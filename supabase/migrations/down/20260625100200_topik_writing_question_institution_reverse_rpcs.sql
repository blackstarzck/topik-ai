-- down: 20260625100200_topik_writing_question_institution_reverse_rpcs.sql
-- 기관 중심 역방향 RPC 3종 제거(매핑 테이블·문항 중심 RPC는 영향 없음).
drop function if exists public.admin_add_institution_writing_questions(text, text[], text);
drop function if exists public.admin_remove_institution_writing_questions(text, text[], text);
drop function if exists public.admin_list_institution_writing_questions(text);
