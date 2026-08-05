-- Analytics: 학습 분석·분석 개요 조회 권한을 관리자 공통(is_admin)에서
-- 세부 권한 analytics.read(public.admin_has_permission) 로 전환한다 — 트랙 0 / CBT2 R-09.
--
-- 대상 4함수(시그니처·응답 형태 불변, 권한 검사식만 교체):
--   * get_admin_learning_analytics_filtered(...)   — 학습 분석 통계
--   * get_admin_learning_analytics_filter_options() — 학습 분석 조건 사전
--   * get_admin_learning_analytics(integer)         — 구형 집계(호환 유지분, FE 미사용이나 직접 호출 우회를 함께 닫는다)
--   * get_admin_analytics_overview(integer)         — 분석 개요 KPI
--
-- 방식: 라이브 정의(pg_get_functiondef)를 읽어 권한 검사 블록만 치환한다(20260715190000 선례).
--   파일 전문 재정의는 이후 수술(pdf perTopic 등)을 되덮으므로 쓰지 않는다. 각 함수의
--   기존 계약 리터럴을 사전·사후 단정으로 보존하고, 앵커는 존재가 아니라
--   발생 횟수 = 1 을 단정한 뒤 치환한다(20260714090000 선례).
--
-- 정책(오너 확정 2026-08-05):
--   * platform_admin 은 권한 함수 안에서 자동 통과(모든 권한 암묵 보유).
--   * 활성(active) 상태만 인정 — invited/suspended 는 grant 가 있어도 거절.
--   * org_admin + grant 는 새로 허용된다(구 검사식은 org_admin 을 역할 단위로 거절).
--     "마스터 관리자" 단일 운영에서 세분 권한 운영으로 가는 첫 전환이며 의도된 행동 변화다.
--   * grant 백필 없음 — 현재 관리자 계정은 dev·운영 각 platform_admin 1개라 대상이 없다.
--
-- down 실행 순서 주의: 이 마이그레이션이 적용된 상태에서 20260714090000 ·
--   20260715130000 · 20260715190000 의 down 을 먼저 실행하지 않는다. 러너는
--   비-LIFO down 을 막지 않으며, 해당 가드들은 구 검사식을 전제하므로 순서를
--   어기면 fail-closed 되거나 추적기와 실제 정의가 어긋난다.
-- down: supabase/migrations-admin/down/20260805130000_admin_analytics_read_permission.sql

begin;

do $swap_analytics_permission$
declare
  v_guard_old constant text := $anchor$  if not private.is_admin(caller_id) then
    raise exception 'forbidden: admin required';
  end if;$anchor$;
  v_guard_new constant text := $anchor$  if not public.admin_has_permission(caller_id, 'analytics.read') then
    raise exception 'forbidden: missing permission analytics.read';
  end if;$anchor$;
  v_targets constant jsonb := jsonb_build_array(
    jsonb_build_object(
      'identity', 'public.get_admin_learning_analytics_filtered(date,date,smallint[],text,text,jsonb,boolean)',
      'contract', jsonb_build_array(
        $c$all_meta.topic_main as topic_main$c$,
        $c$pdf_per_topic as$c$,
        $c$'perTopic'$c$,
        $c$submission_metadata_facts as$c$,
        $c$event_metadata_coverage as$c$,
        $c$topic_total$c$,
        $c$'questionNo', t.question_no$c$
      )
    ),
    jsonb_build_object(
      'identity', 'public.get_admin_learning_analytics_filter_options()',
      'contract', jsonb_build_array($c$q54.required_structure$c$)
    ),
    jsonb_build_object(
      'identity', 'public.get_admin_learning_analytics(integer)',
      'contract', jsonb_build_array($c$private.admin_writing_question_metadata$c$)
    ),
    jsonb_build_object(
      'identity', 'public.get_admin_analytics_overview(integer)',
      'contract', jsonb_build_array($c$least(greatest(coalesce(period_days, 7), 1), 365)$c$)
    )
  );
  v_target jsonb;
  v_identity regprocedure;
  v_definition text;
  v_literal text;
begin
  -- 권한 함수 자체가 없으면 42883 으로 죽는 함수를 만들게 된다(20260804100300 이 수리한 결함의 재발 방지).
  if to_regprocedure('public.admin_has_permission(uuid,text)') is null then
    raise exception 'analytics permission gate: public.admin_has_permission(uuid,text) is missing';
  end if;

  for v_target in select value from jsonb_array_elements(v_targets)
  loop
    v_identity := to_regprocedure(v_target->>'identity');
    if v_identity is null then
      raise exception 'analytics permission gate: % is missing', v_target->>'identity';
    end if;

    select pg_get_functiondef(v_identity) into v_definition;

    -- 사전 단정: 구 가드 블록이 정확히 1회, 신 가드 흔적 0회, 가드 외 잔존 참조 0회.
    if (length(v_definition) - length(replace(v_definition, v_guard_old, ''))) / length(v_guard_old) <> 1 then
      raise exception 'analytics permission gate: expected exactly one legacy guard in %', v_target->>'identity';
    end if;
    if position('admin_has_permission' in v_definition) > 0 then
      raise exception 'analytics permission gate: % already carries a permission check', v_target->>'identity';
    end if;
    if (length(v_definition) - length(replace(v_definition, 'private.is_admin', ''))) / length('private.is_admin') <> 1 then
      raise exception 'analytics permission gate: unexpected extra private.is_admin reference in %', v_target->>'identity';
    end if;
    for v_literal in select jsonb_array_elements_text(v_target->'contract')
    loop
      if position(v_literal in v_definition) = 0 then
        raise exception 'analytics permission gate: contract literal % is missing in %', v_literal, v_target->>'identity';
      end if;
    end loop;

    v_definition := replace(v_definition, v_guard_old, v_guard_new);

    -- 사후 단정: 신 가드 정확히 1회, 구 검사식 0회, 계약 리터럴 보존.
    if (length(v_definition) - length(replace(v_definition, v_guard_new, ''))) / length(v_guard_new) <> 1
       or position('private.is_admin' in v_definition) > 0 then
      raise exception 'analytics permission gate: rewrite incomplete for %', v_target->>'identity';
    end if;
    for v_literal in select jsonb_array_elements_text(v_target->'contract')
    loop
      if position(v_literal in v_definition) = 0 then
        raise exception 'analytics permission gate: contract literal % lost during rewrite of %', v_literal, v_target->>'identity';
      end if;
    end loop;

    execute v_definition;
  end loop;
