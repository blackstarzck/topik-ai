-- =====================================================================
-- topik-ai admin · 메타데이터·태그 스키마 전환 P1 · 0005
-- topik_writing_53_questions: 공통 컬럼(§7.1+E1, 0003과 동결 계약 동일) + 53번 전용(§7.4)
-- D-13: 1차 전환은 source_data(JSONB 수치)만 적재, data_asset_url 빈 값 허용.
-- down: supabase/migrations/down/20260610200500_topik_writing_53_questions.sql
-- =====================================================================

create table if not exists public.topik_writing_53_questions (
  -- ── 공통 컬럼 (v0.8 §7.1 + E1) — 0003과 동일 블록 ───────────────────
  question_id            text primary key,
  created_at             timestamptz not null default now(),
  updated_at             timestamptz,
  schema_version         text not null default '1.0',
  source_exam_reference  text,
  source_reference       text,
  exam_name              text not null default 'TOPIK',
  section                text not null default '쓰기',
  item_number            smallint not null check (item_number = 53),
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
  -- ── 53번 전용 컬럼 (v0.8 §7.4) ─────────────────────────────────────
  data_type                  text not null
                             check (data_type in ('표', '막대그래프', '선그래프', '원그래프', '복합 자료')),
  data_topic                 text not null,
  chart_title                text,
  chart_unit                 text,
  comparison_target_count    smallint,
  data_series_count          smallint,
  number_expression_required boolean not null,
  comparison_type            text not null,
  change_type                text,
  key_findings               jsonb,
  required_structure         jsonb not null,
  expression_set             jsonb,
  word_count_min             smallint,
  word_count_max             smallint,
  interpretation_difficulty  text,
  prohibited_elements        jsonb,
  source_data                jsonb,
  data_asset_url             text,
  scoring_focus              jsonb,
  constraint topik_writing_53_questions_topic_fk
    foreign key (topic_main, topic_detail)
    references public.topik_writing_topic_master (topic_main, topic_detail),
  constraint topik_writing_53_questions_secondary_topic_fk
    foreign key (secondary_topic_main, secondary_topic_detail)
    references public.topik_writing_topic_master (topic_main, topic_detail)
);

comment on table public.topik_writing_53_questions is
  'TOPIK 쓰기 53번(자료 설명) 문제 (v0.8 §7.1+§7.4, 편차 E1 포함). 자료는 source_data 수치 우선(D-13). 쓰기는 admin_update_topik_question RPC 단일 경로.';
