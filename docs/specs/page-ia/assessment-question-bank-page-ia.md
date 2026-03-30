# Assessment > TOPIK 쓰기 문제은행 상세 IA

## 1. 문서 목적

- `Assessment > TOPIK 쓰기 문제은행`의 운영 목적, 데이터 블록, 검수/관리 흐름을 같은 기준으로 정리합니다.
- 단일 페이지 안에서 `검수 큐`와 `문항 관리`를 함께 제공하되, 두 흐름의 목적과 액션을 분리해 문서 SoT를 고정합니다.
- 운영 기본 흐름 `검색 -> 상세 -> 조치 -> 감사 로그 확인`을 유지하면서, `51~54번` 문제 유형별 검수 UI 차이를 허용하는 구조를 정의합니다.

## 2. 문서 메타

| 항목 | 내용 |
| --- | --- |
| 모듈 | Assessment |
| 페이지명 | TOPIK 쓰기 문제은행 |
| 현재 상태 | 구현됨 (mock service/store 기반) |
| 페이지 유형 | 카탈로그/자산 관리형 + 유형별 검수 워크스페이스 |
| 라우트 | /assessment/question-bank |
| 주요 권한 | assessment.question-bank.manage |
| 주요 role | SUPER_ADMIN, CONTENT_MANAGER |
| 연관 문서 | docs/specs/admin-page-tables.md, docs/specs/admin-data-contract.md, docs/specs/admin-action-log.md, docs/specs/admin-data-usage-map.md, docs/architecture/admin-data-source-transition.md |

## 3. 페이지 목표와 비목표

### 목표

- TOPIK 쓰기 `51~54번` AI 생성 문항을 배치 단위로 검수합니다.
- 검수 완료 문항을 운영 상태 기준으로 후속 관리합니다.
- 검수/관리 조치 후 `Target Type`, `Target ID`, 감사 로그 확인 경로를 같은 화면에서 제공합니다.

### 비목표

- 운영자가 이 화면에서 직접 문항을 수동 생성하거나 시험 세트를 편성하지 않습니다.
- EPS TOPIK, 레벨 테스트 세트 관리 책임을 이 화면으로 가져오지 않습니다.
- `노출/숨김` 최종 정책을 이 문서 하나로 확정하지 않고, 현재는 `운영 상태` 후보 수준으로 관리합니다.

## 4. 운영자 사용 시나리오

- 시나리오 1: 운영자가 `검수 큐` 탭에서 `51~54번` 유형을 전환하고, 배치/상태/날짜 조건으로 검수 대상을 좁힙니다.
- 시나리오 2: 운영자가 행 클릭으로 상세 Drawer를 열고, 문제 유형에 맞는 검수 UI와 자동 검증 결과를 확인한 뒤 `검수 완료`, `보류`, `수정 필요`를 결정합니다.
- 시나리오 3: 운영자가 `문항 관리` 탭에서 검수 완료 문항을 다시 검색하고, `노출 후보`, `숨김 후보`, `운영 제외` 같은 운영 상태를 관리합니다.
- 시나리오 4: 운영자가 조치 후 `AssessmentQuestion + questionId` 기준으로 감사 로그를 확인하고, EPS TOPIK/레벨 테스트 원본 화면으로 후속 검수를 이어갑니다.

## 5. 화면 구조

| 영역 | 목적 | 주요 데이터 | 주요 액션 | 다른 관리자 페이지 영향 | 사용자 화면 영향 |
| --- | --- | --- | --- | --- | --- |
| 상단 요약 카드 | 현재 탭 기준 우선순위 파악 | 검수 상태별 또는 운영 상태별 건수 | 빠른 범위 전환 | 후속 검수 대상을 압축 | 직접 노출 없음 |
| 주 탭 | `검수 큐` / `문항 관리` 역할 분리 | 현재 작업 흐름 | 탭 전환 | 같은 페이지 내 목적 분리 | 직접 노출 없음 |
| 문제 번호 탭 | `51`, `52`, `53`, `54` 유형 전환 | 문제 번호별 건수 | 문제 유형 전환 | 유형별 검수 UI 분기 | 시험/문제 풀이 화면 원천 |
| SearchBar | 검색/필터/기간 조건 적용 | 검색 대상, 검색어, 상태, 생성일 | 상세 필터 적용/초기화 | 후속 상세 대상 압축 | 직접 노출 없음 |
| 본문 테이블 | 검수/관리 대상 비교 | 문항 메타, 배치 정보, 검수 상태, 운영 상태, 사용처 | 행 클릭, 더보기 | EPS TOPIK / 레벨 테스트 원천 데이터 추적 | 간접 영향 |
| 상세 Drawer | 유형별 검수/관리 워크스페이스 | 기본 정보, 문제 프리뷰, 자동 검증, 메모, 운영 상태 | 검수 상태 변경, 운영 상태 변경, 감사 로그 확인 | EPS TOPIK / 레벨 테스트 연결 경로 제공 | 시험 노출/비노출 후보 결정에 간접 영향 |

