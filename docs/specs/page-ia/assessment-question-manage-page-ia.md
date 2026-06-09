# Assessment > TOPIK 쓰기 문항 관리 상세 IA

## 1. 문서 목적

- `Assessment > TOPIK 쓰기 문항 관리`의 목록 운영 구조를 하나의 SoT로 고정한다.
- 운영 기본 흐름 `검색 -> 비교 -> 운영 조치 -> 감사 로그 확인`을 유지하되, 운영 상태(노출/숨김/운영 제외)와 사용 현황을 비교·관리하는 목록 운영 화면으로 한정한다.
- 검수 워크플로우는 별도 검수 페이지 `/assessment/question-bank` 소관이며, 이 페이지는 검수 큐/검수 메모/검수 상태 변경 책임을 가지지 않는다.
- `51~54번` 문제 유형 차이를 반영하면서도 검색 파라미터, 감사 로그 역추적, URL 복원 계약을 검수 페이지와 일관되게 유지한다.

## 2. 문서 메타

| 항목 | 내용 |
| --- | --- |
| 모듈 | Assessment |
| 페이지명 | TOPIK 쓰기 문항 관리 |
| 현재 상태 | 구현됨 (Supabase `problems` 조회 기반, JSON fixture/store fallback 없음) / 운영 조치 write는 준비 중 |
| 페이지 유형 | 목록 운영형 |
| 라우트 | `/assessment/question-bank/manage` |
| 주요 권한 | `assessment.question-bank.manage` |
| 주요 role | `SUPER_ADMIN`, `CONTENT_MANAGER` |
| 연관 문서 | `docs/specs/page-ia/assessment-question-bank-page-ia.md`, `docs/specs/admin-page-tables.md`, `docs/specs/admin-data-contract.md`, `docs/architecture/admin-data-source-transition.md`, `docs/specs/admin-page-gap-register.md` |

## 3. 페이지 목표와 비목표

### 목표

- AI 배치가 생성한 TOPIK 쓰기 `51~54번` 문항을 문제 번호 단위로 운영 관점에서 비교한다.
- 운영 상태(노출 후보/숨김 후보/운영 제외)와 사용 현황을 한 화면에서 비교·관리한다.
- 검수 상태는 읽기 전용 컬럼으로 함께 노출하여 검수 진척과 운영 상태를 대조한다.
- 운영 상태 변경은 `AssessmentQuestion + questionId` 감사 로그 계약으로 추적한다.

### 비목표

- 검수 큐, 검수 메모, 검수 상태 변경(`검수 완료`/`수정 필요`/`보류`)은 이 화면 책임이 아니며 검수 페이지 `/assessment/question-bank` 소관이다.
- 이 화면에서 직접 문항을 수동 생성하지 않는다.
- EPS TOPIK, 레벨 테스트 세트 편성을 이 화면 책임으로 가져오지 않는다.
- JSON 업로드, JSON fallback 조회, 배치 재생성, 대량 일괄 운영 액션은 포함하지 않는다.

## 4. 운영자 사용 시나리오

- 시나리오 1: 운영자가 상단 요약 카드에서 `operationStatus`별 건수를 확인하고, 카드 클릭으로 운영 상태 기준 필터를 좁힌다.
- 시나리오 2: 운영자가 문제 번호(`51`, `52`, `53`, `54`) 다중 선택과 SearchBar 상세 검색(도메인/유형/난이도)으로 비교 대상을 좁힌다.
- 시나리오 3: 운영자가 목록 테이블에서 `검수 상태`(읽기 전용)와 `운영 상태`, `사용 현황`을 나란히 비교한다.
- 시나리오 4: 운영자가 `운영 조치`(노출 후보/숨김 후보/운영 제외)를 실행하려 하면 확인+사유 모달을 거쳐 `AssessmentQuestion + questionId` 감사 로그로 기록되도록 설계되어 있으나, 현재는 v13 `lifecycle_status` 미적용으로 운영 조치 버튼이 비활성(준비 중)이다.
- 시나리오 5: 운영 조치가 활성화된 이후 운영자는 성공 피드백에 포함된 `감사 로그 확인` 링크로 이동해 동일 문항의 운영 이력을 검증한다.

