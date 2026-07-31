-- =====================================================================
-- TALKPIK AI · Conformance · 2026-06-02
-- Admin RPCs (X-08/X-10/H-01) + user-scoped list RPC (C-02)
--
-- All admin RPCs follow the Phase 6 convention (20260521140000):
--   - SECURITY DEFINER, set search_path = pg_catalog, public
--   - caller_id := auth.uid(); raise 'unauthenticated' if null
--   - guard with private.is_platform_admin / is_content_admin / is_org_admin
--   - mutations write public.admin_audit_logs
--       (admin_user_id, action, target_table, target_id, diff, payload)
--   - revoke all from public; grant execute to authenticated
--
-- auth.users assumption: readable inside SECURITY DEFINER (definer = postgres,
-- which owns/has access to the auth schema). get_admin_users / get_admin_user_stats
-- rely on this for email + last_sign_in_at.
--
-- list_user_problems is SECURITY INVOKER (default) so it runs in the caller's
-- RLS scope; auth.uid() identifies the caller for the attempt/solve join.
-- =====================================================================


-- =====================================================================
-- get_admin_users — platform_admin. Paginated user directory for X-10.
-- Returns per-user rows + a window total_count so the client can paginate.
-- sort: 'activity' (default) | 'created' | 'name'
-- =====================================================================
create or replace function public.get_admin_users(
  search    text default null,
  sort      text default 'activity',
  page      int  default 1,
  page_size int  default 20
)
returns table (
  user_id          uuid,
  email            text,
  display_name     text,
  app_role         text,
  plan_label       text,
  status           text,
  submission_count int,
  last_activity    timestamptz,
  last_sign_in_at  timestamptz,
  created_at       timestamptz,
  total_count      bigint
)
language plpgsql
security definer
set search_path = pg_catalog, public
stable
as $$
declare
  caller_id uuid := auth.uid();
  v_page    int  := greatest(coalesce(page, 1), 1);
  v_size    int  := least(greatest(coalesce(page_size, 20), 1), 100);
  v_offset  int;
  v_search  text := nullif(btrim(coalesce(search, '')), '');
begin
  if caller_id is null then raise exception 'unauthenticated'; end if;
  if not private.is_platform_admin(caller_id) then
    raise exception 'forbidden: platform_admin required';
  end if;
  v_offset := (v_page - 1) * v_size;

  return query
  with base as (
    select
      p.id              as user_id,
      u.email::text     as email,
      p.display_name    as display_name,
      p.app_role        as app_role,
      p.plan_label      as plan_label,
      p.status          as status,
      (select count(*)::int from public.writing_submissions ws
         where ws.user_id = p.id) as submission_count,
      (select max(se.occurred_at) from public.study_events se
         where se.user_id = p.id) as last_activity,
      u.last_sign_in_at as last_sign_in_at,
      p.created_at      as created_at
    from public.profiles p
    left join auth.users u on u.id = p.id
    where v_search is null
       or p.display_name ilike '%' || v_search || '%'
       or u.email ilike '%' || v_search || '%'
  ),
  counted as (
    select base.*, count(*) over () as total_count
    from base
  )
  select
    counted.user_id, counted.email, counted.display_name, counted.app_role,
    counted.plan_label, counted.status, counted.submission_count,
    counted.last_activity, counted.last_sign_in_at, counted.created_at,
    counted.total_count
  from counted
  order by
    case when sort = 'created'  then counted.created_at end desc nulls last,
    case when sort = 'name'     then counted.display_name end asc  nulls last,
    case when sort = 'activity' or sort is null
         then counted.last_activity end desc nulls last,
    counted.created_at desc
  limit v_size offset v_offset;
end;
$$;
revoke all on function public.get_admin_users(text, text, int, int) from public;
grant execute on function public.get_admin_users(text, text, int, int) to authenticated;
comment on function public.get_admin_users(text, text, int, int) is
  'Platform-admin user directory (X-10). Joins auth.users + profiles + submission_count + last_activity. Window total_count for pagination.';


