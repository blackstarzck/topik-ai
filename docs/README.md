# TOPIK AI Admin 문서 인덱스

## 목적

- 문서를 성격별로 분류해 탐색과 유지보수를 쉽게 합니다.
- 관리자 UI 변경 시 어떤 기준 문서를 함께 봐야 하는지 빠르게 찾을 수 있게 합니다.

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
  - `admin-page-ia-drafts.md`
  - `admin-page-tables.md`
  - `admin-page-flows-mermaid.md`
  - `admin-user-detail-page-structure.md`
  - `admin-action-log.md`
  - `admin-data-usage-map.md`

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
- 페이지 목적과 화면 블록 구성이 변하면 `docs/specs/admin-page-analysis.md`, `docs/specs/admin-page-ia-drafts.md`, `docs/specs/admin-page-tables.md`를 함께 검토합니다.
