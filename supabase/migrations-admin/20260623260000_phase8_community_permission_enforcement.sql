-- Phase 8 (1st increment): server-side fine-grained permission enforcement.
--
-- Adds public.admin_has_permission(caller, '<key>') gates to the high-risk community
-- post moderation RPCs, on top of the existing private.is_admin coarse gate. This is
-- the defense-in-depth layer so a non-super admin without the specific grant is rejected
-- even on a direct RPC call (not just hidden in the menu). platform_admin bypasses
-- admin_has_permission (returns true), so super-admin behavior is unchanged.
--
-- Bodies are reproduced verbatim from the live functions with ONLY the permission
-- guard inserted after the is_admin check. Rollout continues domain-by-domain
-- (community show/report/memo, operation, commerce, users, ...) in later increments.
-- down: supabase/migrations-admin/down/20260623260000_phase8_community_permission_enforcement.sql

create or replace function public.admin_hide_community_post(p_post_id text, p_reason text, p_policy_code text)
returns text
language plpgsql
security definer
set search_path to 'pg_catalog', 'public'
as $function$
declare
  caller_id uuid := auth.uid();
  v_old public.community_posts%rowtype;
  v_saved public.community_posts%rowtype;
begin
  if caller_id is null then raise exception 'unauthenticated'; end if;
  if not private.is_admin(caller_id) then raise exception 'forbidden: admin required'; end if;
  if not public.admin_has_permission(caller_id, 'community.posts.hide') then
    raise exception 'forbidden: missing permission community.posts.hide';
  end if;
  if nullif(btrim(coalesce(p_reason, '')), '') is null then raise exception 'reason required (operational reason)'; end if;
  if p_policy_code is not null and p_policy_code not in ('SPAM','ABUSE','AD','PRIVACY','DUPLICATE','OTHER') then
    raise exception 'invalid community policy code: %', p_policy_code;
  end if;

  select * into v_old from public.community_posts where id = p_post_id for update;
  if not found then raise exception 'unknown community post id: %', p_post_id; end if;

  update public.community_posts
     set status = 'hidden',
         last_moderation_policy_code = p_policy_code,
         updated_by = caller_id::text,
         updated_at = now()
   where id = p_post_id
   returning * into v_saved;

  insert into public.admin_audit_logs (admin_user_id, action, target_table, target_id, diff, payload)
  values (
    caller_id, 'post_hidden', 'CommunityPost', p_post_id,
    jsonb_build_object('status', jsonb_build_object('from', v_old.status, 'to', v_saved.status)),
    jsonb_build_object('reason', p_reason, 'policy_code', p_policy_code, 'title', v_saved.title)
  );
  return p_post_id;
end;
$function$;

create or replace function public.admin_delete_community_post(p_post_id text, p_reason text)
returns text
language plpgsql
security definer
set search_path to 'pg_catalog', 'public'
as $function$
declare
  caller_id uuid := auth.uid();
  v_old public.community_posts%rowtype;
begin
  if caller_id is null then raise exception 'unauthenticated'; end if;
  if not private.is_admin(caller_id) then raise exception 'forbidden: admin required'; end if;
  if not public.admin_has_permission(caller_id, 'community.posts.delete') then
    raise exception 'forbidden: missing permission community.posts.delete';
  end if;
  if nullif(btrim(coalesce(p_reason, '')), '') is null then raise exception 'reason required (operational reason)'; end if;

  select * into v_old from public.community_posts where id = p_post_id for update;
  if not found then raise exception 'unknown community post id: %', p_post_id; end if;

  insert into public.admin_audit_logs (admin_user_id, action, target_table, target_id, diff, payload)
  values (
    caller_id, 'post_deleted', 'CommunityPost', p_post_id,
    jsonb_build_object('deleted', jsonb_build_object('from', false, 'to', true)),
    jsonb_build_object('reason', p_reason, 'title', v_old.title)
  );

  delete from public.community_posts where id = p_post_id;
  return p_post_id;
end;
$function$;
