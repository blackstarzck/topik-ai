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
last_reviewed_at: "2026-07-16"
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
| 페이지 유형 | `목록+관리 통합형 + 2depth 상세(조회 전용)` — 구 2depth 검수 페이지는 조회 전용 상세로 재작성 완료 |
| 페이지 목적 한 줄 요약 | 외부(공급) API에서 수신·적재된 TOPIK 쓰기 문항(51~54)을 비교·확인하고, 태그·노출 상태·기관 노출 매핑을 같은 목록에서 조치하는 화면입니다. |
| 주요 운영자 | `CONTENT_MANAGER, SUPER_ADMIN` |
| 주요 권한 | `assessment.question-bank.manage` |
| 코드 근거 | `src/features/assessment/pages/assessment-question-manage-page.tsx, src/features/assessment/pages/assessment-question-detail-page.tsx`(후자 = 조회 전용 상세 — 재정의 P3에서 구 검수 페이지를 개명·재작성 완료) |
| 연관 SoT 문서 | `docs/specs/page-ia/assessment-question-bank-page-ia.md`, `docs/specs/admin-data-contract.md`, `docs/specs/admin-data-usage-map.md`, `docs/specs/admin-page-tables.md`, `docs/architecture/metadata-tag-schema-transition-decision-record.md` §0 |

## 3. 이 페이지의 목적

### 목적

- 문제 발원은 **외부(공급) API**이며 상세 수신 경로가 구현됐습니다(D-11 공급 계약·변경 통지 추적). 문제 본문+메타데이터(schema-rule §4·§7, §7.9·검수 필드 제외)가 **완성 상태로 공급**되며, admin은 문제를 저작·생성·분류·검수하지 않습니다.
- 이 페이지는 수신·적재(외부 API → Supabase `topik_writing_51/52/53/54_questions` + `question_source_map`)된 문항을 확인하고, 목록 단위 관리 포인트를 처리하는 관리자 기점입니다. 2depth 상세는 조회 전용입니다.
- 성공적으로 승격된 내용 버전은 목록의 수정 횟수·확장 이력과 2depth 상세의 `버전 #<canonical_import_id>`/`변경 이력보기` 탭에서 원본 생성/수정 시각과 content/payload hash를 포함해 관리자 전용으로 조회합니다. 사용자 화면에는 버전 번호나 이력을 노출하지 않습니다.
- 관리 포인트는 **태그**(schema-rule §2: tag_master 사전 기반 `question_tags` 부여/제거), 노출 통제는 **`service_status` 컬럼**(D-6 유지: available/excluded/internal_test, 기본 internal_test), 기관별 문항 매핑은 **`topik_writing_question_institution_exposure`**입니다. 2026-06-23 통합 이후 모두 `/assessment/question-bank`에서 처리합니다.
- **기관 배정은 이 페이지에서 다루지 않습니다.** 2026-06-26 에 문항 중심 진입점(기관 컬럼·단건 설정·일괄 배정)을 제공하기로 문서화했으나 구현된 적이 없고, 문항 중심 진입점은 만들지 않기로 확정했다(2026-08-01 오너 결정). 기관별 배정은 `Users > 기관 코드`의 `노출 문항` 모달(기관 중심) 단일 경로로만 관리한다.
- v13 사용자 기능은 read-only로 소비합니다. P2 백필 466행은 초기 코퍼스로 유지되며, 신규 문항은 외부 상세 API 수신·승격 경로로 추가됩니다.
- 코드 현실: Supabase가 구성된 운영 환경은 `topik_writing` 신규 4테이블 + 추천 뷰만 조회하고, 2depth 상세는 조회 전용입니다. `VITE_QUESTION_BANK_SOURCE=legacy`와 `problems` 읽기 어댑터는 최종 canonical 전환에서 삭제했습니다. Supabase 미구성 CI·스모크 환경만 결정적 mock을 사용합니다.

### 비목표

