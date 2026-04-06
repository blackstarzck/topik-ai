# Assessment > TOPIK 쓰기 문제은행 상세 IA

## 1. 문서 목적

- `Assessment > TOPIK 쓰기 문제은행`의 목록 운영 구조와 2depth 검수 페이지 구조를 하나의 SoT로 고정한다.
- 운영 기본 흐름 `검색 -> 상세 -> 조치 -> 감사 로그 확인`은 유지하되, `검수 큐`는 행 클릭과 툴팁 `검수하기`를 통해 2depth 검수 페이지로 진입하고 `문항 관리`는 목록 비교용 읽기 화면으로 유지한다.
- `51~54번` 문제 유형 차이를 반영하면서도 검색 파라미터, 감사 로그 역추적, URL 복원 계약을 일관되게 유지한다.

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

- AI 배치가 자동 생성한 TOPIK 쓰기 `51~54번` 문항을 문제 번호 단위로 검수한다.
- 검수 메모를 통해 각 문항의 적합성 판단과 수정 근거를 기록한다.
- `검수 완료`는 해당 문항의 검수가 종료되었음을 의미하며, 완료 문항은 JSON 내보내기 대상이 된다.
- `수정 히스토리`를 통해 과거 검수 메모와 그 메모가 AI 재생성에 어떻게 반영되었는지 추적한다.
- 검수 상태와 운영 상태는 분리 관리한다.
- 검수 완료와 운영 상태 변경 모두 `AssessmentQuestion + questionId` 감사 로그 계약으로 추적한다.

### 비목표

- 이 화면에서 직접 문항을 수동 생성하지 않는다.
- EPS TOPIK, 레벨 테스트 세트 편성을 이 화면 책임으로 가져오지 않는다.
- JSON 업로드, 배치 재생성, 대량 일괄 검수 액션은 아직 포함하지 않는다.

## 4. 운영자 사용 시나리오

- 시나리오 1: 운영자가 `검수 큐` 탭에서 문제 번호와 검색 조건으로 문항을 좁히고, `문항` 1줄 셀 hover/focus 툴팁으로 문항 전문을 확인한 뒤 툴팁 내부 `검수하기` 또는 행 클릭으로 2depth 검수 페이지에 들어간다. 툴팁 본문은 검수 상세 `문항 지시문`과 같은 줄바꿈/문단 표현을 유지하며, 목록용 문항 텍스트는 feature 내부 JSON fixture의 `prompt_text`를 우선 사용한다.
- 시나리오 2: 2depth 검수 페이지에서 문항 번호에 맞는 검수 필드만 확인한다. `51/52`, `53`, `54`는 같은 공통 상단과 공통 검수 요약 블록을 공유하되, 전용 row는 문제 유형별로 조건부 노출한다.
- 시나리오 3: 운영자가 본문에서 `문항 번호`, `문항 주제`, `문항 형태`, `문항 ID`, `문항 지시문`을 공통으로 확인하고, 이후 이미지 기준 공통 블록인 `출처`, `핵심 의미`, `핵심 문제`, `모범답안`, `채점 기준`, `수정 히스토리`를 순서대로 검토한다. 문제 번호별 전용 row는 `51/52`의 `문항`, `54`의 `문항 질문`만 추가로 노출한다.
  - 현재 mock row는 모두 feature 내부 JSON fixture 전체(`valid_questions_97items_2026-03-27.json`, 현재 workspace 기준 97개)를 `reviewDocument` SoT로 붙인다. `문항 주제`, `문항`, `핵심 의미`, `핵심 문제`, `모범답안`, `채점 기준`, `수정 히스토리`는 JSON direct key를 우선 사용한다.
  - direct key가 없는 값은 빈값으로 두고 화면에서는 `-`로 표시한다. 현재 `51/52`의 `문항 지시문`, 공통 `출처`, `검수자`가 이 규칙을 따른다.
