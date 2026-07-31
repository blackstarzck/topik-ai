-- =====================================================================
-- TALKPIK AI · Phase 6 · profiles.notification_prefs column
--
-- Adds a jsonb column for client-side notification preference flags.
-- Schema contract:
--   - NOT NULL default '{}'::jsonb
--   - CHECK ensures the column is always a JSON object (never array/null/scalar)
-- Allowed keys live in code (src/lib/settings/types.ts). Missing keys -> false.
-- Transport (email/push) is OOS-9; Phase 6 only persists the preference.
-- =====================================================================

alter table public.profiles
  add column if not exists notification_prefs jsonb
    not null default '{}'::jsonb;

-- Guard against accidental writes of arrays/scalars/null-as-string.
alter table public.profiles
  drop constraint if exists profiles_notification_prefs_is_object;
alter table public.profiles
  add constraint profiles_notification_prefs_is_object
  check (jsonb_typeof(notification_prefs) = 'object');

comment on column public.profiles.notification_prefs is
  'Phase 6: client notification preference flags. JSON object only. Transport (SES/FCM/...) is OOS-9.';
