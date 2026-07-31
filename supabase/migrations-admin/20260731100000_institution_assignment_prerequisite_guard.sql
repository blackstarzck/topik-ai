-- =====================================================================
-- 기관 배정 선행조건 가드 — 문항 배정 없는 기관에 회원을 넣지 못하게 막는다.
--
-- 배경: 학습자 노출 규칙은 기관 할당제다(계약 SoT = topik_writing_question_institution_exposure
--   테이블 comment, 20260730120000). 무소속 학습자는 노출 허용 문항 전체를 보고,
--   기관 소속 학습자는 자기 institution_code 에 배정된 문항만 본다.
--   따라서 **배정 0건인 기관에 회원이 들어가면 그 회원은 쓰기 문항을 한 건도 보지 못한다.**
--   현재 institution_codes 4개는 전부 배정 1건 이상이라 아직 희생자가 없지만(실측 2026-07-31),
--   신규 기관을 만들어 회원을 배정/초대하는 순간 빈 화면이 발생한다.
--
-- 접근: 폴백(배정 0건 = 제한 없음)으로 의미를 바꾸는 대신, **잘못된 상태 자체를 만들 수
--   없게** 한다. 소속(profiles.affiliation_code)을 부여할 수 있는 경로는 라이브 실측으로
--   두 개뿐이고(admin_assign_institution_code, respond_institution_invitation), 초대는
--   admin_invite_institution_members 가 만든다. 가입/QR 경로는 소속을 쓰지 않는다
--   (handle_new_user 에 affiliation_code 쓰기 없음 — 20260724130000 신뢰 경계 이후).
--   즉 관리자 진입점 두 곳만 막으면 빈 화면은 원천적으로 생기지 않는다.
--
--   학습자 쪽 respond_institution_invitation 은 의도적으로 건드리지 않는다: v13 앱에 새 예외를
--   던지게 되고, 짝 마이그(20260731100100)의 마지막-배정 삭제 가드가 대기 중 초대까지 세므로
--   "초대 후 배정이 사라진" 경로가 도달 불가해진다.
--
-- 이 마이그는 라이브 정의를 문자열 수술로 패치한다(20260714140000 선례). 앵커가 사라지면
--   실패하므로, 나중에 누가 이 함수를 재정의해도 구버전 위에 덮어쓰는 사고가 나지 않는다
--   (supabase/README.md · AGENTS.md §11.6 "구버전 정의 위에 작성 금지").
--
-- 경계: 두 RPC 는 topik-ai 소유(admin 네임스페이스)다. profiles.affiliation_code 쓰기는
--   기존 승인된 예외 경로이며 이 마이그는 그 컬럼 외 어떤 v13 소유 컬럼도 건드리지 않는다.
--   check-migration-ownership-boundary 의 ALLOWED_PROFILE_WRITE_FILES 에 이 파일을 등재했다.
-- down: supabase/migrations-admin/down/20260731100000_institution_assignment_prerequisite_guard.sql
-- =====================================================================

-- 배정 유무 판정 헬퍼. 노출 매핑 테이블은 다른 마이그 폴더(topik_writing, 별도 tracker·러너)
-- 소유라 클린 부트스트랩에서 적용 순서가 보장되지 않는다(20260625100000 헤더가 하드 FK 를
-- 피한 것과 같은 이유). 게이팅 레이어가 아직 없으면 빈 화면 위험도 없으므로 통과시킨다
-- (fail-open) — 학습자 가시성 predicate 의 fail-closed 와 목적이 반대인 지점이다.
create or replace function private.institution_has_writing_assignment(p_code text)
returns boolean
language plpgsql
stable
security definer
set search_path = pg_catalog, public, private
as $$
declare
  v_code text := nullif(btrim(coalesce(p_code, '')), '');
begin
  if v_code is null then
    return true;
  end if;
  if to_regclass('public.topik_writing_question_institution_exposure') is null then
    return true;
  end if;
  return exists (
    select 1
    from public.topik_writing_question_institution_exposure e
    where e.institution_code = v_code
  );
end;
$$;

revoke all on function private.institution_has_writing_assignment(text) from public;
revoke all on function private.institution_has_writing_assignment(text) from anon;
revoke all on function private.institution_has_writing_assignment(text) from authenticated;
revoke all on function private.institution_has_writing_assignment(text) from service_role;

