-- down: 학습 원본 테이블의 관리자 직접 조회 분기를 복원한다.
-- 주의: 원복은 "관리자면 원본 전량 조회 허용"으로 되돌아가는 보안 완화다 — 통계 권한 없는
-- 관리자가 원본에서 통계를 재구성할 수 있는 상태로 돌아간다. 운영 실행은 별도 승인 후에만.

begin;

do $restore_admin_read$
declare
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
      raise exception 'learner raw read revert: policy %.% is missing', v_table, v_policy;
    end if;
    if position('is_admin' in v_qual) > 0 then
      raise exception 'learner raw read revert: policy %.% already has the admin branch', v_table, v_policy;
    end if;

    execute format('drop policy %I on public.%I', v_policy, v_table);
    execute format(
      'create policy %I on public.%I for select to authenticated '
      || 'using (user_id = (select auth.uid()) or private.is_admin((select auth.uid())))',
      v_policy, v_table
    );

    select p.qual into v_qual
    from pg_policies p
    where p.schemaname = 'public' and p.tablename = v_table and p.policyname = v_policy;
    if v_qual is null or position('is_admin' in v_qual) = 0 or position('user_id' in v_qual) = 0 then
      raise exception 'learner raw read revert: rewrite incomplete for %.%', v_table, v_policy;
    end if;
  end loop;
end
$restore_admin_read$;

do $restore_attempts_admin_read$
begin
  if exists (
    select 1 from pg_policies p
    where p.schemaname = 'public'
      and p.tablename = 'problem_attempts'
      and p.policyname = 'attempts_admin_select'
  ) then
    raise exception 'learner raw read revert: attempts_admin_select already exists';
  end if;

  create policy attempts_admin_select on public.problem_attempts
    for select to authenticated
    using (private.is_admin((select auth.uid())));
end
$restore_attempts_admin_read$;

do $verify_admin_read_restored$
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
  v_admin_branches integer;
begin
  foreach v_table in array v_tables
  loop
    select count(*) into v_admin_branches
    from pg_policies p
    where p.schemaname = 'public' and p.tablename = v_table and p.qual like '%is_admin%';
    if v_admin_branches <> 1 then
      raise exception 'learner raw read revert: % has % admin branch(es), expected 1', v_table, v_admin_branches;
    end if;
  end loop;
end
$verify_admin_read_restored$;

commit;
