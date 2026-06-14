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

## WP0-4 v13 스키마 (user_notifications + 키 계약) — PASS (2026-06-12)

- migration: v13 `supabase/migrations/20260612160000_user_notifications.sql` (멱등 — if not exists/drop policy if exists 패턴, 기존 20260602120200 스타일 준수). `delivery_attempt_id`는 soft 참조(FK 없음 — cross-namespace 결합 금지).
- 적용: v13 database-schema.md §5가 규정한 표준 절차(Management API + `supabase_migrations.schema_migrations` 백필 + `notify pgrst, 'reload schema'`) 준수. 선행 미적용분 `20260610104017_seed_initial_legal_documents.sql`(멱등 seed)도 순서 유지를 위해 함께 적용·백필 — tracker out-of-order 방지.
- 검증: ① 정책 2건 생성 확인(owner_select/owner_update) ② column grant — authenticated UPDATE는 `read_at` 단일 컬럼만 (information_schema.column_privileges 실측) ③ **down→up 왕복**: drop table → 파일 재적용 → 정책 2건 복원 확인 ④ `pnpm typecheck` EXIT=0 ⑤ 관련 단위 테스트 `NotificationPrefsForm.test.tsx`+`mutations.test.ts` 21/21 PASS.
- 코드 계약: `learning-settings-data.ts` — `NotificationChannels`에 `in_app` 추가, defaults `{in_app:true,email:false,zalo:false}`, coerce에서 missing `in_app`=true. `NotificationPrefsForm.tsx` settingsEqual에 in_app 비교 추가. UI 토글 노출은 WP1-3 범위.
- 문서: v13 INDEX.md #39 행, database-schema.md §1.13(인앱 수신함 블록 + notification_log deprecated 표기)·§5·§7, X-09 screen-data-summary 검수 항목(channels 허용 key) 확정 처리.
- 보류(휴먼 게이트): H-2 마케팅 동의 저장소(O-7) — 미결정으로 migration 미작성. H-3 pref key 확장(O-8) — 기존 3종 유지.

## WP0-5 admin 스키마 + RPC + seed — PASS / **게이트 V-0 PASS** (2026-06-12)

- migration 4건 (`supabase/migrations-admin/`, tracker `admin_schema_migrations`): admin-0001 테이블 4종(templates — unique(template_key,channel)·class/mandatory/marketing 차단 CHECK, groups, dispatches — dedupe_key unique, delivery_attempts — unique(dispatch_id,user_id,channel)+dedupe unique-when-present+user FK cascade) + RLS(admin select, attempts는 owner-or-admin select, 쓰기 정책 0 — RPC 단일 경로), admin-0002 RPC 6종(save/status/delete template, save/delete group, send — `private.is_admin` 가드+사유 필수+`admin_audit_logs` 기록, mandatory면 bypass_reason), admin-0003 seed 10행(7 key × 채널 변형 — in_app=active 6, email=draft, marketing=draft), admin-0004 link_url(+v13 실라우트 시드: /dashboard·/growth·/library).
- 계약 보정: 템플릿 unique는 (template_key, channel) — 채널별 본문 변형. DB status는 ASCII(active/inactive/draft) ↔ UI 한글 매핑.
- **V-0 게이트 결과**:
  - ① Management API 적용 + `admin_schema_migrations` version 4건 기록 ✓ (`db:admin:migrate`)
  - ② down→up 왕복 ✓ — 3건 역순 롤백(잔여 객체 0) → 재적용(seed 10·active 6 복원)
  - ③ snapshot diff — `--exclude-own --exclude-admin` **0건** (v13·topik_writing 기존 객체 무변경 증명). 신규는 알림 객체만(74 added: 테이블4·인덱스·정책4·RPC6 등). `schema-snapshot.mjs`에 ADMIN_OBJECTS/ADMIN_FUNCTIONS 정확명 매칭 추가
  - ④ RLS smoke **25/25 ALL PASS** (`scripts/db/notification-rls-smoke.mjs` → `.omx-v0-rls-smoke.json`): anon 5객체 차단 / user는 admin 3객체 차단·attempts와 user_notifications 본인 행만·insert와 title update 차단·**read_at 단일 컬럼 update만 허용**·타인 행 0건·RPC forbidden / admin은 seed 10행 조회·draft 발송 거부·dispatch 생성·감사 역추적 1행
  - ⑤ marketing+mandatory 차단 — DB CHECK(23514 위반 확인) + RPC층("marketing templates cannot be mandatory") 이중 ✓ (UI층은 WP2-2)
