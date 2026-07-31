-- =====================================================================
-- Guard writing submissions against hidden or inactive problems.
--
-- Rationale:
-- The learner UI only lists public writing problems, but a client can still
-- call the submit RPC with a known problem_id. Because the submit RPC is the
-- sole writer for writing_submissions, it must verify the problem's current
-- exposure state before inserting any rows.
-- =====================================================================

create or replace function private.assert_writing_problem_submittable(
  p_problem_id uuid,
  p_question_no smallint
)
returns void
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
begin
  if not exists (
    select 1
      from public.problems p
     where p.id = p_problem_id
       and p.domain = 'writing'
       and p.question_no = p_question_no
       and p.publish_status = 'published'
       and p.visibility = 'public'
       and p.lifecycle_status = 'active'
  ) then
    raise exception 'problem_not_submittable'
      using errcode = 'P0001',
            detail = 'Writing submissions are allowed only for published, public, active writing problems.';
  end if;
end;
$$;

revoke all on function private.assert_writing_problem_submittable(uuid, smallint) from public;
grant execute on function private.assert_writing_problem_submittable(uuid, smallint) to authenticated;
comment on function private.assert_writing_problem_submittable(uuid, smallint) is
  'Rejects writing submissions for hidden, unpublished, inactive, non-writing, or question-number-mismatched problems.';

create or replace function public.submit_writing_with_feedback(
  submission jsonb,
  feedback jsonb,
  dimensions jsonb,
  sentences jsonb
)
returns uuid
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  caller_id uuid := auth.uid();
  new_submission_id uuid;
  dim_row jsonb;
  sent_row jsonb;
begin
  if caller_id is null then
    raise exception 'unauthenticated';
  end if;

  perform private.assert_submission_payload(submission, dimensions, sentences);
  perform private.assert_writing_problem_submittable(
    (submission->>'problem_id')::uuid,
    (submission->>'question_no')::smallint
  );

  insert into public.writing_submissions (
    user_id, problem_id, draft_id, question_no,
    answer_text, answer_json, char_count, feedback_status
  )
  values (
    caller_id,
    (submission->>'problem_id')::uuid,
    case when submission ? 'draft_id'
              and jsonb_typeof(submission->'draft_id') = 'string'
         then (submission->>'draft_id')::uuid
         else null end,
    (submission->>'question_no')::smallint,
    submission->>'answer_text',
    case when submission ? 'answer_json'
         then submission->'answer_json'
         else null end,
    (submission->>'char_count')::int,
    'complete'
  )
  returning id into new_submission_id;

  insert into public.writing_feedback (
    submission_id, user_id, status,
    score_total, score_max, overall_summary,
    ai_model, ai_model_version, raw_ai_result
  )
  values (
    new_submission_id,
    caller_id,
    'complete',
    nullif(feedback->>'score_total', '')::numeric,
    nullif(feedback->>'score_max', '')::numeric,
    feedback->>'overall_summary',
    coalesce(feedback->>'ai_model', 'mock-v1'),
    coalesce(feedback->>'ai_model_version', 'phase-5'),
    case when feedback ? 'raw_ai_result' then feedback->'raw_ai_result' else null end
  );

  if jsonb_typeof(dimensions) = 'array' then
    for dim_row in select * from jsonb_array_elements(dimensions)
    loop
      insert into public.feedback_dimension_scores (
        submission_id, user_id, dimension,
        score, score_max, summary, weakness_level
      )
      values (
        new_submission_id,
        caller_id,
        dim_row->>'dimension',
        nullif(dim_row->>'score', '')::numeric,
        nullif(dim_row->>'score_max', '')::numeric,
        dim_row->>'summary',
        nullif(dim_row->>'weakness_level', '')::smallint
      );
    end loop;
  end if;

  if jsonb_typeof(sentences) = 'array' then
    for sent_row in select * from jsonb_array_elements(sentences)
    loop
      insert into public.sentence_feedback (
        submission_id, user_id, sentence_index,
        original_text, corrected_text, comment
      )
      values (
        new_submission_id,
        caller_id,
        (sent_row->>'sentence_index')::int,
        sent_row->>'original_text',
        sent_row->>'corrected_text',
        sent_row->>'comment'
      );
    end loop;
  end if;

  update public.writing_drafts
    set autosave_status = 'superseded',
        updated_at = now()
  where user_id = caller_id
    and problem_id = (submission->>'problem_id')::uuid
    and autosave_status <> 'superseded';

  return new_submission_id;
end;
$$;

comment on function public.submit_writing_with_feedback(jsonb, jsonb, jsonb, jsonb) is
  'Atomic writing submit RPC. Validates payload and rejects hidden/unpublished/inactive/non-writing problems before inserting submission and feedback rows.';
