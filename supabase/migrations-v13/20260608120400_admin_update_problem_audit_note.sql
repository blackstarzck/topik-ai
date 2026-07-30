-- =====================================================================
-- TALKPIK AI · Admin integration Phase C follow-up (owner-approved item 4) · 2026-06-08
-- admin_update_problem: persist a free-text review NOTE into the audit trail.
--
-- WHY: topik-ai's review screen collects a "검수 메모 / 사유" (the justification for a
-- review decision). v13 has NO column for a reviewer note (problems.explanation is the
-- LEARNER-facing answer explanation — wrong sink). The note is per-ACTION reasoning, so
-- its faithful home is the AUDIT trail next to "who/when/what changed", not a problem
-- column. This stores it in admin_audit_logs.payload (currently always '{}').
--
-- DESIGN (no signature change → zero risk to existing callers):
--   The note is passed INSIDE the existing jsonb patch under the RESERVED control key
--   '__note' (double underscore — never a column; already ignored by the allowlist loop
--   because it is not in `allowed`). The function extracts it and writes
--   payload = {"review_note": <note>} on the same audit row as the column diff.
--   Existing 2-key calls {problem_id, patch} keep working unchanged; the PostgREST
--   signature admin_update_problem(uuid, jsonb) is identical to 20260608120300.
--
-- The note rides with an actual column change (the early-return on an empty diff is
-- preserved), which matches the intended use: the note accompanies a review-status
-- write. A note with no column change produces no audit row (and no note) — by design.
--
-- additive + idempotent: create-or-replace only. All prior behaviour (13-key allowlist
-- + typed branches + content_admin guard + diff) is preserved VERBATIM from
-- 20260608120300; the only additions are the v_note extraction and the payload build.
-- RLS on problems unchanged. prod = do not apply (report-only); dev only.
-- =====================================================================

create or replace function public.admin_update_problem(
  problem_id uuid,
  patch      jsonb
)
returns void
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  caller_id uuid := auth.uid();
  old_row   public.problems%rowtype;
  v_diff    jsonb := '{}'::jsonb;
  v_note    text  := nullif(patch->>'__note', '');
  v_payload jsonb := '{}'::jsonb;
  k         text;
  allowed   text[] := array[
    'title','prompt','materials','answer_key','rubric','tags',
    'explanation','difficulty','visibility','review_status','publish_status',
    'topic_category_code','review_workflow_status'
  ];
