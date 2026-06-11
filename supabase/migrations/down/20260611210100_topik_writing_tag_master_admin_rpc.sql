-- down: 0014 admin_update_tag_master_status 제거 (P5-3 롤백)
-- tag_master 행 데이터는 무변경 — RPC만 제거한다(토글된 is_active 값은 유지).
drop function if exists public.admin_update_tag_master_status(text, boolean, text);
