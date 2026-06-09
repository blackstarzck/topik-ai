# Assessment > TOPIK 쓰기 문제 검수 상세 IA

## 1. 문서 목적

- `Assessment > TOPIK 쓰기 문제 검수`의 목록 운영 구조와 2depth 검수 페이지 구조를 하나의 SoT로 고정한다.
- 이 문서의 1차 대상은 검수 목록 페이지(`/assessment/question-bank`)와 2depth 검수 페이지(`/assessment/question-bank/review/:questionId`)다. 기존 `문항 관리` 모드는 별도 라우트/페이지로 분리되어 `docs/specs/page-ia/assessment-question-manage-page-ia.md`로 이관되었다.
- 운영 기본 흐름 `검색 -> 상세 -> 조치 -> 감사 로그 확인`은 유지하되, 검수 목록은 행 클릭과 툴팁 `검수하기`를 통해 2depth 검수 페이지로 진입한다.
- `51~54번` 문제 유형 차이를 반영하면서도 검색 파라미터, 감사 로그 역추적, URL 복원 계약을 일관되게 유지한다.

> 상위 개념어로서 "문제은행"은 검수/관리 두 페이지를 아우르는 도메인 명칭으로만 사용한다. 라우트 `/assessment/question-bank`는 검수 페이지가 소유하고, 문항 관리 페이지(`/assessment/question-bank/manage`)는 `docs/specs/page-ia/assessment-question-manage-page-ia.md`가 소유한다.

## 2. 문서 메타

| 항목 | 내용 |
| --- | --- |
| 모듈 | Assessment |
| 페이지명 | TOPIK 쓰기 문제 검수 |
| 현재 상태 | 구현됨 (Supabase `problems` 조회 기반, JSON fixture/store fallback 없음) |
| 페이지 유형 | 목록 운영형 + 2depth 검수 페이지 |
| 목록 라우트 | `/assessment/question-bank` |
| 검수 라우트 | `/assessment/question-bank/review/:questionId` |
| 주요 권한 | `assessment.question-bank.manage` |
| 주요 role | `SUPER_ADMIN`, `CONTENT_MANAGER` |
| 연관 문서 | `docs/specs/page-ia/assessment-question-manage-page-ia.md`, `docs/specs/admin-page-tables.md`, `docs/specs/admin-data-contract.md`, `docs/specs/admin-action-log.md`, `docs/architecture/admin-data-source-transition.md`, `docs/specs/admin-policy-source-map.md`, `docs/specs/admin-data-usage-map.md`, `docs/specs/topik-ai-service-api-reference.md` |

## 3. 페이지 목표와 비목표

### 목표

- AI 배치가 자동 생성한 TOPIK 쓰기 `51~54번` 문항을 문제 번호 단위로 검수한다.
- 검수 메모를 통해 각 문항의 적합성 판단과 수정 근거를 기록한다.
- `검수 완료`는 해당 문항의 검수가 종료되었음을 의미하며, 상류 서비스로의 배포(API 업로드) 대상 조건으로 사용된다(운영정책 `POL-017`, 아래 §8.1).
- `수정 히스토리`를 통해 과거 검수 메모와 그 메모가 AI 재생성에 어떻게 반영되었는지 추적한다.
- 검수 상태와 운영 상태는 분리 관리한다. 운영 상태 조회/조치는 문항 관리 페이지(`docs/specs/page-ia/assessment-question-manage-page-ia.md`)의 책임이다.
- 검수 완료는 `AssessmentQuestion + questionId` 감사 로그 계약으로 추적한다.

### 비목표

- 이 화면에서 직접 문항을 수동 생성하지 않는다.
- EPS TOPIK, 레벨 테스트 세트 편성을 이 화면 책임으로 가져오지 않는다.
- JSON 업로드, JSON fallback 조회, 배치 재생성, 대량 일괄 검수 액션은 포함하지 않는다.

## 4. 운영자 사용 시나리오

