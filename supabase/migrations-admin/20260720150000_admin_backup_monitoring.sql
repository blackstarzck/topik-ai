-- =====================================================================
-- topik-ai admin · topik-prod on-premise backup monitoring
--
-- Stores metadata only. Backup files, object names, local paths, database
-- connection strings, secrets, raw errors, and member data are never stored.
-- Browser clients have no direct table access; authenticated admins read via
-- SECURITY DEFINER RPCs and the Vercel receiver writes through a service-role
-- only RPC.
--
-- down: supabase/migrations-admin/down/20260720150000_admin_backup_monitoring.sql
-- =====================================================================

create table public.admin_backup_runs (
  id                    uuid primary key,
  source_project        text not null default 'topik-prod',
  status                text not null,
  started_at            timestamptz not null,
  completed_at          timestamptz,
  next_scheduled_at     timestamptz,
  disk_used_percent     numeric(5, 2),
  error_code            text,
  terminal_payload_hash text,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now(),
  constraint admin_backup_runs_source_check
    check (source_project = 'topik-prod'),
  constraint admin_backup_runs_status_check
    check (status in ('running', 'succeeded', 'partial_failure', 'failed', 'delayed')),
  constraint admin_backup_runs_time_check
    check (completed_at is null or completed_at >= started_at),
  constraint admin_backup_runs_disk_check
    check (disk_used_percent is null or disk_used_percent between 0 and 100),
  constraint admin_backup_runs_error_code_check
    check (error_code is null or error_code ~ '^[A-Z0-9_]{1,64}$'),
  constraint admin_backup_runs_terminal_hash_check
    check (
      (status = 'running' and completed_at is null and terminal_payload_hash is null)
      or
      (status <> 'running' and completed_at is not null and terminal_payload_hash is not null)
    )
);

create table public.admin_backup_component_results (
  run_id             uuid not null references public.admin_backup_runs(id) on delete cascade,
  target             text not null,
  status             text not null,
  size_bytes         bigint,
  object_count       bigint,
  validation_status  text not null,
  error_code         text,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  primary key (run_id, target),
  constraint admin_backup_component_target_check
    check (target in ('database', 'storage')),
  constraint admin_backup_component_status_check
    check (status in ('pending', 'succeeded', 'failed', 'not_run')),
  constraint admin_backup_component_validation_check
    check (validation_status in ('pending', 'passed', 'failed', 'not_run')),
  constraint admin_backup_component_size_check
    check (size_bytes is null or size_bytes >= 0),
  constraint admin_backup_component_count_check
    check (object_count is null or object_count >= 0),
  constraint admin_backup_component_database_count_check
    check (target = 'storage' or object_count is null),
  constraint admin_backup_component_error_code_check
    check (error_code is null or error_code ~ '^[A-Z0-9_]{1,64}$')
);

create table public.admin_restore_drills (
  id                          uuid primary key,
  source_run_id               uuid references public.admin_backup_runs(id) on delete set null,
  source_project              text not null default 'topik-prod',
  status                      text not null,
  started_at                  timestamptz not null,
  completed_at                timestamptz not null,
  database_validation_status  text not null,
  storage_validation_status   text not null,
  error_code                  text,
  payload_hash                text not null,
  created_at                  timestamptz not null default now(),
  constraint admin_restore_drills_source_check
    check (source_project = 'topik-prod'),
  constraint admin_restore_drills_status_check
    check (status in ('succeeded', 'failed')),
  constraint admin_restore_drills_time_check
    check (completed_at >= started_at),
  constraint admin_restore_drills_validation_check
    check (
      database_validation_status in ('passed', 'failed')
      and storage_validation_status in ('passed', 'failed')
    ),
  constraint admin_restore_drills_error_code_check
    check (error_code is null or error_code ~ '^[A-Z0-9_]{1,64}$'),
  constraint admin_restore_drills_hash_check
    check (payload_hash ~ '^[0-9a-f]{64}$')
);

create table public.admin_backup_report_events (
  id            uuid primary key,
  report_type   text not null,
  entity_id     uuid not null,
  payload_hash  text not null,
  received_at   timestamptz not null default now(),
  constraint admin_backup_report_events_type_check
    check (report_type in ('backup_started', 'backup_completed', 'restore_drill_completed')),
  constraint admin_backup_report_events_hash_check
    check (payload_hash ~ '^[0-9a-f]{64}$')
);

