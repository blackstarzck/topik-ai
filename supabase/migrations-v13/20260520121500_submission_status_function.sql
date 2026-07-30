-- =====================================================================
-- TALKPIK AI · Tier 1 MVP · hardening round-2
-- 16/16 · writing_submissions.feedback_status transition function
-- Spec: docs/development/database-schema.md §1.5 (immutable submission)
--
-- writing_submissions has no UPDATE policy → owner-side UPDATEs are blocked.
-- AI feedback pipeline (server) needs to flip feedback_status between
-- 'pending' → 'analyzing' → 'complete' / 'failed'. This function is the
-- ONLY supported transition path; granted to service_role only.
-- =====================================================================

create or replace function private.set_submission_feedback_status(
  p_submission_id uuid,
  p_new_status    text
)
returns void
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
declare
  v_current text;
begin
  if p_new_status not in ('pending','analyzing','complete','failed') then
    raise exception 'invalid feedback_status: %', p_new_status
      using errcode = '22023';
  end if;

  select feedback_status into v_current
    from public.writing_submissions
   where id = p_submission_id
   for update;

  if v_current is null then
    raise exception 'writing_submission % not found', p_submission_id
      using errcode = '02000';
  end if;

  -- Allowed transitions:
  --   pending    -> analyzing | failed
  --   analyzing  -> complete  | failed
  --   complete   -> (terminal)
  --   failed     -> analyzing (retry)
  if not (
       (v_current = 'pending'   and p_new_status in ('analyzing','failed'))
    or (v_current = 'analyzing' and p_new_status in ('complete','failed'))
    or (v_current = 'failed'    and p_new_status =  'analyzing')
  ) then
    raise exception 'illegal feedback_status transition: % -> %', v_current, p_new_status
      using errcode = '22023';
  end if;

  update public.writing_submissions
     set feedback_status = p_new_status
   where id = p_submission_id;
end;
$$;

revoke all on function private.set_submission_feedback_status(uuid, text) from public;
grant execute on function private.set_submission_feedback_status(uuid, text) to service_role;

comment on function private.set_submission_feedback_status(uuid, text) is
  'Service-side state machine for writing_submissions.feedback_status. service_role only.';
