-- =====================================================================
-- topik-ai admin · 기관 초대 만료(expiry) 기능 (오너 결정 2026-07-08)
--
-- 정책: 기본 7일 + 초대 시 변경 가능(p_expires_in_days 1~365).
-- 판정: cron 없는 lazy 방식 — 접점마다 전환/표시한다.
--   ① respond: 만료된 pending 응답 시 status='expired' 영속화 + {status:'expired'} 반환
--      (코드 비활성 canceled 처리와 동일 패턴 — 예외를 던지면 전환까지 롤백됨)
--   ② invite: 같은 (user,code)의 만료된 pending 을 expired 로 먼저 전환해 재초대 허용
--      (pending partial unique 가 만료 초대로 재초대를 영구 차단하는 것 방지)
--   ③ list: 표시용 유효 상태 계산(pending+만료 경과 → 'expired') — DB 전환 없이도 화면 정확
-- 알림: 인앱 payload 에 expires_at 포함(v13 모달 D-day), 인앱 본문 {{expires_on}}
--   변수를 RPC 가 KST 날짜로 렌더(템플릿에 변수가 없으면 no-op). 이메일 본문은
--   워커 렌더 제약(display_name만)으로 만료일 미포함 — handoff 문서 참조.
-- 백필: 기존 pending 초대는 created_at + 7일로 만료 설정.
-- invite RPC 는 시그니처 변경(3인자→4인자 default)이라 DROP 후 재생성 — 구버전
--   3인자 호출(배포된 admin)은 PostgREST named-args 해석으로 4인자 default 에 안전 매칭.
-- down: supabase/migrations-admin/down/20260708120000_institution_invitation_expiry.sql
-- =====================================================================

alter table public.institution_code_invitations
  add column if not exists expires_at timestamptz;

comment on column public.institution_code_invitations.expires_at is
  '초대 만료 시각(초대 시 지정, 기본 7일). 경과 시 lazy 전환으로 status=expired. null=만료 없음(레거시 방지용 백필 수행).';

alter table public.institution_code_invitations
  drop constraint if exists institution_code_invitations_status_check;
alter table public.institution_code_invitations
  add constraint institution_code_invitations_status_check
  check (status in ('pending', 'accepted', 'declined', 'canceled', 'expired'));

-- 백필: 만료 정책 도입 전 pending 초대는 초대일 + 7일.
update public.institution_code_invitations
   set expires_at = created_at + interval '7 days'
 where status = 'pending' and expires_at is null;

create index if not exists institution_code_invitations_pending_expiry_idx
  on public.institution_code_invitations (expires_at)
  where status = 'pending';

-- ── invite: 만료 기간 인자 추가(기본 7일) — 시그니처 변경으로 DROP 후 재생성 ────
drop function if exists public.admin_invite_institution_members(uuid[], text, text);

create function public.admin_invite_institution_members(
  p_user_ids        uuid[],
  p_code            text,
  p_reason          text,
  p_expires_in_days integer default 7
)
returns integer
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  caller_id       uuid := auth.uid();
  v_reason        text := nullif(btrim(coalesce(p_reason, '')), '');
  v_code          text := btrim(coalesce(p_code, ''));
  v_days          integer := coalesce(p_expires_in_days, 7);
  v_expires_at    timestamptz;
  v_expires_on    text;
  v_code_status   text;
  v_label         text;
  v_inapp_tpl     public.notification_templates%rowtype;
  v_email_tpl_id  uuid;
  v_bad_uid       uuid;
  v_dispatch_id   uuid;
  v_invitation_id uuid;
  v_attempt_id    uuid;
  v_display       text;
  v_title         text;
  v_body          text;
  v_invited       integer := 0;
  rec             record;
