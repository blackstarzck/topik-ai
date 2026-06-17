-- =====================================================================
-- topik-ai admin · Operation events · admin-0011
-- admin 운영 이벤트 테이블 + admin RPC 단일 write 경로
--
-- 계약 SoT: docs/specs/admin-data-contract.md
-- 소유권:   docs/architecture/shared-supabase-schema-ownership.md
--           (tracker: admin_schema_migrations — topik_writing와 분리)
-- RLS 모델: 읽기 = admin(private.is_admin), 쓰기 = 정책 없음(RPC 단일 경로).
-- enum: visibility_status/progress_status/indexing_policy는 ASCII 저장,
--       event_type/reward_type/exposure_channels는 한글 코드값(types.ts 기준),
--       UI 라벨 매핑은 supabase-operation-events-service.ts에서 수행.
-- 보상정책/메시지템플릿은 외부 도메인 미구축 → denormalized 문자열(FK 없음).
-- 배너/보상/템플릿 정규화는 후속(page-sync·gap-register 미확정).
-- down: supabase/migrations-admin/down/20260617152000_operation_events.sql
-- =====================================================================

create table if not exists public.operation_events (
  id                        text primary key,
  title                     text not null,
  summary                   text not null default '',
  body_html                 text not null default '',
  slug                      text,
  event_type                text not null,
  visibility_status         text not null default 'hidden',
  progress_status           text not null default 'upcoming',
  start_at                  date,
  end_at                    date,
  exposure_channels         jsonb not null default '[]'::jsonb,
  target_group_id           text,
  target_group_name         text,
  participant_count         integer not null default 0,
  participant_limit         integer,
  reward_type               text,
  reward_policy_id          text,
  reward_policy_name        text,
  message_template_id       text,
  message_template_name     text,
  banner_image_url          text,
  banner_image_source_type  text,
  banner_image_file_name    text,
  banner_images             jsonb not null default '[]'::jsonb,
  landing_url               text,
  meta_title                text,
  meta_description          text,
  og_image_url              text,
  canonical_url             text,
  indexing_policy           text,
  admin_memo                text,
  created_at                timestamptz not null default now(),
  updated_at                timestamptz not null default now(),
  updated_by                text
);

alter table public.operation_events
  drop constraint if exists operation_events_event_type_check;
alter table public.operation_events
  add constraint operation_events_event_type_check
  check (event_type in ('프로모션','출석','챌린지','리워드'));

alter table public.operation_events
  drop constraint if exists operation_events_visibility_status_check;
alter table public.operation_events
  add constraint operation_events_visibility_status_check
  check (visibility_status in ('exposed','hidden','scheduled'));

alter table public.operation_events
  drop constraint if exists operation_events_progress_status_check;
alter table public.operation_events
  add constraint operation_events_progress_status_check
  check (progress_status in ('ongoing','upcoming','ended'));

alter table public.operation_events
  drop constraint if exists operation_events_reward_type_check;
alter table public.operation_events
  add constraint operation_events_reward_type_check
  check (reward_type is null or reward_type in ('없음','쿠폰','포인트','배지'));

alter table public.operation_events
  drop constraint if exists operation_events_banner_source_check;
alter table public.operation_events
  add constraint operation_events_banner_source_check
  check (banner_image_source_type is null or banner_image_source_type in ('file','url'));

alter table public.operation_events
  drop constraint if exists operation_events_indexing_policy_check;
alter table public.operation_events
  add constraint operation_events_indexing_policy_check
  check (indexing_policy is null or indexing_policy in ('index','noindex'));

alter table public.operation_events
  drop constraint if exists operation_events_exposure_channels_array_check;
alter table public.operation_events
  add constraint operation_events_exposure_channels_array_check
  check (jsonb_typeof(exposure_channels) = 'array');

alter table public.operation_events
  drop constraint if exists operation_events_banner_images_array_check;
alter table public.operation_events
  add constraint operation_events_banner_images_array_check
  check (jsonb_typeof(banner_images) = 'array');

