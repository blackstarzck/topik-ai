-- down: Operation 정책 관리 admin RPC + helper + 테이블 제거
drop function if exists public.admin_publish_operation_policy_version(text, text, text);
drop function if exists public.admin_delete_operation_policy(text, text);
drop function if exists public.admin_toggle_operation_policy_status(text, text, text);
drop function if exists public.admin_save_operation_policy(text, jsonb, text);
drop function if exists public.next_operation_policy_history_id();
drop function if exists public.next_operation_policy_id();
drop function if exists public.operation_policy_snapshot(public.operation_policies);
drop table if exists public.operation_policy_histories;
drop table if exists public.operation_policies;
