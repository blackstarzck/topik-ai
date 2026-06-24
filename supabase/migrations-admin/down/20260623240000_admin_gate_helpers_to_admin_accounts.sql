-- down: restore the admin-gate helpers to read public.profiles.app_role.
-- WARNING: only valid while admins still have profiles rows. After Phase 7 deletes
-- admins' profiles rows, rolling back here re-locks them out until those rows are
-- restored from backup (.db-backup-full).

create or replace function private.is_admin(uid uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_catalog
as $$
  select exists (
    select 1 from public.profiles
    where id = uid
      and app_role in ('content_admin', 'platform_admin')
      and status = 'active'
  );
$$;

create or replace function private.is_platform_admin(uid uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_catalog
as $$
  select exists (
    select 1 from public.profiles
    where id = uid
      and app_role = 'platform_admin'
      and status = 'active'
  );
$$;

create or replace function private.is_content_admin(uid uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_catalog
as $$
  select exists (
    select 1 from public.profiles
    where id = uid
      and app_role in ('content_admin', 'platform_admin')
      and status = 'active'
  );
$$;

create or replace function private.is_org_admin(uid uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_catalog
as $$
  select exists (
    select 1 from public.profiles
    where id = uid
      and app_role in ('org_admin', 'platform_admin')
      and status = 'active'
  );
$$;