create index admin_backup_runs_started_at_desc_idx
  on public.admin_backup_runs (started_at desc);
create index admin_backup_runs_status_started_at_idx
  on public.admin_backup_runs (status, started_at desc);
create index admin_restore_drills_completed_at_desc_idx
  on public.admin_restore_drills (completed_at desc);
create index admin_backup_report_events_received_at_idx
  on public.admin_backup_report_events (received_at);

alter table public.admin_backup_runs enable row level security;
alter table public.admin_backup_runs force row level security;
alter table public.admin_backup_component_results enable row level security;
alter table public.admin_backup_component_results force row level security;
alter table public.admin_restore_drills enable row level security;
alter table public.admin_restore_drills force row level security;
alter table public.admin_backup_report_events enable row level security;
alter table public.admin_backup_report_events force row level security;

revoke all on table public.admin_backup_runs from public, anon, authenticated;
revoke all on table public.admin_backup_component_results from public, anon, authenticated;
revoke all on table public.admin_restore_drills from public, anon, authenticated;
revoke all on table public.admin_backup_report_events from public, anon, authenticated;
grant all on table public.admin_backup_runs to service_role;
grant all on table public.admin_backup_component_results to service_role;
grant all on table public.admin_restore_drills to service_role;
grant all on table public.admin_backup_report_events to service_role;

-- The Vercel report receiver is the only intended caller. The strict HTTP
-- schema validation happens before this RPC; this function repeats transition,
-- source, idempotency, and caller checks at the database boundary.
create function public.record_admin_backup_report(
  p_report jsonb,
  p_payload_hash text
)
returns text
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_report_id       uuid;
  v_entity_id       uuid;
  v_report_type     text;
  v_source_project  text;
  v_existing_hash   text;
  v_existing_status text;
  v_status          text;
  v_database        jsonb;
  v_storage         jsonb;
  v_system_level    text;
  v_system_message  text;
