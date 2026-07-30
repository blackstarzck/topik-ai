-- Evidence-preserving down for 20260714140000.
--
-- This rollback restores deleted writing rows only from the exact private
-- backup captured by the forward migration. It never reconstructs legacy
-- content from the current canonical catalog. Registry and snapshot evidence
-- are intentionally retained after rollback.

do $$
begin
  if to_regclass('private.writing_problem_cutover_backup') is null
     or to_regclass('private.writing_problem_cutover_fk_backup') is null
     or to_regclass('private.writing_problem_cutover_function_backup') is null
     or to_regclass('private.writing_problem_cutover_policy_backup') is null
     or to_regclass('private.writing_read_control_retired_20260714') is null
     or to_regclass('private.writing_submission_control') is null then
    raise exception 'writing_identity_cutover_rollback_evidence_missing';
  end if;

  if exists (
    select 1
    from private.writing_problem_cutover_backup backup
    where backup.row_hash is distinct from md5(backup.problem_row::text)
       or backup.problem_row->>'domain' is distinct from 'writing'
       or backup.problem_row->>'id' is distinct from backup.problem_id::text
  ) then
    raise exception 'writing_identity_cutover_rollback_backup_corrupt';
  end if;
end
$$;

-- No new submission may race the FK and runtime restoration.
do $$
declare
  v_mode text;
begin
  select control.submission_mode
    into v_mode
    from private.writing_submission_control control
   where control.singleton
   for update;
  if v_mode is distinct from 'blocked' then
    raise exception 'writing_identity_cutover_rollback_requires_blocked_submissions';
  end if;
end
$$;

drop trigger if exists public_problems_reject_writing
  on public.problems;
drop trigger if exists public_problems_register_identity
  on public.problems;
drop trigger if exists public_problems_preserve_delete_semantics
  on public.problems;
drop trigger if exists public_problems_retire_identity
  on public.problems;
drop function if exists private.preserve_public_problem_delete_semantics();

-- Existing rows with a backup ID must be byte-equivalent. A conflicting row
-- is not overwritten.
do $$
declare
  v_conflict_count bigint;
begin
  select count(*) into v_conflict_count
  from private.writing_problem_cutover_backup backup
  join public.problems problem on problem.id = backup.problem_id
  where to_jsonb(problem) is distinct from backup.problem_row;

  if v_conflict_count <> 0 then
    raise exception 'writing_identity_cutover_rollback_problem_conflict: %',
      v_conflict_count;
  end if;
end
$$;

insert into public.problems
select (jsonb_populate_record(null::public.problems, backup.problem_row)).*
from private.writing_problem_cutover_backup backup
where not exists (
  select 1
  from public.problems problem
  where problem.id = backup.problem_id
);

do $$
declare
  v_missing_count bigint;
begin
  select count(*) into v_missing_count
  from private.writing_problem_cutover_backup backup
  left join public.problems problem
    on problem.id = backup.problem_id
   and to_jsonb(problem) = backup.problem_row
  where problem.id is null;
  if v_missing_count <> 0 then
    raise exception 'writing_identity_cutover_rollback_restore_incomplete: %',
      v_missing_count;
  end if;
end
$$;

-- A post-cutover identity may have learner rows but no historical
-- public.problems backup. Refuse to fabricate that content.
do $$
declare
  v_fk record;
  v_missing bigint;
begin
  for v_fk in
    select *
    from private.writing_problem_cutover_fk_backup
    order by source_table, constraint_name
  loop
    execute format(
      'select count(*) from %s source_row left join public.problems problem on problem.id = source_row.%I where source_row.%I is not null and problem.id is null',
      v_fk.source_table,
      v_fk.source_column,
      v_fk.source_column
    ) into v_missing;
    if v_missing <> 0 then
      raise exception 'writing_identity_cutover_rollback_unrestorable_reference: %.% count=%',
        v_fk.source_table,
        v_fk.source_column,
        v_missing;
    end if;
  end loop;
end
$$;

-- Move every actual FK back to public.problems with its captured definition.
-- The temporary constraint validates before the registry constraint is
-- removed, preserving a valid FK throughout the swap.
do $$
declare
  v_fk record;
  v_current_count integer;
  v_new_name text;
  v_definition text;
