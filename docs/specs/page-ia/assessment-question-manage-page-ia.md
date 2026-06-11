# Assessment > TOPIK 쓰기 문항 관리 상세 IA

## 1. 문서 목적

- `Assessment > TOPIK 쓰기 문항 관리`의 목록 운영 구조를 하나의 SoT로 고정한다.
- 2026-06-11 인바운드 모델 전환(`docs/architecture/metadata-tag-schema-transition-decision-record.md` §0)에 따라 이 페이지는 **admin의 핵심 관리 surface**다: 외부(공급) API가 완성 상태로 공급해 적재된 문항에 대해 admin이 가진 두 가지 통제 수단 — ① **관리 포인트 = 태그**(`tag_master` 사전 기반 `question_tags` 부여/제거 + 사유 memo) ② **노출 통제 = `service_status`**(D-6: `available`/`excluded`/`internal_test`, 기본 `internal_test`) — 를 실행하는 화면이다.
- 운영 기본 흐름은 `검색 -> 비교 -> 관리 조치(태그/노출) -> 감사 로그 확인`이다. 조치 write는 **P4 관리 포인트 개방(2026-06-11)으로 활성화됐다** — 노출 상태 전환 + 태그 부여/제거(태그 편집 모달), 전 조치 사유 필수·RPC 단일 경로.
- 문항·메타데이터 열람은 문항 목록 페이지 `/assessment/question-bank`(조회 전용) 소관이며, 검수 개념(검수 큐/검수 메모/검수 상태 변경)은 2026-06-11 §0으로 admin 전체에서 삭제됐다.
- `51~54번` 문제 유형 차이를 반영하면서도 검색 파라미터, 감사 로그 역추적, URL 복원 계약을 문항 목록 페이지와 일관되게 유지한다.

## 2. 문서 메타

| 항목 | 내용 |
| --- | --- |
| 모듈 | Assessment |
| 페이지명 | TOPIK 쓰기 문항 관리 |
| 현재 상태 | 구현됨 — 조회 + 관리 조치 활성(P4 관리 포인트 개방, 2026-06-11: 노출 상태 전환 + 태그 부여/제거. `OPERATION_WRITE_ENABLED`/`SERVICE_STATUS_WRITE_ENABLED` 게이트 제거). 데이터 소스는 facade 스위치(**`topik_writing` 기본** — 재정의 P3 컷오버 완료 / `legacy` 롤백(env, 조치 불가) / `mock`) |
| 페이지 유형 | 목록 운영형 |
| 라우트 | `/assessment/question-bank/manage` |
| 주요 권한 | `assessment.question-bank.manage` |
| 주요 role | `SUPER_ADMIN`, `CONTENT_MANAGER` |
| 연관 문서 | `docs/specs/page-ia/assessment-question-bank-page-ia.md`, `docs/specs/admin-page-tables.md`, `docs/specs/admin-data-contract.md`, `docs/specs/admin-action-log.md`, `docs/architecture/admin-data-source-transition.md`, `docs/specs/admin-page-gap-register.md`, `docs/specs/admin-policy-source-map.md`, `docs/specs/admin-data-usage-map.md`, `docs/architecture/metadata-tag-schema-transition-decision-record.md`, `docs/metadata-tag-schema-rule.md` |

## 3. 페이지 목표와 비목표

### 목표

