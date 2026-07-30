-- Remove writing content from public.problems without changing the stable UUID
-- used by learner-owned rows. This migration deliberately fails closed when
-- the live FK graph or identity evidence differs from the audited baseline.

do $$
begin
  if to_regclass('public.topik_writing_question_source_map') is null
     or to_regprocedure(
       'public.get_available_writing_questions(smallint,uuid)'
     ) is null
     or to_regclass('private.writing_read_control') is null then
    raise exception 'writing_identity_cutover_prerequisite_missing';
  end if;
end
$$;

-- Keep exact pre-cutover definitions for the paired, evidence-preserving down.
create table if not exists private.writing_problem_cutover_function_backup (
  function_signature text primary key,
  function_definition text not null,
  owner_name text not null,
  captured_at timestamptz not null default now(),
  migration_version text not null
    default '20260714140000'
    check (migration_version = '20260714140000')
);

revoke all on table private.writing_problem_cutover_function_backup from public;
revoke all on table private.writing_problem_cutover_function_backup from anon;
revoke all on table private.writing_problem_cutover_function_backup from authenticated;
revoke all on table private.writing_problem_cutover_function_backup from service_role;

with target(signature) as (
  select unnest(array[
    'public.get_writing_runtime_state()',
    'public.set_writing_runtime_state(text,text,text,text,text,text)',
    'private.set_writing_runtime_state(text,text,text,text,text,text)',
    'private.is_writing_canonical_read_enabled()',
    'private.get_writing_submission_mode()',
    'public.is_writing_problem_visible_to_caller(uuid,smallint)',
    'private.is_writing_problem_visible_to_user(uuid,smallint,uuid)',
    'public.filter_visible_writing_problem_ids(uuid[])',
    'private.is_canonical_writing_problem_visible_to_user(uuid,uuid)',
    'public.get_writing_submission_history_context(uuid[])',
    'private.populate_writing_draft_question_snapshot()',
    'private.validate_writing_submission_canonical_context()',
    'public.list_user_problems(jsonb,text,integer,integer)',
    'public.list_user_library_problem_items()',
    'public.reconcile_active_writing_draft_versions(text,text)',
    'private.ensure_writing_problem_anchor(uuid,text,smallint)',
    'private.is_canonical_writing_problem_anchor(uuid)',
    'private.project_writing_mirror_learner_materials(jsonb,jsonb,smallint)',
    'private.writing_mirror_learner_projection_matches(uuid,jsonb)',
    'private.get_writing_question_snapshot_for_reconciliation(uuid,text,bigint,text,smallint)',
    'private.assert_writing_problem_submittable(uuid,smallint)',
    'private.assert_writing_problem_submittable_for_user(uuid,smallint,uuid)',
    'public.create_external_writing_submission(jsonb)',
    'private.assert_latest_writing_draft_reconciliation(text)',
    'private.guard_writing_runtime_transition()',
    'private.guard_writing_cron_retirement_snapshot()',
    'private.verify_writing_cron_retirement_event()',
    'public.sync_available_writing_problems()',
    'private.sync_available_writing_problems_legacy_impl()',
    'public.run_writing_mirror_rollback_sync(text,text)'
  ]::text[])
), resolved as (
  select target.signature, to_regprocedure(target.signature)::oid as function_oid
  from target
)
insert into private.writing_problem_cutover_function_backup (
  function_signature,
  function_definition,
  owner_name
)
select
  resolved.signature,
  pg_get_functiondef(resolved.function_oid),
  owner_role.rolname
from resolved
join pg_proc routine_row on routine_row.oid = resolved.function_oid
join pg_roles owner_role on owner_role.oid = routine_row.proowner
where resolved.function_oid is not null
on conflict (function_signature) do nothing;

do $$
declare
  v_signature text;
begin
  foreach v_signature in array array[
    'public.get_writing_runtime_state()',
    'public.set_writing_runtime_state(text,text,text,text,text,text)',
    'private.set_writing_runtime_state(text,text,text,text,text,text)',
    'private.is_writing_canonical_read_enabled()',
    'private.get_writing_submission_mode()',
    'public.is_writing_problem_visible_to_caller(uuid,smallint)',
    'private.is_writing_problem_visible_to_user(uuid,smallint,uuid)',
    'public.filter_visible_writing_problem_ids(uuid[])',
    'private.is_canonical_writing_problem_visible_to_user(uuid,uuid)',
    'public.get_writing_submission_history_context(uuid[])',
    'private.populate_writing_draft_question_snapshot()',
    'private.validate_writing_submission_canonical_context()',
    'public.list_user_problems(jsonb,text,integer,integer)',
    'public.list_user_library_problem_items()',
    'public.reconcile_active_writing_draft_versions(text,text)',
    'private.ensure_writing_problem_anchor(uuid,text,smallint)',
    'private.is_canonical_writing_problem_anchor(uuid)',
    'private.project_writing_mirror_learner_materials(jsonb,jsonb,smallint)',
    'private.writing_mirror_learner_projection_matches(uuid,jsonb)',
    'private.get_writing_question_snapshot_for_reconciliation(uuid,text,bigint,text,smallint)',
    'private.assert_writing_problem_submittable(uuid,smallint)',
    'private.assert_writing_problem_submittable_for_user(uuid,smallint,uuid)',
    'public.create_external_writing_submission(jsonb)',
    'private.assert_latest_writing_draft_reconciliation(text)',
    'private.guard_writing_runtime_transition()',
    'private.guard_writing_cron_retirement_snapshot()',
    'private.verify_writing_cron_retirement_event()',
    'public.sync_available_writing_problems()',
    'private.sync_available_writing_problems_legacy_impl()',
    'public.run_writing_mirror_rollback_sync(text,text)'
  ]::text[]
  loop
    if not exists (
      select 1
      from private.writing_problem_cutover_function_backup backup
      where backup.function_signature = v_signature
    ) then
      raise exception 'writing_cutover_function_backup_missing: %', v_signature;
    end if;
  end loop;
end
$$;

create table if not exists private.writing_problem_cutover_policy_backup (
  schemaname text not null,
  tablename text not null,
  policyname text not null,
  permissive text not null,
  roles text[] not null,
  command text not null,
  using_expression text,
  check_expression text,
  captured_at timestamptz not null default now(),
  primary key (schemaname, tablename, policyname)
);

revoke all on table private.writing_problem_cutover_policy_backup from public;
revoke all on table private.writing_problem_cutover_policy_backup from anon;
revoke all on table private.writing_problem_cutover_policy_backup from authenticated;
revoke all on table private.writing_problem_cutover_policy_backup from service_role;

insert into private.writing_problem_cutover_policy_backup (
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  command,
  using_expression,
  check_expression
)
select
  schemaname,
  tablename,
  policyname,
  permissive,
  roles::text[],
  cmd,
  qual,
  with_check
from pg_policies
where schemaname = 'public'
  and (tablename, policyname) in (
    ('problems', 'problems_visible_select'),
    ('problem_assets', 'problem_assets_select'),
    ('study_events', 'study_events_owner_insert'),
    ('library_items', 'library_items_owner_insert')
  )
on conflict (schemaname, tablename, policyname) do nothing;

do $$
begin
  if (
    select count(*)
    from private.writing_problem_cutover_policy_backup
  ) <> 4 then
    raise exception 'writing_cutover_policy_backup_incomplete';
  end if;
end
$$;

