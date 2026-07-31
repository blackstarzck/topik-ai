-- Rollback: 20260801100100_institution_assignment_prerequisite_mode_aware.sql
--
-- 헬퍼를 20260731100000 본문(모드 비인지)으로 원복한다. 두 RPC 의 호출부는 애초에
-- 건드리지 않았으므로 원복 대상이 아니다.
--
-- 주의: 이 파일만 실행하고 짝 마이그(topik_writing 20260801100000)를 남겨 두면,
-- `제한 없음` 모드 기관에 회원을 배정·초대할 때 다시 잘못 차단된다(학습자에게는 문항이
-- 보이는데 관리자 조치만 막히는 상태). 두 파일은 함께 down 하는 것이 정상 경로다.

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
  '기관 코드에 쓰기 문항 배정이 1건이라도 있는지. 기관 할당제에서 배정 0건 기관의 소속 학습자는 쓰기 문항을 하나도 보지 못하므로, 회원 배정·초대 진입점이 이 함수를 선행조건으로 검사한다. 노출 매핑 테이블이 아직 없으면(폴더 간 적용 순서 미보장) true 를 돌려준다. 2026-07-31.';