- 수신·적재된 TOPIK 쓰기 `51~54번` 문항을 문제 번호 단위로 운영 관점에서 비교하고, admin의 관리 포인트를 실행한다.
- **태그 부여/제거(관리 포인트)**: `docs/metadata-tag-schema-rule.md` §2의 `tag_master` 사전(추천목적/반복방지/학습흐름/운영주의/대표문제/추천사용)을 기반으로 `question_tags`를 부여/제거하고 사유를 memo로 남긴다. 문항 품질·상태 표현은 태그로만 한다. (P4 개방 완료 — 행별 `태그 편집` 모달: 활성 태그 목록+제거, 사전 기반 부여, 사유 memo 필수)
- **노출 통제(`service_status`)**: 사용자에게 보여지는 부분의 통제 책임을 이 페이지가 가진다. `available`(노출 가능)/`excluded`(노출 제외)/`internal_test`(내부 테스트, 기본값) 전환으로 v13 read-only 소비의 노출 여부를 결정한다.
- 노출 상태별 건수와 태그 부여 현황을 한 화면에서 비교한다.
- 관리 조치는 `AssessmentQuestion + questionId` 감사 로그 계약(`service_status_changed`/`tag_assigned`/`tag_removed` — D-8 개정)으로 추적한다.

### 비목표

- 검수하지 않는다. 검수 큐/검수 메모/검수 상태 변경은 2026-06-11 검수 개념 전면 삭제로 admin에 존재하지 않는다(구 검수 상태 잔존 표시는 재정의 P3에서 제거 완료 — §6.2, `202f905`).
- 이 화면에서 문항을 수동 생성·저작·분류하지 않는다(문항 본문·메타데이터는 외부에서 완성 상태로 공급).
- 수신·적재 실행은 이 화면 책임이 아니다(외부 공급 API 연동 트랙 — 미개발, §11 오픈 이슈).
- 상류 서비스로의 배포(API 업로드/push)는 폐기된 개념이다(2026-06-11 §0 — 구 §7.4 배포 정책 폐기, 아래 §7.4로 대체).
- EPS TOPIK, 레벨 테스트 세트 편성을 이 화면 책임으로 가져오지 않는다.
- JSON 업로드, JSON fallback 조회, 배치 재생성, 대량 일괄 운영 액션은 포함하지 않는다.

## 4. 운영자 사용 시나리오

- 시나리오 1: 운영자가 상단 요약 카드에서 노출 상태(`serviceStatus`)별 건수(`전체 문항`/`노출 가능`/`노출 제외`/`내부 테스트`)를 확인하고, 카드 클릭으로 노출 상태 기준 필터를 좁힌다.
- 시나리오 2: 운영자가 문제 번호(`51`, `52`, `53`, `54`) 다중 선택과 SearchBar 상세 검색(주제 종합/세부 · 유형 · 난이도)으로 비교 대상을 좁힌다.
- 시나리오 3: 운영자가 목록 테이블에서 `노출 상태`와 `태그`(활성 태그 수)를 나란히 비교해 조치 대상을 식별한다.
- 시나리오 4: 운영자가 운영 조치(`노출 가능`/`노출 제외`/`내부 테스트`)를 실행하면 확인+사유(필수) 모달을 거쳐 RPC(`admin_update_topik_question`)로 반영되고 `AssessmentQuestion + questionId` 감사 로그(`service_status_changed`)가 남는다. 현재 노출 상태와 같은 전환 버튼은 비활성이다. `available` 전환 시 운영주의 태그 활성 문항이면 모달에 POL-018 ② 경고가, 반복방지 태그 활성 과다면 ③ `excluded` 권고가 표시된다.
- 시나리오 5: 운영자가 행별 `태그 편집` 모달에서 활성 태그를 확인하고, `tag_master` 사전에서 태그를 골라 사유 memo(필수)와 함께 부여하거나, 활성 태그를 사유 입력(ConfirmAction)과 함께 제거한다(`tag_assigned`/`tag_removed` 감사 기록).
- 시나리오 6: 조치 후 운영자는 성공 피드백에 포함된 `감사 로그 확인` 링크로 이동해 동일 문항의 운영 이력을 검증한다.

## 5. 화면 구조

### 5.1 문항 관리 페이지 `/assessment/question-bank/manage`

