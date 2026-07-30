-- =====================================================================
-- TALKPIK AI · Tier 1 MVP
-- 08/12 · library_items (polymorphic) + study_events (ledger) + export_files
-- Spec: docs/development/database-schema.md §1.9, §1.10, §1.11
-- =====================================================================

-- ---------------------------------------------------------------------
-- export_files : created BEFORE library_items so library_items.export_id can FK
-- ---------------------------------------------------------------------
create table if not exists public.export_files (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references public.profiles(id) on delete cascade,
  source_type   text not null
                check (source_type in ('submission','report','library_selection')),
  source_id     uuid,
  storage_path  text not null,
  options       jsonb,
  status        text not null default 'queued'
                check (status in ('queued','ready','failed')),
  created_at    timestamptz not null default now(),
  ready_at      timestamptz
);

create index if not exists export_files_user_created
  on public.export_files (user_id, created_at desc);

create index if not exists export_files_pending
  on public.export_files (status)
  where status in ('queued','failed');

comment on table public.export_files is
  'User-generated exports (PDF etc). storage_path lives in bucket generated-exports (private).';

-- ---------------------------------------------------------------------
-- library_items : polymorphic per F-01 "내 서재"
--   exactly one of attempt_id / submission_id / report_id / export_id / problem_id
-- ---------------------------------------------------------------------
create table if not exists public.library_items (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references public.profiles(id) on delete cascade,
  item_type       text not null
                  check (item_type in ('attempt','submission','report','export','problem')),
  attempt_id      uuid references public.problem_attempts(id)    on delete cascade,
  submission_id   uuid references public.writing_submissions(id) on delete cascade,
  report_id       uuid references public.comparison_reports(id)  on delete cascade,
  export_id       uuid references public.export_files(id)        on delete cascade,
  problem_id      uuid references public.problems(id)            on delete cascade,
  note            text,
  tags            text[] not null default '{}',
  saved_at        timestamptz not null default now(),

  -- exactly one of *_id is non-null
  constraint library_items_exactly_one_target check (
    (case when attempt_id    is not null then 1 else 0 end +
     case when submission_id is not null then 1 else 0 end +
     case when report_id     is not null then 1 else 0 end +
     case when export_id     is not null then 1 else 0 end +
     case when problem_id    is not null then 1 else 0 end) = 1
  ),

  -- item_type matches the populated *_id
  constraint library_items_type_matches check (
    (item_type = 'attempt'    and attempt_id    is not null) or
    (item_type = 'submission' and submission_id is not null) or
    (item_type = 'report'     and report_id     is not null) or
    (item_type = 'export'     and export_id     is not null) or
    (item_type = 'problem'    and problem_id    is not null)
  )
);

create index if not exists library_items_user_type_saved
  on public.library_items (user_id, item_type, saved_at desc);

create index if not exists library_items_tags_gin
  on public.library_items using gin (tags);

-- 동일 (user, target) 중복 저장 방지 (각 target 종류별)
create unique index if not exists library_items_user_attempt_uniq
  on public.library_items (user_id, attempt_id)    where attempt_id    is not null;
create unique index if not exists library_items_user_submission_uniq
  on public.library_items (user_id, submission_id) where submission_id is not null;
create unique index if not exists library_items_user_report_uniq
  on public.library_items (user_id, report_id)     where report_id     is not null;
create unique index if not exists library_items_user_export_uniq
  on public.library_items (user_id, export_id)     where export_id     is not null;
create unique index if not exists library_items_user_problem_uniq
  on public.library_items (user_id, problem_id)    where problem_id    is not null;

comment on table public.library_items is
  'F-01 "내 서재" polymorphic saves. Exactly one of *_id is non-null per row.';

-- ---------------------------------------------------------------------
-- study_events : per-user time-series ledger for dashboards / analytics
-- ---------------------------------------------------------------------
create table if not exists public.study_events (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null references public.profiles(id) on delete cascade,
  event_type     text not null,
  occurred_at    timestamptz not null default now(),
  problem_id     uuid references public.problems(id)            on delete set null,
  submission_id  uuid references public.writing_submissions(id) on delete set null,
  attempt_id     uuid references public.problem_attempts(id)    on delete set null,
  session_id     uuid,
  payload        jsonb
);

create index if not exists study_events_user_occurred
  on public.study_events (user_id, occurred_at desc);

create index if not exists study_events_user_type_occurred
  on public.study_events (user_id, event_type, occurred_at desc);

create index if not exists study_events_session
  on public.study_events (session_id)
  where session_id is not null;

comment on table public.study_events is
  'Per-user event ledger. event_type catalog frozen separately (practice_started, attempt_submitted, draft_autosaved, submission_submitted, feedback_viewed, report_viewed, recommendation_clicked, export_downloaded).';
