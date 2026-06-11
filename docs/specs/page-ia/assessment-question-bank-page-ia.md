# Assessment > TOPIK 쓰기 문항 목록 상세 IA

## 1. 문서 목적

- `Assessment > TOPIK 쓰기 문항 목록`의 목록 조회 구조와 2depth 문항 상세 페이지 구조를 하나의 SoT로 고정한다.
- 이 문서의 1차 대상은 문항 목록 페이지(`/assessment/question-bank`)와 2depth 문항 상세 페이지다. `문항 관리`(관리 포인트: 태그 + 노출 통제)는 별도 라우트/페이지로 분리되어 `docs/specs/page-ia/assessment-question-manage-page-ia.md`가 소유한다.
- 2026-06-11 인바운드 모델 전환(`docs/architecture/metadata-tag-schema-transition-decision-record.md` §0)에 따라 이 페이지의 정체성은 **조회 전용**으로 재정의됐다. 문항 본문·메타데이터는 외부(공급) API가 **완성 상태로 공급**하며, admin은 문제를 저작·생성·분류·검수하지 않는다. 이 페이지는 수신·적재된 문항과 메타데이터를 열람하는 화면이다.
- 운영 기본 흐름은 `검색 -> 상세 열람`이다. 조치(태그 부여/제거, `service_status` 노출 통제)는 문항 관리 페이지 책임이며, 이 페이지에는 쓰기 액션이 없다.
- `51~54번` 문제 유형 차이를 반영하면서도 검색 파라미터, URL 복원 계약을 관리 페이지와 일관되게 유지한다.

> 상위 개념어로서 "문제은행"은 목록/관리 두 페이지를 아우르는 도메인 명칭으로만 사용한다. 라우트 `/assessment/question-bank`는 문항 목록 페이지가 소유하고, 문항 관리 페이지(`/assessment/question-bank/manage`)는 `docs/specs/page-ia/assessment-question-manage-page-ia.md`가 소유한다.

> 현행 코드 주의: 현행 구현은 아직 검수 표면(페이지 제목 `TOPIK 쓰기 문제 검수`, 검수 상태 축, 2depth 페이지의 검수 메모 카드·검수 액션)을 포함한다. 본 문서의 목표/정책/계약은 새 모델 기준으로 기술하고, 현행 코드 동작을 서술하는 부분은 사실대로 두되 "(2026-06-11 인바운드 전환으로 제거 예정 — 재정의 P3)"를 표시한다.

## 2. 문서 메타

| 항목 | 내용 |
| --- | --- |
| 모듈 | Assessment |
| 페이지명 | TOPIK 쓰기 문항 목록 (조회 전용) |
| 현재 상태 | 구현됨 — 데이터 소스는 facade 스위치(`legacy` 기본 / `topik_writing` / `mock`) 기반. 단 현행 구현은 검수 표면을 포함하며 재정의 P3에서 제거 예정 |
| 페이지 유형 | 목록 조회형 + 2depth 문항 상세(조회 전용) |
| 목록 라우트 | `/assessment/question-bank` |
| 상세 라우트 | 현행 `/assessment/question-bank/review/:questionId` — 재정의 P3 구현에서 검수 명칭 없는 경로로 개명 예정(확정 경로는 P3 라우터 갱신과 동시 문서화) |
| 주요 권한 | `assessment.question-bank.manage` |
| 주요 role | `SUPER_ADMIN`, `CONTENT_MANAGER` |
| 연관 문서 | `docs/specs/page-ia/assessment-question-manage-page-ia.md`, `docs/specs/admin-page-tables.md`, `docs/specs/admin-data-contract.md`, `docs/specs/admin-action-log.md`, `docs/architecture/admin-data-source-transition.md`, `docs/specs/admin-policy-source-map.md`, `docs/specs/admin-data-usage-map.md`, `docs/architecture/metadata-tag-schema-transition-decision-record.md`, `docs/metadata-tag-schema-rule.md` |

## 3. 페이지 목표와 비목표

### 목표

