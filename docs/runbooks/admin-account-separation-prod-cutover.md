# 관리자 계정 분리 — 운영(production) 컷오버 런북

## 0. 현재 상태 (2026-07-16)

- 운영 Supabase `topik-prod`(`eymlabowhfgtxbiqwxqh`)에 admin canonical migration 83개와 TOPIK 쓰기 migration 32개를 적용·장부화했다.
- `20260716052957_topik_writing_source_updated_at_version_tracking.sql`은 공급 API의 `updated_at`이 모두 null인 전제조건 때문에 manifest에서 명시적으로 차단 상태다.
- 현재 `.env.local`에 설정된 관리자 계정을 Auth 사용자로 사용하고 `admin_accounts`의 active `platform_admin`으로 승격했다.
- 최종 상태에서 해당 사용자의 `profiles.app_role`은 `learner`로 복원했다. 관리자 권한 SoT는 `admin_accounts`이며 `admin_get_self` 로그인 검증을 통과했다.
- `admin_bootstrapped` 감사 로그는 계정별 1건으로 멱등 보관한다.
- legacy API key는 비활성 상태다. admin 소유 public 함수의 `anon` execute는 0건이며, 운영 seed/demo 업무 데이터는 정리 후 0건이다.
- 최신 소스를 Vercel Production에 배포했고 `https://topik-ai.vercel.app`에서 현재 관리자 계정의 `admin_get_self` 로그인과 실제 `topik-prod` 쿠폰 source를 확인했다.
- Production 브라우저 E2E에서 정기 쿠폰 템플릿 생성·상세·수정·삭제·감사 로그 확인을 통과했고 테스트 업무 행은 0건으로 정리됐다. headed Chromium 화면에서도 `topik-prod` 요청 `200`, page error `0`, 재확인 console error `0`을 확인했다.
- `/api/auth-email/sync`, `/api/admin/invite`, `/api/notifications/dispatch-email`의 비인증 `POST`와 알림 워커 비인증 `GET`은 모두 `401`을 반환해 Production 함수 라우팅 경계를 통과했다.

## 1. 필수 환경 가드

비밀값은 저장소에 기록하지 않고 실행 환경으로만 전달한다.

```text
SUPABASE_ACCESS_TOKEN
SUPABASE_PROJECT_REF=eymlabowhfgtxbiqwxqh
SUPABASE_EXPECTED_PROJECT_REF=eymlabowhfgtxbiqwxqh
SUPABASE_PRODUCTION_CONFIRM=eymlabowhfgtxbiqwxqh
E2E_ADMIN_EMAIL
E2E_ADMIN_PASSWORD
```

- 읽기 명령은 project ref를 명시한다.
- 쓰기 명령은 expected ref 일치가 필수다.
- 운영 쓰기는 production confirm까지 정확히 일치해야 한다.
- manifest 밖 migration, 서로 다른 tracker 혼용, 암묵적 전체 replay는 금지한다.

## 2. 상태와 계획 확인

```powershell
node scripts/db/admin-migrate.mjs --status --manifest scripts/db/manifests/admin-production-cutover.json
node scripts/db/migrate.mjs --status --manifest scripts/db/manifests/writing-production-cutover.json

node scripts/db/admin-migrate.mjs --plan --manifest scripts/db/manifests/admin-production-cutover.json --batch post-cutover
```

`--plan`, `--apply`, `--baseline-existing`, `--down`은 모두 manifest와 batch를 요구한다. 적용 전에는 각 batch의 precondition SQL이 통과해야 한다.

## 3. 백업과 순차 적용

최초 컷오버 전 백업:

```powershell
node scripts/db/run-sql.mjs --write --file scripts/db/sql/production-admin-precutover-backup.sql
```

Admin 적용 순서:

1. `notification-baseline`
2. `foundation`
3. `account-model`
4. `account-cutover`
5. `post-cutover`
6. `security-hardening`
7. `security-hardening-followup`

각 단계는 다음 형식으로 실행한다.

```powershell
node scripts/db/admin-migrate.mjs --apply --manifest scripts/db/manifests/admin-production-cutover.json --batch <batch-name>
```

