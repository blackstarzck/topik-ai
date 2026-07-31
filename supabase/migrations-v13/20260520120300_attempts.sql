-- =====================================================================
-- TALKPIK AI · Tier 1 MVP
-- 04/12 · problem_attempts (objective reading/listening attempts)
-- Spec: docs/development/database-schema.md §1.4
-- =====================================================================

create table if not exists public.problem_attempts (
  id                  uuid primary key default gen_random_uuid(),
  user_id             uuid not null references public.profiles(id) on delete cascade,
  problem_id          uuid not null references public.problems(id) on delete cascade,
  selected_answer     jsonb,
  is_correct          boolean,
  score               numeric(5,2),
  status              text not null default 'started'
                      check (status in ('started','submitted','reviewed')),
  started_at          timestamptz not null default now(),
  submitted_at        timestamptz,
  bookmarked          boolean not null default false,
  time_spent_seconds  int
);

create index if not exists attempts_user_submitted
  on public.problem_attempts (user_id, submitted_at desc);

create index if not exists attempts_problem_user
  on public.problem_attempts (problem_id, user_id);

create index if not exists attempts_user_wrong
  on public.problem_attempts (user_id, is_correct)
  where is_correct = false;

create index if not exists attempts_user_bookmarked
  on public.problem_attempts (user_id)
  where bookmarked = true;

comment on table public.problem_attempts is
  'Objective (reading/listening) attempts. Writing flow uses writing_submissions.';
