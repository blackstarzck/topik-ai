-- Users > 추천인 관리: admin-owned referral directory (code / relations / reward ledger).
-- Owner decision (2026-06-19): Referral is an ADMIN-OWNED entity. New admin-owned tables
-- + SECURITY DEFINER admin RPCs; no v13 DDL change (referrer/referred user ids are loose
-- text refs to v13 profiles). Reward POLICY (확정 시점/보상 수단/회수·취소 규칙) is
-- intentionally undefined per page-sync §13 — we build the STRUCTURE and stub the policy:
-- reward_method_label defaults to '정책 미확정' and adjustments only record an audited entry
-- (no confirmation-timing / rollback automation). Derived fields (referred/confirmed count,
-- total reward, anomaly flags, last_used_at) are computed on read, not denormalized.
-- down: supabase/migrations-admin/down/20260619120000_referrals.sql

create table if not exists public.referrals (
  id                          text primary key,
  code                        text not null,
  referrer_user_id            text,
  referrer_name               text,
  referrer_email              text,
  created_at                  text,                          -- display timestamp (mock parity)
  expires_at                  text,
  last_action_at              text,
  status                      text not null default '활성',   -- 활성 / 비활성
  anomaly_status              text not null default '없음',   -- 없음 / 검토 필요 / 검토 완료
  admin_memo                  text not null default '',
  policy_snapshot             jsonb not null default jsonb_build_object(
    'version', '정책 초안 v0',
    'confirmationTiming', '미확정',
    'rewardMethod', '미확정',
    'manualAdjustmentAuthority', '미확정',
    'rollbackRule', '미확정',
    'note', '추천 확정 시점, 보상 수단, 수동 보정 권한, 회수 규칙은 아직 확정되지 않았으며 운영 화면에서 가정값으로만 표시됩니다.'
  ),
  created_ts                  timestamptz not null default now(),
  updated_at                  timestamptz not null default now()
);
create index if not exists referrals_status_idx on public.referrals (status);
create index if not exists referrals_anomaly_idx on public.referrals (anomaly_status);

create table if not exists public.referral_relations (
  id                 text primary key,
  referral_id        text not null references public.referrals(id) on delete cascade,
  referred_user_id   text,
  referred_user_name text,
  joined_at          text,
  confirmed_at       text not null default '',
  status             text not null default '대기',   -- 대기 / 완료 / 취소
  anomaly_flag       text not null default '',
  review_note        text not null default ''
);
create index if not exists referral_relations_referral_idx
  on public.referral_relations (referral_id);

create table if not exists public.referral_reward_ledgers (
  id                  text primary key,
  referral_id         text not null references public.referrals(id) on delete cascade,
  relation_id         text not null default '',
  entry_type          text not null,                       -- 지급 / 회수 / 취소 / 수동 보정
  reward_method_label text not null default '정책 미확정',
  amount              int  not null default 0,
  status              text not null default '완료',          -- 대기 / 완료 / 취소
  acted_at            text,
  reason              text not null default '',
  created_ts          timestamptz not null default now()
);
create index if not exists referral_reward_ledgers_referral_idx
  on public.referral_reward_ledgers (referral_id, created_ts desc);

alter table public.referrals enable row level security;
alter table public.referrals force row level security;
alter table public.referral_relations enable row level security;
alter table public.referral_relations force row level security;
alter table public.referral_reward_ledgers enable row level security;
alter table public.referral_reward_ledgers force row level security;

create policy referrals_admin_select on public.referrals
  for select to authenticated using (private.is_admin((select auth.uid())));
create policy referral_relations_admin_select on public.referral_relations
  for select to authenticated using (private.is_admin((select auth.uid())));
create policy referral_reward_ledgers_admin_select on public.referral_reward_ledgers
  for select to authenticated using (private.is_admin((select auth.uid())));

-- ── Read: list (full ReferralSummary incl nested relations / ledger / derived) ──
create or replace function public.admin_list_referrals(
  p_search         text default null,
  p_status         text default null,
  p_anomaly_status text default null
)
returns table (
  id text, code text, referrer_user_id text, referrer_name text, referrer_email text,
  created_at text, expires_at text, last_used_at text, last_action_at text,
  status text, anomaly_status text, anomaly_flags jsonb,
  referred_count int, confirmed_count int, total_reward_amount int,
  admin_memo text, relations jsonb, reward_ledger jsonb, policy_snapshot jsonb
)
language plpgsql stable security definer set search_path = pg_catalog, public
as $$
declare
  caller_id uuid := auth.uid();
  v_search text := lower(nullif(btrim(coalesce(p_search, '')), ''));
