-- =====================================================================
-- TALKPIK AI - Dashboard KPI writing source alignment
--
-- Purpose:
--   Keep the learner dashboard/growth KPI contract unchanged while moving
--   submission counts to writing_submissions and streak calculation to the
--   study_events learning ledger. This aligns v13 with the topik-ai handoff
--   contract for writing-first learning analytics.
-- =====================================================================

create or replace function public.get_dashboard_kpi()
returns table (
  today_attempts int,
  total_attempts int,
  exam_days_left int,
  streak_days int
)
language plpgsql
security definer
set search_path = pg_catalog, public
stable
as $$
declare
  caller_id uuid := auth.uid();
  today_kst date := (now() at time zone 'Asia/Seoul')::date;
  today_start timestamptz := (today_kst::timestamp at time zone 'Asia/Seoul');
  today_end timestamptz := ((today_kst + interval '1 day')::timestamp at time zone 'Asia/Seoul');
  exam_d date;
  edl int;
  sd int;
begin
  if caller_id is null then
    raise exception 'unauthenticated';
  end if;

  select count(*)::int into today_attempts
    from public.writing_submissions
    where user_id = caller_id
      and submitted_at >= today_start
      and submitted_at < today_end;

  select count(*)::int into total_attempts
    from public.writing_submissions
    where user_id = caller_id;

  select exam_date into exam_d
    from public.learning_goals
    where user_id = caller_id
    limit 1;
  if exam_d is null then
    edl := null;
  else
    edl := (exam_d - today_kst);
    if edl < 0 then edl := null; end if;
  end if;
  exam_days_left := edl;

  with event_days as (
    select distinct (se.occurred_at at time zone 'Asia/Seoul')::date as d
    from public.study_events se
    where se.user_id = caller_id
  ),
  latest as (
    select max(d) as max_d
    from event_days
    where d <= today_kst
  ),
  ranked_days as (
    select ed.d,
           row_number() over (order by ed.d desc) as rn,
           latest.max_d
    from event_days ed
    cross join latest
    where ed.d <= today_kst
  )
  select case
    when (select max_d from latest) >= today_kst - 1
    then (
      select count(*)::int
      from ranked_days
      where d = max_d - (rn - 1)::int
    )
    else 0
  end into sd;
  streak_days := coalesce(sd, 0);

  return next;
end;
$$;

revoke all on function public.get_dashboard_kpi() from public;
grant execute on function public.get_dashboard_kpi() to authenticated;
comment on function public.get_dashboard_kpi() is
  'Dashboard KPI in 1 round-trip. Submission counts use writing_submissions; streak uses study_events KST days. No args -> caller is always auth.uid().';
