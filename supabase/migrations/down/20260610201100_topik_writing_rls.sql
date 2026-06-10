-- down: 0011 RLS 정책 제거 (테이블은 유지, 정책/RLS만 복귀)
drop policy if exists topik_writing_51_questions_admin_select on public.topik_writing_51_questions;
drop policy if exists topik_writing_52_questions_admin_select on public.topik_writing_52_questions;
drop policy if exists topik_writing_53_questions_admin_select on public.topik_writing_53_questions;
drop policy if exists topik_writing_54_questions_admin_select on public.topik_writing_54_questions;
drop policy if exists topik_writing_topic_master_admin_select on public.topik_writing_topic_master;
drop policy if exists topik_writing_tag_master_admin_select on public.topik_writing_tag_master;
drop policy if exists topik_writing_question_tags_admin_select on public.topik_writing_question_tags;
drop policy if exists topik_writing_question_source_map_admin_select on public.topik_writing_question_source_map;
alter table public.topik_writing_51_questions disable row level security;
alter table public.topik_writing_52_questions disable row level security;
alter table public.topik_writing_53_questions disable row level security;
alter table public.topik_writing_54_questions disable row level security;
alter table public.topik_writing_topic_master disable row level security;
alter table public.topik_writing_tag_master disable row level security;
alter table public.topik_writing_question_tags disable row level security;
alter table public.topik_writing_question_source_map disable row level security;
