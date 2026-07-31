-- =====================================================================
-- PDF export request identity and retry-safe quota reservations
--
-- User JWT remains the authority for acquisition and quota claim. The
-- service role remains limited to terminal commit/release after ownership
-- checks.
-- Remote rollout must quiesce PDF requests, drain legacy workers, and deploy
-- this migration with the matching app version in one maintenance window.
-- Forward-only: v13 does not apply this migration remotely.
-- =====================================================================

alter table public.export_files
  add column if not exists request_id uuid,
  add column if not exists attempt_id uuid,
  add column if not exists lease_expires_at timestamptz;

update public.export_files
set status = 'failed',
    failure_code = 'legacy_unknown',
    failed_at = coalesce(failed_at, now()),
    ready_at = null,
    attempt_id = null,
    lease_expires_at = null
where request_id is null
  and status = 'queued';

create unique index if not exists export_files_user_request_uniq
  on public.export_files (user_id, request_id)
  where request_id is not null;

comment on column public.export_files.request_id is
  'Client-generated idempotency UUID. New PDF routes require it; historical rows may be null.';
comment on column public.export_files.attempt_id is
  'Server-generated processing attempt UUID. Terminal transitions must match the current attempt.';
comment on column public.export_files.lease_expires_at is
  'Short processing lease. A queued row may be reacquired only after this instant.';

create or replace function public.acquire_pdf_export_attempt(
  p_request_id uuid,
  p_source_type text,
  p_source_id uuid,
  p_request_options jsonb,
  p_render_source text
)
returns jsonb
language plpgsql
security definer
set search_path = public, private, pg_temp
as $$
declare
  v_user_id uuid := auth.uid();
  v_existing public.export_files%rowtype;
  v_export_id uuid;
  v_attempt_id uuid;
  v_lease_expires_at timestamptz;
  v_storage_path text;
  v_render_source text;
  v_requested_item_id text;
  v_requested_item_uuid uuid;
  v_requested_item_ids uuid[] := '{}';
