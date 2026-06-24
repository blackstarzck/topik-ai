-- down: drop the admin-account permission helper, grants, and accounts tables.
-- Safe only before the invite flow / backfill have populated real admin rows.
drop function if exists public.admin_has_permission(uuid, text);
drop table if exists public.admin_permission_grants;
drop table if exists public.admin_accounts;
