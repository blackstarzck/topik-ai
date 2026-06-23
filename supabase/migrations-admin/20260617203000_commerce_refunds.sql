-- =====================================================================
-- topik-ai admin - Commerce refunds - admin-0019
-- Commerce > refund workflow mock -> Supabase transition.
-- RLS: admin select only. Writes are SECURITY DEFINER RPCs.
-- UI labels remain Korean; DB enum-like values are ASCII.
-- v13 payment_history/profiles are loose references only; no FK and no writes.
-- down: supabase/migrations-admin/down/20260617203000_commerce_refunds.sql
-- =====================================================================

create table if not exists public.commerce_refunds (
  id text primary key,
  payment_id text not null,
  user_id text not null,
  user_nickname text not null,
  requested_amount integer not null,
  reason text not null,
  status text not null default 'pending',
  requested_at timestamptz not null,
  processed_by text,
  processed_at timestamptz,
  review_reason text,
  created_at timestamptz not null default now()
);

alter table public.commerce_refunds drop constraint if exists commerce_refunds_id_check;
alter table public.commerce_refunds add constraint commerce_refunds_id_check
  check (id ~ '^RF-[0-9]+$');
alter table public.commerce_refunds drop constraint if exists commerce_refunds_requested_amount_check;
alter table public.commerce_refunds add constraint commerce_refunds_requested_amount_check
  check (requested_amount >= 0);
alter table public.commerce_refunds drop constraint if exists commerce_refunds_status_check;
alter table public.commerce_refunds add constraint commerce_refunds_status_check
  check (status in ('pending','approved','rejected'));
comment on constraint commerce_refunds_status_check on public.commerce_refunds is
  'ASCII statuses: pending=처리 대기, approved=승인, rejected=거절';

create index if not exists commerce_refunds_status
  on public.commerce_refunds (status);
create index if not exists commerce_refunds_requested_at
  on public.commerce_refunds (requested_at desc);

alter table public.commerce_refunds enable row level security;
alter table public.commerce_refunds force row level security;
drop policy if exists commerce_refunds_admin_select on public.commerce_refunds;
create policy commerce_refunds_admin_select on public.commerce_refunds
  for select to authenticated using (private.is_admin((select auth.uid())));

create or replace function public.next_commerce_refund_id()
returns text
language sql
stable
set search_path = pg_catalog, public
as $$
  select 'RF-' || lpad((coalesce(max(substring(id from '^RF-([0-9]+)$')::integer), 0) + 1)::text, 4, '0')
  from public.commerce_refunds
  where id ~ '^RF-[0-9]+$';
$$;

revoke all on function public.next_commerce_refund_id() from public;

insert into public.commerce_refunds (
  id, payment_id, user_id, user_nickname, requested_amount, reason, status,
  requested_at, processed_by, processed_at, review_reason, created_at
) values
  ('RF-0001','PAY-1001','U00001','member_1',29000,'중복 결제','pending','2026-03-04 10:23:00+09',null,null,null,'2026-03-04 10:23:00+09'),
  ('RF-0002','PAY-1002','U00008','member_8',49000,'서비스 미이용','approved','2026-03-02 08:12:00+09','admin_kim','2026-03-02 14:40:00+09','서비스 미이용 확인 후 승인','2026-03-02 08:12:00+09'),
  ('RF-0003','PAY-1005','U00024','member_24',79000,'결제 후 상품 변경 요청','rejected','2026-03-10 09:48:00+09','admin_park','2026-03-10 11:05:00+09','부분 환불 불가 상품','2026-03-10 09:48:00+09')
on conflict (id) do nothing;

create or replace function public.admin_approve_billing_refund(
  p_refund_id text,
  p_reason text
)
returns void
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  caller_id uuid := auth.uid();
  v_old public.commerce_refunds%rowtype;
  v_new public.commerce_refunds%rowtype;
begin
  if caller_id is null then raise exception 'unauthenticated'; end if;
  if not private.is_admin(caller_id) then raise exception 'forbidden: admin required'; end if;
  if nullif(btrim(coalesce(p_reason, '')), '') is null then raise exception 'reason required (operational reason)'; end if;

  select * into v_old
  from public.commerce_refunds
  where id = p_refund_id
  for update;
  if not found then raise exception 'unknown commerce refund id: %', p_refund_id; end if;
  if v_old.status <> 'pending' then raise exception 'commerce refund is not pending: %', p_refund_id; end if;

  update public.commerce_refunds
  set status = 'approved',
      processed_by = caller_id::text,
      processed_at = now(),
      review_reason = btrim(p_reason)
  where id = p_refund_id
  returning * into v_new;

  insert into public.admin_audit_logs (admin_user_id, action, target_table, target_id, diff, payload)
  values (
    caller_id,
    'refund_approved',
    'CommerceRefund',
    p_refund_id,
    jsonb_build_object('before', to_jsonb(v_old), 'after', to_jsonb(v_new)),
    jsonb_build_object(
      'reason', btrim(p_reason),
      'payment_id', v_new.payment_id,
      'requested_amount', v_new.requested_amount,
      'intent_only_v13_payment_history_pending', true
    )
  );
end;
$$;

create or replace function public.admin_reject_billing_refund(
  p_refund_id text,
  p_reason text
)
returns void
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  caller_id uuid := auth.uid();
  v_old public.commerce_refunds%rowtype;
  v_new public.commerce_refunds%rowtype;
begin
  if caller_id is null then raise exception 'unauthenticated'; end if;
  if not private.is_admin(caller_id) then raise exception 'forbidden: admin required'; end if;
  if nullif(btrim(coalesce(p_reason, '')), '') is null then raise exception 'reason required (operational reason)'; end if;

  select * into v_old
  from public.commerce_refunds
  where id = p_refund_id
  for update;
  if not found then raise exception 'unknown commerce refund id: %', p_refund_id; end if;
  if v_old.status <> 'pending' then raise exception 'commerce refund is not pending: %', p_refund_id; end if;

  update public.commerce_refunds
  set status = 'rejected',
      processed_by = caller_id::text,
      processed_at = now(),
      review_reason = btrim(p_reason)
  where id = p_refund_id
  returning * into v_new;

  insert into public.admin_audit_logs (admin_user_id, action, target_table, target_id, diff, payload)
  values (
    caller_id,
    'refund_rejected',
    'CommerceRefund',
    p_refund_id,
    jsonb_build_object('before', to_jsonb(v_old), 'after', to_jsonb(v_new)),
    jsonb_build_object(
      'reason', btrim(p_reason),
      'payment_id', v_new.payment_id,
      'requested_amount', v_new.requested_amount
    )
  );
end;
$$;
