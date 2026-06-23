-- =====================================================================
-- topik-ai admin - Commerce points - admin-0017
-- Commerce > 포인트 관리 mock -> Supabase transition.
-- RLS: admin select only. Writes are SECURITY DEFINER RPCs.
-- UI labels remain Korean; DB enum-like values are ASCII.
-- down: supabase/migrations-admin/down/20260617190000_commerce_points.sql
-- =====================================================================

create table if not exists public.commerce_point_policies (
  id text primary key,
  name text not null,
  policy_type text not null,
  category text not null,
  amount integer not null default 0,
  points integer not null default 0,
  status text not null default 'draft',
  description text,
  condition_summary text not null default '',
  earn_debit_rule text not null default '',
  expiration_rule text not null default '',
  target_condition text not null default '',
  trigger_source text not null default '',
  duplication_rule text not null default '',
  manual_adjustment_rule text not null default '',
  note text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  updated_by text
);

create table if not exists public.commerce_point_ledgers (
  id text primary key,
  user_id text not null,
  user_name text,
  entry_type text not null,
  source_type text not null default 'admin',
  amount integer not null,
  balance_after integer not null,
  available_balance_after integer not null,
  status text not null default 'completed',
  expiration_at date,
  source text,
  source_id text,
  source_label text,
  policy_id text,
  policy_name text,
  reason text not null,
  approval_memo text,
  occurred_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  created_by text
);

create table if not exists public.commerce_point_expirations (
  id text primary key,
  user_id text not null,
  user_name text,
  source_type text not null default 'system',
  scheduled_amount integer not null,
  available_amount integer not null default 0,
  expire_at timestamptz not null,
  status text not null default 'scheduled',
  hold_reason text,
  held_by text,
  held_at timestamptz,
  processed_at timestamptz,
  related_ledger_id text,
  policy_id text,
  policy_name text,
  calculation_memo text not null default '',
  created_at timestamptz not null default now()
);

alter table public.commerce_point_policies drop constraint if exists commerce_point_policies_policy_type_check;
alter table public.commerce_point_policies add constraint commerce_point_policies_policy_type_check
  check (policy_type in ('earn','debit','expire'));
alter table public.commerce_point_policies drop constraint if exists commerce_point_policies_category_check;
alter table public.commerce_point_policies add constraint commerce_point_policies_category_check
  check (category in ('earn','debit','expire'));
alter table public.commerce_point_policies drop constraint if exists commerce_point_policies_status_check;
alter table public.commerce_point_policies add constraint commerce_point_policies_status_check
  check (status in ('draft','active','inactive'));

alter table public.commerce_point_ledgers drop constraint if exists commerce_point_ledgers_entry_type_check;
alter table public.commerce_point_ledgers add constraint commerce_point_ledgers_entry_type_check
  check (entry_type in ('earn','debit','revoke','restore','expire'));
alter table public.commerce_point_ledgers drop constraint if exists commerce_point_ledgers_source_type_check;
alter table public.commerce_point_ledgers add constraint commerce_point_ledgers_source_type_check
  check (source_type in ('referral','mission','event','payment','refund','admin','system'));
alter table public.commerce_point_ledgers drop constraint if exists commerce_point_ledgers_status_check;
alter table public.commerce_point_ledgers add constraint commerce_point_ledgers_status_check
  check (status in ('completed','held','cancelled'));
alter table public.commerce_point_ledgers drop constraint if exists commerce_point_ledgers_nonnegative_balance_check;
alter table public.commerce_point_ledgers add constraint commerce_point_ledgers_nonnegative_balance_check
  check (balance_after >= 0 and available_balance_after >= 0);

alter table public.commerce_point_expirations drop constraint if exists commerce_point_expirations_status_check;
alter table public.commerce_point_expirations add constraint commerce_point_expirations_status_check
  check (status in ('scheduled','held','completed','cancelled'));
alter table public.commerce_point_expirations drop constraint if exists commerce_point_expirations_source_type_check;
alter table public.commerce_point_expirations add constraint commerce_point_expirations_source_type_check
  check (source_type in ('referral','mission','event','payment','refund','admin','system'));
alter table public.commerce_point_expirations drop constraint if exists commerce_point_expirations_amount_nonnegative_check;
alter table public.commerce_point_expirations add constraint commerce_point_expirations_amount_nonnegative_check
  check (scheduled_amount >= 0 and available_amount >= 0);

