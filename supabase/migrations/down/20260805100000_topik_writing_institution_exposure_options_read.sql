-- Rollback: 20260805100000_topik_writing_institution_exposure_options_read.sql
--
-- 읽기 전용 RPC 하나만 제거한다. 되돌리면 `auto_assign_new_questions` 가 다시 write-only
-- 가 되므로 관리 화면의 자동 배정 토글이 현재 상태를 그릴 수 없다 — 화면을 함께 되돌릴
-- 때만 실행하여라.

drop function if exists public.admin_list_institution_exposure_options(text[]);
