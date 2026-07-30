-- =====================================================================
-- Institution-scoped writing problem visibility.
--
-- Contract:
-- - No exposure mapping rows for a question => public to all authenticated users.
-- - One or more mapping rows => visible only when profiles.affiliation_code
--   matches one of the mapped institution codes.
-- - This is a read-time visibility layer over service_status/publish/lifecycle;
--   it must not archive or unarchive public.problems rows.
-- =====================================================================

create or replace function public.is_writing_problem_visible_to_caller(
  p_problem_id uuid,
  p_question_no smallint
)
returns boolean
language plpgsql
security definer
set search_path = pg_catalog, public
stable
as $$
declare
  caller_id uuid := auth.uid();
  caller_code text;
  v_question_id text;
begin
  if caller_id is null then
    return false;
  end if;

  select nullif(btrim(affiliation_code), '')
    into caller_code
    from public.profiles
   where id = caller_id;

  select nullif(p.materials->>'question_id', '')
    into v_question_id
    from public.problems p
   where p.id = p_problem_id
     and p.domain = 'writing'
     and p.question_no = p_question_no;

  if v_question_id is null then
    return false;
  end if;

  -- The exposure table is owned by the shared admin surface. Local v13-only
  -- stacks may not have applied that migration yet; in that case, keep synced
  -- writing rows visible instead of breaking all writing practice locally.
  if to_regclass('public.topik_writing_question_institution_exposure') is null then
    return true;
  end if;

  return not exists (
    select 1
      from public.topik_writing_question_institution_exposure e
     where e.question_id = v_question_id
       and e.item_number = p_question_no
  )
  or exists (
    select 1
      from public.topik_writing_question_institution_exposure e
     where e.question_id = v_question_id
       and e.item_number = p_question_no
       and e.institution_code = caller_code
  );
end;
$$;

revoke all on function public.is_writing_problem_visible_to_caller(uuid, smallint) from public;
grant execute on function public.is_writing_problem_visible_to_caller(uuid, smallint) to authenticated;

comment on function public.is_writing_problem_visible_to_caller(uuid, smallint) is
  'Returns whether auth.uid() may see a writing problem under institution exposure rules. Mapping absence means public; mapping presence means profiles.affiliation_code must match. Requires problems.materials.question_id. 2026-06-26.';

create or replace function public.filter_visible_writing_problem_ids(
  p_problem_ids uuid[]
)
returns table (problem_id uuid)
language sql
security definer
set search_path = pg_catalog, public
stable
as $$
  select p.id
    from public.problems p
   where p.id = any(p_problem_ids)
     and p.domain = 'writing'
     and public.is_writing_problem_visible_to_caller(p.id, p.question_no);
$$;

revoke all on function public.filter_visible_writing_problem_ids(uuid[]) from public;
grant execute on function public.filter_visible_writing_problem_ids(uuid[]) to authenticated;

comment on function public.filter_visible_writing_problem_ids(uuid[]) is
  'Batch filters problem ids through institution-scoped writing visibility for server-side recommendation and direct-entry paths. 2026-06-26.';

