do $$
declare v_id text; v_listed int; v_deleted text; v_aadd int; v_adel int;
begin
  perform set_config('request.jwt.claims','{"sub":"ee97b5c1-63db-40aa-aa25-e0ca934cacbd"}', true);
  v_id := public.admin_add_user_memo('1dad0fd0-0c19-447f-b668-f44184c1d9d7','E2E 검증 메모','검증 사유');
  select count(*) into v_listed from public.admin_list_user_memos('1dad0fd0-0c19-447f-b668-f44184c1d9d7');
  select count(*) into v_aadd from public.admin_audit_logs where action='user_memo_added' and target_id='1dad0fd0-0c19-447f-b668-f44184c1d9d7';
  v_deleted := public.admin_delete_user_memo(v_id,'삭제 사유');
  select count(*) into v_adel from public.admin_audit_logs where action='user_memo_deleted' and target_id='1dad0fd0-0c19-447f-b668-f44184c1d9d7';
  raise exception 'MEMO_OK add=% listed=% deleted=% audit_add=% audit_del=%', v_id, v_listed, v_deleted, v_aadd, v_adel;
end $$;