comment on function private.institution_has_writing_assignment(text) is
  '기관 코드에 쓰기 문항 배정이 1건이라도 있는지. 기관 할당제에서 배정 0건 기관의 소속 학습자는 쓰기 문항을 하나도 보지 못하므로, 회원 배정·초대 진입점이 이 함수를 선행조건으로 검사한다. 노출 매핑 테이블이 아직 없으면(폴더 간 적용 순서 미보장) 게이팅 자체가 없다는 뜻이라 true 를 돌려준다. 2026-07-31.';

do $patch$
declare
  v_def text;
  v_anchor text;
  v_guard text;
begin
  -- ---------------------------------------------------------------- 직접 배정
  if to_regprocedure('public.admin_assign_institution_code(uuid[],text,text)') is null then
    raise exception 'admin_assign_institution_code_missing';
  end if;

  v_def := pg_get_functiondef(
    to_regprocedure('public.admin_assign_institution_code(uuid[],text,text)')
  );
  v_anchor := $anchor$  if v_status <> '활성' then raise exception 'cannot assign to a non-active code: %', v_code; end if;$anchor$;

  if position(v_anchor in v_def) = 0 then
    raise exception 'admin_assign_institution_code_anchor_missing'
      using detail = 'The active-code check line changed; re-derive the patch against the current definition instead of overwriting it.';
  end if;
  if position('institution_has_writing_assignment' in v_def) > 0 then
    raise exception 'admin_assign_institution_code_guard_already_present';
  end if;

  v_guard := $guard$
  -- 배정 0건 기관에 회원을 넣으면 그 회원은 쓰기 문항을 하나도 보지 못한다(기관 할당제).
  if not private.institution_has_writing_assignment(v_code) then
    raise exception 'institution % has no writing question assignment', v_code
      using detail = 'Institution learners see only questions assigned to their institution_code, so members added to an unassigned institution would see no writing questions at all.',
            hint = 'Assign at least one question first: Users > 기관 코드 > 노출 문항.';
  end if;$guard$;

  execute replace(v_def, v_anchor, v_anchor || v_guard);

  -- ---------------------------------------------------------------- 초대 발송
  if to_regprocedure('public.admin_invite_institution_members(uuid[],text,text,integer)') is null then
    raise exception 'admin_invite_institution_members_missing';
  end if;

  v_def := pg_get_functiondef(
    to_regprocedure('public.admin_invite_institution_members(uuid[],text,text,integer)')
  );
  v_anchor := $anchor$  if v_code_status <> '활성' then raise exception 'cannot invite to a non-active code: %', v_code; end if;$anchor$;

  if position(v_anchor in v_def) = 0 then
    raise exception 'admin_invite_institution_members_anchor_missing'
      using detail = 'The active-code check line changed; re-derive the patch against the current definition instead of overwriting it.';
  end if;
  if position('institution_has_writing_assignment' in v_def) > 0 then
    raise exception 'admin_invite_institution_members_guard_already_present';
  end if;

  execute replace(v_def, v_anchor, v_anchor || v_guard);
end
$patch$;

-- 패치가 실제로 두 함수 본문에 들어갔는지 확인한다. 문자열 수술은 조용히 no-op 이 될 수
-- 있는 방식이라(replace 가 못 찾으면 원본 그대로 execute), 사후 단정을 반드시 남긴다.
do $verify$
declare
  v_missing text[] := '{}'::text[];
begin
  if position(
    'institution_has_writing_assignment' in
    pg_get_functiondef(to_regprocedure('public.admin_assign_institution_code(uuid[],text,text)'))
  ) = 0 then
    v_missing := v_missing || 'admin_assign_institution_code';
  end if;
  if position(
    'institution_has_writing_assignment' in
    pg_get_functiondef(to_regprocedure('public.admin_invite_institution_members(uuid[],text,text,integer)'))
  ) = 0 then
    v_missing := v_missing || 'admin_invite_institution_members';
  end if;
  if cardinality(v_missing) > 0 then
    raise exception 'institution_assignment_guard_not_installed: %', array_to_string(v_missing, ', ');
  end if;
end
$verify$;
