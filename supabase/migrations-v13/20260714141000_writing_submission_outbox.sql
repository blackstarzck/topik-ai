-- Durable provider-dispatch intent/outbox for canonical writing submissions.
-- Apply after 20260714140000. The migration installs the evidence contract but
-- leaves submission_mode=blocked; an operator must explicitly activate the
-- verified local outbox through public.set_writing_submission_state(...).

do $$
begin
  if to_regclass('private.problem_identities') is null
     or to_regclass('private.writing_submission_control') is null
     or to_regprocedure(
       'public.get_writing_submission_control()'
     ) is null then
    raise exception 'writing_outbox_cutover_prerequisite_missing';
  end if;
  if exists (
    select 1
    from pg_catalog.pg_attribute attribute_row
    where attribute_row.attrelid = 'public.writing_submissions'::regclass
      and attribute_row.attname = 'external_submission_id'
      and not attribute_row.attisdropped
  ) then
    raise exception 'writing_submission_external_id_column_preexisting';
  end if;
end
$$;

-- Operators need to exercise the real durable-intent RPCs before they can
-- truthfully certify the outbox. `verification` opens only those service-role
-- RPCs; the application still accepts submissions exclusively in the
-- canonical + local_outbox_verified state.
do $$
declare
  v_constraint record;
begin
  for v_constraint in
    select constraint_row.conname
    from pg_catalog.pg_constraint constraint_row
    where constraint_row.conrelid =
        'private.writing_submission_control'::regclass
      and constraint_row.contype = 'c'
      and constraint_row.conname like
        'writing_submission_control_submission_mode_check%'
  loop
    execute format(
      'alter table private.writing_submission_control drop constraint %I',
      v_constraint.conname
    );
  end loop;
end
$$;
alter table private.writing_submission_control
  add constraint writing_submission_control_submission_mode_check
  check (submission_mode in ('blocked', 'verification', 'canonical'));

alter table private.writing_submission_control
  drop constraint if exists writing_submission_control_evidence_shape;
alter table private.writing_submission_control
  add constraint writing_submission_control_evidence_shape check (
    submission_mode = 'blocked'
    or (
      submission_mode = 'verification'
      and submission_contract_state = 'unverified'
      and evidence_id is null
    )
    or (
      submission_mode = 'canonical'
      and submission_contract_state = 'local_outbox_verified'
      and nullif(btrim(evidence_id), '') is not null
    )
  );

create table private.writing_outbox_function_backup (
  function_signature text primary key,
  function_definition text not null,
  owner_name text not null,
  captured_at timestamptz not null default now(),
  migration_version text not null default '20260714141000'
    check (migration_version = '20260714141000')
);

revoke all on table private.writing_outbox_function_backup from public;
revoke all on table private.writing_outbox_function_backup from anon;
revoke all on table private.writing_outbox_function_backup from authenticated;
revoke all on table private.writing_outbox_function_backup from service_role;

