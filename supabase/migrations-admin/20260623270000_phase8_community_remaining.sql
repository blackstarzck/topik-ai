-- Phase 8 (community, 2nd increment): permission gates on the remaining community
-- moderation RPCs. Same pattern: admin_has_permission(caller, '<key>') after is_admin.
--   admin_show_community_post     → community.posts.hide   (un-hide = same permission)
--   admin_resolve_community_report→ community.reports.resolve
--   admin_add_community_post_memo → community.reports.resolve
-- Bodies reproduced verbatim from live with only the guard inserted.
-- down: supabase/migrations-admin/down/20260623270000_phase8_community_remaining.sql

create or replace function public.admin_show_community_post(p_post_id text, p_reason text, p_policy_code text)
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
     set status = 'published',
         last_moderation_policy_code = p_policy_code,
         updated_by = caller_id::text,
         updated_at = now()
   where id = p_post_id
   returning * into v_saved;

  insert into public.admin_audit_logs (admin_user_id, action, target_table, target_id, diff, payload)
  values (
    caller_id, 'post_shown', 'CommunityPost', p_post_id,
    jsonb_build_object('status', jsonb_build_object('from', v_old.status, 'to', v_saved.status)),
    jsonb_build_object('reason', p_reason, 'policy_code', p_policy_code, 'title', v_saved.title)
  );
  return p_post_id;
end;
$function$;

create or replace function public.admin_resolve_community_report(p_report_id text, p_action text, p_reason text)
returns text
language plpgsql
security definer
set search_path to 'pg_catalog', 'public'
as $function$
declare
  caller_id uuid := auth.uid();
  v_report public.community_reports%rowtype;
begin
  if caller_id is null then raise exception 'unauthenticated'; end if;
  if not private.is_admin(caller_id) then raise exception 'forbidden: admin required'; end if;
  if not public.admin_has_permission(caller_id, 'community.reports.resolve') then
    raise exception 'forbidden: missing permission community.reports.resolve';
  end if;
  if nullif(btrim(coalesce(p_reason, '')), '') is null then raise exception 'reason required (operational reason)'; end if;
  if p_action not in ('hide_post','suspend_user','dismiss') then raise exception 'invalid report action: %', p_action; end if;

  select * into v_report from public.community_reports where id = p_report_id for update;
  if not found then raise exception 'unknown community report id: %', p_report_id; end if;

  if p_action = 'hide_post' and v_report.target_post_id is not null then
    update public.community_posts
       set status = 'hidden',
           last_moderation_policy_code = coalesce(v_report.reason_code, 'OTHER'),
           updated_by = caller_id::text,
           updated_at = now()
     where id = v_report.target_post_id;
  end if;

  update public.community_reports
     set process_status = 'resolved',
         resolution_action = p_action,
         resolved_by = caller_id::text,
         resolved_at = now()
   where id = p_report_id;

  insert into public.admin_audit_logs (admin_user_id, action, target_table, target_id, diff, payload)
  values (
    caller_id, 'report_resolved', 'CommunityReport', p_report_id,
    jsonb_build_object('process_status', jsonb_build_object('from', v_report.process_status, 'to', 'resolved')),
    jsonb_build_object(
      'action', p_action,
      'reason', p_reason,
      'affected_post_id', v_report.target_post_id,
      'affected_user_id', v_report.target_user_id,
      'user_suspend_integration', case when p_action = 'suspend_user' then 'intent_only_v13_admin_set_user_status_pending' else null end
    )
  );
  return p_report_id;
end;
$function$;

create or replace function public.admin_add_community_post_memo(p_post_id text, p_memo jsonb, p_reason text default null::text)
returns text
language plpgsql
security definer
set search_path to 'pg_catalog', 'public'
as $function$
declare
  caller_id uuid := auth.uid();
  v_post public.community_posts%rowtype;
  v_note_id text;
begin
  if caller_id is null then raise exception 'unauthenticated'; end if;
  if not private.is_admin(caller_id) then raise exception 'forbidden: admin required'; end if;
  if not public.admin_has_permission(caller_id, 'community.reports.resolve') then
    raise exception 'forbidden: missing permission community.reports.resolve';
  end if;
  if nullif(btrim(coalesce(p_memo->>'title', '')), '') is null then raise exception 'memo title required'; end if;
  if nullif(btrim(coalesce(p_memo->>'content', '')), '') is null then raise exception 'memo content required'; end if;

  select * into v_post from public.community_posts where id = p_post_id for update;
  if not found then raise exception 'unknown community post id: %', p_post_id; end if;

  v_note_id := public.next_community_post_admin_note_id(p_post_id);
  insert into public.community_post_admin_notes (
    id, post_id, title, type, author_id, author_name, content, created_at
  ) values (
    v_note_id,
    p_post_id,
    btrim(p_memo->>'title'),
    coalesce(nullif(btrim(p_memo->>'type'), ''), '기타'),
    coalesce(nullif(btrim(p_memo->>'author_id'), ''), caller_id::text),
    coalesce(nullif(btrim(p_memo->>'author_name'), ''), '관리자'),
    btrim(p_memo->>'content'),
    now()
  );

  update public.community_posts
     set updated_by = caller_id::text,
         updated_at = now()
   where id = p_post_id;

  insert into public.admin_audit_logs (admin_user_id, action, target_table, target_id, payload)
  values (
    caller_id, 'post_memo_added', 'CommunityPost', p_post_id,
    jsonb_build_object(
      'reason', nullif(btrim(coalesce(p_reason, '')), ''),
      'memo_id', v_note_id,
      'memo_title', btrim(p_memo->>'title'),
      'memo_type', coalesce(nullif(btrim(p_memo->>'type'), ''), '기타')
    )
  );
  return v_note_id;
end;
$function$;
