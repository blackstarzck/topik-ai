-- =====================================================================
-- Users > 회원 상세 > 학습 현황: writing 중심 재정의 (학습 데이터 수집 Phase 2)
--
-- 배경(오너 확정 2026-07-08, docs/checklists/users-learning-data-collection-report-and-plan.md §7):
--   기존 get_admin_user_learning_overview(20260622170000)는 핵심 KPI(총 풀이 수·
--   정답률·평균 점수·누적 학습시간·북마크·streak·주간 학습분)를 전부
--   problem_attempts에서 계산했으나, v13 사용자 화면에는 problem_attempts
--   insert 경로가 없어(추천 dedup용 select만, dev DB 0행) 모든 회원에게 0이
--   표시되고 있었다. TOPIK 쓰기 학습 현황의 기준 원천을 writing 계열로 재정의한다.
--
-- 원천(전부 v13 소유, 읽기 전용):
--   writing_submissions ⋈ writing_feedback ⋈ feedback_dimension_scores
--   ⋈ problems(tags/title) ⋈ study_events(streak·열람) ⋈ learning_goals
--   ⋈ writing_submission_metrics(소요 시간, v13 마이그 20260708113000 선행 필수)
--
-- 계약 요점:
--   - 점수 = 원점수 + 100점 정규화 병기(score_total/score_max*100, 행별 score_max
--     기준 — dev 데이터에 51번 10점/100점 만점 혼재 확인).
--   - 소요 시간: metrics 행 부재 = "미수집"(null) — 0분으로 렌더 금지.
--     weeklyStudiedMinutes도 metricsCount=0이면 null(미수집).
--   - streak/활성 판단은 로그인이 아니라 학습 이벤트(study_events) 기준.
--   - 답안 원문(answer_text)·문장별 첨삭(sentence_feedback)·narrative는
--     기본 payload에서 제외(개인정보, 별도 권한/감사 체계 전까지).
--   - problem_attempts 기반 KPI는 objective_attempts 블록으로 분리 유지
--     (객관식/읽기/듣기 도입 대비, 화면에서 별도 라벨).
-- down: supabase/migrations-admin/down/20260708130000_users_learning_overview_writing_first.sql
-- =====================================================================

drop function if exists public.get_admin_user_learning_overview(uuid);

create function public.get_admin_user_learning_overview(
  target_id uuid
)
returns table (
  kpis jsonb,
  per_question jsonb,
  tag_stats jsonb,
  weaknesses jsonb,
  recent_writing jsonb,
  objective_attempts jsonb,
  onboarding jsonb
)
language plpgsql
stable
security definer
set search_path = pg_catalog, public
as $$
declare
  caller_id uuid := auth.uid();
  kst_today date := (now() at time zone 'Asia/Seoul')::date;
  week_start date := (date_trunc('week', now() at time zone 'Asia/Seoul'))::date;