- 시나리오 1: 운영자가 검수 목록 페이지에서 문제 번호와 검색 조건으로 문항을 좁히고, `문항` 1줄 셀 hover/focus 툴팁으로 문항 전문을 확인한 뒤 툴팁 내부 `검수하기` 또는 행 클릭으로 2depth 검수 페이지에 들어간다. 툴팁 본문은 검수 상세 `문항 지시문`과 같은 줄바꿈/문단 표현을 유지하며, 목록용 문항 텍스트는 Supabase `problems.prompt`를 사용한다.
- 시나리오 2: 2depth 검수 페이지에서 문항 번호에 맞는 검수 필드만 확인한다. `51/52`, `53`, `54`는 같은 공통 상단과 공통 검수 요약 블록을 공유하되, 전용 row는 문제 유형별로 조건부 노출한다.
- 시나리오 3: 운영자가 본문에서 `문항 번호`, `문항 주제`, `문항 형태`, `문항 ID`, `문항 지시문`을 공통으로 확인하고, 이후 이미지 기준 공통 블록인 `출처`, `핵심 의미`, `핵심 문제`, `모범답안`, `채점 기준`, `수정 히스토리`를 순서대로 검토한다. 문제 번호별 전용 row는 `51/52`의 `문항`, `54`의 `문항 질문`만 추가로 노출한다.
  - 현재 row는 Supabase `problems`에서 읽은 값을 화면 모델로 매핑한다. `문항 주제`는 `title`, `문항`과 profile별 `문항 지시문` source는 `prompt`, `모범답안`은 `answer_key`, `채점 기준`은 `rubric`를 사용한다.
  - Supabase source가 없는 값은 임의 생성하지 않고 화면에서 `-`, `미상`, `미지정`, 빈 이력으로 표시한다. JSON fixture fallback은 사용하지 않는다.
- 시나리오 4: 우측 `검수 메모` 카드에 판단 근거를 입력하고 `검수 완료`, `수정 필요`, `보류` 중 하나를 선택한다. 저장되지 않은 메모가 있으면 상태 변경 전에 함께 저장된다.
- 시나리오 5: 운영자는 성공 피드백에 포함된 `감사 로그 확인` 링크로 이동해 동일 문항의 이력을 검증한다.
- 운영 상태/사용 현황 비교는 별도 라우트인 문항 관리 페이지(`docs/specs/page-ia/assessment-question-manage-page-ia.md`)에서 수행한다. 두 페이지는 동일한 조회 결과(공유 hook)를 사용한다.

## 5. 화면 구조

### 5.1 검수 목록 페이지 `/assessment/question-bank`

| 영역 | 목적 | 주요 데이터 | 주요 액션 |
| --- | --- | --- | --- |
| `PageTitle` | 페이지 식별 | 제목 `TOPIK 쓰기 문제 검수`, 설명 | 없음 |
| 상단 요약 카드 | 현재 우선순위 범위 파악 | 검수 상태(`reviewStatus`)별 건수 | 카드 클릭 필터 |
| 문제 번호 체크박스 그룹 | `51`, `52`, `53`, `54` 범위 전환 | 문제 번호 | 다중 선택 전환, 기본 전체 선택 |
| SearchBar | 공통 목록형 검색 조건 적용 | `전체` 선택기, 검색어, 상세 검색 팝오버 | 즉시 필터, 상세 검색 적용 |
| 목록 테이블 | 검수 대상 비교 | 문항 번호, 문항 ID, 문항 주제/도메인, 문항(hover 툴팁 + `검수하기`), 검수 상태, 최근 수정 | 행 클릭, 툴팁 `검수하기` |

### 5.2 검수 페이지 `/assessment/question-bank/review/:questionId`