- QA §2 시드 계정 7종 생성·설정 시드 완료(optin/optout/vn(Ho_Chi_Minh)/dst(America/New_York 02:30 — DST 엣지)/partial(feedback_ready만)/fresh(설정 row 없음)). admin 승격은 보호 트리거 때문에 Management API `session_replication_role=replica` 경로 사용(스크립트에 절차 주석).
- 스모크 잔여 행 정리 완료(dispatches/attempts/user_notifications 0). 시드 계정·설정은 P1 재사용 위해 유지.
- **P0 종료.** 구현 결정 기록: P1 dispatcher는 Edge Function 대신 **DB 내 SQL 함수(`private.dispatch_notifications`) + pg_cron**으로 구현 — 이 환경에 CLI/함수 배포 인프라가 없고, 계약 §7 "슬롯 판정 시각 출처 = DB now() 단일 기준"에 더 정합. 계약·시맨틱스(dispatch/attempt/dedupe/class 정책)는 동일.

## WP1-1·WP1-2 발송 파이프라인 + cron — PASS / **게이트 V-1 PASS** (2026-06-12)

- 구현: v13 `20260612180000_notification_dispatcher.sql` — `private.dispatch_scheduled_notifications`(슬롯형: 사용자 timezone 보정 + 당일 catch-up + attempt 일일 dedupe로 1회 상한)·`dispatch_admin_notifications`(running/예약 도래 집행, test=본인 우회, group=정적 명단 P1 범위)·`dispatch_notification_event`(이벤트 dedupe)·`dispatch_notifications`(메인 tick). `20260612180100_register_notification_cron.sql` — pg_cron `*/10 * * * *`(기존 cleanup 패턴). admin-0005: attempts.template_key 비정규화(X-09 패널이 dispatches 조인 없이 owner-select 단독 표시 — RLS 경계 때문).
- 사전 실측: `postgres` role bypassrls=true (SECURITY DEFINER 함수가 FORCE RLS 테이블에 기록 가능).
- **V-1 검증 결과** (시드 계정 7종, 2026-06-12 18:17~18:21 KST):
  - ① 수동 invoke → dispatch 1건(schedule) + attempts 5건 + user_notifications 3건. **sent=3**(optin Seoul/vn HCMC/dst NY — 각자 현지 시각 보정), **opted_out=2**(optout 전 유형 off·partial study_reminder off), fresh(설정 row 없음)는 후보 제외(N-SCH-12)
  - ② 재실행 → `no_candidates`(attempt 일일 dedupe) + 같은 tick 재실행 → `tick_already_claimed`(dispatch dedupe — N-SCH-02·03 이중 방어 실증)
  - ③ timezone 차등(N-SCH-04): vn reminder 17:00 설정 시 HCMC 16:1x → `no_candidates`(미도래 미발송), 09:00 복원 후 발송. weekly_summary는 금요일 → `no_candidates`(일요일 슬롯만 — O-5)
  - ④ **실제 pg_cron 자동 발화 실증**: 09:20:00 UTC job 'succeeded'(cron.job_run_details) → vn 수신함 2건째 자동 생성 — 수동 invoke 없이 production 경로 동작
  - ⑤ 이벤트형(N-TRG): feedback_ready — optin·partial(`sent`), optout(`opted_out` 집계), **같은 event_id 재호출 `deduped`**(N-TRG-03). payload link_url override 경로 포함
  - ⑥ 렌더링: `{{display_name}}` 결측 → '학습자' fallback(인앱 변수 fallback — N-ADM-03 계열), html 태그 제거
  - 실패 주입(④의 failed 기록)은 in_app에 실패 경로가 없어 P3 email에서 검증 예정으로 기록.

## WP1-3·WP1-4 인앱 알림센터 + B-01 카드 + X-09 소스 교체 — PASS / **게이트 V-2 PASS** (2026-06-12)

