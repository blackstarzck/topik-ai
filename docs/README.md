# TOPIK AI Admin 문서 인덱스

## 목적

- 문서를 성격별로 분류해 탐색과 유지보수를 쉽게 합니다.
- 관리자 UI 변경 시 어떤 기준 문서를 함께 봐야 하는지 빠르게 찾을 수 있게 합니다.

## 문서 분류

- `docs/templates`
  - `admin-page-ia-template.md`

- `docs/guidelines`
  - `admin-coding-guidelines-antigravity.md`
  - `react-optimization-rule.md`
  - `typescript-essential-checklist.md`
  - `comments-rule.md`
  - `admin-design-guide-antigravity.md`
  - `admin-ux-ui-design.md`

- `docs/architecture`
  - `admin-information-architecture.md`
  - `admin-dev-stack.md`
  - `admin-frontend-architecture.md`

- `docs/specs`
  - `admin-page-analysis.md`
  - `admin-page-ia-change-log.md`
  - `admin-page-tables.md`
  - `admin-page-flows-mermaid.md`
  - `admin-user-detail-page-structure.md`
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
  - `page-ia/system-admins-page-ia.md`
  - `page-ia/system-audit-logs-page-ia.md`
  - `page-ia/system-logs-page-ia.md`
  - `page-ia/system-permissions-page-ia.md`
  - `page-ia/users-detail-page-ia.md`
  - `page-ia/users-instructor-management-page-ia.md`
  - `page-ia/users-list-page-ia.md`
  - `page-ia/users-referrals-page-ia.md`

- `docs/checklists`
  - `admin-essential-checklist.md`
  - `codex-response-completion-checklist.md`

## 운영 문서

- 실행 지침: `AGENTS.md`
- 문서 변경 로그: `logs/admin-doc-update-log.md`

## 관리 규칙

- `docs/**` 문서를 추가, 삭제, 이동하면 같은 작업에서 `docs/README.md` 인덱스를 반드시 갱신합니다.
- MD 문서를 수정하면 `logs/admin-doc-update-log.md`에 변경 요약을 기록합니다.
- 관리자 테이블, 정책 데이터, B2C 노출 위치가 바뀌면 `docs/specs/admin-data-usage-map.md`를 함께 평가하고 반영합니다.
- 페이지 목적과 화면 블록 구성이 변하면 `docs/specs/admin-page-analysis.md`, `docs/specs/page-ia/*.md`, `docs/specs/admin-page-tables.md`를 함께 검토합니다.
- 페이지별 상세 IA 문서는 `docs/templates/admin-page-ia-template.md`를 기반으로 작성하고, 변경 시 `docs/specs/admin-page-ia-change-log.md`에도 기록합니다.
