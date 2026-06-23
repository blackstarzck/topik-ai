> ✅ **완료됨 (2026-06-18, 커밋 `d4ba5a6`, push 완료).** 아래 핸드오프는 작업 착수 시점 기록이며, 차단#1(트리거 허용)은 해소·검증되었고 증분은 적용·검증·커밋·push까지 끝났습니다. 추가 RPC `admin_list_admin_app_roles`(리뷰 F3 대응)와 self-verify write 강화가 반영되었습니다. 결과 요약은 `.codex-artifacts/rbac-app-role/db-change-report.html` 참고. 이 문서는 이력 보존용으로 남겨둡니다.

# HANDOFF — 권한 화면 RBAC(app_role) 전환

작성: 2026-06-18 (Claude / Opus 4.8 세션) · 브랜치 `feat/operation-notices-db`
대상: 이 작업을 이어받는 다음 세션

> **한 줄 요약:** 권한 화면을 "실제 관리자 등급(`app_role`) 변경 화면"으로 개조하는 증분(마이그레이션 RPC + 서비스 + 화면)을 **작성 완료했으나, 아직 dev DB 미적용·미검증·미커밋** 상태로 워킹트리에 남겨두었다. **최우선 차단 항목 = `profiles.app_role` 쓰기를 v13 `protect_profile_columns` 트리거가 허용하는지 라이브 확인.** 허용되면 적용→검증→커밋, 안 되면 v13 오너 협의로 에스컬레이션.

---

## 0. 지금 워킹트리 상태 (중요 — 두 세션 WIP가 섞여 있음)

브랜치는 `origin/feat/operation-notices-db`와 **0/0 동기화**(내 커밋 전부 push 완료, 최신 `eb5bb96` Phase 0). 그 위에 **커밋 안 된 두 세션의 작업이 공존**한다. 커밋할 때 **반드시 파일을 명시적으로 stage** 할 것 (`git add -A` 금지).

### 이 작업(RBAC)의 파일 — 내 것, 이어서 작업 대상 (9개)
- `supabase/migrations-admin/20260618093000_admin_set_app_role.sql` (신규)
- `supabase/migrations-admin/down/20260618093000_admin_set_app_role.sql` (신규)
- `src/features/system/api/system-permissions-service.ts` (신규)
- `src/features/system/api/system-permissions-data-source.ts` (신규)
- `src/features/system/model/permission-store.ts` (수정)
- `src/features/system/model/permission-types.ts` (수정)
- `src/features/system/pages/system-permissions-page.tsx` (수정 — 화면 개조)
- `src/features/system/pages/system-audit-logs-page.tsx` (수정 — AdminAccount 딥링크)
- `src/shared/model/target-type-label.ts` (수정 — `AdminAccount: "관리자 계정"`)

> 내구 백업: 위 신규 파일 사본 + 수정 파일 패치를 `.codex-artifacts/rbac-app-role/`(`modified-files.patch`, `*.ts`, `*.sql`, `down/`)에 보관. 트리가 엉키면 여기서 복원.

### 동시 세션(알림 이메일 워커 / Vercel) 파일 — **건드리지 말 것**
`.env.example`, `package.json`, `tsconfig.node.json`, `vercel.json`, `api/`, `scripts/check-client-secret-leaks.mjs`, `scripts/check-notification-worker-smoke.mjs`, `scripts/check-vercel-worker-readiness.mjs`, `tests/unit/notification-dispatch-email-worker.test.ts`, `tests/unit/vercel-worker-readiness.test.mjs`, `docs/specs/admin-data-contract.md`, `docs/page-sync/message-history-page-sync.md`, `docs/알림-기능-구현-페이즈-가이드.md`, `logs/admin-doc-update-log.md`. → 그 세션이 커밋/관리한다.

---

## 1. 무슨 결정으로 이 작업을 시작했나

RBAC SoT 결정(GPT-5.5 위임, 2026-06-17): **실제 권한 = `profiles.app_role` 유일**. 화면의 5 RoleKey / 37 permission 카탈로그는 **메뉴 게이팅·표시용일 뿐 실권한 아님**. (신규 RBAC 테이블·화면 catalog SoT 기각.)

`profiles.app_role` 4값: `platform_admin → SUPER_ADMIN`, `content_admin → CONTENT_MANAGER`, `org_admin → READ_ONLY`, `learner → (관리자 아님)`. 매핑 정의: `src/features/auth/model/app-role-mapping.ts`.

### 오너 확인 5항목 — 확정 답변 (2026-06-18)
1. **변경 RPC 설계** — platform_admin만 변경 가능, 감사에 이전→새 등급+사유 기록. (제안 그대로)
2. **2인 승인** — 없음. **단독 실행.**
3. **세션 반영** — **다음 로그인 때 반영.** 강제 재인증·토큰 폐기 없음(`profiles.app_role`만 갱신).
4. **`org_admin → READ_ONLY`** — **임시 현행 유지** (app-role-mapping.ts 변경 금지).
5. **권한 화면 정체성** — **실제 관리자별 `app_role` 변경 화면으로 개조** (37/5 카탈로그는 조회·참고 read-only로 잔존).