alter table public.operation_events
  drop constraint if exists operation_events_participant_count_check;
alter table public.operation_events
  add constraint operation_events_participant_count_check
  check (participant_count >= 0);

alter table public.operation_events
  drop constraint if exists operation_events_participant_limit_check;
alter table public.operation_events
  add constraint operation_events_participant_limit_check
  check (participant_limit is null or participant_limit >= 0);

alter table public.operation_events
  drop constraint if exists operation_events_date_order_check;
alter table public.operation_events
  add constraint operation_events_date_order_check
  check (start_at is null or end_at is null or start_at <= end_at);

create index if not exists operation_events_created_desc
  on public.operation_events (created_at desc);

create index if not exists operation_events_exposed_start
  on public.operation_events (start_at)
  where visibility_status = 'exposed';

comment on table public.operation_events is
  'Operation > 이벤트 SoT. visibility/progress/indexing은 ASCII 저장, event_type/reward_type/exposure_channels는 한글 코드값. 쓰기는 admin RPC 단일 경로. 보상/메시지템플릿은 denormalized(FK 없음).';

alter table public.operation_events enable row level security;
alter table public.operation_events force  row level security;
drop policy if exists operation_events_admin_select on public.operation_events;
create policy operation_events_admin_select on public.operation_events
  for select to authenticated using (private.is_admin((select auth.uid())));

