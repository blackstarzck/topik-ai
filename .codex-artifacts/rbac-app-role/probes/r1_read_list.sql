do $$
declare v_cnt int; v_roles text; v_learners int;
begin
  perform set_config('request.jwt.claims','{"sub":"ee97b5c1-63db-40aa-aa25-e0ca934cacbd"}', true);
  select count(*), string_agg(distinct app_role, ','), count(*) filter (where app_role='learner')
    into v_cnt, v_roles, v_learners
    from public.admin_list_admin_app_roles(null);
  raise exception 'READ1_OK admin_count=% roles=[%] learners=%', v_cnt, v_roles, v_learners;
end $$;
