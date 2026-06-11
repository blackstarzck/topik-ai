# Assessment > TOPIK 쓰기 문항 목록 페이지 동기화 문서

---
doc_type: admin_page_sync
module: "Assessment"
page_name: "TOPIK 쓰기 문항 목록"
route: "/assessment/question-bank"
status: "구현됨"
primary_entity: "AssessmentQuestion"
primary_table_candidate: "topik_writing_51/52/53/54_questions"
owner_agent_scope: "shared"
last_reviewed_at: "2026-06-11"
---

## 1. 문서 목적

- 이 문서는 `TOPIK 쓰기 문항 목록`(구 `TOPIK 쓰기 문제은행`) 관리자 페이지와 사용자 화면 개발 사이의 동기화 기준을 정리합니다.
- 운영자가 이 페이지에서 어떤 관리 포인트를 다루는지, 그 데이터가 사용자 화면에 어떻게 이어질 수 있는지 추적합니다.
- 이 문서는 실제 DB 스키마 확정 문서가 아니며, 현재 관리자 프론트엔드/문서 기준의 후보 계약입니다.
- 2026-06-11 인바운드 전환(`docs/architecture/metadata-tag-schema-transition-decision-record.md` §0)에 따라 목적/가능 작업/CRUD/감사 계약을 수신·관리 모델 기준으로 재작성했습니다. 같은 날 재정의 P3 코드 컷오버(커밋 `202f905`)로 검수 표면이 제거 완료되어 "제거 예정" 병기는 "제거 완료"로 갱신했습니다(검수 4컬럼 물리 제거 마이그레이션 `0013`도 2026-06-11 적용 완료).

## 2. 페이지 요약

| 항목 | 내용 |
| --- | --- |
| 모듈 | `Assessment` |
| 페이지명 | `TOPIK 쓰기 문항 목록` (2026-06-11 재정의, 구 `TOPIK 쓰기 문제은행`) |
| 라우트 | `/assessment/question-bank`, `/assessment/question-bank/:questionId`(상세 — 재정의 P3에서 구 `…/review/:questionId` 개명 완료) |
| 현재 상태 | `구현됨` (2depth 검수 페이지 표면은 재정의 P3에서 제거 완료 — `202f905`) |
| 페이지 유형 | `목록 조회형 + 2depth 상세(조회 전용)` — 구 2depth 검수 페이지는 조회 전용 상세로 재작성 완료 |
| 페이지 목적 한 줄 요약 | 외부(공급) API에서 수신·적재된 TOPIK 쓰기 문항(51~54)을 조회 전용으로 비교·확인하는 화면입니다. 관리 포인트(태그)와 노출 통제(`service_status`)는 형제 라우트 `/assessment/question-bank/manage`가 담당합니다. |
| 주요 운영자 | `CONTENT_MANAGER, SUPER_ADMIN` |
| 주요 권한 | `assessment.questions.manage` |
| 코드 근거 | `src/features/assessment/pages/assessment-question-bank-page.tsx, src/features/assessment/pages/assessment-question-detail-page.tsx`(후자 = 조회 전용 상세 — 재정의 P3에서 구 검수 페이지를 개명·재작성 완료) |
| 연관 SoT 문서 | `docs/specs/page-ia/assessment-question-bank-page-ia.md`, `docs/specs/admin-data-contract.md`, `docs/specs/admin-data-usage-map.md`, `docs/specs/admin-page-tables.md`, `docs/architecture/metadata-tag-schema-transition-decision-record.md` §0 |

## 3. 이 페이지의 목적

### 목적

- 문제 발원은 **외부(공급) API**(미개발 상태 — 공급 계약 요청 추진, D-11 재정의)입니다. 문제 본문+메타데이터(schema-rule §4·§7, §7.9·검수 필드 제외)가 **완성 상태로 공급**되며, admin은 문제를 저작·생성·분류·검수하지 않습니다.
- 이 페이지는 수신·적재(외부 API → Supabase `topik_writing_51/52/53/54_questions` + `question_source_map`)된 문항을 **조회 전용**으로 확인하는 관리자 기점입니다.
- 관리 포인트는 **태그**(schema-rule §2: tag_master 사전 기반 `question_tags` 부여/제거 + 사유 memo), 노출 통제는 **`service_status` 컬럼**(D-6 유지: available/excluded/internal_test, 기본 internal_test)이며, 둘 다 형제 라우트 `/assessment/question-bank/manage`가 담당합니다(P4 관리 포인트 개방 완료 — 2026-06-11).
- v13 사용자 기능은 read-only로 소비합니다. 인터림(외부 API 미개발 동안): P2 백필 466행이 초기 코퍼스입니다.
- 코드 현실: 현행 코드는 facade 스위치 기본 `topik_writing`으로 신규 4테이블 + 추천 뷰를 조회하고, 2depth 상세는 조회 전용입니다(재정의 P3 컷오버 + 검수 표면 제거 완료 — `202f905`). 롤백 경로는 env `VITE_QUESTION_BANK_SOURCE=legacy`(`problems` 읽기 전용 어댑터)입니다.

