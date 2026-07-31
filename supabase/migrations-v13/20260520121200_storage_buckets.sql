-- =====================================================================
-- TALKPIK AI · Tier 1 MVP · hardening round-2
-- 13/16 · Storage buckets
-- Spec: docs/development/database-schema.md §3
-- =====================================================================

-- avatars: public read, owner write under {user_id}/...
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('avatars',           'avatars',           true,  5  * 1024 * 1024, array['image/png','image/jpeg','image/webp']),
  ('problem-assets',    'problem-assets',    true,  20 * 1024 * 1024, array['image/png','image/jpeg','image/webp','audio/mpeg','audio/wav','audio/ogg']),
  ('generated-exports', 'generated-exports', false, 50 * 1024 * 1024, array['application/pdf'])
on conflict (id) do nothing;

-- Note: existing buckets are NOT modified by this migration. To change limits
-- or mime types of an existing bucket, run an explicit UPDATE in a follow-up migration.
