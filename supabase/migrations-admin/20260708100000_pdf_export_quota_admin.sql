-- Operation > PDF 내보내기 제한 관리 RPC 4종.
-- v13 소유 pdf_export_quota_* 4테이블의 DDL은 변경하지 않고, admin 읽기/쓰기 경로만 추가한다.
-- (소유권 경계: docs/architecture/shared-supabase-schema-ownership.md 2026-07-07 기록)
--   * 읽기 2종: usages/resets RLS가 platform_admin 전용이라 일반 admin은 direct select가
--     막히므로 SECURITY DEFINER read RPC로 우회한다 (admin_list_audit_logs 선례).
--   * 쓰기 2종: 정책 저장 + 리셋 생성. reason 필수, admin_audit_logs 기록.
--   * created_by FK는 v13 profiles를 가리키고 admin 계정은 profiles 행이 없으므로
--     (admin_accounts 물리 분리) profiles에 없는 호출자는 null로 저장하고
--     실제 처리자는 admin_audit_logs로 추적한다.
--   * 리셋 의미론: v13 claim RPC는 같은 주기(period-local) 안의 리셋만 인정한다.
--     다음 주기 선예약 불가. group/global 리셋 대상은 생성 시점 스냅샷으로
--     pdf_export_quota_reset_targets에 concrete user_id를 실체화한다.
-- down: supabase/migrations-admin/down/20260708100000_pdf_export_quota_admin.sql

drop function if exists public.get_admin_pdf_quota_policies();

create or replace function public.get_admin_pdf_quota_policies()
returns table (
  id uuid,
  subject_scope text,
  resource_scope text,
  period_unit text,
  period_timezone text,
  limit_count integer,
  priority integer,
  is_active boolean,
  created_at text,
  updated_at timestamptz,
  updated_at_display text
)
language plpgsql
stable
security definer
set search_path to 'pg_catalog', 'public'
as $function$
declare
  caller_id uuid := auth.uid();
begin
  if caller_id is null then raise exception 'unauthenticated'; end if;
  if not private.is_admin(caller_id) then raise exception 'forbidden: admin required'; end if;
  if not public.admin_has_permission(caller_id, 'operation.pdf-quota.manage') then
    raise exception 'forbidden: missing permission operation.pdf-quota.manage';
  end if;

  return query
    select p.id, p.subject_scope, p.resource_scope, p.period_unit,
           p.period_timezone, p.limit_count, p.priority, p.is_active,
           to_char(p.created_at at time zone 'Asia/Seoul', 'YYYY-MM-DD HH24:MI') as created_at,
           p.updated_at,
           to_char(p.updated_at at time zone 'Asia/Seoul', 'YYYY-MM-DD HH24:MI') as updated_at_display
      from public.pdf_export_quota_policies p
     order by p.is_active desc, p.priority asc, p.created_at desc;
end;
$function$;

drop function if exists public.get_admin_pdf_quota_resets(integer, integer, text);

