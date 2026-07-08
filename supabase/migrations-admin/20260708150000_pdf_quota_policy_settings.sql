-- Operation > PDF 내보내기 제한: 정책 관리를 "다중 행 + 활성/비활성 토글"에서
-- "단일 설정 + 변경 이력" 모델로 전환한다 (오너 결정 2026-07-08).
--   * 구 admin_save_pdf_quota_policy(uuid,...,boolean,...)는 다른 활성 행이 있으면
--     raise하는 방식이라 정책 교체가 "전부 비활성화 → 활성화" 2단계가 되고,
--     그 사이 무정책 공백(전 사용자 내보내기 500)이 생겼다. 구 시그니처는
--     명시적으로 drop한다 (create or replace는 시그니처가 다르면 오버로드로 남음).
--   * 신 RPC는 항상 "현재 정책 1행"을 갱신한다: 활성 행이 없으면 최신 행을
--     활성화하고, 행이 없으면 생성한다(자기치유). 비활성화 단독 경로는 없다.
--   * p_limit_count = 0 은 의도적 '내보내기 중단' 스위치다. v13 claim은
--     used >= limit 비교라 0이면 즉시 429(정상 안내)로 동작한다.
--   * 변경 이력은 admin_audit_logs 기반 read RPC로 제공한다. 2026-06-18
--     diff/payload platform_admin 게이팅의 범위 예외: 쿼터 수치(한도/주기/시간대)는
--     PII·정책 본문이 아니고 reason은 이미 전체 admin 공개라, 이 action에 한해
--     화이트리스트 필드만 pdf-quota 권한자에게 반환한다.
--   * DML 정리: usages가 참조하지 않는 비활성 행만 삭제(FK NO ACTION 위반 방지).
-- down: supabase/migrations-admin/down/20260708150000_pdf_quota_policy_settings.sql

drop function if exists public.admin_save_pdf_quota_policy(uuid, integer, text, text, boolean, text);