with target(signature) as (
  select unnest(array[
    'private.guard_writing_submission_control()',
    'public.set_writing_submission_state(text,text,text,text,text)',
    'private.validate_writing_submission_canonical_context()',
    'public.create_external_writing_submission_v2(jsonb)'
  ]::text[])
), resolved as (
  select signature, to_regprocedure(signature)::oid as function_oid
  from target
)
insert into private.writing_outbox_function_backup (
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
join pg_roles owner_role on owner_role.oid = routine_row.proowner;

do $$
begin
  if (select count(*) from private.writing_outbox_function_backup) <> 4 then
    raise exception 'writing_outbox_function_backup_incomplete';
  end if;
end
$$;

create table private.writing_outbox_grant_backup (
  object_signature text primary key,
  service_role_had_execute boolean not null
);

revoke all on table private.writing_outbox_grant_backup from public;
revoke all on table private.writing_outbox_grant_backup from anon;
revoke all on table private.writing_outbox_grant_backup from authenticated;
revoke all on table private.writing_outbox_grant_backup from service_role;

insert into private.writing_outbox_grant_backup values (
  'public.create_external_writing_submission_v2(jsonb)',
  has_function_privilege(
    'service_role',
    'public.create_external_writing_submission_v2(jsonb)',
    'EXECUTE'
  )
);

alter table public.writing_submissions
  add column external_submission_id text;

update public.writing_submissions
set external_submission_id = id::text
where external_submission_id is null;

alter table public.writing_submissions
  alter column external_submission_id set not null;
alter table public.writing_submissions
  drop constraint if exists writing_submissions_external_submission_id_key;
alter table public.writing_submissions
  add constraint writing_submissions_external_submission_id_key
  unique (external_submission_id);

create table private.writing_submission_intents (
  intent_id uuid primary key,
  local_submission_id uuid not null unique,
  provider_dispatch_key text not null unique,
  materialization_token uuid not null default gen_random_uuid() unique,
  dedup_key text not null,
  user_id uuid not null references public.profiles(id) on delete cascade,
  problem_id uuid not null
    references private.problem_identities(problem_id) on delete restrict,
  draft_id uuid not null
    references public.writing_drafts(id) on delete restrict,
  question_no smallint not null check (question_no in (51, 52, 53, 54)),
  answer_text text not null check (length(answer_text) > 0),
  answer_json jsonb,
  answer_hash text not null check (answer_hash ~ '^[0-9a-f]{64}$'),
  char_count integer not null check (char_count >= 0),
  parent_submission_id uuid
    references public.writing_submissions(id) on delete set null,
  canonical_question_id text not null
    check (nullif(btrim(canonical_question_id), '') is not null),
  canonical_import_id bigint not null
    references public.topik_writing_question_import(import_id) on delete restrict,
  canonical_payload_hash text not null
    check (nullif(btrim(canonical_payload_hash), '') is not null),
  question_snapshot jsonb not null
    check (jsonb_typeof(question_snapshot) = 'object'),
  state text not null default 'pending'
    check (state in (
      'pending',
      'dispatching',
      'accepted',
      'ambiguous',
      'failed',
      'materialized'
    )),
  attempt_count integer not null default 0 check (attempt_count >= 0),
  external_submission_id text unique,
  provider_status text,
  reason_code text,
  claimed_at timestamptz,
  accepted_at timestamptz,
  terminal_at timestamptz,
  materialized_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint writing_submission_intent_local_id check (
    local_submission_id = intent_id
  ),
  constraint writing_submission_intent_dispatch_key check (
    provider_dispatch_key = intent_id::text
  ),
  constraint writing_submission_intent_terminal_shape check (
    (
      state in ('pending', 'dispatching')
      and external_submission_id is null
      and reason_code is null
    )
    or (
      state in ('accepted', 'materialized')
      and nullif(btrim(external_submission_id), '') is not null
      and nullif(btrim(provider_status), '') is not null
      and reason_code is null
    )
    or (
      state in ('ambiguous', 'failed')
      and nullif(btrim(reason_code), '') is not null
      and external_submission_id is null
    )
  ),
  constraint writing_submission_intent_snapshot_safe check (
    not private.jsonb_has_forbidden_writing_snapshot_key(question_snapshot)
  )
);

create index writing_submission_intents_state_created_idx
  on private.writing_submission_intents (state, created_at);
create index writing_submission_intents_user_created_idx
  on private.writing_submission_intents (user_id, created_at desc);
create unique index writing_submission_intents_active_dedup_unique
  on private.writing_submission_intents (dedup_key)
  where state <> 'failed';

alter table private.writing_submission_intents enable row level security;
alter table private.writing_submission_intents force row level security;
revoke all on table private.writing_submission_intents from public;
revoke all on table private.writing_submission_intents from anon;
revoke all on table private.writing_submission_intents from authenticated;
revoke all on table private.writing_submission_intents from service_role;

create table private.writing_submission_intent_audit (
  audit_id bigint generated always as identity primary key,
  intent_id uuid not null,
  old_state text,
  new_state text not null,
  attempt_count integer not null,
  external_id_hash text,
  provider_status text,
  reason_code text,
  occurred_at timestamptz not null default now()
);

alter table private.writing_submission_intent_audit enable row level security;
alter table private.writing_submission_intent_audit force row level security;
revoke all on table private.writing_submission_intent_audit from public;
revoke all on table private.writing_submission_intent_audit from anon;
revoke all on table private.writing_submission_intent_audit from authenticated;
revoke all on table private.writing_submission_intent_audit from service_role;

create table private.writing_submission_contract_evidence (
  evidence_id text primary key,
  evidence_type text not null check (evidence_type = 'local_outbox_verified'),
  contract_digest text not null check (contract_digest ~ '^[0-9a-f]{64}$'),
  verification_report_hash text not null
    check (verification_report_hash ~ '^[0-9a-f]{64}$'),
  verified_by text not null,
  reason_hash text not null,
  verified_at timestamptz not null default now()
);

alter table private.writing_submission_contract_evidence enable row level security;
alter table private.writing_submission_contract_evidence force row level security;
revoke all on table private.writing_submission_contract_evidence from public;
revoke all on table private.writing_submission_contract_evidence from anon;
revoke all on table private.writing_submission_contract_evidence from authenticated;
revoke all on table private.writing_submission_contract_evidence from service_role;

create or replace function private.protect_writing_submission_contract_evidence()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog
as $$
begin
  raise exception 'writing_submission_contract_evidence_immutable';
end;
$$;

revoke all on function private.protect_writing_submission_contract_evidence() from public;
revoke all on function private.protect_writing_submission_contract_evidence() from anon;
revoke all on function private.protect_writing_submission_contract_evidence() from authenticated;
revoke all on function private.protect_writing_submission_contract_evidence() from service_role;

create trigger writing_submission_contract_evidence_immutable
before update or delete on private.writing_submission_contract_evidence
for each row execute function private.protect_writing_submission_contract_evidence();

create or replace function private.writing_outbox_contract_digest()
returns text
language sql
immutable
set search_path = pg_catalog
as $$
  select encode(sha256(convert_to(
    'writing-outbox-v2|prepare|claim-once|accepted-recovery|ambiguous-no-retry|confirmed-failure-new-intent|external-text-id|local-intent-uuid',
    'UTF8'
  )), 'hex')
$$;

revoke all on function private.writing_outbox_contract_digest() from public;
revoke all on function private.writing_outbox_contract_digest() from anon;
revoke all on function private.writing_outbox_contract_digest() from authenticated;
revoke all on function private.writing_outbox_contract_digest() from service_role;

create or replace function private.writing_submission_answer_hash(
  p_answer_text text,
  p_answer_json jsonb
)
returns text
language sql
immutable
set search_path = pg_catalog
as $$
  select encode(sha256(convert_to(jsonb_build_object(
    'answer_text', p_answer_text,
    'answer_json', coalesce(p_answer_json, 'null'::jsonb)
  )::text, 'UTF8')), 'hex')
$$;

revoke all on function private.writing_submission_answer_hash(text, jsonb) from public;
revoke all on function private.writing_submission_answer_hash(text, jsonb) from anon;
revoke all on function private.writing_submission_answer_hash(text, jsonb) from authenticated;
revoke all on function private.writing_submission_answer_hash(text, jsonb) from service_role;

create or replace function private.writing_submission_intent_result(
  p_intent private.writing_submission_intents,
  p_should_dispatch boolean
)
returns jsonb
language sql
stable
security definer
set search_path = pg_catalog
as $$
  select jsonb_strip_nulls(jsonb_build_object(
    'intent_id', p_intent.intent_id,
    'state', p_intent.state,
    'should_dispatch', p_should_dispatch,
    'local_submission_id', p_intent.local_submission_id,
    'external_submission_id', p_intent.external_submission_id,
    'provider_dispatch_key', p_intent.provider_dispatch_key,
    'answer_hash', p_intent.answer_hash,
    'canonical_question_id', p_intent.canonical_question_id,
    'canonical_import_id', p_intent.canonical_import_id,
    'canonical_payload_hash', p_intent.canonical_payload_hash,
    'attempt_count', p_intent.attempt_count,
    'last_error_code', p_intent.reason_code
  ))
$$;

revoke all on function private.writing_submission_intent_result(private.writing_submission_intents, boolean) from public;
revoke all on function private.writing_submission_intent_result(private.writing_submission_intents, boolean) from anon;
revoke all on function private.writing_submission_intent_result(private.writing_submission_intents, boolean) from authenticated;
revoke all on function private.writing_submission_intent_result(private.writing_submission_intents, boolean) from service_role;

create or replace function private.protect_writing_submission_intent()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog
as $$
begin
  if old.intent_id is distinct from new.intent_id
     or old.local_submission_id is distinct from new.local_submission_id
     or old.provider_dispatch_key is distinct from new.provider_dispatch_key
     or old.materialization_token is distinct from new.materialization_token
     or old.dedup_key is distinct from new.dedup_key
     or old.user_id is distinct from new.user_id
     or old.problem_id is distinct from new.problem_id
     or old.draft_id is distinct from new.draft_id
     or old.question_no is distinct from new.question_no
     or old.answer_text is distinct from new.answer_text
     or old.answer_json is distinct from new.answer_json
     or old.answer_hash is distinct from new.answer_hash
     or old.char_count is distinct from new.char_count
     or old.parent_submission_id is distinct from new.parent_submission_id
     or old.canonical_question_id is distinct from new.canonical_question_id
     or old.canonical_import_id is distinct from new.canonical_import_id
     or old.canonical_payload_hash is distinct from new.canonical_payload_hash
     or old.question_snapshot is distinct from new.question_snapshot
     or old.created_at is distinct from new.created_at then
    raise exception 'writing_submission_intent_payload_immutable';
  end if;

  if old.state is distinct from new.state and not (
    (old.state = 'pending' and new.state in ('dispatching', 'failed'))
    or (old.state = 'dispatching' and new.state in (
      'accepted', 'ambiguous', 'failed'
    ))
    or (old.state = 'accepted' and new.state = 'materialized')
    or (old.state = 'ambiguous' and new.state in ('accepted', 'failed'))
  ) then
    raise exception 'writing_submission_intent_transition_invalid: % -> %',
      old.state,
      new.state;
  end if;

  if old.state is not distinct from new.state and (
    old.attempt_count is distinct from new.attempt_count
    or old.external_submission_id is distinct from
      new.external_submission_id
    or old.provider_status is distinct from new.provider_status
    or old.reason_code is distinct from new.reason_code
    or old.claimed_at is distinct from new.claimed_at
    or old.accepted_at is distinct from new.accepted_at
    or old.terminal_at is distinct from new.terminal_at
    or old.materialized_at is distinct from new.materialized_at
  ) then
    raise exception 'writing_submission_intent_state_fields_immutable';
  end if;

  if old.state = 'pending' and new.state = 'dispatching'
     and new.attempt_count <> old.attempt_count + 1 then
    raise exception 'writing_submission_intent_attempt_count_invalid';
  end if;
  if not (old.state = 'pending' and new.state = 'dispatching')
     and new.attempt_count is distinct from old.attempt_count then
    raise exception 'writing_submission_intent_attempt_count_immutable';
  end if;

  new.updated_at := now();
  return new;
end;
$$;

revoke all on function private.protect_writing_submission_intent() from public;
revoke all on function private.protect_writing_submission_intent() from anon;
revoke all on function private.protect_writing_submission_intent() from authenticated;
revoke all on function private.protect_writing_submission_intent() from service_role;

create trigger writing_submission_intents_protect
before update on private.writing_submission_intents
for each row execute function private.protect_writing_submission_intent();

create or replace function private.record_writing_submission_intent_transition(
  p_intent private.writing_submission_intents,
  p_old_state text
)
returns void
language sql
security definer
set search_path = pg_catalog, private
as $$
  insert into private.writing_submission_intent_audit (
    intent_id,
    old_state,
    new_state,
    attempt_count,
    external_id_hash,
    provider_status,
    reason_code
  ) values (
    p_intent.intent_id,
    p_old_state,
    p_intent.state,
    p_intent.attempt_count,
    case
      when p_intent.external_submission_id is null then null
      else encode(sha256(convert_to(
        p_intent.external_submission_id,
        'UTF8'
      )), 'hex')
    end,
    p_intent.provider_status,
    p_intent.reason_code
  )
$$;

revoke all on function private.record_writing_submission_intent_transition(private.writing_submission_intents, text) from public;
revoke all on function private.record_writing_submission_intent_transition(private.writing_submission_intents, text) from anon;
revoke all on function private.record_writing_submission_intent_transition(private.writing_submission_intents, text) from authenticated;
revoke all on function private.record_writing_submission_intent_transition(private.writing_submission_intents, text) from service_role;

create or replace function public.prepare_writing_submission_intent(
  p_intent_id uuid,
  p_submission jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, private
as $$
declare
  v_owner_id uuid;
  v_draft_id uuid;
  v_parent_submission_id uuid;
  v_answer_json jsonb;
  v_answer_hash text;
  v_dedup_key text;
  v_existing private.writing_submission_intents%rowtype;
  v_draft public.writing_drafts%rowtype;
  v_inserted boolean := false;
  v_submission_mode text;
begin
  if p_intent_id is null then
    raise exception 'writing_submission_intent_id_required';
  end if;
  if p_submission is null or jsonb_typeof(p_submission) <> 'object' then
    raise exception 'writing_submission_intent_payload_required';
  end if;
  if not (p_submission ? 'user_id')
     or not (p_submission ? 'draft_id')
     or not (p_submission ? 'canonical_question_id')
     or not (p_submission ? 'canonical_import_id')
     or not (p_submission ? 'canonical_payload_hash')
     or not (p_submission ? 'question_snapshot') then
    raise exception 'writing_submission_intent_context_required';
  end if;

  begin
    v_owner_id := (p_submission->>'user_id')::uuid;
    v_draft_id := (p_submission->>'draft_id')::uuid;
    v_parent_submission_id := case
      when p_submission ? 'parent_submission_id'
        and jsonb_typeof(p_submission->'parent_submission_id') = 'string'
        then (p_submission->>'parent_submission_id')::uuid
      else null
    end;
  exception when others then
    raise exception 'writing_submission_intent_uuid_invalid';
  end;

  v_submission_mode := private.get_writing_submission_mode();
  if v_submission_mode is null
     or v_submission_mode not in ('verification', 'canonical') then
    raise exception 'writing_submission_temporarily_blocked';
  end if;
  if v_submission_mode = 'canonical' then
    perform private.assert_current_writing_outbox_activation();
  end if;

  perform private.assert_submission_payload(
    p_submission,
    '[]'::jsonb,
    '[]'::jsonb
  );
  perform private.assert_writing_question_submittable(
    (p_submission->>'problem_id')::uuid,
    p_submission->>'canonical_question_id',
    (p_submission->>'canonical_import_id')::bigint,
    p_submission->>'canonical_payload_hash',
    (p_submission->>'question_no')::smallint,
    v_owner_id
  );
  perform private.assert_writing_submission_snapshot_matches_catalog(
    (p_submission->>'problem_id')::uuid,
    p_submission->>'canonical_question_id',
    (p_submission->>'canonical_import_id')::bigint,
    p_submission->>'canonical_payload_hash',
    (p_submission->>'question_no')::smallint,
    v_owner_id,
    p_submission->'question_snapshot'
  );

  select * into v_draft
  from public.writing_drafts draft
  where draft.id = v_draft_id
    and draft.user_id = v_owner_id
    and draft.problem_id = (p_submission->>'problem_id')::uuid
    and draft.question_no = (p_submission->>'question_no')::smallint
    and draft.autosave_status <> 'superseded';
  if not found then
    raise exception 'writing_submission_intent_draft_not_owned';
  end if;
  if v_draft.canonical_question_id is distinct from
       p_submission->>'canonical_question_id'
     or v_draft.canonical_import_id is distinct from
       (p_submission->>'canonical_import_id')::bigint
     or v_draft.canonical_payload_hash is distinct from
       p_submission->>'canonical_payload_hash'
     or v_draft.question_snapshot is distinct from
       p_submission->'question_snapshot' then
    raise exception 'canonical_draft_version_conflict';
  end if;

  if v_parent_submission_id is not null and not exists (
    select 1
    from public.writing_submissions submission
    where submission.id = v_parent_submission_id
      and submission.user_id = v_owner_id
      and submission.problem_id = (p_submission->>'problem_id')::uuid
      and submission.question_no = (p_submission->>'question_no')::smallint
  ) then
    raise exception 'parent_submission_not_owned';
  end if;

  v_answer_json := case
    when p_submission ? 'answer_json' then p_submission->'answer_json'
    else null
  end;
  v_answer_hash := private.writing_submission_answer_hash(
    p_submission->>'answer_text',
    v_answer_json
  );
  v_dedup_key := encode(sha256(convert_to(concat_ws('|',
    v_owner_id::text,
    v_draft_id::text,
    p_submission->>'canonical_question_id',
    p_submission->>'canonical_import_id',
    p_submission->>'canonical_payload_hash',
    v_answer_hash
  ), 'UTF8')), 'hex');

  select * into v_existing
  from private.writing_submission_intents intent
  where intent.intent_id = p_intent_id
  for update;
  if found then
    if v_existing.dedup_key is distinct from v_dedup_key then
      raise exception 'writing_submission_intent_id_conflict';
    end if;
    return private.writing_submission_intent_result(v_existing, false);
  end if;

  begin
    insert into private.writing_submission_intents (
      intent_id,
      local_submission_id,
      provider_dispatch_key,
      dedup_key,
      user_id,
      problem_id,
      draft_id,
      question_no,
      answer_text,
      answer_json,
      answer_hash,
      char_count,
      parent_submission_id,
      canonical_question_id,
      canonical_import_id,
      canonical_payload_hash,
      question_snapshot
    ) values (
      p_intent_id,
      p_intent_id,
      p_intent_id::text,
      v_dedup_key,
      v_owner_id,
      (p_submission->>'problem_id')::uuid,
      v_draft_id,
      (p_submission->>'question_no')::smallint,
      p_submission->>'answer_text',
      v_answer_json,
      v_answer_hash,
      (p_submission->>'char_count')::integer,
      v_parent_submission_id,
      p_submission->>'canonical_question_id',
      (p_submission->>'canonical_import_id')::bigint,
      p_submission->>'canonical_payload_hash',
      p_submission->'question_snapshot'
    )
    returning * into v_existing;
    v_inserted := true;
  exception when unique_violation then
    select * into v_existing
    from private.writing_submission_intents intent
    where intent.intent_id = p_intent_id
       or intent.dedup_key = v_dedup_key
    order by
      (intent.intent_id = p_intent_id) desc,
      (intent.state <> 'failed') desc,
      intent.created_at desc
    limit 1
    for update;
    if not found then
      raise;
    end if;
    if v_existing.intent_id = p_intent_id
       and v_existing.dedup_key is distinct from v_dedup_key then
      raise exception 'writing_submission_intent_id_conflict';
    end if;
  end;

  if v_inserted then
    perform private.record_writing_submission_intent_transition(
      v_existing,
      null
    );
  end if;
  return private.writing_submission_intent_result(v_existing, false);
end;
$$;

revoke all on function public.prepare_writing_submission_intent(uuid, jsonb) from public;
revoke all on function public.prepare_writing_submission_intent(uuid, jsonb) from anon;
revoke all on function public.prepare_writing_submission_intent(uuid, jsonb) from authenticated;
grant execute on function public.prepare_writing_submission_intent(uuid, jsonb) to service_role;

create or replace function public.claim_writing_submission_intent(
  p_intent_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, private
as $$
declare
  v_intent private.writing_submission_intents%rowtype;
  v_old_state text;
  v_submission_mode text;
begin
  -- Linearize emergency blocking before claiming an intent. The state setter
  -- takes an UPDATE lock on the same singleton, so whichever transaction
  -- acquires the control row first defines whether this claim is authorized.
  select control.submission_mode into v_submission_mode
  from private.writing_submission_control control
  where control.singleton
  for share;

  select * into v_intent
  from private.writing_submission_intents intent
  where intent.intent_id = p_intent_id
  for update;
  if not found then
    raise exception 'writing_submission_intent_not_found';
  end if;

  if v_intent.state <> 'pending'
     or v_submission_mode not in (
       'verification',
       'canonical'
     ) then
    return private.writing_submission_intent_result(v_intent, false);
  end if;
  if v_submission_mode = 'canonical' then
    perform private.assert_current_writing_outbox_activation();
  end if;

  v_old_state := v_intent.state;
  update private.writing_submission_intents
  set state = 'dispatching',
      attempt_count = attempt_count + 1,
      claimed_at = now()
  where intent_id = p_intent_id
  returning * into v_intent;
  perform private.record_writing_submission_intent_transition(
    v_intent,
    v_old_state
  );
  return private.writing_submission_intent_result(v_intent, true);
end;
$$;

revoke all on function public.claim_writing_submission_intent(uuid) from public;
revoke all on function public.claim_writing_submission_intent(uuid) from anon;
revoke all on function public.claim_writing_submission_intent(uuid) from authenticated;
grant execute on function public.claim_writing_submission_intent(uuid) to service_role;

create or replace function public.mark_writing_submission_intent_accepted(
  p_intent_id uuid,
  p_external_submission_id text,
  p_provider_status text
)
returns void
language plpgsql
security definer
set search_path = pg_catalog, private
as $$
declare
  v_intent private.writing_submission_intents%rowtype;
  v_old_state text;
  v_external_submission_id text := btrim(p_external_submission_id);
  v_provider_status text := btrim(p_provider_status);
begin
  if nullif(v_external_submission_id, '') is null
     or length(v_external_submission_id) > 512
     or v_external_submission_id !~ '^[[:graph:]]+$' then
    raise exception 'writing_submission_external_id_invalid';
  end if;
  if nullif(v_provider_status, '') is null
     or length(v_provider_status) > 128
     or v_provider_status !~ '^[A-Za-z0-9][A-Za-z0-9_.:-]*$' then
    raise exception 'writing_submission_provider_status_invalid';
  end if;

  select * into v_intent
  from private.writing_submission_intents intent
  where intent.intent_id = p_intent_id
  for update;
  if not found then
    raise exception 'writing_submission_intent_not_found';
  end if;

  if v_intent.state in ('accepted', 'materialized') then
    if v_intent.external_submission_id is distinct from
         v_external_submission_id
       or v_intent.provider_status is distinct from v_provider_status then
      raise exception 'writing_submission_acceptance_conflict';
    end if;
    return;
  end if;
  if v_intent.state <> 'dispatching' then
    raise exception 'writing_submission_acceptance_state_invalid: %',
      v_intent.state;
  end if;

  v_old_state := v_intent.state;
  update private.writing_submission_intents
  set state = 'accepted',
      external_submission_id = v_external_submission_id,
      provider_status = v_provider_status,
      accepted_at = now(),
      terminal_at = now()
  where intent_id = p_intent_id
  returning * into v_intent;
  perform private.record_writing_submission_intent_transition(
    v_intent,
    v_old_state
  );
end;
$$;

revoke all on function public.mark_writing_submission_intent_accepted(uuid, text, text) from public;
revoke all on function public.mark_writing_submission_intent_accepted(uuid, text, text) from anon;
revoke all on function public.mark_writing_submission_intent_accepted(uuid, text, text) from authenticated;
grant execute on function public.mark_writing_submission_intent_accepted(uuid, text, text) to service_role;

create or replace function public.mark_writing_submission_intent_ambiguous(
  p_intent_id uuid,
  p_reason_code text
)
returns void
language plpgsql
security definer
set search_path = pg_catalog, private
as $$
declare
  v_intent private.writing_submission_intents%rowtype;
  v_old_state text;
  v_reason_code text := btrim(p_reason_code);
begin
  if nullif(v_reason_code, '') is null
     or length(v_reason_code) > 128
     or v_reason_code !~ '^[A-Za-z0-9][A-Za-z0-9_.:-]*$' then
    raise exception 'writing_submission_reason_code_invalid';
  end if;

  select * into v_intent
  from private.writing_submission_intents intent
  where intent.intent_id = p_intent_id
  for update;
  if not found then
    raise exception 'writing_submission_intent_not_found';
  end if;

  if v_intent.state = 'ambiguous' then
    if v_intent.reason_code is distinct from v_reason_code then
      raise exception 'writing_submission_ambiguous_reason_conflict';
    end if;
    return;
  end if;
  if v_intent.state <> 'dispatching' then
    raise exception 'writing_submission_ambiguous_state_invalid: %',
      v_intent.state;
  end if;

  v_old_state := v_intent.state;
  update private.writing_submission_intents
  set state = 'ambiguous',
      reason_code = v_reason_code,
      terminal_at = now()
  where intent_id = p_intent_id
  returning * into v_intent;
  perform private.record_writing_submission_intent_transition(
    v_intent,
    v_old_state
  );
end;
$$;

revoke all on function public.mark_writing_submission_intent_ambiguous(uuid, text) from public;
revoke all on function public.mark_writing_submission_intent_ambiguous(uuid, text) from anon;
revoke all on function public.mark_writing_submission_intent_ambiguous(uuid, text) from authenticated;
grant execute on function public.mark_writing_submission_intent_ambiguous(uuid, text) to service_role;

create or replace function public.mark_writing_submission_intent_failed(
  p_intent_id uuid,
  p_reason_code text
)
returns void
language plpgsql
security definer
set search_path = pg_catalog, private
as $$
declare
  v_intent private.writing_submission_intents%rowtype;
  v_old_state text;
  v_reason_code text := btrim(p_reason_code);
begin
  if nullif(v_reason_code, '') is null
     or length(v_reason_code) > 128
     or v_reason_code !~ '^[A-Za-z0-9][A-Za-z0-9_.:-]*$' then
    raise exception 'writing_submission_reason_code_invalid';
  end if;

  select * into v_intent
  from private.writing_submission_intents intent
  where intent.intent_id = p_intent_id
  for update;
  if not found then
    raise exception 'writing_submission_intent_not_found';
  end if;

  if v_intent.state = 'failed' then
    if v_intent.reason_code is distinct from v_reason_code then
      raise exception 'writing_submission_failure_reason_conflict';
    end if;
    return;
  end if;
  if v_intent.state not in ('pending', 'dispatching') then
    raise exception 'writing_submission_failure_state_invalid: %',
      v_intent.state;
  end if;

  v_old_state := v_intent.state;
  update private.writing_submission_intents
  set state = 'failed',
      reason_code = v_reason_code,
      terminal_at = now()
  where intent_id = p_intent_id
  returning * into v_intent;
  perform private.record_writing_submission_intent_transition(
    v_intent,
    v_old_state
  );
end;
$$;

revoke all on function public.mark_writing_submission_intent_failed(uuid, text) from public;
revoke all on function public.mark_writing_submission_intent_failed(uuid, text) from anon;
revoke all on function public.mark_writing_submission_intent_failed(uuid, text) from authenticated;
grant execute on function public.mark_writing_submission_intent_failed(uuid, text) to service_role;

-- Service-only operations surface. It intentionally omits answer_text,
-- answer_json and question_snapshot. Ambiguous intents are never redispatched;
-- an operator must first confirm the provider outcome and then resolve the
-- existing intent to accepted or failed.
create or replace function public.list_writing_submission_intents_for_reconciliation(
  p_states text[] default array['ambiguous', 'dispatching', 'failed']::text[],
  p_limit integer default 100
)
returns table (
  intent_id uuid,
  local_submission_id uuid,
  provider_dispatch_key text,
  state text,
  attempt_count integer,
  external_id_hash text,
  provider_status text,
  reason_code text,
  created_at timestamptz,
  updated_at timestamptz,
  terminal_at timestamptz,
  materialized_at timestamptz
)
language plpgsql
security definer
set search_path = pg_catalog, private
as $$
begin
  if p_states is null
     or cardinality(p_states) = 0
     or not (p_states <@ array[
       'pending','dispatching','accepted','ambiguous','failed','materialized'
     ]::text[]) then
    raise exception 'writing_submission_reconciliation_states_invalid';
  end if;
  if p_limit is null or p_limit < 1 or p_limit > 500 then
    raise exception 'writing_submission_reconciliation_limit_invalid';
  end if;

  return query
  select
    intent.intent_id,
    intent.local_submission_id,
    intent.provider_dispatch_key,
    intent.state,
    intent.attempt_count,
    case
      when intent.external_submission_id is null then null
      else encode(sha256(convert_to(
        intent.external_submission_id,
        'UTF8'
      )), 'hex')
    end,
    intent.provider_status,
    intent.reason_code,
    intent.created_at,
    intent.updated_at,
    intent.terminal_at,
    intent.materialized_at
  from private.writing_submission_intents intent
  where intent.state = any (p_states)
  order by intent.updated_at asc, intent.intent_id asc
  limit p_limit;
end;
$$;

revoke all on function public.list_writing_submission_intents_for_reconciliation(text[], integer) from public;
revoke all on function public.list_writing_submission_intents_for_reconciliation(text[], integer) from anon;
revoke all on function public.list_writing_submission_intents_for_reconciliation(text[], integer) from authenticated;
grant execute on function public.list_writing_submission_intents_for_reconciliation(text[], integer) to service_role;

create or replace function public.list_writing_submission_intent_audit(
  p_intent_id uuid
)
returns table (
  audit_id bigint,
  old_state text,
  new_state text,
  attempt_count integer,
  external_id_hash text,
  provider_status text,
  reason_code text,
  occurred_at timestamptz
)
language sql
stable
security definer
set search_path = pg_catalog, private
as $$
  select
    audit.audit_id,
    audit.old_state,
    audit.new_state,
    audit.attempt_count,
    audit.external_id_hash,
    audit.provider_status,
    audit.reason_code,
    audit.occurred_at
  from private.writing_submission_intent_audit audit
  where audit.intent_id = p_intent_id
  order by audit.audit_id asc
$$;

revoke all on function public.list_writing_submission_intent_audit(uuid) from public;
revoke all on function public.list_writing_submission_intent_audit(uuid) from anon;
revoke all on function public.list_writing_submission_intent_audit(uuid) from authenticated;
grant execute on function public.list_writing_submission_intent_audit(uuid) to service_role;

create or replace function public.reconcile_writing_submission_intent(
  p_intent_id uuid,
  p_resolution text,
  p_external_submission_id text default null,
  p_provider_status text default null,
  p_reason_code text default null
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, private
as $$
declare
  v_intent private.writing_submission_intents%rowtype;
  v_old_state text;
  v_resolution text := lower(btrim(p_resolution));
  v_external_submission_id text := nullif(btrim(p_external_submission_id), '');
  v_provider_status text := nullif(btrim(p_provider_status), '');
  v_reason_code text := nullif(btrim(p_reason_code), '');
begin
  if v_resolution is null
     or v_resolution not in ('accepted', 'failed') then
    raise exception 'writing_submission_reconciliation_resolution_invalid';
  end if;

  select * into v_intent
  from private.writing_submission_intents intent
  where intent.intent_id = p_intent_id
  for update;
  if not found then
    raise exception 'writing_submission_intent_not_found';
  end if;
  if v_intent.state not in ('dispatching', 'ambiguous') then
    raise exception 'writing_submission_reconciliation_state_invalid: %',
      v_intent.state;
  end if;

  v_old_state := v_intent.state;
  if v_resolution = 'accepted' then
    if v_external_submission_id is null
       or length(v_external_submission_id) > 512
       or v_external_submission_id !~ '^[[:graph:]]+$'
       or v_provider_status is null
       or length(v_provider_status) > 128
       or v_provider_status !~ '^[A-Za-z0-9][A-Za-z0-9_.:-]*$' then
      raise exception 'writing_submission_reconciliation_provider_result_invalid';
    end if;
    update private.writing_submission_intents intent
    set state = 'accepted',
        external_submission_id = v_external_submission_id,
        provider_status = v_provider_status,
        reason_code = null,
        accepted_at = now(),
        terminal_at = now()
    where intent.intent_id = p_intent_id
    returning * into v_intent;
  else
    if v_reason_code is null
       or length(v_reason_code) > 128
       or v_reason_code !~ '^[A-Za-z0-9][A-Za-z0-9_.:-]*$' then
      raise exception 'writing_submission_reason_code_invalid';
    end if;
    update private.writing_submission_intents intent
    set state = 'failed',
        reason_code = v_reason_code,
        terminal_at = now()
    where intent.intent_id = p_intent_id
    returning * into v_intent;
  end if;

  perform private.record_writing_submission_intent_transition(
    v_intent,
    v_old_state
  );
  return private.writing_submission_intent_result(v_intent, false);
end;
$$;

revoke all on function public.reconcile_writing_submission_intent(uuid, text, text, text, text) from public;
revoke all on function public.reconcile_writing_submission_intent(uuid, text, text, text, text) from anon;
revoke all on function public.reconcile_writing_submission_intent(uuid, text, text, text, text) from authenticated;
grant execute on function public.reconcile_writing_submission_intent(uuid, text, text, text, text) to service_role;

create or replace function private.protect_writing_submission_external_id()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog
as $$
begin
  if old.external_submission_id is distinct from new.external_submission_id then
    raise exception 'writing_submission_external_id_immutable';
  end if;
  return new;
end;
$$;

revoke all on function private.protect_writing_submission_external_id() from public;
revoke all on function private.protect_writing_submission_external_id() from anon;
revoke all on function private.protect_writing_submission_external_id() from authenticated;
revoke all on function private.protect_writing_submission_external_id() from service_role;

create trigger writing_submissions_external_id_immutable
before update of external_submission_id on public.writing_submissions
for each row execute function private.protect_writing_submission_external_id();

create or replace function private.validate_writing_submission_canonical_context()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public, private
as $$
declare
  v_is_writing boolean;
  v_materialization_token text;
begin
  select identity_row.domain = 'writing'
    and identity_row.lifecycle = 'active'
    into v_is_writing
    from private.problem_identities identity_row
   where identity_row.problem_id = new.problem_id;

  if not coalesce(v_is_writing, false) then
    raise exception 'writing_submission_problem_identity_invalid';
  end if;
  if nullif(btrim(new.canonical_question_id), '') is null
     or new.canonical_import_id is null
     or nullif(btrim(new.canonical_payload_hash), '') is null
     or jsonb_typeof(new.question_snapshot) is distinct from 'object' then
    raise exception 'canonical_submission_context_required';
  end if;
  if new.question_snapshot->>'question_id' is distinct from
       new.canonical_question_id
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

  if tg_op = 'UPDATE' then
    if old.problem_id is distinct from new.problem_id
       or old.user_id is distinct from new.user_id
       or old.draft_id is distinct from new.draft_id
       or old.question_no is distinct from new.question_no
       or old.answer_text is distinct from new.answer_text
       or old.answer_json is distinct from new.answer_json
       or old.char_count is distinct from new.char_count
       or old.parent_submission_id is distinct from new.parent_submission_id
       or old.canonical_question_id is distinct from new.canonical_question_id
       or old.canonical_import_id is distinct from new.canonical_import_id
       or old.canonical_payload_hash is distinct from new.canonical_payload_hash
       or old.question_snapshot is distinct from new.question_snapshot then
      raise exception 'canonical_submission_context_immutable';
    end if;
    return new;
  end if;

  v_materialization_token := current_setting(
    'app.writing_outbox_materialization_token',
    true
  );
  if nullif(v_materialization_token, '') is null
     or not exists (
       select 1
       from private.writing_submission_intents intent
       where intent.materialization_token::text = v_materialization_token
         and intent.state = 'accepted'
         and intent.intent_id = new.id
         and intent.local_submission_id = new.id
         and intent.user_id = new.user_id
         and intent.problem_id = new.problem_id
         and intent.draft_id = new.draft_id
         and intent.question_no = new.question_no
         and intent.answer_hash = private.writing_submission_answer_hash(
           new.answer_text,
           new.answer_json
         )
         and intent.char_count = new.char_count
         and intent.parent_submission_id is not distinct from
           new.parent_submission_id
         and intent.canonical_question_id = new.canonical_question_id
         and intent.canonical_import_id = new.canonical_import_id
         and intent.canonical_payload_hash = new.canonical_payload_hash
         and intent.question_snapshot = new.question_snapshot
         and intent.external_submission_id = new.external_submission_id
     ) then
    raise exception 'writing_submission_outbox_intent_required';
  end if;
  return new;
end;
$$;

revoke all on function private.validate_writing_submission_canonical_context() from public;
revoke all on function private.validate_writing_submission_canonical_context() from anon;
revoke all on function private.validate_writing_submission_canonical_context() from authenticated;
revoke all on function private.validate_writing_submission_canonical_context() from service_role;

drop trigger if exists writing_submissions_validate_canonical_context
  on public.writing_submissions;
create trigger writing_submissions_validate_canonical_context
before insert or update of
  problem_id,
  question_no,
  user_id,
  draft_id,
  answer_text,
  answer_json,
  char_count,
  parent_submission_id,
  canonical_question_id,
  canonical_import_id,
  canonical_payload_hash,
  question_snapshot
on public.writing_submissions
for each row
execute function private.validate_writing_submission_canonical_context();

create or replace function public.materialize_writing_submission_intent(
  p_intent_id uuid
)
returns uuid
language plpgsql
security definer
set search_path = pg_catalog, public, private
as $$
declare
  v_intent private.writing_submission_intents%rowtype;
  v_submission public.writing_submissions%rowtype;
  v_old_state text;
begin
  select * into v_intent
  from private.writing_submission_intents intent
  where intent.intent_id = p_intent_id
  for update;
  if not found then
    raise exception 'writing_submission_intent_not_found';
  end if;
  if v_intent.state not in ('accepted', 'materialized') then
    raise exception 'writing_submission_materialize_state_invalid: %',
      v_intent.state;
  end if;

  select * into v_submission
  from public.writing_submissions submission
  where submission.id = v_intent.local_submission_id;

  if found then
    if v_submission.user_id is distinct from v_intent.user_id
       or v_submission.problem_id is distinct from v_intent.problem_id
       or v_submission.draft_id is distinct from v_intent.draft_id
       or v_submission.question_no is distinct from v_intent.question_no
       or private.writing_submission_answer_hash(
         v_submission.answer_text,
         v_submission.answer_json
       ) is distinct from v_intent.answer_hash
       or v_submission.char_count is distinct from v_intent.char_count
       or v_submission.parent_submission_id is distinct from
         v_intent.parent_submission_id
       or v_submission.canonical_question_id is distinct from
         v_intent.canonical_question_id
       or v_submission.canonical_import_id is distinct from
         v_intent.canonical_import_id
       or v_submission.canonical_payload_hash is distinct from
         v_intent.canonical_payload_hash
       or v_submission.question_snapshot is distinct from
         v_intent.question_snapshot
       or v_submission.external_submission_id is distinct from
         v_intent.external_submission_id then
      raise exception 'writing_submission_materialization_conflict';
    end if;
  else
    if v_intent.state <> 'accepted' then
      raise exception 'writing_submission_materialized_row_missing';
    end if;
    perform set_config(
      'app.writing_outbox_materialization_token',
      v_intent.materialization_token::text,
      true
    );
    begin
      insert into public.writing_submissions (
        id,
        user_id,
        problem_id,
        draft_id,
        question_no,
        answer_text,
        answer_json,
        char_count,
        feedback_status,
        parent_submission_id,
        canonical_question_id,
        canonical_import_id,
        canonical_payload_hash,
        question_snapshot,
        external_submission_id
      ) values (
        v_intent.local_submission_id,
        v_intent.user_id,
        v_intent.problem_id,
        v_intent.draft_id,
        v_intent.question_no,
        v_intent.answer_text,
        v_intent.answer_json,
        v_intent.char_count,
        case
          when lower(v_intent.provider_status) = 'failed' then 'failed'
          else 'analyzing'
        end,
        v_intent.parent_submission_id,
        v_intent.canonical_question_id,
        v_intent.canonical_import_id,
        v_intent.canonical_payload_hash,
        v_intent.question_snapshot,
        v_intent.external_submission_id
      );
    exception when others then
      perform set_config(
        'app.writing_outbox_materialization_token',
        '',
        true
      );
      raise;
    end;
    perform set_config(
      'app.writing_outbox_materialization_token',
      '',
      true
    );
  end if;

  perform private.ensure_submission_library_item(
    v_intent.user_id,
    v_intent.local_submission_id
  );
  update public.writing_drafts
  set autosave_status = 'superseded',
      updated_at = now()
  where id = v_intent.draft_id
    and user_id = v_intent.user_id
    and problem_id = v_intent.problem_id
    and autosave_status <> 'superseded';

  if v_intent.state = 'accepted' then
    v_old_state := v_intent.state;
    update private.writing_submission_intents
    set state = 'materialized',
        materialized_at = now()
    where intent_id = p_intent_id
    returning * into v_intent;
    perform private.record_writing_submission_intent_transition(
      v_intent,
      v_old_state
    );
  end if;
  return v_intent.local_submission_id;
end;
$$;

revoke all on function public.materialize_writing_submission_intent(uuid) from public;
revoke all on function public.materialize_writing_submission_intent(uuid) from anon;
revoke all on function public.materialize_writing_submission_intent(uuid) from authenticated;
grant execute on function public.materialize_writing_submission_intent(uuid) to service_role;

-- Remove the superseded direct writer entirely. Its exact definition is kept
-- only in the private rollback backup while the outbox remains unused.
drop function public.create_external_writing_submission_v2(jsonb);

create or replace function private.assert_writing_outbox_contract_evidence(
  p_evidence_id text
)
returns void
language plpgsql
stable
security definer
set search_path = pg_catalog, private
as $$
declare
  v_evidence private.writing_submission_contract_evidence%rowtype;
  v_rpc text;
begin
  select * into v_evidence
  from private.writing_submission_contract_evidence evidence
  where evidence.evidence_id = nullif(btrim(p_evidence_id), '');
  if not found
     or v_evidence.evidence_type <> 'local_outbox_verified'
     or v_evidence.contract_digest <>
       private.writing_outbox_contract_digest()
     or v_evidence.verification_report_hash !~ '^[0-9a-f]{64}$' then
    raise exception 'writing_submission_outbox_evidence_invalid';
  end if;

  if to_regclass('private.writing_submission_intents') is null
     or to_regclass('private.writing_submission_intent_audit') is null then
    raise exception 'writing_submission_outbox_storage_missing';
  end if;
  if not exists (
    select 1
    from pg_catalog.pg_class relation_row
    where relation_row.oid =
      'private.writing_submission_intents'::regclass
      and relation_row.relrowsecurity
      and relation_row.relforcerowsecurity
  ) then
    raise exception 'writing_submission_outbox_rls_invalid';
  end if;
  if not exists (
    select 1
    from pg_catalog.pg_attribute attribute_row
    where attribute_row.attrelid = 'public.writing_submissions'::regclass
      and attribute_row.attname = 'external_submission_id'
      and attribute_row.atttypid = 'text'::regtype
      and attribute_row.attnotnull
      and not attribute_row.attisdropped
  ) or not exists (
    select 1
    from pg_catalog.pg_constraint constraint_row
    where constraint_row.conrelid = 'public.writing_submissions'::regclass
      and constraint_row.contype = 'u'
      and pg_get_constraintdef(constraint_row.oid) =
        'UNIQUE (external_submission_id)'
  ) then
    raise exception 'writing_submission_external_id_contract_invalid';
  end if;

  foreach v_rpc in array array[
    'public.prepare_writing_submission_intent(uuid,jsonb)',
    'public.claim_writing_submission_intent(uuid)',
    'public.mark_writing_submission_intent_accepted(uuid,text,text)',
    'public.mark_writing_submission_intent_ambiguous(uuid,text)',
    'public.mark_writing_submission_intent_failed(uuid,text)',
    'public.list_writing_submission_intents_for_reconciliation(text[],integer)',
    'public.list_writing_submission_intent_audit(uuid)',
    'public.reconcile_writing_submission_intent(uuid,text,text,text,text)',
    'public.materialize_writing_submission_intent(uuid)'
  ] loop
    if to_regprocedure(v_rpc) is null
       or not has_function_privilege('service_role', v_rpc, 'EXECUTE')
       or has_function_privilege('authenticated', v_rpc, 'EXECUTE')
       or has_function_privilege('anon', v_rpc, 'EXECUTE') then
      raise exception 'writing_submission_outbox_rpc_contract_invalid: %',
        v_rpc;
    end if;
  end loop;

  if to_regprocedure(
    'public.create_external_writing_submission_v2(jsonb)'
  ) is not null then
    raise exception 'writing_submission_direct_writer_still_present';
  end if;
  if not exists (
    select 1
    from pg_catalog.pg_trigger trigger_row
    where trigger_row.tgrelid = 'public.writing_submissions'::regclass
      and trigger_row.tgname =
        'writing_submissions_validate_canonical_context'
      and not trigger_row.tgisinternal
      and trigger_row.tgenabled in ('O', 'A')
  ) then
    raise exception 'writing_submission_outbox_guard_missing';
  end if;
end;
$$;

revoke all on function private.assert_writing_outbox_contract_evidence(text) from public;
revoke all on function private.assert_writing_outbox_contract_evidence(text) from anon;
revoke all on function private.assert_writing_outbox_contract_evidence(text) from authenticated;
revoke all on function private.assert_writing_outbox_contract_evidence(text) from service_role;

create or replace function private.assert_current_writing_outbox_activation()
returns void
language plpgsql
stable
security definer
set search_path = pg_catalog, private
as $$
declare
  v_control private.writing_submission_control%rowtype;
begin
  select * into v_control
  from private.writing_submission_control control
  where control.singleton;
  if not found
     or v_control.submission_mode <> 'canonical'
     or v_control.submission_contract_state <> 'local_outbox_verified'
     or nullif(btrim(v_control.evidence_id), '') is null then
    raise exception 'canonical_submission_outbox_activation_invalid';
  end if;
  perform private.assert_writing_outbox_contract_evidence(
    v_control.evidence_id
  );
end;
$$;

revoke all on function private.assert_current_writing_outbox_activation() from public;
revoke all on function private.assert_current_writing_outbox_activation() from anon;
revoke all on function private.assert_current_writing_outbox_activation() from authenticated;
revoke all on function private.assert_current_writing_outbox_activation() from service_role;

-- Installation is not verification. A service operator records evidence only
-- after timeout, duplicate, concurrent-submit, and accepted-recovery live tests
-- have passed and the immutable report artifact has been hashed.
create or replace function public.record_writing_submission_contract_evidence(
  p_evidence_id text,
  p_verification_report jsonb,
  p_verified_by text,
  p_reason text
)
returns void
language plpgsql
security definer
set search_path = pg_catalog, private
as $$
declare
  v_evidence_id text := nullif(btrim(p_evidence_id), '');
  v_contract_digest text := private.writing_outbox_contract_digest();
  v_report_hash text;
  v_verified_by text := nullif(btrim(p_verified_by), '');
  v_reason text := nullif(btrim(p_reason), '');
begin
  if v_evidence_id is null
     or v_evidence_id !~ '^[a-z0-9][a-z0-9._:-]{7,127}$'
     or v_verified_by is null
     or v_reason is null
     or jsonb_typeof(p_verification_report) is distinct from 'object'
     or p_verification_report->>'contract' is distinct from 'writing-outbox-v2'
     or p_verification_report->>'schemaVersion' is distinct from '2'
     or p_verification_report->>'contractDigest' is distinct from v_contract_digest
     or p_verification_report->>'cleanup' is distinct from 'complete'
     or jsonb_typeof(p_verification_report->'scenarios') is distinct from 'object'
     or p_verification_report#>>'{scenarios,concurrentDuplicate,oneFulfilled}' is distinct from 'true'
     or p_verification_report#>>'{scenarios,concurrentDuplicate,providerDispatches}' is distinct from '1'
     or p_verification_report#>>'{scenarios,timeout,quarantined}' is distinct from 'true'
     or p_verification_report#>>'{scenarios,timeout,providerDispatches}' is distinct from '1'
     or p_verification_report#>>'{scenarios,deterministicFailure,failed}' is distinct from 'true'
     or p_verification_report#>>'{scenarios,deterministicFailure,retrySucceededWithNewIntent}' is distinct from 'true'
     or p_verification_report#>>'{scenarios,deterministicFailure,providerDispatches}' is distinct from '2'
     or p_verification_report#>>'{scenarios,acceptedMarkerFailure,quarantined}' is distinct from 'true'
     or p_verification_report#>>'{scenarios,acceptedMarkerFailure,providerDispatches}' is distinct from '1'
     or p_verification_report#>>'{scenarios,materializationRecovery,recovered}' is distinct from 'true'
     or p_verification_report#>>'{scenarios,materializationRecovery,providerDispatches}' is distinct from '1' then
    raise exception 'writing_submission_verification_evidence_invalid';
  end if;

  v_report_hash := encode(
    sha256(convert_to(p_verification_report::text, 'UTF8')),
    'hex'
  );

  insert into private.writing_submission_contract_evidence (
    evidence_id,
    evidence_type,
    contract_digest,
    verification_report_hash,
    verified_by,
    reason_hash
  ) values (
    v_evidence_id,
    'local_outbox_verified',
    v_contract_digest,
    v_report_hash,
    v_verified_by,
    encode(sha256(convert_to(v_reason, 'UTF8')), 'hex')
  );

  perform private.assert_writing_outbox_contract_evidence(v_evidence_id);
end;
$$;

revoke all on function public.record_writing_submission_contract_evidence(
  text, jsonb, text, text
) from public;
revoke all on function public.record_writing_submission_contract_evidence(
  text, jsonb, text, text
) from anon;
revoke all on function public.record_writing_submission_contract_evidence(
  text, jsonb, text, text
) from authenticated;
grant execute on function public.record_writing_submission_contract_evidence(
  text, jsonb, text, text
) to service_role;

create or replace function private.guard_writing_submission_control()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, private
as $$
begin
  if new.submission_mode = 'verification' then
    if new.submission_contract_state <> 'unverified'
       or new.evidence_id is not null then
      raise exception 'writing_submission_verification_state_invalid';
    end if;
  elsif new.submission_mode = 'canonical' then
    if new.submission_contract_state <> 'local_outbox_verified'
       or nullif(btrim(new.evidence_id), '') is null then
      raise exception 'canonical_submission_outbox_evidence_required';
    end if;
    perform private.assert_writing_outbox_contract_evidence(
      new.evidence_id
    );
  end if;
  return new;
end;
$$;

revoke all on function private.guard_writing_submission_control() from public;
revoke all on function private.guard_writing_submission_control() from anon;
revoke all on function private.guard_writing_submission_control() from authenticated;
revoke all on function private.guard_writing_submission_control() from service_role;

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
  v_evidence_id text := nullif(btrim(p_evidence_id), '');
begin
  if p_submission_mode not in ('blocked', 'verification', 'canonical') then
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
  if p_submission_mode = 'verification' then
    if p_submission_contract_state <> 'unverified'
       or v_evidence_id is not null then
      raise exception 'writing_submission_verification_state_invalid';
    end if;
  elsif p_submission_mode = 'canonical' then
    if p_submission_contract_state <> 'local_outbox_verified'
       or v_evidence_id is null then
      raise exception 'canonical_submission_outbox_evidence_required';
    end if;
    perform private.assert_writing_outbox_contract_evidence(v_evidence_id);
  end if;

  select * into v_old
  from private.writing_submission_control control
  where control.singleton
  for update;

  update private.writing_submission_control
  set submission_mode = p_submission_mode,
      submission_contract_state = p_submission_contract_state,
      changed_by = btrim(p_actor),
      reason_hash = md5(btrim(p_reason)),
      evidence_id = v_evidence_id,
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
    p_submission_mode,
    p_submission_contract_state,
    btrim(p_actor),
    md5(btrim(p_reason)),
    v_evidence_id
  );
end;
$$;

revoke all on function public.set_writing_submission_state(text, text, text, text, text) from public;
revoke all on function public.set_writing_submission_state(text, text, text, text, text) from anon;
revoke all on function public.set_writing_submission_state(text, text, text, text, text) from authenticated;
grant execute on function public.set_writing_submission_state(text, text, text, text, text) to service_role;

-- This migration intentionally leaves submissions blocked and creates no
-- verification evidence. Activation stays impossible until a verified report
-- is recorded explicitly through the service-only evidence RPC.
do $$
begin
  if exists (
    select 1
    from private.writing_submission_control control
    where control.singleton
      and control.submission_mode <> 'blocked'
  ) then
    raise exception 'writing_outbox_migration_must_leave_submissions_blocked';
  end if;
end
$$;

comment on table private.writing_submission_intents is
  'Private durable dispatch intent. Answers stay private; dispatching and ambiguous intents are never automatically reclaimed.';
comment on column public.writing_submissions.external_submission_id is
  'Stable provider submission identifier as text. Historical rows use their prior UUID id text; new local ids remain intent UUIDs.';
comment on function public.prepare_writing_submission_intent(uuid, jsonb) is
  'Service-only idempotent preparation of an exact canonical submission intent; does not dispatch.';
comment on function public.claim_writing_submission_intent(uuid) is
  'Service-only one-shot pending-to-dispatching claim. A second call never authorizes another provider request.';
comment on column private.writing_submission_control.submission_mode is
  'blocked disables submission, verification permits service-only outbox drills, and canonical requires immutable local_outbox_verified evidence.';
comment on function public.materialize_writing_submission_intent(uuid) is
  'Service-only accepted-intent recovery and materialization. Safe to retry after provider success without another provider request.';
comment on function public.record_writing_submission_contract_evidence(text, jsonb, text, text) is
  'Service-only registration of a validated and hashed v2 live verification report. Installation alone never certifies or activates submissions.';