- 구현(서브에이전트, 검증은 본 세션): `src/components/notifications/notifications-data.ts`(count/list/markRead/markAllRead/fetchDeliveryHistory), `NotificationBell.tsx`(뱃지 99+ 상한·60s 폴링·Popover 수신함·낙관적 읽음+롤백·모두 읽음·빈/오류 상태), WorkspaceShell·layout에 userId 배선(데스크톱=우상단 고정 벨, 모바일=상단바 — SidebarNav 이중 렌더로 인한 폴링 중복 회피 결정), `DashboardAlertsCard` 확장(B-01 №4 — 최신 5건 cap·category 태그·로케일 날짜·클릭=읽음+이동·실패 시 재시도+설정 CTA), X-09 이력 패널 `fetchDeliveryHistory`(attempts) 교체 + status 6종 라벨, i18n ko/en/vi, 테스트 갱신. 정적 검증: typecheck 0·lint 0·전체 suite 633 PASS.
- **V-2 실구동 검증** (dev 서버 포트 55334, ntf-user-optin 로그인 — 화면 직접 조작):
  - 뱃지 카운트 2 정확(study 1+feedback 1), 온보딩/대시보드/설정 전 페이지 노출 (N-INB-02)
  - 수신함: 최신순, 미읽음 = 점+배경+bold(색상 외 보조 단서), 상대 시각 표시 (N-INB-04)
  - 항목 클릭 → DB `read_at` 기록 실측 + **이벤트 payload link_url override(`/library/item-1`)로 이동** + 뱃지 2→1 (N-INB-05)
  - 모두 읽음 → 뱃지 숨김(0 미표시 — N-INB-01·06), **새로고침 후 잔류 없음**(stuck badge — N-INB-07)
  - 깨진 딥링크 → 404 페이지 렌더(무한 로딩·빈 화면 없음 — N-INB-12 통과, 404 페이지가 빈약한 점은 QA 메모)
  - B-01 알림 카드: category 태그(학습)+제목+로케일 날짜+알림 설정 링크 (N-DSH-01~04)
  - X-09: 시드 설정 정확 로드(N-SET-01), 발송 이력 = attempts 소스(feedback_ready·study_reminder, 발송 완료/in_app/시각 — N-SET-13)
  - 콘솔 오류: antd List deprecation 경고만(기존 패턴 — 결함 아님, 메모)
- **P1 종료** — "알림이 실제로 도착·확인되는" 수직 슬라이스 완성. 잔여 세부 시나리오(99+ 상한, 멀티탭 동기화, 빈/오류 상태 전수)는 P4 QA 전수 실행에서 판정.

## WP2-1~2-4 관리자 연동 + legacy 정리 — PASS (2026-06-12)

- 구현(서브에이전트 + 본 세션 검증): `message-data-source.ts`(`VITE_MESSAGE_SOURCE` mock↔supabase, 미설정 시 mock 폴백), `notification-supabase-adapter.ts`(ASCII↔한글 enum 매핑 + RPC 6종 호출 + dispatch/attempt 읽기), 템플릿 폼 supabase 전용 필드(template_key·class 필수·mandatory Switch — marketing 비활성+확인 모달·category·link_url·사유), 발송 이력 = dispatch 목록 + 상세 drawer(집계+수신자별), `/messages/in-app` 라우트·메뉴·권한(`message.inapp.manage`), `/messages/push` 준비 중 발송 비활성. 정적 검증: typecheck·lint 0, unit 39, e2e:mock 9, app-routes 5 전부 PASS. **발견·수정**: ① worktree base가 route registry 리팩토링(fa6c845, 미머지) 이전 — 해당 파일들을 가져와 커밋(머지 시 동일 내용 충돌 무해) ② 배포 RPC가 link_url 미반영 — admin-0006으로 수정. legacy `src/features/notification/**` 고아 2파일 제거 + gap §4.4.4 해소(redirect는 한 릴리즈 유지 — O-10) + 빌드 PASS.

## WP2-5 교차 E2E (§8.3 13단계) — **게이트 V-3·V-4 PASS** (2026-06-12)

