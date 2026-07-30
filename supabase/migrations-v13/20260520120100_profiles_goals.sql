-- =====================================================================
-- TALKPIK AI · Tier 1 MVP
-- 02/12 · profiles + learning_goals
-- Spec: docs/development/database-schema.md §1.1, §1.2
-- =====================================================================

-- ---------------------------------------------------------------------
-- profiles : auth.users 1:1 mirror with trusted role/plan/status
-- ---------------------------------------------------------------------
create table if not exists public.profiles (
  id            uuid primary key references auth.users(id) on delete cascade,
  display_name  text,
  nickname      citext,
  avatar_path   text,
  ui_locale     text not null default 'ko'
                check (ui_locale in ('ko','en','vi')),
  app_role      text not null default 'learner'
                check (app_role in ('learner','content_admin','org_admin','platform_admin')),
  plan_label    text not null default 'free',
  status        text not null default 'active'
                check (status in ('active','blocked','deleted')),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create unique index if not exists profiles_nickname_lower_uniq
  on public.profiles ( (lower(nickname)) )
  where nickname is not null;

comment on table public.profiles is
  'Per-user trusted attributes (role, plan, status). 1:1 mirror of auth.users.';
comment on column public.profiles.app_role is
  'Authorization role. Never source from JWT/user metadata.';

-- ---------------------------------------------------------------------
-- learning_goals : A-03 single active learning goal per user
-- ---------------------------------------------------------------------
create table if not exists public.learning_goals (
  user_id              uuid primary key references public.profiles(id) on delete cascade,
  topik_level          text not null check (topik_level in ('TOPIK_I','TOPIK_II')),
  target_grade         smallint not null check (target_grade between 1 and 6),
  exam_date            date,
  weekly_goal_minutes  int,
  weak_areas           text[] not null default '{}',
  is_active            boolean not null default true,
  updated_at           timestamptz not null default now()
);

create index if not exists learning_goals_weak_areas_gin
  on public.learning_goals using gin (weak_areas);

comment on table public.learning_goals is
  'Per-user active TOPIK learning goal. One row per user.';