- 외부(공급) API로부터 수신·적재된 TOPIK 쓰기 `51~54번` 문항(Supabase `topik_writing_51/52/53/54_questions` + `question_source_map`)을 문제 번호 단위로 조회·열람한다. 외부 API가 미개발인 인터림 동안에는 P2 백필 466행(초기 코퍼스)이 조회 대상이다.
- 표시 축은 **주제(`topic_main`/`topic_detail`)·난이도(1~6)·유형·노출 상태(`service_status`)·태그**다. 문항 품질·상태 표현은 태그로만 한다(태그 부여/제거는 문항 관리 페이지 책임).
- 2depth 문항 상세에서 공급된 메타데이터(`docs/metadata-tag-schema-rule.md` §4·§7, §7.9 제외)를 조회 전용으로 열람한다 — 51/52 빈칸 메타, 53 자료 수치, 54 문항 질문 등 번호별 전용 필드 포함.
- 노출 상태·태그 조치가 필요한 문항을 식별해 문항 관리 페이지(`docs/specs/page-ia/assessment-question-manage-page-ia.md`)로 넘긴다.

### 비목표

- 검수하지 않는다. 검수 큐/검수 메모/검수 상태 변경은 2026-06-11 검수 개념 전면 삭제로 admin 표면에서 제거 대상이다(현행 코드의 검수 표면은 재정의 P3에서 제거 예정).
- 이 화면에서 문항을 수동 생성·저작·분류하지 않는다(문항 본문·메타데이터는 외부에서 완성 상태로 공급).
- 태그 부여/제거와 `service_status` 노출 통제는 이 화면 책임이 아니다(문항 관리 페이지 소관).
- 상류 서비스로의 배포(API 업로드/push)는 폐기된 개념이며 이 화면을 포함한 admin 어디에도 존재하지 않는다(2026-06-11 §0 — 구 POL-017 push 모델 폐기).
- EPS TOPIK, 레벨 테스트 세트 편성을 이 화면 책임으로 가져오지 않는다.
- JSON 업로드, JSON fallback 조회, 배치 재생성, 대량 일괄 조치는 포함하지 않는다.

## 4. 운영자 사용 시나리오

- 시나리오 1: 운영자가 목록 페이지에서 문제 번호와 검색 조건(주제 종합/세부, 유형, 난이도, 검색어)으로 문항을 좁히고, `상황 요약` 1줄 셀 hover/focus 툴팁으로 상황 요약 전문과 시나리오 유형을 확인한 뒤 행 클릭으로 2depth 문항 상세에 들어간다. (현행 코드 사실: 툴팁 내부 진입 버튼 라벨이 `검수하기`다 — 2026-06-11 인바운드 전환으로 조회 명칭으로 교체 예정 — 재정의 P3)
- 시나리오 2: 2depth 문항 상세에서 문항 번호에 맞는 메타데이터 row만 확인한다. `51/52`, `53`, `54`는 같은 공통 상단(문항 번호/ID/주제/보조 주제/유형·급수/시나리오 유형/상황 요약/학습 목표/문항 본문)과 공통 꼬리(모범답안, `auto_checks_passed`, 추천 키)를 공유하되, 번호별 전용 row를 조건부 노출한다.
- 시나리오 3: 운영자가 상세에서 공급 메타데이터의 정합을 열람으로 확인하고, 태그 부여/제거나 노출 상태 전환이 필요하다고 판단하면 문항 관리 페이지(`/assessment/question-bank/manage`)에서 조치한다. 이 페이지에서는 어떤 상태도 변경하지 않는다.
- (현행 코드 사실 — 제거 예정, 재정의 P3) 현행 2depth 페이지 우측에는 `검수 메모` 카드가 있고 `검수 완료`/`사용 보류`/`검수 필요` 액션이 동작한다. 메모는 `content_team_memo`에 기록되는데, 새 모델에서 `content_team_memo`는 **수신 메타데이터(admin 쓰기 없음)**이므로 이 쓰기 경로 자체가 제거 대상이다.
- 두 페이지(목록/관리)는 동일한 조회 결과(공유 hook)를 사용한다.

## 5. 화면 구조

### 5.1 문항 목록 페이지 `/assessment/question-bank`