end
$swap_analytics_permission$;

-- 실행 권한 재선언 — 치환 실행은 기존 ACL 을 보존하지만 최종 상태를 명시적으로 고정한다.
revoke all on function public.get_admin_learning_analytics_filtered(
  date, date, smallint[], text, text, jsonb, boolean
) from public, anon;
grant execute on function public.get_admin_learning_analytics_filtered(
  date, date, smallint[], text, text, jsonb, boolean
) to authenticated;

revoke all on function public.get_admin_learning_analytics_filter_options() from public, anon;
grant execute on function public.get_admin_learning_analytics_filter_options() to authenticated;

revoke all on function public.get_admin_learning_analytics(integer) from public, anon;
grant execute on function public.get_admin_learning_analytics(integer) to authenticated;

revoke all on function public.get_admin_analytics_overview(integer) from public, anon;
grant execute on function public.get_admin_analytics_overview(integer) to authenticated;

comment on function public.get_admin_learning_analytics_filtered(
  date, date, smallint[], text, text, jsonb, boolean
) is
  'Analytics 학습 분석 전역 조건 집계. analytics.read 권한 전용(admin_has_permission, platform_admin 자동 통과) read-only, 개인 식별자/답안 원문 미반환. '
  'KST 날짜·51~54와 canonical topic_main/topic_detail·세부 조건을 모든 분석 블록에 동일 적용한다. '
  'pdf_usage.perTopic은 직접 귀속 export_downloaded 이벤트를 문제 유형×대주제×세부 주제 단위로 반환하며 혼합·미분류는 주제로 배분하지 않는다. '
  'PDF는 내보내기 완료 텔레메트리이며 실제 파일 저장 완료를 의미하지 않는다.';

comment on function public.get_admin_learning_analytics_filter_options() is
  'Analytics 학습 분석 조건 사전. analytics.read 권한 전용(admin_has_permission, platform_admin 자동 통과) read-only 집계이며 '
  'TOPIK 쓰기 신규 메타데이터의 주제 계층과 51~54 유형별 세부 조건만 반환한다.';

comment on function public.get_admin_learning_analytics(integer) is
  'Analytics 학습 분석 집계(학습 데이터 수집 Phase 3). analytics.read 권한 전용(admin_has_permission, platform_admin 자동 통과), '
  '개인 식별자 미반환. 학습 활성 사용자=study_events 기준(로그인 아님), '
  'period_days 0=전체, 점수=원점+정규화 병기, 소요시간 metrics 부재=미수집.';

comment on function public.get_admin_analytics_overview(integer) is
  '분석 개요 기간 KPI 집계(현재 기간 + 직전 동일기간). analytics.read 권한 전용(admin_has_permission, platform_admin 자동 통과), 집계 수치만 반환(PII 없음). 활성=기간 내 로그인, 도달률 분모=sent+failed, 매출=payment_history paid 합계(KRW).';

-- 사후 검증: 실행 후 라이브 정의·권한·주석을 다시 읽어 전환 완료를 확정한다.
do $verify_analytics_permission$
declare
  v_guard_new constant text := $anchor$  if not public.admin_has_permission(caller_id, 'analytics.read') then
    raise exception 'forbidden: missing permission analytics.read';
  end if;$anchor$;
  v_identities constant text[] := array[
    'public.get_admin_learning_analytics_filtered(date,date,smallint[],text,text,jsonb,boolean)',
    'public.get_admin_learning_analytics_filter_options()',
    'public.get_admin_learning_analytics(integer)',
    'public.get_admin_analytics_overview(integer)'
  ];
  v_name text;
  v_identity regprocedure;
  v_definition text;
begin
  foreach v_name in array v_identities
  loop
    v_identity := to_regprocedure(v_name);
    if v_identity is null then
      raise exception 'analytics permission verify: % is missing', v_name;
    end if;

    select pg_get_functiondef(v_identity) into v_definition;

    if (length(v_definition) - length(replace(v_definition, v_guard_new, ''))) / length(v_guard_new) <> 1 then
      raise exception 'analytics permission verify: new guard is not in place for %', v_name;
    end if;
    if position('private.is_admin' in v_definition) > 0 then
      raise exception 'analytics permission verify: legacy check survived in %', v_name;
    end if;
    if has_function_privilege('anon', v_identity, 'execute') then
      raise exception 'analytics permission verify: anon can still execute %', v_name;
    end if;
    if position('analytics.read' in coalesce(obj_description(v_identity, 'pg_proc'), '')) = 0 then
      raise exception 'analytics permission verify: comment was not re-stamped for %', v_name;
    end if;
  end loop;
end
$verify_analytics_permission$;

commit;
