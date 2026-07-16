-- Track upstream writing-question revisions by source updated_at and canonical content.
--
-- question_id remains the logical family key. payload_hash preserves the exact raw
-- response, while content_hash excludes source/transport/operational metadata so a
-- timestamp-only resend cannot move the learner-visible canonical pointer.
-- Tracker: topik_writing_schema_migrations (supabase/migrations).

create or replace function private.try_parse_writing_source_time(p_value text)
returns timestamptz
language plpgsql
immutable
set search_path = pg_catalog
as $$
begin
  if nullif(btrim(p_value), '') is null then
    return null;
  end if;

  -- Reject timezone-less values. The source contract is UTC ISO-8601, and
  -- accepting local timestamps would make revision ordering session-dependent.
  if btrim(p_value) !~* '^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}([.]\d+)?(Z|[+]00(:?00)?)$' then
    return null;
  end if;

  return p_value::timestamptz;
exception when others then
  return null;
end;
$$;

create or replace function private.writing_question_content_projection(
  p_raw_payload jsonb,
  p_item_number smallint
)
returns jsonb
language plpgsql
stable
set search_path = pg_catalog, public
as $$
declare
  v_relation regclass;
  v_projection jsonb;
begin
  if p_raw_payload is null
     or jsonb_typeof(p_raw_payload) <> 'object'
     or p_item_number not in (51, 52, 53, 54) then
    return null;
  end if;

  v_relation := to_regclass(format('public.topik_writing_%s_questions', p_item_number));
  if v_relation is null then
    return null;
  end if;

  select coalesce(jsonb_object_agg(entry.key, entry.value order by entry.key), '{}'::jsonb)
    into v_projection
    from jsonb_each(p_raw_payload) as entry
   where entry.key in (
     select attribute.attname
       from pg_attribute as attribute
      where attribute.attrelid = v_relation
        and attribute.attnum > 0
        and not attribute.attisdropped
   )
     and entry.key <> all(array[
       'question_id',
       'item_number',
       'created_at',
       'updated_at',
       'schema_version',
       'source_exam_reference',
       'source_reference',
       'exam_name',
       'section',
       'service_status',
       'auto_checks_passed',
       'recommendation_keys',
       'avoid_repeat_keys',
       'content_team_memo'
     ]::text[]);

  return v_projection;
end;
$$;

create or replace function private.writing_question_content_hash(
  p_raw_payload jsonb,
  p_item_number smallint
)
returns text
language sql
stable
set search_path = pg_catalog, public, private
as $$
  select case
    when private.writing_question_content_projection(p_raw_payload, p_item_number) is null
      then null
    else md5(private.writing_question_content_projection(p_raw_payload, p_item_number)::text)
  end;
$$;

revoke all on function private.try_parse_writing_source_time(text) from public, anon, authenticated, service_role;
revoke all on function private.writing_question_content_projection(jsonb, smallint) from public, anon, authenticated, service_role;
revoke all on function private.writing_question_content_hash(jsonb, smallint) from public, anon, authenticated, service_role;

alter table public.topik_writing_question_import
  add column if not exists source_created_at timestamptz,
  add column if not exists source_updated_at timestamptz,
  add column if not exists content_hash text,
  add column if not exists version_decision text;

update public.topik_writing_question_import
   set source_created_at = private.try_parse_writing_source_time(raw_payload->>'created_at'),
       source_updated_at = coalesce(
         private.try_parse_writing_source_time(raw_payload->>'updated_at'),
         private.try_parse_writing_source_time(raw_payload->>'created_at')
       ),
       content_hash = private.writing_question_content_hash(raw_payload, item_number),
       version_decision = 'legacy'
 where source_created_at is null
    or source_updated_at is null
    or content_hash is null
    or version_decision is null;

alter table public.topik_writing_question_import
  alter column version_decision set not null;

do $$
begin
  if not exists (
    select 1
      from pg_constraint
     where conname = 'topik_writing_question_import_version_decision_check'
       and conrelid = 'public.topik_writing_question_import'::regclass
  ) then
    alter table public.topik_writing_question_import
      add constraint topik_writing_question_import_version_decision_check
      check (version_decision in (
        'legacy',
        'initial',
        'content_changed',
        'metadata_only',
        'out_of_order',
        'timestamp_conflict',
        'identity_conflict',
        'invalid_timestamp'
      ));
  end if;
end;
$$;

create index if not exists topik_writing_question_import_source_updated_idx
  on public.topik_writing_question_import (source_task_id, source_updated_at desc, import_id desc);

comment on column public.topik_writing_question_import.source_created_at is
  'External API created_at. Immutable family baseline for the same source_task_id/question_id.';
