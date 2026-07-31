-- =====================================================================
-- list_user_problems: writing-aware solve state + lifecycle fields.
--
-- Keeps SECURITY INVOKER so problems/writing_drafts/writing_submissions RLS
-- remains the authorization boundary. The function signature is unchanged;
-- returned columns are additive for C-02 user-facing problem rows.
-- =====================================================================

drop function if exists public.list_user_problems(jsonb, text, int, int);

create or replace function public.list_user_problems(
  filter    jsonb default '{}'::jsonb,
  sort      text  default 'recent',
  page      int   default 1,
  page_size int   default 20
)
returns table (
  problem_id     uuid,
  title          text,
  domain         text,
  topik_level    smallint,
  question_no    smallint,
  difficulty     smallint,
  tags           text[],
  attempt_count  int,
  is_solved      boolean,
  last_attempt_at timestamptz,
  created_at     timestamptz,
  total_count    bigint,
  solve_state    text,
  has_draft      boolean,
  draft_status   text,
  writing_submission_count int,
  latest_submission_id uuid,
  latest_submission_at timestamptz,
  writing_feedback_status text,
  lifecycle_status text,
  lifecycle_reason text,
  publish_status text,
  review_status text
)
language plpgsql
set search_path = pg_catalog, public
stable
as $$
declare
  caller_id   uuid := auth.uid();
  v_page      int  := greatest(coalesce(page, 1), 1);
  v_size      int  := least(greatest(coalesce(page_size, 20), 1), 100);
  v_offset    int;
  f           jsonb := coalesce(filter, '{}'::jsonb);
  f_domain    text  := nullif(f->>'domain','');
  f_level     int   := nullif(f->>'topik_level','')::int;
  f_qno       int   := nullif(f->>'question_no','')::int;
  f_diff      int   := nullif(f->>'difficulty','')::int;
  f_status    text  := nullif(f->>'status','');
  f_search    text  := nullif(btrim(coalesce(f->>'search','')), '');
begin
  if caller_id is null then raise exception 'unauthenticated'; end if;
  v_offset := (v_page - 1) * v_size;

  return query
  with visible as (
    select p.*
    from public.problems p
    where p.publish_status = 'published'
      and (f_domain is null or p.domain = f_domain)
      and (f_level  is null or p.topik_level = f_level)
      and (f_qno    is null or p.question_no = f_qno)
      and (f_diff   is null or p.difficulty = f_diff)
      and (f_search is null or p.title ilike '%' || f_search || '%')
  ),
  with_activity as (
    select
      v.*,
      coalesce(pa.objective_attempt_count, 0) as objective_attempt_count,
      coalesce(pa.objective_is_solved, false) as objective_is_solved,
      pa.objective_last_attempt_at,
      coalesce(wd.has_draft, false) as has_draft,
      wd.draft_status,
      wd.latest_draft_at,
      coalesce(ws.writing_submission_count, 0) as writing_submission_count,
      ws.latest_submission_id,
      ws.latest_submission_at,
      ws.writing_feedback_status
    from visible v
    left join lateral (
      select
        count(*)::int as objective_attempt_count,
        coalesce(bool_or(a.is_correct), false) as objective_is_solved,
        max(a.started_at) as objective_last_attempt_at
      from public.problem_attempts a
      where a.problem_id = v.id and a.user_id = caller_id
    ) pa on true
    left join lateral (
      select
        (count(*) > 0) as has_draft,
        (array_agg(d.autosave_status order by d.last_saved_at desc nulls last))[1] as draft_status,
        max(d.last_saved_at) as latest_draft_at
      from public.writing_drafts d
      where d.problem_id = v.id
        and d.user_id = caller_id
        and d.autosave_status <> 'superseded'
    ) wd on true
    left join lateral (
      select
        count(*)::int as writing_submission_count,
        (array_agg(s.id order by s.submitted_at desc))[1] as latest_submission_id,
        max(s.submitted_at) as latest_submission_at,
        (array_agg(s.feedback_status order by s.submitted_at desc))[1] as writing_feedback_status
      from public.writing_submissions s
      where s.problem_id = v.id and s.user_id = caller_id
    ) ws on true
  ),
  with_status as (
    select
      wa.*,
      case
        when wa.domain = 'writing' and wa.writing_submission_count > 0 then 'submitted'
        when wa.domain = 'writing' and wa.has_draft then 'attempted'
        when wa.domain <> 'writing' and wa.objective_is_solved then 'submitted'
        when wa.domain <> 'writing' and wa.objective_attempt_count > 0 then 'attempted'
        else 'none'
      end as solve_state,
      case
        when wa.domain = 'writing' then
          wa.writing_submission_count + case when wa.has_draft and wa.writing_submission_count = 0 then 1 else 0 end
        else wa.objective_attempt_count
      end as effective_attempt_count,
      case
        when wa.domain = 'writing' then wa.writing_submission_count > 0
        else wa.objective_is_solved
      end as effective_is_solved,
      case
        when wa.domain = 'writing' then
          case
            when wa.latest_submission_at is not null and wa.latest_draft_at is not null
              then greatest(wa.latest_submission_at, wa.latest_draft_at)
            else coalesce(wa.latest_submission_at, wa.latest_draft_at)
          end
        else wa.objective_last_attempt_at
      end as effective_last_attempt_at
    from with_activity wa
  ),
  filtered as (
    select * from with_status ws
    where f_status is null
       or (f_status = 'solved'      and ws.solve_state = 'submitted')
       or (f_status = 'attempted'   and ws.solve_state = 'attempted')
       or (f_status = 'unattempted' and ws.solve_state = 'none')
  ),
  counted as (
    select filtered.*, count(*) over () as total_count
    from filtered
  )
  select
    counted.id,
    counted.title,
    counted.domain,
    counted.topik_level,
    counted.question_no,
    counted.difficulty,
    counted.tags,
    counted.effective_attempt_count,
    counted.effective_is_solved,
    counted.effective_last_attempt_at,
    counted.created_at,
    counted.total_count,
    counted.solve_state,
    counted.has_draft,
    counted.draft_status,
    counted.writing_submission_count,
    counted.latest_submission_id,
    counted.latest_submission_at,
    counted.writing_feedback_status,
    counted.lifecycle_status,
    counted.lifecycle_reason,
    counted.publish_status,
    counted.review_status
  from counted
  order by
    case when sort = 'difficulty' then counted.difficulty end asc nulls last,
    counted.created_at desc
  limit v_size offset v_offset;
end;
$$;

revoke all on function public.list_user_problems(jsonb, text, int, int) from public;
grant execute on function public.list_user_problems(jsonb, text, int, int) to authenticated;
comment on function public.list_user_problems(jsonb, text, int, int) is
  'C-02 writing-aware filtered pagination. SECURITY INVOKER. Adds writing_drafts/submissions solve_state and problem lifecycle fields.';