| 영역 | 목적 | 주요 데이터 | 주요 액션 |
| --- | --- | --- | --- |
| `PageTitle` | 페이지 식별 | 페이지 제목 `TOPIK 쓰기 문항 관리` | 없음 |
| 상단 요약 카드 | 노출 상태 범위 파악 | `전체 문항`(필터 해제) + `노출 가능`/`노출 제외`/`내부 테스트` 건수 | 카드 클릭 필터 |
| 공유 toolbar - 문제 번호 체크박스 그룹 | `51`, `52`, `53`, `54` 범위 전환 | 문제 번호 | 다중 선택 전환, 기본 전체 선택 |
| 공유 toolbar - SearchBar | 공통 목록형 검색 조건 적용 | 검색어, 상세 검색 팝오버(주제 종합/세부 · 유형 · 난이도) | 즉시 필터, 상세 검색 적용 |
| 목록 테이블 | 노출 상태/태그 비교와 조치 | 문항 번호, 문항 ID, 주제(종합/세부), 유형/난이도, 노출 상태, 태그(수 + `태그 편집` 버튼), 운영 조치, 최근 수정 (구 `검수 상태` 컬럼은 재정의 P3에서 제거 완료. 구 "준비 중" 경고 Alert는 P4 개방으로 제거) | `운영 조치` 3종(현재 상태 버튼만 disabled), `태그 편집` 모달 |

## 6. 데이터 블록 정의

### 6.1 목록 공통 데이터

- `questionId`
- `questionNumber`
- `topicMain` / `topicDetail`
- `questionTypeName`
- `targetLevel` / `difficultyLevel`(1~6)
- `serviceStatus` (legacy 소스 행은 null — `미지정` 표시)
- 활성 태그 수 (`question_tags` 집계 — `topik_writing` 소스 전용, legacy 소스는 빈 값)
- `updatedAt`

### 6.2 목록 테이블 컬럼

| 컬럼 | 의미 | source/표시 |
| --- | --- | --- |
| 문항 번호 | 문제 번호(`51~54`) | 화면 모델 `questionNumber` |
| 문항 ID | 문항 식별자 | `questionId` (신규 스키마 채번 `topik-writing-{번호}-{연번}` — D-4. legacy 소스는 `problems.id`) |
| 주제(종합/세부) | 주제 축 2단 | `topic_main` / `topic_detail` |
| 유형/난이도 | 유형 명칭 + 급수·난이도 | `question_type_name`, `targetLevel`/`difficultyLevel` |
| (제거 완료 — 재정의 P3, `202f905`) 검수 상태 | 구 모델의 검수 진척 표시 | `review_status` 기반 컬럼 표시는 제거 완료. 물리 컬럼 제거도 마이그레이션 `0013`으로 완료(2026-06-11 적용) |
| 노출 상태 | `available`/`excluded`/`internal_test` | `service_status`. legacy 소스는 물리 컬럼이 없어 `미지정` 표시 |
| 태그 | 활성 태그 수 + 편집 진입 | `question_tags` 활성 행 집계(`N개`, 없으면 `-`) + `태그 편집` 모달 버튼(P4 개방 — §7.3) |
| 운영 조치 | `노출 가능`/`노출 제외`/`내부 테스트` 전환 액션 | 활성(P4 개방) — 현재 노출 상태와 같은 전환 버튼만 disabled (§7.3) |
| 최근 수정 | 최종 수정 시각 | `updatedAt` |

### 6.3 검색/선택 데이터

- 공통 쿼리
  - `questionNo` 반복 파라미터
  - `topicMain` / `topicDetail`
  - `questionType`
  - `difficulty`
  - `keyword`
- 문항 관리 전용
  - `serviceStatus`
- `tag`는 P4 태그 필터 자리 확보용 예약 키(현재 미사용)이며, `tab` 쿼리 파라미터는 사용하지 않는다.

## 7. 관리 조치/상태 규칙

### 7.1 노출 상태 값 (`service_status` — D-6)

