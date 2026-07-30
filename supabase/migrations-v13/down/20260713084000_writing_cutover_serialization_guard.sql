begin;

-- Refuse the standalone down path unless runtime has already returned to the
-- only state where the unserialized legacy setter is safe.
do $$
declare
  v_read_mode text;
  v_submission_mode text;
begin
  perform pg_catalog.pg_advisory_xact_lock(731971029691967530::bigint);
  select control.read_mode, control.submission_mode
    into v_read_mode, v_submission_mode
    from private.writing_read_control control
   where control.singleton
   for update;
  if v_read_mode is distinct from 'legacy'
     or v_submission_mode is distinct from 'blocked' then
    raise exception 'writing_serialization_down_requires_legacy_blocked';
  end if;

  if to_regprocedure(
    'private.set_writing_runtime_state_unserialized_impl(text,text,text,text,text,text)'
  ) is not null then
    drop function if exists private.set_writing_runtime_state(
      text, text, text, text, text, text
    );
    alter function private.set_writing_runtime_state_unserialized_impl(
      text, text, text, text, text, text
    ) rename to set_writing_runtime_state;
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
  end if;
end
$$;

drop trigger if exists writing_cron_retirement_event_guard
  on private.writing_scheduler_event;
drop trigger if exists writing_cron_retirement_snapshot_guard
  on private.writing_cron_definition_snapshot;
drop trigger if exists writing_runtime_transition_serialization
  on private.writing_read_control;

drop function if exists private.verify_writing_cron_retirement_event();
drop function if exists private.guard_writing_cron_retirement_snapshot();
drop function if exists private.guard_writing_runtime_transition();
drop function if exists private.assert_latest_writing_draft_reconciliation(text);

-- If the retirement migration was not applied, restore the exact legacy body
-- that this serialization migration wrapped. In normal reverse order the
-- retirement down migration has already performed this restoration.
do $$
begin
  if to_regprocedure(
    'private.sync_available_writing_problems_legacy_impl()'
  ) is not null then
    drop function if exists public.sync_available_writing_problems();
    alter function private.sync_available_writing_problems_legacy_impl()
      set schema public;
    alter function public.sync_available_writing_problems_legacy_impl()
      rename to sync_available_writing_problems;
    revoke all on function public.sync_available_writing_problems() from public;
    revoke all on function public.sync_available_writing_problems() from anon;
    revoke all on function public.sync_available_writing_problems()
      from authenticated;
    grant execute on function public.sync_available_writing_problems()
      to service_role;
  end if;
end
$$;

commit;
