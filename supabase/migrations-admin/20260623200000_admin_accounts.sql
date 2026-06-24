-- System > admins: dedicated admin-account table — physical separation of admin
-- identity out of the shared, v13-owned public.profiles.
--
-- Design (owner decision 2026-06-23):
--   * Admins live in public.admin_accounts (topik-ai-owned), keyed by auth.users(id).
--     They have NO profiles row (full physical separation). profiles stays the
--     learner-only directory owned by v13.
--   * role keeps the v13 app_role vocabulary (platform_admin/content_admin/org_admin)
--     so the v13 private.is_* helpers can be repointed to this table by redefining
--     ONLY their bodies (see the v13 migration in Phase 5). platform_admin = super admin.
--   * status: 'invited' (email invite not yet accepted) / 'active' / 'suspended'.
--     The is_* helpers count only 'active', so a pending invite never authorizes.
--   * Fine-grained permissions live in admin_permission_grants. platform_admin
--     (super) bypasses all permission checks; other admins need explicit grants.
--
-- Writes go exclusively through SECURITY DEFINER admin RPCs (added in later phases);
-- RLS allows admins read-only direct access. No v13 DDL/trigger change in this file.
-- down: supabase/migrations-admin/down/20260623200000_admin_accounts.sql

create table if not exists public.admin_accounts (
  id              uuid primary key references auth.users(id) on delete cascade,
  email           text,
  display_name    text,
  role            text not null default 'content_admin'
                    check (role in ('platform_admin', 'content_admin', 'org_admin')),
  status          text not null default 'active'
                    check (status in ('invited', 'active', 'suspended')),
  created_by      uuid,
  invited_at      timestamptz,
  accepted_at     timestamptz,
  last_sign_in_at timestamptz,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index if not exists admin_accounts_role_status_idx
  on public.admin_accounts (role, status);

create table if not exists public.admin_permission_grants (
  admin_id       uuid not null references public.admin_accounts(id) on delete cascade,
  permission_key text not null,
  granted_by     uuid,
  granted_at     timestamptz not null default now(),
  primary key (admin_id, permission_key)
);

create index if not exists admin_permission_grants_admin_idx
  on public.admin_permission_grants (admin_id);

alter table public.admin_accounts enable row level security;
alter table public.admin_accounts force row level security;
alter table public.admin_permission_grants enable row level security;
alter table public.admin_permission_grants force row level security;

-- Admin read-only direct access; all writes go through SECURITY DEFINER RPCs
-- (which run as a BYPASSRLS role, same precedent as user_admin_memos/instructors).
create policy admin_accounts_admin_select on public.admin_accounts
  for select to authenticated using (private.is_admin((select auth.uid())));

create policy admin_permission_grants_admin_select on public.admin_permission_grants
  for select to authenticated using (private.is_admin((select auth.uid())));

-- Permission-enforcement helper (topik-ai-owned, public schema). platform_admin
-- (super admin) implicitly holds every permission; every other admin must hold an
-- explicit, still-active grant. Used by the phased server-side CRUD enforcement.
create or replace function public.admin_has_permission(p_uid uuid, p_key text)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public
as $$
  select
    exists (
      select 1 from public.admin_accounts a
      where a.id = p_uid
        and a.role = 'platform_admin'
        and a.status = 'active'
    )
    or exists (
      select 1
      from public.admin_permission_grants g
      join public.admin_accounts a on a.id = g.admin_id
      where g.admin_id = p_uid
        and g.permission_key = p_key
        and a.status = 'active'
    );
$$;

revoke all on function public.admin_has_permission(uuid, text) from public;
grant execute on function public.admin_has_permission(uuid, text) to authenticated;

comment on table public.admin_accounts is
  'Dedicated admin-account directory (topik-ai-owned). Admins are physically separated from v13-owned public.profiles and have no profiles row. role uses v13 app_role vocabulary (platform_admin=super). status invited/active/suspended; only active authorizes. Writes via SECURITY DEFINER admin RPCs only.';
comment on table public.admin_permission_grants is
  'Per-admin fine-grained permission grants (37-key catalog). platform_admin bypasses; other admins are gated by these grants via public.admin_has_permission. Writes via admin RPC only.';
comment on function public.admin_has_permission(uuid, text) is
  'Server-side permission gate. true if the caller is an active platform_admin (super, all permissions) or holds an active grant for p_key. Used by phased CRUD enforcement.';
