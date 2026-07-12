# TOPIK AI Admin 문서 인덱스

## 목적
- 관리자 프론트엔드 문서를 주제별로 찾기 쉽게 정리한 인덱스다.
- 문서 변경 시 어떤 SoT를 함께 갱신해야 하는지 빠르게 판단할 수 있도록 유지한다.

## 문서 분류

### `docs` (루트 보고서·작업 안내서)
- `metadata-tag-schema-rule.md` — 콘텐츠팀용 TOPIK 쓰기 51~54 메타데이터·태그 작업 안내서 + 개발팀 전달용 테이블 스키마(권장안, v0.8)
- `메타데이터-태그-스키마-전환-영향도-보고서.md` — 위 권장 스키마로 DB·관리체계 전환 시의 영향도 분석 보고서
- `메타데이터-태그-스키마-전환-실행계획안.md` — 전환 실행 계획안(2026-06-11 인바운드 개정): P0~P6 단계 — P3=읽기 컷오버+검수 표면·컬럼 제거, P4=관리 포인트(태그·노출) 개방, P6=외부 공급 API 수신 연동 — 와 검증 게이트(§12.3 PASS 채점)
- `v13-admin-상호보완-분석-보고서.html` — v13 ↔ admin 상호보완·커버리지 분석 보고서
- `metadata-tag-schema-transition-handoff.md` — 전환 작업 인수인계 문서(인바운드 전환 직후 상태·재정의 P3 절차·주의사항)
- `알림-기능-개발-실행계획안.md` — 알림(Notification) 기능 개발 실행계획안 rev3(채널 4종·class 정책·발송 이력 3계층·검증 게이트 V-0~V-6)
- `알림-기능-구현-페이즈-가이드.md` — 알림 기능 에이전트 실행용 작업 패키지 분해(WP0-1~WP4-3, 휴먼 결정 게이트 H-1~H-5)
- `알림-기능-QA-시나리오.md` — 알림 기능 게이트별 상세 QA 시나리오(약 80건, 빈발 버그 매핑)
- `api-inventory-backend-handoff.md` — v13 ↔ topik-ai 백엔드 API 인벤토리·핸드오프 참고 문서

### `docs/requests` (외부 발신 요청·발주 문서)
- `v13-dashboard-kpi-writing-source-handoff-2026-07-09.md` — v13 대시보드/성장 KPI가 빈 `problem_attempts`를 읽어 오늘/누적 제출·연속 학습일이 항상 0인 문제를 쓰기 원천(`writing_submissions`+`study_events`)으로 재정의하는 handoff(참고 계산식·영향 파일·검증 기준)
- `v13-pdf-export-quota-handoff-2026-07-07.md` — v13 PDF 내보내기 쿼터 handoff 사본(원본은 v13 저장소 docs 폴더의 `handoff-pdf-export-quota-topik-ai.md`). DB 계약, admin 필수 기능, 보안 경계, 인수 테스트 기준
- `v13-institution-invitation-handoff-2026-07-07.md` — 기관 회원 추가가 동의 기반 초대로 전환된 뒤 v13 알림함에서 수락/거부 모달과 `respond_institution_invitation` RPC를 구현하기 위한 handoff
- `v13-users-registration-lifecycle-handoff-2026-06-26.md` — v13 사용자 앱의 이메일 인증·필수 약관 동의·정상 진입 불변식 정합화 handoff(DB/RLS guard, auth completion route, dry-run/backfill, QA 기준)
- `v13-institution-question-exposure-handoff-2026-06-26.md` — v13 사용자 화면에 기관별 TOPIK 쓰기 문항 노출 계약을 적용하기 위한 handoff(관리 SoT, v13 영향 파일, 공통 predicate, 검증 기준)
- `v13-institution-invitation-handoff-2026-07-07.md` — v13 기관 초대 수락/거절/만료/알림 처리 handoff
- `upstream-writing-endpoints-request-2026-06-10.md` — TOPIK 쓰기 문항 공급(인바운드) API 계약 요청서(D-11 재정의 — 2026-06-11 재작성, 구 push 업로드 요청 폐기)
- `problems-read-only-freeze-notice-2026-06-11.md` — v13 `problems` read-only 동결 선언 공지 초안(§7.1-6 이행 — 오너 채널 발신용, 코드 0줄)
- `content-team-order-2026-06-10.md` — [폐기] 콘텐츠팀 재분류 입력표 승인 발주서(인바운드 전환으로 트랙 소멸 — 미발신 종결, 역사 보존)
- `content-team-p2-5-sample-2026-06-11.md` — [폐기] P2-5 10문항 샘플 검토 시트(인바운드 전환으로 게이트 소멸 — 미발신 종결, 역사 보존)

