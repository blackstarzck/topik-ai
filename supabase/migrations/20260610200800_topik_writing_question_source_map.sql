-- =====================================================================
-- topik-ai admin · 메타데이터·태그 스키마 전환 P1 · 0008
-- topik_writing_question_source_map: 식별자 매핑 테이블 (편차 E2)
--
-- 역할: D-4 채번 idempotency(legacy_problem_id 선조회), 레거시 역추적,
--       D-3 topic_category_code 참고 보존, P6 배포 증적(published_task_id).
-- down: supabase/migrations/down/20260610200800_topik_writing_question_source_map.sql
-- =====================================================================

create table if not exists public.topik_writing_question_source_map (
  question_id                text primary key,
  item_number                smallint not null check (item_number in (51, 52, 53, 54)),
  legacy_problem_id          uuid unique,
  legacy_topic_category_code text,
  legacy_publish_status      text,
  legacy_visibility          text,
  published_task_id          text,
  backfill_batch             text,
  hold_reason                text,
  created_at                 timestamptz not null default now(),
  updated_at                 timestamptz
);

comment on table public.topik_writing_question_source_map is
  'question_id <-> v13 problems.id <-> 상류 published_task_id 매핑 (편차 E2). 채번 idempotency와 적재 보류(hold_reason) 추적의 단일 저장소.';
comment on column public.topik_writing_question_source_map.hold_reason is
  '적재 보류 사유(D-5). NULL이면 정상 적재 상태. 보류 행은 question_id만 선점하고 문제 테이블에는 미적재.';
