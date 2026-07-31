-- =============================================================================
-- User JWT hardening: canonical consent writes, deleted-account fail-close,
-- protected account deletion, and private avatar access.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. Consent snapshots are written only by complete_auth_gate().
-- -----------------------------------------------------------------------------
revoke insert on table public.user_consents from authenticated;

drop policy if exists user_consents_owner_insert on public.user_consents;
drop policy if exists user_consents_no_direct_insert on public.user_consents;
create policy user_consents_no_direct_insert
  on public.user_consents
  for insert to authenticated
  with check (false);

-- -----------------------------------------------------------------------------
-- 2. Active-account predicate.
--
-- This function is kept in the non-exposed private schema. It accepts no user
-- input and reveals only whether the current JWT owner has an active profile.
-- SECURITY DEFINER is required so the profiles policy can evaluate without
-- recursive RLS. PostgREST exposes public, not private, so this is not a public
-- RPC even though authenticated needs EXECUTE for policy evaluation.
-- -----------------------------------------------------------------------------
create or replace function private.is_active_user()
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public
as $$
  select exists (
    select 1
    from public.profiles
    where id = auth.uid()
      and status = 'active'
  );
$$;

revoke all on function private.is_active_user() from public, anon;
grant execute on function private.is_active_user() to authenticated;

comment on function private.is_active_user() is
  'RLS-only predicate. True when the current JWT owner has an active profile; '
  'kept in the non-exposed private schema.';

create or replace function private.assert_active_user()
returns void
language plpgsql
stable
security definer
set search_path = pg_catalog, public, private
as $$
begin
  if auth.uid() is null then
    raise exception 'unauthenticated' using errcode = '42501';
  end if;

  if not private.is_active_user() then
    raise exception 'account_inactive' using errcode = '42501';
  end if;
end;
$$;

revoke all on function private.assert_active_user() from public, anon, authenticated;

comment on function private.assert_active_user() is
  'SECURITY DEFINER RPC entry guard. Rejects missing, blocked, or deleted JWT owners.';

-- Restrictive policies are AND-ed with each table's existing ownership policy.
-- Public catalog/content tables intentionally remain readable after deletion;
-- only private user/account rows are fail-closed here.
drop policy if exists active_account_only on public.profiles;
create policy active_account_only on public.profiles
  as restrictive for all to authenticated
  using ((select private.is_active_user()))
  with check ((select private.is_active_user()));

drop policy if exists active_account_only on public.learning_goals;
create policy active_account_only on public.learning_goals
  as restrictive for all to authenticated
  using ((select private.is_active_user()))
  with check ((select private.is_active_user()));

drop policy if exists active_account_only on public.problem_attempts;
create policy active_account_only on public.problem_attempts
  as restrictive for all to authenticated
  using ((select private.is_active_user()))
  with check ((select private.is_active_user()));

drop policy if exists active_account_only on public.writing_drafts;
create policy active_account_only on public.writing_drafts
  as restrictive for all to authenticated
  using ((select private.is_active_user()))
  with check ((select private.is_active_user()));

drop policy if exists active_account_only on public.writing_submissions;
create policy active_account_only on public.writing_submissions
  as restrictive for all to authenticated
  using ((select private.is_active_user()))
  with check ((select private.is_active_user()));

drop policy if exists active_account_only on public.writing_feedback;
create policy active_account_only on public.writing_feedback
  as restrictive for all to authenticated
  using ((select private.is_active_user()))
  with check ((select private.is_active_user()));

drop policy if exists active_account_only on public.feedback_dimension_scores;
create policy active_account_only on public.feedback_dimension_scores
  as restrictive for all to authenticated
  using ((select private.is_active_user()))
  with check ((select private.is_active_user()));

drop policy if exists active_account_only on public.sentence_feedback;
create policy active_account_only on public.sentence_feedback
  as restrictive for all to authenticated
  using ((select private.is_active_user()))
  with check ((select private.is_active_user()));

drop policy if exists active_account_only on public.comparison_reports;
create policy active_account_only on public.comparison_reports
  as restrictive for all to authenticated
  using ((select private.is_active_user()))
  with check ((select private.is_active_user()));

drop policy if exists active_account_only on public.recommendation_runs;
create policy active_account_only on public.recommendation_runs
  as restrictive for all to authenticated
  using ((select private.is_active_user()))
  with check ((select private.is_active_user()));

drop policy if exists active_account_only on public.recommendation_items;
create policy active_account_only on public.recommendation_items
  as restrictive for all to authenticated
  using ((select private.is_active_user()))
  with check ((select private.is_active_user()));

