-- Phase 8 enforcement (user admin memos): admin_has_permission gates after is_admin.
-- Generated from live bodies by scripts/db/gen-phase8-enforcement.mjs.
-- down: supabase/migrations-admin/down/20260623286000_phase8_user_memos.sql

CREATE OR REPLACE FUNCTION public.admin_add_user_memo(p_user_id text, p_content text, p_reason text)
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public'
AS $function$
declare
  caller_id uuid := auth.uid();
  v_admin_name text;
  v_id text;
begin
  if caller_id is null then raise exception 'unauthenticated'; end if;
  if not private.is_admin(caller_id) then raise exception 'forbidden: admin required'; end if;
  if not public.admin_has_permission(caller_id, 'users.read') then raise exception 'forbidden: missing permission users.read'; end if;
  if nullif(btrim(coalesce(p_user_id, '')), '') is null then raise exception 'user id required'; end if;
  if nullif(btrim(coalesce(p_content, '')), '') is null then raise exception 'content required'; end if;
  if nullif(btrim(coalesce(p_reason, '')), '') is null then raise exception 'reason required'; end if;

  select coalesce(nullif(p.display_name, ''), nullif(p.nickname::text, ''), caller_id::text)
    into v_admin_name
    from public.profiles p
   where p.id = caller_id;

  insert into public.user_admin_memos (user_id, admin_user_id, admin_name, content)
       values (p_user_id, caller_id, v_admin_name, btrim(p_content))
    returning id into v_id;

  insert into public.admin_audit_logs (admin_user_id, action, target_table, target_id, diff, payload)
  values (
    caller_id,
    'user_memo_added',
    'User',
    p_user_id,
    jsonb_build_object('memo_id', v_id),
    jsonb_build_object('reason', btrim(p_reason), 'memo_id', v_id, 'content_preview', left(btrim(p_content), 80))
  );

  return v_id;
end;
$function$;

CREATE OR REPLACE FUNCTION public.admin_delete_user_memo(p_memo_id text, p_reason text)
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public'
AS $function$
declare
  caller_id uuid := auth.uid();
  v_user_id text;
begin
  if caller_id is null then raise exception 'unauthenticated'; end if;
  if not private.is_admin(caller_id) then raise exception 'forbidden: admin required'; end if;
  if not public.admin_has_permission(caller_id, 'users.read') then raise exception 'forbidden: missing permission users.read'; end if;
  if nullif(btrim(coalesce(p_reason, '')), '') is null then raise exception 'reason required'; end if;

  delete from public.user_admin_memos where id = p_memo_id returning user_id into v_user_id;
  if v_user_id is null then
    raise exception 'unknown memo id: %', p_memo_id;
  end if;

  insert into public.admin_audit_logs (admin_user_id, action, target_table, target_id, diff, payload)
  values (
    caller_id,
    'user_memo_deleted',
    'User',
    v_user_id,
    jsonb_build_object('memo_id', p_memo_id),
    jsonb_build_object('reason', btrim(p_reason), 'memo_id', p_memo_id)
  );

  return p_memo_id;
end;
$function$;
