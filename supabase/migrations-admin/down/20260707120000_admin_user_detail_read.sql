-- down: drop the single-member detail read RPC. 회원 상세는 다시 목록 RPC
-- 폴백(상위 100명 스캔) 경로로 동작한다(프론트가 실패 시 폴백하도록 되어 있음).

drop function if exists public.get_admin_user(uuid);