begin
  if auth.role() <> 'service_role' then
    raise exception 'forbidden: service role required';
  end if;
  if p_report is null or p_payload_hash !~ '^[0-9a-f]{64}$' then
    raise exception 'invalid report';
  end if;

  v_report_id := (p_report ->> 'report_id')::uuid;
  v_report_type := p_report ->> 'report_type';
  v_source_project := p_report ->> 'source_project';
  if v_report_type not in ('backup_started', 'backup_completed', 'restore_drill_completed') then
    raise exception 'invalid report type';
  end if;
  if v_source_project <> 'topik-prod' then
    raise exception 'invalid source project';
  end if;

  v_entity_id := case
    when v_report_type in ('backup_started', 'backup_completed')
      then (p_report ->> 'run_id')::uuid
    else (p_report ->> 'drill_id')::uuid
  end;

  -- Claim the report id before applying any state transition. A concurrent
  -- retry waits on the primary key and then follows the duplicate branch.
  insert into public.admin_backup_report_events (
    id, report_type, entity_id, payload_hash
  ) values (
    v_report_id, v_report_type, v_entity_id, p_payload_hash
  ) on conflict (id) do nothing;

  if not found then
    select e.payload_hash
      into v_existing_hash
    from public.admin_backup_report_events e
    where e.id = v_report_id;
    if v_existing_hash = p_payload_hash then
      return 'duplicate';
    end if;
    raise exception 'conflicting report id';
  end if;

  if v_report_type = 'backup_started' then
    if exists (select 1 from public.admin_backup_runs where id = v_entity_id) then
      raise exception 'conflicting backup run';
    end if;

    insert into public.admin_backup_runs (
      id,
      source_project,
      status,
      started_at,
      next_scheduled_at,
      disk_used_percent
    ) values (
      v_entity_id,
      v_source_project,
      'running',
      (p_report ->> 'started_at')::timestamptz,
      nullif(p_report ->> 'next_scheduled_at', '')::timestamptz,
      nullif(p_report ->> 'disk_used_percent', '')::numeric
    );

    insert into public.admin_backup_component_results (
      run_id, target, status, validation_status
    ) values
      (v_entity_id, 'database', 'pending', 'pending'),
      (v_entity_id, 'storage', 'pending', 'pending');

  elsif v_report_type = 'backup_completed' then
    v_status := p_report ->> 'status';
    v_database := p_report -> 'database';
    v_storage := p_report -> 'storage';

    select r.status into v_existing_status
    from public.admin_backup_runs r
    where r.id = v_entity_id
    for update;

    if not found then
      raise exception 'backup start report required';
    end if;
    if v_existing_status <> 'running' then
      raise exception 'completed backup is immutable';
    end if;

    update public.admin_backup_runs
    set
      status = v_status,
      completed_at = (p_report ->> 'completed_at')::timestamptz,
      next_scheduled_at = nullif(p_report ->> 'next_scheduled_at', '')::timestamptz,
      disk_used_percent = nullif(p_report ->> 'disk_used_percent', '')::numeric,
      error_code = nullif(p_report ->> 'error_code', ''),
      terminal_payload_hash = p_payload_hash,
      updated_at = now()
    where id = v_entity_id;

    insert into public.admin_backup_component_results (
      run_id,
      target,
      status,
      size_bytes,
      object_count,
      validation_status,
      error_code,
      updated_at
    ) values
      (
        v_entity_id,
        'database',
        v_database ->> 'status',
        nullif(v_database ->> 'size_bytes', '')::bigint,
        null,
        v_database ->> 'validation_status',
        nullif(v_database ->> 'error_code', ''),
        now()
      ),
      (
        v_entity_id,
        'storage',
        v_storage ->> 'status',
        nullif(v_storage ->> 'size_bytes', '')::bigint,
        nullif(v_storage ->> 'object_count', '')::bigint,
        v_storage ->> 'validation_status',
        nullif(v_storage ->> 'error_code', ''),
        now()
      )
    on conflict (run_id, target) do update
    set
      status = excluded.status,
      size_bytes = excluded.size_bytes,
      object_count = excluded.object_count,
      validation_status = excluded.validation_status,
      error_code = excluded.error_code,
      updated_at = excluded.updated_at;

    v_system_level := case
      when v_status = 'succeeded' then 'INFO'
      when v_status in ('partial_failure', 'delayed') then 'WARN'
      else 'ERROR'
    end;
    v_system_message := case
      when v_status = 'succeeded' then '운영 백업이 정상 완료되었습니다.'
      when v_status = 'partial_failure' then '운영 백업이 일부 실패했습니다.'
      when v_status = 'delayed' then '운영 백업이 이전 실행과 겹쳐 지연되었습니다.'
      else '운영 백업이 실패했습니다.'
    end;

    insert into public.system_logs (
      id, level, component, message, trace_id, context, created_at
    ) values (
      'BACKUP-' || v_report_id::text,
      v_system_level,
      'backup-service',
      v_system_message,
      v_entity_id::text,
      jsonb_strip_nulls(jsonb_build_object(
        'run_id', v_entity_id,
        'status', v_status,
        'error_code', nullif(p_report ->> 'error_code', '')
      )),
      (p_report ->> 'completed_at')::timestamptz
    );

  else
    if exists (select 1 from public.admin_restore_drills where id = v_entity_id) then
      raise exception 'completed restore drill is immutable';
    end if;

    insert into public.admin_restore_drills (
      id,
      source_run_id,
      source_project,
      status,
      started_at,
      completed_at,
      database_validation_status,
      storage_validation_status,
      error_code,
      payload_hash
    ) values (
      v_entity_id,
      nullif(p_report ->> 'source_run_id', '')::uuid,
      v_source_project,
      p_report ->> 'status',
      (p_report ->> 'started_at')::timestamptz,
      (p_report ->> 'completed_at')::timestamptz,
      p_report ->> 'database_validation_status',
      p_report ->> 'storage_validation_status',
      nullif(p_report ->> 'error_code', ''),
      p_payload_hash
    );

    v_system_level := case when p_report ->> 'status' = 'succeeded' then 'INFO' else 'ERROR' end;
    v_system_message := case
      when p_report ->> 'status' = 'succeeded' then '월간 복원 점검이 정상 완료되었습니다.'
      else '월간 복원 점검이 실패했습니다.'
    end;

    insert into public.system_logs (
      id, level, component, message, trace_id, context, created_at
    ) values (
      'RESTORE-' || v_report_id::text,
      v_system_level,
      'backup-service',
      v_system_message,
      v_entity_id::text,
      jsonb_strip_nulls(jsonb_build_object(
        'drill_id', v_entity_id,
        'source_run_id', nullif(p_report ->> 'source_run_id', ''),
        'status', p_report ->> 'status',
        'error_code', nullif(p_report ->> 'error_code', '')
      )),
      (p_report ->> 'completed_at')::timestamptz
    );
  end if;

  -- Metadata retention is enforced on every accepted report. Backup files are
  -- retained separately by restic on the on-premise host for only seven days.
  delete from public.admin_backup_report_events
  where report_type <> 'restore_drill_completed'
    and received_at < now() - interval '90 days';
  delete from public.admin_backup_runs
  where started_at < now() - interval '90 days';
  delete from public.admin_backup_report_events
  where report_type = 'restore_drill_completed'
    and received_at < now() - interval '13 months';
  delete from public.admin_restore_drills
  where completed_at < now() - interval '13 months';

  return 'accepted';
