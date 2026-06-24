-- Phase 4: admin-account RPC layer. Adds the new admin-management RPCs and repoints
-- the existing admin/role/audit READ RPCs from v13-owned public.profiles to the
-- topik-ai-owned public.admin_accounts. Applied BEFORE the v13 helper switch (Phase 5)
-- so every reader of admin app_role is on admin_accounts before profiles loses admins.
--
-- Return shapes of the rewritten read RPCs are preserved (frontend mappers unchanged):
-- app_role column now carries admin_accounts.role; last_sign_in_at comes from auth.users.
-- down: supabase/migrations-admin/down/20260623230000_admin_accounts_rpcs.sql

-- =====================================================================
-- admin_get_self() — caller's own admin record + effective permission keys.
-- Read by auth-store on session resolution. Auto-accepts a pending invite
-- (invited -> active) on the first authenticated call. Returns no rows when the
-- caller is not an active admin, so the login gate rejects them. platform_admin
-- bypasses fine-grained permissions: the client expands its permission set to the
-- full catalog (SUPER_ADMIN), so granted keys are returned as-is here.
-- =====================================================================
create or replace function public.admin_get_self()
returns table (
  admin_id        uuid,
  role            text,
  status          text,
  display_name    text,
  email           text,
  permission_keys text[]
)
language plpgsql
volatile
security definer
set search_path = pg_catalog, public
as $$
#variable_conflict use_column
declare
  caller_id uuid := auth.uid();
begin
  if caller_id is null then
    return; -- unauthenticated → no rows
  end if;

  -- Accept a pending invite on first authenticated visit (reaching here proves the
  -- invitee set a password and signed in). Qualify the table to avoid colliding with
  -- the RETURNS TABLE output columns (status/role/etc).
  update public.admin_accounts a
     set status = 'active',
         accepted_at = coalesce(a.accepted_at, now()),
         last_sign_in_at = now(),
         updated_at = now()
   where a.id = caller_id and a.status = 'invited';

  return query
    select
      a.id,
      a.role,
      a.status,
      a.display_name,
      a.email,
      coalesce(
        (select array_agg(g.permission_key order by g.permission_key)
           from public.admin_permission_grants g
          where g.admin_id = a.id),
        array[]::text[]
      )
    from public.admin_accounts a
    where a.id = caller_id
      and a.status = 'active';
end;
$$;

-- =====================================================================
-- admin_get_admin(p_admin_id) — full detail + grants for one admin (any admin reads).
-- =====================================================================
create or replace function public.admin_get_admin(p_admin_id uuid)
returns table (
  admin_id        uuid,
  email           text,
  display_name    text,
  role            text,
  status          text,
  created_by      uuid,
  invited_at      timestamptz,
  accepted_at     timestamptz,
  last_sign_in_at timestamptz,
  created_at      timestamptz,
  updated_at      timestamptz,
  permission_keys text[]
)
language plpgsql
stable
security definer
set search_path = pg_catalog, public
as $$
declare
  caller_id uuid := auth.uid();
begin
  if caller_id is null then raise exception 'unauthenticated'; end if;
  if not private.is_admin(caller_id) then raise exception 'forbidden: admin required'; end if;

  return query
    select
      a.id,
      a.email,
      a.display_name,
      a.role,
      a.status,
      a.created_by,
      a.invited_at,
      a.accepted_at,
      coalesce(u.last_sign_in_at, a.last_sign_in_at),
      a.created_at,
      a.updated_at,
      coalesce(
        (select array_agg(g.permission_key order by g.permission_key)
           from public.admin_permission_grants g
          where g.admin_id = a.id),
        array[]::text[]
      )
    from public.admin_accounts a
    left join auth.users u on u.id = a.id
    where a.id = p_admin_id;
end;
$$;

