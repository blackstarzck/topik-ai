-- =====================================================================
-- TALKPIK AI - 2026-06-23 - auth completion gate
--
-- Keep /auth/consent as the single sign-up completion gate: required
-- profile fields + required legal consents are completed in one DB
-- transaction. Also restores the final auth bootstrap trigger so all profile
-- seed fields survive later handle_new_user() redefinitions.
-- =====================================================================

update public.profiles
set nickname = ('talkpik-' || substr(replace(id::text, '-', ''), 1, 12))::citext
where nickname is null or btrim(nickname::text) = '';

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public, private
as $$
declare
  v_attempt int := 0;
  v_affiliation_code text := nullif(btrim(new.raw_user_meta_data->>'affiliation_code'), '');
  v_nickname citext;
begin
  if v_affiliation_code is not null
     and v_affiliation_code !~ '^[A-Za-z0-9_-]{2,64}$' then
    v_affiliation_code := null;
  end if;

  loop
    v_attempt := v_attempt + 1;
    v_nickname := private.generate_default_nickname();

    begin
      insert into public.profiles (id, display_name, nationality_country_code, affiliation_code, nickname)
      values (
        new.id,
        nullif(btrim(new.raw_user_meta_data->>'display_name'), ''),
        upper(nullif(btrim(new.raw_user_meta_data->>'nationality_country_code'), '')),
        v_affiliation_code,
        v_nickname
      )
      on conflict (id) do nothing;
      return new;
    exception
      when unique_violation then
        if v_attempt >= 5 then
          raise;
        end if;
    end;
  end loop;
end;
$$;

revoke all on function public.handle_new_user() from public;

comment on function public.handle_new_user() is
  'After insert on auth.users, create matching public.profiles row idempotently '
  'and seed display_name/nationality_country_code/affiliation_code from metadata '
  'plus a required non-identifying random nickname. SECURITY DEFINER with locked search_path. Auth completion gate 2026-06-23.';

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row
  execute function public.handle_new_user();

create or replace function public.complete_auth_gate(
  p_display_name text,
  p_nickname text,
  p_nationality_country_code text,
  p_accept_required_consents boolean
)
returns void
language plpgsql
security definer
set search_path = pg_catalog, public, private
as $$
declare
  v_user_id uuid := auth.uid();
  v_profile record;
  v_display_name text := nullif(btrim(p_display_name), '');
  v_nickname text := nullif(btrim(p_nickname), '');
  v_country text := upper(nullif(btrim(p_nationality_country_code), ''));
  v_missing_document_count integer := 0;
begin
  if v_user_id is null then
    raise exception 'auth_completion_required: unauthenticated'
      using errcode = '42501';
  end if;

  select
    id,
    display_name,
    nickname::text as nickname,
    nationality_country_code,
    ui_locale,
    status
  into v_profile
  from public.profiles
  where id = v_user_id
  for update;

  if not found then
    raise exception 'auth_completion_required: profile_missing'
      using errcode = 'P0002';
  end if;

  if v_profile.status is distinct from 'active' then
    raise exception 'auth_completion_required: account_inactive'
      using errcode = '42501';
  end if;

  if v_profile.display_name is not null
     and length(btrim(v_profile.display_name)) between 2 and 30 then
    v_display_name := btrim(v_profile.display_name);
  elsif v_display_name is null
        or length(v_display_name) < 2
        or length(v_display_name) > 30 then
    raise exception 'auth_completion_required: display_name'
      using errcode = 'P0001';
  end if;

  if v_profile.nickname is not null
     and length(btrim(v_profile.nickname)) between 2 and 20 then
    v_nickname := btrim(v_profile.nickname);
  elsif v_nickname is null
        or length(v_nickname) < 2
        or length(v_nickname) > 20 then
    raise exception 'auth_completion_required: nickname'
      using errcode = 'P0001';
  end if;

  if v_profile.nationality_country_code is not null
     and v_profile.nationality_country_code ~ '^[A-Z]{2}$' then
    v_country := v_profile.nationality_country_code;
  elsif v_country is null or v_country !~ '^[A-Z]{2}$' then
    raise exception 'auth_completion_required: nationality_country_code'
      using errcode = 'P0001';
  end if;

  update public.profiles
     set display_name = v_display_name,
         nickname = v_nickname::citext,
         nationality_country_code = v_country
   where id = v_user_id
     and (
       display_name is distinct from v_display_name
       or nickname::text is distinct from v_nickname
       or nationality_country_code is distinct from v_country
     );

  with localized_required_documents as (
    select *
    from public.legal_documents
    where locale = coalesce(v_profile.ui_locale, 'ko')
      and status = 'published'
      and requires_consent is true
  ),
  required_documents as (
    select *
    from localized_required_documents
    union all
    select *
    from public.legal_documents
    where locale = 'ko'
      and status = 'published'
      and requires_consent is true
      and not exists (select 1 from localized_required_documents)
  ),
  latest_required_documents as (
    select id, doc_type, version
    from (
      select
        required_documents.*,
        row_number() over (
          partition by doc_type
          order by coalesce(effective_at, created_at) desc
        ) as rn
      from required_documents
    ) ranked
    where rn = 1
  ),
  missing_documents as (
    select latest_required_documents.*
    from latest_required_documents
    where not exists (
      select 1
      from public.user_consents
      where user_id = v_user_id
        and document_id = latest_required_documents.id
    )
  )
  select count(*) into v_missing_document_count
  from missing_documents;

  if v_missing_document_count > 0
     and coalesce(p_accept_required_consents, false) is false then
    raise exception 'auth_completion_required: consent'
      using errcode = 'P0001';
  end if;

  if v_missing_document_count > 0 then
    with localized_required_documents as (
      select *
      from public.legal_documents
      where locale = coalesce(v_profile.ui_locale, 'ko')
        and status = 'published'
        and requires_consent is true
    ),
    required_documents as (
      select *
      from localized_required_documents
      union all
      select *
      from public.legal_documents
      where locale = 'ko'
        and status = 'published'
        and requires_consent is true
        and not exists (select 1 from localized_required_documents)
    ),
    latest_required_documents as (
      select id, doc_type, version
      from (
        select
          required_documents.*,
          row_number() over (
            partition by doc_type
            order by coalesce(effective_at, created_at) desc
          ) as rn
        from required_documents
      ) ranked
      where rn = 1
    ),
    missing_documents as (
      select latest_required_documents.*
      from latest_required_documents
      where not exists (
        select 1
        from public.user_consents
        where user_id = v_user_id
          and document_id = latest_required_documents.id
      )
    )
    insert into public.user_consents (
      user_id,
      document_id,
      doc_type,
      version,
      source
    )
    select
      v_user_id,
      id,
      doc_type,
      version,
      'signup'
    from missing_documents;
  end if;
end;
$$;

revoke all on function public.complete_auth_gate(text, text, text, boolean) from public;
grant execute on function public.complete_auth_gate(text, text, text, boolean) to authenticated;

comment on function public.complete_auth_gate(text, text, text, boolean) is
  'Completes the single /auth/consent gate for the current active user by filling required profile fields and recording missing required consents in one transaction.';
