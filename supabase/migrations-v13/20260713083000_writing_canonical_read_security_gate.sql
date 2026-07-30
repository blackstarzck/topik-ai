-- Stages the RLS cutover behind one database runtime source of truth.
-- The singleton starts in legacy mode, so applying this migration does not
-- change existing reads. An operator must explicitly activate canonical mode
-- after shadow, external-grader, and role-matrix gates pass.

-- Preserve the immediately prior function bodies so the down migration can
-- remove every static dependency on the admin-owned canonical RPC before that
-- RPC is rolled back. ON CONFLICT intentionally keeps the first pre-cutover
-- definition if a partially applied migration is retried.
create table if not exists private.writing_canonical_read_rollback_function (
  function_key text primary key,
  function_signature text not null,
  function_definition text not null,
  function_description text
);

revoke all on table private.writing_canonical_read_rollback_function from public;
revoke all on table private.writing_canonical_read_rollback_function from anon;
revoke all on table private.writing_canonical_read_rollback_function from authenticated;
revoke all on table private.writing_canonical_read_rollback_function from service_role;

insert into private.writing_canonical_read_rollback_function (
  function_key,
  function_signature,
  function_definition,
  function_description
)
select
  target.function_key,
  target.function_signature,
  pg_get_functiondef(target.function_oid),
  obj_description(target.function_oid, 'pg_proc')
from (
  values
    (
      'list_user_problems',
      'public.list_user_problems(jsonb,text,integer,integer)',
      to_regprocedure(
        'public.list_user_problems(jsonb,text,integer,integer)'
      )::oid
    ),
    (
      'list_user_library_problem_items',
      'public.list_user_library_problem_items()',
      to_regprocedure('public.list_user_library_problem_items()')::oid
    )
) target(function_key, function_signature, function_oid)
where target.function_oid is not null
on conflict (function_key) do nothing;

do $$
begin
  if (
    select count(*)
      from private.writing_canonical_read_rollback_function
     where function_key in (
       'list_user_problems',
       'list_user_library_problem_items'
     )
  ) <> 2 then
    raise exception 'canonical_read_rollback_function_backup_incomplete';
  end if;
end
$$;

create table if not exists private.writing_read_control (
  singleton boolean primary key default true check (singleton),
  read_mode text not null default 'legacy'
    check (read_mode in ('legacy', 'shadow', 'canonical')),
  submission_mode text not null default 'legacy'
    check (submission_mode in ('blocked', 'legacy', 'canonical')),
  submission_contract_state text not null default 'unverified'
    check (submission_contract_state in (
      'unverified',
      'provider_verified',
      'local_outbox_verified'
    )),
  changed_by text not null default 'migration',
  change_reason text not null default 'initial_state',
  evidence_id text,
  changed_at timestamptz not null default now(),
  constraint writing_read_control_allowed_combination check (
    (read_mode in ('legacy', 'shadow') and submission_mode in ('legacy', 'blocked'))
    or (read_mode = 'canonical' and submission_mode = 'blocked')
    or (
      read_mode = 'canonical'
      and submission_mode = 'canonical'
      and submission_contract_state in ('provider_verified', 'local_outbox_verified')
      and nullif(btrim(evidence_id), '') is not null
    )
  )
);

alter table private.writing_read_control enable row level security;
alter table private.writing_read_control force row level security;
revoke all on table private.writing_read_control from public;
revoke all on table private.writing_read_control from anon;
revoke all on table private.writing_read_control from authenticated;
revoke all on table private.writing_read_control from service_role;

insert into private.writing_read_control (
  singleton,
  read_mode,
  submission_mode,
  submission_contract_state,
  changed_by,
  change_reason
)
values (true, 'legacy', 'legacy', 'unverified', 'migration', 'initial_state')
on conflict (singleton) do nothing;

create table if not exists private.writing_runtime_state_audit (
  audit_id bigint generated always as identity primary key,
  event_name text not null default 'writing_runtime_state_changed'
    check (event_name = 'writing_runtime_state_changed'),
  old_read_mode text,
  old_submission_mode text,
  old_submission_contract_state text,
  new_read_mode text not null,
  new_submission_mode text not null,
  new_submission_contract_state text not null,
  actor text not null,
  reason_hash text not null,
  evidence_id text,
  changed_at timestamptz not null default now()
);

alter table private.writing_runtime_state_audit enable row level security;
alter table private.writing_runtime_state_audit force row level security;
revoke all on table private.writing_runtime_state_audit from public;
revoke all on table private.writing_runtime_state_audit from anon;
revoke all on table private.writing_runtime_state_audit from authenticated;
revoke all on table private.writing_runtime_state_audit from service_role;

insert into private.writing_runtime_state_audit (
  old_read_mode,
  old_submission_mode,
  old_submission_contract_state,
  new_read_mode,
  new_submission_mode,
  new_submission_contract_state,
  actor,
  reason_hash,
  evidence_id
)
select
  null,
  null,
  null,
  control.read_mode,
  control.submission_mode,
  control.submission_contract_state,
  control.changed_by,
  md5(control.change_reason),
  control.evidence_id
from private.writing_read_control control
where control.singleton
  and not exists (select 1 from private.writing_runtime_state_audit);

create or replace function public.get_writing_runtime_state()
returns table (
  read_mode text,
  submission_mode text,
  submission_contract_state text
)
language sql
stable
security definer
set search_path = pg_catalog, private
as $$
  select
    control.read_mode,
    control.submission_mode,
    control.submission_contract_state
  from private.writing_read_control control
  where control.singleton
$$;

revoke all on function public.get_writing_runtime_state() from public;
grant execute on function public.get_writing_runtime_state() to authenticated;
grant execute on function public.get_writing_runtime_state() to service_role;

comment on function public.get_writing_runtime_state() is
  'Read-only application runtime source of truth. Does not expose operator identity, reason, or evidence metadata.';

create or replace function private.is_writing_canonical_read_enabled()
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, private
as $$
  select coalesce(
    (
      select control.read_mode = 'canonical'
        from private.writing_read_control control
       where control.singleton
    ),
    false
  )
$$;

revoke all on function private.is_writing_canonical_read_enabled() from public;
revoke all on function private.is_writing_canonical_read_enabled() from anon;
grant execute on function private.is_writing_canonical_read_enabled() to authenticated;
grant execute on function private.is_writing_canonical_read_enabled() to service_role;

create or replace function private.get_writing_submission_mode()
returns text
language sql
stable
security definer
set search_path = pg_catalog, private
as $$
  select coalesce(
    (select control.submission_mode
       from private.writing_read_control control
      where control.singleton),
    'blocked'
  )
$$;

revoke all on function private.get_writing_submission_mode() from public;
revoke all on function private.get_writing_submission_mode() from anon;
grant execute on function private.get_writing_submission_mode() to authenticated;
grant execute on function private.get_writing_submission_mode() to service_role;

-- Created before the runtime setter so its canonical transition gate can
-- require durable reconciliation evidence even with check_function_bodies on.
create table if not exists private.writing_draft_reconciliation_audit (
  audit_id bigint generated always as identity primary key,
  event_name text not null default 'writing_draft_reconciliation'
    check (event_name = 'writing_draft_reconciliation'),
  status text not null check (status in ('pinned', 'blocked_mismatch')),
  candidate_count integer not null check (candidate_count >= 0),
  pinned_count integer not null check (pinned_count >= 0),
  mismatch_count integer not null check (mismatch_count >= 0),
  raw_diagnostic_mismatch_count integer not null default 0
    check (raw_diagnostic_mismatch_count >= 0),
  actor text not null,
  evidence_id text not null,
  checked_at timestamptz not null default now()
);