| 영역 | 목적 | 주요 데이터 | 주요 액션 |
| --- | --- | --- | --- |
| `PageTitle` | 페이지 식별 | 목표 제목 `TOPIK 쓰기 문항 목록` (현행 코드: `TOPIK 쓰기 문제 검수` — 제거 예정, 재정의 P3) | 없음 |
| 상단 요약 카드 | 조회 범위 파악 | 목표: 노출 상태(`service_status`)·태그 등 조회 축 건수 (현행 코드: 검수 상태(`reviewStatus`)별 건수 — 제거 예정, 재정의 P3) | 카드 클릭 필터 |
| 문제 번호 체크박스 그룹 | `51`, `52`, `53`, `54` 범위 전환 | 문제 번호 | 다중 선택 전환, 기본 전체 선택 |
| SearchBar | 공통 목록형 검색 조건 적용 | 검색어, 상세 검색 팝오버(주제 종합/세부 · 유형 · 난이도) | 즉시 필터, 상세 검색 적용 |
| 목록 테이블 | 수신 문항 비교·열람 | 문항 번호, 문항 ID, 주제(종합/세부), 상황 요약(hover 툴팁), 유형/난이도, 최근 수정. 목표 축으로 노출 상태·태그 컬럼을 추가한다 (현행 코드: 검수 상태 컬럼 노출 — 제거 예정, 재정의 P3) | 행 클릭으로 상세 진입 |

### 5.2 문항 상세 페이지 (현행 라우트 `/assessment/question-bank/review/:questionId` — 개명 예정)

| 영역 | 목적 | 주요 데이터 | 주요 액션 |
| --- | --- | --- | --- |
| `PageTitle` + 돌아가기 | 문항 문맥 식별 | 문제 번호, 목록 복귀 경로 (현행 코드 제목: `TOPIK {n}번 문항 검수` — 조회 명칭으로 교체 예정, 재정의 P3) | 목록 복귀 |
| 메타데이터 `Descriptions` | 공급 메타데이터 조회 전용 열람 | 공통 상단(문항 번호/ID/주제(종합/세부)/보조 주제/유형 · 급수·난이도/시나리오 유형/상황 요약/학습 목표/문항 본문) + 번호별 전용 row + 공통 꼬리(모범답안, `auto_checks_passed`, 추천 키) | 본문 열람(쓰기 없음) |
| 우측 `검수 메모` 카드 (현행 코드 사실 — 제거 예정, 재정의 P3) | (구 모델) 검수 판단 기록과 상태 변경 | 검수/진행/노출 상태 Tag, `content_team_memo` 입력, `검수 완료`/`사용 보류`/`검수 필요` 버튼 | 검수 개념 삭제로 카드 전체가 제거 대상. 노출 상태 Tag 등 조회성 정보는 상세 본문 표시로 흡수 예정 |

- 번호별 전용 row(조회 전용, 현행 화면 모델 기준):
  - `51`: 복원문(빈칸 채움), 빈칸 ㄱ/ㄴ 메타(역할/기능/정답 유형)와 대표·허용 정답
  - `52`: 복원문(빈칸 채움), 완성 단위/허용답안 범위, 연결 기능(ㄱ)/요구 표현 기능(ㄴ), ㄱ·ㄴ 단서 문장, 대표 정답, 채점 주의
  - `53`: 자료 유형/자료 주제, 차트 제목/단위, 비교 유형/변화/해석 난이도, 글자 수, 글 구성, 핵심 발견, 자료 수치(`source_data`), 채점 중점
  - `54`: 글쓰기 유형/쟁점, 관점 요구/추론 패턴, 문항 질문, 글자 수, 글 구성, 근거 키워드, 금지 요소, 채점 중점

## 6. 데이터 블록 정의

### 6.1 목록 공통 데이터

- `questionId`
- `questionNumber`
- `topicMain` / `topicDetail`
- `questionTypeName`
- `targetLevel` / `difficultyLevel`(1~6)
- `situationSummary` / `scenarioType`
- `serviceStatus`(노출 상태 — legacy 소스는 null이며 `미지정` 표시)
- `recommendationKeys`
- `updatedAt`
- (현행 코드 사실 — 제거 예정, 재정의 P3) `reviewStatus` / `reviewWorkflowStatus`가 화면 모델에 남아 있고 목록 `검수 상태` 컬럼에 표시된다. 컬럼 물리 제거는 재정의 P3 마이그레이션에서 수행한다.

### 6.2 검색/선택 데이터

