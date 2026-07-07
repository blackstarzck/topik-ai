-- =====================================================================
-- topik-ai admin · Users > 기관 초대(동의 기반 소속 배정) + 알림(인앱+이메일)
--
-- 오너 결정(2026-07-07): 관리자 '회원 추가'는 즉시 배정이 아니라 pending 초대를
--   생성하고, 사용자가 v13 알림에서 수락해야 profiles.affiliation_code 가 적용된다.
--   (수락/거부 RPC 는 20260707141000 — profiles 쓰기를 그 파일 하나로 격리)
--
-- 알림 경로: admin_invite_institution_members 가 초대행과 함께
--   - dispatch 1행(template_id = **email** 템플릿 — dispatch-email 워커가 template_id 를
--     우선 조회하므로 in_app id 를 넣으면 이메일에 인앱 카피가 렌더된다)
--   - in_app attempt(sent) + user_notifications 행(payload.invitation_id 포함) inline insert
--   - email attempt(pending) → topik-ai /api/notifications/dispatch-email SMTP 워커가 수거
--   를 생성한다. class=transactional + mandatory=true(동의 요청은 수신 선호 우회 — 계약 §2).
--
-- 소유권 예외: user_notifications 는 v13 소유 테이블이지만 per-user payload(invitation_id)와
--   강제 이메일은 v13 그룹 디스패처 파이프라인으로 표현 불가하여 이 RPC 가 inline insert 한다.
--   (docs/architecture/shared-supabase-schema-ownership.md 에 예외 기록. v13 private 함수는
--   호출하지 않는다 — 렌더링은 이 파일 안에서 inline replace.)
-- down: supabase/migrations-admin/down/20260707140000_institution_invitations.sql
-- =====================================================================

-- ── 초대 원장 ─────────────────────────────────────────────────────────────────
create table if not exists public.institution_code_invitations (
  id           uuid primary key default gen_random_uuid(),
  -- 코드는 불투명 문자열(profiles.affiliation_code 선례) — FK 없음, 수락 시 재검증.
  code         text not null,
  user_id      uuid not null references public.profiles(id) on delete cascade,
  invited_by   uuid references auth.users(id) on delete set null,
  reason       text not null,
  status       text not null default 'pending'
                 check (status in ('pending', 'accepted', 'declined', 'canceled')),
  responded_at timestamptz,
  created_at   timestamptz not null default now()
);

-- 같은 (회원, 코드)의 pending 초대는 1건만 — 멱등/동시성 가드(insert 는 on conflict skip).
create unique index if not exists institution_code_invitations_pending_uniq
  on public.institution_code_invitations (user_id, code)
  where status = 'pending';
create index if not exists institution_code_invitations_code_status_idx
  on public.institution_code_invitations (code, status);
create index if not exists institution_code_invitations_user_created_idx
  on public.institution_code_invitations (user_id, created_at desc);

alter table public.institution_code_invitations enable row level security;
alter table public.institution_code_invitations force  row level security;

-- v13 수락/거부 모달이 본인 초대를 직접 읽는다. 관리자는 전체 조회.
drop policy if exists institution_code_invitations_select on public.institution_code_invitations;
create policy institution_code_invitations_select on public.institution_code_invitations
  for select to authenticated
  using (user_id = (select auth.uid()) or private.is_admin((select auth.uid())));

-- 쓰기는 SECURITY DEFINER RPC 전용 (정책 없음 + 명시 revoke).
revoke insert, update, delete on public.institution_code_invitations from anon, authenticated;

comment on table public.institution_code_invitations is
  '기관 코드 초대 원장(topik-ai 소유). 관리자 초대(pending) → 사용자가 v13 알림 모달에서 respond_institution_invitation 으로 수락/거부. 수락 시에만 profiles.affiliation_code 적용. 쓰기는 RPC 전용, 본인/관리자만 select.';

-- ── 알림 템플릿 시드 (institution_invitation × in_app/email) ───────────────────
insert into public.notification_templates (
  template_key, channel, class, mandatory, mode, category, name, summary,
  subject, body_html, variables, link_url, status
) values
(
  'institution_invitation', 'in_app', 'transactional', true, 'auto', 'notice',
  '기관 소속 초대(인앱)',
  '관리자가 기관 코드에 회원을 초대하면 발송되는 인앱 알림. 알림에서 수락/거부 모달을 연다.',
  '기관 소속 초대가 도착했습니다',
  -- link_url ''(not null 컬럼) — v13 벨은 이 알림을 라우팅 대신 수락/거부 모달로 처리한다.
  '<p>{{display_name}}님, {{institution_label}} 기관 소속 초대가 도착했습니다. 수락하면 해당 기관 회원으로 등록됩니다.</p>',
  '["display_name","institution_label"]'::jsonb, '', 'active'
),
(
  'institution_invitation', 'email', 'transactional', true, 'auto', 'notice',
  '기관 소속 초대(이메일)',
  '관리자가 기관 코드에 회원을 초대하면 발송되는 이메일. 워커 제약({{display_name}}만 렌더)으로 기관명 없는 일반 카피 + CTA.',
  '[TOPIK AI] 기관 소속 초대 안내',
  '<p>{{display_name}}님, 안녕하세요.</p><p>TOPIK AI 에서 기관 소속 초대가 도착했습니다. 아래 버튼을 눌러 알림함에서 초대 내용을 확인하고 수락 여부를 선택해 주세요.</p>',
  '["display_name"]'::jsonb, '/settings/notifications', 'active'
)
on conflict (template_key, channel) do nothing;

