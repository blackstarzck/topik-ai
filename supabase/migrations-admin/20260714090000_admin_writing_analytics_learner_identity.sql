-- Admin analytics canonical writing identity correction.
--
-- Read/reference dependencies owned outside the admin domain:
--   topik_writing_question_source_map, topik_writing_question_recommendation_view,
--   topik_writing_question_tags, writing_submissions, writing_feedback,
--   writing_submission_metrics, study_events.
-- This migration defines only admin-owned read interfaces. It does not write or
-- alter any v13-owned or topik_writing-owned table.
--
-- Dependency: topik_writing migration
--   20260713080015_topik_writing_canonical_read_contract.sql
-- must be applied first so learner_problem_id exists.

do $$
begin
  if not exists (
    select 1
      from information_schema.columns
     where table_schema = 'public'
       and table_name = 'topik_writing_question_source_map'
       and column_name = 'learner_problem_id'
  ) then
    raise exception 'missing topik_writing dependency: learner_problem_id';
  end if;
end
$$;

create table if not exists private.admin_writing_analytics_rollback_function (
  function_key text primary key,
  function_definition text not null
);

revoke all on table private.admin_writing_analytics_rollback_function from public;
revoke all on table private.admin_writing_analytics_rollback_function from anon;
revoke all on table private.admin_writing_analytics_rollback_function from authenticated;
revoke all on table private.admin_writing_analytics_rollback_function from service_role;

insert into private.admin_writing_analytics_rollback_function (
  function_key,
  function_definition
)
select
  target.function_key,
  pg_get_functiondef(target.function_oid)
from (
  values
    (
      'get_admin_user_learning_overview',
      to_regprocedure('public.get_admin_user_learning_overview(uuid)')::oid
    ),
    (
      'get_admin_learning_analytics',
      to_regprocedure('public.get_admin_learning_analytics(integer)')::oid
    ),
    (
      'get_admin_learning_analytics_filtered',
      to_regprocedure(
        'public.get_admin_learning_analytics_filtered(date,date,smallint[],text,text,jsonb,boolean)'
      )::oid
    )
) target(function_key, function_oid)
where target.function_oid is not null
on conflict (function_key) do nothing;

do $$
begin
  if (
    select count(*)
      from private.admin_writing_analytics_rollback_function
  ) <> 3 then
    raise exception 'admin writing analytics rollback backup incomplete';
  end if;
end
$$;