-- =====================================================================
-- get_admin_user_stats — platform_admin. KPI band for X-10.
-- =====================================================================
create or replace function public.get_admin_user_stats()
returns table (
  total_users       int,
  active_users      int,
  blocked_users     int,
  total_submissions int
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
  if not private.is_platform_admin(caller_id) then
    raise exception 'forbidden: platform_admin required';
  end if;

  return query
  select
    (select count(*)::int from public.profiles)                              as total_users,
    (select count(*)::int from public.profiles where status = 'active')      as active_users,
    (select count(*)::int from public.profiles where status = 'blocked')     as blocked_users,
    (select count(*)::int from public.writing_submissions)                   as total_submissions;
end;
$$;
revoke all on function public.get_admin_user_stats() from public;
grant execute on function public.get_admin_user_stats() to authenticated;
comment on function public.get_admin_user_stats() is
  'Platform-admin KPI counts (X-10 band): total/active/blocked users + total submissions.';


-- =====================================================================
-- admin_set_user_status — platform_admin. Deactivate (not delete).
-- new_status in ('active','blocked'). Audited.
-- =====================================================================
create or replace function public.admin_set_user_status(
  target_id  uuid,
  new_status text
)
returns void
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  caller_id  uuid := auth.uid();
  old_status text;
begin
  if caller_id is null then raise exception 'unauthenticated'; end if;
  if not private.is_platform_admin(caller_id) then
    raise exception 'forbidden: platform_admin required';
  end if;
  if target_id is null then raise exception 'target_id required'; end if;
  if new_status not in ('active','blocked') then
    raise exception 'invalid new_status: %', new_status;
  end if;
  if target_id = caller_id then
    raise exception 'cannot change own status';
  end if;

  select status into old_status from public.profiles where id = target_id;
  if old_status is null then raise exception 'target user not found'; end if;
  if old_status = new_status then return; end if;

  -- The protect-columns trigger blocks status changes for non-admins, but it
  -- bypasses via private.is_admin(auth.uid()). Inside this SECURITY DEFINER RPC
  -- auth.uid() is still the calling platform_admin, so the trigger's admin
  -- bypass applies and the status update succeeds. (The guard above already
  -- enforced platform_admin.)
  update public.profiles set status = new_status where id = target_id;

  insert into public.admin_audit_logs (
    admin_user_id, action, target_table, target_id, diff, payload
  ) values (
    caller_id,
    'profile.status_change',
    'profiles',
    target_id::text,
    jsonb_build_object('from', old_status, 'to', new_status),
    jsonb_build_object('target_user_id', target_id)
  );
end;
$$;
revoke all on function public.admin_set_user_status(uuid, text) from public;
grant execute on function public.admin_set_user_status(uuid, text) to authenticated;
comment on function public.admin_set_user_status(uuid, text) is
  'Platform-admin only. Sets profiles.status active/blocked (deactivate-not-delete) + writes admin_audit_logs.';


-- =====================================================================
-- admin_update_problem — content_admin. Patches allowed columns, audited diff.
-- patch is a jsonb object of column -> new value. Unknown keys ignored.
-- =====================================================================
create or replace function public.admin_update_problem(
  problem_id uuid,
  patch      jsonb
)
returns void
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  caller_id uuid := auth.uid();
  old_row   public.problems%rowtype;
  v_diff    jsonb := '{}'::jsonb;
  k         text;
  allowed   text[] := array[
    'title','prompt','materials','answer_key','rubric','tags',
    'explanation','difficulty','visibility','review_status','publish_status'
  ];
begin
  if caller_id is null then raise exception 'unauthenticated'; end if;
  if not private.is_content_admin(caller_id) then
    raise exception 'forbidden: content_admin required';
  end if;
  if problem_id is null then raise exception 'problem_id required'; end if;
  if patch is null or jsonb_typeof(patch) <> 'object' then
    raise exception 'patch must be a json object';
  end if;

  select * into old_row from public.problems where id = problem_id;
  if not found then raise exception 'problem not found'; end if;

  -- Apply each allowed key explicitly (typed casts; avoids dynamic SQL).
  for k in select jsonb_object_keys(patch) loop
    if not (k = any(allowed)) then
      continue;  -- silently ignore unknown / protected keys
    end if;

    if k = 'title' then
      update public.problems set title = patch->>'title' where id = problem_id;
      v_diff := v_diff || jsonb_build_object('title',
                  jsonb_build_object('from', old_row.title, 'to', patch->>'title'));
    elsif k = 'prompt' then
      update public.problems set prompt = patch->>'prompt' where id = problem_id;
      v_diff := v_diff || jsonb_build_object('prompt',
                  jsonb_build_object('from', old_row.prompt, 'to', patch->>'prompt'));
    elsif k = 'materials' then
      update public.problems set materials = patch->'materials' where id = problem_id;
      v_diff := v_diff || jsonb_build_object('materials',
                  jsonb_build_object('from', old_row.materials, 'to', patch->'materials'));
    elsif k = 'answer_key' then
      update public.problems set answer_key = patch->'answer_key' where id = problem_id;
      v_diff := v_diff || jsonb_build_object('answer_key',
                  jsonb_build_object('from', old_row.answer_key, 'to', patch->'answer_key'));
    elsif k = 'rubric' then
      update public.problems set rubric = patch->'rubric' where id = problem_id;
      v_diff := v_diff || jsonb_build_object('rubric',
                  jsonb_build_object('from', old_row.rubric, 'to', patch->'rubric'));
    elsif k = 'tags' then
      update public.problems
        set tags = coalesce(
              (select array_agg(value::text)
                 from jsonb_array_elements_text(patch->'tags') as value),
              '{}')
        where id = problem_id;
      v_diff := v_diff || jsonb_build_object('tags',
                  jsonb_build_object('from', to_jsonb(old_row.tags), 'to', patch->'tags'));
    elsif k = 'explanation' then
      update public.problems set explanation = patch->>'explanation' where id = problem_id;
      v_diff := v_diff || jsonb_build_object('explanation',
                  jsonb_build_object('from', old_row.explanation, 'to', patch->>'explanation'));
    elsif k = 'difficulty' then
      update public.problems
        set difficulty = nullif(patch->>'difficulty','')::smallint where id = problem_id;
      v_diff := v_diff || jsonb_build_object('difficulty',
                  jsonb_build_object('from', old_row.difficulty, 'to', patch->>'difficulty'));
    elsif k = 'visibility' then
      update public.problems set visibility = patch->>'visibility' where id = problem_id;
      v_diff := v_diff || jsonb_build_object('visibility',
                  jsonb_build_object('from', old_row.visibility, 'to', patch->>'visibility'));
    elsif k = 'review_status' then
      update public.problems set review_status = patch->>'review_status' where id = problem_id;
      v_diff := v_diff || jsonb_build_object('review_status',
                  jsonb_build_object('from', old_row.review_status, 'to', patch->>'review_status'));
    elsif k = 'publish_status' then
      update public.problems set publish_status = patch->>'publish_status' where id = problem_id;
      v_diff := v_diff || jsonb_build_object('publish_status',
                  jsonb_build_object('from', old_row.publish_status, 'to', patch->>'publish_status'));
    end if;
  end loop;

  if v_diff = '{}'::jsonb then
    return;  -- nothing changed -> no audit row
  end if;

  insert into public.admin_audit_logs (
    admin_user_id, action, target_table, target_id, diff, payload
  ) values (
    caller_id,
    'problem.update',
    'problems',
    problem_id::text,
    v_diff,
    '{}'::jsonb
  );
end;
$$;
revoke all on function public.admin_update_problem(uuid, jsonb) from public;
grant execute on function public.admin_update_problem(uuid, jsonb) to authenticated;
comment on function public.admin_update_problem(uuid, jsonb) is
  'Content-admin only. Patches allowlisted problem columns from jsonb + writes admin_audit_logs with a diff. Unknown keys ignored.';


-- =====================================================================
-- admin_delete_problem — content_admin / platform_admin. Audited.
-- =====================================================================
create or replace function public.admin_delete_problem(
  problem_id uuid
)
returns void
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  caller_id uuid := auth.uid();
  old_row   public.problems%rowtype;
begin
  if caller_id is null then raise exception 'unauthenticated'; end if;
  if not private.is_content_admin(caller_id) then
    raise exception 'forbidden: content_admin required';
  end if;
  if problem_id is null then raise exception 'problem_id required'; end if;

  select * into old_row from public.problems where id = problem_id;
  if not found then raise exception 'problem not found'; end if;

  insert into public.admin_audit_logs (
    admin_user_id, action, target_table, target_id, diff, payload
  ) values (
    caller_id,
    'problem.delete',
    'problems',
    problem_id::text,
    null,
    jsonb_build_object(
      'title', old_row.title,
      'domain', old_row.domain,
      'publish_status', old_row.publish_status
    )
  );

  delete from public.problems where id = problem_id;
end;
$$;
revoke all on function public.admin_delete_problem(uuid) from public;
grant execute on function public.admin_delete_problem(uuid) to authenticated;
comment on function public.admin_delete_problem(uuid) is
  'Content/platform admin only. Deletes a problem + writes admin_audit_logs (snapshot in payload). Audit row written before delete.';


-- =====================================================================
-- admin_add_problem_asset / admin_remove_problem_asset — content_admin. Audited.
-- =====================================================================
create or replace function public.admin_add_problem_asset(
  problem_id   uuid,
  storage_path text,
  asset_type   text,
  sort_order   int default 0
)
returns uuid
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  caller_id uuid := auth.uid();
  new_id    uuid;
begin
  if caller_id is null then raise exception 'unauthenticated'; end if;
  if not private.is_content_admin(caller_id) then
    raise exception 'forbidden: content_admin required';
  end if;
  if problem_id is null or storage_path is null then
    raise exception 'problem_id and storage_path required';
  end if;
  if asset_type not in ('image','audio') then
    raise exception 'invalid asset_type: %', asset_type;
  end if;
  if not exists (select 1 from public.problems where id = problem_id) then
    raise exception 'problem not found';
  end if;

  insert into public.problem_assets (problem_id, storage_path, asset_type, sort_order)
  values (problem_id, storage_path, asset_type, coalesce(sort_order, 0))
  returning id into new_id;

  insert into public.admin_audit_logs (
    admin_user_id, action, target_table, target_id, diff, payload
  ) values (
    caller_id,
    'problem_asset.add',
    'problem_assets',
    new_id::text,
    null,
    jsonb_build_object(
      'problem_id', problem_id,
      'storage_path', storage_path,
      'asset_type', asset_type,
      'sort_order', coalesce(sort_order, 0)
    )
  );

  return new_id;
end;
$$;
revoke all on function public.admin_add_problem_asset(uuid, text, text, int) from public;
grant execute on function public.admin_add_problem_asset(uuid, text, text, int) to authenticated;
comment on function public.admin_add_problem_asset(uuid, text, text, int) is
  'Content-admin only. Inserts a problem_assets row + writes admin_audit_logs. Returns new asset id.';


create or replace function public.admin_remove_problem_asset(
  asset_id uuid
)
returns void
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  caller_id uuid := auth.uid();
  old_row   public.problem_assets%rowtype;
begin
  if caller_id is null then raise exception 'unauthenticated'; end if;
  if not private.is_content_admin(caller_id) then
    raise exception 'forbidden: content_admin required';
  end if;
  if asset_id is null then raise exception 'asset_id required'; end if;

  select * into old_row from public.problem_assets where id = asset_id;
  if not found then raise exception 'asset not found'; end if;

  insert into public.admin_audit_logs (
    admin_user_id, action, target_table, target_id, diff, payload
  ) values (
    caller_id,
    'problem_asset.remove',
    'problem_assets',
    asset_id::text,
    null,
    jsonb_build_object(
      'problem_id', old_row.problem_id,
      'storage_path', old_row.storage_path,
      'asset_type', old_row.asset_type
    )
  );

  delete from public.problem_assets where id = asset_id;
end;
$$;
revoke all on function public.admin_remove_problem_asset(uuid) from public;
grant execute on function public.admin_remove_problem_asset(uuid) to authenticated;
comment on function public.admin_remove_problem_asset(uuid) is
  'Content-admin only. Deletes a problem_assets row + writes admin_audit_logs (snapshot in payload).';


-- =====================================================================
-- get_admin_audit_logs — admin. Recent audit rows for H-01/X-08/X-10.
-- Any admin (content/org/platform) may read; mirrors admin_audit_logs RLS
-- (private.is_admin = content_admin OR platform_admin) but also allows
-- org_admin via is_org_admin for the org dashboards.
-- =====================================================================
create or replace function public.get_admin_audit_logs(
  p_target_id  uuid default null,
  row_limit    int  default 50
)
returns table (
  id            uuid,
  admin_user_id uuid,
  action        text,
  target_table  text,
  target_id     text,
  diff          jsonb,
  payload       jsonb,
  created_at    timestamptz
)
language plpgsql
security definer
set search_path = pg_catalog, public
stable
as $$
declare
  caller_id uuid := auth.uid();
  v_limit   int  := least(greatest(coalesce(row_limit, 50), 1), 200);
  v_target  text := p_target_id::text;  -- null-safe; null target -> all
begin
  if caller_id is null then raise exception 'unauthenticated'; end if;
  if not (private.is_content_admin(caller_id)
          or private.is_org_admin(caller_id)
          or private.is_platform_admin(caller_id)) then
    raise exception 'forbidden: admin required';
  end if;

  -- v_target is a local variable (unambiguous; no column is named v_target).
  return query
  select
    al.id, al.admin_user_id, al.action, al.target_table,
    al.target_id, al.diff, al.payload, al.created_at
  from public.admin_audit_logs al
  where v_target is null
     or al.target_id = v_target
  order by al.created_at desc
  limit v_limit;
end;
$$;
revoke all on function public.get_admin_audit_logs(uuid, int) from public;
grant execute on function public.get_admin_audit_logs(uuid, int) to authenticated;
comment on function public.get_admin_audit_logs(uuid, int) is
  'Admin-readable recent admin_audit_logs (H-01/X-08/X-10). Optional target_id filter. content/org/platform admin only.';


-- =====================================================================
-- get_admin_org_dashboard — EXTENDED (additive, backward-compatible).
-- Phase 6 returned: learner_count, active_7d_count, submissions_7d_count,
-- recent_events. We ADD a 4th KPI avg_writing_score + per_user rows for
-- X-08 region 4. Existing 4 columns keep their position/semantics; new
-- columns are appended so existing positional/by-name readers are unaffected.
--
-- NB: Postgres forbids changing a function's RETURNS TABLE column set via
-- CREATE OR REPLACE ("cannot change return type of existing function"). The
-- existing definition returns 4 columns; we are going to 6. So we DROP first,
-- then recreate. Drop is idempotent. Any client calling this between drop and
-- recreate within the same migration transaction is not a concern (DDL is
-- transactional in Postgres / Supabase migrations run in a transaction).
-- =====================================================================
drop function if exists public.get_admin_org_dashboard();
create or replace function public.get_admin_org_dashboard()
returns table (
  learner_count        int,
  active_7d_count      int,
  submissions_7d_count int,
  recent_events        jsonb,
  avg_writing_score    numeric,
  per_user             jsonb
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
              'user_id', se.user_id,
              'payload', se.payload
            ) order by se.occurred_at desc), '[]'::jsonb)
       from (
         select * from public.study_events
         order by occurred_at desc
         limit 100
       ) se) as recent_events,
    -- NEW KPI: average writing_feedback.score_total across all feedback rows.
    (select round(avg(wf.score_total), 2) from public.writing_feedback wf
       where wf.score_total is not null) as avg_writing_score,
    -- NEW: per-learner rows for X-08 region 4.
    (select coalesce(
              jsonb_agg(
                jsonb_build_object(
                  'learner_id',       u.learner_id,
                  'display_name',     u.display_name,
                  'submission_count', u.submission_count,
                  'avg_score',        u.avg_score,
                  'last_activity',    u.last_activity
                )
                order by u.last_activity desc nulls last
              ),
              '[]'::jsonb)
       from (
         select
           p.id                                   as learner_id,
           p.display_name                         as display_name,
           (select count(*)::int from public.writing_submissions ws
              where ws.user_id = p.id)            as submission_count,
           (select round(avg(wf2.score_total), 2) from public.writing_feedback wf2
              where wf2.user_id = p.id and wf2.score_total is not null) as avg_score,
           (select max(se2.occurred_at) from public.study_events se2
              where se2.user_id = p.id)           as last_activity
         from public.profiles p
         where p.app_role = 'learner'
         order by last_activity desc nulls last
         limit 200
       ) u) as per_user;
