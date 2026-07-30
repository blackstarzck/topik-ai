-- =====================================================================
-- TALKPIK AI · Admin integration Phase C (gate §2-2) · 2026-06-08
-- problems: topic_category_code (D-B) + review_workflow_status (D-C)
-- + extend admin_update_problem allowlist for both.
--
-- Backs the topik-ai admin "TOPIK 쓰기 문제은행" reconciliation:
--   D-B: topik-ai problem topic (생활/학습/사회/문화/경제/교육/환경/기술) is a
--        SUBJECT axis, semantically DIFFERENT from v13 problems.domain (reading/
--        listening/writing = the skill AREA). So it gets a NEW dedicated column,
--        NOT a reuse of `domain` (per GPT-5.5 cross-review D-B).
--   D-C: topik-ai reviewStatus is a flat 5-value workflow (검수 대기/검수 중/보류/
--        검수 완료/수정 필요). v13 keeps `review_status` as the FINAL curation
--        result (pending/approved/rejected) and adds `review_workflow_status` for
--        the in-progress workflow stage (per D-C). No 5->3 collapse / no info loss.
--
-- PROPOSED ONLY (R2): topik-ai internal CODE values are still Korean labels only
-- (no ratified ASCII codes). So both columns are added as NULLABLE text WITHOUT a
-- CHECK constraint — the owner ratifies the canonical code/enum spelling LATER,
-- at which point a CHECK can be added in a follow-up. Do NOT copy Korean display
-- labels verbatim into *_code. No writes are wired until codes are ratified.
--
-- additive + idempotent: add column if not exists; create-or-replace the RPC.
-- Adding a NULLABLE column is a metadata-only change (no table rewrite). RLS on
-- `problems` is unchanged. prod = do not apply (report-only); dev only.
-- =====================================================================


-- topic_category_code : SUBJECT/category code (D-B). Distinct from problems.domain
-- (skill area: reading/listening/writing). NULLABLE; no CHECK yet (codes unratified).
-- PROPOSED canonical set (owner to ratify): life/study/society/culture/economy/
-- education/environment/technology  <-  생활/학습/사회/문화/경제/교육/환경/기술.
alter table public.problems
  add column if not exists topic_category_code text;

comment on column public.problems.topic_category_code is
  'Admin Phase C (D-B): SUBJECT/category code for the writing question bank, '
  'DISTINCT from problems.domain (skill area). Nullable, no CHECK yet — topik-ai '
  'codes are Korean-label-only and the canonical ASCII set is owner-ratified LATER '
  '(PROPOSED: life/study/society/culture/economy/education/environment/technology). '
  'Do NOT store Korean labels verbatim. Reconciliation: topik-ai '
  'assessment_questions.domain (subject).';


-- review_workflow_status : in-progress review workflow stage (D-C), SEPARATE from
-- review_status (final result: pending/approved/rejected). NULLABLE; no CHECK yet.
-- PROPOSED enum (owner to ratify): not_started/in_progress/on_hold/done/
-- revision_requested  <-  검수 대기/검수 중/보류/검수 완료/수정 필요.
alter table public.problems
  add column if not exists review_workflow_status text;

comment on column public.problems.review_workflow_status is
  'Admin Phase C (D-C): in-progress review WORKFLOW stage, distinct from '
  'review_status (final curation result). Nullable, no CHECK yet — topik-ai 5-state '
  'workflow (검수 대기/검수 중/보류/검수 완료/수정 필요) maps here; canonical ASCII '
  'enum is owner-ratified LATER (PROPOSED: not_started/in_progress/on_hold/done/'
  'revision_requested). Reconciliation: topik-ai assessment_questions.reviewStatus.';


-- ---------------------------------------------------------------------
-- Extend admin_update_problem: allowlist + explicit branches for the two new
-- columns (audited diff, content_admin only). Recreated from 20260602120400 with
-- 'topic_category_code' and 'review_workflow_status' added; all prior behaviour
-- is preserved verbatim.
-- ---------------------------------------------------------------------
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
  for k in select jsonb_object_keys(patch) loop
    if not (k = any(allowed)) then
      continue;  -- silently ignore unknown / protected keys
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
    return;  -- nothing changed -> no audit row
  end if;

  insert into public.admin_audit_logs (
    admin_user_id, action, target_table, target_id, diff, payload
  ) values (
    caller_id,
    'problem.update',
    'problems',
    problem_id::text,
    v_diff,
    '{}'::jsonb
  );
end;
$$;
revoke all on function public.admin_update_problem(uuid, jsonb) from public;
grant execute on function public.admin_update_problem(uuid, jsonb) to authenticated;
comment on function public.admin_update_problem(uuid, jsonb) is
  'Content-admin only. Patches allowlisted problem columns from jsonb + writes '
  'admin_audit_logs with a diff. Unknown keys ignored. Phase C (2026-06-08) added '
  'topic_category_code + review_workflow_status to the allowlist.';
