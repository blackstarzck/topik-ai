-- 감사 로그 민감정보(diff/payload) 노출 보호를 복원하고, 우회 경로인 원본 테이블 접근까지 닫는다.
--
-- 배경: 오너 결정(2026-06-18)으로 `admin_audit_logs.diff`/`payload` 는 회원 PII·정책 본문·
--   환불/정지 사유를 담을 수 있어 **platform_admin 에게만** 노출하기로 했고,
--   20260618095000 이 조회 RPC 에 그 게이트를 넣었다. 그런데 이후 두 번의 재정의가 게이트를
--   드롭했다 — 20260623230000(actor 를 admin_accounts 로 재지향)과 현재 정의
--   20260720104000(User/Users target projection). 둘 다 v_is_platform 선언이 없고
--   diff/payload 를 그대로 반환하며 payload 키워드 검색도 무조건 허용한다.
--   결과: 활성 content_admin 이 모든 감사 행의 민감정보를 조회할 수 있는 상태로 되돌아갔다.
--
-- 🚨 RPC 만 고치면 닫히지 않는다. 원본 테이블에 두 정책이 열려 있다:
--   * admin_audit_logs_admin_select — private.is_admin, 행·컬럼 제한 없음
--     → PostgREST 로 테이블을 직접 조회하면 RPC 마스킹을 그대로 우회한다.
--   * admin_audit_logs_admin_insert — private.is_admin + admin_user_id = auth.uid()
--     → 관리자가 자기 이름으로 임의의 감사 기록을 만들 수 있다(감사 무결성 훼손).
--   RPC 표면과 테이블 표면은 독립된 두 게이트다(PR #80 에서 학습 원본에 같은 교훈).
--
-- 조치:
--   1) 조회 RPC 게이트 복원 — 라이브 정의를 읽어 세 지점만 치환(전문 재정의 금지: 이후
--      수술이 심은 User/Users projection·admin_accounts actor 조인을 되덮으면 안 된다).
--   2) 원본 SELECT 정책을 platform_admin 전용으로 축소 — 일반 관리자의 목록 조회는 definer
--      RPC 경유만 남는다. RPC 는 postgres 소유 + rolbypassrls 라 RLS 를 우회하므로 화면
--      기능은 유지된다(같은 구조를 PR #80 에서 검증했다).
--   3) 직접 INSERT 정책 삭제 — 모든 감사 기록은 definer RPC 가 쓴다. 직접 INSERT 경로는
--      기능적으로 불필요하고 위조 수단일 뿐이다.
--
-- `reason`(payload->>'reason')은 전체 관리자에게 계속 노출한다(2026-06-18 결정 유지).
--   사유에 PII 를 넣지 않는 것이 기존 계약이다.
-- down: supabase/migrations-admin/down/20260805160000_audit_logs_sensitive_data_gate_restore.sql

begin;

do $restore_audit_gate$
declare
  v_identity constant text :=
    'public.admin_list_audit_logs(text,text,text,timestamptz,timestamptz,integer,integer)';
  -- 앵커 3종. 라이브 본문과 바이트가 일치해야 하며, 각 1회 발생을 단정한 뒤 치환한다.
  v_declare_old constant text := $anchor$declare
  caller_id uuid := auth.uid();$anchor$;
  v_declare_new constant text := $anchor$declare
  caller_id uuid := auth.uid();
  v_is_platform boolean;$anchor$;
  v_guard_old constant text :=
    $anchor$  if not private.is_admin(caller_id) then raise exception 'forbidden: admin required'; end if;$anchor$;
  v_guard_new constant text :=
    $anchor$  if not private.is_admin(caller_id) then raise exception 'forbidden: admin required'; end if;
  v_is_platform := private.is_platform_admin(caller_id);$anchor$;
  v_keyword_old constant text := $anchor$        or l.payload::text ilike '%' || v_keyword || '%'$anchor$;
  v_keyword_new constant text := $anchor$        or (v_is_platform and l.payload::text ilike '%' || v_keyword || '%')$anchor$;
  v_select_old constant text := $anchor$    counted.diff,
    counted.payload,$anchor$;
  v_select_new constant text := $anchor$    case when v_is_platform then counted.diff else null end,
    case when v_is_platform then counted.payload else null end,$anchor$;
  v_proc regprocedure;
  v_definition text;
  v_pairs constant jsonb := jsonb_build_array(
    jsonb_build_object('old', v_declare_old, 'new', v_declare_new, 'label', 'declare'),
    jsonb_build_object('old', v_guard_old, 'new', v_guard_new, 'label', 'guard'),
    jsonb_build_object('old', v_keyword_old, 'new', v_keyword_new, 'label', 'keyword-search'),
    jsonb_build_object('old', v_select_old, 'new', v_select_new, 'label', 'select-list')
  );
  v_pair jsonb;
  v_old text;
  v_new text;