### `docs/templates`
- `admin-page-ia-template.md`
- `admin-page-sync-template.md`

### `docs/page-sync`
- `README.md` — 폴더 목적·13개 섹션 구조·DB=후보 계약/SoT 관계·상태 표기 규칙·모듈별 문서 목록(구현됨30/placeholder10) 인덱스
- `analytics-overview-page-sync.md`
- `analytics-learning-page-sync.md` — 학습 분석의 다차원 필터, read-only 집계, PDF 내보내기 귀속과 B2C 내부 전용 경계
- `assessment-level-tests-page-sync.md`
- `assessment-question-bank-eps-topik-page-sync.md`
- `assessment-question-bank-page-sync.md`
- `commerce-coupons-page-sync.md`
- `commerce-payments-page-sync.md`
- `commerce-points-page-sync.md`
- `commerce-refunds-page-sync.md`
- `commerce-store-page-sync.md`
- `community-posts-page-sync.md`
- `community-reports-page-sync.md`
- `content-badges-page-sync.md`
- `content-library-page-sync.md`
- `content-missions-page-sync.md`
- `content-vocabulary-multiple-choice-page-sync.md`
- `content-vocabulary-page-sync.md`
- `content-vocabulary-sonagi-page-sync.md`
- `dashboard-page-sync.md`
- `message-groups-page-sync.md`
- `message-history-page-sync.md`
- `message-inapp-page-sync.md`
- `message-mail-page-sync.md`
- `message-push-page-sync.md`
- `operation-chatbot-page-sync.md`
- `operation-events-page-sync.md`
- `operation-faq-page-sync.md`
- `operation-notices-page-sync.md`
- `operation-pdf-quota-page-sync.md` — PDF 내보내기 쿼터 정책/초기화 관리와 v13 내보내기 429 흐름의 동기화 기준
- `operation-policies-page-sync.md`
- `system-admins-page-sync.md`
- `system-audit-logs-page-sync.md`
- `system-logs-page-sync.md`
- `system-metadata-page-sync.md`
- `system-permissions-page-sync.md`
- `users-detail-page-sync.md`
- `users-institution-codes-page-sync.md`
- `users-instructor-management-page-sync.md`
- `users-list-page-sync.md`
- `users-referrals-page-sync.md`

### `docs/guidelines`
- `admin-coding-guidelines-antigravity.md`
- `react-optimization-rule.md`
- `typescript-essential-checklist.md`
- `comments-rule.md`
- `admin-design-guide-antigravity.md`
- `admin-detail-drawer-guidelines.md`
- `admin-ux-ui-design.md`

### `docs/architecture`
- `admin-overview.md`
- `admin-data-source-transition.md`
- `users-registration-lifecycle-v13-handoff.md` — 이메일 미인증/약관 동의/회원 상태 불변식과 v13 원천 스키마·백필 요청 handoff(2026-06-26)
- `shared-supabase-schema-ownership.md` — 공유 Supabase 스키마 소유권 매트릭스(객체별 owner/writer/reader/RLS/migration home — 2026-06-12 알림 기능 WP0-1)
- `metadata-tag-schema-transition-decision-record.md` — 메타데이터·태그 스키마 전환 결정 기록(**§0 = 2026-06-11 인바운드 모델 전환 확정** + D-1~D-13 처분 + v13 경계 합의)
- `d3-classification-ownership-decision-brief.md` — [폐기] D-3 분류 작성 주체 결정 브리프(인바운드 전환으로 목적 소멸 — 역사 보존)

### `docs/harness`
- `index.md`

### `docs/runbooks`
- `notification-worker-production-verification.md` — v13 transition email worker를 topik-ai production worker로 넘기기 전/후 SOT, Vercel readiness, smoke, cross-app state evidence를 기록하는 운영 검증 runbook
- `notification-worker-production-evidence.example.md` — 실제 production evidence 파일 작성 시 secret 값을 남기지 않도록 돕는 redacted 예시 문서
- `admin-account-separation-prod-cutover.md` — 관리자 계정 분리 production cutover 적용 순서·검증·롤백 runbook