- 공통 쿼리(목록/관리 두 페이지 공통)
  - `questionNo` 반복 파라미터
  - `topicMain` / `topicDetail` (17주제 2단 — 주제 마스터 기반)
  - `questionType`
  - `difficulty` (1~6 정수)
  - `keyword`
  - `tag` — P4 태그 필터 자리 확보용 예약 키(현재 미사용)
- 목록 페이지 전용
  - `reviewStatus` (현행 코드 사실 — 검수 개념 삭제로 제거 예정, 재정의 P3)
- 노출 상태 쿼리(`serviceStatus`)는 문항 관리 페이지 전용이며 이 페이지에서는 사용하지 않는다(`docs/specs/page-ia/assessment-question-manage-page-ia.md`).
- `tab` 쿼리 파라미터는 제거되었다. 각 라우트가 자체 URL 상태를 보존한다.

### 6.3 문항 상세 페이지 데이터

- 데이터 소스는 facade 스위치(`question-bank-data-source.ts`)가 결정한다:
  - `topik_writing` — 신규 스키마(`topik_writing_51/52/53/54_questions` + `question_source_map`, 주제 마스터·태그) 읽기. 컷오버 목표 경로.
  - `legacy`(현행 기본값) — v13 `problems` 읽기를 신규 화면 모델로 매핑하는 어댑터. 컷오버 후 롤백 경로로 P4 종료까지 보존.
  - `mock` — Supabase 미구성/`VITE_SUPABASE_DISABLED` 시 결정적 픽스처(D-12).
- 공통 메타데이터(수신값, 조회 전용)
  - 주제 축(`topic_main`/`topic_detail`, 보조 주제), 유형(`question_type_name`), 급수/난이도, 시나리오 유형, 상황 요약, 학습 목표, 문항 본문, 모범답안, 추천 키
  - `auto_checks_passed` — 수신·적재 자동 정합 검사 표식(존치)
  - `content_team_memo` — 수신 메타데이터(admin 쓰기 없음)
- Supabase source가 없는 값은 임의 생성하지 않고 화면에서 `-`, 빈 목록(empty state)으로 표시한다. JSON fixture fallback은 사용하지 않는다(`mock` 소스는 Supabase 미구성 시의 명시적 모크 모드이며 fallback이 아니다).
- (현행 코드 사실 — 제거 예정, 재정의 P3) 상세 화면 모델에 `review_status`/`review_workflow_status` 기반 표시와 검수 메모 쓰기 경로(`content_team_memo` 저장, legacy 소스에서는 영속 컬럼이 없어 화면 상태로만 유지)가 남아 있다.

## 7. 액션 정의

- 이 페이지(목록·상세)는 **조회 전용**이며 쓰기 액션을 정의하지 않는다.
- 쓰기 액션(태그 부여/제거, 노출 상태 전환)은 문항 관리 페이지(`docs/specs/page-ia/assessment-question-manage-page-ia.md`)에서 정의하고, `AssessmentQuestion + questionId` 감사 로그 계약(`service_status_changed`/`tag_assigned`/`tag_removed`)을 따른다(`docs/specs/admin-action-log.md`).
- 수신·적재 감사 액션 `question_received`는 외부 공급 API 연동 시 추가한다(수신 경로 미구현 — §12 오픈 이슈).
- (현행 코드 사실 — 제거 예정, 재정의 P3) 현행 상세 페이지에는 검수 액션 3종(`검수 완료`/`사용 보류`/`검수 필요`)과 메모 저장이 확인+사유 모달, 감사 로그 링크와 함께 구현되어 있다. 검수 감사 액션 4종(`review_completed`/`review_on_hold`/`review_revision_requested`/`review_memo_saved`)은 2026-06-11 §0으로 폐기됐으며, 검수 표면 제거와 함께 정리한다.

## 8. 상태값/운영 규칙

