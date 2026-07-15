-- Analytics > 학습 분석: canonical identity projection 적용만 되돌린다.
-- 20260715130000이 보존한 metadata coverage와 문항별 topic_stats 계약은 유지한다.

begin;

do $migration$
declare
  v_identity regprocedure := to_regprocedure(
    'public.get_admin_learning_analytics_filtered(date,date,smallint[],text,text,jsonb,boolean)'
  );
  v_definition text;
  v_uses_private_identity boolean;
begin
  if v_identity is null then
    raise exception 'learning analytics RPC is missing; refusing metadata restore rollback';
  end if;

  select pg_get_functiondef(v_identity) into v_definition;

  if position('submission_metadata_facts as' in v_definition) = 0
     or position('event_metadata_coverage as' in v_definition) = 0
     or position('''metadataEligibleSubmissions''' in v_definition) = 0
     or position('topic_total' in v_definition) = 0
     or position('''questionNo'', t.question_no' in v_definition) = 0
     or position('private.is_admin' in v_definition) = 0 then
    raise exception 'learning analytics metadata/topic contract is missing; refusing rollback';
  end if;

  v_uses_private_identity := position(
    'from private.admin_writing_question_identity_map pm' in v_definition
  ) > 0;

  if v_uses_private_identity then
    if position(
         'private.admin_writing_problem_identity_projection mapped_problem' in v_definition
       ) = 0
       or position(
         'private.admin_writing_problem_identity_projection problem' in v_definition
       ) = 0
       or position(
         'private.admin_writing_problem_identity_projection source_problem' in v_definition
       ) = 0 then
      raise exception 'learning analytics private identity contract is partial; refusing rollback';
    end if;

    v_definition := replace(
      v_definition,
      'from private.admin_writing_question_identity_map pm',
      'from public.topik_writing_problem_question_map pm'
    );
    v_definition := replace(
      v_definition,
      'private.admin_writing_problem_identity_projection mapped_problem',
      'public.problems mapped_problem'
    );
    v_definition := replace(
      v_definition,
      'private.admin_writing_problem_identity_projection problem',
      'public.problems problem'
    );
    v_definition := replace(
      v_definition,
      'private.admin_writing_problem_identity_projection source_problem',
      'public.problems source_problem'
    );
    v_definition := replace(v_definition, 'problem.problem_id', 'problem.id');
    v_definition := replace(
      v_definition,
      'problem.item_number',
      'problem.question_no'
    );
  elsif position(
          'from public.topik_writing_problem_question_map pm' in v_definition
        ) = 0
        or position('public.problems mapped_problem' in v_definition) = 0
        or position('public.problems problem' in v_definition) = 0
        or position('public.problems source_problem' in v_definition) = 0 then
    raise exception 'learning analytics public identity contract is missing; refusing rollback';
  end if;

  if position('submission_metadata_facts as' in v_definition) = 0
     or position('event_metadata_coverage as' in v_definition) = 0
     or position('''metadataEligibleSubmissions''' in v_definition) = 0
     or position('topic_total' in v_definition) = 0
     or position('''questionNo'', t.question_no' in v_definition) = 0
     or position('from public.topik_writing_problem_question_map pm' in v_definition) = 0
     or position('public.problems problem' in v_definition) = 0
     or position('private.is_admin' in v_definition) = 0 then
    raise exception 'learning analytics metadata restore rollback incomplete';
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
  'metadata coverage와 문제 유형별 topic_stats 계약을 유지하며 public identity 관계로 복원한다.';

commit;