| 노출 상태 | 의미 |
| --- | --- |
| `internal_test`(내부 테스트) | 기본값. 사용자 노출 차단 — 백필(초기 코퍼스) 466행 전부 이 상태로 적재됨 |
| `available`(노출 가능) | v13 read-only 소비에 노출 가능 |
| `excluded`(노출 제외) | 사용자 노출에서 제외 |
| `미지정` | legacy 소스 행처럼 `service_status` 물리 컬럼 자체가 없는 경우의 표시 라벨 |

- `service_status` 컬럼이 **유일한 물리 노출 상태**다. '서비스_노출상태' 태그 그룹은 시드에서 제외하고 태그 RPC에서 부여를 차단한다(이중 기록 방지). '운영 제외'는 `excluded` + 운영주의 태그 값 '운영 제외' 부여로 구분한다.

### 7.2 관리 조치 액션

| 액션 | 감사 액션 코드 | 대상 식별 기준 | 확인/사유 | 성공 후 피드백 | 감사 로그 확인 경로 |
| --- | --- | --- | --- | --- | --- |
| 노출 가능 전환 | `service_status_changed` | `AssessmentQuestion + questionId` | 확인 + 사유 필수 | 대상 식별 정보와 감사 로그 링크 노출 | `/system/audit-logs?targetType=AssessmentQuestion&targetId={questionId}` |
| 노출 제외 전환 | `service_status_changed` | `AssessmentQuestion + questionId` | 확인 + 사유 필수 | 대상 식별 정보와 감사 로그 링크 노출 | 동일 |
| 내부 테스트 전환 | `service_status_changed` | `AssessmentQuestion + questionId` | 확인 + 사유 필수 | 대상 식별 정보와 감사 로그 링크 노출 | 동일 |
| 태그 부여 | `tag_assigned` | `AssessmentQuestion + questionId` | 사유 memo 필수(`question_tags.memo`) — 태그 편집 모달, 사전 미선택/사유 공백 시 비활성 | 대상 식별 정보와 감사 로그 링크 노출 | 동일 |
| 태그 제거 | `tag_removed` | `AssessmentQuestion + questionId` | 확인(ConfirmAction) + 사유 memo 필수 — 이력 보존형(`is_active=false`+`removed_at`) | 대상 식별 정보와 감사 로그 링크 노출 | 동일 |

> 검수 감사 액션 4종과 배포 `question_published`는 2026-06-11 §0(D-8 개정)으로 폐기됐다. 수신 감사 액션 `question_received`는 외부 공급 API 연동 시 추가한다(`docs/specs/admin-action-log.md`).

### 7.3 조치 활성 규칙 (P4 관리 포인트 개방 — 2026-06-11)

- 조치 버튼(노출 가능/노출 제외/내부 테스트)은 활성이다 — `OPERATION_WRITE_ENABLED`/`SERVICE_STATUS_WRITE_ENABLED` 게이트와 "준비 중" 경고 Alert는 P4에서 제거됐다. 현재 노출 상태와 같은 전환 버튼만 비활성(무의미 전환 차단)이다.
- 모든 write는 RPC 단일 경로다: 노출 상태 = `admin_update_topik_question`(화이트리스트 `service_status` 단일, `__note` → `payload.note`), 태그 = `admin_assign_question_tag`/`admin_remove_question_tag`(사유 → `question_tags.memo` + `payload.tag_memo`). 직접 테이블 write는 RLS로 전면 차단된다(P4-4 네거티브 검증).
- 태그 편집 모달: 활성 태그 목록(+부여 사유 memo 표시)과 제거 버튼, `tag_master` 활성 사전 기반 부여 폼(그룹별 옵션·검색, 이미 활성인 태그는 비활성 옵션, 선택 태그의 description/usage_rule 안내 표시). 부여는 태그+사유 입력 전까지 비활성, 제거는 ConfirmAction(사유 필수)을 거친다. '서비스_노출상태' 그룹은 facade 옵션 필터 + RPC 가드로 이중 차단된다(D-6).
- **POL-018 화면 가드**: ② `available` 전환 확인 모달에서 대상 문항의 운영주의 그룹 활성 태그를 검사해 태그명을 명시한 경고를 표시한다(사유는 항상 필수). ③ 반복방지 그룹 활성 태그가 임계(2개) 이상이면 `available` 전환 모달과 태그 편집 모달에 `excluded` 권고를 표시한다.
- legacy 롤백 소스에서는 조치가 동작하지 않는다(facade가 명시 오류 — 구 스키마에 물리 노출 상태·태그 없음). mock 소스는 인메모리 왕복으로만 동작한다(감사 미기록, D-12).

