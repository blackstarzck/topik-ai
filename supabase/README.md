# supabase/ — 마이그레이션 디렉터리 안내

## CI/CD 마이그레이션 게이트 (2026-07-21)

- development와 production manifest는 두 namespace 모두 `release-all` batch를 제공한다. 자동 적용 순서는 항상 `topik_writing` 후 admin이다.
- `--verify-all --require-clean --json-out <PATH>`는 tracker와 로컬 전체 migration의 checksum, pending, remote-only, blocked 적용, down pair를 대사한다.
- PR 변경 분류가 `database`일 때 `scripts/db/check-expand-migrations.mjs`가 기존 migration 수정·삭제와 contract migration을 거부한다. 같은 PR에서 앞선 신규 migration이 처음 만든 0인자 함수를 뒤의 신규 migration이 동일 이름으로 즉시 재생성하는 경우만 미출시 release 내부 보정으로 허용한다. 기존 함수·인자 함수·procedure·재생성 없는 삭제는 계속 차단한다. 분류가 모호하거나 CI/DB/API/Auth 설정에 닿으면 항상 `database`로 fail-closed 처리한다.
- 고정 v13 SHA를 포함한 전체 재생은 `scripts/ci/run-shadow-contract.mjs`가 담당한다. shadow fixture와 cron 호환 계층은 임시 로컬 DB에만 존재한다.
- 신규 forward migration이 있는 `db-only`/`app-db` 변경은 origin/main 뒤 topik-dev 적용·권한·CRUD·브라우저 검증이 먼저 성공해야 회사 저장소 fast-forward와 topik-prod 적용이 시작된다. `db-only`는 Vercel을 실행하지 않고, `app-only`는 migration을 적용하지 않으며, `sync-only`는 코드 동기화 후 DB/Vercel 없이 종료한다. 상세 순서는 `docs/architecture/admin-cicd-pipeline.md`를 따른다. 기존 forward migration 변경과 자동 down migration은 허용하지 않는다.

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
  `notification_groups`, `notification_dispatches`, `notification_delivery_attempts`,
  `notification_email_config`)와 관련 admin RPC, DB dispatcher/email 함수, 알림 cron,
  템플릿 link_url, 이메일 본문 크기 가드, dispatch 취소 RPC 등.
- **추적 테이블**: `admin_schema_migrations` (`topik_writing_schema_migrations`와 분리)
- **러너**: `scripts/db/admin-migrate.mjs`
  - 적용: `npm run db:admin:migrate`
  - 상태 확인: `npm run db:admin:migrate:status`
  - 롤백: `node scripts/db/admin-migrate.mjs --down <name>`
- **소유권 근거**: `docs/architecture/shared-supabase-schema-ownership.md`
- **TOPIK 쓰기 분석 교정 순서**: `20260714090000_admin_writing_analytics_learner_identity.sql`은
  `migrations/20260713080015_topik_writing_canonical_read_contract.sql` 적용 후 실행한다. admin tracker에는
  read interface만 기록하며, `learner_problem_id`가 없으면 fail-closed로 중단한다.

### 2.1 백업 관리 운영 객체 (`20260720150000`~`20260720150200`)

- 소유 객체: `admin_backup_runs`, `admin_backup_component_results`, `admin_restore_drills`, `admin_backup_report_events`
- 보고 함수: `record_admin_backup_report` — service role 전용, 중복 안전성·완료 불변성·보관 정리 담당
- 조회 함수: `get_admin_backup_summary`, `get_admin_backup_runs` — 관리자 조회 전용. `20260720150100`은 목록 함수의 열 이름 충돌을 교정하고, `20260720150200`은 요약에 마지막 보고 수신 시각을 추가한다.
- 자동 완료 이벤트는 `system_logs`에만 연결하며 `admin_audit_logs`에는 기록하지 않는다.
- 브라우저 직접 테이블 접근과 쓰기는 허용하지 않고 모든 테이블에 RLS enable+force를 적용한다.
- 세 migration은 모두 `down/`에 같은 파일명의 되돌리기 SQL을 둔다.
- 실제 백업 원본은 `topik-prod`뿐이며, 동일한 비민감 보고 요약을 `topik-dev`에 독립 저장해 localhost 관리자 화면에서 확인한다. 두 환경의 보고 저장은 서로 다른 서버 전용 키와 독립 재시도를 사용한다.

### 2.2 알림 파이프라인 마이그레이션 홈 (`20260723011242`)

- `20260723011242_notification_pipeline_ownership_transfer.sql`이 DB dispatcher, email defer/retry,
  marketing consent gate, `notification_email_config`, `dispatch_notifications` cron의 단일 forward
  migration home이다. 적용 이력은 `admin_schema_migrations`에만 기록한다.
- v13의 과거 `20260612180000`~`20260612200100` 파이프라인 migration은 독립 clean replay를
  깨뜨리지 않는 역사적 no-op이다. v13에서 admin 운영 테이블이나 파이프라인 함수를 다시 만들지 않는다.
- 통합 clean replay는 v13 사용자 객체(`profiles`, `notification_settings`, `user_notifications`,
  `user_marketing_consent`) → topik-ai 알림 운영 테이블/RPC → 이 forward migration 순으로 수렴한다.
  선행 객체가 없으면 migration은 fail-closed로 중단한다.
- forward migration은 기존 dispatch/attempt/config row를 삭제하거나 재시드하지 않고 최종 함수,
  RLS, grants, cron을 수렴시킨다. down은 공유 운영 상태를 되돌리지 않는 의도적 no-op이며 이후 교정도
  roll-forward로만 수행한다.