## 5. 화면 구조

### 5.1 문항 관리 페이지 `/assessment/question-bank/manage`

| 영역 | 목적 | 주요 데이터 | 주요 액션 |
| --- | --- | --- | --- |
| `PageTitle` | 페이지 식별 | 페이지 제목/설명 (`TOPIK 쓰기 문항 관리`) | 없음 |
| 상단 요약 카드 | 운영 상태 범위 파악 | `전체 문항`(필터 해제) + `노출 후보`/`숨김 후보`/`운영 제외` 건수 | 카드 클릭 필터 |
| 공유 toolbar - 문제 번호 체크박스 그룹 | `51`, `52`, `53`, `54` 범위 전환 | 문제 번호 | 다중 선택 전환, 기본 전체 선택 |
| 공유 toolbar - SearchBar | 공통 목록형 검색 조건 적용 | `전체` 선택기, 검색어, 상세 검색 팝오버(도메인/유형/난이도) | 즉시 필터, 상세 검색 적용 |
| 준비 중 경고 Alert | 운영 조치 비활성 상태 안내 (목록 카드 본문 상단, 목록 테이블 직전) | "운영 상태 관리는 준비 중입니다" 경고 | 없음 |
| 목록 테이블 | 운영 상태/사용 현황 비교 | 문항 번호, 문항 ID, 주제, 검수 상태, 운영 상태, 사용 현황, 운영 조치, 최근 수정 | `운영 조치`(현재 disabled) |

## 6. 데이터 블록 정의

### 6.1 목록 공통 데이터

- `questionId`
- `questionNumber`
- `topic`
- `domain`
- `questionTypeLabel`
- `difficultyLevel`
- `reviewStatus`
- `operationStatus`
- `usageSummary`
- `updatedAt`
- `updatedBy`
- 현재 목록 셀에서는 Supabase `problems.title`과 `topic_category_code` 라벨을 노출하고, `검수 상태`는 읽기 전용으로 함께 표시한다.

### 6.2 목록 테이블 컬럼

| 컬럼 | 의미 | source/표시 |
| --- | --- | --- |
| 문항 번호 | 문제 번호(`51~54`) | `problems.question_no` |
| 문항 ID | 문항 식별자 | `problems.id` |
| 주제 | 문항 주제 | `problems.title` |
| 검수 상태 | 검수 진척(읽기 전용) | `problems.review_status` / `review_workflow_status` |
| 운영 상태 | 노출/숨김/운영 제외 단계 | 현재 전부 `미지정` sentinel (v13 `lifecycle_status` 미적용) |
| 사용 현황 | 운영 활용 상태 + 운영 메모 | `사용 N회 / 시험 연결 N건` 형식과 `managementNote`(`problems.explanation`). 현재 usage/연결 count source가 없어 `사용 0회 / 시험 연결 0건`으로 표시 |
| 운영 조치 | 노출 후보/숨김 후보/운영 제외 액션 | 현재 disabled (준비 중) |
| 최근 수정 | 최종 수정 시각 | `problems.updated_at` |

### 6.3 검색/선택 데이터

- 공통 쿼리
  - `questionNo` 반복 파라미터
  - `domain`
  - `questionType`
  - `difficulty`
  - `keyword`
- 문항 관리 전용
  - `operationStatus`
- `tab` 쿼리 파라미터는 사용하지 않는다.

## 7. 운영 조치/상태 규칙

### 7.1 운영 상태 값

| 운영 상태 | 의미 |
| --- | --- |
| `미지정` | 운영 단계가 지정되지 않은 기본값 (현재 모든 문항의 sentinel) |
| `노출 후보` | 노출 후보로 분류된 단계 |
| `숨김 후보` | 숨김 후보로 분류된 단계 |
| `운영 제외` | 운영에서 제외된 단계 |

### 7.2 운영 조치 액션