create index if not exists commerce_point_ledgers_user_occurred_at
  on public.commerce_point_ledgers (user_id, occurred_at desc);
create index if not exists commerce_point_expirations_user_id
  on public.commerce_point_expirations (user_id);
create index if not exists commerce_point_expirations_expire_at
  on public.commerce_point_expirations (expire_at);

alter table public.commerce_point_policies enable row level security;
alter table public.commerce_point_policies force row level security;
drop policy if exists commerce_point_policies_admin_select on public.commerce_point_policies;
create policy commerce_point_policies_admin_select on public.commerce_point_policies
  for select to authenticated using (private.is_admin((select auth.uid())));

alter table public.commerce_point_ledgers enable row level security;
alter table public.commerce_point_ledgers force row level security;
drop policy if exists commerce_point_ledgers_admin_select on public.commerce_point_ledgers;
create policy commerce_point_ledgers_admin_select on public.commerce_point_ledgers
  for select to authenticated using (private.is_admin((select auth.uid())));

alter table public.commerce_point_expirations enable row level security;
alter table public.commerce_point_expirations force row level security;
drop policy if exists commerce_point_expirations_admin_select on public.commerce_point_expirations;
create policy commerce_point_expirations_admin_select on public.commerce_point_expirations
  for select to authenticated using (private.is_admin((select auth.uid())));

create or replace function public.next_commerce_point_policy_id()
returns text
language sql
stable
set search_path = pg_catalog, public
as $$
  select 'POL-' || lpad((coalesce(max(substring(id from '^POL-([0-9]+)$')::integer), 0) + 1)::text, 4, '0')
  from public.commerce_point_policies
  where id ~ '^POL-[0-9]+$';
$$;

create or replace function public.next_commerce_point_ledger_id()
returns text
language sql
stable
set search_path = pg_catalog, public
as $$
  select 'PL-' || lpad((coalesce(max(substring(id from '^PL-([0-9]+)$')::integer), 0) + 1)::text, 4, '0')
  from public.commerce_point_ledgers
  where id ~ '^PL-[0-9]+$';
$$;

revoke all on function public.next_commerce_point_policy_id() from public;
revoke all on function public.next_commerce_point_ledger_id() from public;

insert into public.commerce_point_policies (
  id, name, policy_type, category, status, description, condition_summary,
  earn_debit_rule, expiration_rule, target_condition, trigger_source,
  duplication_rule, manual_adjustment_rule, note, created_at, updated_at, updated_by
) values
  ('POL-1001','추천 가입 보상','earn','earn','active','추천 코드 가입 후 추천 확정 시 1회 적립','추천 코드 가입 후 추천 확정 시 1회 적립','추천 확정 시 추천인 1,000P 적립','적립 후 90일 뒤 소멸','추천 확정 회원','추천','추천 관계 1건당 1회만 적립','예외 조정은 운영 관리자 승인 후 가능','추천 정책 확정 전까지 1,000P 기준으로 운영 중','2026-03-24 10:10:00+09','2026-03-24 10:10:00+09','ops.kim'),
  ('POL-1002','미션 완료 보상','earn','earn','active','학습 미션 완료 시 즉시 적립','학습 미션 완료 시 즉시 적립','미션별 300P~1,500P 차등 적립','적립 후 60일 뒤 소멸','미션 완료 회원','미션','동일 미션 재참여 시 적립 제한','이상 적립만 수동 회수 허용','미션 난이도별 보상 금액은 아직 운영 가이드에 맞춰 조정 예정','2026-03-23 16:40:00+09','2026-03-23 16:40:00+09','content.lee'),
  ('POL-1003','결제 포인트 사용','debit','debit','draft','결제 시 사용 가능 포인트 차감','결제 시 사용 가능 포인트 차감','결제 성공 시 사용 포인트 차감','환불 시 차감 포인트 복구 여부 검토 필요','포인트 사용 결제 회원','결제','주문 단위 1회 차감','환불 복구는 재무 검토 후 수동 승인','차감 우선순위와 환불 복구 정책이 아직 미확정','2026-03-22 09:05:00+09','2026-03-22 09:05:00+09','ops.park'),
  ('POL-1004','소멸 예고 기본 규칙','expire','expire','inactive','유효기간이 지난 포인트 자동 소멸','유효기간이 지난 포인트 자동 소멸','소멸 대상 포인트를 만료 일시에 차감','만료 7일 전 사전 안내 후 자동 소멸','유효기간 종료 포인트','시스템','동일 원장 중복 소멸 금지','보류 등록 시 자동 소멸 제외','사전 안내 시점과 예외 기준 재검토로 일시 중지','2026-03-21 14:20:00+09','2026-03-21 14:20:00+09','ops.kim')
