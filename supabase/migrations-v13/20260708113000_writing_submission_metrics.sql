-- =====================================================================
-- TALKPIK AI · Writing submission time metrics
--
-- Purpose (learning-data collection Phase 1, owner decision 2026-07-08):
--   TOPIK writing 51~54 per-submission solve-time metrics. The on-screen
--   timer (`elapsedSeconds`) was display-only and never persisted; admin
--   learning analytics needs a writing-native time source. Owner decided
--   AGAINST reusing `problem_attempts` (objective-attempt semantics) and
--   FOR a writing-only metrics contract.
--
-- Contract (SoT — keep this comment in lockstep with consumers):
--   - One row per writing submission (PK = submission_id). Immutable:
--     insert-once by the submitting learner, no update/delete policies.
--   - elapsed_seconds  = on-screen timer seconds while the workspace was
--     mounted (background-tab throttling may make this differ from
--     submitted_at - started_at; both are kept on purpose).
--   - active_seconds   = seconds where the learner typed within the last
--     30s window (typing-engagement, always <= elapsed_seconds).
--   - No answer text / draft body / feedback narrative — numbers and ids
--     only (same PII stance as study_events payload guard).
--   - Readers: learner reads own rows; topik-ai admin reads via its own
--     read-only SECURITY DEFINER aggregate RPCs (no v13 code change).
--   - 0 vs not-collected: absence of a row means "not collected"
--     (submissions predating this migration have no row). Consumers must
--     not render missing rows as "0 min".
-- =====================================================================

create table if not exists public.writing_submission_metrics (
  submission_id   uuid primary key references public.writing_submissions(id) on delete cascade,
  user_id         uuid not null references public.profiles(id) on delete cascade,
  problem_id      uuid references public.problems(id) on delete set null,
  question_no     int check (question_no between 51 and 54),
  elapsed_seconds int not null check (elapsed_seconds between 0 and 86400),
  active_seconds  int check (
    active_seconds is null
    or (active_seconds >= 0 and active_seconds <= elapsed_seconds)
  ),
  started_at      timestamptz,
  submitted_at    timestamptz not null default now(),
  created_at      timestamptz not null default now()
);

create index if not exists writing_submission_metrics_user_submitted
  on public.writing_submission_metrics (user_id, submitted_at desc);

create index if not exists writing_submission_metrics_question
  on public.writing_submission_metrics (question_no, submitted_at desc);

comment on table public.writing_submission_metrics is
  'Writing 51~54 per-submission solve-time metrics (learning-data Phase 1). '
  'One immutable row per submission: elapsed_seconds = mounted timer, '
  'active_seconds = typing-engaged seconds (30s idle window), no content/PII. '
  'Missing row = not collected (never render as 0). Admin reads via '
  'topik-ai read-only aggregate RPCs; do not reuse problem_attempts for writing.';

alter table public.writing_submission_metrics enable row level security;
alter table public.writing_submission_metrics force row level security;

drop policy if exists writing_submission_metrics_owner_select
  on public.writing_submission_metrics;
create policy writing_submission_metrics_owner_select
  on public.writing_submission_metrics
  for select to authenticated
  using (
    user_id = (select auth.uid())
    or private.is_admin((select auth.uid()))
  );

drop policy if exists writing_submission_metrics_owner_insert
  on public.writing_submission_metrics;
create policy writing_submission_metrics_owner_insert
  on public.writing_submission_metrics
  for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and exists (
      select 1
      from public.writing_submissions ws
      where ws.id = writing_submission_metrics.submission_id
        and ws.user_id = (select auth.uid())
        and ws.problem_id is not distinct from writing_submission_metrics.problem_id
        and ws.question_no is not distinct from writing_submission_metrics.question_no
    )
  );

-- No update/delete policies on purpose: the metric is an immutable
-- write-once measurement; corrections happen by new submissions.