insert into public.operation_events (
  id, title, summary, body_html, slug, event_type, visibility_status, progress_status,
  start_at, end_at, exposure_channels, target_group_id, target_group_name,
  participant_count, participant_limit, reward_type, reward_policy_id, reward_policy_name,
  message_template_id, message_template_name, banner_image_url, banner_image_source_type,
  banner_image_file_name, banner_images, landing_url, meta_title, meta_description,
  og_image_url, canonical_url, indexing_policy, admin_memo, created_at, updated_at, updated_by
) values
  (
    'EVT-001', '봄 학습 출석 이벤트',
    '연속 출석 회원에게 포인트를 지급하는 3월 캠페인입니다.',
    '<h2>봄 학습 출석 이벤트</h2><p>3월 한 달 동안 연속 출석을 유지한 회원에게 포인트를 지급합니다.</p><ul><li>7일 연속 출석 시 100P 지급</li><li>14일 연속 출석 시 추가 보너스 지급</li><li>이벤트 탭과 앱 홈 배너에서 상세 조건 확인 가능</li></ul>',
    '봄-학습-출석-이벤트', '출석', 'exposed', 'ongoing',
    '2026-03-20'::date, '2026-03-31'::date,
    jsonb_build_array('앱 홈','이벤트 탭'), 'GRP-001', '활성 학습자',
    1280, 5000, '포인트', 'POINT-100', '출석 7일 누적 100P',
    'PUSH-MAN-001', '점검 공지 푸시', 'https://images.example.com/events/attendance-march.png', 'file',
    'attendance-march.png',
    jsonb_build_array(jsonb_build_object('uid','EVT-001-banner-1','name','attendance-march.png','url','https://images.example.com/events/attendance-march.png')),
    '/events/spring-attendance', '봄 학습 출석 이벤트', '연속 출석 시 포인트를 지급하는 3월 학습 이벤트를 확인하세요.',
    'https://images.example.com/events/attendance-march-og.png', '/events/spring-attendance', 'index',
    '앱 홈 상단 배너와 이벤트 탭 동시 노출',
    '2026-03-15 00:00:00+09'::timestamptz, '2026-03-22 10:40:00+09'::timestamptz, 'admin_park'
  ),
  (
    'EVT-002', '친구 초대 리워드 캠페인',
    '친구 초대 성공 시 쿠폰을 지급하는 시즌 프로모션입니다.',
    '<h2>친구 초대 리워드 캠페인</h2><p>친구가 초대 링크를 통해 가입하고 첫 학습을 완료하면 쿠폰을 지급합니다.</p><ol><li>친구에게 전용 링크를 공유합니다.</li><li>친구가 가입 후 첫 학습을 완료합니다.</li><li>조건 충족 시 15% 할인 쿠폰이 자동 발급됩니다.</li></ol>',
    '친구-초대-리워드-캠페인', '프로모션', 'scheduled', 'upcoming',
    '2026-04-01'::date, '2026-04-20'::date,
    jsonb_build_array('웹 홈','이벤트 탭'), 'GRP-003', 'VIP 고객',
    0, 3000, '쿠폰', 'COUPON-APR-15', '친구 초대 15% 쿠폰',
    'MAIL-MAN-002', 'VIP 행사 초대 메일', 'https://images.example.com/events/referral-april.png', 'file',
    'referral-april.png',
    jsonb_build_array(jsonb_build_object('uid','EVT-002-banner-1','name','referral-april.png','url','https://images.example.com/events/referral-april.png')),
    '/events/referral-april', '친구 초대 리워드 캠페인', '친구 초대 성공 시 사용할 수 있는 할인 쿠폰 이벤트입니다.',
    'https://images.example.com/events/referral-april-og.png', '/events/referral-april', 'index',
    '4월 1일 09:00 자동 노출 예정',
    '2026-03-18 00:00:00+09'::timestamptz, '2026-03-22 17:10:00+09'::timestamptz, 'admin_kim'
  ),
  (
    'EVT-003', 'TOPIK 응시 챌린지',
    '응시 완료 회원에게 배지를 지급한 시즌 챌린지입니다.',
    '<h2>TOPIK 응시 챌린지</h2><p>TOPIK 응시를 완료한 회원에게 완주 배지를 지급했던 시즌 챌린지입니다.</p><p>현재는 종료되어 신규 참여는 불가하며, 기존 참여 이력과 보상 내역만 보관합니다.</p>',
    'topik-응시-챌린지', '챌린지', 'hidden', 'ended',
    '2026-02-01'::date, '2026-02-28'::date,
    jsonb_build_array('이벤트 탭'), 'GRP-004', '운영 공지 구독자',
    642, null, '배지', 'BADGE-TOPIK-001', 'TOPIK 챌린지 완주 배지',
    'PUSH-MAN-002', '주말 캠페인 안내', 'https://images.example.com/events/topik-challenge.png', 'file',
    'topik-challenge.png',
    jsonb_build_array(jsonb_build_object('uid','EVT-003-banner-1','name','topik-challenge.png','url','https://images.example.com/events/topik-challenge.png')),
    '/events/topik-challenge', 'TOPIK 응시 챌린지', 'TOPIK 응시 회원을 위한 시즌 챌린지와 배지 지급 기록입니다.',
    'https://images.example.com/events/topik-challenge-og.png', '/events/topik-challenge', 'noindex',
    '종료 후 이력 보관용. 노출 재개 계획 없음.',
    '2026-01-25 00:00:00+09'::timestamptz, '2026-03-01 08:30:00+09'::timestamptz, 'admin_lee'
  )
on conflict (id) do nothing;

-- ---------------------------------------------------------------------
-- admin_save_operation_event(p_id, p_event, p_reason) — 생성/수정
-- ---------------------------------------------------------------------
create or replace function public.admin_save_operation_event(
  p_id     text,
  p_event  jsonb,
  p_reason text
)
returns text
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  caller_id  uuid := auth.uid();
  v_id       text;
  v_title    text;
  v_event_type text;
  v_visibility text;
  v_reward_type text;
  v_indexing text;
  v_banner_src text;
  v_old      public.operation_events%rowtype;
  v_diff     jsonb := '{}'::jsonb;