on conflict (id) do nothing;

insert into public.commerce_point_ledgers (
  id, occurred_at, user_id, user_name, entry_type, source_type, amount,
  balance_after, available_balance_after, status, expiration_at, source,
  source_id, source_label, policy_id, policy_name, reason, approval_memo, created_by
) values
  ('PL-2008','2026-03-26 14:20:00+09','U00018','김하린','earn','event',500,3500,3200,'completed','2026-06-24','EVT-3201','EVT-3201','봄 출석 이벤트','POL-1001','추천 가입 보상','이벤트 참여 적립','자동 적립','system'),
  ('PL-2007','2026-03-26 11:05:00+09','U00004','박선우','revoke','admin',-700,1200,1200,'completed',null,'MANUAL-9003','MANUAL-9003','운영 수동 회수','POL-1002','미션 완료 보상','중복 적립 확인으로 회수','운영 관리자 확인 완료','ops.kim'),
  ('PL-2006','2026-03-26 09:30:00+09','U00009','이서준','earn','referral',1000,5400,5400,'completed','2026-06-24','REF-1102','REF-1102','추천 코드 REF-1102','POL-1001','추천 가입 보상','추천 확정 보상','자동 적립','system'),
  ('PL-2005','2026-03-25 16:15:00+09','U00012','최예린','debit','payment',-2000,800,800,'held',null,'PAY-1005','PAY-1005','결제 PAY-1005','POL-1003','결제 포인트 사용','결제 포인트 사용 적용 대기','환불 복구 정책 검토 중','billing.bot'),
  ('PL-2004','2026-03-25 09:45:00+09','U00021','오민재','restore','refund',1200,2600,2600,'completed','2026-05-31','RF-002','RF-002','환불 RF-002','POL-1003','결제 포인트 사용','환불 승인으로 포인트 복구','재무 승인 완료','ops.finance'),
  ('PL-2003','2026-03-24 18:00:00+09','U00001','김민지','expire','system',-1500,900,900,'cancelled','2026-03-24','EXP-3002','EXP-3002','소멸 예약 EXP-3002','POL-1004','소멸 예고 기본 규칙','보류 등록으로 소멸 취소','고객센터 승인','system'),
  ('PL-2002','2026-03-24 10:00:00+09','U00030','정예나','earn','mission',800,4300,4300,'completed','2026-05-23','MIS-3209','MIS-3209','초급 듣기 미션','POL-1002','미션 완료 보상','미션 완료 보상','자동 적립','system'),
  ('PL-2001','2026-03-23 08:30:00+09','U00005','한지수','earn','admin',2000,2000,2000,'completed','2026-06-21','MANUAL-9001','MANUAL-9001','운영 수동 적립','POL-1002','미션 완료 보상','고객 보상 지급','VOC 대응','ops.park')
on conflict (id) do nothing;

insert into public.commerce_point_expirations (
  id, expire_at, user_id, user_name, source_type, scheduled_amount, available_amount,
  status, hold_reason, held_by, processed_at, related_ledger_id, policy_id,
  policy_name, calculation_memo
) values
  ('EXP-3005','2026-03-27 00:00:00+09','U00009','이서준','referral',1000,5400,'scheduled',null,null,null,'PL-2006','POL-1001','추천 가입 보상','추천 보상 90일 만료 예정'),
  ('EXP-3004','2026-03-28 00:00:00+09','U00012','최예린','payment',1200,800,'held','환불 검토 완료 후 만료 재계산 필요','ops.finance',null,'PL-2004','POL-1003','결제 포인트 사용','환불 복구 포인트라 재계산 전까지 보류'),
  ('EXP-3003','2026-03-29 00:00:00+09','U00018','김하린','event',500,3200,'scheduled',null,null,null,'PL-2008','POL-1001','추천 가입 보상','이벤트 적립분 기본 만료 예정'),
  ('EXP-3002','2026-03-24 00:00:00+09','U00001','김민지','system',1500,900,'cancelled','고객센터 보류 등록 후 취소','ops.kim','2026-03-24 09:10:00+09','PL-2003','POL-1004','소멸 예고 기본 규칙','소멸 시도 후 보류 전환으로 취소 처리'),
  ('EXP-3001','2026-03-22 00:00:00+09','U00007','조유진','mission',900,0,'completed',null,null,'2026-03-22 00:01:00+09','PL-1899','POL-1002','미션 완료 보상','예정 일시에 자동 소멸 처리')