begin
  if caller_id is null then raise exception 'unauthenticated'; end if;
  if not private.is_admin(caller_id) then raise exception 'forbidden: admin required'; end if;
  return query
    select
      r.id, r.code, r.referrer_user_id, r.referrer_name, r.referrer_email,
      r.created_at, r.expires_at,
      coalesce((
        select max(coalesce(nullif(rel.confirmed_at, ''), rel.joined_at))
          from public.referral_relations rel where rel.referral_id = r.id
      ), '') as last_used_at,
      r.last_action_at, r.status, r.anomaly_status,
      coalesce((
        select jsonb_agg(distinct rel.anomaly_flag)
          from public.referral_relations rel
         where rel.referral_id = r.id and nullif(rel.anomaly_flag, '') is not null
      ), '[]'::jsonb) as anomaly_flags,
      coalesce((select count(*) from public.referral_relations rel
                 where rel.referral_id = r.id), 0)::int as referred_count,
      coalesce((select count(*) from public.referral_relations rel
                 where rel.referral_id = r.id and rel.status = '완료'), 0)::int as confirmed_count,
      coalesce((select sum(l.amount) from public.referral_reward_ledgers l
                 where l.referral_id = r.id and l.status = '완료'), 0)::int as total_reward_amount,
      r.admin_memo,
      coalesce((
        select jsonb_agg(jsonb_build_object(
                 'id', rel.id, 'referredUserId', rel.referred_user_id,
                 'referredUserName', rel.referred_user_name, 'joinedAt', rel.joined_at,
                 'confirmedAt', rel.confirmed_at, 'status', rel.status,
                 'anomalyFlag', rel.anomaly_flag, 'reviewNote', rel.review_note)
               order by rel.id)
          from public.referral_relations rel where rel.referral_id = r.id
      ), '[]'::jsonb) as relations,
      coalesce((
        select jsonb_agg(jsonb_build_object(
                 'id', l.id, 'relationId', l.relation_id, 'entryType', l.entry_type,
                 'rewardMethodLabel', l.reward_method_label, 'amount', l.amount,
                 'status', l.status, 'actedAt', l.acted_at, 'reason', l.reason)
               order by l.created_ts desc, l.id desc)
          from public.referral_reward_ledgers l where l.referral_id = r.id
      ), '[]'::jsonb) as reward_ledger,
      r.policy_snapshot
    from public.referrals r
   where (p_status is null or r.status = p_status)
     and (p_anomaly_status is null or r.anomaly_status = p_anomaly_status)
     and (
       v_search is null
       or lower(r.code) ilike '%' || v_search || '%'
       or lower(coalesce(r.referrer_user_id, '')) ilike '%' || v_search || '%'
       or lower(coalesce(r.referrer_name, '')) ilike '%' || v_search || '%'
     )
   order by r.id;
end;
$$;

-- ── Write: status (activate / deactivate) ────────────────────────────────────
create or replace function public.admin_set_referral_status(
  p_referral_id text, p_status text, p_reason text
)
returns text
language plpgsql security definer set search_path = pg_catalog, public
as $$
declare
  caller_id uuid := auth.uid();
  v_old text;
  v_now text := to_char(now(), 'YYYY-MM-DD HH24:MI');
begin
  if caller_id is null then raise exception 'unauthenticated'; end if;
  if not private.is_admin(caller_id) then raise exception 'forbidden: admin required'; end if;
  if p_status not in ('활성', '비활성') then raise exception 'invalid status: %', p_status; end if;
  if nullif(btrim(coalesce(p_reason, '')), '') is null then raise exception 'reason required'; end if;

  select status into v_old from public.referrals where id = p_referral_id for update;
  if not found then raise exception 'unknown referral id: %', p_referral_id; end if;
  if v_old = p_status then raise exception 'referral already %', p_status; end if;

  update public.referrals
     set status = p_status, last_action_at = v_now, updated_at = now()
   where id = p_referral_id;

  insert into public.admin_audit_logs (admin_user_id, action, target_table, target_id, diff, payload)
  values (caller_id, 'referral_status_changed', 'Referral', p_referral_id,
          jsonb_build_object('status', jsonb_build_object('from', v_old, 'to', p_status)),
          jsonb_build_object('reason', btrim(p_reason)));
  return p_referral_id;
end;
$$;