comment on column public.topik_writing_question_import.source_updated_at is
  'External API updated_at. Orders upstream revisions; never acts as the canonical version identifier.';
comment on column public.topik_writing_question_import.content_hash is
  'MD5 of the canonical learner/grading projection. Source timestamps and transport/operational metadata are excluded.';
comment on column public.topik_writing_question_import.version_decision is
  'Revision classification. Only initial/content_changed rows are eligible for canonical promotion; legacy preserves pre-cutover history.';
comment on column public.topik_writing_question_import.is_latest is
  'Most recently received raw response for the source_task_id. Learner-visible current content is pinned only by question_source_map.canonical_import_id.';

create or replace function public.admin_ingest_writing_task(
  p_actor_id uuid,
  p_source_task_id text,
  p_raw_payload jsonb,
  p_raw_response_text text default null,
  p_item_number smallint default null,
  p_source_endpoint text default null
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, private
as $$
declare
  v_sid text := nullif(btrim(p_source_task_id), '');
  v_text text;
  v_payload_hash text;
  v_content_hash text;
  v_source_created_at timestamptz;
  v_source_updated_at timestamptz;
  v_family_created_at timestamptz;
  v_latest_source_updated_at timestamptz;
  v_family_item_number smallint;
  v_family_item_number_count integer := 0;
  v_reference_content_hash text;
  v_import_id bigint;
  v_existing_id bigint;
  v_has_family boolean := false;
  v_version_decision text;
  v_mapping_status text;
  v_hold_reason text;
  v_event text;
begin
  if p_actor_id is null then
    raise exception 'actor required';
  end if;
  if not private.is_content_admin(p_actor_id) then
    raise exception 'forbidden: content_admin required';
  end if;
  if v_sid is null then
    raise exception 'source_task_id required';
  end if;
  if p_raw_payload is null or jsonb_typeof(p_raw_payload) <> 'object' then
    raise exception 'raw_payload must be a json object';
  end if;
  if p_item_number is not null and p_item_number not in (51, 52, 53, 54) then
    raise exception 'item_number must be null or one of 51/52/53/54';
  end if;

  -- Serialize classification for one logical question without blocking other IDs.
  perform pg_advisory_xact_lock(hashtextextended('topik-writing-question:' || v_sid, 0));

  v_text := coalesce(p_raw_response_text, p_raw_payload::text);
  v_payload_hash := md5(v_text);
  v_source_created_at := private.try_parse_writing_source_time(p_raw_payload->>'created_at');
  v_source_updated_at := private.try_parse_writing_source_time(p_raw_payload->>'updated_at');
  v_content_hash := private.writing_question_content_hash(p_raw_payload, p_item_number);

  select import_id
    into v_existing_id
    from public.topik_writing_question_import
   where source_task_id = v_sid
     and payload_hash = v_payload_hash
   for update;

  if v_existing_id is not null then
    update public.topik_writing_question_import
       set is_latest = false
     where source_task_id = v_sid
       and import_id <> v_existing_id
       and is_latest;

    update public.topik_writing_question_import
       set last_seen_at = now(),
           ingest_count = ingest_count + 1,
           item_number = coalesce(p_item_number, item_number),
           source_endpoint = coalesce(p_source_endpoint, source_endpoint),
           is_latest = true
     where import_id = v_existing_id;

    return jsonb_build_object(
      'status', 'unchanged',
      'import_id', v_existing_id,
      'source_task_id', v_sid,
      'payload_hash', v_payload_hash,
      'item_number', p_item_number
    );
  end if;

  select
    exists(select 1 from public.topik_writing_question_import where source_task_id = v_sid),
    min(source_created_at) filter (
      where source_created_at is not null
        and version_decision not in ('invalid_timestamp', 'identity_conflict')
    ),
    max(source_updated_at) filter (
      where source_updated_at is not null
        and version_decision not in ('invalid_timestamp', 'identity_conflict')
    ),
    min(item_number) filter (
      where item_number is not null
        and version_decision not in ('invalid_timestamp', 'identity_conflict')
    ),
    count(distinct item_number) filter (
      where item_number is not null
        and version_decision not in ('invalid_timestamp', 'identity_conflict')
    )
  into
    v_has_family,
    v_family_created_at,
    v_latest_source_updated_at,
    v_family_item_number,
    v_family_item_number_count
  from public.topik_writing_question_import
  where source_task_id = v_sid;

  select question_import.content_hash
    into v_reference_content_hash
    from public.topik_writing_question_import as question_import
   where question_import.source_task_id = v_sid
     and question_import.content_hash is not null
     and question_import.version_decision in ('legacy', 'initial', 'content_changed', 'metadata_only')
     and (
       question_import.mapping_status = 'promoted'
       or question_import.raw_payload->>'review_status' = U&'\AC80\C218 \C644\B8CC'
     )
   order by question_import.source_updated_at desc nulls last, question_import.import_id desc
   limit 1;

  if v_source_created_at is null
     or v_source_updated_at is null
     or v_source_updated_at < v_source_created_at then
    v_version_decision := 'invalid_timestamp';
    v_hold_reason := 'invalid_timestamp: created_at/updated_at must be valid and updated_at must not precede created_at';
  elsif v_content_hash is null
     or p_item_number is null
     or nullif(btrim(p_raw_payload->>'question_id'), '') is null
     or btrim(p_raw_payload->>'question_id') is distinct from v_sid
     or (nullif(btrim(p_raw_payload->>'item_number'), '') is not null and btrim(p_raw_payload->>'item_number') is distinct from p_item_number::text)
     or (v_family_created_at is not null and v_family_created_at is distinct from v_source_created_at)
     or v_family_item_number_count > 1
     or (v_family_item_number is not null and v_family_item_number is distinct from p_item_number) then
    v_version_decision := 'identity_conflict';
    v_hold_reason := 'identity_conflict: question_id, item_number, or created_at differs from the existing question family';
  elsif not v_has_family then
    v_version_decision := 'initial';
  elsif v_latest_source_updated_at is not null and v_source_updated_at < v_latest_source_updated_at then
    v_version_decision := 'out_of_order';
    v_hold_reason := 'out_of_order: source updated_at is older than the latest observed source revision';
  elsif v_latest_source_updated_at is not null and v_source_updated_at = v_latest_source_updated_at then
    if v_reference_content_hash is not null and v_content_hash = v_reference_content_hash then
      v_version_decision := 'metadata_only';
      v_hold_reason := 'metadata_only: canonical learner/grading content is unchanged';
    else
      v_version_decision := 'timestamp_conflict';
      v_hold_reason := 'timestamp_conflict: content changed without a strictly newer source updated_at';
    end if;
  elsif v_reference_content_hash is not null and v_content_hash = v_reference_content_hash then
    v_version_decision := 'metadata_only';
    v_hold_reason := 'metadata_only: canonical learner/grading content is unchanged';
  elsif v_reference_content_hash is null then
    v_version_decision := 'initial';
  else
    v_version_decision := 'content_changed';
  end if;

  if v_version_decision in ('initial', 'content_changed') then
    v_mapping_status := 'raw';
    v_event := case when v_version_decision = 'initial' then 'inserted' else 'new_version' end;
  else
    v_mapping_status := 'held';
    v_event := case when v_version_decision = 'metadata_only' then 'metadata_only' else 'held' end;
  end if;

  update public.topik_writing_question_import
     set is_latest = false
   where source_task_id = v_sid
     and is_latest;

  insert into public.topik_writing_question_import (
    source_task_id,
    payload_hash,
    raw_payload,
    raw_response_text,
    item_number,
    source_endpoint,
    is_latest,
    mapping_status,
    hold_reason,
    source_created_at,
    source_updated_at,
    content_hash,
    version_decision
  ) values (
    v_sid,
    v_payload_hash,
    p_raw_payload,
    p_raw_response_text,
    p_item_number,
    p_source_endpoint,
    true,
    v_mapping_status,
    v_hold_reason,
    v_source_created_at,
    v_source_updated_at,
    v_content_hash,
    v_version_decision
  )
  returning import_id into v_import_id;

  insert into public.admin_audit_logs (
    admin_user_id,
    action,
    target_table,
    target_id,
    diff,
    payload
  ) values (
    p_actor_id,
    'question_received',
    'AssessmentQuestionImport',
    v_sid,
    '{}'::jsonb,
    jsonb_build_object(
      'event', v_event,
      'import_id', v_import_id,
      'payload_hash', v_payload_hash,
      'content_hash', v_content_hash,
      'version_decision', v_version_decision,
      'source_created_at', v_source_created_at,
      'source_updated_at', v_source_updated_at,
      'item_number', p_item_number,
      'source_endpoint', p_source_endpoint
    )
  );

  return jsonb_build_object(
    'status', v_event,
    'import_id', v_import_id,
    'source_task_id', v_sid,
    'payload_hash', v_payload_hash,
    'content_hash', v_content_hash,
    'version_decision', v_version_decision,
    'hold_reason', v_hold_reason,
    'item_number', p_item_number
  );
end;
$$;

revoke all on function public.admin_ingest_writing_task(uuid, text, jsonb, text, smallint, text) from public, anon, authenticated;
grant execute on function public.admin_ingest_writing_task(uuid, text, jsonb, text, smallint, text) to service_role;

comment on function public.admin_ingest_writing_task(uuid, text, jsonb, text, smallint, text) is
  'Service-role ingest. Serializes by question_id, preserves exact payload_hash rows, and promotes only strictly newer source updated_at plus changed canonical content_hash.';

create or replace function public.admin_ingest_writing_tasks_bulk(
  p_actor_id uuid,
  p_source_endpoint text,
  p_tasks jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_item jsonb;
  v_res jsonb;
  v_status text;
  v_inserted integer := 0;
  v_new_version integer := 0;
  v_metadata_only integer := 0;
  v_held integer := 0;
  v_unchanged integer := 0;
  v_failed integer := 0;
  v_failures jsonb := '[]'::jsonb;
begin
  if p_actor_id is null then
    raise exception 'actor required';
  end if;
  if not private.is_content_admin(p_actor_id) then
    raise exception 'forbidden: content_admin required';
  end if;
  if p_tasks is null or jsonb_typeof(p_tasks) <> 'array' then
    raise exception 'tasks must be a json array';
  end if;

  -- Consistent family order prevents two concurrent bulk requests from taking
  -- the same advisory locks in opposite order.
  for v_item in
    select task.value
      from jsonb_array_elements(p_tasks) as task(value)
     order by task.value->>'source_task_id'
  loop
    begin
      v_res := public.admin_ingest_writing_task(
        p_actor_id,
        v_item->>'source_task_id',
        v_item->'raw_payload',
        v_item->>'raw_response_text',
        nullif(v_item->>'item_number', '')::smallint,
        p_source_endpoint
      );
      v_status := v_res->>'status';
      if v_status = 'inserted' then
        v_inserted := v_inserted + 1;
      elsif v_status = 'new_version' then
        v_new_version := v_new_version + 1;
      elsif v_status = 'metadata_only' then
        v_metadata_only := v_metadata_only + 1;
      elsif v_status = 'held' then
        v_held := v_held + 1;
      else
        v_unchanged := v_unchanged + 1;
      end if;
    exception when others then
      v_failed := v_failed + 1;
      if jsonb_array_length(v_failures) < 50 then
        v_failures := v_failures || jsonb_build_object(
          'source_task_id', v_item->>'source_task_id',
          'error', left(coalesce(sqlerrm, ''), 300)
        );
      end if;
    end;
  end loop;

  return jsonb_build_object(
    'inserted', v_inserted,
    'new_version', v_new_version,
    'metadata_only', v_metadata_only,
    'held', v_held,
    'unchanged', v_unchanged,
    'failed', v_failed,
    'total', jsonb_array_length(p_tasks),
    'failures', v_failures
  );
end;
$$;

revoke all on function public.admin_ingest_writing_tasks_bulk(uuid, text, jsonb) from public, anon, authenticated;
grant execute on function public.admin_ingest_writing_tasks_bulk(uuid, text, jsonb) to service_role;

comment on function public.admin_ingest_writing_tasks_bulk(uuid, text, jsonb) is
  'Service-role bulk ingest with inserted/new_version/metadata_only/held/unchanged/failed revision counts.';

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
  v_new integer := 0;
  v_updated integer := 0;
  v_held integer := 0;
  v_skipped_review integer := 0;
  v_idempotent_skipped integer := 0;
  v_failures jsonb := '[]'::jsonb;
begin
  if p_actor_id is null then
    raise exception 'actor required';
  end if;
  if not private.is_content_admin(p_actor_id) then
    raise exception 'forbidden: content_admin required';
  end if;
  if to_regprocedure('private.ensure_writing_problem_identity(uuid,text,smallint)') is null then
    raise exception 'missing v13 dependency: writing problem identity registry function';
  end if;

  for v_row in
    select
      imp.import_id,
      imp.source_task_id,
      imp.payload_hash,
      imp.content_hash,
      imp.source_created_at,
      imp.source_updated_at,
      imp.version_decision,
      imp.item_number,
      imp.promoted_question_id,
      imp.raw_payload
    from public.topik_writing_question_import as imp
    where imp.mapping_status in ('raw', 'mapped', 'held')
      and imp.version_decision in ('initial', 'content_changed')
      and (p_question_ids is null or imp.source_task_id = any(p_question_ids))
    order by imp.source_task_id, imp.source_updated_at nulls last, imp.import_id
    for update skip locked
  loop
    begin
      perform pg_advisory_xact_lock(hashtextextended('topik-writing-question:' || v_row.source_task_id, 0));

      if v_row.raw_payload->>'review_status' is distinct from U&'\AC80\C218 \C644\B8CC' then
        update public.topik_writing_question_import
           set mapping_status = 'held',
               hold_reason = 'review incomplete: review_status<>검수 완료'
         where import_id = v_row.import_id;
        v_skipped_review := v_skipped_review + 1;
        continue;
      end if;
      if v_row.content_hash is null
         or v_row.source_created_at is null
         or v_row.source_updated_at is null then
        raise exception 'eligible revision is missing source timestamps or content_hash';
      end if;
      if v_row.item_number is null or v_row.item_number not in (51, 52, 53, 54) then
        raise exception 'unresolvable item_number';
      end if;
      if nullif(btrim(v_row.raw_payload->>'question_id'), '') is null
         or btrim(v_row.raw_payload->>'question_id') is distinct from v_row.source_task_id then
        raise exception 'question_id mismatch between inbox key and payload';
      end if;
      if v_row.promoted_question_id is not null
         and v_row.promoted_question_id is distinct from v_row.source_task_id then
        raise exception 'promoted_question_id mismatch between inbox and source task';
      end if;
      if nullif(v_row.raw_payload->>'item_number', '') is not null
         and btrim(v_row.raw_payload->>'item_number') is distinct from v_row.item_number::text then
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
      select source_map.learner_problem_id, source_map.item_number, source_map.canonical_import_id
        into v_learner_problem_id, v_existing_item_number, v_existing_import_id
        from public.topik_writing_question_source_map as source_map
       where source_map.question_id = v_row.source_task_id
       for update;
      if v_existing_item_number is not null and v_existing_item_number <> v_row.item_number then
        raise exception 'source map item_number collision';
      end if;

      if v_existing_import_id = v_row.import_id then
        if v_existing_status is null then
          raise exception 'canonical_question_missing_for_pinned_import';
        end if;
        if v_learner_problem_id is distinct from md5(v_row.source_task_id)::uuid then
          raise exception 'canonical_question_identity_mismatch';
        end if;

        select question_import.payload_hash
          into v_existing_payload_hash
          from public.topik_writing_question_import as question_import
         where question_import.import_id = v_row.import_id
           and question_import.source_task_id = v_row.source_task_id
           and question_import.item_number = v_row.item_number;
        if not found or v_existing_payload_hash is distinct from v_row.payload_hash then
          raise exception 'canonical_question_payload_hash_mismatch';
        end if;

        perform private.ensure_writing_problem_identity(
          v_learner_problem_id,
          v_row.source_task_id,
          v_row.item_number
        );

        update public.topik_writing_question_source_map
           set hold_reason = null,
               updated_at = now()
         where question_id = v_row.source_task_id
           and item_number = v_row.item_number
           and canonical_import_id = v_row.import_id;

        update public.topik_writing_question_import
           set mapping_status = 'promoted',
               promoted_question_id = v_row.source_task_id,
               hold_reason = null
         where import_id = v_row.import_id;

        v_idempotent_skipped := v_idempotent_skipped + 1;
        continue;
      end if;

      v_learner_problem_id := coalesce(v_learner_problem_id, md5(v_row.source_task_id)::uuid);

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
      ) values (
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

      perform private.ensure_writing_problem_identity(
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
      ) values (
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
          'content_hash', v_row.content_hash,
          'version_decision', v_row.version_decision,
          'source_created_at', v_row.source_created_at,
          'source_updated_at', v_row.source_updated_at,
          'problem_id', v_learner_problem_id
        )
      );
    exception when others then
      v_held := v_held + 1;
      update public.topik_writing_question_import
         set mapping_status = 'held',
             hold_reason = left(coalesce(sqlerrm, ''), 300)
       where import_id = v_row.import_id
         and not exists (
           select 1
             from public.topik_writing_question_source_map as source_map
            where source_map.question_id = v_row.source_task_id
              and source_map.canonical_import_id = v_row.import_id
         );
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
    'idempotent_skipped', v_idempotent_skipped,
    'failures', v_failures
  );
end;
$$;

revoke all on function public.admin_promote_writing_questions(uuid, text[]) from public, anon, authenticated;
grant execute on function public.admin_promote_writing_questions(uuid, text[]) to service_role;

comment on function public.admin_promote_writing_questions(uuid, text[]) is
  'Service-role promotion. Processes only initial/content_changed decisions in source revision order and atomically switches canonical_import_id; metadata-only/anomalous observations remain inbox-only.';
