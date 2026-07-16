-- Canonical writing read contract.
-- Deployment dependency: v13 20260713080015_writing_problem_identity_anchor.sql
-- must be applied to the shared database first.

alter table public.topik_writing_question_source_map
  add column if not exists canonical_import_id bigint;

alter table public.topik_writing_question_source_map
  add column if not exists learner_problem_id uuid
  generated always as (md5(question_id)::uuid) stored;

do $$
declare
  v_type oid;
  v_generated "char";
  v_expression text;
begin
  select attribute.atttypid,
         attribute.attgenerated,
         pg_get_expr(definition.adbin, definition.adrelid)
    into v_type, v_generated, v_expression
    from pg_attribute attribute
    left join pg_attrdef definition
      on definition.adrelid = attribute.attrelid
     and definition.adnum = attribute.attnum
   where attribute.attrelid =
         'public.topik_writing_question_source_map'::regclass
     and attribute.attname = 'learner_problem_id'
     and not attribute.attisdropped;

  if v_type is distinct from 'uuid'::regtype
     or v_generated is distinct from 's'
     or regexp_replace(
          lower(coalesce(v_expression, '')),
          '[[:space:]()]',
          '',
          'g'
        ) <> 'md5question_id::uuid' then
    raise exception 'writing_learner_problem_id_definition_incompatible'
      using errcode = 'P0001',
            detail = coalesce(v_expression, 'missing generated expression');
  end if;
end
$$;

alter table public.topik_writing_question_source_map
  alter column learner_problem_id set not null;

do $$
begin
  if not exists (
    select 1
      from pg_constraint
     where conname = 'topik_writing_source_map_canonical_import_fk'
       and conrelid = 'public.topik_writing_question_source_map'::regclass
  ) then
    alter table public.topik_writing_question_source_map
      add constraint topik_writing_source_map_canonical_import_fk
      foreign key (canonical_import_id)
      references public.topik_writing_question_import(import_id)
      on delete restrict;
  end if;
end
$$;

do $$
begin
  if not exists (
    select 1
      from pg_constraint
     where conname = 'topik_writing_source_map_learner_problem_id_key'
       and conrelid = 'public.topik_writing_question_source_map'::regclass
  ) then
    alter table public.topik_writing_question_source_map
      add constraint topik_writing_source_map_learner_problem_id_key
      unique (learner_problem_id);
  end if;
end
$$;

create index if not exists topik_writing_source_map_canonical_import_idx
  on public.topik_writing_question_source_map (canonical_import_id)
  where canonical_import_id is not null;

comment on column public.topik_writing_question_source_map.canonical_import_id is
  'Exact inbox version currently represented by the official typed question. Never infer this from is_latest.';

comment on column public.topik_writing_question_source_map.learner_problem_id is
  'Deterministic v13 learner/FK identity derived from md5(question_id). legacy_problem_id remains provenance only.';

create or replace function private.reject_writing_source_map_question_id_update()
returns trigger
language plpgsql
set search_path = pg_catalog
as $$
begin
  if new.question_id is distinct from old.question_id then
    raise exception 'writing_question_id_immutable'
      using errcode = 'P0001',
            detail = 'Create a new canonical question instead of changing question_id.';
  end if;
  return new;
end;
$$;

revoke all on function private.reject_writing_source_map_question_id_update() from public;
revoke all on function private.reject_writing_source_map_question_id_update() from anon;
revoke all on function private.reject_writing_source_map_question_id_update() from authenticated;
revoke all on function private.reject_writing_source_map_question_id_update() from service_role;

drop trigger if exists topik_writing_source_map_question_id_immutable
  on public.topik_writing_question_source_map;
create trigger topik_writing_source_map_question_id_immutable
before update of question_id on public.topik_writing_question_source_map
for each row
execute function private.reject_writing_source_map_question_id_update();

