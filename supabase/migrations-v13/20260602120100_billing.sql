-- =====================================================================
-- TALKPIK AI · Conformance · 2026-06-02
-- Billing: subscriptions + subscription_plans + payment_history
--
-- Backs X-03 (plan/pricing surface) and the account billing views.
--   - subscriptions       : per-user subscription state (owner-only + admin read)
--   - subscription_plans  : public catalog (authenticated reads active plans)
--   - payment_history     : per-user receipts (owner-only)
--
-- Conventions copied from existing migrations:
--   - enable + force RLS on every table
--   - owner policies wrap auth.uid() in (select ...) for InitPlan optimization
--   - admin read via private.is_platform_admin (20260521140000)
--   - updated_at autoupdate via public.touch_updated_at (20260520120900)
-- =====================================================================


-- ---------------------------------------------------------------------
-- subscription_plans : public plan catalog (X-03 price rendering)
-- plan_key is a stable text PK referenced by subscriptions.plan_key.
-- ---------------------------------------------------------------------
create table if not exists public.subscription_plans (
  plan_key     text primary key,
  name         text not null,
  cadence      text not null
               check (cadence in ('monthly','quarterly','yearly')),
  price_cents  int not null,
  currency     text not null default 'KRW',
  features     jsonb not null default '[]'::jsonb,
  recommended  boolean not null default false,
  active       boolean not null default true,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create index if not exists subscription_plans_active_cadence
  on public.subscription_plans (active, cadence);

comment on table public.subscription_plans is
  'Public plan catalog. authenticated may read active plans (X-03). Admin-managed pricing.';


-- ---------------------------------------------------------------------
-- subscriptions : per-user subscription state
-- ---------------------------------------------------------------------
create table if not exists public.subscriptions (
  id                       uuid primary key default gen_random_uuid(),
  user_id                  uuid not null references public.profiles(id) on delete cascade,
  plan_key                 text references public.subscription_plans(plan_key) on delete set null,
  billing_cadence          text not null
                           check (billing_cadence in ('monthly','quarterly','yearly')),
  status                   text not null default 'active'
                           check (status in ('active','canceled','past_due','trialing','paused')),
  current_period_start     timestamptz,
  current_period_end       timestamptz,
  cancel_at                timestamptz,
  provider                 text,
  provider_subscription_id text,
  created_at               timestamptz not null default now(),
  updated_at               timestamptz not null default now()
);

create index if not exists subscriptions_user_status
  on public.subscriptions (user_id, status);

comment on table public.subscriptions is
  'Per-user subscription state. Owner-only RLS; platform_admin may read. '
  'Writes expected from billing service (service_role) — no client INSERT/UPDATE policy.';


-- ---------------------------------------------------------------------
-- payment_history : per-user receipts / charge attempts
-- ---------------------------------------------------------------------
create table if not exists public.payment_history (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references public.profiles(id) on delete cascade,
  subscription_id uuid references public.subscriptions(id) on delete set null,
  amount_cents    int not null,
  currency        text not null default 'KRW',
  status          text not null
                  check (status in ('paid','failed','refunded','pending')),
  receipt_url     text,
  paid_at         timestamptz,
  created_at      timestamptz not null default now()
);

create index if not exists payment_history_user_paid
  on public.payment_history (user_id, paid_at desc);

comment on table public.payment_history is
  'Per-user payment records. Owner-only RLS. Written by billing service (service_role).';


-- ---------------------------------------------------------------------
-- updated_at autoupdate triggers
-- ---------------------------------------------------------------------
drop trigger if exists trg_subscription_plans_touch_updated_at on public.subscription_plans;
create trigger trg_subscription_plans_touch_updated_at
  before update on public.subscription_plans
  for each row execute function public.touch_updated_at();

drop trigger if exists trg_subscriptions_touch_updated_at on public.subscriptions;
create trigger trg_subscriptions_touch_updated_at
  before update on public.subscriptions
  for each row execute function public.touch_updated_at();


-- =====================================================================
-- RLS
-- =====================================================================

-- subscription_plans : public read of ACTIVE plans for authenticated users.
-- No client write policy (admin/service manages pricing).
alter table public.subscription_plans enable row level security;
alter table public.subscription_plans force  row level security;

drop policy if exists subscription_plans_active_select on public.subscription_plans;
create policy subscription_plans_active_select
  on public.subscription_plans
  for select to authenticated
  using ( active = true or private.is_platform_admin((select auth.uid())) );

drop policy if exists subscription_plans_admin_all on public.subscription_plans;
create policy subscription_plans_admin_all
  on public.subscription_plans
  for all to authenticated
  using ( private.is_platform_admin((select auth.uid())) )
  with check ( private.is_platform_admin((select auth.uid())) );


-- subscriptions : owner read-only (writes via service_role/RPC); admin read.
alter table public.subscriptions enable row level security;
alter table public.subscriptions force  row level security;

drop policy if exists subscriptions_owner_select on public.subscriptions;
create policy subscriptions_owner_select
  on public.subscriptions
  for select to authenticated
  using ( user_id = (select auth.uid()) or private.is_platform_admin((select auth.uid())) );

-- intentionally no client INSERT/UPDATE/DELETE policy → billing service
-- (service_role) is the sole writer, mirroring writing_feedback convention.


-- payment_history : owner read-only; admin read.
alter table public.payment_history enable row level security;
alter table public.payment_history force  row level security;

drop policy if exists payment_history_owner_select on public.payment_history;
create policy payment_history_owner_select
  on public.payment_history
  for select to authenticated
  using ( user_id = (select auth.uid()) or private.is_platform_admin((select auth.uid())) );

-- intentionally no client write policy → written by billing service (service_role).


-- =====================================================================
-- Seed example plans (X-03 can render real prices)
-- Placeholder KRW prices + Korean feature names. Tagged via features[]
-- "__seed":"conformance-20260602" marker key so they are identifiable and
-- can be replaced by real pricing later. on conflict do nothing = idempotent.
-- =====================================================================
insert into public.subscription_plans
  (plan_key, name, cadence, price_cents, currency, features, recommended, active)
values
  ('topik_monthly',   'TALKPIK 월간',  'monthly',    990000, 'KRW',
    '["AI 작문 첨삭 무제한","약점 추천 문제","학습 리포트","__seed:conformance-20260602"]'::jsonb,
    false, true),
  ('topik_quarterly', 'TALKPIK 분기', 'quarterly', 2670000, 'KRW',
    '["월간 혜택 전부","분기 17% 할인","우선 첨삭 큐","__seed:conformance-20260602"]'::jsonb,
    true,  true),
  ('topik_yearly',    'TALKPIK 연간', 'yearly',    9900000, 'KRW',
    '["월간 혜택 전부","연간 17% 할인","모의고사 PDF 내보내기","__seed:conformance-20260602"]'::jsonb,
    false, true)
on conflict (plan_key) do nothing;