begin
  if caller_id is null then raise exception 'unauthenticated'; end if;
  if not private.is_admin(caller_id) then raise exception 'forbidden: admin required'; end if;
  if nullif(btrim(coalesce(p_reason, '')), '') is null then
    raise exception 'reason required (operational reason)';
  end if;

  v_title := nullif(btrim(coalesce(p_event->>'title', '')), '');
  if v_title is null then raise exception 'title required'; end if;

  v_event_type := coalesce(nullif(btrim(coalesce(p_event->>'event_type','')),''), '프로모션');
  if v_event_type not in ('프로모션','출석','챌린지','리워드') then
    raise exception 'invalid event_type: %', v_event_type;
  end if;

  v_visibility := coalesce(nullif(btrim(coalesce(p_event->>'visibility_status','')),''), 'hidden');
  if v_visibility not in ('exposed','hidden','scheduled') then
    raise exception 'invalid visibility_status: %', v_visibility;
  end if;

  v_reward_type := nullif(btrim(coalesce(p_event->>'reward_type','')),'');
  if v_reward_type is not null and v_reward_type not in ('없음','쿠폰','포인트','배지') then
    raise exception 'invalid reward_type: %', v_reward_type;
  end if;

  v_indexing := nullif(btrim(coalesce(p_event->>'indexing_policy','')),'');
  if v_indexing is not null and v_indexing not in ('index','noindex') then
    raise exception 'invalid indexing_policy: %', v_indexing;
  end if;

  v_banner_src := nullif(btrim(coalesce(p_event->>'banner_image_source_type','')),'');
  if v_banner_src is not null and v_banner_src not in ('file','url') then
    raise exception 'invalid banner_image_source_type: %', v_banner_src;
  end if;

  if nullif(btrim(coalesce(p_id, '')), '') is null then
    select 'EVT-' || lpad((coalesce(max(substring(id from '^EVT-([0-9]+)$')::integer), 0) + 1)::text, 3, '0')
      into v_id
      from public.operation_events
     where id ~ '^EVT-[0-9]+$';

    insert into public.operation_events (
      id, title, summary, body_html, slug, event_type, visibility_status, progress_status,
      start_at, end_at, exposure_channels, target_group_id, target_group_name,
      participant_count, participant_limit, reward_type, reward_policy_id, reward_policy_name,
      message_template_id, message_template_name, banner_image_url, banner_image_source_type,
      banner_image_file_name, banner_images, landing_url, meta_title, meta_description,
      og_image_url, canonical_url, indexing_policy, admin_memo, updated_by
    ) values (
      v_id, v_title,
      coalesce(p_event->>'summary',''), coalesce(p_event->>'body_html',''),
      nullif(btrim(coalesce(p_event->>'slug','')),''), v_event_type, v_visibility, 'upcoming',
      nullif(btrim(coalesce(p_event->>'start_at','')),'')::date,
      nullif(btrim(coalesce(p_event->>'end_at','')),'')::date,
      coalesce(p_event->'exposure_channels','[]'::jsonb),
      nullif(btrim(coalesce(p_event->>'target_group_id','')),''),
      nullif(btrim(coalesce(p_event->>'target_group_name','')),''),
      0,
      nullif(btrim(coalesce(p_event->>'participant_limit','')),'')::integer,
      v_reward_type,
      nullif(btrim(coalesce(p_event->>'reward_policy_id','')),''),
      nullif(btrim(coalesce(p_event->>'reward_policy_name','')),''),
      nullif(btrim(coalesce(p_event->>'message_template_id','')),''),
      nullif(btrim(coalesce(p_event->>'message_template_name','')),''),
      nullif(btrim(coalesce(p_event->>'banner_image_url','')),''),
      v_banner_src,
      nullif(btrim(coalesce(p_event->>'banner_image_file_name','')),''),
      coalesce(p_event->'banner_images','[]'::jsonb),
      nullif(btrim(coalesce(p_event->>'landing_url','')),''),
      nullif(btrim(coalesce(p_event->>'meta_title','')),''),
      nullif(btrim(coalesce(p_event->>'meta_description','')),''),
      nullif(btrim(coalesce(p_event->>'og_image_url','')),''),
      nullif(btrim(coalesce(p_event->>'canonical_url','')),''),
      v_indexing,
      nullif(btrim(coalesce(p_event->>'admin_memo','')),''),
      caller_id::text
    );

    v_diff := jsonb_build_object(
      'title', jsonb_build_object('from', null, 'to', v_title),
      'event_type', jsonb_build_object('from', null, 'to', v_event_type),
      'visibility_status', jsonb_build_object('from', null, 'to', v_visibility)
    );
  else
    v_id := btrim(p_id);
    select * into v_old from public.operation_events where id = v_id for update;
    if not found then raise exception 'unknown event id: %', v_id; end if;

    if v_old.title is distinct from v_title then
      v_diff := v_diff || jsonb_build_object('title', jsonb_build_object('from', v_old.title, 'to', v_title));
    end if;
    if v_old.event_type is distinct from v_event_type then
      v_diff := v_diff || jsonb_build_object('event_type', jsonb_build_object('from', v_old.event_type, 'to', v_event_type));
    end if;
    if v_old.visibility_status is distinct from v_visibility then
      v_diff := v_diff || jsonb_build_object('visibility_status', jsonb_build_object('from', v_old.visibility_status, 'to', v_visibility));
    end if;

    update public.operation_events
       set title = v_title,
           summary = coalesce(p_event->>'summary',''),
           body_html = coalesce(p_event->>'body_html',''),
           slug = nullif(btrim(coalesce(p_event->>'slug','')),''),
           event_type = v_event_type,
           visibility_status = v_visibility,
           start_at = nullif(btrim(coalesce(p_event->>'start_at','')),'')::date,
           end_at = nullif(btrim(coalesce(p_event->>'end_at','')),'')::date,
           exposure_channels = coalesce(p_event->'exposure_channels','[]'::jsonb),
           target_group_id = nullif(btrim(coalesce(p_event->>'target_group_id','')),''),
           target_group_name = nullif(btrim(coalesce(p_event->>'target_group_name','')),''),
           participant_limit = nullif(btrim(coalesce(p_event->>'participant_limit','')),'')::integer,
           reward_type = v_reward_type,
           reward_policy_id = nullif(btrim(coalesce(p_event->>'reward_policy_id','')),''),
           reward_policy_name = nullif(btrim(coalesce(p_event->>'reward_policy_name','')),''),
           message_template_id = nullif(btrim(coalesce(p_event->>'message_template_id','')),''),
           message_template_name = nullif(btrim(coalesce(p_event->>'message_template_name','')),''),
           banner_image_url = nullif(btrim(coalesce(p_event->>'banner_image_url','')),''),
           banner_image_source_type = v_banner_src,
           banner_image_file_name = nullif(btrim(coalesce(p_event->>'banner_image_file_name','')),''),
           banner_images = coalesce(p_event->'banner_images','[]'::jsonb),
           landing_url = nullif(btrim(coalesce(p_event->>'landing_url','')),''),
           meta_title = nullif(btrim(coalesce(p_event->>'meta_title','')),''),
           meta_description = nullif(btrim(coalesce(p_event->>'meta_description','')),''),
           og_image_url = nullif(btrim(coalesce(p_event->>'og_image_url','')),''),
           canonical_url = nullif(btrim(coalesce(p_event->>'canonical_url','')),''),
           indexing_policy = v_indexing,
           admin_memo = nullif(btrim(coalesce(p_event->>'admin_memo','')),''),
           updated_by = caller_id::text,
           updated_at = now()
     where id = v_id;
  end if;

  insert into public.admin_audit_logs (admin_user_id, action, target_table, target_id, diff, payload)
  values (
    caller_id, 'event_saved', 'OperationEvent', v_id, v_diff,
    jsonb_build_object(
      'reason', p_reason,
      'mode', case when nullif(btrim(coalesce(p_id, '')), '') is null then 'create' else 'update' end,
      'title', v_title
    )
  );

  return v_id;