-- Stable identities outlive mutable catalog content. No application role may
-- read or write this private registry directly.
create table if not exists private.problem_identities (
  problem_id uuid primary key,
  domain text not null check (domain in ('reading', 'listening', 'writing')),
  identity_key text not null check (nullif(btrim(identity_key), '') is not null),
  lifecycle text not null default 'active'
    check (lifecycle in ('active', 'retired')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (domain, identity_key)
);

alter table private.problem_identities enable row level security;
alter table private.problem_identities force row level security;
revoke all on table private.problem_identities from public;
revoke all on table private.problem_identities from anon;
revoke all on table private.problem_identities from authenticated;
revoke all on table private.problem_identities from service_role;

create or replace function private.protect_problem_identity()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, private
as $$
begin
  if tg_op = 'DELETE' then
    raise exception 'problem_identity_hard_delete_forbidden';
  end if;

  if old.problem_id is distinct from new.problem_id
     or old.domain is distinct from new.domain
     or old.identity_key is distinct from new.identity_key
     or old.created_at is distinct from new.created_at then
    raise exception 'problem_identity_immutable';
  end if;

  new.updated_at := now();
  return new;
end;
$$;

revoke all on function private.protect_problem_identity() from public;
revoke all on function private.protect_problem_identity() from anon;
revoke all on function private.protect_problem_identity() from authenticated;
revoke all on function private.protect_problem_identity() from service_role;

drop trigger if exists problem_identities_immutable
  on private.problem_identities;
create trigger problem_identities_immutable
before update or delete on private.problem_identities
for each row execute function private.protect_problem_identity();

create or replace function private.register_problem_identity(
  p_problem_id uuid,
  p_domain text,
  p_identity_key text
)
returns uuid
language plpgsql
security definer
set search_path = pg_catalog, private
as $$
declare
  v_existing private.problem_identities%rowtype;
begin
  if p_problem_id is null
     or p_domain not in ('reading', 'listening', 'writing')
     or nullif(btrim(p_identity_key), '') is null then
    raise exception 'problem_identity_registration_invalid';
  end if;

  if p_domain = 'writing'
     and p_problem_id is distinct from (md5(btrim(p_identity_key)))::uuid then
    raise exception 'writing_problem_identity_must_equal_md5_question_id';
  end if;

  insert into private.problem_identities (
    problem_id,
    domain,
    identity_key
  ) values (
    p_problem_id,
    p_domain,
    btrim(p_identity_key)
  )
  on conflict (problem_id) do nothing;

  select *
    into v_existing
    from private.problem_identities identity_row
   where identity_row.problem_id = p_problem_id;

  if not found
     or v_existing.domain is distinct from p_domain
     or v_existing.identity_key is distinct from btrim(p_identity_key) then
    raise exception 'problem_identity_registration_conflict';
  end if;

  return p_problem_id;
end;
$$;

revoke all on function private.register_problem_identity(uuid, text, text) from public;
revoke all on function private.register_problem_identity(uuid, text, text) from anon;
revoke all on function private.register_problem_identity(uuid, text, text) from authenticated;
grant execute on function private.register_problem_identity(uuid, text, text) to service_role;

-- Admin promotions cross the domain boundary only through this narrow v13-owned
-- function. It accepts an identity after the canonical row and source-map pin
-- exist in the same transaction; the import row may still be transitioning to
-- `promoted` and is therefore validated by identity/version, not final status.
create or replace function private.ensure_writing_problem_identity(
  p_problem_id uuid,
  p_question_id text,
  p_item_number smallint
)
returns uuid
language plpgsql
security definer
set search_path = pg_catalog, public, private
as $$
declare
  v_question_id text := nullif(btrim(p_question_id), '');
begin
  if p_problem_id is null
     or v_question_id is null
     or p_item_number not in (51, 52, 53, 54)
     or p_problem_id is distinct from (md5(v_question_id))::uuid then
    raise exception 'writing_problem_identity_invalid';
  end if;

  if not exists (
    select 1
    from public.topik_writing_question_source_map source_map
    join public.topik_writing_question_import import_row
      on import_row.import_id = source_map.canonical_import_id
     and import_row.source_task_id = source_map.question_id
     and import_row.item_number = source_map.item_number
    join private.topik_writing_question_learner_projection question
      on question.question_id = source_map.question_id
     and question.item_number = source_map.item_number
    where source_map.question_id = v_question_id
      and source_map.item_number = p_item_number
      and source_map.learner_problem_id = p_problem_id
  ) then
    raise exception 'writing_problem_identity_canonical_pin_missing';
  end if;

  return private.register_problem_identity(
    p_problem_id,
    'writing',
    v_question_id
  );
end;
$$;

revoke all on function private.ensure_writing_problem_identity(uuid, text, smallint) from public;
revoke all on function private.ensure_writing_problem_identity(uuid, text, smallint) from anon;
revoke all on function private.ensure_writing_problem_identity(uuid, text, smallint) from authenticated;
grant execute on function private.ensure_writing_problem_identity(uuid, text, smallint) to service_role;

-- Every existing public problem is registered. Writing identity keys must be
-- canonical question_id values, never provenance-only legacy_problem_id.
insert into private.problem_identities (
  problem_id,
  domain,
  identity_key,
  lifecycle
)
select
  problem.id,
  problem.domain,
  case
    when problem.domain = 'writing'
      and source_map.question_id is not null
      and problem.id = (md5(source_map.question_id))::uuid
      then source_map.question_id
    when problem.domain = 'writing'
      then 'legacy-public.problems:' || problem.id::text
    else 'public.problems:' || problem.id::text
  end,
  case
    when problem.domain = 'writing'
      and source_map.question_id is not null
      and problem.id = (md5(source_map.question_id))::uuid
      then 'active'
    when problem.domain = 'writing' then 'retired'
    else 'active'
  end
from public.problems problem
left join lateral (
  select map.question_id
  from public.topik_writing_question_source_map map
  where map.learner_problem_id = problem.id
  order by map.question_id
  limit 1
) source_map on problem.domain = 'writing'
on conflict (problem_id) do nothing;

insert into private.problem_identities (problem_id, domain, identity_key)
select
  source_map.learner_problem_id,
  'writing',
  source_map.question_id
from public.topik_writing_question_source_map source_map
where source_map.learner_problem_id is not null
on conflict (problem_id) do nothing;

do $$
declare
  v_count bigint;
begin
  select count(*) into v_count
  from public.problems problem
  left join private.problem_identities identity_row
    on identity_row.problem_id = problem.id
   and identity_row.domain = problem.domain
  where identity_row.problem_id is null
     or (
       problem.domain = 'writing'
       and not (
         (
           identity_row.lifecycle = 'active'
           and identity_row.problem_id = (md5(identity_row.identity_key))::uuid
         )
         or (
           identity_row.lifecycle = 'retired'
           and identity_row.identity_key =
             'legacy-public.problems:' || problem.id::text
           and not exists (
             select 1
             from public.topik_writing_question_source_map source_map
             where source_map.learner_problem_id = problem.id
           )
         )
       )
     );
  if v_count <> 0 then
    raise exception 'existing_problem_identity_backfill_incomplete: %', v_count;
  end if;

  select count(*) into v_count
  from public.topik_writing_question_source_map source_map
  left join private.problem_identities identity_row
    on identity_row.problem_id = source_map.learner_problem_id
   and identity_row.domain = 'writing'
   and identity_row.identity_key = source_map.question_id
  where source_map.learner_problem_id is null
     or source_map.learner_problem_id is distinct from
       (md5(source_map.question_id))::uuid
     or identity_row.problem_id is null;
  if v_count <> 0 then
    raise exception 'canonical_writing_identity_backfill_incomplete: %', v_count;
  end if;
end
$$;

-- Exact mirror rows are retained privately so down can restore their original
-- bytes. Canonical content is never used to fabricate a historical row.
create table if not exists private.writing_problem_cutover_backup (
  problem_id uuid primary key,
  problem_row jsonb not null,
  row_hash text not null,
  backed_up_at timestamptz not null default now(),
  migration_version text not null
    default '20260714140000'
    check (migration_version = '20260714140000'),
  check (row_hash = md5(problem_row::text))
);

alter table private.writing_problem_cutover_backup enable row level security;
alter table private.writing_problem_cutover_backup force row level security;
revoke all on table private.writing_problem_cutover_backup from public;
revoke all on table private.writing_problem_cutover_backup from anon;
revoke all on table private.writing_problem_cutover_backup from authenticated;
revoke all on table private.writing_problem_cutover_backup from service_role;

insert into private.writing_problem_cutover_backup (
  problem_id,
  problem_row,
  row_hash
)
select problem.id, to_jsonb(problem), md5(to_jsonb(problem)::text)
from public.problems problem
where problem.domain = 'writing'
on conflict (problem_id) do nothing;

do $$
declare
  v_count bigint;
begin
  select count(*) into v_count
  from public.problems problem
  left join private.writing_problem_cutover_backup backup
    on backup.problem_id = problem.id
   and backup.problem_row = to_jsonb(problem)
   and backup.row_hash = md5(to_jsonb(problem)::text)
  where problem.domain = 'writing'
    and backup.problem_id is null;
  if v_count <> 0 then
    raise exception 'writing_problem_backup_incomplete: %', v_count;
  end if;
end
$$;

-- Legacy rows receive a separate snapshot. Do not populate canonical IDs,
-- import IDs, hashes, or question_snapshot without exact canonical evidence.
alter table public.writing_drafts
  add column if not exists legacy_cutover_snapshot jsonb;
alter table public.writing_submissions
  add column if not exists legacy_cutover_snapshot jsonb;

create or replace function private.build_writing_legacy_cutover_snapshot(
  p_problem_id uuid
)
returns jsonb
language sql
stable
security definer
set search_path = pg_catalog, public, private
as $$
  select jsonb_strip_nulls(jsonb_build_object(
    'snapshot_source', 'legacy_cutover',
    'problem_id', problem.id,
    'question_id', source_map.question_id,
    'item_number', problem.question_no,
    'topik_level', problem.topik_level,
    'difficulty', problem.difficulty,
    'title', problem.title,
    'prompt', problem.prompt,
    'tags', coalesce(problem.tags, '{}'::text[]),
    'materials', case
      when learner.question_id is null then '{}'::jsonb
      else private.project_writing_mirror_learner_materials(
        problem.materials,
        learner.materials,
        problem.question_no
      )
    end
  ))
  from public.problems problem
  left join public.topik_writing_question_source_map source_map
    on source_map.learner_problem_id = problem.id
   and source_map.item_number = problem.question_no
  left join private.topik_writing_question_learner_projection learner
    on learner.question_id = source_map.question_id
   and learner.item_number = source_map.item_number
  where problem.id = p_problem_id
    and problem.domain = 'writing'
  limit 1
$$;

revoke all on function private.build_writing_legacy_cutover_snapshot(uuid) from public;
revoke all on function private.build_writing_legacy_cutover_snapshot(uuid) from anon;
revoke all on function private.build_writing_legacy_cutover_snapshot(uuid) from authenticated;
revoke all on function private.build_writing_legacy_cutover_snapshot(uuid) from service_role;

create or replace function private.protect_writing_legacy_cutover_snapshot()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog
as $$
begin
  if tg_op = 'INSERT' and new.legacy_cutover_snapshot is not null then
    raise exception 'legacy_cutover_snapshot_server_backfill_only';
  end if;
  if tg_op = 'UPDATE'
     and old.legacy_cutover_snapshot is not null
     and new.legacy_cutover_snapshot is distinct from old.legacy_cutover_snapshot then
    raise exception 'legacy_cutover_snapshot_immutable';
  end if;
  if tg_op = 'UPDATE'
     and old.legacy_cutover_snapshot is null
     and new.legacy_cutover_snapshot is not null
     and current_setting('app.writing_legacy_snapshot_backfill', true)
       is distinct from 'on' then
    raise exception 'legacy_cutover_snapshot_server_backfill_only';
  end if;
  return new;
end;
$$;

revoke all on function private.protect_writing_legacy_cutover_snapshot() from public;
revoke all on function private.protect_writing_legacy_cutover_snapshot() from anon;
revoke all on function private.protect_writing_legacy_cutover_snapshot() from authenticated;
revoke all on function private.protect_writing_legacy_cutover_snapshot() from service_role;

drop trigger if exists writing_drafts_legacy_cutover_snapshot_immutable
  on public.writing_drafts;
create trigger writing_drafts_legacy_cutover_snapshot_immutable
before insert or update of legacy_cutover_snapshot on public.writing_drafts
for each row execute function private.protect_writing_legacy_cutover_snapshot();

drop trigger if exists writing_submissions_legacy_cutover_snapshot_immutable
  on public.writing_submissions;
create trigger writing_submissions_legacy_cutover_snapshot_immutable
before insert or update of legacy_cutover_snapshot on public.writing_submissions
for each row execute function private.protect_writing_legacy_cutover_snapshot();

select set_config('app.writing_legacy_snapshot_backfill', 'on', true);

update public.writing_drafts draft
set legacy_cutover_snapshot =
  private.build_writing_legacy_cutover_snapshot(draft.problem_id)
where draft.legacy_cutover_snapshot is null
  and (
    draft.canonical_question_id is null
    or draft.canonical_import_id is null
    or draft.canonical_payload_hash is null
    or draft.question_snapshot is null
  );

update public.writing_submissions submission
set legacy_cutover_snapshot =
  private.build_writing_legacy_cutover_snapshot(submission.problem_id)
where submission.legacy_cutover_snapshot is null
  and (
    submission.canonical_question_id is null
    or submission.canonical_import_id is null
    or submission.canonical_payload_hash is null
    or submission.question_snapshot is null
  );

select set_config('app.writing_legacy_snapshot_backfill', 'off', true);

alter table public.writing_drafts
  drop constraint if exists writing_drafts_cutover_history_context_present;
alter table public.writing_drafts
  add constraint writing_drafts_cutover_history_context_present
  check (
    (
      canonical_question_id is not null
      and canonical_import_id is not null
      and canonical_payload_hash is not null
      and jsonb_typeof(question_snapshot) = 'object'
    )
    or (
      jsonb_typeof(legacy_cutover_snapshot) = 'object'
      and legacy_cutover_snapshot->>'snapshot_source' = 'legacy_cutover'
      and not private.jsonb_has_forbidden_writing_snapshot_key(
        legacy_cutover_snapshot
      )
    )
  ) not valid;
alter table public.writing_drafts
  validate constraint writing_drafts_cutover_history_context_present;

alter table public.writing_submissions
  drop constraint if exists writing_submissions_cutover_history_context_present;
alter table public.writing_submissions
  add constraint writing_submissions_cutover_history_context_present
  check (
    (
      canonical_question_id is not null
      and canonical_import_id is not null
      and canonical_payload_hash is not null
      and jsonb_typeof(question_snapshot) = 'object'
    )
    or (
      jsonb_typeof(legacy_cutover_snapshot) = 'object'
      and legacy_cutover_snapshot->>'snapshot_source' = 'legacy_cutover'
      and not private.jsonb_has_forbidden_writing_snapshot_key(
        legacy_cutover_snapshot
      )
    )
  ) not valid;
alter table public.writing_submissions
  validate constraint writing_submissions_cutover_history_context_present;

comment on column public.writing_drafts.legacy_cutover_snapshot is
  'Immutable learner-safe legacy_cutover snapshot. It is not canonical version evidence.';
comment on column public.writing_submissions.legacy_cutover_snapshot is
  'Immutable learner-safe legacy_cutover snapshot. It is not canonical version evidence.';

-- Capture and retarget the complete audited FK graph. Any additional FK to
-- public.problems aborts the migration so no dependent row is silently missed.
create table if not exists private.writing_problem_cutover_fk_backup (
  source_table text not null,
  source_column text not null,
  constraint_name text not null,
  constraint_definition text not null,
  delete_action "char" not null,
  update_action "char" not null,
  match_type "char" not null,
  is_deferrable boolean not null,
  initially_deferred boolean not null,
  captured_at timestamptz not null default now(),
  primary key (source_table, constraint_name)
);

revoke all on table private.writing_problem_cutover_fk_backup from public;
revoke all on table private.writing_problem_cutover_fk_backup from anon;
revoke all on table private.writing_problem_cutover_fk_backup from authenticated;
revoke all on table private.writing_problem_cutover_fk_backup from service_role;

create temporary table expected_writing_problem_fk (
  source_table regclass primary key,
  source_column text not null,
  required boolean not null
) on commit drop;

insert into expected_writing_problem_fk values
  ('public.problem_assets'::regclass, 'problem_id', true),
  ('public.problem_attempts'::regclass, 'problem_id', true),
  ('public.writing_drafts'::regclass, 'problem_id', true),
  ('public.writing_submissions'::regclass, 'problem_id', true),
  ('public.recommendation_items'::regclass, 'problem_id', true),
  ('public.library_items'::regclass, 'problem_id', true),
  ('public.study_events'::regclass, 'problem_id', true),
  ('public.pdf_export_quota_usages'::regclass, 'problem_id', true),
  ('public.pdf_export_quota_resets'::regclass, 'problem_id', true),
  ('public.writing_submission_metrics'::regclass, 'problem_id', true);

do $$
begin
  if to_regclass('public.assignments') is not null then
    insert into expected_writing_problem_fk values
      ('public.assignments'::regclass, 'problem_id', false);
  end if;
end
$$;

do $$
declare
  v_expected record;
  v_actual_count integer;
  v_unexpected_count integer;
  v_fk record;
  v_new_name text;
  v_match_clause text;
  v_update_clause text;
  v_delete_clause text;
  v_deferrable_clause text;
begin
  for v_expected in select * from expected_writing_problem_fk loop
    select count(*) into v_actual_count
    from pg_constraint constraint_row
    join pg_attribute source_attribute
      on source_attribute.attrelid = constraint_row.conrelid
     and source_attribute.attnum = constraint_row.conkey[1]
    where constraint_row.contype = 'f'
      and constraint_row.conrelid = v_expected.source_table
      and constraint_row.confrelid = 'public.problems'::regclass
      and cardinality(constraint_row.conkey) = 1
      and cardinality(constraint_row.confkey) = 1
      and source_attribute.attname = v_expected.source_column;

    if v_actual_count <> 1 then
      raise exception 'expected_problem_fk_count_mismatch: %.% count=%',
        v_expected.source_table::text,
        v_expected.source_column,
        v_actual_count;
    end if;
  end loop;

  select count(*) into v_unexpected_count
  from pg_constraint constraint_row
  left join expected_writing_problem_fk expected
    on expected.source_table = constraint_row.conrelid
  left join pg_attribute source_attribute
    on source_attribute.attrelid = constraint_row.conrelid
   and source_attribute.attnum = constraint_row.conkey[1]
  where constraint_row.contype = 'f'
    and constraint_row.confrelid = 'public.problems'::regclass
    and (
      expected.source_table is null
      or cardinality(constraint_row.conkey) <> 1
      or cardinality(constraint_row.confkey) <> 1
      or source_attribute.attname is distinct from expected.source_column
    );

  if v_unexpected_count <> 0 then
    raise exception 'unexpected_public_problems_fk_detected: %',
      v_unexpected_count;
  end if;

  insert into private.writing_problem_cutover_fk_backup (
    source_table,
    source_column,
    constraint_name,
    constraint_definition,
    delete_action,
    update_action,
    match_type,
    is_deferrable,
    initially_deferred
  )
  select
    format('%I.%I', source_namespace.nspname, source_relation.relname),
    source_attribute.attname,
    constraint_row.conname,
    pg_get_constraintdef(constraint_row.oid, true),
    constraint_row.confdeltype,
    constraint_row.confupdtype,
    constraint_row.confmatchtype,
    constraint_row.condeferrable,
    constraint_row.condeferred
  from pg_constraint constraint_row
  join pg_attribute source_attribute
    on source_attribute.attrelid = constraint_row.conrelid
   and source_attribute.attnum = constraint_row.conkey[1]
  join pg_class source_relation
    on source_relation.oid = constraint_row.conrelid
  join pg_namespace source_namespace
    on source_namespace.oid = source_relation.relnamespace
  where constraint_row.contype = 'f'
    and constraint_row.confrelid = 'public.problems'::regclass
  on conflict (source_table, constraint_name) do nothing;

  for v_fk in
    select *
    from private.writing_problem_cutover_fk_backup
    order by source_table, constraint_name
  loop
    v_new_name := left(v_fk.constraint_name, 44)
      || '_identity_' || substr(md5(v_fk.source_table || v_fk.constraint_name), 1, 8);
    v_match_clause := case v_fk.match_type
      when 'f' then ' MATCH FULL'
      when 'p' then ' MATCH PARTIAL'
      else ''
    end;
    v_update_clause := case v_fk.update_action
      when 'a' then ' ON UPDATE NO ACTION'
      when 'r' then ' ON UPDATE RESTRICT'
      when 'c' then ' ON UPDATE CASCADE'
      when 'n' then ' ON UPDATE SET NULL'
      when 'd' then ' ON UPDATE SET DEFAULT'
    end;
    v_delete_clause := case v_fk.delete_action
      when 'a' then ' ON DELETE NO ACTION'
      when 'r' then ' ON DELETE RESTRICT'
      when 'c' then ' ON DELETE CASCADE'
      when 'n' then ' ON DELETE SET NULL'
      when 'd' then ' ON DELETE SET DEFAULT'
    end;
    v_deferrable_clause := case
      when not v_fk.is_deferrable then ' NOT DEFERRABLE'
      when v_fk.initially_deferred then ' DEFERRABLE INITIALLY DEFERRED'
      else ' DEFERRABLE INITIALLY IMMEDIATE'
    end;

    execute format(
      'alter table %s add constraint %I foreign key (%I) references private.problem_identities(problem_id)%s%s%s%s not valid',
      v_fk.source_table,
      v_new_name,
      v_fk.source_column,
      v_match_clause,
      v_update_clause,
      v_delete_clause,
      v_deferrable_clause
    );
    execute format(
      'alter table %s validate constraint %I',
      v_fk.source_table,
      v_new_name
    );
    execute format(
      'alter table %s drop constraint %I',
      v_fk.source_table,
      v_fk.constraint_name
    );
    execute format(
      'alter table %s rename constraint %I to %I',
      v_fk.source_table,
      v_new_name,
      v_fk.constraint_name
    );
  end loop;

  if exists (
    select 1
    from pg_constraint constraint_row
    where constraint_row.contype = 'f'
      and constraint_row.confrelid = 'public.problems'::regclass
  ) then
    raise exception 'public_problems_fk_remains_after_identity_cutover';
  end if;
end
$$;

-- The read source is no longer switchable. Keep only a fail-closed submission
-- control. This migration cannot enable canonical submission; a later verified
-- provider/outbox migration must replace the evidence guard first.
drop trigger if exists writing_runtime_transition_serialization
  on private.writing_read_control;
drop trigger if exists writing_cron_retirement_snapshot_guard
  on private.writing_cron_definition_snapshot;
drop trigger if exists writing_cron_retirement_event_guard
  on private.writing_scheduler_event;

alter table private.writing_read_control
  rename to writing_read_control_retired_20260714;

create table private.writing_submission_control (
  singleton boolean primary key default true check (singleton),
  submission_mode text not null default 'blocked'
    check (submission_mode in ('blocked', 'canonical')),
  submission_contract_state text not null default 'unverified'
    check (submission_contract_state in (
      'unverified',
      'provider_verified',
      'local_outbox_verified'
    )),
  changed_by text not null,
  reason_hash text not null,
  evidence_id text,
  changed_at timestamptz not null default now(),
  constraint writing_submission_control_evidence_shape check (
    submission_mode = 'blocked'
    or (
      submission_mode = 'canonical'
      and submission_contract_state in (
        'provider_verified',
        'local_outbox_verified'
      )
      and nullif(btrim(evidence_id), '') is not null
    )
  )
);

alter table private.writing_submission_control enable row level security;
alter table private.writing_submission_control force row level security;
revoke all on table private.writing_submission_control from public;
revoke all on table private.writing_submission_control from anon;
revoke all on table private.writing_submission_control from authenticated;
revoke all on table private.writing_submission_control from service_role;

insert into private.writing_submission_control (
  singleton,
  submission_mode,
  submission_contract_state,
  changed_by,
  reason_hash,
  evidence_id
) values (
  true,
  'blocked',
  'unverified',
  'migration',
  md5('writing_identity_registry_cutover'),
  '20260714140000'
);

create table private.writing_submission_control_audit (
  audit_id bigint generated always as identity primary key,
  old_submission_mode text,
  old_submission_contract_state text,
  new_submission_mode text not null,
  new_submission_contract_state text not null,
  actor text not null,
  reason_hash text not null,
  evidence_id text,
  changed_at timestamptz not null default now()
);

alter table private.writing_submission_control_audit enable row level security;
alter table private.writing_submission_control_audit force row level security;
revoke all on table private.writing_submission_control_audit from public;
revoke all on table private.writing_submission_control_audit from anon;
revoke all on table private.writing_submission_control_audit from authenticated;
revoke all on table private.writing_submission_control_audit from service_role;

insert into private.writing_submission_control_audit (
  new_submission_mode,
  new_submission_contract_state,
  actor,
  reason_hash,
  evidence_id
) values (
  'blocked',
  'unverified',
  'migration',
  md5('writing_identity_registry_cutover'),
  '20260714140000'
);

create or replace function private.guard_writing_submission_control()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog
as $$
begin
  if new.submission_mode = 'canonical' then
    raise exception 'canonical_submission_evidence_guard_not_installed';
  end if;
  return new;
end;
$$;

revoke all on function private.guard_writing_submission_control() from public;
revoke all on function private.guard_writing_submission_control() from anon;
revoke all on function private.guard_writing_submission_control() from authenticated;
revoke all on function private.guard_writing_submission_control() from service_role;

create trigger writing_submission_control_fail_closed
before insert or update on private.writing_submission_control
for each row execute function private.guard_writing_submission_control();

create or replace function public.get_writing_submission_control()
returns table (
  submission_mode text,
  submission_contract_state text
)
language sql
stable
security definer
set search_path = pg_catalog, private
as $$
  select
    control.submission_mode,
    control.submission_contract_state
  from private.writing_submission_control control
  where control.singleton
$$;

revoke all on function public.get_writing_submission_control() from public;
revoke all on function public.get_writing_submission_control() from anon;
grant execute on function public.get_writing_submission_control() to authenticated;
grant execute on function public.get_writing_submission_control() to service_role;

create or replace function private.get_writing_submission_mode()
returns text
language sql
stable
security definer
set search_path = pg_catalog, private
as $$
  select coalesce(
    (
      select control.submission_mode
      from private.writing_submission_control control
      where control.singleton
    ),
    'blocked'
  )
$$;

revoke all on function private.get_writing_submission_mode() from public;
revoke all on function private.get_writing_submission_mode() from anon;
grant execute on function private.get_writing_submission_mode() to authenticated;
grant execute on function private.get_writing_submission_mode() to service_role;

create or replace function public.set_writing_submission_state(
  p_submission_mode text,
  p_submission_contract_state text,
  p_actor text,
  p_reason text,
  p_evidence_id text default null
)
returns void
language plpgsql
security definer
set search_path = pg_catalog, private
as $$
declare
  v_old private.writing_submission_control%rowtype;
begin
  if p_submission_mode not in ('blocked', 'canonical') then
    raise exception 'writing_submission_mode_invalid';
  end if;
  if p_submission_contract_state not in (
    'unverified',
    'provider_verified',
    'local_outbox_verified'
  ) then
    raise exception 'writing_submission_contract_state_invalid';
  end if;
  if nullif(btrim(p_actor), '') is null
     or nullif(btrim(p_reason), '') is null then
    raise exception 'writing_submission_state_actor_reason_required';
  end if;
  if p_submission_mode = 'canonical' then
    raise exception 'canonical_submission_evidence_guard_not_installed';
  end if;

  select * into v_old
  from private.writing_submission_control control
  where control.singleton
  for update;

  update private.writing_submission_control
  set submission_mode = 'blocked',
      submission_contract_state = p_submission_contract_state,
      changed_by = btrim(p_actor),
      reason_hash = md5(btrim(p_reason)),
      evidence_id = nullif(btrim(p_evidence_id), ''),
      changed_at = now()
  where singleton;

  insert into private.writing_submission_control_audit (
    old_submission_mode,
    old_submission_contract_state,
    new_submission_mode,
    new_submission_contract_state,
    actor,
    reason_hash,
    evidence_id
  ) values (
    v_old.submission_mode,
    v_old.submission_contract_state,
    'blocked',
    p_submission_contract_state,
    btrim(p_actor),
    md5(btrim(p_reason)),
    nullif(btrim(p_evidence_id), '')
  );
end;
$$;

revoke all on function public.set_writing_submission_state(text, text, text, text, text) from public;
revoke all on function public.set_writing_submission_state(text, text, text, text, text) from anon;
revoke all on function public.set_writing_submission_state(text, text, text, text, text) from authenticated;
grant execute on function public.set_writing_submission_state(text, text, text, text, text) to service_role;

-- Visibility resolves canonical identity and current learner-safe availability,
-- never mirror materials.
create or replace function public.is_writing_problem_visible_to_caller(
  p_problem_id uuid,
  p_question_no smallint
)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public
as $$
  select (select auth.uid()) is not null
    and exists (
      select 1
      from public.get_available_writing_questions(
        p_question_no,
        p_problem_id
      ) canonical
    )
$$;

revoke all on function public.is_writing_problem_visible_to_caller(uuid, smallint) from public;
revoke all on function public.is_writing_problem_visible_to_caller(uuid, smallint) from anon;
grant execute on function public.is_writing_problem_visible_to_caller(uuid, smallint) to authenticated;

create or replace function private.is_writing_problem_visible_to_user(
  p_problem_id uuid,
  p_question_no smallint,
  p_user_id uuid
)
returns boolean
language plpgsql
stable
security definer
set search_path = pg_catalog, public, private
as $$
declare
  v_question_id text;
  v_affiliation_code text;
begin
  if p_user_id is null then
    return false;
  end if;

  select source_map.question_id
    into v_question_id
    from public.topik_writing_question_source_map source_map
    join private.topik_writing_question_learner_projection question
      on question.question_id = source_map.question_id
     and question.item_number = source_map.item_number
     and question.service_status = 'available'
   where source_map.learner_problem_id = p_problem_id
     and source_map.item_number = p_question_no
   limit 1;

  if v_question_id is null then
    return false;
  end if;

  select nullif(btrim(profile.affiliation_code), '')
    into v_affiliation_code
    from public.profiles profile
   where profile.id = p_user_id;

  if v_affiliation_code is null then
    return true;
  end if;
  if to_regclass(
    'public.topik_writing_question_institution_exposure'
  ) is null then
    return false;
  end if;

  return exists (
    select 1
    from public.topik_writing_question_institution_exposure exposure
    where exposure.question_id = v_question_id
      and exposure.item_number = p_question_no
      and exposure.institution_code = v_affiliation_code
  );
end;
$$;

revoke all on function private.is_writing_problem_visible_to_user(uuid, smallint, uuid) from public;
revoke all on function private.is_writing_problem_visible_to_user(uuid, smallint, uuid) from anon;
revoke all on function private.is_writing_problem_visible_to_user(uuid, smallint, uuid) from authenticated;
grant execute on function private.is_writing_problem_visible_to_user(uuid, smallint, uuid) to service_role;

create or replace function public.filter_visible_writing_problem_ids(
  p_problem_ids uuid[]
)
returns table (problem_id uuid)
language sql
stable
security definer
set search_path = pg_catalog, public
as $$
  select source_map.learner_problem_id
  from public.topik_writing_question_source_map source_map
  where source_map.learner_problem_id = any(coalesce(p_problem_ids, '{}'::uuid[]))
    and public.is_writing_problem_visible_to_caller(
      source_map.learner_problem_id,
      source_map.item_number
    )
$$;

revoke all on function public.filter_visible_writing_problem_ids(uuid[]) from public;
revoke all on function public.filter_visible_writing_problem_ids(uuid[]) from anon;
grant execute on function public.filter_visible_writing_problem_ids(uuid[]) to authenticated;

create or replace function private.is_canonical_writing_problem_visible_to_user(
  p_problem_id uuid,
  p_user_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public
as $$
  select p_user_id is not null
    and p_user_id = (select auth.uid())
    and exists (
      select 1
      from private.problem_identities identity_row
      where identity_row.problem_id = p_problem_id
        and identity_row.domain = 'writing'
        and identity_row.lifecycle = 'active'
    )
    and exists (
      select 1
      from public.get_available_writing_questions(null, p_problem_id)
    )
$$;

revoke all on function private.is_canonical_writing_problem_visible_to_user(uuid, uuid) from public;
revoke all on function private.is_canonical_writing_problem_visible_to_user(uuid, uuid) from anon;
grant execute on function private.is_canonical_writing_problem_visible_to_user(uuid, uuid) to authenticated;

create or replace function public.get_writing_submission_history_context(
  p_submission_ids uuid[]
)
returns table (
  submission_id uuid,
  problem_id uuid,
  question_no smallint,
  title text
)
language sql
stable
security definer
set search_path = pg_catalog, public
as $$
  select
    submission.id,
    submission.problem_id,
    submission.question_no,
    coalesce(
      nullif(btrim(submission.question_snapshot->>'title'), ''),
      nullif(btrim(submission.legacy_cutover_snapshot->>'title'), '')
    )
  from public.writing_submissions submission
  where submission.user_id = (select auth.uid())
    and submission.id = any(coalesce(p_submission_ids, '{}'::uuid[]))
$$;

revoke all on function public.get_writing_submission_history_context(uuid[]) from public;
revoke all on function public.get_writing_submission_history_context(uuid[]) from anon;
grant execute on function public.get_writing_submission_history_context(uuid[]) to authenticated;

create or replace function private.populate_writing_draft_question_snapshot()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public, private
as $$
declare
  v_is_writing boolean;
begin
  select identity_row.domain = 'writing'
    and identity_row.lifecycle = 'active'
    into v_is_writing
    from private.problem_identities identity_row
   where identity_row.problem_id = new.problem_id;

  if not coalesce(v_is_writing, false) then
    raise exception 'writing_draft_problem_identity_invalid';
  end if;

  if new.autosave_status <> 'superseded' and (
    nullif(btrim(new.canonical_question_id), '') is null
    or new.canonical_import_id is null
    or nullif(btrim(new.canonical_payload_hash), '') is null
  ) then
    raise exception 'canonical_draft_context_required';
  end if;

  if new.canonical_question_id is null then
    new.question_snapshot := null;
    return new;
  end if;

  new.question_snapshot := private.get_writing_question_snapshot_from_catalog(
    new.problem_id,
    new.canonical_question_id,
    new.canonical_import_id,
    new.canonical_payload_hash,
    new.question_no,
    new.user_id
  );

  if private.jsonb_has_forbidden_writing_snapshot_key(new.question_snapshot) then
    raise exception 'canonical_snapshot_contains_forbidden_key';
  end if;
  return new;
end;
$$;

revoke all on function private.populate_writing_draft_question_snapshot() from public;
revoke all on function private.populate_writing_draft_question_snapshot() from anon;
revoke all on function private.populate_writing_draft_question_snapshot() from authenticated;
revoke all on function private.populate_writing_draft_question_snapshot() from service_role;

create or replace function private.validate_writing_submission_canonical_context()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public, private
as $$
declare
  v_is_writing boolean;
  v_submission_mode text;
  v_contract_state text;
begin
  select identity_row.domain = 'writing'
    and identity_row.lifecycle = 'active'
    into v_is_writing
    from private.problem_identities identity_row
   where identity_row.problem_id = new.problem_id;

  if not coalesce(v_is_writing, false) then
    raise exception 'writing_submission_problem_identity_invalid';
  end if;

  select control.submission_mode, control.submission_contract_state
    into v_submission_mode, v_contract_state
    from private.writing_submission_control control
   where control.singleton;

  if v_submission_mode is distinct from 'canonical' then
    raise exception 'writing_submission_temporarily_blocked';
  end if;
  if v_contract_state not in ('provider_verified', 'local_outbox_verified') then
    raise exception 'canonical_submission_contract_evidence_required';
  end if;
  if nullif(btrim(new.canonical_question_id), '') is null
     or new.canonical_import_id is null
     or nullif(btrim(new.canonical_payload_hash), '') is null
     or jsonb_typeof(new.question_snapshot) is distinct from 'object' then
    raise exception 'canonical_submission_context_required';
  end if;
  if new.question_snapshot->>'question_id' is distinct from new.canonical_question_id
     or (new.question_snapshot->>'canonical_import_id')::bigint
       is distinct from new.canonical_import_id
     or new.question_snapshot->>'payload_hash'
       is distinct from new.canonical_payload_hash
     or (new.question_snapshot->>'item_number')::smallint
       is distinct from new.question_no then
    raise exception 'canonical_snapshot_identity_mismatch';
  end if;
  if private.jsonb_has_forbidden_writing_snapshot_key(new.question_snapshot) then
    raise exception 'canonical_snapshot_contains_forbidden_key';
  end if;

  perform private.assert_writing_question_submittable(
    new.problem_id,
    new.canonical_question_id,
    new.canonical_import_id,
    new.canonical_payload_hash,
    new.question_no,
    new.user_id
  );
  perform private.assert_writing_submission_snapshot_matches_catalog(
    new.problem_id,
    new.canonical_question_id,
    new.canonical_import_id,
    new.canonical_payload_hash,
    new.question_no,
    new.user_id,
    new.question_snapshot
  );
  return new;
end;
$$;

revoke all on function private.validate_writing_submission_canonical_context() from public;
revoke all on function private.validate_writing_submission_canonical_context() from anon;
revoke all on function private.validate_writing_submission_canonical_context() from authenticated;
revoke all on function private.validate_writing_submission_canonical_context() from service_role;

-- Rewrite only the catalog CTEs of the two large consumer RPCs. The migration
-- verifies the expected markers and the absence of retired read helpers before
-- executing the resulting CREATE OR REPLACE definitions.
do $$
declare
  v_definition text;
  v_start integer;
  v_end integer;
  v_catalog text;
begin
  v_definition := pg_get_functiondef(
    'public.list_user_problems(jsonb,text,integer,integer)'::regprocedure
  );
  v_start := strpos(v_definition, '  with catalog as (');
  v_end := strpos(v_definition, '  visible as (');
  if v_start = 0 or v_end <= v_start then
    raise exception 'list_user_problems_catalog_shape_changed';
  end if;

  v_catalog := $catalog$  with catalog as (
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
$catalog$;

  v_definition := left(v_definition, v_start - 1)
    || v_catalog
    || substr(v_definition, v_end);
  if v_definition like '%is_writing_canonical_read_enabled%'
     or v_definition like '%is_canonical_writing_problem_anchor%' then
    raise exception 'list_user_problems_retired_read_dependency_remains';
  end if;
  execute v_definition;

  v_definition := pg_get_functiondef(
    'public.list_user_library_problem_items()'::regprocedure
  );
  v_start := strpos(v_definition, '  with writing_catalog as (');
  v_end := strpos(v_definition, '  saved_problem_items as (');
  if v_start = 0 or v_end <= v_start then
    raise exception 'list_user_library_catalog_shape_changed';
  end if;

  v_catalog := $catalog$  with writing_catalog as (
    select
      canonical.problem_id as id,
      canonical.title,
      canonical.item_number as question_no,
      'published'::text as publish_status,
      'public'::text as visibility,
      'active'::text as lifecycle_status,
      null::text as lifecycle_reason,
      true as institution_visible
    from public.get_available_writing_questions(null, null) canonical
  ),
$catalog$;

  v_definition := left(v_definition, v_start - 1)
    || v_catalog
    || substr(v_definition, v_end);
  if v_definition like '%is_writing_canonical_read_enabled%'
     or v_definition like '%is_canonical_writing_problem_anchor%'
     or v_definition like '%problem.domain = ''writing''%' then
    raise exception 'list_user_library_retired_read_dependency_remains';
  end if;
  execute v_definition;
end
$$;

drop policy if exists problems_visible_select on public.problems;
create policy problems_visible_select
  on public.problems
  for select to authenticated
  using (
    domain <> 'writing'
    and (
      private.is_admin((select auth.uid()))
      or author_id = (select auth.uid())
      or (
        publish_status = 'published'
        and visibility = 'public'
      )
    )
  );

drop policy if exists problem_assets_select on public.problem_assets;
create policy problem_assets_select
  on public.problem_assets
  for select to authenticated
  using (
    private.is_admin((select auth.uid()))
    or exists (
      select 1
      from public.problems problem
      where problem.id = problem_assets.problem_id
        and problem.domain <> 'writing'
        and (
          problem.author_id = (select auth.uid())
          or (
            problem.publish_status = 'published'
            and problem.visibility = 'public'
          )
        )
    )
    or private.is_canonical_writing_problem_visible_to_user(
      problem_assets.problem_id,
      (select auth.uid())
    )
  );

drop policy if exists study_events_owner_insert on public.study_events;
create policy study_events_owner_insert
  on public.study_events
  for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and (
      problem_id is null
      or exists (
        select 1
        from public.problems problem
        where problem.id = study_events.problem_id
          and problem.domain <> 'writing'
          and (
            problem.author_id = (select auth.uid())
            or (
              problem.publish_status = 'published'
              and problem.visibility = 'public'
            )
          )
      )
      or private.is_canonical_writing_problem_visible_to_user(
        study_events.problem_id,
        (select auth.uid())
      )
    )
    and (
      submission_id is null
      or exists (
        select 1
        from public.writing_submissions submission
        where submission.id = study_events.submission_id
          and submission.user_id = (select auth.uid())
      )
    )
    and (
      attempt_id is null
      or exists (
        select 1
        from public.problem_attempts attempt
        where attempt.id = study_events.attempt_id
          and attempt.user_id = (select auth.uid())
      )
    )
  );

drop policy if exists library_items_owner_insert on public.library_items;
create policy library_items_owner_insert
  on public.library_items
  for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and (
      (item_type = 'attempt' and exists (
        select 1
        from public.problem_attempts attempt
        where attempt.id = library_items.attempt_id
          and attempt.user_id = (select auth.uid())
      ))
      or (item_type = 'submission' and exists (
        select 1
        from public.writing_submissions submission
        where submission.id = library_items.submission_id
          and submission.user_id = (select auth.uid())
      ))
      or (item_type = 'report' and exists (
        select 1
        from public.comparison_reports report
        where report.id = library_items.report_id
          and report.user_id = (select auth.uid())
      ))
      or (item_type = 'export' and exists (
        select 1
        from public.export_files export_file
        where export_file.id = library_items.export_id
          and export_file.user_id = (select auth.uid())
      ))
      or (
        item_type = 'problem'
        and exists (
          select 1
          from public.problems problem
          where problem.id = library_items.problem_id
            and problem.domain <> 'writing'
            and (
              problem.author_id = (select auth.uid())
              or (
                problem.publish_status = 'published'
                and problem.visibility = 'public'
              )
            )
        )
      )
      or (
        item_type = 'problem'
        and private.is_canonical_writing_problem_visible_to_user(
          library_items.problem_id,
          (select auth.uid())
        )
      )
    )
  );

-- Writing rows can never re-enter public.problems. Non-writing rows keep a
-- registry identity automatically so all retargeted FKs remain valid.
create or replace function private.guard_public_problem_catalog()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog
as $$
begin
  if new.domain = 'writing' then
    raise exception 'writing_content_forbidden_in_public_problems';
  end if;
  if tg_op = 'UPDATE' and new.domain is distinct from old.domain then
    raise exception 'public_problem_domain_immutable_after_identity_cutover';
  end if;
  if tg_op = 'UPDATE' and new.id is distinct from old.id then
    raise exception 'public_problem_id_immutable_after_identity_cutover';
  end if;
  return new;
end;
$$;

revoke all on function private.guard_public_problem_catalog() from public;
revoke all on function private.guard_public_problem_catalog() from anon;
revoke all on function private.guard_public_problem_catalog() from authenticated;
revoke all on function private.guard_public_problem_catalog() from service_role;

create or replace function private.sync_public_problem_identity()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, private
as $$
declare
  v_identity private.problem_identities%rowtype;
begin
  if tg_op = 'INSERT' then
    insert into private.problem_identities (
      problem_id,
      domain,
      identity_key
    ) values (
      new.id,
      new.domain,
      'public.problems:' || new.id::text
    )
    on conflict (problem_id) do nothing;

    select * into v_identity
    from private.problem_identities identity_row
    where identity_row.problem_id = new.id;
    if v_identity.domain is distinct from new.domain
       or v_identity.identity_key is distinct from
         'public.problems:' || new.id::text then
      raise exception 'public_problem_identity_conflict';
    end if;
    return new;
  end if;

  if old.domain <> 'writing' then
    update private.problem_identities
    set lifecycle = 'retired'
    where problem_id = old.id;
  end if;
  return old;
end;
$$;

revoke all on function private.sync_public_problem_identity() from public;
revoke all on function private.sync_public_problem_identity() from anon;
revoke all on function private.sync_public_problem_identity() from authenticated;
revoke all on function private.sync_public_problem_identity() from service_role;

-- The registry FK is required for writing history after its catalog row is
-- removed, but non-writing callers must keep the delete behaviour that their
-- original public.problems FK declared. Reproduce that behaviour before a
-- non-writing catalog row is deleted. Writing rows are deliberately exempt:
-- their dependent history has already moved to immutable row snapshots.
create or replace function private.preserve_public_problem_delete_semantics()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, private
as $$
declare
  v_fk private.writing_problem_cutover_fk_backup%rowtype;
  v_has_reference boolean;
begin
  if old.domain = 'writing' then
    return old;
  end if;

  for v_fk in
    select *
    from private.writing_problem_cutover_fk_backup
    order by source_table, constraint_name
  loop
    if v_fk.delete_action = 'c' then
      execute format(
        'delete from %s where %I = $1',
        v_fk.source_table,
        v_fk.source_column
      ) using old.id;
    elsif v_fk.delete_action = 'n' then
      execute format(
        'update %s set %I = null where %I = $1',
        v_fk.source_table,
        v_fk.source_column,
        v_fk.source_column
      ) using old.id;
    elsif v_fk.delete_action = 'd' then
      execute format(
        'update %s set %I = default where %I = $1',
        v_fk.source_table,
        v_fk.source_column,
        v_fk.source_column
      ) using old.id;
    elsif v_fk.delete_action in ('a', 'r') then
      execute format(
        'select exists (select 1 from %s where %I = $1)',
        v_fk.source_table,
        v_fk.source_column
      ) into v_has_reference using old.id;
      if v_has_reference then
        raise foreign_key_violation using
          message = format(
            'nonwriting_problem_delete_restricted: %s.%s',
            v_fk.source_table,
            v_fk.source_column
          );
      end if;
    end if;
  end loop;
  return old;
end;
$$;

revoke all on function private.preserve_public_problem_delete_semantics() from public;
revoke all on function private.preserve_public_problem_delete_semantics() from anon;
revoke all on function private.preserve_public_problem_delete_semantics() from authenticated;
revoke all on function private.preserve_public_problem_delete_semantics() from service_role;

drop trigger if exists public_problems_reject_writing
  on public.problems;
create trigger public_problems_reject_writing
before insert or update of id, domain on public.problems
for each row execute function private.guard_public_problem_catalog();

drop trigger if exists public_problems_register_identity
  on public.problems;
create trigger public_problems_register_identity
after insert on public.problems
for each row execute function private.sync_public_problem_identity();

drop trigger if exists public_problems_preserve_delete_semantics
  on public.problems;
create trigger public_problems_preserve_delete_semantics
before delete on public.problems
for each row execute function private.preserve_public_problem_delete_semantics();

drop trigger if exists public_problems_retire_identity
  on public.problems;
create trigger public_problems_retire_identity
after delete on public.problems
for each row execute function private.sync_public_problem_identity();

-- Remove every v13 mirror/read-mode entrypoint without CASCADE. An unexpected
-- dependency aborts here and leaves public.problems untouched.
drop function if exists public.set_writing_runtime_state(
  text, text, text, text, text, text
);
drop function if exists public.get_writing_runtime_state();
drop function if exists private.set_writing_runtime_state(
  text, text, text, text, text, text
);
drop function if exists private.is_writing_canonical_read_enabled();
drop function if exists private.is_canonical_writing_problem_anchor(uuid);

drop function if exists public.create_external_writing_submission(jsonb);
drop function if exists private.assert_writing_problem_submittable(uuid, smallint);
drop function if exists private.assert_writing_problem_submittable_for_user(
  uuid, smallint, uuid
);

drop function if exists private.guard_writing_runtime_transition();
drop function if exists private.guard_writing_cron_retirement_snapshot();
drop function if exists private.verify_writing_cron_retirement_event();
drop function if exists private.assert_latest_writing_draft_reconciliation(text);
drop function if exists public.reconcile_active_writing_draft_versions(text, text);

drop function if exists public.run_writing_mirror_rollback_sync(text, text);
drop function if exists public.sync_available_writing_problems();
drop function if exists private.sync_available_writing_problems_legacy_impl();
drop function if exists private.ensure_writing_problem_anchor(uuid, text, smallint);

drop function if exists private.writing_mirror_learner_projection_matches(uuid, jsonb);
drop function if exists private.get_writing_question_snapshot_for_reconciliation(
  uuid, text, bigint, text, smallint
);
drop function if exists private.build_writing_legacy_cutover_snapshot(uuid);
drop function if exists private.project_writing_mirror_learner_materials(
  jsonb, jsonb, smallint
);

-- Prove that no unclassified routine or view still reads writing content from
-- public.problems. The admin-owned parity diagnostic is historical evidence,
-- not an application dependency, and is the only explicit exception.
do $$
declare
  v_routine_count integer;
  v_view_count integer;
begin
  select count(*) into v_routine_count
  from pg_proc routine_row
  join pg_namespace namespace_row on namespace_row.oid = routine_row.pronamespace
  where namespace_row.nspname in ('public', 'private')
    and routine_row.prokind in ('f', 'p')
    and routine_row.oid::regprocedure::text is distinct from
      'private.assert_writing_canonical_content_parity()'
    and pg_get_functiondef(routine_row.oid) ~* E'(problem|p)\\.domain\\s*=\\s*''writing''';

  if v_routine_count <> 0 then
    raise exception 'unresolved_writing_content_routine_dependency: %',
      v_routine_count;
  end if;

  select count(*) into v_view_count
  from pg_views view_row
  where view_row.schemaname in ('public', 'private')
    and view_row.definition ~* E'(problem|p)\\.domain\\s*=\\s*''writing''';
  if v_view_count <> 0 then
    raise exception 'unresolved_writing_content_view_dependency: %',
      v_view_count;
  end if;
end
$$;

-- Final deletion gates. At this point every dependent UUID targets the private
-- registry and every legacy user row has independent learner-safe history.
do $$
declare
  v_count bigint;
begin
  select count(*) into v_count
  from public.problems problem
  left join private.writing_problem_cutover_backup backup
    on backup.problem_id = problem.id
   and backup.problem_row = to_jsonb(problem)
   and backup.row_hash = md5(to_jsonb(problem)::text)
  left join private.problem_identities identity_row
    on identity_row.problem_id = problem.id
   and identity_row.domain = 'writing'
  where problem.domain = 'writing'
    and (backup.problem_id is null or identity_row.problem_id is null);
  if v_count <> 0 then
    raise exception 'writing_problem_delete_evidence_incomplete: %', v_count;
  end if;

  -- Only source-map-pinned mirror rows belong to this catalog cutover. Abort
  -- instead of deleting an author-owned, AI-generated, or otherwise
  -- unclassified writing row that happens to share the legacy domain.
  select count(*) into v_count
  from public.problems problem
  where problem.domain = 'writing'
    and not exists (
      select 1
      from public.topik_writing_question_source_map source_map
      where source_map.learner_problem_id = problem.id
    );
  if v_count <> 0 then
    raise exception 'writing_problem_delete_source_map_unclassified: %',
      v_count;
  end if;

  select count(*) into v_count
  from public.writing_drafts draft
  where not (
    (
      draft.canonical_question_id is not null
      and draft.canonical_import_id is not null
      and draft.canonical_payload_hash is not null
      and jsonb_typeof(draft.question_snapshot) = 'object'
    )
    or (
      jsonb_typeof(draft.legacy_cutover_snapshot) = 'object'
      and draft.legacy_cutover_snapshot->>'snapshot_source' = 'legacy_cutover'
    )
  );
  if v_count <> 0 then
    raise exception 'writing_draft_history_context_incomplete: %', v_count;
  end if;

  select count(*) into v_count
  from public.writing_submissions submission
  where not (
    (
      submission.canonical_question_id is not null
      and submission.canonical_import_id is not null
      and submission.canonical_payload_hash is not null
      and jsonb_typeof(submission.question_snapshot) = 'object'
    )
    or (
      jsonb_typeof(submission.legacy_cutover_snapshot) = 'object'
      and submission.legacy_cutover_snapshot->>'snapshot_source' = 'legacy_cutover'
    )
  );
  if v_count <> 0 then
    raise exception 'writing_submission_history_context_incomplete: %', v_count;
  end if;

  if exists (
    select 1
    from pg_constraint constraint_row
    where constraint_row.contype = 'f'
      and constraint_row.confrelid = 'public.problems'::regclass
  ) then
    raise exception 'public_problems_fk_reappeared_before_delete';
  end if;
end
$$;

delete from public.problems problem
where problem.domain = 'writing'
  and exists (
    select 1
    from public.topik_writing_question_source_map source_map
    where source_map.learner_problem_id = problem.id
  );

do $$
begin
  if exists (
    select 1 from public.problems problem where problem.domain = 'writing'
  ) then
    raise exception 'writing_problem_rows_remain_after_cutover';
  end if;
end
$$;

comment on table private.problem_identities is
  'Content-independent problem UUID registry. Active writing identity is md5(question_id)::uuid. Pre-canonical unmapped rows are retained as retired legacy identities; all rows are immutable and never hard-deleted.';
comment on table private.writing_problem_cutover_backup is
  'Exact private backup of deleted writing public.problems rows. Required for honest rollback; canonical content must never fabricate legacy rows.';
comment on table private.writing_submission_control is
  'Submission-only fail-closed control after canonical reads became permanent. This migration cannot enable canonical submissions.';
