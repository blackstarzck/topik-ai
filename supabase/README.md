# supabase/ — 마이그레이션 디렉터리 안내

## CI/CD 마이그레이션 게이트 (2026-07-20)

- development와 production manifest는 두 namespace 모두 `release-all` batch를 제공한다. 자동 적용 순서는 항상 `topik_writing` 후 admin이다.
- `--verify-all --require-clean --json-out <PATH>`는 tracker와 로컬 전체 migration의 checksum, pending, remote-only, blocked 적용, down pair를 대사한다.
- PR에서는 `scripts/db/check-expand-migrations.mjs`가 기존 migration 수정·삭제와 contract migration을 거부한다.
- 고정 v13 SHA를 포함한 전체 재생은 `scripts/ci/run-shadow-contract.mjs`가 담당한다. shadow fixture와 cron 호환 계층은 임시 로컬 DB에만 존재한다.
- `origin/main` 뒤 topik-dev 적용·권한·CRUD·브라우저 검증이 먼저 성공해야 회사 저장소 fast-forward와 topik-prod staged release가 시작된다. 상세 순서는 `docs/architecture/admin-cicd-pipeline.md`를 따른다. DB down migration은 자동화하지 않는다.

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

### 1.1 정식 작문 카탈로그 읽기 계약 (`20260713080015`)

- 인박스 `topik_writing_question_import`와 번호별 정식 51~54 테이블은 역할이 다르다. 인박스는 원시 응답·버전 보존용이고, 학습자 읽기 SoT는 번호별 정식 테이블이다.
- `topik_writing_question_source_map.learner_problem_id`는 `md5(question_id)::uuid` generated UNIQUE 값으로 v13 FK와 일치하고, `question_id` 변경은 trigger로 거부한다. `legacy_problem_id`는 과거 ETL provenance일 뿐 학습자 식별자로 사용하지 않는다. `canonical_import_id`가 정식 문항과 정확한 인박스 버전을 연결한다. 학습자 RPC는 이 버전의 `payload_hash`와 허용 필드만 반환하며 정답·채점표·원시 응답을 제외한다. 53번 차트 JSON은 루트/series/value 단계의 명시적 재귀 허용 목록으로 다시 만들어 중첩된 비허용 필드도 노출하지 않는다.
- service-role 전용 채점 payload/제출 guard와 authenticated 전용 학습자 RPC의 `GRANT`를 섞지 않는다. 실제 적용 전후에 `anon` 거부, `authenticated` 안전 projection, `service_role` 정확 버전 조회를 각각 검사한다.
- 최초 `20260713080015` 승격 RPC는 v13 소유 `private.ensure_writing_problem_anchor(uuid,text,smallint)`에 의존했다. 교정 마이그레이션 `20260714150000_topik_writing_identity_registry_bridge.sql`부터는 v13 소유 `private.ensure_writing_problem_identity(uuid,text,smallint)`를 먼저 확인하고, 기존 pinned canonical identity와 신규 승격 identity를 이 함수로만 등록·검증한다. v13 registry 마이그레이션을 먼저 적용해야 하며, 함수가 없으면 Admin 마이그레이션은 fail-closed로 중단한다.
- `private.problem_identities`는 v13 소유이므로 이 repo는 직접 DDL/DML 또는 cross-domain FK를 추가하지 않는다. v13 `20260714140000`은 writing 관련 FK를 registry로 이관하고 초안·제출에 불변 learner-safe cutover snapshot을 백필한 뒤 `public.problems` writing 행을 삭제한다. 현재 문항과 과거 기록 모두 retained mirror에 의존하지 않는다.
- `private.assert_writing_canonical_content_parity()`는 정식 typed row를 고정 인박스 `raw_payload`에서 다시 만든 record와 완전 비교한다. 초기 백필에서 불일치하면 마이그레이션을 중단하고, v13 canonical 활성화 게이트에서도 다시 실행한다.
- 2026-07-15 기준 최종 구조의 v13 `20260714140000`/`20260714141000`/`20260714160000`과 Admin `20260714150000`은 dev DB에 적용됐다. identity/FK/snapshot/mirror 삭제 대사, migration down/up, outbox fault-injection, 실제 provider 제출·피드백 canary, desktop/mobile cross-app headed browser를 통과했다. 검증 뒤 dev 제출은 `blocked + unverified`로 fail-close했으며 운영 DB에는 미적용이다. 최종 구조에는 legacy/shadow/read mode/rollback sync가 없고, 서비스 재개 시 검증된 outbox evidence로만 canonical 제출을 활성화한다.

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
- **TOPIK 쓰기 분석 교정 순서**: `20260714090000_admin_writing_analytics_learner_identity.sql`은
  `migrations/20260713080015_topik_writing_canonical_read_contract.sql` 적용 후 실행한다. admin tracker에는
  read interface만 기록하며, `learner_problem_id`가 없으면 fail-closed로 중단한다.

