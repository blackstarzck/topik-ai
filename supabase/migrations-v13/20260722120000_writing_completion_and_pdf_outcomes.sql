-- =====================================================================
-- Learner-visible writing completion and PDF export outcome ledger
--
-- Forward-only. This migration is intentionally not applied remotely by v13.
-- =====================================================================

alter table public.export_files
  add column if not exists failure_code text,
  add column if not exists failed_at timestamptz;

update public.export_files
set failure_code = coalesce(failure_code, 'legacy_unknown'),
    failed_at = coalesce(failed_at, ready_at, created_at),
    ready_at = null
where status = 'failed';

alter table public.export_files
  drop constraint if exists export_files_failure_code_allowed;
alter table public.export_files
  add constraint export_files_failure_code_allowed check (
    failure_code is null
    or failure_code in (
      'legacy_unknown',
      'quota_exceeded',
      'quota_claim_failed',
      'analysis_unavailable',
      'item_unavailable',
      'item_resolution_failed',
      'server_render_failed',
      'storage_upload_failed',
      'browser_print_prepare_failed',
      'quota_commit_failed',
      'export_record_failed',
      'unknown'
    )
  ) not valid;
alter table public.export_files
  validate constraint export_files_failure_code_allowed;

alter table public.export_files
  drop constraint if exists export_files_failure_terminal_shape;
alter table public.export_files
  add constraint export_files_failure_terminal_shape check (
    (
      status = 'failed'
      and failure_code is not null
      and failed_at is not null
      and ready_at is null
    )
    or (
      status in ('queued', 'ready')
      and failure_code is null
      and failed_at is null
    )
  ) not valid;
alter table public.export_files
  validate constraint export_files_failure_terminal_shape;

comment on column public.export_files.failure_code is
  'Sanitized terminal classification only. Never stores exception messages, answers, provider payloads, or PII.';
comment on column public.export_files.failed_at is
  'Terminal failure timestamp. Null for queued and ready exports.';

drop function if exists public.list_user_problems(jsonb, text, integer, integer);

create function public.list_user_problems(
  filter jsonb default '{}'::jsonb,
  sort text default 'newest',
  page int default 1,
  page_size int default 20
)
returns table (
  problem_id uuid,
  title text,
  domain text,
  topik_level smallint,
  question_no smallint,
  difficulty smallint,
  tags text[],
  attempt_count int,
  is_solved boolean,
  last_attempt_at timestamptz,
  created_at timestamptz,
  total_count bigint,
  solve_state text,
  has_draft boolean,
  draft_status text,
  writing_submission_count int,
  writing_submission_attempt_count int,
  latest_submission_id uuid,
  latest_submission_at timestamptz,
  writing_feedback_status text,
  lifecycle_status text,
  lifecycle_reason text,
  publish_status text,
  review_status text
)
language plpgsql
set search_path = pg_catalog, public, private
stable
as $$
declare
  caller_id uuid := auth.uid();
  v_page int := greatest(coalesce(page, 1), 1);
  v_size int := least(greatest(coalesce(page_size, 20), 1), 100);
  v_offset int;
  f jsonb := coalesce(filter, '{}'::jsonb);
  f_domain text := nullif(f->>'domain', '');
  f_level int := nullif(f->>'topik_level', '')::int;
  f_qno int := nullif(f->>'question_no', '')::int;
  f_diff int := nullif(f->>'difficulty', '')::int;
  f_status text := nullif(f->>'status', '');
  f_search text := nullif(btrim(coalesce(f->>'search', '')), '');
  f_recommended boolean := coalesce((f->>'recommended')::boolean, false);
  f_review_set_id uuid := nullif(f->>'review_set_id', '')::uuid;
  v_sort text := coalesce(nullif(sort, ''), 'newest');