- 문제 저작·생성·분류·검수는 admin 전체의 비목표입니다(2026-06-11 §0 — 검수 개념 전면 삭제, 품질·상태 표현은 태그로만).
- 실제 백엔드 스키마 최종 확정은 이 문서에서 담당하지 않습니다.
- 사용자 화면의 상세 UI 설계는 별도 사용자 화면 문서에서 결정합니다.
- 과거 버전 복원·재활성화와 이전 버전 대비 자동 필드 diff는 비목표입니다. `raw`·`held`·`metadata_only` 및 시각/식별 충돌 수신은 모든 원문 행을 표시하는 가져온 문항 인박스에서만 확인합니다.

## 4. 이 페이지에서 할 수 있는 것

| 기능/작업 | 설명 | 작업 성격 | 대상 데이터 | 결과 | 감사 로그 필요 여부 |
| --- | --- | --- | --- | --- | --- |
| TOPIK 쓰기 문항 목록/상세 조회 | 수신·적재된 문항의 목록(뷰)과 상세(번호별 테이블)를 조회 전용으로 확인합니다. | 조회 | AssessmentQuestion | 현재 상태 확인 | 불필요 |
| 승격 버전 이력 조회 | 목록의 수정 횟수·확장 테이블과 상세 탭에서 현재/과거 승격 버전의 payload·수신 메타데이터를 확인합니다. | 조회 | AssessmentQuestionVersion | 관리자 역추적 | 불필요 |
| 수신·적재 | `외부에서 가져오기` 또는 cron → 상류 상세 API → 인박스 무손실 적재 → §7 자동 승격. `question_received`를 인박스와 정식 문항 Target에 기록합니다. | 생성(수신) | AssessmentQuestionImport + AssessmentQuestion | 적재·승격 + 감사 로그 | 필요 |
| 태그 부여/제거·노출 상태 변경 | 더보기 메뉴/일괄 조치에서 수행합니다(P4 개방 완료 — 2026-06-11, 2026-06-23 통합). | 수정 | AssessmentQuestion + questionId | 데이터 반영 | 필요 |
| ~~기관 노출 설정/해제~~ **미제공(2026-08-01 확정)** | 이 페이지에는 기관 배정 진입점이 없다. 문항 중심 진입점은 만들지 않기로 확정했다(2026-08-01 오너 결정). 기관별 배정은 `Users > 기관 코드`의 `노출 문항` 모달(기관 중심) 단일 경로로만 관리한다. `service_status!='available'` 문항의 신규 배정이 blocked 로 안내되는 규칙은 그 기관 중심 경로에서 적용된다. | — | — | — | — |

- 제거 완료: 구 2depth 검수 페이지의 검수 메모 저장·검수 상태 변경 쓰기는 재정의 P3에서 제거 완료됐습니다(`202f905`). 현행 상세는 조회 전용입니다.

## 5. 관리 데이터베이스(CRUD)

> 아래 표는 실제 DB 확정안이 아니라 관리자 페이지 기준의 데이터 계약 후보입니다. 확정된 백엔드 스키마와 다르면 `미확정/차이`에 근거를 적습니다.

