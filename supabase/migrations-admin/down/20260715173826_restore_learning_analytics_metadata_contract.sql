-- =====================================================================
-- Analytics > 학습 분석: metadata coverage 계약 복구 롤백
--
-- 직전 문제별 주제 성과 함수로 되돌린다. 이 함수에는 metadata coverage 계약이 없다.
-- down target: 20260715130000_admin_learning_analytics_topic_stats_by_question.sql
-- =====================================================================

create or replace function public.get_admin_learning_analytics_filtered(
  p_start_date date default null,
  p_end_date date default null,
  p_question_nos smallint[] default array[51, 52, 53, 54]::smallint[],
  p_topic_main text default null,
  p_topic_detail text default null,
  p_detail_filters jsonb default '{}'::jsonb,
  p_compare_previous boolean default true
)
returns table (
  summary jsonb,
  per_question jsonb,
  score_distribution jsonb,
  weak_dimensions jsonb,
  topic_stats jsonb,
  pdf_usage jsonb,
  scope jsonb
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  caller_id uuid := auth.uid();
  v_start timestamptz;
  v_end_exclusive timestamptz;
  v_prev_start timestamptz;
  v_prev_end_exclusive timestamptz;
  v_compare boolean;
  v_question_nos smallint[];
  v_detail_filters jsonb := coalesce(p_detail_filters, '{}'::jsonb);
  v_allowed_detail_keys text[];
  v_key text;
  v_value jsonb;
begin
  if caller_id is null then
    raise exception 'unauthenticated';
  end if;

  if not private.is_admin(caller_id) then
    raise exception 'forbidden: admin required';
  end if;

  if (p_start_date is null) <> (p_end_date is null) then
    raise exception 'start_date and end_date must both be set or both be null';
  end if;

  if p_start_date is not null and p_start_date > p_end_date then
    raise exception 'start_date must be on or before end_date';
  end if;

  if p_topic_detail is not null and p_topic_main is null then
    raise exception 'topic_main is required when topic_detail is set';
  end if;

  if p_question_nos is null or cardinality(p_question_nos) = 0 then
    raise exception 'at least one question number is required';
  end if;

  if exists (
    select 1 from unnest(p_question_nos) q
    where q is null or q not in (51, 52, 53, 54)
  ) then
    raise exception 'question_nos must contain only 51, 52, 53, or 54';
  end if;

  select array_agg(distinct q order by q)
    into v_question_nos
  from unnest(p_question_nos) q;

  if jsonb_typeof(v_detail_filters) <> 'object' then
    raise exception 'detail_filters must be a json object';
  end if;

  if v_detail_filters <> '{}'::jsonb and cardinality(v_question_nos) <> 1 then
    raise exception 'detail_filters require exactly one question number';
  end if;

  v_allowed_detail_keys := case v_question_nos[1]
    when 51 then array['blankRole', 'blankFunction', 'answerType']
    when 52 then array['connectionFunction', 'answerScope']
    when 53 then array['dataType', 'requiredStructure']
    when 54 then array['essayType', 'stance', 'requiredStructure']
    else array[]::text[]
  end;

  for v_key, v_value in select key, value from jsonb_each(v_detail_filters) loop
    if not (v_key = any(v_allowed_detail_keys)) then
      raise exception 'unsupported detail filter for question %: %', v_question_nos[1], v_key;
    end if;
    if jsonb_typeof(v_value) <> 'array' then
      raise exception 'detail filter % must be a json array', v_key;
    end if;
  end loop;

  if p_start_date is null then
    v_start := null;
    v_end_exclusive := null;
    v_compare := false;
    v_prev_start := null;
    v_prev_end_exclusive := null;
  else
    v_start := p_start_date::timestamp at time zone 'Asia/Seoul';
    v_end_exclusive := (p_end_date + 1)::timestamp at time zone 'Asia/Seoul';
    v_compare := coalesce(p_compare_previous, false);
    if v_compare then
      v_prev_end_exclusive := v_start;
      v_prev_start := v_start - (v_end_exclusive - v_start);
    end if;
  end if;

  return query
  with question_metadata as (
    select
      sm.legacy_problem_id as problem_id,
      v.question_id,
      v.item_number,
      v.topic_main,
      v.topic_detail,
      case v.item_number
        when 51 then jsonb_build_object(
          'blankRole', to_jsonb(array_remove(array[q51.blank_1_role, q51.blank_2_role], null)),
          'blankFunction', to_jsonb(array_remove(array[q51.blank_1_function, q51.blank_2_function], null)),
          'answerType', to_jsonb(array_remove(array[q51.blank_1_answer_type, q51.blank_2_answer_type], null))
        )
        when 52 then jsonb_build_object(
          'connectionFunction', jsonb_build_array(q52.connection_function),
          'answerScope', jsonb_build_array(q52.answer_scope_type)
        )
        when 53 then jsonb_build_object(
          'dataType', jsonb_build_array(q53.data_type),
          'requiredStructure', case when jsonb_typeof(q53.required_structure) = 'array'
            then q53.required_structure else '[]'::jsonb end
        )
        when 54 then jsonb_build_object(
          'essayType', jsonb_build_array(q54.essay_type),
          'stance', jsonb_build_array(q54.stance_requirement),
          'requiredStructure', case when jsonb_typeof(q54.required_structure) = 'array'
            then q54.required_structure else '[]'::jsonb end
        )
        else '{}'::jsonb
      end as detail_values
    from public.topik_writing_question_source_map sm
    join public.topik_writing_question_recommendation_view v
      on v.question_id = sm.question_id
     and v.item_number = sm.item_number
    left join public.topik_writing_51_questions q51
      on q51.question_id = v.question_id and v.item_number = 51
    left join public.topik_writing_52_questions q52
      on q52.question_id = v.question_id and v.item_number = 52
    left join public.topik_writing_53_questions q53
      on q53.question_id = v.question_id and v.item_number = 53
    left join public.topik_writing_54_questions q54
      on q54.question_id = v.question_id and v.item_number = 54
    where sm.legacy_problem_id is not null
      and sm.hold_reason is null
  ),
  metadata_filtered as (
    select m.*
    from question_metadata m
    where m.item_number = any(v_question_nos)
      and (p_topic_main is null or m.topic_main = p_topic_main)
      and (p_topic_detail is null or m.topic_detail = p_topic_detail)
      and not exists (
        select 1
        from jsonb_each(v_detail_filters) filter_entry
        where jsonb_array_length(filter_entry.value) > 0
          and not exists (
            select 1
            from jsonb_array_elements_text(filter_entry.value) selected(value)
            where coalesce(m.detail_values->filter_entry.key, '[]'::jsonb) ? selected.value
          )
      )
  ),
  submission_facts as (
    select
      ws.id,
      ws.user_id,
      ws.problem_id,
      m.item_number as question_no,
      m.topic_main,
      m.topic_detail,
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
      metrics.elapsed_seconds
    from public.writing_submissions ws
    join metadata_filtered m on m.problem_id = ws.problem_id
    left join public.writing_feedback wf
      on wf.submission_id = ws.id and wf.user_id = ws.user_id
    left join public.writing_submission_metrics metrics
      on metrics.submission_id = ws.id and metrics.user_id = ws.user_id
  ),
  current_subs as (
    select * from submission_facts s
    where v_start is null
       or (s.submitted_at >= v_start and s.submitted_at < v_end_exclusive)
  ),
  previous_subs as (
    select * from submission_facts s
    where v_compare
      and s.submitted_at >= v_prev_start
      and s.submitted_at < v_prev_end_exclusive
  ),
  current_active_events as (
    select se.id, se.user_id, m.item_number as question_no
    from public.study_events se
    left join public.writing_submissions event_submission
      on event_submission.id = se.submission_id
    join metadata_filtered m
      on m.problem_id = coalesce(se.problem_id, event_submission.problem_id)
    where se.event_type <> 'export_downloaded'
      and (v_start is null
        or (se.occurred_at >= v_start and se.occurred_at < v_end_exclusive))
  ),
  previous_active_events as (
    select se.id, se.user_id, m.item_number as question_no
    from public.study_events se
    left join public.writing_submissions event_submission
      on event_submission.id = se.submission_id
    join metadata_filtered m
      on m.problem_id = coalesce(se.problem_id, event_submission.problem_id)
    where v_compare
      and se.event_type <> 'export_downloaded'
      and se.occurred_at >= v_prev_start
      and se.occurred_at < v_prev_end_exclusive
  ),
  current_active_total as (
    select count(*)::integer as events
    from public.study_events se
    where se.event_type <> 'export_downloaded'
      and (v_start is null
        or (se.occurred_at >= v_start and se.occurred_at < v_end_exclusive))
  ),
  viewed_current as (
    select distinct se.submission_id
    from public.study_events se
    join current_subs s on s.id = se.submission_id
    where se.event_type = 'feedback_viewed'
  ),
  viewed_previous as (
    select distinct se.submission_id
    from public.study_events se
    join previous_subs s on s.id = se.submission_id
    where se.event_type = 'feedback_viewed'
  ),
  pdf_events as (
    select
      se.id,
      se.occurred_at,
      se.payload->>'source_type' as source_type,
      case
        when coalesce(se.payload->>'source_id', '') ~*
          '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
        then (se.payload->>'source_id')::uuid
      end as source_id
    from public.study_events se
    where se.event_type = 'export_downloaded'
  ),
  pdf_classified as (
    select
      pe.*,
      case
        when pe.source_type in ('report', 'library_selection') then 'mixed'
        when pe.source_type = 'submission' and all_meta.problem_id is not null then 'attributable'
        else 'unclassified'
      end as attribution,
      all_meta.item_number,
      filtered_meta.problem_id is not null as matches_scope
    from pdf_events pe
    left join public.writing_submissions source_submission
      on pe.source_type = 'submission' and source_submission.id = pe.source_id
    left join question_metadata all_meta
      on all_meta.problem_id = source_submission.problem_id
    left join metadata_filtered filtered_meta
      on filtered_meta.problem_id = source_submission.problem_id
  ),
  current_pdf as (
    select * from pdf_classified p
    where v_start is null
       or (p.occurred_at >= v_start and p.occurred_at < v_end_exclusive)
  ),
  previous_pdf as (
    select * from pdf_classified p
    where v_compare
      and p.occurred_at >= v_prev_start
      and p.occurred_at < v_prev_end_exclusive
  ),
  current_summary as (
    select
      count(*)::integer as submissions,
      count(distinct user_id)::integer as submitters,
      count(*) filter (where feedback_status = 'complete')::integer as feedback_complete,
      count(*) filter (where parent_submission_id is not null)::integer as resubmissions,
      round(avg(score_normalized), 1) as avg_score_normalized,
      count(elapsed_seconds)::integer as elapsed_samples,
      round(avg(elapsed_seconds))::integer as avg_elapsed_seconds,
      count(*) filter (
        where feedback_status = 'complete'
          and id in (select submission_id from viewed_current)
      )::integer as feedback_viewed_count,
      count(*) filter (
        where generated_at is not null and generated_at >= submitted_at
      )::integer as processing_samples,
      round(percentile_cont(0.5) within group (
        order by extract(epoch from (generated_at - submitted_at))
      ) filter (where generated_at is not null and generated_at >= submitted_at)::numeric)::integer
        as median_processing_seconds
    from current_subs
  ),
  previous_summary as (
    select
      count(*)::integer as submissions,
      count(*) filter (where feedback_status = 'complete')::integer as feedback_complete,
      round(avg(score_normalized), 1) as avg_score_normalized,
      round(avg(elapsed_seconds))::integer as avg_elapsed_seconds,
      count(*) filter (
        where feedback_status = 'complete'
          and id in (select submission_id from viewed_previous)
      )::integer as feedback_viewed_count,
      round(percentile_cont(0.5) within group (
        order by extract(epoch from (generated_at - submitted_at))
      ) filter (where generated_at is not null and generated_at >= submitted_at)::numeric)::integer
        as median_processing_seconds
    from previous_subs
  ),
  per_question_rows as (
    select
      selected.question_no,
      (select count(distinct ae.user_id) from current_active_events ae
        where ae.question_no = selected.question_no)::integer as active_learners,
      count(distinct s.user_id)::integer as submitters,
      count(s.id)::integer as submissions,
      case when count(s.id) > 0 then round(
        count(*) filter (where s.feedback_status = 'complete')::numeric / count(s.id) * 100, 1
      ) end as completion_rate,
      round(avg(s.score_normalized), 1) as avg_score_normalized,
      case when count(*) filter (where s.feedback_status = 'complete') > 0 then round(
        count(*) filter (
          where s.feedback_status = 'complete'
            and s.id in (select submission_id from viewed_current)
        )::numeric / count(*) filter (where s.feedback_status = 'complete') * 100, 1
      ) end as feedback_view_rate,
      round(avg(s.elapsed_seconds))::integer as avg_elapsed_seconds,
      count(s.elapsed_seconds)::integer as elapsed_samples,
      case when count(s.id) > 0 then round(
        count(*) filter (where s.parent_submission_id is not null)::numeric / count(s.id) * 100, 1
      ) end as resubmission_rate,
      (select count(*) from current_pdf p
        where p.attribution = 'attributable'
          and p.matches_scope
          and p.item_number = selected.question_no)::integer as pdf_exports
    from unnest(v_question_nos) selected(question_no)
    left join current_subs s on s.question_no = selected.question_no
    group by selected.question_no
    order by selected.question_no
  ),
  bucket_definitions as (
    select * from (values
      (1, '0-40', 0::numeric, 40::numeric),
      (2, '41-60', 40::numeric, 60::numeric),
      (3, '61-80', 60::numeric, 80::numeric),
      (4, '81-100', 80::numeric, 100::numeric)
    ) b(bucket, label, lower_bound, upper_bound)
  ),
  distribution_rows as (
    select
      selected.question_no,
      b.bucket,
      b.label,
      count(s.id) filter (
        where s.score_normalized is not null
          and case when b.bucket = 1
            then s.score_normalized >= b.lower_bound and s.score_normalized <= b.upper_bound
            else s.score_normalized > b.lower_bound and s.score_normalized <= b.upper_bound end
      )::integer as count,
      case when count(s.id) filter (where s.score_normalized is not null) > 0 then round(
        count(s.id) filter (
          where s.score_normalized is not null
            and case when b.bucket = 1
              then s.score_normalized >= b.lower_bound and s.score_normalized <= b.upper_bound
              else s.score_normalized > b.lower_bound and s.score_normalized <= b.upper_bound end
        )::numeric / count(s.id) filter (where s.score_normalized is not null) * 100, 1
      ) end as percentage
    from unnest(v_question_nos) selected(question_no)
    cross join bucket_definitions b
    left join current_subs s on s.question_no = selected.question_no
    group by selected.question_no, b.bucket, b.label, b.lower_bound, b.upper_bound
    order by selected.question_no, b.bucket
  ),
  dimension_rows as (
    select
      s.question_no,
      fds.dimension,
      round(avg(
        case when coalesce(fds.score_max, 0) > 0
          then fds.score::numeric / fds.score_max * 100 end
      ), 1) as avg_score_normalized,
      count(distinct fds.submission_id)::integer as submissions,
      count(*) filter (where coalesce(fds.weakness_level, 0) > 0)::integer
        as weakness_occurrences,
      coalesce(max(fds.weakness_level), 0)::integer as max_severity
    from current_subs s
    join public.feedback_dimension_scores fds
      on fds.submission_id = s.id and fds.user_id = s.user_id
    group by s.question_no, fds.dimension
    order by s.question_no, avg_score_normalized asc nulls last, fds.dimension
  ),
  current_topics as (
    select
      s.question_no,
      s.topic_main,
      s.topic_detail,
      count(*)::integer as submissions,
      round(avg(s.score_normalized), 1) as avg_score_normalized
    from current_subs s
    group by s.question_no, s.topic_main, s.topic_detail
  ),
  previous_topics as (
    select
      s.question_no,
      s.topic_main,
      s.topic_detail,
      round(avg(s.score_normalized), 1) as avg_score_normalized
    from previous_subs s
    group by s.question_no, s.topic_main, s.topic_detail
  ),
  topic_rows as (
    select
      c.question_no,
      c.topic_main,
      c.topic_detail,
      c.submissions,
      c.avg_score_normalized,
      case when v_compare then p.avg_score_normalized end as avg_score_normalized_prev,
      sum(c.submissions) over (partition by c.topic_main, c.topic_detail) as topic_total
    from current_topics c
    left join previous_topics p
      on p.question_no = c.question_no
     and p.topic_main = c.topic_main
     and p.topic_detail = c.topic_detail
  ),
  pdf_per_question as (
    select
      selected.question_no,
      count(p.id) filter (
        where p.attribution = 'attributable' and p.matches_scope
      )::integer as count
    from unnest(v_question_nos) selected(question_no)
    left join current_pdf p on p.item_number = selected.question_no
    group by selected.question_no
    order by selected.question_no
  ),
  dimension_coverage as (
    select count(distinct fds.submission_id)::integer as submissions
    from public.feedback_dimension_scores fds
    where fds.submission_id in (select id from current_subs)
  )
  select
    jsonb_build_object(
      'periodDays', case when p_start_date is null then null
        else (p_end_date - p_start_date) + 1 end,
      'activeLearners', (select count(distinct user_id) from current_active_events),
      'activeLearnersPrev', case when v_compare
        then (select count(distinct user_id) from previous_active_events) end,
      'submitters', cs.submitters,
      'submissions', cs.submissions,
      'submissionsPrev', case when v_compare then ps.submissions end,
      'feedbackComplete', cs.feedback_complete,
      'completionRate', case when cs.submissions > 0
        then round(cs.feedback_complete::numeric / cs.submissions * 100, 1) end,
      'completionRatePrev', case when v_compare and ps.submissions > 0
        then round(ps.feedback_complete::numeric / ps.submissions * 100, 1) end,
      'avgScoreNormalized', cs.avg_score_normalized,
      'avgScoreNormalizedPrev', case when v_compare then ps.avg_score_normalized end,
      'feedbackViewedCount', cs.feedback_viewed_count,
      'feedbackViewRate', case when cs.feedback_complete > 0
        then round(cs.feedback_viewed_count::numeric / cs.feedback_complete * 100, 1) end,
      'feedbackViewRatePrev', case when v_compare and ps.feedback_complete > 0
        then round(ps.feedback_viewed_count::numeric / ps.feedback_complete * 100, 1) end,
      'avgElapsedSeconds', cs.avg_elapsed_seconds,
      'avgElapsedSecondsPrev', case when v_compare then ps.avg_elapsed_seconds end,
      'elapsedSamples', cs.elapsed_samples,
      'medianProcessingSeconds', cs.median_processing_seconds,
      'medianProcessingSecondsPrev', case when v_compare then ps.median_processing_seconds end,
      'processingSamples', cs.processing_samples,
      'resubmissions', cs.resubmissions,
      'pdfExports', (select count(*) from current_pdf p
        where p.attribution = 'attributable' and p.matches_scope),
      'pdfExportsPrev', case when v_compare then (select count(*) from previous_pdf p
        where p.attribution = 'attributable' and p.matches_scope) end,
      'activeEventsTotal', at.events,
      'activeEventsAttributed', (select count(*) from current_active_events),
      'activeEventAttributionRate', case when at.events > 0 then round(
        (select count(*) from current_active_events)::numeric / at.events * 100, 1
      ) end,
      'dimensionCoverageSubmissions', dc.submissions
    ) as summary,
    coalesce((select jsonb_agg(jsonb_build_object(
      'questionNo', q.question_no,
      'activeLearners', q.active_learners,
      'submitters', q.submitters,
      'submissions', q.submissions,
      'completionRate', q.completion_rate,
      'avgScoreNormalized', q.avg_score_normalized,
      'feedbackViewRate', q.feedback_view_rate,
      'avgElapsedSeconds', q.avg_elapsed_seconds,
      'elapsedSamples', q.elapsed_samples,
      'resubmissionRate', q.resubmission_rate,
      'pdfExports', q.pdf_exports
    ) order by q.question_no) from per_question_rows q), '[]'::jsonb) as per_question,
    coalesce((select jsonb_agg(jsonb_build_object(
      'questionNo', d.question_no,
      'bucket', d.bucket,
      'label', d.label,
      'count', d.count,
      'percentage', d.percentage
    ) order by d.question_no, d.bucket) from distribution_rows d), '[]'::jsonb)
      as score_distribution,
    coalesce((select jsonb_agg(jsonb_build_object(
      'questionNo', d.question_no,
      'dimension', d.dimension,
      'avgScoreNormalized', d.avg_score_normalized,
      'submissions', d.submissions,
      'weaknessOccurrences', d.weakness_occurrences,
      'maxSeverity', d.max_severity
    ) order by d.question_no, d.avg_score_normalized asc nulls last, d.dimension)
      from dimension_rows d), '[]'::jsonb) as weak_dimensions,
    coalesce((select jsonb_agg(jsonb_build_object(
      'questionNo', t.question_no,
      'topicMain', t.topic_main,
      'topicDetail', t.topic_detail,
      'submissions', t.submissions,
      'avgScoreNormalized', t.avg_score_normalized,
      'avgScoreNormalizedPrev', t.avg_score_normalized_prev
    ) order by t.topic_total desc, t.topic_main, t.topic_detail, t.question_no)
      from topic_rows t), '[]'::jsonb) as topic_stats,
    jsonb_build_object(
      'totalExports', (select count(*) from current_pdf p
        where (p.attribution = 'attributable' and p.matches_scope)
           or p.attribution in ('mixed', 'unclassified')),
      'attributableExports', (select count(*) from current_pdf p
        where p.attribution = 'attributable' and p.matches_scope),
      'mixedExports', (select count(*) from current_pdf p where p.attribution = 'mixed'),
      'unclassifiedExports', (select count(*) from current_pdf p where p.attribution = 'unclassified'),
      'attributionRate', case when (select count(*) from current_pdf p
        where (p.attribution = 'attributable' and p.matches_scope)
           or p.attribution in ('mixed', 'unclassified')) > 0 then round(
        (select count(*) from current_pdf p
          where p.attribution = 'attributable' and p.matches_scope)::numeric
          / (select count(*) from current_pdf p
              where (p.attribution = 'attributable' and p.matches_scope)
                 or p.attribution in ('mixed', 'unclassified')) * 100, 1
      ) end,
      'perQuestion', coalesce((select jsonb_agg(jsonb_build_object(
        'questionNo', p.question_no,
        'count', p.count
      ) order by p.question_no) from pdf_per_question p), '[]'::jsonb)
    ) as pdf_usage,
    jsonb_build_object(
      'startDate', p_start_date,
      'endDate', p_end_date,
      'allTime', p_start_date is null,
      'comparePrevious', v_compare,
      'compareStartDate', case when v_compare
        then (v_prev_start at time zone 'Asia/Seoul')::date end,
      'compareEndDate', case when v_compare
        then ((v_prev_end_exclusive at time zone 'Asia/Seoul')::date - 1) end,
      'questions', to_jsonb(v_question_nos),
      'topicMain', p_topic_main,
      'topicDetail', p_topic_detail,
      'detailFilters', v_detail_filters,
      'generatedAt', now()
    ) as scope
  from current_summary cs
  cross join previous_summary ps
  cross join current_active_total at
  cross join dimension_coverage dc;
end;
$$;

revoke all on function public.get_admin_learning_analytics_filtered(
  date, date, smallint[], text, text, jsonb, boolean
) from public;
grant execute on function public.get_admin_learning_analytics_filtered(
  date, date, smallint[], text, text, jsonb, boolean
) to authenticated;

comment on function public.get_admin_learning_analytics_filtered(
  date, date, smallint[], text, text, jsonb, boolean
) is
  'Analytics 학습 분석 전역 조건 집계. private.is_admin 전용 read-only, 개인 식별자/답안 원문 미반환. '
  'KST 날짜·51~54·신규 topic_main/topic_detail·유형별 세부 조건을 모든 섹션에 동일 적용한다. '
  'PDF는 export_downloaded 내보내기 완료 텔레메트리이며 실제 파일 저장 완료를 의미하지 않는다. '
  '주제별 성과(topic_stats)는 문제 유형(51~54) × 대주제 × 세부 주제 단위로 분해해 반환한다.';
