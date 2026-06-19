do $$
begin
  perform set_config('request.jwt.claims','{"sub":"ee97b5c1-63db-40aa-aa25-e0ca934cacbd"}', true);
  perform public.admin_set_admin_app_role('ee97b5c1-63db-40aa-aa25-e0ca934cacbd'::uuid,'org_admin','self demote');
end $$;
