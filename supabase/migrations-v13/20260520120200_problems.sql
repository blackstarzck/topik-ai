-- =====================================================================
-- TALKPIK AI · Tier 1 MVP
-- 03/12 · problems + problem_assets
-- Spec: docs/development/database-schema.md §1.3
-- =====================================================================

-- ---------------------------------------------------------------------
-- problems : AI-generated + admin-curated unified table
-- ---------------------------------------------------------------------
create table if not exists public.problems (
  id              uuid primary key default gen_random_uuid(),
  source          text not null default 'ai_generated'
                  check (source in ('ai_generated','curated')),
  author_id       uuid references public.profiles(id) on delete set null,
  domain          text not null check (domain in ('reading','listening','writing')),
  question_no     smallint
                  check (question_no is null or question_no in (51,52,53,54)),
  topik_level     smallint not null check (topik_level in (1,2)),
  difficulty      smallint check (difficulty is null or difficulty between 1 and 5),
  title           text not null,
  prompt          text not null,
  materials       jsonb,
  answer_key      jsonb,
  rubric          jsonb,
  explanation     text,
  tags            text[] not null default '{}',
  publish_status  text not null default 'draft'
                  check (publish_status in ('draft','published','archived')),
  review_status   text not null default 'pending'
                  check (review_status in ('pending','approved','rejected')),
  visibility      text not null default 'private'
                  check (visibility in ('private','public','org')),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index if not exists problems_domain_qno_level
  on public.problems (domain, question_no, topik_level);

create index if not exists problems_tags_gin
  on public.problems using gin (tags);

create index if not exists problems_curated_status
  on public.problems (publish_status, review_status)
  where source = 'curated';

create index if not exists problems_ai_author
  on public.problems (author_id)
  where source = 'ai_generated';

comment on table public.problems is
  'Unified problem catalog for AI-generated and admin-curated items.';

-- ---------------------------------------------------------------------
-- problem_assets : image/audio attachments
-- ---------------------------------------------------------------------
create table if not exists public.problem_assets (
  id            uuid primary key default gen_random_uuid(),
  problem_id    uuid not null references public.problems(id) on delete cascade,
  storage_path  text not null,
  asset_type    text not null check (asset_type in ('image','audio')),
  sort_order    int not null default 0
);

create index if not exists problem_assets_problem_sort
  on public.problem_assets (problem_id, sort_order);

comment on table public.problem_assets is
  'Per-problem assets. storage_path lives in bucket problem-assets.';