| 항목 | 계약 | 비고 |
| --- | --- | --- |
| 노출 상태(`service_status`) | `available`(노출 가능) / `excluded`(노출 제외) / `internal_test`(내부 테스트, 기본값) | 유일한 물리 노출 상태(D-6). 이 페이지는 표시만, 전환 조치는 문항 관리 페이지 책임. legacy 소스 행은 값이 없어 `미지정` 표시 |
| 태그 | `tag_master` 사전 기반 `question_tags` 활성 태그 | 문항 품질·상태 표현은 태그로만 한다. 부여/제거+사유 memo는 관리 페이지 책임(P4 개방) |
| `auto_checks_passed` | 수신·적재 자동 정합 검사 표식 | 존치 — 검수 개념과 무관한 적재 검증값 |
| `content_team_memo` | 수신 메타데이터 | admin 쓰기 없음. 현행 코드의 검수 메모 쓰기 경로는 제거 예정(재정의 P3) |
| 번호별 메타데이터 표시 | `51/52`, `53`, `54`는 서로 다른 전용 row 집합을 사용 | 상세 `Descriptions` profile로 분기 |
| 목록 상세 진입 방식 | 행 클릭 또는 `상황 요약` hover 툴팁의 진입 버튼으로 2depth 상세 진입 | 목록에서는 액션 컬럼과 Drawer를 두지 않음 |
| (현행 코드 사실 — 제거 예정, 재정의 P3) 검수 상태 | `검수 완료(approved)`/`검수 필요(needs_revision)`/`사용 보류(on_hold)` + 진행 상태 5값(`review_workflow_status`) | 2026-06-11 검수 개념 전면 삭제(D-2·편차 E1 철회). 표시·쓰기 모두 제거 대상, 컬럼 물리 제거는 재정의 P3 마이그레이션 |

## 8.1 수신·관리 운영정책 (POL-017 — 2026-06-11 재정의)

> 정책 SoT는 `docs/specs/admin-policy-source-map.md`의 `POL-017`("TOPIK 쓰기 문항 수신·관리 운영정책"으로 재정의)이며, 이 섹션은 문항 목록 페이지 관점 요약이다. 결정 원문은 `docs/architecture/metadata-tag-schema-transition-decision-record.md` §0.

- 운영 흐름은 `수신(외부 공급 API — 미개발) -> 적재(Supabase 신규 스키마 + question_source_map) -> 관리 포인트(태그) + 노출 통제(service_status) -> v13 read-only 소비`로 고정한다.
- **수신·적재**: 문항 본문+메타데이터는 외부(공급) API가 완성 상태로 공급하고 admin이 수신·적재한다. 외부 API는 미개발 상태로, 공급 계약은 요청 문서(`docs/requests/upstream-writing-endpoints-request-2026-06-10.md`, 2026-06-11 인바운드 기준 재작성 — D-11)로 추진한다. 인터림 동안 신규 공급은 없고 백필 466행(초기 코퍼스)만 존재한다.
- **이 페이지의 위치**: 흐름 중 "적재된 문항의 열람" 단계다. 수신된 문항·메타데이터를 조회 전용으로 확인한다.
- **관리 포인트 + 노출 통제**: 태그 부여/제거와 `service_status` 전환은 문항 관리 페이지(`/assessment/question-bank/manage`)가 담당한다(`docs/specs/page-ia/assessment-question-manage-page-ia.md`).
- **v13 소비**: v13 사용자 기능은 적재된 데이터를 read-only로 소비한다. 상류 서비스로의 배포(API 업로드/push) 단계는 존재하지 않는다 — 구 POL-017의 push 모델(`검수 -> 배포(업로드) -> 노출 통제`)과 구 §8.1 배포 정책은 2026-06-11 §0으로 폐기됐다.
- 노출 제외 기준은 `POL-018`을 따른다(검수 결합 기준 ① 삭제, 운영주의 태그 활성 시 `available` 전환 사유 필수 ②, 반복 노출 회피 과다 시 `excluded` 권고 ③ — 관리 페이지 IA §7.4 참조).

## 9. URL/상태 복원

### 문항 목록 페이지

- 유지 대상
  - `questionNo` 반복 파라미터
  - `topicMain` / `topicDetail`
  - `questionType`
  - `difficulty`
  - `keyword`
  - `reviewStatus` (현행 코드 사실 — 검수 개념 삭제로 제거 예정, 재정의 P3)
- `tag`는 P4 태그 필터 예약 키이며, `serviceStatus`는 문항 관리 페이지 전용이므로 이 페이지에서 복원하지 않는다. `tab` 파라미터는 제거되었다.
- `questionNo`가 없으면 `51~54` 전체 선택으로 해석하고, 부분 선택일 때만 반복 파라미터를 남긴다.

### 문항 상세 페이지

