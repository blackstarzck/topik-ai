-- =====================================================================
-- Auto-save external writing submissions into My Library
-- =====================================================================
-- Backend-triggered analysis can finish after the learner leaves the loading
-- screen. A submitted answer must still be discoverable from F-01 "My Library".

create or replace function private.ensure_submission_library_item(
  p_user_id uuid,
  p_submission_id uuid
)
returns void
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
begin
  if p_user_id is null or p_submission_id is null then
    raise exception 'ensure_submission_library_item requires user and submission';
  end if;

  insert into public.library_items (
    user_id,
    item_type,
    submission_id
  )
  values (p_user_id, 'submission', p_submission_id)
  on conflict (user_id, submission_id) where submission_id is not null do nothing;
end;
$$;

revoke all on function private.ensure_submission_library_item(uuid, uuid) from public;
grant execute on function private.ensure_submission_library_item(uuid, uuid) to service_role;
comment on function private.ensure_submission_library_item(uuid, uuid) is
  'Idempotently creates the F-01 library ledger item for a writing submission.';

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
  v_draft_id uuid;
  next_status text;
  existing_id uuid;
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

  v_draft_id := case when submission ? 'draft_id'
                      and jsonb_typeof(submission->'draft_id') = 'string'
                  then (submission->>'draft_id')::uuid
                  else null end;

  if v_draft_id is not null and not exists (
    select 1
      from public.writing_drafts
     where id = v_draft_id
       and user_id = owner_id
       and problem_id = (submission->>'problem_id')::uuid
       and question_no = (submission->>'question_no')::smallint
  ) then
    raise exception 'draft_not_owned';
  end if;

  if v_draft_id is not null and next_status <> 'failed' then
    select id into existing_id
      from public.writing_submissions
     where draft_id = v_draft_id
       and feedback_status <> 'failed'
     limit 1;
    if existing_id is not null then
      perform private.ensure_submission_library_item(owner_id, existing_id);
      return existing_id;
    end if;
  end if;

  begin
    insert into public.writing_submissions (
      id, user_id, problem_id, draft_id, question_no,
      answer_text, answer_json, char_count, feedback_status
    )
    values (
      external_submission_id,
      owner_id,
      (submission->>'problem_id')::uuid,
      v_draft_id,
      (submission->>'question_no')::smallint,
      submission->>'answer_text',
      case when submission ? 'answer_json'
           then submission->'answer_json'
           else null end,
      (submission->>'char_count')::int,
      next_status
    );
  exception when unique_violation then
    if v_draft_id is not null then
      select id into existing_id
        from public.writing_submissions
       where draft_id = v_draft_id
         and feedback_status <> 'failed'
       limit 1;
      if existing_id is not null then
        perform private.ensure_submission_library_item(owner_id, existing_id);
        return existing_id;
      end if;
    end if;
    raise;
  end;

  perform private.ensure_submission_library_item(owner_id, external_submission_id);

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
  'Service-side writer. Idempotent per draft and auto-saves each submitted answer to My Library.';
