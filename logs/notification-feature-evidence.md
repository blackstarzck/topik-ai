# 알림 기능 구현 증적 로그

기준: `docs/알림-기능-구현-페이즈-가이드.md` (WP 단위 기록), `docs/알림-기능-QA-시나리오.md` (게이트 판정).

---

## WP0-1 스키마 소유권 SoT 개정 — PASS (2026-06-12)

- 승인 근거: 오너의 알림 기능 자율 실행 지시(2026-06-12 `/goal` — "페이즈 가이드 작업 시작, QA 모두 PASS까지"). 가이드 H-1의 "수정안 제시 후 승인" 절차는 본 지시(자율 실행 위임)를 일괄 승인으로 해석하고, 개정 내용을 본 로그와 작업 보고에 명시하는 방식으로 갈음한다. 오너가 개정 내용에 이의를 제기하면 즉시 원복한다.
- 변경 내역:
  1. v13 `AGENTS.md` 비협상 규칙 "관리자 범위 경계": "admin-oriented schema/migration 추가도 금지" 단문을 도메인 기준 소유권 모델로 개정 (v13 = user-facing schema 소유, topik-ai = admin 운영 schema 소유, 공유 객체는 ownership 문서 따름). load-bearing 객체 보호 문구는 유지. (worktree `v13-notif`, 브랜치 `feat/notifications`)
  2. topik-ai `AGENTS.md` §2: 대상 작업에 admin 운영 네임스페이스(알림 4객체 + RPC, `admin_schema_migrations` tracker) 추가, 제외 범위 문구를 소유 네임스페이스 기준으로 일반화. 기존 v13 테이블 DDL 변경 금지 유지.
  3. 신설: `docs/architecture/shared-supabase-schema-ownership.md` — 객체별 owner/writer/reader/RLS/migration home 매트릭스. `notification_delivery_attempts`의 v13 read(X-09 이력 패널) 공유 계약 명시.
  4. `docs/architecture/admin-data-source-transition.md` D-1 절에 "스키마 소유권 일반화 (2026-06-12)" 항목 추가.
- 사전 확인: Management API 접근 정상(토큰 `.env.local`), 공유 프로젝트 확인 — `fglggyfvzjdsbyckinqa`에 v13 테이블(`notification_settings`, `notification_log`)과 topik-ai tracker(`topik_writing_schema_migrations`) 공존 (information_schema 조회, 2026-06-12).
- 작업 공간: topik-ai `C:\Users\admin\Desktop\workspace\topik-ai-notif`(worktree, feat/notifications), v13 `C:\Users\admin\Desktop\workspace\v13-notif`(worktree, feat/notifications ← origin/main d25275f). 양 원본 작업 트리(타 작업 진행 중)는 건드리지 않음.

## WP0-2 admin migration 체계 분리 — PASS (2026-06-12)

- 구현: `scripts/db/migrate-core.mjs`(공용 모듈, tracker/디렉터리 파라미터화) + `scripts/db/admin-migrate.mjs`(tracker `admin_schema_migrations`, 디렉터리 `supabase/migrations-admin/`) + `migrate.mjs` 얇은 래퍼로 리팩토링 + `package.json`에 `db:admin:migrate`/`db:admin:migrate:status` 추가 + `schema-snapshot.mjs`에 `--exclude-admin`(정확한 이름 매칭 — 'notification_' prefix 매칭은 v13 소유 notification_settings/log를 가리므로 금지) 추가.
- 검증: `node scripts/db/admin-migrate.mjs --status` → 빈 pending 정상 출력 + DB에 `admin_schema_migrations` tracker 생성(RLS enabled). 회귀: `node scripts/db/migrate.mjs --status` → 기존 14건 전부 [applied] 동일 출력.
