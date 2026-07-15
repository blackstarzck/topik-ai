-- Analytics > 학습 분석: 주제별 성과를 문제 유형(51~54)별로 분해한다.
-- 직전 최신 RPC의 metadata coverage·identity 계약은 그대로 보존하고
-- topic_stats 집계와 응답 projection만 fail-closed 방식으로 교체한다.

begin;

do $migration$
declare
  v_identity regprocedure := to_regprocedure(
    'public.get_admin_learning_analytics_filtered(date,date,smallint[],text,text,jsonb,boolean)'
  );
  v_definition text;
begin
  if v_identity is null then
    raise exception 'learning analytics RPC is missing; refusing topic stats extension';
  end if;

  select pg_get_functiondef(v_identity) into v_definition;

  if position('submission_metadata_facts as' in v_definition) = 0
     or position('event_metadata_coverage as' in v_definition) = 0
     or position('''metadataEligibleSubmissions''' in v_definition) = 0
     or position('private.is_admin' in v_definition) = 0 then
    raise exception 'learning analytics latest contract is missing; refusing topic stats extension';
  end if;

  if position('topic_total' in v_definition) > 0
     or position('''questionNo'', t.question_no' in v_definition) > 0 then
    raise exception 'learning analytics per-question topic contract already exists';
  end if;

  if position(
       $old_topics$  current_topics as (
    select
      s.topic_main,
      s.topic_detail,
      count(*)::integer as submissions,
      round(avg(s.score_normalized), 1) as avg_score_normalized
    from current_subs s
    where s.topic_main is not null
      and s.topic_detail is not null
    group by s.topic_main, s.topic_detail
  ),
  previous_topics as (
    select
      s.topic_main,
      s.topic_detail,
      round(avg(s.score_normalized), 1) as avg_score_normalized
    from previous_subs s
    where s.topic_main is not null
      and s.topic_detail is not null
    group by s.topic_main, s.topic_detail
  ),
  topic_rows as (
    select
      c.topic_main,
      c.topic_detail,
      c.submissions,
      c.avg_score_normalized,
      case when v_compare then p.avg_score_normalized end as avg_score_normalized_prev
    from current_topics c
    left join previous_topics p
      on p.topic_main = c.topic_main and p.topic_detail = c.topic_detail
    order by c.submissions desc, c.topic_main, c.topic_detail
  ),$old_topics$
       in v_definition
     ) = 0
     or position(
       $old_json$    coalesce((select jsonb_agg(jsonb_build_object(
      'topicMain', t.topic_main,
      'topicDetail', t.topic_detail,
      'submissions', t.submissions,
      'avgScoreNormalized', t.avg_score_normalized,
      'avgScoreNormalizedPrev', t.avg_score_normalized_prev
    ) order by t.submissions desc, t.topic_main, t.topic_detail)
      from topic_rows t), '[]'::jsonb) as topic_stats,$old_json$
       in v_definition
     ) = 0 then
    raise exception 'unexpected learning analytics topic definition; refusing rewrite';
  end if;

  v_definition := replace(
    v_definition,
    $old_topics$  current_topics as (
    select
      s.topic_main,
      s.topic_detail,
      count(*)::integer as submissions,
      round(avg(s.score_normalized), 1) as avg_score_normalized
    from current_subs s
    where s.topic_main is not null
      and s.topic_detail is not null
    group by s.topic_main, s.topic_detail
  ),
  previous_topics as (
    select
      s.topic_main,
      s.topic_detail,
      round(avg(s.score_normalized), 1) as avg_score_normalized
    from previous_subs s
    where s.topic_main is not null
      and s.topic_detail is not null
    group by s.topic_main, s.topic_detail
  ),
  topic_rows as (
    select
      c.topic_main,
      c.topic_detail,
      c.submissions,
      c.avg_score_normalized,
      case when v_compare then p.avg_score_normalized end as avg_score_normalized_prev
    from current_topics c
    left join previous_topics p
      on p.topic_main = c.topic_main and p.topic_detail = c.topic_detail
    order by c.submissions desc, c.topic_main, c.topic_detail
  ),$old_topics$,
    $new_topics$  current_topics as (
    select
      s.question_no,
      s.topic_main,
      s.topic_detail,
      count(*)::integer as submissions,
      round(avg(s.score_normalized), 1) as avg_score_normalized
    from current_subs s
    where s.topic_main is not null
      and s.topic_detail is not null
    group by s.question_no, s.topic_main, s.topic_detail
  ),
  previous_topics as (
    select
      s.question_no,
      s.topic_main,
      s.topic_detail,
      round(avg(s.score_normalized), 1) as avg_score_normalized
    from previous_subs s
    where s.topic_main is not null
      and s.topic_detail is not null
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
  ),$new_topics$
  );

  v_definition := replace(
    v_definition,
    $old_json$    coalesce((select jsonb_agg(jsonb_build_object(
      'topicMain', t.topic_main,
      'topicDetail', t.topic_detail,
      'submissions', t.submissions,
      'avgScoreNormalized', t.avg_score_normalized,
      'avgScoreNormalizedPrev', t.avg_score_normalized_prev
    ) order by t.submissions desc, t.topic_main, t.topic_detail)
      from topic_rows t), '[]'::jsonb) as topic_stats,$old_json$,
    $new_json$    coalesce((select jsonb_agg(jsonb_build_object(
      'questionNo', t.question_no,
      'topicMain', t.topic_main,
      'topicDetail', t.topic_detail,
      'submissions', t.submissions,
      'avgScoreNormalized', t.avg_score_normalized,
      'avgScoreNormalizedPrev', t.avg_score_normalized_prev
    ) order by t.topic_total desc, t.topic_main, t.topic_detail, t.question_no)
      from topic_rows t), '[]'::jsonb) as topic_stats,$new_json$
  );

  if position('submission_metadata_facts as' in v_definition) = 0
     or position('event_metadata_coverage as' in v_definition) = 0
     or position('''metadataEligibleSubmissions''' in v_definition) = 0
     or position('topic_total' in v_definition) = 0
     or position('''questionNo'', t.question_no' in v_definition) = 0
     or position('private.is_admin' in v_definition) = 0 then
    raise exception 'learning analytics topic stats rewrite incomplete';
  end if;

  execute v_definition;
end
$migration$;

revoke all on function public.get_admin_learning_analytics_filtered(
  date, date, smallint[], text, text, jsonb, boolean
) from public;
revoke all on function public.get_admin_learning_analytics_filtered(
  date, date, smallint[], text, text, jsonb, boolean
) from anon;
grant execute on function public.get_admin_learning_analytics_filtered(
  date, date, smallint[], text, text, jsonb, boolean
) to authenticated;

comment on function public.get_admin_learning_analytics_filtered(
  date, date, smallint[], text, text, jsonb, boolean
) is
  'Analytics 학습 분석 전역 조건 집계. private.is_admin 전용 read-only, 개인 식별자/답안 원문 미반환. '
  '직전 최신 metadata coverage·identity·필터 계약을 보존한다. '
  'topic_stats는 문제 유형(51~54)×대주제×세부 주제 단위로 반환한다.';

commit;
