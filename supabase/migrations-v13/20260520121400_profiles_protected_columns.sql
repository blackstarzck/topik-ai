-- =====================================================================
-- TALKPIK AI · Tier 1 MVP · hardening round-2
-- 15/16 · profiles protected columns (app_role / plan_label / status)
-- Spec: docs/development/database-schema.md §7
--
-- Replaces the with-check subquery pattern from 12/16 with a BEFORE UPDATE
-- trigger that compares OLD vs NEW directly — clearer semantics and
-- testable. Admin bypasses via private.is_admin().
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Simplify profiles_self_update — drop subquery-based protected-column check
-- ---------------------------------------------------------------------
drop policy if exists profiles_self_update on public.profiles;
create policy profiles_self_update
  on public.profiles
  for update to authenticated
  using ( id = (select auth.uid()) )
  with check ( id = (select auth.uid()) );

-- ---------------------------------------------------------------------
-- 2. BEFORE UPDATE trigger function — enforces protected-column rule
-- ---------------------------------------------------------------------
create or replace function private.protect_profile_columns()
returns trigger
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
begin
  -- Admins (content_admin / platform_admin) bypass entirely.
  if private.is_admin((select auth.uid())) then
    return new;
  end if;

  if new.app_role is distinct from old.app_role then
    raise exception
      'profiles.app_role can only be changed by admins'
      using errcode = '42501';
  end if;

  if new.plan_label is distinct from old.plan_label then
    raise exception
      'profiles.plan_label can only be changed by admins or billing service'
      using errcode = '42501';
  end if;

  if new.status is distinct from old.status then
    raise exception
      'profiles.status can only be changed by admins'
      using errcode = '42501';
  end if;

  return new;
end;
$$;

revoke all on function private.protect_profile_columns() from public;
-- trigger runs as SECURITY DEFINER owner; no explicit grant needed.

comment on function private.protect_profile_columns() is
  'BEFORE UPDATE on public.profiles. Blocks app_role/plan_label/status changes for non-admins.';

-- ---------------------------------------------------------------------
-- 3. Attach trigger
-- ---------------------------------------------------------------------
drop trigger if exists trg_profiles_protect_columns on public.profiles;
create trigger trg_profiles_protect_columns
  before update on public.profiles
  for each row execute function private.protect_profile_columns();
