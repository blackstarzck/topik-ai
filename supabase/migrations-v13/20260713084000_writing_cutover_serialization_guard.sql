-- Corrective serialization guard for the canonical writing cutover.
--
-- The original runtime migration may already be installed. This migration
-- makes the latest reconciliation evidence, its current draft set, runtime
-- state changes, and the exact mirror Cron mutation one serialized contract.

-- Every runtime-state writer must acquire the advisory barrier before the
-- control-row lock taken by the legacy implementation. Renaming preserves the
-- exact validated implementation while the wrapper fixes the global lock order.
do $$
begin
  if to_regprocedure(
    'private.set_writing_runtime_state_unserialized_impl(text,text,text,text,text,text)'
  ) is null then
    if to_regprocedure(
      'private.set_writing_runtime_state(text,text,text,text,text,text)'
    ) is null then
      raise exception 'writing_runtime_state_setter_missing';
    end if;
    alter function private.set_writing_runtime_state(
      text, text, text, text, text, text
    ) rename to set_writing_runtime_state_unserialized_impl;
  end if;
end
$$;

revoke all on function private.set_writing_runtime_state_unserialized_impl(
  text, text, text, text, text, text
) from public;
revoke all on function private.set_writing_runtime_state_unserialized_impl(
  text, text, text, text, text, text
) from anon;
revoke all on function private.set_writing_runtime_state_unserialized_impl(
  text, text, text, text, text, text
) from authenticated;
revoke all on function private.set_writing_runtime_state_unserialized_impl(
  text, text, text, text, text, text
) from service_role;

create or replace function private.set_writing_runtime_state(
  p_read_mode text,
  p_submission_mode text,
  p_submission_contract_state text,
  p_actor text,
  p_reason text,
  p_evidence_id text default null
)
returns void
language plpgsql
security definer
set search_path = pg_catalog, public, private
as $$
begin
  perform pg_catalog.pg_advisory_xact_lock(731971029691967530::bigint);
  perform private.set_writing_runtime_state_unserialized_impl(
    p_read_mode,
    p_submission_mode,
    p_submission_contract_state,
    p_actor,
    p_reason,
    p_evidence_id
  );
end;
$$;

revoke all on function private.set_writing_runtime_state(
  text, text, text, text, text, text
) from public;
revoke all on function private.set_writing_runtime_state(
  text, text, text, text, text, text
) from anon;
revoke all on function private.set_writing_runtime_state(
  text, text, text, text, text, text
) from authenticated;
revoke all on function private.set_writing_runtime_state(
  text, text, text, text, text, text
) from service_role;

-- Put the legacy mirror body behind the same cutover barrier before the Cron
-- retirement migration runs. A job that started while retirement was waiting
-- must re-check read mode after acquiring the barrier and fail closed.
do $$
begin
  if to_regprocedure(
    'private.sync_available_writing_problems_legacy_impl()'
  ) is null then
    if to_regprocedure('public.sync_available_writing_problems()') is null then
      raise exception 'writing_mirror_sync_function_missing';
    end if;
    alter function public.sync_available_writing_problems()
      rename to sync_available_writing_problems_legacy_impl;
    alter function public.sync_available_writing_problems_legacy_impl()
      set schema private;
  end if;
end
$$;

revoke all on function private.sync_available_writing_problems_legacy_impl()
  from public;
revoke all on function private.sync_available_writing_problems_legacy_impl()
  from anon;
revoke all on function private.sync_available_writing_problems_legacy_impl()
  from authenticated;
revoke all on function private.sync_available_writing_problems_legacy_impl()
  from service_role;

create or replace function public.sync_available_writing_problems()
returns table (synced integer, archived integer)
language plpgsql
security definer
set search_path = pg_catalog, private
as $$
declare
  v_read_mode text;
begin
  perform pg_catalog.pg_advisory_xact_lock(731971029691967530::bigint);
  select control.read_mode
    into v_read_mode
    from private.writing_read_control control
   where control.singleton;
  if v_read_mode is distinct from 'legacy' then
    raise exception 'writing_mirror_sync_requires_legacy_mode';
  end if;
  return query
  select * from private.sync_available_writing_problems_legacy_impl();
end;
$$;

revoke all on function public.sync_available_writing_problems() from public;
revoke all on function public.sync_available_writing_problems() from anon;
revoke all on function public.sync_available_writing_problems()
  from authenticated;
grant execute on function public.sync_available_writing_problems()
  to service_role;

create or replace function private.assert_latest_writing_draft_reconciliation(
  p_evidence_id text
)
returns void
language plpgsql
security definer
set search_path = pg_catalog, public, private
as $$
declare
  v_latest private.writing_draft_reconciliation_audit%rowtype;
  v_candidate record;
  v_candidate_count integer;
  v_snapshot jsonb;
