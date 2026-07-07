-- =====================================================================
-- topik-ai admin · 기관 초대 이메일 하드닝(오너 지적 2026-07-07 후속)
--
-- 1) respond_institution_invitation 재정의: 사용자가 이메일 발송 전에 응답(수락/거부)
--    하거나 코드 비활성으로 초대가 canceled 되는 3개 종결 경로 모두에서, 아직 발송
--    전(pending)인 초대 이메일 attempt 를 skipped(error_code='invitation_responded')로
--    종결한다 — stale 초대 메일이 뒤늦게 나가는 것을 막는다(취소 RPC의 기존 패턴 동일).
-- 2) admin_list_institution_invitations 확장: 초대별 이메일 발송 상태
--    (email_status/email_error/email_sent_at)를 attempt dedupe_key 조인으로 반환 —
--    SMTP 실패(재시도 소진 failed)·정체(pending)가 관리자 화면에 침묵하지 않도록.
--    반환 타입 변경이므로 DROP 후 재생성.
-- down: supabase/migrations-admin/down/20260707150000_institution_invitation_email_hardening.sql
-- =====================================================================

-- ── 1. respond_institution_invitation — 종결 시 pending 이메일 skip ────────────
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

  -- 수락 — 코드 재검증. 코드가 삭제/종료됐으면 예외 대신 초대를 canceled 로 영속화한다
  -- (예외를 던지면 canceled 기록까지 롤백되어 좀비 pending 이 남는다).
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
  '기관 초대 수락/거부(초대받은 본인 전용, v13 알림 모달에서 호출). 수락 시에만 profiles.affiliation_code 적용(app.claim_affiliation_code GUC + RETURNING self-verify, 기존 타기관 소속 덮어쓰기·prev_code 반환). 코드 삭제/종료 시 {status:canceled, error:code_inactive} 반환. 종결 시 미발송 초대 이메일 attempt 는 skipped(invitation_responded) 처리. 감사(action=institution_code_invitation_accepted/declined, actor=사용자).';

-- ── 2. admin_list_institution_invitations — 이메일 발송 상태 컬럼 추가 ─────────
-- 반환 타입 변경: DROP 후 재생성 (프론트 supabase-institution-codes-service 가 함께 갱신됨).
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
  email_sent_at   timestamptz
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
           i.responded_at,
           a.status,
           coalesce(a.error_code, nullif(a.error_message, '')),
           a.sent_at
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
       and (v_status is null or i.status = v_status)
     order by i.created_at desc
     limit 500;
end;
$$;

revoke all     on function public.admin_list_institution_invitations(text, uuid, text) from public;
grant  execute on function public.admin_list_institution_invitations(text, uuid, text) to authenticated;

comment on function public.admin_list_institution_invitations(text, uuid, text) is
  'Users > 기관 초대 목록 read. platform_admin 전용. 코드/회원/상태 필터, 코드 라벨·회원 이메일·초대자(admin_accounts) 표시명에 더해 초대 이메일 발송 상태(email_status/email_error/email_sent_at, attempt dedupe_key 조인)를 반환, 최신순 500건.';
