-- down: restore the FK to profiles(id) ON DELETE RESTRICT.
-- WARNING: only valid while every admin_user_id still has a matching profiles row.
-- After Phase 7 deletes the migrated admins' profiles rows, this down fails until
-- those profiles rows are restored from backup (.db-backup-full).
alter table public.admin_audit_logs
  drop constraint if exists admin_audit_logs_admin_user_id_fkey;

alter table public.admin_audit_logs
  add constraint admin_audit_logs_admin_user_id_fkey
  foreign key (admin_user_id) references public.profiles(id) on delete restrict;
