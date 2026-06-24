# 관리자 계정 분리 — 운영(production) 컷오버 런북

본 작업(브랜치 `feat/admin-account-separation`, PR #3)은 **dev 프로젝트(`fglggyfvzjdsbyckinqa`)에만** 적용·검증됐다. 운영 적용은 아래 순서로 **운영 Supabase 프로젝트 ref**에 대해 수행한다(오너 실행).

> 모든 DB 명령은 `SUPABASE_PROJECT_REF=<prod-ref>` 를 지정해 실행한다. dev와 동일하게 `run-sql.mjs --file` 로 순서대로 적용(마이그 장부가 비어있을 수 있어 admin-migrate 일괄 replay는 피한다).

## 0. 사전
- 운영 DB 전체 백업(특히 `profiles`, `admin_audit_logs`).
- 운영의 현 관리자 인벤토리 확인: `select id,email,app_role,status from profiles where app_role<>'learner'`.
- Vercel(운영) 환경변수 확인: `SUPABASE_SERVICE_ROLE_KEY`(or `SUPABASE_SECRET_KEY`), `SMTP_HOST/PORT/USER/PASS/FROM`, (선택)`ADMIN_INVITE_REDIRECT_URL`.

## 1. 마이그레이션 적용 (순서 엄수)
`supabase/migrations-admin/` 의 다음 파일을 **타임스탬프 순서대로** 적용:

1. `20260623200000_admin_accounts.sql` — admin_accounts/grants 테이블 + `admin_has_permission`
2. `20260623210000_admin_accounts_backfill.sql` — 기존 관리자(app_role<>learner) → admin_accounts 이행 + role 템플릿 grant **(헬퍼 전환 전 필수: 락아웃 방지)**
3. `20260623220000_audit_logs_fk_to_auth_users.sql` — admin_audit_logs FK profiles→auth.users (적용 전 orphan 점검: `select count(*) from admin_audit_logs where admin_user_id not in (select id from auth.users)` = 0)
4. `20260623230000_admin_accounts_rpcs.sql` — 관리자 RPC + 목록/감사 RPC 재작성
5. `20260623240000_admin_gate_helpers_to_admin_accounts.sql` — **게이트 헬퍼(is_admin 등)를 admin_accounts로 전환** (내장 가드: active platform_admin 0이면 abort → 2번을 먼저 적용해야 통과)
6. `20260623250000_admin_invite_finalize.sql` — 초대 확정 RPC (service_role 전용; 적용 후 `revoke from anon/authenticated` 포함됨)
7. `20260623260000` · `270000` (커뮤니티) · `280000`(운영) · `281000`(커머스) · `282000`(회원) · `283000`(메타데이터) · `284000`(인증메일) · `285000`(알림) · `286000`(회원메모) — **Phase 8 권한 강제**(순서 무관, 전부 적용)

> v13 레포 변경 없음: 게이트 헬퍼는 topik-ai 소유로 재정의(5번)되며 운영 DB에 직접 적용된다. v13 의 `supabase db push` 가 헬퍼를 되돌리지 않도록, 운영 적용 후 v13 측이 옛 헬퍼 정의를 재적용하지 않게 한다(공유 스키마 소유권 문서 참조).

## 2. 앱 배포
- topik-ai 운영 배포(이 브랜치 머지분): auth-store가 `admin_get_self` 사용, 서버리스 authz가 admin_accounts 조회, `api/admin/invite`(앱 SMTP) 포함.

## 3. 검증 (운영)
- 기존 슈퍼관리자 로그인 정상(락아웃 0): `select private.is_platform_admin('<admin-uid>')` = true.
- 초대 1건 실행 → 메일 수신 → 수락·로그인 → 부여 권한대로만 메뉴/조치.
- 권한 강제 스팟체크: 권한 없는 도메인 RPC 직접 호출 시 `missing permission ...` 거부.

## 4. Phase 7 — 관리자 profiles row 물리 삭제 (선택, 마지막)
`scripts/db/phase7-delete-admin-profiles.mjs`:
1. **dry-run**(기본): 후보·종속 학습자데이터 카운트·backup JSON 확인.
2. 종속 0행 확인된 관리자만: `PHASE7_CONFIRM=DELETE node scripts/db/phase7-delete-admin-profiles.mjs --apply`.
- 종속 데이터가 있는 관리자는 스크립트가 자동 skip(가드). 그런 계정은 별도 검토.
- 비가역: 삭제 전 backup 보관(롤백은 backup에서 profiles row 복원).

## 5. 롤백
- 각 마이그 `down/` 존재. 단 **Phase 7(삭제) 이후**에는 헬퍼/ FK down 이 백업 복원을 선행해야 함(profiles row 부재 시 down 실패).
- 헬퍼 down(240000)은 profiles-reading 본문으로 복원 → 즉시 구모델 복귀(단 backfill된 admin_accounts는 잔존, 무해).

## 부록: 권한 키 매핑 결정(2026-06-24)
- 회원 메모(add/delete) → `users.read`
- 알림 그룹 → `message.groups.manage`; 알림 템플릿/발송 → `message.{mail,push,inapp}.manage` 중 하나(OR); 약관변경 알림 → `operation.policies.manage`
- 미게이팅 RPC 없음(is_admin 게이트 도메인 쓰기 61개 전부 fine-grained).
