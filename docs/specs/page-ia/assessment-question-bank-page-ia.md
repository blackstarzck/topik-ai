# Assessment > TOPIK 쓰기 문제은행 상세 IA

## 1. 문서 목적

- `Assessment > TOPIK 쓰기 문제은행`의 목록 운영 구조와 `/review/:questionId` 2depth 검토 페이지 구조를 하나의 SoT로 고정한다.
- 이 페이지는 첨부 JSON fixture의 key만 렌더링한다는 계약을 유지하고, JSON에 없는 synthetic 운영 메타는 문서 SoT에서 제외한다.
- 운영 기본 흐름 `검색 -> 상세 -> 조치 -> 감사 로그 확인`은 유지하되, 현재 mock 단계의 조치는 `review_memo` 저장과 `review_passed` 토글로 한정한다.

## 2. 문서 메타

| 항목 | 내용 |
| --- | --- |
| 모듈 | Assessment |
| 페이지명 | TOPIK 쓰기 문제은행 |
| 현재 상태 | 구현됨 (repo-local JSON fixture + mock service/store 기반) |
| 페이지 유형 | 목록 운영형 + 2depth 검토 페이지 |
| 목록 라우트 | `/assessment/question-bank` |
| 검토 라우트 | `/assessment/question-bank/review/:questionId` |
| 주요 권한 | `assessment.question-bank.manage` |
| 주요 role | `SUPER_ADMIN`, `CONTENT_MANAGER` |
| 연관 문서 | `docs/specs/admin-page-tables.md`, `docs/specs/admin-data-contract.md`, `docs/specs/admin-action-log.md`, `docs/architecture/admin-data-source-transition.md` |

## 3. 페이지 목표와 비목표

### 목표

- repo에 복제된 JSON fixture(`assessment-question-bank-documents.json`)를 그대로 읽어 TOPIK 쓰기 검토 문서를 목록/상세로 검토한다.
- `review_memo`를 통해 각 문항의 적합성 판단 근거를 기록한다.
- `review_passed`를 `검수 통과`/`검수 미통과`로 토글하고 같은 `AssessmentQuestion` 감사 로그 계약으로 추적한다.
- `prompt_text` 미리보기와 `context_notes` 요약을 같은 목록 컨텍스트에서 확인하고, `검토하기`로 2depth 검토 페이지에 진입한다.

### 비목표

- 이 화면에서 직접 문항을 수동 생성하지 않는다.
- `문항 관리`, `공개 상태`, `자동 점검`, `문제 번호(51~54)` 같은 synthetic 운영 메타를 이 페이지 책임으로 두지 않는다.
- JSON 업로드, 파일 교체, 배치 재시도, 대량 일괄 검토 액션은 아직 포함하지 않는다.
- EPS TOPIK, 레벨 테스트 세트 편성을 이 화면 책임으로 가져오지 않는다.

## 4. 운영자 사용 시나리오

- 시나리오 1: 운영자가 목록에서 `도메인`, `question_type`, `difficulty`, `review_passed`, `검색어`로 문항을 좁힌다.
- 시나리오 2: 운영자가 문항 ID 링크 또는 `prompt_text` 미리보기 Popover 푸터의 `검토하기` 버튼으로 2depth 검토 페이지에 들어간다.
- 시나리오 3: 운영자가 상세 페이지 좌측 본문에서 `meta`, `review_workflow`, `approved_*`, `scenario_logic`, `relation`, `chart_a/chart_b`, `context_notes`, `narrative`, `prompt_text`, `model_answer`, `rubric`, `edit_history`를 순서대로 검토한다.
- 시나리오 4: 우측 `review_memo` 카드에 판단 근거를 입력하고 `review_memo 저장`을 실행한다.
- 시나리오 5: 운영자가 `검수 통과` 또는 `검수 미통과`를 선택하고 확인 모달에 사유를 남긴다. 저장되지 않은 `review_memo`가 있으면 상태 변경 전에 먼저 저장한다.
- 시나리오 6: 운영자는 성공 피드백에 포함된 `감사 로그 확인` 링크로 이동해 동일 문항의 이력을 검증한다.

## 5. 화면 구조

### 5.1 목록 페이지 `/assessment/question-bank`

