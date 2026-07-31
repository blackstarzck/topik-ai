-- =====================================================================
-- TALKPIK AI · Phase 6 · RPC + admin + RLS hardening
--
-- Codex pre-impl review: 5 rounds, PASS at rev4 (2026-05-22).
--
-- Sections:
--   1.  Admin role helpers (is_platform/content/org_admin)
--   1b. profiles policies narrowed to platform_admin
--   2.  writing_submissions self-INSERT removal + explicit deny
--   3.  private.assert_submission_payload validator
--   4.  library_items / export_files / study_events ownership-strict policies
--   5.  get_dashboard_kpi() — no args, KST day boundary
--   6.  admin_change_user_role — platform_admin only
--   7.  admin_toggle_problem_publish — content_admin
--   8.  Phase 5 RPC body upgrade (validator + dead invalidate friendly)
--   8b. get_admin_org_dashboard — org_admin SECURITY DEFINER aggregate
--
-- Trust model: SECURITY DEFINER functions run as their definer (postgres,
-- BYPASSRLS). FORCE RLS on user tables still applies to direct client
-- access; the definer bypass keeps RPC paths working.
-- =====================================================================


-- =====================================================================
-- 1. Admin role helpers (private schema, SECURITY DEFINER, STABLE)
-- =====================================================================

create or replace function private.is_platform_admin(uid uuid)
returns boolean
language sql
security definer
set search_path = public, pg_catalog
stable
as $$
  select exists (
    select 1 from public.profiles
    where id = uid
      and app_role = 'platform_admin'
      and status = 'active'
  );
$$;
revoke all on function private.is_platform_admin(uuid) from public;
grant execute on function private.is_platform_admin(uuid) to authenticated;
comment on function private.is_platform_admin(uuid) is
  'True only for platform_admin. Used to gate user role changes + profile admin read/write.';

create or replace function private.is_content_admin(uid uuid)
returns boolean
language sql
security definer
set search_path = public, pg_catalog
stable
as $$
  select exists (
    select 1 from public.profiles
    where id = uid
      and app_role in ('content_admin','platform_admin')
      and status = 'active'
  );
$$;
revoke all on function private.is_content_admin(uuid) from public;
grant execute on function private.is_content_admin(uuid) to authenticated;
comment on function private.is_content_admin(uuid) is
  'True for content_admin or platform_admin. Used to gate problem publish toggle.';

create or replace function private.is_org_admin(uid uuid)
returns boolean
language sql
security definer
set search_path = public, pg_catalog
stable
as $$
  select exists (
    select 1 from public.profiles
    where id = uid
      and app_role in ('org_admin','platform_admin')
      and status = 'active'
  );
$$;
revoke all on function private.is_org_admin(uuid) from public;
grant execute on function private.is_org_admin(uuid) to authenticated;
comment on function private.is_org_admin(uuid) is
  'True for org_admin or platform_admin. Used by get_admin_org_dashboard RPC.';


-- =====================================================================
-- 1b. profiles policies — narrow admin branches to platform_admin only
-- =====================================================================

drop policy if exists profiles_admin_all on public.profiles;
create policy profiles_platform_admin_all
  on public.profiles
  for all to authenticated
  using ( private.is_platform_admin((select auth.uid())) )
  with check ( private.is_platform_admin((select auth.uid())) );

drop policy if exists profiles_self_select on public.profiles;
create policy profiles_self_select
  on public.profiles
  for select to authenticated
  using (
    id = (select auth.uid())
    or private.is_platform_admin((select auth.uid()))
  );


-- =====================================================================
-- 2. writing_submissions — remove client-side INSERT path entirely
--    RPC submit_writing_with_feedback (SECURITY DEFINER) is the sole writer.
-- =====================================================================

drop policy if exists writing_submissions_owner_insert on public.writing_submissions;
create policy writing_submissions_no_direct_insert
  on public.writing_submissions
  for insert to authenticated
  with check (false);
