do $$
declare v int;
begin
  select count(*) into v from public.admin_list_admin_app_roles(null);
  raise exception 'UNEXPECTED count=%', v;
end $$;