begin
  if caller_id is null then
    raise exception 'unauthenticated';
  end if;

  if not private.is_platform_admin(caller_id) then
    raise exception 'forbidden: platform_admin required';
  end if;

  return query
  with subs as (
    select
      ws.id,
      ws.problem_id,
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
      p.title as problem_title,
      p.tags as problem_tags,
      m.elapsed_seconds,
      m.active_seconds
    from public.writing_submissions ws
    left join public.writing_feedback wf
      on wf.submission_id = ws.id and wf.user_id = ws.user_id
    left join public.problems p on p.id = ws.problem_id
    left join public.writing_submission_metrics m
      on m.submission_id = ws.id and m.user_id = ws.user_id
    where ws.user_id = target_id
  ),
  viewed_submissions as (
    select distinct se.submission_id
    from public.study_events se
    where se.user_id = target_id
      and se.event_type = 'feedback_viewed'
      and se.submission_id is not null
  ),
  writing_kpis as (
    select
      count(*)::integer as total_submissions,
      count(*) filter (where feedback_status = 'complete')::integer as feedback_complete,
      count(*) filter (where feedback_status in ('pending', 'analyzing'))::integer as feedback_pending,
      count(*) filter (where feedback_status = 'failed')::integer as feedback_failed,
      count(*) filter (where parent_submission_id is not null)::integer as resubmission_count,
      round(avg(score_normalized), 1) as avg_score_normalized,
      count(*) filter (
        where feedback_status = 'complete'
          and id in (select submission_id from viewed_submissions)
      )::integer as feedback_viewed_count,
      count(elapsed_seconds)::integer as metrics_count,
      round(avg(elapsed_seconds), 0) as avg_elapsed_seconds,
      round(avg(active_seconds), 0) as avg_active_seconds,
      max(greatest(submitted_at, coalesce(generated_at, submitted_at))) as latest_writing_at
    from subs
  ),
  -- 주간 학습 분(소요 시간 metrics 기준, KST 월요일 시작). metrics가 하나도
  -- 없는 사용자는 null(미수집) — writing_kpis.metrics_count로 판별한다.
  weekly_minutes as (
    select ceil(coalesce(sum(elapsed_seconds), 0) / 60.0)::integer as mins
    from subs
    where elapsed_seconds is not null
      and (submitted_at at time zone 'Asia/Seoul')::date >= week_start
  ),
  -- 연속 학습일: 학습 이벤트(study_events)가 있는 KST 날짜 기준(오너 결정
  -- "활성 = 학습 행동"). 최근 활동일이 오늘/어제일 때만 현재 streak로 인정.
  event_days as (
    select distinct (se.occurred_at at time zone 'Asia/Seoul')::date as d
    from public.study_events se
    where se.user_id = target_id
  ),
  latest_event as (
    select max(se.occurred_at) as occurred_at
    from public.study_events se
    where se.user_id = target_id
  ),
  ranked_days as (
    select d,
           row_number() over (order by d desc) as rn,
           max(d) over () as max_d
    from event_days
    where d <= kst_today
  ),
  streak_calc as (
    select case
      when (select max(d) from event_days where d <= kst_today) >= kst_today - 1
      then (select count(*)::integer from ranked_days where d = max_d - (rn - 1)::int)
      else 0
    end as streak_days
  ),
  goal as (
    select topik_level, target_grade, exam_date, weekly_goal_minutes, weak_areas, updated_at
    from public.learning_goals
    where user_id = target_id and is_active
    limit 1
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
  tag_rows_all as (
    select
      tag::text as tag,
      count(*)::integer as submissions,
      count(*) filter (where s.feedback_status = 'complete')::integer as feedback_complete,
      round(avg(s.score_normalized), 1) as avg_score_normalized
    from subs s
    cross join lateral unnest(coalesce(s.problem_tags, array[]::text[])) as tag
    group by tag
  ),
  tag_rows as (
    select * from tag_rows_all
    order by submissions desc, tag asc
    limit 12
  ),
  dimension_weaknesses as (
    select
      fds.dimension as label,
      'writing_dimension'::text as source,
      coalesce(max(fds.weakness_level), 1)::integer as severity,
      count(*)::integer as evidence_count
    from public.feedback_dimension_scores fds
    where fds.user_id = target_id
      and coalesce(fds.weakness_level, 0) > 0
    group by fds.dimension
  ),
  tag_weaknesses as (
    select
      tag as label,
      'tag'::text as source,
      2 as severity,
      submissions as evidence_count
    from tag_rows_all
    where avg_score_normalized is not null
      and avg_score_normalized < 70
      and submissions >= 2
  ),
  goal_weaknesses as (
    select
      weak_area::text as label,
      'goal'::text as source,
      1 as severity,
      1 as evidence_count
    from public.learning_goals lg
    cross join lateral unnest(coalesce(lg.weak_areas, array[]::text[])) as weak_area
    where lg.user_id = target_id
      and lg.is_active
  ),
  weakness_rows as (
    select * from (
      select label, source, severity, evidence_count from dimension_weaknesses
      union all
      select label, source, severity, evidence_count from tag_weaknesses
      union all
      select label, source, severity, evidence_count from goal_weaknesses
    ) w
    order by severity desc, evidence_count desc, label asc
    limit 10
  ),
  recent_writing_rows as (
    select
      s.id as submission_id,
      s.question_no,
      s.problem_id,
      -- 문항 title에 지문 전문이 들어있는 유형(52 등)이 있어 표시용으로 절단한다.
      left(coalesce(nullif(s.problem_title, ''), s.problem_id::text, '-'), 120) as problem_title,
      to_char(s.submitted_at at time zone 'Asia/Seoul', 'YYYY-MM-DD HH24:MI') as submitted_at_text,
      s.submitted_at,
      s.feedback_status,
      s.score_total,
      s.score_max,
      s.score_normalized,
      (s.parent_submission_id is not null) as is_resubmission,
      (s.id in (select submission_id from viewed_submissions)) as viewed,
      s.elapsed_seconds,
      coalesce(
        (
          select jsonb_agg(fds.dimension order by fds.weakness_level desc nulls last, fds.dimension)
          from public.feedback_dimension_scores fds
          where fds.submission_id = s.id
            and fds.user_id = target_id
            and coalesce(fds.weakness_level, 0) > 0
        ),
        '[]'::jsonb
      ) as weakness_dimensions
    from subs s
    order by s.submitted_at desc
    limit 5
  ),
  -- 객관식(problem_attempts) KPI: 객관식/읽기/듣기 도입 대비 분리 블록.
  -- TOPIK 쓰기에는 이 원천을 쓰지 않는다(Phase 0 결정).
  attempt_kpis as (
    select
      count(*)::integer as total_attempts,
      count(distinct pa.problem_id)::integer as solved_problems,
      round(avg(case when pa.is_correct is true then 100.0 when pa.is_correct is false then 0.0 end), 1) as correct_rate,
      round(avg(pa.score), 1) as average_score,
      ceil(coalesce(sum(pa.time_spent_seconds), 0) / 60.0)::integer as total_study_minutes,
      count(*) filter (where coalesce(pa.bookmarked, false))::integer as bookmarked_count,
      max(coalesce(pa.submitted_at, pa.started_at)) as latest_attempt_at
    from public.problem_attempts pa
    where pa.user_id = target_id
  )
  select
    jsonb_build_object(
      'totalSubmissions', coalesce(wk.total_submissions, 0),
      'feedbackComplete', coalesce(wk.feedback_complete, 0),
      'feedbackPending', coalesce(wk.feedback_pending, 0),
      'feedbackFailed', coalesce(wk.feedback_failed, 0),
      'resubmissionCount', coalesce(wk.resubmission_count, 0),
      'avgScoreNormalized', wk.avg_score_normalized,
      'feedbackViewedCount', coalesce(wk.feedback_viewed_count, 0),
      'feedbackViewRate',
        case
          when coalesce(wk.feedback_complete, 0) > 0
          then round(wk.feedback_viewed_count::numeric / wk.feedback_complete * 100, 1)
        end,
      'streakDays', coalesce(sc.streak_days, 0),
      'weeklyGoalMinutes', (select weekly_goal_minutes from goal),
      'weeklyStudiedMinutes',
        case when coalesce(wk.metrics_count, 0) > 0 then coalesce(wm.mins, 0) end,
      'metricsCount', coalesce(wk.metrics_count, 0),
      'avgElapsedSeconds', wk.avg_elapsed_seconds,
      'avgActiveSeconds', wk.avg_active_seconds,
      'latestActivityAt',
        case
          when wk.latest_writing_at is null and (select occurred_at from latest_event) is null then ''
          else to_char(
            greatest(
              coalesce(wk.latest_writing_at, (select occurred_at from latest_event)),
              coalesce((select occurred_at from latest_event), wk.latest_writing_at)
            ) at time zone 'Asia/Seoul',
            'YYYY-MM-DD'
          )
        end
    ) as kpis,
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
        'tag', tag,
        'submissions', submissions,
        'feedbackComplete', feedback_complete,
        'avgScoreNormalized', avg_score_normalized
      ) order by submissions desc, tag asc) from tag_rows),
      '[]'::jsonb
    ) as tag_stats,
    coalesce(
      (select jsonb_agg(jsonb_build_object(
        'label', label,
        'source', source,
        'severity', severity,
        'evidenceCount', evidence_count
      ) order by severity desc, evidence_count desc, label asc) from weakness_rows),
      '[]'::jsonb
    ) as weaknesses,
    coalesce(
      (select jsonb_agg(jsonb_build_object(
        'submissionId', submission_id,
        'questionNo', question_no,
        'problemId', problem_id,
        'problemTitle', problem_title,
        'submittedAt', submitted_at_text,
        'feedbackStatus', feedback_status,
        'scoreTotal', score_total,
        'scoreMax', score_max,
        'scoreNormalized', score_normalized,
        'isResubmission', is_resubmission,
        'viewed', viewed,
        'elapsedSeconds', elapsed_seconds,
        'weaknessDimensions', weakness_dimensions
      ) order by submitted_at desc) from recent_writing_rows),
      '[]'::jsonb
    ) as recent_writing,
    jsonb_build_object(
      'totalAttempts', coalesce(ak.total_attempts, 0),
      'solvedProblems', coalesce(ak.solved_problems, 0),
      'correctRate', ak.correct_rate,
      'averageScore', ak.average_score,
      'totalStudyMinutes', coalesce(ak.total_study_minutes, 0),
      'bookmarkedCount', coalesce(ak.bookmarked_count, 0),
      'latestAttemptAt',
        coalesce(to_char(ak.latest_attempt_at at time zone 'Asia/Seoul', 'YYYY-MM-DD'), '')
    ) as objective_attempts,
    coalesce(
      (select jsonb_build_object(
        'hasGoal', true,
        'topikLevel', case topik_level
          when 'TOPIK_I' then 'TOPIK I' when 'TOPIK_II' then 'TOPIK II'
          else coalesce(topik_level, '') end,
        'targetGrade', target_grade,
        'examDate', coalesce(to_char(exam_date, 'YYYY-MM-DD'), ''),
        'weeklyGoalMinutes', weekly_goal_minutes,
        'weakAreas', coalesce(to_jsonb(weak_areas), '[]'::jsonb),
        'goalUpdatedAt', coalesce(to_char(updated_at, 'YYYY-MM-DD'), '')
      ) from goal),
      jsonb_build_object(
        'hasGoal', false,
        'topikLevel', '',
        'targetGrade', null,
        'examDate', '',
        'weeklyGoalMinutes', null,
        'weakAreas', '[]'::jsonb,
        'goalUpdatedAt', ''
      )
    ) as onboarding
  from writing_kpis wk
  cross join streak_calc sc
  cross join weekly_minutes wm
  cross join attempt_kpis ak;
end;
$$;

revoke all on function public.get_admin_user_learning_overview(uuid) from public;
grant execute on function public.get_admin_user_learning_overview(uuid) to authenticated;

comment on function public.get_admin_user_learning_overview(uuid) is
  'Users 회원 상세 학습 현황(writing 중심 재정의, 학습 데이터 수집 Phase 2). '
  'platform_admin 전용, v13 학습 테이블 read-only 집계. 점수=원점+100점 정규화 병기, '
  '소요시간 metrics 부재=미수집(null), streak=학습 이벤트 기준, '
  'answer_text/sentence_feedback/narrative 제외. problem_attempts는 objective_attempts 블록으로 분리.';
