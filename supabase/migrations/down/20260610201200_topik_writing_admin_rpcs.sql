-- down: 0012 감사 RPC 3종 제거
drop function if exists public.admin_update_topik_question(text, smallint, jsonb);
drop function if exists public.admin_assign_question_tag(text, smallint, text, text, text);
drop function if exists public.admin_remove_question_tag(bigint, text);
