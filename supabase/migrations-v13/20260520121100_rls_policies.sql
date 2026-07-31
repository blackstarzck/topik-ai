-- =====================================================================
-- TALKPIK AI · Tier 1 MVP
-- 12/12 · RLS enable + force + policies
-- Spec: docs/development/database-schema.md §2
--
-- Conventions:
--   - All user-owned tables: enable + force RLS (owners can't bypass).
--   - All policies wrap auth.uid() with (select ...) for InitPlan optimization.
--   - Admin bypass goes through private.is_admin(...) (defined in 10/12).
--   - writing_submissions has no UPDATE/DELETE policies → immutable.
--   - admin_audit_logs has no UPDATE/DELETE policies → append-only.
-- =====================================================================

-- =====================================================================
-- profiles
-- =====================================================================
alter table public.profiles enable row level security;
alter table public.profiles force  row level security;

drop policy if exists profiles_self_select on public.profiles;
create policy profiles_self_select
  on public.profiles
  for select to authenticated
  using ( id = (select auth.uid()) or private.is_admin((select auth.uid())) );

drop policy if exists profiles_self_update on public.profiles;
create policy profiles_self_update
  on public.profiles
  for update to authenticated
  using ( id = (select auth.uid()) )
  with check (
    id = (select auth.uid())
    -- prevent users from elevating their own role/plan/status
    and app_role = (select app_role from public.profiles where id = (select auth.uid()))
    and plan_label = (select plan_label from public.profiles where id = (select auth.uid()))
    and status = (select status from public.profiles where id = (select auth.uid()))
  );

drop policy if exists profiles_admin_all on public.profiles;
create policy profiles_admin_all
  on public.profiles
  for all to authenticated
  using ( private.is_admin((select auth.uid())) )
  with check ( private.is_admin((select auth.uid())) );

-- note: INSERT into profiles is handled by an auth trigger (out of scope for this MVP migration).

-- =====================================================================
-- learning_goals
-- =====================================================================
alter table public.learning_goals enable row level security;
alter table public.learning_goals force  row level security;

drop policy if exists learning_goals_owner_all on public.learning_goals;
create policy learning_goals_owner_all
  on public.learning_goals
  for all to authenticated
  using ( user_id = (select auth.uid()) )
  with check ( user_id = (select auth.uid()) );

-- =====================================================================
-- problems
-- =====================================================================
alter table public.problems enable row level security;
alter table public.problems force  row level security;

drop policy if exists problems_visible_select on public.problems;
create policy problems_visible_select
  on public.problems
  for select to authenticated
  using (
    (publish_status = 'published' and (visibility = 'public' or author_id = (select auth.uid())))
    or author_id = (select auth.uid())
    or private.is_admin((select auth.uid()))
  );

drop policy if exists problems_ai_owner_insert on public.problems;
create policy problems_ai_owner_insert
  on public.problems
  for insert to authenticated
  with check (
    (source = 'ai_generated' and author_id = (select auth.uid()))
    or private.is_admin((select auth.uid()))
  );

drop policy if exists problems_ai_owner_update on public.problems;
create policy problems_ai_owner_update
  on public.problems
  for update to authenticated
  using (
    (source = 'ai_generated' and author_id = (select auth.uid()))
    or private.is_admin((select auth.uid()))
  )
  with check (
    (source = 'ai_generated' and author_id = (select auth.uid()))
    or private.is_admin((select auth.uid()))
  );

drop policy if exists problems_admin_delete on public.problems;
create policy problems_admin_delete
  on public.problems
  for delete to authenticated
  using ( private.is_admin((select auth.uid())) );

-- =====================================================================
-- problem_assets — visibility inherits from parent problem
-- =====================================================================
alter table public.problem_assets enable row level security;
alter table public.problem_assets force  row level security;

drop policy if exists problem_assets_select on public.problem_assets;
create policy problem_assets_select
  on public.problem_assets
  for select to authenticated
  using (
    exists (
      select 1 from public.problems p
      where p.id = problem_assets.problem_id
        and (
          (p.publish_status = 'published' and (p.visibility = 'public' or p.author_id = (select auth.uid())))
          or p.author_id = (select auth.uid())
          or private.is_admin((select auth.uid()))
        )
    )
  );

drop policy if exists problem_assets_admin_write on public.problem_assets;
create policy problem_assets_admin_write
  on public.problem_assets
  for all to authenticated
  using ( private.is_admin((select auth.uid())) )
  with check ( private.is_admin((select auth.uid())) );

-- =====================================================================
-- problem_attempts (objective)
-- =====================================================================
alter table public.problem_attempts enable row level security;
alter table public.problem_attempts force  row level security;

drop policy if exists attempts_owner_all on public.problem_attempts;
create policy attempts_owner_all
  on public.problem_attempts
  for all to authenticated
  using ( user_id = (select auth.uid()) )
  with check ( user_id = (select auth.uid()) );

drop policy if exists attempts_admin_select on public.problem_attempts;
create policy attempts_admin_select
  on public.problem_attempts
  for select to authenticated
  using ( private.is_admin((select auth.uid())) );

-- =====================================================================
-- writing_drafts (mutable)
-- =====================================================================
alter table public.writing_drafts enable row level security;
alter table public.writing_drafts force  row level security;

drop policy if exists writing_drafts_owner_all on public.writing_drafts;
create policy writing_drafts_owner_all
  on public.writing_drafts
  for all to authenticated
  using ( user_id = (select auth.uid()) )
  with check ( user_id = (select auth.uid()) );

-- =====================================================================
-- writing_submissions (immutable: select + insert only)
-- =====================================================================
alter table public.writing_submissions enable row level security;
alter table public.writing_submissions force  row level security;

drop policy if exists writing_submissions_owner_select on public.writing_submissions;
create policy writing_submissions_owner_select
  on public.writing_submissions
  for select to authenticated
  using ( user_id = (select auth.uid()) or private.is_admin((select auth.uid())) );

drop policy if exists writing_submissions_owner_insert on public.writing_submissions;
create policy writing_submissions_owner_insert
  on public.writing_submissions
  for insert to authenticated
  with check ( user_id = (select auth.uid()) );

-- intentionally no UPDATE / DELETE policy → blocked.
-- feedback_status transitions handled by service_role-backed code paths.

-- =====================================================================
-- writing_feedback (read-only for owner; written by service_role)
-- =====================================================================
alter table public.writing_feedback enable row level security;
alter table public.writing_feedback force  row level security;

drop policy if exists writing_feedback_owner_select on public.writing_feedback;
create policy writing_feedback_owner_select
  on public.writing_feedback
  for select to authenticated
  using ( user_id = (select auth.uid()) or private.is_admin((select auth.uid())) );

-- =====================================================================
-- feedback_dimension_scores (read-only for owner; written by service_role)
-- =====================================================================
alter table public.feedback_dimension_scores enable row level security;
alter table public.feedback_dimension_scores force  row level security;

drop policy if exists feedback_dimension_owner_select on public.feedback_dimension_scores;
create policy feedback_dimension_owner_select
  on public.feedback_dimension_scores
  for select to authenticated
  using ( user_id = (select auth.uid()) or private.is_admin((select auth.uid())) );

-- =====================================================================
-- sentence_feedback (read-only for owner; written by service_role)
-- =====================================================================
alter table public.sentence_feedback enable row level security;
alter table public.sentence_feedback force  row level security;

drop policy if exists sentence_feedback_owner_select on public.sentence_feedback;
create policy sentence_feedback_owner_select
  on public.sentence_feedback
  for select to authenticated
  using ( user_id = (select auth.uid()) or private.is_admin((select auth.uid())) );

-- =====================================================================
-- comparison_reports
-- =====================================================================
alter table public.comparison_reports enable row level security;
alter table public.comparison_reports force  row level security;

drop policy if exists comparison_reports_owner_select on public.comparison_reports;
create policy comparison_reports_owner_select
  on public.comparison_reports
  for select to authenticated
  using ( user_id = (select auth.uid()) or private.is_admin((select auth.uid())) );

-- =====================================================================
-- recommendation_runs (read-only for owner; written by service_role)
-- =====================================================================
alter table public.recommendation_runs enable row level security;
alter table public.recommendation_runs force  row level security;

drop policy if exists recommendation_runs_owner_select on public.recommendation_runs;
create policy recommendation_runs_owner_select
  on public.recommendation_runs
  for select to authenticated
  using ( user_id = (select auth.uid()) );

-- =====================================================================
-- recommendation_items
-- =====================================================================
alter table public.recommendation_items enable row level security;
alter table public.recommendation_items force  row level security;

drop policy if exists recommendation_items_owner_select on public.recommendation_items;
create policy recommendation_items_owner_select
  on public.recommendation_items
  for select to authenticated
  using ( user_id = (select auth.uid()) );

-- learner may mark an item consumed/expired
drop policy if exists recommendation_items_owner_update on public.recommendation_items;
create policy recommendation_items_owner_update
  on public.recommendation_items
  for update to authenticated
  using ( user_id = (select auth.uid()) )
  with check ( user_id = (select auth.uid()) );

-- =====================================================================
-- library_items
-- =====================================================================
alter table public.library_items enable row level security;
alter table public.library_items force  row level security;

drop policy if exists library_items_owner_all on public.library_items;
create policy library_items_owner_all
  on public.library_items
  for all to authenticated
  using ( user_id = (select auth.uid()) )
  with check ( user_id = (select auth.uid()) );

-- =====================================================================
-- study_events
-- =====================================================================
alter table public.study_events enable row level security;
alter table public.study_events force  row level security;

drop policy if exists study_events_owner_select on public.study_events;
create policy study_events_owner_select
  on public.study_events
  for select to authenticated
  using ( user_id = (select auth.uid()) or private.is_admin((select auth.uid())) );

drop policy if exists study_events_owner_insert on public.study_events;
create policy study_events_owner_insert
  on public.study_events
  for insert to authenticated
  with check ( user_id = (select auth.uid()) );

-- =====================================================================
-- export_files
-- =====================================================================
alter table public.export_files enable row level security;
alter table public.export_files force  row level security;

drop policy if exists export_files_owner_all on public.export_files;
create policy export_files_owner_all
  on public.export_files
  for all to authenticated
  using ( user_id = (select auth.uid()) )
  with check ( user_id = (select auth.uid()) );

-- =====================================================================
-- admin_audit_logs (append-only, admin select)
-- =====================================================================
alter table public.admin_audit_logs enable row level security;
alter table public.admin_audit_logs force  row level security;

drop policy if exists admin_audit_logs_admin_select on public.admin_audit_logs;
create policy admin_audit_logs_admin_select
  on public.admin_audit_logs
  for select to authenticated
  using ( private.is_admin((select auth.uid())) );

drop policy if exists admin_audit_logs_admin_insert on public.admin_audit_logs;
create policy admin_audit_logs_admin_insert
  on public.admin_audit_logs
  for insert to authenticated
  with check ( private.is_admin((select auth.uid())) and admin_user_id = (select auth.uid()) );

-- no UPDATE / DELETE policies → append-only.
