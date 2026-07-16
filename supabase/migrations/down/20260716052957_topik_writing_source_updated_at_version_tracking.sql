-- Roll back source timestamp/content revision classification.
--
-- Rows received while the forward migration was active remain preserved. Before
-- restoring the legacy RPCs, is_latest is reset to the newest legacy-promotable
-- response so metadata-only/anomalous observations cannot be promoted by the
-- older is_latest-based function.
-- Tracker: topik_writing_schema_migrations (supabase/migrations).

update public.topik_writing_question_import
   set is_latest = false
 where is_latest;

with ranked as (
  select
    import_id,
    row_number() over (
      partition by source_task_id
      order by source_updated_at desc nulls last, import_id desc
    ) as revision_rank
  from public.topik_writing_question_import
  where version_decision in ('legacy', 'initial', 'content_changed')
)
update public.topik_writing_question_import as question_import
   set is_latest = true
  from ranked
 where ranked.import_id = question_import.import_id
   and ranked.revision_rank = 1;

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
set search_path = pg_catalog, public
as $$
declare
  v_sid text := nullif(btrim(p_source_task_id), '');
  v_text text;
  v_hash text;
  v_import_id bigint;
  v_existing_id bigint;
  v_superseded integer := 0;
  v_event text;
begin
  if p_actor_id is null then raise exception 'actor required'; end if;
  if not private.is_content_admin(p_actor_id) then
    raise exception 'forbidden: content_admin required';
  end if;
  if v_sid is null then raise exception 'source_task_id required'; end if;
  if p_raw_payload is null or jsonb_typeof(p_raw_payload) <> 'object' then
    raise exception 'raw_payload must be a json object';
  end if;
  if p_item_number is not null and p_item_number not in (51, 52, 53, 54) then
    raise exception 'item_number must be null or one of 51/52/53/54';
  end if;

  v_text := coalesce(p_raw_response_text, p_raw_payload::text);
  v_hash := md5(v_text);

  select import_id into v_existing_id
    from public.topik_writing_question_import
   where source_task_id = v_sid and payload_hash = v_hash;

  if v_existing_id is not null then
    update public.topik_writing_question_import
       set last_seen_at = now(),
           ingest_count = ingest_count + 1,
           item_number = coalesce(p_item_number, item_number),
           source_endpoint = coalesce(p_source_endpoint, source_endpoint)
     where import_id = v_existing_id;
    return jsonb_build_object(
      'status', 'unchanged', 'import_id', v_existing_id,
      'source_task_id', v_sid, 'payload_hash', v_hash, 'item_number', p_item_number
    );
  end if;

  update public.topik_writing_question_import
     set is_latest = false
   where source_task_id = v_sid
     and is_latest;
  get diagnostics v_superseded = row_count;

  insert into public.topik_writing_question_import
    (source_task_id, payload_hash, raw_payload, raw_response_text,
     item_number, source_endpoint, is_latest, mapping_status)
  values
    (v_sid, v_hash, p_raw_payload, p_raw_response_text,
     p_item_number, p_source_endpoint, true, 'raw')
  returning import_id into v_import_id;

  v_event := case when v_superseded > 0 then 'new_version' else 'inserted' end;

  insert into public.admin_audit_logs
    (admin_user_id, action, target_table, target_id, diff, payload)
  values (
    p_actor_id, 'question_received', 'AssessmentQuestionImport', v_sid,
    '{}'::jsonb,
    jsonb_build_object(
      'event', v_event,
      'import_id', v_import_id,
      'payload_hash', v_hash,
      'item_number', p_item_number,
      'source_endpoint', p_source_endpoint
    )
  );

  return jsonb_build_object(
    'status', v_event, 'import_id', v_import_id,
    'source_task_id', v_sid, 'payload_hash', v_hash, 'item_number', p_item_number
  );
end;
$$;

revoke all on function public.admin_ingest_writing_task(uuid, text, jsonb, text, smallint, text) from public, anon, authenticated;
grant execute on function public.admin_ingest_writing_task(uuid, text, jsonb, text, smallint, text) to service_role;

comment on function public.admin_ingest_writing_task(uuid, text, jsonb, text, smallint, text) is
  'service_role 전용(actor 명시 전달). 외부 응답 1건을 topik_writing_question_import에 무손실·버전보존 적재 — (source_task_id, payload_hash) 원자적 upsert, 변경 재전송은 새 버전(이전 버전 보존), 동일 재전송은 unchanged, admin_audit_logs question_received(target_table=AssessmentQuestionImport) 기록.';

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
  v_unchanged integer := 0;
  v_failed integer := 0;
  v_failures jsonb := '[]'::jsonb;
begin
  if p_actor_id is null then raise exception 'actor required'; end if;
  if not private.is_content_admin(p_actor_id) then
    raise exception 'forbidden: content_admin required';
  end if;
  if p_tasks is null or jsonb_typeof(p_tasks) <> 'array' then
    raise exception 'tasks must be a json array';
  end if;

  for v_item in select * from jsonb_array_elements(p_tasks) loop
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
  'service_role 전용. 외부 응답 배열을 한 번의 호출로 무손실 적재 — 항목별로 admin_ingest_writing_task 재사용(멱등·버전·감사), 항목 실패는 격리. inserted/new_version/unchanged/failed 집계 반환.';

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
  if p_actor_id is null then raise exception 'actor required'; end if;
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
      imp.item_number,
      imp.promoted_question_id,
      imp.raw_payload
    from public.topik_writing_question_import as imp
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
      ) into v_existing_status, v_existing_created
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
      ) using v_payload;

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
        admin_user_id, action, target_table, target_id, diff, payload
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
  'Service-role promotion. Learner identities are registered through the v13-owned private registry; same-import identity/item/hash matches recover bookkeeping idempotently, while a later import may replace current canonical content and existing learner history remains pinned to immutable row snapshots.';

drop index if exists public.topik_writing_question_import_source_updated_idx;

alter table public.topik_writing_question_import
  drop constraint if exists topik_writing_question_import_version_decision_check,
  drop column if exists version_decision,
  drop column if exists content_hash,
  drop column if exists source_updated_at,
  drop column if exists source_created_at;

drop function if exists private.writing_question_content_hash(jsonb, smallint);
drop function if exists private.writing_question_content_projection(jsonb, smallint);
drop function if exists private.try_parse_writing_source_time(text);

comment on column public.topik_writing_question_import.is_latest is null;
