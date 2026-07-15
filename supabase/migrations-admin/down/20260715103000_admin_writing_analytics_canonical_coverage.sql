-- Restore the exact coverage-aware filtered analytics function captured by
-- the up migration, then remove the corrective private identity projection.

do $$
declare
  v_definition text;
begin
  select function_definition
    into v_definition
    from private.admin_writing_analytics_coverage_rollback_function
   where singleton;

  if v_definition is null then
    raise exception 'admin writing analytics coverage rollback definition missing';
  end if;

  execute v_definition;
end
$$;

drop view private.admin_writing_problem_identity_projection;
drop view private.admin_writing_question_identity_map;
drop table private.admin_writing_historical_identity_aliases;
drop table private.admin_writing_analytics_coverage_rollback_function;