- 시나리오 4: 우측 `검수 메모` 카드에 판단 근거를 입력하고 `검수 완료`, `수정 필요`, `보류` 중 하나를 선택한다. 저장되지 않은 메모가 있으면 상태 변경 전에 함께 저장된다.
- 시나리오 5: 운영자는 성공 피드백에 포함된 `감사 로그 확인` 링크로 이동해 동일 문항의 이력을 검증한다.
- 시나리오 6: 운영자가 `문항 관리` 탭에서 같은 필터/요약 카드 기준으로 운영 상태와 사용 현황을 비교한다. 이 탭에서는 더 이상 `액션` 컬럼이나 상세 Drawer를 제공하지 않는다.

## 5. 화면 구조

### 5.1 목록 페이지 `/assessment/question-bank`

| 영역 | 목적 | 주요 데이터 | 주요 액션 |
| --- | --- | --- | --- |
| `PageTitle` | 페이지 식별 | 페이지 제목/설명 | 없음 |
| 상단 요약 카드 | 현재 우선순위 범위 파악 | 검수 상태별 또는 운영 상태별 건수 | 카드 클릭 필터 |
| 주 탭 | `검수 큐` / `문항 관리` 역할 분리 | 현재 작업 모드 | 탭 전환 |
| 문제 번호 체크박스 그룹 | `51`, `52`, `53`, `54` 범위 전환 | 문제 번호 | 다중 선택 전환, 기본 전체 선택 |
| SearchBar | 공통 목록형 검색 조건 적용 | `전체` 선택기, 검색어, 상세 검색 팝오버 | 즉시 필터, 상세 검색 적용 |
| 목록 테이블 | 대상 비교 | 문항 번호, 문항 주제/도메인, 문항 텍스트, 상태, 사용 현황 | `검수 큐` 행 클릭, 툴팁 `검수하기` |

### 5.2 검수 페이지 `/assessment/question-bank/review/:questionId`

| 영역 | 목적 | 주요 데이터 | 주요 액션 |
| --- | --- | --- | --- |
| `PageTitle` + 돌아가기 | 검수 문맥 식별 | 문제 번호, 목록 복귀 경로 | 목록 복귀 |
| 문항 검수 워크스페이스 | 문제 번호별 검수 필드 검토 | 공통: `prompt_text`, `model_answer`, `rubric`, `edit_history` / 유형별: `51/52`, `53`, `54` 전용 검수 필드 | 본문 검토 |
| 우측 검수 메모 카드 | 검수 판단 기록과 상태 변경 | 검수자, `review_memo`, 저장 상태 안내 | `검수 완료`, `수정 필요`, `보류` |
| 수정 히스토리 테이블 | 과거 검수 메모와 AI 반영 설명 비교 | 수정 일시, 수정자, 수정 유형 | 행 확장 `Descriptions`로 `검수자 메모`, `반영 리뷰`, `반영 필드` 확인 |

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
- 현재 검수 큐 목록 셀에서는 JSON direct key인 `topic`, `domain`만 노출하고, `questionTypeLabel`, `difficultyLevel`은 exact JSON key가 아니라서 비노출한다.

### 6.2 검색/선택 데이터

- 공통 쿼리
  - `tab`
  - `questionNo` 반복 파라미터
  - `domain`
  - `questionType`
  - `difficulty`
  - `keyword`
- 검수 큐 전용
  - `reviewStatus`
- 문항 관리 전용
  - `operationStatus`

### 6.3 검수 페이지 데이터

- 공통
  - `sourceType`
  - `modelAnswer`
  - `scoringCriteria[]`
  - `revisionHistory[]`
  - `reviewMemo`
  - `managementNote`
  - `reviewCompletedAt` candidate
  - `reviewExportStatus` candidate
