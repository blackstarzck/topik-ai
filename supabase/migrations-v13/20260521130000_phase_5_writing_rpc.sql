-- =====================================================================
-- TALKPIK AI · Phase 5 · Writing RPC layer
-- SECURITY DEFINER functions for atomic submit+feedback and comparison
-- report creation. Trust model: caller identity = auth.uid(). All
-- ownership fields (user_id / submission_id) in payload are IGNORED and
-- overwritten by caller_id / inserted submission id.
-- =====================================================================

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

  -- writing_feedback.status: Phase 5 mock always inserts as 'complete';
  -- payload value is ignored so a typo never crashes the transaction.
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

revoke all on function public.submit_writing_with_feedback(jsonb, jsonb, jsonb, jsonb) from public;
grant execute on function public.submit_writing_with_feedback(jsonb, jsonb, jsonb, jsonb) to authenticated;

comment on function public.submit_writing_with_feedback(jsonb, jsonb, jsonb, jsonb) is
  'Phase 5 atomic submit: inserts writing_submissions, writing_feedback, dimension_scores, sentence_feedback, and supersedes draft. Trust source: auth.uid(). Payload ownership fields are ignored.';


create or replace function public.create_comparison_report_with_metrics(
  current_id uuid,
  previous_id uuid,
  metrics jsonb,
  narrative text,
  ai_model text
)
returns uuid
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  caller_id uuid := auth.uid();
  owner_current uuid;
  owner_previous uuid;
  new_report_id uuid;
begin
  if caller_id is null then
    raise exception 'unauthenticated';
  end if;

  select user_id into owner_current
    from public.writing_submissions
   where id = current_id;
  if owner_current is null then
    raise exception 'current submission not found';
  end if;
  if owner_current <> caller_id then
    raise exception 'forbidden: current submission not owned by caller';
  end if;

  if previous_id is not null then
    select user_id into owner_previous
      from public.writing_submissions
     where id = previous_id;
    if owner_previous is null then
      raise exception 'previous submission not found';
    end if;
    if owner_previous <> caller_id then
      raise exception 'forbidden: previous submission not owned by caller';
    end if;
  end if;

  insert into public.comparison_reports (
    user_id, current_submission_id, previous_submission_id,
    metrics, narrative, ai_model
  )
  values (
    caller_id, current_id, previous_id,
    coalesce(metrics, '{}'::jsonb),
    narrative,
    coalesce(ai_model, 'mock-v1')
  )
  returning id into new_report_id;

  return new_report_id;
end;
$$;

revoke all on function public.create_comparison_report_with_metrics(uuid, uuid, jsonb, text, text) from public;
grant execute on function public.create_comparison_report_with_metrics(uuid, uuid, jsonb, text, text) to authenticated;

comment on function public.create_comparison_report_with_metrics(uuid, uuid, jsonb, text, text) is
  'Phase 5 comparison report creation. Validates both submissions are owned by auth.uid() then inserts.';