-- =====================================================================
-- admin_set_admin_role(p_admin_id, p_new_role, p_reason) — platform_admin only.
-- Writes admin_accounts.role (no profiles write). Blocks self-demotion and demotion
-- of the last active platform_admin. Effective next login. Audited.
-- =====================================================================
create or replace function public.admin_set_admin_role(
  p_admin_id uuid,
  p_new_role text,
  p_reason   text
)
returns uuid
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  caller_id uuid := auth.uid();
  v_old_role text;
  v_status text;
  v_email text;
  v_platform_active_count integer;
begin
  if caller_id is null then raise exception 'unauthenticated'; end if;
  if not private.is_platform_admin(caller_id) then
    raise exception 'forbidden: platform_admin required';
  end if;
  if p_admin_id is null then raise exception 'target admin id required'; end if;
  if p_new_role not in ('platform_admin', 'content_admin', 'org_admin') then
    raise exception 'invalid role: %', p_new_role;
  end if;
  if nullif(btrim(coalesce(p_reason, '')), '') is null then
    raise exception 'reason required';
  end if;

  select role, status, email into v_old_role, v_status, v_email
    from public.admin_accounts where id = p_admin_id for update;
  if not found then raise exception 'unknown admin id: %', p_admin_id; end if;
  if v_old_role = p_new_role then raise exception 'admin role already %', p_new_role; end if;

  if caller_id = p_admin_id and v_old_role = 'platform_admin' then
    raise exception 'cannot demote your own platform_admin role';
  end if;

  -- Last active platform_admin guard (defense-in-depth; the self guard above already
  -- covers the common case).
  if v_old_role = 'platform_admin' then
    select count(*) into v_platform_active_count
      from public.admin_accounts
     where role = 'platform_admin' and status = 'active';
    if v_platform_active_count <= 1 then
      raise exception 'cannot demote the last active platform_admin';
    end if;
  end if;

  update public.admin_accounts
     set role = p_new_role, updated_at = now()
   where id = p_admin_id;

  insert into public.admin_audit_logs (admin_user_id, action, target_table, target_id, diff, payload)
  values (
    caller_id, 'admin_role_changed', 'AdminAccount', p_admin_id::text,
    jsonb_build_object('role', jsonb_build_object('from', v_old_role, 'to', p_new_role)),
    jsonb_build_object('reason', btrim(p_reason), 'target_email', v_email, 'session_policy', 'next_login')
  );

  return p_admin_id;
end;
$$;

-- =====================================================================
-- admin_set_admin_status(p_admin_id, p_status, p_reason) — platform_admin only.
-- Suspend / reactivate. Blocks self-suspend and suspension of the last active
-- platform_admin. Audited.
-- =====================================================================
create or replace function public.admin_set_admin_status(
  p_admin_id uuid,
  p_status   text,
  p_reason   text
)
returns uuid
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  caller_id uuid := auth.uid();
  v_old_status text;
  v_role text;
  v_email text;
  v_platform_active_count integer;
begin
  if caller_id is null then raise exception 'unauthenticated'; end if;
  if not private.is_platform_admin(caller_id) then
    raise exception 'forbidden: platform_admin required';
  end if;
  if p_admin_id is null then raise exception 'target admin id required'; end if;
  if p_status not in ('active', 'suspended') then
    raise exception 'invalid status: %', p_status;
  end if;
  if nullif(btrim(coalesce(p_reason, '')), '') is null then
    raise exception 'reason required';
  end if;

  select status, role, email into v_old_status, v_role, v_email
    from public.admin_accounts where id = p_admin_id for update;
  if not found then raise exception 'unknown admin id: %', p_admin_id; end if;
  if v_old_status = p_status then raise exception 'admin status already %', p_status; end if;

  if caller_id = p_admin_id and p_status = 'suspended' then
    raise exception 'cannot suspend your own account';
  end if;

  if p_status = 'suspended' and v_role = 'platform_admin' then
    select count(*) into v_platform_active_count
      from public.admin_accounts
     where role = 'platform_admin' and status = 'active';
    if v_platform_active_count <= 1 then
      raise exception 'cannot suspend the last active platform_admin';
    end if;
  end if;

  update public.admin_accounts
     set status = p_status, updated_at = now()
   where id = p_admin_id;

  insert into public.admin_audit_logs (admin_user_id, action, target_table, target_id, diff, payload)
  values (
    caller_id, 'admin_status_changed', 'AdminAccount', p_admin_id::text,
    jsonb_build_object('status', jsonb_build_object('from', v_old_status, 'to', p_status)),
    jsonb_build_object('reason', btrim(p_reason), 'target_email', v_email)
  );

  return p_admin_id;