end;
$$;
revoke all on function public.admin_save_operation_event(text, jsonb, text) from public;
grant execute on function public.admin_save_operation_event(text, jsonb, text) to authenticated;

-- ---------------------------------------------------------------------
-- 상태 전이 RPC: schedule(예약)/publish(노출)/end(종료+숨김)
-- ---------------------------------------------------------------------
create or replace function public.admin_schedule_operation_event(
  p_event_id text,
  p_reason   text
)
returns text
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  caller_id uuid := auth.uid();
  v_old     public.operation_events%rowtype;
begin
  if caller_id is null then raise exception 'unauthenticated'; end if;
  if not private.is_admin(caller_id) then raise exception 'forbidden: admin required'; end if;
  if nullif(btrim(coalesce(p_reason, '')), '') is null then raise exception 'reason required (operational reason)'; end if;

  select * into v_old from public.operation_events where id = p_event_id for update;
  if not found then raise exception 'unknown event id: %', p_event_id; end if;

  update public.operation_events
     set visibility_status = 'scheduled', updated_by = caller_id::text, updated_at = now()
   where id = p_event_id;

  insert into public.admin_audit_logs (admin_user_id, action, target_table, target_id, diff, payload)
  values (caller_id, 'event_scheduled', 'OperationEvent', p_event_id,
          jsonb_build_object('visibility_status', jsonb_build_object('from', v_old.visibility_status, 'to', 'scheduled')),
          jsonb_build_object('reason', p_reason, 'title', v_old.title));
  return p_event_id;
