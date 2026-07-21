begin;

drop function public.get_admin_backup_summary();

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
  last_restore_completed_at     timestamptz,
  last_report_received_at       timestamptz
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
    drill.completed_at,
    (select max(e.received_at) from public.admin_backup_report_events e)
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

comment on function public.get_admin_backup_summary() is
  'Dashboard backup summary for any active admin, including the latest metadata delivery time.';

commit;
