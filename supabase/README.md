# supabase/ — 마이그레이션 디렉터리 안내

이 디렉터리는 공유 Supabase 프로젝트(v13)에 적용하는 SQL 마이그레이션을 담는다.
하나의 DB를 **도메인 기준 네임스페이스**로 나눠 두 디렉터리로 분리 운영하며, 각 디렉터리는
서로 다른 **마이그레이션 추적 테이블(tracker)** 로 적용 이력을 따로 관리한다.

> 같은 DB, 다른 소유 영역. `migrations`는 TOPIK 쓰기 평가 도메인, `migrations-admin`은
> 알림 등 admin 운영 기능 스키마다.

## 1. `migrations/` — `topik_writing` 도메인 스키마

- **소유 영역**: TOPIK 쓰기 평가 핵심 도메인 — 토픽/태그 마스터, 51~54번 문항,
  문항-태그/소스 매핑, 추천 뷰, 인덱스, RLS, admin RPC 등.
- **추적 테이블**: `topik_writing_schema_migrations`
- **러너**: `scripts/db/migrate.mjs`
  - 적용: `npm run db:migrate`
  - 상태 확인: `npm run db:migrate:status`
  - 롤백: `node scripts/db/migrate.mjs --down <name>`
- **소유권 근거**: `docs/architecture/metadata-tag-schema-transition-decision-record.md` §2

## 2. `migrations-admin/` — admin 운영 네임스페이스 (알림 등)

- **소유 영역**: 관리자 운영 기능 — 알림 운영 객체(`notification_templates`,
  `notification_groups`, `notification_dispatches`, `notification_delivery_attempts`)와
  관련 admin RPC, 템플릿 link_url, 이메일 본문 크기 가드, dispatch 취소 RPC 등.
- **추적 테이블**: `admin_schema_migrations` (`topik_writing_schema_migrations`와 분리)
- **러너**: `scripts/db/admin-migrate.mjs`
  - 적용: `npm run db:admin:migrate`
  - 상태 확인: `npm run db:admin:migrate:status`
  - 롤백: `node scripts/db/admin-migrate.mjs --down <name>`
- **소유권 근거**: `docs/architecture/shared-supabase-schema-ownership.md`

## 3. 공통 실행 메커니즘

- 두 러너는 동일한 `scripts/db/migrate-core.mjs`를 사용하고, `trackTable`과
  `migrationsDir`만 다르게 주입한다.
- **실행 경로**: 이 머신에는 CLI 인증/DB 비밀번호가 없어 Supabase **Management API**로
  적용한다. 인증은 `SUPABASE_ACCESS_TOKEN`(`sbp_...`) 환경변수를 사용한다.
- **적용 순서**: 각 디렉터리 안에서 파일명(타임스탬프 prefix) 순으로 적용한다.
- **롤백 SQL**: 각 디렉터리의 `down/`에 같은 파일명으로 짝지어 보관하며,
  `--down <name>` 실행 시 해당 SQL을 적용하고 tracker에서 untrack 한다.

## 4. 경계 규칙 (중요)

- 두 네임스페이스의 추적 테이블을 **섞지 않는다** — `topik_writing`은 `db:migrate`,
  admin 운영은 `db:admin:migrate`로만 적용한다.
- 이 repo가 소유하지 않는 **기존 v13 테이블의 DDL 변경은 금지**한다.
- 공유 Supabase 스키마 소유권은 앱 기준이 아니라 **도메인 기준**으로 정한다.
  양쪽 앱이 읽거나 쓰는 공유 객체의 경계·승인 절차는
  `docs/architecture/shared-supabase-schema-ownership.md`의 decision record를 따른다.
