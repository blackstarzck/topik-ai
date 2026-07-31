-- Roll back the unused submission outbox only. Once any provider-dispatch
-- intent exists, automatic rollback is unsafe and is deliberately refused.

begin;

do $$
begin
  if to_regclass('private.writing_submission_intents') is null
     or to_regclass('private.writing_submission_intent_audit') is null
     or to_regclass('private.writing_submission_control') is null
     or to_regclass('private.writing_outbox_function_backup') is null
     or to_regclass('private.writing_outbox_grant_backup') is null then
    raise exception 'writing_outbox_down_backup_missing';
  end if;

  -- Keep these locks through the surrounding migration transaction so no
  -- writer can add evidence after the safety checks and before the DROP DDL.
  lock table private.writing_submission_control
    in access exclusive mode;
  lock table private.writing_submission_intents
    in access exclusive mode;
  lock table private.writing_submission_intent_audit
    in access exclusive mode;
  lock table public.writing_submissions
    in access exclusive mode;
  if not exists (
    select 1
    from private.writing_submission_control control
    where control.singleton
      and control.submission_mode = 'blocked'
  ) then
    raise exception 'writing_outbox_down_requires_blocked_submissions';
  end if;
  if exists (
    select 1
    from private.writing_submission_intents
  ) or exists (
    select 1
    from private.writing_submission_intent_audit
  ) then
    raise exception 'writing_outbox_down_refuses_existing_intents';
  end if;
  if exists (
    select 1
    from public.writing_submissions submission
    where submission.external_submission_id is distinct from
      submission.id::text
  ) then
    raise exception 'writing_outbox_down_external_id_not_legacy_compatible';
  end if;
  if (
    select count(*)
    from private.writing_outbox_function_backup
    where migration_version = '20260714141000'
  ) <> 4 then
    raise exception 'writing_outbox_down_function_backup_incomplete';
  end if;
end
$$;

drop function if exists public.prepare_writing_submission_intent(uuid, jsonb);
drop function if exists public.claim_writing_submission_intent(uuid);
drop function if exists public.mark_writing_submission_intent_accepted(uuid, text, text);
drop function if exists public.mark_writing_submission_intent_ambiguous(uuid, text);
drop function if exists public.mark_writing_submission_intent_failed(uuid, text);
drop function if exists public.reconcile_writing_submission_intent(
  uuid, text, text, text, text
);
drop function if exists public.list_writing_submission_intents_for_reconciliation(
  text[], integer
);
drop function if exists public.list_writing_submission_intent_audit(uuid);
drop function if exists public.materialize_writing_submission_intent(uuid);
drop function if exists public.record_writing_submission_contract_evidence(
  text, jsonb, text, text
);

-- Restore the exact pre-outbox control/insert guards captured by the forward
-- migration before removing their new dependencies.
do $$
declare
  v_backup record;
begin
  for v_backup in
    select
      function_signature,
      function_definition,
      owner_name
    from private.writing_outbox_function_backup
    where migration_version = '20260714141000'
    order by function_signature
  loop
    execute v_backup.function_definition;
    execute format(
      'alter function %s owner to %I',
      v_backup.function_signature,
      v_backup.owner_name
    );
  end loop;
end
$$;

revoke all on function private.guard_writing_submission_control() from public;
revoke all on function private.guard_writing_submission_control() from anon;
revoke all on function private.guard_writing_submission_control() from authenticated;
revoke all on function private.guard_writing_submission_control() from service_role;
revoke all on function private.validate_writing_submission_canonical_context() from public;
revoke all on function private.validate_writing_submission_canonical_context() from anon;
revoke all on function private.validate_writing_submission_canonical_context() from authenticated;
revoke all on function private.validate_writing_submission_canonical_context() from service_role;
revoke all on function public.set_writing_submission_state(text, text, text, text, text) from public;
revoke all on function public.set_writing_submission_state(text, text, text, text, text) from anon;
revoke all on function public.set_writing_submission_state(text, text, text, text, text) from authenticated;
grant execute on function public.set_writing_submission_state(text, text, text, text, text) to service_role;

select public.set_writing_submission_state(
  'blocked',
  'unverified',
  'migration-down:20260714141000',
  'retire unused local submission outbox',
  null
);

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
  check (submission_mode in ('blocked', 'canonical'));

alter table private.writing_submission_control
  drop constraint writing_submission_control_evidence_shape;
alter table private.writing_submission_control
  add constraint writing_submission_control_evidence_shape check (
    submission_mode = 'blocked'
    or (
      submission_mode = 'canonical'
      and submission_contract_state in (
        'provider_verified',
        'local_outbox_verified'
      )
      and nullif(btrim(evidence_id), '') is not null
    )
  );

revoke all on function public.create_external_writing_submission_v2(jsonb) from public;
revoke all on function public.create_external_writing_submission_v2(jsonb) from anon;
revoke all on function public.create_external_writing_submission_v2(jsonb) from authenticated;
revoke all on function public.create_external_writing_submission_v2(jsonb) from service_role;
do $$
begin
  if coalesce((
    select backup.service_role_had_execute
    from private.writing_outbox_grant_backup backup
    where backup.object_signature =
      'public.create_external_writing_submission_v2(jsonb)'
  ), false) then
    execute 'grant execute on function '
      || 'public.create_external_writing_submission_v2(jsonb) '
      || 'to service_role';
  end if;
end
$$;

drop trigger if exists writing_submissions_external_id_immutable
  on public.writing_submissions;
drop function if exists private.protect_writing_submission_external_id();

drop function if exists private.assert_current_writing_outbox_activation();
drop function if exists private.assert_writing_outbox_contract_evidence(text);
drop function if exists private.writing_outbox_contract_digest();
drop trigger if exists writing_submission_contract_evidence_immutable
  on private.writing_submission_contract_evidence;
drop function if exists private.protect_writing_submission_contract_evidence();
drop table private.writing_submission_contract_evidence;

drop function if exists private.record_writing_submission_intent_transition(
  private.writing_submission_intents,
  text
);
drop function if exists private.writing_submission_intent_result(
  private.writing_submission_intents,
  boolean
);
drop trigger if exists writing_submission_intents_protect
  on private.writing_submission_intents;
drop function if exists private.protect_writing_submission_intent();
drop function if exists private.writing_submission_answer_hash(text, jsonb);
drop table private.writing_submission_intent_audit;
drop table private.writing_submission_intents;

alter table public.writing_submissions
  drop constraint writing_submissions_external_submission_id_key;
alter table public.writing_submissions
  drop column external_submission_id;

drop table private.writing_outbox_grant_backup;
drop table private.writing_outbox_function_backup;

do $$
begin
  raise notice
    '20260714141000 rolled back before use; submission mode remains blocked';
end
$$;

commit;