create or replace function private.build_writing_learner_chart(p_chart jsonb)
returns jsonb
language sql
immutable
returns null on null input
set search_path = pg_catalog
as $$
  select case
    when jsonb_typeof(p_chart) <> 'object' then null
    else jsonb_strip_nulls(jsonb_build_object(
      'chart_type', case
        when jsonb_typeof(p_chart->'chart_type') = 'string'
          then p_chart->'chart_type'
        else null
      end,
      'title', case
        when jsonb_typeof(p_chart->'title') = 'string'
          then p_chart->'title'
        else null
      end,
      'unit', case
        when jsonb_typeof(p_chart->'unit') = 'string'
          then p_chart->'unit'
        else null
      end,
      'year_range', case
        when jsonb_typeof(p_chart->'year_range') = 'array' then (
          select jsonb_agg(range_value.value order by range_value.ordinality)
            from jsonb_array_elements(p_chart->'year_range')
              with ordinality as range_value(value, ordinality)
           where jsonb_typeof(range_value.value) in ('string', 'number')
        )
        else null
      end,
      'series', case
        when jsonb_typeof(p_chart->'series') = 'array' then (
          select jsonb_agg(
            jsonb_strip_nulls(jsonb_build_object(
              'label', case
                when jsonb_typeof(series_value.value->'label') = 'string'
                  then series_value.value->'label'
                else null
              end,
              'values', case
                when jsonb_typeof(series_value.value->'values') = 'array' then (
                  select jsonb_agg(point_value.value order by point_value.ordinality)
                    from jsonb_array_elements(series_value.value->'values')
                      with ordinality as point_value(value, ordinality)
                   where jsonb_typeof(point_value.value) = 'number'
                )
                else null
              end
            ))
            order by series_value.ordinality
          )
          from jsonb_array_elements(p_chart->'series')
            with ordinality as series_value(value, ordinality)
          where jsonb_typeof(series_value.value) = 'object'
        )
        else null
      end
    ))
  end;
$$;

revoke all on function private.build_writing_learner_chart(jsonb) from public;
revoke all on function private.build_writing_learner_chart(jsonb) from anon;
revoke all on function private.build_writing_learner_chart(jsonb) from authenticated;
revoke all on function private.build_writing_learner_chart(jsonb) from service_role;

comment on function private.build_writing_learner_chart(jsonb) is
  'Reconstructs learner-safe Q53 chart JSON from an explicit recursive allowlist; unknown nested keys and non-numeric points are discarded.';

create or replace view private.topik_writing_question_learner_projection
with (security_invoker = true)
as
select
  q.question_id,
  q.item_number,
  q.target_level,
  q.difficulty_level,
  q.topic_main,
  q.topic_detail,
  q.text_type,
  q.speech_act,
  q.relation,
  q.scenario_type,
  q.situation_summary,
  q.learning_goal_summary,
  q.prompt_text,
  q.service_status,
  coalesce(nullif(q.situation_summary, ''), nullif(q.topic_main, ''), q.question_type_name) as title,
  jsonb_strip_nulls(jsonb_build_object(
    'question_id', q.question_id,
    'question_type_code', q.question_type_code,
    'question_type_name', q.question_type_name,
    'target_level', q.target_level,
    'difficulty_level', q.difficulty_level,
    'topic_main', q.topic_main,
    'topic_detail', q.topic_detail,
    'text_type', q.text_type,
    'speech_act', q.speech_act,
    'relation', q.relation,
    'scenario_type', q.scenario_type,
    'situation_summary', q.situation_summary,
    'learning_goal_summary', q.learning_goal_summary,
    'prompt_text', q.prompt_text,
    'blank_count', q.blank_count,
    'text_state', q.text_state,
    'blank_notation_policy', q.blank_notation_policy,
    'blank_1_position', q.blank_1_position,
    'blank_1_role', q.blank_1_role,
    'blank_1_function', q.blank_1_function,
    'blank_1_answer_type', q.blank_1_answer_type,
    'blank_2_position', q.blank_2_position,
    'blank_2_role', q.blank_2_role,
    'blank_2_function', q.blank_2_function,
    'blank_2_answer_type', q.blank_2_answer_type
  )) as materials,
  q.created_at,
  q.updated_at
from public.topik_writing_51_questions q
union all
select
  q.question_id,
  q.item_number,
  q.target_level,
  q.difficulty_level,
  q.topic_main,
  q.topic_detail,
  q.text_type,
  q.speech_act,
  q.relation,
  q.scenario_type,
  q.situation_summary,
  q.learning_goal_summary,
  q.prompt_text,
  q.service_status,
  coalesce(nullif(q.situation_summary, ''), nullif(q.topic_main, ''), q.question_type_name) as title,
  jsonb_strip_nulls(jsonb_build_object(
    'question_id', q.question_id,
    'question_type_code', q.question_type_code,
    'question_type_name', q.question_type_name,
    'target_level', q.target_level,
    'difficulty_level', q.difficulty_level,
    'topic_main', q.topic_main,
    'topic_detail', q.topic_detail,
    'text_type', q.text_type,
    'speech_act', q.speech_act,
    'relation', q.relation,
    'scenario_type', q.scenario_type,
    'situation_summary', q.situation_summary,
    'learning_goal_summary', q.learning_goal_summary,
    'prompt_text', q.prompt_text,
    'completion_unit', q.completion_unit,
    'required_sentence_count', q.required_sentence_count,
    'blank_count', q.blank_count,
    'connection_function', q.connection_function,
    'clue_before_text', q.clue_before_text,
    'clue_after_text', q.clue_after_text,
    'required_expression_function', q.required_expression_function,
    'sentence_complexity', q.sentence_complexity,
    'answer_scope_type', q.answer_scope_type,
    'paragraph_role', q.paragraph_role,
    'cohesion_focus', q.cohesion_focus
  )) as materials,
  q.created_at,
  q.updated_at