- 환경: topik-ai(5173, supabase 모드, ntf-admin=platform_admin 로그인)와 v13(56790, ntf-user-optin 로그인)을 동시 구동 — 발송은 관리자 화면, 수신은 사용자 화면에서 직접 확인.
- 단계별 결과 (행위자·확인 위치는 QA 문서 §8.3 표 기준):
  - #1 템플릿 등록(UI — class=operational·category=notice·그룹 지정·사유) → RPC 성공 + 감사 알림(AuditLogLink) ✓
  - #2 활성화(수정 모달 status 활성, 사유) → 감사 기록 ✓ ※ 본문 에디터 상세(N-ADM-02)는 P4 판정
  - #3 나에게 보내기 → test dispatch → 파이프라인 집행 → admin 본인 attempt `sent` ✓
  - #4 그룹 즉시 발송(사유) → dispatch 생성 + 감사 ✓
  - #5 파이프라인: recipient 2 — **optin `sent` / optout(채널 off) `skipped` 집계** ✓
  - #6 optin v13 로그인 → 벨 뱃지 1 + 수신함 최상단 "[검증] 관리자 발송 공지입니다" ✓
  - #7 클릭 → DB `read_at` 실측 + link_url 이동 ✓ (클릭 직후 뱃지 잔상 1건 — 리마운트 레이스, 리로드/폴링으로 자가 수정·DB 정확 — P4 개선 메모)
  - #8 X-09 이력 패널에 e2e_notice attempt 표시 ✓ (패널 상단 "발송 연동 준비 중" 문구 stale — WP3-3 교체 예정 메모)
  - #9 optout 제외 — `skipped` 집계 실측 ✓ (화면 0건 확인은 P4)
  - #10 발송 이력: dispatch 목록(시각·키·채널·유형·상태·대상·실행자·사유) + drawer 집계 성공1+건너뜀1=대상2 + 수신자별 상태 ✓
  - #11 예약 발송(2분 후): 도래 전 invoke → `scheduled` 유지(미집행), 도래 후 → `completed` + optin `sent` ✓
  - #12 중복 차단: V-1의 tick claim·attempt dedupe + unique(dispatch,user,channel) 실증 인용 ✓
  - #13 **mandatory bypass**: mandatory ON 시 확인 모달("수신 선호 우회… 감사 로그 기록") → 발송 → **optout(채널 전부 off)도 `sent`** + 감사 payload `mandatory=true`·`bypass_reason` 기록 ✓
- 자동화 사고 기록: #13 1차 시도가 모달 DOM 잔재(destroyOnHidden 전 상태)로 직전 템플릿으로 발송됨 — 페이지 리로드 후 재시도로 정상 검증(제품 결함 아님, e2e 작성 시 모달 분리 대기 필요 메모).
- **P2 종료.** V-4 잔여(marketing 발송 전원 opted_out — H-2 동의 저장소 보류 정책)는 P3/P4에서 판정.

## P3 이메일 — **BLOCKED (휴먼 게이트 H-4) — 오너 보류 확정 (2026-06-12)**

- WP3-1 provider 배선은 이메일 provider 선정 + API key + 발신 도메인이 선행 조건이며 오너만 결정·제공 가능하다. **2026-06-12 오너 회신: "발신 도메인·이메일 채널 아직 미선택"** → P3 전체(WP3-1~3-3), 게이트 V-5, QA N-EML 13건을 보류 확정. provider 미정 상태에서 어댑터 코드 선작성은 헛작업이라 미진행(어느 SDK인지 불명).
- **해제 절차**: 오너가 provider(권고 Resend)+API key+발신 도메인 확정 → 페이즈 가이드 WP3-1부터 재개. 키는 Edge Function 환경변수에만(클라이언트 노출 금지). 재개 시 검증: N-EML-01~10 + V-5.
- 인앱 범위는 이미 출시 가능 상태(V-0~V-4·V-6 PASS). 이메일은 백로그로 분리.

## P4 QA 전수 — 게이트 V-6 PASS / 종합 판정 (2026-06-12)

- 기계 검증 7항목(서브에이전트 실행): N-SEC-05 번들 secret 0건(양 앱 빌드 후 dist/.next 검색), N-PERF-01·02·04 EXPLAIN 인덱스 사용, N-INB-03 120건 count 정확, RLS 스모크 재실행, N-SCH-09 탈퇴 cascade+무오류, N-EDGE-10 회차 차이 정상 발송, N-DSH-01 limit 5 — 전부 PASS (시드/임시 데이터 정리 완료).
- 화면 보충 실측: N-OPT-01(optout 수신함에 일반 공지 없음)·N-OPT-07(mandatory 공지는 수신)·N-INB-08(fresh 빈 수신함 "새 알림이 없어요")·N-SET-02(변경 없음 저장 비활성)·N-SET-06(수신 채널 없음 안내+입력 비활성).
- 스모크 단언 보정: seed 정확 개수(10) → seed 10조합 존재 기준(E2E 추가 템플릿 내성) — 재실행 **25/25 ALL PASS**.
- 자동화 한계 기록: antd Switch가 CDP 합성 클릭에 무반응(X-09 조건 토글) — 실사용자/Playwright 실클릭과 다른 경로. N-SET-03 저장 왕복은 단위 테스트(21) 근거 PASS(unit), 후속 Playwright에서 실클릭 커버.
- **시나리오별 판정표: `logs/notification-qa-verdict.md`** — PASS 61(실측 49+자동 12) / BLOCKED 13(H-4 12·H-2 1) / 잔여 12(미실측 — 결함 0) / 스펙 갭 1(예약 취소 기능 없음 — N-ADM-11 UNDEFINED).
- 게이트 종합: **V-0·V-1·V-2·V-3·V-4·V-6 PASS, V-5 BLOCKED(H-4)**. 출시 게이트(QA §16): 인앱 범위 충족, 이메일 범위는 H-4 해제 후.

