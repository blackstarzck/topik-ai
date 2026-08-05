-- down: analytics.read 권한 게이트 전환을 원복한다 — 4함수의 권한 검사식을
-- 구형(private.is_admin)으로 되돌리고, 함수 주석을 마이그레이션 이전 원문으로 복원한다.
-- 원복 후에는 20260714090000 · 20260715130000 · 20260715190000 계열 가드가 전제하는
-- 구 검사식 상태로 돌아가므로 해당 마이그레이션들의 재적용 가드와 다시 정합한다.
-- 주의: 원복은 "관리자면 전부 허용"으로 되돌아가는 보안 완화다 — 운영 실행은 별도 승인 후에만.

begin;

do $revert_analytics_permission$
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
  for v_target in select value from jsonb_array_elements(v_targets)
  loop
    v_identity := to_regprocedure(v_target->>'identity');
    if v_identity is null then
      raise exception 'analytics permission revert: % is missing', v_target->>'identity';
    end if;

    select pg_get_functiondef(v_identity) into v_definition;

    -- 사전 단정: 신 가드 블록이 정확히 1회, 구 검사식 흔적 0회.
    if (length(v_definition) - length(replace(v_definition, v_guard_new, ''))) / length(v_guard_new) <> 1 then
      raise exception 'analytics permission revert: expected exactly one permission guard in %', v_target->>'identity';
    end if;
    if position('private.is_admin' in v_definition) > 0 then
      raise exception 'analytics permission revert: % already carries the legacy check', v_target->>'identity';
    end if;
    for v_literal in select jsonb_array_elements_text(v_target->'contract')
    loop
      if position(v_literal in v_definition) = 0 then
        raise exception 'analytics permission revert: contract literal % is missing in %', v_literal, v_target->>'identity';
      end if;
    end loop;

    v_definition := replace(v_definition, v_guard_new, v_guard_old);

    -- 사후 단정: 구 가드 정확히 1회, 권한 검사식 0회, 계약 리터럴 보존.
    if (length(v_definition) - length(replace(v_definition, v_guard_old, ''))) / length(v_guard_old) <> 1
       or position('admin_has_permission' in v_definition) > 0 then
      raise exception 'analytics permission revert: rewrite incomplete for %', v_target->>'identity';
    end if;
    for v_literal in select jsonb_array_elements_text(v_target->'contract')
    loop
      if position(v_literal in v_definition) = 0 then
        raise exception 'analytics permission revert: contract literal % lost during rewrite of %', v_literal, v_target->>'identity';
      end if;
    end loop;

    execute v_definition;
  end loop;
end
$revert_analytics_permission$;

-- 실행 권한 재선언(마이그레이션 이전과 동일한 최종 상태).
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

-- 주석 원문 복원(각 함수의 마이그레이션 이전 텍스트 그대로).
comment on function public.get_admin_learning_analytics_filtered(
  date, date, smallint[], text, text, jsonb, boolean
) is
  'Analytics 학습 분석 전역 조건 집계. private.is_admin 전용 read-only, 개인 식별자/답안 원문 미반환. '
  'KST 날짜·51~54와 canonical topic_main/topic_detail·세부 조건을 모든 분석 블록에 동일 적용한다. '
  'pdf_usage.perTopic은 직접 귀속 export_downloaded 이벤트를 문제 유형×대주제×세부 주제 단위로 반환하며 혼합·미분류는 주제로 배분하지 않는다. '
  'PDF는 내보내기 완료 텔레메트리이며 실제 파일 저장 완료를 의미하지 않는다.';

comment on function public.get_admin_learning_analytics_filter_options() is
  'Analytics 학습 분석 조건 사전. private.is_admin 전용 read-only 집계이며 '
  'TOPIK 쓰기 신규 메타데이터의 주제 계층과 51~54 유형별 세부 조건만 반환한다.';

comment on function public.get_admin_learning_analytics(integer) is
  'Analytics 학습 분석 집계(학습 데이터 수집 Phase 3). admin 공통 read 전용, '
  '개인 식별자 미반환. 학습 활성 사용자=study_events 기준(로그인 아님), '
  'period_days 0=전체, 점수=원점+정규화 병기, 소요시간 metrics 부재=미수집.';

comment on function public.get_admin_analytics_overview(integer) is
  '분석 개요 기간 KPI 집계(현재 기간 + 직전 동일기간). is_admin 전용, 집계 수치만 반환(PII 없음). 활성=기간 내 로그인, 도달률 분모=sent+failed, 매출=payment_history paid 합계(KRW).';

-- 사후 검증: 구 검사식 복원·권한 검사식 소거·주석 원복을 확정한다.
do $verify_analytics_revert$
declare
  v_guard_old constant text := $anchor$  if not private.is_admin(caller_id) then
    raise exception 'forbidden: admin required';
  end if;$anchor$;
  v_entries constant jsonb := jsonb_build_array(
    jsonb_build_object(
      'identity', 'public.get_admin_learning_analytics_filtered(date,date,smallint[],text,text,jsonb,boolean)',
      'comment_fragment', 'private.is_admin 전용'
    ),
    jsonb_build_object(
      'identity', 'public.get_admin_learning_analytics_filter_options()',
      'comment_fragment', 'private.is_admin 전용'
    ),
    jsonb_build_object(
      'identity', 'public.get_admin_learning_analytics(integer)',
      'comment_fragment', 'admin 공통 read 전용'
    ),
    jsonb_build_object(
      'identity', 'public.get_admin_analytics_overview(integer)',
      'comment_fragment', 'is_admin 전용'
    )
  );
  v_entry jsonb;
  v_identity regprocedure;
  v_definition text;
begin
  for v_entry in select value from jsonb_array_elements(v_entries)
  loop
    v_identity := to_regprocedure(v_entry->>'identity');
    if v_identity is null then
      raise exception 'analytics revert verify: % is missing', v_entry->>'identity';
    end if;

    select pg_get_functiondef(v_identity) into v_definition;

    if (length(v_definition) - length(replace(v_definition, v_guard_old, ''))) / length(v_guard_old) <> 1 then
      raise exception 'analytics revert verify: legacy guard is not in place for %', v_entry->>'identity';
    end if;
    if position('admin_has_permission' in v_definition) > 0 then
      raise exception 'analytics revert verify: permission check survived in %', v_entry->>'identity';
    end if;
    if position(v_entry->>'comment_fragment' in coalesce(obj_description(v_identity, 'pg_proc'), '')) = 0 then
      raise exception 'analytics revert verify: comment was not restored for %', v_entry->>'identity';
    end if;
  end loop;
end
$verify_analytics_revert$;

commit;
