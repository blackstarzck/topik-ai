-- Down for 20260824120000: restore the strict-only ingest ladder and re-hold the
-- timestampless receipts that the content-only rule made promote-eligible but
-- that have not been promoted yet. Receipts already promoted stay promoted —
-- promotion is an operator action outside this migration pair, and the canonical
-- pointer is never rewound by a schema rollback.

-- 1) Data inverse. Targets only receipts whose raw payload carries no updated_at
--    (strict-mode rows always carry one, legacy rows keep version_decision='legacy').
update public.topik_writing_question_import
   set version_decision = 'invalid_timestamp',
       mapping_status = 'held',
       hold_reason = 'invalid_timestamp: created_at/updated_at must be valid and updated_at must not precede created_at',
       source_updated_at = null
 where nullif(btrim(raw_payload->>'updated_at'), '') is null
   and (
     (mapping_status = 'raw' and version_decision in ('content_changed', 'initial'))
     or (mapping_status = 'held' and version_decision = 'metadata_only')
   );

-- 2) Restore the 20260716052957 definition of admin_ingest_writing_task.
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