| 엔티티 후보 | 테이블 후보 | CRUD | 관리자 UI 진입점 | 주요 필드 후보 | 감사 로그 Target | 사용자 화면 영향 | 미확정/차이 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| AssessmentQuestion | topik_writing_51/52/53/54_questions + topik_writing_question_source_map(+목록용 추천 뷰) | Create(수신 적재/승격), Read, Update(관리 포인트) | TOPIK 쓰기 문항 목록/상세, 가져온 문항(인박스) | question_id, learner_problem_id(v13/FK), legacy_problem_id(과거 provenance), canonical_import_id, item_number, topic_main/topic_detail, scenario_type, situation_summary, service_status, 태그(question_tags 경유), auto_checks_passed(수신 정합 검사), content_team_memo(수신 메타데이터 — admin 쓰기 없음), created_at, updated_at | AssessmentQuestion + questionId | 확인됨(v13 read-only 소비, dev live E2E) | 신규 4테이블 + 추천 뷰가 기본 source이며, 외부 상세 payload는 별도 인박스에서 검증·승격됩니다. 외부 `question_id`는 opaque 값이고 번호별 라우팅은 `item_number`가 담당합니다. `learner_problem_id`는 v13 소유 identity 함수로만 registry에 등록하며 Admin은 registry table을 직접 변경하지 않습니다. dev v13 current-content 경로가 learner-safe RPC를 직접 읽고, 운영 적용은 별도입니다. |
| AssessmentQuestionVersion | topik_writing_question_version_summary_view + topik_writing_question_import | Read | 목록 `버전` 컬럼/확장 이력, 상세 `변경 이력보기` 탭 | question_id, canonical_import_id, version_count, revision_count, import_id, source_created_at, source_updated_at, content_hash, payload_hash, first_seen_at, last_seen_at, ingest_count, raw_payload | 없음(조회 전용) | 관리자 내부 전용 | 현재 판별은 canonical pointer만 사용합니다. `mapping_status='promoted'`만 문항관리 이력에 포함하고 metadata-only/이상 응답은 인박스에 남깁니다. 자동 diff/복원 write 없음 |
| InstitutionQuestionExposure | topik_writing_question_institution_exposure | Create, Read, Delete | 기관 노출 컬럼/설정 모달/일괄 지정·해제 | institution_code, question_id, reason, batch_id, service_status(조회 결합) | AssessmentQuestion + questionId / InstitutionCode + code | 기관 회원 전용 문항 노출 후보 | `service_status='available'`이 전역 선행 조건. `excluded`/`internal_test` 신규 매핑 추가는 blocked, 기존 매핑 제거는 허용 |

### CRUD 상세

| CRUD | 지원 여부 | 화면 동작 | 저장/서비스 후보 | 성공 후 동기화 대상 | 실패 시 fail-safe |
| --- | --- | --- | --- | --- | --- |
| Create | `지원(수신 적재/자동 승격)` | 운영자가 가져오기 버튼을 실행하거나 cron이 호출하며, 화면에서 문항을 직접 저작하지 않음 | `api/writing-tasks/ingest.ts` → 50건 단위 `admin_ingest_writing_tasks_bulk` 전부 성공 → 50개 ID 단위 `admin_promote_writing_questions` | 인박스 목록, 정식 목록/상세, 감사 로그(`question_received`) | `updated_at + content_hash` 이중 조건으로만 승격. metadata-only/시각·식별 충돌은 인박스 held, 동일 payload는 수신 횟수만 갱신. 청크 실패 시 승격 시작 전 중단 |
| Read | `지원` | 문항 목록(추천 뷰)/상세(번호별 테이블)와 승격 버전 요약·이력·과거 payload 조회 | 신규 4테이블 + 추천 뷰 + 버전 요약 뷰 + import 단일 canonical 경로 | URL/필터/`detailTab`/`versionId` 복원 | 버전 오류는 기존 목록/현재 상세와 격리, `problems`/JSON fallback 없음 |
| Update | `지원` | 태그 부여/제거와 `service_status` 변경을 이 페이지에서 수행한다. 기관 배정은 이 페이지에 진입점이 없다(2026-08-01 확정 — `Users > 기관 코드` 단일 경로). 검수 상태 변경 쓰기는 화면·facade에서 제거 완료(재정의 P3 — `202f905`), DB측 RPC의 검수 화이트리스트도 마이그레이션 `0013`에서 제거 완료(2026-06-11 적용) | `admin_update_topik_question`(service_status)/`admin_assign_question_tag`/`admin_remove_question_tag`/`admin_set_writing_question_institutions`/`admin_clear_writing_question_institutions` | 목록, 상세, 감사 로그 | 실패 또는 blocked 안내 후 재조회 |
| Delete | `미지원` | 물리 삭제 없음. 노출 제외는 `/manage`의 `service_status='excluded'` 전환으로 처리 | 없음 | 목록, 상세, 감사 로그, 사용자 노출 | 확인 모달, 사유 필수(`/manage` 계약) |

