-- Restore a valid current history link for every operation policy.
-- This is idempotent: policies with a matching current history are untouched.

begin;

select pg_advisory_xact_lock(
  hashtextextended('repair-operation-policy-history-links', 0)
);

do $repair$
declare
  policy_row public.operation_policies%rowtype;
  next_history_id text;
begin
  for policy_row in
    select policy.*
    from public.operation_policies policy
    where not exists (
      select 1
      from public.operation_policy_histories history
      where history.policy_id = policy.id
        and history.id = policy.current_version_id
    )
    order by policy.id
  loop
    next_history_id := public.next_operation_policy_history_id();
    policy_row.current_version_id := next_history_id;

    insert into public.operation_policy_histories (
      id,
      policy_id,
      action,
      version_label,
      changed_at,
      changed_by,
      snapshot
    )
    values (
      next_history_id,
      policy_row.id,
      'created',
      policy_row.version_label,
      policy_row.updated_at,
      policy_row.updated_by,
      public.operation_policy_snapshot(policy_row)
    );

    update public.operation_policies
    set current_version_id = next_history_id
    where id = policy_row.id;
  end loop;
end
$repair$;

commit;
