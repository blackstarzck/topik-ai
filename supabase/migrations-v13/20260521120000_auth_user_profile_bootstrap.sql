-- =====================================================================
-- TALKPIK AI · Phase 2 · 17/17 · auth.users -> profiles bootstrap trigger
--
-- Closes the self-inconsistency between:
--   - 20260520121100_rls_policies.sql:46 comment ("INSERT handled by auth
--     trigger out of scope"), which assumed an auth trigger existed.
--   - 20260520121000_triggers.sql, which had `updated_at` and writing-draft
--     triggers but no `auth.users -> profiles` insert trigger.
--
-- Phase 2 (Data And Auth Foundation) was the first PR to actually
-- consume the auth path. Adding this trigger keeps schema and code
-- consistent. RLS on `profiles` still blocks anon/authenticated INSERT
-- — only this SECURITY DEFINER function can populate the row.
-- =====================================================================

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
-- pg_catalog FIRST so that built-in functions cannot be shadowed by a
-- malicious public.* of the same name. public.profiles is fully qualified
-- below, so we never rely on search_path resolution for application objects.
set search_path = pg_catalog, public
as $$
begin
  insert into public.profiles (id)
  values (new.id)
  on conflict (id) do nothing;
  return new;
end;
$$;

revoke all on function public.handle_new_user() from public;

comment on function public.handle_new_user() is
  'After insert on auth.users, create matching public.profiles row idempotently. SECURITY DEFINER with locked search_path.';

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row
  execute function public.handle_new_user();
