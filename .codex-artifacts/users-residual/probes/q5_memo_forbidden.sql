do $$ begin
  perform set_config('request.jwt.claims','{"sub":"1dad0fd0-0c19-447f-b668-f44184c1d9d7"}', true);
  perform public.admin_add_user_memo('1dad0fd0-0c19-447f-b668-f44184c1d9d7','c','r');
end $$;
