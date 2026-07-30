-- =====================================================================
-- TALKPIK AI · PDF export quota ledger
--
-- User app contract:
--   - quota is counted per user + writing problem + period
--   - default policy is 3 exports per month in Asia/Seoul
--   - export_files remains the generated file ledger, not the quota source
-- =====================================================================

create table if not exists public.pdf_export_quota_policies (
  id uuid primary key default gen_random_uuid(),
  subject_scope text not null default 'user'
    check (subject_scope in ('user')),
  resource_scope text not null default 'problem'
    check (resource_scope in ('problem')),
  period_unit text not null default 'month'
    check (period_unit in ('day', 'week', 'month')),
  period_timezone text not null default 'Asia/Seoul',
  limit_count integer not null default 3 check (limit_count >= 0),
  priority integer not null default 100,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists pdf_export_quota_policies_active
  on public.pdf_export_quota_policies (is_active, priority, created_at desc);

comment on table public.pdf_export_quota_policies is
  'Server-enforced PDF export quota policies. Default is user + problem + month, 3 exports, Asia/Seoul.';

create table if not exists public.pdf_export_quota_usages (
  id uuid primary key default gen_random_uuid(),
  policy_id uuid not null references public.pdf_export_quota_policies(id),
  user_id uuid not null references public.profiles(id) on delete cascade,
  problem_id uuid not null references public.problems(id) on delete cascade,
  export_file_id uuid references public.export_files(id) on delete set null,
  period_start timestamptz not null,
  period_end timestamptz not null,
  status text not null default 'reserved'
    check (status in ('reserved', 'committed', 'released')),
  reserved_at timestamptz not null default now(),
  committed_at timestamptz,
  released_at timestamptz,
  release_reason text,
  created_at timestamptz not null default now()
);

create index if not exists pdf_export_quota_usages_count
  on public.pdf_export_quota_usages (
    user_id,
    problem_id,
    period_start,
    period_end,
    status,
    created_at
  )
  where status in ('reserved', 'committed');

create index if not exists pdf_export_quota_usages_export_file
  on public.pdf_export_quota_usages (export_file_id)
  where export_file_id is not null;

comment on table public.pdf_export_quota_usages is
  'Atomic PDF export quota usage ledger. Reserved rows block concurrent overuse and are committed only after export success.';

create table if not exists public.pdf_export_quota_resets (
  id uuid primary key default gen_random_uuid(),
  reset_scope text not null check (reset_scope in ('user', 'group', 'global')),
  problem_id uuid references public.problems(id) on delete cascade,
  reason text,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists pdf_export_quota_resets_lookup
  on public.pdf_export_quota_resets (reset_scope, problem_id, created_at desc);

comment on table public.pdf_export_quota_resets is
  'PDF export quota reset audit header. User/group/global reset targets are materialized in pdf_export_quota_reset_targets.';

create table if not exists public.pdf_export_quota_reset_targets (
  reset_id uuid not null references public.pdf_export_quota_resets(id)
    on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  materialized_at timestamptz not null default now(),
  primary key (reset_id, user_id)
);

create index if not exists pdf_export_quota_reset_targets_user
  on public.pdf_export_quota_reset_targets (user_id, reset_id);

comment on table public.pdf_export_quota_reset_targets is
  'Materialized user targets for user/group/global quota resets. topik-ai owns target expansion.';

insert into public.pdf_export_quota_policies (
  subject_scope,
  resource_scope,
  period_unit,
  period_timezone,
  limit_count,
  priority,
  is_active
)
select 'user', 'problem', 'month', 'Asia/Seoul', 3, 100, true
where not exists (
  select 1
  from public.pdf_export_quota_policies
  where subject_scope = 'user'
    and resource_scope = 'problem'
    and period_unit = 'month'
    and period_timezone = 'Asia/Seoul'
    and limit_count = 3
    and is_active = true
);

alter table public.pdf_export_quota_policies enable row level security;
alter table public.pdf_export_quota_policies force row level security;
alter table public.pdf_export_quota_usages enable row level security;
alter table public.pdf_export_quota_usages force row level security;
alter table public.pdf_export_quota_resets enable row level security;
alter table public.pdf_export_quota_resets force row level security;
alter table public.pdf_export_quota_reset_targets enable row level security;
alter table public.pdf_export_quota_reset_targets force row level security;

drop policy if exists pdf_export_quota_policies_select on public.pdf_export_quota_policies;
create policy pdf_export_quota_policies_select
  on public.pdf_export_quota_policies
  for select to authenticated
  using (is_active or private.is_platform_admin((select auth.uid())));

drop policy if exists pdf_export_quota_policies_admin_all on public.pdf_export_quota_policies;
create policy pdf_export_quota_policies_admin_all
  on public.pdf_export_quota_policies
  for all to authenticated
  using (private.is_platform_admin((select auth.uid())))
  with check (private.is_platform_admin((select auth.uid())));

drop policy if exists pdf_export_quota_usages_owner_select on public.pdf_export_quota_usages;
create policy pdf_export_quota_usages_owner_select
  on public.pdf_export_quota_usages
  for select to authenticated
  using (
    (user_id = (select auth.uid()) and status <> 'reserved')
    or private.is_platform_admin((select auth.uid()))
  );

drop policy if exists pdf_export_quota_resets_select on public.pdf_export_quota_resets;
create policy pdf_export_quota_resets_select
  on public.pdf_export_quota_resets
  for select to authenticated
  using (
    private.is_platform_admin((select auth.uid()))
    or exists (
      select 1
      from public.pdf_export_quota_reset_targets t
      where t.reset_id = pdf_export_quota_resets.id
        and t.user_id = (select auth.uid())
    )
  );

drop policy if exists pdf_export_quota_resets_admin_all on public.pdf_export_quota_resets;
create policy pdf_export_quota_resets_admin_all
  on public.pdf_export_quota_resets
  for all to authenticated
  using (private.is_platform_admin((select auth.uid())))
  with check (private.is_platform_admin((select auth.uid())));

drop policy if exists pdf_export_quota_reset_targets_select on public.pdf_export_quota_reset_targets;
create policy pdf_export_quota_reset_targets_select
  on public.pdf_export_quota_reset_targets
  for select to authenticated
  using (
    user_id = (select auth.uid())
    or private.is_platform_admin((select auth.uid()))
  );

drop policy if exists pdf_export_quota_reset_targets_admin_all on public.pdf_export_quota_reset_targets;
create policy pdf_export_quota_reset_targets_admin_all
  on public.pdf_export_quota_reset_targets
  for all to authenticated
  using (private.is_platform_admin((select auth.uid())))
  with check (private.is_platform_admin((select auth.uid())));

create or replace function public.claim_pdf_export_quota(
  p_user_id uuid,
  p_problem_ids uuid[]
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
  v_local_now timestamp;
  v_local_start timestamp;
  v_local_end timestamp;
  v_period_start timestamptz;
  v_period_end timestamptz;
  v_reset_cutoff timestamptz;
  v_used integer;
  v_usage_id uuid;
  v_usage_ids uuid[] := '{}';
  v_used_response integer := 0;
  v_remaining_response integer := null;
begin
  if p_user_id is distinct from auth.uid() then
    raise exception 'claim_pdf_export_quota: user mismatch'
      using errcode = '42501';
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

  select array_agg(pid order by pid)
    into v_problem_ids
  from (
    select distinct u.pid
    from unnest(coalesce(p_problem_ids, '{}')) as u(pid)
    where u.pid is not null
  ) ordered_problem_ids;

  if coalesce(array_length(v_problem_ids, 1), 0) = 0 then
    raise exception 'claim_pdf_export_quota: problem_ids required'
      using errcode = '22023';
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

  foreach v_problem_id in array v_problem_ids loop
    perform pg_advisory_xact_lock(
      hashtextextended(
        p_user_id::text || ':' || v_problem_id::text || ':' || v_period_start::text,
        0
      )
    );

    select max(r.created_at)
      into v_reset_cutoff
    from public.pdf_export_quota_resets r
    where (r.problem_id is null or r.problem_id = v_problem_id)
      and r.created_at >= v_period_start
      and r.created_at < v_period_end
      and exists (
        select 1
        from public.pdf_export_quota_reset_targets t
        where t.reset_id = r.id
          and t.user_id = p_user_id
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

    select count(*)::integer
      into v_used
    from public.pdf_export_quota_usages u
    where u.user_id = p_user_id
      and u.problem_id = v_problem_id
      and u.period_start = v_period_start
      and u.period_end = v_period_end
      and u.status in ('reserved', 'committed')
      and (v_reset_cutoff is null or u.created_at > v_reset_cutoff);

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
    insert into public.pdf_export_quota_usages (
      policy_id,
      user_id,
      problem_id,
      period_start,
      period_end,
      status
    )
    values (
      v_policy.id,
      p_user_id,
      v_problem_id,
      v_period_start,
      v_period_end,
      'reserved'
    )
    returning id into v_usage_id;

    v_usage_ids := array_append(v_usage_ids, v_usage_id);

    select max(r.created_at)
      into v_reset_cutoff
    from public.pdf_export_quota_resets r
    where (r.problem_id is null or r.problem_id = v_problem_id)
      and r.created_at >= v_period_start
      and r.created_at < v_period_end
      and exists (
        select 1
        from public.pdf_export_quota_reset_targets t
        where t.reset_id = r.id
          and t.user_id = p_user_id
      );

    select count(*)::integer
      into v_used
    from public.pdf_export_quota_usages u
    where u.user_id = p_user_id
      and u.problem_id = v_problem_id
      and u.period_start = v_period_start
      and u.period_end = v_period_end
      and u.status in ('reserved', 'committed')
      and (v_reset_cutoff is null or u.created_at > v_reset_cutoff);

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
  v_updated integer;
begin
  select count(distinct usage_id)::integer
    into v_expected
  from unnest(coalesce(p_usage_ids, '{}')) as u(usage_id)
  where usage_id is not null;

  if coalesce(v_expected, 0) = 0 then
    return;
  end if;

  if not exists (
    select 1
    from public.export_files e
    where e.id = p_export_file_id
      and e.user_id = p_user_id
  ) then
    raise exception 'commit_pdf_export_quota: export file mismatch'
      using errcode = '42501';
  end if;

  update public.pdf_export_quota_usages
     set status = 'committed',
         export_file_id = p_export_file_id,
         committed_at = now()
   where id = any(coalesce(p_usage_ids, '{}'))
     and user_id = p_user_id
     and status = 'reserved';

  get diagnostics v_updated = row_count;
  if v_updated <> v_expected then
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
  v_updated integer;
begin
  select count(distinct usage_id)::integer
    into v_expected
  from unnest(coalesce(p_usage_ids, '{}')) as u(usage_id)
  where usage_id is not null;

  if coalesce(v_expected, 0) = 0 then
    return;
  end if;

  update public.pdf_export_quota_usages
     set status = 'released',
         released_at = now(),
         release_reason = p_reason
   where id = any(coalesce(p_usage_ids, '{}'))
     and user_id = p_user_id
     and status = 'reserved';

  get diagnostics v_updated = row_count;
  if v_updated <> v_expected then
    raise exception 'release_pdf_export_quota: usage count mismatch'
      using errcode = 'P0002';
  end if;
end;
$$;

revoke all on function public.claim_pdf_export_quota(uuid, uuid[]) from public;
revoke all on function public.claim_pdf_export_quota(uuid, uuid[]) from anon;
revoke all on function public.commit_pdf_export_quota(uuid, uuid[], uuid) from public;
revoke all on function public.commit_pdf_export_quota(uuid, uuid[], uuid) from anon;
revoke all on function public.commit_pdf_export_quota(uuid, uuid[], uuid) from authenticated;
revoke all on function public.release_pdf_export_quota(uuid, uuid[], text) from public;
revoke all on function public.release_pdf_export_quota(uuid, uuid[], text) from anon;
revoke all on function public.release_pdf_export_quota(uuid, uuid[], text) from authenticated;

grant execute on function public.claim_pdf_export_quota(uuid, uuid[]) to authenticated;
grant execute on function public.commit_pdf_export_quota(uuid, uuid[], uuid) to service_role;
grant execute on function public.release_pdf_export_quota(uuid, uuid[], text) to service_role;

comment on function public.claim_pdf_export_quota(uuid, uuid[]) is
  'Atomically reserves PDF export quota per user + distinct problem ids using advisory locks.';
comment on function public.commit_pdf_export_quota(uuid, uuid[], uuid) is
  'Commits reserved PDF export quota usages after export_files is ready.';
comment on function public.release_pdf_export_quota(uuid, uuid[], text) is
  'Releases reserved PDF export quota usages when PDF generation or print preparation fails.';