-- ── Write: anomaly review (mark 검토 완료 + append admin memo) ─────────────────
create or replace function public.admin_review_referral_anomaly(
  p_referral_id text, p_reason text
)
returns text
language plpgsql security definer set search_path = pg_catalog, public
as $$
declare
  caller_id uuid := auth.uid();
  v_old text;
  v_memo text;
  v_now text := to_char(now(), 'YYYY-MM-DD HH24:MI');
begin
  if caller_id is null then raise exception 'unauthenticated'; end if;
  if not private.is_admin(caller_id) then raise exception 'forbidden: admin required'; end if;
  if nullif(btrim(coalesce(p_reason, '')), '') is null then raise exception 'reason required'; end if;

  select anomaly_status, admin_memo into v_old, v_memo
    from public.referrals where id = p_referral_id for update;
  if not found then raise exception 'unknown referral id: %', p_referral_id; end if;

  update public.referrals
     set anomaly_status = '검토 완료',
         admin_memo = v_memo || E'\n- ' || v_now || ' 이상치 검토 완료: ' || btrim(p_reason),
         last_action_at = v_now,
         updated_at = now()
   where id = p_referral_id;

  insert into public.admin_audit_logs (admin_user_id, action, target_table, target_id, diff, payload)
  values (caller_id, 'referral_anomaly_reviewed', 'Referral', p_referral_id,
          jsonb_build_object('anomaly_status', jsonb_build_object('from', v_old, 'to', '검토 완료')),
          jsonb_build_object('reason', btrim(p_reason)));
  return p_referral_id;
end;
$$;

-- ── Write: manual reward adjustment (POLICY STUB — records audited entry only) ─
-- entry_type derives from amount sign (>=0 수동 보정, <0 회수). reward_method_label stays
-- '정책 미확정' until the reward policy is defined; no confirmation/rollback automation.
create or replace function public.admin_adjust_referral_reward(
  p_referral_id text, p_amount int, p_reason text
)
returns text
language plpgsql security definer set search_path = pg_catalog, public
as $$
declare
  caller_id uuid := auth.uid();
  v_entry_type text;
  v_id text;
  v_now text := to_char(now(), 'YYYY-MM-DD HH24:MI');
begin
  if caller_id is null then raise exception 'unauthenticated'; end if;
  if not private.is_admin(caller_id) then raise exception 'forbidden: admin required'; end if;
  if p_amount is null then raise exception 'amount required'; end if;
  if nullif(btrim(coalesce(p_reason, '')), '') is null then raise exception 'reason required'; end if;
  if not exists (select 1 from public.referrals where id = p_referral_id) then
    raise exception 'unknown referral id: %', p_referral_id;
  end if;

  v_entry_type := case when p_amount >= 0 then '수동 보정' else '회수' end;
  v_id := 'ADJ-' || replace(gen_random_uuid()::text, '-', '');

  insert into public.referral_reward_ledgers
    (id, referral_id, relation_id, entry_type, reward_method_label, amount, status, acted_at, reason)
  values
    (v_id, p_referral_id, '', v_entry_type, '정책 미확정', p_amount, '완료', v_now, btrim(p_reason));

  update public.referrals set last_action_at = v_now, updated_at = now() where id = p_referral_id;

  insert into public.admin_audit_logs (admin_user_id, action, target_table, target_id, diff, payload)
  values (caller_id, 'referral_reward_adjusted', 'Referral', p_referral_id,
          jsonb_build_object('ledger_id', v_id, 'amount', p_amount, 'entry_type', v_entry_type),
          jsonb_build_object('reason', btrim(p_reason), 'ledger_id', v_id));
  return v_id;
end;
$$;

revoke all on function public.admin_list_referrals(text, text, text) from public;
revoke all on function public.admin_set_referral_status(text, text, text) from public;
revoke all on function public.admin_review_referral_anomaly(text, text) from public;
revoke all on function public.admin_adjust_referral_reward(text, int, text) from public;
grant execute on function public.admin_list_referrals(text, text, text) to authenticated;
grant execute on function public.admin_set_referral_status(text, text, text) to authenticated;
grant execute on function public.admin_review_referral_anomaly(text, text) to authenticated;
grant execute on function public.admin_adjust_referral_reward(text, int, text) to authenticated;

-- ── Seed (dev): representative coverage of status / anomaly / relation / entry types ──
insert into public.referrals
  (id, code, referrer_user_id, referrer_name, referrer_email, created_at, expires_at, last_action_at, status, anomaly_status, admin_memo)