begin
  if v_user_id is null
    or not exists (
      select 1
      from public.profiles profile
      where profile.id = v_user_id
        and profile.status::text = 'active'
    ) then
    raise exception 'acquire_pdf_export_attempt: inactive user'
      using errcode = '42501';
  end if;

  if p_request_id is null
    or p_source_type is null
    or p_source_type not in ('submission', 'report', 'library_selection')
    or p_render_source is null
    or p_render_source not in ('server_render', 'browser_print')
    or p_request_options is null
    or jsonb_typeof(p_request_options) <> 'object' then
    raise exception 'acquire_pdf_export_attempt: invalid request'
      using errcode = '22023';
  end if;

  if octet_length(p_request_options::text) > 4096
    or not p_request_options ?& array[
      'filename',
      'includeAnswers',
      'includeFeedback',
      'layout',
      'orientation',
      'request_item_ids'
    ]
    or (
      select count(*)
      from jsonb_object_keys(p_request_options)
    ) <> 6
    or jsonb_typeof(p_request_options->'filename') <> 'string'
    or char_length(btrim(p_request_options->>'filename')) not between 1 and 60
    or p_request_options->>'filename'
      is distinct from btrim(p_request_options->>'filename')
    or jsonb_typeof(p_request_options->'includeAnswers') <> 'boolean'
    or jsonb_typeof(p_request_options->'includeFeedback') <> 'boolean'
    or jsonb_typeof(p_request_options->'layout') <> 'string'
    or p_request_options->>'layout' not in ('paged', 'continuous')
    or jsonb_typeof(p_request_options->'orientation') <> 'string'
    or p_request_options->>'orientation' not in ('portrait', 'landscape') then
    raise exception 'acquire_pdf_export_attempt: invalid options'
      using errcode = '22023';
  end if;

  if p_source_type = 'submission' then
    if p_source_id is null
      or not exists (
        select 1
        from public.writing_submissions submission
        where submission.id = p_source_id
          and submission.user_id = v_user_id
      ) then
      raise exception 'acquire_pdf_export_attempt: submission ownership mismatch'
        using errcode = '42501';
    end if;
    if p_request_options->'request_item_ids' is distinct from 'null'::jsonb then
      raise exception 'acquire_pdf_export_attempt: invalid submission payload'
        using errcode = '22023';
    end if;
  elsif p_source_type = 'report' then
    if p_source_id is null
      or not exists (
        select 1
        from public.comparison_reports report
        where report.id = p_source_id
          and report.user_id = v_user_id
      ) then
      raise exception 'acquire_pdf_export_attempt: report ownership mismatch'
        using errcode = '42501';
    end if;
    if p_request_options->'request_item_ids' is distinct from 'null'::jsonb then
      raise exception 'acquire_pdf_export_attempt: invalid report payload'
        using errcode = '22023';
    end if;
  else
    if p_source_id is not null
      or jsonb_typeof(p_request_options->'request_item_ids') <> 'array'
      or jsonb_array_length(p_request_options->'request_item_ids')
        not between 1 and 6 then
      raise exception 'acquire_pdf_export_attempt: invalid library payload'
        using errcode = '22023';
    end if;

    for v_requested_item_id in
      select item_id
      from jsonb_array_elements_text(
        p_request_options->'request_item_ids'
      ) requested(item_id)
    loop
      if v_requested_item_id is null
        or v_requested_item_id
          !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
        raise exception 'acquire_pdf_export_attempt: invalid library item id'
          using errcode = '22023';
      end if;
      v_requested_item_uuid := v_requested_item_id::uuid;
      if v_requested_item_uuid = any(v_requested_item_ids) then
        raise exception 'acquire_pdf_export_attempt: duplicate library item id'
          using errcode = '22023';
      end if;
      v_requested_item_ids :=
        array_append(v_requested_item_ids, v_requested_item_uuid);
    end loop;

    if exists (
      select 1
      from unnest(v_requested_item_ids) requested(item_id)
      left join public.library_items item
        on item.id = requested.item_id
       and item.user_id = v_user_id
       and item.item_type::text in ('submission', 'report')
      left join public.writing_submissions submission
        on item.item_type::text = 'submission'
       and submission.id = item.submission_id
       and submission.user_id = v_user_id
      left join public.comparison_reports report
        on item.item_type::text = 'report'
       and report.id = item.report_id
       and report.user_id = v_user_id
      where item.id is null
        or (
          item.item_type::text = 'submission'
          and submission.id is null
        )
        or (
          item.item_type::text = 'report'
          and report.id is null
        )
    ) then
      raise exception 'acquire_pdf_export_attempt: library source mismatch'
        using errcode = '42501';
    end if;
  end if;

  perform pg_advisory_xact_lock(
    hashtextextended(v_user_id::text || ':' || p_request_id::text, 0)
  );

  select *
    into v_existing
  from public.export_files export_file
  where export_file.user_id = v_user_id
    and export_file.request_id = p_request_id
  for update;

  if found then
    if v_existing.source_type::text is distinct from p_source_type
      or v_existing.source_id is distinct from p_source_id
      or v_existing.options - 'source' is distinct from p_request_options then
      raise exception 'acquire_pdf_export_attempt: request payload mismatch'
        using errcode = '22023';
    end if;

    if v_existing.status::text = 'ready' then
      v_render_source := case
        when v_existing.options->>'source' = 'browser_print'
          then 'browser_print'
        else 'server_render'
      end;
      return jsonb_build_object(
        'attemptId', null,
        'exportId', v_existing.id,
        'leaseExpiresAt', null,
        'renderSource', v_render_source,
        'state', 'ready',
        'storagePath', v_existing.storage_path
      );
    end if;

    if v_existing.status::text = 'queued'
      and v_existing.lease_expires_at > now() then
      raise exception 'acquire_pdf_export_attempt: active lease'
        using errcode = '55P03';
    end if;

    v_export_id := v_existing.id;
  else
    v_export_id := gen_random_uuid();
  end if;

  v_attempt_id := gen_random_uuid();
  v_lease_expires_at := now() + interval '5 minutes';
  v_storage_path := (
    case
      when p_render_source = 'server_render' then 'server-render'
      else 'browser-print'
    end
    || '://'
    || v_export_id::text
    || '/'
    || v_attempt_id::text
  );

  if v_existing.id is null then
    insert into public.export_files (
      id,
      user_id,
      request_id,
      attempt_id,
      lease_expires_at,
      source_type,
      source_id,
      storage_path,
      options,
      status
    )
    values (
      v_export_id,
      v_user_id,
      p_request_id,
      v_attempt_id,
      v_lease_expires_at,
      p_source_type,
      p_source_id,
      v_storage_path,
      p_request_options || jsonb_build_object('source', p_render_source),
      'queued'
    );
  else
    update public.export_files
       set attempt_id = v_attempt_id,
           lease_expires_at = v_lease_expires_at,
           storage_path = v_storage_path,
           options =
             p_request_options || jsonb_build_object('source', p_render_source),
           status = 'queued',
           failure_code = null,
           failed_at = null,
           ready_at = null
     where id = v_export_id;
  end if;

  return jsonb_build_object(
    'attemptId', v_attempt_id,
    'exportId', v_export_id,
    'leaseExpiresAt', to_jsonb(v_lease_expires_at),
    'renderSource', p_render_source,
    'state', 'queued',
    'storagePath', v_storage_path
  );