begin
  if nullif(btrim(p_evidence_id), '') is null then
    raise exception 'canonical_draft_reconciliation_evidence_id_required';
  end if;

  -- Shared with topik-ai 20260713082500. The table locks close the gap
  -- between evidence validation and the final singleton write.
  perform pg_catalog.pg_advisory_xact_lock(731971029691967530::bigint);
  lock table public.topik_writing_question_import in share row exclusive mode;
  lock table public.topik_writing_question_source_map in share row exclusive mode;
  lock table public.topik_writing_51_questions in share row exclusive mode;
  lock table public.topik_writing_52_questions in share row exclusive mode;
  lock table public.topik_writing_53_questions in share row exclusive mode;
  lock table public.topik_writing_54_questions in share row exclusive mode;
  lock table public.problems in share row exclusive mode;
  lock table public.writing_drafts in share row exclusive mode;

  select audit.*
    into v_latest
    from private.writing_draft_reconciliation_audit audit
   order by audit.checked_at desc, audit.audit_id desc
   limit 1;

  if not found
     or v_latest.status is distinct from 'pinned'
     or v_latest.mismatch_count <> 0
     or v_latest.pinned_count is distinct from v_latest.candidate_count
     or v_latest.evidence_id is distinct from btrim(p_evidence_id) then
    raise exception 'canonical_latest_draft_reconciliation_evidence_invalid';
  end if;

  select count(*)::integer
    into v_candidate_count
    from public.writing_drafts draft
    join public.problems problem on problem.id = draft.problem_id
   where problem.domain = 'writing'
     and problem.source = 'curated'
     and draft.autosave_status <> 'superseded'
     and (
       nullif(btrim(coalesce(draft.answer_text, '')), '') is not null
       or (
         draft.answer_json is not null
         and draft.answer_json <> 'null'::jsonb
         and draft.answer_json <> '{}'::jsonb
       )
     );

  if v_candidate_count is distinct from v_latest.candidate_count then
    raise exception 'canonical_draft_reconciliation_candidate_set_changed: evidence %, current %',
      v_latest.candidate_count,
      v_candidate_count;
  end if;

  for v_candidate in
    select
      draft.id,
      draft.problem_id,
      draft.question_no,
      draft.canonical_question_id,
      draft.canonical_import_id,
      draft.canonical_payload_hash,
      draft.question_snapshot,
      source_map.question_id as expected_question_id,
      source_map.canonical_import_id as expected_import_id,
      import_row.payload_hash as expected_payload_hash
    from public.writing_drafts draft
    join public.problems problem on problem.id = draft.problem_id
    left join public.topik_writing_question_source_map source_map
      on source_map.learner_problem_id = draft.problem_id
     and source_map.item_number = draft.question_no
    left join public.topik_writing_question_import import_row
      on import_row.import_id = source_map.canonical_import_id
    where problem.domain = 'writing'
      and problem.source = 'curated'
      and draft.autosave_status <> 'superseded'
      and (
        nullif(btrim(coalesce(draft.answer_text, '')), '') is not null
        or (
          draft.answer_json is not null
          and draft.answer_json <> 'null'::jsonb
          and draft.answer_json <> '{}'::jsonb
        )
      )
    order by draft.id
  loop
    if v_candidate.expected_question_id is null
       or v_candidate.expected_import_id is null
       or nullif(btrim(v_candidate.expected_payload_hash), '') is null
       or v_candidate.canonical_question_id is distinct from v_candidate.expected_question_id
       or v_candidate.canonical_import_id is distinct from v_candidate.expected_import_id
       or v_candidate.canonical_payload_hash is distinct from v_candidate.expected_payload_hash
       or jsonb_typeof(v_candidate.question_snapshot) is distinct from 'object' then
      raise exception 'canonical_draft_reconciliation_current_pin_mismatch: %',
        v_candidate.id;
    end if;

    v_snapshot := private.get_writing_question_snapshot_for_reconciliation(
      v_candidate.problem_id,
      v_candidate.expected_question_id,
      v_candidate.expected_import_id,
      v_candidate.expected_payload_hash,
      v_candidate.question_no
    );

    if v_snapshot is null
       or v_candidate.question_snapshot is distinct from v_snapshot then
      raise exception 'canonical_draft_reconciliation_current_snapshot_mismatch: %',
        v_candidate.id;
    end if;
  end loop;
end;
$$;

revoke all on function private.assert_latest_writing_draft_reconciliation(text)
  from public;
revoke all on function private.assert_latest_writing_draft_reconciliation(text)
  from anon;
revoke all on function private.assert_latest_writing_draft_reconciliation(text)
  from authenticated;
revoke all on function private.assert_latest_writing_draft_reconciliation(text)
  from service_role;

create or replace function private.guard_writing_runtime_transition()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public, private
as $$
begin
  perform pg_catalog.pg_advisory_xact_lock(731971029691967530::bigint);

  if new.read_mode = 'canonical' then
    perform private.assert_latest_writing_draft_reconciliation(new.evidence_id);
  end if;

  return new;
end;
$$;

