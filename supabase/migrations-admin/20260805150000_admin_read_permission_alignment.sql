-- 관리자 조회 RPC 2종의 권한 검사를 화면 게이팅과 같은 권한 키로 맞춘다 — 트랙 0 후속.
--
-- 배경: PR #79(20260805130000)가 학습 분석 표면을 analytics.read 로 잠갔지만, 같은 병이
--   남은 표면이 두 곳 더 있었다. 둘 다 화면은 권한 키로 게이팅하는데 서버는 관리자 공통이다.
--
--   * get_admin_dashboard_stats()  — 사이드바 대시보드는 dashboard.read 게이팅
--   * get_admin_backup_summary()   — 같은 화면의 get_admin_backup_runs 는 이미
--                                    system.backups.read 를 요구한다(요약만 무게이트인 혼재)
--
-- 방식은 20260805130000 과 동일하다: 라이브 정의(pg_get_functiondef)를 읽어 권한 검사
--   블록만 치환하고, 앵커는 존재가 아니라 발생 횟수 = 1 을 단정한 뒤 바꾼다. 두 함수 모두
--   수술 이력이 없는 단일 정의지만, 전문 재정의를 쓰지 않는 이유는 같다 — 미래에 수술이
--   끼어들면 그때 이 파일이 되덮기 사고를 만든다.
-- down: supabase/migrations-admin/down/20260805150000_admin_read_permission_alignment.sql

begin;

do $align_admin_read_permission$
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
  if to_regprocedure('public.admin_has_permission(uuid,text)') is null then
    raise exception 'admin read alignment: public.admin_has_permission(uuid,text) is missing';
  end if;

  for v_target in select value from jsonb_array_elements(v_targets)
  loop
    v_identity := to_regprocedure(v_target->>'identity');
    if v_identity is null then
      raise exception 'admin read alignment: % is missing', v_target->>'identity';
    end if;

    v_guard_new := format(
      $tpl$  if not public.admin_has_permission(caller_id, %L) then
    raise exception 'forbidden: missing permission %s';
  end if;$tpl$,
      v_target->>'key',
      v_target->>'key'
    );

    select pg_get_functiondef(v_identity) into v_definition;

    -- 사전 단정: 구 가드 블록 정확히 1회, 신 가드 흔적 0회, 가드 외 잔존 참조 0회.
    if (length(v_definition) - length(replace(v_definition, v_guard_old, ''))) / length(v_guard_old) <> 1 then
      raise exception 'admin read alignment: expected exactly one legacy guard in %', v_target->>'identity';
    end if;
    if position('admin_has_permission' in v_definition) > 0 then
      raise exception 'admin read alignment: % already carries a permission check', v_target->>'identity';
    end if;
    if (length(v_definition) - length(replace(v_definition, 'private.is_admin', ''))) / length('private.is_admin') <> 1 then
      raise exception 'admin read alignment: unexpected extra private.is_admin reference in %', v_target->>'identity';
    end if;
    for v_literal in select jsonb_array_elements_text(v_target->'contract')
    loop
      if position(v_literal in v_definition) = 0 then
        raise exception 'admin read alignment: contract literal % is missing in %', v_literal, v_target->>'identity';
      end if;
    end loop;

    v_definition := replace(v_definition, v_guard_old, v_guard_new);

    -- 사후 단정: 신 가드 1회, 구 검사식 0회, 계약 리터럴 보존.
    if (length(v_definition) - length(replace(v_definition, v_guard_new, ''))) / length(v_guard_new) <> 1
       or position('private.is_admin' in v_definition) > 0 then
      raise exception 'admin read alignment: rewrite incomplete for %', v_target->>'identity';
    end if;
    for v_literal in select jsonb_array_elements_text(v_target->'contract')
    loop
      if position(v_literal in v_definition) = 0 then
        raise exception 'admin read alignment: contract literal % lost during rewrite of %', v_literal, v_target->>'identity';
      end if;
    end loop;

    execute v_definition;
  end loop;
end
$align_admin_read_permission$;

-- 실행 권한 재선언 — 치환 실행은 기존 ACL 을 보존하지만 최종 상태를 명시적으로 고정한다.
revoke all on function public.get_admin_dashboard_stats() from public, anon;
grant execute on function public.get_admin_dashboard_stats() to authenticated;

revoke all on function public.get_admin_backup_summary() from public, anon;
grant execute on function public.get_admin_backup_summary() to authenticated;

comment on function public.get_admin_dashboard_stats() is
  '대시보드 요약/큐/경고 실데이터 집계. dashboard.read 권한 전용(admin_has_permission, platform_admin 자동 통과), 집계 수치만 반환(PII 없음). 오늘=KST 자정, 실패/추세 창=최근 7일 vs 직전 7일.';

comment on function public.get_admin_backup_summary() is
  'System > 백업 관리 요약. system.backups.read 권한 전용(admin_has_permission, platform_admin 자동 통과) read-only. 같은 화면의 get_admin_backup_runs 와 동일한 권한 계약을 따른다.';

-- 사후 검증: 라이브 정의·권한·주석을 다시 읽어 전환 완료를 확정한다.
do $verify_admin_read_alignment$
declare
  v_entries constant jsonb := jsonb_build_array(
    jsonb_build_object('identity', 'public.get_admin_dashboard_stats()', 'key', 'dashboard.read'),
    jsonb_build_object('identity', 'public.get_admin_backup_summary()', 'key', 'system.backups.read')
  );
  v_entry jsonb;
  v_identity regprocedure;
  v_definition text;
  v_needle text;
begin
  for v_entry in select value from jsonb_array_elements(v_entries)
  loop
    v_identity := to_regprocedure(v_entry->>'identity');
    if v_identity is null then
      raise exception 'admin read alignment verify: % is missing', v_entry->>'identity';
    end if;

    select pg_get_functiondef(v_identity) into v_definition;
    v_needle := format('public.admin_has_permission(caller_id, %L)', v_entry->>'key');

    if position(v_needle in v_definition) = 0 then
      raise exception 'admin read alignment verify: new guard is not in place for %', v_entry->>'identity';
    end if;
    if position('private.is_admin' in v_definition) > 0 then
      raise exception 'admin read alignment verify: legacy check survived in %', v_entry->>'identity';
    end if;
    if has_function_privilege('anon', v_identity, 'execute') then
      raise exception 'admin read alignment verify: anon can still execute %', v_entry->>'identity';
    end if;
    if position(v_entry->>'key' in coalesce(obj_description(v_identity, 'pg_proc'), '')) = 0 then
      raise exception 'admin read alignment verify: comment was not re-stamped for %', v_entry->>'identity';
    end if;
  end loop;
end
$verify_admin_read_alignment$;

commit;
