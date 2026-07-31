-- =====================================================================
-- 기관 배정 선행조건 가드를 노출 모드 인지형으로 갱신한다.
--
-- 짝 마이그: supabase/migrations/20260801100000_topik_writing_institution_exposure_mode.sql
--   그쪽이 기관 단위 노출 모드(`제한 없음` / `배정분만`)를 도입한다.
--
-- 문제: 20260731100000 이 도입한 선행조건 가드는 "그 기관에 배정된 문항이 1건 이상"을
--   요구한다. `제한 없음` 모드 기관은 배정이 0건이어도 소속 학습자가 available 문항 전체를
--   보므로 빈 화면이 아니다. 그대로 두면 `제한 없음` 기관에 회원을 배정·초대하려 할 때
--   'institution % has no writing question assignment' 로 **잘못 차단**된다.
--
-- 접근: 헬퍼 private.institution_has_writing_assignment(text) 하나만 create or replace 한다.
--   20260731100000 이 문자열 수술로 admin_assign_institution_code 와
--   admin_invite_institution_members 본문에 심어둔 호출부는 함수 이름이 같으므로 **무수정**이다.
--   두 RPC 를 다시 수술하지 않으므로 그 마이그의 앵커와 down 짝이 온전하게 유지된다.
--
-- 모드 원장은 topik_writing 네임스페이스(별도 tracker·러너) 소유라 적용 순서가 보장되지
--   않는다. 없으면 `배정분만`(= 이 가드 도입 시점의 동작)으로 간주한다 — 폴백은 항상
--   현행 동작이다. M1/M2 어느 순서로 적용돼도 중간 상태가 오늘 동작이다.
--
-- 경계: 이 파일은 private 헬퍼 하나만 재정의하며 profiles 를 읽지도 쓰지도 않는다.
--   패치 대상이던 두 RPC 를 건드리지 않으므로 ALLOWED_PROFILE_WRITE_FILES 등재도 불필요하다.
-- down: supabase/migrations-admin/down/20260801100100_institution_assignment_prerequisite_mode_aware.sql
-- =====================================================================

create or replace function private.institution_has_writing_assignment(p_code text)
returns boolean
language plpgsql
stable
security definer
set search_path = pg_catalog, public, private
as $$
declare
  v_code text := nullif(btrim(coalesce(p_code, '')), '');
  v_mode text;
begin
  if v_code is null then
    return true;
  end if;

  -- 노출 매핑 테이블이 없으면 게이팅 레이어 자체가 없다는 뜻이라 빈 화면 위험도 없다
  -- (20260731100000 의 fail-open 계약 유지).
  if to_regclass('public.topik_writing_question_institution_exposure') is null then
    return true;
  end if;

  -- 모드가 `제한 없음` 이면 배정 0건이어도 소속 학습자가 available 전체를 본다 →
  -- 선행조건 검사 대상이 아니다. 원장이 아직 없으면 `배정분만` 으로 본다(현행 동작).
  if to_regclass('public.topik_writing_institution_exposure_mode') is not null then
    execute
      'select m.exposure_mode from public.topik_writing_institution_exposure_mode m'
      || ' where m.institution_code = $1'
      into v_mode
      using v_code;

    if coalesce(v_mode, '배정분만') = '제한 없음' then
      return true;
    end if;
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
  '기관 코드에 회원을 배정·초대해도 그 학습자가 쓰기 문항을 볼 수 있는지. `제한 없음` 모드 기관은 배정 0건이어도 available 전체가 보이므로 true 를 돌려준다. `배정분만` 모드(또는 모드 원장에 행이 없는 경우)에는 배정이 1건 이상이어야 true 다. 노출 매핑 테이블이나 모드 원장이 아직 없으면(폴더 간 적용 순서 미보장) 각각 fail-open / `배정분만` 으로 처리한다. 회원 배정·초대 진입점이 이 함수를 선행조건으로 검사한다. 2026-08-01 모드 인지형으로 갱신.';

-- 패치가 실제로 반영됐는지 사후 단정. 두 RPC 의 호출부는 건드리지 않았으므로 그 호출부가
-- 여전히 이 헬퍼를 부르고 있는지도 함께 확인한다.
do $verify$
declare
  v_missing text[] := '{}'::text[];
begin
  if position(
    'topik_writing_institution_exposure_mode' in
    pg_get_functiondef(to_regprocedure('private.institution_has_writing_assignment(text)'))
  ) = 0 then
    raise exception 'institution_has_writing_assignment_not_mode_aware';
  end if;

  if position(
    'institution_has_writing_assignment' in
    pg_get_functiondef(to_regprocedure('public.admin_assign_institution_code(uuid[],text,text)'))
  ) = 0 then
    v_missing := v_missing || 'admin_assign_institution_code';
  end if;
  if position(
    'institution_has_writing_assignment' in
    pg_get_functiondef(
      to_regprocedure('public.admin_invite_institution_members(uuid[],text,text,integer)')
    )
  ) = 0 then
    v_missing := v_missing || 'admin_invite_institution_members';
  end if;

  if cardinality(v_missing) > 0 then
    raise exception 'institution_assignment_guard_callsite_lost: %', array_to_string(v_missing, ', ');
  end if;
end
$verify$;