begin
  if caller_id is null then raise exception 'unauthenticated'; end if;
  if not private.is_platform_admin(caller_id) then raise exception 'forbidden: platform_admin required'; end if;
  if v_reason is null then raise exception 'reason required'; end if;
  if v_code = '' then raise exception 'code required'; end if;
  if p_user_ids is null or array_length(p_user_ids, 1) is null then
    raise exception 'user ids required';
  end if;
  if v_days < 1 or v_days > 365 then
    raise exception 'expires_in_days must be between 1 and 365: %', v_days;
  end if;

  v_expires_at := now() + make_interval(days => v_days);
  v_expires_on := to_char(v_expires_at at time zone 'Asia/Seoul', 'YYYY-MM-DD');

  select label, status into v_label, v_code_status
    from public.institution_codes where code = v_code;
  if not found then raise exception 'unknown code: %', v_code; end if;
  if v_code_status <> '활성' then raise exception 'cannot invite to a non-active code: %', v_code; end if;

  select * into v_inapp_tpl
    from public.notification_templates
   where template_key = 'institution_invitation' and channel = 'in_app' and status = 'active'
   limit 1;
  select id into v_email_tpl_id
    from public.notification_templates
   where template_key = 'institution_invitation' and channel = 'email' and status = 'active'
   limit 1;
  if v_inapp_tpl.id is null or v_email_tpl_id is null then
    raise exception 'institution_invitation templates missing (in_app/email)';
  end if;

  -- 존재하지 않는 회원 id 는 배정 RPC 선례대로 전체 실패.
  select t.x into v_bad_uid
    from unnest(p_user_ids) as t(x)
   where t.x is not null
     and not exists (select 1 from public.profiles p where p.id = t.x)
   limit 1;
  if v_bad_uid is not null then raise exception 'unknown user id: %', v_bad_uid; end if;

  -- 만료 경과한 pending 은 expired 로 전환해 재초대를 허용한다(lazy 전환 ②).
  update public.institution_code_invitations i
     set status = 'expired'
   where i.code = v_code and i.status = 'pending'
     and i.expires_at is not null and i.expires_at < now()
     and i.user_id = any(p_user_ids);

  -- 스킵 규칙(무오류): 동일 코드 기소속 / 동일 코드 유효 pending 존재 / 탈퇴(deleted) 회원.
  for rec in
    select p.id,
           u.email::text as email,
           coalesce(nullif(p.display_name, ''), nullif(p.nickname::text, ''), u.email::text) as display
      from (select distinct x as id from unnest(p_user_ids) as t(x) where x is not null) ids
      join public.profiles p on p.id = ids.id
      left join auth.users u on u.id = p.id
     where coalesce(p.affiliation_code, '') <> v_code
       and coalesce(p.status, '') <> 'deleted'
       and not exists (
             select 1 from public.institution_code_invitations i
              where i.user_id = p.id and i.code = v_code and i.status = 'pending'
           )
  loop
    -- 대상이 1명 이상 확정된 시점에만 dispatch 를 만든다(0명이면 원장 오염 없음).
    if v_dispatch_id is null then
      insert into public.notification_dispatches
        (template_id, template_key, channels, target_type, status, actor_id, reason, dedupe_key, started_at)
      values
        (v_email_tpl_id, 'institution_invitation', '["in_app","email"]'::jsonb, 'event', 'running',
         caller_id, v_reason, 'inst-invite:' || gen_random_uuid(), now())
      returning id into v_dispatch_id;
    end if;

    insert into public.institution_code_invitations (code, user_id, invited_by, reason, expires_at)
    values (v_code, rec.id, caller_id, v_reason, v_expires_at)
    on conflict (user_id, code) where status = 'pending' do nothing
    returning id into v_invitation_id;
    if v_invitation_id is null then continue; end if;  -- 동시 실행 race — 이미 초대됨

    insert into public.notification_delivery_attempts
      (dispatch_id, user_id, channel, template_key, status, dedupe_key, sent_at)
    values
      (v_dispatch_id, rec.id, 'in_app', 'institution_invitation', 'sent',
       rec.id::text || ':institution_invitation:' || v_invitation_id::text, now())
    returning id into v_attempt_id;

    v_display := coalesce(nullif(btrim(coalesce(rec.display, '')), ''), '학습자');
    v_title := replace(v_inapp_tpl.subject, '{{display_name}}', v_display);
    v_body  := replace(replace(replace(
                 regexp_replace(coalesce(v_inapp_tpl.body_html, ''), '<[^>]+>', '', 'g'),
                 '{{display_name}}', v_display),
                 '{{institution_label}}', v_label),
                 '{{expires_on}}', v_expires_on);

    insert into public.user_notifications
      (user_id, template_key, category, title, body, link_url, payload, delivery_attempt_id)
    values
      (rec.id, 'institution_invitation', v_inapp_tpl.category, v_title, v_body, null,
       jsonb_build_object(
         'kind', 'institution_invitation',
         'invitation_id', v_invitation_id,
         'code', v_code,
         'code_label', v_label,
         'expires_at', v_expires_at
       ),
       v_attempt_id);

    -- transactional+mandatory — 수신 선호를 확인하지 않고 pending 적재(계약 §2), 워커가 발송.
    insert into public.notification_delivery_attempts
      (dispatch_id, user_id, channel, template_key, status, dedupe_key)
    values
      (v_dispatch_id, rec.id, 'email', 'institution_invitation', 'pending',
       rec.id::text || ':institution_invitation:email:' || v_invitation_id::text);

    insert into public.admin_audit_logs (admin_user_id, action, target_table, target_id, diff, payload)
    values (
      caller_id,
      'institution_code_invited',
      'User',
      rec.id::text,
      jsonb_build_object('invitation_status', jsonb_build_object('from', null, 'to', 'pending')),
      jsonb_build_object('reason', v_reason, 'code', v_code, 'code_label', v_label,
                         'invitation_id', v_invitation_id, 'expires_at', v_expires_at,
                         'target_email', rec.email, 'target_display', rec.display)
    );

    v_invited := v_invited + 1;
  end loop;

  if v_dispatch_id is not null then
    update public.notification_dispatches
       set status = 'completed', recipient_count = v_invited, completed_at = now()
     where id = v_dispatch_id;
  end if;

  return v_invited;
