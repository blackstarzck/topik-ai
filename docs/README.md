# TOPIK AI Admin Docs Index

## 목적
- 루트에 흩어진 문서를 성격별 폴더로 분류해 탐색성과 유지보수성을 높입니다.

## 문서 분류
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
  - `admin-page-tables.md`
  - `admin-page-flows-mermaid.md`
  - `admin-user-detail-page-structure.md`
  - `admin-action-log.md`
- `docs/checklists`
  - `admin-essential-checklist.md`
  - `codex-response-completion-checklist.md`

## 운영 문서
- 실행 지침: `AGENTS.md` (루트 고정)
- 문서 변경 로그: `logs/admin-doc-update-log.md`

## 관리 규칙
- `docs/**`에 문서를 추가/삭제/이동하면 같은 작업에서 `docs/README.md` 인덱스를 반드시 갱신합니다.
- MD 변경이 있으면 `logs/admin-doc-update-log.md`에 변경 요약을 반드시 기록합니다.
- 루트 경로 변경 안내는 `MOVED_DOCS.md`에서 관리합니다.
