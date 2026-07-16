# Assessment > 가져온 문항(인박스) IA

## 1. 문서 목적

- 외부 공급 API에서 가져와 무손실 인박스(topik_writing_question_import)에 적재된 문항을 열람하는 화면의 운영 목적, 데이터 블록, 후속 흐름을 정리합니다.
- 상류 상세 API(`/api/writing/tasks/{Q51|Q52|Q53|Q54}`)의 full payload를 인박스에 무손실 적재하고, 적재 직후 §7 정식 문항으로 자동 승격하는 현재 운영 흐름을 기준으로 합니다.

## 2. 문서 메타

| 항목 | 내용 |
| --- | --- |
| 모듈 | Assessment |
| 페이지명 | 가져온 문항(인박스) |
| 현재 상태 | 구현(조회 + 수동 수신/자동 승격) |
| 페이지 유형 | 목록/조회 + 수신 조치형 |
| 라우트 | /assessment/question-bank/imported |
| 주요 권한 | assessment.question-bank.manage |
| 주요 role | SUPER_ADMIN, CONTENT_MANAGER |
| 연관 문서 | docs/plans/question-bank-ingest-flow-plan.html, docs/specs/admin-page-tables.md |

## 3. 페이지 목표와 비목표

### 목표

- 외부 API에서 적재된 문항 목록을 번호별로 조회하고 적재 상태를 파악합니다.
- §7 정식 문항 테이블과 분리된 적재 1차 착지점(인박스)을 가시화해, 무엇이 승격됐고 무엇이 보류됐는지 확인합니다.
- 운영자가 `외부에서 가져오기`를 실행하면 서버가 상류 상세 API를 번호별로 페이지네이션 수신하고, 50건 단위 순차 적재가 모두 성공한 뒤 이번 요청 문항 ID를 50개 단위로 자동 승격합니다. 기존 보류 backlog는 이 버튼 실행만으로 재처리하지 않습니다.

### 비목표

- 이 화면은 문항 본문·정답을 직접 저작하거나 편집하지 않습니다(인바운드 모델 §0).
- 이 화면은 상류 자격증명이나 service-role 키를 브라우저에 노출하지 않습니다. 브라우저는 관리자 access token만 서버 함수에 전달합니다.

## 4. 운영자 사용 시나리오

- 시나리오 1: 운영자가 적재된 가져온 문항 목록을 번호/제목/주제 기준으로 훑습니다.
- 시나리오 2: 운영자가 적재 상태, 최근 수신본 여부, 이력 판정(`initial`/`content_changed`/`metadata_only`/이상 시각·식별 충돌), 원본 생성/수정 시각과 보류 사유를 점검합니다.
- 시나리오 3: 운영자가 `외부에서 가져오기`를 실행하고 내용 변경/메타데이터만 변경/보류/승격 건수 피드백을 확인합니다.

## 5. 화면 구조

| 영역 | 목적 | 주요 데이터 | 주요 액션 | 다른 관리자 페이지 영향 | 사용자 화면 영향 |
| --- | --- | --- | --- | --- | --- |
| 상단 요약 | 적재 규모 파악 | 전체/번호별(51·52·53·54) 건수 | 없음 | 후속 보강 우선순위 판단 | 간접 영향 |
| 상단 액션 | 외부 문항 수신 | 상류 Q51~Q54 상세 응답 | 외부에서 가져오기 | 인박스 적재·§7 자동 승격·감사 기록 | 승격 후 간접 영향 |
| 본문 영역 | 모든 원문 수신 행 비교·확인 | 소스 ID, 번호, 제목, 주제, 난이도, 생성 출처, 적재 상태, 최근 수신본, 이력 판정, 원본 생성/수정 시각, content hash, 판정 사유, 최근 수신 | 정렬·필터 | §7 정식 문항과 분리 | 간접 영향 |

- 본문 상단의 정적 인박스 설명 Alert는 노출하지 않습니다. 모크 모드, pending, error처럼 운영자가 현재 상태와 복구 경로를 판단하는 Alert만 조건부로 유지합니다.

## 6. 데이터 블록 정의

### 상단 요약 데이터
- 전체 수신 행 건수, 51/52/53/54 번호별 수신 행 건수. 같은 `question_id`의 과거 원문도 별도 행으로 포함합니다.