drop policy if exists active_account_only on public.library_items;
create policy active_account_only on public.library_items
  as restrictive for all to authenticated
  using ((select private.is_active_user()))
  with check ((select private.is_active_user()));

drop policy if exists active_account_only on public.study_events;
create policy active_account_only on public.study_events
  as restrictive for all to authenticated
  using ((select private.is_active_user()))
  with check ((select private.is_active_user()));

drop policy if exists active_account_only on public.export_files;
create policy active_account_only on public.export_files
  as restrictive for all to authenticated
  using ((select private.is_active_user()))
  with check ((select private.is_active_user()));

drop policy if exists active_account_only on public.subscriptions;
create policy active_account_only on public.subscriptions
  as restrictive for all to authenticated
  using ((select private.is_active_user()))
  with check ((select private.is_active_user()));

drop policy if exists active_account_only on public.payment_history;
create policy active_account_only on public.payment_history
  as restrictive for all to authenticated
  using ((select private.is_active_user()))
  with check ((select private.is_active_user()));

drop policy if exists active_account_only on public.notification_settings;
create policy active_account_only on public.notification_settings
  as restrictive for all to authenticated
  using ((select private.is_active_user()))
  with check ((select private.is_active_user()));

drop policy if exists active_account_only on public.notification_log;
create policy active_account_only on public.notification_log
  as restrictive for all to authenticated
  using ((select private.is_active_user()))
  with check ((select private.is_active_user()));

drop policy if exists active_account_only on public.user_consents;
create policy active_account_only on public.user_consents
  as restrictive for all to authenticated
  using ((select private.is_active_user()))
  with check ((select private.is_active_user()));

drop policy if exists active_account_only on public.user_notifications;
create policy active_account_only on public.user_notifications
  as restrictive for all to authenticated
  using ((select private.is_active_user()))
  with check ((select private.is_active_user()));

drop policy if exists active_account_only on public.user_marketing_consent;
create policy active_account_only on public.user_marketing_consent
  as restrictive for all to authenticated
  using ((select private.is_active_user()))
  with check ((select private.is_active_user()));

drop policy if exists active_account_only on public.pdf_export_quota_usages;
create policy active_account_only on public.pdf_export_quota_usages
  as restrictive for all to authenticated
  using ((select private.is_active_user()))
  with check ((select private.is_active_user()));

drop policy if exists active_account_only on public.pdf_export_quota_resets;
create policy active_account_only on public.pdf_export_quota_resets
  as restrictive for all to authenticated
  using ((select private.is_active_user()))
  with check ((select private.is_active_user()));

drop policy if exists active_account_only on public.pdf_export_quota_reset_targets;
create policy active_account_only on public.pdf_export_quota_reset_targets
  as restrictive for all to authenticated
  using ((select private.is_active_user()))
  with check ((select private.is_active_user()));

drop policy if exists active_account_only on public.writing_submission_metrics;
create policy active_account_only on public.writing_submission_metrics
  as restrictive for all to authenticated
  using ((select private.is_active_user()))
  with check ((select private.is_active_user()));

-- Public published catalog rows remain readable after account deletion. All
-- caller-private catalog paths and every catalog mutation still require an
-- active profile.
drop policy if exists problems_active_or_public_select on public.problems;
create policy problems_active_or_public_select on public.problems
  as restrictive for select to authenticated
  using (
    (
      publish_status = 'published'
      and visibility = 'public'
    )
    or (select private.is_active_user())
  );

drop policy if exists problems_active_insert on public.problems;
create policy problems_active_insert on public.problems
  as restrictive for insert to authenticated
  with check ((select private.is_active_user()));

drop policy if exists problems_active_update on public.problems;
create policy problems_active_update on public.problems
  as restrictive for update to authenticated
  using ((select private.is_active_user()))
  with check ((select private.is_active_user()));

drop policy if exists problems_active_delete on public.problems;
create policy problems_active_delete on public.problems
  as restrictive for delete to authenticated
  using ((select private.is_active_user()));

drop policy if exists problem_assets_active_or_public_select on public.problem_assets;
create policy problem_assets_active_or_public_select on public.problem_assets
  as restrictive for select to authenticated
  using (
    exists (
      select 1
      from public.problems problem
      where problem.id = problem_assets.problem_id
        and problem.publish_status = 'published'
        and problem.visibility = 'public'
    )
    or (select private.is_active_user())
  );

