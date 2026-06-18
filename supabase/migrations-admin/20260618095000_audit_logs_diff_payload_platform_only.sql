-- =====================================================================
-- topik-ai admin - Audit logs diff/payload exposure gating
-- Owner decision (2026-06-18): admin_audit_logs.diff/payload may contain
-- sensitive content (member PII, policy bodies, refund/suspension reasons),
-- so they are exposed ONLY to platform_admin. content_admin/org_admin keep
-- list/filter/actor/reason visibility but receive diff/payload as NULL — the
-- sensitive data is never sent over the wire to a non-platform admin (server
-- side gating, defence in depth). The payload keyword search branch is also
-- restricted to platform_admin so payload contents cannot be probed.
-- reason (payload->>'reason') stays visible to all admins (unchanged).
-- CREATE OR REPLACE only; no table/column/RLS/write-path change.
-- down restores the previous (ungated) read RPC from 20260618001000.
-- down: supabase/migrations-admin/down/20260618095000_audit_logs_diff_payload_platform_only.sql
-- =====================================================================

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
  v_is_platform boolean;
  v_target_type text := nullif(btrim(coalesce(p_target_type, '')), '');
  v_target_id   text := nullif(btrim(coalesce(p_target_id, '')), '');
  v_keyword     text := nullif(btrim(coalesce(p_keyword, '')), '');
  v_limit       int := least(greatest(coalesce(p_limit, 100), 1), 500);
  v_offset      int := greatest(coalesce(p_offset, 0), 0);
begin
  if caller_id is null then raise exception 'unauthenticated'; end if;
  if not private.is_admin(caller_id) then raise exception 'forbidden: admin required'; end if;
  v_is_platform := private.is_platform_admin(caller_id);

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
        or (v_is_platform and l.payload::text ilike '%' || v_keyword || '%')
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
    case when v_is_platform then counted.diff else null end,
    case when v_is_platform then counted.payload else null end,
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
  'System > audit logs read. Admin-only SECURITY DEFINER RPC over public.admin_audit_logs. diff/payload (and the payload keyword search branch) are returned ONLY to platform_admin; other admins get NULL diff/payload. actor=profiles.display_name, reason=payload->>reason stays visible to all admins. Read-only.';
