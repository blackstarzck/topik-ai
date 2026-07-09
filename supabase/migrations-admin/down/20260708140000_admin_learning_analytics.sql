-- down: 20260708140000_admin_learning_analytics
-- 신설 RPC 제거(선행 상태에는 존재하지 않던 함수).

drop function if exists public.get_admin_learning_analytics(integer);
