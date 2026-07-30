-- Restore legacy behavior before replacing policies and function bodies.

update private.writing_read_control
   set read_mode = 'legacy',
       submission_mode = 'legacy',
       submission_contract_state = 'unverified',
       changed_by = 'migration-down',
       change_reason = 'restore legacy runtime',
       evidence_id = null,
       changed_at = now()
 where singleton;

revoke all on function public.set_writing_runtime_state(text, text, text, text, text, text) from service_role;
revoke all on function public.reconcile_active_writing_draft_versions(text, text) from service_role;
revoke all on function public.get_writing_runtime_state() from authenticated;
revoke all on function public.get_writing_runtime_state() from service_role;
revoke all on function public.get_writing_submission_history_context(uuid[]) from authenticated;
drop function if exists public.get_writing_submission_history_context(uuid[]);

-- Restore the legacy submission guards after the mode is reset. These are the
-- definitions from the institution visibility migration.
create or replace function private.assert_writing_problem_submittable(
  p_problem_id uuid,
  p_question_no smallint
)
returns void
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
begin
  if not exists (
    select 1
      from public.problems p
     where p.id = p_problem_id
       and p.domain = 'writing'
       and p.question_no = p_question_no
       and p.publish_status = 'published'
       and p.visibility = 'public'
       and p.lifecycle_status = 'active'
       and public.is_writing_problem_visible_to_caller(p.id, p.question_no)
  ) then
    raise exception 'problem_not_submittable'
      using errcode = 'P0001',
            detail = 'Writing submissions are allowed only for published, public, active, institution-visible writing problems.';
  end if;
end;
$$;

revoke all on function private.assert_writing_problem_submittable(uuid, smallint) from public;
grant execute on function private.assert_writing_problem_submittable(uuid, smallint) to authenticated;
comment on function private.assert_writing_problem_submittable(uuid, smallint) is
  'Rejects writing submissions for hidden, unpublished, inactive, non-writing, question-number-mismatched, or institution-hidden problems.';

create or replace function private.assert_writing_problem_submittable_for_user(
  p_problem_id uuid,
  p_question_no smallint,
  p_user_id uuid
)
returns void
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
begin
  if not exists (
    select 1
      from public.problems p
     where p.id = p_problem_id
       and p.domain = 'writing'
       and p.question_no = p_question_no
       and p.publish_status = 'published'
       and p.visibility = 'public'
       and p.lifecycle_status = 'active'
       and private.is_writing_problem_visible_to_user(p.id, p.question_no, p_user_id)
  ) then
    raise exception 'problem_not_submittable'
      using errcode = 'P0001',
            detail = 'Writing submissions are allowed only for published, public, active, institution-visible writing problems.';
  end if;
end;
$$;

revoke all on function private.assert_writing_problem_submittable_for_user(uuid, smallint, uuid) from public;
grant execute on function private.assert_writing_problem_submittable_for_user(uuid, smallint, uuid) to service_role;
comment on function private.assert_writing_problem_submittable_for_user(uuid, smallint, uuid) is
  'Owner-aware service-role writing submission guard for hidden, unpublished, inactive, non-writing, question-number-mismatched, or institution-hidden problems.';

-- Restore the nullable legacy-compatible validator from the version snapshot
-- migration. The preceding mode reset makes legacy versionless inserts valid.
create or replace function private.validate_writing_submission_canonical_context()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public, private
as $$
begin
  if new.canonical_question_id is null then
    return new;
  end if;

  if new.question_snapshot->>'question_id' is distinct from new.canonical_question_id
     or (new.question_snapshot->>'canonical_import_id')::bigint is distinct from new.canonical_import_id
     or new.question_snapshot->>'payload_hash' is distinct from new.canonical_payload_hash
     or (new.question_snapshot->>'item_number')::smallint is distinct from new.question_no then
    raise exception 'canonical_snapshot_identity_mismatch';
  end if;

  if private.jsonb_has_forbidden_writing_snapshot_key(new.question_snapshot) then
    raise exception 'canonical_snapshot_contains_forbidden_key';
  end if;

  perform private.assert_writing_question_submittable(
    new.problem_id,
    new.canonical_question_id,
    new.canonical_import_id,
    new.canonical_payload_hash,
    new.question_no,
    new.user_id
  );

  perform private.assert_writing_submission_snapshot_matches_catalog(
    new.problem_id,
    new.canonical_question_id,
    new.canonical_import_id,
    new.canonical_payload_hash,
    new.question_no,
    new.user_id,
    new.question_snapshot
  );

  return new;
end;
$$;

revoke all on function private.validate_writing_submission_canonical_context() from public;
revoke all on function private.validate_writing_submission_canonical_context() from anon;
revoke all on function private.validate_writing_submission_canonical_context() from authenticated;

-- Restore the version-snapshot migration's legacy-compatible draft trigger
-- before removing the runtime helpers it no longer needs.
create or replace function private.populate_writing_draft_question_snapshot()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public, private
as $$
begin
  if new.canonical_question_id is null then
    new.question_snapshot := null;
    return new;
  end if;

  new.question_snapshot := private.get_writing_question_snapshot_from_catalog(
    new.problem_id,
    new.canonical_question_id,
    new.canonical_import_id,
    new.canonical_payload_hash,
    new.question_no,
    new.user_id
  );

  if private.jsonb_has_forbidden_writing_snapshot_key(new.question_snapshot) then
    raise exception 'canonical_snapshot_contains_forbidden_key';
  end if;

  return new;