- dispatch 선언은 최종 라이브 오버로드 집합만 사용한다 — `dispatch_notification_event(text,uuid,text,jsonb,text)`
  1본(p_payload·p_channel default)과 `dispatch_scheduled_notifications(text,text)` 1본(p_channel default).
  레거시 1인자/4인자 오버로드를 재선언하면 1·4인자 호출이 모호해지고(42725), default 없는 core를
  라이브에 재적용하면 default 제거로 실패한다(42P13). 미적용 migration의 승인된 in-place 재작성은
  `scripts/db/manifests/unapplied-rewrites.json` 선언으로만 expand gate를 통과하며, 실제 적용 여부는
  러너의 tracker checksum이 fail-closed로 재검증한다.
- 이 재작성 허용 항목은 dev·prod 양쪽 적용과 checksum 일치가 확인된 2026-07-29에 제거했다.
  allowlist는 미적용 상태에서만 유효하므로 적용 후에도 남겨 두면 이후 릴리스가 checksum
  mismatch로 dev·prod 동시에 멈춘다.

### 2.3 사용자 리포트 인수 (`20260723170000`, `20260729120000`)

- `20260723170000_system_reports.sql`은 학습자 앱이 작성한 정본을 **바이트 그대로** 채택한 파일이다.
  handoff가 경로·version·checksum을 handback 증거로 요구하므로 주석 추가·개행 변환·BOM 삽입까지
  금지한다. 수정이 필요하면 새 forward migration을 만든다.
- 정본은 `private.system_reports`(RLS enable+force, 정책 0건, 전 role 직접 권한 회수)와
  `public.submit_system_report`(service_role 전용 접수 RPC)만 만든다.
- `20260729120000_admin_system_reports_console.sql`이 관리자 조회·단건 삭제 RPC를 더한다. 정본
  테이블에 컬럼·트리거·인덱스를 추가하지 않고, 자동 retention이나 일괄 삭제도 만들지 않는다.
- 삭제 감사는 Target Type `SystemReport`, Target ID 접수번호를 쓰고 payload에 제출자 이메일·제목·
  본문·사용자 식별자를 담지 않는다. `admin_audit_logs`는 조회 권한이 더 넓어 삭제가 개인정보를
  감사 테이블로 옮기는 결과가 되면 안 된다.
- 소유권 근거: `docs/architecture/shared-supabase-schema-ownership.md` §2

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

## 5. 2026-07-20 환경 적용 상태

- `topik-prod` admin tracker: canonical 83개 적용, checksum 누락 0.
- `topik-prod` TOPIK 쓰기 tracker: 32개 적용. `20260716052957_topik_writing_source_updated_at_version_tracking.sql`은 공급 `updated_at` 전제조건 미충족으로 차단.
- `topik-dev` admin tracker: canonical 88개 + superseded remote-only 이력 1개, checksum 누락 0. 백업 관리 3개 migration은 적용됐고 관리자 요약·목록 읽기 함수의 실제 호출을 확인했다. 로컬 canonical 89번째인 `20260723011242` 알림 파이프라인 소유권 이관은 이 시점에는 미적용이었다 — **2026-07-29 실측으로 정정: dev·prod 양쪽에 2026-07-23 CI 적용 완료, checksum 로컬 파일과 일치**(§5.1 참조). 장부가 진실이며 이 절의 날짜 기준 서술을 그대로 인용하지 말 것.
- `topik-prod`의 백업 관리 3개 migration은 아직 미적용이다. 운영 백업 수신을 켜기 전에 별도 운영 적용과 확인이 필요하다.
- admin 보안 마이그레이션 `20260716130000`/`20260716131000`은 admin 소유 public 함수의 anon/PUBLIC execute를 회수한다. 운영 검증에서 표본 anon executable admin function은 0건이다.
- 운영 DB 적용 완료와 Vercel 웹 배포 완료는 별도다. 최신 소스+운영 DB E2E가 통과했더라도 Production alias의 실제 bundle과 source switch를 다시 검증해야 한다. 2026-07-16 관리자 컷오버는 두 단계를 각각 검증해 `topik-prod` tracker/권한과 Production `admin_get_self` 로그인·쿠폰 CRUD·감사 로그까지 통과했다.

## 5.1 2026-07-29 환경 적용 상태 (admin 네임스페이스)

- `20260723011242` 알림 파이프라인 소유권 이관: **dev·prod 양쪽 적용 완료**(2026-07-23 CI, `applied_by=github-actions-{development,production}`). 로컬 파일 checksum과 장부 값이 일치하며 `unapplied-rewrites.json` 항목은 이에 따라 제거했다.
- 사용자 리포트 인수 2건(`20260723170000`, `20260729120000`): **`topik-dev` 적용 완료**, `--verify-all --require-clean` clean. `topik-prod`는 미적용이며 릴리스 파이프라인의 별도 단계다.
- dev 적용 후 검증: v13 handoff 카탈로그 14개 `*_ok` 열 전부 통과(테이블 owner/RLS enable+force/정책 0/직접 권한 0, 접수 RPC owner·SECURITY DEFINER·`search_path=pg_catalog, private`·EXECUTE allowlist), 접수→목록→삭제→감사 왕복(롤백 트랜잭션), 감사 payload 제출자 정보 부재, 미인증·사유 누락·잘못된 필터 거부, `anon` EXECUTE 3함수 전부 부재.
- manifest 두 개의 `expectedLocalCount`는 91이며 `baseline-all`·`release-all`의 `to`는 `20260729120000_admin_system_reports_console.sql`이다. 한쪽만 갱신하면 다른 contract에서 count mismatch로 실패한다.