on conflict (id) do nothing;

create or replace function public.admin_save_commerce_point_policy(
  p_id text,
  p_policy jsonb,
  p_reason text
)
returns text
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  caller_id uuid := auth.uid();
  v_id text;
  v_old public.commerce_point_policies%rowtype;
  v_saved public.commerce_point_policies%rowtype;
begin
  if caller_id is null then raise exception 'unauthenticated'; end if;
  if not private.is_admin(caller_id) then raise exception 'forbidden: admin required'; end if;
  if nullif(btrim(coalesce(p_reason, '')), '') is null then raise exception 'reason required (operational reason)'; end if;
  if nullif(btrim(coalesce(p_policy->>'name', '')), '') is null then raise exception 'name required'; end if;
  if (p_policy->>'policy_type') not in ('earn','debit','expire') then raise exception 'invalid point policy_type: %', p_policy->>'policy_type'; end if;

  if nullif(btrim(coalesce(p_id, '')), '') is null then
    perform pg_advisory_xact_lock(hashtext('commerce_point_policy_id'));
    v_id := public.next_commerce_point_policy_id();
    insert into public.commerce_point_policies (
      id, name, policy_type, category, status, description, condition_summary,
      earn_debit_rule, expiration_rule, target_condition, trigger_source,
      duplication_rule, manual_adjustment_rule, note, updated_by
    ) values (
      v_id,
      btrim(p_policy->>'name'),
      p_policy->>'policy_type',
      p_policy->>'policy_type',
      'draft',
      coalesce(p_policy->>'condition_summary', ''),
      coalesce(p_policy->>'condition_summary', ''),
      coalesce(p_policy->>'earn_debit_rule', ''),
      coalesce(p_policy->>'expiration_rule', ''),
      coalesce(p_policy->>'target_condition', ''),
      coalesce(p_policy->>'trigger_source', ''),
      coalesce(p_policy->>'duplication_rule', ''),
      coalesce(p_policy->>'manual_adjustment_rule', ''),
      coalesce(p_policy->>'note', ''),
      caller_id::text
    ) returning * into v_saved;
  else
    v_id := btrim(p_id);
    select * into v_old from public.commerce_point_policies where id = v_id for update;
    if not found then raise exception 'unknown commerce point policy id: %', v_id; end if;

    update public.commerce_point_policies
       set name = btrim(p_policy->>'name'),
           policy_type = p_policy->>'policy_type',
           category = p_policy->>'policy_type',
           description = coalesce(p_policy->>'condition_summary', ''),
           condition_summary = coalesce(p_policy->>'condition_summary', ''),
           earn_debit_rule = coalesce(p_policy->>'earn_debit_rule', ''),
           expiration_rule = coalesce(p_policy->>'expiration_rule', ''),
           target_condition = coalesce(p_policy->>'target_condition', ''),
           trigger_source = coalesce(p_policy->>'trigger_source', ''),
           duplication_rule = coalesce(p_policy->>'duplication_rule', ''),
           manual_adjustment_rule = coalesce(p_policy->>'manual_adjustment_rule', ''),
           note = coalesce(p_policy->>'note', ''),
           updated_by = caller_id::text,
           updated_at = now()
     where id = v_id
     returning * into v_saved;
  end if;

  insert into public.admin_audit_logs (admin_user_id, action, target_table, target_id, diff, payload)
  values (
    caller_id, 'point_policy_saved', 'CommercePointPolicy', v_id, '{}'::jsonb,
    jsonb_build_object('reason', p_reason, 'name', v_saved.name, 'policy_type', v_saved.policy_type)
  );
  return v_id;
