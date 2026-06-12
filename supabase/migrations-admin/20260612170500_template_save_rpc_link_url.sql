-- =====================================================================
-- topik-ai admin · 알림 기능 · admin-0006
-- admin_save_notification_template에 link_url 반영 (admin-0004 컬럼 추가가
-- admin-0002 RPC보다 늦어 저장 경로에서 누락됐던 결함 수정 — WP2 발견).
-- down: supabase/migrations-admin/down/20260612170500_template_save_rpc_link_url.sql
-- =====================================================================

create or replace function public.admin_save_notification_template(
  p_id        uuid,
  p_template  jsonb,
  p_reason    text
)
returns uuid
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  caller_id uuid := auth.uid();
  v_id      uuid;
  v_action  text;
  v_class   text := p_template->>'class';
  v_mandatory boolean := coalesce((p_template->>'mandatory')::boolean, false);
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

  if p_id is null then
    insert into public.notification_templates (
      template_key, channel, class, mandatory, mode, category, name, summary,
      subject, body_html, body_json, variables, trigger_key, target_group_ids,
      status, link_url, updated_by
    ) values (
      p_template->>'template_key',
      p_template->>'channel',
      v_class,
      v_mandatory,
      coalesce(p_template->>'mode', 'manual'),
      p_template->>'category',
      p_template->>'name',
      coalesce(p_template->>'summary', ''),
      coalesce(p_template->>'subject', ''),
      coalesce(p_template->>'body_html', ''),
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
      channel          = coalesce(p_template->>'channel', channel),
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
                             'channel', p_template->>'channel',
                             'class', v_class, 'mandatory', v_mandatory));
  return v_id;
end;
$$;
