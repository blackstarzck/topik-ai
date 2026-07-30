-- =====================================================================
-- TALKPIK AI · Tier 1 MVP
-- 11/12 · triggers (updated_at autoupdate, draft → submission promote)
-- Spec: docs/development/database-schema.md §1.5
--
-- Functions are defined in 10/12 functions.sql.
-- =====================================================================

-- ---------------------------------------------------------------------
-- updated_at autoupdate triggers for mutable tables
-- ---------------------------------------------------------------------
drop trigger if exists trg_profiles_touch_updated_at on public.profiles;
create trigger trg_profiles_touch_updated_at
  before update on public.profiles
  for each row execute function public.touch_updated_at();

drop trigger if exists trg_learning_goals_touch_updated_at on public.learning_goals;
create trigger trg_learning_goals_touch_updated_at
  before update on public.learning_goals
  for each row execute function public.touch_updated_at();

drop trigger if exists trg_problems_touch_updated_at on public.problems;
create trigger trg_problems_touch_updated_at
  before update on public.problems
  for each row execute function public.touch_updated_at();

drop trigger if exists trg_writing_drafts_touch_updated_at on public.writing_drafts;
create trigger trg_writing_drafts_touch_updated_at
  before update on public.writing_drafts
  for each row execute function public.touch_updated_at();

-- ---------------------------------------------------------------------
-- writing_submissions INSERT → mark matching active draft as superseded
-- ---------------------------------------------------------------------
drop trigger if exists trg_writing_submissions_supersede_draft on public.writing_submissions;
create trigger trg_writing_submissions_supersede_draft
  after insert on public.writing_submissions
  for each row execute function public.supersede_active_draft();