end;
$$;

create or replace function public.admin_update_commerce_point_policy_status(
  p_policy_id text,
  p_next_status text,
  p_reason text
)
returns text
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  caller_id uuid := auth.uid();
  v_old public.commerce_point_policies%rowtype;
  v_saved public.commerce_point_policies%rowtype;
begin
  if caller_id is null then raise exception 'unauthenticated'; end if;
  if not private.is_admin(caller_id) then raise exception 'forbidden: admin required'; end if;
  if nullif(btrim(coalesce(p_reason, '')), '') is null then raise exception 'reason required (operational reason)'; end if;
  if p_next_status not in ('active','inactive') then raise exception 'invalid point policy status: %', p_next_status; end if;

  select * into v_old from public.commerce_point_policies where id = p_policy_id for update;
  if not found then raise exception 'unknown commerce point policy id: %', p_policy_id; end if;

  update public.commerce_point_policies
     set status = p_next_status,
         note = concat_ws(E'\n', nullif(note, ''), '[' || to_char(now(), 'YYYY-MM-DD HH24:MI') || ' / ' || caller_id::text || '] status ' || p_next_status || ' - ' || p_reason),
         updated_by = caller_id::text,
         updated_at = now()
   where id = p_policy_id
   returning * into v_saved;

  insert into public.admin_audit_logs (admin_user_id, action, target_table, target_id, diff, payload)
  values (
    caller_id, 'point_policy_status_changed', 'CommercePointPolicy', p_policy_id,
    jsonb_build_object('status', jsonb_build_object('from', v_old.status, 'to', v_saved.status)),
    jsonb_build_object('reason', p_reason, 'name', v_saved.name)
  );
  return p_policy_id;
end;
$$;

create or replace function public.admin_create_manual_point_adjustment(
  p_user_id text,
  p_amount integer,
  p_reason text
)
returns text
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  caller_id uuid := auth.uid();
  v_latest public.commerce_point_ledgers%rowtype;
  v_ledger_id text;
  v_next_balance integer;
  v_entry_type text;
begin
  if caller_id is null then raise exception 'unauthenticated'; end if;
  if not private.is_admin(caller_id) then raise exception 'forbidden: admin required'; end if;
  if nullif(btrim(coalesce(p_reason, '')), '') is null then raise exception 'reason required (operational reason)'; end if;
  if nullif(btrim(coalesce(p_user_id, '')), '') is null then raise exception 'user_id required'; end if;
  if coalesce(p_amount, 0) = 0 then raise exception 'amount must not be zero'; end if;

  perform pg_advisory_xact_lock(hashtext('commerce_point_ledger_user:' || p_user_id));
  perform pg_advisory_xact_lock(hashtext('commerce_point_ledger_id'));

  select * into v_latest
    from public.commerce_point_ledgers
   where user_id = p_user_id
   order by occurred_at desc, created_at desc, id desc
   limit 1
   for update;

  v_next_balance := coalesce(v_latest.available_balance_after, 0) + p_amount;
  -- Negative point balances are blocked until the commerce deficit policy is documented.
  if v_next_balance < 0 then
    raise exception 'point balance cannot be negative';
  end if;

  v_ledger_id := public.next_commerce_point_ledger_id();
  v_entry_type := case when p_amount < 0 then 'debit' else 'earn' end;

  insert into public.commerce_point_ledgers (
    id, user_id, user_name, entry_type, source_type, amount, balance_after,
    available_balance_after, status, expiration_at, source, source_id,
    source_label, policy_id, policy_name, reason, approval_memo, occurred_at,
    created_by
  ) values (
    v_ledger_id, p_user_id, p_user_id, v_entry_type, 'admin', p_amount,
    v_next_balance, v_next_balance, 'completed',
    case when p_amount > 0 then (current_date + interval '90 days')::date else null end,
    'manual_adjustment', v_ledger_id, '운영 수동 조정', 'POL-1002',
    '운영 수동 조정', btrim(p_reason), btrim(p_reason), now(), caller_id::text
  );

  insert into public.admin_audit_logs (admin_user_id, action, target_table, target_id, diff, payload)
  values (
    caller_id, 'point_manual_adjusted', 'CommercePointLedger', v_ledger_id,
    jsonb_build_object('available_balance_after', jsonb_build_object('from', coalesce(v_latest.available_balance_after, 0), 'to', v_next_balance)),
    jsonb_build_object('reason', p_reason, 'user_id', p_user_id, 'amount', p_amount)
  );
  return v_ledger_id;
