-- down: drop new admin-management RPCs and restore the three read RPCs to their
-- original profiles-reading bodies (pre-Phase-4). Safe only while admins still have
-- profiles rows (i.e., before Phase 7).

drop function if exists public.admin_get_self();
drop function if exists public.admin_get_admin(uuid);
drop function if exists public.admin_set_admin_role(uuid, text, text);
drop function if exists public.admin_set_admin_status(uuid, text, text);
drop function if exists public.admin_grant_permissions(uuid, text[], text);
drop function if exists public.admin_revoke_permissions(uuid, text[], text);

-- restore admin_list_admins (reads profiles)
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
  if caller_id is null then raise exception 'unauthenticated'; end if;
  if not private.is_admin(caller_id) then raise exception 'forbidden: admin required'; end if;
  return query
    select p.id, u.email::text, p.display_name, p.nickname::text, p.app_role::text, p.status,
           u.last_sign_in_at, p.created_at, p.updated_at
    from public.profiles p
    left join auth.users u on u.id = p.id
    where p.app_role <> 'learner'
      and (v_search is null or u.email ilike '%' || v_search || '%'
           or p.display_name ilike '%' || v_search || '%' or p.nickname::text ilike '%' || v_search || '%')
    order by lower(coalesce(p.display_name, u.email::text)) asc nulls last, p.created_at desc;
end;
$$;

-- restore admin_list_admin_app_roles (reads profiles)
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
  if caller_id is null then raise exception 'unauthenticated'; end if;
  if not private.is_platform_admin(caller_id) then raise exception 'forbidden: platform_admin required'; end if;
  return query
    select p.id, u.email::text, p.display_name, p.nickname::text, p.app_role::text, p.status,
           u.last_sign_in_at, p.created_at
    from public.profiles p
    left join auth.users u on u.id = p.id
    where p.app_role <> 'learner'
      and (v_search is null or u.email ilike '%' || v_search || '%'
           or p.display_name ilike '%' || v_search || '%' or p.nickname::text ilike '%' || v_search || '%')
    order by lower(coalesce(p.display_name, u.email::text)) asc nulls last, p.created_at desc;
end;
$$;

-- restore admin_list_audit_logs (actor from profiles)
create or replace function public.admin_list_audit_logs(
  p_target_type text default null,
  p_target_id   text default null,
  p_keyword     text default null,
  p_start       timestamptz default null,
  p_end         timestamptz default null,
  p_limit       int default 100,
  p_offset      int default 0
)
returns table (
  log_id text, target_type text, target_id text, action text, actor text,
  reason text, diff jsonb, payload jsonb, created_at timestamptz, total_count bigint
)
language plpgsql
stable
security definer
set search_path = pg_catalog, public
as $$
#variable_conflict use_column
declare
  caller_id uuid := auth.uid();
  v_target_type text := nullif(btrim(coalesce(p_target_type, '')), '');
  v_target_id   text := nullif(btrim(coalesce(p_target_id, '')), '');
  v_keyword     text := nullif(btrim(coalesce(p_keyword, '')), '');
  v_limit       int := least(greatest(coalesce(p_limit, 100), 1), 500);
  v_offset      int := greatest(coalesce(p_offset, 0), 0);
begin
  if caller_id is null then raise exception 'unauthenticated'; end if;
  if not private.is_admin(caller_id) then raise exception 'forbidden: admin required'; end if;
  return query
  with filtered as (
    select l.id, l.target_table, l.target_id, l.action,
      coalesce(nullif(p.display_name, ''), l.admin_user_id::text, 'system') as actor,
      l.diff, l.payload, l.created_at
    from public.admin_audit_logs l
    left join public.profiles p on p.id = l.admin_user_id
    where (v_target_type is null or l.target_table = v_target_type)
      and (v_target_id is null or l.target_id = v_target_id)
      and (p_start is null or l.created_at >= p_start)
      and (p_end is null or l.created_at <= p_end)
      and (v_keyword is null or l.action ilike '%' || v_keyword || '%'
           or l.target_id ilike '%' || v_keyword || '%' or l.payload::text ilike '%' || v_keyword || '%')
  ),
  counted as (select filtered.*, count(*) over () as total_count from filtered)
  select counted.id::text, counted.target_table, counted.target_id, counted.action, counted.actor,
         counted.payload ->> 'reason', counted.diff, counted.payload, counted.created_at, counted.total_count
  from counted
  order by counted.created_at desc
  offset v_offset limit v_limit;
end;
$$;
