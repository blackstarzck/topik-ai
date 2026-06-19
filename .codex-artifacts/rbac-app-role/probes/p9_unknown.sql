do $$
begin
  perform set_config('request.jwt.claims','{"sub":"ee97b5c1-63db-40aa-aa25-e0ca934cacbd"}', true);
  perform public.admin_set_admin_app_role('00000000-0000-0000-0000-000000000000'::uuid,'org_admin','unknown target');
end $$;
