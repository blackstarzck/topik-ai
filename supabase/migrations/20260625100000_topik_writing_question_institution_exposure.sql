-- =====================================================================
-- topik-ai admin · TOPIK 쓰기 문항 기관별 노출 매핑
-- topik_writing_question_institution_exposure: 문항 × 기관코드 (공개 기본 + 기관 한정)
--
-- 모델: 매핑 행이 있는 문항 = 지정 기관(institution_codes.code) 회원에게만 노출,
--   매핑 행이 없는 문항 = 종전처럼 전체 공개. service_status 위에 얹히는 직교 레이어다
--   (service_status 값/RPC/추천 뷰/페이로드 RPC는 이 마이그에서 건드리지 않는다).
--
-- 4분할 부모(topik_writing_5x_questions)를 단일 FK로 참조할 수 없으므로
--   (question_id, item_number) 합성 참조의 무결성은 RPC에서 검증한다
--   (topik_writing_question_tags 0007 선례와 동일). institution_code 도 institution_codes.code
--   를 값으로 참조하되 하드 FK 를 걸지 않는다 — institution_codes 는 별개 마이그 네임스페이스
--   (migrations-admin/, 별도 tracker·러너)라 두 폴더 간 적용 순서가 보장되지 않아(클린 부트스트랩
--   에서 db:migrate 가 db:admin:migrate 보다 먼저 돌면 FK 가 깨짐) + 교차 영역 롤백을 묶지 않기
--   위해서다. 무결성은 RPC 런타임 검증(신규 부여 코드는 활성 코드만 허용)으로 보장하며, 이는
--   profiles.affiliation_code 소프트 참조(20260623110000)·합성 참조 RPC 검증(20260610201200)
--   선례와 동일한 코드베이스 규약이다.
--
-- 쓰기 경계: 이 테이블/RPC는 topik-ai 관리측에서만 매핑을 저장한다. 학습자 앱(v13)의
--   실제 노출 반영은 후속 작업이며, v13 객체·미러/싱크는 이 마이그에서 건드리지 않는다.
--   v13 후속은 아래 "학습자 최종 노출 계약"을 SoT로 삼아 service_role 읽기로 적용한다.
--
-- 학습자 최종 노출 계약(v13 후속 구현 기준):
--   visible_to(user, q) :=
--     q.service_status = 'available'
--     AND ( NOT EXISTS (이 테이블에 q 매핑 행)                          -- 전체 공개
--           OR EXISTS (q 매핑 행 WHERE institution_code = user.affiliation_code) )  -- 기관 한정
--
-- RLS: 읽기 = admin 역할(private.is_admin), 쓰기 = 전면 차단(INSERT/UPDATE/DELETE 정책
--   없음 → security definer RPC 단일 경로). topik_writing_rls 0011 모델과 동일.
-- down: supabase/migrations/down/20260625100000_topik_writing_question_institution_exposure.sql
-- =====================================================================

create table if not exists public.topik_writing_question_institution_exposure (
  question_id      text     not null,
  item_number      smallint not null check (item_number in (51, 52, 53, 54)),
  institution_code text     not null,  -- institution_codes.code 소프트 참조(하드 FK 미사용, 위 헤더 참조)
  created_by       uuid,
  created_at       timestamptz not null default now(),
  reason           text,
  primary key (question_id, institution_code)
);

-- 코드 → 허용 문항 역방향 조회 가속(v13 후속의 affiliation_code 필터, 관리 화면 칩 그룹핑).
create index if not exists topik_writing_question_institution_exposure_code_idx
  on public.topik_writing_question_institution_exposure (institution_code);

alter table public.topik_writing_question_institution_exposure enable row level security;

create policy topik_writing_question_institution_exposure_admin_select
  on public.topik_writing_question_institution_exposure
  for select to authenticated using (private.is_admin((select auth.uid())));

comment on table public.topik_writing_question_institution_exposure is
  'TOPIK 쓰기 문항 × 기관코드 노출 매핑(공개 기본 + 기관 한정). 매핑 행 존재=해당 institution_codes.code 회원에게만 노출, 없음=전체 공개. service_status 위에 얹히는 직교 레이어. 부여/해제는 admin_set/clear_writing_question_institutions RPC 단일 경로(content_admin). 학습자 최종 노출 계약: service_status=available AND (매핑 없음 OR 매핑.institution_code = user.affiliation_code) — v13 후속이 service_role 읽기로 적용(이 테이블이 SoT).';
