-- =====================================================================
-- topik-ai admin · 메타데이터·태그 스키마 전환 P1 · 0010
-- 인덱스 (실행 계획안 §5.2 0010)
-- down: supabase/migrations/down/20260610201000_topik_writing_indexes.sql
-- =====================================================================

-- 문제 테이블 4종 공통 조회 축
create index if not exists topik_writing_51_questions_review_status_idx on public.topik_writing_51_questions (review_status);
create index if not exists topik_writing_51_questions_service_status_idx on public.topik_writing_51_questions (service_status);
create index if not exists topik_writing_51_questions_topic_idx on public.topik_writing_51_questions (topic_main, topic_detail);
create index if not exists topik_writing_51_questions_scenario_type_idx on public.topik_writing_51_questions (scenario_type);
create index if not exists topik_writing_51_questions_rec_keys_gin on public.topik_writing_51_questions using gin (recommendation_keys);
create index if not exists topik_writing_51_questions_avoid_keys_gin on public.topik_writing_51_questions using gin (avoid_repeat_keys);

create index if not exists topik_writing_52_questions_review_status_idx on public.topik_writing_52_questions (review_status);
create index if not exists topik_writing_52_questions_service_status_idx on public.topik_writing_52_questions (service_status);
create index if not exists topik_writing_52_questions_topic_idx on public.topik_writing_52_questions (topic_main, topic_detail);
create index if not exists topik_writing_52_questions_scenario_type_idx on public.topik_writing_52_questions (scenario_type);
create index if not exists topik_writing_52_questions_rec_keys_gin on public.topik_writing_52_questions using gin (recommendation_keys);
create index if not exists topik_writing_52_questions_avoid_keys_gin on public.topik_writing_52_questions using gin (avoid_repeat_keys);

create index if not exists topik_writing_53_questions_review_status_idx on public.topik_writing_53_questions (review_status);
create index if not exists topik_writing_53_questions_service_status_idx on public.topik_writing_53_questions (service_status);
create index if not exists topik_writing_53_questions_topic_idx on public.topik_writing_53_questions (topic_main, topic_detail);
create index if not exists topik_writing_53_questions_scenario_type_idx on public.topik_writing_53_questions (scenario_type);
create index if not exists topik_writing_53_questions_rec_keys_gin on public.topik_writing_53_questions using gin (recommendation_keys);
create index if not exists topik_writing_53_questions_avoid_keys_gin on public.topik_writing_53_questions using gin (avoid_repeat_keys);

create index if not exists topik_writing_54_questions_review_status_idx on public.topik_writing_54_questions (review_status);
create index if not exists topik_writing_54_questions_service_status_idx on public.topik_writing_54_questions (service_status);
create index if not exists topik_writing_54_questions_topic_idx on public.topik_writing_54_questions (topic_main, topic_detail);
create index if not exists topik_writing_54_questions_scenario_type_idx on public.topik_writing_54_questions (scenario_type);
create index if not exists topik_writing_54_questions_rec_keys_gin on public.topik_writing_54_questions using gin (recommendation_keys);
create index if not exists topik_writing_54_questions_avoid_keys_gin on public.topik_writing_54_questions using gin (avoid_repeat_keys);

-- 태그 매핑 조회 축
create index if not exists topik_writing_question_tags_question_idx on public.topik_writing_question_tags (question_id, is_active);
create index if not exists topik_writing_question_tags_tag_idx on public.topik_writing_question_tags (tag_code, is_active);

-- source_map 역추적 축 (legacy_problem_id는 UNIQUE 제약으로 인덱스 보유)
create index if not exists topik_writing_question_source_map_batch_idx on public.topik_writing_question_source_map (backfill_batch);
