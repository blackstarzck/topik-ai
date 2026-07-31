-- Rollback: 20260730120000_topik_writing_institution_exposure_contract_correction.sql
--
-- comment 3건을 마이그 직전 상태로 되돌린다.
--   · 테이블 comment: 20260625100000 이 기록한 전용 잠금 문구(원문 그대로 복원)
--   · predicate comment: 마이그 이전에는 comment 가 없었으므로 null 로 되돌린다
--   · reader comment: 20260713080015 가 기록한 원문(기관 문장 없음)
-- forward 와 마찬가지로 테이블·함수·정책·권한·데이터는 건드리지 않으므로
--   롤백해도 학습자 가시성은 달라지지 않는다(문구만 원복).

comment on table public.topik_writing_question_institution_exposure is
  'TOPIK 쓰기 문항 × 기관코드 노출 매핑(공개 기본 + 기관 한정). 매핑 행 존재=해당 institution_codes.code 회원에게만 노출, 없음=전체 공개. service_status 위에 얹히는 직교 레이어. 부여/해제는 admin_set/clear_writing_question_institutions RPC 단일 경로(content_admin). 학습자 최종 노출 계약: service_status=available AND (매핑 없음 OR 매핑.institution_code = user.affiliation_code) — v13 후속이 service_role 읽기로 적용(이 테이블이 SoT).';

comment on function private.is_writing_question_visible_to_user(text, smallint, uuid) is null;

comment on function public.get_available_writing_questions(smallint, uuid) is
  'Learner-safe canonical list/detail RPC. Caller identity comes only from auth.uid(); answer, rubric, raw import, and internal review fields are excluded.';
