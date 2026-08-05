-- 학습 원본 테이블의 "관리자면 직접 조회 허용" RLS 분기를 제거한다 — 트랙 0 후속.
--
-- 배경: PR #79(마이그 admin/20260805130000)가 학습 분석 RPC 4종을 analytics.read 권한으로
--   잠갔지만, 같은 데이터의 원본 테이블은 정책이 `user_id = auth.uid() or private.is_admin(...)`
--   이라 통계 권한 없는 활성 관리자가 PostgREST 로 원본을 직접 읽어 통계를 재구성할 수 있었다.
--   dev 실측(2026-08-05): analytics.read grant 없는 content_admin 이 writing_submissions 282행,
--   writing_feedback 249행을 조회했다.
--
-- 왜 관리자 분기를 "좁히는" 대신 "제거"하는가:
--   * 관리자 콘솔은 이 테이블들을 직접 읽지 않는다(topik-ai `src/` 에 해당 테이블 `.from()` 0건).
--     모든 관리자 조회는 SECURITY DEFINER RPC 경유이고, 그 함수들은 postgres 소유 +
--     rolbypassrls 라 RLS 를 우회한다 — 따라서 이 변경으로 죽는 관리자 화면이 없다.
--   * 권한 키로 다시 게이팅하면(analytics.read 등) 원본 표면에 두 번째 권한 계약이 생긴다.
--     원본은 "감사 가능한 RPC 만" 이라는 단일 규칙이 더 좁고 설명하기 쉽다.
--   * 학습자 본인 조회(`user_id = auth.uid()`)는 그대로 유지된다 — v13 학습자 화면 무영향.
--
-- 저작 위치: v13 저작 동결(2026-07-30, 워터마크 20260729120000)에 따라 신규 learner
--   마이그레이션은 이 저장소의 `supabase/migrations-v13/` 에 워터마크 초과 타임스탬프로 쓴다.
--   장부는 `supabase_migrations.schema_migrations`(결정 D3 — 장부 유지, 쓰기 주체만 이 저장소).
-- down: supabase/migrations-v13/down/20260805140000_learner_raw_data_admin_read_removal.sql

begin;

do $strip_admin_read$
declare
  -- 대상: 학습 분석 원본(제출·피드백·지표·차원 점수) + 답안/첨삭 본문 보유(문장 첨삭·비교 리포트)
  -- + 학습 이벤트. 전부 `본인 또는 관리자` 단일 PERMISSIVE SELECT 정책이다.
  v_targets constant jsonb := jsonb_build_array(
    jsonb_build_object('table', 'writing_submissions', 'policy', 'writing_submissions_owner_select'),
    jsonb_build_object('table', 'writing_feedback', 'policy', 'writing_feedback_owner_select'),
    jsonb_build_object('table', 'writing_submission_metrics', 'policy', 'writing_submission_metrics_owner_select'),
    jsonb_build_object('table', 'feedback_dimension_scores', 'policy', 'feedback_dimension_owner_select'),
    jsonb_build_object('table', 'sentence_feedback', 'policy', 'sentence_feedback_owner_select'),
    jsonb_build_object('table', 'study_events', 'policy', 'study_events_owner_select'),
    jsonb_build_object('table', 'comparison_reports', 'policy', 'comparison_reports_owner_select')
  );
  v_target jsonb;
  v_table text;
  v_policy text;
  v_qual text;
