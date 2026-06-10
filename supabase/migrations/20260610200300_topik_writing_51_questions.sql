-- =====================================================================
-- topik-ai admin · 메타데이터·태그 스키마 전환 P1 · 0003
-- topik_writing_51_questions: 공통 컬럼(v0.8 §7.1, 35개) + 편차 E1(review_workflow_status)
--                             + 51번 전용 컬럼(v0.8 §7.2)
--
-- 공통 컬럼 블록은 4테이블 동결 계약이다(§3.2-2): 변경은 4테이블 동시 마이그레이션으로만.
-- 저장값 사전(D-2/D-6): review_status approved/needs_revision/on_hold,
--   review_workflow_status not_started/in_progress/on_hold/done/revision_requested,
--   service_status available/excluded/internal_test (기본 internal_test).
-- down: supabase/migrations/down/20260610200300_topik_writing_51_questions.sql
-- =====================================================================

create table if not exists public.topik_writing_51_questions (
  -- ── 공통 컬럼 (v0.8 §7.1 + E1) ──────────────────────────────────────
  question_id            text primary key,
  created_at             timestamptz not null default now(),
  updated_at             timestamptz,
  schema_version         text not null default '1.0',
  source_exam_reference  text,
  source_reference       text,
  exam_name              text not null default 'TOPIK',
  section                text not null default '쓰기',
  item_number            smallint not null check (item_number = 51),
  question_type_code     text not null,
  question_type_name     text not null,
  target_level           text,
  difficulty_level       smallint check (difficulty_level between 1 and 6),
  topic_main             text not null,
  topic_detail           text not null,
  secondary_topic_main   text,
  secondary_topic_detail text,
  topic_source           text not null,
  text_type              text,
  speech_act             text,
  relation               text,
  scenario_type          text not null,
  situation_summary      text not null,
  learning_goal_summary  text,
  prompt_text            text not null,
  resolved_text          text,
  model_answer           text,
  answer_key             jsonb,
  review_status          text not null check (review_status in ('approved', 'needs_revision', 'on_hold')),
  review_workflow_status text not null default 'not_started'
                         check (review_workflow_status in ('not_started', 'in_progress', 'on_hold', 'done', 'revision_requested')),
  service_status         text not null default 'internal_test'
                         check (service_status in ('available', 'excluded', 'internal_test')),
  auto_checks_passed     boolean,
  review_passed          boolean,
  recommendation_keys    jsonb,
  avoid_repeat_keys      jsonb,
  content_team_memo      text,
  -- ── 51번 전용 컬럼 (v0.8 §7.2) ─────────────────────────────────────
  blank_count               smallint not null,
  text_state                text,
  blank_notation_policy     text,
  grammar_patterns          jsonb,
  blank_1_position          text not null,
  blank_1_role              text not null,
  blank_1_function          text not null,
  blank_1_answer_type       text not null,
  blank_1_canonical_answer  text not null,
  blank_1_accepted_answers  jsonb,
  blank_1_accepted_synonyms jsonb,
  blank_1_target_note       text,
  blank_2_position          text not null,
  blank_2_role              text not null,
  blank_2_function          text not null,
  blank_2_answer_type       text not null,
  blank_2_canonical_answer  text not null,
  blank_2_accepted_answers  jsonb,
  blank_2_accepted_synonyms jsonb,
  blank_2_target_note       text,
  validation_result         jsonb,
  -- 주제 축 무결성: topic_master 고정값 집합 강제 (§6.3 축 검증의 DB 레벨 보강)
  constraint topik_writing_51_questions_topic_fk
    foreign key (topic_main, topic_detail)
    references public.topik_writing_topic_master (topic_main, topic_detail),
  constraint topik_writing_51_questions_secondary_topic_fk
    foreign key (secondary_topic_main, secondary_topic_detail)
    references public.topik_writing_topic_master (topic_main, topic_detail)
);

comment on table public.topik_writing_51_questions is
  'TOPIK 쓰기 51번(빈칸 완성) 문제 (v0.8 §7.1+§7.2, 편차 E1 포함). 쓰기는 admin_update_topik_question RPC 단일 경로.';
