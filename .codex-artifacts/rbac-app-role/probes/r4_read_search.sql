do $$
declare v int;
begin
  perform set_config('request.jwt.claims','{"sub":"ee97b5c1-63db-40aa-aa25-e0ca934cacbd"}', true);
  select count(*) into v from public.admin_list_admin_app_roles('zzz_nonexistent_zzz');
  raise exception 'READ4_OK search_filtered_count=%', v;
end $$;
