-- =====================================================================
-- TOPIK AI Admin · notification pipeline ownership transfer · 2026-07-23
--
-- Canonical owner / migration home:
--   topik-ai / supabase/migrations-admin / admin_schema_migrations
--
-- Replay contract:
--   1. Replay all v13 user-facing migrations. Retired v13 pipeline files are no-ops.
--   2. Apply topik-ai admin migrations. The four admin tables must already exist.
--   3. This migration re-declares the final dispatcher, email pipeline, privileges,
--      and pg_cron job without deleting or reseeding existing operational data.
--   4. Every dispatch declaration uses the final live overload set — one
--      dispatch_notification_event(text,uuid,text,jsonb,text) with p_payload and
--      p_channel defaults, one dispatch_scheduled_notifications(text,text) with the
--      p_channel default — so replaying over the live databases never removes
--      parameter defaults (42P13) and 1/3/4/5-arg call forms stay unambiguous (42725).
--
-- Recovery contract: roll forward with a corrective admin migration. The paired
-- down file intentionally preserves these shared runtime objects and all data.
-- =====================================================================

-- Fail closed when the cross-repository replay order is incomplete.
do $notification_pipeline_prerequisites$
declare
  v_relation text;
begin
  if to_regnamespace('private') is null then
    raise exception 'notification pipeline prerequisite missing: private schema';
  end if;

  foreach v_relation in array array[
    'public.profiles',
    'public.notification_settings',
    'public.user_notifications',
    'public.user_marketing_consent',
    'public.notification_templates',
    'public.notification_groups',
    'public.notification_dispatches',
    'public.notification_delivery_attempts'
  ]
  loop
    if to_regclass(v_relation) is null then
      raise exception 'notification pipeline prerequisite missing: %', v_relation;
    end if;
  end loop;
end
$notification_pipeline_prerequisites$;

-- ---------------------------------------------------------------------
-- Transferred final-state source: supabase/migrations/20260612180000_notification_dispatcher.sql
-- ---------------------------------------------------------------------
-- =====================================================================
-- TALKPIK AI · Notification feature WP1-1 · 2026-06-12
-- 발송 파이프라인 (in_app 채널) — SQL dispatcher
--
-- 계약 SoT: topik-ai docs/specs/notification-contract.md
--   - 시각 출처: DB now() 단일 기준 (계약 §7 — 이중 시각 출처 금지)
--   - idempotency 2단: dispatch.dedupe_key(슬롯/이벤트) + attempt.dedupe_key(사용자×회차)
--   - class 정책 §2: marketing=동의 필수(저장소 미구현 — 전원 opted_out),
--     mandatory=in_app 강제, learning/transactional=pref 존중, 채널 off=skipped
-- 구현 결정: Edge Function 대신 DB 함수 + pg_cron (환경에 함수 배포 인프라 없음,
--   시각 출처 단일화에 정합 — 증적 로그 WP0-5 절). 시맨틱스는 실행계획안 §5.3 동일.
-- 함수는 private 스키마(PostgREST 미노출), SECURITY DEFINER(owner postgres —
--   bypassrls 실측 확인)로 admin 소유 dispatch/attempt 테이블에 기록한다.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 렌더링 헬퍼: html → plain text + {{display_name}} 치환 (결측 fallback '학습자')
-- ---------------------------------------------------------------------
create or replace function private.render_notification_text(p_source text, p_display_name text)
returns text
language sql
immutable
as $$
  select replace(
           regexp_replace(coalesce(p_source, ''), '<[^>]+>', '', 'g'),
           '{{display_name}}',
           coalesce(nullif(btrim(coalesce(p_display_name, '')), ''), '학습자'));
$$;