### 비목표

- 문제 저작·생성·분류·검수는 admin 전체의 비목표입니다(2026-06-11 §0 — 검수 개념 전면 삭제, 품질·상태 표현은 태그로만).
- 실제 백엔드 스키마 최종 확정은 이 문서에서 담당하지 않습니다.
- 사용자 화면의 상세 UI 설계는 별도 사용자 화면 문서에서 결정합니다.

## 4. 이 페이지에서 할 수 있는 것

| 기능/작업 | 설명 | 작업 성격 | 대상 데이터 | 결과 | 감사 로그 필요 여부 |
| --- | --- | --- | --- | --- | --- |
| TOPIK 쓰기 문항 목록/상세 조회 | 수신·적재된 문항의 목록(뷰)과 상세(번호별 테이블)를 조회 전용으로 확인합니다. | 조회 | AssessmentQuestion | 현재 상태 확인 | 불필요 |
| 수신·적재(후속) | 외부(공급) API → Supabase 적재. 외부 API 미개발 상태로, 공급 연동 시 감사 액션 `question_received`와 함께 추가됩니다. | 생성(수신) | AssessmentQuestion | 적재 + 감사 로그 | 필요 |
| 태그 부여/제거·노출 상태 변경 | 이 페이지 비대상 — `/assessment/question-bank/manage`에서 수행합니다(P4 개방 완료 — 2026-06-11, RT-4 왕복 검증). | 수정 | AssessmentQuestion + questionId | 데이터 반영 | 필요(`/manage` 계약) |

- 제거 완료: 구 2depth 검수 페이지의 검수 메모 저장·검수 상태 변경 쓰기는 재정의 P3에서 제거 완료됐습니다(`202f905`). 현행 상세는 조회 전용입니다.

## 5. 관리 데이터베이스(CRUD)

> 아래 표는 실제 DB 확정안이 아니라 관리자 페이지 기준의 데이터 계약 후보입니다. 확정된 백엔드 스키마와 다르면 `미확정/차이`에 근거를 적습니다.

| 엔티티 후보 | 테이블 후보 | CRUD | 관리자 UI 진입점 | 주요 필드 후보 | 감사 로그 Target | 사용자 화면 영향 | 미확정/차이 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| AssessmentQuestion | topik_writing_51/52/53/54_questions + topik_writing_question_source_map(+목록용 추천 뷰) | Create(수신 적재 — 후속), Read | TOPIK 쓰기 문항 목록/상세 | question_id, item_number, topic_main/topic_detail, scenario_type, situation_summary, service_status, 태그(question_tags 경유), auto_checks_passed(수신 정합 검사), content_team_memo(수신 메타데이터 — admin 쓰기 없음), created_at, updated_at | AssessmentQuestion + questionId | 노출 예정(v13 read-only 소비) | 재정의 P3 컷오버 완료(`202f905`): 현행 코드 source는 신규 4테이블 + 추천 뷰(facade 기본 `topik_writing`). 검수 컬럼(review_status 등)은 화면·코드에서 제거 완료, 물리 제거도 마이그레이션 `0013`으로 완료(2026-06-11 적용) |

### CRUD 상세

