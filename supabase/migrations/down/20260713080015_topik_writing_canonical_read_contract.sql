-- Interface-only rollback. Source-map version links, generated learner identity,
-- and question_id immutability are retained because learner foreign keys may
-- already depend on them. legacy_problem_id remains provenance only.

drop function if exists public.get_available_writing_questions(smallint, uuid);
drop function if exists public.get_writing_question_grading_payload(text, bigint);
drop function if exists private.assert_writing_question_submittable(uuid, text, bigint, text, smallint, uuid);
drop function if exists private.is_writing_question_visible_to_user(text, smallint, uuid);
drop function if exists private.assert_writing_canonical_content_parity();
drop view if exists private.topik_writing_question_learner_projection;
drop function if exists private.build_writing_learner_chart(jsonb);

-- Restore the promotion contract that existed immediately before this migration.
-- Version links already written by the newer function are intentionally retained.
create or replace function public.admin_promote_writing_questions(
  p_actor_id     uuid,
  p_question_ids text[] default null
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_row              record;
  v_table            text;
  v_payload          jsonb;
  v_existing_status  text;
  v_existing_created timestamptz;
  v_new              integer := 0;
  v_updated          integer := 0;
  v_held             integer := 0;
  v_skipped_review   integer := 0;
  v_failures         jsonb := '[]'::jsonb;
begin
  if p_actor_id is null then
    raise exception 'actor required';
  end if;
  if not private.is_content_admin(p_actor_id) then
    raise exception 'forbidden: content_admin required';
  end if;

  for v_row in
    select import_id, source_task_id, item_number, raw_payload
      from public.topik_writing_question_import
     where is_latest
       and mapping_status in ('raw', 'held')
       and (p_question_ids is null or source_task_id = any(p_question_ids))
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
      v_table := format('topik_writing_%s_questions', v_row.item_number);

      v_existing_status := null;
      v_existing_created := null;
      execute format(
        'select service_status, created_at from public.%I where question_id = $1',
        v_table
      )
        into v_existing_status, v_existing_created
        using v_row.source_task_id;

      v_payload := v_row.raw_payload
        || jsonb_build_object(
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
          'event', case
            when v_existing_status is null then 'promoted_new'
            else 'promoted_updated'
          end,
          'item_number', v_row.item_number
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
  'Rollback contract. Promotes the latest reviewed import into the typed official table without canonical source-version anchoring.';

comment on function public.get_available_writing_problem_payloads(smallint, text) is
  'Service-role-only legacy mirror payload. Contains answer-bearing raw import data.';
