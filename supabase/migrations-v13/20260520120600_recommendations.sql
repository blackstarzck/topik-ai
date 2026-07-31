-- =====================================================================
-- TALKPIK AI · Tier 1 MVP
-- 07/12 · recommendation_runs + recommendation_items
-- Spec: docs/development/database-schema.md §1.8
-- =====================================================================

-- ---------------------------------------------------------------------
-- recommendation_runs : execution records (why this set)
-- ---------------------------------------------------------------------
create table if not exists public.recommendation_runs (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references public.profiles(id) on delete cascade,
  source_type     text not null
                  check (source_type in ('dashboard','feedback','weakness','next_problem')),
  source_id       uuid,
  reason_summary  text,
  created_at      timestamptz not null default now(),
  expires_at      timestamptz
);

create index if not exists recommendation_runs_user_source_created
  on public.recommendation_runs (user_id, source_type, created_at desc);

comment on table public.recommendation_runs is
  'Recommendation generation events. One run yields multiple recommendation_items.';

-- ---------------------------------------------------------------------
-- recommendation_items : individual problem suggestions
-- ---------------------------------------------------------------------
create table if not exists public.recommendation_items (
  id                  uuid primary key default gen_random_uuid(),
  run_id              uuid not null references public.recommendation_runs(id) on delete cascade,
  user_id             uuid not null references public.profiles(id) on delete cascade,
  problem_id          uuid not null references public.problems(id) on delete cascade,
  rank                int not null,
  reason              text,
  estimated_minutes   int,
  weakness_tags       text[],
  status              text not null default 'active'
                      check (status in ('active','consumed','expired'))
);

create unique index if not exists recommendation_items_run_problem_uniq
  on public.recommendation_items (run_id, problem_id);

create index if not exists recommendation_items_run_rank
  on public.recommendation_items (run_id, rank);

create index if not exists recommendation_items_user_active
  on public.recommendation_items (user_id)
  where status = 'active';

comment on table public.recommendation_items is
  'Recommended problems with rank and reason. status tracks user interaction.';
