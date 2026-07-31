-- =====================================================================
-- 롤백 — 기관 단위 옵트인 기본값(배정 0건 = 제한 없음) 제거
--
-- 20260731011500 직전 상태로 되돌린다:
--   - 본문: 20260713080015 의 할당제 정의(폴백 분기 없음)
--   - comment 3건: 20260730120000 이 확정한 할당제 문구
--
-- ⚠️ 롤백하면 "배정 0건 기관의 소속 학습자 = 0문항" 기본값이 되살아난다.
-- 되돌리기 전에 배정이 0건인 기관에 회원이 배정돼 있는지 확인한다:
--   select ic.code,
--          (select count(*) from public.topik_writing_question_institution_exposure e
--            where e.institution_code = ic.code) as exposure_rows,
--          (select count(*) from public.profiles p
--            where nullif(btrim(p.affiliation_code),'') = ic.code) as members
--     from public.institution_codes ic order by 2, 1;
-- exposure_rows=0 이고 members>0 인 행이 있으면 그 회원들은 롤백 직후 문항을
-- 전혀 보지 못한다. 그 경우 롤백 대신 배정을 채우는 쪽을 검토한다.
-- =====================================================================

create or replace function private.is_writing_question_visible_to_user(
  p_question_id text,
  p_item_number smallint,
  p_user_id uuid
)
returns boolean
language plpgsql
security definer
stable
set search_path = pg_catalog, public, private
as $$
declare
  v_affiliation_code text;
begin
  if p_user_id is null then
    return false;
  end if;

  select nullif(btrim(p.affiliation_code), '')
    into v_affiliation_code
    from public.profiles p
   where p.id = p_user_id;

  if not found then
    return false;
  end if;

  -- Preserve the latest v13 contract: non-institution learners see the full
  -- available pool; institution learners see assigned questions only.
  if v_affiliation_code is null then
    return true;
  end if;

  return exists (
    select 1
      from public.topik_writing_question_institution_exposure e
     where e.question_id = p_question_id
       and e.item_number = p_item_number
       and e.institution_code = v_affiliation_code
  );
end;
$$;

revoke all on function private.is_writing_question_visible_to_user(text, smallint, uuid) from public;
revoke all on function private.is_writing_question_visible_to_user(text, smallint, uuid) from anon;
revoke all on function private.is_writing_question_visible_to_user(text, smallint, uuid) from authenticated;
revoke all on function private.is_writing_question_visible_to_user(text, smallint, uuid) from service_role;

comment on table public.topik_writing_question_institution_exposure is
  'TOPIK 쓰기 문항 × 기관코드 노출 매핑(기관 할당제). 매핑 행 = 해당 institution_codes.code 소속 학습자에게 그 문항을 허용하는 목록이며, 다른 학습자에게 잠그는 장치가 아니다(매핑된 문항도 무소속 학습자에게는 계속 보인다). service_status 위에 얹히는 직교 레이어. 부여/해제는 admin_set/clear_writing_question_institutions(문항중심)와 admin_add/remove_institution_writing_questions(기관중심) RPC 단일 경로(content_admin). 학습자 최종 노출 계약: service_status=available AND (user.affiliation_code 없음 OR 매핑.institution_code = user.affiliation_code) — 무소속 학습자는 available 전체를 보고, 기관 소속 학습자는 자기 코드에 매핑된 문항만 본다(미매핑 문항은 기관 소속 학습자에게 보이지 않는다). 강제 지점은 private.is_writing_question_visible_to_user 단 하나이며, public.get_available_writing_questions(canonical reader)의 WHERE 절이 목록·상세·라이브러리·RLS·제출 경로를 모두 이 predicate 로 통과시킨다. 2026-07-30 오너 결정으로 라이브 규칙을 계약으로 확정했다 — 종전 문구 "매핑 없음=전체 공개, 매핑 있음=기관 한정"(전용 잠금)은 구현된 적이 없다.';

comment on function private.is_writing_question_visible_to_user(text, smallint, uuid) is
  '기관 할당제 학습자 가시성 predicate — 기관별 쓰기 문항 노출의 유일한 강제 지점. profiles.affiliation_code 가 없는 학습자에게는 available 문항 전체를 허용하고, 기관 소속 학습자에게는 topik_writing_question_institution_exposure 에 자기 institution_code 로 매핑된 문항만 허용한다. public.get_available_writing_questions 의 WHERE 절이 이 함수를 호출하므로 문제목록·상세·라이브러리·RLS 정책·제출 guard 가 모두 여기를 통과한다. 이 본문을 바꾸면 학습자 노출 규칙 자체가 바뀐다. 매핑 테이블은 topik-ai 소유(20260625100000). 2026-07-30.';

comment on function public.get_available_writing_questions(smallint, uuid) is
  'Learner-safe canonical list/detail RPC. Caller identity comes only from auth.uid(); answer, rubric, raw import, and internal review fields are excluded. Institution exposure is enforced here through private.is_writing_question_visible_to_user: learners without profiles.affiliation_code get the full available pool, institution learners get only the questions mapped to their institution_code in topik_writing_question_institution_exposure.';
