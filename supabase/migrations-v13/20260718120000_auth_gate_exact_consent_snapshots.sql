-- ============================================================================
-- TALKPIK AI - 2026-07-18 - exact auth consent document snapshots
--
-- The consent page already posts the exact document id/version pairs rendered
-- to the user. The previous RPC accepted only a boolean and re-selected legal
-- documents during the call, so a newly published version could be recorded
-- even though the user never saw it.
--
-- This forward migration adds snapshot-aware overloads. The base overload:
--   * locks legal_documents against concurrent publication for this transaction,
--   * derives the same complete, official localized-or-ko required set as UI,
--   * captures the missing rows once in deterministic id order,
--   * requires exact equality with the submitted id/version JSON array, and
--   * inserts only the captured rows.
--
-- Authenticated access to the unsafe 4/7/9-argument overloads is revoked. The
-- functions remain temporarily present only to avoid a destructive signature
-- drop in environments with cached metadata; they are no longer client-callable.
-- Remote apply is owned by the separate topik-ai operations procedure.
-- ============================================================================

create or replace function public.complete_auth_gate(
  p_display_name text,
  p_nickname text,
  p_nationality_country_code text,
  p_accept_required_consents boolean,
  p_consent_documents jsonb
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
  v_document_locale text;
  v_localized_candidate_count integer := 0;
  v_localized_type_count integer := 0;
  v_candidate_count integer := 0;
  v_candidate_type_count integer := 0;
  v_missing_documents jsonb := '[]'::jsonb;
  v_expected_consent_documents jsonb := '[]'::jsonb;
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
     and public.is_supported_country_code(v_profile.nationality_country_code) then
    v_country := v_profile.nationality_country_code;
  elsif v_country is null or not public.is_supported_country_code(v_country) then
    raise exception 'auth_completion_required: nationality_country_code'
      using errcode = 'P0001';
  end if;

  -- A SHARE table lock allows concurrent readers but conflicts with the row
  -- exclusive lock required by INSERT/UPDATE/DELETE publication changes. This
  -- closes the check/insert race without relying on every publisher to take an
  -- advisory lock.
  lock table public.legal_documents in share mode;

  with ranked as (
    select
      doc_type,
      dense_rank() over (
        partition by doc_type
        order by coalesce(effective_at, created_at) desc
      ) as recency_rank
    from public.legal_documents
    where locale = coalesce(v_profile.ui_locale, 'ko')
      and status = 'published'
      and requires_consent is true
      and source_policy_id is not null
      and is_placeholder is false
  ), latest_candidates as (
    select doc_type
    from ranked
    where recency_rank = 1
  )
  select count(*), count(distinct doc_type)
    into v_localized_candidate_count, v_localized_type_count
  from latest_candidates;

  if v_localized_candidate_count <> v_localized_type_count then
    raise exception 'auth_completion_unavailable: ambiguous_consent_documents'
      using errcode = 'P0001';
  end if;

  if v_localized_type_count = 2 then
    v_document_locale := coalesce(v_profile.ui_locale, 'ko');
  elsif coalesce(v_profile.ui_locale, 'ko') <> 'ko' then
    v_document_locale := 'ko';
  else
    raise exception 'auth_completion_unavailable: consent_documents'
      using errcode = 'P0001';
  end if;

  with ranked as (
    select
      id,
      doc_type,
      version,
      dense_rank() over (
        partition by doc_type
        order by coalesce(effective_at, created_at) desc
      ) as recency_rank
    from public.legal_documents
    where locale = v_document_locale
      and status = 'published'
      and requires_consent is true
      and source_policy_id is not null
      and is_placeholder is false
  ), latest_candidates as (
    select id, doc_type, version
    from ranked
    where recency_rank = 1
  )
  select count(*), count(distinct doc_type)
    into v_candidate_count, v_candidate_type_count
  from latest_candidates;

  if v_candidate_count <> 2 or v_candidate_type_count <> 2 then
    raise exception 'auth_completion_unavailable: consent_documents'
      using errcode = 'P0001';
  end if;

  with ranked as (
    select
      id,
      doc_type,
      version,
      dense_rank() over (
        partition by doc_type
        order by coalesce(effective_at, created_at) desc
      ) as recency_rank
    from public.legal_documents
    where locale = v_document_locale
      and status = 'published'
      and requires_consent is true
      and source_policy_id is not null
      and is_placeholder is false
  ), latest_required_documents as (
    select id, doc_type, version
    from ranked
    where recency_rank = 1
  ), missing_documents as (
    select id, doc_type, version
    from latest_required_documents
    where not exists (
      select 1
      from public.user_consents
      where user_id = v_user_id
        and document_id = latest_required_documents.id
    )
  )
  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id', id::text,
        'doc_type', doc_type,
        'version', version
      )
      order by id
    ),
    '[]'::jsonb
  )
  into v_missing_documents
  from missing_documents;

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id', document->>'id',
        'version', document->>'version'
      )
      order by document->>'id'
    ),
    '[]'::jsonb
  )
  into v_expected_consent_documents
  from jsonb_array_elements(v_missing_documents) as document;

  if jsonb_typeof(p_consent_documents) is distinct from 'array'
     or p_consent_documents is distinct from v_expected_consent_documents then
    raise exception 'auth_completion_stale: consent_documents'
      using errcode = 'P0001';
  end if;

  if jsonb_array_length(v_expected_consent_documents) > 0
     and coalesce(p_accept_required_consents, false) is false then
    raise exception 'auth_completion_required: consent'
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

  insert into public.user_consents (
    user_id,
    document_id,
    doc_type,
    version,
    source
  )
  select
    v_user_id,
    document.id,
    document.doc_type,
    document.version,
    'signup'
  from jsonb_to_recordset(v_missing_documents) as document(
    id uuid,
    doc_type text,
    version text
  );
