-- System > permissions: dedicated admin-account listing for the app_role change screen.
-- Replaces the previous reuse of get_admin_users (which paginates the ENTIRE profiles
-- table, learners included, capped at 500) — at scale learners consumed the page budget
-- and admins could be silently dropped. This RPC filters to admin roles in SQL, so the
-- result set is the (small, bounded) staff population and never truncated by learners.
-- Read access is platform_admin-only, matching the role-change write path and
-- get_admin_users' own platform_admin posture; non-platform admins see only the
-- read-only RoleKey/permission catalog on the screen, not this list.
-- Reads v13-owned public.profiles + auth.users; no DDL/trigger changes.
-- down: supabase/migrations-admin/down/20260618094000_admin_list_admin_app_roles.sql

create or replace function public.admin_list_admin_app_roles(
  p_search text default null
)
returns table (
  user_id uuid,
  email text,
  display_name text,
  nickname text,
  app_role text,
  status text,
  last_sign_in_at timestamptz,
  created_at timestamptz
)
language plpgsql
stable
security definer
set search_path = pg_catalog, public
as $$
declare
  caller_id uuid := auth.uid();
  v_search text := lower(nullif(btrim(coalesce(p_search, '')), ''));
begin
  if caller_id is null then
    raise exception 'unauthenticated';
  end if;

  if not private.is_platform_admin(caller_id) then
    raise exception 'forbidden: platform_admin required';
  end if;

  return query
    select
      p.id,
      u.email::text,
      p.display_name,
      p.nickname::text,
      p.app_role::text,
      p.status,
      u.last_sign_in_at,
      p.created_at
    from public.profiles p
    left join auth.users u on u.id = p.id
    where p.app_role <> 'learner'
      and (
        v_search is null
        or u.email ilike '%' || v_search || '%'
        or p.display_name ilike '%' || v_search || '%'
        or p.nickname::text ilike '%' || v_search || '%'
      )
    order by lower(coalesce(p.display_name, u.email::text)) asc nulls last,
             p.created_at desc;
end;
$$;

revoke all on function public.admin_list_admin_app_roles(text) from public;
grant execute on function public.admin_list_admin_app_roles(text) to authenticated;

comment on function public.admin_list_admin_app_roles(text) is
  'System > permissions admin-account list (app_role <> learner) for the role-change screen. platform_admin only, optional search over email/display_name/nickname. Read-only; never paginated by learners. Promotion-from-learner is intentionally out of scope for this list (handled via the Users directory).';
