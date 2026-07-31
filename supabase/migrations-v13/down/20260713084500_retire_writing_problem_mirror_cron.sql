-- Restore the original public sync implementation and its one-minute schedule.
-- Mirror rows and all canonical version metadata are intentionally retained.

drop function if exists public.run_writing_mirror_rollback_sync(text, text);
drop function if exists public.sync_available_writing_problems();

do $$
begin
  if to_regprocedure(
    'private.sync_available_writing_problems_legacy_impl()'
  ) is null then
    raise exception 'writing_mirror_sync_rollback_function_missing';
  end if;

  alter function private.sync_available_writing_problems_legacy_impl()
    set schema public;
  alter function public.sync_available_writing_problems_legacy_impl()
    rename to sync_available_writing_problems;
end
$$;

revoke all on function public.sync_available_writing_problems() from public;
revoke all on function public.sync_available_writing_problems() from anon;
revoke all on function public.sync_available_writing_problems()
  from authenticated;
grant execute on function public.sync_available_writing_problems()
  to service_role;

do $$
declare
  v_job_count integer;
  v_schedule text;
  v_command text;
  v_command_digest text;
  v_database_name text;
  v_run_as_username text;
  v_active boolean;
  v_nodename text;
  v_nodeport integer;
  v_actual_schedule text;
  v_actual_command_digest text;
  v_actual_database_name text;
  v_actual_run_as_username text;
  v_actual_active boolean;
  v_actual_nodename text;
  v_actual_nodeport integer;
  v_restored boolean := false;
begin
  -- The serialization guard from 08:40 is still active during reverse-order
  -- rollback and permits a restoration event only in legacy + blocked mode.
  perform private.set_writing_runtime_state(
    'legacy',
    'blocked',
    'unverified',
    'down_migration',
    'explicit_schema_rollback',
    null
  );

  select
    snapshot.schedule,
    snapshot.command,
    snapshot.command_digest,
    snapshot.database_name,
    snapshot.run_as_username,
    snapshot.active,
    snapshot.nodename,
    snapshot.nodeport
    into
      v_schedule,
      v_command,
      v_command_digest,
      v_database_name,
      v_run_as_username,
      v_active,
      v_nodename,
      v_nodeport
    from private.writing_cron_definition_snapshot snapshot
   where snapshot.job_name = 'sync-writing-problems';

  if not found then
    raise exception 'writing_mirror_cron_definition_snapshot_missing';
  end if;

  if md5(v_command) is distinct from v_command_digest then
    raise exception 'writing_mirror_cron_definition_snapshot_digest_mismatch';
  end if;

  select count(*)
    into v_job_count
    from cron.job
   where jobname = 'sync-writing-problems';

  if v_job_count > 1 then
    raise exception 'writing_mirror_cron_duplicate_jobs: %', v_job_count;
  end if;

  if v_job_count = 0 then
    -- Supabase's managed pg_cron rejects an explicitly supplied superuser
    -- name even when the Management SQL session already runs as that role.
    -- Passing NULL means "current_user"; keep the exact-restore guarantee by
    -- refusing to proceed when the captured role differs from the session.
    if v_run_as_username is distinct from current_user then
      raise exception 'writing_mirror_cron_restore_role_mismatch: expected %, current %',
        v_run_as_username,
        current_user;
    end if;
    perform cron.schedule_in_database(
      'sync-writing-problems',
      v_schedule,
      v_command,
      v_database_name,
      null,
      v_active
    );
    v_restored := true;
  end if;

  select
    job.schedule::text,
    md5(job.command),
    job.database,
    job.username,
    job.active,
    job.nodename,
    job.nodeport
    into
      v_actual_schedule,
      v_actual_command_digest,
      v_actual_database_name,
      v_actual_run_as_username,
      v_actual_active,
      v_actual_nodename,
      v_actual_nodeport
    from cron.job job
   where job.jobname = 'sync-writing-problems';

  if not found
     or v_actual_schedule is distinct from v_schedule
     or v_actual_command_digest is distinct from v_command_digest
     or v_actual_database_name is distinct from v_database_name
     or v_actual_run_as_username is distinct from v_run_as_username
     or v_actual_active is distinct from v_active
     or v_actual_nodename is distinct from v_nodename
     or v_actual_nodeport is distinct from v_nodeport then
    raise exception 'writing_mirror_cron_restored_definition_mismatch';
  end if;

  if v_restored then
    insert into private.writing_scheduler_event (
      event_name,
      job_name,
      schedule,
      command_digest,
      database_name,
      run_as_username,
      active,
      nodename,
      nodeport,
      actor,
      reason_hash
    ) values (
      'writing_cron_restored',
      'sync-writing-problems',
      v_schedule,
      v_command_digest,
      v_database_name,
      v_run_as_username,
      v_active,
      v_nodename,
      v_nodeport,
      'down_migration',
      md5('explicit_schema_rollback')
    );
  end if;
end
$$;

-- Keep private.writing_scheduler_event as immutable retirement/rollback
-- evidence even when the scheduling interface is rolled back.
