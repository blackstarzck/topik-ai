-- =====================================================================
-- topik-ai admin · 이용약관 버전 변경 알림(인앱+이메일)
-- 오너 결정(2026-06-22): 관리자 수동 발송, 대상=전체 활성 사용자, CTA=/terms-agreement.
--
-- 템플릿 2종(template_key='legal_terms_changed'):
--   - in_app : class=operational, mandatory=true  → 디스패처가 전원 'sent'(수신거부 불가 공지)
--   - email  : class=operational, mandatory=false → 디스패처 규칙상 pref_on+email_on 사용자에게 'pending'→발송
-- 트리거 RPC admin_send_terms_change_notification(p_reason):
--   활성 회원 전원을 정적 그룹에 스냅샷 적재 후 두 채널 dispatch를 생성(즉시 running).
--   실제 집행(수신자 산정·user_notifications/email)은 v13 pg_cron 디스패처가 수행.
-- 그룹/디스패치/감사는 topik-ai 소유 테이블만 기록. profiles는 read-only 참조(get_admin_users 선례).
-- down: supabase/migrations-admin/down/20260622170000_legal_terms_change_notification.sql
-- =====================================================================

insert into public.notification_templates (
  template_key, channel, class, mandatory, mode, category, name, summary,
  subject, body_html, variables, link_url, status
) values
(
  'legal_terms_changed', 'in_app', 'operational', true, 'manual', 'notice',
  '이용약관 개정 안내(인앱)',
  '이용약관 버전 변경 시 전체 사용자에게 발송하는 인앱 공지.',
  '이용약관이 개정되었습니다',
  '<p>{{display_name}}님, TOPIK AI 이용약관이 새 버전으로 개정되었습니다. 변경 내용을 확인하고 동의해 주세요.</p>',
  '["display_name"]'::jsonb, '/terms-agreement', 'active'
),
(
  'legal_terms_changed', 'email', 'operational', false, 'manual', 'notice',
  '이용약관 개정 안내(이메일)',
  '이용약관 버전 변경 시 발송하는 이메일 공지(이메일 수신 설정 사용자 대상).',
  '[TOPIK AI] 이용약관 개정 안내',
  '<p>{{display_name}}님, 안녕하세요.</p><p>TOPIK AI 이용약관이 새 버전으로 개정되었습니다. 아래 버튼을 눌러 변경된 약관을 확인하고 동의해 주세요. 로그인되어 있지 않은 경우 로그인 후 약관 동의 화면으로 이동합니다.</p>',
  '["display_name"]'::jsonb, '/terms-agreement', 'active'
)
on conflict (template_key, channel) do nothing;

create or replace function public.admin_send_terms_change_notification(p_reason text)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
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
$$;
revoke all on function public.admin_send_terms_change_notification(text) from public;
grant execute on function public.admin_send_terms_change_notification(text) to authenticated;