end;
$$;
revoke all on function public.get_admin_org_dashboard() from public;
grant execute on function public.get_admin_org_dashboard() to authenticated;
comment on function public.get_admin_org_dashboard() is
  'Org/platform admin dashboard. Phase 6 KPI (learner/active7d/submissions7d/recent_events) + ADDED avg_writing_score KPI + per_user rows (X-08 region 4). Additive: original 4 columns unchanged.';


-- =====================================================================
-- list_user_problems — C-02 accurate filtered pagination.
-- SECURITY INVOKER (default): runs in caller RLS scope. auth.uid() is the
-- caller. Returns the user-visible problem list joined with the caller's
-- attempt/solve status + an accurate window total for the filtered set.
--
-- filter jsonb keys (all optional):
--   domain         text   -> problems.domain
--   topik_level    int    -> problems.topik_level
--   question_no    int    -> problems.question_no
--   difficulty     int    -> problems.difficulty
--   status         text   -> 'solved' | 'attempted' | 'unattempted'
--   search         text   -> ILIKE on title
-- sort: 'recent' (default, created_at desc) | 'difficulty'
-- =====================================================================
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
  total_count    bigint
)
language plpgsql
-- SECURITY INVOKER (default): runs in caller RLS scope. search_path pinned for
-- safety even though all objects below are schema-qualified.
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
    -- RLS on problems already restricts to caller-visible rows because this
    -- function is SECURITY INVOKER. The predicate below is a harmless mirror
    -- that also lets the filter narrow the set.
    select p.*
    from public.problems p
    where (f_domain is null or p.domain = f_domain)
      and (f_level  is null or p.topik_level = f_level)
      and (f_qno    is null or p.question_no = f_qno)
      and (f_diff   is null or p.difficulty = f_diff)
      and (f_search is null or p.title ilike '%' || f_search || '%')
  ),
  with_status as (
    select
      v.*,
      (select count(*)::int from public.problem_attempts a
         where a.problem_id = v.id and a.user_id = caller_id) as attempt_count,
      exists (
        select 1 from public.problem_attempts a
        where a.problem_id = v.id and a.user_id = caller_id and a.is_correct = true
      ) as is_solved,
      (select max(a.started_at) from public.problem_attempts a
         where a.problem_id = v.id and a.user_id = caller_id) as last_attempt_at
    from visible v
  ),
  filtered as (
    select * from with_status ws
    where f_status is null
       or (f_status = 'solved'      and ws.is_solved)
       or (f_status = 'attempted'   and ws.attempt_count > 0)
       or (f_status = 'unattempted' and ws.attempt_count = 0)
  ),
  counted as (
    select filtered.*, count(*) over () as total_count
    from filtered
  )
  select
    counted.id, counted.title, counted.domain, counted.topik_level,
    counted.question_no, counted.difficulty, counted.tags,
    counted.attempt_count, counted.is_solved, counted.last_attempt_at,
    counted.created_at, counted.total_count
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
  'C-02 accurate filtered pagination. SECURITY INVOKER (caller RLS scope). Joins caller attempt/solve status + window total_count. filter jsonb: domain/topik_level/question_no/difficulty/status/search.';
