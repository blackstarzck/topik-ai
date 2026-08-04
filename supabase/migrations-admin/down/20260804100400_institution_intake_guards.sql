-- Rollback: 20260804100400_institution_intake_guards.sql
--
-- 🚨 이 파일도 admin_assign_institution_code / admin_invite_institution_members 를
-- 재정의하지 않는다. 원본 마이그가 두 함수를 건드리지 않았으므로 되돌릴 것도 없다
-- (문자열 수술로 심어진 선행조건 가드는 그대로 살아 있어야 한다).
--
-- 헬퍼는 20260801100100 본문(모드 인지형, 계약 비인지형)으로 되돌린다.

-- ---------------------------------------------------------------- 초대 좌석 백스톱 제거
drop trigger if exists institution_code_invitations_seat_limit_guard
  on public.institution_code_invitations;
drop function if exists private.guard_institution_invitation_seat_limit();

-- ---------------------------------------------------------------- wrapper 2종 제거
drop function if exists public.admin_invite_institution_members_guarded(uuid[], text, text, integer);
drop function if exists public.admin_assign_institution_code_guarded(uuid[], text, text);
drop function if exists private.assert_institution_intake_allowed(text, bigint);

-- ---------------------------------------------------------------- 헬퍼 원복 (20260801100100 본문)
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

-- 원복 후에도 수술된 두 RPC 의 호출부가 살아 있는지 확인한다.
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
