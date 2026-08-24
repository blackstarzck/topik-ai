-- Fix the canonical-replacement guard's optional dependency check.
--
-- 20260713082500 wrapped its optional call in a to_regprocedure existence
-- check, but PL/pgSQL resolves every function named in an IF expression when
-- the statement is first planned, so the static reference to
-- private.is_writing_canonical_read_enabled() raises 42883 the moment the v13
-- cutover (v13 20260714140000) removed that function — boolean short-circuit
-- never gets a chance to run. Measured 2026-08-24 on dev: every canonical
-- DELETE+INSERT replacement (promoted_updated) fails inside the promote RPC's
-- per-row handler and the receipt is re-held; production carries the same
-- function body and the same missing dependency, so replacement promotion has
-- been broken everywhere since the cutover. An existence check only fails open
-- when the optional call is issued through dynamic SQL, which resolves names
-- at execution time. Advisory-lock key and rejection semantics are unchanged;
-- if the v13 runtime-state machinery ever returns, the guard re-engages.
-- Tracker: topik_writing_schema_migrations (supabase/migrations).

create or replace function private.guard_writing_canonical_question_replacement()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public, private
as $$
declare
  v_enabled boolean := false;
begin
  -- Shared with v13 20260713084000. Keep this numeric key stable across repos.
  perform pg_catalog.pg_advisory_xact_lock(731971029691967530::bigint);

  if to_regprocedure('private.is_writing_canonical_read_enabled()') is not null then
    execute 'select private.is_writing_canonical_read_enabled()' into v_enabled;
  end if;

  if v_enabled then
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
  'Serializes existing canonical question replacement with the v13 runtime cutover. The optional runtime-mode probe is invoked through dynamic SQL so the guard fails open (allows replacement) when the v13 runtime-state machinery is absent, instead of raising 42883 from a statically planned reference.';
