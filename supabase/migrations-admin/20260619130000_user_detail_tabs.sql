-- Users > 회원 상세: admin-owned per-user tabs (활동 / 결제 / 접속 로그).
-- Owner decision (2026-06-19): these tabs are ADMIN-OWNED. New admin-owned tables +
-- read-only SECURITY DEFINER RPCs (display/audit tabs — no admin writes here, so no
-- write RPC / audit; mirrors the system_logs + community-read read-only precedent).
-- user_id is a loose uuid ref to v13 profiles (no FK — same convention as commerce/community).
-- down: supabase/migrations-admin/down/20260619130000_user_detail_tabs.sql

create table if not exists public.user_activity_events (
  id          text primary key,
  user_id     uuid not null,
  event_type  text not null,            -- 로그인 / 게시글 / ...
  content     text not null default '',
  ip          text not null default '',
  created_at  timestamptz not null default now()
);
create index if not exists user_activity_events_user_idx
  on public.user_activity_events (user_id, created_at desc);

create table if not exists public.user_payment_records (
  id          text primary key,
  user_id     uuid not null,
  product     text not null,
  amount_krw  int  not null default 0,
  method      text not null default '',  -- 카드 / 계좌이체 / ...
  status      text not null default '완료', -- 완료 / 환불 / ...
  paid_at     date,
  created_at  timestamptz not null default now()
);
create index if not exists user_payment_records_user_idx
  on public.user_payment_records (user_id, paid_at desc);

create table if not exists public.user_access_logs (
  id          text primary key,
  user_id     uuid not null,
  log_type    text not null,             -- 로그인 / API / ...
  ip          text not null default '',
  device      text not null default '',
  created_at  timestamptz not null default now()
);
create index if not exists user_access_logs_user_idx
  on public.user_access_logs (user_id, created_at desc);

alter table public.user_activity_events enable row level security;
alter table public.user_activity_events force row level security;
alter table public.user_payment_records enable row level security;
alter table public.user_payment_records force row level security;
alter table public.user_access_logs enable row level security;
alter table public.user_access_logs force row level security;

create policy user_activity_events_admin_select on public.user_activity_events
  for select to authenticated using (private.is_admin((select auth.uid())));
create policy user_payment_records_admin_select on public.user_payment_records
  for select to authenticated using (private.is_admin((select auth.uid())));
create policy user_access_logs_admin_select on public.user_access_logs
  for select to authenticated using (private.is_admin((select auth.uid())));

-- ── Read RPCs (is_admin guard, read-only) ─────────────────────────────────────
-- Datetime columns are returned as KST display text (YYYY-MM-DD HH24:MI) so the UI shows
-- Korean local time consistently (all other admin timestamps are display strings).
create or replace function public.admin_get_user_activity(
  p_target_user_id uuid, p_limit int default 100
)
returns table (id text, event_type text, content text, ip text, created_at text)
language plpgsql stable security definer set search_path = pg_catalog, public
as $$
declare caller_id uuid := auth.uid();
begin
  if caller_id is null then raise exception 'unauthenticated'; end if;
  if not private.is_admin(caller_id) then raise exception 'forbidden: admin required'; end if;
  return query
    select e.id, e.event_type, e.content, e.ip,
           to_char(e.created_at at time zone 'Asia/Seoul', 'YYYY-MM-DD HH24:MI')
      from public.user_activity_events e
     where e.user_id = p_target_user_id
     order by e.created_at desc
     limit greatest(coalesce(p_limit, 100), 1);
end;
$$;

create or replace function public.admin_get_user_payments(
  p_target_user_id uuid, p_limit int default 100
)
returns table (id text, product text, amount_krw int, method text, status text, paid_at text)
language plpgsql stable security definer set search_path = pg_catalog, public
as $$
declare caller_id uuid := auth.uid();
begin
  if caller_id is null then raise exception 'unauthenticated'; end if;
  if not private.is_admin(caller_id) then raise exception 'forbidden: admin required'; end if;
  return query
    select p.id, p.product, p.amount_krw, p.method, p.status,
           to_char(p.paid_at, 'YYYY-MM-DD')
      from public.user_payment_records p
     where p.user_id = p_target_user_id
     order by p.paid_at desc nulls last, p.id desc
     limit greatest(coalesce(p_limit, 100), 1);