- JSON 검수 문서 매핑
  - `reviewDocument.id`
  - `reviewDocument.created_at`
  - `reviewDocument.meta.domain`
  - `reviewDocument.meta.question_type`
  - `reviewDocument.meta.difficulty`
  - `reviewDocument.prompt_text`
  - `reviewDocument.context_notes.row1_label`, `reviewDocument.context_notes.row1_value`
  - `reviewDocument.context_notes.row2_label`, `reviewDocument.context_notes.row2_value`
  - `reviewDocument.model_answer`
  - `reviewDocument.rubric.content`, `reviewDocument.rubric.language`, `reviewDocument.rubric.structure`
  - `reviewDocument.review_memo`
  - `reviewDocument.edit_history[]`
  - `reviewDocument.review_passed`
- 수정 히스토리 해석
  - `revisionHistory[]`, `reviewDocument.edit_history[]`는 단순 변경 로그가 아니라 `과거 검수 메모 + AI 반영 설명` 흐름을 보여주는 블록으로 해석한다.
- 각 히스토리 항목은 기본 행에서 최소 `수정 일시`, `수정자`, `수정 유형`을 확인할 수 있어야 한다.
- 행을 확장하면 `Descriptions` 컴포넌트 안에서 `검수자 메모(summary)`, `반영 리뷰(review_snapshot)`, `반영 필드(changed_fields[])`를 순서대로 확인할 수 있어야 한다.
- 유형별 검수 필드
  - `51/52`
    - 공통 상단: `문항 번호`, `문항 주제`, `문항 형태`, `문항 ID`, `문항 지시문`
    - 공통 요약 row: `출처`, `핵심 의미`, `핵심 문제`, `모범답안`, `채점 기준`
    - 전용 row: `문항`
    - 전용 row `문항`은 feature 내부 JSON fixture의 `prompt_text`(`questionText`)를 사용한다.
    - `문항 지시문`, `출처`는 direct key가 없어 현재 `-`로 표시한다.
  - `53`
    - 공통 상단: `문항 번호`, `문항 주제`, `문항 형태`, `문항 ID`, `문항 지시문`
    - 공통 요약 row: `출처`, `핵심 의미`, `핵심 문제`, `모범답안`, `채점 기준`
    - 전용 row: 없음
    - `문항 지시문`은 `questionText`(`prompt_text`), `핵심 의미/핵심 문제`는 `context_notes`, `모범답안`과 `채점 기준`, `수정 히스토리`는 각각 `model_answer`, `rubric`, `edit_history`를 우선 사용한다.
    - `출처`는 direct key가 없어 현재 `-`로 표시한다.
  - `54`
    - 공통 상단: `문항 번호`, `문항 주제`, `문항 형태`, `문항 ID`, `문항 지시문`
    - 공통 요약 row: `출처`, `핵심 의미`, `핵심 문제`, `모범답안`, `채점 기준`
    - 전용 row: `문항 질문`
    - `문항 지시문`은 `questionText`(`prompt_text`)를 사용하고, `문항 질문`은 `approved_topic_seed.shared_context`와 `scenario_logic`를 이용해 구성한다.
    - `출처`는 direct key가 없어 현재 `-`로 표시한다.

## 7. 액션 정의

| 액션 | 대상 식별 기준 | 확인/사유 | 성공 후 피드백 | 감사 로그 확인 경로 |
| --- | --- | --- | --- | --- |
| 검수 완료 | `AssessmentQuestion + questionId` | 확인 + 사유 필수 | 대상 식별 정보와 감사 로그 링크 노출 | `/system/audit-logs?targetType=AssessmentQuestion&targetId={questionId}` |
| 수정 필요 | `AssessmentQuestion + questionId` | 확인 + 사유 필수 | 대상 식별 정보와 감사 로그 링크 노출 | 동일 |
| 보류 | `AssessmentQuestion + questionId` | 확인 + 사유 필수 | 대상 식별 정보와 감사 로그 링크 노출 | 동일 |
| 노출 후보 | `AssessmentQuestion + questionId` | 확인 + 사유 필수 | 대상 식별 정보와 감사 로그 링크 노출 | 동일 |
| 숨김 후보 | `AssessmentQuestion + questionId` | 확인 + 사유 필수 | 대상 식별 정보와 감사 로그 링크 노출 | 동일 |
| 운영 제외 | `AssessmentQuestion + questionId` | 확인 + 사유 필수 | 대상 식별 정보와 감사 로그 링크 노출 | 동일 |