alter table private.writing_draft_reconciliation_audit enable row level security;
alter table private.writing_draft_reconciliation_audit force row level security;
revoke all on table private.writing_draft_reconciliation_audit from public;
revoke all on table private.writing_draft_reconciliation_audit from anon;
revoke all on table private.writing_draft_reconciliation_audit from authenticated;
revoke all on table private.writing_draft_reconciliation_audit from service_role;

create or replace function private.set_writing_runtime_state(
  p_read_mode text,
  p_submission_mode text,
  p_submission_contract_state text,
  p_actor text,
  p_reason text,
  p_evidence_id text default null
)
returns void
language plpgsql
security definer
set search_path = pg_catalog, public, private
as $$
declare
  v_missing_version_links bigint;
  v_incomplete_active_drafts bigint;
  v_old_read_mode text;
  v_old_submission_mode text;
  v_old_submission_contract_state text;
begin
  if p_read_mode not in ('legacy', 'shadow', 'canonical') then
    raise exception 'writing_read_mode_invalid';
  end if;
  if p_submission_mode not in ('blocked', 'legacy', 'canonical') then
    raise exception 'writing_submission_mode_invalid';
  end if;
  if p_submission_contract_state not in (
    'unverified',
    'provider_verified',
    'local_outbox_verified'
  ) then
    raise exception 'writing_submission_contract_state_invalid';
  end if;
  if nullif(btrim(p_actor), '') is null then
    raise exception 'writing_runtime_actor_required';
  end if;
  if nullif(btrim(p_reason), '') is null then
    raise exception 'writing_runtime_reason_required';
  end if;
  if (p_read_mode in ('legacy', 'shadow') and p_submission_mode = 'canonical')
     or (p_read_mode = 'canonical' and p_submission_mode = 'legacy') then
    raise exception 'writing_runtime_combination_invalid';
  end if;
  if p_submission_mode = 'canonical'
     and (
       p_read_mode <> 'canonical'
       or p_submission_contract_state not in (
         'provider_verified',
         'local_outbox_verified'
       )
       or nullif(btrim(p_evidence_id), '') is null
     ) then
    raise exception 'canonical_submission_contract_evidence_required';
  end if;

  select
    control.read_mode,
    control.submission_mode,
    control.submission_contract_state
    into
      v_old_read_mode,
      v_old_submission_mode,
      v_old_submission_contract_state
    from private.writing_read_control control
   where control.singleton
   for update;

  if p_read_mode = 'canonical' then
    if to_regprocedure(
      'public.get_available_writing_questions(smallint,uuid)'
    ) is null then
      raise exception 'canonical_learner_rpc_missing';
    end if;
    if to_regprocedure(
      'private.assert_writing_question_submittable(uuid,text,bigint,text,smallint,uuid)'
    ) is null then
      raise exception 'canonical_submission_guard_missing';
    end if;
    if to_regprocedure(
      'public.create_external_writing_submission_v2(jsonb)'
    ) is null then
      raise exception 'canonical_submission_writer_missing';
    end if;
    if to_regprocedure(
      'private.assert_writing_canonical_content_parity()'
    ) is null then
      raise exception 'canonical_content_parity_guard_missing';
    end if;

    perform private.assert_writing_canonical_content_parity();

    execute $check$
      with available_question as (
        select question_id, item_number
          from public.topik_writing_51_questions
         where service_status = 'available'
        union all
        select question_id, item_number
          from public.topik_writing_52_questions
         where service_status = 'available'
        union all
        select question_id, item_number
          from public.topik_writing_53_questions
         where service_status = 'available'
        union all
        select question_id, item_number
          from public.topik_writing_54_questions
         where service_status = 'available'
      )
      select count(*)
        from available_question official
        left join public.topik_writing_question_source_map source_map
          on source_map.question_id = official.question_id
         and source_map.item_number = official.item_number
        left join public.topik_writing_question_import import_row
          on import_row.import_id = source_map.canonical_import_id
        left join public.problems anchor
          on anchor.id = source_map.learner_problem_id
       where source_map.question_id is null
          or source_map.canonical_import_id is null
          or source_map.learner_problem_id is null
          or anchor.id is null
          or anchor.source is distinct from 'curated'
          or anchor.domain is distinct from 'writing'
          or anchor.question_no is distinct from official.item_number
          or import_row.import_id is null
          or import_row.mapping_status <> 'promoted'
          or import_row.source_task_id <> source_map.question_id
          or import_row.source_task_id <> official.question_id
          or import_row.item_number is distinct from source_map.item_number
          or import_row.item_number is distinct from official.item_number
          or import_row.promoted_question_id is distinct from official.question_id
          or nullif(btrim(import_row.payload_hash), '') is null
    $check$
      into v_missing_version_links;

    if v_missing_version_links <> 0 then
      raise exception 'canonical_source_version_links_incomplete: %',
        v_missing_version_links;
    end if;

    select count(*)
      into v_incomplete_active_drafts
      from public.writing_drafts draft
      join public.problems problem on problem.id = draft.problem_id
      left join public.topik_writing_question_source_map source_map
        on source_map.learner_problem_id = problem.id
      left join public.topik_writing_question_import import_row
        on import_row.import_id = source_map.canonical_import_id
     where problem.domain = 'writing'
       and problem.source = 'curated'
       and draft.autosave_status <> 'superseded'
       and (
         nullif(btrim(coalesce(draft.answer_text, '')), '') is not null
         or (
           draft.answer_json is not null
           and draft.answer_json <> 'null'::jsonb
           and draft.answer_json <> '{}'::jsonb
         )
       )
       and not (
         nullif(btrim(draft.canonical_question_id), '') is not null
         and draft.canonical_import_id is not null
         and nullif(btrim(draft.canonical_payload_hash), '') is not null
         and jsonb_typeof(draft.question_snapshot) = 'object'
         and draft.canonical_question_id = source_map.question_id
         and draft.canonical_import_id = source_map.canonical_import_id
         and draft.canonical_payload_hash = import_row.payload_hash
       );

    if v_incomplete_active_drafts <> 0 then
      raise exception 'canonical_active_draft_version_pins_incomplete: %',
        v_incomplete_active_drafts;
    end if;

    if not exists (
      select 1
        from private.writing_draft_reconciliation_audit audit
       where audit.status = 'pinned'
         and audit.mismatch_count = 0
         and audit.pinned_count = audit.candidate_count
       order by audit.checked_at desc, audit.audit_id desc
       limit 1
    ) then
      raise exception 'canonical_draft_reconciliation_evidence_missing';
    end if;
  end if;

  insert into private.writing_read_control (
    singleton,
    read_mode,
    submission_mode,
    submission_contract_state,
    changed_by,
    change_reason,
    evidence_id,
    changed_at
  ) values (
    true,
    p_read_mode,
    p_submission_mode,
    p_submission_contract_state,
    btrim(p_actor),
    btrim(p_reason),
    nullif(btrim(p_evidence_id), ''),
    now()
  )
  on conflict (singleton) do update
    set read_mode = excluded.read_mode,
        submission_mode = excluded.submission_mode,
        submission_contract_state = excluded.submission_contract_state,
        changed_by = excluded.changed_by,
        change_reason = excluded.change_reason,
        evidence_id = excluded.evidence_id,
        changed_at = excluded.changed_at;

  insert into private.writing_runtime_state_audit (
    old_read_mode,
    old_submission_mode,
    old_submission_contract_state,
    new_read_mode,
    new_submission_mode,
    new_submission_contract_state,
    actor,
    reason_hash,
    evidence_id
  ) values (
    v_old_read_mode,
    v_old_submission_mode,
    v_old_submission_contract_state,
    p_read_mode,
    p_submission_mode,
    p_submission_contract_state,
    btrim(p_actor),
    md5(btrim(p_reason)),
    nullif(btrim(p_evidence_id), '')
  );
end;
$$;

