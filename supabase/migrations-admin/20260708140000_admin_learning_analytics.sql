-- =====================================================================
-- Analytics > 학습 분석: 전체 사용자 학습 집계 read RPC (학습 데이터 수집 Phase 3)
--
-- 배경(오너 확정 2026-07-08, docs/checklists/users-learning-data-collection-report-and-plan.md):
--   기존 get_admin_analytics_overview(20260707130000)는 가입/신고/알림/매출
--   중심으로 학습 성과 집계가 없다. TOPIK 쓰기(51~54) 학습 지표를 기간별로
--   집계하는 별도 RPC를 신설한다. 화면은 Analytics 하위 "학습 분석" 탭.
--
-- Metric 정의(오너 확정):
--   - 학습 활성 사용자 = 기간 내 study_events 1건 이상(로그인 기준 아님 —
--     기존 개요의 "활성 사용자(로그인)"와 라벨로 구분해 공존).
--   - 점수 = 원점수 + 100점 정규화 병기(행별 score_max 기준).
--   - 소요 시간 = writing_submission_metrics(부재=미수집, 0으로 렌더 금지).
--   - 피드백 처리시간 = generated_at - submitted_at (음수 방어), 고착 재동기화
--     이력으로 평균이 부풀 수 있어 중앙값 병기.
--   - 개인 식별자(user_id 등)는 반환하지 않는다(순수 집계).
--
-- period_days: 7/30/90 = 최근 N일, 0 = 전체 기간. 직전 동일기간 비교값은
--   period_days > 0 일 때만 계산(전체 기간은 비교 대상이 없어 null).
-- 권한: private.is_admin (집계 수치만 반환 — 기존 analytics 표면과 동일).
-- down: supabase/migrations-admin/down/20260708140000_admin_learning_analytics.sql
-- =====================================================================

drop function if exists public.get_admin_learning_analytics(integer);

create function public.get_admin_learning_analytics(
  period_days integer default 30
)
returns table (
  summary jsonb,
  per_question jsonb,
  score_distribution jsonb,
  weak_dimensions jsonb,
  tag_stats jsonb
)
language plpgsql
stable
security definer
set search_path = pg_catalog, public
as $$
declare
  caller_id uuid := auth.uid();
  v_days integer := greatest(0, least(coalesce(period_days, 30), 365));
  v_end timestamptz := now();
  v_start timestamptz;
  v_prev_start timestamptz;