comment on policy writing_submissions_no_direct_insert on public.writing_submissions is
  'Explicit deny. All inserts must go through submit_writing_with_feedback RPC.';


-- =====================================================================
-- 3. private.assert_submission_payload — strict validator
--    DB-source-of-truth enums: feedback.sql:39 (dimension) + feedback.sql:43
--    (weakness_level 1-5) + writing.sql:47 (question_no in 51..54).
-- =====================================================================

create or replace function private.assert_submission_payload(
  submission jsonb,
  dimensions jsonb,
  sentences jsonb
)
returns void
language plpgsql
set search_path = pg_catalog, public
as $$
declare
  qn int;
  cc int;
  dim_row jsonb;
  dim_name text;
  wl_text text;
  wl_int int;
  sent_row jsonb;
  si_int int;
begin
  if submission is null or jsonb_typeof(submission) <> 'object' then
    raise exception 'invalid submission payload (not object)';
  end if;

  -- problem_id
  if not (submission ? 'problem_id')
     or jsonb_typeof(submission->'problem_id') <> 'string' then
    raise exception 'submission.problem_id required (string)';
  end if;
  begin
    perform (submission->>'problem_id')::uuid;
  exception when others then
    raise exception 'submission.problem_id must be a valid uuid';
  end;

  -- question_no in (51,52,53,54)
  if not (submission ? 'question_no') then
    raise exception 'submission.question_no required';
  end if;
  begin
    qn := (submission->>'question_no')::int;
  exception when others then
    raise exception 'submission.question_no must be integer';
  end;
  if qn not in (51,52,53,54) then
    raise exception 'submission.question_no must be one of (51,52,53,54)';
  end if;

  -- answer_text non-empty
  if not (submission ? 'answer_text')
     or jsonb_typeof(submission->'answer_text') <> 'string'
     or length(submission->>'answer_text') = 0 then
    raise exception 'submission.answer_text required (non-empty string)';
  end if;

  -- char_count integer >= 0
  if not (submission ? 'char_count') then
    raise exception 'submission.char_count required';
  end if;
  begin
    cc := (submission->>'char_count')::int;
  exception when others then
    raise exception 'submission.char_count must be integer';
  end;
  if cc < 0 then
    raise exception 'submission.char_count must be >= 0';
  end if;

  -- draft_id optional uuid
  if submission ? 'draft_id' and jsonb_typeof(submission->'draft_id') <> 'null' then
    if jsonb_typeof(submission->'draft_id') <> 'string' then
      raise exception 'submission.draft_id must be string uuid';
    end if;
    begin
      perform (submission->>'draft_id')::uuid;
    exception when others then
      raise exception 'submission.draft_id must be a valid uuid';
    end;
  end if;

  -- dimensions optional array
  if dimensions is not null and jsonb_typeof(dimensions) = 'array' then
    for dim_row in select * from jsonb_array_elements(dimensions) loop
      if jsonb_typeof(dim_row) <> 'object' then
        raise exception 'dimension entry must be object';
      end if;
      dim_name := dim_row->>'dimension';
      if dim_name is null
         or dim_name not in ('grammar','vocab','structure','content','expression','topic_fit') then
        raise exception 'invalid dimension name: %', dim_name;
      end if;
      if (dim_row ? 'score') and (dim_row->>'score') <> ''
         and (dim_row->>'score')::numeric < 0 then
        raise exception 'dimension.score must be >= 0';
      end if;
      if (dim_row ? 'score_max') and (dim_row->>'score_max') <> ''
         and (dim_row->>'score_max')::numeric < 0 then
        raise exception 'dimension.score_max must be >= 0';
      end if;
      if (dim_row ? 'weakness_level') and (dim_row->>'weakness_level') <> '' then
        wl_text := dim_row->>'weakness_level';
        begin
          wl_int := wl_text::int;
        exception when others then
          raise exception 'dimension.weakness_level must be integer';
        end;
        if wl_int < 1 or wl_int > 5 then
          raise exception 'dimension.weakness_level must be between 1 and 5';
        end if;
      end if;
    end loop;
  end if;

  -- sentences optional array
  if sentences is not null and jsonb_typeof(sentences) = 'array' then
    for sent_row in select * from jsonb_array_elements(sentences) loop
      if jsonb_typeof(sent_row) <> 'object' then
        raise exception 'sentence entry must be object';
      end if;
      if not (sent_row ? 'sentence_index') then
        raise exception 'sentence.sentence_index required';
      end if;
      begin
        si_int := (sent_row->>'sentence_index')::int;
      exception when others then
        raise exception 'sentence.sentence_index must be integer';
      end;
      if si_int < 0 then
        raise exception 'sentence.sentence_index must be >= 0';
      end if;
    end loop;
  end if;
