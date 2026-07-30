-- =====================================================================
-- TALKPIK AI · Conformance · 2026-06-02
-- *** NET-NEW SCOPE *** Organizations / assignments
--
-- These tables are NOT in the Tier 1 MVP schema (docs/development/
-- database-schema.md). They are added under explicit user authorization to
-- back documented org-admin surfaces:
--   - X-08  : assignment-create, submission-rate, org affiliation
--   - X-10  : region 5 org column
--
-- COORDINATOR: confirm this scope before applying. The org RLS model assumed
-- here (org_admin sees their own orgs; members see orgs they belong to) is a
-- design decision that should be validated against the IA specs.
--
--   organizations          : org directory
--   org_members            : (org_id, user_id) membership with per-org role
--   assignments            : org-issued tasks, optionally tied to a problem
--   assignment_submissions : learner responses to an assignment
--
-- RLS uses a private membership helper rather than a recursive policy, to
-- avoid org_members self-reference loops (same private-schema SECURITY
-- DEFINER pattern as private.is_*_admin).
-- =====================================================================


-- ---------------------------------------------------------------------
-- organizations
-- ---------------------------------------------------------------------
create table if not exists public.organizations (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  created_by  uuid references public.profiles(id) on delete set null,
  created_at  timestamptz not null default now()
);

comment on table public.organizations is
  'NET-NEW (2026-06-02): organization directory backing X-08/X-10 org surfaces.';


-- ---------------------------------------------------------------------
-- org_members : membership + per-org role
-- ---------------------------------------------------------------------
create table if not exists public.org_members (
  org_id      uuid not null references public.organizations(id) on delete cascade,
  user_id     uuid not null references public.profiles(id) on delete cascade,
  role        text not null default 'member'
              check (role in ('member','manager','owner')),
  created_at  timestamptz not null default now(),
  primary key (org_id, user_id)
);

create index if not exists org_members_user
  on public.org_members (user_id);

comment on table public.org_members is
  'NET-NEW (2026-06-02): org membership. role = per-org membership role (distinct from profiles.app_role).';


-- ---------------------------------------------------------------------
-- assignments : org-issued task, optionally backed by a problem
-- ---------------------------------------------------------------------
create table if not exists public.assignments (
  id          uuid primary key default gen_random_uuid(),
  org_id      uuid not null references public.organizations(id) on delete cascade,
  title       text not null,
  problem_id  uuid references public.problems(id) on delete set null,
  due_at      timestamptz,
  created_by  uuid references public.profiles(id) on delete set null,
  created_at  timestamptz not null default now()
);

create index if not exists assignments_org_due
  on public.assignments (org_id, due_at desc);

comment on table public.assignments is
  'NET-NEW (2026-06-02): org assignment. problem_id optional. Backs X-08 assignment-create.';


-- ---------------------------------------------------------------------
-- assignment_submissions : learner response to an assignment
-- ---------------------------------------------------------------------
create table if not exists public.assignment_submissions (
  id             uuid primary key default gen_random_uuid(),
  assignment_id  uuid not null references public.assignments(id) on delete cascade,
  user_id        uuid not null references public.profiles(id) on delete cascade,
  submission_id  uuid references public.writing_submissions(id) on delete set null,
  status         text not null default 'assigned'
                 check (status in ('assigned','submitted','reviewed')),
  submitted_at   timestamptz,
  created_at     timestamptz not null default now()
);

create unique index if not exists assignment_submissions_assignment_user_uniq
  on public.assignment_submissions (assignment_id, user_id);

create index if not exists assignment_submissions_user
  on public.assignment_submissions (user_id, status);

comment on table public.assignment_submissions is
  'NET-NEW (2026-06-02): per-learner assignment response. Backs X-08 submission-rate.';


-- =====================================================================
-- Membership helper (private schema, SECURITY DEFINER, STABLE)
-- Mirrors the private.is_*_admin pattern. Avoids recursive RLS on org_members.
-- =====================================================================
create or replace function private.is_org_member(uid uuid, org uuid)
returns boolean
language sql
security definer
set search_path = public, pg_catalog
stable
as $$
  select exists (
    select 1 from public.org_members
    where user_id = uid and org_id = org
  );