## 8. 상태값/운영 규칙

| 항목 | 현재 계약 | 비고 |
| --- | --- | --- |
| 검수 상태 | `검수 대기`, `검수 중`, `보류`, `검수 완료`, `수정 필요` | 운영 상태와 분리 유지 |
| 운영 상태 | `미지정`, `노출 후보`, `숨김 후보`, `운영 제외` | 최종 공개 정책과 직접 등치하지 않음 |
| 검수 메모 의미 | 검수자가 문항 적합성을 판단한 근거 | 단순 메모가 아니라 검수 판단 기록 |
| 검수 완료 의미 | 해당 문항 검수가 종료되었음을 의미 | 완료 문항은 JSON 내보내기 대상 |
| 검수 상태 변경 UX | 별도 `검수 메모 저장` 버튼 없이 `검수 완료`, `수정 필요`, `보류` 실행 시 최신 메모를 먼저 저장한 뒤 상태를 변경 | 2depth 검수 페이지에서만 적용 |
| 수정 히스토리 의미 | 과거 검수 메모와 AI 반영 설명을 함께 보여줌 | 재생성 적합성 검토용 |
| 문제 번호별 검수 필드 | `51/52`, `53`, `54`는 서로 다른 검수 필드 집합을 사용 | 현재는 검수 페이지 `Descriptions` profile로 분기, 장기적으로는 mock/API schema 분리 검토 |
| 검수 큐 상세 방식 | 행 클릭 또는 `문항` hover 툴팁의 `검수하기` 버튼으로 2depth 검수 페이지에 진입 | 목록에서는 액션 컬럼과 Drawer를 두지 않음 |
| 문항 관리 상세 방식 | 별도 행 클릭/Drawer 없이 목록 비교용 테이블로 유지 | 운영 상태 비교와 사용 현황 확인 중심 |

## 9. URL/상태 복원

### 목록 페이지

- 유지 대상
  - `tab`
  - `questionNo` 반복 파라미터
  - `domain`
  - `questionType`
  - `difficulty`
  - `keyword`
  - `reviewStatus`
  - `operationStatus`
- `questionNo`가 없으면 `51~54` 전체 선택으로 해석하고, 부분 선택일 때만 반복 파라미터를 남긴다.

### 검수 페이지

- 검수 페이지 URL은 목록 페이지 쿼리를 그대로 보존해 들어간다.
- `목록으로 돌아가기`는 현재 검수 페이지의 쿼리를 이용해 같은 목록 상태를 복원한다.

## 10. 네트워크 상태와 fail-safe

- pending: 문항 목록 또는 검수 대상을 불러오는 중임을 Alert로 표시한다.
- success: 현재 필터 결과를 렌더링한다.
- empty: 조건에 맞는 문항이 없음을 Empty 상태로 안내한다.
- error: 오류 메시지와 `다시 시도`를 제공하고, 가능한 경우 마지막 성공 목록을 유지한다.
- abort/retry: 화면 이탈 시 요청 취소, 조회 실패 시 수동 재시도, 조치 버튼 중복 제출 방지를 적용한다.

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

- 최종 공개/숨김 정책과 승인 체계는 아직 확정되지 않았다.
- `검수 완료 -> JSON 내보내기`의 실행 위치와 파일 스키마는 아직 고정되지 않았다.
- 문제 번호별 검수 필드는 현재 `Descriptions` profile helper로 분기한다. mock/API 단계에서 별도 review field profile schema로 승격할지는 후속 구현에서 확정해야 한다.
- AI 재생성, 배치 재시도, 프롬프트 버전 비교, 대량 검수 액션은 후속 범위다.
- EPS TOPIK / 레벨 테스트 편성 화면에서 검수 완료 문항을 소비하는 계약은 별도 후속 문서가 필요하다.
