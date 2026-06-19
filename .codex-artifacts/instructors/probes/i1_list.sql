do $$ declare v_cnt int; v_statuses text;
begin
  perform set_config('request.jwt.claims','{"sub":"ee97b5c1-63db-40aa-aa25-e0ca934cacbd"}', true);
  select count(*), string_agg(distinct status,',') into v_cnt, v_statuses from public.admin_list_instructors(null,null,null,null,null);
  raise exception 'LIST_OK count=% statuses=[%]', v_cnt, v_statuses;
end $$;
