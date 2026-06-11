-- =====================================================================
-- down · 0013 검수 컬럼 제거 롤백 (구조 복원 한정)
--
-- 주의: 컬럼 drop으로 소실된 검수 값 데이터(백필 이관분)는 복원되지 않는다.
--   - review_status는 원 스키마가 default 없는 NOT NULL이었으나, 데이터
--     소실 상태에서의 구조 복원을 위해 default 'needs_revision'을 부여해
--     재추가한다(전 행 needs_revision — 원값 복원은 ETL 재실행 필요).
--   - 값까지 복원하려면: 본 down 적용 후 구판 transform(검수 사전 포함
--     커밋 이력)으로 etl:transform → etl:load 재실행.
-- =====================================================================

drop view if exists public.topik_writing_question_recommendation_view;

alter table public.topik_writing_51_questions
  add column if not exists review_status text not null default 'needs_revision'
    check (review_status in ('approved', 'needs_revision', 'on_hold')),
  add column if not exists review_workflow_status text not null default 'not_started'
    check (review_workflow_status in ('not_started', 'in_progress', 'on_hold', 'done', 'revision_requested')),
  add column if not exists review_passed boolean,
  add column if not exists validation_result jsonb;

alter table public.topik_writing_52_questions
  add column if not exists review_status text not null default 'needs_revision'
    check (review_status in ('approved', 'needs_revision', 'on_hold')),
  add column if not exists review_workflow_status text not null default 'not_started'
    check (review_workflow_status in ('not_started', 'in_progress', 'on_hold', 'done', 'revision_requested')),
  add column if not exists review_passed boolean;

alter table public.topik_writing_53_questions
  add column if not exists review_status text not null default 'needs_revision'
    check (review_status in ('approved', 'needs_revision', 'on_hold')),
  add column if not exists review_workflow_status text not null default 'not_started'
    check (review_workflow_status in ('not_started', 'in_progress', 'on_hold', 'done', 'revision_requested')),
  add column if not exists review_passed boolean;

alter table public.topik_writing_54_questions
  add column if not exists review_status text not null default 'needs_revision'
    check (review_status in ('approved', 'needs_revision', 'on_hold')),
  add column if not exists review_workflow_status text not null default 'not_started'
    check (review_workflow_status in ('not_started', 'in_progress', 'on_hold', 'done', 'revision_requested')),
  add column if not exists review_passed boolean;

create index if not exists topik_writing_51_questions_review_status_idx on public.topik_writing_51_questions (review_status);
create index if not exists topik_writing_52_questions_review_status_idx on public.topik_writing_52_questions (review_status);
create index if not exists topik_writing_53_questions_review_status_idx on public.topik_writing_53_questions (review_status);
create index if not exists topik_writing_54_questions_review_status_idx on public.topik_writing_54_questions (review_status);

-- 구판 뷰(검수 2컬럼 포함 18컬럼) 재생성
create view public.topik_writing_question_recommendation_view
with (security_invoker = true)
as
select
  question_id, item_number, target_level, difficulty_level,
  topic_main, topic_detail, speech_act, scenario_type,
  recommendation_keys, avoid_repeat_keys, review_status, service_status,
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

-- 구판 RPC(검수 화이트리스트 포함)는 0012 마이그레이션 원본으로 재생성한다:
--   node scripts/db/migrate.mjs --file supabase/migrations/20260610201200_topik_writing_admin_rpcs.sql
