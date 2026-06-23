do $$
declare
  v_pf_diff jsonb; v_pf_payload jsonb; v_pf_kw int;
  v_ca_diff jsonb; v_ca_payload jsonb; v_ca_kw int;
begin
  insert into public.admin_audit_logs(admin_user_id, action, target_table, target_id, diff, payload)
    values('ee97b5c1-63db-40aa-aa25-e0ca934cacbd','__probe_action__','__Probe__','__PROBE_TARGET__',
           '{"secret_field":"SENSITIVE_DIFF"}'::jsonb,
           '{"reason":"probe reason","secret":"SENSITIVE_PAYLOAD"}'::jsonb);

  -- platform_admin read
  perform set_config('request.jwt.claims','{"sub":"ee97b5c1-63db-40aa-aa25-e0ca934cacbd"}', true);
  select diff, payload into v_pf_diff, v_pf_payload
    from public.admin_list_audit_logs(null,'__PROBE_TARGET__',null,null,null,10,0) limit 1;
  select count(*) into v_pf_kw
    from public.admin_list_audit_logs(null,null,'SENSITIVE_PAYLOAD',null,null,10,0);

  -- promote a learner to content_admin (test) and read as them
  update public.profiles set app_role='content_admin' where id='1dad0fd0-0c19-447f-b668-f44184c1d9d7';
  perform set_config('request.jwt.claims','{"sub":"1dad0fd0-0c19-447f-b668-f44184c1d9d7"}', true);
  select diff, payload into v_ca_diff, v_ca_payload
    from public.admin_list_audit_logs(null,'__PROBE_TARGET__',null,null,null,10,0) limit 1;
  select count(*) into v_ca_kw
    from public.admin_list_audit_logs(null,null,'SENSITIVE_PAYLOAD',null,null,10,0);

  raise exception 'GATE platform[diff=% payload=% payloadKw=%] content_admin[diff=% payload=% payloadKw=%] (rolled back)',
    (v_pf_diff is not null),(v_pf_payload is not null),v_pf_kw,
    (v_ca_diff is not null),(v_ca_payload is not null),v_ca_kw;
end $$;
