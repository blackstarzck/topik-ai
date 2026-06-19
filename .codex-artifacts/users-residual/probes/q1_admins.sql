do $$
declare v_cnt int; v_learners int;
begin
  perform set_config('request.jwt.claims','{"sub":"ee97b5c1-63db-40aa-aa25-e0ca934cacbd"}', true);
  select count(*), count(*) filter (where app_role='learner') into v_cnt, v_learners from public.admin_list_admins(null);
  raise exception 'ADMINS_OK count=% learners=%', v_cnt, v_learners;
end $$;
