-- Admin RBAC SoT write path: profiles.app_role only.
-- v13 owns public.profiles and private.protect_profile_columns. This migration
-- does not change v13 DDL/triggers. The protect_profile_columns trigger bypasses
-- writes entirely for is_admin(caller) (content_admin/platform_admin, active), so
-- a platform_admin caller may write app_role — same mechanism as the live
-- admin_set_user_status precedent on the status column. Verified on dev DB
-- (fglggyfvzjdsbyckinqa, 2026-06-18): direct empirical probe confirmed the write
-- succeeds for a platform_admin and is rejected for every guard. The UPDATE below
-- additionally self-verifies (RETURNING) so a future trigger change that silently
-- suppresses the write fails loudly instead of recording a false audit entry.
-- down: supabase/migrations-admin/down/20260618093000_admin_set_app_role.sql

create or replace function public.admin_set_admin_app_role(
  p_target_user_id uuid,
  p_new_app_role text,
  p_reason text
)
returns uuid
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  caller_id uuid := auth.uid();
  v_old_app_role text;
  v_target_email text;
  v_target_display text;
  v_platform_admin_count integer;
  v_persisted_app_role text;
begin
  if caller_id is null then
    raise exception 'unauthenticated';
  end if;

  if not private.is_platform_admin(caller_id) then
    raise exception 'forbidden: platform_admin required';
  end if;

  if p_target_user_id is null then
    raise exception 'target user id required';
  end if;

  if p_new_app_role not in ('platform_admin', 'content_admin', 'org_admin', 'learner') then
    raise exception 'invalid app_role: %', p_new_app_role;
  end if;

  if nullif(btrim(coalesce(p_reason, '')), '') is null then
    raise exception 'reason required';
  end if;

  select p.app_role, u.email::text, coalesce(nullif(p.display_name, ''), nullif(p.nickname::text, ''), u.email::text)
    into v_old_app_role, v_target_email, v_target_display
    from public.profiles p
    left join auth.users u on u.id = p.id
   where p.id = p_target_user_id
   for update of p;

  if not found then
    raise exception 'unknown user id: %', p_target_user_id;
  end if;

  if v_old_app_role = p_new_app_role then
    raise exception 'admin app_role already %', p_new_app_role;
  end if;

  if caller_id = p_target_user_id and v_old_app_role = 'platform_admin' and p_new_app_role <> 'platform_admin' then
    raise exception 'cannot demote your own platform_admin role';
  end if;

  -- Defense-in-depth. Under the current invariants this branch is effectively
  -- unreachable: a platform_admin caller demoting the *last* platform_admin would
  -- have to be demoting themselves, which the self-demotion guard above already
  -- blocks. Kept so a future weakening of is_platform_admin cannot open a lockout.
  if v_old_app_role = 'platform_admin' and p_new_app_role <> 'platform_admin' then
    select count(*) into v_platform_admin_count
      from public.profiles
     where app_role = 'platform_admin';

    if v_platform_admin_count <= 1 then
      raise exception 'cannot demote the last platform_admin';
    end if;
  end if;

  -- Live write is intentionally limited to the SoT column and self-verifies:
  -- RETURNING reflects the post-trigger row, so if protect_profile_columns ever
  -- silently suppresses the admin app_role write the function aborts loudly
  -- instead of recording a false audit entry. (Verified allowed on dev DB
  -- 2026-06-18; this guard protects against future trigger-policy changes.)
  update public.profiles
     set app_role = p_new_app_role
   where id = p_target_user_id
  returning app_role into v_persisted_app_role;

  if v_persisted_app_role is distinct from p_new_app_role then
    raise exception
      'app_role write suppressed (persisted=%, expected=%); protect_profile_columns may no longer allow admin app_role writes',
      v_persisted_app_role, p_new_app_role
      using errcode = '42501';
  end if;

  insert into public.admin_audit_logs (admin_user_id, action, target_table, target_id, diff, payload)
  values (
    caller_id,
    'admin_role_changed',
    'AdminAccount',
    p_target_user_id::text,
    jsonb_build_object('app_role', jsonb_build_object('from', v_old_app_role, 'to', p_new_app_role)),
    jsonb_build_object(
      'reason', btrim(p_reason),
      'target_email', v_target_email,
      'target_display', v_target_display,
      'session_policy', 'next_login'
    )
  );

  return p_target_user_id;
end;
$$;

revoke all on function public.admin_set_admin_app_role(uuid, text, text) from public;
grant execute on function public.admin_set_admin_app_role(uuid, text, text) to authenticated;

comment on function public.admin_set_admin_app_role(uuid, text, text) is
  'System > permissions app_role change. platform_admin only, reason required, blocks self platform_admin demotion (last-admin guard kept as defense-in-depth), writes profiles.app_role (self-verified via RETURNING) and admin_audit_logs(action=admin_role_changed,target=AdminAccount). Existing sessions are not revoked; next login reflects the change. profiles.app_role write relies on the protect_profile_columns admin bypass (is_admin caller) — verified allowed on dev DB 2026-06-18.';
