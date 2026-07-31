-- Final cutover migration. Apply only after the runtime singleton is in
-- canonical read mode and cross-app/browser/rollback gates have passed.
-- The Vercel external-ingest schedule and every other pg_cron job are outside
-- this migration's scope.

create table if not exists private.writing_scheduler_event (
  event_id bigint generated always as identity primary key,
  event_name text not null check (event_name in (
    'writing_cron_retired',
    'writing_cron_restored',
    'writing_mirror_rollback_sync'
  )),
  job_name text not null,
  schedule text,
  command_digest text,
  database_name text,
  run_as_username text,
  active boolean,
  nodename text,
  nodeport integer,
  actor text not null,
  reason_hash text not null,
  occurred_at timestamptz not null default now()
);

alter table private.writing_scheduler_event enable row level security;
alter table private.writing_scheduler_event force row level security;
revoke all on table private.writing_scheduler_event from public;
revoke all on table private.writing_scheduler_event from anon;
revoke all on table private.writing_scheduler_event from authenticated;
revoke all on table private.writing_scheduler_event from service_role;

create table if not exists private.writing_cron_definition_snapshot (
  job_name text primary key,
  schedule text not null,
  command text not null,
  command_digest text not null,
  database_name text not null,
  run_as_username text not null,
  active boolean not null,
  nodename text not null,
  nodeport integer not null,
  captured_at timestamptz not null default now(),
  constraint writing_cron_definition_digest_matches
    check (command_digest = md5(command))
);

alter table private.writing_cron_definition_snapshot enable row level security;
alter table private.writing_cron_definition_snapshot force row level security;
revoke all on table private.writing_cron_definition_snapshot from public;
revoke all on table private.writing_cron_definition_snapshot from anon;
revoke all on table private.writing_cron_definition_snapshot from authenticated;
revoke all on table private.writing_cron_definition_snapshot from service_role;

drop trigger if exists writing_cron_retirement_snapshot_guard
  on private.writing_cron_definition_snapshot;
create trigger writing_cron_retirement_snapshot_guard
before insert or update on private.writing_cron_definition_snapshot
for each row execute function private.guard_writing_cron_retirement_snapshot();

drop trigger if exists writing_cron_retirement_event_guard
  on private.writing_scheduler_event;
create trigger writing_cron_retirement_event_guard
before insert on private.writing_scheduler_event
for each row execute function private.verify_writing_cron_retirement_event();

do $$
declare
  v_job_count integer;
  v_read_mode text;
  v_submission_mode text;
  v_job_id bigint;
  v_schedule text;
  v_command text;
  v_command_digest text;
  v_database_name text;
  v_run_as_username text;
  v_active boolean;
  v_nodename text;
  v_nodeport integer;
  v_running_count integer;