end;
$$;

drop policy if exists export_files_owner_all on public.export_files;
drop policy if exists export_files_owner_insert on public.export_files;
drop policy if exists export_files_owner_update on public.export_files;
drop policy if exists export_files_owner_delete on public.export_files;

revoke insert, update, delete on public.export_files from authenticated;
revoke insert, update, delete on public.export_files from anon;
grant select on public.export_files to authenticated;

alter table public.pdf_export_quota_usages
  add column if not exists request_id uuid;

update public.pdf_export_quota_usages
set status = 'released',
    released_at = coalesce(released_at, now()),
    release_reason = 'request_identity_cutover'
where request_id is null
  and status = 'reserved';

update public.pdf_export_quota_usages
set request_id = gen_random_uuid()
where request_id is null;

alter table public.pdf_export_quota_usages
  alter column request_id set not null;

alter table public.pdf_export_quota_usages
  drop constraint if exists pdf_export_quota_usages_request_problem_period_uniq;
alter table public.pdf_export_quota_usages
  add constraint pdf_export_quota_usages_request_problem_period_uniq unique (
    user_id,
    request_id,
    problem_id,
    period_start,
    period_end
  );

comment on column public.pdf_export_quota_usages.request_id is
  'Stable client request UUID. A retry reuses the same usage row for each distinct problem in the bound period.';

create table if not exists public.pdf_export_request_periods (
  user_id uuid not null references public.profiles(id) on delete cascade,
  request_id uuid not null,
  policy_id uuid not null references public.pdf_export_quota_policies(id),
  problem_ids uuid[] not null,
  period_start timestamptz not null,
  period_end timestamptz not null,
  created_at timestamptz not null default now(),
  primary key (user_id, request_id),
  constraint pdf_export_request_periods_nonempty_problems
    check (cardinality(problem_ids) > 0),
  constraint pdf_export_request_periods_valid_window
    check (period_end > period_start)
);

alter table public.pdf_export_request_periods enable row level security;
alter table public.pdf_export_request_periods force row level security;

comment on table public.pdf_export_request_periods is
  'Binds one client PDF request UUID to one policy period and exact sorted problem set. Prevents a request id from being repurposed across periods.';

drop function if exists public.claim_pdf_export_quota(uuid, uuid[]);

