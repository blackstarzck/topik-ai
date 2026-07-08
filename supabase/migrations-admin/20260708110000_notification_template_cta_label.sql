-- =====================================================================
-- topik-ai admin · 이메일 CTA 버튼 문구 관리(오너 지적 2026-07-08)
--
-- 이메일 워커(dispatch-email)는 template.link_url 이 있으면 본문 하단에 CTA 앵커를
-- 자동 삽입하는데, 버튼 문구('알림 확인하기')가 코드에 하드코딩되어 관리자 템플릿
-- 편집 화면에서 보이지도 바꿀 수도 없었다. cta_label 컬럼을 추가해 관리자가
-- 메시지 ▸ 메일 템플릿에서 문구를 관리하게 한다.
--   - 빈 값('') = 워커 기본 문구('알림 확인하기') 사용 (기존 발송물 동작 불변)
--   - link_url 이 비어 있으면 CTA 자체가 붙지 않는 기존 규칙 유지
-- admin_save_notification_template 도 cta_label 을 저장하도록 재정의(20260612170500 + 1필드).
-- down: supabase/migrations-admin/down/20260708110000_notification_template_cta_label.sql
-- =====================================================================

alter table public.notification_templates
  add column if not exists cta_label text not null default '';

comment on column public.notification_templates.cta_label is
  '이메일 본문 하단 자동 삽입 CTA 버튼 문구. 빈 값이면 워커 기본(알림 확인하기). link_url 이 비면 CTA 미삽입.';

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
      status, link_url, cta_label, updated_by
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
      coalesce(p_template->>'cta_label', ''),
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
      cta_label        = coalesce(p_template->>'cta_label', cta_label),
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
