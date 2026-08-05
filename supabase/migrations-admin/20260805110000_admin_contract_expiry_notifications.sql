-- =====================================================================
-- 관리자 인앱 알림 substrate + 기관 계약 만료 임박 적재
--
-- 배경: 계약 기간(20260804100000)과 D-day 화면(PR #77)은 있지만, 관리자가 그 화면을
--   보러 들어오지 않으면 만료를 놓친다. 오너 요구는 만료 임박 인앱 알림이었다.
--
-- 🚨 계획서(snappy-yawning-flame.md)의 PR-D 전제 2개가 실측과 달랐다(2026-08-05):
--   ① "admin_accounts 는 profiles 행이 없어 알림 수신자가 될 수 없다" → **사실이 아니다.**
--      admin_accounts.id 는 auth.users(id) 를 참조하고 handle_new_user 가 모든 auth 유저에
--      profiles 행을 만든다. dev 1/1, 운영 1/1 모두 profiles 행이 있다.
--   ② "org_admin 을 수신자로" → **org_admin 계정이 dev·운영 모두 0개**이고 기관↔관리자
--      매핑 스키마도 없다. 그대로 만들면 수신자가 구조적으로 0명인 기능이 된다.
--   오너 결정(2026-08-05): **마스터 관리자(platform_admin)를 수신자로 먼저** 만들고,
--   기관 단위 관리자 계정이 생기면 이 substrate 를 재사용한다.
--
-- 왜 user_notifications 를 쓰지 않는가: 그 테이블은 v13 공유 객체이고(학습자 알림함의
--   원장) v13 앱이 로그인 사용자 기준으로 읽는다. 관리자 도메인 알림을 그쪽에 넣으면
--   학습자 앱 알림함에 관리 문구가 나타나고, 남의 소유 테이블을 오염시킨다.
--   check-migration-ownership-boundary 의 V13_USER_SHARED_OBJECTS 에 등재된 이유가 그것이다.
--   → 수신자 FK 가 admin_accounts 인 별도 테이블을 만든다.
--
-- 왜 admin 폴더인가: dispatch_notifications 의 **최신 정의 소유 폴더가 admin**
--   (20260723011242 notification_pipeline_ownership_transfer)이다. writing 폴더에서 고치면
--   적용 순서(writing → admin)상 나중에 도는 admin 이 구버전으로 되덮는다 —
--   20260804100300 에서 같은 함정을 이미 밟았다.
--
-- 신규 cron 을 만들지 않는다: 기존 10분 tick(dispatch_notifications)에 키 하나를 더한다.
--   cron 이 늘어나면 스케줄 소유·실패 관측 지점이 갈라진다.
--
-- down: supabase/migrations-admin/down/20260805110000_admin_contract_expiry_notifications.sql
-- =====================================================================

-- ---------------------------------------------------------------- 알림 원장
create table if not exists public.admin_notifications (
  id                 uuid primary key default gen_random_uuid(),
  recipient_admin_id uuid not null references public.admin_accounts(id) on delete cascade,
  category           text not null,
  -- 영구 dedup 키. tick 이 10분마다 도므로 이것이 없으면 같은 마일스톤이 하루 144번 쌓인다.
  event_key          text not null,
  title              text not null,
  body               text,
  link_url           text,
  payload            jsonb,
  read_at            timestamptz,
  created_at         timestamptz not null default now(),
  constraint admin_notifications_event_unique unique (recipient_admin_id, event_key)
);

create index if not exists admin_notifications_recipient_unread_idx
  on public.admin_notifications (recipient_admin_id, created_at desc)
  where read_at is null;

-- RLS: enable 만(force 금지 — definer RPC 경로를 막는다). 읽기는 **본인 행만**.
-- 관리자끼리도 서로의 알림함을 보지 못한다.
alter table public.admin_notifications enable row level security;

drop policy if exists admin_notifications_owner_select on public.admin_notifications;
create policy admin_notifications_owner_select
  on public.admin_notifications
  for select to authenticated
  using (recipient_admin_id = (select auth.uid()));

comment on table public.admin_notifications is
  '관리자 인앱 알림 원장. 수신자 FK 는 admin_accounts(id)(= auth.users(id)) 이며 학습자 알림함 user_notifications 와 분리한다 — 그쪽은 v13 공유 객체라 관리 도메인 알림을 넣으면 학습자 앱에 노출된다. (recipient_admin_id, event_key) unique 가 영구 dedup 이다: 적재는 10분 cron tick 에서 일어나므로 이것이 없으면 같은 마일스톤이 반복 적재된다. RLS 는 본인 행 select 만 허용하고 쓰기는 definer RPC 단일 경로다. 2026-08-05.';

comment on column public.admin_notifications.event_key is
  '영구 dedup 키. 계약 만료 알림은 `contract_expiry:<code>:<contract_id>:<bucket>` 형식이며 bucket 은 d30/d7/expired 다. 계약을 새로 만들면 contract_id 가 달라져 새 알림이 나간다.';

-- ---------------------------------------------------------------- 조회 RPC
create or replace function public.admin_list_my_notifications(
  p_limit       integer default 50,
  p_unread_only boolean default false
)
returns table (
  id         uuid,
  category   text,
  title      text,
  body       text,
  link_url   text,
  payload    jsonb,
  read_at    timestamptz,
  created_at timestamptz
)
language plpgsql
security definer
stable
set search_path = pg_catalog, public, private
as $$
declare
  caller_id uuid := auth.uid();
  v_limit   integer := least(greatest(coalesce(p_limit, 50), 1), 200);
begin
  if caller_id is null then
    raise exception 'unauthenticated';
  end if;
  if not private.is_admin(caller_id) then
    raise exception 'forbidden: admin required';
  end if;

  -- 본인 행만. definer 라서 RLS 를 우회하므로 여기서 명시적으로 좁힌다.
  --
  -- `id` 로 tie-break 하는 이유: 한 tick 의 적재는 단일 INSERT 라 created_at 이 **전부 같다**
  -- (now() 는 트랜잭션 고정). created_at 만으로 정렬하면 같은 tick 알림들의 순서가 매 조회마다
  -- 달라져 목록이 흔들리고 limit 경계에서 행이 누락·중복된다.
  return query
  select n.id, n.category, n.title, n.body, n.link_url, n.payload, n.read_at, n.created_at
    from public.admin_notifications n
   where n.recipient_admin_id = caller_id
     and (not coalesce(p_unread_only, false) or n.read_at is null)
   order by n.created_at desc, n.id
   limit v_limit;
end;
$$;

revoke all on function public.admin_list_my_notifications(integer, boolean) from public;
revoke all on function public.admin_list_my_notifications(integer, boolean) from anon;
grant execute on function public.admin_list_my_notifications(integer, boolean) to authenticated;

comment on function public.admin_list_my_notifications(integer, boolean) is
  '로그인한 관리자 본인의 인앱 알림 목록(최신순, 최대 200건). definer 라 RLS 를 우회하므로 본문에서 recipient_admin_id = auth.uid() 로 명시적으로 좁힌다 — 다른 관리자의 알림함을 볼 수 없다. 정렬은 (created_at desc, id) 다: 한 tick 의 적재는 단일 INSERT 라 created_at 이 전부 같으므로 tie-break 없이는 목록 순서가 조회마다 흔들린다. 2026-08-05.';

create or replace function public.admin_count_my_unread_notifications()
returns integer
language plpgsql
security definer
stable
set search_path = pg_catalog, public, private
as $$
declare
  caller_id uuid := auth.uid();
  v_count   integer;
begin
  if caller_id is null then
    raise exception 'unauthenticated';
  end if;
  if not private.is_admin(caller_id) then
    raise exception 'forbidden: admin required';
  end if;

  select count(*)
    into v_count
    from public.admin_notifications n
   where n.recipient_admin_id = caller_id
     and n.read_at is null;

  return coalesce(v_count, 0);
end;
$$;

revoke all on function public.admin_count_my_unread_notifications() from public;
revoke all on function public.admin_count_my_unread_notifications() from anon;
grant execute on function public.admin_count_my_unread_notifications() to authenticated;

comment on function public.admin_count_my_unread_notifications() is
  '로그인한 관리자 본인의 미읽음 알림 수(셸 벨 배지용). 2026-08-05.';

-- ---------------------------------------------------------------- 읽음 처리 RPC
-- 읽음은 조치가 아니라 열람 기록이므로 사유를 요구하지 않고 감사 로그도 남기지 않는다
-- (사유 필수 규약은 상태를 바꾸는 운영 조치에 적용된다).
create or replace function public.admin_mark_notification_read(p_id uuid)
returns integer
language plpgsql
security definer
set search_path = pg_catalog, public, private
as $$
declare
  caller_id uuid := auth.uid();
  v_changed integer := 0;
begin
  if caller_id is null then raise exception 'unauthenticated'; end if;
  if not private.is_admin(caller_id) then raise exception 'forbidden: admin required'; end if;
  if p_id is null then raise exception 'notification id required'; end if;

  update public.admin_notifications
     set read_at = now()
   where id = p_id
     and recipient_admin_id = caller_id
     and read_at is null;
  get diagnostics v_changed = row_count;

  return v_changed;
end;
$$;

revoke all on function public.admin_mark_notification_read(uuid) from public;
revoke all on function public.admin_mark_notification_read(uuid) from anon;
grant execute on function public.admin_mark_notification_read(uuid) to authenticated;

comment on function public.admin_mark_notification_read(uuid) is
  '알림 1건을 읽음 처리한다(본인 행만, 이미 읽은 행은 no-op). 변경된 행 수를 돌려준다. 열람 기록이라 사유·감사 로그를 요구하지 않는다. 2026-08-05.';

create or replace function public.admin_mark_all_notifications_read()
returns integer
language plpgsql
security definer
set search_path = pg_catalog, public, private
as $$
declare
  caller_id uuid := auth.uid();
  v_changed integer := 0;
begin
  if caller_id is null then raise exception 'unauthenticated'; end if;
  if not private.is_admin(caller_id) then raise exception 'forbidden: admin required'; end if;

  update public.admin_notifications
     set read_at = now()
   where recipient_admin_id = caller_id
     and read_at is null;
  get diagnostics v_changed = row_count;

  return v_changed;
end;
$$;

revoke all on function public.admin_mark_all_notifications_read() from public;
revoke all on function public.admin_mark_all_notifications_read() from anon;
grant execute on function public.admin_mark_all_notifications_read() to authenticated;

comment on function public.admin_mark_all_notifications_read() is
  '본인의 미읽음 알림 전체를 읽음 처리하고 변경 건수를 돌려준다. 2026-08-05.';

-- ---------------------------------------------------------------- 만료 임박 적재
-- 버킷 판정으로 두 가지를 동시에 해결한다:
--   ① **놓친 날 복구** — `days_left = 30` 처럼 딱 그 날만 보면 cron 이 멈춘 날의 마일스톤이
--      영구히 사라진다. 범위(`<=`)로 보면 다음 tick 이 잡는다.
--   ② **잘못된 마일스톤 방지** — 단순히 `days_left <= 30` 이면 5일 남은 계약에도 `D-30`
--      알림이 나가 문구가 사실과 달라진다. 버킷을 겹치지 않게 자르면(7<d<=30 / 0<d<=7 / d<=0)
--      계약 하나가 각 구간을 지날 때 한 번씩만, 그 구간에 맞는 문구로 나간다.
-- dedup 은 (recipient, event_key) unique 가 담당하므로 tick 이 몇 번 돌아도 안전하다.
create or replace function private.enqueue_contract_expiry_notifications()
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, private
as $$
declare
  v_today    date;
  v_inserted integer := 0;
begin
  -- 계약 원장은 topik_writing 폴더 소유라 적용 순서가 보장되지 않는다 → fail-open.
  if to_regclass('public.topik_writing_institution_contracts') is null then
    return jsonb_build_object('skipped', 'contract_ledger_absent');
  end if;

  v_today := (now() at time zone 'Asia/Seoul')::date;

  with milestone as (
    select c.institution_code,
           c.contract_id,
           c.ends_on,
           (c.ends_on - v_today) as days_left,
           case
             when (c.ends_on - v_today) <= 0 then 'expired'
             when (c.ends_on - v_today) <= 7 then 'd7'
             else 'd30'
           end as bucket
      from public.topik_writing_institution_contracts c
     where c.ends_on is not null
       -- 무기한 계약은 만료가 없고, 시작 전 계약은 아직 알릴 것이 없다.
       and c.starts_on <= v_today
       and (c.ends_on - v_today) <= 30
  ),
  recipient as (
    -- RBAC SoT 는 profiles.app_role 이다(admin_accounts.role 이 아니다).
    -- 정지·초대 대기 계정에는 보내지 않는다.
    select aa.id as admin_id
      from public.admin_accounts aa
      join public.profiles p on p.id = aa.id
     where p.app_role = 'platform_admin'
       and coalesce(aa.status, '') not in ('suspended', 'revoked')
  ),
  labelled as (
    select m.*,
           case m.bucket
             when 'expired' then '기관 계약이 만료되었습니다'
             when 'd7' then '기관 계약 만료가 7일 이내입니다'
             else '기관 계약 만료가 30일 이내입니다'
           end as title
      from milestone m
  )
  insert into public.admin_notifications (
    recipient_admin_id, category, event_key, title, body, link_url, payload
  )
  select r.admin_id,
         'institution_contract',
         'contract_expiry:' || l.institution_code || ':' || l.contract_id::text || ':' || l.bucket,
         l.title,
         l.institution_code || ' 계약 종료일 ' || to_char(l.ends_on, 'YYYY-MM-DD')
           || case
                when l.days_left < 0 then ' (' || abs(l.days_left) || '일 경과)'
                when l.days_left = 0 then ' (오늘)'
                else ' (' || l.days_left || '일 남음)'
              end,
         '/users/institution-codes/' || l.institution_code || '?tab=contract',
         jsonb_build_object(
           'kind', 'institution_contract_expiry',
           'code', l.institution_code,
           'contract_id', l.contract_id,
           'ends_on', l.ends_on,
           'days_left', l.days_left,
           'bucket', l.bucket
         )
    from labelled l
    cross join recipient r
  on conflict (recipient_admin_id, event_key) do nothing;

  get diagnostics v_inserted = row_count;

  return jsonb_build_object('inserted', v_inserted, 'today', v_today);
end;
$$;

revoke all on function private.enqueue_contract_expiry_notifications() from public;
revoke all on function private.enqueue_contract_expiry_notifications() from anon;
revoke all on function private.enqueue_contract_expiry_notifications() from authenticated;
revoke all on function private.enqueue_contract_expiry_notifications() from service_role;

comment on function private.enqueue_contract_expiry_notifications() is
  '기관 계약 만료 임박 알림을 관리자 알림함에 적재한다(10분 tick 에서 호출). 버킷은 겹치지 않게 자른다: 7<남은일수<=30 → d30, 0<남은일수<=7 → d7, 남은일수<=0 → expired. 범위 판정이라 cron 이 멈춘 날의 마일스톤도 다음 tick 이 잡고(놓친 날 복구), 버킷이 겹치지 않아 5일 남은 계약에 D-30 문구가 나가지 않는다. (recipient, event_key) unique 가 영구 dedup 이므로 tick 이 반복돼도 중복 적재되지 않는다. 수신자는 profiles.app_role=platform_admin(RBAC SoT) 인 활성 관리자다. 계약 원장이 없으면 fail-open. 2026-08-05.';

-- ---------------------------------------------------------------- cron tick 배선
-- 20260723011242 본문에 키 하나를 더한다. 신규 cron 을 만들지 않는다.
create or replace function private.dispatch_notifications()
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, private
as $$
begin
  return jsonb_build_object(
    'at', now(),
    'study_reminder',       private.dispatch_scheduled_notifications('study_reminder', 'in_app'),
    'weekly_summary',       private.dispatch_scheduled_notifications('weekly_summary', 'in_app'),
    'study_reminder_email', private.dispatch_scheduled_notifications('study_reminder', 'email'),
    'weekly_summary_email', private.dispatch_scheduled_notifications('weekly_summary', 'email'),
    'admin',                private.dispatch_admin_notifications(),
    'contract_expiry',      private.enqueue_contract_expiry_notifications(),
    'email_retry',          private.retry_failed_email_attempts()
  );
end;
$$;

revoke all on function private.dispatch_notifications() from public;
revoke all on function private.dispatch_notifications() from anon;
revoke all on function private.dispatch_notifications() from authenticated;

comment on function private.dispatch_notifications() is
  '알림 파이프라인 10분 tick(cron job dispatch_notifications). 예약 알림 4종 + 관리자 발송 디스패처 + 기관 계약 만료 임박 적재 + 이메일 재시도를 한 번에 돌리고 각 결과를 jsonb 로 모은다. 신규 스케줄을 만들지 않고 이 함수에 키를 더하는 것이 규약이다 — cron 이 늘어나면 스케줄 소유·실패 관측 지점이 갈라진다. 2026-08-05 contract_expiry 추가.';

-- ---------------------------------------------------------------- 사후 단정
do $verify$
declare
  v_def   text;
  v_count integer;
begin
  if to_regclass('public.admin_notifications') is null then
    raise exception 'admin_notifications_table_missing';
  end if;

  -- 영구 dedup 이 제약으로 강제되는지. 이것이 없으면 10분마다 같은 알림이 쌓인다.
  select count(*)
    into v_count
    from pg_constraint c
   where c.conrelid = 'public.admin_notifications'::regclass
     and c.contype = 'u'
     and c.conname = 'admin_notifications_event_unique';
  if v_count <> 1 then
    raise exception 'admin_notifications_dedup_constraint_missing: %', v_count;
  end if;

  -- 수신자가 학습자 알림함이 아니어야 한다(v13 공유 객체 오염 방지).
  v_def := pg_get_functiondef(to_regprocedure('private.enqueue_contract_expiry_notifications()'));
  if position('user_notifications' in v_def) > 0 then
    raise exception 'contract_expiry_must_not_write_learner_notifications';
  end if;
  if position('admin_notifications' in v_def) = 0 then
    raise exception 'contract_expiry_not_wired_to_admin_notifications';
  end if;

  -- 버킷이 겹치지 않게 잘렸는지(범위 판정 + 세 버킷).
  if position('''expired''' in v_def) = 0
     or position('''d7''' in v_def) = 0
     or position('''d30''' in v_def) = 0 then
    raise exception 'contract_expiry_bucket_labels_missing';
  end if;

  -- tick 이 실제로 호출하는지. 여기가 빠지면 적재가 영구히 일어나지 않는다.
  if position(
    'enqueue_contract_expiry_notifications' in
    pg_get_functiondef(to_regprocedure('private.dispatch_notifications()'))
  ) = 0 then
    raise exception 'contract_expiry_not_wired_into_tick';
  end if;

  -- 기존 tick 항목이 하나도 사라지지 않았는지(되덮기 사고 방지).
  v_def := pg_get_functiondef(to_regprocedure('private.dispatch_notifications()'));
  if position('dispatch_scheduled_notifications' in v_def) = 0
     or position('dispatch_admin_notifications' in v_def) = 0
     or position('retry_failed_email_attempts' in v_def) = 0 then
    raise exception 'dispatch_notifications_lost_existing_keys';
  end if;

  -- 신규 RPC 가 anon 에 열려 있지 않은지.
  select count(*)
    into v_count
    from (
      select unnest(array[
        'public.admin_list_my_notifications(integer,boolean)',
        'public.admin_count_my_unread_notifications()',
        'public.admin_mark_notification_read(uuid)',
        'public.admin_mark_all_notifications_read()'
      ]) as sig
    ) s
   where has_function_privilege('anon', s.sig, 'EXECUTE');
  if v_count <> 0 then
    raise exception 'admin_notification_rpc_anon_execute_present: %', v_count;
  end if;
end
$verify$;
