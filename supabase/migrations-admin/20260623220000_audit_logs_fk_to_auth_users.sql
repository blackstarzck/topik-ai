-- Phase 3: repoint admin_audit_logs.admin_user_id FK from profiles(id) to auth.users(id).
--
-- After admins are physically separated from profiles (no profiles row), the former
-- FK -> profiles(id) ON DELETE RESTRICT would (a) make every audit INSERT by a
-- profiles-less admin violate the FK, and (b) block deleting a migrated admin's
-- profiles row (Phase 7). auth.users(id) is the stable identity anchor that every
-- admin keeps (profiles.id itself references auth.users(id)). admin_audit_logs is
-- topik-ai-owned (owner decision 2026-06-17), so this repoint lives in migrations-admin.
--
-- Precheck on dev (fglggyfvzjdsbyckinqa, 2026-06-23): 0 orphan actor rows
-- (admin_user_id NOT IN auth.users), 0 null actors, column NOT NULL — repoint is safe.
-- down: supabase/migrations-admin/down/20260623220000_audit_logs_fk_to_auth_users.sql

alter table public.admin_audit_logs
  drop constraint if exists admin_audit_logs_admin_user_id_fkey;

alter table public.admin_audit_logs
  add constraint admin_audit_logs_admin_user_id_fkey
  foreign key (admin_user_id) references auth.users(id) on delete restrict;