begin
  for v_fk in
    select *
    from private.writing_problem_cutover_fk_backup
    order by source_table, constraint_name
  loop
    select count(*) into v_current_count
    from pg_constraint constraint_row
    join pg_attribute source_attribute
      on source_attribute.attrelid = constraint_row.conrelid
     and source_attribute.attnum = constraint_row.conkey[1]
    where constraint_row.contype = 'f'
      and constraint_row.conrelid = v_fk.source_table::regclass
      and constraint_row.confrelid = 'private.problem_identities'::regclass
      and constraint_row.conname = v_fk.constraint_name
      and cardinality(constraint_row.conkey) = 1
      and source_attribute.attname = v_fk.source_column;

    if v_current_count <> 1 then
      raise exception 'writing_identity_cutover_rollback_fk_shape_changed: %.%',
        v_fk.source_table,
        v_fk.constraint_name;
    end if;

    v_new_name := left(v_fk.constraint_name, 44)
      || '_problems_' || substr(md5(v_fk.source_table || v_fk.constraint_name), 1, 8);
    v_definition := regexp_replace(
      v_fk.constraint_definition,
      'REFERENCES[[:space:]]+(public\\.)?problems',
      'REFERENCES public.problems',
      'i'
    );

    execute format(
      'alter table %s add constraint %I %s not valid',
      v_fk.source_table,
      v_new_name,
      v_definition
    );
    execute format(
      'alter table %s validate constraint %I',
      v_fk.source_table,
      v_new_name
    );
    execute format(
      'alter table %s drop constraint %I',
      v_fk.source_table,
      v_fk.constraint_name
    );
    execute format(
      'alter table %s rename constraint %I to %I',
      v_fk.source_table,
      v_new_name,
      v_fk.constraint_name
    );
  end loop;

  if exists (
    select 1
    from pg_constraint constraint_row
    where constraint_row.contype = 'f'
      and constraint_row.confrelid = 'private.problem_identities'::regclass
  ) then
    raise exception 'writing_identity_cutover_rollback_registry_fk_remains';
  end if;
end
$$;

-- Retire the new control as evidence and reactivate the pre-cutover singleton.
drop function if exists public.set_writing_submission_state(
  text, text, text, text, text
);
drop function if exists public.get_writing_submission_control();
drop trigger if exists writing_submission_control_fail_closed
  on private.writing_submission_control;

-- Preserve the submission-state audit without leaving the live table name
-- occupied. The forward migration must be replayable after this drill, and a
-- static retired table name would collide on the second rollback cycle.
create table if not exists private.writing_submission_control_audit_rollback_history (
  archive_id bigint generated always as identity primary key,
  rollback_at timestamptz not null default now(),
  audit_row jsonb not null,
  row_hash text not null,
  constraint writing_submission_control_audit_rollback_hash_matches check (
    row_hash = md5(audit_row::text)
  )
);
alter table private.writing_submission_control_audit_rollback_history
  enable row level security;
alter table private.writing_submission_control_audit_rollback_history
  force row level security;
revoke all on table private.writing_submission_control_audit_rollback_history
  from public;
revoke all on table private.writing_submission_control_audit_rollback_history
  from anon;
revoke all on table private.writing_submission_control_audit_rollback_history
  from authenticated;
revoke all on table private.writing_submission_control_audit_rollback_history
  from service_role;

insert into private.writing_submission_control_audit_rollback_history (
  audit_row,
  row_hash
)
select to_jsonb(audit_row), md5(to_jsonb(audit_row)::text)
from private.writing_submission_control_audit audit_row;

drop table private.writing_submission_control_audit;

alter table private.writing_submission_control
  rename to writing_submission_control_retired_20260714;
alter table private.writing_read_control_retired_20260714
  rename to writing_read_control;

-- Restore the captured routine bodies in dependency order. Definitions and
-- owners are exact; grants are restated explicitly below so rollback never
-- broadens access through default EXECUTE privileges.
do $$
declare
  v_function record;
begin
  for v_function in
    select *
    from private.writing_problem_cutover_function_backup backup
    order by case backup.function_signature
      when 'private.project_writing_mirror_learner_materials(jsonb,jsonb,smallint)' then 10
      when 'private.get_writing_question_snapshot_for_reconciliation(uuid,text,bigint,text,smallint)' then 20
      when 'private.writing_mirror_learner_projection_matches(uuid,jsonb)' then 30
      when 'private.ensure_writing_problem_anchor(uuid,text,smallint)' then 40
      when 'private.is_writing_canonical_read_enabled()' then 40
      when 'private.is_canonical_writing_problem_anchor(uuid)' then 40
      when 'private.get_writing_submission_mode()' then 40
      when 'private.assert_writing_problem_submittable(uuid,smallint)' then 50
      when 'private.assert_writing_problem_submittable_for_user(uuid,smallint,uuid)' then 50
      when 'private.assert_latest_writing_draft_reconciliation(text)' then 50
      when 'private.guard_writing_runtime_transition()' then 60
      when 'private.guard_writing_cron_retirement_snapshot()' then 60
      when 'private.verify_writing_cron_retirement_event()' then 60
      when 'private.set_writing_runtime_state(text,text,text,text,text,text)' then 70
      when 'private.sync_available_writing_problems_legacy_impl()' then 70
      when 'public.set_writing_runtime_state(text,text,text,text,text,text)' then 80
      when 'public.run_writing_mirror_rollback_sync(text,text)' then 80
      else 90
    end,
    backup.function_signature
  loop
    execute v_function.function_definition;
    execute 'alter function ' || v_function.function_signature
      || ' owner to ' || quote_ident(v_function.owner_name);
    execute 'revoke all on function ' || v_function.function_signature
      || ' from public, anon, authenticated, service_role';
  end loop;