| CRUD | 지원 여부 | 화면 동작 | 저장/서비스 후보 | 성공 후 동기화 대상 | 실패 시 fail-safe |
| --- | --- | --- | --- | --- | --- |
| Create | `후속(수신 적재)` | 외부(공급) API 수신 → Supabase 적재. 외부 API 미개발 — 공급 계약 회신 게이트(D-11 재정의)에 종속하며, 화면에서 직접 문항을 생성하지 않음 | 수신 파이프라인(후속) + `question_source_map` idempotency(D-4) | 목록, 상세, 감사 로그(`question_received`) | 수신 정합 검사(auto_checks_passed) 실패분 적재 보류 |
| Read | `지원` | 문항 목록(추천 뷰)/상세(번호별 테이블) 조회 | 신규 4테이블 + 추천 뷰(재정의 P3 컷오버 완료 — 롤백 시 legacy `problems` 읽기 전용 어댑터) | URL/필터 복원 | empty/error 처리, JSON fallback 없음 |
| Update | `이 페이지 미지원` | 태그 부여/제거 + `service_status` 변경은 `/manage`에서 수행(P4 개방 완료 — 2026-06-11). 검수 상태 변경 쓰기는 화면·facade에서 제거 완료(재정의 P3 — `202f905`), DB측 RPC의 검수 화이트리스트도 마이그레이션 `0013`에서 제거 완료(2026-06-11 적용) | `admin_update_topik_question`(service_status)/`admin_assign_question_tag`/`admin_remove_question_tag` | 목록, 상세, 감사 로그 | 실패 시 재조회 또는 오류 안내 |
| Delete | `미지원` | 물리 삭제 없음. 노출 제외는 `/manage`의 `service_status='excluded'` 전환으로 처리 | 없음 | 목록, 상세, 감사 로그, 사용자 노출 | 확인 모달, 사유 필수(`/manage` 계약) |

## 6. 관리자 조치와 감사 로그 계약

감사 액션 사전은 D-8 개정(2026-06-11 §0)을 따릅니다: 유지 = `service_status_changed`/`tag_assigned`/`tag_removed`(`/manage` 담당), 추가(후속) = `question_received`(수신·적재 — 공급 연동 시 추가), 폐기 = 검수 4종(`review_completed`/`review_on_hold`/`review_revision_requested`/`review_memo_saved`)·`question_published`(push).

| 조치 | 파괴적 여부 | 확인 단계 | 사유/근거 입력 | Target Type | Target ID | 감사 로그 확인 경로 |
| --- | --- | --- | --- | --- | --- | --- |
| 수신·적재(`question_received`, 후속 — 공급 연동 시 추가) | 아니요 | 시스템 기록 | 불필요(수신 메타 기록) | AssessmentQuestion | 대상 ID | /system/audit-logs?targetType=AssessmentQuestion&targetId={targetId} |
| 태그 부여/제거(`tag_assigned`/`tag_removed`) — `/manage` 담당 | 아니요 | 필수 | 필수(`question_tags.memo`) | AssessmentQuestion | 대상 ID | /system/audit-logs?targetType=AssessmentQuestion&targetId={targetId} |
| 노출 상태 변경(`service_status_changed`) — `/manage` 담당 | 예 | 필수 | 필수 | AssessmentQuestion | 대상 ID | /system/audit-logs?targetType=AssessmentQuestion&targetId={targetId} |

- 폐기: 검수 액션 4종과 `question_published`(push)는 2026-06-11 §0으로 폐기됐습니다. 검수 페이지 코드는 재정의 P3에서 제거 완료(`202f905` — 기존 감사 행은 "(구)" 역사 라벨로 표시)이고, DB측 RPC(`admin_update_topik_question`)의 검수 액션 경로도 마이그레이션 `0013`에서 제거 완료됐습니다(2026-06-11 적용 — RPC 원문 검수 참조 0건).

## 7. 사용자 화면 동기화 포인트

| 사용자 화면 후보 | 영향 상태 | 관리자 데이터 | 사용자 화면에 반영되는 방식 | 동기화 필요 시점 | 비고 |
| --- | --- | --- | --- | --- | --- |
| TOPIK 쓰기 시험 화면, 문제 풀이 화면, 결과/해설 화면 | 노출 예정 | 문항 본문+메타데이터(신규 4테이블), `service_status`, 태그 | v13 사용자 기능이 read-only로 소비합니다. 노출 on/off는 `service_status`(available/excluded/internal_test, 기본 internal_test)로만 통제합니다(`/manage` — P4 개방 완료, 2026-06-11). 상류 push(업로드/배포) 경로는 2026-06-11 §0으로 폐기됐습니다. | `service_status` 변경 시 | 인터림: v13 사용자 기능은 현행 `problems`를 읽는 중 — 신규 4테이블 소비 경로 전환은 컷오버 후속(별도 결정) |

## 8. 이 페이지와 연관있는 페이지(예상)

### 관리자 페이지

