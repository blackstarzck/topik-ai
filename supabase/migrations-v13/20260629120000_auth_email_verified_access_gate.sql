-- ============================================================================
-- TALKPIK AI - 2026-06-29 - email verified access gate hardening
--
-- Keep profile status (`profiles.status = 'active'`) separate from Supabase
-- Auth email verification. Protected resources and signup completion require
-- both an active profile and `auth.users.email_confirmed_at is not null`.
-- ============================================================================

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

  if not private.is_email_confirmed(v_user_id) then
    raise exception 'auth_completion_required: email_unverified'
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
  'Completes the single /auth/consent gate for the current active and email-confirmed user by filling required profile fields and recording missing required consents in one transaction.';

drop policy if exists user_consents_owner_insert on public.user_consents;
create policy user_consents_owner_insert
  on public.user_consents
  for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and private.is_email_confirmed((select auth.uid()))
    and exists (
      select 1
      from public.profiles
      where profiles.id = (select auth.uid())
        and profiles.status = 'active'
    )
  );
