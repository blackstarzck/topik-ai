-- down: 20260625100100_topik_writing_question_institution_exposure_rpcs.sql
-- 기관별 노출 관리 RPC 3종 제거(매핑 테이블 20260625100000 은 영향 없음).
drop function if exists public.admin_set_writing_question_institutions(text[], text[], text);
drop function if exists public.admin_clear_writing_question_institutions(text[], text);
drop function if exists public.admin_list_writing_question_institutions(text);
