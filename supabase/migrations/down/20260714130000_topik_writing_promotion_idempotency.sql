-- Roll back only the promotion RPC definition to the exact pre-corrective
-- 20260713080015 contract. The canonical schema and serialization guard remain.

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