## 6. 관리자 조치와 감사 로그 계약

감사 액션 사전은 D-8 개정(2026-06-11 §0)과 2026-06-26 기관 노출 정합화를 따릅니다: 유지 = `service_status_changed`/`tag_assigned`/`tag_removed`, 기관 매핑 = `question_institutions_changed`/`question_institutions_cleared`, 수신 = `question_received`(인박스 적재 + 정식 문항 승격), 폐기 = 검수 4종(`review_completed`/`review_on_hold`/`review_revision_requested`/`review_memo_saved`)·`question_published`(push).

| 조치 | 파괴적 여부 | 확인 단계 | 사유/근거 입력 | Target Type | Target ID | 감사 로그 확인 경로 |
| --- | --- | --- | --- | --- | --- | --- |
| 수신·적재(`question_received`) | 아니요 | 시스템 기록 | 불필요(수신 메타 기록) | AssessmentQuestionImport / AssessmentQuestion | source_task_id / question_id | `/system/audit-logs?targetType=AssessmentQuestionImport&targetId={sourceTaskId}`, `/system/audit-logs?targetType=AssessmentQuestion&targetId={questionId}` |
| 태그 부여/제거(`tag_assigned`/`tag_removed`) | 아니요 | 시스템 기록 | 불필요 | AssessmentQuestion | 대상 ID | /system/audit-logs?targetType=AssessmentQuestion&targetId={targetId} |
| 노출 상태 변경(`service_status_changed`) | 예 | 필수 | 필수 | AssessmentQuestion | 대상 ID | /system/audit-logs?targetType=AssessmentQuestion&targetId={targetId} |
| 기관 노출 설정/해제(`question_institutions_changed`/`question_institutions_cleared`) | 아니요 | 모달 확인 | 필수 | AssessmentQuestion | 대상 ID | /system/audit-logs?targetType=AssessmentQuestion&targetId={targetId} |

- 폐기: 검수 액션 4종과 `question_published`(push)는 2026-06-11 §0으로 폐기됐습니다. 검수 페이지 코드는 재정의 P3에서 제거 완료(`202f905` — 기존 감사 행은 "(구)" 역사 라벨로 표시)이고, DB측 RPC(`admin_update_topik_question`)의 검수 액션 경로도 마이그레이션 `0013`에서 제거 완료됐습니다(2026-06-11 적용 — RPC 원문 검수 참조 0건).

## 7. 사용자 화면 동기화 포인트

| 사용자 화면 후보 | 영향 상태 | 관리자 데이터 | 사용자 화면에 반영되는 방식 | 동기화 필요 시점 | 비고 |
| --- | --- | --- | --- | --- | --- |
| TOPIK 쓰기 시험 화면, 문제 풀이 화면, 현재 문항 보관함·추천 화면 | 확인됨(dev) | 번호별 정식 51~54 테이블의 학습자 허용 필드, `learner_problem_id`, `service_status`, 태그, 기관 매핑, `canonical_import_id`/`payload_hash` | v13은 `get_available_writing_questions`를 통해 read-only로 직접 소비합니다. `problem_id`는 `learner_problem_id=md5(question_id)::uuid`이며 `legacy_problem_id`를 사용하지 않습니다. 최종 노출 predicate는 `service_status='available' AND (사용자 affiliation_code 없음 OR 기관 노출 모드 = 제한 없음 OR 매핑.institution_code = 사용자 affiliation_code)`이며(무소속 학습자와 `제한 없음` 모드 기관 학습자는 `available` 전체, `배정분만` 모드 기관 학습자는 자기 코드 배정분만), 정답·채점표·원시 payload는 학습자 응답에서 제외합니다. 신규·기존 canonical identity는 v13 private registry가 소유합니다. | `service_status`/기관 매핑/정식 승격 버전 변경 다음 요청 | dev에 14:00/14:10/15:00/16:00 교정을 적용해 `public.problems` writing 0건과 registry FK를 확인했습니다. desktop/mobile headed E2E로 공개·제외의 다음 요청 반영, Q51~54·Q53 chart·추천·초안·history/PDF를 확인했고 실제 provider Q54 제출→피드백 canary도 통과했습니다. 운영 적용은 별도입니다. |

