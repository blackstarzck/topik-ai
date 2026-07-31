-- =====================================================================
-- External Writing API submission + feedback sync
-- =====================================================================

create or replace function public.create_external_writing_submission(
  submission jsonb
)
returns uuid
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  owner_id uuid;
  external_submission_id uuid;
  draft_id uuid;
  next_status text;
begin
  if not (submission ? 'user_id')
     or jsonb_typeof(submission->'user_id') <> 'string' then
    raise exception 'submission.user_id required (string uuid)';
  end if;

  begin
    owner_id := (submission->>'user_id')::uuid;
  exception when others then
    raise exception 'submission.user_id must be a valid uuid';
  end;

  perform private.assert_submission_payload(submission, '[]'::jsonb, '[]'::jsonb);
  perform private.assert_writing_problem_submittable(
    (submission->>'problem_id')::uuid,
    (submission->>'question_no')::smallint
  );

  if not (submission ? 'external_submission_id')
     or jsonb_typeof(submission->'external_submission_id') <> 'string' then
    raise exception 'submission.external_submission_id required (string uuid)';
  end if;

  begin
    external_submission_id := (submission->>'external_submission_id')::uuid;
  exception when others then
    raise exception 'submission.external_submission_id must be a valid uuid';
  end;

  next_status := coalesce(submission->>'feedback_status', 'analyzing');
  if next_status not in ('analyzing', 'failed') then
    raise exception 'submission.feedback_status must be analyzing or failed';
  end if;

  draft_id := case when submission ? 'draft_id'
                      and jsonb_typeof(submission->'draft_id') = 'string'
                  then (submission->>'draft_id')::uuid
                  else null end;

  if draft_id is not null and not exists (
    select 1
      from public.writing_drafts
     where id = draft_id
       and user_id = owner_id
       and problem_id = (submission->>'problem_id')::uuid
       and question_no = (submission->>'question_no')::smallint
  ) then
    raise exception 'draft_not_owned';
  end if;

  insert into public.writing_submissions (
    id, user_id, problem_id, draft_id, question_no,
    answer_text, answer_json, char_count, feedback_status
  )
  values (
    external_submission_id,
    owner_id,
    (submission->>'problem_id')::uuid,
    draft_id,
    (submission->>'question_no')::smallint,
    submission->>'answer_text',
    case when submission ? 'answer_json'
         then submission->'answer_json'
         else null end,
    (submission->>'char_count')::int,
    next_status
  );

  update public.writing_drafts
    set autosave_status = 'superseded',
        updated_at = now()
  where user_id = owner_id
    and problem_id = (submission->>'problem_id')::uuid
    and autosave_status <> 'superseded';

  return external_submission_id;
end;
$$;

revoke all on function public.create_external_writing_submission(jsonb) from public;
grant execute on function public.create_external_writing_submission(jsonb) to service_role;
comment on function public.create_external_writing_submission(jsonb) is
  'Service-side writer. Creates an analyzing/failed local writing_submissions row for an externally queued Writing API submission.';

create or replace function public.sync_external_writing_feedback(
  target_submission_id uuid,
  next_status text,
  feedback jsonb default null,
  dimensions jsonb default '[]'::jsonb,
  sentences jsonb default '[]'::jsonb
)
returns text
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  owner_id uuid;
  dim_row jsonb;
  sent_row jsonb;
begin
  if next_status not in ('pending', 'analyzing', 'complete', 'failed') then
    raise exception 'invalid feedback_status: %', next_status;
  end if;

  select user_id into owner_id
    from public.writing_submissions
   where id = target_submission_id;

  if owner_id is null then
    raise exception 'submission_not_found';
  end if;

  if next_status <> 'complete' then
    perform private.set_submission_feedback_status(target_submission_id, next_status);
    return next_status;
  end if;

  if feedback is null or jsonb_typeof(feedback) <> 'object' then
    raise exception 'feedback payload required for complete status';
  end if;

  insert into public.writing_feedback (
    submission_id, user_id, status,
    score_total, score_max, overall_summary,
    ai_model, ai_model_version, raw_ai_result
  )
  values (
    target_submission_id,
    owner_id,
    coalesce(feedback->>'status', 'complete'),
    nullif(feedback->>'score_total', '')::numeric,
    nullif(feedback->>'score_max', '')::numeric,
    feedback->>'overall_summary',
    coalesce(feedback->>'ai_model', 'talkpik-writing-api'),
    coalesce(feedback->>'ai_model_version', 'openapi'),
    case when feedback ? 'raw_ai_result' then feedback->'raw_ai_result' else null end
  )
  on conflict (submission_id) do update
    set status = excluded.status,
        score_total = excluded.score_total,
        score_max = excluded.score_max,
        overall_summary = excluded.overall_summary,
        ai_model = excluded.ai_model,
        ai_model_version = excluded.ai_model_version,
        raw_ai_result = excluded.raw_ai_result,
        generated_at = now();

  delete from public.feedback_dimension_scores
   where submission_id = target_submission_id
     and user_id = owner_id;

  if jsonb_typeof(dimensions) = 'array' then
    for dim_row in select * from jsonb_array_elements(dimensions)
    loop
      insert into public.feedback_dimension_scores (
        submission_id, user_id, dimension,
        score, score_max, summary, weakness_level
      )
      values (
        target_submission_id,
        owner_id,
        dim_row->>'dimension',
        nullif(dim_row->>'score', '')::numeric,
        nullif(dim_row->>'score_max', '')::numeric,
        dim_row->>'summary',
        nullif(dim_row->>'weakness_level', '')::smallint
      );
    end loop;
  end if;

  delete from public.sentence_feedback
   where submission_id = target_submission_id
     and user_id = owner_id;

  if jsonb_typeof(sentences) = 'array' then
    for sent_row in select * from jsonb_array_elements(sentences)
    loop
      insert into public.sentence_feedback (
        submission_id, user_id, sentence_index,
        original_text, corrected_text, comment
      )
      values (
        target_submission_id,
        owner_id,
        (sent_row->>'sentence_index')::int,
        sent_row->>'original_text',
        sent_row->>'corrected_text',
        sent_row->>'comment'
      );
    end loop;
  end if;

  perform private.set_submission_feedback_status(target_submission_id, 'complete');

  return 'complete';
end;
$$;

revoke all on function public.sync_external_writing_feedback(uuid, text, jsonb, jsonb, jsonb) from public;
grant execute on function public.sync_external_writing_feedback(uuid, text, jsonb, jsonb, jsonb) to service_role;
comment on function public.sync_external_writing_feedback(uuid, text, jsonb, jsonb, jsonb) is
  'Service-side writer. Synchronizes externally graded Writing API feedback into owner-readable local feedback tables.';