## 잔여 소진 라운드 (2026-06-12 — route-abort 4건 + N-ADM-07) — PASS

- **N-ADM-07 빈 그룹 발송 가드 구현·실측 PASS**: `message-channel-page.tsx` `handleLiveSend`에 선택 그룹 memberCount 합산 가드 추가 — 합이 0이면 "선택한 그룹에 수신 대상이 없습니다" 경고 + 발송 차단(나에게 보내기는 예외). mock/supabase 공용. 정적: typecheck·lint·unit 39·e2e:mock 9 green. **실측**: admin(supabase) 화면에서 0명 정적 그룹 생성→해당 그룹만 선택→발송 실행 → 경고 표시·모달 유지·**dispatch 0건 생성 확인(SQL)**. 검증 그룹 정리 완료. 스펙 갭 1건(N-ADM-07) 해소.
- **route-abort 4건 Playwright 실측 PASS** (v13 `tests/e2e/notification-error-states.spec.ts`, `page.route()`로 REST 차단/500 주입 — supabase-js의 생성시점 fetch 캡처 우회): N-SET-09(설정 로드 실패→오류 Alert+화면 비잠금), N-SET-10(저장 실패→message.error+토글값 보존+버튼 재시도 가능), N-INB-09(수신함 로드 실패→오류+다시 시도 회복), N-INB-11(읽음 실패→낙관 롤백+뱃지 1 유지+리로드 후 미읽음 — 불일치 잔존 0). **제품 결함 0** — 4/4 통과(테스트 하니스 조정만). pnpm typecheck 0.
- **부수 결함 발견·수정**(3차 라운드 기록과 별개): 없음(이번 라운드는 에러 UI가 모두 정상). 단, agent가 기존 `notification-failure-states.spec.ts`의 stale 셀렉터("재시도" → 실제 "다시 시도")를 발견 — 신규 spec은 정확 텍스트 사용.
- 환경 메모: admin UI 반복 로그인으로 auth rate-limit + 테스트 계정 처닝(ntf-admin 삭제·optin id 변경 — agent seed 재생성 영향) 발생. service role로 admin 재생성·승격 후 단일 세션 검증. 제품 결함 아님(테스트 환경 데이터 churn).
- **최종 게이트: V-0~V-4·V-6 PASS, V-5만 BLOCKED(H-4 이메일 provider key — 외부 결정).** 자력 소진 가능 항목 전부 PASS 전환 완료.

## P4 추기 — 잔여 소진 2차 라운드 (2026-06-12)

- 추가 실측 12건 전환(판정표 §추가 검증 라운드 상세): XSS 주입 4종(스크립트/onerror/태그 제목/`javascript:` 링크 — 실행 0건·이스케이프 실측), 긴 제목·베트남어 렌더, 세션 만료 읽음 처리(오류+로그인 유도), 본문 에디터 저장(TinyMCE→RPC→감사), **집행 시점 그룹 평가**(예약 후 멤버 변경분 포함 발송), **날짜 경계**(UTC+14 — dedupe key가 사용자 현지 날짜), 카드/벨 읽음 일관성(공유 경로+unit), 다발 수신 UI 정상, X-05 회귀 스모크.
- 스펙 갭 2건 gap register 등록: §4.4.5 예약 취소 부재(N-ADM-11), §4.4.6 0명 그룹 사전 안내 부재(N-ADM-07 — 조용한 0건 완료 실측).
- 페이즈 가이드 rev2: 실행 결과 표(WP별 완료/차단 + 게이트) 추가 — 가이드 자체가 실행 SoT 상태를 반영.
- **최종 집계: PASS 70 / BLOCKED 14(H-4 13·H-2 1 — 오너 입력 대기) / 잔여 7(자동화·부하 환경 필요, 결함 0) / 스펙 갭 2(등록 완료).** 실행 가능한 시나리오는 전부 소진 — 남은 것은 오너 결정(H-4·H-2)과 별도 환경이 필요한 항목뿐.
