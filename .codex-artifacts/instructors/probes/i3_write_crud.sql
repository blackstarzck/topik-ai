do $$ declare v_note text; v_audit int;
begin
  perform set_config('request.jwt.claims','{"sub":"ee97b5c1-63db-40aa-aa25-e0ca934cacbd"}', true);
  perform public.admin_set_instructor_status('INS-0002','정지','검증 정지');
  v_note := public.admin_add_instructor_note('INS-0002','검증 메모','검증 사유');
  perform public.admin_delete_instructor_note(v_note,'검증 삭제');
  select count(*) into v_audit from public.admin_audit_logs where target_table='Instructor' and target_id='INS-0002';
  raise exception 'WRITE_OK note=% audit_rows=% (rolled back)', v_note, v_audit;
end $$;