begin
  for v_target in select value from jsonb_array_elements(v_targets)
  loop
    v_table := v_target->>'table';
    v_policy := v_target->>'policy';

    select p.qual into v_qual
    from pg_policies p
    where p.schemaname = 'public' and p.tablename = v_table and p.policyname = v_policy;

    if v_qual is null then
      raise exception 'learner raw read: policy %.% is missing', v_table, v_policy;
    end if;
    -- 사전 단정: 본인 분기와 관리자 분기가 모두 있어야 한다(이미 좁혀진 상태면 재실행 아님).
    if position('is_admin' in v_qual) = 0 then
      raise exception 'learner raw read: policy %.% has no admin branch to remove', v_table, v_policy;
    end if;
    if position('user_id' in v_qual) = 0 then
      raise exception 'learner raw read: policy %.% has no owner branch; refusing rewrite', v_table, v_policy;
    end if;

    execute format('drop policy %I on public.%I', v_policy, v_table);
    execute format(
      'create policy %I on public.%I for select to authenticated using (user_id = (select auth.uid()))',
      v_policy, v_table
    );

    -- 사후 단정: 관리자 분기 소거 + 본인 분기 보존.
    select p.qual into v_qual
    from pg_policies p
    where p.schemaname = 'public' and p.tablename = v_table and p.policyname = v_policy;
    if v_qual is null or position('is_admin' in v_qual) > 0 or position('user_id' in v_qual) = 0 then
      raise exception 'learner raw read: rewrite incomplete for %.%', v_table, v_policy;
    end if;
  end loop;
end
$strip_admin_read$;

-- problem_attempts 는 관리자 분기가 별도 PERMISSIVE 정책으로 분리돼 있어 그 정책만 없앤다.
-- 학습자 본인 접근은 attempts_owner_all 이 계속 담당한다.
do $strip_attempts_admin_read$
declare
  v_qual text;
begin
  select p.qual into v_qual
  from pg_policies p
  where p.schemaname = 'public'
    and p.tablename = 'problem_attempts'
    and p.policyname = 'attempts_admin_select';

  if v_qual is null then
    raise exception 'learner raw read: attempts_admin_select is missing';
  end if;
  if position('is_admin' in v_qual) = 0 then
    raise exception 'learner raw read: attempts_admin_select is not the admin branch';
  end if;
  if not exists (
    select 1 from pg_policies p
    where p.schemaname = 'public'
      and p.tablename = 'problem_attempts'
      and p.policyname = 'attempts_owner_all'
  ) then
    raise exception 'learner raw read: attempts_owner_all is missing; refusing to drop admin policy';
  end if;

  drop policy attempts_admin_select on public.problem_attempts;
end
$strip_attempts_admin_read$;

-- 사후 검증: 대상 8테이블에 관리자 분기가 하나도 남지 않았고, 본인 조회 정책은 전부 살아 있다.
do $verify_admin_read_removed$
declare
  v_tables constant text[] := array[
    'writing_submissions',
    'writing_feedback',
    'writing_submission_metrics',
    'feedback_dimension_scores',
    'sentence_feedback',
    'study_events',
    'comparison_reports',
    'problem_attempts'
  ];
  v_table text;
  v_admin_left integer;
  v_owner_select integer;
begin
  foreach v_table in array v_tables
  loop
    select count(*) into v_admin_left
    from pg_policies p
    where p.schemaname = 'public' and p.tablename = v_table and p.qual like '%is_admin%';
    if v_admin_left > 0 then
      raise exception 'learner raw read: % still has % admin policy branch(es)', v_table, v_admin_left;
    end if;

    select count(*) into v_owner_select
    from pg_policies p
    where p.schemaname = 'public'
      and p.tablename = v_table
      and p.cmd in ('SELECT', 'ALL')
      and p.permissive = 'PERMISSIVE'
      and p.qual like '%user_id%';
    if v_owner_select = 0 then
      raise exception 'learner raw read: % lost its owner read path', v_table;
    end if;
  end loop;

  -- 관리자 조회 경로는 definer RPC 다 — RLS 를 우회하는지(소유자가 bypassrls 인지) 확인한다.
  -- 이 전제가 깨지면 이 마이그레이션이 관리자 화면을 죽인다.
  if exists (
    select 1
    from pg_proc pr
    join pg_namespace n on n.oid = pr.pronamespace
    join pg_roles r on r.oid = pr.proowner
    where n.nspname = 'public'
      and pr.proname in (
        'get_admin_learning_analytics_filtered',
        'get_admin_learning_analytics_filter_options',
        'get_admin_learning_analytics',
        'get_admin_analytics_overview',
        'get_admin_user_learning_overview'
      )
      and (not pr.prosecdef or not r.rolbypassrls)
  ) then
    raise exception 'learner raw read: an admin analytics RPC does not bypass RLS; removal would break admin screens';
  end if;
end
$verify_admin_read_removed$;

commit;
