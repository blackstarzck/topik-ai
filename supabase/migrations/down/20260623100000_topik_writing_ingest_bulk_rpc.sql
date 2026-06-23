-- down: 0003(P6) admin_ingest_writing_tasks_bulk 제거
drop function if exists public.admin_ingest_writing_tasks_bulk(uuid, text, jsonb);