### `docs/swagger-api`
- 상류 `TalkPik AI Service` API(Swagger) 스냅샷을 그룹별로 분리한 참조 문서다. 구 단일 문서 `topik-ai-service-api-reference.md`를 대체한다(생성 기준일 2026-06-17, Swagger UI `https://api.dotoretopik.com/docs`).
- **admin 경계 주석**: admin은 이 상류 API로 문항을 push/배포하지 않는다 — 인바운드 수신 모델(결정 기록 `docs/architecture/metadata-tag-schema-transition-decision-record.md` §0). Writing API(`GET /api/writing/tasks` 등)는 v13 사용자 노출용이며 admin 배포 대상이 아니다.
- `swagger-api/README.md` — 폴더 진입점·권장 읽기 순서·v13 Writing 연결 핵심
- `swagger-api/openapi-reference.md` — 전체 endpoint/schema 색인(72 paths·74 operations·118 schemas)
- `swagger-api/auth-and-errors.md` — 인증 헤더(`Bearer`/`X-API-Key`)·응답/에러 코드
- `swagger-api/writing-api-v13-screen-map.html` — v13 Writing 화면 연결 맵(HTML)
- 엔드포인트: `swagger-api/endpoints/admin-campaign.md`, `swagger-api/endpoints/admin-eval.md`, `swagger-api/endpoints/admin-users.md`, `swagger-api/endpoints/eval-auth.md`, `swagger-api/endpoints/evaluation.md`, `swagger-api/endpoints/external-campaign.md`, `swagger-api/endpoints/listening.md`, `swagger-api/endpoints/reading.md`, `swagger-api/endpoints/writing.md`
- 스키마: `swagger-api/schemas/index.md`, `swagger-api/schemas/common.md`, `swagger-api/schemas/admin-campaign.md`, `swagger-api/schemas/admin-eval.md`, `swagger-api/schemas/admin-users.md`, `swagger-api/schemas/eval-auth.md`, `swagger-api/schemas/evaluation.md`, `swagger-api/schemas/external-campaign.md`, `swagger-api/schemas/listening.md`, `swagger-api/schemas/reading.md`, `swagger-api/schemas/writing.md`

### `docs/specs`
- `admin-data-contract.md`
- `notification-contract.md` — 알림 채널/class/template_key/status/dedupe 단일 계약 (2026-06-12)
- `admin-page-gap-register.md`
- `admin-page-ia-change-log.md`
- `admin-page-tables.md`
- `admin-policy-source-map.md`
- `admin-page-flows-mermaid.md`
- `admin-action-log.md`
- `admin-data-usage-map.md`
- `page-ia/analytics-overview-page-ia.md`
- `page-ia/analytics-learning-page-ia.md` — 학습 분석(`/analytics/learning`): 기간·문제 유형·주제·세부 특성 통합 필터, KPI/분포/취약 차원/주제/PDF 내보내기 집계 계약
- `page-ia/assessment-level-tests-page-ia.md`
- `page-ia/assessment-question-bank-eps-topik-page-ia.md`
- `page-ia/assessment-question-bank-page-ia.md` — TOPIK 쓰기 문항 통합 페이지(조회 + 노출/태그 관리, route-backed 탭 문항/가져온 문항) — 2026-06-23 IA 통합
- `page-ia/assessment-question-bank-imported-page-ia.md` — 가져온 문항(인박스): 외부 공급 API 수신·검수 완료분 승격(`/assessment/question-bank/imported` 탭)
- `page-ia/assessment-question-manage-page-ia.md` — [supersede] 구 관리 페이지(`/assessment/question-bank/manage` → bank로 redirect), bank 통합 문서로 승계
- `page-ia/commerce-coupons-page-ia.md`
- `page-ia/commerce-payments-page-ia.md`
- `page-ia/commerce-points-page-ia.md`
- `page-ia/commerce-refunds-page-ia.md`
- `page-ia/commerce-store-page-ia.md`
- `page-ia/community-posts-page-ia.md`
- `page-ia/community-reports-page-ia.md`
- `page-ia/content-badges-page-ia.md`
- `page-ia/content-library-page-ia.md`
- `page-ia/content-missions-page-ia.md`
- `page-ia/content-vocabulary-multiple-choice-page-ia.md`
- `page-ia/content-vocabulary-page-ia.md`
- `page-ia/content-vocabulary-sonagi-page-ia.md`
- `page-ia/dashboard-page-ia.md`
- `page-ia/message-groups-page-ia.md`
- `page-ia/message-history-page-ia.md`
- `page-ia/message-inapp-page-ia.md`
- `page-ia/message-mail-page-ia.md`
- `page-ia/message-push-page-ia.md`
- `page-ia/operation-chatbot-page-ia.md`
- `page-ia/operation-events-page-ia.md`
- `page-ia/operation-faq-page-ia.md`
- `page-ia/operation-notices-page-ia.md`
- `page-ia/operation-pdf-quota-page-ia.md` — PDF 내보내기 제한(쿼터 정책 + 개인/기관 코드/전체 초기화, v13 소유 테이블 admin RPC 관리)
- `page-ia/operation-policies-page-ia.md`
- `page-ia/system-admins-page-ia.md`
- `page-ia/system-audit-logs-page-ia.md`
- `page-ia/system-logs-page-ia.md`
- `page-ia/system-metadata-page-ia.md`
- `page-ia/system-permissions-page-ia.md`
- `page-ia/users-detail-page-ia.md`
- `page-ia/users-institution-codes-page-ia.md` — 기관 코드 관리(`/users/institution-codes`): 유입 코드, 소속 회원, 기관별 문항 노출 모달
- `page-ia/users-instructor-management-page-ia.md`
- `page-ia/users-list-page-ia.md`
- `page-ia/users-referrals-page-ia.md`