drop policy if exists problem_assets_active_insert on public.problem_assets;
create policy problem_assets_active_insert on public.problem_assets
  as restrictive for insert to authenticated
  with check ((select private.is_active_user()));

drop policy if exists problem_assets_active_update on public.problem_assets;
create policy problem_assets_active_update on public.problem_assets
  as restrictive for update to authenticated
  using ((select private.is_active_user()))
  with check ((select private.is_active_user()));

drop policy if exists problem_assets_active_delete on public.problem_assets;
create policy problem_assets_active_delete on public.problem_assets
  as restrictive for delete to authenticated
  using ((select private.is_active_user()));

-- -----------------------------------------------------------------------------
-- 3. status/deleted_at are RPC-only, including for authenticated admin JWTs.
--
-- PostgreSQL column privileges are the direct boundary. The trigger is an
-- additional invariant: only the owner context of the lifecycle RPC may issue
-- the protected UPDATE. A caller-controlled custom GUC is not authorization.
-- -----------------------------------------------------------------------------
revoke update on table public.profiles from authenticated;
grant update (
  display_name,
  gender,
  nationality_country_code,
  nickname,
  phone_country_code,
  phone_number,
  phone_number_prompt_dismissed_at,
  avatar_path,
  ui_locale,
  ui_locale_source,
  notification_prefs,
  learning_locale,
  content_prefs,
  bio
) on table public.profiles to authenticated;

create or replace function private.protect_profile_columns()
returns trigger
language plpgsql
security invoker
set search_path = public, pg_catalog
as $$
begin
  if (
    new.status is distinct from old.status
    or new.deleted_at is distinct from old.deleted_at
  ) and current_user <> pg_get_userbyid(
    (
      select routine.proowner
      from pg_proc routine
      where routine.oid = 'public.request_account_deletion()'::regprocedure
    )
  ) then
    raise exception
      'profiles.status and profiles.deleted_at can only be changed by account lifecycle RPCs'
      using errcode = '42501';
  end if;

  if private.is_admin((select auth.uid())) then
    return new;
  end if;

  if new.app_role is distinct from old.app_role then
    raise exception
      'profiles.app_role can only be changed by admins'
      using errcode = '42501';
  end if;

  if new.plan_label is distinct from old.plan_label then
    raise exception
      'profiles.plan_label can only be changed by admins or billing service'
      using errcode = '42501';
  end if;

  if new.affiliation_code is distinct from old.affiliation_code
     and current_setting('app.claim_affiliation_code', true) is distinct from '1' then
    raise exception
      'profiles.affiliation_code can only be changed by claim_affiliation_code'
      using errcode = '42501';
  end if;

  return new;
end;
$$;

revoke all on function private.protect_profile_columns() from public;

create or replace function public.request_account_deletion()
returns void
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  caller_id uuid := auth.uid();
  current_status text;
  current_deleted_at timestamptz;
begin
  if caller_id is null then
    raise exception 'unauthenticated' using errcode = '42501';
  end if;

  select status, deleted_at
    into current_status, current_deleted_at
  from public.profiles
  where id = caller_id
  for update;

  if not found then
    raise exception 'profile not found' using errcode = 'P0002';
  end if;

  if current_status = 'deleted' then
    return;
  end if;

  if current_status <> 'active' or current_deleted_at is not null then
    raise exception 'account is not active' using errcode = '42501';
  end if;

  update public.profiles
     set status = 'deleted',
         deleted_at = now()
   where id = caller_id
     and status = 'active'
     and deleted_at is null;
end;
$$;

revoke all on function public.request_account_deletion() from public, anon;
grant execute on function public.request_account_deletion() to authenticated;

-- The caller can read only its own status even after ordinary profile RLS has
-- fail-closed. No timestamp, role, plan, or profile data is returned.
create or replace function public.get_my_account_state()
returns text
language plpgsql
stable
security definer
set search_path = pg_catalog, public
as $$
declare
  caller_id uuid := auth.uid();
  account_status text;
begin
  if caller_id is null then
    raise exception 'unauthenticated' using errcode = '42501';
  end if;

  select status
    into account_status
  from public.profiles
  where id = caller_id;

  return account_status;
end;
$$;

revoke all on function public.get_my_account_state() from public, anon;
grant execute on function public.get_my_account_state() to authenticated;

comment on function public.get_my_account_state() is
  'Returns only the current JWT owner profile status, including after private '
  'profile RLS fail-closes. Authenticated only.';