end;
$$;
revoke all on function private.assert_submission_payload(jsonb, jsonb, jsonb) from public;
grant execute on function private.assert_submission_payload(jsonb, jsonb, jsonb) to authenticated;
comment on function private.assert_submission_payload(jsonb, jsonb, jsonb) is
  'Strict validator for submit_writing_with_feedback payload. DB-truth enums for dimension/weakness/question_no.';


-- =====================================================================
-- 4. library_items / export_files / study_events — ownership-strict
--    Insert policies verify referenced FK ownership in addition to user_id.
-- =====================================================================

-- 4.1 library_items
drop policy if exists library_items_owner_all on public.library_items;

drop policy if exists library_items_owner_select on public.library_items;
create policy library_items_owner_select
  on public.library_items
  for select to authenticated
  using ( user_id = (select auth.uid()) );

drop policy if exists library_items_owner_insert on public.library_items;
create policy library_items_owner_insert
  on public.library_items
  for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and (
      (item_type = 'attempt' and exists (
        select 1 from public.problem_attempts a
        where a.id = library_items.attempt_id and a.user_id = (select auth.uid())
      ))
      or (item_type = 'submission' and exists (
        select 1 from public.writing_submissions s
        where s.id = library_items.submission_id and s.user_id = (select auth.uid())
      ))
      or (item_type = 'report' and exists (
        select 1 from public.comparison_reports r
        where r.id = library_items.report_id and r.user_id = (select auth.uid())
      ))
      or (item_type = 'export' and exists (
        select 1 from public.export_files e
        where e.id = library_items.export_id and e.user_id = (select auth.uid())
      ))
      or (item_type = 'problem' and exists (
        select 1 from public.problems p
        where p.id = library_items.problem_id
          and (
            (p.publish_status = 'published' and (p.visibility = 'public' or p.author_id = (select auth.uid())))
            or p.author_id = (select auth.uid())
          )
      ))
    )
  );

drop policy if exists library_items_owner_update on public.library_items;
create policy library_items_owner_update
  on public.library_items
  for update to authenticated
  using ( user_id = (select auth.uid()) )
  with check ( user_id = (select auth.uid()) );

drop policy if exists library_items_owner_delete on public.library_items;
create policy library_items_owner_delete
  on public.library_items
  for delete to authenticated
  using ( user_id = (select auth.uid()) );


-- 4.2 export_files
drop policy if exists export_files_owner_all on public.export_files;

drop policy if exists export_files_owner_select on public.export_files;
create policy export_files_owner_select
  on public.export_files
  for select to authenticated
  using ( user_id = (select auth.uid()) );

drop policy if exists export_files_owner_insert on public.export_files;
create policy export_files_owner_insert
  on public.export_files
  for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and (
      (source_type = 'submission' and source_id is not null and exists (
        select 1 from public.writing_submissions s
        where s.id = export_files.source_id and s.user_id = (select auth.uid())
      ))
      or (source_type = 'report' and source_id is not null and exists (
        select 1 from public.comparison_reports r
        where r.id = export_files.source_id and r.user_id = (select auth.uid())
      ))
      or (source_type = 'library_selection' and source_id is null)
    )
  );