end
$$;

grant execute on function public.get_writing_runtime_state()
  to authenticated, service_role;
grant execute on function public.set_writing_runtime_state(
  text, text, text, text, text, text
) to service_role;
grant execute on function private.is_writing_canonical_read_enabled()
  to authenticated, service_role;
grant execute on function private.get_writing_submission_mode()
  to authenticated, service_role;
grant execute on function public.is_writing_problem_visible_to_caller(uuid, smallint)
  to authenticated;
grant execute on function private.is_writing_problem_visible_to_user(uuid, smallint, uuid)
  to service_role;
grant execute on function public.filter_visible_writing_problem_ids(uuid[])
  to authenticated;
grant execute on function private.is_canonical_writing_problem_visible_to_user(uuid, uuid)
  to authenticated;
grant execute on function public.get_writing_submission_history_context(uuid[])
  to authenticated;
grant execute on function public.list_user_problems(jsonb, text, integer, integer)
  to authenticated;
grant execute on function public.list_user_library_problem_items()
  to authenticated;
grant execute on function public.reconcile_active_writing_draft_versions(text, text)
  to service_role;
grant execute on function private.ensure_writing_problem_anchor(uuid, text, smallint)
  to service_role;
grant execute on function private.assert_writing_problem_submittable(uuid, smallint)
  to authenticated;
grant execute on function private.assert_writing_problem_submittable_for_user(uuid, smallint, uuid)
  to service_role;
grant execute on function public.create_external_writing_submission(jsonb)
  to service_role;
grant execute on function public.run_writing_mirror_rollback_sync(text, text)
  to service_role;

-- Restore the four policies exactly from catalog evidence.
do $$
declare
  v_policy record;
  v_roles text;
  v_sql text;
begin
  for v_policy in
    select *
    from private.writing_problem_cutover_policy_backup
    order by schemaname, tablename, policyname
  loop
    select string_agg(quote_ident(role_name), ', ' order by role_name)
      into v_roles
      from unnest(v_policy.roles) role_name;

    execute format(
      'drop policy if exists %I on %I.%I',
      v_policy.policyname,
      v_policy.schemaname,
      v_policy.tablename
    );
    v_sql := format(
      'create policy %I on %I.%I as %s for %s to %s',
      v_policy.policyname,
      v_policy.schemaname,
      v_policy.tablename,
      v_policy.permissive,
      v_policy.command,
      v_roles
    );
    if v_policy.using_expression is not null then
      v_sql := v_sql || ' using (' || v_policy.using_expression || ')';
    end if;
    if v_policy.check_expression is not null then
      v_sql := v_sql || ' with check (' || v_policy.check_expression || ')';
    end if;
    execute v_sql;
  end loop;
end
$$;

-- Recreate runtime/Cron serialization triggers only when their captured
-- functions and historical evidence tables exist.
do $$
begin
  if to_regprocedure('private.guard_writing_runtime_transition()') is not null then
    execute 'create trigger writing_runtime_transition_serialization before insert or update on private.writing_read_control for each row execute function private.guard_writing_runtime_transition()';
  end if;
  if to_regclass('private.writing_cron_definition_snapshot') is not null
     and to_regprocedure(
       'private.guard_writing_cron_retirement_snapshot()'
     ) is not null then
    execute 'create trigger writing_cron_retirement_snapshot_guard before insert or update on private.writing_cron_definition_snapshot for each row execute function private.guard_writing_cron_retirement_snapshot()';
  end if;
  if to_regclass('private.writing_scheduler_event') is not null
     and to_regprocedure(
       'private.verify_writing_cron_retirement_event()'
     ) is not null then
    execute 'create trigger writing_cron_retirement_event_guard before insert on private.writing_scheduler_event for each row execute function private.verify_writing_cron_retirement_event()';
  end if;
end
$$;

comment on table private.writing_submission_control_retired_20260714 is
  'Retained submission-only control evidence from the identity-registry cutover. It is inactive after rollback.';

do $$
begin
  raise notice 'Partial evidence-preserving rollback complete. problem_identities, legacy_cutover_snapshot columns, immutable snapshot guards, and cutover backup/audit tables were intentionally retained. The retired mirror Cron was not rescheduled by this down migration.';
end
$$;
