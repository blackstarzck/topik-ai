-- =====================================================================
-- TALKPIK AI · Conformance decision #4 · 2026-06-08
-- problems lifecycle status + problem-level expiry columns
--
-- Backs C-02 (problem list): "비공개/만료 문제는 행 비활성 및 사유 표시".
--
-- DECISION (#4, finalized 2026-06-08): give the PROBLEM ITSELF dedicated
-- status + expiry columns, kept SEPARATE from recommendation expiry
-- (recommendation_runs.expires_at). The expiry *criteria* are intentionally
-- NOT decided yet, so we add the columns ONLY — no auto-expire trigger / cron /
-- computed badge. See docs/ai-workflow/runs/2026/06/08/
-- 20260608-conformance-decisions-finalized.md
--
-- ADMIN-CONTRACT NOTE: admin contract `assessment_questions`
-- (Assessment > TOPIK 쓰기 문제은행) has status fields reviewStatus /
-- operationStatus / validationStatus but NO problem-level expiry field.
-- RECONCILIATION TARGETS (LATER admin-build phase):
--   lifecycle_status  ↔ assessment_questions.operationStatus  (align enum then)
--   expires_at        = net-new (no contract counterpart)
-- `problems` remains an admin-curated shared entity (publish_status /
-- review_status already admin-owned); existing RLS on problems is unchanged
-- (this migration only adds columns).
--
-- additive + idempotent: add column if not exists; drop+recreate the check
-- constraint (mirrors the profiles.learning_locale pattern in
-- 20260602120200_notifications_and_settings.sql). Adding a NOT NULL column with
-- a constant default is a metadata-only change in Postgres (no table rewrite).
-- =====================================================================


-- lifecycle_status : availability lifecycle, DISTINCT from publish_status
-- (editorial publication: draft/published/archived) and review_status
-- (curation approval: pending/approved/rejected).
--   active   = normal, shown on C-02
--   inactive = 비공개 → C-02 row deactivated + reason shown
--   expired  = 만료    → C-02 row deactivated + reason shown
alter table public.problems
  add column if not exists lifecycle_status text not null default 'active';

alter table public.problems
  drop constraint if exists problems_lifecycle_status_check;
alter table public.problems
  add constraint problems_lifecycle_status_check
  check (lifecycle_status in ('active','inactive','expired'));

comment on column public.problems.lifecycle_status is
  'Conformance #4: availability lifecycle (active/inactive/expired). Drives the '
  'C-02 status badge + row-deactivate. Distinct from publish_status (editorial) '
  'and review_status (curation). Admin-owned. Reconciliation target: admin '
  'contract assessment_questions.operationStatus (LATER admin-build phase).';


-- lifecycle_reason : human-readable reason shown next to a deactivated row (C-02 사유 표시).
alter table public.problems
  add column if not exists lifecycle_reason text;

comment on column public.problems.lifecycle_reason is
  'Conformance #4: reason shown on C-02 when a problem is inactive/expired (사유 표시). '
  'Nullable; set when lifecycle_status is inactive or expired.';


-- expires_at : PROBLEM-level expiry timestamp. Deliberately SEPARATE from
-- recommendation_runs.expires_at (which expires a recommendation event, not a
-- problem). Nullable = no expiry. Criteria undecided → stored value only, no
-- auto logic derives lifecycle_status from this yet.
alter table public.problems
  add column if not exists expires_at timestamptz;

comment on column public.problems.expires_at is
  'Conformance #4: problem-level expiry timestamp (distinct from '
  'recommendation_runs.expires_at). Nullable = no expiry. Expiry CRITERIA are '
  'deferred — no auto-expire trigger/cron derives lifecycle_status from this yet.';


-- Partial index for C-02 filtering of the (rare) non-active problems; the common
-- 'active' rows are excluded to keep the index small.
create index if not exists problems_lifecycle_inactive
  on public.problems (lifecycle_status)
  where lifecycle_status <> 'active';
