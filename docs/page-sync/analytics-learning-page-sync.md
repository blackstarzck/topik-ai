# Analytics > 학습 분석 페이지 동기화 문서

---
doc_type: admin_page_sync
module: "Analytics"
page_name: "학습 분석"
route: "/analytics/learning"
status: "구현됨"
primary_entity: "LearningAnalyticsAggregate"
primary_table_candidate: "read-only aggregate RPC"
owner_agent_scope: "shared"
last_reviewed_at: "2026-07-10"
---

## 1. 문서 목적

- TOPIK 쓰기 학습 원천과 admin 내부 분석 화면의 동기화 기준을 정리합니다.
- 실제 데이터·필터 계약은 `docs/specs/page-ia/analytics-learning-page-ia.md`와 `docs/specs/admin-data-contract.md`를 우선합니다.

## 2. 페이지 요약

| 항목 | 내용 |
| --- | --- |
| 모듈 | `Analytics` |
| 페이지명 | `학습 분석` |
| 라우트 | `/analytics/learning` |
| 현재 상태 | `구현됨` |
| 목적 | 기간·문제 유형·주제·세부 특성별 TOPIK 쓰기 성과 비교 |
| 주요 권한 | `analytics.read` |
| 연관 SoT | `docs/specs/page-ia/analytics-learning-page-ia.md`, `docs/specs/admin-data-contract.md`, `docs/specs/admin-data-usage-map.md` |

## 3. 목적과 비목표

- 목적: 학습 규모, 피드백 품질, 점수·취약 차원·주제 성과와 PDF 내보내기 사용을 같은 조건으로 분석합니다.
- 비목표: 개인 학습자 식별, 답안/첨삭 본문 열람, 학습 데이터 변경, 실제 파일 저장 완료 횟수 측정은 담당하지 않습니다.

## 4. 이 페이지에서 할 수 있는 것

| 기능 | 성격 | 결과 | 감사 로그 |
| --- | --- | --- | --- |
| 분석 조건 적용 | 조회 | 모든 KPI·분석 블록 재집계와 URL 복원 | 불필요 |
| 지표 사전 | 조회 | 정의·계산식·표본·커버리지 확인 | 불필요 |
| 분석 공유 | 조회 | 현재 조건 URL 복사 | 불필요 |
| CSV 내보내기 | 조회 | 현재 집계 결과 파일 생성 | 불필요 |

## 5. 관리 데이터베이스(CRUD)

| 엔티티 | source | CRUD | 주요 데이터 | 사용자 화면 영향 | 차이 |
| --- | --- | --- | --- | --- | --- |
| LearningAnalyticsAggregate | `get_admin_learning_analytics_filtered(...)` | Read | 8 KPI, 유형·점수·차원·주제·PDF 집계 | 내부 전용 | 개인 식별자·민감 본문 미반환 |
| LearningAnalyticsFilterOptions | `get_admin_learning_analytics_filter_options()` | Read | 주제 계층, 유형별 세부 특성 | 내부 전용 | 신규 TOPIK 쓰기 메타데이터를 read-only 참조 |

- Create/Update/Delete는 지원하지 않습니다. Read 실패 시 마지막 성공 결과와 재시도를 제공합니다.

## 6. 관리자 조치와 감사 로그 계약

- 조회·공유·클라이언트 CSV 생성만 제공하므로 파괴적 조치, Target Type/ID, 감사 로그가 없습니다.

## 7. 사용자 화면 동기화 포인트

| 사용자 화면 후보 | 영향 상태 | 공통 원천 | 반영 방식 |
| --- | --- | --- | --- |
| v13 TOPIK 쓰기 제출/피드백 | 내부 전용 | `writing_submissions`, `writing_feedback`, `feedback_dimension_scores`, `writing_submission_metrics`, `study_events` | 사용자 활동을 admin이 read-only 집계하며 사용자 UI를 변경하지 않음 |
| v13 PDF 내보내기 | 내부 전용 | `study_events.export_downloaded` | 실제 다운로드가 아닌 내보내기 완료 이벤트로 집계 |

## 8. 연관 관리자 페이지

| 페이지 | 관계 | 비고 |
| --- | --- | --- |
| Analytics > 통계 개요 | 형제 | 로그인 활성 사용자와 학습 활성 사용자 정의 구분 |
| Users > 회원 상세 > 학습 현황 | 후행 참고 | 개인 단위 상세는 이 화면이 담당 |
| Assessment > TOPIK 쓰기 문항 | 원천 참고 | 문제 유형·주제·세부 특성 메타데이터 제공 |

## 9. 상태값·용어 정합성

- 사용자 노출 용어는 `문제 유형`, `주제`, `세부 특성`, `PDF 내보내기 완료 수`를 사용합니다.
- `미수집`, `혼합`, `미분류`를 0과 구분하며 `export_downloaded`를 `실제 다운로드`로 표기하지 않습니다.

## 10. URL/검색/복원 규칙

- 기본 라우트: `/analytics/learning`.
- 복원 키: `period`, `from`, `to`, `compare`, 반복 `question`, `topicMain`, `topicDetail`, 반복 `d.<field>`.
- Drawer open과 미적용 draft는 복원하지 않습니다.

## 11. 네트워크 상태와 fail-safe

| 상태 | UI |
| --- | --- |
| pending | 최초 skeleton, 재조회 시 마지막 성공 결과 + 갱신 표시 |
| success | 현재 적용 조건과 집계 결과 표시 |
| empty | 0·미수집·미분류를 구분한 빈 상태 |
| error | 마지막 성공 결과 유지, 오류 안내와 재시도 |

## 12. 에이전트 작업 메모

- 두 RPC, mock, URL 직렬화가 같은 query/response 계약을 유지하는지 확인합니다.
- 문제 유형·주제·세부 특성이 모든 분석 블록에 동일하게 적용되는지 e2e로 검증합니다.
- B2C 노출 상태는 `내부 전용`이며 별도 사용자 화면 기능을 추정하지 않습니다.

## 13. 미확정 항목

| 항목 | 내용 | 영향 |
| --- | --- | --- |
| PDF 혼합·미분류 | 보고서·서재 선택 이벤트에 포함 문제 유형 정보가 부족하면 귀속하지 않음 | 귀속률로 표시; 실제 저장 완료 이벤트는 v13 별도 계약 필요 |
| 평가 차원·시간 커버리지 | 기존 데이터는 표본이 부족할 수 있음 | 표본·커버리지를 표시하고 임의 보정하지 않음 |
