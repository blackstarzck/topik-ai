# Assessment > TOPIK 쓰기 문제은행 상세 IA

## 1. 문서 목적

- `Assessment > TOPIK 쓰기 문제은행`의 목록 운영 구조와 2depth 검수 페이지 구조를 하나의 SoT로 고정합니다.
- 운영 기본 흐름 `검색 -> 상세 -> 조치 -> 감사 로그 확인`을 유지하되, `검수 큐`는 2depth 페이지, `문항 관리`는 상세 Drawer 중심으로 역할을 분리합니다.
- `51~54번` 문제 유형 차이를 반영하면서도 검색 파라미터, 감사 로그 역추적, URL 복원 계약을 일관되게 유지합니다.

## 2. 문서 메타

| 항목 | 내용 |
| --- | --- |
| 모듈 | Assessment |
| 페이지명 | TOPIK 쓰기 문제은행 |
| 현재 상태 | 구현됨 (mock service/store 기반) |
| 페이지 유형 | 목록 운영형 + 2depth 검수 페이지 |
| 목록 라우트 | `/assessment/question-bank` |
| 검수 라우트 | `/assessment/question-bank/review/:questionId` |
| 주요 권한 | `assessment.question-bank.manage` |
| 주요 role | `SUPER_ADMIN`, `CONTENT_MANAGER` |
| 연관 문서 | `docs/specs/admin-page-tables.md`, `docs/specs/admin-data-contract.md`, `docs/specs/admin-action-log.md`, `docs/architecture/admin-data-source-transition.md` |

## 3. 페이지 목표와 비목표

### 목표

- TOPIK 쓰기 `51~54번` AI 생성 문항을 문제 번호 단위로 검수합니다.
- 검수 완료 문항의 운영 상태를 별도 관리 탭에서 관리합니다.
- 검수 메모 저장, 상태 변경, 운영 상태 변경 모두 `AssessmentQuestion + questionId` 감사 로그 계약으로 추적합니다.

### 비목표

- 이 화면에서 직접 문항을 수동 생성하지 않습니다.
- EPS TOPIK, 레벨 테스트 세트 편성을 이 화면 책임으로 가져오지 않습니다.
- JSON 업로드/내보내기, 대량 일괄 승인, 배치 재생성 기능은 아직 포함하지 않습니다.

## 4. 운영자 사용 시나리오

- 시나리오 1: 운영자가 `검수 큐` 탭에서 문제 번호와 검색 조건으로 문항을 좁히고, 행 클릭으로 2depth 검수 페이지에 들어갑니다.
- 시나리오 2: 검수 페이지에서 문항 카드 안의 `지시문`, `출처`, `핵심 의미`, `핵심 문제`, `모범답안 보기`, `채점 기준`, `수정 히스토리`를 연속으로 확인하고 우측 `검수 메모` 패널에서 메모 저장 후 `검수 완료`, `보류`, `수정 필요`를 결정합니다.
- 시나리오 3: 운영자가 `문항 관리` 탭에서 행 클릭으로 빠른 상세 Drawer를 열고, 기본 정보와 핵심 요약을 다시 확인한 뒤 `노출 후보`, `숨김 후보`, `운영 제외`를 조치합니다.
- 시나리오 4: 운영자가 조치 후 `감사 로그 확인` 링크로 이동해 동일 문항의 이력을 검증합니다.

## 5. 화면 구조

### 5.1 목록 페이지 `/assessment/question-bank`

| 영역 | 목적 | 주요 데이터 | 주요 액션 |
| --- | --- | --- | --- |
| `PageTitle` | 페이지 식별 | 페이지 제목/설명 | 없음 |
| 상단 요약 카드 | 현재 우선순위 범위 파악 | 검수 상태별 또는 운영 상태별 건수 | 카드 클릭 필터 |
| 주 탭 | `검수 큐` / `문항 관리` 역할 분리 | 현재 작업 모드 | 탭 전환 |
| 문제 번호 체크박스 그룹 | `51`, `52`, `53`, `54` 범위 전환 | 문제 번호 | 단일 선택 전환 |
| SearchBar | 검색 조건 적용 | 도메인, 유형, 난이도, 검색어 | 즉시 필터 |
| 목록 테이블 | 대상 비교 | 문항 메타, 상태, 자동 점검, 사용 현황 | 행 클릭, 더보기 |
| 상세 Drawer | 문항 빠른 상세/운영 조치 | 기본 정보, 핵심 요약, 메모, 사용 현황 | 운영 상태 변경, 감사 로그 이동, 검수 페이지 이동 |

### 5.2 검수 페이지 `/assessment/question-bank/review/:questionId`

| 영역 | 목적 | 주요 데이터 | 주요 액션 |
| --- | --- | --- | --- |
| `PageTitle` + 돌아가기 | 검수 문맥 식별 | 문제 번호, 목록 복귀 경로 | 목록 복귀 |
| 문항 카드 | 한 카드 안에서 검수 정보 연속 확인 | 지시문, 출처, 핵심 의미, 핵심 문제, 유형별 세부 블록 | `모범답안 보기`, `채점 기준`, `수정 히스토리` 확장 |
| 우측 검수 메모 카드 | 검수 판단 저장 및 상태 결정 | 검수 메모, 사용 현황, 운영 메모 | 메모 저장, 보류, 검수 완료, 수정 필요, 감사 로그 이동 |

## 6. 데이터 블록 정의

### 6.1 목록 공통 데이터

- `questionId`
- `questionNumber`
- `topic`
- `domain`
- `questionTypeLabel`
- `difficultyLevel`
- `generationBatchId`
- `promptVersion`
- `generationModel`
- `generatedAt`
- `updatedAt`
- `updatedBy`