from public.topik_writing_52_questions q
union all
select
  q.question_id,
  q.item_number,
  q.target_level,
  q.difficulty_level,
  q.topic_main,
  q.topic_detail,
  q.text_type,
  q.speech_act,
  q.relation,
  q.scenario_type,
  q.situation_summary,
  q.learning_goal_summary,
  q.prompt_text,
  q.service_status,
  coalesce(nullif(q.chart_title, ''), nullif(q.situation_summary, ''), nullif(q.topic_main, ''), q.question_type_name) as title,
  jsonb_strip_nulls(jsonb_build_object(
    'question_id', q.question_id,
    'question_type_code', q.question_type_code,
    'question_type_name', q.question_type_name,
    'target_level', q.target_level,
    'difficulty_level', q.difficulty_level,
    'topic_main', q.topic_main,
    'topic_detail', q.topic_detail,
    'text_type', q.text_type,
    'speech_act', q.speech_act,
    'relation', q.relation,
    'scenario_type', q.scenario_type,
    'situation_summary', q.situation_summary,
    'learning_goal_summary', q.learning_goal_summary,
    'prompt_text', q.prompt_text,
    'data_type', q.data_type,
    'data_topic', q.data_topic,
    'chart_title', q.chart_title,
    'chart_unit', q.chart_unit,
    'comparison_target_count', q.comparison_target_count,
    'data_series_count', q.data_series_count,
    'number_expression_required', q.number_expression_required,
    'comparison_type', q.comparison_type,
    'change_type', q.change_type,
    'required_structure', q.required_structure,
    'word_count_min', q.word_count_min,
    'word_count_max', q.word_count_max,
    'interpretation_difficulty', q.interpretation_difficulty,
    'prohibited_elements', q.prohibited_elements,
    'charts', case
      when q.source_data is null then null
      else jsonb_strip_nulls(jsonb_build_object(
        'chart_a', private.build_writing_learner_chart(q.source_data->'chart_a'),
        'chart_b', private.build_writing_learner_chart(q.source_data->'chart_b')
      ))
    end,
    'data_asset_url', q.data_asset_url
  )) as materials,
  q.created_at,
  q.updated_at
from public.topik_writing_53_questions q
union all
select
  q.question_id,
  q.item_number,
  q.target_level,
  q.difficulty_level,
  q.topic_main,
  q.topic_detail,
  q.text_type,
  q.speech_act,
  q.relation,
  q.scenario_type,
  q.situation_summary,
  q.learning_goal_summary,
  q.prompt_text,
  q.service_status,
  coalesce(nullif(q.issue_topic, ''), nullif(q.situation_summary, ''), nullif(q.topic_main, ''), q.question_type_name) as title,
  jsonb_strip_nulls(jsonb_build_object(
    'question_id', q.question_id,
    'question_type_code', q.question_type_code,
    'question_type_name', q.question_type_name,
    'target_level', q.target_level,
    'difficulty_level', q.difficulty_level,
    'topic_main', q.topic_main,
    'topic_detail', q.topic_detail,
    'text_type', q.text_type,
    'speech_act', q.speech_act,
    'relation', q.relation,
    'scenario_type', q.scenario_type,
    'situation_summary', q.situation_summary,
    'learning_goal_summary', q.learning_goal_summary,
    'prompt_text', q.prompt_text,
    'essay_type', q.essay_type,
    'issue_topic', q.issue_topic,
    'prompt_questions', q.prompt_questions,
    'stance_requirement', q.stance_requirement,
    'required_structure', q.required_structure,
    'required_reason_count', q.required_reason_count,
    'example_requirement', q.example_requirement,
    'word_count_min', q.word_count_min,
    'word_count_max', q.word_count_max,
    'reasoning_pattern', q.reasoning_pattern,
    'vocabulary_level', q.vocabulary_level,
    'prohibited_elements', q.prohibited_elements
  )) as materials,
  q.created_at,
  q.updated_at
from public.topik_writing_54_questions q;

revoke all on private.topik_writing_question_learner_projection from public;
revoke all on private.topik_writing_question_learner_projection from anon;
revoke all on private.topik_writing_question_learner_projection from authenticated;