end;
$$;

revoke all on function public.record_admin_backup_report(jsonb, text) from public, anon, authenticated;
grant execute on function public.record_admin_backup_report(jsonb, text) to service_role;

create function public.get_admin_backup_summary()
returns table (
  latest_run_id                 uuid,
  latest_status                 text,
  latest_started_at             timestamptz,
  latest_completed_at           timestamptz,
  next_scheduled_at             timestamptz,
  disk_used_percent             numeric,
  database_status               text,
  database_size_bytes           bigint,
  storage_status                text,
  storage_object_count          bigint,
  storage_size_bytes            bigint,
  last_success_at               timestamptz,
  recent_success_count          bigint,
  recent_terminal_count         bigint,
  last_restore_status           text,
  last_restore_completed_at     timestamptz
)
language plpgsql
stable
security definer
set search_path = pg_catalog, public
as $$
declare
  caller_id uuid := auth.uid();
begin
  if caller_id is null then raise exception 'unauthenticated'; end if;
  if not private.is_admin(caller_id) then
    raise exception 'forbidden: admin required';
  end if;

  return query
  with latest as (
    select r.*
    from public.admin_backup_runs r
    order by r.started_at desc
    limit 1
  ), recent as (
    select
      count(*) filter (where r.status = 'succeeded') as success_count,
      count(*) filter (where r.status <> 'running') as terminal_count
    from public.admin_backup_runs r
    where r.started_at >= now() - interval '7 days'
  )
  select
    l.id,
    l.status,
    l.started_at,
    l.completed_at,
    l.next_scheduled_at,
    l.disk_used_percent,
    db.status,
    db.size_bytes,
    storage.status,
    storage.object_count,
    storage.size_bytes,
    (select max(r.completed_at) from public.admin_backup_runs r where r.status = 'succeeded'),
    recent.success_count,
    recent.terminal_count,
    drill.status,
    drill.completed_at
  from recent
  left join latest l on true
  left join public.admin_backup_component_results db
    on db.run_id = l.id and db.target = 'database'
  left join public.admin_backup_component_results storage
    on storage.run_id = l.id and storage.target = 'storage'
  left join lateral (
    select d.status, d.completed_at
    from public.admin_restore_drills d
    order by d.completed_at desc
    limit 1
  ) drill on true;
end;
$$;

revoke all on function public.get_admin_backup_summary() from public, anon;
grant execute on function public.get_admin_backup_summary() to authenticated;

create function public.get_admin_backup_runs(
  p_started_from timestamptz default null,
  p_started_to   timestamptz default null,
  p_result       text default null,
  p_target       text default null,
  p_keyword      text default null,
  p_limit        integer default 50,
  p_offset       integer default 0
)
returns table (
  run_id                       uuid,
  display_status               text,
  started_at                   timestamptz,
  completed_at                 timestamptz,
  next_scheduled_at            timestamptz,
  disk_used_percent            numeric,
  error_code                   text,
  database_status              text,
  database_size_bytes          bigint,
  database_validation_status   text,
  database_error_code          text,
  storage_status               text,
  storage_object_count         bigint,
  storage_size_bytes           bigint,
  storage_validation_status    text,
  storage_error_code           text,
  system_log_id                text,
  total_count                  bigint
)
language plpgsql
stable
security definer
set search_path = pg_catalog, public
as $$
declare
  caller_id uuid := auth.uid();
  v_limit integer := least(greatest(coalesce(p_limit, 50), 1), 100);
  v_offset integer := greatest(coalesce(p_offset, 0), 0);
