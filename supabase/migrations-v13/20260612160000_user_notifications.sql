-- =====================================================================
-- TALKPIK AI · Notification feature · 2026-06-12
-- user_notifications : in-app inbox rows (X-09 확장 + B-01 알림 카드 + 알림센터)
--
-- Ownership: v13 (user-facing schema) — see topik-ai
-- docs/architecture/shared-supabase-schema-ownership.md.
-- Writes come from the dispatch pipeline (service_role). Owners may only
-- read their rows and set read_at (column-level grant).
--
-- delivery_attempt_id is a SOFT reference to notification_delivery_attempts
-- (topik-ai-owned, created by admin_schema_migrations). No FK on purpose:
-- cross-namespace coupling is forbidden by the ownership contract.
--
-- Contract SoT: topik-ai docs/specs/notification-contract.md
--   category : 'study' | 'exam_schedule' | 'notice' | 'event' | 'marketing'
-- =====================================================================

create table if not exists public.user_notifications (
  id                  uuid primary key default gen_random_uuid(),
  user_id             uuid not null references public.profiles(id) on delete cascade,
  template_key        text not null,
  category            text not null,
  title               text not null,
  body                text,
  link_url            text,
  payload             jsonb,
  read_at             timestamptz,
  delivery_attempt_id uuid,
  created_at          timestamptz not null default now()
);

alter table public.user_notifications
  drop constraint if exists user_notifications_category_check;
alter table public.user_notifications
  add constraint user_notifications_category_check
  check (category in ('study','exam_schedule','notice','event','marketing'));

create index if not exists user_notifications_user_created
  on public.user_notifications (user_id, created_at desc);

-- Unread badge count path: partial index keeps the count query cheap.
create index if not exists user_notifications_user_unread
  on public.user_notifications (user_id)
  where read_at is null;

comment on table public.user_notifications is
  'In-app notification inbox (bell badge / inbox / B-01 cards). Insert by service_role pipeline only; owner may read and set read_at.';
comment on column public.user_notifications.delivery_attempt_id is
  'Soft reference to notification_delivery_attempts (topik-ai-owned). No FK by ownership contract.';

-- =====================================================================
-- RLS — owner select + read_at-only owner update. No client insert/delete.
-- =====================================================================

alter table public.user_notifications enable row level security;
alter table public.user_notifications force  row level security;

drop policy if exists user_notifications_owner_select on public.user_notifications;
create policy user_notifications_owner_select
  on public.user_notifications
  for select to authenticated
  using ( user_id = (select auth.uid()) );

drop policy if exists user_notifications_owner_update on public.user_notifications;
create policy user_notifications_owner_update
  on public.user_notifications
  for update to authenticated
  using ( user_id = (select auth.uid()) )
  with check ( user_id = (select auth.uid()) );

-- Column-level write restriction: owners may flip read_at only. Table-level
-- update is revoked, then a single-column grant is added back. insert/delete
-- stay revoked for client roles (pipeline writes via service_role, which
-- bypasses RLS and holds table privileges).
revoke insert, update, delete on public.user_notifications from anon, authenticated;
grant update (read_at) on public.user_notifications to authenticated;
