-- =====================================================================
-- topik-ai admin - System logs - admin-0020
-- System > system logs mock -> Supabase read-only transition.
-- RLS: admin select only. No admin write policies, RPCs, or audit-log wiring.
-- Ingestion source is intentionally out of scope for this admin migration.
-- down: supabase/migrations-admin/down/20260617213000_system_logs.sql
-- =====================================================================

create table if not exists public.system_logs (
  id          text primary key,
  level       text not null,
  component   text not null,
  message     text not null,
  trace_id    text,
  context     jsonb,
  created_at  timestamptz not null default now()
);

alter table public.system_logs drop constraint if exists system_logs_level_check;
alter table public.system_logs add constraint system_logs_level_check
  check (level in ('INFO', 'WARN', 'ERROR'));

create index if not exists system_logs_created_at_desc_idx
  on public.system_logs (created_at desc);
create index if not exists system_logs_level_idx
  on public.system_logs (level)
  where level in ('WARN', 'ERROR');
create index if not exists system_logs_component_idx
  on public.system_logs (component);

alter table public.system_logs enable row level security;
alter table public.system_logs force row level security;
drop policy if exists system_logs_admin_select on public.system_logs;
create policy system_logs_admin_select on public.system_logs
  for select to authenticated using (private.is_admin((select auth.uid())));

insert into public.system_logs (id, level, component, message, trace_id, context, created_at)
values
  (
    'SYS-001',
    'INFO',
    'notification-worker',
    'dispatch batch completed',
    'trace-sys-001',
    '{"source":"mock-system-logs","seed":true}'::jsonb,
    '2026-03-11 09:11:42+09'::timestamptz
  ),
  (
    'SYS-002',
    'WARN',
    'billing-sync',
    'payment webhook delayed',
    'trace-sys-002',
    '{"source":"mock-system-logs","seed":true}'::jsonb,
    '2026-03-11 09:47:03+09'::timestamptz
  ),
  (
    'SYS-003',
    'ERROR',
    'community-service',
    'report queue retry limit reached',
    'trace-sys-003',
    '{"source":"mock-system-logs","seed":true}'::jsonb,
    '2026-03-11 10:02:19+09'::timestamptz
  ),
  (
    'SYS-004',
    'ERROR',
    'admin-auth',
    'temporary token validation failed',
    'trace-sys-004',
    '{"source":"mock-system-logs","seed":true}'::jsonb,
    '2026-03-11 10:38:11+09'::timestamptz
  )
on conflict (id) do nothing;