create or replace view private.admin_writing_question_metadata
with (security_invoker = true)
as
select
  sm.learner_problem_id as problem_id,
  v.question_id,
  v.item_number,
  coalesce(
    nullif(imp.raw_payload->>'topic_seed_title', ''),
    nullif(imp.raw_payload#>>'{approved_topic_seed,topic_seed_title}', ''),
    nullif(imp.raw_payload#>>'{scenario_logic,scenario_title}', ''),
    nullif(imp.raw_payload->>'situation_summary', ''),
    nullif(imp.raw_payload->>'topic_main', ''),
    '쓰기 문제'
  ) as problem_title,
  coalesce((
    select array_agg(tag_value order by first_order, tag_value collate "C")
      from (
        select value as tag_value, min(sort_order) as first_order
          from (
            values
              (v.topic_main, 1),
              (v.topic_detail, 2),
              (v.speech_act, 3),
              (v.scenario_type, 4)
            union all
            select coalesce(nullif(t.tag_value, ''), t.tag_code), 10
              from public.topik_writing_question_tags t
             where t.question_id = v.question_id
               and t.item_number = v.item_number
               and t.is_active
          ) raw_tags(value, sort_order)
         where nullif(btrim(value), '') is not null
         group by value
      ) deduplicated_tags
  ), '{}'::text[]) as problem_tags
from public.topik_writing_question_source_map sm
join public.topik_writing_question_recommendation_view v
  on v.question_id = sm.question_id
 and v.item_number = sm.item_number
join public.topik_writing_question_import imp
  on imp.import_id = sm.canonical_import_id
 and imp.source_task_id = sm.question_id
 and imp.item_number = sm.item_number
 and imp.mapping_status = 'promoted'
where sm.canonical_import_id is not null
  and sm.hold_reason is null;

revoke all on private.admin_writing_question_metadata from public;
revoke all on private.admin_writing_question_metadata from anon;
revoke all on private.admin_writing_question_metadata from authenticated;
revoke all on private.admin_writing_question_metadata from service_role;

comment on view private.admin_writing_question_metadata is
  'Admin-only canonical metadata keyed by deterministic learner_problem_id. Replaces current-content reads from the retained problems mirror.';

do $$
declare
  v_identity regprocedure := to_regprocedure('public.get_admin_user_learning_overview(uuid)');
  v_definition text;
begin
  if v_identity is null then
    raise exception 'missing admin dependency: get_admin_user_learning_overview(uuid)';
  end if;
  select pg_get_functiondef(v_identity) into v_definition;

  if (length(v_definition) - length(replace(v_definition, 'p.title', ''))) /
       length('p.title') = 1
     and (length(v_definition) - length(replace(v_definition, 'p.tags', ''))) /
       length('p.tags') = 1
     and position(
       'left join public.problems p on p.id = ws.problem_id' in v_definition
     ) > 0 then
    v_definition := replace(v_definition, 'p.title', 'p.problem_title');
    v_definition := replace(v_definition, 'p.tags', 'p.problem_tags');
    v_definition := replace(
      v_definition,
      'left join public.problems p on p.id = ws.problem_id',
      'left join private.admin_writing_question_metadata p on p.problem_id = ws.problem_id'
    );
    execute v_definition;
  elsif position('p.problem_title' in v_definition) > 0
     and position('p.problem_tags' in v_definition) > 0
     and position(
       'left join private.admin_writing_question_metadata p on p.problem_id = ws.problem_id'
       in v_definition
     ) > 0 then
    null;
  else
    raise exception 'unexpected get_admin_user_learning_overview definition; refusing stale rewrite';
  end if;
end
$$;

do $$
declare
  v_identity regprocedure := to_regprocedure('public.get_admin_learning_analytics(integer)');
  v_definition text;
begin
  if v_identity is null then
    raise exception 'missing admin dependency: get_admin_learning_analytics(integer)';
  end if;
  select pg_get_functiondef(v_identity) into v_definition;

  if (length(v_definition) - length(replace(v_definition, 'p.tags', ''))) /
       length('p.tags') = 1
     and position(
       'left join public.problems p on p.id = ws.problem_id' in v_definition
     ) > 0 then
    v_definition := replace(v_definition, 'p.tags', 'p.problem_tags');
    v_definition := replace(
      v_definition,
      'left join public.problems p on p.id = ws.problem_id',
      'left join private.admin_writing_question_metadata p on p.problem_id = ws.problem_id'
    );
    execute v_definition;
  elsif position('p.problem_tags' in v_definition) > 0
     and position(
       'left join private.admin_writing_question_metadata p on p.problem_id = ws.problem_id'
       in v_definition
     ) > 0 then
    null;
  else
    raise exception 'unexpected get_admin_learning_analytics definition; refusing stale rewrite';
  end if;
end
$$;

do $$
declare
  v_identity regprocedure := to_regprocedure(
    'public.get_admin_learning_analytics_filtered(date,date,smallint[],text,text,jsonb,boolean)'
  );
  v_definition text;
begin
  if v_identity is null then
    raise exception 'missing admin dependency: get_admin_learning_analytics_filtered';
  end if;
  select pg_get_functiondef(v_identity) into v_definition;

  if (length(v_definition) - length(replace(v_definition, 'sm.legacy_problem_id', ''))) /
       length('sm.legacy_problem_id') = 2
     and position('sm.learner_problem_id' in v_definition) = 0 then
    v_definition := replace(
      v_definition,
      'sm.legacy_problem_id',
      'sm.learner_problem_id'
    );
    execute v_definition;
  elsif position('sm.legacy_problem_id' in v_definition) = 0
     and (
       (length(v_definition) - length(replace(v_definition, 'sm.learner_problem_id', ''))) /
       length('sm.learner_problem_id') = 2
       or position(
         'from public.topik_writing_problem_question_map pm' in
         v_definition
       ) > 0
     ) then
    -- The latest analytics contract already resolves canonical metadata via
    -- the domain-owned problem/question map. It has no stale source-map ID to
    -- rewrite, so preserve that newer definition exactly.
    null;
  else
    raise exception 'unexpected get_admin_learning_analytics_filtered definition; refusing stale rewrite';
  end if;
end
$$;