-- -----------------------------------------------------------------------------
-- 4. SECURITY DEFINER user-data RPCs fail closed for stale deleted-user JWTs.
--
-- Keep the audited implementation byte-for-byte by moving it to private and
-- exposing a narrow public wrapper whose first executable statement is the
-- shared active-account assertion.
-- -----------------------------------------------------------------------------
alter function public.get_dashboard_kpi() set schema private;
alter function private.get_dashboard_kpi() rename to get_dashboard_kpi_unchecked;
revoke all on function private.get_dashboard_kpi_unchecked()
  from public, anon, authenticated, service_role;

create or replace function public.get_dashboard_kpi()
returns table (
  today_attempts int,
  total_attempts int,
  exam_days_left int,
  streak_days int
)
language plpgsql
stable
security definer
set search_path = pg_catalog, public, private
as $$
begin
  perform private.assert_active_user();
  return query
    select * from private.get_dashboard_kpi_unchecked();
end;
$$;

revoke all on function public.get_dashboard_kpi() from public, anon;
grant execute on function public.get_dashboard_kpi() to authenticated;

alter function public.get_writing_submission_history_context(uuid[])
  set schema private;
alter function private.get_writing_submission_history_context(uuid[])
  rename to get_writing_submission_history_context_unchecked;
revoke all on function private.get_writing_submission_history_context_unchecked(uuid[])
  from public, anon, authenticated, service_role;

create or replace function public.get_writing_submission_history_context(
  p_submission_ids uuid[]
)
returns table (
  submission_id uuid,
  problem_id uuid,
  question_no smallint,
  title text
)
language plpgsql
stable
security definer
set search_path = pg_catalog, public, private
as $$
begin
  perform private.assert_active_user();
  return query
    select *
    from private.get_writing_submission_history_context_unchecked(
      p_submission_ids
    );
end;
$$;

revoke all on function public.get_writing_submission_history_context(uuid[])
  from public, anon;
grant execute on function public.get_writing_submission_history_context(uuid[])
  to authenticated;

alter function public.replace_stale_writing_draft(uuid, text, bigint, text)
  set schema private;
alter function private.replace_stale_writing_draft(uuid, text, bigint, text)
  rename to replace_stale_writing_draft_unchecked;
revoke all on function private.replace_stale_writing_draft_unchecked(
  uuid,
  text,
  bigint,
  text
) from public, anon, authenticated, service_role;

create or replace function public.replace_stale_writing_draft(
  p_draft_id uuid,
  p_current_question_id text,
  p_current_import_id bigint,
  p_current_payload_hash text
)
returns uuid
language plpgsql
security definer
set search_path = pg_catalog, public, private
as $$
begin
  perform private.assert_active_user();
  return private.replace_stale_writing_draft_unchecked(
    p_draft_id,
    p_current_question_id,
    p_current_import_id,
    p_current_payload_hash
  );
end;
$$;

revoke all on function public.replace_stale_writing_draft(
  uuid,
  text,
  bigint,
  text
) from public, anon;
grant execute on function public.replace_stale_writing_draft(
  uuid,
  text,
  bigint,
  text
) to authenticated;

alter function public.create_comparison_report_with_metrics(
  uuid,
  uuid,
  jsonb,
  text,
  text
) set schema private;
alter function private.create_comparison_report_with_metrics(
  uuid,
  uuid,
  jsonb,
  text,
  text
) rename to create_comparison_report_with_metrics_unchecked;
revoke all on function private.create_comparison_report_with_metrics_unchecked(
  uuid,
  uuid,
  jsonb,
  text,
  text
) from public, anon, authenticated, service_role;

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
set search_path = pg_catalog, public, private
as $$
begin
  perform private.assert_active_user();
  return private.create_comparison_report_with_metrics_unchecked(
    current_id,
    previous_id,
    metrics,
    narrative,
    ai_model
  );
end;
$$;

revoke all on function public.create_comparison_report_with_metrics(
  uuid,
  uuid,
  jsonb,
  text,
  text
) from public, anon;
grant execute on function public.create_comparison_report_with_metrics(
  uuid,
  uuid,
  jsonb,
  text,
  text
) to authenticated;

alter function public.claim_pdf_export_quota(uuid, uuid[]) set schema private;
alter function private.claim_pdf_export_quota(uuid, uuid[])
  rename to claim_pdf_export_quota_unchecked;
revoke all on function private.claim_pdf_export_quota_unchecked(uuid, uuid[])
  from public, anon, authenticated, service_role;

