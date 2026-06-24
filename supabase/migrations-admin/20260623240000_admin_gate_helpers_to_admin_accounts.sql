-- Phase 5: repoint the admin-gate helpers to public.admin_accounts.
--
-- Ownership: the admin-authorization helpers (private.is_admin / is_platform_admin /
-- is_content_admin / is_org_admin) are topik-ai-owned admin infrastructure (owner
-- decision 2026-06-23: topik-ai owns all admin/management infrastructure; v13 is a
-- read-only consumer of admin-configured data and owns none of this). Their bodies
-- previously read public.profiles.app_role; admins are now physically separated into
-- public.admin_accounts (no profiles row), so the gate must read admin_accounts.
--
-- These helpers are the SINGLE decision point for "is this user an admin"; every RLS
-- policy and the protect_profile_columns trigger delegate to them, so repointing only
-- the four function bodies repoints the whole gate without touching any policy.
-- admin_accounts.role uses the same vocabulary as the old app_role, so this is a 1:1
-- swap of the FROM clause; status='active' semantics are preserved.
--
-- SAFETY: aborts if admin_accounts has no active platform_admin (would lock out every
-- admin). Phase 2 backfill must have run first. Verified on dev: E2E admin present.
-- down: supabase/migrations-admin/down/20260623240000_admin_gate_helpers_to_admin_accounts.sql

do $$
begin
  if to_regclass('public.admin_accounts') is null then
    raise exception 'admin_accounts table missing — apply 20260623200000_admin_accounts.sql first';
  end if;
  if (select count(*) from public.admin_accounts where role = 'platform_admin' and status = 'active') = 0 then
    raise exception 'refusing to repoint admin helpers: no active platform_admin in admin_accounts (would lock out all admins). Run the Phase 2 backfill first.';
  end if;
end $$;

create or replace function private.is_admin(uid uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_catalog
as $$
  select exists (
    select 1 from public.admin_accounts
    where id = uid
      and role in ('content_admin', 'platform_admin')
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
    select 1 from public.admin_accounts
    where id = uid
      and role = 'platform_admin'
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
    select 1 from public.admin_accounts
    where id = uid
      and role in ('content_admin', 'platform_admin')
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
    select 1 from public.admin_accounts
    where id = uid
      and role in ('org_admin', 'platform_admin')
      and status = 'active'
  );
$$;

comment on function private.is_admin(uid uuid) is
  'Admin gate (content_admin/platform_admin, active). topik-ai-owned; reads public.admin_accounts after admin identity was physically separated from profiles (2026-06-23).';
comment on function private.is_platform_admin(uid uuid) is
  'Super-admin gate (platform_admin, active). topik-ai-owned; reads public.admin_accounts (2026-06-23 admin identity separation).';
comment on function private.is_content_admin(uid uuid) is
  'Content-admin gate (content_admin/platform_admin, active). topik-ai-owned; reads public.admin_accounts (2026-06-23 admin identity separation).';
comment on function private.is_org_admin(uid uuid) is
  'Org-admin gate (org_admin/platform_admin, active). topik-ai-owned; reads public.admin_accounts (2026-06-23 admin identity separation).';