---

## 2. 작성된 증분 — 무엇이 들어있나

### RPC (마이그레이션) — `admin_set_admin_app_role(p_target_user_id uuid, p_new_app_role text, p_reason text)`
SECURITY DEFINER. 신규 테이블 0. 검증 완료된 설계:
- 가드: unauthenticated→`unauthenticated`, **`private.is_platform_admin(caller)` 아니면 `forbidden`**, `p_reason` 필수.
- `p_new_app_role` ∈ (platform_admin, content_admin, org_admin, learner) 아니면 예외.
- 대상 행 `for update of p` 잠금, 현재 등급 동일하면 예외(no-op 방지).
- **잠금 방지: 자기 자신 platform_admin 강등 차단 + 마지막 platform_admin 강등 차단(count<=1).**
- `update profiles set app_role` → `admin_audit_logs` INSERT (`action='admin_role_changed'`, `target_table='AdminAccount'`, `target_id`=대상 uuid, `diff={app_role:{from,to}}`, `payload={reason,target_email,target_display,session_policy:'next_login'}`).
- `revoke all from public` + `grant execute to authenticated`. 함수 코멘트에 트리거 미검증 경고 포함.

### 서비스/화면
- `system-permissions-service.ts` — 읽기: `get_admin_users` RPC 재사용(관리자 목록 + `app_role` 매핑). 쓰기: `admin_set_admin_app_role`. exports `fetchAdminAppRolesSafe`, `changeAdminAppRoleSafe`.
- `system-permissions-data-source.ts` — `isSupabaseConfigured` + `VITE_SYSTEM_PERMISSIONS_SOURCE=mock` 스위치(미설정 시 supabase).
- `system-permissions-page.tsx` — 관리자별 현재 등급 + '등급 변경' 조치(platform_admin만), 37/5 카탈로그는 참고 read-only. (개조 내용은 미검증 — 아래 3 참조.)
- `system-audit-logs-page.tsx` / `target-type-label.ts` — `AdminAccount` 라벨·딥링크.

---

## 3. 아직 안 된 것 / 열린 리스크 (이어받을 작업)

### ★ 차단 #1 (최우선) — `profiles.app_role` 쓰기 허용 검증
RPC는 `update public.profiles set app_role` 를 한다. `profiles`는 **v13 소유**, `private.protect_profile_columns` 트리거가 컬럼 쓰기를 보호한다. 작성 에이전트는 **라이브 검증을 못 했고**(레포 인스펙션으로 `status` 토글 admin bypass 선례만 확인), 마이그레이션 코멘트에 "apply 시점에 검증 필요"로 명시해 둠.

**할 일:** dev DB(`fglggyfvzjdsbyckinqa`)에서 트리거 정의를 확인하고, platform_admin 컨텍스트로 `app_role` UPDATE가 통과하는지 실증.
- **통과하면** → 그대로 적용.
- **막히면** → 라이브 쓰기 강행 금지. RPC는 보존하되 v13 오너에게 "감사 추적 가능한 admin app_role 변경을 위해 `protect_profile_columns`에 admin bypass(또는 전용 변경 함수) 필요"로 에스컬레이션. (`admin_set_user_status`가 `status`에 대해 받은 처리와 동일 패턴.) v13 트리거 DDL을 이 레포에서 직접 바꾸지 말 것.

### 갭 #2 — 단위 테스트 없음
Phase 0(`tests/unit/system-audit-logs-supabase-service.test.ts`)처럼 `tests/unit/system-permissions-supabase-service.test.ts` 추가 필요(잠금방지·가드·매핑 검증).

### 갭 #3 — 검증 파이프라인 미실행
typecheck / lint / e2e(mock) / no-collateral diff / harness 전부 **아직 안 돌림**. 화면 개조(`system-permissions-page.tsx`)는 특히 리뷰 필요(부여/회수 UI를 "실권한 아님" 표기로 바꿨는지, 기존 mock 시뮬레이션 회귀 보존됐는지).

### 갭 #4 — 문서 동기화 미완
이 패스는 코드만. `docs/specs/admin-data-contract.md`(권한 섹션), `docs/architecture/shared-supabase-schema-ownership.md`(§3 결정 기록 — app_role write RPC), 권한 화면 page-sync, `logs/admin-doc-update-log.md` 동기화 필요. **단, `admin-data-contract.md`/`admin-doc-update-log.md`는 동시 세션도 편집 중** → 충돌 주의(내 줄만 추가, mojibake 검사 필수).

---

## 4. 이어서 하는 정확한 순서 (레시피)