| 액션 | 대상 식별 기준 | 확인/사유 | 성공 후 피드백 | 감사 로그 확인 경로 |
| --- | --- | --- | --- | --- |
| 노출 후보 | `AssessmentQuestion + questionId` | 확인 + 사유 필수 | 대상 식별 정보와 감사 로그 링크 노출 | `/system/audit-logs?targetType=AssessmentQuestion&targetId={questionId}` |
| 숨김 후보 | `AssessmentQuestion + questionId` | 확인 + 사유 필수 | 대상 식별 정보와 감사 로그 링크 노출 | 동일 |
| 운영 제외 | `AssessmentQuestion + questionId` | 확인 + 사유 필수 | 대상 식별 정보와 감사 로그 링크 노출 | 동일 |

### 7.3 현재 비활성(준비 중) 규칙

- 현재 v13 `lifecycle_status`가 적용되기 전이므로 `operationStatus`는 모든 문항에서 `미지정` sentinel로 표시된다.
- 운영 조치 버튼(노출 후보/숨김 후보/운영 제외)은 전부 disabled이며, 페이지 상단에 "운영 상태 관리는 준비 중입니다" 경고 Alert를 노출한다.
- 확인+사유 -> 감사 로그(`ConfirmAction` + `AuditLogLink`) 흐름은 코드에 미리 연결되어 있으나, 감사 RPC(`admin_update_problem`) write path는 데이터 계약상 비활성이다.
- `lifecycle_status` 도착 시 `OPERATION_WRITE_ENABLED` 플래그 활성화 및 서비스 un-stub로 운영 조치를 한 번에 활성화한다. 즉 운영 상태 변경은 "후속 활성화" 상태이지 지금 동작하지 않는다.

## 8. URL/상태 복원

- 유지 대상
  - `questionNo` 반복 파라미터
  - `domain`
  - `questionType`
  - `difficulty`
  - `keyword`
  - `operationStatus`
- `tab` 파라미터는 사용하지 않으며, 이 라우트가 자체 URL 상태를 보존한다.
- `questionNo`가 없으면 `51~54` 전체 선택으로 해석하고, 부분 선택일 때만 반복 파라미터를 남긴다.

## 9. 네트워크 상태와 fail-safe

- pending: 문항 목록을 불러오는 중임을 Alert로 표시한다.
- success: 현재 필터 결과를 렌더링한다.
- empty: 조건에 맞는 문항이 없음을 Empty 상태로 안내한다.
- error: 오류 메시지와 `다시 시도`를 제공하고, 가능한 경우 마지막 성공 목록을 유지한다.
- abort/retry: 화면 이탈 시 요청 취소, 조회 실패 시 수동 재시도, (운영 조치 활성화 후) 조치 버튼 중복 제출 방지를 적용한다.

## 10. 구현 메모

- 문항 관리 페이지 파일
  - `src/features/assessment/pages/assessment-question-manage-page.tsx`
- 공유 모델/조회 (검수 페이지와 동일 조회 결과 공유)
  - `src/features/assessment/model/use-assessment-question-list.ts`
  - `src/features/assessment/model/use-assessment-question-filters.ts`
- 공유 toolbar
  - `src/features/assessment/ui/assessment-question-bank-toolbar.tsx`
- 데이터 source
  - Supabase `problems`(question_no 51-54) 조회 기반, JSON/store fallback 없음. 검수 페이지 `/assessment/question-bank`와 동일한 조회 결과를 공유한다.

## 11. 오픈 이슈

- v13 `lifecycle_status` 적용 후 `OPERATION_WRITE_ENABLED` 플래그와 서비스 un-stub로 운영 조치(노출 후보/숨김 후보/운영 제외)를 활성화해야 한다.
- 운영 조치 활성화 전까지 `operationStatus`는 `미지정` sentinel로 고정되고 `admin_update_problem` write path는 비활성이다.
- 최종 공개/숨김 정책과 승인 체계는 아직 확정되지 않았다.
- 사용 현황 컬럼의 정식 source 계약은 후속 데이터 적용 시 확정해야 한다.
- Supabase 미설정/조회 실패 시 JSON fallback을 제공하지 않고 error/retry 상태를 노출한다.
