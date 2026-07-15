-- Corrective guard for the canonical cutover.
--
-- 20260713080015 may already be installed, so do not rewrite that migration.
-- Runtime transitions in v13 use the same transaction-scoped advisory lock
-- and lock the canonical tables before validating active drafts. An existing
-- canonical row replacement that began from a stale legacy/shadow read must
-- therefore re-check the runtime mode at its first destructive write.

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

drop trigger if exists topik_writing_block_canonical_question_replacement
  on public.topik_writing_51_questions;
create trigger topik_writing_block_canonical_question_replacement
before delete on public.topik_writing_51_questions
for each row execute function private.guard_writing_canonical_question_replacement();

drop trigger if exists topik_writing_block_canonical_question_replacement
  on public.topik_writing_52_questions;
create trigger topik_writing_block_canonical_question_replacement
before delete on public.topik_writing_52_questions
for each row execute function private.guard_writing_canonical_question_replacement();

drop trigger if exists topik_writing_block_canonical_question_replacement
  on public.topik_writing_53_questions;
create trigger topik_writing_block_canonical_question_replacement
before delete on public.topik_writing_53_questions
for each row execute function private.guard_writing_canonical_question_replacement();

drop trigger if exists topik_writing_block_canonical_question_replacement
  on public.topik_writing_54_questions;
create trigger topik_writing_block_canonical_question_replacement
before delete on public.topik_writing_54_questions
for each row execute function private.guard_writing_canonical_question_replacement();

comment on function private.guard_writing_canonical_question_replacement() is
  'Serializes existing canonical question replacement with the v13 runtime cutover and rejects stale delete/reinsert promotion after canonical reads begin.';
