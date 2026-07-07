-- =====================================================================
-- topik-ai admin · 기관 초대 사용자 응답 RPC (수락/거부)
--
-- 20260707140000 의 pending 초대를 초대받은 본인(v13 학습자)이 수락/거부한다.
-- 수락 시에만 profiles.affiliation_code 를 적용한다(오너 결정 2026-07-07).
--
-- profiles 쓰기 경계: 호출자가 비관리자(학습자)이므로 protect_profile_columns 의
--   admin bypass 가 적용되지 않는다. v13 이 공식 제공하는 사용자 동의 이스케이프 해치인
--   트랜잭션 GUC app.claim_affiliation_code='1'(v13 20260619140000, claim/accept 경로와
--   동일 메커니즘)을 세팅한 뒤 UPDATE 하고, RETURNING self-verify 로 향후 v13 트리거
--   정책 변경 시 조용한 실패 대신 즉시(42501) 실패한다.
--   ※ v13 public.accept_affiliation_invite 는 기존 소속이 있으면 전환을 거부하는
--   QR 가입 전용 RPC 라 재사용하지 않는다(초대 기반 '소속 변경'이 막힘). 그대로 공존.
-- 덮어쓰기 semantics: 수락은 기존 타기관 소속을 덮어쓴다(관리자 '소속 변경' 유스케이스).
--   감사 diff 와 반환값 prev_code 로 추적하며, v13 모달이 사전 경고를 표시한다(handoff).
-- profiles 쓰기 파일 allowlist: scripts/check-migration-ownership-boundary.mjs
--   ALLOWED_PROFILE_WRITE_FILES 에 이 파일(affiliation_code 한정)을 등록한다.
-- down: supabase/migrations-admin/down/20260707141000_institution_invitation_respond.sql
-- =====================================================================

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
  '기관 초대 수락/거부(초대받은 본인 전용, v13 알림 모달에서 호출). 수락 시에만 profiles.affiliation_code 적용(app.claim_affiliation_code GUC + RETURNING self-verify, 기존 타기관 소속 덮어쓰기·prev_code 반환). 코드 삭제/종료 시 {status:canceled, error:code_inactive} 반환. 감사(action=institution_code_invitation_accepted/declined, actor=사용자).';
