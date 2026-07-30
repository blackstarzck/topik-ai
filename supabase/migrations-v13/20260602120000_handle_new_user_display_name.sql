-- =====================================================================
-- TALKPIK AI · Conformance · 2026-06-02
-- handle_new_user(): also seed profiles.display_name from auth metadata
--
-- The Phase 2 bootstrap trigger (20260521120000_auth_user_profile_bootstrap)
-- inserted only profiles.id. Registration captures a display name into
-- auth.users.raw_user_meta_data->>'display_name', but it was never copied
-- into the profiles row, so X-05 / dashboards rendered an empty name until
-- the user re-saved their profile.
--
-- This recreates the function additively: same idempotent insert path, same
-- SECURITY DEFINER + locked search_path, plus a display_name column populated
-- from metadata (nullif empty -> NULL). raw_user_meta_data is a column on the
-- NEW (auth.users) record, not a function, so the locked search_path is
-- unaffected. profiles.display_name already exists (profiles_goals.sql:12).
-- =====================================================================

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
-- pg_catalog FIRST so built-in functions cannot be shadowed by a malicious
-- public.* of the same name. public.profiles is fully qualified below.
set search_path = pg_catalog, public
as $$
begin
  insert into public.profiles (id, display_name)
  values (
    new.id,
    nullif(new.raw_user_meta_data->>'display_name', '')
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

revoke all on function public.handle_new_user() from public;

comment on function public.handle_new_user() is
  'After insert on auth.users, create matching public.profiles row idempotently '
  'and seed display_name from raw_user_meta_data->>''display_name'' (nullif empty). '
  'SECURITY DEFINER with locked search_path. Conformance 2026-06-02.';

-- Trigger definition unchanged from 20260521120000; re-asserted idempotently
-- so a clean `supabase db reset` keeps the binding even if file order shifts.
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row
  execute function public.handle_new_user();
