-- Preserve the source submission for feedback retry submissions.
-- The column already exists; this migration updates the service-role RPC so
-- feedback rewrites can power comparison reports through parent_submission_id.

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
  v_parent_submission_id uuid;
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
  perform private.assert_writing_problem_submittable_for_user(
    (submission->>'problem_id')::uuid,
    (submission->>'question_no')::smallint,
    owner_id
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

  v_parent_submission_id :=
    case when submission ? 'parent_submission_id'
           and jsonb_typeof(submission->'parent_submission_id') = 'string'
         then (submission->>'parent_submission_id')::uuid
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

  if v_parent_submission_id is not null and not exists (
    select 1
      from public.writing_submissions
     where id = v_parent_submission_id
       and user_id = owner_id
       and problem_id = (submission->>'problem_id')::uuid
       and question_no = (submission->>'question_no')::smallint
  ) then
    raise exception 'parent_submission_not_owned';
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
      answer_text, answer_json, char_count, feedback_status, parent_submission_id
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
      next_status,
      v_parent_submission_id
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
  'Service-side writer. Idempotent per draft, preserves feedback retry parent submissions, auto-saves each submitted answer to My Library, and checks institution writing exposure for the owner user.';