-- ---------------------------------------------------------------------
-- 스케줄형 (study_reminder / weekly_summary)
--   - 후보: 사용자 timezone 기준 오늘 슬롯 도달(같은 현지 날짜 내 catch-up 허용,
--     attempt 일일 dedupe로 1회 상한 — 다운타임 소급 스톰 방지 N-SCH-11)
--   - 동시 실행: tick 단위 dispatch dedupe(N-SCH-03) + attempt dedupe 이중
-- ---------------------------------------------------------------------
create or replace function private.dispatch_scheduled_notifications(
  p_template_key text,
  p_channel      text default 'in_app'
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, private
as $$
declare
  v_tpl         public.notification_templates%rowtype;
  v_tick        text;
  v_dispatch_id uuid;
  v_sent int; v_skipped int; v_opted int;
begin
  select * into v_tpl
    from public.notification_templates
   where template_key = p_template_key and channel = 'in_app' and status = 'active'
   limit 1;
  if not found then
    return jsonb_build_object('template', p_template_key, 'result', 'no_active_template');
  end if;

  drop table if exists _ntf_candidates;
  create temp table _ntf_candidates on commit drop as
  select ns.user_id,
         p.display_name,
         ((now() at time zone ns.timezone)::date)::text as local_date,
         coalesce((ns.channels->>'in_app')::boolean, true) as in_app_on,
         coalesce((p.notification_prefs->>p_template_key)::boolean, false) as pref_on
    from public.notification_settings ns
    join public.profiles p on p.id = ns.user_id
   where case
           when p_template_key = 'study_reminder' then
             ns.reminder_time is not null
             and ns.reminder_days @> to_jsonb(extract(dow from (now() at time zone ns.timezone))::int)
             and (now() at time zone ns.timezone)::time >= ns.reminder_time
           when p_template_key = 'weekly_summary' then
             -- O-5: 일요일 20:00 (사용자 timezone) 고정 슬롯
             extract(dow from (now() at time zone ns.timezone))::int = 0
             and (now() at time zone ns.timezone)::time >= time '20:00'
           else false
         end
     and not exists (
           select 1 from public.notification_delivery_attempts a
            where a.dedupe_key = ns.user_id::text || ':' || p_template_key || ':'
                                 || ((now() at time zone ns.timezone)::date)::text
         );

  if (select count(*) from _ntf_candidates) = 0 then
    return jsonb_build_object('template', p_template_key, 'result', 'no_candidates');
  end if;

  -- tick 클레임: 10분 윈도우. 같은 tick의 동시/재실행은 한쪽만 집행한다.
  v_tick := to_char(
    date_trunc('hour', now()) + (floor(extract(minute from now())::numeric / 10) * interval '10 minutes'),
    'YYYY-MM-DD"T"HH24:MI"Z"');
  insert into public.notification_dispatches
    (template_id, template_key, channels, target_type, status, dedupe_key, started_at)
  values
    (v_tpl.id, p_template_key, jsonb_build_array('in_app'), 'schedule', 'running',
     'sched:' || p_template_key || ':' || v_tick, now())
  on conflict (dedupe_key) do nothing
  returning id into v_dispatch_id;
  if v_dispatch_id is null then
    return jsonb_build_object('template', p_template_key, 'result', 'tick_already_claimed', 'tick', v_tick);
  end if;

  -- 정책 평가 결과를 attempt로 기록 (opt-out 제외자도 opted_out/skipped 집계 — 계약 §2)
  with ins as (
    insert into public.notification_delivery_attempts
      (dispatch_id, user_id, channel, template_key, status, dedupe_key, sent_at)
    select v_dispatch_id, c.user_id, 'in_app', p_template_key,
           case when not c.pref_on then 'opted_out'
                when not c.in_app_on then 'skipped'
                else 'sent' end,
           c.user_id::text || ':' || p_template_key || ':' || c.local_date,
           case when c.pref_on and c.in_app_on then now() else null end
      from _ntf_candidates c
    on conflict (dedupe_key) where dedupe_key is not null do nothing
    returning id, user_id, status
  )
  insert into public.user_notifications
    (user_id, template_key, category, title, body, link_url, delivery_attempt_id)
  select i.user_id, p_template_key, v_tpl.category,
         private.render_notification_text(v_tpl.subject, c.display_name),
         private.render_notification_text(v_tpl.body_html, c.display_name),
         v_tpl.link_url, i.id
    from ins i
    join _ntf_candidates c on c.user_id = i.user_id
   where i.status = 'sent';

  select count(*) filter (where status = 'sent'),
         count(*) filter (where status = 'skipped'),
         count(*) filter (where status = 'opted_out')
    into v_sent, v_skipped, v_opted
    from public.notification_delivery_attempts
   where dispatch_id = v_dispatch_id;

  update public.notification_dispatches
     set status = 'completed',
         recipient_count = coalesce(v_sent,0) + coalesce(v_skipped,0) + coalesce(v_opted,0),
         completed_at = now()
   where id = v_dispatch_id;

  return jsonb_build_object('template', p_template_key, 'dispatch_id', v_dispatch_id,
                            'sent', v_sent, 'skipped', v_skipped, 'opted_out', v_opted);
end;
$$;

-- ---------------------------------------------------------------------
-- 관리자 발송 집행 (즉시 running / 예약 도래 scheduled)
--   - 대상: test=actor 본인(선호 우회 — 본인 확인용), group=정적 명단
--     (조건 기반 그룹 해석은 P2 — 미해석 그룹은 target_snapshot에 기록)
-- ---------------------------------------------------------------------
create or replace function private.dispatch_admin_notifications()
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, private
as $$
declare
  d        record;
  v_tpl    public.notification_templates%rowtype;
  v_sent int; v_skipped int; v_opted int;
  v_results jsonb := '[]'::jsonb;
begin
  for d in
    select * from public.notification_dispatches
     where (status = 'running' and target_type in ('group','test'))
        or (status = 'scheduled' and scheduled_at <= now())
     order by created_at
       for update skip locked
  loop
    if d.status = 'scheduled' then
      update public.notification_dispatches
         set status = 'running', started_at = now()
       where id = d.id;
    end if;

    select * into v_tpl from public.notification_templates where id = d.template_id;
    if v_tpl.id is null then
      update public.notification_dispatches set status = 'failed', completed_at = now() where id = d.id;
      v_results := v_results || jsonb_build_object('dispatch', d.id, 'result', 'template_missing');
      continue;
    end if;

    drop table if exists _ntf_audience;
    create temp table _ntf_audience on commit drop as
    select u.user_id,
           p.display_name,
           coalesce((ns.channels->>'in_app')::boolean, true) as in_app_on,
           coalesce((p.notification_prefs->>v_tpl.template_key)::boolean, false) as pref_on
      from (
        select d.actor_id as user_id
         where d.target_type = 'test' and d.actor_id is not null
        union
        select (jsonb_array_elements_text(g.static_member_ids))::uuid
          from public.notification_groups g
         where d.target_type = 'group'
           and exists (select 1 from jsonb_array_elements_text(d.target_group_ids) t(gid)
                        where t.gid = g.id::text)
      ) u
      join public.profiles p on p.id = u.user_id
      left join public.notification_settings ns on ns.user_id = u.user_id;

    with ins as (
      insert into public.notification_delivery_attempts
        (dispatch_id, user_id, channel, template_key, status, sent_at)
      select d.id, a.user_id, 'in_app', v_tpl.template_key,
             case
               when d.target_type = 'test' then 'sent'                         -- 나에게 보내기: 본인 확인용
               when v_tpl.class = 'marketing' then 'opted_out'                 -- 동의 저장소 미구현(H-2) — 전원 제외
               when v_tpl.mandatory then 'sent'                                -- mandatory: in_app 강제 (bypass)
               when v_tpl.class in ('learning','transactional') and not a.pref_on then 'opted_out'
               when not a.in_app_on then 'skipped'
               else 'sent' end,
             now()
        from _ntf_audience a
      on conflict (dispatch_id, user_id, channel) do nothing
      returning id, user_id, status
    )
    insert into public.user_notifications
      (user_id, template_key, category, title, body, link_url, delivery_attempt_id)
    select i.user_id, v_tpl.template_key, v_tpl.category,
           private.render_notification_text(v_tpl.subject, a.display_name),
           private.render_notification_text(v_tpl.body_html, a.display_name),
           v_tpl.link_url, i.id
      from ins i
      join _ntf_audience a on a.user_id = i.user_id
     where i.status = 'sent';

    select count(*) filter (where status = 'sent'),
           count(*) filter (where status = 'skipped'),
           count(*) filter (where status = 'opted_out')
      into v_sent, v_skipped, v_opted
      from public.notification_delivery_attempts
     where dispatch_id = d.id;

    update public.notification_dispatches
       set status = 'completed',
           recipient_count = coalesce(v_sent,0) + coalesce(v_skipped,0) + coalesce(v_opted,0),
           completed_at = now()
     where id = d.id;

    v_results := v_results || jsonb_build_object('dispatch', d.id,
                  'sent', v_sent, 'skipped', v_skipped, 'opted_out', v_opted);
  end loop;

  return jsonb_build_object('processed', jsonb_array_length(v_results), 'dispatches', v_results);
end;
$$;

-- ---------------------------------------------------------------------
-- 이벤트형 (feedback_ready 등) — 도메인 이벤트 지점에서 호출
--   p_event_id 기반 dispatch dedupe → 같은 이벤트 재처리 시 중복 0건 (N-TRG-03)
-- ---------------------------------------------------------------------
create or replace function private.dispatch_notification_event(
  p_template_key text,
  p_user_id      uuid,
  p_event_id     text,
  p_payload      jsonb default '{}'::jsonb,
  p_channel      text  default null
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, private
as $$
declare
  v_tpl         public.notification_templates%rowtype;
  v_dispatch_id uuid;
  v_status      text;
  v_attempt_id  uuid;
  v_display     text;
  v_in_app_on   boolean;
  v_pref_on     boolean;
begin
  if p_user_id is null or nullif(btrim(coalesce(p_event_id, '')), '') is null then
    raise exception 'user_id and event_id required';
  end if;

  select * into v_tpl
    from public.notification_templates
   where template_key = p_template_key and channel = 'in_app' and status = 'active'
   limit 1;
  if not found then
    return jsonb_build_object('result', 'no_active_template', 'template', p_template_key);
  end if;

  insert into public.notification_dispatches
    (template_id, template_key, channels, target_type, status, dedupe_key, started_at)
  values
    (v_tpl.id, p_template_key, jsonb_build_array('in_app'), 'event', 'running',
     'event:' || p_template_key || ':' || p_event_id, now())
  on conflict (dedupe_key) do nothing
  returning id into v_dispatch_id;
  if v_dispatch_id is null then
    return jsonb_build_object('result', 'deduped', 'event_id', p_event_id);
  end if;

  select p.display_name,
         coalesce((ns.channels->>'in_app')::boolean, true),
         coalesce((p.notification_prefs->>p_template_key)::boolean, false)
    into v_display, v_in_app_on, v_pref_on
    from public.profiles p
    left join public.notification_settings ns on ns.user_id = p.id
   where p.id = p_user_id;
  if not found then
    update public.notification_dispatches set status = 'failed', completed_at = now() where id = v_dispatch_id;
    return jsonb_build_object('result', 'unknown_user');
  end if;

  v_status := case
    when v_tpl.mandatory then 'sent'
    when v_tpl.class in ('learning','transactional') and not v_pref_on then 'opted_out'
    when not v_in_app_on then 'skipped'
    else 'sent' end;

  insert into public.notification_delivery_attempts
    (dispatch_id, user_id, channel, template_key, status, dedupe_key, sent_at)
  values
    (v_dispatch_id, p_user_id, 'in_app', p_template_key, v_status,
     p_user_id::text || ':' || p_template_key || ':' || p_event_id,
     case when v_status = 'sent' then now() else null end)
  on conflict (dedupe_key) where dedupe_key is not null do nothing
  returning id into v_attempt_id;

  if v_attempt_id is not null and v_status = 'sent' then
    insert into public.user_notifications
      (user_id, template_key, category, title, body, link_url, payload, delivery_attempt_id)
    values
      (p_user_id, p_template_key, v_tpl.category,
       private.render_notification_text(v_tpl.subject, v_display),
       private.render_notification_text(v_tpl.body_html, v_display),
       coalesce(nullif(p_payload->>'link_url', ''), v_tpl.link_url),
       p_payload, v_attempt_id);
  end if;

  update public.notification_dispatches
     set status = 'completed', recipient_count = 1, completed_at = now()
   where id = v_dispatch_id;

  return jsonb_build_object('result', v_status, 'dispatch_id', v_dispatch_id, 'attempt_id', v_attempt_id);
end;
$$;

-- ---------------------------------------------------------------------
-- 메인 tick (pg_cron 등록 대상 — 20260612180100)
-- ---------------------------------------------------------------------
create or replace function private.dispatch_notifications()
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, private
as $$
begin
  return jsonb_build_object(
    'at', now(),
    'study_reminder', private.dispatch_scheduled_notifications('study_reminder'),
    'weekly_summary', private.dispatch_scheduled_notifications('weekly_summary'),
    'admin', private.dispatch_admin_notifications()
  );
end;
$$;

-- private 스키마는 PostgREST 미노출이지만 명시적으로 client 실행 권한 차단
revoke all on function private.render_notification_text(text, text) from public, anon, authenticated;
revoke all on function private.dispatch_scheduled_notifications(text, text) from public, anon, authenticated;
revoke all on function private.dispatch_admin_notifications() from public, anon, authenticated;
revoke all on function private.dispatch_notification_event(text, uuid, text, jsonb, text) from public, anon, authenticated;
revoke all on function private.dispatch_notifications() from public, anon, authenticated;

comment on function private.dispatch_notifications() is
  '알림 발송 메인 tick (pg_cron 10분 주기). 스케줄형 2종 + 관리자 발송 집행. 시각 출처 = DB now() 단일 기준.';

-- ---------------------------------------------------------------------
-- Transferred final-state source: supabase/migrations/20260612180100_register_notification_cron.sql
-- ---------------------------------------------------------------------
-- =====================================================================
-- TALKPIK AI · Notification feature WP1-2 · 2026-06-12
-- private.dispatch_notifications() pg_cron 등록 (10분 주기)
--
-- 20260527110000_register_cleanup_cron.sql 패턴 준수:
--   - pg_cron extension 존재 시에만 등록 (미설치 환경은 조용히 skip)
--   - idempotent unschedule-then-register
--   - jobname: dispatch_notifications
--   - 권한: job은 등록 role(postgres — bypassrls 실측 확인)로 실행,
--     함수는 SECURITY DEFINER. 슬롯 판정은 함수 내부에서 사용자 timezone
--     보정으로 수행하므로 cron 자체는 UTC 10분 주기면 충분하다.
-- =====================================================================

do $$
declare
  v_jobid bigint;
begin
  if to_regclass('cron.job') is null
     or to_regprocedure('cron.unschedule(bigint)') is null
     or to_regprocedure('cron.schedule(text,text,text)') is null then
    raise notice 'pg_cron scheduling API unavailable — skipping dispatch_notifications registration';
    return;
  end if;

  select jobid
  into v_jobid
  from cron.job
  where jobname = 'dispatch_notifications'
  limit 1;

  if v_jobid is not null then
    perform cron.unschedule(v_jobid);
    raise log 'dispatch_notifications: existing job (jobid=%) unscheduled before reregister', v_jobid;
  end if;

  perform cron.schedule(
    'dispatch_notifications',
    '*/10 * * * *',
    $sql$ select private.dispatch_notifications() $sql$
  );

  raise log 'dispatch_notifications cron job registered (*/10 * * * * UTC)';
end $$;

-- ---------------------------------------------------------------------
-- Transferred final-state source: supabase/migrations/20260612190000_notification_email_pipeline.sql
-- ---------------------------------------------------------------------
-- =====================================================================
-- TALKPIK AI · Notification feature · 2026-06-12
-- Email notification pipeline (provider-AGNOSTIC) — SQL dispatcher extension
--
-- 계약 SoT: topik-ai docs/specs/notification-contract.md
--   - 채널: in_app / email / push / zalo. class: transactional / operational /
--     learning / marketing. marketing=동의 필수(저장소 H-2 미구현 → 전원 opted_out).
--
-- 정직성 경계 (CRITICAL):
--   이 파이프라인은 이메일 발송을 "결정·기록"하고, 성공/실패를 모사하는 TEST
--   transport를 제공한다. 실제 메일 provider 통합이 아니다(H-4 — provider 미선정).
--   attempt.status='sent'의 의미는 "파이프라인이 설정된 transport에 메시지를
--   넘겼고 transport가 성공을 반환했다"일 뿐, "실제 받은편지함에 도달했다"가 아니다.
--   기본 transport mode='disabled' → 'skipped'(reason no_transport)로 기록하여
--   provider 부재 시 프로덕션 동작이 정직하도록 한다.
--   'live' 모드 본문은 향후 실제 provider HTTP 호출이 들어갈 지점이며, 본 마이그
--   레이션은 실제 호출을 구현하지 않는다(placeholder).
--
-- 시각 출처: DB now() 단일 기준 (계약 §7). idempotency 2단 유지.
-- 함수는 private 스키마(PostgREST 미노출) + SECURITY DEFINER.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Email transport config (단일 행, service-role/SECURITY DEFINER only)
-- ---------------------------------------------------------------------
create table if not exists public.notification_email_config (
  id         boolean primary key default true check (id),
  mode       text not null default 'disabled'
             check (mode in ('disabled','test_success','test_fail','test_fail_once','live')),
  updated_at timestamptz not null default now()
);

insert into public.notification_email_config (id, mode)
values (true, 'disabled')
on conflict (id) do nothing;

comment on table public.notification_email_config is
  'Email transport 모드 단일 행. disabled(기본,프로덕션 정직) / test_* (검증용) / live(H-4 provider 미구현). '
  'RLS force + 정책 없음 → SECURITY DEFINER 함수와 service_role만 접근.';

-- RLS: enable + force, 정책 없음 (client 전면 차단).
alter table public.notification_email_config enable row level security;
alter table public.notification_email_config force  row level security;
revoke all on public.notification_email_config from anon, authenticated;

-- ---------------------------------------------------------------------
-- 2. Transport stub — config.mode에 따라 성공/실패/스킵을 모사한다.
--    실제 provider 호출은 'live' 분기(아래 명시)에 들어갈 미래 통합 지점.
-- ---------------------------------------------------------------------
create or replace function private.notification_email_transport(
  p_to         text,
  p_subject    text,
  p_body       text,
  p_attempt_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, private
as $$
declare
  v_mode  text;
  v_retry int;
begin
  select mode into v_mode from public.notification_email_config where id = true;
  v_mode := coalesce(v_mode, 'disabled');

  if v_mode = 'disabled' then
    -- provider 미구성 — 정직하게 스킵. 'sent'로 위장하지 않는다.
    return jsonb_build_object('ok', false, 'skip', true, 'reason', 'no_transport');

  elsif v_mode = 'test_success' then
    return jsonb_build_object('ok', true, 'provider_message_id', 'test-' || coalesce(p_attempt_id::text, 'unknown'));

  elsif v_mode = 'test_fail' then
    return jsonb_build_object('ok', false, 'error_code', 'test_error',
                             'error_message', 'simulated provider failure');

  elsif v_mode = 'test_fail_once' then
    -- 첫 시도(retry_count=0)는 실패, 재시도(retry_count>=1)는 성공 →
    -- 재시도-후-성공 + 중복 무발송을 검증할 수 있게 한다.
    select coalesce(retry_count, 0) into v_retry
      from public.notification_delivery_attempts where id = p_attempt_id;
    if coalesce(v_retry, 0) = 0 then
      return jsonb_build_object('ok', false, 'error_code', 'test_error',
                               'error_message', 'simulated first-try failure');
    else
      return jsonb_build_object('ok', true, 'provider_message_id', 'test-' || coalesce(p_attempt_id::text, 'unknown'));
    end if;

  elsif v_mode = 'live' then
    -- ===============================================================
    -- FUTURE PROVIDER INTEGRATION POINT (H-4)
    -- 실제 메일 provider가 선정되면 이곳에서 HTTP 호출(pg_net 또는 외부
    -- 워커 큐)을 수행하고 그 결과를 {ok, provider_message_id|error_code,
    -- error_message} 형태로 반환한다. 현재는 provider 미선정 — 실제 호출을
    -- 구현하지 않으며, 'sent'를 거짓으로 반환하지 않는다.
    -- ===============================================================
    return jsonb_build_object('ok', false, 'error_code', 'no_live_provider',
                             'error_message', 'live transport not configured (H-4)');

  else
    return jsonb_build_object('ok', false, 'error_code', 'unknown_mode',
                             'error_message', 'unrecognized transport mode: ' || v_mode);
  end if;
end;
$$;

-- ---------------------------------------------------------------------
-- 2b. 이메일 1건 집행 헬퍼 — pending attempt를 받아 transport 호출 후 종결 처리.
--     dispatcher 분기에서 공유한다(중복 코드 방지). attempt는 이미 'pending'으로
--     존재해야 한다. transport 결과로 sent/skipped/failed를 확정한다.
-- ---------------------------------------------------------------------
create or replace function private.finalize_email_attempt(
  p_attempt_id uuid,
  p_to         text,
  p_subject    text,
  p_body       text
)
returns text
language plpgsql
security definer
set search_path = pg_catalog, public, private
as $$
declare
  v_res    jsonb;
  v_status text;
begin
  v_res := private.notification_email_transport(p_to, p_subject, p_body, p_attempt_id);

  if coalesce((v_res->>'ok')::boolean, false) then
    update public.notification_delivery_attempts
       set status = 'sent',
           provider_message_id = v_res->>'provider_message_id',
           error_code = null,
           error_message = null,
           sent_at = now()
     where id = p_attempt_id;
    v_status := 'sent';

  elsif coalesce((v_res->>'skip')::boolean, false) then
    update public.notification_delivery_attempts
       set status = 'skipped',
           error_message = v_res->>'reason',
           sent_at = null
     where id = p_attempt_id;
    v_status := 'skipped';

  else
    update public.notification_delivery_attempts
       set status = 'failed',
           error_code = v_res->>'error_code',
           error_message = v_res->>'error_message',
           sent_at = null
     where id = p_attempt_id;
    v_status := 'failed';
  end if;

  return v_status;
end;
$$;

-- ---------------------------------------------------------------------
-- 3a. 스케줄형 (study_reminder / weekly_summary) — channel-aware.
--     기존 함수는 channel='in_app' 고정이었다. p_channel 파라미터로 확장하되
--     in_app 경로의 시맨틱스는 그대로 보존한다.
--       - in_app: 후보 평가 → attempt(in_app) + user_notifications insert.
--       - email : user_notifications insert 안 함. 자격 평가(pref+channels.email),
--                 eligible는 'pending' attempt 후 transport 호출로 종결.
--                 dedupe_key/dispatch dedupe에 channel을 포함해 in_app과 충돌 방지.
-- ---------------------------------------------------------------------

create or replace function private.dispatch_scheduled_notifications(
  p_template_key text,
  p_channel      text default 'in_app'
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, private
as $$
declare
  v_tpl         public.notification_templates%rowtype;
  v_tick        text;
  v_dispatch_id uuid;
  v_sent int; v_skipped int; v_opted int; v_failed int;
  c record;
begin
  if p_channel not in ('in_app','email') then
    return jsonb_build_object('template', p_template_key, 'channel', p_channel, 'result', 'unsupported_channel');
  end if;

  select * into v_tpl
    from public.notification_templates
   where template_key = p_template_key and channel = p_channel and status = 'active'
   limit 1;
  if not found then
    return jsonb_build_object('template', p_template_key, 'channel', p_channel, 'result', 'no_active_template');
  end if;

  drop table if exists _ntf_candidates;
  create temp table _ntf_candidates on commit drop as
  select ns.user_id,
         p.display_name,
         ((now() at time zone ns.timezone)::date)::text as local_date,
         coalesce((ns.channels->>'in_app')::boolean, true)  as in_app_on,
         coalesce((ns.channels->>'email')::boolean, false)  as email_on,
         coalesce((p.notification_prefs->>p_template_key)::boolean, false) as pref_on
    from public.notification_settings ns
    join public.profiles p on p.id = ns.user_id
   where case
           when p_template_key = 'study_reminder' then
             ns.reminder_time is not null
             and ns.reminder_days @> to_jsonb(extract(dow from (now() at time zone ns.timezone))::int)
             and (now() at time zone ns.timezone)::time >= ns.reminder_time
           when p_template_key = 'weekly_summary' then
             extract(dow from (now() at time zone ns.timezone))::int = 0
             and (now() at time zone ns.timezone)::time >= time '20:00'
           else false
         end
     and not exists (
           select 1 from public.notification_delivery_attempts a
            where a.dedupe_key = case
                   when p_channel = 'email'
                     then ns.user_id::text || ':' || p_template_key || ':email:'
                          || ((now() at time zone ns.timezone)::date)::text
                   else ns.user_id::text || ':' || p_template_key || ':'
                          || ((now() at time zone ns.timezone)::date)::text
                 end
         );

  if (select count(*) from _ntf_candidates) = 0 then
    return jsonb_build_object('template', p_template_key, 'channel', p_channel, 'result', 'no_candidates');
  end if;

  -- tick 클레임: 10분 윈도우. channel을 포함해 in_app/email 디스패치가 충돌하지 않게 한다.
  v_tick := to_char(
    date_trunc('hour', now()) + (floor(extract(minute from now())::numeric / 10) * interval '10 minutes'),
    'YYYY-MM-DD"T"HH24:MI"Z"');
  insert into public.notification_dispatches
    (template_id, template_key, channels, target_type, status, dedupe_key, started_at)
  values
    (v_tpl.id, p_template_key, jsonb_build_array(p_channel), 'schedule', 'running',
     'sched:' || p_channel || ':' || p_template_key || ':' || v_tick, now())
  on conflict (dedupe_key) do nothing
  returning id into v_dispatch_id;
  if v_dispatch_id is null then
    return jsonb_build_object('template', p_template_key, 'channel', p_channel,
                              'result', 'tick_already_claimed', 'tick', v_tick);
  end if;

  if p_channel = 'in_app' then
    -- ── in_app 경로 (기존 시맨틱스 보존) ────────────────────────────────
    with ins as (
      insert into public.notification_delivery_attempts
        (dispatch_id, user_id, channel, template_key, status, dedupe_key, sent_at)
      select v_dispatch_id, c2.user_id, 'in_app', p_template_key,
             case when not c2.pref_on then 'opted_out'
                  when not c2.in_app_on then 'skipped'
                  else 'sent' end,
             c2.user_id::text || ':' || p_template_key || ':' || c2.local_date,
             case when c2.pref_on and c2.in_app_on then now() else null end
        from _ntf_candidates c2
      on conflict (dedupe_key) where dedupe_key is not null do nothing
      returning id, user_id, status
    )
    insert into public.user_notifications
      (user_id, template_key, category, title, body, link_url, delivery_attempt_id)
    select i.user_id, p_template_key, v_tpl.category,
           private.render_notification_text(v_tpl.subject, c3.display_name),
           private.render_notification_text(v_tpl.body_html, c3.display_name),
           v_tpl.link_url, i.id
      from ins i
      join _ntf_candidates c3 on c3.user_id = i.user_id
     where i.status = 'sent';

  else
    -- ── email 경로 (user_notifications insert 없음) ─────────────────────
    -- 1) 자격 미달자(opted_out/skipped)는 attempt만 기록.
    insert into public.notification_delivery_attempts
      (dispatch_id, user_id, channel, template_key, status, dedupe_key, sent_at)
    select v_dispatch_id, c2.user_id, 'email', p_template_key,
           -- learning class: pref 존중 + channels.email 존중. (study_reminder/
           -- weekly_summary는 learning, mandatory 아님.)
           case when not c2.pref_on  then 'opted_out'
                when not c2.email_on then 'skipped'
                else 'pending' end,
           c2.user_id::text || ':' || p_template_key || ':email:' || c2.local_date,
           null
      from _ntf_candidates c2
    on conflict (dedupe_key) where dedupe_key is not null do nothing;

    -- 2) pending(자격 통과) attempt마다 transport 호출 → sent/skipped/failed 종결.
    for c in
      select a.id as attempt_id,
             private.render_notification_text(v_tpl.subject, cand.display_name)   as subject,
             private.render_notification_text(v_tpl.body_html, cand.display_name) as body
        from public.notification_delivery_attempts a
        join _ntf_candidates cand on cand.user_id = a.user_id
       where a.dispatch_id = v_dispatch_id and a.status = 'pending'
    loop
      perform private.finalize_email_attempt(
        c.attempt_id,
        null,  -- p_to: provider 통합 시 사용자 이메일 주입(현재 stub은 미사용)
        c.subject,
        c.body);
    end loop;
  end if;

  select count(*) filter (where status = 'sent'),
         count(*) filter (where status = 'skipped'),
         count(*) filter (where status = 'opted_out'),
         count(*) filter (where status = 'failed')
    into v_sent, v_skipped, v_opted, v_failed
    from public.notification_delivery_attempts
   where dispatch_id = v_dispatch_id;

  update public.notification_dispatches
     set status = case when coalesce(v_failed,0) > 0 then 'partial_failed' else 'completed' end,
         recipient_count = coalesce(v_sent,0) + coalesce(v_skipped,0)
                           + coalesce(v_opted,0) + coalesce(v_failed,0),
         completed_at = now()
   where id = v_dispatch_id;

  return jsonb_build_object('template', p_template_key, 'channel', p_channel,
                            'dispatch_id', v_dispatch_id, 'sent', v_sent,
                            'skipped', v_skipped, 'opted_out', v_opted, 'failed', v_failed);
end;
$$;

-- ---------------------------------------------------------------------
-- 3b. 관리자 발송 — v_tpl.channel로 분기.
--     템플릿은 단일 channel을 가지므로 디스패치별로 분기한다.
-- ---------------------------------------------------------------------
create or replace function private.dispatch_admin_notifications()
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, private
as $$
declare
  d        record;
  v_tpl    public.notification_templates%rowtype;
  v_sent int; v_skipped int; v_opted int; v_failed int;
  v_results jsonb := '[]'::jsonb;
  a record;
begin
  for d in
    select * from public.notification_dispatches
     where (status = 'running' and target_type in ('group','test'))
        or (status = 'scheduled' and scheduled_at <= now())
     order by created_at
       for update skip locked
  loop
    if d.status = 'scheduled' then
      update public.notification_dispatches
         set status = 'running', started_at = now()
       where id = d.id;
    end if;

    select * into v_tpl from public.notification_templates where id = d.template_id;
    if v_tpl.id is null then
      update public.notification_dispatches set status = 'failed', completed_at = now() where id = d.id;
      v_results := v_results || jsonb_build_object('dispatch', d.id, 'result', 'template_missing');
      continue;
    end if;

    drop table if exists _ntf_audience;
    create temp table _ntf_audience on commit drop as
    select u.user_id,
           p.display_name,
           coalesce((ns.channels->>'in_app')::boolean, true)  as in_app_on,
           coalesce((ns.channels->>'email')::boolean, false)  as email_on,
           coalesce((p.notification_prefs->>v_tpl.template_key)::boolean, false) as pref_on
      from (
        select d.actor_id as user_id
         where d.target_type = 'test' and d.actor_id is not null
        union
        select (jsonb_array_elements_text(g.static_member_ids))::uuid
          from public.notification_groups g
         where d.target_type = 'group'
           and exists (select 1 from jsonb_array_elements_text(d.target_group_ids) t(gid)
                        where t.gid = g.id::text)
      ) u
      join public.profiles p on p.id = u.user_id
      left join public.notification_settings ns on ns.user_id = u.user_id;

    if v_tpl.channel = 'in_app' then
      -- ── in_app 경로 (기존 시맨틱스 보존) ──────────────────────────────
      with ins as (
        insert into public.notification_delivery_attempts
          (dispatch_id, user_id, channel, template_key, status, sent_at)
        select d.id, a2.user_id, 'in_app', v_tpl.template_key,
               case
                 when d.target_type = 'test' then 'sent'
                 when v_tpl.class = 'marketing' then 'opted_out'
                 when v_tpl.mandatory then 'sent'
                 when v_tpl.class in ('learning','transactional') and not a2.pref_on then 'opted_out'
                 when not a2.in_app_on then 'skipped'
                 else 'sent' end,
               now()
          from _ntf_audience a2
        on conflict (dispatch_id, user_id, channel) do nothing
        returning id, user_id, status
      )
      insert into public.user_notifications
        (user_id, template_key, category, title, body, link_url, delivery_attempt_id)
      select i.user_id, v_tpl.template_key, v_tpl.category,
             private.render_notification_text(v_tpl.subject, a3.display_name),
             private.render_notification_text(v_tpl.body_html, a3.display_name),
             v_tpl.link_url, i.id
        from ins i
        join _ntf_audience a3 on a3.user_id = i.user_id
       where i.status = 'sent';

    elsif v_tpl.channel = 'email' then
      -- ── email 경로 (user_notifications insert 없음) ───────────────────
      -- 자격 평가 후 'pending'으로 attempt 기록(또는 opted_out/skipped 종결).
      --   test 대상: 본인 확인용 → 자격 평가 우회하고 발송 시도(pending).
      --   marketing: 동의 저장소 H-2 미구현 → opted_out.
      --   mandatory + operational: in_app만 강제 가능(계약 §2) — email은 강제 불가
      --     하므로 pref/channel 존중. (operational pref 키 부재 시 pref_on=false →
      --     opted_out. 현행 계약상 operational email 토글 노출 범위 O-8 미정.)
      insert into public.notification_delivery_attempts
        (dispatch_id, user_id, channel, template_key, status, sent_at)
      select d.id, a2.user_id, 'email', v_tpl.template_key,
             case
               when d.target_type = 'test' then 'pending'
               when v_tpl.class = 'marketing' then 'opted_out'
               when v_tpl.class in ('learning','transactional','operational') and not a2.pref_on then 'opted_out'
               when not a2.email_on then 'skipped'
               else 'pending' end,
             null
        from _ntf_audience a2
      on conflict (dispatch_id, user_id, channel) do nothing;

      for a in
        select x.id as attempt_id,
               private.render_notification_text(v_tpl.subject, aud.display_name)   as subject,
               private.render_notification_text(v_tpl.body_html, aud.display_name) as body
          from public.notification_delivery_attempts x
          join _ntf_audience aud on aud.user_id = x.user_id
         where x.dispatch_id = d.id and x.status = 'pending'
      loop
        perform private.finalize_email_attempt(
          a.attempt_id,
          null,
          a.subject,
          a.body);
      end loop;

    else
      update public.notification_dispatches set status = 'failed', completed_at = now() where id = d.id;
      v_results := v_results || jsonb_build_object('dispatch', d.id, 'result', 'unsupported_channel', 'channel', v_tpl.channel);
      continue;
    end if;

    select count(*) filter (where status = 'sent'),
           count(*) filter (where status = 'skipped'),
           count(*) filter (where status = 'opted_out'),
           count(*) filter (where status = 'failed')
      into v_sent, v_skipped, v_opted, v_failed
      from public.notification_delivery_attempts
     where dispatch_id = d.id;

    update public.notification_dispatches
       set status = case when coalesce(v_failed,0) > 0 then 'partial_failed' else 'completed' end,
           recipient_count = coalesce(v_sent,0) + coalesce(v_skipped,0)
                             + coalesce(v_opted,0) + coalesce(v_failed,0),
           completed_at = now()
     where id = d.id;

    v_results := v_results || jsonb_build_object('dispatch', d.id, 'channel', v_tpl.channel,
                  'sent', v_sent, 'skipped', v_skipped, 'opted_out', v_opted, 'failed', v_failed);
  end loop;

  return jsonb_build_object('processed', jsonb_array_length(v_results), 'dispatches', v_results);
end;
$$;

-- ---------------------------------------------------------------------
-- 3c. 이벤트형 (feedback_ready 등) — 활성 channel별로 분기 디스패치.
--     계약 §3: feedback_ready는 in_app+email 양쪽으로 발송될 수 있다. 활성
--     템플릿이 여러 channel을 가지면 각 channel을 독립 dispatch로 집행한다.
--     p_channel을 지정하면 해당 channel만 집행한다(검증/선택 발송용).
--     각 dispatch dedupe_key·attempt dedupe_key에 channel을 포함해 충돌 방지.
-- ---------------------------------------------------------------------
create or replace function private.dispatch_notification_event(
  p_template_key text,
  p_user_id      uuid,
  p_event_id     text,
  p_payload      jsonb default '{}'::jsonb,
  p_channel      text  default null   -- null = 모든 활성 channel
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, private
as $$
declare
  v_tpl         public.notification_templates%rowtype;
  v_dispatch_id uuid;
  v_status      text;
  v_attempt_id  uuid;
  v_display     text;
  v_in_app_on   boolean;
  v_email_on    boolean;
  v_pref_on     boolean;
  v_results     jsonb := '[]'::jsonb;
begin
  if p_user_id is null or nullif(btrim(coalesce(p_event_id, '')), '') is null then
    raise exception 'user_id and event_id required';
  end if;

  -- 수신자 컨텍스트 1회 조회 (모든 channel 공유).
  select p.display_name,
         coalesce((ns.channels->>'in_app')::boolean, true),
         coalesce((ns.channels->>'email')::boolean, false),
         coalesce((p.notification_prefs->>p_template_key)::boolean, false)
    into v_display, v_in_app_on, v_email_on, v_pref_on
    from public.profiles p
    left join public.notification_settings ns on ns.user_id = p.id
   where p.id = p_user_id;
  if not found then
    return jsonb_build_object('result', 'unknown_user');
  end if;

  -- 활성 템플릿(들)을 channel별로 순회. p_channel 지정 시 해당 channel만.
  for v_tpl in
    select * from public.notification_templates
     where template_key = p_template_key
       and status = 'active'
       and (p_channel is null or channel = p_channel)
     order by case channel when 'in_app' then 0 else 1 end
  loop
    insert into public.notification_dispatches
      (template_id, template_key, channels, target_type, status, dedupe_key, started_at)
    values
      (v_tpl.id, p_template_key, jsonb_build_array(v_tpl.channel), 'event', 'running',
       'event:' || v_tpl.channel || ':' || p_template_key || ':' || p_event_id, now())
    on conflict (dedupe_key) do nothing
    returning id into v_dispatch_id;
    if v_dispatch_id is null then
      v_results := v_results || jsonb_build_object('channel', v_tpl.channel, 'result', 'deduped');
      continue;
    end if;

    v_attempt_id := null;

    if v_tpl.channel = 'in_app' then
      v_status := case
        when v_tpl.class = 'marketing' then 'opted_out'
        when v_tpl.mandatory then 'sent'
        when v_tpl.class in ('learning','transactional') and not v_pref_on then 'opted_out'
        when not v_in_app_on then 'skipped'
        else 'sent' end;

      insert into public.notification_delivery_attempts
        (dispatch_id, user_id, channel, template_key, status, dedupe_key, sent_at)
      values
        (v_dispatch_id, p_user_id, 'in_app', p_template_key, v_status,
         p_user_id::text || ':' || p_template_key || ':' || p_event_id,
         case when v_status = 'sent' then now() else null end)
      on conflict (dedupe_key) where dedupe_key is not null do nothing
      returning id into v_attempt_id;

      if v_attempt_id is not null and v_status = 'sent' then
        insert into public.user_notifications
          (user_id, template_key, category, title, body, link_url, payload, delivery_attempt_id)
        values
          (p_user_id, p_template_key, v_tpl.category,
           private.render_notification_text(v_tpl.subject, v_display),
           private.render_notification_text(v_tpl.body_html, v_display),
           coalesce(nullif(p_payload->>'link_url', ''), v_tpl.link_url),
           p_payload, v_attempt_id);
      end if;

    else  -- email
      -- 자격 평가: marketing→opted_out, learning/transactional/operational→pref+channels.email.
      -- mandatory operational은 email 강제 불가(계약 §2)이므로 pref/channel 존중.
      v_status := case
        when v_tpl.class = 'marketing' then 'opted_out'
        when v_tpl.class in ('learning','transactional','operational') and not v_pref_on then 'opted_out'
        when not v_email_on then 'skipped'
        else 'pending' end;

      insert into public.notification_delivery_attempts
        (dispatch_id, user_id, channel, template_key, status, dedupe_key, sent_at)
      values
        (v_dispatch_id, p_user_id, 'email', p_template_key, v_status,
         p_user_id::text || ':' || p_template_key || ':email:' || p_event_id, null)
      on conflict (dedupe_key) where dedupe_key is not null do nothing
      returning id into v_attempt_id;

      -- pending이면 transport 호출로 종결. (email은 user_notifications 미기록.)
      if v_attempt_id is not null and v_status = 'pending' then
        v_status := private.finalize_email_attempt(
          v_attempt_id, null,
          private.render_notification_text(v_tpl.subject, v_display),
          private.render_notification_text(v_tpl.body_html, v_display));
      end if;
    end if;

    update public.notification_dispatches
       set status = case when v_status = 'failed' then 'partial_failed' else 'completed' end,
           recipient_count = 1, completed_at = now()
     where id = v_dispatch_id;

    v_results := v_results || jsonb_build_object(
      'channel', v_tpl.channel, 'result', v_status,
      'dispatch_id', v_dispatch_id, 'attempt_id', v_attempt_id);
  end loop;

  if jsonb_array_length(v_results) = 0 then
    return jsonb_build_object('result', 'no_active_template', 'template', p_template_key);
  end if;

  return jsonb_build_object('template', p_template_key, 'event_id', p_event_id, 'channels', v_results);
end;
$$;

-- ---------------------------------------------------------------------
-- 4. 실패 email attempt 재시도 (최대 3회). 3회 도달 시 terminal.
--    transport 재호출 → 성공이면 'sent', 실패면 retry_count++ 후 'failed' 유지.
-- ---------------------------------------------------------------------
create or replace function private.retry_failed_email_attempts()
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, private
as $$
declare
  r record;
  v_retried int := 0;
  v_succeeded int := 0;
  v_still_failed int := 0;
  v_res jsonb;
  v_display text;
  v_subject text;
  v_body text;
begin
  for r in
    select a.id, a.user_id, a.template_key, a.retry_count
      from public.notification_delivery_attempts a
     where a.channel = 'email'
       and a.status = 'failed'
       and a.retry_count < 3
       for update skip locked
  loop
    -- retry_count를 먼저 증가시킨다(transport가 retry_count를 읽는 test_fail_once
    -- 모드가 증가분을 본다 → 재시도-후-성공 검증).
    update public.notification_delivery_attempts
       set retry_count = retry_count + 1
     where id = r.id;

    -- 렌더 텍스트 재구성 (display_name fallback 동일).
    select p.display_name into v_display from public.profiles p where p.id = r.user_id;
    select t.subject, t.body_html into v_subject, v_body
      from public.notification_templates t
     where t.template_key = r.template_key and t.channel = 'email'
     order by case when t.status = 'active' then 0 else 1 end
     limit 1;

    v_res := private.notification_email_transport(
      null,
      private.render_notification_text(v_subject, v_display),
      private.render_notification_text(v_body, v_display),
      r.id);

    v_retried := v_retried + 1;

    if coalesce((v_res->>'ok')::boolean, false) then
      update public.notification_delivery_attempts
         set status = 'sent',
             provider_message_id = v_res->>'provider_message_id',
             error_code = null, error_message = null, sent_at = now()
       where id = r.id;
      v_succeeded := v_succeeded + 1;
    else
      -- 실패 유지(retry_count는 이미 증가). 3회 도달 시 다음 호출부터 제외.
      update public.notification_delivery_attempts
         set status = 'failed',
             error_code = coalesce(v_res->>'error_code', 'retry_failed'),
             error_message = v_res->>'error_message'
       where id = r.id;
      v_still_failed := v_still_failed + 1;
    end if;
  end loop;

  return jsonb_build_object('retried', v_retried, 'succeeded', v_succeeded, 'still_failed', v_still_failed);
end;
$$;

-- ---------------------------------------------------------------------
-- 5. 메인 tick — in_app 경로 보존 + email 스케줄형 2종 + email 재시도 추가.
-- ---------------------------------------------------------------------
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
    'email_retry',          private.retry_failed_email_attempts()
  );
end;
$$;

-- private 스키마는 PostgREST 미노출이지만 명시적으로 client 실행 권한 차단.
revoke all on function private.notification_email_transport(text, text, text, uuid) from public, anon, authenticated;
revoke all on function private.finalize_email_attempt(uuid, text, text, text) from public, anon, authenticated;
revoke all on function private.dispatch_scheduled_notifications(text, text) from public, anon, authenticated;
revoke all on function private.dispatch_admin_notifications() from public, anon, authenticated;
revoke all on function private.dispatch_notification_event(text, uuid, text, jsonb, text) from public, anon, authenticated;

-- ---------------------------------------------------------------------
-- Final role/RLS convergence. New Supabase projects no longer guarantee
-- implicit Data API grants, so the intended read/write boundary is explicit.
-- ---------------------------------------------------------------------
alter table public.notification_templates enable row level security;
alter table public.notification_templates force row level security;
alter table public.notification_groups enable row level security;
alter table public.notification_groups force row level security;
alter table public.notification_dispatches enable row level security;
alter table public.notification_dispatches force row level security;
alter table public.notification_delivery_attempts enable row level security;
alter table public.notification_delivery_attempts force row level security;
alter table public.notification_email_config enable row level security;
alter table public.notification_email_config force row level security;

revoke all on table
  public.notification_templates,
  public.notification_groups,
  public.notification_dispatches,
  public.notification_delivery_attempts,
  public.notification_email_config
from public, anon;

revoke insert, update, delete, truncate, references, trigger on table
  public.notification_templates,
  public.notification_groups,
  public.notification_dispatches,
  public.notification_delivery_attempts,
  public.notification_email_config
from authenticated;

grant select on table
  public.notification_templates,
  public.notification_groups,
  public.notification_dispatches,
  public.notification_delivery_attempts
to authenticated;

revoke all on table public.notification_email_config from authenticated;

grant all privileges on table
  public.notification_templates,
  public.notification_groups,
  public.notification_dispatches,
  public.notification_delivery_attempts,
  public.notification_email_config
to service_role;
revoke all on function private.retry_failed_email_attempts() from public, anon, authenticated;
revoke all on function private.dispatch_notifications() from public, anon, authenticated;

comment on function private.notification_email_transport(text, text, text, uuid) is
  'Email transport STUB (provider-agnostic). disabled→skip(no_transport); test_*→모사 성공/실패; live→placeholder(H-4, 실제 호출 미구현). sent는 "transport 성공 반환"이지 "실제 수신"이 아니다.';
comment on function private.retry_failed_email_attempts() is
  'failed email attempt 재시도 (최대 3회, 3회 도달 시 terminal). dispatch_notifications tick에서 호출.';
comment on function private.dispatch_notifications() is
  '알림 발송 메인 tick (pg_cron 10분 주기). 스케줄형 in_app·email + 관리자 발송 + email 재시도. 시각 출처 = DB now() 단일 기준.';

-- ---------------------------------------------------------------------
-- Transferred final-state source: supabase/migrations/20260612190100_email_transport_fail_user.sql
-- ---------------------------------------------------------------------
-- =====================================================================
-- TALKPIK AI · Notification feature · 2026-06-12
-- Email transport STUB — per-user failure control (QA N-EDGE-04 부분 실패)
--
-- 동기:
--   기존 stub은 mode 전역으로만 성공/실패를 모사한다(test_success=전원 성공,
--   test_fail=전원 실패). 이 때문에 "한 배치 안에서 일부 수신자만 실패하고
--   나머지는 정상, 1명 실패가 배치를 중단시키지 않음"(N-EDGE-04 부분 실패)을
--   검증할 수 없다. 사용자별 실패를 주입할 수 있는 단일 다이얼을 추가한다.
--
-- 변경:
--   1) notification_email_config.fail_user_id (nullable uuid) 추가.
--   2) private.notification_email_transport 갱신 — mode='test_success' 이고
--      config.fail_user_id 가 NULL 이 아니며 해당 attempt 의 user_id 가
--      fail_user_id 와 같으면 실패(error_code 'test_partial_fail')를 반환한다.
--      그 외 test_success 대상은 기존대로 성공. 다른 mode 는 일체 불변.
--      (attempt 의 user_id 는 p_attempt_id 로 조회한다.)
--
-- 정직성 경계 (유지): transport 는 여전히 STUB 이다. 'sent' 는 "stub 이 성공을
--   반환했다"일 뿐 "실제 메일 수신"이 아니다. 기본 mode 는 'disabled'.
--   fail_user_id 는 QA 주입용 다이얼이며 평시 NULL 이어야 한다.
-- =====================================================================

