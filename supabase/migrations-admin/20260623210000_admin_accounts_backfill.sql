-- Phase 2: backfill existing admins (non-learner profiles) into admin_accounts.
-- Runs BEFORE the v13 helper repoint (Phase 5) so there is no access gap: the
-- acting platform_admin must already exist here when is_* starts reading this table.
--
-- Mapping: profiles.app_role -> admin_accounts.role (same vocabulary). Existing
-- admins are treated as already-accepted (accepted_at = now(), invited_at = null).
-- status: active profiles -> 'active', anything else -> 'suspended'.
--
-- Permission grants: platform_admin (super) gets NONE (it bypasses every check via
-- public.admin_has_permission). content_admin / org_admin receive the default key
-- set of their mapped client RoleKey so they keep their effective access:
--   content_admin -> CONTENT_MANAGER defaults; org_admin -> READ_ONLY defaults
--   (app-role-mapping.ts; org_admin is READ_ONLY by owner decision 2026-06-18).
-- The arrays below MIRROR src/features/system/model/permission-types.ts roleCatalog
-- as of 2026-06-23 — keep in sync if the catalog changes.
-- down: supabase/migrations-admin/down/20260623210000_admin_accounts_backfill.sql

insert into public.admin_accounts (
  id, email, display_name, role, status,
  created_by, invited_at, accepted_at, last_sign_in_at, created_at, updated_at
)
select
  p.id,
  u.email::text,
  coalesce(nullif(p.display_name, ''), nullif(p.nickname::text, ''), u.email::text),
  p.app_role,
  case when p.status = 'active' then 'active' else 'suspended' end,
  null,
  null,
  now(),
  u.last_sign_in_at,
  p.created_at,
  now()
from public.profiles p
left join auth.users u on u.id = p.id
where p.app_role <> 'learner'
on conflict (id) do nothing;

-- content_admin -> CONTENT_MANAGER default permission set
insert into public.admin_permission_grants (admin_id, permission_key, granted_by)
select a.id, perm_key, null
from public.admin_accounts a
cross join unnest(array[
  'dashboard.read',
  'operation.faq.manage',
  'assessment.question-bank.manage',
  'assessment.eps-topik.manage',
  'assessment.level-tests.manage',
  'content.library.manage',
  'content.badges.manage',
  'content.vocabulary.manage',
  'content.vocabulary.sonagi.manage',
  'content.vocabulary.multiple-choice.manage',
  'content.missions.manage',
  'analytics.read',
  'system.audit.read'
]) as perm_key
where a.role = 'content_admin'
on conflict do nothing;

-- org_admin -> READ_ONLY default permission set
insert into public.admin_permission_grants (admin_id, permission_key, granted_by)
select a.id, perm_key, null
from public.admin_accounts a
cross join unnest(array[
  'dashboard.read',
  'users.read',
  'message.history.read',
  'commerce.payments.read',
  'analytics.read',
  'system.audit.read',
  'system.logs.read'
]) as perm_key
where a.role = 'org_admin'
on conflict do nothing;
