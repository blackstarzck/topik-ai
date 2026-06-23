do $$ declare v_cnt int; v_titles text; begin
  perform set_config('request.jwt.claims','{"sub":"ee97b5c1-63db-40aa-aa25-e0ca934cacbd"}', true);
  select count(*), string_agg(title,' | ') into v_cnt, v_titles from public.admin_get_user_community_posts('U00012', 50);
  raise exception 'COMMUNITY_OK count=% titles=[%]', v_cnt, coalesce(v_titles,'');
end $$;