### 본문 데이터
- 소스 ID(`source_task_id`), 문항 번호(`item_number`), 제목/주제/난이도/생성 출처(`raw_payload` 파생)
- 적재 상태(`mapping_status`), 최근 수신본(`is_latest`: 서비스 현재 버전이 아니라 마지막으로 받은 원문), 이력 판정(`version_decision`), 판정/보류 사유(`hold_reason`)
- 원본 생성 시각(`source_created_at`), 원본 수정 시각(`source_updated_at`), 실제 학습·채점 내용 해시(`content_hash`), 최초/최근 수신과 수신 횟수

## 7. 액션 정의

| 액션 | 성격 | 대상 식별 기준 | 확인/사유 필요 여부 | 성공 후 피드백 | 감사 로그 확인 경로 |
| --- | --- | --- | --- | --- | --- |
| 목록 조회 | 조회 | source_task_id | 불필요 | 목록 렌더 | 조회 액션이므로 별도 감사 로그는 적재(question_received) 흐름으로 대체합니다. |
| 다시 시도 | 조회 | - | 불필요 | 재조회 | 해당 없음 |
| 외부에서 가져오기 | 수신/적재 | 상류 source_task_id(question_id) | 불필요(멱등 적재) | inserted/new_version/metadata_only/held/unchanged/failed 및 promoted/held 요약 후 목록 재조회 | `/system/audit-logs?targetType=AssessmentQuestionImport&targetId={sourceTaskId}`, 승격 후 `/system/audit-logs?targetType=AssessmentQuestion&targetId={questionId}` |

## 8. 상태값/정책/운영 규칙

| 항목 | 현재 상태 | 관리자 페이지 영향 | 사용자 화면 영향 | 추후 결정 필요 내용 |
| --- | --- | --- | --- | --- |
| 적재 상태값 | 확정 | raw/mapped/promoted/held 4값으로 적재 단계를 표시합니다. | 승격 전 문항은 사용자에게 노출되지 않습니다. | 없음 |
| 무손실 적재 | 확정 | 외부 상세 응답 원문을 verbatim+버전 보존하고 동일 payload 재수신은 unchanged로 처리합니다. | 직접 노출 없음 | 없음 |
| 변경 이력 판정 | 확정 | 같은 `question_id`에서 더 최신 `source_updated_at`과 다른 `content_hash`가 함께 확인된 경우만 `content_changed` 승격 후보입니다. `updated_at`만 달라진 응답은 `metadata_only`, 과거/동일 시각 내용 충돌·식별 충돌·잘못된 시각은 보류합니다. | 실제 승격된 내용 변경만 v13의 기존 draft/submit 충돌 가드를 실행합니다. | 공급 API `updated_at` non-null 선행 |
| `is_latest` 의미 | 확정 | 같은 문항군에서 마지막으로 받은 원문 행 표시입니다. 모든 수신 행을 목록에 보존해 표시하며 서비스 현재 버전은 `question_source_map.canonical_import_id`로만 판별합니다. | 직접 사용 금지 | 없음 |
| 감사 추적 | 확정 | 인박스 적재 시 `AssessmentQuestionImport`, 승격 시 `AssessmentQuestion` Target으로 `question_received`를 기록합니다. | 직접 노출 없음 | 없음 |

## 9. 다른 관리자 페이지 영향

| 대상 페이지 | 영향 내용 | 연동 방식 | 선행/후행 관계 |
| --- | --- | --- | --- |
| Assessment > TOPIK 쓰기 문항 목록 | 승격 시 §7 정식 목록으로 합류 | 적재 → 보강 → 승격 | 선행 관계 |
| System > 감사 로그 | 적재 이벤트(question_received) 추적 | 딥링크 | 적재 후 |

## 10. 사용자 화면/B2C 영향 참고

| 사용자 화면 후보 | 영향 상태 | 이 페이지 데이터가 반영되는 방식 | 비고 |
| --- | --- | --- | --- |
| 쓰기 연습/제출 화면 | 노출 예정 | 승격된 문항이 §7로 합류한 뒤 사용자에게 제공 | 승격 전 비노출 |

## 11. URL/상태 복원

- 기본 라우트: /assessment/question-bank/imported
- 필수 쿼리 파라미터 후보: page, pageSize
- 유지되어야 하는 상태: 목록 페이지네이션/정렬 상태

## 12. 네트워크 상태와 fail-safe

