-- list_user_problems canonical catalog 수리.
--
-- 20260722120000 은 20260713083000 의 pre-cutover 정의를 베이스로 작성되어,
-- 20260714140000 이 DROP 한 private helper 두 개를 본문 3곳에서 다시 참조한다:
--   private.is_writing_canonical_read_enabled()
--   private.is_canonical_writing_problem_anchor(uuid)
-- plpgsql 본문은 생성 시 이름을 해석하지 않으므로 적용은 성공하고 호출 시 42883 이 된다.
--
-- 본 마이그는 catalog CTE 만 20260714140000 이 확립한 post-cutover 형태로 교체한다.
-- public.problems 의 writing 행은 20260714140000 이 삭제했으므로 domain <> 'writing'
-- 으로 충분하며, canonical 브랜치는 조건 없이 읽는다.
-- 시그니처, 24개 반환 필드, 완료/시도 집계, 정렬, 권한은 변경하지 않는다.
--
-- Forward-only; v13 does not apply it remotely.

create or replace function public.list_user_problems(
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
      and problem.domain <> 'writing'

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

-- 적용 직후 라이브 카탈로그 상태를 단정한다. 문자열 검사가 아니라 pg_get_functiondef
-- 결과를 읽으므로, 실패 시 이 트랜잭션 전체가 롤백된다.
do $verify$
declare
  v_def text;
begin
  v_def := pg_get_functiondef(
    'public.list_user_problems(jsonb,text,integer,integer)'::regprocedure
  );
  if v_def like '%is_writing_canonical_read_enabled%'
     or v_def like '%is_canonical_writing_problem_anchor%' then
    raise exception 'list_user_problems_retired_read_dependency_remains';
  end if;
  if v_def not like '%get_available_writing_questions(null, null) canonical%' then
    raise exception 'list_user_problems_canonical_reader_missing';
  end if;
  if v_def not like '%writing_submission_attempt_count%' then
    raise exception 'list_user_problems_attempt_count_contract_missing';
  end if;
end
$verify$;
