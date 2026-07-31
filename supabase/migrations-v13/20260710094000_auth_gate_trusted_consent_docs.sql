-- ============================================================================
-- TALKPIK AI - 2026-07-10 - align auth-gate required consent docs with trust filter
--
-- BUG: public.complete_auth_gate(text,text,text,boolean) (the base overload that
-- 7/9-arg gender/phone/locale overloads delegate to) selects "required consent
-- documents" with only `status = 'published' AND requires_consent IS TRUE`.
-- It does NOT apply the trust filter the application layer uses
-- (src/lib/legal/consent.ts fetchRequiredConsentDocuments:
--   .or("source_policy_id.not.is.null,is_placeholder.is.true")).
--
-- Effect: if an UNTRUSTED published legal_documents row (no source_policy_id and
-- not a placeholder — e.g. leftover E2E seeds) exists for a doc_type and is newer
-- than the trusted row, the RPC's `latest per doc_type` picks the untrusted row
-- and records user_consents against it, while the TS gate
-- (getMissingRequiredConsentDocuments -> hasCompletedRequiredConsent) checks the
-- TRUSTED row. The two disagree, so post-auth keeps redirecting the user back to
-- /auth/consent (permanent bounce) even though the RPC "succeeded".
--
-- FIX: add the same trust filter `(source_policy_id is not null or is_placeholder
-- is true)` to all four legal_documents selections inside the base overload
-- (count CTE localized + ko-fallback, insert CTE localized + ko-fallback). No
-- other behavior changes; body is otherwise identical to 20260623103000.
--
-- Forward-only. create-or-replace preserves the existing function ACL; grants are
-- re-asserted defensively (authenticated only, anon revoked) to match the
-- 20260625001257 hardening. Remote apply is handled by the separate ops procedure
-- (not applied from v13).
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
      and (source_policy_id is not null or is_placeholder is true)
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
      and (source_policy_id is not null or is_placeholder is true)
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
        and (source_policy_id is not null or is_placeholder is true)
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
        and (source_policy_id is not null or is_placeholder is true)
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
revoke execute on function public.complete_auth_gate(text, text, text, boolean) from anon;
grant execute on function public.complete_auth_gate(text, text, text, boolean) to authenticated;

comment on function public.complete_auth_gate(text, text, text, boolean) is
  'Completes required profile fields and records required consents in one transaction. Required consent documents are restricted to trusted rows (source_policy_id set or placeholder) to match the application consent gate, so untrusted/leftover published documents cannot desync consent recording vs the post-auth check.';
