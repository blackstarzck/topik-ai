-- =====================================================================
-- TALKPIK AI - legal_documents public read policy fix - 2026-06-12
--
-- /auth/consent reads published legal_documents before/after OAuth.
-- The original public read policy mixed published-row access with the
-- platform-admin helper:
--
--   status = 'published' or private.is_platform_admin(auth.uid())
--
-- The helper is intentionally not executable by anon, so anon reads of
-- published rows can fail with 42501 before the published predicate is useful.
-- Keep public published reads independent from admin-only access.
-- =====================================================================

drop policy if exists legal_documents_published_read on public.legal_documents;
create policy legal_documents_published_read
  on public.legal_documents
  for select to anon, authenticated
  using ( status = 'published' );

-- The existing legal_documents_admin_all policy continues to grant platform
-- admins access to draft/archived rows and write operations.