create function public.claim_pdf_export_quota(
  p_user_id uuid,
  p_problem_ids uuid[],
  p_request_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public, private, pg_temp
as $$
declare
  v_policy public.pdf_export_quota_policies%rowtype;
  v_problem_ids uuid[];
  v_problem_id uuid;
  v_export_source_type text;
  v_export_source_id uuid;
  v_export_options jsonb;
  v_export_item_id text;
  v_export_item_uuid uuid;
  v_export_item_ids uuid[] := '{}';
  v_expected_problem_ids uuid[];
  v_resolved_item_count integer;
  v_local_now timestamp;
  v_local_start timestamp;
  v_local_end timestamp;
  v_period_start timestamptz;
  v_period_end timestamptz;
  v_bound_policy_id uuid;
  v_bound_problem_ids uuid[];
  v_bound_period_start timestamptz;
  v_bound_period_end timestamptz;
  v_reset_cutoff timestamptz;
  v_used integer;
  v_usage_id uuid;
  v_usage_status text;
  v_usage_ids uuid[] := '{}';
  v_used_response integer := 0;
  v_remaining_response integer := null;
begin
  if p_user_id is distinct from auth.uid()
    or not exists (
      select 1
      from public.profiles profile
      where profile.id = p_user_id
        and profile.status::text = 'active'
    ) then
    raise exception 'claim_pdf_export_quota: user mismatch'
      using errcode = '42501';
  end if;
  if p_request_id is null then
    raise exception 'claim_pdf_export_quota: request_id required'
      using errcode = '22023';
  end if;

  perform pg_advisory_xact_lock(
    hashtextextended(p_user_id::text || ':' || p_request_id::text, 0)
  );

  select
    export_file.source_type::text,
    export_file.source_id,
    export_file.options
    into
      v_export_source_type,
      v_export_source_id,
      v_export_options
  from public.export_files export_file
  where export_file.user_id = p_user_id
    and export_file.request_id = p_request_id
    and export_file.status::text in ('queued', 'ready')
  for update;

  if not found then
    raise exception 'claim_pdf_export_quota: export acquisition missing'
      using errcode = 'P0002';
  end if;

  if p_problem_ids is null
    or cardinality(p_problem_ids) not between 1 and 6
    or array_position(p_problem_ids, null) is not null then
    raise exception 'claim_pdf_export_quota: invalid problem ids'
      using errcode = '22023';
  end if;

  select array_agg(pid order by pid)
    into v_problem_ids
  from (
    select distinct u.pid
    from unnest(coalesce(p_problem_ids, '{}')) as u(pid)
    where u.pid is not null
  ) ordered_problem_ids;

  if p_problem_ids is distinct from v_problem_ids then
    raise exception 'claim_pdf_export_quota: problem ids must be sorted and unique'
      using errcode = '22023';
  end if;

  if v_export_source_type = 'submission' then
    select array[submission.problem_id]
      into v_expected_problem_ids
    from public.writing_submissions submission
    where submission.id = v_export_source_id
      and submission.user_id = p_user_id;

    if not found then
      raise exception 'claim_pdf_export_quota: export source missing'
        using errcode = 'P0002';
    end if;
  elsif v_export_source_type = 'report' then
    select array[report_submission.problem_id]
      into v_expected_problem_ids
    from public.comparison_reports report
    join public.writing_submissions report_submission
      on report_submission.id = report.current_submission_id
     and report_submission.user_id = p_user_id
    where report.id = v_export_source_id
      and report.user_id = p_user_id;

    if not found then
      raise exception 'claim_pdf_export_quota: export source missing'
        using errcode = 'P0002';
    end if;
  elsif v_export_source_type = 'library_selection' then
    if v_export_source_id is not null
      or jsonb_typeof(v_export_options->'request_item_ids') <> 'array'
      or jsonb_array_length(v_export_options->'request_item_ids')
        not between 1 and 6 then
      raise exception 'claim_pdf_export_quota: invalid acquired library source'
        using errcode = 'P0002';
    end if;

    for v_export_item_id in
      select item_id
      from jsonb_array_elements_text(
        v_export_options->'request_item_ids'
      ) requested(item_id)
    loop
      if v_export_item_id
        !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
        raise exception 'claim_pdf_export_quota: invalid acquired library item'
          using errcode = 'P0002';
      end if;
      v_export_item_uuid := v_export_item_id::uuid;
      if v_export_item_uuid = any(v_export_item_ids) then
        raise exception 'claim_pdf_export_quota: duplicate acquired library item'
          using errcode = 'P0002';
      end if;
      v_export_item_ids :=
        array_append(v_export_item_ids, v_export_item_uuid);
    end loop;

    select
      array_agg(
        distinct resolved.problem_id
        order by resolved.problem_id
      ),
      count(*)::integer
      into v_expected_problem_ids, v_resolved_item_count
    from (
      select case
        when item.item_type::text = 'submission'
          then submission.problem_id
        else report_submission.problem_id
      end as problem_id
      from unnest(v_export_item_ids) requested(item_id)
      join public.library_items item
        on item.id = requested.item_id
       and item.user_id = p_user_id
       and item.item_type::text in ('submission', 'report')
      left join public.writing_submissions submission
        on item.item_type::text = 'submission'
       and submission.id = item.submission_id
       and submission.user_id = p_user_id
      left join public.comparison_reports report
        on item.item_type::text = 'report'
       and report.id = item.report_id
       and report.user_id = p_user_id
      left join public.writing_submissions report_submission
        on item.item_type::text = 'report'
       and report_submission.id = report.current_submission_id
       and report_submission.user_id = p_user_id
      where (
          item.item_type::text = 'submission'
          and submission.id is not null
        )
        or (
          item.item_type::text = 'report'
          and report.id is not null
          and report_submission.id is not null
        )
    ) resolved;

    if v_resolved_item_count
      is distinct from cardinality(v_export_item_ids) then
      raise exception 'claim_pdf_export_quota: export source missing'
        using errcode = 'P0002';
    end if;
  else
    raise exception 'claim_pdf_export_quota: invalid acquired source'
      using errcode = 'P0002';
  end if;

  if cardinality(v_expected_problem_ids) not between 1 and 6
    or v_problem_ids is distinct from v_expected_problem_ids then
    raise exception 'claim_pdf_export_quota: problem set mismatch'
      using errcode = '22023';
  end if;

  select *
    into v_policy
  from public.pdf_export_quota_policies
  where is_active = true
    and subject_scope = 'user'
    and resource_scope = 'problem'
  order by priority asc, created_at desc
  limit 1;

  if not found then
    raise exception 'claim_pdf_export_quota: active policy not found'
      using errcode = 'P0002';
  end if;

  v_local_now := timezone(v_policy.period_timezone, now());
  if v_policy.period_unit = 'day' then
    v_local_start := date_trunc('day', v_local_now);
    v_local_end := v_local_start + interval '1 day';
  elsif v_policy.period_unit = 'week' then
    v_local_start := date_trunc('week', v_local_now);
    v_local_end := v_local_start + interval '1 week';
  else
    v_local_start := date_trunc('month', v_local_now);
    v_local_end := v_local_start + interval '1 month';
  end if;
  v_period_start := v_local_start at time zone v_policy.period_timezone;
  v_period_end := v_local_end at time zone v_policy.period_timezone;

  insert into public.pdf_export_request_periods (
    user_id,
    request_id,
    policy_id,
    problem_ids,
    period_start,
    period_end
  )
  values (
    p_user_id,
    p_request_id,
    v_policy.id,
    v_problem_ids,
    v_period_start,
    v_period_end
  )
  on conflict (user_id, request_id) do nothing;

  select
    binding.policy_id,
    binding.problem_ids,
    binding.period_start,
    binding.period_end
  into
    v_bound_policy_id,
    v_bound_problem_ids,
    v_bound_period_start,
    v_bound_period_end
  from public.pdf_export_request_periods binding
  where binding.user_id = p_user_id
    and binding.request_id = p_request_id;

  if v_bound_policy_id is distinct from v_policy.id
    or v_bound_problem_ids is distinct from v_problem_ids
    or v_bound_period_start is distinct from v_period_start
    or v_bound_period_end is distinct from v_period_end then
    raise exception 'claim_pdf_export_quota: request id already bound'
      using errcode = '22023';
  end if;

  foreach v_problem_id in array v_problem_ids loop
    perform pg_advisory_xact_lock(
      hashtextextended(
        p_user_id::text || ':' || v_problem_id::text || ':' || v_period_start::text,
        0
      )
    );

    update public.pdf_export_quota_usages
       set status = 'released',
           released_at = now(),
           release_reason = 'reservation_timeout'
     where user_id = p_user_id
       and problem_id = v_problem_id
       and period_start = v_period_start
       and period_end = v_period_end
       and status = 'reserved'
       and created_at <= now() - interval '15 minutes';

    select usage.id, usage.status
      into v_usage_id, v_usage_status
    from public.pdf_export_quota_usages usage
    where usage.user_id = p_user_id
      and usage.request_id = p_request_id
      and usage.problem_id = v_problem_id
      and usage.period_start = v_period_start
      and usage.period_end = v_period_end;

    if found and v_usage_status in ('reserved', 'committed') then
      continue;
    end if;

    select max(reset.created_at)
      into v_reset_cutoff
    from public.pdf_export_quota_resets reset
    where (reset.problem_id is null or reset.problem_id = v_problem_id)
      and reset.created_at >= v_period_start
      and reset.created_at < v_period_end
      and exists (
        select 1
        from public.pdf_export_quota_reset_targets target
        where target.reset_id = reset.id
          and target.user_id = p_user_id
      );

    select count(*)::integer
      into v_used
    from public.pdf_export_quota_usages usage
    where usage.user_id = p_user_id
      and usage.problem_id = v_problem_id
      and usage.period_start = v_period_start
      and usage.period_end = v_period_end
      and usage.status in ('reserved', 'committed')
      and (v_reset_cutoff is null or usage.created_at > v_reset_cutoff);

    if v_used >= v_policy.limit_count then
      return jsonb_build_object(
        'allowed', false,
        'code', 'pdf_export_quota_exceeded',
        'limit', v_policy.limit_count,
        'used', v_used,
        'remaining', 0,
        'resetAt', to_jsonb(v_period_end),
        'periodUnit', v_policy.period_unit,
        'problemId', v_problem_id
      );
    end if;
  end loop;

  foreach v_problem_id in array v_problem_ids loop
    select usage.id, usage.status
      into v_usage_id, v_usage_status
    from public.pdf_export_quota_usages usage
    where usage.user_id = p_user_id
      and usage.request_id = p_request_id
      and usage.problem_id = v_problem_id
      and usage.period_start = v_period_start
      and usage.period_end = v_period_end;

    if not found then
      insert into public.pdf_export_quota_usages (
        policy_id,
        user_id,
        problem_id,
        request_id,
        period_start,
        period_end,
        status
      )
      values (
        v_policy.id,
        p_user_id,
        v_problem_id,
        p_request_id,
        v_period_start,
        v_period_end,
        'reserved'
      )
      returning id into v_usage_id;
    elsif v_usage_status = 'released' then
      update public.pdf_export_quota_usages
         set status = 'reserved',
             reserved_at = now(),
             committed_at = null,
             released_at = null,
             release_reason = null,
             export_file_id = null,
             created_at = now()
       where id = v_usage_id;
    end if;

    v_usage_ids := array_append(v_usage_ids, v_usage_id);

    select max(reset.created_at)
      into v_reset_cutoff
    from public.pdf_export_quota_resets reset
    where (reset.problem_id is null or reset.problem_id = v_problem_id)
      and reset.created_at >= v_period_start
      and reset.created_at < v_period_end
      and exists (
        select 1
        from public.pdf_export_quota_reset_targets target
        where target.reset_id = reset.id
          and target.user_id = p_user_id
      );

    select count(*)::integer
      into v_used
    from public.pdf_export_quota_usages usage
    where usage.user_id = p_user_id
      and usage.problem_id = v_problem_id
      and usage.period_start = v_period_start
      and usage.period_end = v_period_end
      and usage.status in ('reserved', 'committed')
      and (v_reset_cutoff is null or usage.created_at > v_reset_cutoff);

    v_used_response := greatest(v_used_response, v_used);
    v_remaining_response := least(
      coalesce(v_remaining_response, v_policy.limit_count),
      greatest(v_policy.limit_count - v_used, 0)
    );
  end loop;

  return jsonb_build_object(
    'allowed', true,
    'usageIds', v_usage_ids,
    'limit', v_policy.limit_count,
    'used', v_used_response,
    'remaining', coalesce(v_remaining_response, v_policy.limit_count),
    'resetAt', to_jsonb(v_period_end),
    'periodUnit', v_policy.period_unit
  );
end;
$$;

create or replace function public.commit_pdf_export_quota(
  p_user_id uuid,
  p_usage_ids uuid[],
  p_export_file_id uuid
)
returns void
language plpgsql
security definer
set search_path = public, private, pg_temp
as $$
declare
  v_expected integer;
  v_matched integer;
  v_export_request_id uuid;
begin
  select count(distinct usage_id)::integer
    into v_expected
  from unnest(coalesce(p_usage_ids, '{}')) as requested(usage_id)
  where usage_id is not null;

  if coalesce(v_expected, 0) = 0 then
    return;
  end if;

  select export_file.request_id
    into v_export_request_id
  from public.export_files export_file
  where export_file.id = p_export_file_id
    and export_file.user_id = p_user_id
    and export_file.status = 'ready';

  if not found then
    raise exception 'commit_pdf_export_quota: export file mismatch'
      using errcode = '42501';
  end if;

  if exists (
    select 1
    from unnest(coalesce(p_usage_ids, '{}')) as requested(usage_id)
    left join public.pdf_export_quota_usages usage
      on usage.id = requested.usage_id
    where requested.usage_id is not null
      and (
        usage.id is null
        or usage.user_id <> p_user_id
        or usage.request_id is distinct from v_export_request_id
        or usage.status = 'released'
        or (
          usage.status = 'committed'
          and usage.export_file_id is distinct from p_export_file_id
        )
      )
  ) then
    raise exception 'commit_pdf_export_quota: usage mismatch'
      using errcode = 'P0002';
  end if;

  update public.pdf_export_quota_usages
     set status = 'committed',
         export_file_id = p_export_file_id,
         committed_at = now()
   where id = any(coalesce(p_usage_ids, '{}'))
     and user_id = p_user_id
     and status = 'reserved';

  select count(distinct usage.id)::integer
    into v_matched
  from public.pdf_export_quota_usages usage
  where usage.id = any(coalesce(p_usage_ids, '{}'))
    and usage.user_id = p_user_id
    and usage.status = 'committed'
    and usage.export_file_id = p_export_file_id;

  if v_matched <> v_expected then
    raise exception 'commit_pdf_export_quota: usage count mismatch'
      using errcode = 'P0002';
  end if;
end;
$$;

create or replace function public.release_pdf_export_quota(
  p_user_id uuid,
  p_usage_ids uuid[],
  p_reason text default null
)
returns void
language plpgsql
security definer
set search_path = public, private, pg_temp
as $$
declare
  v_expected integer;
  v_matched integer;
begin
  select count(distinct usage_id)::integer
    into v_expected
  from unnest(coalesce(p_usage_ids, '{}')) as requested(usage_id)
  where usage_id is not null;

  if coalesce(v_expected, 0) = 0 then
    return;
  end if;

  if exists (
    select 1
    from unnest(coalesce(p_usage_ids, '{}')) as requested(usage_id)
    left join public.pdf_export_quota_usages usage
      on usage.id = requested.usage_id
    where requested.usage_id is not null
      and (
        usage.id is null
        or usage.user_id <> p_user_id
        or usage.status = 'committed'
      )
  ) then
    raise exception 'release_pdf_export_quota: usage mismatch'
      using errcode = 'P0002';
  end if;

  update public.pdf_export_quota_usages
     set status = 'released',
         released_at = now(),
         release_reason = p_reason
   where id = any(coalesce(p_usage_ids, '{}'))
     and user_id = p_user_id
     and status = 'reserved';

  select count(distinct usage.id)::integer
    into v_matched
  from public.pdf_export_quota_usages usage
  where usage.id = any(coalesce(p_usage_ids, '{}'))
    and usage.user_id = p_user_id
    and usage.status = 'released';

  if v_matched <> v_expected then
    raise exception 'release_pdf_export_quota: usage count mismatch'
      using errcode = 'P0002';
  end if;
end;
$$;

create or replace function public.complete_pdf_export_attempt(
  p_user_id uuid,
  p_usage_ids uuid[],
  p_export_file_id uuid,
  p_attempt_id uuid,
  p_storage_path text
)
returns boolean
language plpgsql
security definer
set search_path = public, private, pg_temp
as $$
declare
  v_status text;
  v_attempt_id uuid;
  v_storage_path text;
begin
  select export_file.status, export_file.attempt_id, export_file.storage_path
    into v_status, v_attempt_id, v_storage_path
  from public.export_files export_file
  where export_file.id = p_export_file_id
    and export_file.user_id = p_user_id
  for update;

  if not found or v_attempt_id is distinct from p_attempt_id then
    return false;
  end if;

  if v_status = 'ready' then
    if v_storage_path is distinct from p_storage_path then
      return false;
    end if;
    perform public.commit_pdf_export_quota(
      p_user_id,
      p_usage_ids,
      p_export_file_id
    );
    return true;
  end if;

  if v_status <> 'queued' then
    return false;
  end if;

  update public.export_files
     set storage_path = p_storage_path,
         status = 'ready',
         ready_at = now(),
         failure_code = null,
         failed_at = null,
         lease_expires_at = null
   where id = p_export_file_id
     and user_id = p_user_id
     and attempt_id = p_attempt_id
     and status = 'queued';

  if not found then
    return false;
  end if;

  perform public.commit_pdf_export_quota(
    p_user_id,
    p_usage_ids,
    p_export_file_id
  );
  return true;
end;
$$;

create or replace function public.fail_pdf_export_attempt(
  p_user_id uuid,
  p_usage_ids uuid[],
  p_export_file_id uuid,
  p_attempt_id uuid,
  p_failure_code text,
  p_reason text
)
returns text
language plpgsql
security definer
set search_path = public, private, pg_temp
as $$
declare
  v_status text;
  v_attempt_id uuid;
  v_export_request_id uuid;
begin
  select
    export_file.status,
    export_file.attempt_id,
    export_file.request_id
    into v_status, v_attempt_id, v_export_request_id
  from public.export_files export_file
  where export_file.id = p_export_file_id
    and export_file.user_id = p_user_id
  for update;

  if not found or v_attempt_id is distinct from p_attempt_id then
    return 'stale_attempt';
  end if;

  if exists (
    select 1
    from unnest(coalesce(p_usage_ids, '{}')) as requested(usage_id)
    left join public.pdf_export_quota_usages usage
      on usage.id = requested.usage_id
    where requested.usage_id is not null
      and (
        usage.id is null
        or usage.user_id <> p_user_id
        or usage.request_id is distinct from v_export_request_id
      )
  ) then
    raise exception 'fail_pdf_export_attempt: usage request mismatch'
      using errcode = 'P0002';
  end if;

  if v_status = 'ready' then
    perform public.commit_pdf_export_quota(
      p_user_id,
      p_usage_ids,
      p_export_file_id
    );
    return 'already_ready_current';
  end if;

  if v_status = 'failed' then
    perform public.release_pdf_export_quota(
      p_user_id,
      p_usage_ids,
      p_reason
    );
    return 'failed_current';
  end if;

  if v_status <> 'queued' then
    return 'stale_attempt';
  end if;

  update public.export_files
     set status = 'failed',
         failure_code = p_failure_code,
         failed_at = now(),
         ready_at = null,
         lease_expires_at = null
   where id = p_export_file_id
     and user_id = p_user_id
     and attempt_id = p_attempt_id
     and status = 'queued';

  if not found then
    return 'stale_attempt';
  end if;

  perform public.release_pdf_export_quota(
    p_user_id,
    p_usage_ids,
    p_reason
  );
  return 'failed_current';
end;
$$;

revoke all on function public.acquire_pdf_export_attempt(uuid, text, uuid, jsonb, text)
  from public;
revoke all on function public.acquire_pdf_export_attempt(uuid, text, uuid, jsonb, text)
  from anon;
revoke all on function public.acquire_pdf_export_attempt(uuid, text, uuid, jsonb, text)
  from service_role;
revoke all on function public.claim_pdf_export_quota(uuid, uuid[], uuid)
  from public;
revoke all on function public.claim_pdf_export_quota(uuid, uuid[], uuid)
  from anon;
revoke all on function public.claim_pdf_export_quota(uuid, uuid[], uuid)
  from service_role;
revoke all on function public.commit_pdf_export_quota(uuid, uuid[], uuid)
  from public;
revoke all on function public.commit_pdf_export_quota(uuid, uuid[], uuid)
  from anon;
revoke all on function public.commit_pdf_export_quota(uuid, uuid[], uuid)
  from authenticated;
revoke all on function public.release_pdf_export_quota(uuid, uuid[], text)
  from public;
revoke all on function public.release_pdf_export_quota(uuid, uuid[], text)
  from anon;
revoke all on function public.release_pdf_export_quota(uuid, uuid[], text)
  from authenticated;
revoke all on function public.complete_pdf_export_attempt(uuid, uuid[], uuid, uuid, text)
  from public;
revoke all on function public.complete_pdf_export_attempt(uuid, uuid[], uuid, uuid, text)
  from anon;
revoke all on function public.complete_pdf_export_attempt(uuid, uuid[], uuid, uuid, text)
  from authenticated;
revoke all on function public.fail_pdf_export_attempt(uuid, uuid[], uuid, uuid, text, text)
  from public;
revoke all on function public.fail_pdf_export_attempt(uuid, uuid[], uuid, uuid, text, text)
  from anon;
revoke all on function public.fail_pdf_export_attempt(uuid, uuid[], uuid, uuid, text, text)
  from authenticated;

grant execute on function public.acquire_pdf_export_attempt(uuid, text, uuid, jsonb, text)
  to authenticated;
grant execute on function public.claim_pdf_export_quota(uuid, uuid[], uuid)
  to authenticated;
grant execute on function public.commit_pdf_export_quota(uuid, uuid[], uuid)
  to service_role;
grant execute on function public.release_pdf_export_quota(uuid, uuid[], text)
  to service_role;
grant execute on function public.complete_pdf_export_attempt(uuid, uuid[], uuid, uuid, text)
  to service_role;
grant execute on function public.fail_pdf_export_attempt(uuid, uuid[], uuid, uuid, text, text)
  to service_role;

comment on function public.acquire_pdf_export_attempt(uuid, text, uuid, jsonb, text) is
  'JWT-authenticated atomic PDF export ledger acquisition. Validates the bounded route option contract, active user, and source ownership; binds one payload per request; and creates the processing attempt and lease inside the database.';
comment on function public.claim_pdf_export_quota(uuid, uuid[], uuid) is
  'JWT-authenticated, retry-safe PDF quota reservation for an active user with a matching acquired export row, bound to one request UUID, exact distinct problems, and one policy period.';
comment on function public.commit_pdf_export_quota(uuid, uuid[], uuid) is
  'Service-only idempotent terminal commit after an owned export file is ready.';
comment on function public.release_pdf_export_quota(uuid, uuid[], text) is
  'Service-only idempotent release for reserved rows after a failed export attempt.';
comment on function public.complete_pdf_export_attempt(uuid, uuid[], uuid, uuid, text) is
  'Service-only atomic current-attempt ready transition and quota commit.';
comment on function public.fail_pdf_export_attempt(uuid, uuid[], uuid, uuid, text, text) is
  'Service-only atomic current-attempt failure transition and quota release with an explicit race outcome.';