create or replace function public.claim_pdf_export_quota(
  p_user_id uuid,
  p_problem_ids uuid[]
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, private
as $$
begin
  perform private.assert_active_user();
  return private.claim_pdf_export_quota_unchecked(p_user_id, p_problem_ids);
end;
$$;

revoke all on function public.claim_pdf_export_quota(uuid, uuid[])
  from public, anon;
grant execute on function public.claim_pdf_export_quota(uuid, uuid[])
  to authenticated;

alter function public.is_nickname_available(text) set schema private;
alter function private.is_nickname_available(text)
  rename to is_nickname_available_unchecked;
revoke all on function private.is_nickname_available_unchecked(text)
  from public, anon, authenticated, service_role;

create or replace function public.is_nickname_available(candidate text)
returns boolean
language plpgsql
stable
security definer
set search_path = pg_catalog, public, private
as $$
begin
  perform private.assert_active_user();
  return private.is_nickname_available_unchecked(candidate);
end;
$$;

revoke all on function public.is_nickname_available(text) from public, anon;
grant execute on function public.is_nickname_available(text) to authenticated;

alter function public.list_user_library_problem_items() set schema private;
alter function private.list_user_library_problem_items()
  rename to list_user_library_problem_items_unchecked;
revoke all on function private.list_user_library_problem_items_unchecked()
  from public, anon, authenticated, service_role;

create or replace function public.list_user_library_problem_items()
returns table (
  item_id uuid,
  problem_id uuid,
  title text,
  question_no smallint,
  answer_text text,
  tags text[],
  saved_at timestamptz,
  availability_status text,
  availability_reason text,
  can_retry boolean
)
language plpgsql
security definer
set search_path = pg_catalog, public, private
as $$
begin
  perform private.assert_active_user();
  return query
    select *
    from private.list_user_library_problem_items_unchecked();
end;
$$;

revoke all on function public.list_user_library_problem_items()
  from public, anon;
grant execute on function public.list_user_library_problem_items()
  to authenticated;

-- This legacy submit endpoint still had grants even though its post-cutover
-- helper was removed. It is not part of the v13 canonical write path.
revoke execute on function public.submit_writing_with_feedback(jsonb, jsonb, jsonb, jsonb)
  from authenticated;
revoke execute on function public.submit_writing_with_feedback(
  jsonb,
  jsonb,
  jsonb,
  jsonb
) from public, anon;

-- -----------------------------------------------------------------------------
-- 5. Storage: avatars become private and both private buckets require an active
-- user plus the existing owner path checks.
-- -----------------------------------------------------------------------------
update storage.buckets
   set public = false
 where id = 'avatars';

drop policy if exists avatars_public_read on storage.objects;
drop policy if exists avatars_owner_select on storage.objects;
create policy avatars_owner_select
  on storage.objects
  for select to authenticated
  using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = (select auth.uid())::text
    and (select private.is_active_user())
  );

drop policy if exists avatars_owner_insert on storage.objects;
create policy avatars_owner_insert
  on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = (select auth.uid())::text
    and (select private.is_active_user())
    and private.is_email_confirmed((select auth.uid()))
  );

drop policy if exists avatars_owner_update on storage.objects;
create policy avatars_owner_update
  on storage.objects
  for update to authenticated
  using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = (select auth.uid())::text
    and (select private.is_active_user())
  )
  with check (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = (select auth.uid())::text
    and (select private.is_active_user())
    and private.is_email_confirmed((select auth.uid()))
  );

drop policy if exists avatars_owner_delete on storage.objects;
create policy avatars_owner_delete
  on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = (select auth.uid())::text
    and (select private.is_active_user())
  );

drop policy if exists exports_owner_select on storage.objects;
create policy exports_owner_select
  on storage.objects
  for select to authenticated
  using (
    bucket_id = 'generated-exports'
    and (storage.foldername(name))[1] = 'exports'
    and (storage.foldername(name))[2] = (select auth.uid())::text
    and (select private.is_active_user())
  );

drop policy if exists exports_owner_insert on storage.objects;
create policy exports_owner_insert
  on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'generated-exports'
    and (storage.foldername(name))[1] = 'exports'
    and (storage.foldername(name))[2] = (select auth.uid())::text
    and (select private.is_active_user())
    and private.is_email_confirmed((select auth.uid()))
  );

drop policy if exists exports_owner_delete on storage.objects;
create policy exports_owner_delete
  on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'generated-exports'
    and (storage.foldername(name))[1] = 'exports'
    and (storage.foldername(name))[2] = (select auth.uid())::text
    and (select private.is_active_user())
  );