## 3. 공통 실행 메커니즘

- 두 러너는 동일한 `scripts/db/migrate-core.mjs`를 사용하고, `trackTable`과
  `migrationsDir`만 다르게 주입한다.
- **실행 경로**: 이 머신에는 CLI 인증/DB 비밀번호가 없어 Supabase **Management API**로
  적용한다. 인증은 `SUPABASE_ACCESS_TOKEN`(`sbp_...`) 환경변수를 사용한다.
- **적용 순서**: 각 디렉터리 안에서 파일명(타임스탬프 prefix) 순으로 적용한다.
- **롤백 SQL**: 각 디렉터리의 `down/`에 같은 파일명으로 짝지어 보관하며,
  `--down <name>` 실행 시 해당 SQL을 적용하고 tracker에서 untrack 한다.

### 3.1 환경 manifest와 쓰기 가드

- 개발/운영 적용 목록은 `scripts/db/manifests/*.json`에서 project ref, 로컬 canonical 개수,
  batch 범위, precondition/finalizer, blocked/remote-only 이력을 명시한다.
- manifest 실행은 `--manifest`와 `--batch`가 필수이며, 장부에 없는 파일을 암묵적으로
  전체 replay하지 않는다.
- 쓰기는 `SUPABASE_EXPECTED_PROJECT_REF`가 실제 target과 같아야 한다. 운영 프로젝트는
  `SUPABASE_PRODUCTION_CONFIRM=eymlabowhfgtxbiqwxqh`까지 일치해야 한다.
- migration 본문과 tracker 기록은 같은 transaction에서 처리한다. tracker에는
  SHA-256 checksum, apply mode, batch id, applied by를 보관해 파일 변조와 잘못된 장부 채택을 탐지한다.
- 운영 SQL 보조 도구 `scripts/db/run-sql.mjs`는 기본 read-only이며 mutation keyword는
  `--write`와 동일한 target/production guard 없이는 거부한다.
- 현재 관리자 계정 부트스트랩은 `scripts/db/bootstrap-admin.mjs`의
  `prepare -> verify -> finalize -> verify` 순서를 사용한다. 최종 관리자 권한 SoT는
  `admin_accounts`이고 `profiles.app_role`은 `learner`로 복원한다.

## 4. 경계 규칙 (중요)

- 두 네임스페이스의 추적 테이블을 **섞지 않는다** — `topik_writing`은 `db:migrate`,
  admin 운영은 `db:admin:migrate`로만 적용한다.
- 이 repo가 소유하지 않는 **기존 v13 테이블의 DDL 변경은 금지**한다.
- 공유 Supabase 스키마 소유권은 앱 기준이 아니라 **도메인 기준**으로 정한다.
  양쪽 앱이 읽거나 쓰는 공유 객체의 경계·승인 절차는
  `docs/architecture/shared-supabase-schema-ownership.md`의 decision record를 따른다.

## 5. 2026-07-16 운영 적용 상태

- `topik-prod` admin tracker: canonical 83개 적용, checksum 누락 0.
- `topik-prod` TOPIK 쓰기 tracker: 32개 적용. `20260716052957_topik_writing_source_updated_at_version_tracking.sql`은 공급 `updated_at` 전제조건 미충족으로 차단.
- `topik-dev` admin tracker: canonical 83개 + superseded remote-only 이력 1개. manifest가 remote-only 파일을 재생하지 않도록 고정한다.
- admin 보안 마이그레이션 `20260716130000`/`20260716131000`은 admin 소유 public 함수의 anon/PUBLIC execute를 회수한다. 운영 검증에서 표본 anon executable admin function은 0건이다.
- 운영 DB 적용 완료와 Vercel 웹 배포 완료는 별도다. 최신 소스+운영 DB E2E가 통과했더라도 Production alias의 실제 bundle과 source switch를 다시 검증해야 한다. 2026-07-16 관리자 컷오버는 두 단계를 각각 검증해 `topik-prod` tracker/권한과 Production `admin_get_self` 로그인·쿠폰 CRUD·감사 로그까지 통과했다.