| 연관 관리자 페이지 | 관계 유형 | 연관 이유 | 이동/연동 방식 | 선행/후행 관계 | 확정 상태 |
| --- | --- | --- | --- | --- | --- |
| Assessment > TOPIK 쓰기 문항 관리(`/assessment/question-bank/manage`) | 필수 연동 | 관리 포인트(태그 부여/제거)와 노출 통제(`service_status`)는 `/manage`가 담당 | 형제 라우트 이동 | 후행 | 확정(2026-06-11 §0) |
| Assessment > EPS TOPIK | 참고/후속 | TOPIK 쓰기 문항 데이터의 원본 확인 또는 후속 검증 | 식별자 또는 필터 기반 이동 | 선행 또는 후행 | 운영상 추정 |
| Assessment > 레벨 테스트 | 참고/후속 | TOPIK 쓰기 문항 데이터의 원본 확인 또는 후속 검증 | 식별자 또는 필터 기반 이동 | 선행 또는 후행 | 운영상 추정 |
| System > 감사 로그 | 필수 후행 | TOPIK 쓰기 문항 데이터의 원본 확인 또는 후속 검증 | 식별자 또는 필터 기반 이동 | 후행 | 확정 |

### 사용자 화면

| 연관 사용자 화면 후보 | 관계 유형 | 연관 이유 | 관리자 변경 후 예상 영향 | 확정 상태 |
| --- | --- | --- | --- | --- |
| TOPIK 쓰기 시험 화면 | 데이터 노출 후보 | 문항 본문+메타데이터(신규 4테이블 — admin 조회는 재정의 P3 컷오버 완료. v13 사용자 소비 경로 전환은 후속), `service_status`, 태그 | `service_status`·태그 변경 시 표시/접근/추천이 달라질 수 있습니다. | 노출 예정 |
| 문제 풀이 화면 | 데이터 노출 후보 | 문항 본문+메타데이터(신규 4테이블 — admin 조회는 재정의 P3 컷오버 완료. v13 사용자 소비 경로 전환은 후속), `service_status`, 태그 | `service_status`·태그 변경 시 표시/접근/추천이 달라질 수 있습니다. | 노출 예정 |
| 결과/해설 화면 | 데이터 노출 후보 | 문항 본문+메타데이터(신규 4테이블 — admin 조회는 재정의 P3 컷오버 완료. v13 사용자 소비 경로 전환은 후속), `service_status`, 태그 | `service_status`·태그 변경 시 표시/접근/추천이 달라질 수 있습니다. | 노출 예정 |

## 9. 상태값/용어/키워드 정합성

| 구분 | 표준 값/용어 | 내부 코드 후보 | 사용자 노출 라벨 | 비고 |
| --- | --- | --- | --- | --- |
| 노출 상태(노출 가능/노출 제외/내부 테스트) | available/excluded/internal_test | service_status | 사용자 직접 노출 라벨 아님(노출 on/off 결과로만 반영) | D-6 확정 — 유일한 물리 노출 상태, 기본 internal_test |
| 태그 그룹(추천목적/반복방지/학습흐름/운영주의/대표문제/추천사용) | tag_master 사전(schema-rule §2) | question_tags | 사용자 비노출(내부 관리 포인트) | 부여/제거는 `/manage`에서 활성(P4 개방 완료), 사유는 `question_tags.memo` 필수 |
| 문항 번호 51~54 | 문항 번호 51~54 | page-specific enum candidate | 문항 번호 51~54 | 정확한 상태 세트는 IA와 데이터 계약 문서를 우선합니다. |

- 제거 완료: 구 검수 대기/검수 완료/수정 필요/보류 상태 세트는 검수 개념 삭제(2026-06-11 §0)에 따라 재정의 P3에서 제거 완료됐습니다(`202f905`). 품질·상태 표현은 태그로만 합니다.

## 10. URL/검색/복원 규칙

- 기본 라우트: `/assessment/question-bank`
- 필수 쿼리/경로 파라미터: 없음
- 선택 쿼리 파라미터: `questionNo`(반복), `topicMain`, `topicDetail`, `questionType`, `difficulty`, `keyword` (+ P4 예약 `tag`. 구 `reviewStatus`는 재정의 P3에서 제거 완료)
- 목록 복원 기준: 목록/필터/정렬/상세 대상 복원 (`tab` 쿼리는 제거됨)
- 상세 Drawer/Modal/하위 라우트 복원 여부: `/assessment/question-bank/:questionId`(재정의 P3에서 구 `…/review/:questionId` 개명 완료 — 목록 쿼리를 보존해 진입/복귀)
- 사용자 화면 동기화에 필요한 식별자: AssessmentQuestion + questionId

## 11. 네트워크 상태와 fail-safe