## 6. 데이터 블록 정의

### 상단 요약 데이터

- `검수 큐`
  - 전체 문항
  - 검수 대기
  - 보류
  - 검수 완료
- `문항 관리`
  - 전체 문항
  - 노출 후보
  - 숨김 후보
  - 운영 제외

### 검색/선택 데이터

- 공통
  - `tab`
  - `questionNo`
  - `searchField`
  - `keyword`
  - `startDate`
  - `endDate`
  - `selected`
- 검수 큐 전용
  - `reviewStatus`
- 문항 관리 전용
  - `operationStatus`

### 본문 데이터

- 공통 문항 정보
  - `questionId`
  - `questionNumber`
  - `topic`
  - `generationBatchId`
  - `promptVersion`
  - `generationModel`
  - `generatedAt`
  - `updatedAt`
  - `updatedBy`
- 검수 큐 중심 정보
  - `reviewStatus`
  - `validationStatus`
  - `validationSignals[]`
- 문항 관리 중심 정보
  - `operationStatus`
  - `usageCount`
  - `linkedExamCount`

### 상세 데이터

- 기본 정보
  - 문항 ID, 문제 번호, 배치 ID, 프롬프트 버전, 생성 모델, 생성 시각, 최근 수정 정보
- 문제 프리뷰
  - `51/52`: 문장/보기/정답/검수 포인트
  - `53`: 자료 설명형 프롬프트, 핵심 수치, 답안 가이드
  - `54`: 장문형 주제, 제시 조건, 평가 포인트
- 검수 메타
  - `reviewStatus`
  - `validationStatus`
  - `validationSignals[]`
  - `reviewMemo`
- 운영 메타
  - `operationStatus`
  - `usageCount`
  - `linkedExamCount`
  - `managementNote`

## 7. 액션 정의

| 액션 | 성격 | 대상 식별 기준 | 확인/사유 필요 여부 | 성공 후 피드백 | 감사 로그 확인 경로 |
| --- | --- | --- | --- | --- | --- |
| 검수 완료 | 수정 | AssessmentQuestion + questionId | 확인 + 사유 필수 | 대상 식별 정보와 감사 로그 경로를 안내합니다. | /system/audit-logs?targetType=AssessmentQuestion&targetId={questionId} |
| 보류 | 수정 | AssessmentQuestion + questionId | 확인 + 사유 필수 | 대상 식별 정보와 감사 로그 경로를 안내합니다. | /system/audit-logs?targetType=AssessmentQuestion&targetId={questionId} |
| 수정 필요 | 수정 | AssessmentQuestion + questionId | 확인 + 사유 필수 | 대상 식별 정보와 감사 로그 경로를 안내합니다. | /system/audit-logs?targetType=AssessmentQuestion&targetId={questionId} |
| 노출 후보 | 수정 | AssessmentQuestion + questionId | 확인 + 사유 필수 | 대상 식별 정보와 감사 로그 경로를 안내합니다. | /system/audit-logs?targetType=AssessmentQuestion&targetId={questionId} |
| 숨김 후보 | 파괴적 성격의 운영 조치 | AssessmentQuestion + questionId | 확인 + 사유 필수 | 대상 식별 정보와 감사 로그 경로를 안내합니다. | /system/audit-logs?targetType=AssessmentQuestion&targetId={questionId} |
| 운영 제외 | 파괴적 성격의 운영 조치 | AssessmentQuestion + questionId | 확인 + 사유 필수 | 대상 식별 정보와 감사 로그 경로를 안내합니다. | /system/audit-logs?targetType=AssessmentQuestion&targetId={questionId} |
| 시험 연결 보기 | 조회 | AssessmentQuestion + questionId | 불필요 | 현재 사용처와 연결 문맥을 Drawer에서 확인합니다. | 조회성 액션이므로 별도 감사 로그는 강제하지 않습니다. |

## 8. 상태값/정책/운영 규칙

