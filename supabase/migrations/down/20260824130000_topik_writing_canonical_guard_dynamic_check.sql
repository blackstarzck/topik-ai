-- Down for 20260824130000: restore the 20260713082500 guard definition with the
-- statically planned optional reference. Note that with the v13 runtime-state
-- machinery absent this restored body raises 42883 on every canonical
-- replacement — that is the pre-fix behavior being restored, not a new defect.

create or replace function private.guard_writing_canonical_question_replacement()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public, private
as $$
begin
  -- Shared with v13 20260713084000. Keep this numeric key stable across repos.
  perform pg_catalog.pg_advisory_xact_lock(731971029691967530::bigint);

  if to_regprocedure('private.is_writing_canonical_read_enabled()') is not null
     and private.is_writing_canonical_read_enabled() then
    raise exception 'canonical_question_replacement_requires_noncanonical_mode'
      using errcode = 'P0001',
            detail = 'Existing canonical question content cannot be delete/reinserted while learner reads are canonical.';
  end if;

  return old;
end;
$$;

revoke all on function private.guard_writing_canonical_question_replacement()
  from public;
revoke all on function private.guard_writing_canonical_question_replacement()
  from anon;
revoke all on function private.guard_writing_canonical_question_replacement()
  from authenticated;
revoke all on function private.guard_writing_canonical_question_replacement()
  from service_role;

comment on function private.guard_writing_canonical_question_replacement() is
  'Serializes existing canonical question replacement with the v13 runtime cutover and rejects stale delete/reinsert promotion after canonical reads begin.';