begin
  if caller_id is null then
    raise exception 'unauthenticated';
  end if;

  if not private.is_admin(caller_id) then
    raise exception 'forbidden: admin required';
  end if;

  if v_days = 0 then
    v_start := '-infinity'::timestamptz;
    v_prev_start := null;
  else
    v_start := v_end - make_interval(days => v_days);
    v_prev_start := v_start - make_interval(days => v_days);
  end if;

  return query
  with subs as (
    select
      ws.id,
      ws.user_id,
      ws.question_no,
      ws.submitted_at,
      ws.feedback_status,
      ws.parent_submission_id,
      wf.score_total,
      wf.score_max,
      wf.generated_at,
      case
        when ws.feedback_status = 'complete'
         and wf.score_total is not null
         and coalesce(wf.score_max, 0) > 0
        then round(wf.score_total::numeric / wf.score_max * 100, 1)
      end as score_normalized,
      p.tags as problem_tags,
      m.elapsed_seconds
    from public.writing_submissions ws
    left join public.writing_feedback wf
      on wf.submission_id = ws.id and wf.user_id = ws.user_id
    left join public.problems p on p.id = ws.problem_id
    left join public.writing_submission_metrics m
      on m.submission_id = ws.id and m.user_id = ws.user_id
    where ws.submitted_at >= v_start
  ),
  prev_subs as (
    select
      ws.id,
      case
        when ws.feedback_status = 'complete'
         and wf.score_total is not null
         and coalesce(wf.score_max, 0) > 0
        then round(wf.score_total::numeric / wf.score_max * 100, 1)
      end as score_normalized
    from public.writing_submissions ws
    left join public.writing_feedback wf
      on wf.submission_id = ws.id and wf.user_id = ws.user_id
    where v_prev_start is not null
      and ws.submitted_at >= v_prev_start
      and ws.submitted_at < v_start
  ),
  viewed_submissions as (
    select distinct se.submission_id
    from public.study_events se
    where se.event_type = 'feedback_viewed'
      and se.submission_id is not null
      and se.submission_id in (select id from subs)
  ),
  learner_counts as (
    select
      (select count(distinct se.user_id) from public.study_events se
        where se.occurred_at >= v_start)::integer as active_learners,
      case
        when v_prev_start is null then null
        else (select count(distinct se.user_id) from public.study_events se
          where se.occurred_at >= v_prev_start and se.occurred_at < v_start)::integer
      end as active_learners_prev
  ),
  processing as (
    select
      round(avg(extract(epoch from (generated_at - submitted_at))))::integer as avg_seconds,
      round(percentile_cont(0.5) within group (
        order by extract(epoch from (generated_at - submitted_at))
      )::numeric)::integer as median_seconds
    from subs
    where generated_at is not null
      and generated_at >= submitted_at
  ),
  elapsed_stats as (
    select
      count(elapsed_seconds)::integer as metrics_count,
      round(avg(elapsed_seconds))::integer as avg_elapsed_seconds,
      round(percentile_cont(0.5) within group (order by elapsed_seconds)::numeric)::integer
        as median_elapsed_seconds
    from subs
    where elapsed_seconds is not null
  ),
  summary_calc as (
    select
      count(*)::integer as submissions,
      count(distinct user_id)::integer as submitters,
      count(*) filter (where feedback_status = 'complete')::integer as feedback_complete,
      count(*) filter (where feedback_status in ('pending', 'analyzing'))::integer as feedback_pending,
      count(*) filter (where feedback_status = 'failed')::integer as feedback_failed,
      count(*) filter (where parent_submission_id is not null)::integer as resubmissions,
      round(avg(score_normalized), 1) as avg_score_normalized,
      count(*) filter (
        where feedback_status = 'complete'
          and id in (select submission_id from viewed_submissions)
      )::integer as feedback_viewed_count,
      (select count(distinct fds.submission_id)
         from public.feedback_dimension_scores fds
        where fds.submission_id in (select id from subs))::integer as dimension_coverage_submissions
    from subs
  ),
  prev_summary_calc as (
    select
      count(*)::integer as submissions_prev,
      round(avg(score_normalized), 1) as avg_score_normalized_prev
    from prev_subs
  ),
  question_rows as (
    select
      q.question_no,
      count(s.id)::integer as submissions,
      count(*) filter (where s.feedback_status = 'complete')::integer as feedback_complete,
      round(avg(s.score_total) filter (where s.feedback_status = 'complete'), 1) as avg_score_raw,
      mode() within group (order by s.score_max) as score_max_mode,
      round(avg(s.score_normalized), 1) as avg_score_normalized,
      round(avg(s.elapsed_seconds), 0) as avg_elapsed_seconds,
      count(s.elapsed_seconds)::integer as metrics_count
    from generate_series(51, 54) as q(question_no)
    left join subs s on s.question_no = q.question_no
    group by q.question_no
    order by q.question_no
  ),
  bucket_counts as (
    select least(width_bucket(score_normalized, 0, 100, 5), 5) as bucket,
           count(*)::integer as cnt
    from subs
    where score_normalized is not null
    group by 1
  ),
  distribution_rows as (
    select
      b.bucket,
      case b.bucket
        when 1 then '0-19' when 2 then '20-39' when 3 then '40-59'
        when 4 then '60-79' else '80-100' end as label,
      coalesce(bc.cnt, 0) as cnt
    from generate_series(1, 5) as b(bucket)
    left join bucket_counts bc on bc.bucket = b.bucket
    order by b.bucket
  ),
  dimension_rows as (
    select
      fds.dimension,
      count(*) filter (where coalesce(fds.weakness_level, 0) > 0)::integer as weakness_occurrences,
      count(distinct fds.submission_id)::integer as submissions,
      coalesce(max(fds.weakness_level), 0)::integer as max_severity
    from public.feedback_dimension_scores fds
    where fds.submission_id in (select id from subs)
    group by fds.dimension
    having count(*) filter (where coalesce(fds.weakness_level, 0) > 0) > 0
    order by weakness_occurrences desc, dimension asc
    limit 10
  ),
  tag_rows as (
    select
      tag::text as tag,
      count(*)::integer as submissions,
      round(avg(s.score_normalized), 1) as avg_score_normalized
    from subs s
    cross join lateral unnest(coalesce(s.problem_tags, array[]::text[])) as tag
    group by tag
    order by submissions desc, tag asc
    limit 12
  )
  select
    jsonb_build_object(
      'periodDays', v_days,
      'activeLearners', lc.active_learners,
      'activeLearnersPrev', lc.active_learners_prev,
      'submitters', coalesce(sm.submitters, 0),
      'submissions', coalesce(sm.submissions, 0),
      'submissionsPrev', case when v_prev_start is null then null else coalesce(ps.submissions_prev, 0) end,
      'feedbackComplete', coalesce(sm.feedback_complete, 0),
      'feedbackPending', coalesce(sm.feedback_pending, 0),
      'feedbackFailed', coalesce(sm.feedback_failed, 0),
      'completionRate',
        case when coalesce(sm.submissions, 0) > 0
          then round(sm.feedback_complete::numeric / sm.submissions * 100, 1) end,
      'failureRate',
        case when coalesce(sm.submissions, 0) > 0
          then round(sm.feedback_failed::numeric / sm.submissions * 100, 1) end,
      'resubmissions', coalesce(sm.resubmissions, 0),
      'avgScoreNormalized', sm.avg_score_normalized,
      'avgScoreNormalizedPrev', ps.avg_score_normalized_prev,
      'feedbackViewedCount', coalesce(sm.feedback_viewed_count, 0),
      'feedbackViewRate',
        case when coalesce(sm.feedback_complete, 0) > 0
          then round(sm.feedback_viewed_count::numeric / sm.feedback_complete * 100, 1) end,
      'avgProcessingSeconds', pr.avg_seconds,
      'medianProcessingSeconds', pr.median_seconds,
      'metricsCount', coalesce(es.metrics_count, 0),
      'avgElapsedSeconds', es.avg_elapsed_seconds,
      'medianElapsedSeconds', es.median_elapsed_seconds,
      'dimensionCoverageSubmissions', coalesce(sm.dimension_coverage_submissions, 0)
    ) as summary,
    coalesce(
      (select jsonb_agg(jsonb_build_object(
        'questionNo', question_no,
        'submissions', submissions,
        'feedbackComplete', feedback_complete,
        'avgScoreRaw', avg_score_raw,
        'scoreMax', score_max_mode,
        'avgScoreNormalized', avg_score_normalized,
        'avgElapsedSeconds', avg_elapsed_seconds,
        'metricsCount', metrics_count
      ) order by question_no) from question_rows),
      '[]'::jsonb
    ) as per_question,
    coalesce(
      (select jsonb_agg(jsonb_build_object(
        'bucket', bucket,
        'label', label,
        'count', cnt
      ) order by bucket) from distribution_rows),
      '[]'::jsonb
    ) as score_distribution,
    coalesce(
      (select jsonb_agg(jsonb_build_object(
        'dimension', dimension,
        'weaknessOccurrences', weakness_occurrences,
        'submissions', submissions,
        'maxSeverity', max_severity
      ) order by weakness_occurrences desc, dimension asc) from dimension_rows),
      '[]'::jsonb
    ) as weak_dimensions,
    coalesce(
      (select jsonb_agg(jsonb_build_object(
        'tag', tag,
        'submissions', submissions,
        'avgScoreNormalized', avg_score_normalized
      ) order by submissions desc, tag asc) from tag_rows),
      '[]'::jsonb
    ) as tag_stats
  from summary_calc sm
  cross join prev_summary_calc ps
  cross join learner_counts lc
  cross join processing pr
  cross join elapsed_stats es;
end;
$$;

revoke all on function public.get_admin_learning_analytics(integer) from public;
grant execute on function public.get_admin_learning_analytics(integer) to authenticated;

comment on function public.get_admin_learning_analytics(integer) is
  'Analytics 학습 분석 집계(학습 데이터 수집 Phase 3). admin 공통 read 전용, '
  '개인 식별자 미반환. 학습 활성 사용자=study_events 기준(로그인 아님), '
  'period_days 0=전체, 점수=원점+정규화 병기, 소요시간 metrics 부재=미수집.';
