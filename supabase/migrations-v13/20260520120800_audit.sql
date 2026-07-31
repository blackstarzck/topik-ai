-- =====================================================================
-- TALKPIK AI · Tier 1 MVP
-- 09/12 · admin_audit_logs (X-10 admin action tracking)
-- Spec: docs/development/database-schema.md §1.12
-- =====================================================================

create table if not exists public.admin_audit_logs (
  id             uuid primary key default gen_random_uuid(),
  admin_user_id  uuid not null references public.profiles(id) on delete restrict,
  action         text not null,
  target_table   text not null,
  target_id      text not null,
  diff           jsonb,
  payload        jsonb,
  created_at     timestamptz not null default now()
);

create index if not exists admin_audit_logs_admin_created
  on public.admin_audit_logs (admin_user_id, created_at desc);

create index if not exists admin_audit_logs_target_created
  on public.admin_audit_logs (target_table, target_id, created_at desc);

comment on table public.admin_audit_logs is
  'Append-only audit log for admin actions. select restricted to admins via RLS.';
