-- down: 20260623180000_topik_writing_bulk_service_status_rpc.sql
-- 일괄 노출 상태 변경 RPC 제거(단건 admin_update_topik_question 은 영향 없음).
drop function if exists public.admin_bulk_set_writing_question_service_status(text[], text, text);