end;
$$;

-- =====================================================================
-- admin_grant_permissions / admin_revoke_permissions — platform_admin only.
-- Add/remove fine-grained permission keys for one admin. Audited.
-- =====================================================================
create or replace function public.admin_grant_permissions(
  p_admin_id uuid,
  p_keys     text[],
  p_reason   text
)
returns integer
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  caller_id uuid := auth.uid();
  v_email text;
  v_affected integer := 0;
begin
  if caller_id is null then raise exception 'unauthenticated'; end if;
  if not private.is_platform_admin(caller_id) then
    raise exception 'forbidden: platform_admin required';
  end if;
  if p_admin_id is null then raise exception 'target admin id required'; end if;
  if p_keys is null or array_length(p_keys, 1) is null then
    raise exception 'at least one permission key required';
  end if;
  if nullif(btrim(coalesce(p_reason, '')), '') is null then
    raise exception 'reason required';
  end if;

  select email into v_email from public.admin_accounts where id = p_admin_id;
  if not found then raise exception 'unknown admin id: %', p_admin_id; end if;

  with ins as (
    insert into public.admin_permission_grants (admin_id, permission_key, granted_by)
    select p_admin_id, k, caller_id
    from unnest(p_keys) as k
    where nullif(btrim(k), '') is not null
    on conflict (admin_id, permission_key) do nothing
    returning permission_key
  )
  select count(*) into v_affected from ins;

  insert into public.admin_audit_logs (admin_user_id, action, target_table, target_id, diff, payload)
  values (
    caller_id, 'admin_permissions_granted', 'AdminAccount', p_admin_id::text,
    jsonb_build_object('permission_keys', jsonb_build_object('added', to_jsonb(p_keys))),
    jsonb_build_object('reason', btrim(p_reason), 'target_email', v_email, 'affected', v_affected)
  );

  return v_affected;
end;
$$;

create or replace function public.admin_revoke_permissions(
  p_admin_id uuid,
  p_keys     text[],
  p_reason   text
)
returns integer
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  caller_id uuid := auth.uid();
  v_email text;
  v_affected integer := 0;
begin
  if caller_id is null then raise exception 'unauthenticated'; end if;
  if not private.is_platform_admin(caller_id) then
    raise exception 'forbidden: platform_admin required';
  end if;
  if p_admin_id is null then raise exception 'target admin id required'; end if;
  if p_keys is null or array_length(p_keys, 1) is null then
    raise exception 'at least one permission key required';
  end if;
  if nullif(btrim(coalesce(p_reason, '')), '') is null then
    raise exception 'reason required';
  end if;

  select email into v_email from public.admin_accounts where id = p_admin_id;
  if not found then raise exception 'unknown admin id: %', p_admin_id; end if;

  with del as (
    delete from public.admin_permission_grants
    where admin_id = p_admin_id and permission_key = any(p_keys)
    returning permission_key
  )
  select count(*) into v_affected from del;

  insert into public.admin_audit_logs (admin_user_id, action, target_table, target_id, diff, payload)
  values (
    caller_id, 'admin_permissions_revoked', 'AdminAccount', p_admin_id::text,
    jsonb_build_object('permission_keys', jsonb_build_object('removed', to_jsonb(p_keys))),
    jsonb_build_object('reason', btrim(p_reason), 'target_email', v_email, 'affected', v_affected)
  );

  return v_affected;
end;
$$;