drop policy if exists export_files_owner_update on public.export_files;
create policy export_files_owner_update
  on public.export_files
  for update to authenticated
  using ( user_id = (select auth.uid()) )
  with check ( user_id = (select auth.uid()) );

drop policy if exists export_files_owner_delete on public.export_files;
create policy export_files_owner_delete
  on public.export_files
  for delete to authenticated
  using ( user_id = (select auth.uid()) );


-- 4.3 study_events — replace insert policy with FK-ownership check
drop policy if exists study_events_owner_insert on public.study_events;
create policy study_events_owner_insert
  on public.study_events
  for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and (problem_id is null or exists (
      select 1 from public.problems p
      where p.id = study_events.problem_id
        and (
          (p.publish_status = 'published' and (p.visibility = 'public' or p.author_id = (select auth.uid())))
          or p.author_id = (select auth.uid())
        )
    ))
    and (submission_id is null or exists (
      select 1 from public.writing_submissions s
      where s.id = study_events.submission_id and s.user_id = (select auth.uid())
    ))
    and (attempt_id is null or exists (
      select 1 from public.problem_attempts a
      where a.id = study_events.attempt_id and a.user_id = (select auth.uid())
    ))
  );


-- =====================================================================
-- 5. get_dashboard_kpi() — no args, KST day boundary, RLS-bypass via DEFINER
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

  -- today_attempts
  select count(*)::int into today_attempts
    from public.problem_attempts
    where user_id = caller_id
      and started_at >= today_start
      and started_at <  today_end;

  -- total_attempts
  select count(*)::int into total_attempts
    from public.problem_attempts
    where user_id = caller_id;

  -- exam_days_left
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

  -- streak_days: consecutive KST days ending today or yesterday
  with day_keys as (
    select distinct
      ((started_at at time zone 'Asia/Seoul')::date) as d
    from public.problem_attempts
    where user_id = caller_id
      and started_at >= (today_kst - 365)::timestamp at time zone 'Asia/Seoul'
    order by 1 desc
  ),
  with_offset as (
    select d,
           today_kst - d as off
    from day_keys
  ),
  -- Streak: starts at offset 0 or 1, increases by 1 each step (off = row_number - start_off).
  streak_calc as (
    select d, off, row_number() over (order by off) - 1 as rn
    from with_offset
    where off >= 0
  ),
  -- A day is part of streak if its `off` matches the position from the top (with start offset 0 or 1).
  top_offset as (
    select min(off) as start_off from streak_calc
  ),
  streak_rows as (
    select sc.* from streak_calc sc, top_offset t
    where sc.off = t.start_off + sc.rn
      and t.start_off <= 1
  )
  select count(*)::int into sd from streak_rows;
  streak_days := coalesce(sd, 0);

  return next;
end;
$$;
revoke all on function public.get_dashboard_kpi() from public;
grant execute on function public.get_dashboard_kpi() to authenticated;
comment on function public.get_dashboard_kpi() is
  'Phase 6: dashboard KPI in 1 round-trip. No args -> caller is always auth.uid(). KST day boundary preserved.';


-- =====================================================================
-- 6. admin_change_user_role — platform_admin only, audited
-- =====================================================================

create or replace function public.admin_change_user_role(
  target_id uuid,
  new_role text
)
returns void
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  caller_id uuid := auth.uid();
  old_role text;
