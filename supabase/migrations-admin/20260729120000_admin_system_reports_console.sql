-- System > 사용자 리포트 조회·삭제 RPC.
-- v13 정본(20260723170000_system_reports.sql)이 만든 private.system_reports 를
-- 변형하지 않고 관리자 읽기 경로와 단건 수동 삭제 경로만 추가한다.
-- 정본 테이블에 컬럼·트리거·인덱스를 추가하지 않으며, 자동 retention 이나
-- 일괄 삭제도 만들지 않는다(보관은 무기한 수동, 삭제는 승인된 단건만).
-- 감사 payload 에는 제출자 식별 정보(email/title/message/user_id)를 담지 않는다.
-- admin_audit_logs 는 content_admin 도 조회할 수 있으므로 삭제가 PII 를 감사
-- 테이블로 옮기는 결과가 되면 안 된다.
-- down: supabase/migrations-admin/down/20260729120000_admin_system_reports_console.sql

create or replace function public.admin_list_system_reports(
  p_category text default null,
  p_from timestamptz default null,
  p_to timestamptz default null,
  p_keyword text default null,
  p_limit integer default 50,
  p_offset integer default 0
)
returns table (
  report_id uuid,
  reference_code text,
  category text,
  email text,
  title text,
  message text,
  pathname text,
  browser text,
  os text,
  device_type text,
  viewport_width integer,
  viewport_height integer,
  locale text,
  app_version text,
  reporter_user_id uuid,
  created_at timestamptz,
  total_count bigint
)
language plpgsql
stable
security definer
set search_path = pg_catalog, public
as $$
declare
  caller_id uuid := auth.uid();
  v_keyword text := nullif(btrim(coalesce(p_keyword, '')), '');
  v_limit integer := least(greatest(coalesce(p_limit, 50), 1), 100);
  v_offset integer := greatest(coalesce(p_offset, 0), 0);
begin
  if caller_id is null then raise exception 'unauthenticated'; end if;
  if not public.admin_has_permission(caller_id, 'system.reports.read') then
    raise exception 'forbidden: missing permission system.reports.read';
  end if;
  if p_category is not null and p_category not in ('bug', 'question', 'suggestion') then
    raise exception 'invalid category filter';
  end if;

  return query
  with filtered as (
    select r.*
      from private.system_reports r
     where (p_category is null or r.category = p_category)
       and (p_from is null or r.created_at >= p_from)
       and (p_to is null or r.created_at < p_to)
       and (
         v_keyword is null
         or r.reference_code ilike '%' || v_keyword || '%'
         or r.title ilike '%' || v_keyword || '%'
         or r.message ilike '%' || v_keyword || '%'
         or r.email ilike '%' || v_keyword || '%'
       )
  )
  select
    f.id,
    f.reference_code,
    f.category,
    f.email,
    f.title,
    f.message,
    f.pathname,
    f.browser,
    f.os,
    f.device_type,
    f.viewport_width,
    f.viewport_height,
    f.locale,
    f.app_version,
    f.user_id,
    f.created_at,
    count(*) over ()
  from filtered f
  order by f.created_at desc, f.id desc
  limit v_limit offset v_offset;
end;
$$;

create or replace function public.admin_delete_system_report(
  p_report_id uuid,
  p_reason text
)
returns text
language plpgsql
security definer
set search_path to 'pg_catalog', 'public'
as $function$
declare
  caller_id uuid := auth.uid();
  v_reason text := nullif(btrim(coalesce(p_reason, '')), '');
  v_old private.system_reports%rowtype;
begin
  if caller_id is null then raise exception 'unauthenticated'; end if;
  if not private.is_platform_admin(caller_id) then
    raise exception 'forbidden: platform_admin required';
  end if;
  if p_report_id is null then raise exception 'report id required'; end if;
  if v_reason is null then raise exception 'reason required'; end if;

  select * into v_old
    from private.system_reports
   where id = p_report_id
   for update;
  if not found then raise exception 'unknown system report: %', p_report_id; end if;

  delete from private.system_reports
   where id = p_report_id;

  insert into public.admin_audit_logs (admin_user_id, action, target_table, target_id, diff, payload)
  values (
    caller_id,
    'system_report_deleted',
    'SystemReport',
    v_old.reference_code,
    jsonb_build_object('deleted', jsonb_build_object('from', false, 'to', true)),
    jsonb_build_object(
      'reason', v_reason,
      'report_id', v_old.id,
      'reference_code', v_old.reference_code,
      'category', v_old.category,
      'locale', v_old.locale,
      'pathname', v_old.pathname,
      'browser', v_old.browser,
      'os', v_old.os,
      'device_type', v_old.device_type,
      'app_version', v_old.app_version,
      'was_authenticated', v_old.user_id is not null,
      'reported_at', v_old.created_at
    )
  );

  return v_old.reference_code;
end;
$function$;

revoke all on function public.admin_list_system_reports(
  text, timestamptz, timestamptz, text, integer, integer
) from public, anon;
grant execute on function public.admin_list_system_reports(
  text, timestamptz, timestamptz, text, integer, integer
) to authenticated;

revoke all on function public.admin_delete_system_report(uuid, text) from public, anon;
grant execute on function public.admin_delete_system_report(uuid, text) to authenticated;

comment on function public.admin_list_system_reports(
  text, timestamptz, timestamptz, text, integer, integer
) is
  'Lists private.system_reports for admins holding system.reports.read. Read-only; never alters the v13 canonical table.';
comment on function public.admin_delete_system_report(uuid, text) is
  'Manually deletes one system report. platform_admin only, reason required, audited as SystemReport without reporter PII. No automatic retention.';