revoke all on function private.guard_writing_runtime_transition() from public;
revoke all on function private.guard_writing_runtime_transition() from anon;
revoke all on function private.guard_writing_runtime_transition() from authenticated;
revoke all on function private.guard_writing_runtime_transition() from service_role;

drop trigger if exists writing_runtime_transition_serialization
  on private.writing_read_control;
create trigger writing_runtime_transition_serialization
before insert or update on private.writing_read_control
for each row execute function private.guard_writing_runtime_transition();

create or replace function private.guard_writing_cron_retirement_snapshot()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, private
as $$
declare
  v_read_mode text;
  v_submission_mode text;
begin
  if new.job_name <> 'sync-writing-problems' then
    return new;
  end if;

  -- cron.job is managed by supabase_admin and cannot receive application
  -- triggers. This owned snapshot is the final write before unschedule, so
  -- lock the runtime row here for the whole retirement transaction.
  perform pg_catalog.pg_advisory_xact_lock(731971029691967530::bigint);
  select control.read_mode, control.submission_mode
    into v_read_mode, v_submission_mode
    from private.writing_read_control control
   where control.singleton
   for update;

  if v_read_mode is distinct from 'canonical'
     or v_submission_mode is distinct from 'blocked' then
    raise exception 'writing_mirror_cron_removal_requires_canonical_blocked';
  end if;

  return new;
end;
$$;

revoke all on function private.guard_writing_cron_retirement_snapshot() from public;
revoke all on function private.guard_writing_cron_retirement_snapshot() from anon;
revoke all on function private.guard_writing_cron_retirement_snapshot() from authenticated;
revoke all on function private.guard_writing_cron_retirement_snapshot() from service_role;

do $$
begin
  if to_regclass('private.writing_cron_definition_snapshot') is not null then
    execute 'drop trigger if exists writing_cron_retirement_snapshot_guard
      on private.writing_cron_definition_snapshot';
    execute 'create trigger writing_cron_retirement_snapshot_guard
      before insert or update on private.writing_cron_definition_snapshot
      for each row execute function private.guard_writing_cron_retirement_snapshot()';
  end if;
end
$$;

create or replace function private.verify_writing_cron_retirement_event()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, private, cron
as $$
declare
  v_read_mode text;
  v_submission_mode text;
begin
  if new.job_name <> 'sync-writing-problems'
     or new.event_name not in ('writing_cron_retired', 'writing_cron_restored') then
    return new;
  end if;

  perform pg_catalog.pg_advisory_xact_lock(731971029691967530::bigint);
  select control.read_mode, control.submission_mode
    into v_read_mode, v_submission_mode
    from private.writing_read_control control
   where control.singleton
   for update;

  if new.event_name = 'writing_cron_retired' then
    if v_read_mode is distinct from 'canonical'
       or v_submission_mode is distinct from 'blocked' then
      raise exception 'writing_cron_retirement_event_requires_canonical_blocked';
    end if;
    if exists (
      select 1 from cron.job where jobname = 'sync-writing-problems'
    ) then
      raise exception 'writing_cron_retirement_event_requires_absent_job';
    end if;
  else
    if v_read_mode is distinct from 'legacy'
       or v_submission_mode is distinct from 'blocked' then
      raise exception 'writing_mirror_cron_restore_requires_legacy_blocked';
    end if;
    if not exists (
      select 1 from cron.job where jobname = 'sync-writing-problems'
    ) then
      raise exception 'writing_cron_restoration_event_requires_present_job';
    end if;
  end if;

  return new;
end;
$$;

revoke all on function private.verify_writing_cron_retirement_event() from public;
revoke all on function private.verify_writing_cron_retirement_event() from anon;
revoke all on function private.verify_writing_cron_retirement_event() from authenticated;
revoke all on function private.verify_writing_cron_retirement_event() from service_role;

do $$
begin
  if to_regclass('private.writing_scheduler_event') is not null then
    execute 'drop trigger if exists writing_cron_retirement_event_guard
      on private.writing_scheduler_event';
    execute 'create trigger writing_cron_retirement_event_guard
      before insert on private.writing_scheduler_event
      for each row execute function private.verify_writing_cron_retirement_event()';
  end if;
end
$$;

-- Already-cut-over dev environments must pass the corrected gate immediately.
do $$
declare
  v_read_mode text;
  v_evidence_id text;
begin
  perform pg_catalog.pg_advisory_xact_lock(731971029691967530::bigint);
  select control.read_mode, control.evidence_id
    into v_read_mode, v_evidence_id
    from private.writing_read_control control
   where control.singleton
   for update;

  if v_read_mode = 'canonical' then
    perform private.assert_latest_writing_draft_reconciliation(v_evidence_id);
  end if;
end
$$;

comment on function private.assert_latest_writing_draft_reconciliation(text) is
  'Fail-closed canonical transition gate: only the latest matching evidence is valid, and every current active draft pin/snapshot is revalidated under table and advisory locks.';
