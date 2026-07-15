-- Analytics > 학습 분석: 문제 유형별 주제 분해만 제거한다.
-- metadata coverage·identity·필터 계약은 유지한 채 topic_stats를
-- 직전 대주제×세부 주제 집계로 fail-closed 방식으로 복원한다.

begin;

do $migration$
declare
  v_identity regprocedure := to_regprocedure(
    'public.get_admin_learning_analytics_filtered(date,date,smallint[],text,text,jsonb,boolean)'
  );
  v_definition text;
begin
  if v_identity is null then
    raise exception 'learning analytics RPC is missing; refusing topic stats rollback';
  end if;

  select pg_get_functiondef(v_identity) into v_definition;

  if position('submission_metadata_facts as' in v_definition) = 0
     or position('event_metadata_coverage as' in v_definition) = 0
     or position('''metadataEligibleSubmissions''' in v_definition) = 0
     or position('topic_total' in v_definition) = 0
     or position('''questionNo'', t.question_no' in v_definition) = 0
     or position('private.is_admin' in v_definition) = 0 then
    raise exception 'learning analytics topic contract is missing; refusing rollback';
  end if;

  if position(
       $current_topics$  current_topics as (
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
  ),$current_topics$
       in v_definition
     ) = 0
     or position(
       $current_json$    coalesce((select jsonb_agg(jsonb_build_object(
      'questionNo', t.question_no,
      'topicMain', t.topic_main,
      'topicDetail', t.topic_detail,
      'submissions', t.submissions,
      'avgScoreNormalized', t.avg_score_normalized,
      'avgScoreNormalizedPrev', t.avg_score_normalized_prev
    ) order by t.topic_total desc, t.topic_main, t.topic_detail, t.question_no)
      from topic_rows t), '[]'::jsonb) as topic_stats,$current_json$
       in v_definition
     ) = 0 then
    raise exception 'unexpected learning analytics topic definition; refusing rollback';
  end if;

  v_definition := replace(
    v_definition,
    $current_topics$  current_topics as (
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
  ),$current_topics$,
    $previous_topics$  current_topics as (
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
  ),$previous_topics$
  );

  v_definition := replace(
    v_definition,
    $current_json$    coalesce((select jsonb_agg(jsonb_build_object(
      'questionNo', t.question_no,
      'topicMain', t.topic_main,
      'topicDetail', t.topic_detail,
      'submissions', t.submissions,
      'avgScoreNormalized', t.avg_score_normalized,
      'avgScoreNormalizedPrev', t.avg_score_normalized_prev
    ) order by t.topic_total desc, t.topic_main, t.topic_detail, t.question_no)
      from topic_rows t), '[]'::jsonb) as topic_stats,$current_json$,
    $previous_json$    coalesce((select jsonb_agg(jsonb_build_object(
      'topicMain', t.topic_main,
      'topicDetail', t.topic_detail,
      'submissions', t.submissions,
      'avgScoreNormalized', t.avg_score_normalized,
      'avgScoreNormalizedPrev', t.avg_score_normalized_prev
    ) order by t.submissions desc, t.topic_main, t.topic_detail)
      from topic_rows t), '[]'::jsonb) as topic_stats,$previous_json$
  );

  if position('submission_metadata_facts as' in v_definition) = 0
     or position('event_metadata_coverage as' in v_definition) = 0
     or position('''metadataEligibleSubmissions''' in v_definition) = 0
     or position('topic_total' in v_definition) > 0
     or position('''questionNo'', t.question_no' in v_definition) > 0
     or position('private.is_admin' in v_definition) = 0 then
    raise exception 'learning analytics topic stats rollback incomplete';
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
  'metadata coverage·identity·필터 계약을 보존한다. '
  'topic_stats는 직전 대주제×세부 주제 단위로 복원한다.';

commit;