begin
  if to_regprocedure('private.is_platform_admin(uuid)') is null then
    raise exception 'audit gate restore: private.is_platform_admin(uuid) is missing';
  end if;

  v_proc := to_regprocedure(v_identity);
  if v_proc is null then
    raise exception 'audit gate restore: % is missing', v_identity;
  end if;

  select pg_get_functiondef(v_proc) into v_definition;

  -- 사전 단정: 게이트가 없는 상태여야 한다(이미 복원됐으면 재실행이 아니라 중단).
  if position('v_is_platform' in v_definition) > 0 then
    raise exception 'audit gate restore: % already carries the platform gate', v_identity;
  end if;
  -- 이후 수술이 심은 계약이 살아 있어야 한다(전문 재정의로 되덮지 않는다는 증거).
  if position('lower(counted.target_table) in (''user'', ''users'')' in v_definition) = 0
     or position('left join public.admin_accounts a on a.id = l.admin_user_id' in v_definition) = 0 then
    raise exception 'audit gate restore: latest projection/actor contract is missing in %', v_identity;
  end if;

  for v_pair in select value from jsonb_array_elements(v_pairs)
  loop
    v_old := v_pair->>'old';
    v_new := v_pair->>'new';
    if (length(v_definition) - length(replace(v_definition, v_old, ''))) / length(v_old) <> 1 then
      raise exception 'audit gate restore: anchor % must occur exactly once in %',
        v_pair->>'label', v_identity;
    end if;
    v_definition := replace(v_definition, v_old, v_new);
  end loop;

  -- 사후 단정: 선언 1회 + 대입 1회 + 조건부 검색 1회 + 마스킹 2회.
  if (length(v_definition) - length(replace(v_definition, 'v_is_platform boolean;', ''))) / length('v_is_platform boolean;') <> 1
     or position('v_is_platform := private.is_platform_admin(caller_id);' in v_definition) = 0
     or position('(v_is_platform and l.payload::text ilike' in v_definition) = 0
     or (length(v_definition) - length(replace(v_definition, 'case when v_is_platform then counted.', '')))
        / length('case when v_is_platform then counted.') <> 2 then
    raise exception 'audit gate restore: rewrite incomplete for %', v_identity;
  end if;
  if position('lower(counted.target_table) in (''user'', ''users'')' in v_definition) = 0
     or position('left join public.admin_accounts a on a.id = l.admin_user_id' in v_definition) = 0 then
    raise exception 'audit gate restore: projection/actor contract lost during rewrite of %', v_identity;
  end if;

  execute v_definition;
end
$restore_audit_gate$;

revoke all on function public.admin_list_audit_logs(
  text, text, text, timestamptz, timestamptz, integer, integer
) from public, anon;
grant execute on function public.admin_list_audit_logs(
  text, text, text, timestamptz, timestamptz, integer, integer
) to authenticated;

comment on function public.admin_list_audit_logs(
  text, text, text, timestamptz, timestamptz, integer, integer
) is
  'System > 감사 로그 조회. definer RPC 이며 diff/payload 와 payload 키워드 검색은 platform_admin 에게만 허용한다(오너 결정 2026-06-18). 그 외 관리자는 diff/payload 를 NULL 로 받고 목록·필터·actor·reason 만 본다. '
  'Persisted User targets accept User/Users filters and are projected as Users for the admin UI contract. '
  '원본 테이블 직접 조회는 platform_admin 전용 정책으로 막혀 있으므로 일반 관리자의 유일한 조회 경로는 이 RPC 다.';

