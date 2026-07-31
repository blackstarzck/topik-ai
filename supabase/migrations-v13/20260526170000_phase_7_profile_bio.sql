-- =====================================================================
-- Phase 7-E · Task 10 (P1-6) · profiles.bio column
-- IA: docs/Wireframe/27-X-05-profile-editing/description.md (160자 자기소개)
-- =====================================================================
--
-- Bio is a short self-introduction (max 160 chars per IA spec). The column
-- is nullable so existing profiles continue to work without migration data.
-- Self-update is permitted by the existing `profiles_self_update` policy
-- (id = auth.uid()), so no new policy is required.
--
-- The protected-columns trigger (20260520121400_profiles_protected_columns)
-- only blocks app_role / plan_label / status — bio is freely editable by
-- the row's owner, which matches the IA contract (user-controlled blurb).

alter table public.profiles
  add column if not exists bio text;

alter table public.profiles
  drop constraint if exists profiles_bio_max_length;

alter table public.profiles
  add constraint profiles_bio_max_length
  check (bio is null or char_length(bio) <= 160);

comment on column public.profiles.bio is
  'Self-introduction up to 160 chars. Editable by owner (profiles_self_update). Phase 7 Task 10.';
