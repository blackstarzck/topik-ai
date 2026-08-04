-- =====================================================================
-- 기관 코드 삭제 시 계약 원장과 운영 설정을 함께 정리한다 + 노출 모드 RPC 결함 수리.
--
-- ① 삭제 정리 확장
--   topik_writing_institution_contracts 와 institution_code_settings 는 institution_codes.code
--   를 소프트 참조한다(하드 FK 없음 — 계약 테이블은 별개 마이그 네임스페이스라 적용 순서
--   미보장, 설정 테이블은 대칭성 유지). 삭제한 코드를 같은 이름으로 다시 만들었을 때 이전
--   계약 기간·정원·담당자가 되살아나면 안 되므로 admin_delete_institution_code 단일 write
--   경로가 같은 트랜잭션에서 제거한다. 20260801100200 이 노출 매핑·모드 원장에 대해
--   확립한 패턴을 두 테이블에 확장하는 것이다.
--
--   베이스는 **20260801100200 의 최신 본문**이다(AGENTS.md §11.6 "구버전 정의 위에 작성
--   금지"). admin_delete_institution_code 는 문자열 수술 대상이 아님을 확인했다 —
--   20260731100000 의 수술 앵커는 admin_assign_institution_code 와
--   admin_invite_institution_members 둘뿐이다.
--
-- ② 노출 모드 RPC 결함 수리 (1행)
--   20260801100000 이 도입하고 20260801100200 이 이어받은 admin_set_institution_exposure_mode
--   는 `private.admin_has_permission` 을 호출한다. 그 함수는 **public 에만 존재한다**
--   (20260623200000 이 public.admin_has_permission(uuid,text) 로 만들고, private 변형을
--   만드는 마이그는 저장소에 없다 — dev 라이브 실측 2026-08-04: to_regprocedure 가 null).
--   결과: 기관 단위 노출 모드의 **유일한 쓰기 경로가** is_admin 검사를 지난 모든 호출에서
--   42883 으로 실패한다. dev·운영 모두 적용된 상태이며(2026-08-03 운영 적용), 그때 검증은
--   학습자 읽기 경로만 확인해 이 결함을 놓쳤다.
--
--   수리를 여기(admin 폴더)에 두는 이유: 이 함수의 **최신 정의 소유 폴더가 admin**
--   (20260801100200)이다. 적용 순서가 topik_writing → admin 이므로 writing 폴더에서
--   고치면 클린 부트스트랩에서 20260801100200 이 나중에 돌며 깨진 정의로 되덮는다.
--
-- 경계: profiles 를 읽기만 한다(회원 수 확인). 쓰지 않으므로
--   check-migration-ownership-boundary 의 ALLOWED_PROFILE_WRITE_FILES 등재가 필요 없다.
-- down: supabase/migrations-admin/down/20260804100300_institution_contract_delete_cleanup.sql
-- =====================================================================

-- ---------------------------------------------------------------- ② 노출 모드 RPC 수리
-- 20260801100200 본문과 **스키마 한정 1곳만** 다르다(private → public).
create or replace function public.admin_set_institution_exposure_mode(
  p_code text,
  p_mode text,
  p_reason text
)
returns text
language plpgsql
security definer
set search_path = pg_catalog, public, private
as $$
declare
  caller_id uuid := auth.uid();
  v_code   text := btrim(coalesce(p_code, ''));
  v_mode   text := btrim(coalesce(p_mode, ''));
  v_reason text := nullif(btrim(coalesce(p_reason, '')), '');
  v_old    text;
  v_assigned bigint;
  v_population record;
begin
  if caller_id is null then raise exception 'unauthenticated'; end if;
  if not private.is_admin(caller_id) then raise exception 'forbidden: admin required'; end if;
  -- public.admin_has_permission — private 변형은 존재하지 않는다(위 헤더 ② 참조).
  if not public.admin_has_permission(caller_id, 'users.institution-codes.manage') then
    raise exception 'forbidden: missing permission users.institution-codes.manage';
  end if;
  if v_code = '' then raise exception 'code required'; end if;
  if v_reason is null then raise exception 'reason required'; end if;
  if v_mode not in ('제한 없음', '배정분만') then
    raise exception 'invalid exposure mode: %', v_mode;
  end if;

  -- 코드 삭제 RPC와 같은 행 잠금을 공유한다. 행이 없는 모드의 최초 INSERT도
  -- 삭제 정리와 직렬화되어 code 없는 orphan 원장을 만들 수 없다.
  perform 1
    from public.institution_codes c
   where c.code = v_code
   for update;
  if not found then
    raise exception 'unknown code: %', v_code;
  end if;

  select m.exposure_mode
    into v_old
    from public.topik_writing_institution_exposure_mode m
   where m.institution_code = v_code
   for update;

  -- 행이 없으면 현재 유효값은 기본값이다.
  v_old := coalesce(v_old, '배정분만');
  if v_old = v_mode then
    return v_code;  -- 변경 없음 — 감사 행을 남기지 않는다(모달이 항상 호출해도 안전).
  end if;

  insert into public.topik_writing_institution_exposure_mode (
    institution_code, exposure_mode, reason, changed_by, updated_at
  ) values (
    v_code, v_mode, v_reason, caller_id, now()
  )
  on conflict (institution_code) do update set
    exposure_mode = excluded.exposure_mode,
    reason = excluded.reason,
    changed_by = excluded.changed_by,
    updated_at = now();

  select count(*)
    into v_assigned
    from public.topik_writing_question_institution_exposure e
   where e.institution_code = v_code;

  select *
    into v_population
    from private.institution_learner_population(v_code);

  insert into public.admin_audit_logs (
    admin_user_id, action, target_table, target_id, diff, payload
  ) values (
    caller_id,
    'institution_exposure_mode_changed',
    'InstitutionCode',
    v_code,
    jsonb_build_object('exposure_mode', jsonb_build_object('from', v_old, 'to', v_mode)),
    jsonb_build_object(
      'reason', v_reason,
      'code', v_code,
      'assignment_count', v_assigned,
      'member_count', v_population.member_count,
      'pending_invitation_count', v_population.pending_invitation_count
    )
  );

  return v_code;
end;
$$;

revoke all on function public.admin_set_institution_exposure_mode(text, text, text) from public;
revoke all on function public.admin_set_institution_exposure_mode(text, text, text) from anon;
grant execute on function public.admin_set_institution_exposure_mode(text, text, text) to authenticated;

comment on function public.admin_set_institution_exposure_mode(text, text, text) is
  '기관 코드의 쓰기 문항 노출 모드를 변경한다(사유 필수, platform 권한 users.institution-codes.manage — public.admin_has_permission 사용, private 변형은 존재하지 않는다). institution_codes 행을 잠가 코드 삭제와 직렬화한다. 값이 그대로면 감사 행 없이 조기 반환한다. 배정 0건 + 회원/대기초대 있는 상태로 `배정분만` 전환은 모드 테이블 트리거가 거부한다. 감사 action = institution_exposure_mode_changed, Target = InstitutionCode + code. 2026-08-04 권한 함수 스키마 한정 수리.';

-- ---------------------------------------------------------------- ① 삭제 정리 확장
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
  v_deleted_contract_count bigint := 0;
  v_deleted_settings_count bigint := 0;
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

  -- 계약 원장은 topik_writing 네임스페이스 소유라 적용 순서가 보장되지 않는다
  -- → to_regclass fail-open + 동적 EXECUTE(위 두 블록과 동형).
  if to_regclass('public.topik_writing_institution_contracts') is not null then
    execute 'delete from public.topik_writing_institution_contracts where institution_code = $1'
      using v_code;
    get diagnostics v_deleted_contract_count = row_count;
  end if;

  -- 운영 설정은 같은 admin 폴더(20260804100200)라 적용 순서가 보장되지만, 이 함수가
  -- 구버전 스키마에서도 호출될 수 있으므로 같은 방어를 유지한다.
  if to_regclass('public.institution_code_settings') is not null then
    execute 'delete from public.institution_code_settings where institution_code = $1'
      using v_code;
    get diagnostics v_deleted_settings_count = row_count;
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
      'deleted_contract_count', v_deleted_contract_count,
      'deleted_settings_count', v_deleted_settings_count,
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
  'Users > 기관 코드 삭제. 가입 회원이 있는 code는 차단하고 pending 초대를 취소한다. 존재 시 topik_writing_question_institution_exposure 배정, topik_writing_institution_exposure_mode 원장, topik_writing_institution_contracts 계약, institution_code_settings 운영 설정을 같은 트랜잭션에서 제거해 코드 재생성 시 이전 모드·계약 기간·정원·담당자가 되살아나지 않게 한 뒤 InstitutionCode 감사 로그를 남긴다(payload 에 정리 건수 5종). 2026-08-04.';

-- ---------------------------------------------------------------- 사후 단정
do $verify$
declare
  v_delete_definition text;
  v_set_definition text;
begin
  select pg_get_functiondef(
    'public.admin_delete_institution_code(text,text)'::regprocedure
  )
    into v_delete_definition;

  -- 20260801100200 이 세운 단정을 그대로 유지한다(회귀 방지).
  if position('topik_writing_institution_exposure_mode' in v_delete_definition) = 0
     or position('deleted_exposure_mode_count' in v_delete_definition) = 0 then
    raise exception 'institution_exposure_mode_delete_cleanup_not_wired';
  end if;

  -- 이번에 추가한 정리 2종.
  if position('topik_writing_institution_contracts' in v_delete_definition) = 0
     or position('deleted_contract_count' in v_delete_definition) = 0 then
    raise exception 'institution_contract_delete_cleanup_not_wired';
  end if;
  if position('institution_code_settings' in v_delete_definition) = 0
     or position('deleted_settings_count' in v_delete_definition) = 0 then
    raise exception 'institution_settings_delete_cleanup_not_wired';
  end if;

  select pg_get_functiondef(
    'public.admin_set_institution_exposure_mode(text,text,text)'::regprocedure
  )
    into v_set_definition;

  if position('FROM PUBLIC.INSTITUTION_CODES' in upper(v_set_definition)) = 0
     or position('FOR UPDATE' in upper(v_set_definition)) = 0 then
    raise exception 'institution_exposure_mode_code_lock_not_wired';
  end if;

  -- 권한 함수 수리가 반영됐는지. private 변형 호출이 남아 있으면 42883 이 재발한다.
  if position('private.admin_has_permission' in v_set_definition) > 0 then
    raise exception 'institution_exposure_mode_permission_schema_not_fixed';
  end if;
  if position('public.admin_has_permission' in v_set_definition) = 0 then
    raise exception 'institution_exposure_mode_permission_check_lost';
  end if;

  -- 권한 함수가 실제로 존재하는지(이 결함의 근본 원인 자체를 단정한다).
  if to_regprocedure('public.admin_has_permission(uuid,text)') is null then
    raise exception 'admin_has_permission_missing';
  end if;
end
$verify$;