create or replace function public.get_admin_pdf_quota_resets(
  p_page integer default 1,
  p_page_size integer default 20,
  p_scope text default null
)
returns table (
  id uuid,
  reset_scope text,
  problem_id uuid,
  reason text,
  actor_email text,
  actor_name text,
  target_count bigint,
  created_at text,
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
  v_scope text := nullif(btrim(coalesce(p_scope, '')), '');
begin
  if caller_id is null then raise exception 'unauthenticated'; end if;
  if not private.is_admin(caller_id) then raise exception 'forbidden: admin required'; end if;
  if not public.admin_has_permission(caller_id, 'operation.pdf-quota.manage') then
    raise exception 'forbidden: missing permission operation.pdf-quota.manage';
  end if;
  if v_scope is not null and v_scope not in ('user', 'group', 'global') then
    raise exception 'invalid scope filter: %', v_scope;
  end if;

  return query
    select r.id,
           r.reset_scope,
           r.problem_id,
           r.reason,
           aa.email as actor_email,
           aa.display_name as actor_name,
           (select count(*)
              from public.pdf_export_quota_reset_targets t
             where t.reset_id = r.id) as target_count,
           to_char(r.created_at at time zone 'Asia/Seoul', 'YYYY-MM-DD HH24:MI') as created_at,
           count(*) over () as total_count
      from public.pdf_export_quota_resets r
      left join lateral (
        select a.admin_user_id
          from public.admin_audit_logs a
         where a.action = 'pdf_quota_reset_created'
           and a.target_table = 'PdfQuotaReset'
           and a.target_id = r.id::text
         order by a.created_at asc
         limit 1
      ) al on true
      left join public.admin_accounts aa on aa.id = al.admin_user_id
     where v_scope is null or r.reset_scope = v_scope
     order by r.created_at desc, r.id desc
     limit v_page_size offset (v_page - 1) * v_page_size;
end;
$function$;

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
    -- 단일 활성 정책 원칙: 활성 정책이 이미 있으면 새 활성 정책 생성을 거부한다.
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

create or replace function public.admin_create_pdf_quota_reset(
  p_scope text,
  p_user_id uuid default null,
  p_group_code text default null,
  p_problem_id uuid default null,
  p_reason text default null
)
returns jsonb
language plpgsql
security definer
set search_path to 'pg_catalog', 'public'
as $function$
declare
  caller_id uuid := auth.uid();
  v_scope text := nullif(btrim(coalesce(p_scope, '')), '');
  v_group_code text := nullif(btrim(coalesce(p_group_code, '')), '');
  v_reason text := nullif(btrim(coalesce(p_reason, '')), '');
  v_created_by uuid;
  v_reset_id uuid;
  v_target_count bigint := 0;
begin
  if caller_id is null then raise exception 'unauthenticated'; end if;
  if not private.is_admin(caller_id) then raise exception 'forbidden: admin required'; end if;
  if not public.admin_has_permission(caller_id, 'operation.pdf-quota.manage') then
    raise exception 'forbidden: missing permission operation.pdf-quota.manage';
  end if;
  if v_reason is null then raise exception 'reason required'; end if;
  if v_scope is null or v_scope not in ('user', 'group', 'global') then
    raise exception 'scope must be one of user/group/global';
  end if;
  if p_problem_id is not null and not exists (
    select 1 from public.problems where problems.id = p_problem_id
  ) then
    raise exception 'unknown problem id: %', p_problem_id;
  end if;
  if v_scope = 'user' then
    if p_user_id is null then raise exception 'user_id required for user scope'; end if;
    if not exists (select 1 from public.profiles where profiles.id = p_user_id) then
      raise exception 'unknown user id: %', p_user_id;
    end if;
  elsif v_scope = 'group' then
    if v_group_code is null then raise exception 'group_code required for group scope'; end if;
    if not exists (select 1 from public.institution_codes where code = v_group_code) then
      raise exception 'unknown institution code: %', v_group_code;
    end if;
  end if;

  -- admin 계정은 profiles 행이 없어 created_by FK(profiles)를 채울 수 없다.
  select case
           when exists (select 1 from public.profiles where profiles.id = caller_id)
             then caller_id
           else null
         end
    into v_created_by;

  insert into public.pdf_export_quota_resets (reset_scope, problem_id, reason, created_by)
  values (v_scope, p_problem_id, v_reason, v_created_by)
  returning pdf_export_quota_resets.id into v_reset_id;

  if v_scope = 'user' then
    insert into public.pdf_export_quota_reset_targets (reset_id, user_id)
    values (v_reset_id, p_user_id);
    v_target_count := 1;
  elsif v_scope = 'group' then
    insert into public.pdf_export_quota_reset_targets (reset_id, user_id)
    select v_reset_id, pr.id
      from public.profiles pr
     where pr.affiliation_code = v_group_code
       and coalesce(pr.status, 'active') <> 'deleted';
    get diagnostics v_target_count = row_count;
    if v_target_count = 0 then
      raise exception 'institution code % has no members to reset', v_group_code;
    end if;
  elsif v_scope = 'global' then
    insert into public.pdf_export_quota_reset_targets (reset_id, user_id)
    select v_reset_id, pr.id
      from public.profiles pr
     where coalesce(pr.status, 'active') <> 'deleted';
    get diagnostics v_target_count = row_count;
    if v_target_count = 0 then
      raise exception 'global reset has no members to reset';
    end if;
  end if;

  insert into public.admin_audit_logs (admin_user_id, action, target_table, target_id, diff, payload)
  values (
    caller_id,
    'pdf_quota_reset_created',
    'PdfQuotaReset',
    v_reset_id::text,
    jsonb_build_object('reset', jsonb_build_object('from', null, 'to', v_scope)),
    jsonb_build_object(
      'reason', v_reason,
      'scope', v_scope,
      'user_id', p_user_id,
      'group_code', v_group_code,
      'problem_id', p_problem_id,
      'target_count', v_target_count,
      'period_semantics', 'period_local_snapshot'
    )
  );

  return jsonb_build_object('resetId', v_reset_id, 'targetCount', v_target_count);
end;
$function$;

revoke all on function public.get_admin_pdf_quota_policies() from public;
revoke all on function public.get_admin_pdf_quota_resets(integer, integer, text) from public;
revoke all on function public.admin_save_pdf_quota_policy(uuid, integer, text, text, boolean, text) from public;
revoke all on function public.admin_create_pdf_quota_reset(text, uuid, text, uuid, text) from public;

grant execute on function public.get_admin_pdf_quota_policies() to authenticated;
grant execute on function public.get_admin_pdf_quota_resets(integer, integer, text) to authenticated;
grant execute on function public.admin_save_pdf_quota_policy(uuid, integer, text, text, boolean, text) to authenticated;
grant execute on function public.admin_create_pdf_quota_reset(text, uuid, text, uuid, text) to authenticated;

comment on function public.get_admin_pdf_quota_policies() is
  'Operation > PDF 내보내기 제한: 정책 목록 read RPC. usages/resets RLS의 platform_admin 제한을 우회해 operation.pdf-quota.manage 권한자에게 제공한다.';
comment on function public.get_admin_pdf_quota_resets(integer, integer, text) is
  'Operation > PDF 내보내기 제한: 초기화 이력 read RPC. target_count 집계와 admin_audit_logs 기반 처리자 정보를 포함한다.';
comment on function public.admin_save_pdf_quota_policy(uuid, integer, text, text, boolean, text) is
  'Operation > PDF 내보내기 제한: 정책 저장. 단일 활성 정책(user+problem)을 강제하고 PdfQuotaPolicy 감사 로그를 남긴다.';
comment on function public.admin_create_pdf_quota_reset(text, uuid, text, uuid, text) is
  'Operation > PDF 내보내기 제한: 개인/기관 코드/전체 초기화 생성. group/global은 생성 시점 스냅샷으로 대상을 실체화하며 PdfQuotaReset 감사 로그를 남긴다.';