create or replace function public.list_user_problems(
  filter    jsonb default '{}'::jsonb,
  sort      text  default 'newest',
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
  caller_id      uuid := auth.uid();
  v_page         int  := greatest(coalesce(page, 1), 1);
  v_size         int  := least(greatest(coalesce(page_size, 20), 1), 100);
  v_offset       int;
  f              jsonb := coalesce(filter, '{}'::jsonb);
  f_domain       text  := nullif(f->>'domain','');
  f_level        int   := nullif(f->>'topik_level','')::int;
  f_qno          int   := nullif(f->>'question_no','')::int;
  f_diff         int   := nullif(f->>'difficulty','')::int;
  f_status       text  := nullif(f->>'status','');
  f_search       text  := nullif(btrim(coalesce(f->>'search','')), '');
  f_recommended  boolean := coalesce((f->>'recommended')::boolean, false);
  f_review_set_id uuid := nullif(f->>'review_set_id','')::uuid;
  v_sort         text := coalesce(nullif(sort, ''), 'newest');
begin
  if caller_id is null then raise exception 'unauthenticated'; end if;
  v_offset := (v_page - 1) * v_size;

  return query
  with visible as (
    select p.*
    from public.problems p
    where p.publish_status = 'published'
      and (
        p.domain <> 'writing'
        or public.is_writing_problem_visible_to_caller(p.id, p.question_no)
      )
      and (f_domain is null or p.domain = f_domain)
      and (f_level  is null or p.topik_level = f_level)
      and (f_qno    is null or p.question_no = f_qno)
      and (f_diff   is null or p.difficulty = f_diff)
      and (f_search is null or p.title ilike '%' || f_search || '%')
      and (
        f_review_set_id is null
        or exists (
          select 1
          from public.study_events se
          cross join lateral jsonb_array_elements_text(se.payload->'item_ids') as selected(item_id)
          join public.library_items li on li.id = selected.item_id::uuid
          left join public.writing_submissions s on s.id = li.submission_id
          where se.id = f_review_set_id
            and se.user_id = caller_id
            and se.event_type = 'review_set_created'
            and li.user_id = caller_id
            and (
              li.problem_id = p.id
              or s.problem_id = p.id
            )
        )
      )
      and (
        not f_recommended
        or exists (
          select 1
          from public.recommendation_items ri
          join public.recommendation_runs rr on rr.id = ri.run_id
          where ri.problem_id = p.id
            and rr.user_id = caller_id
            and coalesce(ri.status, 'active') = 'active'
            and (rr.expires_at is null or rr.expires_at > now())
        )
      )
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
    case when v_sort in ('difficulty-asc', 'difficulty') then counted.difficulty end asc nulls last,
    case when v_sort = 'difficulty-desc' then counted.difficulty end desc nulls last,
    case when v_sort in ('oldest') then counted.created_at end asc nulls last,
    case when v_sort in ('newest', 'recent', 'difficulty', 'difficulty-asc', 'difficulty-desc') then counted.created_at end desc nulls last,
    counted.id asc
  limit v_size offset v_offset;
end;
$$;

revoke all on function public.list_user_problems(jsonb, text, int, int) from public;
grant execute on function public.list_user_problems(jsonb, text, int, int) to authenticated;
comment on function public.list_user_problems(jsonb, text, int, int) is
  'C-02 writing-aware filtered pagination with recommended-only filtering, exact UI sort semantics, stable tie ordering, and institution writing exposure filtering.';

create or replace function private.assert_writing_problem_submittable(
  p_problem_id uuid,
  p_question_no smallint
)
returns void
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
begin
  if not exists (
    select 1
      from public.problems p
     where p.id = p_problem_id
       and p.domain = 'writing'
       and p.question_no = p_question_no
       and p.publish_status = 'published'
       and p.visibility = 'public'
       and p.lifecycle_status = 'active'
       and public.is_writing_problem_visible_to_caller(p.id, p.question_no)
  ) then
    raise exception 'problem_not_submittable'
      using errcode = 'P0001',
            detail = 'Writing submissions are allowed only for published, public, active, institution-visible writing problems.';
  end if;
end;
$$;

revoke all on function private.assert_writing_problem_submittable(uuid, smallint) from public;
grant execute on function private.assert_writing_problem_submittable(uuid, smallint) to authenticated;
comment on function private.assert_writing_problem_submittable(uuid, smallint) is
  'Rejects writing submissions for hidden, unpublished, inactive, non-writing, question-number-mismatched, or institution-hidden problems.';

create or replace function private.is_writing_problem_visible_to_user(
  p_problem_id uuid,
  p_question_no smallint,
  p_user_id uuid
)
returns boolean
language plpgsql
security definer
set search_path = pg_catalog, public
stable
as $$
declare
  caller_code text;
  v_question_id text;
begin
  if p_user_id is null then
    return false;
  end if;

  select nullif(btrim(affiliation_code), '')
    into caller_code
    from public.profiles
   where id = p_user_id;

  select nullif(p.materials->>'question_id', '')
    into v_question_id
    from public.problems p
   where p.id = p_problem_id
     and p.domain = 'writing'
     and p.question_no = p_question_no;

  if v_question_id is null then
    return false;
  end if;

  if to_regclass('public.topik_writing_question_institution_exposure') is null then
    return true;
  end if;

  return not exists (
    select 1
      from public.topik_writing_question_institution_exposure e
     where e.question_id = v_question_id
       and e.item_number = p_question_no
  )
  or exists (
    select 1
      from public.topik_writing_question_institution_exposure e
     where e.question_id = v_question_id
       and e.item_number = p_question_no
       and e.institution_code = caller_code
  );
end;
$$;

revoke all on function private.is_writing_problem_visible_to_user(uuid, smallint, uuid) from public;
grant execute on function private.is_writing_problem_visible_to_user(uuid, smallint, uuid) to service_role;

comment on function private.is_writing_problem_visible_to_user(uuid, smallint, uuid) is
  'Private owner-aware variant of institution-scoped writing visibility for service-role submission ingestion. 2026-06-26.';

create or replace function private.assert_writing_problem_submittable_for_user(
  p_problem_id uuid,
  p_question_no smallint,
  p_user_id uuid
)
returns void
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
begin
  if not exists (
    select 1
      from public.problems p
     where p.id = p_problem_id
       and p.domain = 'writing'
       and p.question_no = p_question_no
       and p.publish_status = 'published'
       and p.visibility = 'public'
       and p.lifecycle_status = 'active'
       and private.is_writing_problem_visible_to_user(p.id, p.question_no, p_user_id)
  ) then
    raise exception 'problem_not_submittable'
      using errcode = 'P0001',
            detail = 'Writing submissions are allowed only for published, public, active, institution-visible writing problems.';
  end if;
end;
$$;

revoke all on function private.assert_writing_problem_submittable_for_user(uuid, smallint, uuid) from public;
grant execute on function private.assert_writing_problem_submittable_for_user(uuid, smallint, uuid) to service_role;

comment on function private.assert_writing_problem_submittable_for_user(uuid, smallint, uuid) is
  'Owner-aware service-role writing submission guard for hidden, unpublished, inactive, non-writing, question-number-mismatched, or institution-hidden problems.';

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
  'Service-side writer. Idempotent per draft, auto-saves each submitted answer to My Library, and checks institution writing exposure for the owner user.';