revoke all on function private.set_writing_runtime_state(text, text, text, text, text, text) from public;
revoke all on function private.set_writing_runtime_state(text, text, text, text, text, text) from anon;
revoke all on function private.set_writing_runtime_state(text, text, text, text, text, text) from authenticated;
revoke all on function private.set_writing_runtime_state(text, text, text, text, text, text) from service_role;

comment on function private.set_writing_runtime_state(text, text, text, text, text, text) is
  'Internal atomic read/submission cutover switch. Call through the public service-role entrypoint.';

create or replace function public.set_writing_runtime_state(
  p_read_mode text,
  p_submission_mode text,
  p_submission_contract_state text,
  p_actor text,
  p_reason text,
  p_evidence_id text default null
)
returns void
language plpgsql
security definer
set search_path = pg_catalog, public, private
as $$
begin
  perform private.set_writing_runtime_state(
    p_read_mode,
    p_submission_mode,
    p_submission_contract_state,
    p_actor,
    p_reason,
    p_evidence_id
  );
end;
$$;

revoke all on function public.set_writing_runtime_state(text, text, text, text, text, text) from public;
revoke all on function public.set_writing_runtime_state(text, text, text, text, text, text) from anon;
revoke all on function public.set_writing_runtime_state(text, text, text, text, text, text) from authenticated;
grant execute on function public.set_writing_runtime_state(text, text, text, text, text, text) to service_role;

comment on function public.set_writing_runtime_state(text, text, text, text, text, text) is
  'Service-role-only atomic cutover entrypoint. Canonical reads require parity, learner_problem_id anchors, and active draft pins; canonical submissions additionally require recorded provider/outbox evidence.';

create or replace function private.project_writing_mirror_learner_materials(
  p_raw_payload jsonb,
  p_canonical_materials jsonb,
  p_question_no smallint
)
returns jsonb
language sql
stable
security definer
set search_path = pg_catalog, private
as $$
  select coalesce(jsonb_object_agg(
    learner_key,
    case
      when learner_key = 'charts' and p_question_no = 53 then
        jsonb_strip_nulls(jsonb_build_object(
          'chart_a', private.build_writing_learner_chart(
            p_raw_payload#>'{source_data,chart_a}'
          ),
          'chart_b', private.build_writing_learner_chart(
            p_raw_payload#>'{source_data,chart_b}'
          )
        ))
      else p_raw_payload->learner_key
    end
  ), '{}'::jsonb)
  from jsonb_object_keys(
    coalesce(p_canonical_materials, '{}'::jsonb)
      - 'canonical_import_id'
      - 'payload_hash'
  ) learner_key
$$;

revoke all on function private.project_writing_mirror_learner_materials(jsonb, jsonb, smallint) from public;
revoke all on function private.project_writing_mirror_learner_materials(jsonb, jsonb, smallint) from anon;
revoke all on function private.project_writing_mirror_learner_materials(jsonb, jsonb, smallint) from authenticated;
revoke all on function private.project_writing_mirror_learner_materials(jsonb, jsonb, smallint) from service_role;

create or replace function private.writing_mirror_learner_projection_matches(
  p_problem_id uuid,
  p_canonical_snapshot jsonb
)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public, private
as $$
  select coalesce(bool_and(
    problem.source = 'curated'
    and problem.domain = 'writing'
    and problem.question_no = (p_canonical_snapshot->>'item_number')::smallint
    and problem.topik_level = (p_canonical_snapshot->>'topik_level')::smallint
    and problem.difficulty is not distinct from
      (p_canonical_snapshot->>'difficulty')::smallint
    and problem.title is not distinct from p_canonical_snapshot->>'title'
    and problem.prompt is not distinct from p_canonical_snapshot->>'prompt'
    and to_jsonb(coalesce(problem.tags, '{}'::text[]))
      is not distinct from coalesce(p_canonical_snapshot->'tags', '[]'::jsonb)
    and private.project_writing_mirror_learner_materials(
      problem.materials,
      p_canonical_snapshot->'materials',
      problem.question_no
    ) is not distinct from (
      coalesce(p_canonical_snapshot->'materials', '{}'::jsonb)
        - 'canonical_import_id'
        - 'payload_hash'
    )
    and problem.publish_status = 'published'
    and problem.visibility = 'public'
    and problem.lifecycle_status = 'active'
  ), false)
  from public.problems problem
  where problem.id = p_problem_id
$$;

revoke all on function private.writing_mirror_learner_projection_matches(uuid, jsonb) from public;
revoke all on function private.writing_mirror_learner_projection_matches(uuid, jsonb) from anon;
revoke all on function private.writing_mirror_learner_projection_matches(uuid, jsonb) from authenticated;
revoke all on function private.writing_mirror_learner_projection_matches(uuid, jsonb) from service_role;