### `docs/checklists`
- `admin-essential-checklist.md`
- `codex-response-completion-checklist.md`
- `users-learning-data-collection-report-and-plan.md` — v13 사용자 화면의 TOPIK 쓰기 학습 데이터 수집 가능성, 추가 수집 후보, topik-ai Admin read contract/page 준비 범위를 함께 정리한 조사 보고서 및 실행 계획안
- `users-learning-overview-v13-alignment-checklist.md` — Admin `Users > 회원 상세 > 학습 현황` 요약 컨텐츠와 v13 사용자 화면의 실제 데이터 수집 경로를 대사하기 위한 체크리스트

### `docs/plans`
- `plans/assessment-ia-consolidation-plan.md` — 평가 메뉴 IA 통합 실행계획(쓰기 3페이지 → 메뉴 1 + route-backed 탭 2: 문항/가져온 문항) — 2026-06-23
- `plans/auth-email-template-management-plan.md` — 인증메일(Supabase Auth) 템플릿 관리와 커스텀 도메인 연동 실행 계획

## 운영 문서
- 실행 지침: `AGENTS.md`
- 문서 변경 로그: `logs/admin-doc-update-log.md`
- Supabase 마이그레이션 디렉터리/네임스페이스 안내(`docs/` 밖, 외부 참조): `supabase/README.md`

## 관리 규칙
- `Users > 회원 상세` 학습 현황 탭의 계약은 기존 SoT(`admin-data-contract`, `users-detail-page-ia`, `users-detail-page-sync`, `admin-data-usage-map`, `shared-supabase-schema-ownership`, `admin-action-log`)에서 추적하고, v13 사용자 화면의 실제 수집 경로 대사는 `docs/checklists/users-learning-overview-v13-alignment-checklist.md`로 수행한다. TOPIK 쓰기 학습 데이터 수집 항목과 v13/topik-ai 양 프로젝트 실행 경계는 `docs/checklists/users-learning-data-collection-report-and-plan.md`를 기준 참고 문서로 사용한다.
- 상위 개요, 메뉴 구조, 라우팅, 역할, 페이지 상태는 `docs/architecture/admin-overview.md`를 우선 확인한다.
- 하네스 구조와 기본 검증 명령은 `docs/harness/index.md`를 우선 확인한다.
- `docs/**` 문서를 추가/삭제/이동하면 같은 작업에서 `docs/README.md`를 반드시 갱신한다.
- MD 문서를 수정하면 `logs/admin-doc-update-log.md`에 변경 요약을 기록한다.
- 사용자 요구사항이 MD 문서 수정/삭제와 직접 관련되면 같은 작업에서 해당 MD를 즉시 갱신한다.
- 운영/정책 관련 내용은 구현과 별개로 지속 모니터링 대상으로 두고, 변경 여부와 영향도를 결과에 기록한다.
- 구조/문서 드리프트 검증은 기본적으로 `npm run harness:check`를 사용한다.
- 행 클릭 상세 Drawer 규칙이 바뀌면 `docs/guidelines/admin-detail-drawer-guidelines.md`와 관련 IA 문서를 함께 갱신한다.
- 관리자 테이블/정책/B2C 노출 위치가 바뀌면 `docs/specs/admin-data-usage-map.md`를 함께 평가하고 반영한다.
- 엔티티명, 테이블명 후보, 컬럼/필드명, 변수명, enum/code table 후보, schema candidate 분류가 바뀌면 `docs/specs/admin-data-contract.md`를 함께 평가하고 반영한다.
- API/mock/데이터베이스/응답 스키마/repository-service 경계/더미데이터 SoT 구조가 바뀌면 `docs/architecture/admin-data-source-transition.md`를 함께 평가하고 반영한다.
- 페이지 목적, 운영 플로우, 데이터 계약, 감사 로그 계약, URL 복원 규칙, 상세 진입 패턴의 미확정/누락/오구현 항목을 새로 발견하거나 해소하면 `docs/specs/admin-page-gap-register.md`를 같은 작업에서 반드시 갱신한다.
