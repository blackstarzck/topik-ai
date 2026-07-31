-- =====================================================================
-- Writing submission dedup guard (draft-level)
-- =====================================================================
-- 목적: 다중 탭/창, 네트워크 재시도, 빠른 연타로 같은 답안이 두 번 제출되는 빈틈을
--       서버 측에서 닫는다.
-- 키 선택: (user_id, problem_id) 전역이 아니라 draft_id를 중복 식별 키로 쓴다.
--   - 재응시(다시 풀기, fresh=1)는 새 draft를 만들어 새 draft_id를 가지므로 막히지 않는다.
--   - 실패(failed) 제출은 partial predicate에서 제외돼, 실패 후 재시도가 허용된다.
-- 불변식: "한 draft당 활성(non-failed) 제출 1건". "한 draft당 영구 1건"이 아니다.
-- RLS: 변경하지 않는다. writing_submissions는 service_role RPC가 유일 writer다.

create unique index if not exists writing_submissions_draft_active_unique
  on public.writing_submissions (draft_id)
  where draft_id is not null and feedback_status <> 'failed';

comment on index public.writing_submissions_draft_active_unique is
  'Dedup guard: at most one non-failed submission per draft_id. Re-attempts use a new draft_id; failed rows are excluded so resubmission stays allowed. Invariant: one active (non-failed) submission per draft, not one permanent submission.';

-- 단일 writer RPC를 멱등화한다. 20260618143000_external_writing_submission_sync.sql의
-- 본문을 baseline으로 forward-only 재선언하며, 두 가지를 추가한다.
--   1) 로컬 변수 draft_id -> v_draft_id rename (기존 함수의 로컬 변수 draft_id가
--      writing_submissions.draft_id 컬럼명과 충돌해, dedup 조회의 WHERE가 전체 매칭이
--      되는 사고를 방지).
--   2) INSERT 전 활성 제출 선조회(멱등 반환) + unique_violation catch-and-reselect.
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

  -- 멱등 반환: 이 draft에 이미 활성(non-failed) 제출이 있으면 새 row 없이 그 id를 반환한다.
  -- (failed 생성 경로는 재시도를 위해 이 분기를 건너뛴다.)
  if v_draft_id is not null and next_status <> 'failed' then
    select id into existing_id
      from public.writing_submissions
     where draft_id = v_draft_id
       and feedback_status <> 'failed'
     limit 1;
    if existing_id is not null then
      return existing_id;
    end if;
  end if;

  -- INSERT. 동시 제출 레이스로 partial unique index가 두 번째 INSERT를 거부하면,
  -- 먼저 들어간 활성 제출 id를 반환해 동일 submission으로 수렴시킨다.
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
        return existing_id;
      end if;
    end if;
    raise;
  end;

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
  'Service-side writer. Idempotent per draft: returns the existing non-failed submission for a draft instead of inserting a duplicate (select-before-insert + unique_violation catch-and-reselect).';