-- Existing drafts may outlive a later institution-exposure change. Reconcile
-- their exact learner-safe content without re-granting current list/detail
-- access. New draft/submission writers continue to use the user-visible
-- catalog snapshot function and therefore still enforce current exposure.
create or replace function private.get_writing_question_snapshot_for_reconciliation(
  p_problem_id uuid,
  p_question_id text,
  p_canonical_import_id bigint,
  p_payload_hash text,
  p_item_number smallint
)
returns jsonb
language sql
stable
security definer
set search_path = pg_catalog, public, private
as $$
  select jsonb_build_object(
    'question_id', question.question_id,
    'canonical_import_id', import_row.import_id::text,
    'payload_hash', import_row.payload_hash,
    'item_number', question.item_number,
    'topik_level', 2::smallint,
    'difficulty', case
      when question.difficulty_level is null then null
      else least(greatest(question.difficulty_level, 1), 5)::smallint
    end,
    'title', coalesce(
      nullif(import_row.raw_payload->>'topic_seed_title', ''),
      nullif(import_row.raw_payload#>>'{approved_topic_seed,topic_seed_title}', ''),
      nullif(import_row.raw_payload#>>'{scenario_logic,scenario_title}', ''),
      nullif(import_row.raw_payload->>'situation_summary', ''),
      nullif(import_row.raw_payload->>'topic_main', ''),
      '쓰기 문제'
    ),
    'prompt', question.prompt_text,
    'tags', coalesce((
      select array_agg(tag_value order by first_order, tag_value collate "C")
        from (
          select value as tag_value, min(sort_order) as first_order
            from (
              values
                (question.topic_main, 1),
                (question.topic_detail, 2),
                (question.speech_act, 3),
                (question.scenario_type, 4)
              union all
              select coalesce(nullif(tag.tag_value, ''), tag.tag_code), 10
                from public.topik_writing_question_tags tag
               where tag.question_id = question.question_id
                 and tag.item_number = question.item_number
                 and tag.is_active
            ) raw_tags(value, sort_order)
           where nullif(btrim(value), '') is not null
           group by value
        ) deduplicated_tags
    ), '{}'::text[]),
    'materials', question.materials || jsonb_build_object(
      'canonical_import_id', import_row.import_id,
      'payload_hash', import_row.payload_hash
    )
  )
  from private.topik_writing_question_learner_projection question
  join public.topik_writing_question_source_map source_map
    on source_map.question_id = question.question_id
   and source_map.item_number = question.item_number
   and source_map.learner_problem_id = p_problem_id
   and source_map.canonical_import_id = p_canonical_import_id
  join public.topik_writing_question_import import_row
    on import_row.import_id = source_map.canonical_import_id
   and import_row.source_task_id = question.question_id
   and import_row.promoted_question_id = question.question_id
   and import_row.item_number = question.item_number
   and import_row.mapping_status = 'promoted'
  where question.question_id = p_question_id
    and question.item_number = p_item_number
    and question.service_status = 'available'
    and import_row.payload_hash = p_payload_hash
  limit 1
$$;

revoke all on function private.get_writing_question_snapshot_for_reconciliation(uuid, text, bigint, text, smallint) from public;
revoke all on function private.get_writing_question_snapshot_for_reconciliation(uuid, text, bigint, text, smallint) from anon;
revoke all on function private.get_writing_question_snapshot_for_reconciliation(uuid, text, bigint, text, smallint) from authenticated;
revoke all on function private.get_writing_question_snapshot_for_reconciliation(uuid, text, bigint, text, smallint) from service_role;

create or replace function public.reconcile_active_writing_draft_versions(
  p_actor text,
  p_evidence_id text
)
returns table (
  candidate_count integer,
  pinned_count integer,
  mismatch_count integer,
  raw_diagnostic_mismatch_count integer,
  evidence_id text
)
language plpgsql
security definer
set search_path = pg_catalog, public, private
as $$
declare
  v_candidate record;
  v_candidate_count integer := 0;
  v_pinned_count integer := 0;
  v_mismatch_count integer := 0;
  v_raw_diagnostic_mismatch_count integer := 0;
  v_snapshot jsonb;
  v_read_mode text;
  v_submission_mode text;
begin
  if nullif(btrim(p_actor), '') is null then
    raise exception 'writing_draft_reconciliation_actor_required';
  end if;
  if nullif(btrim(p_evidence_id), '') is null then
    raise exception 'writing_draft_reconciliation_evidence_required';
  end if;

  select control.read_mode, control.submission_mode
    into v_read_mode, v_submission_mode
    from private.writing_read_control control
   where control.singleton
   for update;

  if v_read_mode is distinct from 'shadow'
     or v_submission_mode is distinct from 'blocked' then
    raise exception 'writing_draft_reconciliation_requires_shadow_blocked';
  end if;

  -- Freeze every source that participates in eligibility and the final pin.
  -- SHARE ROW EXCLUSIVE blocks concurrent promotions, mirror refreshes, and
  -- draft writes while still permitting read-only verification in this
  -- one-time maintenance transaction.
  lock table public.topik_writing_question_import
    in share row exclusive mode;
  lock table public.topik_writing_question_source_map
    in share row exclusive mode;
  lock table public.problems
    in share row exclusive mode;
  lock table public.writing_drafts
    in share row exclusive mode;

  perform private.assert_writing_canonical_content_parity();

  for v_candidate in
    select
      draft.id,
      draft.user_id,
      draft.problem_id,
      draft.question_no,
      draft.canonical_question_id,
      draft.canonical_import_id,
      draft.canonical_payload_hash,
      draft.question_snapshot,
      source_map.question_id as expected_question_id,
      source_map.canonical_import_id as expected_import_id,
      import_row.payload_hash as expected_payload_hash,
      import_row.raw_payload as expected_raw_payload,
      problem.materials as legacy_raw_payload,
      problem.answer_key as legacy_answer_key,
      problem.rubric as legacy_rubric
    from public.writing_drafts draft
    join public.problems problem on problem.id = draft.problem_id
    left join public.topik_writing_question_source_map source_map
      on source_map.learner_problem_id = draft.problem_id
     and source_map.item_number = draft.question_no
    left join public.topik_writing_question_import import_row
      on import_row.import_id = source_map.canonical_import_id
    where problem.domain = 'writing'
      and problem.source = 'curated'
      and draft.autosave_status <> 'superseded'
      and (
        nullif(btrim(coalesce(draft.answer_text, '')), '') is not null
        or (
          draft.answer_json is not null
          and draft.answer_json <> 'null'::jsonb
          and draft.answer_json <> '{}'::jsonb
        )
      )
    order by draft.id
  loop
    v_candidate_count := v_candidate_count + 1;
    v_snapshot := null;

    if v_candidate.expected_question_id is null
       or v_candidate.expected_import_id is null
       or nullif(btrim(v_candidate.expected_payload_hash), '') is null
       or (
         v_candidate.canonical_question_id is not null
         and v_candidate.canonical_question_id is distinct from v_candidate.expected_question_id
       )
       or (
         v_candidate.canonical_import_id is not null
         and v_candidate.canonical_import_id is distinct from v_candidate.expected_import_id
       )
       or (
         v_candidate.canonical_payload_hash is not null
         and v_candidate.canonical_payload_hash is distinct from v_candidate.expected_payload_hash
       ) then
      v_mismatch_count := v_mismatch_count + 1;
      continue;
    end if;

    if v_candidate.legacy_raw_payload is distinct from v_candidate.expected_raw_payload
       or v_candidate.legacy_answer_key is distinct from v_candidate.expected_raw_payload->'answer_key'
       or v_candidate.legacy_rubric is distinct from coalesce(
         v_candidate.expected_raw_payload->'rubric',
         v_candidate.expected_raw_payload->'approved_rubric'
       ) then
      -- Diagnostic only. Raw/answer/rubric payloads are not learner-visible
      -- and must never decide whether an answer may be version-pinned.
      v_raw_diagnostic_mismatch_count := v_raw_diagnostic_mismatch_count + 1;
    end if;

    begin
      v_snapshot := private.get_writing_question_snapshot_for_reconciliation(
        v_candidate.problem_id,
        v_candidate.expected_question_id,
        v_candidate.expected_import_id,
        v_candidate.expected_payload_hash,
        v_candidate.question_no
      );
    exception when others then
      v_mismatch_count := v_mismatch_count + 1;
      continue;
    end;

    if not private.writing_mirror_learner_projection_matches(
      v_candidate.problem_id,
      v_snapshot
    ) then
      v_mismatch_count := v_mismatch_count + 1;
      continue;
    end if;

    if v_candidate.question_snapshot is not null
       and v_candidate.question_snapshot is distinct from v_snapshot then
      v_mismatch_count := v_mismatch_count + 1;
    end if;
  end loop;

  if v_mismatch_count = 0 then
    perform set_config('app.writing_draft_reconciliation', 'on', true);
    update public.writing_drafts draft
       set canonical_question_id = source_map.question_id,
           canonical_import_id = source_map.canonical_import_id,
           canonical_payload_hash = import_row.payload_hash,
           question_snapshot = private.get_writing_question_snapshot_for_reconciliation(
             draft.problem_id,
             source_map.question_id,
             source_map.canonical_import_id,
             import_row.payload_hash,
             draft.question_no
           ),
           updated_at = now()
      from public.problems problem,
           public.topik_writing_question_source_map source_map,
           public.topik_writing_question_import import_row
     where problem.id = draft.problem_id
       and problem.domain = 'writing'
       and problem.source = 'curated'
       and source_map.learner_problem_id = draft.problem_id
       and source_map.item_number = draft.question_no
       and import_row.import_id = source_map.canonical_import_id
       and draft.autosave_status <> 'superseded'
       and (
         nullif(btrim(coalesce(draft.answer_text, '')), '') is not null
         or (
           draft.answer_json is not null
           and draft.answer_json <> 'null'::jsonb
           and draft.answer_json <> '{}'::jsonb
         )
       );
    get diagnostics v_pinned_count = row_count;
    perform set_config('app.writing_draft_reconciliation', 'off', true);

    if v_pinned_count is distinct from v_candidate_count then
      raise exception 'writing_draft_reconciliation_candidate_set_changed: expected %, pinned %',
        v_candidate_count,
        v_pinned_count;
    end if;
  end if;

  insert into private.writing_draft_reconciliation_audit (
    status,
    candidate_count,
    pinned_count,
    mismatch_count,
    raw_diagnostic_mismatch_count,
    actor,
    evidence_id
  ) values (
    case when v_mismatch_count = 0 then 'pinned' else 'blocked_mismatch' end,
    v_candidate_count,
    v_pinned_count,
    v_mismatch_count,
    v_raw_diagnostic_mismatch_count,
    btrim(p_actor),
    btrim(p_evidence_id)
  );

  return query select
    v_candidate_count,
    v_pinned_count,
    v_mismatch_count,
    v_raw_diagnostic_mismatch_count,
    btrim(p_evidence_id);
end;
$$;

revoke all on function public.reconcile_active_writing_draft_versions(text, text) from public;
revoke all on function public.reconcile_active_writing_draft_versions(text, text) from anon;
revoke all on function public.reconcile_active_writing_draft_versions(text, text) from authenticated;
grant execute on function public.reconcile_active_writing_draft_versions(text, text) to service_role;

comment on function public.reconcile_active_writing_draft_versions(text, text) is
  'Fail-closed active-draft pinning. Eligibility compares only the exact learner-safe mirror/canonical projection. Raw, answer, and rubric drift is recorded as a separate non-blocking diagnostic. Any learner-visible mismatch preserves every answer unchanged.';

-- Canonical mode replaces only curated mirror anchors. Other writing rows
-- (for example author-owned or AI-generated content) remain on the existing
-- public.problems path and must not disappear during this source cutover.
create or replace function private.is_canonical_writing_problem_anchor(
  p_problem_id uuid
)
returns boolean
language sql
security definer
stable
set search_path = pg_catalog, public
as $$
  select exists (
    select 1
      from public.topik_writing_question_source_map source_map
     where source_map.learner_problem_id = p_problem_id
  )
$$;

revoke all on function private.is_canonical_writing_problem_anchor(uuid) from public;
revoke all on function private.is_canonical_writing_problem_anchor(uuid) from anon;
grant execute on function private.is_canonical_writing_problem_anchor(uuid) to authenticated;
grant execute on function private.is_canonical_writing_problem_anchor(uuid) to service_role;

-- Client-side learning telemetry still references problem_id. In canonical
-- mode the retained public.problems row is intentionally private/inactive, so
-- the legacy study_events policy cannot authorize an otherwise visible
-- canonical question. This helper preserves the same learner visibility
-- contract as the canonical read RPC without exposing question content.
create or replace function private.is_canonical_writing_problem_visible_to_user(
  p_problem_id uuid,
  p_user_id uuid
)
returns boolean
language sql
security definer
stable
set search_path = pg_catalog, public, private
as $$
  select
    p_user_id is not null
    and p_user_id = (select auth.uid())
    and private.is_writing_canonical_read_enabled()
    and exists (
      select 1
        from public.get_available_writing_questions(null, p_problem_id)
    )
$$;

revoke all on function private.is_canonical_writing_problem_visible_to_user(uuid, uuid) from public;
revoke all on function private.is_canonical_writing_problem_visible_to_user(uuid, uuid) from anon;
grant execute on function private.is_canonical_writing_problem_visible_to_user(uuid, uuid) to authenticated;

-- Historical submission views must not depend on current canonical content.
-- This owner-scoped function reads the immutable submission snapshot when it
-- exists and the retained mirror title for legacy-unversioned submissions.
create or replace function public.get_writing_submission_history_context(
  p_submission_ids uuid[]
)
returns table (
  submission_id uuid,
  problem_id uuid,
  question_no smallint,
  title text
)
language sql
stable
security definer
set search_path = pg_catalog, public
as $$
  select
    submission.id,
    submission.problem_id,
    submission.question_no,
    coalesce(
      nullif(btrim(submission.question_snapshot->>'title'), ''),
      problem.title
    )
  from public.writing_submissions submission
  join public.problems problem on problem.id = submission.problem_id
  where submission.user_id = (select auth.uid())
    and submission.id = any(coalesce(p_submission_ids, '{}'::uuid[]))
    and problem.domain = 'writing'
$$;

revoke all on function public.get_writing_submission_history_context(uuid[])
  from public;
revoke all on function public.get_writing_submission_history_context(uuid[])
  from anon;
grant execute on function public.get_writing_submission_history_context(uuid[])
  to authenticated;

comment on function public.get_writing_submission_history_context(uuid[]) is
  'Owner-scoped legacy-history repository. Uses pinned safe snapshots or retained mirror titles and never current canonical content.';

-- Once current reads are canonical, every active canonical-anchor draft must
-- carry exact version context before any answer/status write. Superseded legacy
-- rows remain immutable history and are intentionally allowed to stay
-- unversioned.
create or replace function private.populate_writing_draft_question_snapshot()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public, private
as $$
declare
  v_requires_canonical_context boolean;
  v_reconciliation_snapshot jsonb;
begin
  v_requires_canonical_context :=
    new.autosave_status <> 'superseded'
    and private.is_writing_canonical_read_enabled()
    and private.is_canonical_writing_problem_anchor(new.problem_id);

  if v_requires_canonical_context and (
    nullif(btrim(new.canonical_question_id), '') is null
    or new.canonical_import_id is null
    or nullif(btrim(new.canonical_payload_hash), '') is null
  ) then
    raise exception 'canonical_draft_context_required'
      using errcode = 'P0001',
            detail = 'Active drafts on canonical writing anchors require the exact question/import/hash version.';
  end if;

  if new.canonical_question_id is null then
    new.question_snapshot := null;
    return new;
  end if;

  if current_setting('app.writing_draft_reconciliation', true) = 'on' then
    v_reconciliation_snapshot :=
      private.get_writing_question_snapshot_for_reconciliation(
        new.problem_id,
        new.canonical_question_id,
        new.canonical_import_id,
        new.canonical_payload_hash,
        new.question_no
      );
    if v_reconciliation_snapshot is null
       or new.question_snapshot is distinct from v_reconciliation_snapshot then
      raise exception 'writing_draft_reconciliation_snapshot_mismatch';
    end if;
  else
    new.question_snapshot := private.get_writing_question_snapshot_from_catalog(
      new.problem_id,
      new.canonical_question_id,
      new.canonical_import_id,
      new.canonical_payload_hash,
      new.question_no,
      new.user_id
    );
  end if;

  if private.jsonb_has_forbidden_writing_snapshot_key(new.question_snapshot) then
    raise exception 'canonical_snapshot_contains_forbidden_key';
  end if;

  return new;
end;
$$;

revoke all on function private.populate_writing_draft_question_snapshot() from public;
revoke all on function private.populate_writing_draft_question_snapshot() from anon;
revoke all on function private.populate_writing_draft_question_snapshot() from authenticated;
revoke all on function private.populate_writing_draft_question_snapshot() from service_role;

drop trigger if exists writing_drafts_populate_question_snapshot
  on public.writing_drafts;
create trigger writing_drafts_populate_question_snapshot
before insert or update of
  problem_id,
  question_no,
  user_id,
  answer_text,
  answer_json,
  autosave_status,
  canonical_question_id,
  canonical_import_id,
  canonical_payload_hash,
  question_snapshot
on public.writing_drafts
for each row
execute function private.populate_writing_draft_question_snapshot();

-- Canonical mode must be a write cutover as well as a read cutover. The two
-- legacy SECURITY DEFINER writers both call one of these guards, so rejecting
-- here prevents either writer from inserting a versionless submission after
-- the database switch is enabled.
create or replace function private.assert_writing_problem_submittable(
  p_problem_id uuid,
  p_question_no smallint
)
returns void
language plpgsql
security definer
set search_path = pg_catalog, public, private
as $$
begin
  if private.get_writing_submission_mode() = 'blocked' then
    raise exception 'writing_submission_temporarily_blocked'
      using errcode = 'P0001',
            detail = 'Writing submission is disabled until the provider or local outbox contract is verified.';
  end if;
  if private.get_writing_submission_mode() = 'canonical' then
    raise exception 'canonical_submission_v2_required'
      using errcode = 'P0001',
            detail = 'Canonical writing mode requires the version-pinned submission writer.';
  end if;

  if not exists (
    select 1
      from public.problems p
     where p.id = p_problem_id
       and p.domain = 'writing'
       and p.question_no = p_question_no
       and p.publish_status = 'published'
       and p.visibility = 'public'
       and p.lifecycle_status = 'active'
       and public.is_writing_problem_visible_to_caller(p.id, p.question_no)
  ) then
    raise exception 'problem_not_submittable'
      using errcode = 'P0001',
            detail = 'Writing submissions are allowed only for published, public, active, institution-visible writing problems.';
  end if;
end;
$$;

revoke all on function private.assert_writing_problem_submittable(uuid, smallint) from public;
grant execute on function private.assert_writing_problem_submittable(uuid, smallint) to authenticated;
comment on function private.assert_writing_problem_submittable(uuid, smallint) is
  'Legacy authenticated submission guard. Rejects all legacy writes while canonical writing mode is active.';

create or replace function private.assert_writing_problem_submittable_for_user(
  p_problem_id uuid,
  p_question_no smallint,
  p_user_id uuid
)
returns void
language plpgsql
security definer
set search_path = pg_catalog, public, private
as $$
begin
  if private.get_writing_submission_mode() = 'blocked' then
    raise exception 'writing_submission_temporarily_blocked'
      using errcode = 'P0001',
            detail = 'Writing submission is disabled until the provider or local outbox contract is verified.';
  end if;
  if private.get_writing_submission_mode() = 'canonical' then
    raise exception 'canonical_submission_v2_required'
      using errcode = 'P0001',
            detail = 'Canonical writing mode requires the version-pinned submission writer.';
  end if;

  if not exists (
    select 1
      from public.problems p
     where p.id = p_problem_id
       and p.domain = 'writing'
       and p.question_no = p_question_no
       and p.publish_status = 'published'
       and p.visibility = 'public'
       and p.lifecycle_status = 'active'
       and private.is_writing_problem_visible_to_user(p.id, p.question_no, p_user_id)
  ) then
    raise exception 'problem_not_submittable'
      using errcode = 'P0001',
            detail = 'Writing submissions are allowed only for published, public, active, institution-visible writing problems.';
  end if;
end;
$$;

revoke all on function private.assert_writing_problem_submittable_for_user(uuid, smallint, uuid) from public;
grant execute on function private.assert_writing_problem_submittable_for_user(uuid, smallint, uuid) to service_role;
comment on function private.assert_writing_problem_submittable_for_user(uuid, smallint, uuid) is
  'Legacy service submission guard. Rejects all legacy writes while canonical writing mode is active.';

-- Defense in depth for every insert path: once canonical submission is active, a
-- writing submission cannot be created without the exact canonical identity,
-- immutable import version, payload hash, safe snapshot, and grader contract.
create or replace function private.validate_writing_submission_canonical_context()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public, private
as $$
declare
  v_is_writing boolean;
  v_has_any_context boolean;
  v_has_complete_context boolean;
  v_submission_mode text;
  v_contract_state text;
begin
  select exists (
    select 1
      from public.problems problem
     where problem.id = new.problem_id
       and problem.domain = 'writing'
  ) into v_is_writing;

  v_has_any_context :=
    new.canonical_question_id is not null
    or new.canonical_import_id is not null
    or new.canonical_payload_hash is not null
    or new.question_snapshot is not null;
  v_has_complete_context :=
    nullif(btrim(new.canonical_question_id), '') is not null
    and new.canonical_import_id is not null
    and nullif(btrim(new.canonical_payload_hash), '') is not null
    and jsonb_typeof(new.question_snapshot) = 'object';

  select control.submission_mode, control.submission_contract_state
    into v_submission_mode, v_contract_state
    from private.writing_read_control control
   where control.singleton;

  if v_is_writing and v_submission_mode = 'blocked' then
    raise exception 'writing_submission_temporarily_blocked';
  end if;

  if v_submission_mode = 'canonical'
     and v_is_writing
     and not v_has_complete_context then
    raise exception 'canonical_submission_context_required';
  end if;

  if not v_has_any_context then
    return new;
  end if;

  if not v_has_complete_context then
    raise exception 'canonical_submission_context_required';
  end if;

  if v_is_writing
     and v_submission_mode <> 'canonical'
     and v_has_any_context then
    raise exception 'canonical_submission_mode_required';
  end if;

  if v_is_writing
     and v_submission_mode = 'canonical'
     and v_contract_state not in ('provider_verified', 'local_outbox_verified') then
    raise exception 'canonical_submission_contract_evidence_required';
  end if;

  if new.question_snapshot->>'question_id' is distinct from new.canonical_question_id
     or (new.question_snapshot->>'canonical_import_id')::bigint is distinct from new.canonical_import_id
     or new.question_snapshot->>'payload_hash' is distinct from new.canonical_payload_hash
     or (new.question_snapshot->>'item_number')::smallint is distinct from new.question_no then
    raise exception 'canonical_snapshot_identity_mismatch';
  end if;

  if private.jsonb_has_forbidden_writing_snapshot_key(new.question_snapshot) then
    raise exception 'canonical_snapshot_contains_forbidden_key';
  end if;

  perform private.assert_writing_question_submittable(
    new.problem_id,
    new.canonical_question_id,
    new.canonical_import_id,
    new.canonical_payload_hash,
    new.question_no,
    new.user_id
  );

  perform private.assert_writing_submission_snapshot_matches_catalog(
    new.problem_id,
    new.canonical_question_id,
    new.canonical_import_id,
    new.canonical_payload_hash,
    new.question_no,
    new.user_id,
    new.question_snapshot
  );

  return new;
end;
$$;

revoke all on function private.validate_writing_submission_canonical_context() from public;
revoke all on function private.validate_writing_submission_canonical_context() from anon;
revoke all on function private.validate_writing_submission_canonical_context() from authenticated;

drop policy if exists study_events_owner_insert on public.study_events;
create policy study_events_owner_insert
  on public.study_events
  for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and (
      problem_id is null
      or exists (
        select 1
          from public.problems problem
         where problem.id = study_events.problem_id
           and (
             (
               problem.publish_status = 'published'
               and (
                 problem.visibility = 'public'
                 or problem.author_id = (select auth.uid())
               )
             )
             or problem.author_id = (select auth.uid())
           )
      )
      or private.is_canonical_writing_problem_visible_to_user(
        study_events.problem_id,
        (select auth.uid())
      )
    )
    and (
      submission_id is null
      or exists (
        select 1
          from public.writing_submissions submission
         where submission.id = study_events.submission_id
           and submission.user_id = (select auth.uid())
      )
    )
    and (
      attempt_id is null
      or exists (
        select 1
          from public.problem_attempts attempt
         where attempt.id = study_events.attempt_id
           and attempt.user_id = (select auth.uid())
      )
    )
  );

drop policy if exists problems_visible_select on public.problems;
create policy problems_visible_select
  on public.problems
  for select to authenticated
  using (
    private.is_admin((select auth.uid()))
    or author_id = (select auth.uid())
    or (
      publish_status = 'published'
      and visibility = 'public'
      and (
        domain <> 'writing'
        or not private.is_writing_canonical_read_enabled()
        or not private.is_canonical_writing_problem_anchor(id)
      )
    )
  );

drop policy if exists problem_assets_select on public.problem_assets;
create policy problem_assets_select
  on public.problem_assets
  for select to authenticated
  using (
    exists (
      select 1
        from public.problems problem
       where problem.id = problem_assets.problem_id
         and (
           private.is_admin((select auth.uid()))
           or problem.author_id = (select auth.uid())
           or (
             problem.publish_status = 'published'
             and problem.visibility = 'public'
             and (
              problem.domain <> 'writing'
              or not private.is_writing_canonical_read_enabled()
              or not private.is_canonical_writing_problem_anchor(problem.id)
            )
           )
         )
    )
  );

-- Problem bookmarks remain direct owner inserts. In canonical mode the
-- content-free UUID anchor is intentionally not published, so visibility must
-- be proven through the learner-safe catalog instead of public.problems.
drop policy if exists library_items_owner_insert on public.library_items;
create policy library_items_owner_insert
  on public.library_items
  for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and (
      (item_type = 'attempt' and exists (
        select 1 from public.problem_attempts attempt
        where attempt.id = library_items.attempt_id
          and attempt.user_id = (select auth.uid())
      ))
      or (item_type = 'submission' and exists (
        select 1 from public.writing_submissions submission
        where submission.id = library_items.submission_id
          and submission.user_id = (select auth.uid())
      ))
      or (item_type = 'report' and exists (
        select 1 from public.comparison_reports report
        where report.id = library_items.report_id
          and report.user_id = (select auth.uid())
      ))
      or (item_type = 'export' and exists (
        select 1 from public.export_files export_file
        where export_file.id = library_items.export_id
          and export_file.user_id = (select auth.uid())
      ))
      or (item_type = 'problem' and exists (
        select 1 from public.problems problem
        where problem.id = library_items.problem_id
          and (
            (
              problem.publish_status = 'published'
              and (
                problem.visibility = 'public'
                or problem.author_id = (select auth.uid())
              )
            )
            or problem.author_id = (select auth.uid())
          )
      ))
      or (
        item_type = 'problem'
        and private.is_writing_canonical_read_enabled()
        and exists (
          select 1
            from public.get_available_writing_questions(
              null,
              library_items.problem_id
            ) canonical
        )
      )
    )
  );

