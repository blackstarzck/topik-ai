do $$
begin
  perform public.admin_set_admin_app_role('2b551b6b-b0da-4ab2-b929-61018c878b31'::uuid,'org_admin','should be unauth');
end $$;