| 상태 | UI 노출 | 운영자가 할 수 있는 것 | 사용자 화면 동기화 영향 |
| --- | --- | --- | --- |
| pending | pending 상태에서 목록/상세 loading 표시 | 대기 또는 취소 | 동기화 지연 |
| success | success 상태에서 데이터 표시 | 후속 조치 또는 원본 확인 | 동기화 가능 |
| empty | empty 상태에서 빈 상태와 필터 초기화 또는 등록 유도 | 필터 초기화 또는 후속 확인 | 직접 영향 없음 |
| error | error 상태에서 재시도와 마지막 성공 상태 fallback 제공 | 재시도 또는 마지막 성공 상태 확인 | 동기화 보류 |

## 12. 에이전트 작업 메모

- Codex 확인 포인트:
  - `src/features/assessment/pages/assessment-question-bank-page.tsx, src/features/assessment/pages/assessment-question-detail-page.tsx` 구현과 `docs/specs/page-ia/assessment-question-bank-page-ia.md` 문서 일치 확인 — 구 검수 페이지·검수 쓰기 경로는 재정의 P3에서 제거 완료(`202f905`)
  - 신규 4테이블 + 추천 뷰 조회 경계(facade 기본 `topik_writing`, 롤백 env=legacy)와 감사 로그 Target 확인
- Claude 확인 포인트:
  - 시험/문제 풀이 화면 데이터 원천에 노출 예정으로 연결됩니다(v13 read-only 소비).
  - 정책 문구와 노출/비노출 기준(`service_status`) 검토
- 양쪽 동기화가 필요한 결정:
  - 외부 공급 API 계약(페이로드/식별자) 확정
  - v13 사용자 기능의 신규 4테이블 소비 경로 전환 시점
  - 감사 로그 Target Type 세분화

## 13. 미확정 항목

| 항목 | 미확정 내용 | 필요한 결정 주체 | 관리자 페이지 영향 | 사용자 화면 영향 | 추적 문서 |
| --- | --- | --- | --- | --- | --- |
| 외부 공급(인바운드) API 계약 | 문제 발원인 외부(공급) API는 미개발 상태입니다. 공급 계약(페이로드 = schema-rule §4·§7(§7.9·검수 필드 제외), idempotency 식별자 포함)은 요청서(D-11 재정의) 회신 게이트에 종속하며, 수신 연동과 `question_received` 감사 결선 시점이 미확정입니다. 종전 "상류 배포(업로드) 엔드포인트" 미확정 행은 push 폐기(2026-06-11 §0)로 본 행으로 대체됐습니다. | 기획/외부 공급측/백엔드 | 수신 적재 경로/감사 로그 계약 추가 | 신규 문항 유입 시점 | docs/architecture/metadata-tag-schema-transition-decision-record.md §0, docs/requests/upstream-writing-endpoints-request-2026-06-10.md(인바운드 기준 재작성) |
| service_status ↔ v13 노출 연동 | `service_status`(D-6 유지)가 유일한 물리 노출 상태입니다. 구판의 상류 노출 토글 엔드포인트·보상 정책(구 P6) 미확정은 push 폐기로 소멸했습니다. 남은 미확정은 v13 사용자 기능의 신규 4테이블 read-only 소비 경로 전환(현재는 `problems`를 읽음)입니다 — `/manage` write 개방(P4)은 2026-06-11 완료. | 기획/백엔드/프론트 | `/manage` 운영 조치 활성화/감사 로그 계약 | 사용자 노출 on/off | docs/specs/page-ia/assessment-question-manage-page-ia.md, docs/architecture/metadata-tag-schema-transition-decision-record.md |
| 메타데이터·태그 스키마 전환(인바운드 재정의) | 2026-06-11 인바운드 전환(§0)으로 P3 이후 단계가 재정의됐습니다(검수 컷오버 → 조회 컷오버 + 검수 표면·컬럼 제거, push 트랙·P2-5 콘텐츠팀 게이트 폐기). 이 페이지는 재정의 P3에서 어댑터/타입/필터 축 전면 변경, 검수 표면 제거, 상세 라우트 개명, 본 문서 §5~§7 재검증이 수행됩니다. 세부 단계 정의는 실행계획안 2026-06-11 개정을 따릅니다. | admin(실행계획안 2026-06-11 개정 게이트) | 재정의 P3에서 어댑터/타입/필터 축 전면 변경(XL) + 검수 표면 제거 | 태그 기반 추천·노출 정책 신설 가능(후속) | docs/architecture/metadata-tag-schema-transition-decision-record.md §0, docs/메타데이터-태그-스키마-전환-실행계획안.md(2026-06-11 개정), docs/specs/admin-data-contract.md §12 |