| 영역 | 목적 | 주요 데이터 | 주요 액션 |
| --- | --- | --- | --- |
| `PageTitle` + 돌아가기 | 검수 문맥 식별 | 문제 번호, 목록 복귀 경로 | 목록 복귀 |
| 문항 검수 워크스페이스 | 문제 번호별 검수 필드 검토 | 공통: Supabase `problems.prompt`, `answer_key`, `rubric` / 유형별: `51/52`, `53`, `54` 전용 검수 필드 | 본문 검토 |
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
- 현재 검수 목록 셀에서는 Supabase `problems.title`과 `topic_category_code` 라벨만 노출하고, `questionTypeLabel`, `difficultyLevel`은 파생값이므로 비노출한다.

### 6.2 검색/선택 데이터

- 공통 쿼리(검수/관리 두 페이지 공통)
  - `questionNo` 반복 파라미터
  - `domain`
  - `questionType`
  - `difficulty`
  - `keyword`
- 검수 페이지 전용
  - `reviewStatus`
- 운영 상태 쿼리(`operationStatus`)는 문항 관리 페이지 전용이며 이 페이지에서는 사용하지 않는다(`docs/specs/page-ia/assessment-question-manage-page-ia.md`).
- `tab` 쿼리 파라미터는 제거되었다. 각 라우트가 자체 URL 상태를 보존한다.

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
- Supabase 검수 문서 매핑
  - `problems.id`
  - `problems.question_no`
  - `problems.title`
  - `problems.prompt`
  - `problems.topic_category_code`
  - `problems.difficulty`
  - `problems.rubric[]`
  - `problems.answer_key`
  - `problems.review_status`, `problems.review_workflow_status`
  - `problems.created_at`, `problems.updated_at`
- 수정 히스토리 해석
  - `revisionHistory[]`는 단순 변경 로그가 아니라 `과거 검수 메모 + AI 반영 설명` 흐름을 보여주는 블록으로 해석한다. 현재 Supabase 문제은행 조회에서는 별도 이력 source가 없어 빈 이력으로 표시한다.
- 각 히스토리 항목은 기본 행에서 최소 `수정 일시`, `수정자`, `수정 유형`을 확인할 수 있어야 한다.
- 행을 확장하면 `Descriptions` 컴포넌트 안에서 `검수자 메모(summary)`, `반영 리뷰(review_snapshot)`, `반영 필드(changed_fields[])`를 순서대로 확인할 수 있어야 한다.
- 유형별 검수 필드
  - `51/52`
    - 공통 상단: `문항 번호`, `문항 주제`, `문항 형태`, `문항 ID`, `문항 지시문`
    - 공통 요약 row: `출처`, `핵심 의미`, `핵심 문제`, `모범답안`, `채점 기준`
    - 전용 row: `문항`
    - 전용 row `문항`은 Supabase `problems.prompt`(`questionText`)를 사용한다.
    - 공통 `문항 지시문`, `출처`는 Supabase source가 없어 현재 `-`로 표시한다.
  - `53`
    - 공통 상단: `문항 번호`, `문항 주제`, `문항 형태`, `문항 ID`, `문항 지시문`
    - 공통 요약 row: `출처`, `핵심 의미`, `핵심 문제`, `모범답안`, `채점 기준`
    - 전용 row: 없음
    - `문항 지시문`은 Supabase `problems.prompt`(`questionText`), `모범답안`은 `answer_key`, `채점 기준`은 `rubric`를 사용한다. `핵심 의미/핵심 문제/수정 히스토리`는 현재 Supabase source가 없어 sentinel 또는 빈 이력으로 표시한다.
    - `출처`는 Supabase source가 없어 현재 `-`로 표시한다.
  - `54`
    - 공통 상단: `문항 번호`, `문항 주제`, `문항 형태`, `문항 ID`, `문항 지시문`
    - 공통 요약 row: `출처`, `핵심 의미`, `핵심 문제`, `모범답안`, `채점 기준`
    - 전용 row: `문항 질문`
    - `문항 지시문`은 Supabase `problems.prompt`(`questionText`)를 사용하고, `문항 질문`은 현재 별도 source가 없으므로 같은 prompt 기반 표시와 빈 조건 목록으로 유지한다.
    - `출처`는 Supabase source가 없어 현재 `-`로 표시한다.

## 7. 액션 정의

