-- =====================================================================
-- topik-ai admin · 메타데이터·태그 스키마 전환 P1 · 0011
-- RLS 정책 (실행 계획안 §5.3)
--
-- 모델: 읽기 = admin 역할(RLS 직조회, private.is_admin = content_admin/platform_admin
--       + status active), 쓰기 = 전면 차단(INSERT/UPDATE/DELETE 정책 없음 → RPC 단일
--       경로. 백필은 service-role 키가 RLS를 우회하는 일회성 경로, §5.3).
-- 뷰는 0009에서 security_invoker=true로 베이스 RLS를 상속한다.
-- down: supabase/migrations/down/20260610201100_topik_writing_rls.sql
-- =====================================================================

alter table public.topik_writing_51_questions enable row level security;
alter table public.topik_writing_52_questions enable row level security;
alter table public.topik_writing_53_questions enable row level security;
alter table public.topik_writing_54_questions enable row level security;
alter table public.topik_writing_topic_master enable row level security;
alter table public.topik_writing_tag_master enable row level security;
alter table public.topik_writing_question_tags enable row level security;
alter table public.topik_writing_question_source_map enable row level security;

create policy topik_writing_51_questions_admin_select on public.topik_writing_51_questions
  for select to authenticated using (private.is_admin((select auth.uid())));
create policy topik_writing_52_questions_admin_select on public.topik_writing_52_questions
  for select to authenticated using (private.is_admin((select auth.uid())));
create policy topik_writing_53_questions_admin_select on public.topik_writing_53_questions
  for select to authenticated using (private.is_admin((select auth.uid())));
create policy topik_writing_54_questions_admin_select on public.topik_writing_54_questions
  for select to authenticated using (private.is_admin((select auth.uid())));
create policy topik_writing_topic_master_admin_select on public.topik_writing_topic_master
  for select to authenticated using (private.is_admin((select auth.uid())));
create policy topik_writing_tag_master_admin_select on public.topik_writing_tag_master
  for select to authenticated using (private.is_admin((select auth.uid())));
create policy topik_writing_question_tags_admin_select on public.topik_writing_question_tags
  for select to authenticated using (private.is_admin((select auth.uid())));
create policy topik_writing_question_source_map_admin_select on public.topik_writing_question_source_map
  for select to authenticated using (private.is_admin((select auth.uid())));
