-- =====================================================================
-- TALKPIK AI · Conformance · 2026-06-02
-- Notification persistence (X-09) + settings prefs (G-01)
--
--   - notification_settings : per-user reminder schedule + channels (owner-only)
--   - notification_log       : delivery ledger (owner read-only)
--   - profiles.learning_locale + profiles.content_prefs : G-01 settings columns
--
-- The existing profiles.notification_prefs (3 boolean flags, jsonb object,
-- 20260521141000) is left AS-IS. notification_settings AUGMENTS it with the
-- schedule/channel detail X-09 needs to persist.
--
-- Protect-trigger note: private.protect_profile_columns
-- (20260520121400_profiles_protected_columns) only guards app_role /
-- plan_label / status. learning_locale and content_prefs are NOT guarded,
-- so the existing profiles_self_update policy (id = auth.uid()) already lets
-- owners update them. No trigger change required — verified against the
-- trigger body which raises only on those three columns.
-- =====================================================================


-- ---------------------------------------------------------------------
-- notification_settings : 1:1 with profiles, per-user reminder config (X-09)
-- ---------------------------------------------------------------------
create table if not exists public.notification_settings (
  user_id        uuid primary key references public.profiles(id) on delete cascade,
  reminder_time  time,
  reminder_days  jsonb not null default '[]'::jsonb,
  channels       jsonb not null default '{"email":false,"zalo":false}'::jsonb,
  timezone       text not null default 'Asia/Seoul',
  updated_at     timestamptz not null default now()
);

-- Guard jsonb shape (mirrors profiles_notification_prefs_is_object pattern).
alter table public.notification_settings
  drop constraint if exists notification_settings_days_is_array;
alter table public.notification_settings
  add constraint notification_settings_days_is_array
  check (jsonb_typeof(reminder_days) = 'array');

alter table public.notification_settings
  drop constraint if exists notification_settings_channels_is_object;
alter table public.notification_settings
  add constraint notification_settings_channels_is_object
  check (jsonb_typeof(channels) = 'object');

comment on table public.notification_settings is
  'X-09 per-user reminder schedule + channel toggles. Augments profiles.notification_prefs. Owner-only RLS.';


-- ---------------------------------------------------------------------
-- notification_log : delivery ledger (owner read; written by service_role)
-- ---------------------------------------------------------------------
create table if not exists public.notification_log (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references public.profiles(id) on delete cascade,
  channel       text not null,
  template_key  text not null,
  status        text not null
                check (status in ('sent','failed','pending')),
  payload       jsonb,
  sent_at       timestamptz,
  created_at    timestamptz not null default now()
);

create index if not exists notification_log_user_created
  on public.notification_log (user_id, created_at desc);

comment on table public.notification_log is
  'X-09 notification delivery ledger. Owner read-only; written by the notification service (service_role).';


-- ---------------------------------------------------------------------
-- updated_at autoupdate
-- ---------------------------------------------------------------------
drop trigger if exists trg_notification_settings_touch_updated_at on public.notification_settings;
create trigger trg_notification_settings_touch_updated_at
  before update on public.notification_settings
  for each row execute function public.touch_updated_at();


-- =====================================================================
-- RLS
-- =====================================================================

-- notification_settings : owner full control.
alter table public.notification_settings enable row level security;
alter table public.notification_settings force  row level security;

drop policy if exists notification_settings_owner_all on public.notification_settings;
create policy notification_settings_owner_all
  on public.notification_settings
  for all to authenticated
  using ( user_id = (select auth.uid()) )
  with check ( user_id = (select auth.uid()) );


-- notification_log : owner read-only; written by service_role (no client write).
alter table public.notification_log enable row level security;
alter table public.notification_log force  row level security;

drop policy if exists notification_log_owner_select on public.notification_log;
create policy notification_log_owner_select
  on public.notification_log
  for select to authenticated
  using ( user_id = (select auth.uid()) or private.is_platform_admin((select auth.uid())) );


-- =====================================================================
-- profiles : G-01 settings prefs columns
-- =====================================================================

-- learning_locale : preferred study UI/content language (distinct from
-- the existing ui_locale chrome locale). Nullable -> "follow ui_locale".
alter table public.profiles
  add column if not exists learning_locale text;

alter table public.profiles
  drop constraint if exists profiles_learning_locale_check;
alter table public.profiles
  add constraint profiles_learning_locale_check
  check (learning_locale is null or learning_locale in ('ko','en','vi'));

comment on column public.profiles.learning_locale is
  'G-01 preferred learning-content language (ko/en/vi). Null = follow ui_locale. Owner-editable.';

-- content_prefs : feedback-display / example-difficulty / explanation-length etc.
alter table public.profiles
  add column if not exists content_prefs jsonb not null default '{}'::jsonb;

alter table public.profiles
  drop constraint if exists profiles_content_prefs_is_object;
alter table public.profiles
  add constraint profiles_content_prefs_is_object
  check (jsonb_typeof(content_prefs) = 'object');

comment on column public.profiles.content_prefs is
  'G-01 learning content preferences (feedback-display / example-difficulty / explanation-length). '
  'JSON object only. Owner-editable (not guarded by protect-columns trigger).';