| 액션 | 대상 식별 기준 | 확인/사유 | 성공 후 피드백 | 감사 로그 확인 경로 |
| --- | --- | --- | --- | --- |
| 검수 완료 | `AssessmentQuestion + questionId` | 확인 + 사유 필수 | 대상 식별 정보와 감사 로그 링크 노출 | `/system/audit-logs?targetType=AssessmentQuestion&targetId={questionId}` |
| 수정 필요 | `AssessmentQuestion + questionId` | 확인 + 사유 필수 | 대상 식별 정보와 감사 로그 링크 노출 | 동일 |
| 보류 | `AssessmentQuestion + questionId` | 확인 + 사유 필수 | 대상 식별 정보와 감사 로그 링크 노출 | 동일 |

> 운영 상태 쓰기 액션(`노출 후보`, `숨김 후보`, `운영 제외`)은 문항 관리 페이지(`docs/specs/page-ia/assessment-question-manage-page-ia.md`)에서 정의한다.

## 8. 상태값/운영 규칙

| 항목 | 현재 계약 | 비고 |
| --- | --- | --- |
| 검수 상태 | `검수 대기`, `검수 중`, `보류`, `검수 완료`, `수정 필요` | 운영 상태와 분리 유지 |
| 운영 상태 | (이 페이지 비표시) | 운영 상태 조회/조치는 문항 관리 페이지(`docs/specs/page-ia/assessment-question-manage-page-ia.md`)가 담당 |
| 검수 메모 의미 | 검수자가 문항 적합성을 판단한 근거 | 단순 메모가 아니라 검수 판단 기록 |
| 검수 완료 의미 | 해당 문항 검수가 종료되었음을 의미 | 상류 서비스 배포(API 업로드) 대상 조건 (`POL-017`, §8.1) |
| 검수 상태 변경 UX | 별도 `검수 메모 저장` 버튼 없이 `검수 완료`, `수정 필요`, `보류` 실행 시 최신 메모를 먼저 저장한 뒤 상태를 변경 | 2depth 검수 페이지에서만 적용 |
| 수정 히스토리 의미 | 과거 검수 메모와 AI 반영 설명을 함께 보여줌 | 재생성 적합성 검토용 |
| 문제 번호별 검수 필드 | `51/52`, `53`, `54`는 서로 다른 검수 필드 집합을 사용 | 현재는 검수 페이지 `Descriptions` profile로 분기, 장기적으로는 mock/API schema 분리 검토 |
| 검수 목록 상세 방식 | 행 클릭 또는 `문항` hover 툴팁의 `검수하기` 버튼으로 2depth 검수 페이지에 진입 | 목록에서는 액션 컬럼과 Drawer를 두지 않음 |

## 8.1 검수·배포 운영정책 (POL-017)

> 정책 SoT는 `docs/specs/admin-policy-source-map.md`의 `POL-017`이며, 이 섹션은 검수 페이지 관점 요약이다. 상류 API 계약은 `docs/specs/topik-ai-service-api-reference.md`(Swagger `http://58.236.187.135:9009/docs#/`의 Writing 파트)를 단일 원문으로 사용한다.