begin
  perform pg_catalog.pg_advisory_xact_lock(731971029691967530::bigint);
  select control.read_mode, control.submission_mode
    into v_read_mode, v_submission_mode
    from private.writing_read_control control
   where control.singleton;

  if v_read_mode is distinct from 'canonical'
     or v_submission_mode is distinct from 'blocked' then
    raise exception 'writing_mirror_cron_retirement_requires_canonical_blocked';
  end if;

  select count(*)
    into v_job_count
    from cron.job
   where jobname = 'sync-writing-problems';

  if v_job_count > 1 then
    raise exception 'writing_mirror_cron_duplicate_jobs: %', v_job_count;
  end if;

  if v_job_count = 1 then
    select
      job.jobid,
      job.schedule::text,
      job.command,
      md5(job.command),
      job.database,
      job.username,
      job.active,
      job.nodename,
      job.nodeport
      into
        v_job_id,
        v_schedule,
        v_command,
        v_command_digest,
        v_database_name,
        v_run_as_username,
        v_active,
        v_nodename,
        v_nodeport
      from cron.job job
     where job.jobname = 'sync-writing-problems';

    insert into private.writing_cron_definition_snapshot (
      job_name,
      schedule,
      command,
      command_digest,
      database_name,
      run_as_username,
      active,
      nodename,
      nodeport
    ) values (
      'sync-writing-problems',
      v_schedule,
      v_command,
      v_command_digest,
      v_database_name,
      v_run_as_username,
      v_active,
      v_nodename,
      v_nodeport
    )
    on conflict (job_name) do nothing;

    if not exists (
      select 1
        from private.writing_cron_definition_snapshot snapshot
       where snapshot.job_name = 'sync-writing-problems'
         and snapshot.schedule = v_schedule
         and snapshot.command_digest = v_command_digest
         and snapshot.database_name = v_database_name
         and snapshot.run_as_username = v_run_as_username
         and snapshot.active = v_active
         and snapshot.nodename = v_nodename
         and snapshot.nodeport = v_nodeport
    ) then
      raise exception 'writing_mirror_cron_definition_changed_after_snapshot';
    end if;

    perform cron.unschedule(v_job_id);

    -- The wrapper installed by 20260713084000 takes the same advisory lock
    -- and re-checks legacy read mode before invoking the old body. This table
    -- lock also waits for an already-mutating legacy transaction to finish.
    lock table public.problems in share row exclusive mode;

    select count(*)
      into v_running_count
      from cron.job_run_details run
     where run.jobid = v_job_id
       and run.end_time is null;

    if v_running_count <> 0 then
      raise exception 'writing_mirror_cron_run_in_progress: %', v_running_count;
    end if;

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
      'writing_cron_retired',
      'sync-writing-problems',
      v_schedule,
      v_command_digest,
      v_database_name,
      v_run_as_username,
      v_active,
      v_nodename,
      v_nodeport,
      'migration',
      md5('canonical_blocked_cutover')
    );
  elsif not exists (
    select 1
      from private.writing_scheduler_event event
     where event.event_name = 'writing_cron_retired'
       and event.job_name = 'sync-writing-problems'
  ) then
    raise exception 'writing_mirror_cron_missing_without_retirement_evidence';
  end if;
end
$$;

-- Preserve the implementation for explicit rollback, but make the historic
-- public entrypoint fail closed so a service process cannot silently restart
-- mirroring while canonical reads are active.
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
set search_path = pg_catalog
as $$
begin
  raise exception 'writing_mirror_sync_retired'
    using errcode = 'P0001',
          detail = 'Use run_writing_mirror_rollback_sync with an actor and reason during an explicit rollback.';
end;
$$;

revoke all on function public.sync_available_writing_problems() from public;
revoke all on function public.sync_available_writing_problems() from anon;
revoke all on function public.sync_available_writing_problems() from authenticated;
revoke all on function public.sync_available_writing_problems() from service_role;

create or replace function public.run_writing_mirror_rollback_sync(
  p_actor text,
  p_reason text
)
returns table (synced integer, archived integer)
language plpgsql
security definer
set search_path = pg_catalog, private
as $$
begin
  if nullif(btrim(p_actor), '') is null then
    raise exception 'writing_mirror_rollback_actor_required';
  end if;
  if nullif(btrim(p_reason), '') is null then
    raise exception 'writing_mirror_rollback_reason_required';
  end if;

  raise log 'writing_mirror_rollback_sync actor=% reason_hash=%',
    btrim(p_actor), md5(btrim(p_reason));

  insert into private.writing_scheduler_event (
    event_name,
    job_name,
    actor,
    reason_hash
  ) values (
    'writing_mirror_rollback_sync',
    'sync-writing-problems',
    btrim(p_actor),
    md5(btrim(p_reason))
  );

  return query
  select * from private.sync_available_writing_problems_legacy_impl();
end;
$$;

revoke all on function public.run_writing_mirror_rollback_sync(text, text)
  from public;
revoke all on function public.run_writing_mirror_rollback_sync(text, text)
  from anon;
revoke all on function public.run_writing_mirror_rollback_sync(text, text)
  from authenticated;
grant execute on function public.run_writing_mirror_rollback_sync(text, text)
  to service_role;

comment on function public.sync_available_writing_problems() is
  'Retired mirror entrypoint. The implementation remains private for an explicit audited rollback only.';
comment on function public.run_writing_mirror_rollback_sync(text, text) is
  'Service-role-only explicit rollback sync. Requires operator actor and reason; never scheduled by this migration.';
