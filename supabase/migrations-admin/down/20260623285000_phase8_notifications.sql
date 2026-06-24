-- down: restore message (notification templates/dispatch/groups) RPCs without the admin_has_permission guard.

CREATE OR REPLACE FUNCTION public.admin_save_notification_group(p_id uuid, p_group jsonb, p_reason text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public'
AS $function$
declare
  caller_id uuid := auth.uid();
  v_id      uuid;
  v_action  text;
begin
  if caller_id is null then raise exception 'unauthenticated'; end if;
  if not private.is_admin(caller_id) then raise exception 'forbidden: admin required'; end if;
  if nullif(btrim(coalesce(p_reason, '')), '') is null then
    raise exception 'reason required (operational reason)';
  end if;

  if p_id is null then
    insert into public.notification_groups (
      name, description, definition_type, builder_mode, channels, member_count,
      rule_summary, filters, query_config, static_member_ids, status,
      last_calculated_at, updated_by
    ) values (
      p_group->>'name',
      coalesce(p_group->>'description', ''),
      coalesce(p_group->>'definition_type', 'static'),
      coalesce(p_group->>'builder_mode', 'simple'),
      coalesce(p_group->'channels', '[]'::jsonb),
      coalesce((p_group->>'member_count')::integer, 0),
      coalesce(p_group->>'rule_summary', ''),
      coalesce(p_group->'filters', '{}'::jsonb),
      p_group->'query_config',
      coalesce(p_group->'static_member_ids', '[]'::jsonb),
      coalesce(p_group->>'status', 'draft'),
      now(),
      caller_id
    ) returning id into v_id;
    v_action := 'notification_group_created';
  else
    update public.notification_groups set
      name              = coalesce(p_group->>'name', name),
      description       = coalesce(p_group->>'description', description),
      definition_type   = coalesce(p_group->>'definition_type', definition_type),
      builder_mode      = coalesce(p_group->>'builder_mode', builder_mode),
      channels          = coalesce(p_group->'channels', channels),
      member_count      = coalesce((p_group->>'member_count')::integer, member_count),
      rule_summary      = coalesce(p_group->>'rule_summary', rule_summary),
      filters           = coalesce(p_group->'filters', filters),
      query_config      = coalesce(p_group->'query_config', query_config),
      static_member_ids = coalesce(p_group->'static_member_ids', static_member_ids),
      status            = coalesce(p_group->>'status', status),
      last_calculated_at = now(),
      updated_by        = caller_id,
      updated_at        = now()
    where id = p_id
    returning id into v_id;
    if v_id is null then raise exception 'unknown group id: %', p_id; end if;
    v_action := 'notification_group_updated';
  end if;

  insert into public.admin_audit_logs (admin_user_id, action, target_table, target_id, payload)
  values (caller_id, v_action, 'Notification', v_id::text,
          jsonb_build_object('reason', p_reason, 'name', p_group->>'name'));
  return v_id;
end;
$function$;

CREATE OR REPLACE FUNCTION public.admin_delete_notification_group(p_id uuid, p_reason text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public'
AS $function$
declare
  caller_id uuid := auth.uid();
  v_name    text;
begin
  if caller_id is null then raise exception 'unauthenticated'; end if;
  if not private.is_admin(caller_id) then raise exception 'forbidden: admin required'; end if;
  if nullif(btrim(coalesce(p_reason, '')), '') is null then
    raise exception 'reason required (operational reason)';
  end if;

  delete from public.notification_groups where id = p_id returning name into v_name;
  if v_name is null then raise exception 'unknown group id: %', p_id; end if;

  insert into public.admin_audit_logs (admin_user_id, action, target_table, target_id, payload)
  values (caller_id, 'notification_group_deleted', 'Notification', p_id::text,
          jsonb_build_object('reason', p_reason, 'name', v_name));
end;
$function$;

CREATE OR REPLACE FUNCTION public.admin_save_notification_template(p_id uuid, p_template jsonb, p_reason text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public'
AS $function$
declare
  caller_id uuid := auth.uid();
  v_id      uuid;
  v_action  text;
  v_class   text := p_template->>'class';
  v_mandatory boolean := coalesce((p_template->>'mandatory')::boolean, false);
  v_channel text := p_template->>'channel';
  v_body    text := coalesce(p_template->>'body_html', '');
begin
  if caller_id is null then raise exception 'unauthenticated'; end if;
  if not private.is_admin(caller_id) then raise exception 'forbidden: admin required'; end if;
  if nullif(btrim(coalesce(p_reason, '')), '') is null then
    raise exception 'reason required (operational reason)';
  end if;
  if v_class is null then raise exception 'class required (notification-contract.md §2)'; end if;
  if v_class = 'marketing' and v_mandatory then
    raise exception 'marketing templates cannot be mandatory (contract §2)';
  end if;
  -- N-EML-08: email 본문 크기 가드 (Gmail ~102KB 클리핑)
  if v_channel = 'email' and octet_length(v_body) > 102400 then
    raise exception 'email body too large (% bytes > 102400). Gmail clips ~102KB — reduce body_html.', octet_length(v_body);
  end if;

  if p_id is null then
    insert into public.notification_templates (
      template_key, channel, class, mandatory, mode, category, name, summary,
      subject, body_html, body_json, variables, trigger_key, target_group_ids,
      status, link_url, updated_by
    ) values (
      p_template->>'template_key',
      v_channel,
      v_class,
      v_mandatory,
      coalesce(p_template->>'mode', 'manual'),
      p_template->>'category',
      p_template->>'name',
      coalesce(p_template->>'summary', ''),
      coalesce(p_template->>'subject', ''),
      v_body,
      p_template->'body_json',
      coalesce(p_template->'variables', '[]'::jsonb),
      p_template->>'trigger_key',
      coalesce(p_template->'target_group_ids', '[]'::jsonb),
      coalesce(p_template->>'status', 'draft'),
      coalesce(p_template->>'link_url', ''),
      caller_id
    ) returning id into v_id;
    v_action := 'notification_template_created';
  else
    update public.notification_templates set
      template_key     = coalesce(p_template->>'template_key', template_key),
      channel          = coalesce(v_channel, channel),
      class            = coalesce(v_class, class),
      mandatory        = v_mandatory,
      mode             = coalesce(p_template->>'mode', mode),
      category         = coalesce(p_template->>'category', category),
      name             = coalesce(p_template->>'name', name),
      summary          = coalesce(p_template->>'summary', summary),
      subject          = coalesce(p_template->>'subject', subject),
      body_html        = coalesce(p_template->>'body_html', body_html),
      body_json        = coalesce(p_template->'body_json', body_json),
      variables        = coalesce(p_template->'variables', variables),
      trigger_key      = coalesce(p_template->>'trigger_key', trigger_key),
      target_group_ids = coalesce(p_template->'target_group_ids', target_group_ids),
      status           = coalesce(p_template->>'status', status),
      link_url         = coalesce(p_template->>'link_url', link_url),
      updated_by       = caller_id,
      updated_at       = now()
    where id = p_id
    returning id into v_id;
    if v_id is null then raise exception 'unknown template id: %', p_id; end if;
    v_action := 'notification_template_updated';
  end if;

  insert into public.admin_audit_logs (admin_user_id, action, target_table, target_id, payload)
  values (caller_id, v_action, 'Notification', v_id::text,
          jsonb_build_object('reason', p_reason,
                             'template_key', p_template->>'template_key',
                             'channel', v_channel,
                             'class', v_class, 'mandatory', v_mandatory));
  return v_id;
end;
$function$;

CREATE OR REPLACE FUNCTION public.admin_set_notification_template_status(p_id uuid, p_next text, p_reason text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public'
AS $function$
declare
  caller_id uuid := auth.uid();
  v_from    text;
begin
  if caller_id is null then raise exception 'unauthenticated'; end if;
  if not private.is_admin(caller_id) then raise exception 'forbidden: admin required'; end if;
  if nullif(btrim(coalesce(p_reason, '')), '') is null then
    raise exception 'reason required (operational reason)';
  end if;
  if p_next not in ('active','inactive','draft') then
    raise exception 'invalid status: %', p_next;
  end if;

  select status into v_from from public.notification_templates where id = p_id;
  if not found then raise exception 'unknown template id: %', p_id; end if;
  if v_from = p_next then raise exception 'template already %', p_next; end if;

  update public.notification_templates
     set status = p_next, updated_by = caller_id, updated_at = now()
   where id = p_id;

  insert into public.admin_audit_logs (admin_user_id, action, target_table, target_id, diff, payload)
  values (caller_id, 'notification_template_status_changed', 'Notification', p_id::text,
          jsonb_build_object('status', jsonb_build_object('from', v_from, 'to', p_next)),
          jsonb_build_object('reason', p_reason));
end;
$function$;

CREATE OR REPLACE FUNCTION public.admin_delete_notification_template(p_id uuid, p_reason text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public'
AS $function$
declare
  caller_id uuid := auth.uid();
  v_key     text;
begin
  if caller_id is null then raise exception 'unauthenticated'; end if;
  if not private.is_admin(caller_id) then raise exception 'forbidden: admin required'; end if;
  if nullif(btrim(coalesce(p_reason, '')), '') is null then
    raise exception 'reason required (operational reason)';
  end if;

  delete from public.notification_templates where id = p_id returning template_key into v_key;
  if v_key is null then raise exception 'unknown template id: %', p_id; end if;

  insert into public.admin_audit_logs (admin_user_id, action, target_table, target_id, payload)
  values (caller_id, 'notification_template_deleted', 'Notification', p_id::text,
          jsonb_build_object('reason', p_reason, 'template_key', v_key));
end;
$function$;

CREATE OR REPLACE FUNCTION public.admin_send_notification(p_template_id uuid, p_group_ids jsonb, p_scheduled_at timestamp with time zone, p_reason text, p_target_type text DEFAULT 'group'::text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public'
AS $function$
declare
  caller_id  uuid := auth.uid();
  v_template public.notification_templates%rowtype;
  v_id       uuid;
  v_status   text;
begin
  if caller_id is null then raise exception 'unauthenticated'; end if;
  if not private.is_admin(caller_id) then raise exception 'forbidden: admin required'; end if;
  if nullif(btrim(coalesce(p_reason, '')), '') is null then
    raise exception 'reason required (operational reason)';
  end if;
  if p_target_type not in ('group','test') then
    raise exception 'admin dispatch target_type must be group|test, got %', p_target_type;
  end if;

  select * into v_template from public.notification_templates where id = p_template_id;
  if not found then raise exception 'unknown template id: %', p_template_id; end if;
  if v_template.status <> 'active' then
    raise exception 'template not active (status=%): activate before sending', v_template.status;
  end if;
  if p_target_type = 'group'
     and (p_group_ids is null or jsonb_typeof(p_group_ids) <> 'array' or jsonb_array_length(p_group_ids) = 0) then
    raise exception 'group dispatch requires at least one group id';
  end if;

  v_status := case when p_scheduled_at is not null then 'scheduled' else 'running' end;

  insert into public.notification_dispatches (
    template_id, template_key, channels, target_type, target_group_ids,
    status, actor_id, reason, dedupe_key, scheduled_at,
    started_at
  ) values (
    v_template.id,
    v_template.template_key,
    jsonb_build_array(v_template.channel),
    p_target_type,
    coalesce(p_group_ids, '[]'::jsonb),
    v_status,
    caller_id,
    p_reason,
    'admin:' || gen_random_uuid()::text,
    p_scheduled_at,
    case when p_scheduled_at is null then now() else null end
  ) returning id into v_id;

  insert into public.admin_audit_logs (admin_user_id, action, target_table, target_id, payload)
  values (caller_id, 'notification_dispatch_created', 'Notification', v_id::text,
          jsonb_build_object(
            'reason', p_reason,
            'template_key', v_template.template_key,
            'channel', v_template.channel,
            'class', v_template.class,
            'mandatory', v_template.mandatory,
            'bypass_reason', case when v_template.mandatory then p_reason else null end,
            'target_type', p_target_type,
            'target_group_ids', coalesce(p_group_ids, '[]'::jsonb),
            'scheduled_at', p_scheduled_at
          ));
  return v_id;
end;
$function$;

CREATE OR REPLACE FUNCTION public.admin_cancel_notification_dispatch(p_dispatch_id uuid, p_reason text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public'
AS $function$
declare
  caller_id uuid := auth.uid();
  v_status  text;
  v_key     text;
begin
  if caller_id is null then raise exception 'unauthenticated'; end if;
  if not private.is_admin(caller_id) then raise exception 'forbidden: admin required'; end if;
  if nullif(btrim(coalesce(p_reason, '')), '') is null then
    raise exception 'reason required (operational reason)';
  end if;

  select status, template_key into v_status, v_key
    from public.notification_dispatches
   where id = p_dispatch_id;
  if not found then raise exception 'unknown dispatch'; end if;
  if v_status <> 'scheduled' then
    raise exception 'only scheduled dispatches can be canceled (status=%)', v_status;
  end if;

  update public.notification_dispatches
     set status = 'canceled', completed_at = now()
   where id = p_dispatch_id;

  insert into public.admin_audit_logs (admin_user_id, action, target_table, target_id, payload)
  values (caller_id, 'notification_dispatch_canceled', 'Notification', p_dispatch_id::text,
          jsonb_build_object('reason', p_reason, 'template_key', v_key));
end;
$function$;

CREATE OR REPLACE FUNCTION public.admin_send_terms_change_notification(p_reason text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public'
AS $function$
declare
  caller_id   uuid := auth.uid();
  v_group_id  uuid;
  v_member_ids jsonb;
  v_count     int;
  v_in_app_tpl uuid;
  v_email_tpl  uuid;
  v_in_app_dispatch uuid;
  v_email_dispatch  uuid;
begin
  if caller_id is null then raise exception 'unauthenticated'; end if;
  if not private.is_admin(caller_id) then raise exception 'forbidden: admin required'; end if;
  if nullif(btrim(coalesce(p_reason, '')), '') is null then
    raise exception 'reason required (operational reason)';
  end if;

  -- 발송 시점의 활성 회원 전체를 스냅샷으로 적재(디스패처는 static_member_ids만 평가).
  select coalesce(jsonb_agg(id), '[]'::jsonb), count(*)
    into v_member_ids, v_count
    from public.profiles
   where status = 'active';

  select id into v_group_id
    from public.notification_groups
   where name = '전체 활성 사용자'
   order by created_at
   limit 1;

  if v_group_id is null then
    insert into public.notification_groups (
      name, description, definition_type, builder_mode, channels, member_count,
      rule_summary, filters, static_member_ids, status, last_calculated_at, updated_by
    ) values (
      '전체 활성 사용자',
      '약관 변경 등 전체 공지 대상(활성 회원 전원, 발송 시 스냅샷).',
      'static', 'simple', '["in_app","email"]'::jsonb, v_count,
      '활성 회원 전체', '{}'::jsonb, v_member_ids, 'active', now(), caller_id
    )
    returning id into v_group_id;
  else
    update public.notification_groups
       set static_member_ids = v_member_ids,
           member_count = v_count,
           status = 'active',
           last_calculated_at = now(),
           updated_by = caller_id,
           updated_at = now()
     where id = v_group_id;
  end if;

  select id into v_in_app_tpl
    from public.notification_templates
   where template_key = 'legal_terms_changed' and channel = 'in_app'
   limit 1;
  select id into v_email_tpl
    from public.notification_templates
   where template_key = 'legal_terms_changed' and channel = 'email'
   limit 1;
  if v_in_app_tpl is null or v_email_tpl is null then
    raise exception 'legal_terms_changed templates missing (in_app/email)';
  end if;

  v_in_app_dispatch := public.admin_send_notification(
    v_in_app_tpl, jsonb_build_array(v_group_id::text), null, p_reason, 'group');
  v_email_dispatch := public.admin_send_notification(
    v_email_tpl, jsonb_build_array(v_group_id::text), null, p_reason, 'group');

  return jsonb_build_object(
    'group_id', v_group_id,
    'recipients', v_count,
    'in_app_dispatch', v_in_app_dispatch,
    'email_dispatch', v_email_dispatch
  );
end;
$function$;