### 문항 수정 시 상태별 버전 동기화

정책 SoT는 `docs/architecture/writing-question-version-policy.md`입니다.

| 사용자 상태 | 관리자 최신 버전 반영 | 과거 버전 유지 | 동기화 규칙 |
| --- | --- | --- | --- |
| 신규 풀이 | 즉시 | 아니요 | 현재 버전으로 시작 |
| 북마크 | 열람 시 | 아니요 | 북마크는 `question_id` 관계만 유지하고 최신 문항 표시 |
| 임시저장 | 재진입·제출 시 | 아니요 | 임시답안은 보존하되 최신 문항을 표시하고 호환성 검사 |
| 제출 완료·채점·피드백·결과 | 반영하지 않음 | 예 | 제출 확정 시점의 import ID/hash/문항 스냅샷 유지 |

- `updated_at`만 바뀌고 `content_hash`가 같은 `metadata_only` 수신은 canonical pointer를 바꾸지 않으므로 임시저장·열어둔 문제·제출·북마크에 영향이 없습니다.
- 실제 `content_changed`가 승격되면 활성 임시저장/열어둔 제출은 v13의 기존 canonical import/hash 충돌 가드로 저장·제출을 중단하고 답안을 보존합니다. 완료 제출 280건은 `question_snapshot` 또는 `legacy_cutover_snapshot`을 계속 사용합니다. 2026-07-16 dev 점검의 활성 임시저장 36건은 실제 승격 시 이 가드의 영향 후보입니다.
| 다시 풀기 | 새 시도 시작 시 | 기존 제출만 유지 | 새 시도는 최신, 과거 제출은 당시 버전 유지 |

사용자에게 일반 문항 수정 알림이나 버전 번호를 노출하지 않습니다. 최신 문항과 임시답안이 호환되지 않을 때만 제출을 중단하고 인라인 복구 경로를 제공합니다.

## 8. 이 페이지와 연관있는 페이지(예상)

### 관리자 페이지

| 연관 관리자 페이지 | 관계 유형 | 연관 이유 | 이동/연동 방식 | 선행/후행 관계 | 확정 상태 |
| --- | --- | --- | --- | --- | --- |
| Assessment > TOPIK 쓰기 문항(`/assessment/question-bank`) | 자기 참조 | 관리 포인트(태그 부여/제거), 노출 통제(`service_status`), 기관 노출 설정을 같은 통합 페이지가 담당 | 행 더보기/일괄 조치 | 현재 | 확정(2026-06-23 통합, 2026-06-26 기관 정합화) |
| Users > 기관 코드 | 동등 | 같은 `topik_writing_question_institution_exposure` 매핑을 기관 중심으로 관리 | 기관 코드별 노출 문항 모달 | 동등 | 확정 |
| Assessment > EPS TOPIK | 참고/후속 | TOPIK 쓰기 문항 데이터의 원본 확인 또는 후속 검증 | 식별자 또는 필터 기반 이동 | 선행 또는 후행 | 운영상 추정 |
| Assessment > 레벨 테스트 | 참고/후속 | TOPIK 쓰기 문항 데이터의 원본 확인 또는 후속 검증 | 식별자 또는 필터 기반 이동 | 선행 또는 후행 | 운영상 추정 |
| System > 감사 로그 | 필수 후행 | TOPIK 쓰기 문항 데이터의 원본 확인 또는 후속 검증 | 식별자 또는 필터 기반 이동 | 후행 | 확정 |

### 사용자 화면

