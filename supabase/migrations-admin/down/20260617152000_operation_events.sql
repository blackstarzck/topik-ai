-- down: Operation 이벤트 admin RPC + 테이블 제거
drop function if exists public.admin_end_operation_event(text, text);
drop function if exists public.admin_publish_operation_event(text, text);
drop function if exists public.admin_schedule_operation_event(text, text);
drop function if exists public.admin_save_operation_event(text, jsonb, text);
drop table if exists public.operation_events;