| 영역 | 목적 | 주요 데이터 | 주요 액션 |
| --- | --- | --- | --- |
| `PageTitle` | 페이지 식별 | 페이지 제목/설명 | 없음 |
| 상단 요약 카드 | 현재 검토 범위 파악 | 전체 문항 수, `review_passed=true/false` 건수 | 카드 클릭 필터 |
| SearchBar | 공통 목록형 검색 조건 적용 | `domain`, `questionType`, `difficulty`, `keyword`, `reviewPassed` | 즉시 검색, 상세 검색 적용 |
| 안내 Alert | 데이터 계약 안내 | JSON key만 렌더링한다는 설명 | 없음 |
| 목록 테이블 | 대상 비교 | `id`, `meta`, `approved_topic_seed`, `prompt_text`, `review_workflow.final_question.status`, `review_passed`, 최신 `edit_history` | 문항 ID 링크, 미리보기 hover/focus, `검토하기` CTA |

### 5.2 검토 페이지 `/assessment/question-bank/review/:questionId`

| 영역 | 목적 | 주요 데이터 | 주요 액션 |
| --- | --- | --- | --- |
| `PageTitle` + 돌아가기 | 검토 문맥 식별 | JSON `id`, 목록 복귀 경로 | 목록 복귀 |
| 좌측 문서 본문 | JSON 원문 검토 | `meta`, `review_workflow`, `approved_*`, `scenario_logic`, `relation`, `chart_a/chart_b`, `context_notes`, `narrative`, `prompt_text`, `model_answer`, `rubric`, `edit_history` | 본문 검토 |
| 우측 검토 카드 | 현재 검토 기록과 조치 | `review_memo`, `review_passed` | `review_memo 저장`, `검수 통과`, `검수 미통과`, `감사 로그 확인` |
| 수정 히스토리 테이블 | JSON 원문 이력 확인 | `edited_at`, `edited_by`, `edit_type`, `source`, `summary`, `changed_fields`, `review_snapshot` | 행 확장 `Descriptions` 확인 |

## 6. 데이터 블록 정의

### 6.1 목록 공통 데이터

- 직접 렌더링
  - `id`
  - `meta.domain`
  - `meta.question_type`
  - `meta.difficulty`
  - `approved_topic_seed.topic_seed_title`
  - `prompt_text`
  - `review_workflow.final_question.status`
  - `review_passed`
  - `created_at`
  - `edit_history[]`
- 파생 표시
  - `latestEditedAt`: `edit_history[]` 최신 항목의 `edited_at`
  - `latestEditedBy`: `edit_history[]` 최신 항목의 `edited_by`
  - `questionPreviewText`: `prompt_text`, `context_notes.row1_value`, `context_notes.row2_value`를 합쳐 만든 화면용 축약 텍스트

### 6.2 검색/선택 데이터

- 공통 쿼리
  - `domain`
  - `questionType`
  - `difficulty`
  - `keyword`
  - `reviewPassed`
- 필터 옵션
  - `domain`, `questionType`, `difficulty` 옵션은 현재 로드된 JSON 값에서 동적으로 계산한다.
  - `reviewPassed`는 `true`, `false`만 사용한다.

### 6.3 검토 페이지 데이터

- 기본 식별/메타
  - `id`
  - `created_at`
  - `meta.domain`
  - `meta.topic_type`
  - `meta.question_type`
  - `meta.narrative_slots[]`
  - `meta.difficulty`
  - `meta.inference_gap`
  - `meta.link_keywords[]`
- 검토 workflow
  - `review_workflow.stage_order[]`
  - `review_workflow.topic_logic.status`, `approval_source`, `artifact_id`
  - `review_workflow.graph_logic.status`, `approval_source`, `artifact_id`
  - `review_workflow.rubric.status`, `approval_source`, `artifact_id`
  - `review_workflow.final_question.status`, `approval_source`, `artifact_id`
  - `review_passed`
- 승인/구성 데이터
  - `approved_topic_seed.*`
  - `approved_graph_logic.*`
  - `approved_rubric.*`
  - `chart_roles.*`
  - `scenario_logic.*`
  - `relation.*`
- 문항 문서 데이터
  - `chart_a.*`
  - `chart_b.*`
  - `context_notes.*`
  - `narrative.*`
  - `prompt_text`
  - `model_answer`
  - `rubric.content`, `rubric.structure`, `rubric.language`
- 검토 기록 데이터
  - `review_memo`
  - `edit_history[]`
  - 각 `edit_history` 항목은 기본 행에서 `edited_at`, `edited_by`, `edit_type`, `source`를 보여주고, 행을 확장하면 `summary`, `changed_fields[]`, `review_snapshot`을 순서대로 확인한다.

## 7. 액션 정의

