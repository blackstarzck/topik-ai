-- =====================================================================
-- TALKPIK AI · Conformance decision #2 · 2026-06-08
-- Versioned legal documents (terms/privacy) + per-user consent ledger
--
-- Backs A-01 (signup terms link/consent), D-M1 (submission consent),
-- X-13 (terms page + "re-consent on official publication"), X-14 (privacy).
--
-- DECISION (#2 = B, finalized 2026-06-08): store each policy document PER
-- VERSION, and record which version each user accepted and when.
-- See docs/ai-workflow/runs/2026/06/08/20260608-conformance-decisions-finalized.md
--
-- ADMIN-CONTRACT MAPPING (topik-ai/docs/specs/admin-data-contract.md):
--   legal_documents  ≈ Operation > 정책 관리 `operation_policies`
--                       + version history `operation_policy_histories`
--   requires_consent ≈ admin contract field `requiresConsent`
--   doc_type / version / effective_at / body
--                    ≈ category|policyType / versionLabel / effectiveDate / bodyHtml
-- Admin authors policies; the LATER admin-build phase reconciles names to the
-- contract. These v13 tables follow v13's own snake_case conventions (cf.
-- problems, subscription_plans) and are the source the USER screens read.
--
-- Conventions copied from 20260602120100_billing.sql:
--   enable+force RLS · public read of published rows · admin-all via
--   private.is_platform_admin · owner-scoped consent · public.touch_updated_at.
-- =====================================================================


-- ---------------------------------------------------------------------
-- legal_documents : one row per (doc_type, version, locale). Append-only
-- history — a new version is a NEW row; existing rows are never rewritten.
-- ---------------------------------------------------------------------
create table if not exists public.legal_documents (
  id               uuid primary key default gen_random_uuid(),
  doc_type         text not null
                   check (doc_type in ('terms','privacy')),
  version          text not null,
  locale           text not null default 'ko'
                   check (locale in ('ko','en','vi')),
  title            text not null,
  body             text not null,
  summary          text,
  is_placeholder   boolean not null default true,
  requires_consent boolean not null default true,
  status           text not null default 'draft'
                   check (status in ('draft','published','archived')),
  effective_at     timestamptz,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

-- one row per version per locale of a given document type
create unique index if not exists legal_documents_type_version_locale
  on public.legal_documents (doc_type, version, locale);

-- fast "current published doc for this type+locale" lookup (X-13/X-14)
create index if not exists legal_documents_type_locale_status
  on public.legal_documents (doc_type, locale, status, effective_at desc);

comment on table public.legal_documents is
  'Versioned terms/privacy documents (conformance #2). One row per version; '
  'append-only history. Admin-authored (maps to admin operation_policies / '
  'operation_policy_histories); USER screens read published rows (X-13/X-14).';


-- ---------------------------------------------------------------------
-- user_consents : append-only acceptance ledger. One row per accept event;
-- rows are immutable (no updated_at, no client UPDATE/DELETE).
-- ---------------------------------------------------------------------
create table if not exists public.user_consents (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references public.profiles(id) on delete cascade,
  document_id  uuid not null references public.legal_documents(id) on delete restrict,
  doc_type     text not null
               check (doc_type in ('terms','privacy')),
  version      text not null,
  source       text not null default 'signup'
               check (source in ('signup','re_consent','settings')),
  accepted_at  timestamptz not null default now(),
  created_at   timestamptz not null default now()
);

create index if not exists user_consents_user_accepted
  on public.user_consents (user_id, accepted_at desc);

create index if not exists user_consents_document
  on public.user_consents (document_id);

comment on table public.user_consents is
  'Per-user consent ledger (conformance #2): which legal_documents version a '
  'user accepted and when. Append-only; owner read + owner insert, writes also '
  'via service_role/RPC (signup A-01, re-consent X-13). doc_type/version '
  'denormalized for audit stability across document changes.';


-- ---------------------------------------------------------------------
-- updated_at autoupdate (legal_documents only; user_consents is immutable)
-- ---------------------------------------------------------------------
drop trigger if exists trg_legal_documents_touch_updated_at on public.legal_documents;
create trigger trg_legal_documents_touch_updated_at
  before update on public.legal_documents
  for each row execute function public.touch_updated_at();


-- =====================================================================
-- RLS
-- =====================================================================

-- legal_documents : anyone (incl. anon, since X-13/X-14 are PUBLIC pages
-- reachable before signup) may read PUBLISHED docs; platform admin reads all
-- and is the sole writer (authoring also via service_role).
alter table public.legal_documents enable row level security;
alter table public.legal_documents force  row level security;

drop policy if exists legal_documents_published_read on public.legal_documents;
create policy legal_documents_published_read
  on public.legal_documents
  for select to anon, authenticated
  using ( status = 'published' or private.is_platform_admin((select auth.uid())) );

drop policy if exists legal_documents_admin_all on public.legal_documents;
create policy legal_documents_admin_all
  on public.legal_documents
  for all to authenticated
  using ( private.is_platform_admin((select auth.uid())) )
  with check ( private.is_platform_admin((select auth.uid())) );


-- user_consents : owner reads own + admin reads; owner may INSERT own.
-- No UPDATE/DELETE policy → ledger rows are immutable. service_role bypasses
-- RLS for signup/backfill writes.
alter table public.user_consents enable row level security;
alter table public.user_consents force  row level security;

drop policy if exists user_consents_owner_select on public.user_consents;
create policy user_consents_owner_select
  on public.user_consents
  for select to authenticated
  using ( user_id = (select auth.uid()) or private.is_platform_admin((select auth.uid())) );

drop policy if exists user_consents_owner_insert on public.user_consents;
create policy user_consents_owner_insert
  on public.user_consents
  for insert to authenticated
  with check ( user_id = (select auth.uid()) );