end;
$$;

revoke all     on function public.admin_invite_institution_members(uuid[], text, text, integer) from public;
grant  execute on function public.admin_invite_institution_members(uuid[], text, text, integer) to authenticated;

comment on function public.admin_invite_institution_members(uuid[], text, text, integer) is
  'Users > 기관 초대 발송. platform_admin 전용, reason 필수, 활성 코드만, 만료 기본 7일(p_expires_in_days 1~365). pending 초대행 생성 + 인앱 알림(payload.invitation_id/expires_at, {{expires_on}} 렌더) + 이메일 attempt(pending→SMTP 워커). 만료된 기존 pending 은 expired 전환 후 재초대 허용. 동일코드 기소속/유효 pending/deleted 스킵(무오류), 초대 수 반환, 회원별 감사.';

-- ── respond: 만료된 초대 응답 시 expired 영속화 ────────────────────────────────
create or replace function public.respond_institution_invitation(
  p_invitation_id uuid,
  p_accept        boolean
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  caller_id      uuid := auth.uid();
  v_row          public.institution_code_invitations%rowtype;
  v_label        text;
  v_code_status  text;
  v_old          text;
  v_profile_stat text;
  v_persisted    text;
begin
  if caller_id is null then raise exception 'unauthenticated'; end if;
  if p_invitation_id is null then raise exception 'invitation id required'; end if;
  if p_accept is null then raise exception 'accept flag required'; end if;

  select * into v_row
    from public.institution_code_invitations
   where id = p_invitation_id
   for update;
  if not found then raise exception 'unknown invitation: %', p_invitation_id; end if;
  if v_row.user_id <> caller_id then
    raise exception 'forbidden: not invitation owner' using errcode = '42501';
  end if;
  if v_row.status <> 'pending' then
    -- v13 모달이 상태 문자열로 '이미 처리된 초대' 분기를 표시한다.
    raise exception 'invitation already responded: %', v_row.status;
  end if;

  select label, status into v_label, v_code_status
    from public.institution_codes where code = v_row.code;

  -- 응답이 확정되면 아직 발송 전인 초대 이메일은 의미가 없다 — skipped 로 종결.
  update public.notification_delivery_attempts
     set status = 'skipped', error_code = 'invitation_responded',
         error_message = 'invitation responded before email dispatch'
   where channel = 'email' and status = 'pending'
     and dedupe_key = v_row.user_id::text || ':institution_invitation:email:' || v_row.id::text;

  -- 만료 경과 — 예외 대신 expired 영속화(lazy 전환 ①). 수락/거부 모두 무효.
  if v_row.expires_at is not null and v_row.expires_at < now() then
    update public.institution_code_invitations
       set status = 'expired'
     where id = v_row.id;
    return jsonb_build_object('status', 'expired', 'error', 'invitation_expired',
                              'code', v_row.code, 'code_label', v_label);
  end if;

  -- 거부: 소속 무변화, 초대만 종결.
  if not p_accept then
    update public.institution_code_invitations
       set status = 'declined', responded_at = now()
     where id = v_row.id;

    insert into public.admin_audit_logs (admin_user_id, action, target_table, target_id, diff, payload)
    values (
      caller_id,
      'institution_code_invitation_declined',
      'User',
      caller_id::text,
      jsonb_build_object('invitation_status', jsonb_build_object('from', 'pending', 'to', 'declined')),
      jsonb_build_object('code', v_row.code, 'code_label', v_label, 'invitation_id', v_row.id)
    );

    return jsonb_build_object('status', 'declined', 'code', v_row.code, 'code_label', v_label);
  end if;

  -- 수락 — 코드 재검증. 코드가 삭제/종료됐으면 예외 대신 초대를 canceled 로 영속화한다.
  if v_code_status is null or v_code_status <> '활성' then
    update public.institution_code_invitations
       set status = 'canceled', responded_at = now()
     where id = v_row.id;
    return jsonb_build_object('status', 'canceled', 'error', 'code_inactive',
                              'code', v_row.code, 'code_label', v_label);
  end if;

  select p.affiliation_code, p.status into v_old, v_profile_stat
    from public.profiles p
   where p.id = caller_id
   for update of p;
  if not found then raise exception 'profile not found'; end if;
  if v_profile_stat = 'deleted' then
    raise exception 'forbidden: profile deleted' using errcode = '42501';
  end if;

  -- v13 사용자 동의 이스케이프 해치(트랜잭션 한정) — protect_profile_columns 통과.
  perform set_config('app.claim_affiliation_code', '1', true);

  update public.profiles
     set affiliation_code = v_row.code
   where id = caller_id
  returning affiliation_code into v_persisted;

  if v_persisted is distinct from v_row.code then
    raise exception
      'affiliation_code write suppressed (persisted=%, expected=%); protect_profile_columns may no longer honor app.claim_affiliation_code',
      v_persisted, v_row.code using errcode = '42501';
  end if;

  update public.institution_code_invitations
     set status = 'accepted', responded_at = now()
   where id = v_row.id;

  insert into public.admin_audit_logs (admin_user_id, action, target_table, target_id, diff, payload)
  values (
    caller_id,
    'institution_code_invitation_accepted',
    'User',
    caller_id::text,
    jsonb_build_object('affiliation_code', jsonb_build_object('from', v_old, 'to', v_row.code)),
    jsonb_build_object('code', v_row.code, 'code_label', v_label,
                       'invitation_id', v_row.id, 'prev_code', v_old)
  );

  return jsonb_build_object('status', 'accepted', 'code', v_row.code,
                            'code_label', v_label, 'prev_code', v_old);
end;
$$;

revoke all     on function public.respond_institution_invitation(uuid, boolean) from public;
grant  execute on function public.respond_institution_invitation(uuid, boolean) to authenticated;

comment on function public.respond_institution_invitation(uuid, boolean) is
  '기관 초대 수락/거부(초대받은 본인 전용, v13 알림 모달에서 호출). 만료 경과 시 {status:expired} 영속화. 수락 시에만 profiles.affiliation_code 적용(GUC+self-verify, 타기관 덮어쓰기·prev_code 반환). 코드 삭제/종료 시 {status:canceled, error:code_inactive}. 종결 시 미발송 초대 이메일 attempt skipped 처리. 감사(actor=사용자).';

-- ── list: expires_at 반환 + 표시용 유효 상태(pending+만료 → expired) ────────────
drop function if exists public.admin_list_institution_invitations(text, uuid, text);

create function public.admin_list_institution_invitations(
  p_code    text default null,
  p_user_id uuid default null,
  p_status  text default null
)
returns table (
  invitation_id   uuid,
  code            text,
  code_label      text,
  user_id         uuid,
  email           text,
  display_name    text,
  nickname        text,
  status          text,
  reason          text,
  invited_by      uuid,
  invited_by_name text,
  created_at      timestamptz,
  responded_at    timestamptz,
  email_status    text,
  email_error     text,
  email_sent_at   timestamptz,
  expires_at      timestamptz
)
language plpgsql
stable
security definer
set search_path = pg_catalog, public
as $$
declare
  caller_id uuid := auth.uid();
  v_code    text := nullif(btrim(coalesce(p_code, '')), '');
  v_status  text := nullif(btrim(coalesce(p_status, '')), '');
begin
  if caller_id is null then raise exception 'unauthenticated'; end if;
  if not private.is_platform_admin(caller_id) then raise exception 'forbidden: platform_admin required'; end if;

  return query
    select i.id,
           i.code,
           c.label,
           i.user_id,
           u.email::text,
           p.display_name,
           p.nickname::text,
           -- 표시용 유효 상태(lazy 전환 ③): 만료 경과한 pending 은 expired 로 계산.
           case when i.status = 'pending' and i.expires_at is not null and i.expires_at < now()
                then 'expired' else i.status end,
           i.reason,
           i.invited_by,
           coalesce(nullif(aa.display_name, ''), aa.email, i.invited_by::text),
           i.created_at,
           i.responded_at,
           a.status,
           coalesce(a.error_code, nullif(a.error_message, '')),
           a.sent_at,
           i.expires_at
      from public.institution_code_invitations i
      left join public.institution_codes c on c.code = i.code
      left join public.profiles p on p.id = i.user_id
      left join auth.users u on u.id = i.user_id
      left join public.admin_accounts aa on aa.id = i.invited_by
      left join public.notification_delivery_attempts a
        on a.channel = 'email'
       and a.dedupe_key = i.user_id::text || ':institution_invitation:email:' || i.id::text
     where (v_code is null or i.code = v_code)
       and (p_user_id is null or i.user_id = p_user_id)
       and (v_status is null or
            (case when i.status = 'pending' and i.expires_at is not null and i.expires_at < now()
                  then 'expired' else i.status end) = v_status)
     order by i.created_at desc
     limit 500;
end;
$$;

revoke all     on function public.admin_list_institution_invitations(text, uuid, text) from public;
grant  execute on function public.admin_list_institution_invitations(text, uuid, text) to authenticated;

comment on function public.admin_list_institution_invitations(text, uuid, text) is
  'Users > 기관 초대 목록 read. platform_admin 전용. 코드/회원/상태 필터(유효 상태 기준 — 만료 경과 pending 은 expired), 코드 라벨·회원 이메일·초대자 표시명·이메일 발송 상태·만료 시각 반환, 최신순 500건.';

-- ── 인앱 템플릿 본문에 만료 안내 문장 추가({{expires_on}} 변수) ────────────────
update public.notification_templates
   set body_html = '<p>{{display_name}}님, {{institution_label}} 기관 소속 초대가 도착했습니다. 수락하면 해당 기관 회원으로 등록됩니다. 이 초대는 {{expires_on}}까지 응답할 수 있습니다.</p>',
       variables = '["display_name","institution_label","expires_on"]'::jsonb
 where template_key = 'institution_invitation' and channel = 'in_app';