-- Prove that every pinned typed row is exactly the record that PostgreSQL
-- would reconstruct from its immutable inbox payload. Operational columns are
-- overlaid with their current typed values because admin may legitimately
-- change visibility without changing question content.
create or replace function private.assert_writing_canonical_content_parity()
returns void
language plpgsql
security definer
set search_path = pg_catalog, public, private
as $$
declare
  v_item_number smallint;
  v_table text;
  v_mismatch_count bigint;
begin
  foreach v_item_number in array array[51, 52, 53, 54]::smallint[]
  loop
    v_table := format('topik_writing_%s_questions', v_item_number);
    execute format(
      $parity$
        select count(*)
          from public.%I official
          join public.topik_writing_question_source_map source_map
            on source_map.question_id = official.question_id
           and source_map.item_number = official.item_number
          join public.topik_writing_question_import import_row
            on import_row.import_id = source_map.canonical_import_id
           and import_row.source_task_id = official.question_id
           and import_row.promoted_question_id = official.question_id
           and import_row.item_number = official.item_number
           and import_row.mapping_status = 'promoted'
         where to_jsonb(official) is distinct from to_jsonb(
           jsonb_populate_record(
             null::public.%I,
             import_row.raw_payload || jsonb_build_object(
               'question_id', official.question_id,
               'item_number', official.item_number,
               'service_status', official.service_status,
               'created_at', to_jsonb(official.created_at),
               'updated_at', to_jsonb(official.updated_at)
             )
           )
         )
      $parity$,
      v_table,
      v_table
    ) into v_mismatch_count;

    if v_mismatch_count <> 0 then
      raise exception 'canonical_typed_import_content_mismatch: item %, count %',
        v_item_number,
        v_mismatch_count;
    end if;
  end loop;
end;
$$;

revoke all on function private.assert_writing_canonical_content_parity() from public;
revoke all on function private.assert_writing_canonical_content_parity() from anon;
revoke all on function private.assert_writing_canonical_content_parity() from authenticated;
grant execute on function private.assert_writing_canonical_content_parity() to service_role;

comment on function private.assert_writing_canonical_content_parity() is
  'Fails unless every exact-version source-map pointer reconstructs the current typed row from its promoted inbox raw_payload.';

create or replace function private.is_writing_question_visible_to_user(
  p_question_id text,
  p_item_number smallint,
  p_user_id uuid
)
returns boolean
language plpgsql
security definer
stable
set search_path = pg_catalog, public, private
as $$
declare
  v_affiliation_code text;
begin
  if p_user_id is null then
    return false;
  end if;

  select nullif(btrim(p.affiliation_code), '')
    into v_affiliation_code
    from public.profiles p
   where p.id = p_user_id;

  if not found then
    return false;
  end if;

  -- Preserve the latest v13 contract: non-institution learners see the full
  -- available pool; institution learners see assigned questions only.
  if v_affiliation_code is null then
    return true;
  end if;

  return exists (
    select 1
      from public.topik_writing_question_institution_exposure e
     where e.question_id = p_question_id
       and e.item_number = p_item_number
       and e.institution_code = v_affiliation_code
  );
end;
$$;

revoke all on function private.is_writing_question_visible_to_user(text, smallint, uuid) from public;
revoke all on function private.is_writing_question_visible_to_user(text, smallint, uuid) from anon;
revoke all on function private.is_writing_question_visible_to_user(text, smallint, uuid) from authenticated;
revoke all on function private.is_writing_question_visible_to_user(text, smallint, uuid) from service_role;