values
  ('REF-0001', 'TOPIK-3200', 'U00011', '김민준', 'member11@topik.ai', '2026-03-01 10:00', '2026-05-01', '2026-03-12 12:00', '활성', '없음',
   '운영 모니터링 상태입니다. 정책 확정 전까지는 가정값 기준으로만 관리합니다.'),
  ('REF-0002', 'TOPIK-3201', 'U00012', '이서연', 'member12@topik.ai', '2026-03-02 11:00', '2026-05-05', '2026-03-13 09:30', '활성', '검토 필요',
   '추천 확정 및 보상 지급 기준이 미확정이므로 이상치 검토 우선 대상입니다.'),
  ('REF-0003', 'TOPIK-3202', 'U00013', '박지후', 'member13@topik.ai', '2026-03-03 09:00', '2026-04-20', '2026-03-14 15:00', '비활성', '검토 완료',
   '운영 검토를 마쳤으며 후속 정책 확정 시 보상 원장 재점검이 필요합니다.')
on conflict (id) do nothing;

insert into public.referral_relations
  (id, referral_id, referred_user_id, referred_user_name, joined_at, confirmed_at, status, anomaly_flag, review_note)
values
  ('REL-0001-1', 'REF-0001', 'U00201', '최서연', '2026-02-15 10:00', '2026-02-17 11:00', '완료', '', ''),
  ('REL-0001-2', 'REF-0001', 'U00202', '정도윤', '2026-02-18 10:00', '2026-02-20 11:00', '완료', '', ''),
  ('REL-0001-3', 'REF-0001', 'U00203', '강예린', '2026-02-22 10:00', '2026-02-24 11:00', '완료', '', ''),
  ('REL-0002-1', 'REF-0002', 'U00210', '조시우', '2026-02-25 10:00', '2026-02-27 11:00', '완료', '자기추천 의심', '운영 검토 필요'),
  ('REL-0002-2', 'REF-0002', 'U00211', '윤유진', '2026-02-26 10:00', '2026-02-28 11:00', '완료', '', ''),
  ('REL-0002-3', 'REF-0002', 'U00212', '장현우', '2026-03-01 10:00', '', '대기', '', ''),
  ('REL-0003-1', 'REF-0003', 'U00220', '임지원', '2026-02-10 10:00', '2026-02-12 11:00', '완료', '동일 기기 반복', '운영 검토 완료'),
  ('REL-0003-2', 'REF-0003', 'U00221', '김민준', '2026-02-11 10:00', '', '취소', '', '')
on conflict (id) do nothing;

insert into public.referral_reward_ledgers
  (id, referral_id, relation_id, entry_type, amount, status, acted_at, reason)
values
  ('RWD-0001-1', 'REF-0001', 'REL-0001-1', '지급', 4000, '완료', '2026-02-17 12:00', '추천 확정 기준 가정값 반영'),
  ('RWD-0001-2', 'REF-0001', 'REL-0001-2', '지급', 4000, '완료', '2026-02-20 12:00', '추천 확정 기준 가정값 반영'),
  ('RWD-0001-3', 'REF-0001', 'REL-0001-3', '지급', 4000, '완료', '2026-02-24 12:00', '추천 확정 기준 가정값 반영'),
  ('RWD-0002-1', 'REF-0002', 'REL-0002-1', '지급', 5000, '완료', '2026-02-27 12:00', '추천 확정 기준 가정값 반영'),
  ('RWD-0002-2', 'REF-0002', 'REL-0002-2', '지급', 5000, '완료', '2026-02-28 12:00', '추천 확정 기준 가정값 반영'),
  ('RWD-0003-1', 'REF-0003', 'REL-0003-1', '지급', 6000, '완료', '2026-02-12 12:00', '추천 확정 기준 가정값 반영'),
  ('RWD-0003-2', 'REF-0003', 'REL-0003-2', '취소', -6000, '완료', '2026-02-19 12:00', '추천 확정 취소 가정값 반영'),
  ('ADJ-0003-1', 'REF-0003', '', '수동 보정', 1000, '완료', '2026-03-10 14:00', '운영 검토 후 수동 보정')
on conflict (id) do nothing;

comment on function public.admin_list_referrals(text, text, text) is
  'Users > 추천인 관리 list (full ReferralSummary incl nested relations/ledger + derived counts/total/flags). private.is_admin guard.';
comment on function public.admin_adjust_referral_reward(text, int, text) is
  'Users > 추천인 관리 manual reward adjustment — POLICY STUB (records audited ledger entry, reward_method_label=정책 미확정; no confirmation/rollback automation).';
