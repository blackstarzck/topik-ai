-- down: 정책 "단일 설정 + 변경 이력" 전환 되돌리기.
-- 신 시그니처와 history/search RPC를 제거하고, 20260708100000의 구
-- admin_save_pdf_quota_policy(uuid,...,boolean,...) 원문을 복원한다.
-- 주의: up의 비활성 행 정리(DML)는 되돌릴 수 없다.

drop function if exists public.admin_save_pdf_quota_policy(integer, text, text, text, timestamptz);
drop function if exists public.get_admin_pdf_quota_policy_history(integer, integer);
drop function if exists public.search_admin_pdf_quota_reset_users(text, integer, integer);

create or replace function public.admin_save_pdf_quota_policy(
  p_policy_id uuid,
  p_limit_count integer,
  p_period_unit text,
  p_period_timezone text,
  p_is_active boolean,
  p_reason text
)
returns uuid
language plpgsql
security definer
set search_path to 'pg_catalog', 'public'
as $function$
declare
  caller_id uuid := auth.uid();
  v_reason text := nullif(btrim(coalesce(p_reason, '')), '');
  v_timezone text := nullif(btrim(coalesce(p_period_timezone, '')), '');
  v_old public.pdf_export_quota_policies%rowtype;
  v_id uuid;
  v_diff jsonb := '{}'::jsonb;
begin
  if caller_id is null then raise exception 'unauthenticated'; end if;
  if not private.is_admin(caller_id) then raise exception 'forbidden: admin required'; end if;
  if not public.admin_has_permission(caller_id, 'operation.pdf-quota.manage') then
    raise exception 'forbidden: missing permission operation.pdf-quota.manage';
  end if;
  if v_reason is null then raise exception 'reason required'; end if;
  if coalesce(p_limit_count, 0) < 1 then
    raise exception 'limit_count must be >= 1';
  end if;
  if p_period_unit is null or p_period_unit not in ('day', 'week', 'month') then
    raise exception 'period_unit must be one of day/week/month';
  end if;
  if v_timezone is null then raise exception 'period_timezone required'; end if;
  if not exists (select 1 from pg_timezone_names z where z.name = v_timezone) then
    raise exception 'unknown period_timezone: %', v_timezone;
  end if;
  if p_is_active is null then raise exception 'is_active required'; end if;

  if p_policy_id is null then
    if p_is_active and exists (
      select 1 from public.pdf_export_quota_policies
       where subject_scope = 'user' and resource_scope = 'problem' and is_active
    ) then
      raise exception 'active policy already exists: deactivate it first or edit it in place';
    end if;

    insert into public.pdf_export_quota_policies (
      subject_scope, resource_scope, period_unit, period_timezone,
      limit_count, is_active
    ) values (
      'user', 'problem', p_period_unit, v_timezone,
      p_limit_count, p_is_active
    )
    returning pdf_export_quota_policies.id into v_id;

    v_diff := jsonb_build_object(
      'limit_count', jsonb_build_object('from', null, 'to', p_limit_count),
      'period_unit', jsonb_build_object('from', null, 'to', p_period_unit),
      'period_timezone', jsonb_build_object('from', null, 'to', v_timezone),
      'is_active', jsonb_build_object('from', null, 'to', p_is_active)
    );
  else
    select * into v_old
      from public.pdf_export_quota_policies
     where pdf_export_quota_policies.id = p_policy_id
     for update;
    if not found then raise exception 'unknown policy id: %', p_policy_id; end if;
    v_id := v_old.id;

    if p_is_active and exists (
      select 1 from public.pdf_export_quota_policies
       where subject_scope = 'user' and resource_scope = 'problem'
         and is_active and pdf_export_quota_policies.id <> v_id
    ) then
      raise exception 'another active policy already exists: only one active policy is allowed';
    end if;

    if v_old.limit_count is distinct from p_limit_count then
      v_diff := v_diff || jsonb_build_object(
        'limit_count', jsonb_build_object('from', v_old.limit_count, 'to', p_limit_count));
    end if;
    if v_old.period_unit is distinct from p_period_unit then
      v_diff := v_diff || jsonb_build_object(
        'period_unit', jsonb_build_object('from', v_old.period_unit, 'to', p_period_unit));
    end if;
    if v_old.period_timezone is distinct from v_timezone then
      v_diff := v_diff || jsonb_build_object(
        'period_timezone', jsonb_build_object('from', v_old.period_timezone, 'to', v_timezone));
    end if;
    if v_old.is_active is distinct from p_is_active then
      v_diff := v_diff || jsonb_build_object(
        'is_active', jsonb_build_object('from', v_old.is_active, 'to', p_is_active));
    end if;

    update public.pdf_export_quota_policies
       set period_unit = p_period_unit,
           period_timezone = v_timezone,
           limit_count = p_limit_count,
           is_active = p_is_active,
           updated_at = now()
     where pdf_export_quota_policies.id = v_id;
  end if;

  insert into public.admin_audit_logs (admin_user_id, action, target_table, target_id, diff, payload)
  values (
    caller_id,
    'pdf_quota_policy_saved',
    'PdfQuotaPolicy',
    v_id::text,
    v_diff,
    jsonb_build_object(
      'reason', v_reason,
      'limit_count', p_limit_count,
      'period_unit', p_period_unit,
      'period_timezone', v_timezone,
      'is_active', p_is_active,
      'period_unit_changed', (v_old.id is not null and v_old.period_unit is distinct from p_period_unit)
    )
  );

  return v_id;
end;
$function$;

revoke all on function public.admin_save_pdf_quota_policy(uuid, integer, text, text, boolean, text) from public;
grant execute on function public.admin_save_pdf_quota_policy(uuid, integer, text, text, boolean, text) to authenticated;

comment on function public.admin_save_pdf_quota_policy(uuid, integer, text, text, boolean, text) is
  'Operation > PDF 내보내기 제한: 정책 저장. 단일 활성 정책(user+problem)을 강제하고 PdfQuotaPolicy 감사 로그를 남긴다.';

notify pgrst, 'reload schema';