create or replace function public.admin_save_pdf_quota_policy(
  p_limit_count integer,
  p_period_unit text,
  p_period_timezone text,
  p_reason text,
  p_expected_updated_at timestamptz default null
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
  v_deactivated uuid[] := '{}';
begin
  if caller_id is null then raise exception 'unauthenticated'; end if;
  if not private.is_admin(caller_id) then raise exception 'forbidden: admin required'; end if;
  if not public.admin_has_permission(caller_id, 'operation.pdf-quota.manage') then
    raise exception 'forbidden: missing permission operation.pdf-quota.manage';
  end if;
  if v_reason is null then raise exception 'reason required'; end if;
  if coalesce(p_limit_count, -1) < 0 then
    raise exception 'limit_count must be >= 0 (0 pauses PDF export for everyone)';
  end if;
  if p_period_unit is null or p_period_unit not in ('day', 'week', 'month') then
    raise exception 'period_unit must be one of day/week/month';
  end if;
  if v_timezone is null then raise exception 'period_timezone required'; end if;
  if not exists (select 1 from pg_timezone_names z where z.name = v_timezone) then
    raise exception 'unknown period_timezone: %', v_timezone;
  end if;

  -- 0행/전비활성 상태에서 동시 저장이 활성 2행을 만드는 레이스를 차단한다.
  perform pg_advisory_xact_lock(hashtextextended('admin_save_pdf_quota_policy', 0));

  -- 현재 정책 행 선택: v13 claim과 동일한 정렬(priority asc, created_at desc).
  select * into v_old
    from public.pdf_export_quota_policies
   where is_active and subject_scope = 'user' and resource_scope = 'problem'
   order by priority asc, created_at desc
   limit 1
   for update;

  if not found then
    -- 자기치유: 활성 행이 없으면 최신 행을 되살린다.
    select * into v_old
      from public.pdf_export_quota_policies
     where subject_scope = 'user' and resource_scope = 'problem'
     order by priority asc, created_at desc
     limit 1
     for update;
  end if;

  if v_old.id is not null then
    if p_expected_updated_at is not null
       and v_old.updated_at is distinct from p_expected_updated_at then
      raise exception 'policy was changed by another admin: reload and retry';
    end if;

    update public.pdf_export_quota_policies
       set period_unit = p_period_unit,
           period_timezone = v_timezone,
           limit_count = p_limit_count,
           is_active = true,
           updated_at = now()
     where id = v_old.id;
    v_id := v_old.id;
  else
    insert into public.pdf_export_quota_policies (
      subject_scope, resource_scope, period_unit, period_timezone,
      limit_count, is_active
    ) values (
      'user', 'problem', p_period_unit, v_timezone, p_limit_count, true
    )
    returning id into v_id;
  end if;

  -- 자기치유: 드리프트로 남은 다른 활성 행을 같은 트랜잭션에서 일괄 비활성.
  with deactivated as (
    update public.pdf_export_quota_policies
       set is_active = false,
           updated_at = now()
     where is_active and id <> v_id
    returning id
  )
  select coalesce(array_agg(id), '{}') into v_deactivated from deactivated;

  -- 이력 렌더 안정성을 위해 3필드 from/to를 항상 기록한다(변경분만 기록 방식 폐기).
  insert into public.admin_audit_logs (admin_user_id, action, target_table, target_id, diff, payload)
  values (
    caller_id,
    'pdf_quota_policy_saved',
    'PdfQuotaPolicy',
    v_id::text,
    jsonb_build_object(
      'limit_count', jsonb_build_object('from', v_old.limit_count, 'to', p_limit_count),
      'period_unit', jsonb_build_object('from', v_old.period_unit, 'to', p_period_unit),
      'period_timezone', jsonb_build_object('from', v_old.period_timezone, 'to', v_timezone)
    ),
    jsonb_build_object(
      'reason', v_reason,
      'limit_count', p_limit_count,
      'period_unit', p_period_unit,
      'period_timezone', v_timezone,
      'period_unit_changed', (v_old.id is not null and v_old.period_unit is distinct from p_period_unit),
      'export_paused', (p_limit_count = 0),
      'deactivated_ids', to_jsonb(v_deactivated)
    )
  );

  return v_id;
end;
$function$;

drop function if exists public.get_admin_pdf_quota_policy_history(integer, integer);

create or replace function public.get_admin_pdf_quota_policy_history(
  p_page integer default 1,
  p_page_size integer default 20
)
returns table (
  id text,
  created_at text,
  actor_name text,
  actor_email text,
  reason text,
  limit_from integer,
  limit_to integer,
  period_unit_from text,
  period_unit_to text,
  period_timezone_from text,
  period_timezone_to text,
  result_limit integer,
  result_period_unit text,
  total_count bigint
)
language plpgsql
stable
security definer
set search_path to 'pg_catalog', 'public'
as $function$
declare
  caller_id uuid := auth.uid();
  v_page integer := greatest(coalesce(p_page, 1), 1);
  v_page_size integer := least(greatest(coalesce(p_page_size, 20), 1), 100);
begin
  if caller_id is null then raise exception 'unauthenticated'; end if;
  if not private.is_admin(caller_id) then raise exception 'forbidden: admin required'; end if;
  if not public.admin_has_permission(caller_id, 'operation.pdf-quota.manage') then
    raise exception 'forbidden: missing permission operation.pdf-quota.manage';
  end if;

  -- 구형 감사 행(변경 키만 기록, 생성 이벤트 from=null)도 null-safe로 반환한다.
  return query
    select a.id::text as id,
           to_char(a.created_at at time zone 'Asia/Seoul', 'YYYY-MM-DD HH24:MI') as created_at,
           aa.display_name as actor_name,
           aa.email as actor_email,
           a.payload->>'reason' as reason,
           (a.diff->'limit_count'->>'from')::integer as limit_from,
           (a.diff->'limit_count'->>'to')::integer as limit_to,
           a.diff->'period_unit'->>'from' as period_unit_from,
           a.diff->'period_unit'->>'to' as period_unit_to,
           a.diff->'period_timezone'->>'from' as period_timezone_from,
           a.diff->'period_timezone'->>'to' as period_timezone_to,
           (a.payload->>'limit_count')::integer as result_limit,
           a.payload->>'period_unit' as result_period_unit,
           count(*) over () as total_count
      from public.admin_audit_logs a
      left join public.admin_accounts aa on aa.id = a.admin_user_id
     where a.action = 'pdf_quota_policy_saved'
       and a.target_table = 'PdfQuotaPolicy'
     order by a.created_at desc, a.id desc
     limit v_page_size offset (v_page - 1) * v_page_size;
end;
$function$;

-- FK-safe 정리: usages가 참조하지 않는 비활성 행만 삭제한다.
-- (pdf_export_quota_usages.policy_id FK는 ON DELETE 절이 없어 NO ACTION)
delete from public.pdf_export_quota_policies p
 where not p.is_active
   and not exists (
     select 1 from public.pdf_export_quota_usages u where u.policy_id = p.id
   );

revoke all on function public.admin_save_pdf_quota_policy(integer, text, text, text, timestamptz) from public;
revoke all on function public.get_admin_pdf_quota_policy_history(integer, integer) from public;

grant execute on function public.admin_save_pdf_quota_policy(integer, text, text, text, timestamptz) to authenticated;
grant execute on function public.get_admin_pdf_quota_policy_history(integer, integer) to authenticated;

comment on function public.admin_save_pdf_quota_policy(integer, text, text, text, timestamptz) is
  'Operation > PDF 내보내기 제한: 단일 정책 설정 저장. 항상 현재 정책 1행을 갱신/복구하며(자기치유), 한도 0은 의도적 내보내기 중단이다. p_expected_updated_at으로 동시 편집을 감지한다.';
comment on function public.get_admin_pdf_quota_policy_history(integer, integer) is
  'Operation > PDF 내보내기 제한: 정책 변경 이력. admin_audit_logs(pdf_quota_policy_saved)에서 감사 id, KST 시각, 비민감 화이트리스트 필드만 pdf-quota 권한자에게 반환한다(2026-06-18 게이팅의 범위 예외).';

notify pgrst, 'reload schema';