end;
$$;

drop trigger if exists writing_drafts_populate_question_snapshot
  on public.writing_drafts;
create trigger writing_drafts_populate_question_snapshot
before insert or update of
  problem_id,
  question_no,
  user_id,
  canonical_question_id,
  canonical_import_id,
  canonical_payload_hash,
  question_snapshot
on public.writing_drafts
for each row
execute function private.populate_writing_draft_question_snapshot();

drop policy if exists study_events_owner_insert on public.study_events;
create policy study_events_owner_insert
  on public.study_events
  for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and (
      problem_id is null
      or exists (
        select 1
          from public.problems problem
         where problem.id = study_events.problem_id
           and (
             (
               problem.publish_status = 'published'
               and (
                 problem.visibility = 'public'
                 or problem.author_id = (select auth.uid())
               )
             )
             or problem.author_id = (select auth.uid())
           )
      )
    )
    and (
      submission_id is null
      or exists (
        select 1
          from public.writing_submissions submission
         where submission.id = study_events.submission_id
           and submission.user_id = (select auth.uid())
      )
    )
    and (
      attempt_id is null
      or exists (
        select 1
          from public.problem_attempts attempt
         where attempt.id = study_events.attempt_id
           and attempt.user_id = (select auth.uid())
      )
    )
  );

drop policy if exists library_items_owner_insert on public.library_items;
create policy library_items_owner_insert
  on public.library_items
  for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and (
      (item_type = 'attempt' and exists (
        select 1 from public.problem_attempts attempt
        where attempt.id = library_items.attempt_id
          and attempt.user_id = (select auth.uid())
      ))
      or (item_type = 'submission' and exists (
        select 1 from public.writing_submissions submission
        where submission.id = library_items.submission_id
          and submission.user_id = (select auth.uid())
      ))
      or (item_type = 'report' and exists (
        select 1 from public.comparison_reports report
        where report.id = library_items.report_id
          and report.user_id = (select auth.uid())
      ))
      or (item_type = 'export' and exists (
        select 1 from public.export_files export_file
        where export_file.id = library_items.export_id
          and export_file.user_id = (select auth.uid())
      ))
      or (item_type = 'problem' and exists (
        select 1 from public.problems problem
        where problem.id = library_items.problem_id
          and (
            (
              problem.publish_status = 'published'
              and (
                problem.visibility = 'public'
                or problem.author_id = (select auth.uid())
              )
            )
            or problem.author_id = (select auth.uid())
          )
      ))
    )
  );

drop policy if exists problem_assets_select on public.problem_assets;
create policy problem_assets_select
  on public.problem_assets
  for select to authenticated
  using (
    exists (
      select 1
        from public.problems problem
       where problem.id = problem_assets.problem_id
         and (
           (
             problem.publish_status = 'published'
             and (
               problem.visibility = 'public'
               or problem.author_id = (select auth.uid())
             )
           )
           or problem.author_id = (select auth.uid())
           or private.is_admin((select auth.uid()))
         )
    )
  );

drop policy if exists problems_visible_select on public.problems;
create policy problems_visible_select
  on public.problems
  for select to authenticated
  using (
    (
      publish_status = 'published'
      and (
        visibility = 'public'
        or author_id = (select auth.uid())
      )
    )
    or author_id = (select auth.uid())
    or private.is_admin((select auth.uid()))
  );

-- Restore the exact immediately prior list RPC definitions captured before
-- the up migration replaced them. This removes their static dependencies on
-- public.get_available_writing_questions, allowing the admin-owned canonical
-- contract to be rolled back after the version-snapshot migration is reversed.
do $$
declare
  v_function record;
  v_restored_count integer := 0;
begin
  for v_function in
    select
      function_signature,
      function_definition,
      function_description
      from private.writing_canonical_read_rollback_function
     where function_key in (
       'list_user_problems',
       'list_user_library_problem_items'
     )
     order by function_key
  loop
    execute v_function.function_definition;
    execute format(
      'comment on function %s is %L',
      v_function.function_signature,
      v_function.function_description
    );
    v_restored_count := v_restored_count + 1;
  end loop;

  if v_restored_count <> 2 then
    raise exception 'canonical_read_rollback_function_restore_incomplete';
  end if;
end
$$;

drop function if exists public.set_writing_runtime_state(text, text, text, text, text, text);
drop function if exists public.reconcile_active_writing_draft_versions(text, text);
drop function if exists private.get_writing_question_snapshot_for_reconciliation(uuid, text, bigint, text, smallint);
drop function if exists private.writing_mirror_learner_projection_matches(uuid, jsonb);
drop function if exists private.project_writing_mirror_learner_materials(jsonb, jsonb, smallint);
drop function if exists private.set_writing_runtime_state(text, text, text, text, text, text);
drop function if exists public.get_writing_runtime_state();
drop function if exists private.get_writing_submission_mode();
drop function if exists private.is_canonical_writing_problem_visible_to_user(uuid, uuid);
drop function if exists private.is_canonical_writing_problem_anchor(uuid);
drop function if exists private.is_writing_canonical_read_enabled();
drop table if exists private.writing_read_control;
drop table if exists private.writing_draft_reconciliation_audit;
drop table if exists private.writing_runtime_state_audit;
drop table if exists private.writing_canonical_read_rollback_function;