create or replace function public.get_available_writing_questions(
  p_item_number smallint default null,
  p_problem_id uuid default null
)
returns table (
  problem_id uuid,
  question_id text,
  canonical_import_id bigint,
  payload_hash text,
  item_number smallint,
  topik_level smallint,
  difficulty smallint,
  title text,
  prompt text,
  tags text[],
  materials jsonb,
  source_created_at timestamptz,
  source_updated_at timestamptz
)
language sql
security definer
stable
set search_path = pg_catalog, public, private
as $$
  select
    sm.learner_problem_id,
    q.question_id,
    sm.canonical_import_id,
    imp.payload_hash,
    q.item_number,
    2::smallint,
    case
      when q.difficulty_level is null then null
      else least(greatest(q.difficulty_level, 1), 5)::smallint
    end,
    coalesce(
      nullif(imp.raw_payload->>'topic_seed_title', ''),
      nullif(imp.raw_payload#>>'{approved_topic_seed,topic_seed_title}', ''),
      nullif(imp.raw_payload#>>'{scenario_logic,scenario_title}', ''),
      nullif(imp.raw_payload->>'situation_summary', ''),
      nullif(imp.raw_payload->>'topic_main', ''),
      '쓰기 문제'
    ),
    q.prompt_text,
    coalesce((
      select array_agg(tag_value order by first_order, tag_value collate "C")
      from (
        select value as tag_value, min(sort_order) as first_order
        from (
          values
            (q.topic_main, 1),
            (q.topic_detail, 2),
            (q.speech_act, 3),
            (q.scenario_type, 4)
          union all
          select coalesce(nullif(t.tag_value, ''), t.tag_code), 10
            from public.topik_writing_question_tags t
           where t.question_id = q.question_id
             and t.item_number = q.item_number
             and t.is_active
        ) raw_tags(value, sort_order)
        where nullif(btrim(value), '') is not null
        group by value
      ) deduplicated_tags
    ), '{}'::text[]),
    q.materials || jsonb_build_object(
      'canonical_import_id', sm.canonical_import_id,
      'payload_hash', imp.payload_hash
    ),
    q.created_at,
    coalesce(q.updated_at, q.created_at)
  from private.topik_writing_question_learner_projection q
  join public.topik_writing_question_source_map sm
    on sm.question_id = q.question_id
   and sm.item_number = q.item_number
   and sm.learner_problem_id is not null
   and sm.canonical_import_id is not null
  join public.topik_writing_question_import imp
    on imp.import_id = sm.canonical_import_id
   and imp.source_task_id = q.question_id
   and imp.promoted_question_id = q.question_id
   and imp.item_number = q.item_number
   and imp.mapping_status = 'promoted'
  where q.service_status = 'available'
    and (p_item_number is null or q.item_number = p_item_number)
    and (p_problem_id is null or sm.learner_problem_id = p_problem_id)
    and private.is_writing_question_visible_to_user(
      q.question_id,
      q.item_number,
      auth.uid()
    )
  order by q.created_at, q.question_id;
$$;

revoke all on function public.get_available_writing_questions(smallint, uuid) from public;
revoke all on function public.get_available_writing_questions(smallint, uuid) from anon;
revoke all on function public.get_available_writing_questions(smallint, uuid) from service_role;
grant execute on function public.get_available_writing_questions(smallint, uuid) to authenticated;

comment on function public.get_available_writing_questions(smallint, uuid) is
  'Learner-safe canonical list/detail RPC. Caller identity comes only from auth.uid(); answer, rubric, raw import, and internal review fields are excluded.';

create or replace function private.assert_writing_question_submittable(
  p_problem_id uuid,
  p_question_id text,
  p_canonical_import_id bigint,
  p_payload_hash text,
  p_item_number smallint,
  p_user_id uuid
)
returns void
language plpgsql
security definer
stable
set search_path = pg_catalog, public, private
as $$
begin
  if p_user_id is null then
    raise exception 'unauthenticated';
  end if;
  if not exists (
    select 1
      from private.topik_writing_question_learner_projection q
      join public.topik_writing_question_source_map sm
        on sm.question_id = q.question_id
       and sm.item_number = q.item_number
      join public.topik_writing_question_import imp
        on imp.import_id = sm.canonical_import_id
       and imp.source_task_id = q.question_id
       and imp.promoted_question_id = q.question_id
       and imp.item_number = q.item_number
       and imp.mapping_status = 'promoted'
     where sm.learner_problem_id = p_problem_id
       and q.question_id = p_question_id
       and sm.canonical_import_id = p_canonical_import_id
       and imp.payload_hash = p_payload_hash
       and q.item_number = p_item_number
       and q.service_status = 'available'
       and private.is_writing_question_visible_to_user(
         q.question_id,
         q.item_number,
         p_user_id
       )
  ) then
    raise exception 'canonical_problem_not_submittable'
      using errcode = 'P0001',
            detail = 'Canonical identity, version, availability, or institution exposure did not match.';
  end if;
end;
$$;

revoke all on function private.assert_writing_question_submittable(uuid, text, bigint, text, smallint, uuid) from public;
revoke all on function private.assert_writing_question_submittable(uuid, text, bigint, text, smallint, uuid) from anon;
revoke all on function private.assert_writing_question_submittable(uuid, text, bigint, text, smallint, uuid) from authenticated;
grant execute on function private.assert_writing_question_submittable(uuid, text, bigint, text, smallint, uuid) to service_role;

comment on function private.assert_writing_question_submittable(uuid, text, bigint, text, smallint, uuid) is
  'Service-side canonical submission guard. Validates stable UUID, exact promoted version/hash, current availability, and owner institution exposure.';

create or replace function public.get_writing_question_grading_payload(
  p_question_id text,
  p_canonical_import_id bigint
)
returns jsonb
language sql
security definer
stable
set search_path = pg_catalog, public
as $$
  select jsonb_build_object(
    'problem_id', sm.learner_problem_id,
    'question_id', imp.source_task_id,
    'canonical_import_id', imp.import_id,
    'payload_hash', imp.payload_hash,
    'item_number', imp.item_number,
    'raw_payload', imp.raw_payload
  )
  from public.topik_writing_question_import imp
  join public.topik_writing_question_source_map sm
    on sm.canonical_import_id = imp.import_id
   and sm.question_id = imp.source_task_id
   and sm.item_number = imp.item_number
  where imp.import_id = p_canonical_import_id
    and imp.source_task_id = p_question_id
    and imp.promoted_question_id = p_question_id
    and imp.item_number in (51, 52, 53, 54)
    and imp.mapping_status = 'promoted';
$$;

revoke all on function public.get_writing_question_grading_payload(text, bigint) from public;
revoke all on function public.get_writing_question_grading_payload(text, bigint) from anon;
revoke all on function public.get_writing_question_grading_payload(text, bigint) from authenticated;
grant execute on function public.get_writing_question_grading_payload(text, bigint) to service_role;

comment on function public.get_writing_question_grading_payload(text, bigint) is
  'Service-role-only exact-version grading payload. Callers must provide the version stored with the submission.';

-- Backfill exact promoted-version links without changing legacy_problem_id.
-- learner_problem_id is generated from question_id and is the only v13/FK identity.
do $$
begin
  if exists (
    with official as (
      select question_id, item_number from public.topik_writing_51_questions
      union all
      select question_id, item_number from public.topik_writing_52_questions
      union all
      select question_id, item_number from public.topik_writing_53_questions
      union all
      select question_id, item_number from public.topik_writing_54_questions
    )
    select 1
      from official question
      join public.topik_writing_question_source_map source_map
        on source_map.question_id = question.question_id
     where source_map.item_number <> question.item_number
  ) then
    raise exception 'source map item_number collision during canonical backfill';
  end if;
end
$$;

with official as (
  select question_id, item_number from public.topik_writing_51_questions
  union all
  select question_id, item_number from public.topik_writing_52_questions
  union all
  select question_id, item_number from public.topik_writing_53_questions
  union all
  select question_id, item_number from public.topik_writing_54_questions
), resolved as (
  select
    q.question_id,
    q.item_number,
    promoted.import_id as canonical_import_id
  from official q
  left join lateral (
    select imp.import_id
      from public.topik_writing_question_import imp
     where imp.promoted_question_id = q.question_id
       and imp.source_task_id = q.question_id
       and imp.item_number = q.item_number
       and imp.mapping_status = 'promoted'
     order by imp.import_id desc
     limit 1
  ) promoted on true
)
insert into public.topik_writing_question_source_map (
  question_id,
  item_number,
  canonical_import_id,
  backfill_batch,
  updated_at
)
select
  r.question_id,
  r.item_number,
  r.canonical_import_id,
  '20260713-canonical-read-contract',
  now()
from resolved r
where r.canonical_import_id is not null
on conflict (question_id) do update set
  item_number = public.topik_writing_question_source_map.item_number,
  canonical_import_id = coalesce(
    excluded.canonical_import_id,
    public.topik_writing_question_source_map.canonical_import_id
  ),
  updated_at = now();

-- Fail closed if any exact-version pointer would enter canonical reads without
-- a complete UUID + official row + inbox identity/item parity proof.
do $$
begin
  if exists (
    with official as (
      select question_id, item_number from public.topik_writing_51_questions
      union all
      select question_id, item_number from public.topik_writing_52_questions
      union all
      select question_id, item_number from public.topik_writing_53_questions
      union all
      select question_id, item_number from public.topik_writing_54_questions
    )
    select 1
      from public.topik_writing_question_source_map sm
      left join official q
        on q.question_id = sm.question_id
      left join public.topik_writing_question_import imp
        on imp.import_id = sm.canonical_import_id
     where sm.canonical_import_id is not null
       and (
         sm.learner_problem_id is distinct from md5(sm.question_id)::uuid
         or q.question_id is null
         or q.item_number is distinct from sm.item_number
         or imp.import_id is null
         or imp.source_task_id is distinct from sm.question_id
         or imp.promoted_question_id is distinct from sm.question_id
         or imp.item_number is distinct from sm.item_number
         or imp.mapping_status is distinct from 'promoted'
       )
  ) then
    raise exception 'canonical source-map parity violation';
  end if;
end
$$;

select private.assert_writing_canonical_content_parity();

do $$
declare
  v_row record;
begin
  if to_regprocedure('private.ensure_writing_problem_anchor(uuid,text,smallint)') is null then
    raise exception 'missing v13 dependency: private.ensure_writing_problem_anchor(uuid,text,smallint)';
  end if;

  for v_row in
    select sm.question_id, sm.item_number, sm.learner_problem_id
      from public.topik_writing_question_source_map sm
      join private.topik_writing_question_learner_projection q
        on q.question_id = sm.question_id
       and q.item_number = sm.item_number
      join public.topik_writing_question_import imp
        on imp.import_id = sm.canonical_import_id
       and imp.source_task_id = sm.question_id
       and imp.promoted_question_id = sm.question_id
       and imp.item_number = sm.item_number
       and imp.mapping_status = 'promoted'
     where sm.learner_problem_id is not null
       and sm.canonical_import_id is not null
  loop
    perform private.ensure_writing_problem_anchor(
      v_row.learner_problem_id,
      v_row.question_id,
      v_row.item_number
    );
  end loop;
end
$$;

create or replace function public.admin_promote_writing_questions(
  p_actor_id uuid,
  p_question_ids text[] default null
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, private
as $$
declare
  v_row record;
  v_table text;
  v_payload jsonb;
  v_learner_problem_id uuid;
  v_existing_item_number smallint;
  v_existing_import_id bigint;
  v_existing_payload_hash text;
  v_existing_status text;
  v_existing_created timestamptz;
  v_canonical_read_enabled boolean := false;
  v_new integer := 0;
  v_updated integer := 0;
  v_held integer := 0;
  v_skipped_review integer := 0;
  v_failures jsonb := '[]'::jsonb;
begin
  if p_actor_id is null then
    raise exception 'actor required';
  end if;
  if not private.is_content_admin(p_actor_id) then
    raise exception 'forbidden: content_admin required';
  end if;
  if to_regprocedure('private.ensure_writing_problem_anchor(uuid,text,smallint)') is null then
    raise exception 'missing v13 dependency: writing problem anchor function';
  end if;
  -- The topik-ai migration can be installed before v13 introduces its shared
  -- read-mode function. Once that function exists, canonical mode freezes an
  -- existing question_id to its currently pinned payload hash.
  if to_regprocedure('private.is_writing_canonical_read_enabled()') is not null then
    execute 'select coalesce(private.is_writing_canonical_read_enabled(), false)'
      into v_canonical_read_enabled;
  end if;

  for v_row in
    select
      imp.import_id,
      imp.source_task_id,
      imp.payload_hash,
      imp.item_number,
      imp.promoted_question_id,
      imp.raw_payload
    from public.topik_writing_question_import imp
    where imp.is_latest
      and imp.mapping_status in ('raw', 'mapped', 'held')
      and (p_question_ids is null or imp.source_task_id = any(p_question_ids))
    order by imp.import_id
    for update skip locked
  loop
    begin
      if v_row.raw_payload->>'review_status' is distinct from '검수 완료' then
        update public.topik_writing_question_import
           set mapping_status = 'held',
               hold_reason = 'review incomplete: review_status<>검수 완료'
         where import_id = v_row.import_id;
        v_skipped_review := v_skipped_review + 1;
        continue;
      end if;
      if v_row.item_number is null or v_row.item_number not in (51, 52, 53, 54) then
        raise exception 'unresolvable item_number';
      end if;
      if nullif(v_row.raw_payload->>'question_id', '') is not null
         and v_row.raw_payload->>'question_id' is distinct from v_row.source_task_id then
        raise exception 'question_id mismatch between inbox key and payload';
      end if;
      if v_row.promoted_question_id is not null
         and v_row.promoted_question_id is distinct from v_row.source_task_id then
        raise exception 'promoted_question_id mismatch between inbox and source task';
      end if;
      if nullif(v_row.raw_payload->>'item_number', '') is not null
         and (v_row.raw_payload->>'item_number')::smallint is distinct from v_row.item_number then
        raise exception 'item_number mismatch between inbox key and payload';
      end if;

      v_table := format('topik_writing_%s_questions', v_row.item_number);
      v_existing_status := null;
      v_existing_created := null;
      execute format(
        'select service_status, created_at from public.%I where question_id = $1 for update',
        v_table
      )
      into v_existing_status, v_existing_created
      using v_row.source_task_id;

      v_learner_problem_id := null;
      v_existing_item_number := null;
      v_existing_import_id := null;
      select sm.learner_problem_id, sm.item_number, sm.canonical_import_id
        into v_learner_problem_id, v_existing_item_number, v_existing_import_id
        from public.topik_writing_question_source_map sm
       where sm.question_id = v_row.source_task_id
       for update;
      if v_existing_item_number is not null
         and v_existing_item_number <> v_row.item_number then
        raise exception 'source map item_number collision';
      end if;

      if v_canonical_read_enabled and v_existing_status is not null then
        if v_learner_problem_id is null or v_existing_import_id is null then
          raise exception 'canonical_question_version_not_pinned'
            using errcode = 'P0001',
                  detail = 'Existing canonical question requires a stable UUID and exact import pointer before promotion.';
        end if;

        select imp.payload_hash
          into v_existing_payload_hash
          from public.topik_writing_question_import imp
         where imp.import_id = v_existing_import_id
           and imp.source_task_id = v_row.source_task_id
           and imp.promoted_question_id = v_row.source_task_id
           and imp.item_number = v_row.item_number
           and imp.mapping_status = 'promoted';
        if not found then
          raise exception 'canonical_question_version_parity_not_proven'
            using errcode = 'P0001',
                  detail = 'Pinned import does not match the existing canonical question identity and item number.';
        end if;
        if v_existing_payload_hash is distinct from v_row.payload_hash then
          raise exception 'canonical_question_payload_hash_frozen'
            using errcode = 'P0001',
                  detail = 'Disable canonical read mode before promoting a different payload hash for an existing question_id.';
        end if;
      end if;

      v_learner_problem_id := coalesce(
        v_learner_problem_id,
        md5(v_row.source_task_id)::uuid
      );

      v_payload := v_row.raw_payload || jsonb_build_object(
        'question_id', v_row.source_task_id,
        'item_number', v_row.item_number,
        'service_status', coalesce(v_existing_status, 'internal_test'),
        'created_at', to_jsonb(coalesce(v_existing_created, now())),
        'updated_at', to_jsonb(now())
      );

      execute format('delete from public.%I where question_id = $1', v_table)
        using v_row.source_task_id;
      execute format(
        'insert into public.%I select * from jsonb_populate_record(null::public.%I, $1)',
        v_table,
        v_table
      )
      using v_payload;

      insert into public.topik_writing_question_source_map (
        question_id,
        item_number,
        canonical_import_id,
        updated_at
      )
      values (
        v_row.source_task_id,
        v_row.item_number,
        v_row.import_id,
        now()
      )
      on conflict (question_id) do update set
        item_number = public.topik_writing_question_source_map.item_number,
        canonical_import_id = excluded.canonical_import_id,
        hold_reason = null,
        updated_at = now()
      returning learner_problem_id into v_learner_problem_id;

      perform private.ensure_writing_problem_anchor(
        v_learner_problem_id,
        v_row.source_task_id,
        v_row.item_number
      );

      update public.topik_writing_question_import
         set mapping_status = 'promoted',
             promoted_question_id = v_row.source_task_id,
             hold_reason = null
       where import_id = v_row.import_id;

      if v_existing_status is null then
        v_new := v_new + 1;
      else
        v_updated := v_updated + 1;
      end if;

      insert into public.admin_audit_logs (
        admin_user_id,
        action,
        target_table,
        target_id,
        diff,
        payload
      )
      values (
        p_actor_id,
        'question_received',
        'AssessmentQuestion',
        v_row.source_task_id,
        '{}'::jsonb,
        jsonb_build_object(
          'event', case when v_existing_status is null then 'promoted_new' else 'promoted_updated' end,
          'item_number', v_row.item_number,
          'canonical_import_id', v_row.import_id,
          'payload_hash', v_row.payload_hash,
          'problem_id', v_learner_problem_id
        )
      );
    exception when others then
      v_held := v_held + 1;
      update public.topik_writing_question_import
         set mapping_status = 'held',
             hold_reason = left(coalesce(sqlerrm, ''), 300)
       where import_id = v_row.import_id;
      if jsonb_array_length(v_failures) < 50 then
        v_failures := v_failures || jsonb_build_object(
          'question_id', v_row.source_task_id,
          'error', left(coalesce(sqlerrm, ''), 300)
        );
      end if;
    end;
  end loop;

  return jsonb_build_object(
    'promoted_new', v_new,
    'promoted_updated', v_updated,
    'held', v_held,
    'skipped_review', v_skipped_review,
    'failures', v_failures
  );
end;
$$;

revoke all on function public.admin_promote_writing_questions(uuid, text[]) from public;
revoke all on function public.admin_promote_writing_questions(uuid, text[]) from anon;
revoke all on function public.admin_promote_writing_questions(uuid, text[]) from authenticated;
grant execute on function public.admin_promote_writing_questions(uuid, text[]) to service_role;

comment on function public.admin_promote_writing_questions(uuid, text[]) is
  'Service-role promotion. Official row, exact import link, deterministic learner_problem_id anchor, import state, and audit log succeed atomically per question; legacy_problem_id remains provenance only.';

comment on function public.get_available_writing_problem_payloads(smallint, text) is
  'DEPRECATED rollback-only mirror source. Returns answer-bearing inbox payload and must never be called by learner paths. Use get_available_writing_questions for learner reads.';