begin
  if caller_id is null then raise exception 'unauthenticated'; end if;
  if not private.is_content_admin(caller_id) then
    raise exception 'forbidden: content_admin required';
  end if;
  if problem_id is null then raise exception 'problem_id required'; end if;
  if patch is null or jsonb_typeof(patch) <> 'object' then
    raise exception 'patch must be a json object';
  end if;

  select * into old_row from public.problems where id = problem_id;
  if not found then raise exception 'problem not found'; end if;

  -- Apply each allowed key explicitly (typed casts; avoids dynamic SQL).
  -- '__note' is NOT in `allowed`, so it is skipped here and never touches a column.
  for k in select jsonb_object_keys(patch) loop
    if not (k = any(allowed)) then
      continue;  -- silently ignore unknown / protected / control keys
    end if;

    if k = 'title' then
      update public.problems set title = patch->>'title' where id = problem_id;
      v_diff := v_diff || jsonb_build_object('title',
                  jsonb_build_object('from', old_row.title, 'to', patch->>'title'));
    elsif k = 'prompt' then
      update public.problems set prompt = patch->>'prompt' where id = problem_id;
      v_diff := v_diff || jsonb_build_object('prompt',
                  jsonb_build_object('from', old_row.prompt, 'to', patch->>'prompt'));
    elsif k = 'materials' then
      update public.problems set materials = patch->'materials' where id = problem_id;
      v_diff := v_diff || jsonb_build_object('materials',
                  jsonb_build_object('from', old_row.materials, 'to', patch->'materials'));
    elsif k = 'answer_key' then
      update public.problems set answer_key = patch->'answer_key' where id = problem_id;
      v_diff := v_diff || jsonb_build_object('answer_key',
                  jsonb_build_object('from', old_row.answer_key, 'to', patch->'answer_key'));
    elsif k = 'rubric' then
      update public.problems set rubric = patch->'rubric' where id = problem_id;
      v_diff := v_diff || jsonb_build_object('rubric',
                  jsonb_build_object('from', old_row.rubric, 'to', patch->'rubric'));
    elsif k = 'tags' then
      update public.problems
        set tags = coalesce(
              (select array_agg(value::text)
                 from jsonb_array_elements_text(patch->'tags') as value),
              '{}')
        where id = problem_id;
      v_diff := v_diff || jsonb_build_object('tags',
                  jsonb_build_object('from', to_jsonb(old_row.tags), 'to', patch->'tags'));
    elsif k = 'explanation' then
      update public.problems set explanation = patch->>'explanation' where id = problem_id;
      v_diff := v_diff || jsonb_build_object('explanation',
                  jsonb_build_object('from', old_row.explanation, 'to', patch->>'explanation'));
    elsif k = 'difficulty' then
      update public.problems
        set difficulty = nullif(patch->>'difficulty','')::smallint where id = problem_id;
      v_diff := v_diff || jsonb_build_object('difficulty',
                  jsonb_build_object('from', old_row.difficulty, 'to', patch->>'difficulty'));
    elsif k = 'visibility' then
      update public.problems set visibility = patch->>'visibility' where id = problem_id;
      v_diff := v_diff || jsonb_build_object('visibility',
                  jsonb_build_object('from', old_row.visibility, 'to', patch->>'visibility'));
    elsif k = 'review_status' then
      update public.problems set review_status = patch->>'review_status' where id = problem_id;
      v_diff := v_diff || jsonb_build_object('review_status',
                  jsonb_build_object('from', old_row.review_status, 'to', patch->>'review_status'));
    elsif k = 'publish_status' then
      update public.problems set publish_status = patch->>'publish_status' where id = problem_id;
      v_diff := v_diff || jsonb_build_object('publish_status',
                  jsonb_build_object('from', old_row.publish_status, 'to', patch->>'publish_status'));
    elsif k = 'topic_category_code' then
      update public.problems set topic_category_code = patch->>'topic_category_code' where id = problem_id;
      v_diff := v_diff || jsonb_build_object('topic_category_code',
                  jsonb_build_object('from', old_row.topic_category_code, 'to', patch->>'topic_category_code'));
    elsif k = 'review_workflow_status' then
      update public.problems set review_workflow_status = patch->>'review_workflow_status' where id = problem_id;
      v_diff := v_diff || jsonb_build_object('review_workflow_status',
                  jsonb_build_object('from', old_row.review_workflow_status, 'to', patch->>'review_workflow_status'));
    end if;
  end loop;

  if v_diff = '{}'::jsonb then
    return;  -- nothing changed -> no audit row (and no note)
  end if;

  if v_note is not null then
    v_payload := jsonb_build_object('review_note', v_note);
  end if;

  insert into public.admin_audit_logs (
    admin_user_id, action, target_table, target_id, diff, payload
  ) values (
    caller_id,
    'problem.update',
    'problems',
    problem_id::text,
    v_diff,
    v_payload
  );
end;
$$;
revoke all on function public.admin_update_problem(uuid, jsonb) from public;
grant execute on function public.admin_update_problem(uuid, jsonb) to authenticated;
comment on function public.admin_update_problem(uuid, jsonb) is
  'Content-admin only. Patches allowlisted problem columns from jsonb + writes '
  'admin_audit_logs with a diff. Unknown keys ignored. Phase C (2026-06-08) added '
  'topic_category_code + review_workflow_status. Follow-up (2026-06-08, item 4): the '
  'reserved patch key ''__note'' (not a column) is stored in admin_audit_logs.payload '
  'as {"review_note": ...} on the same audit row as the diff.';