end;
$$;

create or replace function public.admin_get_user_access_logs(
  p_target_user_id uuid, p_limit int default 100
)
returns table (id text, log_type text, ip text, device text, created_at text)
language plpgsql stable security definer set search_path = pg_catalog, public
as $$
declare caller_id uuid := auth.uid();
begin
  if caller_id is null then raise exception 'unauthenticated'; end if;
  if not private.is_admin(caller_id) then raise exception 'forbidden: admin required'; end if;
  return query
    select l.id, l.log_type, l.ip, l.device,
           to_char(l.created_at at time zone 'Asia/Seoul', 'YYYY-MM-DD HH24:MI')
      from public.user_access_logs l
     where l.user_id = p_target_user_id
     order by l.created_at desc
     limit greatest(coalesce(p_limit, 100), 1);
end;
$$;

revoke all on function public.admin_get_user_activity(uuid, int) from public;
revoke all on function public.admin_get_user_payments(uuid, int) from public;
revoke all on function public.admin_get_user_access_logs(uuid, int) from public;
grant execute on function public.admin_get_user_activity(uuid, int) to authenticated;
grant execute on function public.admin_get_user_payments(uuid, int) to authenticated;
grant execute on function public.admin_get_user_access_logs(uuid, int) to authenticated;

-- ── Seed (dev): two representative learners so the tabs demo non-empty ─────────
insert into public.user_activity_events (id, user_id, event_type, content, ip, created_at) values
  ('UA-78b0-1', '78b0dad4-0777-4c18-9daa-1c33f872721d', '로그인', 'TOPIK 웹 로그인', '121.133.11.42', '2026-03-03 09:12+09'),
  ('UA-78b0-2', '78b0dad4-0777-4c18-9daa-1c33f872721d', '게시글', '시험 학습 질문', '121.133.11.42', '2026-03-03 12:40+09'),
  ('UA-3b18-1', '3b18edba-9c5a-46ed-83d9-a71458d0b4a9', '로그인', 'TOPIK 모바일 로그인', '203.0.113.7', '2026-03-02 08:05+09')
on conflict (id) do nothing;

insert into public.user_payment_records (id, user_id, product, amount_krw, method, status, paid_at) values
  ('UP-78b0-1', '78b0dad4-0777-4c18-9daa-1c33f872721d', 'TOPIK Premium Monthly', 9000, '카드', '완료', '2026-02-14'),
  ('UP-78b0-2', '78b0dad4-0777-4c18-9daa-1c33f872721d', 'TOPIK Mock Test', 5000, '계좌이체', '환불', '2026-01-03'),
  ('UP-3b18-1', '3b18edba-9c5a-46ed-83d9-a71458d0b4a9', 'TOPIK Premium Monthly', 9000, '카드', '완료', '2026-02-20')
on conflict (id) do nothing;

insert into public.user_access_logs (id, user_id, log_type, ip, device, created_at) values
  ('UL-78b0-1', '78b0dad4-0777-4c18-9daa-1c33f872721d', '로그인', '121.133.11.42', 'Windows Chrome', '2026-03-03 09:12+09'),
  ('UL-78b0-2', '78b0dad4-0777-4c18-9daa-1c33f872721d', 'API', '121.133.11.42', 'Windows Chrome', '2026-03-03 09:15+09'),
  ('UL-3b18-1', '3b18edba-9c5a-46ed-83d9-a71458d0b4a9', '로그인', '203.0.113.7', 'Android Chrome', '2026-03-02 08:05+09')
on conflict (id) do nothing;

comment on function public.admin_get_user_activity(uuid, int) is
  'Users > 회원 상세 활동 탭 read (admin-owned user_activity_events). private.is_admin guard, read-only.';
comment on function public.admin_get_user_payments(uuid, int) is
  'Users > 회원 상세 결제 탭 read (admin-owned user_payment_records). private.is_admin guard, read-only.';
comment on function public.admin_get_user_access_logs(uuid, int) is
  'Users > 회원 상세 접속 로그 탭 read (admin-owned user_access_logs). private.is_admin guard, read-only.';
