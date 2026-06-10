-- =====================================================================
-- topik-ai admin · 메타데이터·태그 스키마 전환 P1 · 0006
-- topik_writing_54_questions: 공통 컬럼(§7.1+E1, 0003과 동결 계약 동일) + 54번 전용(§7.5)
-- down: supabase/migrations/down/20260610200600_topik_writing_54_questions.sql
-- =====================================================================

create table if not exists public.topik_writing_54_questions (
  -- ── 공통 컬럼 (v0.8 §7.1 + E1) — 0003과 동일 블록 ───────────────────
  question_id            text primary key,
  created_at             timestamptz not null default now(),
  updated_at             timestamptz,
  schema_version         text not null default '1.0',
  source_exam_reference  text,
  source_reference       text,
  exam_name              text not null default 'TOPIK',
  section                text not null default '쓰기',
  item_number            smallint not null check (item_number = 54),
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
  -- ── 54번 전용 컬럼 (v0.8 §7.5) ─────────────────────────────────────
  essay_type            text not null
                        check (essay_type in ('주장형', '찬반형', '원인·해결형', '장단점형', '기타')),
  issue_topic           text not null,
  prompt_questions      jsonb not null,
  stance_requirement    text not null,
  required_structure    jsonb not null,
  required_reason_count smallint,
  example_requirement   text,
  word_count_min        smallint,
  word_count_max        smallint,
  reasoning_pattern     text not null,
  argument_keywords     jsonb,
  vocabulary_level      text,
  scoring_focus         jsonb not null,
  prohibited_elements   jsonb,
  model_outline         jsonb,
  rubric                jsonb,
  constraint topik_writing_54_questions_topic_fk
    foreign key (topic_main, topic_detail)
    references public.topik_writing_topic_master (topic_main, topic_detail),
  constraint topik_writing_54_questions_secondary_topic_fk
    foreign key (secondary_topic_main, secondary_topic_detail)
    references public.topik_writing_topic_master (topic_main, topic_detail)
);

comment on table public.topik_writing_54_questions is
  'TOPIK 쓰기 54번(의견 서술) 문제 (v0.8 §7.1+§7.5, 편차 E1 포함). 쓰기는 admin_update_topik_question RPC 단일 경로.';
