-- Rollback: 20260804100300_institution_contract_delete_cleanup.sql
--
-- admin_delete_institution_code 를 20260801100200 본문으로 되돌린다(계약·설정 정리 블록
-- 제거). 계약·설정 테이블 자체는 짝 down 들이 남기므로, 이 상태에서 코드를 삭제하면
-- 계약·설정 행이 orphan 으로 남는다 — 롤백 후 같은 code 를 재생성할 계획이라면 수동으로
-- 정리하여라:
--   delete from public.topik_writing_institution_contracts where institution_code = '<code>';
--   delete from public.institution_code_settings where institution_code = '<code>';
--
-- **admin_set_institution_exposure_mode 는 되돌리지 않는다.** 이 파일이 그 함수에 한 일은
-- 이 기능과 무관한 결함 수리(private.admin_has_permission → public, 존재하지 않는 함수를
-- 부르던 42883)뿐이다. 롤백은 이 기능을 되돌리는 것이지 남의 수리를 다시 깨뜨리는 것이
-- 아니다. 되돌리면 기관 노출 모드의 유일한 쓰기 경로가 다시 죽는다.

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
  v_deleted_exposure_mode_count bigint := 0;
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

  if to_regclass('public.topik_writing_institution_exposure_mode') is not null then
    execute 'delete from public.topik_writing_institution_exposure_mode where institution_code = $1'
      using v_code;
    get diagnostics v_deleted_exposure_mode_count = row_count;
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
      'deleted_exposure_mode_count', v_deleted_exposure_mode_count,
      'canceled_invitation_count', v_canceled_invitation_count
    )
  );

  return v_code;
end;
$function$;

revoke all on function public.admin_delete_institution_code(text, text) from public;
revoke all on function public.admin_delete_institution_code(text, text) from anon;
grant execute on function public.admin_delete_institution_code(text, text) to authenticated;

comment on function public.admin_delete_institution_code(text, text) is
  'Users > 기관 코드 삭제. 가입 회원이 있는 code는 차단하고 pending 초대를 취소한다. 존재 시 topik_writing_question_institution_exposure 배정과 topik_writing_institution_exposure_mode 원장을 같은 트랜잭션에서 제거해 코드 재생성 시 이전 모드가 되살아나지 않게 한 뒤 InstitutionCode 감사 로그를 남긴다. 2026-08-01.';
