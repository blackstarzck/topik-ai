-- Preserve the latest Admin learning-analytics coverage contract after the
-- writing mirror is removed. The prior 20260714090000 migration is immutable:
-- it was already applied in dev before the coverage-aware analytics migration
-- reached origin/main. This corrective migration rewrites only the current
-- filtered RPC definition and keeps its response/coverage shape unchanged.

do $$
begin
  if to_regclass('private.admin_writing_question_metadata') is null then
    raise exception 'missing admin dependency: admin_writing_question_metadata';
  end if;
  if to_regprocedure(
    'public.get_admin_learning_analytics_filtered(date,date,smallint[],text,text,jsonb,boolean)'
  ) is null then
    raise exception 'missing admin dependency: get_admin_learning_analytics_filtered';
  end if;
end
$$;

create table private.admin_writing_analytics_coverage_rollback_function (
  singleton boolean primary key default true check (singleton),
  function_definition text not null
);

revoke all on table private.admin_writing_analytics_coverage_rollback_function from public;
revoke all on table private.admin_writing_analytics_coverage_rollback_function from anon;
revoke all on table private.admin_writing_analytics_coverage_rollback_function from authenticated;
revoke all on table private.admin_writing_analytics_coverage_rollback_function from service_role;

insert into private.admin_writing_analytics_coverage_rollback_function (
  singleton,
  function_definition
)
select
  true,
  pg_get_functiondef(
    to_regprocedure(
      'public.get_admin_learning_analytics_filtered(date,date,smallint[],text,text,jsonb,boolean)'
    )
  );

create table private.admin_writing_historical_identity_aliases (
  problem_id uuid primary key,
  question_id text not null check (nullif(btrim(question_id), '') is not null),
  item_number smallint not null check (item_number in (51, 52, 53, 54)),
  captured_at timestamptz not null default now(),
  unique (question_id, item_number, problem_id)
);

alter table private.admin_writing_historical_identity_aliases enable row level security;
alter table private.admin_writing_historical_identity_aliases force row level security;
revoke all on table private.admin_writing_historical_identity_aliases from public;
revoke all on table private.admin_writing_historical_identity_aliases from anon;
revoke all on table private.admin_writing_historical_identity_aliases from authenticated;
revoke all on table private.admin_writing_historical_identity_aliases from service_role;

insert into private.admin_writing_historical_identity_aliases (
  problem_id,
  question_id,
  item_number
)
select
  alias.problem_id,
  alias.question_id,
  alias.item_number
from public.topik_writing_problem_question_map alias
join public.topik_writing_question_recommendation_view canonical
  on canonical.question_id = alias.question_id
 and canonical.item_number = alias.item_number
where alias.mapping_status = 'active'
  and alias.hold_reason is null
  and not exists (
    select 1
    from private.admin_writing_question_metadata current_identity
    where current_identity.problem_id = alias.problem_id
  );

comment on table private.admin_writing_historical_identity_aliases is
  'Immutable Admin-owned snapshot of resolved pre-cutover writing problem identities. Runtime analytics does not depend on the public environment alias map.';

create view private.admin_writing_question_identity_map
with (security_invoker = true)
as
select
  metadata.problem_id,
  metadata.question_id,
  metadata.item_number,
  'canonical'::text as mapping_kind,
  'active'::text as mapping_status,
  null::text as hold_reason
from private.admin_writing_question_metadata metadata
union all
select
  alias.problem_id,
  alias.question_id,
  alias.item_number,
  'legacy'::text as mapping_kind,
  'active'::text as mapping_status,
  null::text as hold_reason
from private.admin_writing_historical_identity_aliases alias;

revoke all on private.admin_writing_question_identity_map from public;
revoke all on private.admin_writing_question_identity_map from anon;
revoke all on private.admin_writing_question_identity_map from authenticated;
revoke all on private.admin_writing_question_identity_map from service_role;

comment on view private.admin_writing_question_identity_map is
  'Admin-only current and migrated historical identity mapping used by coverage-aware learning analytics after the writing mirror is removed.';

create view private.admin_writing_problem_identity_projection
with (security_invoker = true)
as
select
  identity.problem_id,
  identity.item_number
from private.admin_writing_question_identity_map identity;

revoke all on private.admin_writing_problem_identity_projection from public;
revoke all on private.admin_writing_problem_identity_projection from anon;
revoke all on private.admin_writing_problem_identity_projection from authenticated;
revoke all on private.admin_writing_problem_identity_projection from service_role;

comment on view private.admin_writing_problem_identity_projection is
  'Minimal private replacement for writing identity and item-number joins formerly served by public.problems.';

do $$
begin
  if exists (
    select 1
    from public.writing_submissions submission
    left join private.admin_writing_question_identity_map identity
      on identity.problem_id = submission.problem_id
     and identity.item_number = submission.question_no
    where identity.problem_id is null
  ) then
    raise exception 'historical writing submission identity coverage incomplete';
  end if;

  if exists (
    select 1
    from public.writing_drafts draft
    left join private.admin_writing_question_identity_map identity
      on identity.problem_id = draft.problem_id
     and identity.item_number = draft.question_no
    where identity.problem_id is null
  ) then
    raise exception 'historical writing draft identity coverage incomplete';
  end if;
end
$$;

do $$
declare
  v_identity regprocedure := to_regprocedure(
    'public.get_admin_learning_analytics_filtered(date,date,smallint[],text,text,jsonb,boolean)'
  );
  v_definition text;
begin
  select pg_get_functiondef(v_identity) into v_definition;

  if position('submission_metadata_facts as' in v_definition) = 0
     or position('event_metadata_coverage as' in v_definition) = 0
     or position('metadata_coverage as' in v_definition) = 0
     or position(
       'from public.topik_writing_problem_question_map pm' in v_definition
     ) = 0
     or position('public.problems mapped_problem' in v_definition) = 0
     or position('public.problems problem' in v_definition) = 0
     or position('public.problems source_problem' in v_definition) = 0 then
    raise exception 'unexpected coverage analytics definition; refusing canonical rewrite';
  end if;

  v_definition := replace(
    v_definition,
    'from public.topik_writing_problem_question_map pm',
    'from private.admin_writing_question_identity_map pm'
  );
  v_definition := replace(
    v_definition,
    'public.problems mapped_problem',
    'private.admin_writing_problem_identity_projection mapped_problem'
  );
  v_definition := replace(
    v_definition,
    'public.problems problem',
    'private.admin_writing_problem_identity_projection problem'
  );
  v_definition := replace(
    v_definition,
    'public.problems source_problem',
    'private.admin_writing_problem_identity_projection source_problem'
  );
  v_definition := replace(v_definition, 'problem.id', 'problem.problem_id');
  v_definition := replace(
    v_definition,
    'problem.question_no',
    'problem.item_number'
  );

  if position('public.problems' in v_definition) > 0
     or position(
       'public.topik_writing_problem_question_map' in v_definition
     ) > 0
     or position(
       'from private.admin_writing_question_identity_map pm' in v_definition
     ) = 0
     or position(
       'private.admin_writing_problem_identity_projection problem' in v_definition
     ) = 0
     or position('problem.item_number' in v_definition) = 0
     or position('submission_metadata_facts as' in v_definition) = 0
     or position('event_metadata_coverage as' in v_definition) = 0 then
    raise exception 'coverage analytics canonical rewrite incomplete';
  end if;

  execute v_definition;
end
$$;
