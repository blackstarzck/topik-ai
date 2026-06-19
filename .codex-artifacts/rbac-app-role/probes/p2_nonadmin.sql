do $$
begin
  perform set_config('request.jwt.claims','{"sub":"1dad0fd0-0c19-447f-b668-f44184c1d9d7"}', true);
  perform public.admin_set_admin_app_role('2b551b6b-b0da-4ab2-b929-61018c878b31'::uuid,'org_admin','should be forbidden');
end $$;