begin
  if caller_id is null then
    raise exception 'unauthenticated';
  end if;
  v_offset := (v_page - 1) * v_size;

  return query
  with catalog as (
    select
      problem.id,
      problem.title,
      problem.domain,
      problem.topik_level,
      problem.question_no,
      problem.difficulty,
      problem.tags,
      problem.created_at,
      problem.lifecycle_status,
      problem.lifecycle_reason,
      problem.publish_status,
      problem.review_status
    from public.problems problem
    where problem.publish_status = 'published'
      and (
        problem.domain <> 'writing'
        or (
          (
            not private.is_writing_canonical_read_enabled()
            or not private.is_canonical_writing_problem_anchor(problem.id)
          )
          and public.is_writing_problem_visible_to_caller(
            problem.id,
            problem.question_no
          )
        )
      )

    union all

    select
      canonical.problem_id,
      canonical.title,
      'writing'::text,
      canonical.topik_level,
      canonical.item_number,
      canonical.difficulty,
      canonical.tags,
      canonical.source_created_at,
      'active'::text,
      null::text,
      'published'::text,
      'approved'::text
    from public.get_available_writing_questions(null, null) canonical
    where private.is_writing_canonical_read_enabled()
  ),
  visible as (
    select catalog.*
    from catalog
    where (f_domain is null or catalog.domain = f_domain)
      and (f_level is null or catalog.topik_level = f_level)
      and (f_qno is null or catalog.question_no = f_qno)
      and (f_diff is null or catalog.difficulty = f_diff)
      and (f_search is null or catalog.title ilike '%' || f_search || '%')
      and (
        f_review_set_id is null
        or exists (
          select 1
          from public.study_events event
          cross join lateral jsonb_array_elements_text(
            event.payload->'item_ids'
          ) as selected(item_id)
          join public.library_items library
            on library.id = selected.item_id::uuid
          left join public.writing_submissions submission
            on submission.id = library.submission_id
          where event.id = f_review_set_id
            and event.user_id = caller_id
            and event.event_type = 'review_set_created'
            and library.user_id = caller_id
            and (
              library.problem_id = catalog.id
              or submission.problem_id = catalog.id
            )
        )
      )
      and (
        not f_recommended
        or exists (
          select 1
          from public.recommendation_items item
          join public.recommendation_runs run on run.id = item.run_id
          where item.problem_id = catalog.id
            and run.user_id = caller_id
            and coalesce(item.status, 'active') = 'active'
            and (run.expires_at is null or run.expires_at > now())
        )
      )
  ),
  with_activity as (
    select
      visible.*,
      coalesce(attempt.objective_attempt_count, 0) as objective_attempt_count,
      coalesce(attempt.objective_is_solved, false) as objective_is_solved,
      attempt.objective_last_attempt_at,
      coalesce(draft.has_draft, false) as has_draft,
      draft.draft_status,
      draft.latest_draft_at,
      coalesce(submission.writing_submission_count, 0)
        as writing_submission_count,
      coalesce(submission.writing_submission_attempt_count, 0)
        as writing_submission_attempt_count,
      submission.latest_submission_id,
      submission.latest_submission_at,
      submission.writing_feedback_status
    from visible
    left join lateral (
      select
        count(*)::int as objective_attempt_count,
        coalesce(bool_or(problem_attempt.is_correct), false)
          as objective_is_solved,
        max(problem_attempt.started_at) as objective_last_attempt_at
      from public.problem_attempts problem_attempt
      where problem_attempt.problem_id = visible.id
        and problem_attempt.user_id = caller_id
    ) attempt on true
    left join lateral (
      select
        (count(*) > 0) as has_draft,
        (array_agg(
          writing_draft.autosave_status
          order by writing_draft.last_saved_at desc nulls last
        ))[1] as draft_status,
        max(writing_draft.last_saved_at) as latest_draft_at
      from public.writing_drafts writing_draft
      where writing_draft.problem_id = visible.id
        and writing_draft.user_id = caller_id
        and writing_draft.autosave_status <> 'superseded'
    ) draft on true
    left join lateral (
      select
        count(*) filter (
          where writing_submission.feedback_status = 'complete'
            and exists (
              select 1
              from public.writing_feedback writing_feedback
              where writing_feedback.submission_id = writing_submission.id
                and writing_feedback.status = 'complete'
            )
        )::int as writing_submission_count,
        count(*)::int as writing_submission_attempt_count,
        (array_agg(
          writing_submission.id
          order by writing_submission.submitted_at desc
        ))[1] as latest_submission_id,
        max(writing_submission.submitted_at) as latest_submission_at,
        (array_agg(
          case
            when writing_submission.feedback_status = 'complete'
              and exists (
                select 1
                from public.writing_feedback writing_feedback
                where writing_feedback.submission_id = writing_submission.id
                  and writing_feedback.status = 'complete'
              ) then 'complete'
            when writing_submission.feedback_status = 'complete'
              then 'analyzing'
            else writing_submission.feedback_status
          end
          order by writing_submission.submitted_at desc
        ))[1] as writing_feedback_status
      from public.writing_submissions writing_submission
      where writing_submission.problem_id = visible.id
        and writing_submission.user_id = caller_id
    ) submission on true
  ),
  with_status as (
    select
      activity.*,
      case
        when activity.domain = 'writing'
          and activity.writing_submission_count > 0 then 'submitted'
        when activity.domain = 'writing'
          and activity.writing_submission_attempt_count > 0 then 'attempted'
        when activity.domain = 'writing' and activity.has_draft then 'attempted'
        when activity.domain <> 'writing'
          and activity.objective_is_solved then 'submitted'
        when activity.domain <> 'writing'
          and activity.objective_attempt_count > 0 then 'attempted'
        else 'none'
      end as solve_state,
      case
        when activity.domain = 'writing' then
          activity.writing_submission_attempt_count
          + case
              when activity.has_draft
                and activity.writing_submission_attempt_count = 0 then 1
              else 0
            end
        else activity.objective_attempt_count
      end as effective_attempt_count,
      case
        when activity.domain = 'writing' then
          activity.writing_submission_count > 0
        else activity.objective_is_solved
      end as effective_is_solved,
      case
        when activity.domain = 'writing' then
          case
            when activity.latest_submission_at is not null
              and activity.latest_draft_at is not null
              then greatest(
                activity.latest_submission_at,
                activity.latest_draft_at
              )
            else coalesce(
              activity.latest_submission_at,
              activity.latest_draft_at
            )
          end
        else activity.objective_last_attempt_at
      end as effective_last_attempt_at
    from with_activity activity
  ),
  filtered as (
    select status.*
    from with_status status
    where f_status is null
       or (f_status = 'solved' and status.solve_state = 'submitted')
       or (f_status = 'attempted' and status.solve_state = 'attempted')
       or (f_status = 'unattempted' and status.solve_state = 'none')
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
    counted.writing_submission_attempt_count,
    counted.latest_submission_id,
    counted.latest_submission_at,
    counted.writing_feedback_status,
    counted.lifecycle_status,
    counted.lifecycle_reason,
    counted.publish_status,
    counted.review_status
  from counted
  order by
    case
      when v_sort in ('difficulty-asc', 'difficulty')
        then counted.difficulty
    end asc nulls last,
    case when v_sort = 'difficulty-desc' then counted.difficulty end desc nulls last,
    case when v_sort = 'oldest' then counted.created_at end asc nulls last,
    case
      when v_sort in (
        'newest',
        'recent',
        'difficulty',
        'difficulty-asc',
        'difficulty-desc'
      ) then counted.created_at
    end desc nulls last,
    counted.id asc
  limit v_size offset v_offset;
end;
$$;

revoke all on function public.list_user_problems(jsonb, text, integer, integer)
  from public;
grant execute on function public.list_user_problems(jsonb, text, integer, integer)
  to authenticated;

comment on function public.list_user_problems(jsonb, text, integer, integer) is
  'Learner problem list. writing_submission_count means fully analyzed completion; writing_submission_attempt_count means all materialized submission rows.';

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
  from public.writing_submissions writing_submission
  where writing_submission.user_id = caller_id
    and writing_submission.submitted_at >= today_start
    and writing_submission.submitted_at < today_end
    and writing_submission.feedback_status = 'complete'
    and exists (
      select 1
      from public.writing_feedback writing_feedback
      where writing_feedback.submission_id = writing_submission.id
        and writing_feedback.status = 'complete'
    );

  select count(*)::int into total_attempts
  from public.writing_submissions writing_submission
  where writing_submission.user_id = caller_id
    and writing_submission.feedback_status = 'complete'
    and exists (
      select 1
      from public.writing_feedback writing_feedback
      where writing_feedback.submission_id = writing_submission.id
        and writing_feedback.status = 'complete'
    );

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
    select distinct (event.occurred_at at time zone 'Asia/Seoul')::date as d
    from public.study_events event
    where event.user_id = caller_id
  ),
  latest as (
    select max(d) as max_d
    from event_days
    where d <= today_kst
  ),
  ranked_days as (
    select event_day.d,
           row_number() over (order by event_day.d desc) as rn,
           latest.max_d
    from event_days event_day
    cross join latest
    where event_day.d <= today_kst
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
  'Learner KPI counts only writing submissions whose submission and feedback rows are both complete.';
