begin;

revoke all on function private.jsonb_has_forbidden_writing_snapshot_key(jsonb)
  from authenticated;
revoke all on function private.jsonb_has_forbidden_writing_snapshot_key(jsonb)
  from service_role;
revoke all on function private.jsonb_has_forbidden_writing_snapshot_key(jsonb)
  from public;
revoke all on function private.jsonb_has_forbidden_writing_snapshot_key(jsonb)
  from anon;

commit;
