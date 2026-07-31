-- Interface-only rollback. Version and snapshot columns/data are retained so
-- historical submissions and resumable drafts remain reproducible. Their
-- import FKs are retained with the columns so rollback cannot orphan a pinned
-- canonical version.

drop function if exists public.create_external_writing_submission_v2(jsonb);
drop function if exists public.replace_stale_writing_draft(uuid, text, bigint, text);
drop trigger if exists writing_drafts_populate_question_snapshot
  on public.writing_drafts;
drop function if exists private.populate_writing_draft_question_snapshot();
drop trigger if exists writing_submissions_validate_canonical_context
  on public.writing_submissions;
drop function if exists private.validate_writing_submission_canonical_context();
drop function if exists private.assert_writing_submission_snapshot_matches_catalog(uuid, text, bigint, text, smallint, uuid, jsonb);
drop function if exists private.get_writing_question_snapshot_from_catalog(uuid, text, bigint, text, smallint, uuid);
