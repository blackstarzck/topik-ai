-- Bridge Admin-owned canonical writing metadata to the v13-owned identity registry.
--
-- Cross-domain ownership is intentionally enforced through the v13 service-role
-- function rather than a foreign key or direct DML against private tables.
-- Existing applied migrations remain immutable.
-- Tracker: topik_writing_schema_migrations (supabase/migrations).

do $$
declare
  v_identity record;
begin
  if to_regprocedure('private.ensure_writing_problem_identity(uuid,text,smallint)') is null then
    raise exception 'missing v13 dependency: writing problem identity registry function';
  end if;

  -- Reconcile every currently pinned canonical identity before accepting new
  -- promotions. The v13 function owns validation, conflict handling, and DML.
  for v_identity in
    select
      sm.learner_problem_id,
      sm.question_id,
      sm.item_number
    from public.topik_writing_question_source_map sm
    join public.topik_writing_question_import imp
      on imp.import_id = sm.canonical_import_id
     and imp.source_task_id = sm.question_id
     and imp.promoted_question_id = sm.question_id
     and imp.item_number = sm.item_number
     and imp.mapping_status = 'promoted'
    where sm.learner_problem_id is not null
      and sm.canonical_import_id is not null
    order by sm.question_id
  loop
    perform private.ensure_writing_problem_identity(
      v_identity.learner_problem_id,
      v_identity.question_id,
      v_identity.item_number
    );
  end loop;
end;
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

      -- A pinned import already represented by the canonical typed row is an
      -- idempotent retry. Repair only its bookkeeping; never delete/reinsert
      -- the learner-visible content.
      if v_existing_import_id = v_row.import_id then
        if v_existing_status is null then
          raise exception 'canonical_question_missing_for_pinned_import'
            using errcode = 'P0001',
                  detail = 'The source map pins this import but its canonical typed row is missing.';
        end if;
        if v_learner_problem_id is distinct from md5(v_row.source_task_id)::uuid then
          raise exception 'canonical_question_identity_mismatch'
            using errcode = 'P0001',
                  detail = 'The pinned source map learner identity does not match the canonical question identity.';
        end if;

        v_existing_payload_hash := null;
        select imp.payload_hash
          into v_existing_payload_hash
          from public.topik_writing_question_import imp
         where imp.import_id = v_row.import_id
           and imp.source_task_id = v_row.source_task_id
           and imp.item_number = v_row.item_number;
        if not found or v_existing_payload_hash is distinct from v_row.payload_hash then
          raise exception 'canonical_question_payload_hash_mismatch'
            using errcode = 'P0001',
                  detail = 'The pinned import identity, item number, and payload hash must match before idempotent recovery.';
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
      -- Never overwrite the state of an import already pinned by the
      -- canonical source map. The failure is still returned fail-closed.
      update public.topik_writing_question_import
         set mapping_status = 'held',
             hold_reason = left(coalesce(sqlerrm, ''), 300)
       where import_id = v_row.import_id
         and not exists (
           select 1
             from public.topik_writing_question_source_map sm
            where sm.question_id = v_row.source_task_id
              and sm.canonical_import_id = v_row.import_id
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

revoke all on function public.admin_promote_writing_questions(uuid, text[]) from public;
revoke all on function public.admin_promote_writing_questions(uuid, text[]) from anon;
revoke all on function public.admin_promote_writing_questions(uuid, text[]) from authenticated;
grant execute on function public.admin_promote_writing_questions(uuid, text[]) to service_role;

comment on function public.admin_promote_writing_questions(uuid, text[]) is
  'Service-role promotion. Learner identities are registered through the v13-owned private registry; same-import identity/item/hash matches recover bookkeeping idempotently, while a later import may replace current canonical content and existing learner history remains pinned to immutable row snapshots.';
