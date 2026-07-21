begin;

create or replace function public.get_admin_backup_runs(
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

comment on function public.get_admin_backup_runs(timestamptz, timestamptz, text, text, text, integer, integer) is
  'System > backup management read-only paginated list. Requires system.backups.read.';

commit;
