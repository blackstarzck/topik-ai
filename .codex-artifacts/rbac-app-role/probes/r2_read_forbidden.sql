do $$
declare v int;
begin
  perform set_config('request.jwt.claims','{"sub":"1dad0fd0-0c19-447f-b668-f44184c1d9d7"}', true);
  select count(*) into v from public.admin_list_admin_app_roles(null);
  raise exception 'UNEXPECTED count=%', v;
end $$;