| 연관 사용자 화면 후보 | 관계 유형 | 연관 이유 | 관리자 변경 후 예상 영향 | 확정 상태 |
| --- | --- | --- | --- | --- |
| TOPIK 쓰기 시험 화면 | 데이터 직접 노출 | 문항 본문+메타데이터(신규 4테이블 learner-safe projection), `service_status`, 태그 | `service_status`·태그 변경이 다음 요청의 표시/접근/추천에 즉시 반영됩니다. | 확인됨(dev live E2E) |
| 문제 풀이 화면 | 데이터 직접 노출 | 문항 본문+메타데이터(신규 4테이블 learner-safe projection), `service_status`, 태그, canonical version | 목록·검색·Q51~54 상세·Q53 차트·초안 복구가 같은 canonical version을 사용합니다. | 확인됨(dev live E2E) |
| 과거 결과/피드백/PDF 화면 | row snapshot history | 제출 `question_snapshot` 또는 불변 `legacy_cutover_snapshot` | 기존 제출을 현재 canonical 버전으로 추정하지 않고 각 제출 row에 보존된 당시 학습자 안전 snapshot을 조회합니다. mirror fallback은 사용하지 않습니다. | 확인 예정(14:00 DB 적용 후) |

## 9. 상태값/용어/키워드 정합성

| 구분 | 표준 값/용어 | 내부 코드 후보 | 사용자 노출 라벨 | 비고 |
| --- | --- | --- | --- | --- |
| 노출 상태(노출 가능/노출 제외/내부 테스트) | available/excluded/internal_test | service_status | 사용자 직접 노출 라벨 아님(노출 on/off 결과로만 반영) | D-6 확정 — 유일한 물리 노출 상태, 기본 internal_test. 기관 노출보다 우선하는 전역 차단 조건 |
| 기관 배정 상태(문항 축) | 미배정 / 기관 N곳 배정 (+ 보조 태그 `전역 미노출`) | topik_writing_question_institution_exposure + service_status | 사용자 직접 노출 라벨 아님 | 라벨 축은 "누가 보는가"가 아니라 "몇 개 기관에 배정했나"다. 2026-07-30 재정의로 확정됐다(구 라벨 `전체 공개`/`기관 한정`은 양방향 모두 거짓이어서 폐기). `service_status!='available'`이면 기존 배정이 있어도 `전역 미노출` |
| 기관 노출 모드(기관 축) | 제한 없음 / 배정분만 | topik_writing_institution_exposure_mode.exposure_mode | 사용자 직접 노출 라벨 아님 | **문항 축과 다른 축이다.** 기관 코드 단위 설정이며 `Users > 기관 코드`의 `수정`에서 바꾼다. `제한 없음`이면 그 기관 소속 학습자도 `available` 전체를 보고 배정 목록은 보존만 된다. `배정분만`이면 배정한 문항만 본다. 기본값은 `배정분만`(폴백은 항상 현행 동작). 폐기된 문항축 라벨 `전체 공개`와는 무관한 값이다 |
| 태그 그룹(추천목적/반복방지/학습흐름/운영주의/대표문제/추천사용) | tag_master 사전(schema-rule §2) | question_tags | 사용자 비노출(내부 관리 포인트) | 부여/제거는 `/manage`에서 활성(P4 개방 완료), 별도 메모 필드 없음 |
| 문항 번호 51~54 | 문항 번호 51~54 | page-specific enum candidate | 문항 번호 51~54 | 정확한 상태 세트는 IA와 데이터 계약 문서를 우선합니다. |
| 정식 문항 버전 | 승격된 인박스 버전 | canonical_import_id + payload_hash | 사용자 직접 노출 없음 | 인박스 `is_latest`와 구분합니다. 제출 snapshot과 서버 guard가 동일 버전을 검증해야 합니다. |
| 관리자 수정 횟수·이력 | 승격된 과거 버전 수와 payload | revision_count + import_id | 사용자 직접 노출 없음 | `revision_count=version_count-1`; 현재 포인터가 없으면 `버전 연결 없음`. raw/held 제외 |

- 제거 완료: 구 검수 대기/검수 완료/수정 필요/보류 상태 세트는 검수 개념 삭제(2026-06-11 §0)에 따라 재정의 P3에서 제거 완료됐습니다(`202f905`). 품질·상태 표현은 태그로만 합니다.