end;
$$;

create or replace function public.admin_hold_commerce_point_expiration(
  p_expiration_id text,
  p_reason text
)
returns text
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  caller_id uuid := auth.uid();
  v_old public.commerce_point_expirations%rowtype;
begin
  if caller_id is null then raise exception 'unauthenticated'; end if;
  if not private.is_admin(caller_id) then raise exception 'forbidden: admin required'; end if;
  if nullif(btrim(coalesce(p_reason, '')), '') is null then raise exception 'reason required (operational reason)'; end if;

  select * into v_old from public.commerce_point_expirations where id = p_expiration_id for update;
  if not found then raise exception 'unknown commerce point expiration id: %', p_expiration_id; end if;

  update public.commerce_point_expirations
     set status = case when status = 'completed' then 'completed' else 'held' end,
         hold_reason = btrim(p_reason),
         held_by = caller_id::text,
         held_at = now(),
         calculation_memo = concat_ws(E'\n', nullif(calculation_memo, ''), '[' || to_char(now(), 'YYYY-MM-DD HH24:MI') || ' / ' || caller_id::text || '] hold - ' || p_reason)
   where id = p_expiration_id;

  insert into public.admin_audit_logs (admin_user_id, action, target_table, target_id, diff, payload)
  values (
    caller_id, 'point_expiration_held', 'CommercePointExpiration', p_expiration_id,
    jsonb_build_object('status', jsonb_build_object('from', v_old.status, 'to', case when v_old.status = 'completed' then 'completed' else 'held' end)),
    jsonb_build_object('reason', p_reason, 'user_id', v_old.user_id)
  );
  return p_expiration_id;
end;
$$;

create or replace function public.admin_release_commerce_point_expiration(
  p_expiration_id text,
  p_reason text
)
returns text
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  caller_id uuid := auth.uid();
  v_old public.commerce_point_expirations%rowtype;
begin
  if caller_id is null then raise exception 'unauthenticated'; end if;
  if not private.is_admin(caller_id) then raise exception 'forbidden: admin required'; end if;
  if nullif(btrim(coalesce(p_reason, '')), '') is null then raise exception 'reason required (operational reason)'; end if;

  select * into v_old from public.commerce_point_expirations where id = p_expiration_id for update;
  if not found then raise exception 'unknown commerce point expiration id: %', p_expiration_id; end if;

  update public.commerce_point_expirations
     set status = 'scheduled',
         hold_reason = null,
         held_by = null,
         held_at = null,
         calculation_memo = concat_ws(E'\n', nullif(calculation_memo, ''), '[' || to_char(now(), 'YYYY-MM-DD HH24:MI') || ' / ' || caller_id::text || '] release - ' || p_reason)
   where id = p_expiration_id;

  insert into public.admin_audit_logs (admin_user_id, action, target_table, target_id, diff, payload)
  values (
    caller_id, 'point_expiration_released', 'CommercePointExpiration', p_expiration_id,
    jsonb_build_object('status', jsonb_build_object('from', v_old.status, 'to', 'scheduled')),
    jsonb_build_object('reason', p_reason, 'user_id', v_old.user_id)
  );
  return p_expiration_id;
end;
$$;

revoke all on function public.admin_save_commerce_point_policy(text, jsonb, text) from public;
revoke all on function public.admin_update_commerce_point_policy_status(text, text, text) from public;
revoke all on function public.admin_create_manual_point_adjustment(text, integer, text) from public;
revoke all on function public.admin_hold_commerce_point_expiration(text, text) from public;
revoke all on function public.admin_release_commerce_point_expiration(text, text) from public;
grant execute on function public.admin_save_commerce_point_policy(text, jsonb, text) to authenticated;
grant execute on function public.admin_update_commerce_point_policy_status(text, text, text) to authenticated;
grant execute on function public.admin_create_manual_point_adjustment(text, integer, text) to authenticated;
grant execute on function public.admin_hold_commerce_point_expiration(text, text) to authenticated;
grant execute on function public.admin_release_commerce_point_expiration(text, text) to authenticated;