- pending: loading 안내를 표시하고 직전 성공 데이터가 있으면 유지합니다.
- success: 정상 결과를 렌더링합니다.
- empty: 가져온 문항이 없음을 적재 스크립트 안내와 함께 표시합니다.
- error: 오류 메시지와 다시 시도 버튼을 노출합니다.
- 요청 취소/재시도: 화면 이탈 시 abort, 조회 실패 시 retry. 수신 실패는 서버의 JSON 오류를 표시하고, 비 JSON 응답은 서버 함수 시작 오류로 안내합니다.

## 13. 구현 메모

- 현재 코드베이스에서 재사용할 컴포넌트: PageTitle, ListSummaryCards, AdminListCard, AdminDataTable
- feature 파일: `assessment-imported-tasks-page.tsx`, `imported-tasks-service.ts`, 서버 전용 `writing-task-ingest-mapper.ts`
- 서버 함수: `api/writing-tasks/ingest.ts` — 수동 POST(관리자 JWT)와 cron GET(`CRON_SECRET` + `INGEST_SYSTEM_ACTOR_ID`)을 분리하고, 중복 `question_id` 응답을 쓰기 전에 차단하며 50건 적재 → 전 청크 성공 → 50개 ID 승격 순서를 지킵니다.
- 권한/로그 처리 메모: 읽기는 인박스 테이블 admin SELECT RLS, 쓰기는 서버 service-role + `admin_ingest_writing_tasks_bulk`/`admin_promote_writing_questions` RPC 단일 경로입니다.

## 14. 오픈 이슈

- 2026-07-16 실응답 사전 점검에서 대상 701건의 `updated_at`이 모두 null입니다. 공급 API가 UTC ISO-8601 non-null 계약을 먼저 배포하고 `updated_at >= created_at`, 문항 ID 중복 0건, 문항군 `created_at` 불변 검증을 통과하기 전에는 신규 이력 판정 마이그레이션을 dev/운영 DB에 적용하지 않습니다.
- 배포 검증은 인증 없는 POST의 JSON 401/설정 오류 시작 프로브, 관리자 수동 수신 E2E, statement timeout 없는 전체 701건 청크 처리를 포함합니다.

## 15. 정식 카탈로그 연결과 컷오버 경계 (2026-07-13)

- 인박스의 `is_latest`는 외부 API에서 **마지막으로 수신한 원문 행**이라는 뜻이며, `source_updated_at`이 가장 최신이거나 사용자에게 제공할 정식 버전이라는 뜻이 아닙니다. 새 행이 수신돼도 승격되지 않았다면 기존 정식 문항 노출을 바꾸지 않습니다.
- 마이그레이션 `20260713080015`(공유 dev DB 적용 2026-07-14·운영 미적용)은 `learner_problem_id=md5(question_id)::uuid`로 v13/FK 식별자를 고정하고, `canonical_import_id`로 정식 문항과 정확한 인박스 버전을 연결합니다. `legacy_problem_id`는 과거 ETL provenance로만 보존하며 해당 인박스 행의 `payload_hash`를 제출 버전 식별에 사용합니다.
- 관리자 목록의 `promoted`/`held` 상태는 수신·승격 운영 확인용입니다. 학습자 화면은 인박스 원시 payload를 읽지 않고 번호별 정식 테이블의 허용 필드만 반환하는 `get_available_writing_questions`를 사용해야 합니다.
- 교정 마이그레이션 `20260714150000`(dev 적용·운영 미적용)부터 승격은 v13 소유 `private.ensure_writing_problem_identity`만 호출해 기존 pinned identity와 신규 identity를 등록·검증합니다. Admin은 registry table에 FK/직접 DML을 추가하지 않습니다. 현재 문항 본문·정답의 유일한 SoT는 번호별 정식 51~54 테이블과 source map입니다.
- v13 `20260714140000`/`20260714141000`/`20260714160000`, Admin `20260714150000`은 dev에 적용했습니다. writing FK를 private identity registry로 이관하고 기존 초안·제출에 불변 learner-safe `legacy_cutover_snapshot`을 백필한 뒤 `public.problems` writing 행을 0건으로 만들었습니다. migration down/up, outbox 5종 fault-injection, 실제 provider Q54 제출→피드백, 최신 v13 `origin/main` 기반 cross-app desktop/mobile headed E2E를 통과했고 검증 뒤 dev는 fail-close했습니다. 운영 적용·evidence 활성화·운영 smoke 전에는 서비스 재개를 차단합니다.
