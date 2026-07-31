-- =====================================================================
-- TALKPIK AI · Tier 1 MVP
-- 06/12 · writing_feedback + feedback_dimension_scores + sentence_feedback
--          + comparison_reports
-- Spec: docs/development/database-schema.md §1.6, §1.7
-- =====================================================================

-- ---------------------------------------------------------------------
-- writing_feedback : 1:1 with writing_submissions
-- ---------------------------------------------------------------------
create table if not exists public.writing_feedback (
  submission_id       uuid primary key references public.writing_submissions(id) on delete cascade,
  user_id             uuid not null references public.profiles(id) on delete cascade,
  status              text not null default 'partial'
                      check (status in ('partial','complete','failed')),
  score_total         numeric(5,2),
  score_max           numeric(5,2),
  overall_summary     text,
  ai_model            text,
  ai_model_version    text,
  raw_ai_result       jsonb,
  generated_at        timestamptz not null default now()
);

create index if not exists writing_feedback_user_generated
  on public.writing_feedback (user_id, generated_at desc);

comment on table public.writing_feedback is
  'AI feedback overall row, 1:1 with submission. Detailed scores in feedback_dimension_scores.';

-- ---------------------------------------------------------------------
-- feedback_dimension_scores : normalized per-dimension scores
-- ---------------------------------------------------------------------
create table if not exists public.feedback_dimension_scores (
  id              uuid primary key default gen_random_uuid(),
  submission_id   uuid not null references public.writing_submissions(id) on delete cascade,
  user_id         uuid not null references public.profiles(id) on delete cascade,
  dimension       text not null
                  check (dimension in ('grammar','vocab','structure','content','expression','topic_fit')),
  score           numeric(5,2),
  score_max       numeric(5,2),
  summary         text,
  weakness_level  smallint check (weakness_level is null or weakness_level between 1 and 5)
);

create unique index if not exists feedback_dimension_unique
  on public.feedback_dimension_scores (submission_id, dimension);

create index if not exists feedback_dimension_user_score
  on public.feedback_dimension_scores (user_id, dimension, score);

comment on table public.feedback_dimension_scores is
  'Normalized per-dimension scoring. Drives X-07 weakness recommendation joins.';

-- ---------------------------------------------------------------------
-- sentence_feedback : per-sentence corrections
-- ---------------------------------------------------------------------
create table if not exists public.sentence_feedback (
  id              uuid primary key default gen_random_uuid(),
  submission_id   uuid not null references public.writing_submissions(id) on delete cascade,
  user_id         uuid not null references public.profiles(id) on delete cascade,
  sentence_index  int not null,
  original_text   text,
  corrected_text  text,
  comment         text
);

create index if not exists sentence_feedback_submission_idx
  on public.sentence_feedback (submission_id, sentence_index);

comment on table public.sentence_feedback is
  'Per-sentence corrections for E-02 long-form feedback.';

-- ---------------------------------------------------------------------
-- comparison_reports : R-01 snapshot (AI narrative preserved)
-- ---------------------------------------------------------------------
create table if not exists public.comparison_reports (
  id                       uuid primary key default gen_random_uuid(),
  user_id                  uuid not null references public.profiles(id) on delete cascade,
  current_submission_id    uuid not null references public.writing_submissions(id) on delete cascade,
  previous_submission_id   uuid references public.writing_submissions(id) on delete set null,
  metrics                  jsonb not null,
  narrative                text,
  ai_model                 text,
  generated_at             timestamptz not null default now()
);

create index if not exists comparison_reports_user_generated
  on public.comparison_reports (user_id, generated_at desc);

create index if not exists comparison_reports_current_submission
  on public.comparison_reports (current_submission_id);

comment on table public.comparison_reports is
  'R-01 comparison report snapshot. AI narrative preserved for reproducibility.';