end;
$$;

create or replace function public.complete_auth_gate(
  p_display_name text,
  p_nickname text,
  p_nationality_country_code text,
  p_gender text,
  p_phone_country_code text,
  p_phone_number text,
  p_accept_required_consents boolean,
  p_consent_documents jsonb
)
returns void
language plpgsql
security definer
set search_path = pg_catalog, public, private
as $$
declare
  v_user_id uuid := auth.uid();
  v_gender text := lower(nullif(btrim(p_gender), ''));
  v_phone_country_code text := upper(nullif(btrim(p_phone_country_code), ''));
  v_phone_number text := nullif(btrim(p_phone_number), '');
begin
  if v_user_id is null then
    raise exception 'auth_completion_required: unauthenticated'
      using errcode = '42501';
  end if;

  if v_gender is not null and v_gender not in ('male', 'female') then
    raise exception 'auth_completion_invalid: gender'
      using errcode = 'P0001';
  end if;

  if v_phone_country_code is not null
     and not public.is_supported_country_code(v_phone_country_code) then
    v_phone_country_code := null;
  end if;

  v_phone_number := nullif(
    left(regexp_replace(coalesce(v_phone_number, ''), '[^0-9]', '', 'g'), 20),
    ''
  );
  if v_phone_number is null then
    v_phone_country_code := null;
  end if;

  perform public.complete_auth_gate(
    p_display_name,
    p_nickname,
    p_nationality_country_code,
    p_accept_required_consents,
    p_consent_documents
  );

  update public.profiles
     set gender = v_gender,
         phone_country_code = v_phone_country_code,
         phone_number = v_phone_number
   where id = v_user_id
     and (
       gender is distinct from v_gender
       or phone_country_code is distinct from v_phone_country_code
       or phone_number is distinct from v_phone_number
     );
end;
$$;