| 항목 | 현재 상태 | 관리자 페이지 영향 | 사용자 화면 영향 | 추후 결정 필요 내용 |
| --- | --- | --- | --- | --- |
| 문제 범위 | 확정 | 이 화면은 TOPIK 쓰기 `51~54번`만 다룹니다. | 다른 시험 범위와 혼동하지 않도록 별도 페이지로 확장하지 않습니다. | 없음 |
| 검수 상태 | 구현 기준 고정 | `검수 대기`, `검수 중`, `보류`, `검수 완료`, `수정 필요`를 사용합니다. | 아직 직접 노출되지 않지만 노출 전 품질 게이트 역할을 합니다. | 승인 체계/다단 검수 여부 |
| 운영 상태 | 임시 계약 | `미지정`, `노출 후보`, `숨김 후보`, `운영 제외`를 사용합니다. | 최종 B2C 노출 정책으로 바로 등치하지 않습니다. | 실제 공개/숨김/아카이브 정책과 매핑 |
| 검수 상태와 운영 상태 분리 | 확정 | 검수 완료 여부와 운영 상태를 같은 컬럼으로 합치지 않습니다. | 운영 정책이 바뀌어도 검수 기록은 유지됩니다. | 없음 |
| URL/상태 복원 | 확정 | 탭, 문제 번호, 검색 조건, 선택된 Drawer 대상을 뒤로가기/새로고침에서 복원합니다. | 운영자가 같은 검수 맥락으로 복귀할 수 있습니다. | 없음 |
| 감사 추적 | 확정 | 조치성 액션은 모두 `AssessmentQuestion + questionId` 계약을 사용합니다. | 직접 노출이 없어도 운영 증적 확보가 필요합니다. | 세부 action code 표준화 |

## 9. 다른 관리자 페이지 영향

| 대상 페이지 | 영향 내용 | 연동 방식 | 선행/후행 관계 |
| --- | --- | --- | --- |
| Assessment > EPS TOPIK | 검수 완료 문항을 시험 세트 편성 원천으로 참조할 수 있습니다. | 문항 ID 기준 후속 연결 | 선행 관계 |
| Assessment > 레벨 테스트 | 향후 유사 검수 패턴의 참조 기준이 됩니다. | 운영 패턴 공유 | 병행 관계 |
| System > 감사 로그 | 모든 조치성 액션을 `AssessmentQuestion + questionId`로 역추적합니다. | AuditLogLink / 딥링크 | 조치 후 필수 |

## 10. 사용자 화면/B2C 영향 참고

| 사용자 화면 후보 | 영향 상태 | 이 페이지 데이터가 반영되는 방식 | 비고 |
| --- | --- | --- | --- |
| TOPIK 쓰기 문제 풀이/시험 화면 | 노출 예정 | 검수 완료 문항이 후속 시험/풀이 흐름의 원천 데이터가 됩니다. | 직접 테이블 노출이 아니라 시험 소비 데이터 |

## 11. URL/상태 복원

- 기본 라우트: `/assessment/question-bank`
- 필수 쿼리 파라미터 후보
  - `tab`
  - `questionNo`
  - `searchField`
  - `keyword`
  - `startDate`
  - `endDate`
  - `reviewStatus`
  - `operationStatus`
  - `selected`
- 유지되어야 하는 상태
  - 현재 작업 탭
  - 문제 번호 탭
  - 검색/필터 조건
  - 열려 있는 상세 Drawer 대상

## 12. 네트워크 상태와 fail-safe

- pending: 스켈레톤 또는 loading 상태를 표시하고 직전 성공 데이터를 유지합니다.
- success: 현재 탭/문제 번호 기준 결과를 렌더링합니다.
- empty: 조건에 맞는 문항이 없음을 현재 탭 맥락에 맞게 안내합니다.
- error: 오류 메시지, 재시도 버튼, 마지막 성공 상태 fallback 문구를 함께 노출합니다.
- 마지막 성공 상태 fallback: 통신 오류가 나도 이전 성공 목록/선택 상태를 가능한 한 유지합니다.
- 요청 취소/재시도: 화면 이탈 시 abort, 조회 실패 시 retry, 조치성 액션은 중복 제출 방지가 필요합니다.

## 13. 구현 메모

- 공용 컴포넌트
  - `PageTitle`
  - `ListSummaryCards`
  - `AdminListCard`
  - `SearchBar`
  - `AdminDataTable`
  - `DetailDrawer`
  - `ConfirmAction`
  - `AuditLogLink`
- feature 파일
  - `src/features/assessment/model/assessment-question-bank-types.ts`
  - `src/features/assessment/model/assessment-question-bank-schema.ts`
  - `src/features/assessment/model/assessment-question-bank-store.ts`
  - `src/features/assessment/api/assessment-question-bank-service.ts`
  - `src/features/assessment/pages/assessment-question-bank-page.tsx`
- 감사 로그/라벨 처리 메모
  - `Target Type = AssessmentQuestion`
  - `Target ID = questionId`

## 14. 오픈 이슈

- 최종 `노출/숨김` 운영 정책과 실제 B2C 노출 매핑은 아직 미확정입니다.
- AI 재생성/배치 재시도/프롬프트 버전 비교 화면은 아직 포함하지 않습니다.
- EPS TOPIK / 레벨 테스트 편성 화면에서 검수 완료 문항을 선택하는 계약은 후속 문서에서 구체화해야 합니다.