-- 원본 테이블 표면: 직접 조회를 platform_admin 으로 좁히고, 위조 가능한 직접 INSERT 를 없앤다.
drop policy if exists admin_audit_logs_admin_select on public.admin_audit_logs;
create policy admin_audit_logs_platform_select on public.admin_audit_logs
  for select to authenticated using (private.is_platform_admin((select auth.uid())));

drop policy if exists admin_audit_logs_admin_insert on public.admin_audit_logs;

comment on table public.admin_audit_logs is
  '관리자 조치 감사 원장(topik-ai admin 운영 도메인 소유). 쓰기는 SECURITY DEFINER RPC 단일 경로이며 직접 INSERT 정책은 두지 않는다(위조 방지, 2026-08-05). '
  '직접 SELECT 는 platform_admin 전용이고 그 외 관리자는 admin_list_audit_logs 로만 조회한다 — diff/payload 는 그 RPC 가 마스킹한다.';

-- 사후 검증: 두 표면이 모두 닫혔는지 라이브 상태로 확인한다.
do $verify_audit_gate$
declare
  v_proc regprocedure := to_regprocedure(
    'public.admin_list_audit_logs(text,text,text,timestamptz,timestamptz,integer,integer)'
  );
  v_definition text;
  v_select_qual text;
begin
  if v_proc is null then
    raise exception 'audit gate verify: read RPC is missing';
  end if;

  select pg_get_functiondef(v_proc) into v_definition;
  if position('v_is_platform := private.is_platform_admin(caller_id);' in v_definition) = 0
     or (length(v_definition) - length(replace(v_definition, 'case when v_is_platform then counted.', '')))
        / length('case when v_is_platform then counted.') <> 2
     or position('(v_is_platform and l.payload::text ilike' in v_definition) = 0 then
    raise exception 'audit gate verify: read RPC gate is not in place';
  end if;
  if has_function_privilege('anon', v_proc, 'execute') then
    raise exception 'audit gate verify: anon can still execute the read RPC';
  end if;

  -- 직접 조회 정책은 정확히 하나이고 platform_admin 기준이어야 한다.
  if (select count(*) from pg_policies
       where schemaname = 'public' and tablename = 'admin_audit_logs' and cmd = 'SELECT') <> 1 then
    raise exception 'audit gate verify: expected exactly one select policy on admin_audit_logs';
  end if;
  select p.qual into v_select_qual
  from pg_policies p
  where p.schemaname = 'public' and p.tablename = 'admin_audit_logs' and p.cmd = 'SELECT';
  if position('is_platform_admin' in coalesce(v_select_qual, '')) = 0 then
    raise exception 'audit gate verify: select policy is not platform_admin scoped: %', v_select_qual;
  end if;

  -- 쓰기 정책은 하나도 없어야 한다(definer RPC 단일 경로).
  if exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'admin_audit_logs'
      and cmd in ('INSERT', 'UPDATE', 'DELETE', 'ALL')
  ) then
    raise exception 'audit gate verify: a direct write policy still exists on admin_audit_logs';
  end if;

  -- 감사 기록을 쓰는 RPC 들이 RLS 를 우회하는지(정책 축소가 쓰기를 깨지 않는다는 증거).
  if exists (
    select 1
    from pg_proc pr
    join pg_namespace n on n.oid = pr.pronamespace
    join pg_roles r on r.oid = pr.proowner
    where n.nspname = 'public'
      and pr.proname in ('admin_list_audit_logs', 'admin_set_admin_role', 'admin_grant_permissions')
      and (not pr.prosecdef or not r.rolbypassrls)
  ) then
    raise exception 'audit gate verify: an admin RPC does not bypass RLS; closing the table would break it';
  end if;
end
$verify_audit_gate$;

commit;
