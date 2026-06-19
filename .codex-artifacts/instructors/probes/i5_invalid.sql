do $$ begin
  perform set_config('request.jwt.claims','{"sub":"ee97b5c1-63db-40aa-aa25-e0ca934cacbd"}', true);
  perform public.admin_set_instructor_status('INS-0001','잘못된상태','reason');
end $$;