begin
  if caller_id is null then raise exception 'unauthenticated'; end if;
  if not private.is_platform_admin(caller_id) then
    raise exception 'forbidden: platform_admin required';
  end if;
  if target_id is null then raise exception 'target_id required'; end if;
  if new_role not in ('learner','content_admin','org_admin','platform_admin') then
    raise exception 'invalid new_role: %', new_role;
  end if;
  if target_id = caller_id then
    raise exception 'cannot change own role';
  end if;

  select app_role into old_role from public.profiles where id = target_id;
  if old_role is null then raise exception 'target user not found'; end if;
  if old_role = new_role then return; end if;

  update public.profiles set app_role = new_role where id = target_id;

  insert into public.admin_audit_logs (
    admin_user_id, action, target_table, target_id, diff, payload
  ) values (
    caller_id,
    'profile.role_change',
    'profiles',
    target_id::text,
    jsonb_build_object('from', old_role, 'to', new_role),
    jsonb_build_object('target_user_id', target_id)
  );
end;
$$;
revoke all on function public.admin_change_user_role(uuid, text) from public;
grant execute on function public.admin_change_user_role(uuid, text) to authenticated;
comment on function public.admin_change_user_role(uuid, text) is
  'Platform-admin only. Updates profiles.app_role + writes admin_audit_logs row.';


-- =====================================================================
-- 7. admin_toggle_problem_publish — content_admin or platform_admin
-- =====================================================================

create or replace function public.admin_toggle_problem_publish(
  problem_id uuid,
  new_status text
)
returns void
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  caller_id uuid := auth.uid();
  old_status text;
begin
  if caller_id is null then raise exception 'unauthenticated'; end if;
  if not private.is_content_admin(caller_id) then
    raise exception 'forbidden: content_admin required';
  end if;
  if new_status not in ('draft','published','archived') then
    raise exception 'invalid new_status: %', new_status;
  end if;

  select publish_status into old_status from public.problems where id = problem_id;
  if old_status is null then raise exception 'problem not found'; end if;
  if old_status = new_status then return; end if;

  update public.problems set publish_status = new_status where id = problem_id;

  insert into public.admin_audit_logs (
    admin_user_id, action, target_table, target_id, diff, payload
  ) values (
    caller_id,
    'problem.publish_change',
    'problems',
    problem_id::text,
    jsonb_build_object('from', old_status, 'to', new_status),
    '{}'::jsonb
  );
end;
$$;
revoke all on function public.admin_toggle_problem_publish(uuid, text) from public;
grant execute on function public.admin_toggle_problem_publish(uuid, text) to authenticated;
comment on function public.admin_toggle_problem_publish(uuid, text) is
  'Content/platform admin only. Toggles problems.publish_status + writes admin_audit_logs row.';


-- =====================================================================
-- 8. Phase 5 RPC body upgrade — call validator at entry
--    Re-defines submit_writing_with_feedback. Behaviour unchanged except
--    explicit validation up front. Signature/return unchanged.
--    NB: service_role grants are intentionally NOT added (OOS-12).
-- =====================================================================

create or replace function public.submit_writing_with_feedback(
  submission jsonb,
  feedback jsonb,
  dimensions jsonb,
  sentences jsonb
)
returns uuid
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  caller_id uuid := auth.uid();
  new_submission_id uuid;
  dim_row jsonb;
  sent_row jsonb;
