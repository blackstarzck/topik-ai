do $$ begin
  perform set_config('request.jwt.claims','{"sub":"1dad0fd0-0c19-447f-b668-f44184c1d9d7"}', true);
  perform public.admin_set_instructor_status('INS-0001','정지','x');
end $$;
