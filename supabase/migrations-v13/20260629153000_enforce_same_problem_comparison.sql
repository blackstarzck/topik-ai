-- =====================================================================
-- Enforce same-problem comparison reports
-- =====================================================================
-- Comparison reports compare repeated submissions for the same writing
-- problem. A report may have no previous submission, but when it has one,
-- both submissions must belong to the same user and share problem_id.

create or replace function private.enforce_comparison_report_same_problem()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  current_owner uuid;
  current_problem uuid;
  previous_owner uuid;
  previous_problem uuid;
begin
  select user_id, problem_id into current_owner, current_problem
    from public.writing_submissions
   where id = new.current_submission_id;

  if current_owner is null then
    raise exception 'current submission not found';
  end if;

  if new.user_id <> current_owner then
    raise exception 'comparison report user must match current submission owner';
  end if;

  if new.previous_submission_id is not null then
    if new.previous_submission_id = new.current_submission_id then
      raise exception 'comparison previous submission must differ from current submission';
    end if;

    select user_id, problem_id into previous_owner, previous_problem
      from public.writing_submissions
     where id = new.previous_submission_id;

    if previous_owner is null then
      raise exception 'previous submission not found';
    end if;

    if previous_owner <> new.user_id then
      raise exception 'comparison report user must match previous submission owner';
    end if;

    if previous_problem <> current_problem then
      raise exception 'comparison submissions must share problem_id';
    end if;
  end if;

  return new;
end;
$$;

revoke all on function private.enforce_comparison_report_same_problem() from public;

drop trigger if exists comparison_reports_same_problem_guard
  on public.comparison_reports;
create trigger comparison_reports_same_problem_guard
  before insert or update of user_id, current_submission_id, previous_submission_id
  on public.comparison_reports
  for each row
  execute function private.enforce_comparison_report_same_problem();

comment on function private.enforce_comparison_report_same_problem() is
  'Rejects comparison_reports where current/previous submissions are different problems or different owners.';

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
  current_owner uuid;
  current_problem uuid;
  previous_owner uuid;
  previous_problem uuid;
  new_report_id uuid;
begin
  if caller_id is null then
    raise exception 'unauthenticated';
  end if;

  select user_id, problem_id into current_owner, current_problem
    from public.writing_submissions
   where id = current_id;
  if current_owner is null then
    raise exception 'current submission not found';
  end if;
  if current_owner <> caller_id then
    raise exception 'forbidden: current submission not owned by caller';
  end if;

  if previous_id is not null then
    if previous_id = current_id then
      raise exception 'comparison previous submission must differ from current submission';
    end if;

    select user_id, problem_id into previous_owner, previous_problem
      from public.writing_submissions
     where id = previous_id;
    if previous_owner is null then
      raise exception 'previous submission not found';
    end if;
    if previous_owner <> caller_id then
      raise exception 'forbidden: previous submission not owned by caller';
    end if;
    if previous_problem <> current_problem then
      raise exception 'comparison submissions must share problem_id';
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
  'Creates R-01 comparison reports only for caller-owned submissions on the same problem_id.';