-- 1. 사용자별 실패 주입 다이얼.
alter table public.notification_email_config
  add column if not exists fail_user_id uuid;

comment on column public.notification_email_config.fail_user_id is
  'QA 전용: mode=test_success 일 때 이 user_id 의 attempt 만 실패(test_partial_fail)로 모사. '
  '부분 실패(N-EDGE-04) 검증용. 평시 NULL. 다른 mode 에는 영향 없음.';

-- 2. transport stub 에 per-user 실패 분기 추가 (test_success 한정).
create or replace function private.notification_email_transport(
  p_to         text,
  p_subject    text,
  p_body       text,
  p_attempt_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, private
as $$
declare
  v_mode    text;
  v_fail_id uuid;
  v_user_id uuid;
  v_retry   int;
begin
  select mode, fail_user_id into v_mode, v_fail_id
    from public.notification_email_config where id = true;
  v_mode := coalesce(v_mode, 'disabled');

  if v_mode = 'disabled' then
    -- provider 미구성 — 정직하게 스킵. 'sent'로 위장하지 않는다.
    return jsonb_build_object('ok', false, 'skip', true, 'reason', 'no_transport');

  elsif v_mode = 'test_success' then
    -- per-user 실패 주입(N-EDGE-04): fail_user_id 가 지정되고 이 attempt 의
    -- 소유자가 그 사용자면 실패를 모사한다. 그 외에는 성공.
    if v_fail_id is not null then
      select user_id into v_user_id
        from public.notification_delivery_attempts where id = p_attempt_id;
      if v_user_id = v_fail_id then
        return jsonb_build_object('ok', false, 'error_code', 'test_partial_fail',
                                 'error_message', 'simulated per-user failure (N-EDGE-04)');
      end if;
    end if;
    return jsonb_build_object('ok', true, 'provider_message_id', 'test-' || coalesce(p_attempt_id::text, 'unknown'));

  elsif v_mode = 'test_fail' then
    return jsonb_build_object('ok', false, 'error_code', 'test_error',
                             'error_message', 'simulated provider failure');

  elsif v_mode = 'test_fail_once' then
    -- 첫 시도(retry_count=0)는 실패, 재시도(retry_count>=1)는 성공.
    select coalesce(retry_count, 0) into v_retry
      from public.notification_delivery_attempts where id = p_attempt_id;
    if coalesce(v_retry, 0) = 0 then
      return jsonb_build_object('ok', false, 'error_code', 'test_error',
                               'error_message', 'simulated first-try failure');
    else
      return jsonb_build_object('ok', true, 'provider_message_id', 'test-' || coalesce(p_attempt_id::text, 'unknown'));
    end if;

  elsif v_mode = 'live' then
    -- ===============================================================
    -- FUTURE PROVIDER INTEGRATION POINT (H-4) — 실제 호출 미구현.
    -- ===============================================================
    return jsonb_build_object('ok', false, 'error_code', 'no_live_provider',
                             'error_message', 'live transport not configured (H-4)');

  else
    return jsonb_build_object('ok', false, 'error_code', 'unknown_mode',
                             'error_message', 'unrecognized transport mode: ' || v_mode);
  end if;
end;
$$;

revoke all on function private.notification_email_transport(text, text, text, uuid) from public, anon, authenticated;

comment on function private.notification_email_transport(text, text, text, uuid) is
  'Email transport STUB (provider-agnostic). disabled→skip(no_transport); test_success→성공('
  'config.fail_user_id 일치 attempt 는 test_partial_fail 실패); test_fail→실패; '
  'test_fail_once→첫 시도 실패·재시도 성공; live→placeholder(H-4). '
  'sent 는 "stub 성공 반환"이지 "실제 수신"이 아니다.';

-- ---------------------------------------------------------------------
-- Transferred final-state source: supabase/migrations/20260612190200_email_live_defer.sql
-- ---------------------------------------------------------------------
-- =====================================================================
-- TALKPIK AI · Notification feature · 2026-06-12
-- Email 'live' mode → APP-WORKER DEFER (SQL dispatcher는 발송하지 않는다)
--
-- 동기 / 아키텍처 (확정):
--   in-DB SQL dispatcher는 HTTP 호출이 불가하고(pg_net 미설치), provider API
--   키를 어시스턴트 컨텍스트 밖에 두어야 한다. 따라서 실제 이메일 발송은 v13
--   앱-사이드 워커 라우트(src/app/api/notifications/dispatch-email/route.ts)가
--   담당한다. 워커는 서버 env에서 RESEND_API_KEY를 읽어 Resend를 fetch로 호출한다.
--
--   이 마이그레이션은 'live' 모드의 SQL 동작을 다음과 같이 바꾼다:
--     - private.notification_email_transport: 'live' 분기 → 실패('no_live_provider')
--       대신 DEFER 신호를 반환한다: {ok:false, defer:true, reason:'app_worker'}.
--     - private.finalize_email_attempt: defer=true 결과를 받으면 attempt를
--       'pending' 상태로 그대로 둔다(failed/sent로 만들지 않음). error 필드는 정리.
--   다른 모드(disabled / test_* )는 일체 불변.
--
-- 정직성 경계 (유지·강화):
--   SQL dispatcher는 'live'에서 attempt를 'sent'로 만들지 않는다. 발송 성공의
--   기록은 오직 워커가 Resend로부터 성공 응답을 받은 뒤에만 일어난다. live 모드
--   에서 SQL이 남기는 상태는 'pending'(= 워커가 처리해야 할 큐)뿐이다.
--
-- 재시도 상호작용:
--   private.retry_failed_email_attempts는 status='failed' attempt만 처리하므로
--   defer로 'pending'에 머무는 attempt는 재시도 대상이 아니다(워커 소관).
--   단, 과거에 failed가 된 attempt가 live 모드에서 재시도될 경우 transport가
--   defer를 반환할 수 있으므로, retry 함수도 defer를 '아무것도 하지 않음(pending
--   복귀)'으로 안전하게 처리하도록 함께 갱신한다(거짓 sent/failed 방지).
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. transport: 'live' 분기를 DEFER 신호로 교체. 나머지 분기/시그니처 불변.
--    (20260612190100의 per-user 실패 다이얼 분기를 그대로 보존한다.)
-- ---------------------------------------------------------------------
create or replace function private.notification_email_transport(
  p_to         text,
  p_subject    text,
  p_body       text,
  p_attempt_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, private
as $$
declare
  v_mode    text;
  v_fail_id uuid;
  v_user_id uuid;
  v_retry   int;
begin
  select mode, fail_user_id into v_mode, v_fail_id
    from public.notification_email_config where id = true;
  v_mode := coalesce(v_mode, 'disabled');

  if v_mode = 'disabled' then
    -- provider 미구성 — 정직하게 스킵. 'sent'로 위장하지 않는다.
    return jsonb_build_object('ok', false, 'skip', true, 'reason', 'no_transport');

  elsif v_mode = 'test_success' then
    -- per-user 실패 주입(N-EDGE-04): fail_user_id 가 지정되고 이 attempt 의
    -- 소유자가 그 사용자면 실패를 모사한다. 그 외에는 성공.
    if v_fail_id is not null then
      select user_id into v_user_id
        from public.notification_delivery_attempts where id = p_attempt_id;
      if v_user_id = v_fail_id then
        return jsonb_build_object('ok', false, 'error_code', 'test_partial_fail',
                                 'error_message', 'simulated per-user failure (N-EDGE-04)');
      end if;
    end if;
    return jsonb_build_object('ok', true, 'provider_message_id', 'test-' || coalesce(p_attempt_id::text, 'unknown'));

  elsif v_mode = 'test_fail' then
    return jsonb_build_object('ok', false, 'error_code', 'test_error',
                             'error_message', 'simulated provider failure');

  elsif v_mode = 'test_fail_once' then
    -- 첫 시도(retry_count=0)는 실패, 재시도(retry_count>=1)는 성공.
    select coalesce(retry_count, 0) into v_retry
      from public.notification_delivery_attempts where id = p_attempt_id;
    if coalesce(v_retry, 0) = 0 then
      return jsonb_build_object('ok', false, 'error_code', 'test_error',
                               'error_message', 'simulated first-try failure');
    else
      return jsonb_build_object('ok', true, 'provider_message_id', 'test-' || coalesce(p_attempt_id::text, 'unknown'));
    end if;

  elsif v_mode = 'live' then
    -- ===============================================================
    -- APP-WORKER DEFER: SQL은 발송하지 않는다. attempt를 'pending'으로 두고
    -- 앱 워커 라우트가 RESEND_API_KEY로 실제 발송한다(아키텍처 확정).
    -- 'sent'를 거짓으로 반환하지 않는다.
    -- ===============================================================
    return jsonb_build_object('ok', false, 'defer', true, 'reason', 'app_worker');

  else
    return jsonb_build_object('ok', false, 'error_code', 'unknown_mode',
                             'error_message', 'unrecognized transport mode: ' || v_mode);
  end if;
end;
$$;

revoke all on function private.notification_email_transport(text, text, text, uuid) from public, anon, authenticated;

comment on function private.notification_email_transport(text, text, text, uuid) is
  'Email transport STUB + live DEFER. disabled→skip(no_transport); test_success→성공('
  'config.fail_user_id 일치 attempt 는 test_partial_fail 실패); test_fail→실패; '
  'test_fail_once→첫 시도 실패·재시도 성공; live→DEFER(app_worker, attempt를 pending 유지). '
  'sent 는 "성공 반환"이지 SQL가 직접 보낸 것이 아니다(live는 앱 워커가 발송).';

-- ---------------------------------------------------------------------
-- 2. finalize_email_attempt: defer=true → attempt를 'pending' 유지(no-op 종결).
--    error 필드 정리, sent_at/provider_message_id 미설정. 나머지 분기 불변.
-- ---------------------------------------------------------------------
create or replace function private.finalize_email_attempt(
  p_attempt_id uuid,
  p_to         text,
  p_subject    text,
  p_body       text
)
returns text
language plpgsql
security definer
set search_path = pg_catalog, public, private
as $$
declare
  v_res    jsonb;
  v_status text;
begin
  v_res := private.notification_email_transport(p_to, p_subject, p_body, p_attempt_id);

  if coalesce((v_res->>'defer')::boolean, false) then
    -- live 모드 — 앱 워커가 발송한다. attempt를 'pending'으로 두고 error 정리.
    update public.notification_delivery_attempts
       set status = 'pending',
           error_code = null,
           error_message = null,
           provider_message_id = null,
           sent_at = null
     where id = p_attempt_id;
    v_status := 'pending';

  elsif coalesce((v_res->>'ok')::boolean, false) then
    update public.notification_delivery_attempts
       set status = 'sent',
           provider_message_id = v_res->>'provider_message_id',
           error_code = null,
           error_message = null,
           sent_at = now()
     where id = p_attempt_id;
    v_status := 'sent';

  elsif coalesce((v_res->>'skip')::boolean, false) then
    update public.notification_delivery_attempts
       set status = 'skipped',
           error_message = v_res->>'reason',
           sent_at = null
     where id = p_attempt_id;
    v_status := 'skipped';

  else
    update public.notification_delivery_attempts
       set status = 'failed',
           error_code = v_res->>'error_code',
           error_message = v_res->>'error_message',
           sent_at = null
     where id = p_attempt_id;
    v_status := 'failed';
  end if;

  return v_status;
end;
$$;

revoke all on function private.finalize_email_attempt(uuid, text, text, text) from public, anon, authenticated;

comment on function private.finalize_email_attempt(uuid, text, text, text) is
  'pending email attempt 1건을 transport 결과로 종결. defer=true(live)→pending 유지(앱 워커 발송), '
  'ok→sent, skip→skipped, 그 외→failed. live 모드에서 SQL은 절대 sent로 만들지 않는다.';

-- ---------------------------------------------------------------------
-- 3. retry_failed_email_attempts: live 모드에서 transport가 defer를 반환하면
--    거짓 sent/failed로 만들지 않고 'pending'으로 되돌린다(워커 소관으로 이관).
--    (defer 분기만 추가, 나머지 동작 불변.)
-- ---------------------------------------------------------------------
create or replace function private.retry_failed_email_attempts()
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, private
as $$
declare
  r record;
  v_retried int := 0;
  v_succeeded int := 0;
  v_still_failed int := 0;
  v_deferred int := 0;
  v_res jsonb;
  v_display text;
  v_subject text;
  v_body text;
begin
  for r in
    select a.id, a.user_id, a.template_key, a.retry_count
      from public.notification_delivery_attempts a
     where a.channel = 'email'
       and a.status = 'failed'
       and a.retry_count < 3
       for update skip locked
  loop
    update public.notification_delivery_attempts
       set retry_count = retry_count + 1
     where id = r.id;

    select p.display_name into v_display from public.profiles p where p.id = r.user_id;
    select t.subject, t.body_html into v_subject, v_body
      from public.notification_templates t
     where t.template_key = r.template_key and t.channel = 'email'
     order by case when t.status = 'active' then 0 else 1 end
     limit 1;

    v_res := private.notification_email_transport(
      null,
      private.render_notification_text(v_subject, v_display),
      private.render_notification_text(v_body, v_display),
      r.id);

    v_retried := v_retried + 1;

    if coalesce((v_res->>'defer')::boolean, false) then
      -- live 모드 — 앱 워커가 발송. 'pending'으로 이관(거짓 sent/failed 방지).
      update public.notification_delivery_attempts
         set status = 'pending',
             error_code = null, error_message = null,
             provider_message_id = null, sent_at = null
       where id = r.id;
      v_deferred := v_deferred + 1;

    elsif coalesce((v_res->>'ok')::boolean, false) then
      update public.notification_delivery_attempts
         set status = 'sent',
             provider_message_id = v_res->>'provider_message_id',
             error_code = null, error_message = null, sent_at = now()
       where id = r.id;
      v_succeeded := v_succeeded + 1;
    else
      update public.notification_delivery_attempts
         set status = 'failed',
             error_code = coalesce(v_res->>'error_code', 'retry_failed'),
             error_message = v_res->>'error_message'
       where id = r.id;
      v_still_failed := v_still_failed + 1;
    end if;
  end loop;

  return jsonb_build_object('retried', v_retried, 'succeeded', v_succeeded,
                            'still_failed', v_still_failed, 'deferred', v_deferred);
end;
$$;

revoke all on function private.retry_failed_email_attempts() from public, anon, authenticated;

comment on function private.retry_failed_email_attempts() is
  'failed email attempt 재시도 (최대 3회, 3회 도달 시 terminal). live 모드 transport가 defer를 '
  '반환하면 pending으로 이관(앱 워커 발송). dispatch_notifications tick에서 호출.';

-- ---------------------------------------------------------------------
-- Transferred final-state source: supabase/migrations/20260612200100_marketing_consent_in_dispatch.sql
-- ---------------------------------------------------------------------
-- =====================================================================
-- TALKPIK AI · Notification feature · 2026-06-12
-- Marketing consent in dispatch (H-2) — replace hard-coded marketing→opted_out
--                                       with a consent lookup. Closes N-OPT-04.
--
-- 변경 전 동작 (20260612190000): 모든 마케팅 class attempt → 'opted_out'
--   (저장소 H-2 미구현이라 전원 차단).
-- 변경 후 동작: 마케팅 class → user_marketing_consent 조회.
--   - 유효 동의(consented_at not null AND unsubscribed_at null) → eligible
--     → 다른 class와 동일하게 channel 자격 검사로 진행.
--   - 그 외(동의 행 없음 / consented_at null / unsubscribed) → 'opted_out'.
--
-- 마케팅에는 pref 토글 키가 없다(profiles.notification_prefs는 study_reminder 등
-- learning 키만 보유). 따라서 마케팅 자격은 "동의 + 채널 on"으로 정의한다:
--   동의 O + 채널 on  → eligible (in_app: 'sent', email: 'pending'→transport)
--   동의 O + 채널 off → 'skipped'
--   동의 X            → 'opted_out'
-- 비-마케팅(transactional/operational/learning/mandatory) 동작은 100% 동일.
--
-- 재선언 범위: 마케팅 분기를 포함한 함수만 재생성한다.
--   - private.dispatch_admin_notifications()        (in_app + email 마케팅 분기)
--   - private.dispatch_notification_event(...)      (in_app + email 마케팅 분기)
--   private.dispatch_scheduled_notifications(...)는 마케팅 분기가 없다
--   (study_reminder/weekly_summary = learning) → 미변경.
-- 시그니처는 전부 불변.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 0. 유효 동의 판정 헬퍼 — 규칙을 한 곳에 둔다(파이프라인·향후 라우트 공유 가능).
-- ---------------------------------------------------------------------
create or replace function private.is_marketing_consented(p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public, private
as $$
  select exists (
    select 1 from public.user_marketing_consent c
     where c.user_id = p_user_id
       and c.consented_at is not null
       and c.unsubscribed_at is null
  );
$$;

revoke all on function private.is_marketing_consented(uuid) from public, anon, authenticated;

comment on function private.is_marketing_consented(uuid) is
  'H-2 유효 마케팅 동의 판정. true = consented_at not null AND unsubscribed_at null. dispatch 마케팅 자격의 단일 출처.';

-- ---------------------------------------------------------------------
-- 3b. 관리자 발송 — 마케팅 분기에 consent 검사 주입. (나머지 분기 불변.)
-- ---------------------------------------------------------------------
create or replace function private.dispatch_admin_notifications()
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, private
as $$
declare
  d        record;
  v_tpl    public.notification_templates%rowtype;
  v_sent int; v_skipped int; v_opted int; v_failed int;
  v_results jsonb := '[]'::jsonb;
  a record;
begin
  for d in
    select * from public.notification_dispatches
     where (status = 'running' and target_type in ('group','test'))
        or (status = 'scheduled' and scheduled_at <= now())
     order by created_at
       for update skip locked
  loop
    if d.status = 'scheduled' then
      update public.notification_dispatches
         set status = 'running', started_at = now()
       where id = d.id;
    end if;

    select * into v_tpl from public.notification_templates where id = d.template_id;
    if v_tpl.id is null then
      update public.notification_dispatches set status = 'failed', completed_at = now() where id = d.id;
      v_results := v_results || jsonb_build_object('dispatch', d.id, 'result', 'template_missing');
      continue;
    end if;

    drop table if exists _ntf_audience;
    create temp table _ntf_audience on commit drop as
    select u.user_id,
           p.display_name,
           coalesce((ns.channels->>'in_app')::boolean, true)  as in_app_on,
           coalesce((ns.channels->>'email')::boolean, false)  as email_on,
           coalesce((p.notification_prefs->>v_tpl.template_key)::boolean, false) as pref_on,
           private.is_marketing_consented(u.user_id) as mkt_consented
      from (
        select d.actor_id as user_id
         where d.target_type = 'test' and d.actor_id is not null
        union
        select (jsonb_array_elements_text(g.static_member_ids))::uuid
          from public.notification_groups g
         where d.target_type = 'group'
           and exists (select 1 from jsonb_array_elements_text(d.target_group_ids) t(gid)
                        where t.gid = g.id::text)
      ) u
      join public.profiles p on p.id = u.user_id
      left join public.notification_settings ns on ns.user_id = u.user_id;

    if v_tpl.channel = 'in_app' then
      -- ── in_app 경로 (기존 시맨틱스 보존 + 마케팅 consent) ─────────────
      with ins as (
        insert into public.notification_delivery_attempts
          (dispatch_id, user_id, channel, template_key, status, sent_at)
        select d.id, a2.user_id, 'in_app', v_tpl.template_key,
               case
                 when d.target_type = 'test' then 'sent'
                 when v_tpl.class = 'marketing' then
                   case when not a2.mkt_consented then 'opted_out'
                        when not a2.in_app_on then 'skipped'
                        else 'sent' end
                 when v_tpl.mandatory then 'sent'
                 when v_tpl.class in ('learning','transactional') and not a2.pref_on then 'opted_out'
                 when not a2.in_app_on then 'skipped'
                 else 'sent' end,
               now()
          from _ntf_audience a2
        on conflict (dispatch_id, user_id, channel) do nothing
        returning id, user_id, status
      )
      insert into public.user_notifications
        (user_id, template_key, category, title, body, link_url, delivery_attempt_id)
      select i.user_id, v_tpl.template_key, v_tpl.category,
             private.render_notification_text(v_tpl.subject, a3.display_name),
             private.render_notification_text(v_tpl.body_html, a3.display_name),
             v_tpl.link_url, i.id
        from ins i
        join _ntf_audience a3 on a3.user_id = i.user_id
       where i.status = 'sent';

    elsif v_tpl.channel = 'email' then
      -- ── email 경로 (user_notifications insert 없음 + 마케팅 consent) ──
      --   test 대상: 본인 확인용 → 자격 평가 우회하고 발송 시도(pending).
      --   marketing: H-2 consent 조회 → 동의 O + email_on → pending, 동의 O +
      --     email off → skipped, 동의 X → opted_out.
      --   mandatory + operational: in_app만 강제 가능(계약 §2) — email은 pref/channel 존중.
      insert into public.notification_delivery_attempts
        (dispatch_id, user_id, channel, template_key, status, sent_at)
      select d.id, a2.user_id, 'email', v_tpl.template_key,
             case
               when d.target_type = 'test' then 'pending'
               when v_tpl.class = 'marketing' then
                 case when not a2.mkt_consented then 'opted_out'
                      when not a2.email_on then 'skipped'
                      else 'pending' end
               when v_tpl.class in ('learning','transactional','operational') and not a2.pref_on then 'opted_out'
               when not a2.email_on then 'skipped'
               else 'pending' end,
             null
        from _ntf_audience a2
      on conflict (dispatch_id, user_id, channel) do nothing;

      for a in
        select x.id as attempt_id,
               private.render_notification_text(v_tpl.subject, aud.display_name)   as subject,
               private.render_notification_text(v_tpl.body_html, aud.display_name) as body
          from public.notification_delivery_attempts x
          join _ntf_audience aud on aud.user_id = x.user_id
         where x.dispatch_id = d.id and x.status = 'pending'
      loop
        perform private.finalize_email_attempt(
          a.attempt_id,
          null,
          a.subject,
          a.body);
      end loop;

    else
      update public.notification_dispatches set status = 'failed', completed_at = now() where id = d.id;
      v_results := v_results || jsonb_build_object('dispatch', d.id, 'result', 'unsupported_channel', 'channel', v_tpl.channel);
      continue;
    end if;

    select count(*) filter (where status = 'sent'),
           count(*) filter (where status = 'skipped'),
           count(*) filter (where status = 'opted_out'),
           count(*) filter (where status = 'failed')
      into v_sent, v_skipped, v_opted, v_failed
      from public.notification_delivery_attempts
     where dispatch_id = d.id;

    update public.notification_dispatches
       set status = case when coalesce(v_failed,0) > 0 then 'partial_failed' else 'completed' end,
           recipient_count = coalesce(v_sent,0) + coalesce(v_skipped,0)
                             + coalesce(v_opted,0) + coalesce(v_failed,0),
           completed_at = now()
     where id = d.id;

    v_results := v_results || jsonb_build_object('dispatch', d.id, 'channel', v_tpl.channel,
                  'sent', v_sent, 'skipped', v_skipped, 'opted_out', v_opted, 'failed', v_failed);
  end loop;

  return jsonb_build_object('processed', jsonb_array_length(v_results), 'dispatches', v_results);
end;
$$;

revoke all on function private.dispatch_admin_notifications() from public, anon, authenticated;

-- ---------------------------------------------------------------------
-- 3c. 이벤트형 — 마케팅 분기에 consent 검사 주입. (나머지 분기/시그니처 불변.)
-- ---------------------------------------------------------------------
create or replace function private.dispatch_notification_event(
  p_template_key text,
  p_user_id      uuid,
  p_event_id     text,
  p_payload      jsonb default '{}'::jsonb,
  p_channel      text  default null   -- null = 모든 활성 channel
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, private
as $$
declare
  v_tpl         public.notification_templates%rowtype;
  v_dispatch_id uuid;
  v_status      text;
  v_attempt_id  uuid;
  v_display     text;
  v_in_app_on   boolean;
  v_email_on    boolean;
  v_pref_on     boolean;
  v_mkt_consented boolean;
  v_results     jsonb := '[]'::jsonb;
begin
  if p_user_id is null or nullif(btrim(coalesce(p_event_id, '')), '') is null then
    raise exception 'user_id and event_id required';
  end if;

  -- 수신자 컨텍스트 1회 조회 (모든 channel 공유).
  select p.display_name,
         coalesce((ns.channels->>'in_app')::boolean, true),
         coalesce((ns.channels->>'email')::boolean, false),
         coalesce((p.notification_prefs->>p_template_key)::boolean, false)
    into v_display, v_in_app_on, v_email_on, v_pref_on
    from public.profiles p
    left join public.notification_settings ns on ns.user_id = p.id
   where p.id = p_user_id;
  if not found then
    return jsonb_build_object('result', 'unknown_user');
  end if;

  v_mkt_consented := private.is_marketing_consented(p_user_id);

  -- 활성 템플릿(들)을 channel별로 순회. p_channel 지정 시 해당 channel만.
  for v_tpl in
    select * from public.notification_templates
     where template_key = p_template_key
       and status = 'active'
       and (p_channel is null or channel = p_channel)
     order by case channel when 'in_app' then 0 else 1 end
  loop
    insert into public.notification_dispatches
      (template_id, template_key, channels, target_type, status, dedupe_key, started_at)
    values
      (v_tpl.id, p_template_key, jsonb_build_array(v_tpl.channel), 'event', 'running',
       'event:' || v_tpl.channel || ':' || p_template_key || ':' || p_event_id, now())
    on conflict (dedupe_key) do nothing
    returning id into v_dispatch_id;
    if v_dispatch_id is null then
      v_results := v_results || jsonb_build_object('channel', v_tpl.channel, 'result', 'deduped');
      continue;
    end if;

    v_attempt_id := null;

    if v_tpl.channel = 'in_app' then
      v_status := case
        when v_tpl.class = 'marketing' then
          case when not v_mkt_consented then 'opted_out'
               when not v_in_app_on then 'skipped'
               else 'sent' end
        when v_tpl.mandatory then 'sent'
        when v_tpl.class in ('learning','transactional') and not v_pref_on then 'opted_out'
        when not v_in_app_on then 'skipped'
        else 'sent' end;

      insert into public.notification_delivery_attempts
        (dispatch_id, user_id, channel, template_key, status, dedupe_key, sent_at)
      values
        (v_dispatch_id, p_user_id, 'in_app', p_template_key, v_status,
         p_user_id::text || ':' || p_template_key || ':' || p_event_id,
         case when v_status = 'sent' then now() else null end)
      on conflict (dedupe_key) where dedupe_key is not null do nothing
      returning id into v_attempt_id;

      if v_attempt_id is not null and v_status = 'sent' then
        insert into public.user_notifications
          (user_id, template_key, category, title, body, link_url, payload, delivery_attempt_id)
        values
          (p_user_id, p_template_key, v_tpl.category,
           private.render_notification_text(v_tpl.subject, v_display),
           private.render_notification_text(v_tpl.body_html, v_display),
           coalesce(nullif(p_payload->>'link_url', ''), v_tpl.link_url),
           p_payload, v_attempt_id);
      end if;

    else  -- email
      -- 자격 평가: marketing→consent(동의 O+email_on→pending), learning/transactional/
      -- operational→pref+channels.email. mandatory operational은 email 강제 불가(계약 §2).
      v_status := case
        when v_tpl.class = 'marketing' then
          case when not v_mkt_consented then 'opted_out'
               when not v_email_on then 'skipped'
               else 'pending' end
        when v_tpl.class in ('learning','transactional','operational') and not v_pref_on then 'opted_out'
        when not v_email_on then 'skipped'
        else 'pending' end;

      insert into public.notification_delivery_attempts
        (dispatch_id, user_id, channel, template_key, status, dedupe_key, sent_at)
      values
        (v_dispatch_id, p_user_id, 'email', p_template_key, v_status,
         p_user_id::text || ':' || p_template_key || ':email:' || p_event_id, null)
      on conflict (dedupe_key) where dedupe_key is not null do nothing
      returning id into v_attempt_id;

      -- pending이면 transport 호출로 종결. (email은 user_notifications 미기록.)
      if v_attempt_id is not null and v_status = 'pending' then
        v_status := private.finalize_email_attempt(
          v_attempt_id, null,
          private.render_notification_text(v_tpl.subject, v_display),
          private.render_notification_text(v_tpl.body_html, v_display));
      end if;
    end if;

    update public.notification_dispatches
       set status = case when v_status = 'failed' then 'partial_failed' else 'completed' end,
           recipient_count = 1, completed_at = now()
     where id = v_dispatch_id;

    v_results := v_results || jsonb_build_object(
      'channel', v_tpl.channel, 'result', v_status,
      'dispatch_id', v_dispatch_id, 'attempt_id', v_attempt_id);
  end loop;

  if jsonb_array_length(v_results) = 0 then
    return jsonb_build_object('result', 'no_active_template', 'template', p_template_key);
  end if;

  return jsonb_build_object('template', p_template_key, 'event_id', p_event_id, 'channels', v_results);
end;
$$;

revoke all on function private.dispatch_notification_event(text, uuid, text, jsonb, text) from public, anon, authenticated;
