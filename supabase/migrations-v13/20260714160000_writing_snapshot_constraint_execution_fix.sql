begin;

-- CHECK constraints are evaluated with the inserting role's privileges. The
-- immutable classifier below does not read tables or expose snapshot values;
-- it only returns whether caller-supplied JSON contains a forbidden key.
-- Canonical draft inserts therefore need EXECUTE while anonymous callers stay
-- denied and all snapshot construction functions remain private.
revoke all on function private.jsonb_has_forbidden_writing_snapshot_key(jsonb)
  from public;
revoke all on function private.jsonb_has_forbidden_writing_snapshot_key(jsonb)
  from anon;
grant execute on function private.jsonb_has_forbidden_writing_snapshot_key(jsonb)
  to authenticated;
grant execute on function private.jsonb_has_forbidden_writing_snapshot_key(jsonb)
  to service_role;

do $$
declare
  v_volatility "char";
begin
  select procedure.provolatile
    into v_volatility
  from pg_catalog.pg_proc procedure
  join pg_catalog.pg_namespace namespace
    on namespace.oid = procedure.pronamespace
  where namespace.nspname = 'private'
    and procedure.proname = 'jsonb_has_forbidden_writing_snapshot_key'
    and pg_catalog.oidvectortypes(procedure.proargtypes) = 'jsonb';

  if v_volatility is distinct from 'i' then
    raise exception 'writing_snapshot_classifier_must_remain_immutable';
  end if;

  if not pg_catalog.has_function_privilege(
    'authenticated',
    'private.jsonb_has_forbidden_writing_snapshot_key(jsonb)',
    'EXECUTE'
  ) then
    raise exception 'authenticated_snapshot_constraint_execution_missing';
  end if;

  if not pg_catalog.has_function_privilege(
    'service_role',
    'private.jsonb_has_forbidden_writing_snapshot_key(jsonb)',
    'EXECUTE'
  ) then
    raise exception 'service_role_snapshot_constraint_execution_missing';
  end if;

  if pg_catalog.has_function_privilege(
    'anon',
    'private.jsonb_has_forbidden_writing_snapshot_key(jsonb)',
    'EXECUTE'
  ) then
    raise exception 'anonymous_snapshot_classifier_execution_must_remain_denied';
  end if;

  if private.jsonb_has_forbidden_writing_snapshot_key(
    '{"title":"safe learner material"}'::jsonb
  ) then
    raise exception 'writing_snapshot_classifier_rejected_safe_material';
  end if;

  if not private.jsonb_has_forbidden_writing_snapshot_key(
    '{"nested":{"rubric":"must not be exposed"}}'::jsonb
  ) then
    raise exception 'writing_snapshot_classifier_missed_forbidden_material';
  end if;
end;
$$;

commit;
