-- Rollback: 20260805110000_admin_contract_expiry_notifications.sql
--
-- **알림 원장 테이블은 남긴다.** 적재 함수와 tick 배선을 제거하면 새 알림이 쌓이지 않으므로
-- 동작에는 영향이 없고, 관리자가 이미 받은 알림과 읽음 기록이 보존되며 down→up 재적용 시
-- 그대로 살아난다. 계약 원장·설정 테이블을 남긴 20260804100000/100200 down 과 같은 판단이다.
-- 테이블까지 지우려면 이 파일 실행 후 수동으로:
--   drop table public.admin_notifications;

-- ---------------------------------------------------------------- tick 원복 (20260723011242 본문)
-- contract_expiry 키만 뺀다. 나머지 키를 그대로 유지해야 예약 알림·이메일 재시도가 계속 돈다.
create or replace function private.dispatch_notifications()
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, private
as $$
begin
  return jsonb_build_object(
    'at', now(),
    'study_reminder',       private.dispatch_scheduled_notifications('study_reminder', 'in_app'),
    'weekly_summary',       private.dispatch_scheduled_notifications('weekly_summary', 'in_app'),
    'study_reminder_email', private.dispatch_scheduled_notifications('study_reminder', 'email'),
    'weekly_summary_email', private.dispatch_scheduled_notifications('weekly_summary', 'email'),
    'admin',                private.dispatch_admin_notifications(),
    'email_retry',          private.retry_failed_email_attempts()
  );
end;
$$;

revoke all on function private.dispatch_notifications() from public;
revoke all on function private.dispatch_notifications() from anon;
revoke all on function private.dispatch_notifications() from authenticated;

comment on function private.dispatch_notifications() is
  '알림 파이프라인 10분 tick(cron job dispatch_notifications). 예약 알림 4종 + 관리자 발송 디스패처 + 이메일 재시도를 한 번에 돌리고 각 결과를 jsonb 로 모은다.';

-- ---------------------------------------------------------------- 적재 함수·RPC 제거
drop function if exists private.enqueue_contract_expiry_notifications();
drop function if exists public.admin_mark_all_notifications_read();
drop function if exists public.admin_mark_notification_read(uuid);
drop function if exists public.admin_count_my_unread_notifications();
drop function if exists public.admin_list_my_notifications(integer, boolean);

-- 원복 후 tick 이 온전한지 확인한다(키를 하나 빼면서 다른 키를 잃는 사고 방지).
do $verify$
declare
  v_def text := pg_get_functiondef(to_regprocedure('private.dispatch_notifications()'));
begin
  if position('enqueue_contract_expiry_notifications' in v_def) > 0 then
    raise exception 'dispatch_notifications_still_calls_removed_function';
  end if;
  if position('dispatch_scheduled_notifications' in v_def) = 0
     or position('dispatch_admin_notifications' in v_def) = 0
     or position('retry_failed_email_attempts' in v_def) = 0 then
    raise exception 'dispatch_notifications_lost_existing_keys';
  end if;
end
$verify$;
