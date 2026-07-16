-- Restore the exact definitions captured immediately before the forward
-- migration. This preserves newer filtered-analytics implementations instead
-- of attempting a lossy text rewrite back to an assumed older version.
do $$
declare
  v_function record;
begin
  if (
    select count(*)
      from private.admin_writing_analytics_rollback_function
  ) <> 3 then
    raise exception 'admin writing analytics rollback backup incomplete';
  end if;

  for v_function in
    select function_definition
      from private.admin_writing_analytics_rollback_function
     order by function_key
  loop
    execute v_function.function_definition;
  end loop;
end
$$;

drop view if exists private.admin_writing_question_metadata;
drop table if exists private.admin_writing_analytics_rollback_function;
