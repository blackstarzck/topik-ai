do $$ declare v_name text; v_courses int; v_notes int;
begin
  perform set_config('request.jwt.claims','{"sub":"ee97b5c1-63db-40aa-aa25-e0ca934cacbd"}', true);
  select real_name, jsonb_array_length(assigned_courses), jsonb_array_length(admin_notes)
    into v_name, v_courses, v_notes from public.admin_get_instructor('INS-0001');
  raise exception 'DETAIL_OK name=% courses=% notes=%', v_name, v_courses, v_notes;
end $$;