- 운영 흐름은 `검수(관리자) -> 배포(API 업로드) -> 노출 통제/운영 관리(관리자)`로 고정한다.
- **검수**: 이 페이지(`/assessment/question-bank`)에서 AI 생성 TOPIK 쓰기 `51~54번` 문항(Supabase `problems`)을 `검수 완료`/`수정 필요`/`보류`로 검수한다. 관리자 `problems`는 검수 원본 SoT다.
- **배포(업로드)**: `검수 완료` 문항은 관리자에서 상류 `TalkPik AI Service`로 API 업로드(push)되어 사용자 노출용 작문 과제(`GET /api/writing/tasks`, `GET /api/writing/tasks/{task_type}`)로 등록된다. 즉 과거 오픈 이슈였던 "후속 내보내기/배포"는 파일 내보내기가 아니라 상류 서비스로의 API 업로드로 확정한다. 업로드 결과물의 사용자 노출 데이터 모델은 Writing API(`GenerateProblemResponse`: `task_type`/`title`/`instruction`/`topic`/`max_score`/`difficulty` + 과제별 추가 키)를 따른다.
- **노출 통제/운영 관리**: 사용자에게 보여지는 부분(노출/숨김)의 통제와 운영 관리는 이 페이지가 아니라 문항 관리 페이지(`/assessment/question-bank/manage`)의 운영 상태(`노출 후보`/`숨김 후보`/`운영 제외`)가 담당한다(`docs/specs/page-ia/assessment-question-manage-page-ia.md`).
- 검수와 배포/노출은 분리한다. 이 페이지는 검수 상태 변경까지만 책임지고, 배포된 작문 과제의 사용자 노출 on/off는 관리 페이지 책임이다.
- 후속 확정(후보): 배포 실행 트리거(`검수 완료` 시 자동 vs 별도 `배포` 액션)와 상류 업로드/upsert 엔드포인트 경로는 아직 상류 스냅샷에 없으므로 후속 구현에서 확정한다. 배포 조치를 별도 액션으로 두면 `AssessmentQuestion + questionId` 감사 로그 계약을 따른다(`docs/specs/admin-action-log.md`).

## 9. URL/상태 복원

### 검수 목록 페이지

- 유지 대상
  - `questionNo` 반복 파라미터
  - `domain`
  - `questionType`
  - `difficulty`
  - `keyword`
  - `reviewStatus`
- `tab` 파라미터는 제거되었고, `operationStatus`는 문항 관리 페이지 전용이므로 이 페이지에서 복원하지 않는다.
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

- 검수 목록 페이지 파일
  - `src/features/assessment/pages/assessment-question-bank-page.tsx`
- 2depth 검수 페이지 파일
  - `src/features/assessment/pages/assessment-question-review-page.tsx`
- 문항 관리 페이지는 별도 라우트/파일로 분리되었다(`docs/specs/page-ia/assessment-question-manage-page-ia.md`).
- 모델/서비스
  - `src/features/assessment/model/assessment-question-bank-types.ts`
  - `src/features/assessment/model/assessment-question-bank-schema.ts`
  - `src/features/assessment/model/assessment-question-bank-presenter.ts`
  - `src/features/assessment/api/assessment-question-bank-service.ts`
  - `src/features/assessment/api/supabase-assessment-question-bank-service.ts`

## 12. 오픈 이슈

- 사용자 노출(공개/숨김) 통제 위치는 `POL-017`로 확정되어 문항 관리 페이지(`/assessment/question-bank/manage`)의 운영 상태가 담당한다. 다만 운영 상태 write는 v13 `lifecycle_status` 도착 전까지 비활성이며, 배포 승인 체계(누가 어떤 단계에서 배포를 승인하는지)는 아직 미확정이다.
- `검수 완료 -> 배포`의 방향과 대상은 `POL-017`로 확정되었다(관리자 -> 상류 `TalkPik AI Service` API 업로드 -> Writing 작문 과제). 남은 미확정은 배포 실행 트리거(자동 vs 별도 액션)와 상류 업로드/upsert 엔드포인트 경로이며, 파일 내보내기 방식은 폐기되었다.
- 문제 번호별 검수 필드는 현재 `Descriptions` profile helper로 분기한다. mock/API 단계에서 별도 review field profile schema로 승격할지는 후속 구현에서 확정해야 한다.
- AI 재생성, 배치 재시도, 프롬프트 버전 비교, 대량 검수 액션은 후속 범위다.
- Supabase 미설정/조회 실패 시 JSON fallback을 제공하지 않고 error/retry 상태를 노출한다.
- 1차 사용자 노출 경로는 `POL-017`에 따라 Writing API(`GET /api/writing/tasks`)이며, EPS TOPIK / 레벨 테스트 편성 화면에서 검수/배포 완료 문항을 소비하는 계약은 여전히 별도 후속 문서가 필요하다.