## 10. URL/검색/복원 규칙

- 기본 라우트: `/assessment/question-bank`
- 필수 쿼리/경로 파라미터: 없음
- 선택 쿼리 파라미터: `questionNo`(반복), `topicMain`, `topicDetail`, `questionType`, `difficulty`, `keyword`, `serviceStatus` (+ P4 예약 `tag`. 상세 전용 `detailTab=history`, `versionId=<import_id>`. 구 `reviewStatus`는 재정의 P3에서 제거 완료)
- 목록 복원 기준: 목록/필터/정렬/상세 대상 복원 (`tab` 쿼리는 제거됨)
- 상세 Drawer/Modal/하위 라우트 복원 여부: `/assessment/question-bank/:questionId`(목록 쿼리를 보존해 진입하고, 목록 복귀 시 `detailTab`/`versionId`만 제거)
- 사용자 화면 동기화에 필요한 식별자: AssessmentQuestion + questionId

## 11. 네트워크 상태와 fail-safe

| 상태 | UI 노출 | 운영자가 할 수 있는 것 | 사용자 화면 동기화 영향 |
| --- | --- | --- | --- |
| pending | pending 상태에서 목록/상세 loading 표시 | 대기 또는 취소 | 동기화 지연 |
| success | success 상태에서 데이터 표시 | 후속 조치 또는 원본 확인 | 동기화 가능 |
| empty | empty 상태에서 빈 상태와 필터 초기화 또는 등록 유도 | 필터 초기화 또는 후속 확인 | 직접 영향 없음 |
| error | error 상태에서 재시도와 마지막 성공 상태 fallback 제공 | 재시도 또는 마지막 성공 상태 확인 | 동기화 보류 |

- 버전 요약·이력·과거 상세 요청은 기존 목록/현재 상세와 분리합니다. 잘못되거나 다른 문항에 속한 `versionId`는 이력 탭에서만 차단하고 현재 버전 탭은 계속 사용할 수 있습니다.

## 12. 에이전트 작업 메모

- Codex 확인 포인트:
  - `src/features/assessment/pages/assessment-question-manage-page.tsx, src/features/assessment/pages/assessment-question-detail-page.tsx` 구현과 `docs/specs/page-ia/assessment-question-bank-page-ia.md` 문서 일치 확인 — 구 검수 페이지·검수 쓰기 경로는 재정의 P3에서 제거 완료(`202f905`)
  - 신규 4테이블 + 추천 뷰 단일 운영 경계(`topik_writing`; Supabase 미구성 시에만 mock)와 감사 로그 Target 확인
- Claude 확인 포인트:
  - 시험/문제 풀이 화면 데이터 원천에 직접 연결됩니다(v13 canonical read-only 소비). 최종 identity/FK/snapshot 교정은 dev에 적용했고 실제 cross-app headed browser를 통과했습니다.
  - 정책 문구와 노출/비노출 기준(`service_status` + 기관 매핑 predicate) 검토
- 양쪽 동기화가 필요한 결정:
  - 외부 공급 API의 장기 호환성(페이로드/식별자 변경 통지)
  - 운영 DB/Vercel에 v13 `20260714141000` local outbox를 적용할 시점과 운영 smoke 담당자
  - 검증 evidence ID를 사용한 `canonical + local_outbox_verified` 원자 활성화와 비상 `blocked + unverified` 전환 승인
  - 감사 로그 Target Type 세분화

## 13. 미확정 항목