| 액션 | 대상 식별 기준 | 확인/사유 | 성공 후 피드백 | 감사 로그 확인 경로 |
| --- | --- | --- | --- | --- |
| `review_memo 저장` | `AssessmentQuestion + id` | 별도 확인 없음 | 대상 식별 정보와 감사 로그 링크 노출 | `/system/audit-logs?targetType=AssessmentQuestion&targetId={id}` |
| `검수 통과` | `AssessmentQuestion + id` | 확인 + 사유 필수 | 대상 식별 정보와 감사 로그 링크 노출 | 동일 |
| `검수 미통과` | `AssessmentQuestion + id` | 확인 + 사유 필수 | 대상 식별 정보와 감사 로그 링크 노출 | 동일 |

## 8. 상태값/운영 규칙

| 항목 | 현재 계약 | 비고 |
| --- | --- | --- |
| workflow 상태 | `review_workflow.*.status` 원문 표시 | 현재 fixture는 모두 `approved`, 화면은 `approved/pending/rejected` 색상 매핑을 수용 |
| 검토 통과 상태 | `review_passed: true/false` | 목록 요약 카드, 필터, 우측 조치 카드에서 사용 |
| `review_memo` 의미 | 검토자가 문항 적합성을 판단한 근거 | 단순 메모가 아니라 검토 판단 기록 |
| `review_passed` 변경 UX | 저장되지 않은 `review_memo`가 있으면 먼저 저장한 뒤 확인 모달을 통해 값을 변경 | 2depth 검토 페이지에서만 적용 |
| 빈 메모 가드 | `review_memo`가 비어 있으면 `검수 통과`/`검수 미통과`를 막음 | 판단 근거 누락 방지 |
| 미리보기 UX | 셀 본문은 2줄 ellipsis, hover/focus 시 `prompt_text`와 `context_notes` 2행만 Popover로 확장 | Popover 하단 우측에 `검토하기` 버튼 고정 |
| 상세 진입 방식 | 행 클릭 대신 문항 ID 링크와 미리보기 Popover 푸터 CTA로 2depth 검토 페이지 진입 | Drawer 사용 안 함 |
| synthetic 필드 사용 금지 | `questionNumber`, `reviewStatus`, `visibilityStatus`, `validationStatus`, `AQ-*`형 내부 ID를 화면 계약에서 제거 | JSON에 없는 값은 목록/상세/모의 데이터에 넣지 않음 |

## 9. URL/상태 복원

### 목록 페이지

- 유지 대상
  - `domain`
  - `questionType`
  - `difficulty`
  - `keyword`
  - `reviewPassed`
- 카드 클릭, 상세 검색, 검색어 입력은 위 쿼리만 갱신한다.

### 검토 페이지

- 검토 페이지 URL은 목록 페이지 쿼리를 그대로 보존해 들어간다.
- `목록으로 돌아가기`는 현재 검토 페이지의 쿼리를 이용해 같은 목록 상태를 복원한다.
- 검토 페이지 URL에서는 `selected`, `tab`, `questionNo`를 쓰지 않는다.

## 10. 네트워크 상태와 fail-safe

- pending: 초기 목록 진입은 `AdminDataTable` 기본 loading 오버레이로 처리하고, empty 상태 컴포넌트 위에 로딩 애니메이션을 함께 노출한다.
- success: 현재 필터 결과를 렌더링한다.
- empty: 조건에 맞는 문항이 없음을 Empty 상태로 안내한다.
- error: 오류 메시지와 `다시 시도`를 제공하고, 가능한 경우 마지막 성공 목록을 유지한다.
- abort/retry: 화면 이탈 시 요청 취소, 조회 실패 시 수동 재시도, 조치 버튼 중복 제출 방지를 적용한다.

## 11. 구현 메모

- 목록 페이지 파일
  - `src/features/assessment/pages/assessment-question-bank-page.tsx`
- 검토 페이지 파일
  - `src/features/assessment/pages/assessment-question-review-page.tsx`
- 모델/서비스
  - `src/features/assessment/model/assessment-question-bank-documents.json`
  - `src/features/assessment/model/assessment-question-bank-types.ts`
  - `src/features/assessment/model/assessment-question-bank-schema.ts`
  - `src/features/assessment/model/assessment-question-bank-store.ts`
  - `src/features/assessment/model/assessment-question-bank-presenter.ts`
  - `src/features/assessment/api/assessment-question-bank-service.ts`

## 12. 오픈 이슈

- 외부에서 받은 JSON 파일을 repo fixture로 교체하는 절차와 업로드 write path는 아직 고정되지 않았다.
- `review_memo`, `review_passed` 변경은 현재 mock store 메모리에만 반영되고 원본 파일이나 API persistence에는 연결되지 않았다.
- JSON 내보내기, 배치 재시도, 검토 히스토리 diff, EPS TOPIK / 레벨 테스트 세트 편성 연동은 후속 범위다.
