-- =====================================================================
-- topik-ai admin · 알림 기능 · admin-0008
-- 이메일 본문 크기 가드 (N-EML-08) — Gmail은 ~102KB 초과 HTML을 클리핑하며
-- "전체 메시지 보기"로 잘려 CTA/푸터/수신거부가 사라질 수 있다. email 채널
-- 템플릿의 body_html이 100KB(102400 bytes)를 넘으면 저장을 차단한다.
-- in_app/push/zalo는 클리핑 대상이 아니므로 제약하지 않는다.
-- CHECK로 항상 강제(우회 불가) + 저장 RPC가 친화적 메시지로 선차단.
-- down: supabase/migrations-admin/down/20260612180100_email_body_size_guard.sql
-- =====================================================================

alter table public.notification_templates
  drop constraint if exists notification_templates_email_body_size;
alter table public.notification_templates
  add constraint notification_templates_email_body_size
  check (channel <> 'email' or octet_length(coalesce(body_html, '')) <= 102400);

comment on constraint notification_templates_email_body_size on public.notification_templates is
  'N-EML-08: email 본문 100KB 가드(Gmail 102KB 클리핑 방지). in_app/push/zalo 제외.';

-- 저장 RPC에 친화적 선차단 메시지 추가 (CHECK보다 먼저 raise — admin-0006 정의 기반).
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
$$;
