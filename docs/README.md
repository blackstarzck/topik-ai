# TOPIK AI Admin 문서 인덱스

## 목적
- 관리자 프론트엔드 문서를 주제별로 찾기 쉽게 정리한 인덱스다.
- 문서 변경 시 어떤 SoT를 함께 갱신해야 하는지 빠르게 판단할 수 있도록 유지한다.

## 문서 분류

### `docs` (루트 보고서·작업 안내서)
- `metadata-tag-schema-rule.md` — 콘텐츠팀용 TOPIK 쓰기 51~54 메타데이터·태그 작업 안내서 + 개발팀 전달용 테이블 스키마(권장안, v0.8)
- `메타데이터-태그-스키마-전환-영향도-보고서.md` — 위 권장 스키마로 DB·관리체계 전환 시의 영향도 분석 보고서
- `메타데이터-태그-스키마-전환-실행계획안.md` — 전환 착수 확정(2026-06-10) 후속 실행 계획안: P0~P6 단계, 결정 테이블(D-1~D-13), 마이그레이션/백필/코드 전환 작업 패키지와 검증 게이트(§12.3 PASS 채점)
- `v13-admin-상호보완-분석-보고서.html` — v13 ↔ admin 상호보완·커버리지 분석 보고서
- `metadata-tag-schema-transition-handoff.md` — 전환 작업 인수인계 문서(P1 PASS 시점 상태·도구·P2 다음 단계·주의사항)

### `docs/requests` (외부 발신 요청·발주 문서)
- `upstream-writing-endpoints-request-2026-06-10.md` — 상류 Writing API 업로드/노출토글 엔드포인트 신설 요청서(D-11, task52 부재 이슈 포함)
- `content-team-order-2026-06-10.md` — 콘텐츠팀 재분류 입력표·값 사전·노출 제외 기준·편차(E1/E3) 승인 발주서(D-3/D-6)
- `content-team-p2-5-sample-2026-06-11.md` — P2-5 콘텐츠팀 분류 초안 검토·승인 요청 10문항 샘플(초안 — 발신 전 검토용, 발주서 품목 1번 산출물). ⚠️ D-3 작성 주체 결정 보류 중

### `docs/templates`
- `admin-page-ia-template.md`
- `admin-page-sync-template.md`

### `docs/page-sync`
- `README.md`
- `analytics-overview-page-sync.md`
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
- `message-mail-page-sync.md`
- `message-push-page-sync.md`
- `operation-chatbot-page-sync.md`
- `operation-events-page-sync.md`
- `operation-faq-page-sync.md`
- `operation-notices-page-sync.md`
- `operation-policies-page-sync.md`
- `system-admins-page-sync.md`
- `system-audit-logs-page-sync.md`
- `system-logs-page-sync.md`
- `system-metadata-page-sync.md`
- `system-permissions-page-sync.md`
- `users-detail-page-sync.md`
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
- `metadata-tag-schema-transition-decision-record.md` — 메타데이터·태그 스키마 전환 Phase 0 결정 확정 기록(D-1~D-13 확정값 + v13 경계 합의)
- `d3-classification-ownership-decision-brief.md` — D-3 분류 작성 주체 재배정(콘텐츠팀→개발) 유지/철회 결정 브리프(외부 결정자 위임용 — 보류 중)

### `docs/harness`
- `index.md`

### `docs/specs`
- `topik-ai-service-api-reference.md`
- `admin-data-contract.md`
- `admin-page-gap-register.md`
- `admin-page-ia-change-log.md`
- `admin-page-tables.md`
- `admin-policy-source-map.md`
- `admin-page-flows-mermaid.md`
- `admin-action-log.md`
- `admin-data-usage-map.md`
- `page-ia/analytics-overview-page-ia.md`
- `page-ia/assessment-level-tests-page-ia.md`
- `page-ia/assessment-question-bank-eps-topik-page-ia.md`
- `page-ia/assessment-question-bank-page-ia.md`
- `page-ia/assessment-question-manage-page-ia.md`
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
- `page-ia/message-mail-page-ia.md`
- `page-ia/message-push-page-ia.md`
- `page-ia/operation-chatbot-page-ia.md`
- `page-ia/operation-events-page-ia.md`
- `page-ia/operation-faq-page-ia.md`
- `page-ia/operation-notices-page-ia.md`
- `page-ia/operation-policies-page-ia.md`
- `page-ia/system-admins-page-ia.md`
- `page-ia/system-audit-logs-page-ia.md`
- `page-ia/system-logs-page-ia.md`
- `page-ia/system-metadata-page-ia.md`
- `page-ia/system-permissions-page-ia.md`
- `page-ia/users-detail-page-ia.md`
- `page-ia/users-instructor-management-page-ia.md`
- `page-ia/users-list-page-ia.md`
- `page-ia/users-referrals-page-ia.md`

### `docs/checklists`
- `admin-essential-checklist.md`
- `codex-response-completion-checklist.md`

## 운영 문서
- 실행 지침: `AGENTS.md`
- 문서 변경 로그: `logs/admin-doc-update-log.md`

## 관리 규칙
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