```bash
# 0) 토큰 주입 (러너는 .env.local 자동 로드 안 함; BOM-safe 추출)
export SUPABASE_ACCESS_TOKEN="$(grep -a '^SUPABASE_ACCESS_TOKEN=' .env.local | sed 's/^SUPABASE_ACCESS_TOKEN=//' | tr -d '\r\n')"

# 1) ★차단#1 검증: protect_profile_columns 트리거가 app_role 쓰기 허용하는지 확인 (dev DB fglggyfvzjdsbyckinqa)
#    - 트리거 정의 inspect + platform_admin 컨텍스트 UPDATE 테스트. 막히면 여기서 STOP → v13 에스컬레이션.

# 2) 통과 시 적용
npm run db:admin:migrate           # 20260618093000_admin_set_app_role.sql 적용 (admin_schema_migrations 추적)
#    적용 직후 검증: 함수 존재, 가드 동작(unauth/non-platform_admin→예외), 마지막 platform_admin 강등 차단, 감사 1건 기록

# 3) 무변경 게이트 (내 증분은 함수 +1, 신규 테이블 0)
node ./scripts/db/schema-snapshot.mjs --diff --exclude-own --base .codex-artifacts/rbac-app-role/before.json

# 4) 코드 검증
npm run typecheck && npm run lint
# e2e (mock 모드, 포트 4177, VITE_SUPABASE_DISABLED=true) — 권한 화면 회귀
# 단위 테스트 추가 후 npm test (system-permissions-supabase-service)

# 5) 문서 동기화 (§3 갭#4) → mojibake 주의
npm run harness:check              # mojibake + doc-crosslinks + route-doc-coverage + lint + typecheck

# 6) 보고서 (.codex-artifacts/rbac-app-role/db-change-report.html) — 가독성 높은 평문

# 7) 커밋 — 9개 RBAC 파일 + 신규 단위테스트 + 동기화한 문서만 명시 stage (동시 세션 파일 제외!)
git add supabase/migrations-admin/20260618093000_admin_set_app_role.sql \
        supabase/migrations-admin/down/20260618093000_admin_set_app_role.sql \
        src/features/system/api/system-permissions-service.ts \
        src/features/system/api/system-permissions-data-source.ts \
        src/features/system/model/permission-store.ts \
        src/features/system/model/permission-types.ts \
        src/features/system/pages/system-permissions-page.tsx \
        src/features/system/pages/system-audit-logs-page.tsx \
        src/shared/model/target-type-label.ts
#   + 추가한 테스트/동기화 문서. 그 후 push.
```

---

## 5. 패턴 / 함정 (이 프로그램에서 학습됨)

- **Codex(GPT-5.5) 구현 위임:** `Agent(subagent_type:"codex:codex-rescue", prompt:"<task> --write", run_in_background:true)`. 포워더는 일반 텍스트만 반환 → `git status`/diff로 검증. **구현 직후 즉시 `cp` 백업**(Codex `.sql` 가시성 flicker로 다음 런 후 소실 사례 있었음).
- **doc-sync가 한글 mojibake 쓰는 경우** 있음 → harness mojibake로 잡고 UTF-8 재작성(또는 `git checkout HEAD -- <file>` 후 수동 Edit).
- **복잡한 마이그레이션은 Claude가 Write로 직접 작성**이 안전(메인 트리에 영속).
- **러너는 토큰 자동주입 안 함** — 위 step 0 export 필수.
- **migrations-admin 네임스페이스**: 추적 `admin_schema_migrations`, 러너 `db:admin:migrate`, 항상 `down/<같은이름>.sql` 작성.
- dev DB: Supabase `fglggyfvzjdsbyckinqa` (talkpik-dev), Management API 적용. e2e는 mock 모드(`VITE_SUPABASE_DISABLED=true`, playwright 4177).

---

## 6. 이 작업 외 남은 프로그램 작업 (전부 결정 게이트)

- **감사 화면 diff/payload 노출 범위** — Phase 0에서 RPC는 diff/payload를 반환하나 화면 미노출(민감정보 포함 가능). 결정 필요: (a)전부 (b)민감필드 마스킹 (c)platform_admin만 (d)계속 숨김.
- **placeholder 신규**(콘텐츠 6·EPS TOPIK·레벨테스트·이커머스·챗봇) — **기획 선결로 보류**(오너 확정). 기획 확정 시 별도 트랙.
- 그 외 오너 결정 없이 가능한 mock→DB 전환은 **소진됨**. (operation 4·community·commerce 3·users 핫픽스·system 메타데이터·시스템로그·Phase 0 감사읽기 = 13 커밋 push 완료.)

---

## 7. 핵심 참조

- 진행상태 메모리: `memory/db-build-program.md`, `memory/MEMORY.md`(인덱스)
- 종합 보고서: `docs/reports/admin-db-migration-program-2026-06-17.html`
- 소유권 SoT: `docs/architecture/shared-supabase-schema-ownership.md` (§2 매트릭스, §3 결정기록 — `admin_audit_logs`=topik-ai 소유 정정 포함)
- 데이터 계약 SoT: `docs/specs/admin-data-contract.md`
- 실행 규칙: `AGENTS.md` (Codex 실행 규칙 + §7 문서 동기화)