begin
  if caller_id is null then
    raise exception 'unauthenticated';
  end if;

  perform private.assert_submission_payload(submission, dimensions, sentences);

  insert into public.writing_submissions (
    user_id, problem_id, draft_id, question_no,
    answer_text, answer_json, char_count, feedback_status
  )
  values (
    caller_id,
    (submission->>'problem_id')::uuid,
    case when submission ? 'draft_id'
              and jsonb_typeof(submission->'draft_id') = 'string'
         then (submission->>'draft_id')::uuid
         else null end,
    (submission->>'question_no')::smallint,
    submission->>'answer_text',
    case when submission ? 'answer_json'
         then submission->'answer_json'
         else null end,
    (submission->>'char_count')::int,
    'complete'
  )
  returning id into new_submission_id;

  insert into public.writing_feedback (
    submission_id, user_id, status,
    score_total, score_max, overall_summary,
    ai_model, ai_model_version, raw_ai_result
  )
  values (
    new_submission_id,
    caller_id,
    'complete',
    nullif(feedback->>'score_total', '')::numeric,
    nullif(feedback->>'score_max', '')::numeric,
    feedback->>'overall_summary',
    coalesce(feedback->>'ai_model', 'mock-v1'),
    coalesce(feedback->>'ai_model_version', 'phase-5'),
    case when feedback ? 'raw_ai_result' then feedback->'raw_ai_result' else null end
  );

  if jsonb_typeof(dimensions) = 'array' then
    for dim_row in select * from jsonb_array_elements(dimensions)
    loop
      insert into public.feedback_dimension_scores (
        submission_id, user_id, dimension,
        score, score_max, summary, weakness_level
      )
      values (
        new_submission_id,
        caller_id,
        dim_row->>'dimension',
        nullif(dim_row->>'score', '')::numeric,
        nullif(dim_row->>'score_max', '')::numeric,
        dim_row->>'summary',
        nullif(dim_row->>'weakness_level', '')::smallint
      );
    end loop;
  end if;

  if jsonb_typeof(sentences) = 'array' then
    for sent_row in select * from jsonb_array_elements(sentences)
    loop
      insert into public.sentence_feedback (
        submission_id, user_id, sentence_index,
        original_text, corrected_text, comment
      )
      values (
        new_submission_id,
        caller_id,
        (sent_row->>'sentence_index')::int,
        sent_row->>'original_text',
        sent_row->>'corrected_text',
        sent_row->>'comment'
      );
    end loop;
  end if;

  update public.writing_drafts
    set autosave_status = 'superseded',
        updated_at = now()
  where user_id = caller_id
    and problem_id = (submission->>'problem_id')::uuid
    and autosave_status <> 'superseded';

  return new_submission_id;
end;
$$;
-- grants unchanged: revoke from public + grant to authenticated were set in
-- Phase 5 migration. service_role grant intentionally NOT added (OOS-12).


-- =====================================================================
-- 8b. get_admin_org_dashboard — org_admin or platform_admin, SECURITY DEFINER
--     One-call dashboard payload: KPI + recent study_events (PII contract in client helper).
-- =====================================================================

create or replace function public.get_admin_org_dashboard()
returns table (
  learner_count int,
  active_7d_count int,
  submissions_7d_count int,
  recent_events jsonb
)
language plpgsql
security definer
set search_path = pg_catalog, public
stable
as $$
declare
  caller_id uuid := auth.uid();
begin
  if caller_id is null then raise exception 'unauthenticated'; end if;
  if not private.is_org_admin(caller_id) then
    raise exception 'forbidden: org_admin required';
  end if;

  return query
  select
    (select count(*)::int from public.profiles where app_role = 'learner') as learner_count,
    (select count(distinct user_id)::int from public.problem_attempts
       where started_at >= (now() - interval '7 days')) as active_7d_count,
    (select count(*)::int from public.writing_submissions
       where submitted_at >= (now() - interval '7 days')) as submissions_7d_count,
    (select coalesce(jsonb_agg(jsonb_build_object(
              'event_type', se.event_type,
              'occurred_at', se.occurred_at,
              'user_id', se.user_id,        -- intended: org_admin sees which learner
              'payload', se.payload         -- client helper MUST scrub raw writing content
            ) order by se.occurred_at desc), '[]'::jsonb)
       from (
         select * from public.study_events
         order by occurred_at desc
         limit 100
       ) se) as recent_events;
end;
$$;
revoke all on function public.get_admin_org_dashboard() from public;
grant execute on function public.get_admin_org_dashboard() to authenticated;
comment on function public.get_admin_org_dashboard() is
  'Org admin dashboard. KPI aggregates + 100 recent study_events. Rolling 168h semantics.';