end;
$$;
revoke all on function public.admin_schedule_operation_event(text, text) from public;
grant execute on function public.admin_schedule_operation_event(text, text) to authenticated;

create or replace function public.admin_publish_operation_event(
  p_event_id text,
  p_reason   text
)
returns text
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  caller_id uuid := auth.uid();
  v_old     public.operation_events%rowtype;
begin
  if caller_id is null then raise exception 'unauthenticated'; end if;
  if not private.is_admin(caller_id) then raise exception 'forbidden: admin required'; end if;
  if nullif(btrim(coalesce(p_reason, '')), '') is null then raise exception 'reason required (operational reason)'; end if;

  select * into v_old from public.operation_events where id = p_event_id for update;
  if not found then raise exception 'unknown event id: %', p_event_id; end if;

  update public.operation_events
     set visibility_status = 'exposed', updated_by = caller_id::text, updated_at = now()
   where id = p_event_id;

  insert into public.admin_audit_logs (admin_user_id, action, target_table, target_id, diff, payload)
  values (caller_id, 'event_published', 'OperationEvent', p_event_id,
          jsonb_build_object('visibility_status', jsonb_build_object('from', v_old.visibility_status, 'to', 'exposed')),
          jsonb_build_object('reason', p_reason, 'title', v_old.title));
  return p_event_id;
end;
$$;
revoke all on function public.admin_publish_operation_event(text, text) from public;
grant execute on function public.admin_publish_operation_event(text, text) to authenticated;

create or replace function public.admin_end_operation_event(
  p_event_id text,
  p_reason   text
)
returns text
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  caller_id uuid := auth.uid();
  v_old     public.operation_events%rowtype;
begin
  if caller_id is null then raise exception 'unauthenticated'; end if;
  if not private.is_admin(caller_id) then raise exception 'forbidden: admin required'; end if;
  if nullif(btrim(coalesce(p_reason, '')), '') is null then raise exception 'reason required (operational reason)'; end if;

  select * into v_old from public.operation_events where id = p_event_id for update;
  if not found then raise exception 'unknown event id: %', p_event_id; end if;

  update public.operation_events
     set progress_status = 'ended', visibility_status = 'hidden',
         updated_by = caller_id::text, updated_at = now()
   where id = p_event_id;

  insert into public.admin_audit_logs (admin_user_id, action, target_table, target_id, diff, payload)
  values (caller_id, 'event_ended', 'OperationEvent', p_event_id,
          jsonb_build_object(
            'progress_status', jsonb_build_object('from', v_old.progress_status, 'to', 'ended'),
            'visibility_status', jsonb_build_object('from', v_old.visibility_status, 'to', 'hidden')),
          jsonb_build_object('reason', p_reason, 'title', v_old.title));
  return p_event_id;
end;
$$;
revoke all on function public.admin_end_operation_event(text, text) from public;
grant execute on function public.admin_end_operation_event(text, text) to authenticated;
