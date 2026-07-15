-- Analytics > 학습 분석: PDF 내보내기 완료 이벤트를 문제 유형 × 주제 단위로 확장한다.
-- 기존 최신 함수(20260715173826)의 metadata coverage·canonical identity 계약을 보존하며
-- pdf_usage.perTopic만 fail-closed 방식으로 추가한다.

begin;

do $migration$
declare
  v_identity regprocedure := to_regprocedure(
    'public.get_admin_learning_analytics_filtered(date,date,smallint[],text,text,jsonb,boolean)'
  );
  v_definition text;
begin
  if v_identity is null then
    raise exception 'learning analytics RPC is missing; refusing PDF topic extension';
  end if;

  select pg_get_functiondef(v_identity) into v_definition;

  if position('submission_metadata_facts as' in v_definition) = 0
     or position('event_metadata_coverage as' in v_definition) = 0
     or position('topic_total' in v_definition) = 0
     or position('private.is_admin' in v_definition) = 0 then
    raise exception 'learning analytics latest contract is missing; refusing PDF topic extension';
  end if;

  if position('''perTopic''' in v_definition) > 0
     or position('pdf_per_topic as' in v_definition) > 0 then
    raise exception 'learning analytics PDF topic contract already exists';
  end if;

  if position('      end as attribution,' in v_definition) = 0
     or position('  pdf_per_question as (' in v_definition) = 0
     or position(
       $old_tail$      ) order by p.question_no) from pdf_per_question p), '[]'::jsonb)
    ) as pdf_usage,$old_tail$
       in v_definition
     ) = 0 then
    raise exception 'unexpected learning analytics PDF definition; refusing rewrite';
  end if;

  v_definition := replace(
    v_definition,
    '      end as attribution,',
    $new_projection$      end as attribution,
      all_meta.topic_main as topic_main,
      all_meta.topic_detail as topic_detail,$new_projection$
  );

  v_definition := replace(
    v_definition,
    '  pdf_per_question as (',
    $new_cte$  pdf_per_topic as (
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
  pdf_per_question as ($new_cte$
  );

  v_definition := replace(
    v_definition,
    $old_tail$      ) order by p.question_no) from pdf_per_question p), '[]'::jsonb)
    ) as pdf_usage,$old_tail$,
    $new_tail$      ) order by p.question_no) from pdf_per_question p), '[]'::jsonb),
      'perTopic', coalesce((select jsonb_agg(jsonb_build_object(
        'questionNo', p.question_no,
        'topicMain', p.topic_main,
        'topicDetail', p.topic_detail,
        'count', p.count
      ) order by p.count desc, p.question_no, p.topic_main nulls last, p.topic_detail nulls last)
        from pdf_per_topic p), '[]'::jsonb)
    ) as pdf_usage,$new_tail$
  );

  if position('all_meta.topic_main as topic_main' in v_definition) = 0
     or position('pdf_per_topic as' in v_definition) = 0
     or position('''perTopic''' in v_definition) = 0
     or position('submission_metadata_facts as' in v_definition) = 0
     or position('event_metadata_coverage as' in v_definition) = 0
     or position('topic_total' in v_definition) = 0
     or position('private.is_admin' in v_definition) = 0 then
    raise exception 'learning analytics PDF topic rewrite incomplete';
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
  'KST 날짜·51~54와 canonical topic_main/topic_detail·세부 조건을 모든 분석 블록에 동일 적용한다. '
  'pdf_usage.perTopic은 직접 귀속 export_downloaded 이벤트를 문제 유형×대주제×세부 주제 단위로 반환하며 혼합·미분류는 주제로 배분하지 않는다. '
  'PDF는 내보내기 완료 텔레메트리이며 실제 파일 저장 완료를 의미하지 않는다.';

commit;
