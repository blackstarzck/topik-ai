-- =====================================================================
-- TALKPIK AI · Legal documents projection from admin operation_policies
-- Decision (owner, 2026-06-22): operation_policies (topik-ai admin) is the
-- SINGLE source of truth for legal content; legal_documents is its read-only
-- USER-facing projection. v13 owns legal_documents, so the admin side writes it
-- ONLY through this v13-owned SECURITY DEFINER RPC (ownership boundary).
--
-- This RPC takes the published policy CONTENT (passed in by the admin app, which
-- already reads operation_policies) and writes legal_documents rows. It does NOT
-- read operation_policies — keeping it free of any cross-namespace read coupling.
--
-- Applied to the shared dev DB via the Management API (no CLI/DB password on the
-- build machine). SQL is idempotent (IF NOT EXISTS / CREATE OR REPLACE), so
-- replay in a controlled migration pipeline is harmless.
-- down: supabase/migrations/down/20260622150000_legal_documents_projection.sql
-- =====================================================================

-- Provenance columns: link a projected legal_documents row back to its admin source.
alter table public.legal_documents
  add column if not exists source_policy_id         text,
  add column if not exists source_policy_history_id text,
  add column if not exists source_synced_at         timestamptz;

comment on column public.legal_documents.source_policy_id is
  'Admin operation_policies.id this row was projected from (e.g. POL-001). NULL for legacy/placeholder rows.';

-- ---------------------------------------------------------------------
-- admin_sync_legal_document_from_operation_policy
-- Publishes/refreshes the legal_documents projection for one policy version.
-- - platform_admin gated (the admin's authenticated session calls it).
-- - policy_type -> doc_type mapping (이용약관->terms, 개인정보 처리방침->privacy).
-- - writes locale 'ko' always; 'en' only when an English title+body are supplied.
-- - archives any previously-published rows of the same doc_type that are NOT this
--   version, so exactly the current version stays published per (doc_type, locale).
--   Locales with no row for this version (e.g. vi) fall back to ko in the app.
-- - IMMUTABILITY: republishing the same (doc_type, version, locale) with DIFFERENT
--   body is rejected (append-only history contract); identical content re-syncs OK.
-- ---------------------------------------------------------------------
create or replace function public.admin_sync_legal_document_from_operation_policy(
  p_source_policy_id          text,
  p_source_policy_history_id  text,
  p_policy_type               text,
  p_version                   text,
  p_effective_date            date,
  p_requires_consent          boolean,
  p_title_ko                  text,
  p_body_ko                   text,
  p_summary_ko                text,
  p_title_en                  text,
  p_body_en                   text,
  p_summary_en                text
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  caller_id     uuid := auth.uid();
  v_doc_type    text;
  v_effective   timestamptz := coalesce(p_effective_date::timestamptz, now());
  v_loc         text;
  v_title       text;
  v_body        text;
  v_summary     text;
  v_existing_id uuid;
  v_existing_body text;
  v_id          uuid;
  v_written     jsonb := '[]'::jsonb;
begin
  if caller_id is null then raise exception 'unauthenticated'; end if;
  if not private.is_platform_admin(caller_id) then raise exception 'forbidden: platform admin required'; end if;
  if nullif(btrim(coalesce(p_version, '')), '') is null then raise exception 'version required'; end if;
  if nullif(btrim(coalesce(p_title_ko, '')), '') is null then raise exception 'korean title required'; end if;
  if nullif(btrim(coalesce(p_body_ko, '')), '') is null then raise exception 'korean body required'; end if;

  v_doc_type := case p_policy_type
    when '이용약관' then 'terms'
    when '개인정보 처리방침' then 'privacy'
    else null
  end;
  if v_doc_type is null then
    raise exception 'unsupported policy_type for legal_documents projection: %', p_policy_type;
  end if;

  -- demote prior published versions of this doc_type (keep only the current version)
  update public.legal_documents
     set status = 'archived', updated_at = now()
   where doc_type = v_doc_type
     and status = 'published'
     and version <> p_version;

  for v_loc, v_title, v_body, v_summary in
    select * from (values
      ('ko', p_title_ko, p_body_ko, p_summary_ko),
      ('en', p_title_en, p_body_en, p_summary_en)
    ) as t(locale, title, body, summary)
  loop
    -- skip a locale with no usable content (e.g. English not authored yet)
    if nullif(btrim(coalesce(v_body, '')), '') is null
       or nullif(btrim(coalesce(v_title, '')), '') is null then
      continue;
    end if;

    select id, body into v_existing_id, v_existing_body
      from public.legal_documents
     where doc_type = v_doc_type and version = p_version and locale = v_loc;

    if found then
      if v_existing_body is distinct from v_body then
        raise exception 'immutable version conflict: %/%/% already exists with different content',
          v_doc_type, p_version, v_loc;
      end if;
      update public.legal_documents
         set title = v_title,
             summary = v_summary,
             requires_consent = coalesce(p_requires_consent, true),
             is_placeholder = false,
             status = 'published',
             effective_at = v_effective,
             source_policy_id = p_source_policy_id,
             source_policy_history_id = p_source_policy_history_id,
             source_synced_at = now(),
             updated_at = now()
       where id = v_existing_id;
      v_written := v_written || to_jsonb(v_existing_id);
    else
      insert into public.legal_documents (
        doc_type, version, locale, title, body, summary, is_placeholder,
        requires_consent, status, effective_at,
        source_policy_id, source_policy_history_id, source_synced_at
      ) values (
        v_doc_type, p_version, v_loc, v_title, v_body, v_summary, false,
        coalesce(p_requires_consent, true), 'published', v_effective,
        p_source_policy_id, p_source_policy_history_id, now()
      )
      returning id into v_id;
      v_written := v_written || to_jsonb(v_id);
    end if;
  end loop;

  return jsonb_build_object(
    'doc_type', v_doc_type,
    'version', p_version,
    'written', v_written
  );
end;
$$;

revoke all on function public.admin_sync_legal_document_from_operation_policy(
  text, text, text, text, date, boolean, text, text, text, text, text, text
) from public;
grant execute on function public.admin_sync_legal_document_from_operation_policy(
  text, text, text, text, date, boolean, text, text, text, text, text, text
) to authenticated;