begin
  if caller_id is null then raise exception 'unauthenticated'; end if;
  if not public.admin_has_permission(caller_id, 'system.backups.read') then
    raise exception 'forbidden: missing permission system.backups.read';
  end if;
  if p_result is not null and p_result not in ('running', 'succeeded', 'partial_failure', 'failed', 'delayed') then
    raise exception 'invalid result filter';
  end if;
  if p_target is not null and p_target not in ('database', 'storage') then
    raise exception 'invalid target filter';
  end if;

  return query
  with rows as (
    select
      r.id,
      case
        when r.status = 'running' and r.started_at < now() - interval '2 hours' then 'delayed'
        else r.status
      end as effective_status,
      r.started_at,
      r.completed_at,
      r.next_scheduled_at,
      r.disk_used_percent,
      r.error_code,
      db.status as database_status,
      db.size_bytes as database_size_bytes,
      db.validation_status as database_validation_status,
      db.error_code as database_error_code,
      storage.status as storage_status,
      storage.object_count as storage_object_count,
      storage.size_bytes as storage_size_bytes,
      storage.validation_status as storage_validation_status,
      storage.error_code as storage_error_code,
      logs.id as system_log_id
    from public.admin_backup_runs r
    left join public.admin_backup_component_results db
      on db.run_id = r.id and db.target = 'database'
    left join public.admin_backup_component_results storage
      on storage.run_id = r.id and storage.target = 'storage'
    left join lateral (
      select l.id
      from public.system_logs l
      where l.component = 'backup-service' and l.trace_id = r.id::text
      order by l.created_at desc
      limit 1
    ) logs on true
    where (p_started_from is null or r.started_at >= p_started_from)
      and (p_started_to is null or r.started_at < p_started_to)
      and (nullif(btrim(coalesce(p_keyword, '')), '') is null or r.id::text ilike '%' || btrim(p_keyword) || '%')
  ), filtered as (
    select *
    from rows
    where p_result is null or case
      when p_target is null then effective_status
      when p_target = 'database' and database_status = 'pending' then
        case when effective_status = 'delayed' then 'delayed' else 'running' end
      when p_target = 'database' and database_status = 'not_run' then 'delayed'
      when p_target = 'database' then database_status
      when p_target = 'storage' and storage_status = 'pending' then
        case when effective_status = 'delayed' then 'delayed' else 'running' end
      when p_target = 'storage' and storage_status = 'not_run' then 'delayed'
      else storage_status
    end = p_result
  )
  select
    f.id,
    f.effective_status,
    f.started_at,
    f.completed_at,
    f.next_scheduled_at,
    f.disk_used_percent,
    f.error_code,
    f.database_status,
    f.database_size_bytes,
    f.database_validation_status,
    f.database_error_code,
    f.storage_status,
    f.storage_object_count,
    f.storage_size_bytes,
    f.storage_validation_status,
    f.storage_error_code,
    f.system_log_id,
    count(*) over()
  from filtered f
  order by f.started_at desc
  limit v_limit offset v_offset;
end;
$$;

revoke all on function public.get_admin_backup_runs(timestamptz, timestamptz, text, text, text, integer, integer) from public, anon;
grant execute on function public.get_admin_backup_runs(timestamptz, timestamptz, text, text, text, integer, integer) to authenticated;

comment on table public.admin_backup_runs is
  'topik-prod on-premise backup execution metadata only; no backup payload, paths, object names, PII, secrets, or raw errors.';
comment on table public.admin_backup_component_results is
  'Database and Storage aggregate results for an admin backup run.';
comment on table public.admin_restore_drills is
  'Monthly isolated restore-drill metadata retained for thirteen months.';
comment on function public.get_admin_backup_summary() is
  'Dashboard backup summary for any active admin. Aggregate metadata only.';
comment on function public.get_admin_backup_runs(timestamptz, timestamptz, text, text, text, integer, integer) is
  'System > backup management read-only paginated list. Requires system.backups.read.';