comment on table private.writing_read_control is
  'Single runtime source of truth for writing reads and submissions. Defaults to legacy+legacy; canonical+blocked is the initial direct-read cutover state.';

-- Keep the mixed-domain problem list usable after direct writing rows are
-- hidden. Non-writing and legacy mode still use public.problems; canonical
-- writing rows come only from the learner-safe admin-owned RPC.
create or replace function public.list_user_problems(
  filter jsonb default '{}'::jsonb,
  sort text default 'newest',
  page int default 1,
  page_size int default 20
)
returns table (
  problem_id uuid,
  title text,
  domain text,
  topik_level smallint,
  question_no smallint,
  difficulty smallint,
  tags text[],
  attempt_count int,
  is_solved boolean,
  last_attempt_at timestamptz,
  created_at timestamptz,
  total_count bigint,
  solve_state text,
  has_draft boolean,
  draft_status text,
  writing_submission_count int,
  latest_submission_id uuid,
  latest_submission_at timestamptz,
  writing_feedback_status text,
  lifecycle_status text,
  lifecycle_reason text,
  publish_status text,
  review_status text
)
language plpgsql
set search_path = pg_catalog, public, private
stable
as $$
declare
  caller_id uuid := auth.uid();
  v_page int := greatest(coalesce(page, 1), 1);
  v_size int := least(greatest(coalesce(page_size, 20), 1), 100);
  v_offset int;
  f jsonb := coalesce(filter, '{}'::jsonb);
  f_domain text := nullif(f->>'domain', '');
  f_level int := nullif(f->>'topik_level', '')::int;
  f_qno int := nullif(f->>'question_no', '')::int;
  f_diff int := nullif(f->>'difficulty', '')::int;
  f_status text := nullif(f->>'status', '');
  f_search text := nullif(btrim(coalesce(f->>'search', '')), '');
  f_recommended boolean := coalesce((f->>'recommended')::boolean, false);
  f_review_set_id uuid := nullif(f->>'review_set_id', '')::uuid;
  v_sort text := coalesce(nullif(sort, ''), 'newest');
