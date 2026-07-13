-- down: 환경별 problem_id 별칭 계약 제거
drop view if exists public.topik_writing_problem_question_map;
drop policy if exists topik_writing_problem_aliases_admin_select
  on public.topik_writing_problem_aliases;
drop table if exists public.topik_writing_problem_aliases;