create or replace function public.complete_auth_gate(
  p_display_name text,
  p_nickname text,
  p_nationality_country_code text,
  p_gender text,
  p_phone_country_code text,
  p_phone_number text,
  p_accept_required_consents boolean,
  p_consent_documents jsonb,
  p_ui_locale text,
  p_ui_locale_source text
)
returns void
language plpgsql
security definer
set search_path = pg_catalog, public, private
as $$
declare
  v_user_id uuid := auth.uid();
  v_ui_locale text := case
    when lower(nullif(btrim(p_ui_locale), '')) in ('ko','en','vi')
      then lower(nullif(btrim(p_ui_locale), ''))
    else null
  end;
  v_ui_locale_source text := case
    when lower(nullif(btrim(p_ui_locale_source), '')) in ('auto','manual')
      then lower(nullif(btrim(p_ui_locale_source), ''))
    else null
  end;
begin
  if v_user_id is null then
    raise exception 'auth_completion_required: unauthenticated'
      using errcode = '42501';
  end if;

  if v_ui_locale is not null and v_ui_locale_source is not null then
    update public.profiles
       set ui_locale = v_ui_locale,
           ui_locale_source = v_ui_locale_source
     where id = v_user_id
       and status = 'active'
       and ui_locale_source = 'default';
  end if;

  perform public.complete_auth_gate(
    p_display_name,
    p_nickname,
    p_nationality_country_code,
    p_gender,
    p_phone_country_code,
    p_phone_number,
    p_accept_required_consents,
    p_consent_documents
  );
end;
$$;

-- Unsafe boolean-only overloads stay owner-callable for migration compatibility
-- but are not callable through PostgREST by authenticated users.
revoke all on function public.complete_auth_gate(text, text, text, boolean) from public;
revoke execute on function public.complete_auth_gate(text, text, text, boolean) from anon;
revoke execute on function public.complete_auth_gate(text, text, text, boolean) from authenticated;
revoke all on function public.complete_auth_gate(text, text, text, text, text, text, boolean) from public;
revoke execute on function public.complete_auth_gate(text, text, text, text, text, text, boolean) from anon;
revoke execute on function public.complete_auth_gate(text, text, text, text, text, text, boolean) from authenticated;
revoke all on function public.complete_auth_gate(text, text, text, text, text, text, boolean, text, text) from public;
revoke execute on function public.complete_auth_gate(text, text, text, text, text, text, boolean, text, text) from anon;
revoke execute on function public.complete_auth_gate(text, text, text, text, text, text, boolean, text, text) from authenticated;

revoke all on function public.complete_auth_gate(text, text, text, boolean, jsonb) from public;
revoke execute on function public.complete_auth_gate(text, text, text, boolean, jsonb) from anon;
grant execute on function public.complete_auth_gate(text, text, text, boolean, jsonb) to authenticated;

revoke all on function public.complete_auth_gate(text, text, text, text, text, text, boolean, jsonb) from public;
revoke execute on function public.complete_auth_gate(text, text, text, text, text, text, boolean, jsonb) from anon;
grant execute on function public.complete_auth_gate(text, text, text, text, text, text, boolean, jsonb) to authenticated;

revoke all on function public.complete_auth_gate(text, text, text, text, text, text, boolean, jsonb, text, text) from public;
revoke execute on function public.complete_auth_gate(text, text, text, text, text, text, boolean, jsonb, text, text) from anon;
grant execute on function public.complete_auth_gate(text, text, text, text, text, text, boolean, jsonb, text, text) to authenticated;

comment on function public.complete_auth_gate(text, text, text, boolean, jsonb) is
  'Completes required profile fields and records only the exact current official consent document id/version snapshots displayed to the verified active user.';

comment on function public.complete_auth_gate(text, text, text, text, text, text, boolean, jsonb) is
  'Snapshot-aware auth completion gate with optional gender and split phone fields.';

comment on function public.complete_auth_gate(text, text, text, text, text, text, boolean, jsonb, text, text) is
  'Snapshot-aware auth completion gate with default-source UI locale seeding and optional profile fields.';