begin
  if caller_id is null then
    raise exception 'unauthenticated';
  end if;
  v_offset := (v_page - 1) * v_size;

  return query
  with catalog as (
    select
      problem.id,
      problem.title,
      problem.domain,
      problem.topik_level,
      problem.question_no,
      problem.difficulty,
      problem.tags,
      problem.created_at,
      problem.lifecycle_status,
      problem.lifecycle_reason,
      problem.publish_status,
      problem.review_status
    from public.problems problem
    where problem.publish_status = 'published'
      and (
        problem.domain <> 'writing'
        or (
          (
            not private.is_writing_canonical_read_enabled()
            or not private.is_canonical_writing_problem_anchor(problem.id)
          )
          and public.is_writing_problem_visible_to_caller(
            problem.id,
            problem.question_no
          )
        )
      )

    union all

    select
      canonical.problem_id,
      canonical.title,
      'writing'::text,
      canonical.topik_level,
      canonical.item_number,
      canonical.difficulty,
      canonical.tags,
      canonical.source_created_at,
      'active'::text,
      null::text,
      'published'::text,
      'approved'::text
    from public.get_available_writing_questions(null, null) canonical
    where private.is_writing_canonical_read_enabled()
  ),
  visible as (
    select catalog.*
    from catalog
    where (f_domain is null or catalog.domain = f_domain)
      and (f_level is null or catalog.topik_level = f_level)
      and (f_qno is null or catalog.question_no = f_qno)
      and (f_diff is null or catalog.difficulty = f_diff)
      and (f_search is null or catalog.title ilike '%' || f_search || '%')
      and (
        f_review_set_id is null
        or exists (
          select 1
          from public.study_events event
          cross join lateral jsonb_array_elements_text(
            event.payload->'item_ids'
          ) as selected(item_id)
          join public.library_items library
            on library.id = selected.item_id::uuid
          left join public.writing_submissions submission
            on submission.id = library.submission_id
          where event.id = f_review_set_id
            and event.user_id = caller_id
            and event.event_type = 'review_set_created'
            and library.user_id = caller_id
            and (
              library.problem_id = catalog.id
              or submission.problem_id = catalog.id
            )
        )
      )
      and (
        not f_recommended
        or exists (
          select 1
          from public.recommendation_items item
          join public.recommendation_runs run on run.id = item.run_id
          where item.problem_id = catalog.id
            and run.user_id = caller_id
            and coalesce(item.status, 'active') = 'active'
            and (run.expires_at is null or run.expires_at > now())
        )
      )
  ),
  with_activity as (
    select
      visible.*,
      coalesce(attempt.objective_attempt_count, 0) as objective_attempt_count,
      coalesce(attempt.objective_is_solved, false) as objective_is_solved,
      attempt.objective_last_attempt_at,
      coalesce(draft.has_draft, false) as has_draft,
      draft.draft_status,
      draft.latest_draft_at,
      coalesce(submission.writing_submission_count, 0) as writing_submission_count,
      submission.latest_submission_id,
      submission.latest_submission_at,
      submission.writing_feedback_status
    from visible
    left join lateral (
      select
        count(*)::int as objective_attempt_count,
        coalesce(bool_or(problem_attempt.is_correct), false) as objective_is_solved,
        max(problem_attempt.started_at) as objective_last_attempt_at
      from public.problem_attempts problem_attempt
      where problem_attempt.problem_id = visible.id
        and problem_attempt.user_id = caller_id
    ) attempt on true
    left join lateral (
      select
        (count(*) > 0) as has_draft,
        (array_agg(
          writing_draft.autosave_status
          order by writing_draft.last_saved_at desc nulls last
        ))[1] as draft_status,
        max(writing_draft.last_saved_at) as latest_draft_at
      from public.writing_drafts writing_draft
      where writing_draft.problem_id = visible.id
        and writing_draft.user_id = caller_id
        and writing_draft.autosave_status <> 'superseded'
    ) draft on true
    left join lateral (
      select
        count(*)::int as writing_submission_count,
        (array_agg(
          writing_submission.id
          order by writing_submission.submitted_at desc
        ))[1] as latest_submission_id,
        max(writing_submission.submitted_at) as latest_submission_at,
        (array_agg(
          writing_submission.feedback_status
          order by writing_submission.submitted_at desc
        ))[1] as writing_feedback_status
      from public.writing_submissions writing_submission
      where writing_submission.problem_id = visible.id
        and writing_submission.user_id = caller_id
    ) submission on true
  ),
  with_status as (
    select
      activity.*,
      case
        when activity.domain = 'writing'
          and activity.writing_submission_count > 0 then 'submitted'
        when activity.domain = 'writing' and activity.has_draft then 'attempted'
        when activity.domain <> 'writing'
          and activity.objective_is_solved then 'submitted'
        when activity.domain <> 'writing'
          and activity.objective_attempt_count > 0 then 'attempted'
        else 'none'
      end as solve_state,
      case
        when activity.domain = 'writing' then
          activity.writing_submission_count
          + case
              when activity.has_draft
                and activity.writing_submission_count = 0 then 1
              else 0
            end
        else activity.objective_attempt_count
      end as effective_attempt_count,
      case
        when activity.domain = 'writing' then
          activity.writing_submission_count > 0
        else activity.objective_is_solved
      end as effective_is_solved,
      case
        when activity.domain = 'writing' then
          case
            when activity.latest_submission_at is not null
              and activity.latest_draft_at is not null
              then greatest(
                activity.latest_submission_at,
                activity.latest_draft_at
              )
            else coalesce(
              activity.latest_submission_at,
              activity.latest_draft_at
            )
          end
        else activity.objective_last_attempt_at
      end as effective_last_attempt_at
    from with_activity activity
  ),
  filtered as (
    select status.*
    from with_status status
    where f_status is null
       or (f_status = 'solved' and status.solve_state = 'submitted')
       or (f_status = 'attempted' and status.solve_state = 'attempted')
       or (f_status = 'unattempted' and status.solve_state = 'none')
  ),
  counted as (
    select filtered.*, count(*) over () as total_count
    from filtered
  )
  select
    counted.id,
    counted.title,
    counted.domain,
    counted.topik_level,
    counted.question_no,
    counted.difficulty,
    counted.tags,
    counted.effective_attempt_count,
    counted.effective_is_solved,
    counted.effective_last_attempt_at,
    counted.created_at,
    counted.total_count,
    counted.solve_state,
    counted.has_draft,
    counted.draft_status,
    counted.writing_submission_count,
    counted.latest_submission_id,
    counted.latest_submission_at,
    counted.writing_feedback_status,
    counted.lifecycle_status,
    counted.lifecycle_reason,
    counted.publish_status,
    counted.review_status
  from counted
  order by
    case
      when v_sort in ('difficulty-asc', 'difficulty')
        then counted.difficulty
    end asc nulls last,
    case when v_sort = 'difficulty-desc' then counted.difficulty end desc nulls last,
    case when v_sort = 'oldest' then counted.created_at end asc nulls last,
    case
      when v_sort in (
        'newest',
        'recent',
        'difficulty',
        'difficulty-asc',
        'difficulty-desc'
      ) then counted.created_at
    end desc nulls last,
    counted.id asc
  limit v_size offset v_offset;
