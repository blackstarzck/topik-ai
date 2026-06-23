-- =====================================================================
-- topik-ai admin - Audit logs read RPC - admin-0023
-- System > audit logs live read transition.
-- No table creation, column changes, RLS changes, or write-path changes.
-- Adds admin-owned read indexes and a read-only SECURITY DEFINER RPC.
-- down: supabase/migrations-admin/down/20260618001000_admin_audit_logs_read.sql
-- =====================================================================

create index if not exists admin_audit_logs_target_lookup_idx
  on public.admin_audit_logs (target_table, target_id);

create index if not exists admin_audit_logs_created_at_desc_idx
  on public.admin_audit_logs (created_at desc);

create or replace function public.admin_list_audit_logs(
  p_target_type text default null,
  p_target_id   text default null,
  p_keyword     text default null,
  p_start       timestamptz default null,
  p_end         timestamptz default null,
  p_limit       int default 100,
  p_offset      int default 0
)
returns table (
  log_id      text,
  target_type text,
  target_id   text,
  action      text,
  actor       text,
  reason      text,
  diff        jsonb,
  payload     jsonb,
  created_at  timestamptz,
  total_count bigint
)
language plpgsql
stable
security definer
set search_path = pg_catalog, public
as $$
#variable_conflict use_column
declare
  caller_id uuid := auth.uid();
  v_target_type text := nullif(btrim(coalesce(p_target_type, '')), '');
  v_target_id   text := nullif(btrim(coalesce(p_target_id, '')), '');
  v_keyword     text := nullif(btrim(coalesce(p_keyword, '')), '');
  v_limit       int := least(greatest(coalesce(p_limit, 100), 1), 500);
  v_offset      int := greatest(coalesce(p_offset, 0), 0);
begin
  if caller_id is null then raise exception 'unauthenticated'; end if;
  if not private.is_admin(caller_id) then raise exception 'forbidden: admin required'; end if;

  return query
  with filtered as (
    select
      l.id,
      l.target_table,
      l.target_id,
      l.action,
      coalesce(nullif(p.display_name, ''), l.admin_user_id::text, 'system') as actor,
      l.diff,
      l.payload,
      l.created_at
    from public.admin_audit_logs l
    left join public.profiles p on p.id = l.admin_user_id
    where (v_target_type is null or l.target_table = v_target_type)
      and (v_target_id is null or l.target_id = v_target_id)
      and (p_start is null or l.created_at >= p_start)
      and (p_end is null or l.created_at <= p_end)
      and (
        v_keyword is null
        or l.action ilike '%' || v_keyword || '%'
        or l.target_id ilike '%' || v_keyword || '%'
        or l.payload::text ilike '%' || v_keyword || '%'
      )
  ),
  counted as (
    select filtered.*, count(*) over () as total_count
    from filtered
  )
  select
    counted.id::text,
    counted.target_table,
    counted.target_id,
    counted.action,
    counted.actor,
    counted.payload ->> 'reason',
    counted.diff,
    counted.payload,
    counted.created_at,
    counted.total_count
  from counted
  order by counted.created_at desc
  offset v_offset
  limit v_limit;
end;
$$;

revoke all on function public.admin_list_audit_logs(text, text, text, timestamptz, timestamptz, int, int) from public;
grant execute on function public.admin_list_audit_logs(text, text, text, timestamptz, timestamptz, int, int) to authenticated;

comment on function public.admin_list_audit_logs(text, text, text, timestamptz, timestamptz, int, int) is
  'System > audit logs read. Admin-only SECURITY DEFINER RPC over public.admin_audit_logs with profiles display_name actor resolution, filters, pagination, and total_count. Read-only; write paths remain existing admin RPC INSERTs.';