### 7.4 수신·관리 운영정책 (POL-017 — 2026-06-11 재정의) + 노출 제외 기준 (POL-018)

> 정책 SoT는 `docs/specs/admin-policy-source-map.md`의 `POL-017`("TOPIK 쓰기 문항 수신·관리 운영정책"으로 재정의)·`POL-018`이다. 종전 §7.4 "검수·배포·노출 운영정책"(push 모델: `검수 -> 배포(API 업로드) -> 노출 통제`)은 2026-06-11 §0으로 폐기됐고, 본 섹션이 대체한다. 결정 원문은 `docs/architecture/metadata-tag-schema-transition-decision-record.md` §0.

- 운영 흐름은 `수신(외부 공급 API — 미개발) -> 적재(Supabase topik_writing_51/52/53/54_questions + question_source_map) -> 관리 포인트(태그) + 노출 통제(service_status) -> v13 read-only 소비`다. 이 페이지는 **관리 포인트 + 노출 통제** 단계를 담당한다.
- 상류 배포(API 업로드/push) 단계는 존재하지 않는다. 사용자 노출 여부는 별도 업로드 없이 `service_status` 값 하나로 결정되고, v13 사용자 기능이 적재 데이터를 read-only로 소비한다.
- **노출 제외 기준(POL-018, 2026-06-11 개정)**:
  - ① (삭제) ~~검수 미완료 문항의 `available` 전환 불가~~ — 검수 개념 삭제로 철회.
  - ② 운영주의 태그(`표현 주의`/`난이도 애매` 등) 활성 문항의 `available` 전환은 사유 필수 — P4 화면 가드 구현(활성 태그 검사 + 모달 경고, §7.3).
  - ③ 반복 노출 회피 대상(반복방지 태그 활성 과다 — 임계 2개)은 `excluded` 권고 — P4 화면 가드 구현(전환 모달·태그 편집 모달 권고 표시, §7.3).
  - 각 기준은 `tag_master.usage_rule`과 POL-018에 기록한다.

## 8. URL/상태 복원

- 유지 대상
  - `questionNo` 반복 파라미터
  - `topicMain` / `topicDetail`
  - `questionType`
  - `difficulty`
  - `keyword`
  - `serviceStatus`
- `tag`는 P4 태그 필터 예약 키, `tab` 파라미터는 사용하지 않으며, 이 라우트가 자체 URL 상태를 보존한다.
- `questionNo`가 없으면 `51~54` 전체 선택으로 해석하고, 부분 선택일 때만 반복 파라미터를 남긴다.

## 9. 네트워크 상태와 fail-safe

- pending: 문항 목록을 불러오는 중임을 Alert로 표시한다.
- success: 현재 필터 결과를 렌더링한다.
- empty: 조건에 맞는 문항이 없음을 Empty 상태로 안내한다.
- error: 오류 메시지와 `다시 시도`를 제공하고, 가능한 경우 마지막 성공 목록을 유지한다.
- abort/retry: 화면 이탈 시 요청 취소, 조회 실패 시 수동 재시도, (조치 활성화 후) 조치 버튼 중복 제출 방지를 적용한다.
- mock 모드: Supabase 미구성 시 "모크 모드로 동작 중" Alert를 노출하고 결정적 픽스처를 표시한다(실데이터·감사 로그 미기록).