### 6.2 검색/선택 데이터

- 공통 쿼리
  - `tab`
  - `questionNo`
  - `domain`
  - `questionType`
  - `difficulty`
  - `keyword`
  - `selected`
- 검수 큐 전용
  - `reviewStatus`
- 문항 관리 전용
  - `operationStatus`

### 6.3 검수 페이지 카드 데이터

- 공통
  - `sourceType`
  - `coreMeaning`
  - `keyIssue`
  - `modelAnswer`
  - `scoringCriteria[]`
  - `revisionHistory[]`
  - `reviewMemo`
  - `managementNote`
- 유형별 세부
  - `51/52`: `instruction`, `learnerPrompt`, `choices[]`, `answer`
  - `53`: `learnerPrompt`, `chartTitle`, `sourceSummary`, `keyFigures[]`, `answerGuide`
  - `54`: `learnerPrompt`, `topicPrompt`, `conditionLines[]`, `outlineGuide`

## 7. 액션 정의

| 액션 | 대상 식별 기준 | 확인/사유 | 성공 후 피드백 | 감사 로그 확인 경로 |
| --- | --- | --- | --- | --- |
| 검수 메모 저장 | `AssessmentQuestion + questionId` | 불필요 | 저장 메모 본문과 감사 로그 링크 노출 | `/system/audit-logs?targetType=AssessmentQuestion&targetId={questionId}` |
| 검수 완료 | `AssessmentQuestion + questionId` | 확인 + 사유 필수 | 대상 식별 정보와 감사 로그 링크 노출 | 동일 |
| 보류 | `AssessmentQuestion + questionId` | 확인 + 사유 필수 | 대상 식별 정보와 감사 로그 링크 노출 | 동일 |
| 수정 필요 | `AssessmentQuestion + questionId` | 확인 + 사유 필수 | 대상 식별 정보와 감사 로그 링크 노출 | 동일 |
| 노출 후보 | `AssessmentQuestion + questionId` | 확인 + 사유 필수 | 대상 식별 정보와 감사 로그 링크 노출 | 동일 |
| 숨김 후보 | `AssessmentQuestion + questionId` | 확인 + 사유 필수 | 대상 식별 정보와 감사 로그 링크 노출 | 동일 |
| 운영 제외 | `AssessmentQuestion + questionId` | 확인 + 사유 필수 | 대상 식별 정보와 감사 로그 링크 노출 | 동일 |

## 8. 상태값/운영 규칙

| 항목 | 현재 계약 | 비고 |
| --- | --- | --- |
| 검수 상태 | `검수 대기`, `검수 중`, `보류`, `검수 완료`, `수정 필요` | 운영 상태와 분리 유지 |
| 운영 상태 | `미지정`, `노출 후보`, `숨김 후보`, `운영 제외` | 최종 공개 정책과 직접 등치하지 않음 |
| 검수 메모 저장 게이트 | 저장되지 않은 메모가 있거나 메모가 비어 있으면 검수 상태 변경 금지 | 검수 페이지에서만 적용 |
| 검수 큐 상세 방식 | 행 클릭은 2depth 검수 페이지 진입, Drawer는 `빠른 상세 보기` 예외 액션만 제공 | 전역 Drawer baseline 훼손 방지 |
| 문항 관리 상세 방식 | 행 클릭은 Drawer | 운영 상태 조치 중심 |

## 9. URL/상태 복원

### 목록 페이지

- 유지 대상
  - `tab`
  - `questionNo`
  - `domain`
  - `questionType`
  - `difficulty`
  - `keyword`
  - `reviewStatus`
  - `operationStatus`
  - `selected`

### 검수 페이지

- 검수 페이지 URL은 목록 페이지 쿼리를 그대로 보존해 들어갑니다.
- `목록으로 돌아가기`는 현재 검수 페이지의 쿼리를 이용해 같은 목록 상태를 복원합니다.
- 검수 페이지 URL에서는 `selected`를 쓰지 않습니다.

## 10. 네트워크 상태와 fail-safe

- pending: 문항 목록 또는 검수 대상을 불러오는 중임을 Alert로 표시합니다.
- success: 현재 필터 결과를 렌더링합니다.
- empty: 조건에 맞는 문항이 없음을 Empty 상태로 안내합니다.
- error: 오류 메시지와 `다시 시도`를 제공하고, 가능한 경우 마지막 성공 목록을 유지합니다.
- abort/retry: 화면 이탈 시 요청 취소, 조회 실패 시 수동 재시도, 조치 버튼 중복 제출 방지를 적용합니다.

## 11. 구현 메모

- 목록 페이지 파일
  - `src/features/assessment/pages/assessment-question-bank-page.tsx`
- 검수 페이지 파일
  - `src/features/assessment/pages/assessment-question-review-page.tsx`
- 모델/서비스
  - `src/features/assessment/model/assessment-question-bank-types.ts`
  - `src/features/assessment/model/assessment-question-bank-schema.ts`
  - `src/features/assessment/model/assessment-question-bank-store.ts`
  - `src/features/assessment/model/assessment-question-bank-presenter.ts`
  - `src/features/assessment/api/assessment-question-bank-service.ts`

## 12. 오픈 이슈

- 최종 공개/숨김 정책과 승인 체계는 아직 확정되지 않았습니다.
- JSON 업로드/내보내기, 배치 재시도, 프롬프트 버전 비교, 대량 검수 액션은 후속 범위입니다.
- EPS TOPIK / 레벨 테스트 편성 화면에서 검수 완료 문항을 소비하는 계약은 별도 후속 문서가 필요합니다.