TOPIK 쓰기 버전 요약 적용과 기존 장부 채택은 `writing-production-cutover.json`의 `version-summary`, `baseline-applied` batch로 제한한다. 차단 migration은 공급 계약이 충족되기 전 적용하지 않는다.

## 4. 현재 관리자 계정 부트스트랩

```powershell
node scripts/db/bootstrap-admin.mjs --phase prepare --apply
node scripts/db/bootstrap-admin.mjs --phase verify
node scripts/db/bootstrap-admin.mjs --phase finalize --apply
node scripts/db/bootstrap-admin.mjs --phase verify
```

- `prepare`: 현재 설정된 계정의 로그인 가능성을 확인하고 필요한 경우 Auth 사용자를 생성한 뒤 profile에 임시 admin role을 둔다.
- `verify`: 로그인 후 `admin_get_self`가 active `platform_admin`을 반환하는지 확인한다.
- `finalize`: profile role을 `learner`로 복원하고 bootstrap 감사 로그를 저장한 뒤 admin helper를 재검증한다.
- Auth 사용자 생성 때문에 legacy key를 일시 활성화해야 하는 경우에도 스크립트가 종료 전에 비활성 상태로 복원하고 gateway 반영까지 확인한다.

## 5. 운영 검증

DB 검증:

```powershell
node scripts/db/run-sql.mjs --file scripts/db/sql/verify-production-admin-cutover.sql
```

필수 기대값:

- `migration_count=83`
- active `platform_admin=1`
- bootstrap audit `=1`
- 점검 대상 RLS `10/10`
- 표본 admin SECURITY DEFINER RPC의 anon execute `=0`
- demo 업무 데이터 `=0`

브라우저 E2E는 최신 소스를 `topik-prod` 환경으로 실행한 서버에 대해 수행한다.

```powershell
npm run test:e2e:prod-admin
```

이 테스트는 현재 관리자 로그인, 운영 프로젝트 ref 네트워크 요청, 정기 쿠폰 템플릿 생성·상세·수정·삭제, 감사 로그 화면, DB 잔존 행과 감사 건수를 함께 확인하고 테스트 업무 행을 삭제한다.

## 6. Vercel 배포 승인 게이트 (2026-07-16 통과)

- Production/Preview의 Supabase 환경값이 `topik-prod`인지 확인한다.
- 새 배포 bundle이 `admin_get_self` 인증 경로를 사용해야 한다.
- `/commerce/coupons`가 `commerce_coupon_subscription_templates`를 실제 요청해야 하며 mock seed가 노출되면 안 된다.
- 현재 관리자 계정으로 Vercel 로그인, CRUD, 감사 로그 확인을 다시 수행한다.
- 위 조건 전에는 DB 컷오버 완료와 웹 릴리스 완료를 동일하게 취급하지 않는다.

통과 증거:

- PR `#14` rebase merge 뒤 Production commit `536cad11db0a27c7105c07f43fa04daa073705a9`이 Vercel Ready 상태가 됐다.
- 현재 관리자 세션은 `E2E Admin · 슈퍼`로 표시되고, 쿠폰 템플릿 요청은 `https://eymlabowhfgtxbiqwxqh.supabase.co/rest/v1/commerce_coupon_subscription_templates`에서 `200`을 반환했다.
- `npm run test:e2e:prod-admin` 1/1 통과: 생성 1건, 저장 감사 2건, 삭제 감사 1건과 삭제 사유를 확인한 뒤 업무 행을 삭제했다.
- Production API 비인증 smoke는 `/api/auth-email/sync`, `/api/admin/invite`, `/api/notifications/dispatch-email` `POST`와 알림 워커 `GET` 모두 `401`이다.
- 실제 SMTP 발송을 일으킬 수 있는 인증된 알림 워커 smoke는 이번 관리자 컷오버 검증에서 실행하지 않았다.

## 7. 롤백

- migration별 동일 이름의 `down/` SQL을 사용하고 `--allow-down`과 명시적 production guard를 요구한다.
- DB 롤백 전에 private 컷오버 백업 테이블과 tracker를 대조한다.
- 관리자 `profiles` 행 물리 삭제(Phase 7)는 이번 컷오버 범위에서 수행하지 않았다. 별도 승인과 종속 데이터 0건 증거 없이는 실행하지 않는다.