| 항목 | 미확정 내용 | 필요한 결정 주체 | 관리자 페이지 영향 | 사용자 화면 영향 | 추적 문서 |
| --- | --- | --- | --- | --- | --- |
| 외부 공급(인바운드) API 호환성 | 현재 타입별 상세 API와 서버 자격증명 인증 계약으로 수신·감사 결선이 구현됐습니다. 남은 항목은 상류 payload/식별자 변경 시 하위 호환성과 변경 통지 절차입니다. | 외부 공급측/백엔드 | 매퍼·승격 계약 변경 시 회귀 검증 | 신규 문항 유입 안정성 | docs/specs/admin-data-contract.md §12.6, docs/specs/page-ia/assessment-question-bank-imported-page-ia.md |
| 이전 버전 대비 자동 필드 diff | 1차 관리자 이력 UI는 버전별 전체 payload 조회까지만 구현합니다. 필드 단위 변경 요약은 후속입니다. | admin/콘텐츠 운영 | 이력 탭에 diff 표현 추가 가능 | 사용자 영향 없음 | docs/architecture/writing-question-version-policy.md §7·§12, docs/specs/admin-page-gap-register.md §4.7 |
| canonical source ↔ v13 읽기·제출 | dev의 canonical 읽기와 outbox 제출 검증을 완료했습니다. 14:00/14:10/15:00/16:00 적용, FK/snapshot/mirror 삭제 대사, migration down/up, 5종 fault-injection, 실제 provider canary와 desktop/mobile headed E2E를 통과했습니다. 검증 뒤 dev는 fail-close했습니다. | v13/백엔드/Admin | 관리자 표 변경 없음, 승격 버전 역추적 강화 | 운영 적용·evidence 기반 활성화·운영 smoke만 별도 승인 필요 | docs/specs/admin-data-contract.md §12.6.1, docs/specs/admin-page-gap-register.md §4.7 |
| 기관 매핑 ↔ v13 노출 연동 | predicate `service_status='available' AND (사용자 affiliation_code 없음 OR 매핑.institution_code = 사용자 affiliation_code)`가 learner RPC(`private.is_writing_question_visible_to_user`)와 제출 guard에 반영됐고 dev 실측으로 확인했습니다(2026-07-30: 무소속 700/700, convention-vn 18/700). 운영 적용은 별도입니다. | v13/백엔드/프론트 | `/assessment/question-bank`와 `Users > 기관 코드`의 매핑 조치 활성화/감사 로그 계약 | 기관 소속 회원 대상 문항 배정 | docs/requests/v13-institution-question-exposure-handoff-2026-06-26.md |
| 기관 노출 라벨 축 재정의 | **해소(2026-07-30)** — 오너 확정으로 셀 라벨을 `미배정`/`기관 N곳 배정`, 일괄 액션명을 `기관 배정`/`배정 해제`로 재정의했습니다. 라벨 축이 "누가 보는가"에서 "몇 개 기관에 배정했나"로 바뀌어 더 이상 거짓을 말하지 않습니다. 컬럼 헤더에 규칙 한 줄을 병기하고, `Users > 기관 코드` 모달에는 규칙 Alert·배정 0건 경고문을 신설했으며 `실제 노출`→`배정`·`현재 미노출`→`전역 미노출`로 개명(e2e 스펙 8곳 동시 수정)했습니다. | 오너/프론트 | `/assessment/question-bank` 컬럼·`Users > 기관 코드` 모달 문구 | 관리자 오해 방지 | 해소 |
| 메타데이터·태그 스키마 전환(인바운드 재정의) | 2026-06-11 인바운드 전환(§0)으로 P3 이후 단계가 재정의됐습니다(검수 컷오버 → 조회 컷오버 + 검수 표면·컬럼 제거, push 트랙·P2-5 콘텐츠팀 게이트 폐기). 이 페이지는 재정의 P3에서 어댑터/타입/필터 축 전면 변경, 검수 표면 제거, 상세 라우트 개명, 본 문서 §5~§7 재검증이 수행됩니다. 세부 단계 정의는 실행계획안 2026-06-11 개정을 따릅니다. | admin(실행계획안 2026-06-11 개정 게이트) | 재정의 P3에서 어댑터/타입/필터 축 전면 변경(XL) + 검수 표면 제거 | 태그 기반 추천·노출 정책 신설 가능(후속) | docs/architecture/metadata-tag-schema-transition-decision-record.md §0, docs/메타데이터-태그-스키마-전환-실행계획안.md(2026-06-11 개정), docs/specs/admin-data-contract.md §12 |
