-- Down · admin-0020 · Users directory RPCs
-- get_admin_users / admin_set_user_status 제거. (테이블 신설 없음 — v13 읽기/토글만)
drop function if exists public.admin_set_user_status(uuid, text);
drop function if exists public.get_admin_users(text, text, integer, integer);
