-- down: 20260624100000_writing_problem_payload_rpc.sql
drop function if exists public.get_available_writing_problem_payloads(smallint, text);
