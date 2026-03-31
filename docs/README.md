# TOPIK AI Admin 문서 인덱스

## 목적
- 관리자 프론트엔드 문서를 주제별로 찾기 쉽게 정리한 인덱스다.
- 문서 변경 시 어떤 SoT를 함께 갱신해야 하는지 빠르게 판단할 수 있도록 유지한다.

## 문서 분류

### `docs/templates`
- `admin-page-ia-template.md`

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

### `docs/harness`
- `index.md`

### `docs/specs`
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
