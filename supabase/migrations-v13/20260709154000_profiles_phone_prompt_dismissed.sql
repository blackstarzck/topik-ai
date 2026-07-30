-- ============================================================================
-- TALKPIK AI - 2026-07-09 - phone number reminder dismiss timestamp
--
-- Adds a nullable timestamp that records when a user closed the workspace
-- "add your phone number" reminder banner via "don't show again". The banner
-- is non-blocking and phone_number stays optional; this column only suppresses
-- the reminder permanently (account-scoped) once dismissed.
--
-- New profiles are created by handle_new_user() which does not set this column,
-- so it defaults to NULL ("not dismissed yet") automatically. Existing rows
-- need no backfill for the same reason. Owner self-update is already permitted
-- by profiles_self_update RLS (id = auth.uid()); the protected-column trigger
-- (20260520121400) only guards app_role/plan_label/status, so no policy or
-- trigger change is required for this column.
-- ============================================================================

alter table public.profiles
  add column if not exists phone_number_prompt_dismissed_at timestamptz;

comment on column public.profiles.phone_number_prompt_dismissed_at is
  'Timestamp when the user dismissed the phone-number reminder banner ("don''t show again"). NULL = not dismissed. Set by owner self-update; phone_number remains optional.';
