-- =====================================================================
-- topik-ai admin · 메타데이터·태그 스키마 전환 P1 · 0009
-- topik_writing_question_recommendation_view: 추천 검색용 읽기전용 UNION 뷰
--   (v0.8 §7.9 12컬럼 + 편차 E4: admin 목록용 6컬럼 확장)
--
-- security_invoker = true 필수: 미설정 시 뷰가 소유자 권한으로 실행되어
-- 베이스 테이블 RLS를 우회한다(anon 노출 보안 구멍). P1 스모크의 네거티브
-- 테스트(anon 차단)가 이 설정을 검증한다.
-- down: supabase/migrations/down/20260610200900_topik_writing_question_recommendation_view.sql
-- =====================================================================

create or replace view public.topik_writing_question_recommendation_view
with (security_invoker = true)
as
select
  -- v0.8 §7.9 12컬럼
  question_id, item_number, target_level, difficulty_level,
  topic_main, topic_detail, speech_act, scenario_type,
  recommendation_keys, avoid_repeat_keys, review_status, service_status,
  -- 편차 E4: admin 목록용 확장 컬럼
  situation_summary, question_type_name, content_team_memo,
  review_workflow_status, created_at, updated_at
from public.topik_writing_51_questions
union all
select
  question_id, item_number, target_level, difficulty_level,
  topic_main, topic_detail, speech_act, scenario_type,
  recommendation_keys, avoid_repeat_keys, review_status, service_status,
  situation_summary, question_type_name, content_team_memo,
  review_workflow_status, created_at, updated_at
from public.topik_writing_52_questions
union all
select
  question_id, item_number, target_level, difficulty_level,
  topic_main, topic_detail, speech_act, scenario_type,
  recommendation_keys, avoid_repeat_keys, review_status, service_status,
  situation_summary, question_type_name, content_team_memo,
  review_workflow_status, created_at, updated_at
from public.topik_writing_53_questions
union all
select
  question_id, item_number, target_level, difficulty_level,
  topic_main, topic_detail, speech_act, scenario_type,
  recommendation_keys, avoid_repeat_keys, review_status, service_status,
  situation_summary, question_type_name, content_team_memo,
  review_workflow_status, created_at, updated_at
from public.topik_writing_54_questions;

comment on view public.topik_writing_question_recommendation_view is
  '51~54 공통 컬럼 UNION ALL 읽기전용 뷰 (v0.8 §7.9 + 편차 E4). security_invoker=true로 베이스 테이블 RLS 상속.';