- 상세 페이지 URL은 목록 페이지 쿼리를 그대로 보존해 들어간다.
- `목록으로 돌아가기`는 현재 상세 페이지의 쿼리를 이용해 같은 목록 상태를 복원한다.

## 10. 네트워크 상태와 fail-safe

- pending: 문항 목록 또는 상세 대상을 불러오는 중임을 Alert로 표시한다.
- success: 현재 필터 결과를 렌더링한다.
- empty: 조건에 맞는 문항이 없음을 Empty 상태로 안내한다.
- error: 오류 메시지와 `다시 시도`를 제공하고, 가능한 경우 마지막 성공 목록을 유지한다.
- abort/retry: 화면 이탈 시 요청 취소, 조회 실패 시 수동 재시도를 적용한다.
- mock 모드: Supabase 미구성 시 "모크 모드로 동작 중" Alert를 노출하고 결정적 픽스처를 표시한다(실데이터·감사 로그 미기록).

## 11. 구현 메모

- 문항 목록 페이지 파일
  - `src/features/assessment/pages/assessment-question-bank-page.tsx`
- 2depth 문항 상세 페이지 파일
  - `src/features/assessment/pages/assessment-question-review-page.tsx` (검수 명칭 파일/라우트 — 재정의 P3에서 조회 전용 상세로 개명·재작성 예정)
- 문항 관리 페이지는 별도 라우트/파일로 분리되어 있다(`docs/specs/page-ia/assessment-question-manage-page-ia.md`).
- 모델/서비스
  - `src/features/assessment/model/assessment-question-bank-types.ts`
  - `src/features/assessment/model/assessment-question-bank-schema.ts`
  - `src/features/assessment/model/assessment-question-bank-presenter.ts`
  - `src/features/assessment/model/use-assessment-question-list.ts` / `use-assessment-question-filters.ts` / `use-question-bank-masters.ts`
  - `src/features/assessment/api/question-bank-data-source.ts` (P3 컷오버 스위치 — 기본 `legacy`)
  - `src/features/assessment/api/assessment-question-bank-service.ts` (facade)
  - `src/features/assessment/api/topik-writing-question-bank-service.ts` (신규 스키마)
  - `src/features/assessment/api/supabase-assessment-question-bank-service.ts` (legacy `problems` 어댑터)
  - `src/features/assessment/api/mock-question-bank-service.ts` (D-12 모크)

## 12. 오픈 이슈

- **외부 공급 API 미개발 — 수신 경로 미구현.** 문제 발원인 외부(공급) API가 아직 개발되지 않아 admin의 수신·적재 경로(및 `question_received` 감사 액션)는 미구현이다. 공급 계약은 요청 문서(`docs/requests/upstream-writing-endpoints-request-2026-06-10.md`, D-11 재정의)로 추진하며, 그동안 신규 공급 없이 백필 466행(초기 코퍼스)만 조회된다.
- 검수 표면 제거가 재정의 P3 구현 범위다: 페이지 제목·요약 카드(검수 상태 축)·목록 검수 상태 컬럼·`reviewStatus` 파라미터·상세 검수 메모 카드·검수 액션 3종·검수 라우트 명칭(`/review/:questionId`) 전부(실행계획안 2026-06-11 개정 — `docs/메타데이터-태그-스키마-전환-실행계획안.md`). 검수 컬럼 물리 제거는 같은 재정의 P3 마이그레이션이다.
- 데이터 소스 스위치 기본값은 `legacy`다. `topik_writing` 플립(컷오버)은 P2 PASS 전환 후 수행하며, 그 전까지 legacy 행은 `service_status` 소스가 없어 노출 상태가 `미지정`으로 표시된다.
- 목록의 목표 축(노출 상태·태그 컬럼/요약 카드) 구체 설계는 재정의 P3 구현에서 확정한다. `tag` 필터 활성화는 P4 범위다.
- v13 사용자 기능의 신규 스키마 소비 경로 전환(현재 v13은 `problems`를 읽음)은 별도 트랙이며, EPS TOPIK / 레벨 테스트 편성 화면의 문항 소비 계약도 여전히 별도 후속 문서가 필요하다.
- Supabase 미설정 시 JSON fallback 대신 명시적 mock 모드, 조회 실패 시 error/retry 상태를 노출한다.
