-- System > admins: read-only admin account directory.
-- Reads v13-owned public.profiles + auth.users; no DDL/trigger changes.
-- down: supabase/migrations-admin/down/20260618123000_admin_list_admins.sql

create or replace function public.admin_list_admins(
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
  created_at timestamptz,
  updated_at timestamptz
)
language plpgsql
stable
security definer
set search_path = pg_catalog, public
as $$
declare
  caller_id uuid := auth.uid();
  v_search text := nullif(btrim(coalesce(p_search, '')), '');
begin
  if caller_id is null then
    raise exception 'unauthenticated';
  end if;

  if not private.is_admin(caller_id) then
    raise exception 'forbidden: admin required';
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
      p.created_at,
      p.updated_at
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

revoke all on function public.admin_list_admins(text) from public;
grant execute on function public.admin_list_admins(text) to authenticated;

comment on function public.admin_list_admins(text) is
  'System > admins read-only admin-account directory (app_role <> learner). Requires private.is_admin caller, optional search over email/display_name/nickname.';
