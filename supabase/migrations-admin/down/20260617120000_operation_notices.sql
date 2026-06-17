-- down: Operation 공지사항 admin RPC + 테이블 제거
drop function if exists public.admin_delete_operation_notice(text, text);
drop function if exists public.admin_toggle_operation_notice_status(text, text, text);
drop function if exists public.admin_save_operation_notice(text, jsonb, text);
drop table if exists public.operation_notices;
