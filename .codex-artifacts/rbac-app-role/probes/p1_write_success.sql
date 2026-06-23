do $$
declare v_after text; v_log int;
begin
  perform set_config('request.jwt.claims','{"sub":"ee97b5c1-63db-40aa-aa25-e0ca934cacbd"}', true);
  perform public.admin_set_admin_app_role('1dad0fd0-0c19-447f-b668-f44184c1d9d7'::uuid,'org_admin','empirical write test');
  select app_role into v_after from public.profiles where id='1dad0fd0-0c19-447f-b668-f44184c1d9d7';
  select count(*) into v_log from public.admin_audit_logs where action='admin_role_changed' and target_id='1dad0fd0-0c19-447f-b668-f44184c1d9d7';
  raise exception 'PROBE1_OK after=% audit_rows=% (forced rollback, no persist)', v_after, v_log;
end $$;