-- ── Write: 기관 초대 발송(초대행 + 인앱/이메일 알림) ───────────────────────────
create or replace function public.admin_invite_institution_members(
  p_user_ids uuid[],
  p_code     text,
  p_reason   text
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

  -- 스킵 규칙(무오류): 동일 코드 기소속 / 동일 코드 pending 초대 존재 / 탈퇴(deleted) 회원.
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

    insert into public.institution_code_invitations (code, user_id, invited_by, reason)
    values (v_code, rec.id, caller_id, v_reason)
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
    v_body  := replace(replace(
                 regexp_replace(coalesce(v_inapp_tpl.body_html, ''), '<[^>]+>', '', 'g'),
                 '{{display_name}}', v_display),
                 '{{institution_label}}', v_label);

    insert into public.user_notifications
      (user_id, template_key, category, title, body, link_url, payload, delivery_attempt_id)
    values
      (rec.id, 'institution_invitation', v_inapp_tpl.category, v_title, v_body, null,
       jsonb_build_object(
         'kind', 'institution_invitation',
         'invitation_id', v_invitation_id,
         'code', v_code,
         'code_label', v_label
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
                         'invitation_id', v_invitation_id,
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

-- ── Read: 초대 목록(코드/회원/상태 필터) ──────────────────────────────────────
create or replace function public.admin_list_institution_invitations(
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
  responded_at    timestamptz
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
           i.status,
           i.reason,
           i.invited_by,
           coalesce(nullif(aa.display_name, ''), aa.email, i.invited_by::text),
           i.created_at,
           i.responded_at
      from public.institution_code_invitations i
      left join public.institution_codes c on c.code = i.code
      left join public.profiles p on p.id = i.user_id
      left join auth.users u on u.id = i.user_id
      left join public.admin_accounts aa on aa.id = i.invited_by
     where (v_code is null or i.code = v_code)
       and (p_user_id is null or i.user_id = p_user_id)
       and (v_status is null or i.status = v_status)
     order by i.created_at desc
     limit 500;
end;
$$;

-- ── Write: pending 초대 취소 ──────────────────────────────────────────────────
create or replace function public.admin_cancel_institution_invitation(
  p_invitation_id uuid,
  p_reason        text
)
returns uuid
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  caller_id uuid := auth.uid();
  v_reason  text := nullif(btrim(coalesce(p_reason, '')), '');
  v_row     public.institution_code_invitations%rowtype;
begin
  if caller_id is null then raise exception 'unauthenticated'; end if;
  if not private.is_platform_admin(caller_id) then raise exception 'forbidden: platform_admin required'; end if;
  if v_reason is null then raise exception 'reason required'; end if;
  if p_invitation_id is null then raise exception 'invitation id required'; end if;

  select * into v_row
    from public.institution_code_invitations
   where id = p_invitation_id
   for update;
  if not found then raise exception 'unknown invitation: %', p_invitation_id; end if;
  if v_row.status <> 'pending' then
    raise exception 'invitation is not pending: %', v_row.status;
  end if;

  update public.institution_code_invitations
     set status = 'canceled', responded_at = now()
   where id = p_invitation_id;

  -- 아직 발송 전(pending)인 초대 이메일은 skipped 로 종결 — 취소된 초대의 메일이
  -- 이후 워커 tick 에 발송되는 것을 막는다(이미 발송된 건은 그대로).
  update public.notification_delivery_attempts
     set status = 'skipped', error_code = 'invitation_canceled',
         error_message = 'invitation canceled before email dispatch'
   where channel = 'email' and status = 'pending'
     and dedupe_key = v_row.user_id::text || ':institution_invitation:email:' || v_row.id::text;

  -- user_notifications 행은 그대로 둔다 — 사용자가 응답 시 respond RPC 가
  -- 'invitation already responded: canceled' 로 알려 v13 모달이 처리 상태를 표시한다.
  insert into public.admin_audit_logs (admin_user_id, action, target_table, target_id, diff, payload)
  values (
    caller_id,
    'institution_code_invitation_canceled',
    'User',
    v_row.user_id::text,
    jsonb_build_object('invitation_status', jsonb_build_object('from', 'pending', 'to', 'canceled')),
    jsonb_build_object('reason', v_reason, 'code', v_row.code, 'invitation_id', v_row.id)
  );

  return v_row.id;
end;
$$;

-- ── 코드 삭제 시 좀비 초대 방지: admin_delete_institution_code 재정의 ──────────
-- (20260626100000 본문 + pending 초대 일괄 취소 1문. 시그니처/게이트/감사 유지)
create or replace function public.admin_delete_institution_code(
  p_code text,
  p_reason text
)
returns text
language plpgsql
security definer
set search_path to 'pg_catalog', 'public'
as $function$
declare
  caller_id uuid := auth.uid();
  v_code text := btrim(coalesce(p_code, ''));
  v_reason text := nullif(btrim(coalesce(p_reason, '')), '');
  v_old public.institution_codes%rowtype;
  v_member_count bigint := 0;
  v_deleted_exposure_count bigint := 0;
  v_canceled_invitation_count bigint := 0;
begin
  if caller_id is null then raise exception 'unauthenticated'; end if;
  if not private.is_admin(caller_id) then raise exception 'forbidden: admin required'; end if;
  if not public.admin_has_permission(caller_id, 'users.institution-codes.manage') then
    raise exception 'forbidden: missing permission users.institution-codes.manage';
  end if;
  if v_code = '' then raise exception 'code required'; end if;
  if v_reason is null then raise exception 'reason required'; end if;

  select * into v_old
    from public.institution_codes
   where code = v_code
   for update;
  if not found then raise exception 'unknown code: %', v_code; end if;

  select count(*) into v_member_count
    from public.profiles p
   where p.affiliation_code = v_code;

  if v_member_count > 0 then
    raise exception 'cannot delete institution code with assigned members: %', v_member_count;
  end if;

  update public.institution_code_invitations
     set status = 'canceled', responded_at = now()
   where code = v_code and status = 'pending';
  get diagnostics v_canceled_invitation_count = row_count;

  if to_regclass('public.topik_writing_question_institution_exposure') is not null then
    execute 'delete from public.topik_writing_question_institution_exposure where institution_code = $1'
      using v_code;
    get diagnostics v_deleted_exposure_count = row_count;
  end if;

  delete from public.institution_codes
   where code = v_code;

  insert into public.admin_audit_logs (admin_user_id, action, target_table, target_id, diff, payload)
  values (
    caller_id,
    'institution_code_deleted',
    'InstitutionCode',
    v_code,
    jsonb_build_object('deleted', jsonb_build_object('from', false, 'to', true)),
    jsonb_build_object(
      'reason', v_reason,
      'label', v_old.label,
      'kind', v_old.kind,
      'status', v_old.status,
      'note', v_old.note,
      'member_count', v_member_count,
      'deleted_exposure_count', v_deleted_exposure_count,
      'canceled_invitation_count', v_canceled_invitation_count
    )
  );

  return v_code;
end;
$function$;

-- ── grants / comments ─────────────────────────────────────────────────────────
revoke all     on function public.admin_invite_institution_members(uuid[], text, text) from public;
grant  execute on function public.admin_invite_institution_members(uuid[], text, text) to authenticated;
revoke all     on function public.admin_list_institution_invitations(text, uuid, text) from public;
grant  execute on function public.admin_list_institution_invitations(text, uuid, text) to authenticated;
revoke all     on function public.admin_cancel_institution_invitation(uuid, text) from public;
grant  execute on function public.admin_cancel_institution_invitation(uuid, text) to authenticated;

comment on function public.admin_invite_institution_members(uuid[], text, text) is
  'Users > 기관 초대 발송. platform_admin 전용, reason 필수, 활성 코드만. pending 초대행 생성 + 인앱 알림(user_notifications inline, payload.invitation_id) + 이메일 attempt(pending→SMTP 워커). 동일코드 기소속/기pending/deleted 스킵(무오류), 초대 수 반환, 회원별 감사(action=institution_code_invited).';
comment on function public.admin_list_institution_invitations(text, uuid, text) is
  'Users > 기관 초대 목록 read. platform_admin 전용. 코드/회원/상태 필터, 코드 라벨·회원 이메일·초대자(admin_accounts) 표시명 포함, 최신순 500건.';
comment on function public.admin_cancel_institution_invitation(uuid, text) is
  'Users > pending 기관 초대 취소. platform_admin 전용, reason 필수. status=canceled 전환(응답 완료 건은 예외), 감사(action=institution_code_invitation_canceled).';
comment on function public.admin_delete_institution_code(text, text) is
  'Users > 기관 코드 삭제. 가입 회원이 있는 code는 차단, pending 초대는 일괄 canceled, 존재 시 topik_writing_question_institution_exposure 매핑 제거 후 InstitutionCode 감사 로그.';
