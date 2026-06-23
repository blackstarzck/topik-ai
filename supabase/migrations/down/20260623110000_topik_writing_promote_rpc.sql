-- down: 0004(P6) admin_promote_writing_questions 제거
drop function if exists public.admin_promote_writing_questions(uuid, text[]);