## 10. 구현 메모

- 문항 관리 페이지 파일
  - `src/features/assessment/pages/assessment-question-manage-page.tsx`
- 공유 모델/조회 (문항 목록 페이지와 동일 조회 결과 공유)
  - `src/features/assessment/model/use-assessment-question-list.ts`
  - `src/features/assessment/model/use-assessment-question-filters.ts`
  - `src/features/assessment/model/use-question-bank-masters.ts` (주제 마스터 + 태그 사전 + 활성 태그 일괄 조회/재조회)
- 공유 toolbar / 태그 편집
  - `src/features/assessment/ui/assessment-question-bank-toolbar.tsx`
  - `src/features/assessment/ui/question-tag-edit-modal.tsx` (P4 태그 부여/제거 모달)
- 데이터 source
  - facade(`src/features/assessment/api/assessment-question-bank-service.ts`) + 컷오버 스위치(`question-bank-data-source.ts`, 기본 `topik_writing` — 재정의 P3 컷오버 완료, 롤백 env `VITE_QUESTION_BANK_SOURCE=legacy`). `topik_writing` 소스는 신규 스키마(노출 상태·태그 실값), `legacy` 소스는 v13 `problems` 읽기 전용 어댑터(노출 상태 `미지정`·태그 빈 값), `mock`은 D-12 결정적 픽스처. 문항 목록 페이지 `/assessment/question-bank`와 동일한 조회 결과를 공유한다.

## 11. 오픈 이슈

- **외부 공급 API 미개발 — 수신 경로 미구현.** 이 페이지가 관리할 신규 문항의 공급원이 아직 없어, 인터림 동안 관리 대상은 백필 466행(초기 코퍼스)뿐이다. 공급 계약은 요청 문서(`docs/requests/upstream-writing-endpoints-request-2026-06-10.md`, D-11 재정의)로 추진하며, 수신 감사 액션 `question_received`도 연동 시 추가한다.
- (해소 — P4 관리 포인트 개방, 2026-06-11) 노출 상태 write와 태그 편집 UI 활성화 완료: `OPERATION_WRITE_ENABLED`/`SERVICE_STATUS_WRITE_ENABLED` 게이트 제거 + facade 태그 write 함수(`assignQuestionTagSafe`/`removeQuestionTagSafe`) 신설. RT-4 관리 쓰기 왕복·RLS 네거티브 증적은 `logs/metadata-tag-schema-transition-evidence.md` P4 절.
- 데이터 소스 스위치 기본값은 `topik_writing`이다(재정의 P3 컷오버 완료 — `202f905`). 롤백(env `VITE_QUESTION_BANK_SOURCE=legacy`) 시 노출 상태는 `미지정`, 태그는 빈 값으로 표시된다. 참고(실측 2026-06-10): legacy 경로에 연결됐던 구 `admin_update_problem` RPC는 v13 admin island 제거(2026-06-09)로 라이브 DB에 존재하지 않아, legacy 운영 write는 물리적으로 동작 불가다(어댑터도 읽기 전용으로 봉인됨).
- 구 `검수 상태` 컬럼 잔존(§6.2)과 확인 모달의 구 POL-018 기준 ① 문구(§7.3)는 재정의 P3에서 제거·정리 완료됐다(`202f905`). 검수 4컬럼 물리 제거도 마이그레이션 `0013`으로 완료됐다(2026-06-11 적용).
- (해소 — P4, 2026-06-11) POL-018 기준 ②·③ 화면 강제 구현 완료: `available` 전환 모달이 대상 문항의 운영주의 활성 태그를 검사해 경고하고(②), 반복방지 활성 태그 임계(2개) 이상이면 `excluded` 권고를 표시한다(③ — 태그 편집 모달에도 동일 권고). §7.3 참조.
- Supabase 미설정 시 JSON fallback 대신 명시적 mock 모드, 조회 실패 시 error/retry 상태를 노출한다.
