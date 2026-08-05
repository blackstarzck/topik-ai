-- down: 대시보드 요약·백업 요약 RPC 의 권한 검사를 구형(private.is_admin)으로 되돌린다.
-- 주의: 원복은 "관리자면 전부 허용"으로 되돌아가는 보안 완화다 — 운영 실행은 별도 승인 후에만.

begin;

do $revert_admin_read_permission$
declare
  v_guard_old constant text := $anchor$  if not private.is_admin(caller_id) then
    raise exception 'forbidden: admin required';
  end if;$anchor$;
  v_targets constant jsonb := jsonb_build_array(
    jsonb_build_object(
      'identity', 'public.get_admin_dashboard_stats()',
      'key', 'dashboard.read',
      'contract', jsonb_build_array($c$v_today_start$c$, $c$#variable_conflict use_column$c$)
    ),
    jsonb_build_object(
      'identity', 'public.get_admin_backup_summary()',
      'key', 'system.backups.read',
      'contract', jsonb_build_array($c$recent_terminal_count$c$, $c$last_report_received_at$c$)
    )
  );
  v_target jsonb;
  v_identity regprocedure;
  v_definition text;
  v_guard_new text;
  v_literal text;
begin
  for v_target in select value from jsonb_array_elements(v_targets)
  loop
    v_identity := to_regprocedure(v_target->>'identity');
    if v_identity is null then
      raise exception 'admin read revert: % is missing', v_target->>'identity';
    end if;

    v_guard_new := format(
      $tpl$  if not public.admin_has_permission(caller_id, %L) then
    raise exception 'forbidden: missing permission %s';
  end if;$tpl$,
      v_target->>'key',
      v_target->>'key'
    );

    select pg_get_functiondef(v_identity) into v_definition;

    if (length(v_definition) - length(replace(v_definition, v_guard_new, ''))) / length(v_guard_new) <> 1 then
      raise exception 'admin read revert: expected exactly one permission guard in %', v_target->>'identity';
    end if;
    if position('private.is_admin' in v_definition) > 0 then
      raise exception 'admin read revert: % already carries the legacy check', v_target->>'identity';
    end if;
    for v_literal in select jsonb_array_elements_text(v_target->'contract')
    loop
      if position(v_literal in v_definition) = 0 then
        raise exception 'admin read revert: contract literal % is missing in %', v_literal, v_target->>'identity';
      end if;
    end loop;

    v_definition := replace(v_definition, v_guard_new, v_guard_old);

    if (length(v_definition) - length(replace(v_definition, v_guard_old, ''))) / length(v_guard_old) <> 1
       or position('admin_has_permission' in v_definition) > 0 then
      raise exception 'admin read revert: rewrite incomplete for %', v_target->>'identity';
    end if;
    for v_literal in select jsonb_array_elements_text(v_target->'contract')
    loop
      if position(v_literal in v_definition) = 0 then
        raise exception 'admin read revert: contract literal % lost during rewrite of %', v_literal, v_target->>'identity';
      end if;
    end loop;

    execute v_definition;
  end loop;
end
$revert_admin_read_permission$;

revoke all on function public.get_admin_dashboard_stats() from public, anon;
grant execute on function public.get_admin_dashboard_stats() to authenticated;

revoke all on function public.get_admin_backup_summary() from public, anon;
grant execute on function public.get_admin_backup_summary() to authenticated;

-- 주석 원문 복원(각 함수의 마이그레이션 이전 텍스트 그대로).
comment on function public.get_admin_dashboard_stats() is
  '대시보드 요약/큐/경고 실데이터 집계. is_admin 전용, 집계 수치만 반환(PII 없음). 오늘=KST 자정, 실패/추세 창=최근 7일 vs 직전 7일.';

comment on function public.get_admin_backup_summary() is
  'System > 백업 관리 요약 카드. 최신 실행 상태, 최근 7일 성공률, 마지막 복원 점검, 마지막 리포트 수신 시각을 반환한다. is_admin 전용 read-only.';

do $verify_admin_read_revert$
declare
  v_guard_old constant text := $anchor$  if not private.is_admin(caller_id) then
    raise exception 'forbidden: admin required';
  end if;$anchor$;
  v_identities constant text[] := array[
    'public.get_admin_dashboard_stats()',
    'public.get_admin_backup_summary()'
  ];
  v_name text;
  v_identity regprocedure;
  v_definition text;
begin
  foreach v_name in array v_identities
  loop
    v_identity := to_regprocedure(v_name);
    if v_identity is null then
      raise exception 'admin read revert verify: % is missing', v_name;
    end if;

    select pg_get_functiondef(v_identity) into v_definition;

    if (length(v_definition) - length(replace(v_definition, v_guard_old, ''))) / length(v_guard_old) <> 1 then
      raise exception 'admin read revert verify: legacy guard is not in place for %', v_name;
    end if;
    if position('admin_has_permission' in v_definition) > 0 then
      raise exception 'admin read revert verify: permission check survived in %', v_name;
    end if;
    if position('is_admin 전용' in coalesce(obj_description(v_identity, 'pg_proc'), '')) = 0 then
      raise exception 'admin read revert verify: comment was not restored for %', v_name;
    end if;
  end loop;
end
$verify_admin_read_revert$;

commit;