end;
$$;

revoke all on function public.list_user_problems(jsonb, text, int, int) from public;
revoke all on function public.list_user_problems(jsonb, text, int, int) from anon;
grant execute on function public.list_user_problems(jsonb, text, int, int) to authenticated;

comment on function public.list_user_problems(jsonb, text, int, int) is
  'Mixed-domain list. In canonical DB mode, writing catalog rows come from the learner-safe canonical RPC while stable UUID activity joins remain in v13.';

create or replace function public.list_user_library_problem_items()
returns table (
  item_id uuid,
  problem_id uuid,
  title text,
  question_no smallint,
  answer_text text,
  tags text[],
  saved_at timestamptz,
  availability_status text,
  availability_reason text,
  can_retry boolean
)
language plpgsql
security definer
set search_path = pg_catalog, public, private
as $$
declare
  caller_id uuid := auth.uid();
begin
  if caller_id is null then
    raise exception 'unauthenticated';
  end if;

  return query
  with writing_catalog as (
    select
      problem.id,
      problem.title,
      problem.question_no,
      problem.publish_status,
      problem.visibility,
      problem.lifecycle_status,
      problem.lifecycle_reason,
      public.is_writing_problem_visible_to_caller(
        problem.id,
        problem.question_no
      ) as institution_visible
    from public.problems problem
    where problem.domain = 'writing'
      and (
        not private.is_writing_canonical_read_enabled()
        or not private.is_canonical_writing_problem_anchor(problem.id)
      )

    union all

    select
      canonical.problem_id,
      canonical.title,
      canonical.item_number,
      'published'::text,
      'public'::text,
      'active'::text,
      null::text,
      true
    from public.get_available_writing_questions(null, null) canonical
    where private.is_writing_canonical_read_enabled()
  ),
  saved_problem_items as (
    select
      library.id as item_id,
      library.problem_id,
      coalesce(library.tags, '{}'::text[]) as tags,
      library.saved_at,
      catalog.id as joined_problem_id,
      catalog.title,
      catalog.question_no,
      catalog.publish_status,
      catalog.visibility,
      catalog.lifecycle_status,
      catalog.lifecycle_reason,
      coalesce(catalog.institution_visible, false) as institution_visible
    from public.library_items library
    left join writing_catalog catalog on catalog.id = library.problem_id
    where library.user_id = caller_id
      and library.item_type = 'problem'
  )
  select
    saved.item_id,
    saved.problem_id,
    case
      when saved.joined_problem_id is not null
       and saved.publish_status = 'published'
       and saved.visibility = 'public'
       and saved.institution_visible
      then saved.title
      else null
    end,
    case
      when saved.joined_problem_id is not null
       and saved.publish_status = 'published'
       and saved.visibility = 'public'
       and saved.institution_visible
      then saved.question_no
      else null
    end,
    case
      when saved.joined_problem_id is not null
       and saved.publish_status = 'published'
       and saved.visibility = 'public'
       and saved.institution_visible
      then coalesce(latest_draft.answer_text, latest_submission.answer_text)
      else null
    end,
    saved.tags,
    saved.saved_at,
    case
      when saved.joined_problem_id is null then 'hard_unavailable'
      when saved.publish_status = 'published'
       and saved.visibility = 'public'
       and saved.institution_visible
       and saved.lifecycle_status = 'active'
      then 'available'
      when saved.publish_status = 'published'
       and saved.visibility = 'public'
       and saved.institution_visible
      then 'soft_unavailable'
      else 'hard_unavailable'
    end,
    case
      when saved.joined_problem_id is null then null
      when saved.publish_status = 'published'
       and saved.visibility = 'public'
       and saved.institution_visible
       and saved.lifecycle_status is distinct from 'active'
      then saved.lifecycle_reason
      else null
    end,
    (
      saved.joined_problem_id is not null
      and saved.publish_status = 'published'
      and saved.visibility = 'public'
      and saved.institution_visible
      and saved.lifecycle_status = 'active'
    )
  from saved_problem_items saved
  left join lateral (
    select draft.answer_text
    from public.writing_drafts draft
    where draft.user_id = caller_id
      and draft.problem_id = saved.problem_id
      and draft.autosave_status <> 'superseded'
      and nullif(btrim(coalesce(draft.answer_text, '')), '') is not null
    order by coalesce(
      draft.last_saved_at,
      draft.updated_at,
      draft.created_at
    ) desc
    limit 1
  ) latest_draft on true
  left join lateral (
    select submission.answer_text
    from public.writing_submissions submission
    where submission.user_id = caller_id
      and submission.problem_id = saved.problem_id
      and nullif(btrim(submission.answer_text), '') is not null
    order by submission.submitted_at desc
    limit 1
  ) latest_submission on true
  order by saved.saved_at desc;
end;
$$;

revoke all on function public.list_user_library_problem_items() from public;
revoke all on function public.list_user_library_problem_items() from anon;
grant execute on function public.list_user_library_problem_items() to authenticated;

comment on function public.list_user_library_problem_items() is
  'Saved writing items. Canonical DB mode resolves current title, type, institution exposure, and retry availability only through the learner-safe canonical RPC; user answer previews remain v13-owned.';
