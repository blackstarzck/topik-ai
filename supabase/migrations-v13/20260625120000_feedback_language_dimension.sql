-- Allow the external writing feedback pipeline to persist the backend's
-- normalized language trait alongside the existing feedback dimensions.

alter table public.feedback_dimension_scores
  drop constraint if exists feedback_dimension_scores_dimension_check;

alter table public.feedback_dimension_scores
  add constraint feedback_dimension_scores_dimension_check
  check (dimension in ('grammar','vocab','structure','content','expression','topic_fit','language'));

create or replace function private.assert_submission_payload(
  submission jsonb,
  dimensions jsonb,
  sentences jsonb
)
returns void
language plpgsql
set search_path = pg_catalog, public
as $$
declare
  qn int;
  cc int;
  dim_row jsonb;
  dim_name text;
  wl_text text;
  wl_int int;
  sent_row jsonb;
  si_int int;
begin
  if submission is null or jsonb_typeof(submission) <> 'object' then
    raise exception 'invalid submission payload (not object)';
  end if;

  -- problem_id
  if not (submission ? 'problem_id')
     or jsonb_typeof(submission->'problem_id') <> 'string' then
    raise exception 'submission.problem_id required (string)';
  end if;
  begin
    perform (submission->>'problem_id')::uuid;
  exception when others then
    raise exception 'submission.problem_id must be a valid uuid';
  end;

  -- question_no in (51,52,53,54)
  if not (submission ? 'question_no') then
    raise exception 'submission.question_no required';
  end if;
  begin
    qn := (submission->>'question_no')::int;
  exception when others then
    raise exception 'submission.question_no must be integer';
  end;
  if qn not in (51,52,53,54) then
    raise exception 'submission.question_no must be one of (51,52,53,54)';
  end if;

  -- answer_text non-empty
  if not (submission ? 'answer_text')
     or jsonb_typeof(submission->'answer_text') <> 'string'
     or length(submission->>'answer_text') = 0 then
    raise exception 'submission.answer_text required (non-empty string)';
  end if;

  -- char_count integer >= 0
  if not (submission ? 'char_count') then
    raise exception 'submission.char_count required';
  end if;
  begin
    cc := (submission->>'char_count')::int;
  exception when others then
    raise exception 'submission.char_count must be integer';
  end;
  if cc < 0 then
    raise exception 'submission.char_count must be >= 0';
  end if;

  -- draft_id optional uuid
  if submission ? 'draft_id' and jsonb_typeof(submission->'draft_id') <> 'null' then
    if jsonb_typeof(submission->'draft_id') <> 'string' then
      raise exception 'submission.draft_id must be string uuid';
    end if;
    begin
      perform (submission->>'draft_id')::uuid;
    exception when others then
      raise exception 'submission.draft_id must be a valid uuid';
    end;
  end if;

  -- dimensions optional array
  if dimensions is not null and jsonb_typeof(dimensions) = 'array' then
    for dim_row in select * from jsonb_array_elements(dimensions) loop
      if jsonb_typeof(dim_row) <> 'object' then
        raise exception 'dimension entry must be object';
      end if;
      dim_name := dim_row->>'dimension';
      if dim_name is null
         or dim_name not in ('grammar','vocab','structure','content','expression','topic_fit','language') then
        raise exception 'invalid dimension name: %', dim_name;
      end if;
      if (dim_row ? 'score') and (dim_row->>'score') <> ''
         and (dim_row->>'score')::numeric < 0 then
        raise exception 'dimension.score must be >= 0';
      end if;
      if (dim_row ? 'score_max') and (dim_row->>'score_max') <> ''
         and (dim_row->>'score_max')::numeric < 0 then
        raise exception 'dimension.score_max must be >= 0';
      end if;
      if (dim_row ? 'weakness_level') and (dim_row->>'weakness_level') <> '' then
        wl_text := dim_row->>'weakness_level';
        begin
          wl_int := wl_text::int;
        exception when others then
          raise exception 'dimension.weakness_level must be integer';
        end;
        if wl_int < 1 or wl_int > 5 then
          raise exception 'dimension.weakness_level must be between 1 and 5';
        end if;
      end if;
    end loop;
  end if;

  -- sentences optional array
  if sentences is not null and jsonb_typeof(sentences) = 'array' then
    for sent_row in select * from jsonb_array_elements(sentences) loop
      if jsonb_typeof(sent_row) <> 'object' then
        raise exception 'sentence entry must be object';
      end if;
      if not (sent_row ? 'sentence_index') then
        raise exception 'sentence.sentence_index required';
      end if;
      begin
        si_int := (sent_row->>'sentence_index')::int;
      exception when others then
        raise exception 'sentence.sentence_index must be integer';
      end;
      if si_int < 0 then
        raise exception 'sentence.sentence_index must be >= 0';
      end if;
    end loop;
  end if;
end;
$$;
revoke all on function private.assert_submission_payload(jsonb, jsonb, jsonb) from public;
grant execute on function private.assert_submission_payload(jsonb, jsonb, jsonb) to authenticated;
comment on function private.assert_submission_payload(jsonb, jsonb, jsonb) is
  'Strict validator for submit_writing_with_feedback payload. DB-truth enums for dimension/weakness/question_no. Accepts language for external feedback sync.';
