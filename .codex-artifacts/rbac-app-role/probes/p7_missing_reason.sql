do $$
begin
  perform set_config('request.jwt.claims','{"sub":"ee97b5c1-63db-40aa-aa25-e0ca934cacbd"}', true);
  perform public.admin_set_admin_app_role('1dad0fd0-0c19-447f-b668-f44184c1d9d7'::uuid,'org_admin','   ');
end $$;
