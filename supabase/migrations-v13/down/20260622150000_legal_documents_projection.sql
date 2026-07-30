-- down: remove the legal_documents projection RPC and provenance columns.
drop function if exists public.admin_sync_legal_document_from_operation_policy(
  text, text, text, text, date, boolean, text, text, text, text, text, text
);
alter table public.legal_documents
  drop column if exists source_policy_id,
  drop column if exists source_policy_history_id,
  drop column if exists source_synced_at;
