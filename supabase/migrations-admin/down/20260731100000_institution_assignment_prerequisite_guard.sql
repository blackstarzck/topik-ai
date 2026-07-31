-- Rollback: 20260731100000_institution_assignment_prerequisite_guard.sql
--
-- forward 가 문자열 수술로 끼워 넣은 선행조건 가드 블록을 두 함수 본문에서 다시 떼어내고
-- 헬퍼를 제거한다. 라이브 정의에서 가드 블록만 지우므로, forward 이후에 다른 마이그가
-- 같은 함수를 정당하게 재정의했더라도 그 변경은 보존된다.

do $unpatch$
declare
  v_def text;
  v_guard text;
begin
  v_guard := $guard$
  -- 배정 0건 기관에 회원을 넣으면 그 회원은 쓰기 문항을 하나도 보지 못한다(기관 할당제).
  if not private.institution_has_writing_assignment(v_code) then
    raise exception 'institution % has no writing question assignment', v_code
      using detail = 'Institution learners see only questions assigned to their institution_code, so members added to an unassigned institution would see no writing questions at all.',
            hint = 'Assign at least one question first: Users > 기관 코드 > 노출 문항.';
  end if;$guard$;

  if to_regprocedure('public.admin_assign_institution_code(uuid[],text,text)') is not null then
    v_def := pg_get_functiondef(
      to_regprocedure('public.admin_assign_institution_code(uuid[],text,text)')
    );
    if position(v_guard in v_def) > 0 then
      execute replace(v_def, v_guard, '');
    end if;
  end if;

  if to_regprocedure('public.admin_invite_institution_members(uuid[],text,text,integer)') is not null then
    v_def := pg_get_functiondef(
      to_regprocedure('public.admin_invite_institution_members(uuid[],text,text,integer)')
    );
    if position(v_guard in v_def) > 0 then
      execute replace(v_def, v_guard, '');
    end if;
  end if;
end
$unpatch$;

drop function if exists private.institution_has_writing_assignment(text);
