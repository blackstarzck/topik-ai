-- down: 0002(P6) admin_ingest_writing_task 제거
drop function if exists public.admin_ingest_writing_task(uuid, text, jsonb, text, smallint, text);
