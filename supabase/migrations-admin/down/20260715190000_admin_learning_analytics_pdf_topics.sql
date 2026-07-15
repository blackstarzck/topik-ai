-- Analytics > 학습 분석: pdf_usage.perTopic 확장을 제거하고 20260715173826 계약으로 복원한다.

begin;

do $migration$
declare
  v_identity regprocedure := to_regprocedure(
    'public.get_admin_learning_analytics_filtered(date,date,smallint[],text,text,jsonb,boolean)'
  );
  v_definition text;
begin
  if v_identity is null then
    raise exception 'learning analytics RPC is missing; refusing PDF topic rollback';
  end if;

  select pg_get_functiondef(v_identity) into v_definition;

  if position('all_meta.topic_main as topic_main' in v_definition) = 0
     or position('pdf_per_topic as' in v_definition) = 0
     or position('''perTopic''' in v_definition) = 0 then
    raise exception 'learning analytics PDF topic contract is missing; refusing rollback';
  end if;

  v_definition := replace(
    v_definition,
    $old_projection$      end as attribution,
      all_meta.topic_main as topic_main,
      all_meta.topic_detail as topic_detail,$old_projection$,
    '      end as attribution,'
  );

  v_definition := replace(
    v_definition,
    $old_cte$  pdf_per_topic as (
    select
      p.item_number as question_no,
      p.topic_main,
      p.topic_detail,
      count(*)::integer as count
    from current_pdf p
    where p.attribution = 'attributable'
      and p.matches_scope
    group by p.item_number, p.topic_main, p.topic_detail
  ),
  pdf_per_question as ($old_cte$,
    '  pdf_per_question as ('
  );

  v_definition := replace(
    v_definition,
    $old_tail$      ) order by p.question_no) from pdf_per_question p), '[]'::jsonb),
      'perTopic', coalesce((select jsonb_agg(jsonb_build_object(
        'questionNo', p.question_no,
        'topicMain', p.topic_main,
        'topicDetail', p.topic_detail,
        'count', p.count
      ) order by p.count desc, p.question_no, p.topic_main nulls last, p.topic_detail nulls last)
        from pdf_per_topic p), '[]'::jsonb)
    ) as pdf_usage,$old_tail$,
    $new_tail$      ) order by p.question_no) from pdf_per_question p), '[]'::jsonb)
    ) as pdf_usage,$new_tail$
  );

  if position('all_meta.topic_main as topic_main' in v_definition) > 0
     or position('pdf_per_topic as' in v_definition) > 0
     or position('''perTopic''' in v_definition) > 0
     or position('submission_metadata_facts as' in v_definition) = 0
     or position('event_metadata_coverage as' in v_definition) = 0
     or position('topic_total' in v_definition) = 0
     or position('private.is_admin' in v_definition) = 0 then
    raise exception 'learning analytics PDF topic rollback incomplete';
  end if;

  execute v_definition;
end
$migration$;

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
  'KST 날짜·51~54는 problems.question_no fallback을 포함하고, topic_main/topic_detail·세부 조건은 canonical+alias 통합 매핑 제출에 적용한다. '
  '주제 통계는 문항별 행을 반환하고 동일 주제의 전체 제출 수 기준으로 정렬한다. '
  'metadata coverage는 topic/detail과 독립된 기간·문항 분모로 제출·이벤트 연결 상태를 반환한다. '
  'PDF는 export_downloaded 내보내기 완료 텔레메트리이며 실제 파일 저장 완료를 의미하지 않는다.';

commit;
