-- down: 예약 발송 취소 RPC 제거
drop function if exists public.admin_cancel_notification_dispatch(uuid, text);
