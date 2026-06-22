-- down: 활동/결제 실 소스 RPC 제거 + 학습 현황 RPC를 20260618120000 원본으로 복원.
drop function if exists public.admin_get_user_study_events(uuid, int);
drop function if exists public.admin_get_user_payment_history(uuid, int);

drop function if exists public.get_admin_user_learning_overview(uuid);

create function public.get_admin_user_learning_overview(
  target_id uuid
)
returns table (
  kpis jsonb,
  domain_accuracy jsonb,
  weaknesses jsonb,
  recent_attempts jsonb,
  recent_writing jsonb
)
language plpgsql
stable
security definer
set search_path = pg_catalog, public
as $$
declare
  caller_id uuid := auth.uid();
begin
  if caller_id is null then
    raise exception 'unauthenticated';
  end if;

  if not private.is_platform_admin(caller_id) then
    raise exception 'forbidden: platform_admin required';
  end if;

  return query
  with attempts as (
    select
      pa.id,
      pa.problem_id,
      pa.is_correct,
      pa.score,
      pa.status,
      pa.started_at,
      pa.submitted_at,
      coalesce(pa.bookmarked, false) as bookmarked,
      coalesce(pa.time_spent_seconds, 0) as time_spent_seconds,
      p.domain,
      p.question_no,
      p.topik_level,
      p.difficulty,
      p.title,
      p.tags
    from public.problem_attempts pa
    left join public.problems p on p.id = pa.problem_id
    where pa.user_id = target_id
  ),
  attempt_kpis as (
    select
      count(*)::integer as total_attempts,
      count(distinct problem_id)::integer as solved_problems,
      round(avg(case when is_correct is true then 100.0 when is_correct is false then 0.0 end), 1) as correct_rate,
      round(avg(score), 1) as average_score,
      ceil(coalesce(sum(time_spent_seconds), 0) / 60.0)::integer as total_study_minutes,
      count(*) filter (where bookmarked)::integer as bookmarked_count,
      max(coalesce(submitted_at, started_at)) as latest_attempt_at
    from attempts
  ),
  writing_kpis as (
    select
      count(ws.*)::integer as writing_submission_count,
      count(wf.*)::integer as writing_feedback_count,
      max(greatest(ws.submitted_at, coalesce(wf.generated_at, ws.submitted_at))) as latest_writing_at
    from public.writing_submissions ws
    left join public.writing_feedback wf on wf.submission_id = ws.id and wf.user_id = ws.user_id
    where ws.user_id = target_id
  ),
  domain_rows as (
    select
      coalesce(nullif(domain, ''), 'unknown') as domain,
      count(*)::integer as attempts,
      round(avg(case when is_correct is true then 100.0 when is_correct is false then 0.0 end), 1) as correct_rate,
      round(avg(score), 1) as average_score
    from attempts
    group by coalesce(nullif(domain, ''), 'unknown')
    order by attempts desc, domain asc
  ),
  domain_weaknesses as (
    select
      domain as label,
      'domain'::text as source,
      case
        when correct_rate is null then 1
        when correct_rate < 50 then 3
        when correct_rate < 70 then 2
        else 1
      end as severity,
      attempts as evidence_count
    from domain_rows
    where correct_rate is null or correct_rate < 70
  ),
  tag_rows as (
    select
      tag::text as label,
      count(*)::integer as evidence_count
    from attempts a
    cross join lateral unnest(coalesce(a.tags, array[]::text[])) as tag
    where a.is_correct is false
    group by tag
    order by evidence_count desc, label asc
    limit 5
  ),
  writing_dimension_weaknesses as (
    select
      fds.dimension as label,
      'writing_dimension'::text as source,
      coalesce(max(fds.weakness_level), 1)::integer as severity,
      count(*)::integer as evidence_count
    from public.feedback_dimension_scores fds
    where fds.user_id = target_id
      and coalesce(fds.weakness_level, 0) > 0
    group by fds.dimension
    order by severity desc, evidence_count desc, label asc
    limit 5
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
    select label, source, severity, evidence_count from domain_weaknesses
    union all
    select label, 'tag'::text, 2, evidence_count from tag_rows
    union all
    select label, source, severity, evidence_count from writing_dimension_weaknesses
    union all
    select label, source, severity, evidence_count from goal_weaknesses
  ),
  recent_attempt_rows as (
    select
      id,
      problem_id,
      coalesce(nullif(domain, ''), 'unknown') as domain,
      question_no,
      topik_level,
      difficulty,
      coalesce(nullif(title, ''), problem_id::text) as title,
      is_correct,
      score,
      status,
      submitted_at,
      time_spent_seconds
    from attempts
    order by coalesce(submitted_at, started_at) desc nulls last
    limit 10
  ),
  recent_writing_rows as (
    select
      ws.id as submission_id,
      ws.question_no,
      ws.submitted_at,
      ws.feedback_status,
      wf.score_total,
      wf.score_max,
      coalesce(
        (
          select jsonb_agg(fds.dimension order by fds.weakness_level desc nulls last, fds.dimension)
          from public.feedback_dimension_scores fds
          where fds.submission_id = ws.id
            and fds.user_id = ws.user_id
            and coalesce(fds.weakness_level, 0) > 0
        ),
        '[]'::jsonb
      ) as weakness_dimensions
    from public.writing_submissions ws
    left join public.writing_feedback wf on wf.submission_id = ws.id and wf.user_id = ws.user_id
    where ws.user_id = target_id
    order by ws.submitted_at desc
    limit 5
  )
  select
    jsonb_build_object(
      'totalAttempts', coalesce(ak.total_attempts, 0),
      'solvedProblems', coalesce(ak.solved_problems, 0),
      'correctRate', ak.correct_rate,
      'averageScore', ak.average_score,
      'totalStudyMinutes', coalesce(ak.total_study_minutes, 0),
      'bookmarkedCount', coalesce(ak.bookmarked_count, 0),
      'writingSubmissionCount', coalesce(wk.writing_submission_count, 0),
      'writingFeedbackCount', coalesce(wk.writing_feedback_count, 0),
      'latestActivityAt',
        case
          when ak.latest_attempt_at is null and wk.latest_writing_at is null then ''
          else to_char(
            greatest(
              coalesce(ak.latest_attempt_at, wk.latest_writing_at),
              coalesce(wk.latest_writing_at, ak.latest_attempt_at)
            ),
            'YYYY-MM-DD'
          )
        end
    ) as kpis,
    coalesce(
      (select jsonb_agg(jsonb_build_object(
        'domain', domain,
        'attempts', attempts,
        'correctRate', correct_rate,
        'averageScore', average_score
      ) order by attempts desc, domain asc) from domain_rows),
      '[]'::jsonb
    ) as domain_accuracy,
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
        'id', id,
        'problemId', problem_id,
        'domain', domain,
        'questionNo', question_no,
        'topikLevel', topik_level::text,
        'difficulty', difficulty::text,
        'title', title,
        'isCorrect', is_correct,
        'score', score,
        'status', status,
        'submittedAt', coalesce(to_char(submitted_at, 'YYYY-MM-DD'), ''),
        'timeSpentSeconds', time_spent_seconds
      ) order by submitted_at desc nulls last) from recent_attempt_rows),
      '[]'::jsonb
    ) as recent_attempts,
    coalesce(
      (select jsonb_agg(jsonb_build_object(
        'submissionId', submission_id,
        'questionNo', question_no,
        'submittedAt', to_char(submitted_at, 'YYYY-MM-DD'),
        'feedbackStatus', feedback_status,
        'scoreTotal', score_total,
        'scoreMax', score_max,
        'weaknessDimensions', weakness_dimensions
      ) order by submitted_at desc) from recent_writing_rows),
      '[]'::jsonb
    ) as recent_writing
  from attempt_kpis ak
  cross join writing_kpis wk;
end;
$$;

revoke all on function public.get_admin_user_learning_overview(uuid) from public;
grant execute on function public.get_admin_user_learning_overview(uuid) to authenticated;

comment on function public.get_admin_user_learning_overview(uuid) is
  'Users detail learning overview for platform_admin. Read-only aggregate over v13 learning tables. Excludes writing_submissions.answer_text and sentence_feedback text/comment PII.';
