-- =====================================================================
-- 기관별 쓰기 문항 노출 — 학습자 최종 노출 계약 문구 정정 (동작 변경 0)
--
-- 배경: 20260625100000 이 이 테이블의 comment 를 "학습자 최종 노출 계약 SoT"로
--   선언하면서 전용 잠금 모델을 적어 두었다:
--     service_status=available AND (매핑 없음 OR 매핑.institution_code = user.affiliation_code)
--   즉 "매핑 행이 있는 문항은 그 기관 회원에게만 보이고, 매핑 없는 문항은 전체 공개".
--   그러나 라이브 게이팅을 실제로 수행하는 predicate
--   private.is_writing_question_visible_to_user (20260713080015 에서 도입,
--   public.get_available_writing_questions 의 WHERE 절이 호출)는 다른 규칙을 강제한다:
--     무소속 학습자(profiles.affiliation_code 없음) = available 문항 전체
--     기관 소속 학습자                             = 자기 institution_code 매핑분만
--   전용 잠금 모델은 이 저장소에서 한 번도 구현된 적이 없다. 매핑 행은 "다른 학습자에게
--   잠그는 장치"가 아니라 "그 기관 학습자에게 허용하는 목록"으로 동작해 왔다.
--
--   두 문구의 불일치 자체가 실측 오진을 만들었다(2026-07-30): 라이브 reader 본문에
--   institution/affiliation 문자열이 없어(predicate 를 간접 호출) 키워드 grep 이
--   "게이팅 0건"으로 오판했고, 실제로는 convention-vn 소속 130명이 700문항 중 18문항만
--   보고 있었다. 계약 문구가 라이브와 어긋난 채로 SoT 를 자칭하면 같은 오진이 반복된다.
--
-- 오너 결정(2026-07-30): 라이브 규칙(기관 할당제)을 계약으로 확정한다. 따라서 이
--   마이그는 comment 3건만 다시 쓴다 — 테이블·함수·정책·권한·인덱스·데이터 전부 무변경이므로
--   학습자 가시성은 단 1건도 달라지지 않는다(회귀 0).
--
-- 잘못된 문구가 다시 SoT 가 되지 않도록, 라이브 predicate 와 reader 가 실제로 할당제
--   형태일 때만 comment 를 기록한다. 형태가 다르면 stamp 하지 않고 실패한다
--   (20260527113000 이 남긴 false-record 실패를 반복하지 않기 위한 fail-closed).
--
-- 관리자측 계약은 무변경: RPC set/clear(문항중심)·add/remove(기관중심)와 그 감사
--   payload 는 이 마이그에서 건드리지 않는다.
-- down: supabase/migrations/down/20260730120000_topik_writing_institution_exposure_contract_correction.sql
-- =====================================================================

do $contract_guard$
declare
  v_predicate text;
  v_reader text;
begin
  if to_regclass('public.topik_writing_question_institution_exposure') is null then
    raise exception 'institution_exposure_table_missing';
  end if;
  if to_regprocedure('private.is_writing_question_visible_to_user(text,smallint,uuid)') is null then
    raise exception 'institution_exposure_predicate_missing';
  end if;
  if to_regprocedure('public.get_available_writing_questions(smallint,uuid)') is null then
    raise exception 'institution_exposure_canonical_reader_missing';
  end if;

  v_predicate := regexp_replace(
    pg_get_functiondef(
      to_regprocedure('private.is_writing_question_visible_to_user(text,smallint,uuid)')
    ),
    '\s+',
    ' ',
    'g'
  );
  v_reader := regexp_replace(
    pg_get_functiondef(
      to_regprocedure('public.get_available_writing_questions(smallint,uuid)')
    ),
    '\s+',
    ' ',
    'g'
  );

  -- 할당제의 핵심 분기: 무소속 학습자에게 available 전체를 허용한다.
  if v_predicate not ilike '%if v_affiliation_code is null then return true;%' then
    raise exception 'institution_exposure_predicate_is_not_assignment_model'
      using detail = 'private.is_writing_question_visible_to_user no longer grants the full available pool to learners without profiles.affiliation_code. Do not stamp the assignment-model contract before re-deciding the semantics.';
  end if;

  -- 기관 소속 학습자를 매핑 행으로 제한하는 분기.
  if v_predicate not ilike '%topik_writing_question_institution_exposure%'
     or v_predicate not ilike '%e.institution_code = v_affiliation_code%' then
    raise exception 'institution_exposure_predicate_does_not_read_mapping';
  end if;

  -- canonical reader 가 이 predicate 를 단일 관문으로 통과시키는지.
  if v_reader not ilike '%is_writing_question_visible_to_user%'
     or v_reader not ilike '%service_status = ''available''%' then
    raise exception 'institution_exposure_reader_gate_missing';
  end if;
end
$contract_guard$;

comment on table public.topik_writing_question_institution_exposure is
  'TOPIK 쓰기 문항 × 기관코드 노출 매핑(기관 할당제). 매핑 행 = 해당 institution_codes.code 소속 학습자에게 그 문항을 허용하는 목록이며, 다른 학습자에게 잠그는 장치가 아니다(매핑된 문항도 무소속 학습자에게는 계속 보인다). service_status 위에 얹히는 직교 레이어. 부여/해제는 admin_set/clear_writing_question_institutions(문항중심)와 admin_add/remove_institution_writing_questions(기관중심) RPC 단일 경로(content_admin). 학습자 최종 노출 계약: service_status=available AND (user.affiliation_code 없음 OR 매핑.institution_code = user.affiliation_code) — 무소속 학습자는 available 전체를 보고, 기관 소속 학습자는 자기 코드에 매핑된 문항만 본다(미매핑 문항은 기관 소속 학습자에게 보이지 않는다). 강제 지점은 private.is_writing_question_visible_to_user 단 하나이며, public.get_available_writing_questions(canonical reader)의 WHERE 절이 목록·상세·라이브러리·RLS·제출 경로를 모두 이 predicate 로 통과시킨다. 2026-07-30 오너 결정으로 라이브 규칙을 계약으로 확정했다 — 종전 문구 "매핑 없음=전체 공개, 매핑 있음=기관 한정"(전용 잠금)은 구현된 적이 없다.';

comment on function private.is_writing_question_visible_to_user(text, smallint, uuid) is
  '기관 할당제 학습자 가시성 predicate — 기관별 쓰기 문항 노출의 유일한 강제 지점. profiles.affiliation_code 가 없는 학습자에게는 available 문항 전체를 허용하고, 기관 소속 학습자에게는 topik_writing_question_institution_exposure 에 자기 institution_code 로 매핑된 문항만 허용한다. public.get_available_writing_questions 의 WHERE 절이 이 함수를 호출하므로 문제목록·상세·라이브러리·RLS 정책·제출 guard 가 모두 여기를 통과한다. 이 본문을 바꾸면 학습자 노출 규칙 자체가 바뀐다. 매핑 테이블은 topik-ai 소유(20260625100000). 2026-07-30.';

comment on function public.get_available_writing_questions(smallint, uuid) is
  'Learner-safe canonical list/detail RPC. Caller identity comes only from auth.uid(); answer, rubric, raw import, and internal review fields are excluded. Institution exposure is enforced here through private.is_writing_question_visible_to_user: learners without profiles.affiliation_code get the full available pool, institution learners get only the questions mapped to their institution_code in topik_writing_question_institution_exposure.';
