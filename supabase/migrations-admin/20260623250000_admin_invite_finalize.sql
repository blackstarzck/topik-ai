-- Phase 6: admin invite finalization RPC.
-- Called by the api/admin/invite serverless function (service role) AFTER it has
-- (1) verified the caller's JWT and (2) confirmed the caller is an active
-- platform_admin, and after Supabase auth.admin.inviteUserByEmail created the new
-- auth.users row (and the serverless deleted the transient profiles row so the admin
-- is physically separated). This RPC records the admin_accounts row (status='invited'
-- until first login), seeds permission grants, and writes the audit entry.
--
-- Security: execute is granted to service_role ONLY (never authenticated), because the
-- function trusts p_caller_id for audit attribution — only the server (service role),
-- which has already authorized the caller, may call it. Defense-in-depth: it still
-- re-verifies p_caller_id is an active platform_admin.
-- down: supabase/migrations-admin/down/20260623250000_admin_invite_finalize.sql

create or replace function public.admin_finalize_invite(
  p_caller_id    uuid,
  p_user_id      uuid,
  p_email        text,
  p_display_name text,
  p_role         text,
  p_keys         text[]
)
returns uuid
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_affected int := 0;
begin
  if p_caller_id is null then raise exception 'caller id required'; end if;
  if not exists (
    select 1 from public.admin_accounts
    where id = p_caller_id and role = 'platform_admin' and status = 'active'
  ) then
    raise exception 'forbidden: platform_admin required';
  end if;
  if p_user_id is null then raise exception 'invited user id required'; end if;
  if p_role not in ('platform_admin', 'content_admin', 'org_admin') then
    raise exception 'invalid role: %', p_role;
  end if;

  insert into public.admin_accounts (id, email, display_name, role, status, created_by, invited_at)
  values (
    p_user_id,
    nullif(btrim(p_email), ''),
    nullif(btrim(p_display_name), ''),
    p_role,
    'invited',
    p_caller_id,
    now()
  )
  on conflict (id) do update
    set role = excluded.role,
        email = coalesce(excluded.email, public.admin_accounts.email),
        display_name = coalesce(excluded.display_name, public.admin_accounts.display_name),
        updated_at = now();

  if p_keys is not null and array_length(p_keys, 1) is not null then
    insert into public.admin_permission_grants (admin_id, permission_key, granted_by)
    select p_user_id, k, p_caller_id
    from unnest(p_keys) as k
    where nullif(btrim(k), '') is not null
    on conflict (admin_id, permission_key) do nothing;
    get diagnostics v_affected = row_count;
  end if;

  insert into public.admin_audit_logs (admin_user_id, action, target_table, target_id, diff, payload)
  values (
    p_caller_id, 'admin_invited', 'AdminAccount', p_user_id::text,
    jsonb_build_object('role', jsonb_build_object('from', null, 'to', p_role)),
    jsonb_build_object(
      'email', nullif(btrim(p_email), ''),
      'granted_keys', to_jsonb(coalesce(p_keys, array[]::text[])),
      'granted_count', v_affected,
      'status', 'invited'
    )
  );

  return p_user_id;
end;
$$;

-- Service-role ONLY. Must explicitly revoke anon + authenticated: Supabase's default
-- privileges grant EXECUTE on new functions to anon/authenticated, and this RPC trusts
-- p_caller_id (a parameter, not auth.uid()), so any non-service caller could pass a
-- known platform_admin id and self-promote. Revoke them all.
revoke all on function public.admin_finalize_invite(uuid, uuid, text, text, text, text[]) from public;
revoke all on function public.admin_finalize_invite(uuid, uuid, text, text, text, text[]) from anon;
revoke all on function public.admin_finalize_invite(uuid, uuid, text, text, text, text[]) from authenticated;
grant execute on function public.admin_finalize_invite(uuid, uuid, text, text, text, text[]) to service_role;

comment on function public.admin_finalize_invite(uuid, uuid, text, text, text, text[]) is
  'Server-only (service_role) admin invite finalizer. Records admin_accounts(status=invited) + permission grants + audit(admin_invited). Re-verifies p_caller_id is an active platform_admin. Called by api/admin/invite after inviteUserByEmail + transient profiles-row deletion.';