-- =====================================================================
-- REWRITES: read RPCs repointed from profiles to admin_accounts (same return shapes).
-- =====================================================================
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
    select
      a.id,
      a.email,
      a.display_name,
      null::text,
      a.role,
      a.status,
      coalesce(u.last_sign_in_at, a.last_sign_in_at),
      a.created_at,
      a.updated_at
    from public.admin_accounts a
    left join auth.users u on u.id = a.id
    where (
        v_search is null
        or a.email ilike '%' || v_search || '%'
        or a.display_name ilike '%' || v_search || '%'
      )
    order by lower(coalesce(a.display_name, a.email)) asc nulls last,
             a.created_at desc;
end;
$$;

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
  if not private.is_platform_admin(caller_id) then
    raise exception 'forbidden: platform_admin required';
  end if;

  return query
    select
      a.id,
      a.email,
      a.display_name,
      null::text,
      a.role,
      a.status,
      coalesce(u.last_sign_in_at, a.last_sign_in_at),
      a.created_at
    from public.admin_accounts a
    left join auth.users u on u.id = a.id
    where (
        v_search is null
        or a.email ilike '%' || v_search || '%'
        or a.display_name ilike '%' || v_search || '%'
      )
    order by lower(coalesce(a.display_name, a.email)) asc nulls last,
             a.created_at desc;
end;
$$;

-- admin_list_audit_logs: actor name now resolved from admin_accounts (not profiles).
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
  log_id      text,
  target_type text,
  target_id   text,
  action      text,
  actor       text,
  reason      text,
  diff        jsonb,
  payload     jsonb,
  created_at  timestamptz,
  total_count bigint
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
    select
      l.id,
      l.target_table,
      l.target_id,
      l.action,
      coalesce(nullif(a.display_name, ''), l.admin_user_id::text, 'system') as actor,
      l.diff,
      l.payload,
      l.created_at
    from public.admin_audit_logs l
    left join public.admin_accounts a on a.id = l.admin_user_id
    where (v_target_type is null or l.target_table = v_target_type)
      and (v_target_id is null or l.target_id = v_target_id)
      and (p_start is null or l.created_at >= p_start)
      and (p_end is null or l.created_at <= p_end)
      and (
        v_keyword is null
        or l.action ilike '%' || v_keyword || '%'
        or l.target_id ilike '%' || v_keyword || '%'
        or l.payload::text ilike '%' || v_keyword || '%'
      )
  ),
  counted as (
    select filtered.*, count(*) over () as total_count
    from filtered
  )
  select
    counted.id::text,
    counted.target_table,
    counted.target_id,
    counted.action,
    counted.actor,
    counted.payload ->> 'reason',
    counted.diff,
    counted.payload,
    counted.created_at,
    counted.total_count
  from counted
  order by counted.created_at desc
  offset v_offset
  limit v_limit;
end;
$$;

-- Grants
revoke all on function public.admin_get_self() from public;
grant execute on function public.admin_get_self() to authenticated;
revoke all on function public.admin_get_admin(uuid) from public;
grant execute on function public.admin_get_admin(uuid) to authenticated;
revoke all on function public.admin_set_admin_role(uuid, text, text) from public;
grant execute on function public.admin_set_admin_role(uuid, text, text) to authenticated;
revoke all on function public.admin_set_admin_status(uuid, text, text) from public;
grant execute on function public.admin_set_admin_status(uuid, text, text) to authenticated;
revoke all on function public.admin_grant_permissions(uuid, text[], text) from public;
grant execute on function public.admin_grant_permissions(uuid, text[], text) to authenticated;
revoke all on function public.admin_revoke_permissions(uuid, text[], text) from public;
grant execute on function public.admin_revoke_permissions(uuid, text[], text) to authenticated;

comment on function public.admin_get_self() is
  'Caller''s own admin record + granted permission keys for session resolution. Auto-accepts pending invite (invited->active). No rows when not an active admin. platform_admin permissions are expanded client-side to the full catalog.';
comment on function public.admin_set_admin_role(uuid, text, text) is
  'System > permissions role change on admin_accounts. platform_admin only, reason required, blocks self-demotion and last-active-platform_admin demotion. Audited (admin_role_changed). Effective next login.';
