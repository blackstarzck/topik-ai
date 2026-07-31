-- =====================================================================
-- TALKPIK AI · Tier 1 MVP · hardening round-2
-- 14/16 · storage.objects RLS policies
-- Spec: docs/development/database-schema.md §3
--
-- Path conventions (enforced by these policies):
--   avatars/{user_id}/{file}
--   problem-assets/{problem_id}/{file}
--   generated-exports/exports/{user_id}/{export_id}.pdf
--
-- storage.foldername(name) returns the path split by '/' WITHOUT the file name.
-- For 'exports/abc-uuid/xyz.pdf' it returns ['exports','abc-uuid'];
-- index [1] = 'exports', [2] = 'abc-uuid'.
-- =====================================================================

-- ---------------------------------------------------------------------
-- avatars: public read, owner write to own folder
-- ---------------------------------------------------------------------
drop policy if exists avatars_public_read on storage.objects;
create policy avatars_public_read
  on storage.objects
  for select to anon, authenticated
  using ( bucket_id = 'avatars' );

drop policy if exists avatars_owner_insert on storage.objects;
create policy avatars_owner_insert
  on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

drop policy if exists avatars_owner_update on storage.objects;
create policy avatars_owner_update
  on storage.objects
  for update to authenticated
  using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  )
  with check (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

drop policy if exists avatars_owner_delete on storage.objects;
create policy avatars_owner_delete
  on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

-- ---------------------------------------------------------------------
-- problem-assets: public read, admin write only
-- (problem-level visibility is enforced by RLS on public.problems / public.problem_assets;
--  the storage layer just serves files. Assets are public-read but indexable only by
--  someone who already got the problem_id via the table policies.)
-- ---------------------------------------------------------------------
drop policy if exists problem_assets_public_read on storage.objects;
create policy problem_assets_public_read
  on storage.objects
  for select to anon, authenticated
  using ( bucket_id = 'problem-assets' );

drop policy if exists problem_assets_admin_write on storage.objects;
create policy problem_assets_admin_write
  on storage.objects
  for all to authenticated
  using ( bucket_id = 'problem-assets' and private.is_admin((select auth.uid())) )
  with check ( bucket_id = 'problem-assets' and private.is_admin((select auth.uid())) );

-- ---------------------------------------------------------------------
-- generated-exports: private, owner read/write under exports/{user_id}/
-- ---------------------------------------------------------------------
drop policy if exists exports_owner_select on storage.objects;
create policy exports_owner_select
  on storage.objects
  for select to authenticated
  using (
    bucket_id = 'generated-exports'
    and (storage.foldername(name))[1] = 'exports'
    and (storage.foldername(name))[2] = (select auth.uid())::text
  );

drop policy if exists exports_owner_insert on storage.objects;
create policy exports_owner_insert
  on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'generated-exports'
    and (storage.foldername(name))[1] = 'exports'
    and (storage.foldername(name))[2] = (select auth.uid())::text
  );

drop policy if exists exports_owner_delete on storage.objects;
create policy exports_owner_delete
  on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'generated-exports'
    and (storage.foldername(name))[1] = 'exports'
    and (storage.foldername(name))[2] = (select auth.uid())::text
  );

-- exports are immutable after generation: no owner_update policy.
-- Server-side regeneration uses service_role which bypasses RLS.