$$;
revoke all on function private.is_org_member(uuid, uuid) from public;
grant execute on function private.is_org_member(uuid, uuid) to authenticated;
comment on function private.is_org_member(uuid, uuid) is
  'NET-NEW (2026-06-02): true if uid is a member of org. SECURITY DEFINER to avoid recursive org_members RLS.';

create or replace function private.is_org_manager(uid uuid, org uuid)
returns boolean
language sql
security definer
set search_path = public, pg_catalog
stable
as $$
  select exists (
    select 1 from public.org_members
    where user_id = uid and org_id = org and role in ('manager','owner')
  ) or private.is_platform_admin(uid);
$$;
revoke all on function private.is_org_manager(uuid, uuid) from public;
grant execute on function private.is_org_manager(uuid, uuid) to authenticated;
comment on function private.is_org_manager(uuid, uuid) is
  'NET-NEW (2026-06-02): true if uid is manager/owner of org, or platform_admin. SECURITY DEFINER.';


-- =====================================================================
-- RLS
-- =====================================================================

-- organizations : members read; managers/platform_admin write.
alter table public.organizations enable row level security;
alter table public.organizations force  row level security;

drop policy if exists organizations_member_select on public.organizations;
create policy organizations_member_select
  on public.organizations
  for select to authenticated
  using (
    private.is_org_member((select auth.uid()), id)
    or private.is_platform_admin((select auth.uid()))
  );

drop policy if exists organizations_manager_write on public.organizations;
create policy organizations_manager_write
  on public.organizations
  for all to authenticated
  using ( private.is_org_manager((select auth.uid()), id) )
  with check ( private.is_org_manager((select auth.uid()), id) );


-- org_members : a user sees their own membership rows + org managers see all
-- rows of orgs they manage. Managers may write membership.
alter table public.org_members enable row level security;
alter table public.org_members force  row level security;

drop policy if exists org_members_self_or_manager_select on public.org_members;
create policy org_members_self_or_manager_select
  on public.org_members
  for select to authenticated
  using (
    user_id = (select auth.uid())
    or private.is_org_manager((select auth.uid()), org_id)
  );

drop policy if exists org_members_manager_write on public.org_members;
create policy org_members_manager_write
  on public.org_members
  for all to authenticated
  using ( private.is_org_manager((select auth.uid()), org_id) )
  with check ( private.is_org_manager((select auth.uid()), org_id) );


-- assignments : org members read; managers write.
alter table public.assignments enable row level security;
alter table public.assignments force  row level security;

drop policy if exists assignments_member_select on public.assignments;
create policy assignments_member_select
  on public.assignments
  for select to authenticated
  using (
    private.is_org_member((select auth.uid()), org_id)
    or private.is_platform_admin((select auth.uid()))
  );

drop policy if exists assignments_manager_write on public.assignments;
create policy assignments_manager_write
  on public.assignments
  for all to authenticated
  using ( private.is_org_manager((select auth.uid()), org_id) )
  with check ( private.is_org_manager((select auth.uid()), org_id) );


-- assignment_submissions : learner owns their row; org managers read all rows
-- in assignments of orgs they manage.
alter table public.assignment_submissions enable row level security;
alter table public.assignment_submissions force  row level security;

drop policy if exists assignment_submissions_owner_select on public.assignment_submissions;
create policy assignment_submissions_owner_select
  on public.assignment_submissions
  for select to authenticated
  using (
    user_id = (select auth.uid())
    or exists (
      select 1 from public.assignments a
      where a.id = assignment_submissions.assignment_id
        and private.is_org_manager((select auth.uid()), a.org_id)
    )
  );

drop policy if exists assignment_submissions_owner_write on public.assignment_submissions;
create policy assignment_submissions_owner_write
  on public.assignment_submissions
  for all to authenticated
  using ( user_id = (select auth.uid()) )
  with check (
    user_id = (select auth.uid())
    -- learner may only respond to an assignment for an org they belong to,
    -- and may only attach their own writing_submission.
    and exists (
      select 1 from public.assignments a
      where a.id = assignment_submissions.assignment_id
        and private.is_org_member((select auth.uid()), a.org_id)
    )
    and (submission_id is null or exists (
      select 1 from public.writing_submissions s
      where s.id = assignment_submissions.submission_id
        and s.user_id = (select auth.uid())
    ))
  );
