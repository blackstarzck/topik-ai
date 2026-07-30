-- =====================================================================
-- TALKPIK AI · Tier 1 MVP
-- 05/12 · writing_drafts (mutable) + writing_submissions (immutable)
-- Spec: docs/development/database-schema.md §1.5
-- =====================================================================

-- ---------------------------------------------------------------------
-- writing_drafts : autosave / mutable
-- ---------------------------------------------------------------------
create table if not exists public.writing_drafts (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null references public.profiles(id) on delete cascade,
  problem_id       uuid not null references public.problems(id) on delete cascade,
  question_no      smallint not null check (question_no in (51,52,53,54)),
  answer_text      text,
  answer_json      jsonb,
  char_count       int,
  autosave_status  text not null default 'clean'
                   check (autosave_status in ('clean','dirty','syncing','failed','superseded')),
  last_saved_at    timestamptz,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

create index if not exists writing_drafts_user_updated
  on public.writing_drafts (user_id, updated_at desc);

create index if not exists writing_drafts_user_status
  on public.writing_drafts (user_id, autosave_status);

-- 활성 draft 1개 보장 (같은 user, problem 에서 superseded 가 아닌 것은 1개만)
create unique index if not exists writing_drafts_active_unique
  on public.writing_drafts (user_id, problem_id)
  where autosave_status <> 'superseded';

comment on table public.writing_drafts is
  'Mutable per-attempt draft with autosave. Partial unique enforces one active draft per (user, problem).';

-- ---------------------------------------------------------------------
-- writing_submissions : immutable submitted answer
-- ---------------------------------------------------------------------
create table if not exists public.writing_submissions (
  id                    uuid primary key default gen_random_uuid(),
  user_id               uuid not null references public.profiles(id) on delete cascade,
  problem_id            uuid not null references public.problems(id) on delete restrict,
  draft_id              uuid references public.writing_drafts(id) on delete set null,
  question_no           smallint not null check (question_no in (51,52,53,54)),
  answer_text           text not null,
  answer_json           jsonb,
  char_count            int not null,
  submitted_at          timestamptz not null default now(),
  feedback_status       text not null default 'pending'
                        check (feedback_status in ('pending','analyzing','complete','failed')),
  parent_submission_id  uuid references public.writing_submissions(id) on delete set null
);

create index if not exists writing_submissions_user_submitted
  on public.writing_submissions (user_id, submitted_at desc);

create index if not exists writing_submissions_problem_user
  on public.writing_submissions (problem_id, user_id);

create index if not exists writing_submissions_pending
  on public.writing_submissions (feedback_status)
  where feedback_status in ('pending','analyzing');

create index if not exists writing_submissions_parent
  on public.writing_submissions (parent_submission_id)
  where parent_submission_id is not null;

comment on table public.writing_submissions is
  'Immutable submitted writing answer. RLS allows insert/select only — update/delete disabled.';
