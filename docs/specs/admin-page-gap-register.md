# 관리자 페이지 미확정/누락/오구현 레지스트리

## 1. 목적

- 이 문서는 관리자 각 페이지의 `운영`, `기능`, `정책`, `페이지/데이터 연관성` 관점에서 아직 확정되지 않았거나 누락된 사항, 관리자 페이지 기준으로 잘못 구현된 사항을 코드베이스 기준으로 추적하는 레지스트리다.
- 신규 작업에서 아래 항목을 해소하거나 상태를 바꾸면, 구현과 함께 이 문서를 같은 작업에서 반드시 갱신한다.

## 2. 판정 기준

- `미확정`: 정책, 책임 주체, 데이터 계약, 감사 로그 계약, B2C 노출 위치, 화면 간 연결 규칙이 코드상으로 고정되지 않았거나 문서/구현이 서로 다름
- `누락`: 관리자 페이지로서 필요한 상태 처리, 조치 검증, URL 복원, 권한/사유 입력, 상세 진입, 감사 로그 연결, e2e 검증 장치 등이 없음
- `오구현`: 현재 구현이 전역 패턴, 용어 계약, 데이터 SoT, 감사 로그 계약, 관리자 UX 원칙과 어긋남

## 3. 전역 공통 이슈

### 3.1 인코딩/라벨 깨짐

- `src/shared/layout/admin-labels.ts`
- `src/shared/layout/admin-shell.tsx`
- `src/shared/ui/placeholder-page/admin-placeholder-page.tsx`
- `src/features/dashboard/pages/dashboard-page.tsx`
- Windows PowerShell 기본 인코딩으로는 일부 UTF-8 문서가 깨져 보일 수 있으나, `docs/**` 본문 자체가 손상된 것은 현재 확인되지 않았다.
- 실제 오구현 범위는 소스 코드의 사용자 노출 문자열 리터럴과 공용 라벨 파일에 남아 있는 mojibake다.
- `Commerce > 쿠폰 관리` 생성 페이지의 깨진 문자열은 2026-03-26 작업에서 복구 완료했다.
- 우선순위: `오구현`
- 필요 조치: UTF-8 기준으로 소스/문서 인코딩을 정리하고, 깨진 문자열을 계약 용어 기준으로 복구해야 한다.

### 3.2 Placeholder 라우트 다수 잔존

- `src/app/router/routes.ts`
- 아래 라우트는 아직 `AdminPlaceholderPage`에 머물러 있어 운영/기능/정책 계약이 코드에 고정되지 않았다.
- `Operation > 챗봇 설정`
- `Commerce > 이커머스 관리`
- `Assessment > EPS TOPIK`
- `Assessment > 레벨 테스트`
- `Content > 콘텐츠 관리`
- `Content > 배지`
- `Content > 단어장`
- `Content > 소나기`
- `Content > 객관식 선택`
- `Content > 학습 미션`
- 우선순위: `미확정 + 누락`
- 필요 조치: 각 페이지 IA, 데이터 계약, 감사 로그 계약, URL 복원 규칙, 상태 UX, 상세 진입 패턴을 실제 구현 전 문서와 함께 확정해야 한다.

### 3.3 모듈 명칭과 실제 구현 축 불일치

- `src/app/router/routes.ts`
- `src/features/notification/**`
- `src/features/message/**`
- `src/features/billing/**`
- 라우트는 `messages`, `commerce`를 사용하지만 실제 구현 폴더는 일부 `notification`, `billing`을 유지하고 있다.
- `notification-send-page.tsx`, `notification-history-page.tsx`는 더 이상 라우트에서 직접 쓰지 않고 redirect만 남아 있어 책임 경계가 불명확하다.
- 우선순위: `미확정`
- 필요 조치: 현재 표준 모듈명을 `Message`, `Commerce`로 단일화하고, 레거시 페이지/폴더의 존치 여부를 결정해야 한다.

### 3.4 감사 로그 Target Type 과도한 범용화

- `src/features/system/pages/system-audit-logs-page.tsx`
- `docs/specs/admin-data-contract.md`
- 현재 `Message`, `Operation`, `Commerce` 같은 범용 Target Type이 혼재한다.
- 어떤 엔티티를 조치했는지 `Template`, `Group`, `Refund`, `Notice`, `Faq`, `Event` 단위까지 내려가지 않아 조치 추적성이 약하다.
- 2026-06-17 갱신: `Operation > 공지사항`은 `OperationNotice + noticeId`로 세분화했고, 저장/상태 변경/삭제 RPC의 `target_table`도 `OperationNotice`로 고정했다.
- 2026-06-17 갱신: `Operation > 이벤트`는 `OperationEvent + eventId`로 세분화했고, 저장/예약/게시/종료 RPC의 `target_table`도 `OperationEvent`로 고정했다.
- 우선순위: `미확정 + 오구현`
- 필요 조치: 남은 엔티티별 Target Type 표준을 확정하고 감사 로그 목록과 각 페이지 조치 로그를 같은 기준으로 맞춰야 한다.

### 3.5 하드코딩된 관리자 Actor 사용

- `src/features/message/pages/message-channel-page.tsx`
- `src/features/message/pages/message-history-page.tsx`
- `src/features/billing/pages/billing-refunds-page.tsx`
- `src/features/system/pages/system-permissions-page.tsx`
- `admin_current`, `admin_park` 같은 값이 조치 수행자로 하드코딩되어 있다.
- 우선순위: `오구현`
- 필요 조치: 실제 로그인 관리자 식별자 또는 최소한 공통 auth/context 기반 파생값으로 치환해야 한다.

### 3.6 자동 e2e 검증 커버리지 제한

- `playwright.config.ts`, `tests/e2e/operation-policies.spec.ts`가 추가되어 초기 실행 기반은 생겼다.
- 다만 아직 `Users`, `Community`, `Message`, `Commerce` 등 다른 고위험 운영 플로우는 자동 e2e 시나리오가 없다.
- 우선순위: `누락`
- 필요 조치: 정책 관리를 시작점으로 삼아 고위험 조치가 있는 목록/상세/조치 플로우를 모듈별로 순차 확장해야 한다.

### 3.7 운영 DB 컷오버와 Vercel 웹 배포 완료 / 서버 워커 환경 교정 필요

- `Resolved(DB)`: 2026-07-16 `topik-prod`에 admin canonical migration 83개와 TOPIK 쓰기 migration 32개를 적용·장부화했다. 공급 `updated_at` 전제조건이 충족되지 않은 writing migration 1개는 manifest에서 명시적으로 차단했다(2026-08-24 공급 채움 확정으로 차단 해제·적용 완료).
- `Resolved(Auth)`: 현재 설정된 관리자 계정을 active `platform_admin`으로 승격했다. 최종 `profiles.app_role`은 `learner`이고 `admin_accounts`/`admin_get_self`가 관리자 권한 SoT다. bootstrap 감사 로그와 legacy key 비활성 상태를 검증했다.
- `Resolved(Security)`: admin 소유 public 함수의 anon execute를 회수했고 운영 표본 쿼리에서 anon executable admin function 0건, 점검 대상 RLS 10/10을 확인했다.
- `Resolved(CRUD)`: 최신 소스+운영 DB에서 현재 관리자 로그인, 정기 쿠폰 템플릿 생성·상세·수정·삭제, 감사 로그 확인, 삭제 후 업무 행 0건과 저장 2건/삭제 1건 감사를 브라우저와 DB로 검증했다.
- `Resolved(Deployment)`: PR `#14`를 rebase merge해 Production commit `536cad11db0a27c7105c07f43fa04daa073705a9`을 배포했다. `https://topik-ai.vercel.app`에서 현재 관리자 로그인, `topik-prod`의 `commerce_coupon_subscription_templates` 요청 `200`, 정기 쿠폰 CRUD·감사 로그 E2E 1/1을 통과했고 mock seed는 노출되지 않았다.
- `Resolved(API)`: Production의 `/api/auth-email/sync`, `/api/admin/invite`, `/api/notifications/dispatch-email` 비인증 `POST`와 알림 워커 비인증 `GET`이 모두 `401`을 반환한다.
- `Resolved(Actual SMTP)`: 2026-07-16 오너 승인 후 `notification_email_config.mode=live`로 전환하고 현재 관리자 본인 대상 dispatch `86da4dd8-1152-4835-87f1-2e12b44202ab`/attempt `92b6938c-e546-4f2f-b5b3-9f416dc6c5d9`을 생성했다. 현재 워커 소스를 운영 DB와 실제 SMTP에 연결해 `processed=1, sent=1, failed=0`을 확인했고 attempt는 `sent`, provider message id 존재, `sent_at` 존재, retry `0`, error 없음이다. Production 발송 이력 Drawer도 `완료/성공 1`로 일치했다.
- `Open(Vercel server env)`: 동일한 유효 `topik-prod` 관리자 JWT가 배포된 `/api/notifications/dispatch-email`, `/api/auth-email/sync`, `/api/admin/invite`에서 모두 `401 invalid_session`으로 거부된다. JWT issuer·subject와 운영 `admin_accounts(active platform_admin)`는 일치하므로 Vercel 서버 전용 `SUPABASE_URL`/`SUPABASE_SERVICE_ROLE_KEY` 조합이 운영 프로젝트와 불일치한다. `Ready`는 배포 성공 상태일 뿐 이 런타임 통합 성공을 의미하지 않는다.
- `Open(Recipient count)`: 해당 테스트 dispatch의 `recipient_count=0`이지만 실제 attempt aggregate는 `1`이다. 현재 전달 결과 화면은 attempts 집계를 정확히 표시하나 실행 ledger 수치 보정이 필요하다.
- 우선순위: `P0 Vercel 서버 환경 + P1 발송 수 정합성`
- 필요 조치: Vercel Production/Preview의 canonical 서버 env를 `topik-prod` URL과 활성 secret key로 다시 저장하고 새 배포 후 관리자 JWT `POST` smoke를 2xx로 통과시킨다. 이후 같은 attempt를 재발송하지 말고 pending 0건 상태에서 워커 no-op과 신규 통제 발송을 각각 검증한다. recipient count는 v13 소유 디스패처 경계에서 수정 제안/적용한다.

### 3.8 저장 완료 알림(router state 소비)이 중복 발화 — **해소 (2026-08-03)**

- 등록/수정 페이지가 목록으로 돌아올 때 `navigate(..., { state })` 로 "저장 완료" 신호를 넘기고 목록이 그것을 읽어 알림을 띄우는 패턴이 5개 화면 6개 키에 있었다(공지·정책·메시지 채널·이벤트·쿠폰). 그런데 구현이 **두 갈래로 갈려 각각 절반만** 갖고 있었고, 둘 다 갖춘 화면은 하나도 없었다.
- `해소`: 클리어형(공지·정책·메시지) — 소비 기록이 없어 StrictMode 가 마운트 시 effect 를 두 번 실행하면 두 번째 실행이 `state: null` 반영 전의 `location.state` 를 다시 읽어 **알림이 2개** 떴다. dev 전용이지만 e2e 가 dev 서버를 쓰므로 Playwright strict-mode locator 위반까지 일으켰다(실측: dev 2개 / 프로덕션 빌드 1개).
- `해소`: 가드형(이벤트·쿠폰) — `useRef` 로 같은 도착을 막았지만 state 를 지우지 않아 history 엔트리에 남았다. 다른 화면에 갔다 뒤로 오면 컴포넌트가 리마운트되며 ref 가 리셋되고 살아 있는 state 를 다시 읽어 **오래된 성공 알림이 재발화**했다. 이쪽은 StrictMode 와 무관해 **프로덕션 빌드에서도 재현**된다(실측). commerce 쪽 생산자 2곳은 `replace: true` 가 없어 push 로 남아 브라우저 뒤로/앞으로 왕복만으로도 도달한다.
- 조치: `src/shared/model/use-router-state-notice.ts` 를 신설해 "소비 기록 ref + 소비 즉시 state 초기화"를 한 곳에 묶고 6개 호출부를 전부 전환했다. 두 장치가 **함께** 있어야 하며 하나만 있으면 서로 다른 환경에서 깨진다는 사실을 훅 주석에 계약으로 남겼다.
- 초기화는 `navigate` 가 아니라 `history.replaceState` 로 **그 키만** 지운다. `navigate({pathname, search}, {state: null})` 로 지우면 세 가지가 조용히 깨진다: ①다른 키까지 날아가 지연 마운트 서브트리가 소비할 알림이 영구 소실, ②소비 시점에 캡처한 `search` 를 되쓰므로 같은 커밋에서 쿼리를 정규화하는 effect 보다 훅이 아래에 선언되면 그 정규화를 되돌린다, ③`hash` 가 사라진다. 실측으로 `?keyword=CPN#anchor-section` 유지·다른 키 보존·react-router 의 `key`/`idx` 부기 보존을 확인했다.
- 키 오타 침묵 차단: `src/shared/model/router-saved-state.ts` 의 `RouterSavedStateMap` 이 키와 payload 를 함께 묶고, 생산은 `routerSavedState(key, value)` 헬퍼로만 한다. 전에는 생산·소비가 각자 인라인 객체 리터럴로 키를 적어 한쪽 오타가 "알림이 안 뜬다"로만 나타났고 어떤 게이트도 잡지 못했다. `src/shared/model/target-type-label.ts` 가 이미 전 도메인 target type 을 shared 에서 열거하는 선례다.
- 경계 고정: `scripts/check-router-state-notice-boundary.mjs` — ①훅 파일 외에서 `location.state` 직접 읽기 금지, ②저장 신호 키를 객체 리터럴 속성으로 적기 금지. `harness:check` 와 `harness:e2e:smoke` 에 배선했다(저장소에 `check-*.mjs` 가 15개인데 `harness:check` 가 실제로 도는 건 소수라, 만들고 배선하지 않으면 돌지 않는다).
- 이 경계 검사가 곧바로 일했다: 같은 날 별도 PR 로 들어온 기관 코드 상세 페이지의 `institutionCodeCreated` 소비부가 인라인 ref 가드로 `location.state` 를 직접 읽고 있어 리베이스 직후 게이트가 걸렸고, 같은 훅으로 전환했다. 이때 키 추출 정규식이 접미사(`*Saved`)로 좁혀 있어 새 키(`institutionCodeCreated`)를 놓치는 상태였던 것도 드러나 최상위 키 전량 추출로 고쳤다 — **명명 규약에 의존하는 검사는 규약을 벗어난 항목에서 조용히 빈 통과가 된다.**
- 회귀 고정: `tests/e2e/router-state-notice.spec.ts` — 공지 등록 후 알림 개수 1건(클리어형), 쿠폰 템플릿 생성 후 다른 화면 왕복 시 0건(가드형). 수정 전 코드에서 두 테스트가 각각 `Expected 1, Received 2` 와 `usr` 잔존으로 실패함을 확인했다(red→green).
- ⚠️ **키 오타의 컴파일 오류 전환은 `npm run typecheck` 로는 검증되지 않는다.** 그 스크립트가 빈 통과라서다(§3.9). `npx tsc -b --noEmit` 으로는 `TS2345: Argument of type '"operationNoticSaved"' is not assignable to parameter of type 'keyof RouterSavedStateMap'` 가 정확히 나오는 것을 확인했다.
- 잔여: commerce 생산자 2곳의 `replace: true` 누락은 이제 무해하다(state 를 지우므로). 저장 후 뒤로 가면 생성 페이지로 돌아가는 동선 자체는 별건 UX 판단으로 남긴다.

### 3.9 `npm run typecheck` 가 아무 파일도 검사하지 않음 — **해소 (2026-08-04)**

- 루트 `tsconfig.json` 이 `files: []` + `references` 만 가진 solution-style 파일이다. `tsc --noEmit` 은 project reference 를 따라가지 않으므로 검사 대상이 0개였다. `npm run build` 도 `tsc --noEmit && vite build` 이고 vite 는 esbuild 로 타입을 벗겨내므로, **저장소에 동작하는 타입 검사가 없었다.** AGENTS.md §11.5 가 커밋 전 필수로 지정한 `harness:check` 의 typecheck 단계가 그동안 빈 통과였다.
- 재현(수정 전): `src/**` 아무 파일에 `const x: number = "s";` 를 넣어도 `npm run typecheck` 가 exit 0. `npx tsc -b --noEmit` 은 잡는다.
- 조치: `typecheck` 와 `build` 를 `tsc -b --noEmit` 으로 교체했다. 그 전에 드러난 **기존 타입 오류 134건을 0건으로 정리**했다.
- **역검증(가장 중요)**: 같은 위반을 다시 주입해 `npm run typecheck` 가 `TS2322` 를 출력하고 **exit 1** 로 끝나는 것을 확인했다(출력만 보면 게이트가 CI 를 실패시키는지 알 수 없다). 복원 후 exit 0.

#### 3.9.1 정리한 134건의 성격 (재발 방지용 분류)

절반 이상이 개별 코드 실수가 아니라 **공용 유틸·설정 한 곳**에서 나왔다. 파일 수로 겁먹지 말고 뿌리를 먼저 찾을 것.

| 뿌리 | 성격 | 감소 |
| --- | --- | --- |
| `shared/ui/table/table-column-utils.ts` 의 `onFilter` 파라미터 | React 19 타입의 `Key` 에 `bigint` 가 포함돼 `string \| number \| boolean` 으로 좁히면 반공변성 위반 → 컬럼 배열 전체가 `ColumnType` 에 할당되지 않았다 | 134 → 101 |
| `tsconfig.app.json` `lib` ES2020→ES2022·`composite` 신설, `tsconfig.node.json` `target`/`lib`/`include` | **코드가 아니라 설정 문제**였다. `String.replaceAll`(TS2550)·`Set` 순회(TS2802)·`api/` 의 `src/` 크로스 import(TS6307) | 101 → 94 |
| `antd` 의 `SortOrder` import 경로(5파일) | antd 는 루트에서 export 하지 않는다 → `antd/es/table/interface` | 94 → 90 |
| `fixDrawerTableFirstColumn` 호출부 9곳의 타입 인자 생략 | 생략하면 `RecordType` 이 제약(`object`)으로 폴백해 레코드 타입이 소실되고 `render`/`sorter` 안에서 모든 속성 접근이 깨졌다 | 88 → 60 |
| 옵션 헬퍼 14개의 `SelectProps['options']` 반환 타입 | `DefaultOptionType` 은 `label` 이 옵셔널이라 `Radio.Group` 의 `CheckboxOptionType`(label 필수)에 할당되지 않는다 → `CouponLabeledOption` 신설 | 49 → 41 |
| 배열·조건부 spread 의 리터럴 위드닝 | `as const` 혼용 또는 누락으로 리터럴 유니온이 `string` 으로 넓어졌다(mock 원장 `entryType`, `stepKeys`, setState 갱신본) | 개별 |

- 조용히 넘어가면 안 되는 발견 2건: ①`operation-event-create-page.tsx` 의 폼 값 타입에 `bannerImageUrl`·`bannerImageSourceType`·`bannerImageFileName` 이 빠져 있었다. 세 필드는 `useWatch` 로 읽고 저장 payload 에 실려 나가므로 **타입이 낡은 것**이었다(필드를 지우면 동작이 깨진다). ②`api/notifications/dispatch-email.ts` 의 로컬 `WorkerSchema` 에 `channel`·`status` 가 없어 `.eq()` 필터 키 타입이 select 목록으로 좁혀졌다. DB 에는 있는 컬럼이라 선언을 채웠다.
- 동작을 바꿀 수 있었던 지점은 보수적으로 처리했다: `faqs-service` 의 비표준 코드 `'INVALID_STATE'`(소비처 0건)는 형제 서비스와 같은 `'VALIDATION_ERROR'` 로, `InputNumber` 의 `parser` 는 `Number("") = 0` 이 되는 동작 변경을 피하려고 런타임 표현식을 유지하고 타입만 맞췄다(rc-input-number 는 숫자 문자열도 파싱한다).
- 남은 관련 사실: `*.tsbuildinfo` 는 `tsc -b` 가 만드는 증분 캐시이며 §3.10 에서 gitignore 했다.

#### 3.9.2 `tests/**` 는 그 뒤로도 검사되지 않았다 — **해소 (2026-08-20)**

- §3.9 로 `tsc -b` 를 배선한 뒤에도 검사 대상은 `tsconfig.app.json`(include: `src`)과 `tsconfig.node.json`(include: `vite.config.ts`·`api`·assessment server) 둘뿐이었다. **`tests` 는 어느 프로젝트에도 없었다** — 테스트 코드 전체가 타입 검사 밖이었다.
- 조치: `tsconfig.tests.json` 신설 + 루트 solution 에 참조 추가.
- 🚨**`references` 로 app/node 를 가리킬 수 없다** — 두 프로젝트가 `noEmit: true` 라 `TS6310: Referenced project may not disable emit` 로 거부된다. 그래서 테스트가 import 하는 소스(`src`·`api`·`vite.config.ts`)를 **tests 프로젝트의 include 에 함께 넣었다**. src·api 가 두 번 검사되므로 cold typecheck 가 **10.1s → 19.1s** 가 된다. 이걸 피하려면 app/node 를 `emitDeclarationOnly` 로 바꿔 선언을 내보내야 하는데, 빌드 산출물이 생기는 구조 변경이라 채택하지 않았다.
- 옵션은 app 과 같게 두되 `types: ["node", "vite/client"]` 만 다르다 — 테스트가 브라우저 코드(src)와 서버 코드(api)를 동시에 import 하고, src 의 `import.meta.env` 접근에 `vite/client` 가 필요하다.
- **역검증**: `tests/unit` 과 `tests/e2e` **각각**에 타입 위반을 주입해 `npm run typecheck` 가 exit 1 로 끝나는 것을 확인했다(복원 후 exit 0). 대상이 유지되는지는 `tests/unit/typecheck-project-coverage.test.ts` 가 지킨다 — 루트 참조 3개·tests include·`-b` 플래그를 고정하고, tests 참조를 빼는 red 주입에서 1케이스 실패를 확인했다.

##### 드러난 오류 4건 — 절반은 테스트가, 절반은 타입이 틀렸다

| 위치 | 무엇이 틀렸나 | 판단 |
| --- | --- | --- |
| `system-permissions-service.ts` `AdminUserRpcRow.created_at` | 테스트가 `created_at: null` 을 넣는데 타입은 `string` | **타입이 낡았다** — postgres `returns table` 컬럼은 항상 nullable 이고 `mapRpcRow` 는 이미 null 을 처리한다(`toDateTimeSeconds` 가 null→`''`). `string \| null` 로 넓혔다 |
| `users-export-xlsx.test.ts` `affiliation: null` | 타입은 `affiliation?: string` | **테스트가 틀렸다** — 실제 생산자(`users-page`)는 `query.affiliation \|\| undefined` 를 넘긴다. `undefined` 로 고쳤다 |
| `notification-dispatch-email-worker.test.ts` `query.update` 재대입 | 리터럴은 `query` 를, 재대입은 `{ eq }` 를 돌려줬다 | **죽은 선언** — 실제 계약은 `update(...).eq(...)` 가 Promise 다. 리터럴에서 바로 `{ eq }` 를 돌려주게 하고 재대입을 지웠다 |
| `list-loading-consistency.spec.ts` `window.setTimeout` 스텁 | node 의 `setTimeout`(`__promisify__` 보유)과 교차 타입 | **환경 차이** — 이 함수는 `addInitScript` 로 브라우저에서 돌지만 tests 프로젝트는 node 타입도 본다. 대입 지점만 단정(`as typeof window.setTimeout`)했고 e2e 11/11 로 런타임 동작 불변을 확인했다 |

- 🔑 교훈 재확인: 타입 오류를 볼 때 **낡은 타입 vs 틀린 코드**를 먼저 가른다. 4건 중 2건은 테스트가 옳고 타입/선언이 틀린 쪽이었다.

### 3.10 테스트 산출물이 git 에 추적되어 워킹트리를 오염시킴 — **해소 (2026-08-04)**

- `test-results/.last-run.json` 이 초기 대량 커밋(`63727e2`)에 우발적으로 포함돼 추적되고 있었고 `.gitignore` 에 `test-results/` 항목이 없었다. e2e 를 돌릴 때마다 이 파일이 변경되고, 실패 시에는 `test-results/<테스트명>/` 아래에 스크린샷·trace·`error-context.md` 가 생겨 `git status` 가 산출물로 덮였다. 다른 작업 중 `git add -A` 로 산출물을 함께 스테이징할 위험이 실제로 있었다.
- 조치: 추적 해제 + `.gitignore` 에 `test-results/`·`playwright-report/`·`.playwright-mcp/`·`*.tsbuildinfo` 추가. `playwright.config.ts` 는 `outputDir` 을 지정하지 않아 기본값 `test-results/` 를 쓴다. `*.tsbuildinfo` 는 §3.9 복구에 필요한 `tsc -b` 가 만드는 증분 캐시다.
- CI 무영향 확인: `.github/workflows/ci.yml` 의 아티팩트 업로드는 `if: failure()` + `if-no-files-found: ignore` 이고 파일시스템을 직접 읽으므로 gitignore 와 무관하다.
- 검증: e2e 를 실행한 뒤 `git status` 에 산출물이 나타나지 않음을 확인했다(이전에는 `M test-results/.last-run.json` 이 떴다).

### 3.11 서비스 인프라 헬퍼·데이터소스 판별 로직이 파일마다 복제됨 — **부분 해소 (2026-08-18)**

- 동일 본문 헬퍼가 서비스 파일마다 로컬로 복제되어 있었다: `requireClient` 24곳, `throwIfAborted` 18곳, `sleep` 18곳, `toDateTime` 18곳(분/초 정밀도 2계열), `requireReason` 15곳, `toDate` 8곳 등. mock/supabase 판별도 `*-data-source.ts` 21개가 같은 3분기 로직(미구성 → mock, 강제 env → mock, 그 외 supabase)을 반복했다. 신규 도메인을 추가할 때마다 복제가 늘고, 수정 시 일부 복제본만 고쳐질 위험이 상존했다.
- 조치(2026-08-18): 함수 본문을 해시로 대조해 동일성을 검증한 것만 `src/shared/api/supabase-service-utils.ts`(가드 4종), `src/shared/model/date-format.ts`(날짜 포맷 3종), `src/shared/api/api-error.ts`(`createNotFoundError`), `src/shared/api/data-source.ts`(판별 팩토리)로 통합했다 — 로컬 복제 계 104개 제거. resolver 21개는 공개 API(파일명·타입·강제 env 키) 불변의 thin wrapper 로 남겨 문서·e2e 계약을 유지했다.
- 동작 보존을 위해 통합에서 제외한 잔여: `requireReason` 1곳(기관 계약 — 사용자 노출 에러 메시지 상이), `toDateTime` 2곳(billing·auth-email — `undefined` 폴백 반환), `toStringArray` 4곳(String 강제 vs typeof 필터 2계열), `parseSortOrder` 7곳(도메인별 반환 타입 상이), `formatNow` 10곳·`normalizeText` 3곳(mock/store 계층). 목록 질의(정렬/필터/URL 코덱) 계열은 공용 훅 추출 단계에서 다룬다.
- 이월분 해소(2026-08-18, Phase 3a): `formatNow` 10곳 → `formatNowMinutes`/`formatNowSeconds`(분 7·초 3, `date-format.ts`), `toStringArray` 4곳 → `coerceStringArray`/`filterStringArray`(동작별 2함수, `supabase-service-utils.ts`), `parseSortOrder` 7곳 → `table-column-utils.ts` 단일 정의(도메인 별칭 `PointSortOrder`·`CouponSortOrder` 는 antd `SortOrder` 와 동일 유니온으로 실측 확인 — 고아가 된 타입 선언·import 6건 동시 제거). 계 21곳 추가 통합. **의도적 잔존(종결)**: `normalizeText` 3곳(1줄 `trim()` — 공용화 이득 없음), `toDateTime` undefined 폴백 2곳, `requireReason` 문구 상이 1곳(사용자 노출 문구 변경은 동작 변경이라 제외).
- 같은 작업에서 path alias `@/*`(tsconfig.app.json `paths` + vite `resolve.alias`, vitest 는 vite 설정 승계)를 도입하되 이번에 수정한 파일에만 적용했다 — 전면 치환은 진행 중인 다른 브랜치와의 충돌을 피해 별도 작업으로 분리. 미사용 CSS 클래스 13계열(BEM 하위 포함, `global.css` 232줄)과 git 추적 중이던 임시 파일 6개(`tmp_*.ps1` 3, `preview*.log` 3)도 제거했다.
- §3.10 함정 재발 실측(2026-08-18): 위 임시 파일 6개의 **삭제 diff 가 릴리스 분류기에서 `unknown-path` 6건이 되어 PR #87 의 `ci-gate` 를 blocked 로 만들었다** — v7 이 test-results 제거 커밋에서 밟은 것과 같은 구조("사후 gitignore 는 삭제하는 커밋을 구하지 못한다"). 분류기 v8 로 해소: 해당 6개 파일명을 정확 목록(`RETIRED_ROOT_ARTIFACTS`)으로만 light 분류에 추가해 다른 루트 신규 파일의 fail-closed 기본값은 유지했고, 회귀 테스트(6개 삭제 → sync-only/light, 목록 밖 루트 파일 → 여전히 blocked)를 `release-change-classifier.test.mjs` 에 추가했다.

### 3.12 파일 비대화·mock 경계·중복 코드에 기계 게이트가 없음 — **해소 (2026-08-18, 리팩토링 Phase 2)**

- 위생 게이트(lint·typecheck)가 완벽해도 구조 문제는 통과했다: 3,023줄 페이지, mock 픽스처의 feature 경계 밖 import 5곳(프로덕션 경로 오염), 동일 본문 헬퍼 104개(§3.11) 모두 기존 게이트로는 잡히지 않았다. 게이트 없이 분해(Phase 4)부터 하면 다음 기능 추가 때 되돌아간다.
- 조치(2026-08-18): 게이트 3종 신설, 전부 위반 주입 → exit 1 실측으로 배선 검증(§3.9 교훈 "게이트 통과 ≠ 검사가 돌았다").
  - `max-lines` 800(공백·주석 제외): 도입 시점 위반 24개는 `.eslintrc.cjs` overrides baseline 으로 동결. **baseline 목록은 줄이기만 하며 신규 추가 금지** — 이 목록이 Phase 4 분해 작업의 대상 목록이다.
  - Phase 4 분해 착수(2026-08-19, 파일럿 = operation-events-page): 절단 패턴 확립 — ①URL 파서·조치 카피 → `model/*-page-schema.ts` ②목록 컬럼 → `ui/*-columns.tsx` 팩토리(정렬/필터 상태·핸들러는 페이지가 소유하고 인자로 전달) ③상세 Drawer → `ui/*-detail-drawer.tsx` 컴포넌트(열림 판정·조치 확정은 페이지 소유, 콜백 주입). 코드는 그대로 이동(동작 무변경), 880→532줄, **baseline 24→23**(events 제거 후 lint green 으로 800 미만 증명). 이후 분해는 이 패턴을 따른다.
  - Phase 4 2호(2026-08-19, system-permissions-page): 같은 패턴으로 874→687줄, **baseline 23→22**. 라벨·옵션 카탈로그 → `model/system-permissions-page-schema.ts`, 테이블 3종 컬럼 → `ui/system-permissions-columns.tsx` 팩토리(조치 가능 여부·모달 오픈 핸들러는 페이지 소유). 모달 3종(등급 변경·권한 관리·상태 변경)은 Form 인스턴스·제출 상태와 강결합이라 페이지에 잔류 — 800 미만이 목표이지 최소 파일이 목표가 아니다.
  - Phase 4 3호(2026-08-19, assessment 2페이지 묶음): question-detail 1,038→525(조회 전용 표시 계층 490줄 → `ui/assessment-question-detail-panel.tsx` 단일 이동 — 번호별 51~54 항목 구성·버전/상태 사이드 카드), question-manage 1,074→759(조치 카피·상태 상수 → `model/assessment-question-manage-schema.ts`, 컬럼·행 액션·버전 확장 → `ui/assessment-question-manage-columns.tsx` 팩토리 3종). **baseline 22→20**. 같은 feature·같은 e2e 스펙(assessment-question-bank.spec 18케이스) 커버라 한 PR 로 묶음.
  - Phase 4 4호(2026-08-19, instructor+community-posts 묶음): instructor 1,078→415(스키마+컬럼 팩토리+Drawer 컴포넌트 — Drawer 내부 테이블 3종·상태 태그·요약 빌더 동반 이동, 이동 중 formatUserDisplayName 누락을 자체 발견·원복), community-posts 1,173→774(스키마+컬럼 2종+Drawer — 상세 항목·상태 경보는 순수 빌더로 변환). **baseline 20→18**.
  - Phase 4 5호(2026-08-19, operation-policy-create-page): 1,220→657줄, **baseline 18→17**. **폼 중심 화면의 절단 패턴(④) 확립** — Form.Item 기반 Descriptions 아이템은 상위 `<Form>` 컨텍스트로 동작하므로 `ui/*-form-items.tsx` 순수 팩토리로 이동할 수 있다(폼 인스턴스 전달 불필요 — 선택 옵션 배열과 편집 대상 id 만 인자). 폼 인스턴스·`useWatch`·검증·제출·스텝 상태는 전부 페이지 소유. 타입·프리셋·스텝 정의·파서·검증은 `model/operation-policy-create-page-schema.ts` 로 이동. 잔여 폼 중심 8페이지(message-channel·coupon-create·coupon-template-create·event-create·groups·faq·metadata-page·points)는 이 패턴을 적용하되, 아이템 빌더가 워치 값·제출 상태를 직접 참조하는 화면은 그 값도 인자로 전달한다(페이지 소유 원칙 유지).
  - Phase 4 6호(2026-08-19, message-channel-page — 메일·푸시·인앱 공용): 1,255→832줄, **baseline 17→16**. ⑤**모달 통째 이동 변형** — 폼이 Modal 에 갇힌 화면은 Modal+Form+아이템을 컴포넌트로 통째 이동하고 **폼 인스턴스는 페이지가 만들어 props 로 전달**한다(antd `<Form form={...}>` 은 전달받은 인스턴스로 동작, `useWatch` 값은 페이지에서 구독해 함께 전달). ⑥**반복 알림 description 빌더** — 같은 파일 안에서 7번 반복되던 조치 완료 알림 구조(대상 유형→대상 ID→부가 행→감사 링크)를 `ui/message-audit-notice.tsx` 빌더로 통합(부가 행은 문자열, 조건부 행은 false 필터 — 렌더 결과 동일). 이 6호만 verbatim 이 아니라 의도적 변환이며, e2e 직접 커버는 상태 토글 경로 1곳(감사 링크 단언)이고 나머지 6곳은 동일 빌더 재사용이라 구조 동일성으로 보증한다.
  - Phase 4 7호(2026-08-19, operation-pdf-quota-page): 1,290→747줄, **baseline 16→15**. ⑦**탭 섹션 통째 이동** — 모달 변형(⑤)과 같은 원리로 탭 children 전체(AdminListCard+툴바+경고+폼+이력 테이블)를 `ui/*-tab.tsx` 컴포넌트로 이동. 조회 상태·폼 인스턴스·`useWatch` 값·저장/재시도 핸들러는 페이지 소유(props 15개), basePolicy 파생 표시값(초기값·시간대 옵션·주기 변경 감지)은 탭 내부에서 계산해 props 를 줄인다. 컬럼 2종은 외부 상태 무참조라 deps 없는 순수 팩토리. 스키마 상수는 전부 `PDF_QUOTA_` 접두어로 rename(모듈 상수의 도메인 접두어 규칙).
  - Phase 4 8호(2026-08-19, message-history-page): 1,328→14줄(선택자)+715(mock 변형)+585(supabase 변형)+80(공용 스키마), **baseline 15→14**. ⑧**데이터소스 변형 분리** — 한 파일에 페이지 컴포넌트 2개(mock·supabase)가 붙은 파일은 변형별 `pages/*-mock-page.tsx`·`pages/*-dispatch-page.tsx` 로 통째 분리하는 것이 최적 절단(라우트 진입점은 선택자만 잔류). 🚨**분해 대상 파일을 하드코딩한 경계 검사가 있는지 먼저 확인** — `check-message-history-boundary` 가 이 파일에 dispatch ledger 참조를 강제하고 있어 같은 PR 에서 검사 대상 경로를 갱신(+red 단위 테스트, 검사 의도 불변). 분해가 경계 검사를 깨뜨리면 검사 요구를 새 구조로 옮기는 것이지 우회하는 것이 아니다.
  - Phase 4 9호(2026-08-19, analytics-learning-page): 1,443→582줄, **baseline 14→13**. 확립된 변형 조합 적용 — 스키마(KPI 정의 카피 포함: **e2e 가 문구를 검증하는 카피는 verbatim 이 특히 중요**, PDF 위계/조각은 useMemo 본문을 null 가드째 순수 함수로) + 표현 컴포넌트 2파일(KPI 카드·차트) + 컬럼 팩토리 3종 + 조건 Drawer 컴포넌트(⑤ 변형 — 초안 setState 를 `Dispatch<SetStateAction>` 그대로 props 전달, 파생 표시값 3종은 Drawer 내부 재계산으로 props 축소). e2e 10케이스가 KPI 카피·차트 레이아웃·Drawer 적용 흐름까지 잡고 있어 분해 검증력이 가장 높았던 호.
  - Phase 4 10호(2026-08-19, users-referrals-page): 1,406→654줄, **baseline 13→12**. 조합 적용(스키마+컬럼 팩토리 3종·이상치 태그+상세 Drawer 통째+조정 모달). 🔑**선택 대상에서만 파생되는 memo(보상 원장 그룹)는 Drawer 로 동반 이동**하면 페이지 상태가 줄고 Drawer 가 자립한다(내부 컬럼·상태 경보도 동일). 분해 중 IA 의 낡은 재조회 서술(③b 2차에서 제거된 동작)을 발견해 현재 계약으로 정정 — **분해는 IA 서술과 코드의 대조 기회이기도 하다**. e2e 플레이크 재관측: list-loading 스펙의 question-bank 초기 로딩 케이스가 병렬 배치에서 1회 실패, 단독·재배치 통과(기존 가족, 조치 없음).
  - Phase 4 11호(2026-08-19, users-page): 1,514→778줄, **baseline 12→11**. 조합 적용 + ⑨**모달 입력 UX 내부화** — 열림 초기화 effect·`useWatch` 파생값·입력 편의 버튼(컬럼 전체 선택/해제)은 모달 컴포넌트 내부로 옮겨도 계약이 같다(폼 인스턴스·검증·제출·감사 알림은 페이지 잔류). 이것 없이는 이 페이지가 800 을 넘는다 — 모달이 자기 입력 UX 를 소유해야 절단이 닫히는 사례.
  - Phase 4 12호(2026-08-19, operation-event-create-page): 1,543→647줄, **baseline 11→10**. 스텝 에디터 화면의 두 번째 사례(5호 policy-create 형제)인데 아이템이 useMemo 가 아니라 render 인라인이라, 아이템 팩토리 대신 **스텝 섹션 7종을 AdminEditorFormSection 째 컴포넌트로 이동**했다(순수 섹션 4종은 인자 없음, 상태 참조 섹션 3종은 워치 값·옵션·핸들러를 props 로). 배너 드래그 정렬 센서(useSensor)와 정렬 컴포넌트는 노출 섹션 내부로(⑨ 입력 UX 내부화). 폼 타입·스텝 정의·숨은 검증·배너 파일 정규화는 `model/operation-event-create-page-schema.ts`.
  - Phase 4 13호(2026-08-19, operation-policies-page): 1,812→830줄, **baseline 10→9**. 조합 대형 적용 — 스키마(파서·조치 카피·목록 필터·요약 카드 빌더)+컬럼 2종·스냅샷 확장 행+상세 Drawer 통째(히스토리 컬럼 내부 계산)+**툴바 컴포넌트(⑨ 확장: 상세 필터 초안 3종 상태·적용값 동기화 effect·apply/reset 핸들러를 툴바 내부로)**+조치 알림 빌더(⑥: 성공 4곳+실패 4곳, 비-verbatim 전환·렌더 동일). 🚨**생성기 splice 는 반드시 라인 내림차순** — 이번에 치환 하나가 순서를 어겨 아래쪽 12줄이 어긋났고(사라진 null 가드), tsc 가 즉시 잡아 복원했다. 검산에 가드 복원 확인 케이스를 추가.
  - Phase 4 14호(2026-08-20, user-detail-page): 1,881→650줄, **baseline 9→8**. 탭 상세 화면의 절단 기준 — 파일 안에 이미 내장돼 있던 탭 컴포넌트(AffiliationTabPanel)는 파일 분리로 충분하고, 인라인 탭 children 은 프로필·학습 탭처럼 컴포넌트로 통째 이동한다(온보딩 요약 같은 파생 표시값은 탭 내부 계산). 탭 테이블 컬럼 8종은 전부 deps 없는 순수 팩토리였고 메모 삭제 콜백 1개만 인자. mock 표시 행 4종은 userId 만 받는 순수 빌더로 스키마에. 활동·결제·커뮤니티·메모 탭처럼 Table 한 장짜리 children 은 페이지 잔류("최소 파일이 목표가 아니다").
  - Phase 4 15호(2026-08-20, commerce-coupon-create-page): 1,890→811줄, **baseline 8→7**. 5호 폼 아이템 팩토리 패턴의 두 번째 대형 적용(아이템 5종 725줄 — 워치 값 8종·옵션 2종을 인자로). 워치 파생 memo(혜택 필드 메타·유효기간 옵션)는 스키마 순수 함수로 이동하고 페이지 memo 는 글루만 남김. 팩토리 파일이 커도(≈740줄) 800 미만이면 분리하지 않는다.
  - Phase 4 16호(2026-08-20, commerce-coupon-template-create-page): 1,314→706줄, **baseline 7→6**. 15호와 동형 적용(아이템 5종 458줄). 🚨**교훈: deps 요약 출력이 잘리면 원본 세그먼트에서 deps 전체를 다시 세라** — benefit 빌더 본문이 deps 요약에 안 보이던 6개 값(scope/category/product 옵션·워치 3종)을 더 참조해 인자 확장이 필요했다(tsc 가 전부 검출). 인자로 객체(benefitFieldMeta)를 넘기면 페이지 글루 deps 도 필드 단위가 아니라 객체 단위로 맞춘다(exhaustive-deps).
  - Phase 4 17호(2026-08-20, system-metadata-store): 1,054→568줄(store), **baseline 6→5**. 유일한 store 형 대상 — 초기 시드(그룹 438줄+감사)를 `model/system-metadata-seed.ts` 로, 시드·store 공용 팩토리 3종(이력·아이템·관리자 위치)을 `model/system-metadata-factories.ts` 로 분리(순환 없음: factories ← seed ← store). 🚨부분 문자열 카운트 함정 — `createItem` 사용 수를 grep 으로 세면 `createItemId` 가 섞인다(이번에 배치 오판 1회, tsc 가 정정). 사용처 판단은 정확 식별자 경계로.
  - Phase 4 18호(2026-08-20, operation-faq-page): 2,374→734줄(69%↓, 시리즈 최대), **baseline 5→4**. 3탭 결합 화면의 총력 조합 — 스키마(+가시 필터 3종·요약 카드 빌더)·컬럼 3종·편집 모달 2종(⑤)·상세 Drawer 2종(표시 항목 내부 파생)·탭 섹션 3종(⑦: 검색 툴바+상태 알림+테이블+테이블 change 핸들러, 마스터 상세 검색 초안 내부화)·알림 빌더 12곳(⑥). ⑩**조치 실행기 신설** — 저장 2종·위험 조치 4케이스 핸들러 본문을 `ui/operation-faq-actions.tsx` 의 `run*` 함수로 옮기고, 페이지가 소유한 setter·알림 인스턴스·URL 커밋을 `FaqActionContext` 로 주입한다(페이지 핸들러는 3줄 위임). 다중 화면 결합 페이지는 이 실행기 없이 800 미만이 되지 않는다 — 소유권은 페이지에 남고 본문 텍스트만 이동하는 원칙 내 확장. 🚧부가 발견: fetch 가 쓰지 않는 `query.page/pageSize` 재조회 deps 가 referrals 와 동일 패턴으로 잔존(L462 상당) — 오너 확인(2026-08-19)이 instructor·referrals 두 페이지 특정이라 이번엔 유지, §3.13 3차 확산 대상에 등재.
  - Phase 4 19호(2026-08-20, message-groups-page): 2,038→559줄(73%↓, 감축률 시리즈 최대), **baseline 5→3**. 확립 변형 조합만으로 종결 — 스키마(타입·쿼리 빌더 순수 함수 15종·폼 값 빌더·가시 필터)·쿼리 빌더 UI 3종(재귀 편집기)·컬럼 팩토리·테이블 섹션(⑦, 13호 날짜 초안 내부화)·편집 Drawer 통째(⑤, 10호 내부 파생)·알림 3곳은 기존 message-audit-notice 빌더 재사용(⑥ — 신규 파일 없이 6호 산출물 소비). e2e 커버 0 화면이라 스모크 3케이스(`tests/e2e/message-groups.spec.ts`)를 신설해 분해 검증 축으로 썼다(행 Drawer 열기·쿼리 빌더 JSON 미리보기·정적 그룹 전환). baseline 정리 중 11호(referrals) 제거 누락 발견 — 649줄로 이미 800 미만이라 함께 제거(게이트 무영향).
  - Phase 4 20호(2026-08-20, system-metadata-page): 2,256→719줄(68%↓), **baseline 3→2**. 18호와 동급의 총동원(파일 8개) — 스키마(카피·라벨·옵션·타입·순수 함수 13종)·공용 렌더 헬퍼(값 목록·도움말 라벨·알림 description — 컬럼/폼/Drawer/페이지 4곳이 공유해 별도 파일)·트리 조각 3종·컬럼 팩토리 3종·폼 아이템 팩토리 2종(④)·편집 모달 2종(⑤, 폼 아이템 조립 내부화)·상세 Drawer 통째(⑤+10호, 운영 값/이력 컬럼 조립 내부화)·실행기 5종(⑩ MetadataActionContext). 🔑실행기 위임과 actionContext 는 resetItemDragState 뒤에 둬야 한다(TDZ) — 원문 순서를 유지한 채 위임만 모으면 참조가 깨진다. 🚨생성기 함정 재발: useCallback 2-인자 형태(콜백+deps)의 본문 슬라이스는 콜백 닫는 '},'를 포함하기 쉽다(reorder·delete 2곳 tsc 검출) — 본문 끝 앵커는 deps 줄이 아니라 마지막 실행문으로 잡을 것. e2e system-metadata 4/4(트리 드래그·중복 검증·삭제 경로) 무회귀.
  - Phase 4 21호(2026-08-20, commerce-coupons-page): 2,365→724줄(69%↓), **baseline 2→1**(points 만 잔존). 파일 6개 — 스키마(파서·탭 매칭·위험 카피·필터/정렬·요약 카운트/카드 빌더)·유형 선택 카드(ripple 내부 관리)·컬럼 2종(행 액션 메뉴 빌더를 팩토리 내부 상수로 내장 — 인자 구조분해로 rename 0)·목록 섹션(⑦, 빈 목록 가이드 토글·무동작 검색 필드 콜백 내부화)·상세 Drawer 통째(쿠폰/템플릿 두 갈래)·실행기 4종(⑩ CouponActionContext). 🚨신종 함정: **useMemo 제네릭은 잉여 속성 검사를 우회하지만 팩토리의 직접 반환 리터럴은 발동** — 원문 컬럼의 sorter 식별용 잉여 속성 `field` 가 팩토리 전환 직후 TS2561 로 터짐(4곳). 원문 동작 보존은 반환 배열에 `as TableColumnsType<...>` 단언(useMemo 와 동일한 우회)으로. e2e commerce-coupons 3/3 무회귀.
  - Phase 4 22호(2026-08-20, commerce-points-page): 3,020→801줄(73%↓, 절대량 시리즈 최대), **baseline 1→0 — override 블록 제거로 max-lines 800 게이트 예외 0 전면 활성화(Phase 4 분해 프로그램 종결)**. 파일 7개 — 스키마(정렬/필터/파서/요약 카드/폼 기본값)·공용 렌더 헬퍼·컬럼 3종(**query 통째 인자 = rename 0**, deps 는 객체 단위)·검색 툴바(13호 패턴 최대 적용 — 상세 필터 초안 3종+날짜 초안 훅 2벌+URL 동기화 리셋 effect 3종+탭별 SearchBar props 분기 전부 내부화)·3갈래 Drawer·모달 3종(⑤)·실행기 5종(⑩ PointsActionContext, `...query` 스프레드 rename). 계획서에 있던 서버 페이징 전환은 이 PR 에 포함하지 않음 — 분해(무변경)와 동작 변경을 분리, 오너 결정 대기. e2e commerce-points 8/8 무회귀.
  - **게이트 스코프 사각지대 수리(2026-08-20, Phase 4 후속)**: Phase 4 종결로 src baseline 이 0 이 된 직후, `npm run lint` 스코프가 `src/**`+`api/**` 뿐이라 **`scripts/**`·`tests/**` 는 애초에 검사되지 않았다**는 사실을 실측으로 발견했다(그 안에 800줄 초과 5개 잔존 — 게이트는 통과하는데 규칙은 닿지 않는 상태). 스코프를 scripts·tests 로 넓히고, 확장이 만든 소음 351건을 성격별로 분리했다: **332건은 전부 Node 전역**(`process` 299·`Buffer` 29 — browser env 만 켜져 있어서 no-undef)이라 overrides 의 `env.node` 로 해소, 실제 결함은 14건뿐이었고 전부 수리했다(미사용 심볼 5·BOM 정규식 3·finally throw 2·`while(true)` 1·불필요 이스케이프 1·`require` 1·정규식 공백 1). 남은 max-lines 5건은 **새 baseline(scripts 4 + live-e2e 1)으로 등재해 다음 분해 대상 목록으로 명문화**했다(src 의 Phase 2 baseline 과 같은 규칙 — 줄이기만 한다). 🔑판단 기준 3가지: ①BOM 정규식은 리터럴 U+FEFF 를 `﻿` 이스케이프로만 바꿔 **동작 동일**(BOM 제거 로직을 건드리지 않는다) ②`bootstrap-admin` 의 finally throw 는 **의도된 설계**(legacy API key 를 못 잠근 사실이 원본 오류보다 우선해서 드러나야 하고, 둘 다 실패하면 AggregateError) 라 구조 변경 대신 사유를 적은 targeted disable ③생성 산출물 `scripts/wf-plain-layer.gen.mjs` 는 Workflow 런타임 전역에서 도므로 ignorePatterns. 🚨red 검증에서 **복원에 `git checkout <file>` 을 쓰면 같은 파일에 있던 내 미커밋 수정까지 되돌아간다**(이번에 실제로 되돌아갔고 재적용) — 위반 주입은 별도 파일이나 백업 복사로 할 것.
  - **스크립트 분해 1호(2026-08-20, run-shadow-contract.mjs)**: 1,078→748줄, 스코프 확장 baseline 5→4. 절단 = `shadow-psql.mjs`(supabase CLI·docker exec psql·SQL 리터럴 escape·status 파싱 = 저수준 실행 헬퍼) + `shadow-notification-checks.mjs`(알림 카탈로그·발송 파이프라인·재생 전후 스냅샷 불변 검증 265줄). 🔑**대상 선정 기준을 "테스트가 있느냐"에서 "CI 가 실제로 실행하느냐"로 바꿨다** — 이 스크립트는 scripts/ci 변경이 분류기를 full 프로파일로 올려 db-contract job 이 `db:shadow:verify` 로 직접 돌린다 (같은 PR 이 곧 end-to-end 검증). recover-prod-from-dev 는 단위 테스트가 그 파일이 아니라 `prod-data-recovery-core.mjs` 를 검사하므로 오케스트레이터 자체는 무커버라 후순위로 미뤘다. 🚨**8호(message-history 경계 검사)와 동형 함정 재발 확인**: `audit-log-sensitive-data-gate-contract` 테스트가 이 스크립트의 **소스 텍스트**를 읽어 `verifyAuditSensitiveDataGate` 정의·SQL 조각·호출부를 단정한다 → 그 함수와 호출부는 이동 대상에서 제외했고, 검산 스크립트에 계약 문자열 6개와 테스트가 import 하는 export 2개(`computeUpgradeDelta`·`extractV13Pin`) 잔존 단정을 추가했다. 🔑스코프 확장의 즉시 배당: 이동 후 남은 미사용 import 2건(`spawnSync`·`queryPsql`)을 **lint 가 정적으로 잡았다** — src 밖 스크립트 분해에서 no-undef/no-unused-vars 가 사실상 타입 검사 역할을 한다.
  - **스크립트 분해 2호(2026-08-20, session-lifecycle.mjs)**: 1,888→581줄(69%↓, 스크립트 최대), 스코프 baseline 4→3. **단방향 5계층으로 갈랐다**: `session-core`(분류 상수·명령 실행·경로/시간/이름 유틸·JSON IO, leaf) ← `session-git`(worktree porcelain 파싱·저장소/브랜치/PR 조회) ← `session-manifest`(스키마·읽기·생성·승급) ← `session-audit`(세션 분류·물리 후보 판정·보존 오버레이·감사 수집 456줄) ← `session-cleanup`(보존 창·만료 확정·저장소 잠금·영수증 510줄). 본체에는 세션 명령(start/sync/register)·재조정·핀·상태·CLI 라우팅만 남겼다. 🚨**계층 순환을 lint 가 먼저 잡았다**: `readManifests`(core 후보)가 `upgradeManifest`(manifest)를 부르므로 core→manifest 순환이 생긴다 → `readManifests` 를 manifest 로 옮겨 단방향을 회복했다. 🔑**분해 전 심볼 의존 스캔을 도구화**했다(블록별 외부 참조·제공 심볼 표) — 1차 시도는 헤더를 눈대중으로 써서 배선 오류 62건이 났고, 스캔 결과로 헤더를 정확히 재작성하니 1건으로 줄었다. 🔑**재수출로 import 계약을 고정**: 단위 테스트가 이 파일에서 18개 심볼을 import 하므로 이동분은 전부 `export { … } from` 로 다시 내보내 테스트/외부 경로를 건드리지 않았다(검산에 17개 export 잔존 단정 포함). 검증 = verbatim 8블록 + export 17 + 단위 19테스트 + **CLI 실제 실행**(`session-lifecycle.mjs status` 출력 확인) 4중.
  - **스크립트 분해 3호(2026-08-20, migrate-core.mjs)**: 903→604줄, 스코프 baseline 3→2. `migration-primitives.mjs`(운영 project ref 상수·.env.local 로더·식별자 검증·sha256·SQL 텍스트 유틸, leaf) + `migration-contract.mjs`(로컬 목록·매니페스트 배치 해석·정적 계약 점검·검증 리포트 + 그 계약이 쓰는 레코드 빌더·차단 검증) 로 갈랐고, 본체에는 접속 대상 해석·SQL 실행·트래커·적용/롤백만 남겼다. 🚨**소스 텍스트 계약 테스트가 절단면을 되돌렸다**: 1차 안은 `parseMigrationArgs` 를 primitives 로 옮겼는데, `migration-down-order-guard`·`permission-gate-parity` 두 테스트가 **러너 소스에서** `args.includes('--allow-out-of-order-down/apply')` 배선을 직접 단정한다(가드를 명시 플래그로만 열 수 있다는 계약). 테스트를 고치는 대신 **인자 파서를 러너에 남겨** 계약을 원위치로 지켰다 — 운영 마이그 러너의 안전 단정은 분해 편의보다 우선한다. 118호(shadow 감사 게이트)에 이은 같은 유형 3번째 사례. 🔑`migrationRecord`·`validateBlocked` 는 contract 가 부르므로 함께 옮겨 runner↔contract 순환을 피했다. 검증 = verbatim 8블록 + 운영 가드 상수 잔존 단정 + 외부 14심볼 재수출 단정(24/24) + 마이그 테스트 100/100.
  - **스크립트 분해 4호(2026-08-20, analytics-learning-live.pw.ts)**: 878→463줄, 스코프 baseline 2→1. 기준값 계산 계층(Management API SQL 실행·metadata CTE·기간 해석·정규화·baselineAnalytics·옵션 조회)을 `analytics-learning-live-baseline.ts` 로 옮기고 스펙에는 URL 조립·화면 검증·테스트 2종만 남겼다. playwright testMatch 가 파일명 명시라 헬퍼는 스펙으로 수집되지 않는다(`test.beforeAll` 훅은 스펙 잔류). 🚨**typecheck 사각지대를 발견했다**: `tsconfig.app.json`=src, `tsconfig.node.json`=vite/api 뿐이라 **`tests/` 는 어떤 프로젝트에도 포함되지 않는다** — lint 사각지대(#117)와 같은 유형의 두 번째 구멍이다. 그 결과 이 스펙에 **죽은 타입 import 가 남아 있었다**: `LearningAnalyticsWeakDimension` 은 2026-07-15 취약 평가 영역 섹션 제거 때 서비스에서 삭제됐는데, 스펙은 계속 import 하고 `LiveRpcRow` 에 쓰고 있었다 (타입 전용이라 런타임엔 지워져 조용히 통과). 같은 파일이 이미 `BaselineRow` 에 인라인으로 갖고 있던 동일 shape 를 지역 타입 `LiveWeakDimension` 으로 올려 고쳤다 — RPC 는 이 필드를 계속 반환한다. 🔑검증은 ad-hoc `tsc --noEmit` 으로 대체했다(프로젝트 typecheck 가 tests 를 안 보므로): 분해 전 스펙 자체 오류 1건 → 분해 후 0건. **tests 를 typecheck 범위에 넣는 것은 별도 작업**으로 남긴다(전체 tests 에서 얼마나 나올지 먼저 실측해야 한다).
  - **스크립트 분해 5호·종결(2026-08-20, recover-prod-from-dev.mjs)**: 1,458→765줄, **스코프 확장 baseline 1→0 — override 블록을 삭제해 max-lines 800 이 저장소 전체에서 예외 0 이 됐다** (src 는 Phase 4 22호로, scripts·tests 는 스크립트 분해 1~5호로 각각 종결). 4계층: `prod-recovery-catalog`(project ref·버킷·복사 대상 테이블과 테이블별 특수 규칙) ← `prod-recovery-sql`(escape·해시·요약·SQL 텍스트·행 판정·정합성 단정·민감정보를 지운 리포트) ← `prod-recovery-readers`(API 키·스토리지 수집·행/스키마 메타 조회) ← `prod-recovery-stage`(백업 스키마·auth 토큰 백업·스테이지 적재/정리). 러너에는 계획 수립·적용·검증·CLI 만 남겼다. 🚨**소스 텍스트 계약 3번째이자 가장 강한 사례**: `prod-data-recovery-core` 테스트가 러너 소스에서 안전 가드 13개 문자열과 금지 문자열 2개를, `operation-policy-history-repair` 가 복사 대상 테이블 엔트리를 단정한다. 이번엔 4개 문자열이 분해 모듈로 이동해 계약이 깨졌는데, **가드 배선 계약의 의미는 "실행 경로 어딘가"이지 "한 파일 안"이 아니므로 테스트를 러너+분해 모듈 전체를 한 소스로 읽도록 재조준했다**(8호 message-history 경계 검사와 같은 처리). 🔑재조준한 계약은 반드시 **red 검증**한다 — 1차 시도는 `buildStageLoadSql` → `buildStageLoadSqlRENAMED` 로 바꿨는데 **접미사라 부분 문자열이 남아 통과**했다(무효한 red). 겹치지 않는 이름(`buildStageLoadZZZ`)으로 다시 해서 exit 1 을 확인했다 — 변이는 원문 문자열을 포함하지 않아야 한다. 🔑splice 겹침 자동검증의 한계: 내림차순 단정은 통과해도 **범위가 겹치면**(831-873 vs 870-945) 뒤 splice 가 엉뚱한 줄을 지운다. 겹침 여부도 함께 봐야 한다(이번엔 생성 직후 lint 의 no-redeclare/no-undef 가 잡았다).
  - `no-restricted-imports`: `../../*/api/mock-*`·`@/features/*/api/mock-*` 차단. ~~baseline 5개는 Phase 3 에서 해소 예정~~ → **해소 완료(2026-08-18, Phase 3a)**: `users-service.ts` 에 mock 경계 facade 3종(`getMockUserRealName`/`mockUserExists`/`getMockUsers`)을 신설하고 5개 파일을 전환, baseline override 를 삭제해 게이트를 예외 0 으로 전면 활성화했다(삭제 직후 lint 가 정확히 5건을 발화하는 red 검증 후 전환). 한계: 셀렉터가 import 문자열 형상 기반이라 비표준 깊이의 우회는 못 잡는다(완전한 경계 강제는 eslint-plugin-boundaries 도입 검토 항목).
  - jscpd 중복 임계(`check:duplication`, `harness:check` 배선): 도입 시점 실측 4.52%(296 클론·3,955줄)에 임계 5% 로 시작 → **Phase 3a 중복 제거 후 4.38%(285 클론·3,827줄) 재실측, 임계 4.5% 로 하향**(래칫 정책 이행). 대규모 중복 제거 후 같은 PR 에서 임계를 하향한다. 설정 SoT 는 `package.json` `jscpd` 키(신규 루트 설정 파일을 만들지 않아 분류기 unknown-path 를 피함).
- 분류기 v9: 이 작업이 `.eslintrc.cjs` 를 수정하는데 app 목록에는 flat config(`eslint.config.js`)만 있어 **unknown-path → blocked 를 사전 실측으로 확인**하고(§3.10·§3.11 의 함정 3번째 재발을 선제 차단), `.eslintrc.cjs` 를 app 경로에 등재 + 회귀 테스트를 추가했다.

### 3.13 fetch 수명주기가 42개 컴포넌트에 수기 배선됨 — **파일럿 전환 (2026-08-18, Phase 3b)**

- `fetch*Safe` 조회의 수명주기(AbortController 생성 → pending 전환 → abort 가드 → 성공/실패 반영 → cleanup abort)가 42개 컴포넌트에 72회 수기 복제되어 있다. `AsyncState` 는 타입만 공유되고 훅이 없어, §3.8(router state 이중 발화) 같은 effect 배선 실수가 페이지마다 재현될 수 있는 구조였다.
- 조치(2026-08-18, 파일럿): `src/shared/model/use-async-resource.ts` 신설 — 계약은 기존 배선과 동일(초기 `'pending'`·실패 시 직전 data 보존·abort 무시·빈 결과 `'empty'` 매핑·fetcher 는 `useCallback` 강제로 exhaustive-deps 검증 유지). 파일럿 2곳(system-logs·system-audit-logs — 기존 e2e 스펙 보유 페이지로 선정) 전환, 수기 effect 2개 제거.
- 신규 fetch effect 는 이 훅으로만 작성한다(원문: `docs/guidelines/react-optimization-rule.md` §3-5). 나머지 파일은 점진 전환 대상이며, 전환 시 해당 페이지의 e2e 스펙 존재 여부를 먼저 확인하고 없으면 성공 경로 스펙을 같은 작업에서 추가한다.
- 파일럿을 단순 read-only 목록 2곳으로 한정한 이유: 다수 페이지는 reloadKey·연쇄 조회·폴링·조건부 재조회가 결합되어 있어(§3.8 전례) 페이지별 정독 없이 일괄 전환하면 동작 변경 위험이 있다. 훅의 `reload()` 가 reloadKey 계열을 흡수하는지부터 다음 확산 단계에서 검증한다.
- 확산 1차(2026-08-18): 후보 전수를 정독 분류한 뒤 **훅 계약과 의미가 완전히 일치하는 4곳만 전환** — dashboard-page(reload 흡수 실증), use-imported-tasks·use-assessment-question-list(반환 계약까지 동일한 위임형), master-catalog-section(fetch 2개 → 훅 2개 + 결합 reload). 신규 성공 경로 스펙 2건(dashboard·imported-tasks) 추가.
- 확산 1차에서 **의미 상이로 이월(전환 금지 아님 — 훅 확장 결정 필요)**: ①조치 후 목록 로컬 변이(`setRows`/`setState` 를 effect 밖에서 호출 — community-reports·operation-notices·operation-events 등) ②에러 시 데이터 소거 계약(institution-code-detail·contract-tab·system-permissions — 훅은 직전 데이터 보존) ③조건부 fetch(`canRead`/`code` 가드 — analytics-overview·system-reports 등) ④응답을 복수 상태로 분배(message-channel) ⑤fail-open 부가 조회 결합(institution-codes 3-fetch) ⑥재조회 시 pending 미전환(billing-refunds) ⑦fetch 미사용 deps 로 재조회(instructor-management·users-referrals — 의도 여부 오너 확인 필요) ⑧비 SafeResult 서비스 계약(system-admins) ⑨에러 무시 fetch(billing-payments refunds 분기). 확산 2차는 이 분류에 대한 훅 옵션 설계(로컬 변이 대체 경로·enabled·에러 정책)부터 시작한다.
- 확산 2차(2026-08-19): 훅 v2 옵션 4종(`enabled`·`keepDataOnError`·`pendingOnRefetch`·`mapError`)과 `mutate`(조치 후 로컬 갱신 — 기존 배선과 동일하게 empty/success 재판정)를 신설하고 이월 계열 ①②③⑥⑦을 해소, **10파일 추가 전환**: community-reports·operation-notices·operation-events·instructor-management·users-referrals(①mutate — instructor·referrals 는 ⑦도 함께: fetch 가 쓰지 않는 page/pageSize deps 재조회를 **오너 확인(2026-08-19)으로 제거**), contract-tab·system-permissions(②keepDataOnError:false), system-reports·analytics-overview(③enabled — overview 는 권한 회수 시 데이터 소거·메시지 번역을 `mapError` 로 재현), billing-refunds(⑥pendingOnRefetch:false). 신규 성공 경로 스펙 2건(system-reports·system-permissions-list). contract-tab 은 첫 페인트가 빈 테이블 1프레임 → 스피너로 바뀌는 관찰 가능한 개선 1건을 명시.
- 확산 6차(2026-08-21): 이월 계열 **⑤(fail-open 부가 조회 결합)** 해소.
  - 목록은 주 조회 1개 + 부가 조회 2개, 상세는 주 조회 1개 + 부가 조회 4개였다(내가 앞서 "3개·5개"로 보고한 것은 **전체 조회 수**였다 — 부가 조회 수가 아니다).
  - 🚨**진짜 결함은 결합이 아니라 "실패 = 행 없음" 취급이었다.** `result.ok ? result.data : []` 로 삼켰기 때문에 조회가 실패하면 ①노출 모드 컬럼이 전 코드에 도메인 기본값 `배정분만` 을 보여주고(실제로는 `제한 없음` 일 수 있다 — 운영자가 제한된 기관으로 오해한다) ②계약 컬럼이 `-` 를 보여준다(`-` 는 도메인에서 "계약 없음"이라는 **유효한 상태**다). 둘 다 **틀린 값을 정상처럼** 보여준다.
  - 조치: 조회를 각각 `useAsyncResource`(`keepDataOnError: false`)로 나누고, 표시는 순수 함수 `resolveSideFetchOutcome` 이 **네 갈래**로 가른다 — `pending`/`failed`/`missing`(조회 성공 + 행 없음)/`loaded`. **`failed` 와 `missing` 을 절대 섞지 않는 것**이 이 작업의 전부다. 도메인 기본값은 `missing` 에서만 쓴다.
  - 실패는 화면에 드러낸다 — 목록은 부가 조회별 경고 Alert + `다시 시도`, 셀은 `조회 실패`. 상세는 실패한 항목 이름을 나열한 Alert + 항목별 재시도. **주 목록·나머지 탭은 계속 동작한다**(fail-open 을 없애는 것이 아니라 실패를 보이게 하는 것이다).
  - 🚨상세는 코드가 바뀌는 동안 **직전 코드의 값을 쓰지 않는다** — 훅이 재조회 중 직전 데이터를 유지하므로 `codeState.data?.code === code` 가드를 뒀다(없으면 다른 기관의 이름·상태가 잠깐 보인다).
  - 🚨**프리뷰 실측이 내가 놓친 누락 2건을 잡았다**: ①노출 모드를 모르는데 배정 패널이 `배정분만 모드입니다` 안내를 그려 **틀린 전제를 확정**해 줬다(패널까지 `exposureModeUnavailable` 을 내렸다) ②실패 항목 이름을 문장에 붙이니 조사가 `노출 모드을(를)` 로 나왔다(목록 형태 `불러오지 못한 항목: …` 로 바꿨다). **조회 분리만으로는 표시 누락을 못 잡는다 — 실패를 실제로 주입해 화면을 봐야 한다.**
  - 실패 경로는 e2e 로 만들 수 없다(mock 은 항상 성공) → 해석을 순수 함수로 떼어 단위 7케이스로 고정(`failed`→`missing` 로 접는 red 주입에서 2케이스 실패). 성공 경로는 프리뷰 실측 + 기존 institution e2e 26/26 무회귀.
- 확산 5차(2026-08-20): 이월 계열 **⑩(fetch 미사용 deps 로 재조회)** 해소 — 오너 승인(2026-08-20) 후 적용.
  - users-page 의 서버 조회는 `affiliation` 하나만 쓴다(페이징·검색·나머지 필터는 클라이언트 처리). 그런데 재조회 deps 가 `[query.page, query.pageSize, reloadKey, query.affiliation]` 이라 **페이지를 넘길 때마다 같은 데이터를 다시 받았고**, 그 effect 첫 줄의 `setSelectedRowKeys([])` 가 돌아 선택이 초기화됐다. 공용 훅으로 옮기면서 deps 를 조회가 실제로 쓰는 값만 남겼다.
  - 🚨**선택 초기화의 실제 출처는 effect 가 아니라 `commitQuery` 였다.** 페이징도 `commitQuery` 를 거치고 거기서 무조건 선택을 비운다 — deps 만 고쳐도 선택은 계속 풀린다. 그래서 `commitQuery` 를 **대상 집합이 바뀌는 변경일 때만** 비우도록 좁혔다(`page`·`pageSize` 외의 키가 하나라도 있으면 초기화). 내가 처음 오너에게 보고한 "deps 만 고치면 선택이 유지된다"는 **틀린 설명이었다**.
  - 조치 후 로컬 변이(`admin_set_user_status` 성공 후 상태 갱신)는 `mutate` 로, 재조회 2곳(일괄 배정/해제 성공·재시도 버튼)은 `reload()` 로 갔다. 재시도는 직전 목록과 결과가 갈릴 수 있어 선택을 비운다.
  - `[query.affiliation]` 에 걸린 선택 초기화 effect는 **방어용**이다 — 확인해 보니 이 화면의 `setSearchParams` 는 전부 `replace: true` 라 뒤로가기로 affiliation 만 바뀌는 경로는 실제로 만들 수 없었다. "대상 집합이 바뀌면 선택은 무효" 불변식을 호출부마다 기억하지 않아도 되게 조회 축에 붙여 둔 것이다.
  - 🔑**`expect(locator).toHaveCount(0)` 으로는 "재조회가 없었다"를 검증할 수 없다** — 그건 0 이 **될 때까지** 기다리므로 로딩이 떴다 사라지면 그냥 통과한다. 실제로 이 함정에 걸려 red A(deps 복원)를 놓쳤고, 재시도하지 않는 `.count()` 로 바꾼 뒤에야 `settle=0ms` 에서 잡혔다. 짧은 mock 지연으로는 애초에 구분이 안 되므로 `stretchAsyncFetchDelay`(2.5초)를 함께 쓴다.
  - 신규 e2e `users-selection-paging.spec.ts` 2케이스. red 3축 확인: ①deps 복원 → 로딩 관측으로 실패 ②`commitQuery` 무조건 초기화 → 선택 소실로 실패 ③초기화 전부 제거 → 필터 변경 후 선택 잔존으로 실패.
  - `stretchAsyncFetchDelay` 는 `tests/e2e/harness/admin-flow-helpers.ts` 로 옮겨 두 스펙이 공유한다(중복 정의 방지).
- 확산 4차(2026-08-20): 이월 계열 **⑨(에러 무시 fetch)** 해소 — 오너 승인(2026-08-20) 후 적용.
  - billing-payments 의 환불 요청 조회에는 **실패 분기가 아예 없었다**. 실패하면 `refundsState` 가 'pending' 에 영구히 머물고 데이터는 `[]` 로 남아, `환불 관련 건수` 카드가 처리 대기 요청을 0 으로 더한 **낮은 수치를 아무 표시 없이 정상처럼** 보여줬다. 결제·환불 두 조회를 각각 `useAsyncResource` 로 옮기고, 실패를 Alert 로 노출한다(문구: `환불 요청 정보를 불러오지 못해 환불 관련 건수를 집계할 수 없습니다.`).
  - 🔑**실패는 숫자로 표현하지 않는다** — 이 카드 값은 두 조회의 합(결제측 환불 종결 + 환불 요청측 처리 대기)이라 한쪽이 실패하면 합계의 절반이 비어 있다. 낮은 수치 대신 `집계 불가` + 힌트 `환불 요청 조회 실패` 로 바꿨다. 결제측 절반만 남은 부분합을 보여주는 것도 틀린 수치를 보여주는 것이므로 채택하지 않았다.
  - 🚨**이 화면은 실패 경로를 e2e 로 만들 수 없다** — mock 모드는 항상 성공하고, 픽스처를 읽으므로 라우트 가로채기 대상도 없다. 그래서 카드 값 계산을 순수 함수 `resolveRefundRelatedSummary` 로 떼어 단위 테스트 6케이스로 고정했다(에러 분기를 지우는 red 주입에서 2케이스 실패 확인). 성공 경로는 e2e 로 **두 절반이 모두 배선됐는지**를 본다(mock seed 합계 `2건` — 환불 요청측 배선을 끊는 red 주입에서 `1건` 으로 내려가 실패).
  - 프리뷰 실측: 실패 주입 시 Alert + `집계 불가`/`환불 요청 조회 실패`, 주입 해제 시 Alert 없이 `2건`.
  - 잔여 판단(이 작업 범위 밖): 조회 **진행 중(pending)** 프레임에서도 세 카드가 0 을 보여준다 — 요약 카드 전반의 로딩 표현 문제라 화면 하나에서 바꾸면 오히려 불일치가 된다.
- 확산 3차(2026-08-20): 이월 계열 ④⑧ 해소, **2파일 전환 + 서비스 계약 1건 정규화**.
  - ④message-channel(메일·푸시·인앱 공용): 응답 하나(`ChannelSnapshot`)를 `templates`·`groups` 두 상태로 나눠 담던 배선을 **스냅샷 한 덩이로 담고 구조분해로 나누는 방식**으로 바꿨다. 빈 판정은 기존과 같이 `templates.length` 기준(`isEmpty`), 실패 시 직전 스냅샷 보존도 기존과 같다(기존 코드도 실패 때 `setTemplates`/`setGroups` 를 부르지 않았다). 조치 후 로컬 변이 3곳은 `mutate` 로 감싼 `mutateTemplates` 헬퍼를 거친다.
  - ⑧system-admins: 서비스가 내부에서 계산한 `SafeResult` 를 `{ ok, data, error: string }` 으로 **낮춰서 반환**하던 것을 그대로 돌려주도록 정규화했다(표시 문구 동일, `error.code` 를 추가로 얻는다). 호출부는 1곳뿐이었다. 페이지의 `loadState`/`loadErrorMessage` 두 상태와 수기 `loadAdmins` 는 훅 하나로 대체됐고, 초대 성공 후 재조회는 `reload()` 다.
  - 🔑**전환 전 e2e 커버가 0 이었다** — §3.13 규칙대로 같은 작업에서 성공 경로 스펙을 신설했다(`message-channel.spec.ts` 3케이스, `system-admins.spec.ts` 2케이스). message-channel 스펙은 **응답의 두 절반이 모두 배선됐는지**를 본다(목록=templates, 미리보기의 발송 그룹명=groups) — `groups` 배선을 끊는 red 주입에서 3케이스 중 2케이스가 실패하는 것으로 검출력을 확인했다.
  - 🚨스펙 셀렉터는 **추측하지 말고 실측**해야 했다. 1차 작성분 5케이스 중 4케이스가 실패했는데 전부 내 가정이 틀린 것이었다 — 페이지 제목은 `메일 발송` 이 아니라 `메일`, 검색 placeholder 는 `검색...` 이 아니라 `관리자 계정 검색`, 등록 버튼은 **화면 이동이 아니라 모달**을 연다. 프리뷰에서 DOM 을 읽어 고친 뒤 5/5 통과했다.
  - 잔여(4차 이후): ~~⑤institution-codes·institution-code-detail~~(**6차에서 해소**) · ~~⑨billing-payments~~(**4차에서 해소**) · ~~⑩users-page~~(**5차에서 해소**) + C/D 복합(멀티 effect·폴링).
- 확산 2차 후 잔여(3차 대상 — 아래 ④⑧ 은 3차에서 해소): ④message-channel(응답 3상태 분배 — templates/groups 의 조치 후 변이 여부 정독 필요) ⑤institution-codes·**institution-code-detail(5-fetch 확인)** — fail-open 부가 조회 결합은 부가 상태를 훅 밖 잔여 effect 로 나눌지 설계 필요 ⑧system-admins(서비스가 `{ok, data, error: string}` 비표준 반환 — SafeResult 정규화 별도 작업) ⑨billing-payments(refunds 분기가 에러를 삼킴 — 표준화하면 동작 개선이라 오너 승인 필요) ⑩users-page(fetch 가 쓰지 않는 `query.page/pageSize` 재조회 deps 잔존 — instructor·referrals 와 동일 패턴이나 오너 확인(2026-08-19)이 두 페이지 특정이라 확장 적용은 확인 필요) + C/D 복합 페이지(멀티 effect·폴링). 나머지는 Phase 4 분해와 함께 자연 전환.

### 3.14 초기 번들 페이로드가 계측 없이 커짐 — **1차 조치 (2026-08-20, 리팩토링 Phase 5)**

- 첫 화면이 실행 전에 내려받는 JS 가 **단일 청크 1,250.79 kB** 였고, 그 크기를 확인하는 검사가 없었다. 라우트는 이미 전부 `lazy()` 인데도 엔트리가 이렇게 큰 이유를 계측으로 갈랐다: 엔트리 청크 안에서 앱 소스는 **99.1 kB(8%)뿐이고 나머지 92% 가 vendor** 였다(minify 전 기준으로 antd 계열 최다, `@supabase/*` 766 kB, react-dom 131 kB, axios 94.2 kB).
- 계측이 드러낸 결함 2건:
  - **axios 는 이 앱에서 한 번도 요청을 보내지 않았다.** `src/shared/api/http-client.ts` 의 `httpClient` 는 어디에서도 import 되지 않고, 유일한 소비자는 `app.tsx` 의 side-effect import(인터셉터 등록)였다. 프런트의 `/api` 호출 4곳은 전부 네이티브 `fetch` 다. 그래서 `api-error.ts` 의 `axios.isAxiosError` 분기도 도달 불가였고, `docs/architecture/admin-overview.md` 의 "통신 계층: axios" 서술도 사실과 달랐다.
  - **로그인 화면이 항상 초기 페이로드에 있었다.** `auth-gate.tsx` 가 `LoginPage` 를 정적 import 해서, 인증된 세션과 mock 모드처럼 렌더되지 않는 경우에도 antd Form 계열(rc-field-form·async-validator·rc-input)이 첫 로드에 실렸다.
- 조치(2026-08-20):
  - `vite.config.ts` 에 `manualChunks` 신설 — `vendor-react`(164.04 kB)·`vendor-supabase`(210.84 kB) 를 앱 청크에서 떼어냈다. 목적은 바이트 감소가 아니라 **캐시 수명**이다(앱만 바뀌는 배포에서 374.88 kB 가 재다운로드되지 않는다).
  - axios 의존 제거: `http-client.ts` 삭제, side-effect import 제거, `axios.isAxiosError` 를 **동일한 형태 검사**(`isAxiosError === true`, axios 구현과 같은 판정)의 지역 가드로 대체해 매핑 분기는 보존했다. `package.json` 에서 axios 제거 = 의존 트리 23개 감소. 아키텍처 문서의 전송 계층 서술도 `@supabase/supabase-js` + 네이티브 `fetch` 로 정정했다.
  - `LoginPage` 지연 로딩 — Suspense fallback 은 `initializing` 대기 표시를 그대로 공유해 미인증 사용자의 첫 화면 전환이 기존과 같게 보인다.
  - **예산 게이트 신설**(`check:bundle-budget`, `harness:full` + CI quality 잡의 build 직후 배선): `dist/index.html` 이 직접 참조하는 `<script type="module">` **과 `<link rel="modulepreload">`** 를 합산한다. 예산 SoT 는 `package.json` 의 `bundleBudget` 키(jscpd 임계와 같은 방식). red 검증 3종 — 예산 초과 exit 1 · `dist` 부재 시 조용한 통과 대신 exit 1(§3.9 교훈) · modulepreload 미포함이면 374.88 kB 가 계측에서 사라진다는 것 실측.
- 결과: 초기 JS **1,250.79 → 1,120.56 kB(−130.23 kB, −10.4%)**, 그중 **배포마다 무효화되는 앱 청크는 1,250.79 → 745.67 kB(−40.4%)**. 전체 JS 3,991.55 → 3,969.30 kB, 청크 127 → 135개, CSS 30.09 kB 불변. 프로덕션 빌드 프리뷰로 셸·표·날짜 필터·지연 청크 로드까지 콘솔 오류 0 확인, e2e 스모크 11/11, 단위 726/726.
- 🚨**부정 결과(기록 필수) — antd 계열은 이름 규칙으로 vendor 청크로 묶으면 안 된다.** 1차 시도에서 `antd`·`rc-*`·`@rc-component/*`·`@ant-design/*` 를 `vendor-antd` 로 묶었더니 초기 페이로드가 **1,250.79 → 1,741 kB 로 늘었다**. 원인은 배럴(`antd/es/index.js`)이다 — 모듈 그래프상으로는 표 전용 `rc-table`·날짜 전용 `rc-picker` 까지 엔트리에서 정적 도달 가능해 보이지만, Rollup 은 **tree-shaking 이후**의 살아 있는 의존만으로 청크를 배치하므로 실제로는 지연 청크(`Table-*.js` 157 kB, rc-picker 104 kB)에 있다. `getModuleInfo().importers` 는 tree-shaking 전 그래프라 이 차이를 볼 수 없다. 그래서 vendor 그룹은 **엔트리 전용 패키지(`@supabase/*`·react 계열)로 한정**했고, 이 부정 결과를 회귀 가드 단위 테스트로 못박았다(`tests/unit/vite-manual-chunks.test.ts` — antd 계열을 그룹에 넣으면 실패, red 확인). antd 를 캐시 가능하게 떼어내려면 tree-shaking 이후 정보가 필요해 현재 API 로는 안전하게 되지 않는다(미해결). 같은 이유로 **엔트리 청크 자체는 캐시 대상이 될 수 없다** — import 하는 청크의 파일명이 본문에 박히므로 하위 청크 해시가 바뀌면 엔트리 해시도 바뀐다. 캐시 가능한 것은 항상 "엔트리가 import 하는 잎 청크"다.
- 남은 것: ①**mock 픽스처 157.2 kB(minify 전)가 프로덕션 번들 20개 청크에 실린다** — 초기 페이로드는 아니지만 해당 화면을 여는 사용자가 쓰지 않는 데이터를 내려받는다. 동적 import 전환이 Phase 5 후속이며, 소비자가 이미 async 인 서비스와 **동기 초기 상태를 만드는 store(commerce·community·message·operation·pdf-quota·policy)** 를 나눠 판단해야 한다(후자는 초기 상태 의미가 바뀐다). ②antd vendor 분리(위 부정 결과). ③`exceljs` 938.54 kB 는 이미 동적 import 라 대상이 아니고, `tinymce` 는 `/tinymce/tinymce.min.js` 스크립트 로드라 번들 밖이다.

### 3.15 import 경로 표기가 반반으로 섞임 — **해소 (2026-08-20, 리팩토링 alias 전면 치환)**

- `@/*` alias 는 Phase 1(2026-08-18)에서 도입했지만 **그때 수정한 파일에만 적용**했고(전면 치환은 진행 중이던 다른 브랜치와의 충돌을 피해 분리), 그 뒤로 표기가 섞인 상태로 남았다. 실측: 상대경로 `from '../` 905개 vs `from '@/` 343개 — **반반이라 코드만 봐서는 어느 쪽이 규칙인지 알 수 없었다**(규칙 원문도 어느 가이드에도 없었다).
- 규칙을 정해서 적용했다: **모듈 루트를 벗어나는 참조는 `@/`, 루트 안의 참조는 상대경로.** 모듈 루트는 `src/features/<feature>`·`src/shared`·`src/app`(그 밖은 `src`)다. 이 방향인 이유는 ①루트를 벗어나는 `../../..` 는 파일을 옮길 때마다 깨지고 몇 단계인지 세어야 레이어를 알 수 있다 ②반대로 같은 feature 안까지 `@/` 로 적으면 자기 것과 남의 것이 구분되지 않는다. 원문은 `docs/guidelines/typescript-essential-checklist.md` §14.
- 조치(2026-08-20): 경로 해석 기반 codemod 로 **specifier 427개 / 파일 86개**를 치환했다(라인 수 427 삽입·427 삭제 = 1:1 교체, 구조 변경 0). 남은 상대경로는 전부 자기 루트 안이다(`./` 224 + `../` 605).
- 게이트 신설: `check:import-boundary`(`harness:check` 배선). **양방향 검사** — 루트를 벗어난 상대경로도, 루트 안을 가리키는 `@/` 도 실패한다. red 2종 실측(양방향 각각 exit 1). 도입 시점에 기존 `@/` 343개가 **전부 루트 밖을 가리키고 있어** 양방향 검사가 바로 통과했다.
- 🔑**검증 축 = 번들 자산 목록 해시 불변**. import 표기만 바뀌었다면 빌드 산출물은 바이트 단위로 같아야 한다 — 치환 전/후 `dist/assets` 파일명(내용 해시 포함) 146개가 완전히 동일했다(엔트리·vendor 청크 해시까지 같음). typecheck·lint·단위 테스트보다 강한 무드리프트 증명이라 이후 표기 전용 치환에도 이 축을 쓴다.
- 함정: codemod 의 specifier 정규식은 주석 속 `import './x'` 같은 문자열에도 걸릴 수 있다 → diff 전수로 **변경 라인 427개가 모두 `import`/`from`/`export` 를 포함**하는지, 주석 라인 변경이 0인지 확인했다.

### 3.16 가시 텍스트 14px 미만이 화면·전역 CSS 에 남아 있음 — **해소 (2026-08-20, 리팩토링 Phase 6a)**

- 오너 규칙은 2026-07-14 에 정해졌다(가시 텍스트 14px 미만 금지, 베이스 16). 그때는 `/analytics/learning` **한 화면만** 페이지 `ConfigProvider` 로 올렸고, 규칙 원문은 어느 가이드에도 없었으며 나머지 화면과 전역 `global.css` 는 그대로 남았다.
- 실측(2026-08-20): 14px 미만이 **33곳** — 인라인 `fontSize` 21곳(11·12·13px)과 CSS `font-size` 12곳. 전역 `global.css` 의 `.page-title-description`(13px)·`.page-title-meta`(12px) 처럼 **모든 페이지 머리글에 걸리는 것**과, 2026-07-14 에 올렸다던 `/analytics/learning` 의 KPI 툴팁(11·12·13px)까지 포함돼 있었다 — 한 화면을 올려도 **나중에 추가된 CSS 는 다시 작아진다**는 뜻이다.
- 조치: 33곳을 14px 로 올리고(아이콘 글리프 3곳 제외), 규칙 원문을 `docs/guidelines/admin-ux-ui-design.md` 로 명문화하고, `check:typography-min-font` 게이트를 `harness:check` 에 배선했다.
- 🔑**예외는 아이콘 글리프뿐**이다 — `<RightOutlined style={{ fontSize: 12 }} />`, `<CheckOutlined style={{ fontSize: 11 }} />`, 컬럼 도움말 아이콘 래퍼(`cursor: 'help'`, `lineHeight: 1`) 3곳. 아이콘은 텍스트가 아니라 도형이라 규칙 대상이 아니다. allowlist 는 근거와 함께 스크립트에 두고 **줄이기만 한다**(max-lines baseline 과 같은 래칫).
- 🚨판정 기준을 "`<Text>` 인가"로 잡으면 틀린다 — `<pre>`(원본 JSON 뷰어)·`<summary>`(토글 문구)·`<span>`(범례 행)·`CSSProperties` 상수(툴팁 라벨/설명)도 전부 가시 텍스트다. 반대로 `<Text>` 가 아니어도 아이콘 크기 지정이면 대상이 아니다. **엘리먼트 종류가 아니라 "사람이 읽는 글자인가"로 갈라야 한다.**
- 🚨**게이트 범위 한계 — `src/**` 리터럴 스캔만으로는 "규칙 100% 충족"이 아니다.** antd 컴포넌트가 자기 토큰으로 그리는 텍스트는 우리 소스에 숫자가 없다. 프로덕션 빌드 프리뷰에서 텍스트 노드 전수 computed font-size 를 감사한 결과, 우리가 쓴 값은 전부 14 이상인데 **`ant-tag`(Tag 본문)와 `ant-switch-inner-*`(Switch 내부 라벨)가 12px 로 남았다**. 원인은 antd 파생값 `fontSizeSM = fontSize(14) - 2 = 12` 다.
- **해소 (2026-08-20, Phase 6a 보강)**: 전역 테마에 `fontSizeSM: 14` 한 줄을 선언해 닫았다(`src/app/theme.ts`). 재실측에서 7개 화면 **텍스트 노드 1,718개 중 14px 미만 0건**, 드롭다운·표 필터·행 액션 오버레이를 열어도 0건이다.
- 🔑**정정**: 직전 서술의 "해소 수단은 전역 `fontSize: 16` 하나뿐"은 **틀렸다**. antd 의 `fontSizeSM` 은 `ThemeConfig.token`(`Partial<AliasToken>`)에 직접 넣을 수 있는 alias 토큰이고, `components: { Tag: { fontSizeSM: 14 } }` 처럼 **컴포넌트 단위 덮어쓰기도 타입상 허용**된다(`OverrideTokenMap[key] = Partial<CompTokenMap[key]> & Partial<AliasToken>`). 즉 본문(`fontSize`)을 키우지 않고 소형 텍스트만 올리는 길이 처음부터 있었다.
- 전역 토큰을 택한 이유: 같은 `fontSizeSM` 에서 Tag·Switch 말고도 Badge count·표 필터 빈 목록 문구(`:empty::after`)처럼 **DOM 을 훑어도 안 걸리는 표면**이 파생된다. 컴포넌트 단위로 좁히면 그 표면을 전수 열거해야 한다.
- 실측 부작용은 **`.ant-badge-dot` 6→7px 하나뿐**이다(도형이라 규칙 대상 아님). 본문 크기는 불변(`.ant-layout-content` computed 14px) — "앱 전체를 키우지 말라"는 2026-07-14 제약과 충돌하지 않는다. 레이아웃 A/B(같은 화면 2회 빌드)에서 `docScrollX` 386, `.ant-layout-content` 넘침 346px, `.ant-table-body` 넘침 2,750px, 행 높이 42px 이 **모두 불변**이고 Tag 는 전부 한 줄(높이 22→25px, 최대 폭 153→176px)이다.
- 🚨**게이트 자체의 결함을 red 검증이 잡았다**: 새 토큰 검사가 `fontSizeSM` 을 정규식으로 찾는데, **같은 파일 주석에 대안 예시 `components: { Tag: { fontSizeSM: 14 } }` 가 있어 선언을 지워도 통과**했다. 주석을 걷어낸 뒤 매칭하도록 고쳤고, "선언 삭제 + 주석 예시 잔존" 케이스를 red 3종 중 하나로 상설화했다(같은 함정 5회째 — 부재·위치 단정은 낱말이 아니라 실행 코드 표현식으로 해야 한다).
- 남은 것: Phase 6 의 나머지 절반 — **인라인 style 676곳을 디자인 토큰으로 걷어내는 작업은 토큰 기계(antd theme token vs CSS 변수 vs TS 상수)를 오너가 정해야 착수할 수 있다**.

### 3.17 디자인 값이 인라인 리터럴로 흩어져 있음 — **해소 (2026-08-20, 리팩토링 Phase 6b)**

- 실측(2026-08-20): 인라인 `style={{}}` 블록 **676개 / 프로퍼티 996개**. 성격별로 나누면 간격 483(48.5%)·**구조 배치 385(38.7%)**·타이포 51·색 35·모서리 28 이었다.
- 🔑**"676곳 토큰화"는 실제 대상이 아니었다** — 38.7%(`display`/`flex`/`width`/`position` 등)는 디자인 토큰이 아니라 구조 배치라서 토큰화 대상이 아니고, 간격 숫자의 40%는 `0`(리셋)이다. 간격 숫자 리터럴은 **12종뿐이고 92%가 이미 antd 스케일(0/4/8/12/16/20/24/32/48)** 위에 있었다. 그래서 목표를 "전량 개명"이 아니라 **① 단일 소스 확보 ② 스케일 밖 값 정규화 ③ 게이트**로 잡았다.
- 조치: `src/shared/styles/design-tokens.ts` 신설. 값을 새로 정하지 않고 **`theme.getDesignToken(adminThemeToken)` 으로 antd 테마에서 파생**한다(`SPACE`/`RADIUS`/`FONT_SIZE`/`ICON_SIZE`/`COLOR`/`APP_COLOR`). 총 **403곳** 치환(1차 366 + 합성 문자열 32 + shorthand 8 + 모듈 상수 5)에 게이트 `check:design-tokens` 와 단위 테스트 9종을 붙였다.
- 🔑**`theme.useToken()` 훅은 채택할 수 없었다** — Phase 4 분해로 생긴 컬럼 팩토리·스키마 모듈은 컴포넌트가 아니어서 훅을 부를 수 없다. `getDesignToken` 은 순수 함수라 모듈 스코프에서 부를 수 있어 같은 값이 두 계층에 다 닿는다.
- 🚨**브랜드색 드리프트를 발견했다**: 테마가 `colorPrimary: #0f4da8` 인데 **antd 의 `colorLink` 는 `colorPrimary` 에서 파생되지 않는 별도 시드**라 링크·링크 Button 이 antd 기본 `#1677ff` 로 남아 있었다(프리뷰 computed style 실측 `/dashboard` 33개). 여기에 우리 코드의 `#1677ff`/`#e6f4ff` 10곳과 `global.css` 4곳이 겹쳐 있었다. `colorLink` 를 브랜드색으로 지정해 닫았고 **대비비가 4.10:1(WCAG AA 미달) → 7.93:1(AAA)로 개선**된다.
- 🚨**부분 수리가 새 불일치를 만들 수 있다**: `colorLink` 만 고쳤을 때 antd 링크는 브랜드색인데 `global.css` 의 순수 `<a>`(`.table-navigation-link`)는 기본 파랑으로 남아 **한 화면에 링크 색이 두 개**가 됐다(`/users` 20개 실측). 같은 PR 에서 `global.css` 4곳까지 고치고, 게이트가 CSS 의 `#1677ff` 재유입을 막도록 했다.
- 🔑**예외는 "색이 무엇을 뜻하는가"로 가른다** — 데이터 계열 팔레트(차트 시리즈·점수 구간·PDF 분포)와 제3자 브랜드색(소셜 로그인 마크), mock 콘텐츠 HTML 은 대상이 아니다. 파일 예외 4건·블록 예외 9건을 근거와 함께 등재했고 **줄이기만 한다**.
- 시각 변경은 68곳이며 전부 ≤2px 또는 브랜드 교정이다: 간격 스케일 정규화 46곳(6→8·10→12·18→16·9→8·14→16·26→24), `fontSize: 15→16` 9곳(소제목), `borderRadius` 7곳(8→10·3→2), 브랜드 교정 6곳 + `colorLink`. 레이아웃 회귀는 없다 — 프리뷰 7화면에서 문서 가로 스크롤 0·텍스트 노드 1,754개 중 14px 미만 0건.
- 남은 것(별도 판단 필요) — **아래 3건은 §3.17.1 에서 종결**, `global.css` 만 §3.17.2 로 이월
  - ~~**차트 축·눈금 라벨이 `fontSize={9}`** 4곳~~ → 레이아웃 재설계로 14px 적용(§3.17.1).
  - ~~**`colorInfo` 는 antd 기본 파랑 그대로**~~ → 분리 유지로 결정 완료(§3.17.1).
  - ~~**`/analytics/learning` 만 페이지 단위 `fontSize: 16`**~~ → 제거하고 전역 14 와 통일(§3.17.1).
  - ~~**`global.css` 색 리터럴**~~ → CSS 변수 브리지로 해소(§3.17.2). 실수치는 주석 제외 110회·59종·105줄이었고, 세지 않았던 `analytics-learning-page.css` 54곳도 함께 처리했다.

#### 3.17.3 요약 카드가 조회 중에 `0` 을 정상 수치처럼 보여줌 — **해소 (2026-08-20)**

`ListSummaryCards` 에는 로딩 표현이 없었다. 데이터가 빈 배열인 첫 프레임에도 카드가 계산식을 그대로 그리므로 `0건`·`₩0` 이 **정상 수치처럼** 보였다. 같은 화면의 표에는 antd 로딩 오버레이가 있어서 표와 카드가 서로 다른 말을 했다.

- 공용 컴포넌트에 `loading` 을 넣고, 그때는 **라벨은 유지한 채 값·힌트만** `Skeleton.Input` 으로 바꾼다(무엇을 기다리는지 보여야 한다).
- 판정은 `isInitialSummaryLoad(status, hasData)` — **"pending 이고 캐시가 없을 때만"**. 이미 저장소에 같은 관용구가 표 loading 4곳에 흩어져 있었고(`status === 'pending' && !hasCached`), 판정을 한 곳에 모아 화면마다 달라지지 않게 했다.
- 🚨 **한 화면만 배선하면 원래 결함보다 나쁘다** — 그 화면만 로딩을 그리고 나머지는 계속 `0` 을 보여주므로 화면 간 불일치가 된다. 그래서 소비 화면 **17개 전수**를 배선하고, 전수 여부를 단위 테스트가 고정한다.
- 로딩 중에는 **클릭형 카드를 정적으로 그린다**(`--interactive` 클래스도 붙지 않는다) — 값이 없으면 필터로 쓸 수 없다.
- 🔑 재조회(조치 후 갱신)에는 `loading` 이 false 여야 한다. 캐시를 무시하면 이미 맞는 수치가 스켈레톤으로 가려져 화면이 깜빡인다 — 단위 테스트에 그 케이스를 넣었고, 캐시 조건을 지우는 red 주입에서 1케이스가 실패한다.

##### 🚨 e2e 는 "관측 창이 있는 화면"에서만 성립한다

첫 스펙을 `/commerce/payments` 로 썼다가 실패했다. **billing·assessment 의 mock 경로에는 인위적 지연이 없다**(zustand store 를 즉시 반환) — pending 이 마이크로태스크 한 번에 끝나 로딩 프레임을 볼 수 없다. `stretchAsyncFetchDelay` 도 늘릴 대상이 없다.

지연이 있는 화면으로 옮겼다 — `/system/logs`(180ms)·`/commerce/coupons`(220ms). 프리뷰 실측: 로딩 중 카드 텍스트가 `오류 로그`(숫자 없음)였고 조회 후 `오류 로그 2건` 이 됐다.

#### 3.17.2 CSS 가 색 값을 직접 들고 있던 문제 — **해소 (2026-08-20)**

CSS 는 TS 모듈을 import 할 수 없어서 `design-tokens.ts` 의 값이 스타일시트에 닿지 못했다. 그래서 디자인 토큰 게이트도 CSS 는 `#1677ff` 금지 한 줄만 봤다.

**CSS 변수 브리지**를 넣었다.

```
design-tokens.ts (CSS_COLOR_VARIABLES)   ← 값의 단일 소스
        │  scripts/emit-design-token-css.ts (vite-node)
        ▼
generated-design-tokens.css (커밋)        ← :root { --admin-* }
        │  main.tsx 에서 global.css 보다 먼저 import
        ▼
global.css · analytics-learning-page.css  ← var(--admin-*) 만 쓴다
```

| | 실측 |
| --- | --- |
| 변수 | **84개** |
| `global.css` | 치환 107회 + 여러 줄 box-shadow 1건, 리터럴 **0** |
| `analytics-learning-page.css` | 치환 **54회**, 리터럴 **0** |

- 🚨 **`global.css` 만이 아니었다.** 게이트를 CSS 전체로 확장하니 `src/features/analytics/pages/analytics-learning-page.css` 에 54곳이 더 있었다. §3.17 의 "106줄"은 이 파일을 세지 않았다.
- 🚨 **이전 보고 수치는 CSS 주석 안의 색까지 셌다.** `global.css` 실수치는 주석 제외 **110회·59종·105줄**이다(주석 포함 112회). 그래서 검사·치환 모두 **주석을 먼저 걷어낸다**.
- 🔑 **생성물을 커밋한다.** 빌드 타임에만 만들면 개발·테스트 경로에서 파일이 없거나 낡을 수 있고, 리뷰 diff 에 색 변경이 보이지 않는다. 대신 낡음을 `check:design-token-css`(harness:check 배선)가 막는다 — 생성기를 다시 돌려 커밋본과 줄 단위로 대조한다.
- 🔑 **CSS 는 TS 를 못 읽으니 생성기가 TS 를 읽어야 한다.** 생성기는 `vite-node` 로 `scripts/emit-design-token-css.ts` 를 실행한다(그래야 `@/` alias 와 antd 가 해석된다). `node` 로 직접 돌릴 수 없다.
- **import 순서가 계약이다** — 변수 파일이 `global.css` 보다 먼저 들어와야 `var()` 가 해석된다. `src/main.tsx` 에 근거 주석을 남겼다.

##### 🔑 검증 축 = computed color 집합 불변

값을 옮기기만 했으므로 **화면에 나오는 색의 집합이 그대로여야 한다.** 이건 스냅샷 이미지보다 강한 단정이다.

7개 화면(`/dashboard`·`/users`·`/commerce/coupons`·`/messages/groups`·문항 상세·`/analytics/learning`·`/operation/notices`)에서 모든 엘리먼트의 `color`/`backgroundColor`/테두리 4방향/`outlineColor`/`boxShadow`/`backgroundImage` 를 모아 **값 집합과 해시를 치환 전후로 대조 → 7/7 완전 동일**.

- 🚨 처음에는 **값별 등장 횟수까지 넣은 다이제스트**를 썼는데, 알림 벨·툴팁 같은 일시적 노드 때문에 노드 수가 실행마다 달라져 전환과 무관하게 해시가 어긋났다. 불변식은 "**어떤 색이 쓰이는가**"이므로 **횟수를 뺀 집합**으로 비교해야 한다.

##### 예외로 남긴 것

- `--admin-link-hover: #4096ff` 는 **antd 기본 파랑**이다(브랜드색 파생이 아니다). `colorLink` 와 같은 계열의 드리프트지만, 이 작업은 **값을 옮기는 것**이라 값을 바꾸지 않았다. 브랜드 hover 색(`colorPrimaryHover` = `#2d68b5`)으로 맞출지는 별도 판단이다.
- 여러 개의 근접 흰색·회색(`#fcfdff`·`#fcfcfd`·`#fbfdff`·`#f8fbff` …)을 하나로 통합하지 않았다. 통합은 시각 변경이다.

#### 3.17.1 잔여 타이포·상태색 판단 3건 종결 (2026-08-20)

| 항목 | 결정 | 근거 |
| --- | --- | --- |
| 차트 축·값 라벨 `fontSize={9}` 4곳 | **예외 등재가 아니라 레이아웃 재설계** | 9px 을 예외로 인정하면 14px 계약이 깨지고, 아래 게이트 누락이 영구화된다 |
| antd `colorInfo` | **브랜드색과 분리 유지** | 정보 Alert 이 주요 액션·링크와 같은 색이면 둘이 구분되지 않는다. 아이콘 대비 기준 3:1 은 antd 기본 파랑(4.10:1)도 충족한다 — 단 이 색을 본문·링크에 쓰면 4.5:1 미달이라 그때는 브랜드색을 쓴다 |
| `/analytics/learning` 전용 `fontSize: 16` | **제거(전역 14 와 통일)** | 밀집 영역만 키우는 제한적 예외가 아니라 권한 오류 화면까지 감싸는 페이지 전역 재정의였다. "앱 전체 본문을 키우지 말라"는 제약을 한 화면에서 우회하는 형태다 |

##### 🚨 SVG 안의 `fontSize` 는 CSS 픽셀이 아니다

차트는 `viewBox="0 0 360 220"` 을 `width: '100%', maxWidth: 480` 으로 늘려 그렸다. 그래서 `fontSize={9}` 의 실제 크기는 **컨테이너 폭에 따라 달라졌다** — 480px 로 늘면 12px, 360px 미만으로 줄면 9px 미만. §3.17 의 "9px" 서술 자체가 부정확했고, **어느 폭에서도 14px 을 만족하지 못했다**는 것이 정확한 사실이다.

조치는 **스케일을 없애는 것**이다. viewBox 단위 = CSS 픽셀이 되도록 산출 폭 그대로(`width={width}`) 그리고, 좁은 컨테이너에서는 가로 스크롤로 넘긴다. 대신 폭·여백·밴드 너비가 라벨 폭을 따라가야 하므로 그 계산을 순수 함수 `src/features/assessment/model/category-chart-layout.ts` 로 떼어 단위 13케이스로 고정했다(라벨 폭 추정 = CJK 1em / 그 밖 0.6em 2분류 근사, 경계에서는 넉넉한 쪽으로 올림).

- 🔑 **라벨 겹침은 e2e 로 잡기 어렵다** — SVG 텍스트는 서로를 가려도 DOM 상으로는 둘 다 "보인다". 그래서 불변식("라벨 폭 + 최소 여백 ≤ 배정된 자리")을 단위 테스트로 고정하고, 프리뷰에서는 **라벨 경계 상자를 직접 계산해 겹침 0** 을 확인했다(같은 줄로 묶은 10개 라벨 행 전부, x축 라벨 사이 여백 43px).
- 실측(프리뷰 mock, 53번 문항 상세): viewBox `0 0 360 240`·`width="360"`·렌더 폭 360 → 1:1, SVG 텍스트 13개 전부 **정확히 14 CSS px**.
- 🚨 단위 테스트가 내 단언 하나를 잡았다 — "값 라벨을 켜면 밴드가 넓어진다"는 **기본 폭 하한이 지배할 때 성립하지 않는다**(오른쪽 여백이 늘어 오히려 좁아진다). 지켜야 하는 것은 "값 라벨이 배정된 자리에 들어간다"는 불변식이라 그렇게 고쳤다.

##### 🚨 타이포 게이트에 구멍이 두 개 있었다

§3.16·§3.17 은 게이트가 `src/**` 만 보므로 antd 자체 값을 못 본다고 적었지만, **게이트가 우리 코드조차 다 못 보고 있었다.**

| 구멍 | 놓친 표기 | 원인 |
| --- | --- | --- |
| ① JSX/SVG 속성형 | `fontSize={9}`, `fontSize="11"` | 정규식이 `fontSize:`(콜론)을 요구했다 — 차트 라벨 4곳이 이 구멍으로 통과해 왔다 |
| ② 줄 끝 객체 리터럴 | 콤마 없는 마지막 속성 `fontSize: 12` | lookahead `(?=[,\s}'])` 가 줄 끝에서 실패한다 |

둘 다 막고 표기 4종(`fontSize={9}`·`fontSize="11"`·`fontSize={13.5}`·줄 끝 `fontSize: 12`)에 대해 exit 1 을 확인했다.

- 🚨 **주석 매칭 함정 6회째** — 속성형을 잡게 하자 이번에는 **규칙을 설명하는 주석의 예시**(`fontSize={9}`)가 위반으로 잡혔다. 방향에 따라 둘 다로 깨진다: 없는 위반을 만들거나(이 검사), 진짜 선언을 지워도 주석 예시 때문에 통과한다(테마 `fontSizeSM` 검사에서 겪었다). 그래서 **문자열 리터럴은 남기고 주석만 공백으로 덮는 제거기**를 넣었다(라인 번호 보존, 문자열 안의 `//` 는 주석으로 보지 않는다). allowlist 판정은 사람이 읽는 근거이므로 원본(주석 포함) 기준을 유지한다.

### 3.18 포인트 화면이 전량을 받아 클라이언트에서 필터·정렬·페이징함 — **해소 (2026-08-21)**

포인트 3개 탭(정책·원장·소멸 예정)은 전량을 한 번에 받아 화면에서 걸렀다. 원장은 포인트 이벤트마다 행이 늘어나는 표라 전량 조회가 커질 수밖에 없다. Phase 4 22호에서 분해할 때 "가시 동작 변경"이라 분리해 둔 항목이다.

#### 무엇이 동등하고 무엇이 아니었나

| 축 | 서버 전환 |
| --- | --- |
| 필터(상태·유형·출처) | **증명 가능하게 동등** — CHECK 제약 6종의 값 집합이 UI↔DB 번역 맵과 정확히 일치하고 이후 변경이 없다. 제약이 닫혀 있으므로 클라이언트 폴백은 도달 불가이고 `.eq(코드)` 가 화면의 `=== 라벨` 과 같은 행을 고른다 |
| 기간·검색·페이징·총건수 | 동등 |
| **정렬(열거형 7열)** | **동등하지 않았다** — 화면은 한국어 라벨을 `localeCompare('ko-KR')` 로 정렬하는데 열에는 영어 코드가 들어 있다(정책 상태 오름차순: 운영 중→중지→초안 vs active→draft→inactive). PostgREST 에 CASE 정렬이 없어 **DB 정렬 계약이 선행**돼야 했다 |

그래서 2단계로 나눴다 — 1단계 정렬키 생성 컬럼 7개(마이그 `20260821020000`, **dev·운영 적용 완료 — 2026-08-21**), 2단계가 이 전환이다.

#### 계약

- **개요**(`PointsOverview`) — 쿼리와 무관한 건수. 탭 라벨과 요약 카드가 쓴다. 🔑요약 카드는 **상태 필터 역할**이므로 필터를 적용해 세면 자기 자신이 0 이 된다 → 필터 무관 전체 기준(지금과 같은 의미).
- **페이지**(`PointsPageSlice`) — 활성 탭의 현재 페이지 행 + **필터 적용 후 전체 건수**. 툴바 `총 N건`·페이지네이션 총량·소멸 내보내기 건수가 모두 이 값을 쓴다.
- 조건 수립은 순수 함수(`supabase-points-page-queries`)가 하고 실행은 어댑터가 한다 — 라이브 DB 없이 **가짜 빌더로 호출 조건을 검사**할 수 있는 유일한 방법이다(19케이스, red 3축).
- mock 경로는 **기존 `filterX`→`sortX`→`paginateItems` 를 그대로 재사용**한다 → 그 경로에서는 구조적으로 동등하다.
- 🚨**모든 정렬에 `id` 후속 키를 붙인다.** 열거형 정렬키는 값이 3~7종뿐이라 동률이 흔하고, 동률 순서를 고정하지 않으면 **페이지 경계에서 행이 중복·누락**된다.

#### 🚨 프리뷰 실측이 잡은 경합

`selected` 가 현재 페이지 밖일 때 단건 조회로 복원하도록 만들었는데, **정상 링크가 URL 에서 지워졌다.** 원인은 정리 effect 가 `record !== null` 로 "조회가 끝났나"를 판정한 것 — **못 찾은 것과 아직 안 끝난 것이 구별되지 않아서** 페이지 조회가 먼저 끝나는 순간 정리가 돌았다. 대상 id 와 완료 여부를 함께 들고 `resolved && record === null` 일 때만 정리한다.

실측 3경우: 페이지 밖 id → Drawer 열림·URL 유지 / 없는 id → 정리 / 페이지 안 id → 그대로.

#### 🚨 전량 조회에 기대던 다른 표면

소멸 **보류 등록 모달**은 목록이 아니라 **보류 가능 전체**에서 대상을 고른다. 페이지 행만 넘기면 다른 페이지의 건을 고를 수 없어 기능이 줄어든다 → 후보 전용 조회를 두고 상한을 두지 않았다(후보는 종결되지 않은 상태로 도메인상 제한되고, 상한을 두면 목록에 없는 건이 선택 UI 에서 조용히 빠진다).

**내보내기**도 이 계열이다 — 파일을 만들지 않고 건수만 알리는 기능이라 그 수치가 유일한 산출물이다. 현재 페이지 길이를 넘기면 "20건 내보냈다"처럼 실제와 다른 값을 알린다 → 서버 exact count 를 쓴다.

### 3.19 표시 일관성·상태 접힘 잔여 3건 — **해소 (2026-08-21)**

#### 3.19.1 billing 두 화면의 표가 로딩 상태를 아예 안 넘김

`billing-payments`·`billing-refunds` 의 `AdminDataTable` 에 `loading` 이 없었다. 다른 목록 화면은 전부 `loading={state.status === 'pending'}` 을 넘긴다.

🚨**왜 아무도 못 봤나** — billing 의 mock 경로가 store 를 **즉시 반환**해서(다른 mock 서비스는 180~320ms 인위적 지연이 있다) pending 프레임이 마이크로태스크 한 번에 끝난다. 화면에서도 e2e 에서도 관측할 수 없었고, 그래서 `list-loading-consistency` 감사 목록(11개)에도 두 화면이 빠져 있었다.

조치: mock 에 다른 서비스와 같은 지연을 주고(관측 가능하게), `loading` 을 배선하고, **감사 목록에 편입**했다(11 → 13). red: `loading` 을 빼면 그 화면 케이스가 실패한다.

- 🔑 **"관측할 수 없어서 빠졌다"는 감사 목록의 구조적 사각지대다.** 목록에 없는 화면은 검사되지 않고, 검사되지 않는 이유가 "관측 불가"면 영구히 빠진다.

#### 3.19.2 링크 hover 가 antd 기본 파랑

`--admin-link-hover` 가 `#4096ff`(antd 기본 파랑)였다. §3.17.2 는 값 이전 작업이라 그대로 옮겨 두고 별도 판단으로 남겼는데, 실측하니 **대비비 2.99:1** 로 WCAG AA(4.5:1)에 크게 못 미친다.

| 색 | 흰 배경 대비 | |
| --- | --- | --- |
| `#4096ff`(기존 hover) | **2.99:1** | AA 미달 |
| `#1677ff`(#127 이 고친 `colorLink`) | 4.10:1 | AA 미달 |
| `#0f4da8`(브랜드) | 7.93:1 | AAA |
| `#2d68b5`(파생 `colorPrimaryHover`) | **5.59:1** | AA 통과 |

🚨**hover 라서 더 나쁘다** — 평소엔 읽히는 링크가 마우스를 올리면 **덜 읽힌다**. 브랜드 파생 hover 로 맞췄다.

- 🔑 같은 계열 실수가 두 번 났으므로(#127 `colorLink`, 여기 `link-hover`) **값이 아니라 기준**을 테스트로 걸었다 — 브랜드·링크·hover 가 모두 AA 를 넘는지, 그리고 antd 기본 파랑 3종이 링크 색으로 되돌아오지 않는지.

#### 3.19.3 계약 조회가 실패하면 "유입 차단 아님"으로 조용히 읽힘

기관 상세 회원 탭의 차단 안내가 `settings.blockIntakeOnExpiry && contractStatus?.hasActiveContract === false` 였다. `contractStatus` 는 계약 조회 실패·미완료·계약 없음이 **모두 `null`** 이므로, 조회가 실패하면 `false === false` 가 성립하지 않아 안내가 사라진다 — 즉 **실패가 "차단 아님"으로 접혔다**.

이 PR 은 안내를 3갈래로 나눴다.

| 상태 | 안내 | 조치 버튼 |
| --- | --- | --- |
| 옵션 OFF, 또는 유효 계약 | 없음 | 활성 |
| 옵션 ON + 만료 확인됨 | 확정 차단(기존) | 비활성 |
| **옵션 ON + 계약 조회 실패·미완료** | **모름(신규)** | **활성** |

🚨**모를 때 화면이 막지 않는 것이 핵심이다.** 강제는 서버가 한다 — `admin_invite_institution_members_guarded` 가 `institution % has no active contract; member intake is blocked` 로 거절한다(`supabase/migrations-admin/20260804100400_institution_intake_guards.sql`). 화면 값은 **안내용**이므로, 표시 조회가 실패했다고 버튼을 막으면 **서버가 허용할 초대를 화면이 막는 것**이 된다. 그래서 불확실성을 보이게만 하고 아무것도 비활성화하지 않는다.

- 🔑 판정은 순수 함수 `resolveIntakeBlockNotice` 로 떼어 단위 테스트(7건)로 고정했다. 4가지 경우(유효/만료/조회 실패/옵션 OFF)를 프리뷰에서 실측했다.
- 🔑 이 결함은 §3.19.1·§3.19.2 와 함께 **"여러 상태를 한 값에 접었다"** 는 같은 뿌리다(이번 사이클에서 4번째 — 환불 KPI, 기관 부수 조회, 요약 카드, 포인트 상세 조회).

### 3.20 글자 크기 스케일이 두 벌이었음 — **해소 (2026-08-21, 오너 결정)**

오너 결정: **프로젝트 base = 14px**, 그 하나에서 파생한 스케일을 **antd 와 우리 컴포넌트가 똑같이** 쓴다.

#### 3.20.1 base 가 결정이 아니라 상속이었다

`src/app/theme.ts` 에 `fontSize` 가 없어 프로젝트의 base 는 antd seed 기본값(14)이었다. 값은 같지만 **근거가 없다** — antd 가 기본값을 바꾸면 우리 스케일 전 단계가 조용히 따라 움직인다. `BASE_FONT_SIZE_PX = 14` 를 선언하고 테마에 전달한다.

🚨**그 결과 `sm` 단계는 `base` 와 같아진다**(둘 다 14). 선택이 아니라 두 규칙의 논리적 귀결이다 — base 14 이면 antd 자연 파생은 `sm = 12` 인데 §3.16 의 최소 14 규칙이 12 를 금지하고, 올릴 수 있는 최소가 14 = base 다. base 를 16 으로 올리면 단계가 되살아나지만 앱 전체 본문이 커진다(오너가 14 로 결정).

| | base 14 (결정) | base 16 (대안) |
| --- | --- | --- |
| sm | **14** (= base) | 14 |
| base | **14** | **16** |
| lg | 16 | 18 |
| xl | 20 | 22 |
| heading3 / 2 / 1 | 24 / 30 / 38 | 28 / 34 / 42 |

#### 3.20.2 CSS 50곳이 스케일을 우회했다

색은 CSS 변수 브리지(§3.17.2, 84개)가 있는데 **글자 크기는 없었다** — CSS 파일이 px 리터럴을 직접 썼다(50곳). 그중 5곳은 스케일에 아예 없는 값이었다.

| 값 | 곳 | 조치 |
| --- | --- | --- |
| 14 · 16 · 20 · 24 · 28 | 45 | `var(--admin-font-*)` 로 치환(값 무변경) |
| **17** | 3 | → **16** (`lg`) — 섹션 제목·툴팁 제목·Drawer 제목 |
| **22** | 1 | → **20** (`xl`) — PDF 사용량 통계 |
| **`clamp(25px, 2vw, 31px)`** | 1 | → **28** (`metric`) — 학습분석 KPI 값 |

브리지 = `CSS_FONT_VARIABLES`(8개, 생성물 84 → 92 변수). `FONT_SIZE` 에 antd heading 단계(24 · 30 · 38)를 추가해 스케일에 구멍을 없앴다.

- 🚨**`FONT_SIZE.sm`·`xl` 은 사용처가 0 이었다.** `sm` 은 base 와 값이 같아 쓸 이유가 없었고, `xl` 은 CSS 가 리터럴 `20px` 로 우회하고 있었다 — **토큰이 있어도 쓰이지 않으면 스케일이 아니다.**

#### 3.20.3 "규칙을 지키는 리터럴"이 스케일을 쪼갠다

§3.16 게이트는 **최소값만** 봤다. 17 · 22 · clamp 는 전부 14 이상이라 green 이었다. 값이 아니라 **출처**를 검사하도록 바꿨다 — 글자 크기 숫자는 `FONT_SIZE`(TS)와 `var(--admin-font-*)`(CSS)에서만 나온다. 예외는 아이콘 3건과 스케일 원본 2파일뿐이다.

red 검증 6종 전부 확인: CSS 리터럴 / TSX 리터럴 / 원본 파일 예외 동작 / base 12 / 상수만 두고 전달 제거 / 상수 삭제.

- 🚨**base 검사는 red 가 찾아냈다.** base 를 명시 선언으로 바꾼 직후 `BASE_FONT_SIZE_PX = 12` 를 주입했더니 **게이트가 통과했다** — 리터럴 스캐너는 `fontSize:` 패턴만 보므로 상수 대입을 못 보고, 테마 검사는 `fontSizeSM` 만 봤다. base 가 스케일의 유일한 출처가 된 뒤로는 그 한 줄이 앱 전체를 정하므로, 거기가 뚫리면 나머지 검사가 전부 무의미하다.

#### 3.20.4 antd 내부 값 감사를 사람에서 기계로

§3.16 이 남긴 문제 — 게이트는 `src/**` 만 보므로 **antd 가 자기 토큰으로 그리는 텍스트는 우리 소스에 숫자가 없다.** 2026-08-20 에는 사람이 프리뷰에서 손으로 감사해 `ant-tag` 12px 을 찾았고, 그건 다음번에 반복되지 않는다.

신규 e2e `tests/e2e/typography-scale-audit.spec.ts` — 6개 화면의 **렌더된** computed font-size 를 모아 (a) 14 미만 0 (b) 스케일 밖 0 을 단정한다. red: 테마에서 `fontSizeSM` 을 빼면 6개 화면 전부가 `12px (span.ant-tag …)` 로 실패한다.

- 🔑감사 축은 **등장 횟수가 아니라 값 집합**이다 — 알림 벨·툴팁처럼 일시적으로 붙는 노드 때문에 횟수는 실행마다 흔들린다.
- 🔑**부정 단언 앞에 양성 앵커**를 뒀다(텍스트를 하나라도 셌는지 + 본문 14px 이 실제로 보이는지). 없으면 렌더 전 t≈0 에 "위반 0" 이 공짜로 통과한다.

### 3.21 라이브 검증이 로그인을 건너뛰어 승격이 20커밋 막혀 있었음 — **해소 (2026-08-21)**

`Validate development` 의 `topik-dev-app-validation` 이 **#123 이후 앱 변경 커밋 전부**에서 실패했다. 실패 지점은 항상 같았다.

```
tests/live-e2e/prod-admin-readonly.pw.ts:57
await loginIfNeeded(page);
await expect(page.getByRole('heading', { name: '회원 목록' })).toBeVisible();
  → Timeout 20000ms, element(s) not found
```

실패 순간 화면을 잡아 보니 **로그인 화면에 그대로 머물러 있었다**(`heading "TOPIK 관리자 로그인"`, 이메일·비밀번호 입력·로그인 버튼 전부 렌더됨). 즉 앱은 정상이고 **테스트가 로그인을 하지 않고 지나갔다.**

원인은 헬퍼의 판정 방식이다.

```ts
const password = page.locator('input[type="password"]');
if (!(await password.isVisible())) return;   // 재시도 없는 즉시 판정
```

`isVisible()` 은 **기다리지 않는다**. 로그인 화면이 초기 페이로드에 있던 동안에는 `page.goto` 가 끝난 시점에 입력이 이미 DOM 에 있어 우연히 맞았지만, §3.14(Phase 5 번들)가 로그인 화면을 `lazy()` 로 바꾸면서 Suspense 프레임이 생겨 판정 시점에는 아직 입력이 없다.

- 🚨**성능 개선이 검증 경로를 조용히 깼다.** 번들 작업은 프리뷰로 검증됐고 mock e2e 도 전부 통과했다 — mock 스위트는 **로그인을 하지 않기 때문에** 이 경로를 지나가지 않는다. 라이브 DB 검증만 이 분기를 밟는다.
- 🚨**게이트 실패를 20커밋 동안 방치한 것이 더 큰 문제다.** 그동안 승격이 한 번도 되지 않았고, 실패 원인이 "앱 결함"인지 "검증 결함"인지 확인하지 않은 채 리팩토링이 계속 머지됐다. **머지 후 main 게이트 실패는 다음 작업 전에 확인해야 한다** — PR CI 가 green 이어도 main 게이트는 별도다.
- 🔑판정 전에 **화면이 결정될 때까지 기다린 뒤** 분기한다: `password.or(pageTitleBlock)` 이 보일 때까지 대기 → 로그인 폼이면 로그인, 본문이면 이미 인증. 두 spec 에 중복돼 있던 헬퍼(서로 locator 도 달랐다)를 `tests/live-e2e/admin-login.ts` 하나로 모았다.
- 🔑red: 대기 한 줄을 지우면 2 spec 이 즉시 실패한다. 라이브 dev DB 대상으로 실측했다(로컬 재현 → 수리 → 2/2 통과).

### 3.22 릴리스 브라우저 검증이 사람 손에 의존했음 — **해소 (2026-08-21)**

runbook §3(MCP 검증 프로토콜)은 릴리스 담당자가 브라우저를 직접 몰아 7항목을 확인하는 절차였다. 2026-08-21 운영 릴리스에서 실제로 수행해 보고 세 가지 문제를 확인했다.

| 문제 | 결과 |
| --- | --- |
| 범위가 담당자 기억에 달림 | 릴리스마다 확인 화면이 달라진다 |
| 통과 근거가 남지 않음 | 체크리스트에 `pass` 만 남고 무엇을 봤는지는 사라진다 |
| 재현 불가 | 다음 사람이 같은 판단을 다시 할 수 없다 |

`tests/live-e2e/release-browser-verify.pw.ts`(6항목)와 `release-baseline-probe.pw.ts`(`baselineCompared`)로 옮겼다. 설정(`playwright.release-verify.config.ts`)이 대상을 정하므로 **스테이징 프리뷰와 운영 도메인에 같은 계측**을 쓴다 — 그래야 두 단계 결과를 비교할 수 있다. 기본 e2e 스위트는 이 spec 들을 수집하지 않는다(`testDir` 가 `tests/e2e`).

- 🔑**`baselineCompared` 를 측정으로 바꿨다** — 직전 릴리스 SHA 워크트리를 **같은 DB** 로 빌드해 화면별 computed 값(글자 크기 집합·링크색 집합·표 행 수)을 대조한다. 스크린샷 눈대중으로는 1px 변화를 못 본다. 실제로 이번 릴리스에서 `12px`(셸 캡션)·`17px`(핵심 지표 h4)·`18px`(CSV 버튼 라벨) 소멸과 링크색 `#1677ff`→`#0f4da8` 을 숫자로 확인했다.
- 🚨**행 수는 두 대상이 같은 DB 를 볼 때만 비교축이다.** 운영 검증에서 "전"은 dev DB, "후"는 prod DB 라 행 수 차이는 데이터 차이다 — 이번에 `commerce-points` 4→0, `refunds` 3→0 이 경고로 떴고, **운영 DB 를 직접 조회해** 그 표들이 실제로 0행(profiles 209)임을 확인해 회귀가 아님을 가렸다.
- 🚨**한 화면을 한 번만 재면 거짓 변화가 나온다.** dashboard 행 수가 `0 → 4` 로 보였는데 데이터 도착 전을 잡은 것이었다(3라운드 합집합으로는 4=4). 그대로 보고했으면 없는 변화를 릴리스 노트에 적었을 것이다. `PROBE_ROUNDS` 기본값을 3으로 뒀다.
- 🔑**크기별 대표 엘리먼트를 함께 기록한다** — 값 집합만 있으면 "18px 이 사라졌다"에서 멈추고, 그것이 개선인지 회귀인지 알 수 없다. 주인을 남겨야 `CSV 내보내기` 버튼 라벨이었음을 추적할 수 있다.
- 🚨**검증 화면 목록은 spec 안의 `auditedScreens` 다** — 릴리스가 바꾼 화면을 넣는 것이 담당자 몫이고, **목록에 없는 화면은 검사되지 않는다**(§3.19.1 의 감사 목록 사각지대와 같은 함정).

## 4. 모듈별 레지스트리

### 4.1 Dashboard

- 대상 파일: `src/features/dashboard/pages/dashboard-page.tsx`
- 현 상태
  - KPI, 알림, 빠른 링크 대부분이 정적 상수다.
  - 환불 건수만 `useCommerceStore()`를 참조해 일부 데이터 축이 섞여 있다.
- 미확정/누락/오구현
  - 어떤 카드가 실시간 운영 지표인지, 어떤 카드가 정적 안내인지 정책이 확정되지 않았다.
  - `pending / empty / error` 상태가 없다.
  - 카드 클릭 시 연결되어야 할 원본 화면과 필터 프리셋 계약이 없다.
- 분류
  - `미확정`: 카드 책임과 원본 화면 연결
  - `누락`: 네트워크 상태 UX, drill-down 계약

### 4.2 Users

#### 4.2.1 회원 목록

- 대상 파일: `src/features/users/pages/users-page.tsx`
- 현 상태
  - 초기 조회는 `fetchUsersSafe`를 사용한다.
  - `Resolved`(2026-06-17): Supabase 모드의 회원 목록 P0 런타임 실패 원인이던 `get_admin_users`/`admin_set_user_status` RPC 부재를 해소했다. 마이그레이션 `supabase/migrations-admin/20260617210000_admin_users_directory.sql`(+ down)은 `admin_schema_migrations` tracker 기준 2026-06-17 dev DB 적용 완료했다.
  - `get_admin_users(search, sort, page, page_size, affiliation)`는 v13 `profiles`/`auth.users` 조인과 `writing_submissions` 집계 및 `gender`/`phone_masked`를 반환하고, `admin_set_user_status(target_id, new_status)`는 `profiles.status`만 `active`/`blocked`로 토글한다. 신규 테이블은 없고 v13 `profiles` DDL은 변경하지 않는다.
  - `Resolved`(2026-06-26): Admin 노출 `회원 상태`는 `profiles.status` 원천값 단독이 아니라 `get_admin_users.registration_status` 기반 값으로 표시한다. 이메일 미인증은 `인증 대기`, 인증 후 약관 미동의는 `약관 대기`이며, 이메일 미인증 약관 집계는 RPC에서 `none/null`로 정규화한다.
  - `Resolved`(2026-07-09): 회원 목록 성별 컬럼은 `gender`, 전화번호 컬럼은 `phone_masked`만 표시하고, 회원 정보 내보내기는 `admin_export_users` RPC + 사유 필수 + `User + batch:{uuid}` 감사 로그 계약으로 확정했다. 기본 내보내기는 현재 목록 조건 + 전체 컬럼 + 마스킹 전화번호이며, 선택 행 scope와 XLSX 컬럼 선택을 지원한다. 원문 포함 여부와 선택 컬럼 key, 안전한 필터 요약은 감사 payload에 남기되 검색어 원문/성별 값/전화번호 값/파일 내용은 저장하지 않는다.
  - `Resolved`(2026-07-20): prod에는 legacy `profiles.phone`이 없어 Users RPC 3종이 실패하던 환경 드리프트를 `private.admin_profile_phone(to_jsonb(profile_row))`로 해소했다. canonical source는 `phone_country_code` + `phone_number`이고 v13 DDL/DML은 무변경이다. 함께 발견된 감사 로그 저장 Target `User`/UI alias `Users` 혼재는 read RPC projection과 프런트 URL/row 정규화로 복원했다.
- 미확정/누락/오구현
  - `Resolved`(2026-06-17): 정지/해제 조치 결과는 Supabase 모드에서 `admin_set_user_status` RPC를 통해 실제 `profiles.status`에 반영되고, `admin_audit_logs`에 `target_table='User'`, action `user_status_changed`로 기록된다.
  - `미확정`(v13 handoff): v13 사용자 앱의 가입 플로우는 이메일 미인증 `user_consents` 차단, 필수 약관 전 사용자 기능 활성화 차단, dry-run/backfill로 정리해야 한다.
  - 관리자 메모의 저장 주체와 감사 로그 영속 정책이 불명확하다.
  - 조치 사유가 어떤 code table 또는 자유 입력 규칙을 따르는지 확정되지 않았다.
  - 일괄 상태 변경 정책은 아직 확정되지 않았다.
- 분류
  - `Resolved`: 회원 목록 Supabase read/write RPC 라이브 부재(P0 런타임 실패)
  - `미확정`: 메모/사유의 데이터 계약, 일괄 상태 변경 정책, v13 가입 생애주기 원천 계약/백필

#### 4.2.2 강사 관리

- 대상 파일: `src/features/users/pages/instructor-management-page.tsx`
- 현 상태
  - 조회는 서비스 경유, 조치는 로컬 상태 반영이다.
- 미확정/누락/오구현
  - 강사 계정이 Users와 완전히 분리된 엔티티인지, 일부 회원 subtype인지 최종 계약이 코드에서 고정되지 않았다.
  - 정지/복구/메모 조치의 감사 로그 Target Type 세분화가 없다.
- 분류
  - `미확정`: Instructor 엔티티 경계
  - `오구현`: 조치 저장 경계 미일치

#### 4.2.3 추천인 관리

- 대상 파일: `src/features/users/pages/users-referrals-page.tsx`
- 현 상태
  - 조회 후 상태 변경은 로컬 state만 조정한다.
- 미확정/누락/오구현
  - 추천 관계가 정산/리워드와 연결되는지, 단순 조회성인지 정책이 불명확하다.
  - 추천인 조치 후 어떤 감사 로그와 후속 검증 화면으로 이어지는지 없다.
- 분류
  - `미확정`: 추천 보상/정산 정책
  - `누락`: 조치 후 검증 경로

#### 4.2.4 회원 상세

- 대상 파일: `src/features/users/pages/user-detail-page.tsx`
- 현 상태
  - `getMockUserById`와 페이지 내부 정적 배열로 탭 데이터를 구성한다.
- 미확정/누락/오구현
  - 고정 탭 구조는 맞지만 각 탭 데이터의 원본이 모두 페이지 로컬 더미다.
  - 탭별 `pending / empty / error` 상태가 없다.
  - 결제, 커뮤니티, 로그 탭이 실제 각 모듈 SoT와 연결되지 않는다.
- 분류
  - `오구현`: 탭 데이터와 실제 도메인 SoT 단절
  - `누락`: 탭 단위 상태 UX

#### 4.2.5 기관 코드

- 대상 파일: `src/features/users/pages/institution-codes-page.tsx`, `src/features/users/pages/institution-code-create-page.tsx`, `src/features/users/pages/institution-code-detail-page.tsx`, `src/features/users/ui/institution-code-detail/`, `src/features/users/ui/institution-question-exposure-panel.tsx`, `src/features/users/ui/institution-exposure-mode-tag.tsx`
- 미확정/누락/오구현
  - `기관 단위 노출 모드 부재로 "제한 없음"을 전량 배정으로 흉내내야 함` — **[2026-08-01 등재와 동시에 해소]** 기관 할당제에서는 배정 목록이 유일한 스위치라, 어떤 기관 학습자에게 노출 허용 문항 전부를 보이려면 노출 가능 문항을 전량 배정해야 했다(dev 실측: 기관 3곳이 각 700건). 그 결과 ①이후 승격되는 신규 문항이 자동 포함되지 않아 관리자가 매번 재배정해야 하고(무소속 학습자와 노출 범위가 조용히 어긋난다), ②기관을 새로 만들 때마다 같은 우회책을 반복해야 했다. 이 드리프트는 그때까지 어느 문서에도 등재되지 않았다 — 2026-07-30 라벨 축 재정의는 표시 문제만 다뤘다. `topik_writing_institution_exposure_mode`(`제한 없음`/`배정분만`, 기본 `배정분만`)를 도입해 `제한 없음` 기관은 predicate 에서 배정 조건을 건너뛰고 신규 문항을 자동 포함한다. 배정 목록은 모드와 무관하게 보존되며 `배정분만` 복귀 시 그대로 적용된다. 기존 코드 초기값은 규칙 기반 백필(적용 시점 노출 가능 풀 전량이 배정된 기관만 승급)로 정해 **가시 문항 수가 불변**임을 증명했다. 관리자 전환 지점은 `수정` 모달(사유 필수)이며 배정 0건 + 회원 1명 이상으로 `배정분만` 전환은 화면·서버 양쪽에서 차단한다. 신규 코드는 안전 폴백과 같은 `배정분만`으로 시작하고, 코드 삭제 시 모드 원장을 함께 제거한다. 모드 변경과 삭제가 같은 코드 행 잠금을 공유하므로 동시 최초 설정까지 포함해 같은 code 재생성으로 stale `제한 없음`이 되살아나는 경로를 닫았다.
  - `모달 조치형이라 기관 설정을 넓힐 자리가 없음` — **[2026-08-03 해소]** 코드 생성·수정·회원 관리·노출 문항이 목록 화면의 모달 4개에 갇혀 있어 한 화면이 1,463줄로 커지고, 계약 기간·정원 같은 기관 설정을 더 붙일 자리가 없었다. 생성 전용 페이지(`/create`)와 상세 탭 페이지(`/:code?tab=info|members|questions`)로 승격했다. 노출 모드는 배정 현황과 같은 화면에서 판단해야 하므로 `수정`에서 `노출 문항` 탭으로 옮겼고, 그 결과 구 수정 모달의 "모드 먼저 반영 → 실패 시 메타 미변경" 2단계 시퀀싱과 "노출 문항 열기" 탈출 버튼이 함께 사라졌다. 삭제는 행 단위 파괴적 액션이라 목록에 남겼다. 감사 로그의 `?selected=` 딥링크는 그때까지 아무 것도 열지 못하는 죽은 링크였는데 상세 라우트로 살렸다.
  - 잔여 갭: ①전량 배정으로 우회하던 기관 3곳의 stale 배정 정리 시점(`제한 없음` 동안은 무해하나 `배정분만` 복귀 시 의미가 되살아난다), ②`종료` 상태 코드의 모드 해석 — 현재 학습자 predicate 는 `institution_codes.status` 를 아예 보지 않아 종료된 코드의 소속 회원도 계속 문항을 본다(별건), ③기관 계약 기간·계약 히스토리·만료 시 자동 비노출·신규 문항 자동 배정·정원·기관별 초대 유효기간·담당자 정보 — DB 원장 신설이 선행이라 상세 페이지에 `계약` 탭과 회원 정책 섹션이 붙는 형태로 후속 PR 대기.

### 4.3 Community

#### 4.3.1 게시글 관리

- 대상 파일: `src/features/community/pages/community-posts-page.tsx`
- 현 상태
  - 초기 게시글 seed/factory는 `src/features/community/api/mock-community.ts`, 조회/게시/숨김/삭제 facade는 `community-service.ts`, 조치 후 live state는 `community-store.ts`가 담당한다.
  - 페이지는 mock 파일이나 store seed를 직접 import하지 않는다.
- 미확정/누락/오구현
  - 게시글 숨김/노출 정책의 사유 코드와 백엔드 감사 payload 계약이 확정되지 않았다.
  - 신고, 작성자 제재, 콘텐츠 노출 제한의 연계 정책이 분리되지 않았다.
- 분류
  - `미확정`: 게시글 조치 정책
  - `누락`: 신고/작성자 제재 연계 검증 규칙

#### 4.3.2 신고 관리

- 대상 파일: `src/features/community/pages/community-reports-page.tsx`
- 현 상태
  - 초기 신고 seed/factory는 `src/features/community/api/mock-community.ts`, 조회/처리 facade는 `community-service.ts`, 조치 후 live state는 `community-store.ts`가 담당한다.
  - 상세 진입이 `TableRowDetailModal`이다.
- 미확정/누락/오구현
  - 신고 단위 상세 패턴이 전역 `DetailDrawer` 기반 흐름과 다르다.
  - 신고 처리 결과와 게시글/사용자 조치가 어떤 순서로 결합되는지 정책이 고정되지 않았다.
  - 허위 신고, 중복 신고, 자동 종결 규칙이 없다.
- 분류
  - `오구현`: 상세 패턴 불일치
  - `미확정`: 신고 처리 정책

### 4.4 Message

#### 4.4.1 메일/푸시 채널 운영

- 대상 파일
  - `src/features/message/pages/message-channel-page.tsx`
  - `src/features/message/pages/message-mail-page.tsx`
  - `src/features/message/pages/message-push-page.tsx`
- 현 상태
  - 조회는 `fetchChannelSnapshotSafe`
  - 저장/발송/토글/삭제/재시도는 `messages-service.ts` safe facade를 거쳐 `message-store.ts` live state에 반영
  - 초기 그룹/템플릿/이력 seed/factory는 `src/features/message/api/mock-messages.ts`가 담당
- 미확정/누락/오구현
  - 템플릿 원문, 자동 발송 규칙, 발송 이력의 실제 API/DB 책임 경계가 아직 확정되지 않았다.
  - 발송 채널별 정책 차이(예: 실패 재시도, 예약 가능 범위, 수신 거부 반영)가 코드에 명시되지 않았다.
- 분류
  - `미확정`: 실제 API/DB read/write 계약
  - `미확정`: 채널별 운영 정책

#### 4.4.2 발송 대상 그룹

- 대상 파일: `src/features/message/pages/message-groups-page.tsx`
- 현 상태
  - 현재 화면은 존재하고 저장/대상 수 미리보기/재계산/삭제는 `messages-service.ts` facade를 사용하지만, 세그먼트 정의와 실제 사용자 데이터 연결은 mock 스키마 수준이다.
- 미확정/누락/오구현
  - 세그먼트 조건이 실데이터 필드와 1:1로 대응되는지 미확정
  - 그룹 저장 후 실제 발송/미리보기/대상 수 추정 계약이 없다.
- 분류
  - `미확정`: 세그먼트-실데이터 계약
  - `누락`: 그룹 결과 검증 UX

#### 4.4.3 발송 이력

- 대상 파일: `src/features/message/pages/message-history-page.tsx`
- 현 상태
  - 발송 이력 seed/factory는 `api/mock-messages.ts`, 재시도 action은 `messages-service.ts` facade를 사용한다.
  - 이력 재시도 actor는 아직 mock 관리자 값이다.
- 미확정/누락/오구현
  - 실패 건 재시도 범위, 재시도 정책, 중복 발송 방지 기준이 불명확하다.
  - 이력 상세에서 원본 템플릿/대상 그룹/실패 사유의 역추적 경로가 충분히 고정되지 않았다.
- 분류
  - `미확정`: 재시도 정책
  - `오구현`: actor 하드코딩

#### 4.4.4 Notification 레거시 페이지 — **해소 (2026-06-12, 알림 기능 WP2-4)**

- 조치
  - 고아 파일 2개(`notification-send-page.tsx`, `notification-history-page.tsx`) 제거 — import 참조 0건 확인 후 삭제. 알림 운영 기능은 Message 모듈(`/messages/*`, `/messages/in-app` 신설)로 통합 완료.
  - `/notification/send`·`/notification/history` redirect는 **한 릴리즈 유지 후 제거**(O-10 결정 — 내부 admin이므로 IA 일관성 우선). 제거 예정: 다음 릴리즈. route registry E2E가 redirect 동작을 커버한다.
- 분류
  - `해소`: 레거시 정리 완료 (redirect 제거만 후속 1건)

#### 4.4.5 알림 예약 발송 취소 기능 부재 (2026-06-12, QA N-ADM-11)

- 현 상태
  - 예약 발송(dispatch status `scheduled`)을 등록한 뒤 도래 전에 취소하는 UI/RPC가 없다. status enum에 `canceled`는 존재하나 진입 경로가 없다.
- 미확정/누락/오구현
  - `누락`: 예약 취소 액션(이력 화면 scheduled 행 대상) + 취소 RPC + 감사 액션(`notification_dispatch_canceled` 후보).
- 분류
  - `누락`: 기능 후보 — 실행계획안 O-12 후보로 에스컬레이션

#### 4.4.6 0명 그룹 발송 사전 안내 부재 (2026-06-12, QA N-ADM-07)

- 현 상태
  - 정적 멤버 0명 그룹으로 발송을 실행하면 사전 경고 없이 dispatch가 생성되고 recipient 0으로 조용히 `completed` 된다 (집행 사실 실측).
- 미확정/누락/오구현
  - `누락`: 발송 실행 모달에서 선택 그룹 합산 인원 0명일 때 경고/차단.
- 분류
  - `누락`: UI 가드 개선 후보

#### 4.4.7 알림 파이프라인 migration home 혼재 — **해소 (2026-07-23)**

- 조치
  - topik-ai `20260723011242_notification_pipeline_ownership_transfer.sql`을 DB dispatcher/email/marketing/cron의 단일 forward migration home으로 추가했다.
  - v13의 과거 파이프라인 migration 6개와 down 4개를 replay-safe no-op으로 전환하고 정적 경계 검사를 추가했다.
  - 기존 dispatch/attempt/config 데이터는 삭제·재시드하지 않으며, v13 사용자 객체 DDL은 변경하지 않는다.
- 분류
  - `해소`: 알림 구간(`20260612200100`까지) v13 단독 clean replay와 양 repo 통합 shadow replay의 소유권 순서 정합화
  - `검증 차단(저장소 전체)`: v13 전체 standalone reset은 알림 구간 이후 `20260713081559_writing_question_version_snapshot.sql`이 선행 `public.topik_writing_question_import`를 찾지 못해 중단된다. 알림 migration home과 무관한 기존 writing 교차 저장소 의존성이므로 별도 해소 후 전체 reset을 재실행해야 한다.
  - `운영 후속`: dev/production 원격 적용 전 권한·함수 owner·cron·row count 대사 필요(현재 미적용)

### 4.5 Operation

#### 4.5.1 공지사항

- 대상 파일: `src/features/operation/pages/operation-notices-page.tsx`
- 현 상태
  - 2026-06-17 기준 mock-only에서 Supabase-backed hybrid switch로 전환 완료했다.
  - `operation-notices-data-source.ts`가 Supabase 설정과 `VITE_OPERATION_NOTICES_SOURCE`를 판별하고, Supabase 모드는 `operation_notices` + admin RPC 3종(`admin_save_operation_notice`, `admin_toggle_operation_notice_status`, `admin_delete_operation_notice`)을 사용한다.
  - Supabase 미구성, `VITE_SUPABASE_DISABLED=true`, `VITE_OPERATION_NOTICES_SOURCE=mock`은 기존 mock source(`mock-operation.ts` + `operation-store.ts`)로 회귀한다.
  - 마이그레이션 `supabase/migrations-admin/20260617120000_operation_notices.sql`(+ down)은 `admin_schema_migrations` tracker 기준 2026-06-17 dev DB 적용 완료했다.
- 해소된 항목
  - `Resolved`(2026-06-17): 공지사항 mock-only SoT. 조회/저장/상태 변경/삭제가 Supabase-backed 경로를 가지며 mock은 fallback으로 축소됐다.
  - `Resolved`(2026-06-17): 공지 조치 감사 로그 미적재. admin RPC가 `admin_audit_logs`에 `target_table='OperationNotice'`, `target_id=noticeId`, action `notice_saved`/`notice_status_changed`/`notice_deleted`를 기록한다.
  - `Resolved`(2026-06-17): 게시/숨김·삭제 reason 미전달. admin RPC 3종은 reason 필수이며 화면 확인 단계 또는 서비스 경계에서 사유를 전달한다.
- 미확정/누락/오구현
  - 공지의 게시 범위, 상단 고정, 예약 게시, 노출 surface(B2C 앱/웹/센터)별 정책 세분화가 충분히 고정되지 않았다.
  - 에디터 콘텐츠 sanitize/preview 정책이 문서까지 완전히 닫히지 않았다.
  - 자연키 `NOTICE-NNN`은 첫 증분에서 기존 mock/seed와 호환되도록 유지했으나, 동시 생성 race를 막는 장기 채번 방식(sequence/table 등)은 별도 확정이 필요하다.
  - `updated_by`는 호출자 uuid 저장이며 관리자 표시명 매핑 정책이 미확정이다.
- 분류
  - `해소`: mock-only source 경계, 공지 감사 Target Type 세분화, reason 전달 경계
  - `미확정`: 게시 정책 세분화, B2C surface, 채번/수정자 표시 정합

#### 4.5.2 FAQ

- 대상 파일: `src/features/operation/pages/operation-faq-page.tsx`
- 현 상태
  - 2026-06-17 기준 mock-only에서 Supabase-backed hybrid switch로 전환 완료했다.
  - 원문/노출/지표 3탭 구조가 존재하며, Supabase 모드는 `operation_faqs`, `operation_faq_curations`, `operation_faq_metrics`를 조회한다.
  - `operation-faqs-data-source.ts`가 Supabase 설정과 `VITE_OPERATION_FAQS_SOURCE`를 판별하고, Supabase 모드는 `operation_faqs`/`operation_faq_curations` + admin RPC 5종(`admin_save_operation_faq`, `admin_toggle_operation_faq_status`, `admin_delete_operation_faq`, `admin_save_operation_faq_curation`, `admin_delete_operation_faq_curation`)을 사용한다.
  - Supabase 미구성, `VITE_SUPABASE_DISABLED=true`, `VITE_OPERATION_FAQS_SOURCE=mock`은 기존 mock source(`mock-operation.ts` + `operation-store.ts`)로 회귀한다.
  - 마이그레이션 `supabase/migrations-admin/20260617123000_operation_faqs.sql`(+ down)은 `admin_schema_migrations` tracker 기준 2026-06-17 dev DB 적용 완료했다.
- 해소된 항목
  - `Resolved`(2026-06-17): FAQ mock-only SoT. FAQ 원문/노출/지표 조회와 원문/노출 조치가 Supabase-backed 경로를 가지며 mock은 fallback으로 축소됐다.
  - `Resolved`(2026-06-17): FAQ 조치 감사 로그 미적재. admin RPC가 `admin_audit_logs`에 FAQ 원문 `target_table='OperationFaq'`, `target_id=faqId`, action `faq_saved`/`faq_status_changed`/`faq_deleted`; 큐레이션 `target_table='OperationFaqCuration'`, `target_id=curationId`, action `faq_curation_saved`/`faq_curation_deleted`를 기록한다.
  - `Resolved`(2026-06-17): FAQ 원문/노출 reason 미전달. admin RPC 5종은 reason 필수이며 화면 확인 단계 또는 서비스 경계에서 사유를 전달한다.
- 미확정/누락/오구현
  - 자연키 `FAQ-NNN`/`FAQCUR-NNN`은 기존 mock/seed와 호환되도록 유지했으나, 동시 생성 race를 막는 장기 채번 방식(sequence/table 등)은 별도 확정이 필요하다.
  - `updated_by`는 호출자 uuid 저장이며 관리자 표시명 매핑 정책이 미확정이다.
  - `operation_faq_metrics`는 현재 seed/read 전용이며 조회/검색/도움됨 실집계 파이프라인이 미확정이다.
- 분류
  - `해소`: mock-only source 경계, FAQ/FAQ Curation 감사 Target Type 세분화, reason 전달 경계
  - `미확정`: 채번/수정자 표시 정합, metrics 실집계 파이프라인

#### 4.5.3 이벤트

- 대상 파일
  - `src/features/operation/pages/operation-events-page.tsx`
  - `src/features/operation/pages/operation-event-create-page.tsx`
  - `src/features/operation/api/events-service.ts`
  - `src/features/operation/model/operation-store.ts`
- 현 상태
  - 2026-06-17 기준 mock-only에서 Supabase-backed hybrid switch로 전환 완료했다.
  - 목록/상세/등록 상세는 존재한다.
  - `operation-events-data-source.ts`가 Supabase 설정과 `VITE_OPERATION_EVENTS_SOURCE`를 판별하고, Supabase 모드는 `operation_events` + admin RPC 4종(`admin_save_operation_event`, `admin_schedule_operation_event`, `admin_publish_operation_event`, `admin_end_operation_event`)을 사용한다.
  - Supabase 미구성, `VITE_SUPABASE_DISABLED=true`, `VITE_OPERATION_EVENTS_SOURCE=mock`은 기존 mock source(`mock-operation.ts` + `operation-store.ts`)로 회귀한다.
  - 마이그레이션 `supabase/migrations-admin/20260617152000_operation_events.sql`(+ down)은 `admin_schema_migrations` tracker 기준 2026-06-17 dev DB 적용 완료했다.
  - 이벤트 등록 상세의 메시지 그룹/템플릿 선택지는 Message store 직접 참조가 아니라 `messages-service.ts` option DTO를 통해 받는다.
- 해소된 항목
  - `Resolved`(2026-06-17): 이벤트 mock-only SoT. 조회/저장/예약/게시/종료가 Supabase-backed 경로를 가지며 mock은 fallback으로 축소됐다.
  - `Resolved`(2026-06-17): 이벤트 조치 감사 로그 미적재. admin RPC가 `admin_audit_logs`에 `target_table='OperationEvent'`, `target_id=eventId`, action `event_saved`/`event_scheduled`/`event_published`/`event_ended`를 기록한다.
  - `Resolved`(2026-06-17): 이벤트 조치 reason 미전달. admin RPC 4종은 reason 필수이며 화면 확인 단계 또는 서비스 경계에서 사유를 전달한다.
  - `Resolved`(2026-06-17): 배너 파일 업로드 화면 state/data URL only. Supabase 모드는 `banner_images` jsonb 배열과 `banner_image_source_type`(`file`/`url`)을 저장하고 대표 배너 파생 필드를 보존한다.
- 미확정/누락/오구현
  - 자연키 `EVT-NNN`은 기존 mock/seed와 호환되도록 유지했으나, 동시 생성 race를 막는 장기 채번 방식(sequence/table 등)은 별도 확정이 필요하다.
  - `updated_by`는 호출자 uuid 저장이며 관리자 표시명 매핑 정책이 미확정이다.
  - `rewardPolicyId`, 메시지 템플릿, 대상 그룹 참조는 외부 FK 없이 denormalized snapshot으로 저장되며, 실제 정규화/FK 전환 시점이 미확정이다.
  - 참여 현황, 리워드 지급, 발송 템플릿의 후속 운영 플로우가 아직 닫히지 않았다.
  - `participant_count` 집계 source와 갱신 주기가 미확정이다.
  - 배너 이미지는 jsonb 배열로 영속되지만 asset 저장소/서버 업로드 정규화는 후속이다.
- 분류
  - `해소`: mock-only source 경계, 이벤트 감사 Target Type 세분화, reason 전달 경계, 배너 data URL only 저장 갭
  - `미확정`: 채번/수정자 표시 정합, 참조 대상 정규화, 참여/지급/발송 후속 플로우, 참여자 수 집계 source

#### 4.5.4 정책 관리

- 대상 파일
  - `src/features/operation/pages/operation-policies-page.tsx`
  - `src/features/operation/pages/operation-policy-create-page.tsx`
  - `src/features/operation/api/policies-service.ts`
  - `src/features/operation/model/policy-store.ts`
- 현 상태
  - 목록/상세 Drawer/본문 미리보기/등록 상세/TinyMCE 본문 작성까지 구현되었다.
  - 법률 문서뿐 아니라 커뮤니티 게시글 제재, 추천인 보상, 포인트/쿠폰/이벤트/FAQ/챗봇/메시지/권한 변경 정책까지 `운영 영역`, `정책 추적 상태`, `연관 관리자 화면`, `추적 근거 문서` 기준으로 같은 카탈로그에서 추적한다.
  - 2026-06-17 기준 mock-only에서 Supabase-backed hybrid switch로 전환 완료했다.
  - `operation_policies`/`operation_policy_histories`와 admin RPC 4종은 `admin_schema_migrations` tracker 기준 2026-06-17 dev DB 적용 완료했다.
  - Supabase 미구성, `VITE_SUPABASE_DISABLED=true`, `VITE_OPERATION_POLICIES_SOURCE=mock`은 기존 mock source(`mock-operation-policies.ts` + `policy-store.ts`)로 회귀한다.
  - `policies-service.ts` safe facade 7종은 유지하며, 저장/상태 변경/삭제/히스토리 버전 게시 RPC는 reason 필수로 `admin_audit_logs`와 `operation_policy_histories` snapshot을 함께 기록한다.
  - `docs/specs/admin-policy-source-map.md`를 기준으로 코드/문서 근거를 정책 관리 seed/UI와 함께 유지한다.
- 미확정/누락/오구현
  - `Resolved`(2026-06-17): 정책 관리 mock-only SoT. 조회/저장/상태 변경/삭제/히스토리 버전 게시가 Supabase-backed 경로를 가지며 mock은 fallback으로 축소됐다.
  - `Resolved`(2026-06-17): 정책 조치 감사 로그 미적재. admin RPC가 `admin_audit_logs`에 `target_table='OperationPolicy'`, `target_id=policyId`, action `policy_saved`/`policy_status_changed`/`policy_deleted`/`policy_version_published`를 기록하고 histories snapshot을 append한다.
  - `Resolved`(2026-06-17): actor 하드코딩. `CURRENT_ACTOR` 대신 RPC caller 기반 `changed_by`/`updated_by` 기록으로 정합했다.
  - 버전 모델은 `current_version_id`를 도입했으나, 화면 모델의 장기 표현과 히스토리 헤드 정합은 계속 추적한다.
  - `POL-NNN`/`PH-NNNN` max+1 채번 동시성, `changed_by`/`updated_by` uuid 표시명, `requires_consent` 기반 B2C 동의 재수집 트리거는 미확정이다.
  - 정책 버전별 diff 검수, 재동의 대상 추적, 문서 승인 체계는 아직 완전히 닫히지 않았다.
  - TinyMCE 이미지/자산 업로드의 서버 영속 경로와 sanitize 정책이 아직 고정되지 않았다.
  - cross-page 정책 근거 매핑은 현재 문자열 배열과 MD SoT 조합으로 관리되며, 실데이터/API 단계에서 참조형 엔티티로 승격할지 여부는 아직 미확정이다.
- 분류
  - `해소`: mock-only source 경계, 정책 감사 Target Type 세분화, actor 하드코딩
  - `미확정`: 채번 동시성, uuid 표시명, current_version_id 장기 모델, 재동의/승인 정책, 근거 매핑의 엔티티화 범위
  - `누락`: 에디터 자산 영속 경로

#### 4.5.5 챗봇

- 대상 파일: `src/app/router/routes.ts`
- 현 상태
  - Placeholder만 존재
- 미확정/누락/오구현
  - 관리자 페이지 목적이 FAQ 관리형인지, 프롬프트/지식베이스 운영형인지, 대화 로그 모니터링형인지 전혀 확정되지 않았다.
- 분류
  - `미확정 + 누락`

### 4.6 Commerce

#### 4.6.1 결제 내역

- 대상 파일
  - `src/features/billing/pages/billing-payments-page.tsx`
  - `src/features/billing/model/commerce-store.ts`
- 현 상태
  - 초기 결제 seed/factory는 `src/features/billing/api/mock-billing.ts`, 조회 facade는 `billing-service.ts`, 조치 후 live state는 `commerce-store.ts`가 담당한다.
  - 페이지는 zustand mock store를 직접 읽지 않는다.
- 미확정/누락/오구현
  - 외부 PG 응답, 내부 주문, 사용자 결제 화면 중 어떤 것이 SoT인지 확정되지 않았다.
  - `pending / empty / error` 상태가 없다.
- 분류
  - `미확정`: 결제 원본 데이터 소스
  - `누락`: 상태 UX

#### 4.6.2 환불 관리

- 대상 파일
  - `src/features/billing/pages/billing-refunds-page.tsx`
  - `src/features/billing/model/commerce-store.ts`
- 현 상태
  - 초기 환불 seed/factory는 `src/features/billing/api/mock-billing.ts`, 환불 승인/반려 facade는 `billing-service.ts`, 조치 후 live state는 `commerce-store.ts`가 담당한다.
  - 환불 조치자 `admin_park`는 아직 mock 관리자 값이다.
- 미확정/누락/오구현
  - 부분 환불, 중복 환불 방지, PG 환불 결과 동기화 정책이 없다.
  - 환불 사유와 승인 근거가 code table인지 자유 입력인지 고정되지 않았다.
- 분류
  - `오구현`: actor 하드코딩
  - `미확정`: 환불 정책/계약

#### 4.6.3 쿠폰/포인트/스토어

- 대상 파일
  - `src/app/router/routes.ts`
  - `src/features/commerce/pages/commerce-coupons-page.tsx`
  - `src/features/commerce/pages/commerce-coupon-create-page.tsx`
  - `src/features/commerce/pages/commerce-coupon-template-create-page.tsx`
  - `src/features/commerce/api/coupons-service.ts`
  - `src/features/commerce/model/coupon-store.ts`
- 현 상태
  - 쿠폰은 목록, 상세 Drawer, 생성/수정 페이지, 정기 쿠폰 템플릿 관리까지 구현 완료
  - 포인트는 `정책 / 포인트 원장 / 소멸 예정` 3탭 목록형 페이지, 상세 Drawer, 수동 조정/정책 편집/소멸 보류 modal, 감사 로그 링크까지 mock service 기준으로 구현 완료
  - 스토어는 Placeholder
- 미확정/누락/오구현
  - 쿠폰
    - 실제 API/DB/CRM 연동 없이 local store와 mock service 기준으로 동작한다.
    - 초기 쿠폰/정기 쿠폰 템플릿 seed/factory는 `src/features/commerce/api/mock-coupons.ts`, 조치 후 live state는 `coupon-store.ts`, 조회/조치 facade는 `coupons-service.ts`가 담당한다.
    - Free/Pro 플랜 제한, 메시지 템플릿 검수 상태, 회원 그룹/회원 검색, 쿠폰 사용 내역은 실데이터 연동이 아닌 mock 규칙에 머물러 있다.
    - `정기 쿠폰 템플릿`의 저장/수정/발행 중지/재개/삭제는 구현되었지만, 참조 데이터(`쇼핑 등급`, `카테고리`, `상품`)는 아직 mock code table candidate 기준이다.
    - 아임웹 기준의 `적용 제외 상품`, 알림 preview, 시간 단위 제어는 실엔티티 검색/선택 UI, 메시지 템플릿 실연동, API 계약이 확정되지 않아 mock 단계 구현에 머물러 있다.
  - 포인트
    - 초기 정책/원장/소멸 예정 seed/factory는 `src/features/commerce/api/mock-points.ts`, 조회/수동 조정/정책 저장/소멸 보류 facade는 `points-service.ts`가 담당한다.
    - 포인트 적립 원천 분류(`추천`, `미션`, `이벤트`, `결제`, `환불`, `관리자`, `시스템`)와 실제 원장 단위 SoT는 API/DB 계약상 확정되지 않았다.
    - 차감/회수 우선순위, 음수 잔액 허용 여부, 수동 조정 승인 체계가 미확정이다.
    - 소멸 예정/보류/복구 정책과 사전 안내 연결 규칙이 미확정이다.
    - 현재 구현은 feature mock seed/service와 URL query store 기준이라 실제 사용자 포인트 잔액, 주문/환불 원장, 메시지 발송 이력과 아직 연결되지 않았다.
    - `정책 등록/수정`은 현재 Modal 기반인데, 공통 UX 문서상 작성/편집 맥락이 강한 화면은 전용 편집 페이지 또는 별도 편집 영역을 우선한다. 포인트 정책 편집도 메타데이터 중심 전용 화면으로 승격할지 후속 결정이 필요하다.
  - 스토어
    - 스토어 상품/재고/노출 정책이 코드상 전혀 고정되지 않았다.
- 분류
  - 쿠폰: `미확정`
  - 포인트: `미확정`
  - 스토어: `미확정 + 누락`

### 4.7 Assessment

- 대상 파일: `src/features/assessment/pages/assessment-question-bank-page.tsx`, `src/features/assessment/pages/assessment-question-detail-page.tsx`(구 `assessment-question-review-page.tsx` — 재정의 P3 개명), `src/features/assessment/pages/assessment-question-manage-page.tsx`, `src/features/assessment/api/assessment-question-bank-service.ts`, `src/features/assessment/api/topik-writing-question-bank-service.ts`, `src/features/assessment/api/question-bank-data-source.ts`, `src/app/router/routes.ts`
- 현 상태
  - 현재 `/assessment/question-bank`는 문항/가져온 문항 route-backed 탭의 통합 화면이다. Supabase 구성 시 번호별 `topik_writing_51~54_questions`와 추천 뷰만 읽고, 구 `problems` adapter와 env legacy rollback은 2026-07-14 삭제했다. 미구성 환경은 결정적 mock만 사용한다.
  - 검수 페이지는 `reviewStatus 요약 카드+필터 -> 목록 -> 2depth 검수 페이지(/assessment/question-bank/review/:questionId)`와 `검수 메모 입력 -> 검수 완료 / 수정 필요 / 보류` 흐름을 유지한다. `tab` 쿼리는 제거되고 각 라우트가 자체 URL 상태(공통 `questionNo`/`domain`/`questionType`/`difficulty`/`keyword`, 검수 전용 `reviewStatus`, 관리 전용 `operationStatus`)를 복원한다. ※ 2026-06-11 인바운드 전환에 따라 이 검수 표면은 재정의 P3 코드 컷오버(`202f905`)에서 제거 완료됐으며, 현 단락은 역사 기록이다.
  - `EPS TOPIK`, `레벨 테스트`는 아직 Placeholder
- 미확정/누락/오구현
  - `TOPIK 쓰기 문제 검수` — **[2026-06-11 인바운드 전환으로 블록 전체 폐기/대체]** 검수 개념이 admin에서 전면 삭제돼(결정 기록 §0) 아래 갭들은 트랙 소멸로 닫혔다. 잔여 실작업은 후술 신규 갭 ②(검수 표면·컬럼 제거 미구현)로 승계된다.
    - **[대체]** 검수 상태와 운영 상태는 분리 구현됐다. 사용자 공개/숨김 통제 책임은 운영정책 `POL-017`로 통합 문항 페이지(`/assessment/question-bank`)에 확정되었으나, 구판 POL-017의 "배포 승인 체계" 미확정은 push 트랙 폐기로 소멸했다. POL-017은 "TOPIK 쓰기 문항 수신·관리 운영정책"으로 재정의됐고, 노출 통제는 `service_status` 축(write 활성화는 재정의 P4)으로 일원화됐다. 2026-06-26 기관 노출 정합화 당시에는 최종 노출 predicate를 `service_status='available' AND (기관 매핑 없음 OR profiles.affiliation_code 매핑 존재)`로 문서화했으나, 그 잠금 모델은 구현된 적이 없다. 2026-07-30 dev 실측·오너 결정으로 확정된 계약은 기관 할당제이고, 2026-08-01 기관 단위 노출 모드를 더해 `service_status='available' AND (profiles.affiliation_code 없음 OR 기관 노출 모드 = 제한 없음 OR 매핑.institution_code = profiles.affiliation_code)`가 됐다.
    - **[폐기]** ~~문제 번호별 review field profile schema를 별도 계약으로 승격할 필요~~ — 검수 표면 자체가 제거 대상이라 승격 트랙 소멸. (현재 검수 상세가 sentinel/빈 이력로 표시되는 것은 코드 사실로 유효 — 신규 갭 ②에서 화면 제거/재구성으로 해소)
    - **[폐기]** ~~`검수 완료` 문항 배포(관리자 → 상류 `TalkPik AI Service` API 업로드 → Writing 작문 과제 `GET /api/writing/tasks`)와 상류 업로드/upsert 엔드포인트·배포 트리거 미확정~~ — 상류 push(업로드/배포) 트랙 자체가 2026-06-11 폐기됐다. Writing API는 v13 사용자 노출용이며, admin 통합 방향은 인바운드 수신(공급 API 신설 요청 중 — 미개발, 신규 갭 ①)이다.
    - **[폐기]** ~~`수정 히스토리` 빈 이력, 필드별 diff·버전 간 비교 뷰 부재~~ — 검수 상세 표면 제거 대상에 흡수(신규 갭 ②).
    - **[폐기]** ~~AI 재생성, 배치 재시도, 프롬프트 버전 비교, 검수 히스토리 diff~~ — admin은 문항을 저작·생성·검수하지 않는다(인바운드 모델). 트랙 소멸.
    - **[대체]** 1차 사용자 노출 경로의 구판 서술(POL-017 구판: 상류 Writing API 배포)은 폐기됐다. v13 사용자 기능은 Supabase 적재분을 read-only로 소비하며, EPS TOPIK / 레벨 테스트 세트 편성 화면의 문항 소비 계약(태그·`service_status` 기준)은 여전히 후속 구현이 필요하다.
    - **[폐기]** ~~배치별 대량 검수 액션과 후속 내보내기/배포 액션의 관리자 SoT 연결~~ — 검수 액션·배포 액션 모두 폐기(감사 액션 개정: 검수 4종·`question_published` 폐기).
  - `기관 노출 라벨 축이 학습자 규칙과 어긋남` — **[2026-07-30 해소]** 셀 라벨 `미배정`/`기관 N곳 배정`, 액션명 `기관 배정`/`배정 해제`로 재정의하고 모달 규칙 Alert·배정 0건 경고문을 신설했다(하단 최근 해소 이력 참조). 아래는 해소 전 기록이다. **[구]** 관리자 라벨 `전체 공개`(미매핑) / `기관 한정`(매핑)은 전용 잠금 모델 어휘인데, 확정된 학습자 규칙은 기관 할당제다. 실제로는 `전체 공개` 문항이 기관 소속 학습자에게는 **보이지 않고**, `기관 한정` 문항도 무소속 학습자에게는 **계속 보인다** — 라벨이 두 방향 모두 반대로 읽힌다. `미배정` / `기관 N곳 배정` 계열 재정의안이 있으나 `docs/specs/admin-page-tables.md`의 라벨 계약 + 액션명(`기관 한정 지정`/`기관 한정 해제`) + UI 문자열 + `tests/e2e/institution-question-exposure.spec.ts` 정확 매칭이 함께 묶여 있어 별건으로 남겼다. 또한 `Users > 기관 코드` 노출 문항 모달의 우측 빈 상태(`노출로 선택된 문항이 없습니다.`)는 할당제에서 "이 기관 소속 학습자에게 쓰기 문항이 하나도 보이지 않는다"는 강한 결과를 뜻하는데 그 사실을 말하지 않는다. DB 계약·predicate 는 이미 정합화됐다(`supabase/migrations/20260730120000_topik_writing_institution_exposure_contract_correction.sql`).
  - `TOPIK 쓰기 문항 관리`
    - 운영 상태 조치(`노출 후보` / `숨김 후보` / `운영 제외`)는 현재 비활성(스캐폴딩) 상태다. 페이지 상단 `운영 상태 관리는 준비 중입니다` 경고 Alert와 disabled 운영 조치 버튼만 노출되고, `operationStatus`는 모든 문항에서 `미지정` sentinel로만 표시된다. ※ 본 단락은 역사 기록 — 하단 [2026-06-11 P4 갱신] 참조.
    - 확인+사유 -> 감사 로그 흐름(`ConfirmAction` + `AuditLogLink`)은 코드에 미리 연결되어 있다. 주의(실측 2026-06-10): 코드가 참조하는 구 `admin_update_problem` RPC는 v13 admin island 제거(2026-06-09)로 라이브 DB에 존재하지 않아 구 경로 활성화는 불가능하다.
    - 해소 경로(D-6 확정, 2026-06-10): v13 `lifecycle_status` 대기는 폐기됐다. 신규 스키마 `service_status` 축으로 재정의 P3(표시 전환)·재정의 P4(`OPERATION_WRITE_ENABLED` 게이트 제거 + `admin_update_topik_question` write 개방 — 쓰기 계약은 태그+`service_status`로 한정, 2026-06-11 §0)에서 해소한다.
    - **[2026-06-11 P4 갱신 — write 게이트 해소 완료, 2026-06-12 태그 별도 입력 제거 보강]**: P4 관리 포인트 개방으로 `OPERATION_WRITE_ENABLED`/`SERVICE_STATUS_WRITE_ENABLED` 게이트·"준비 중" Alert 제거, `노출 가능`/`노출 제외`/`내부 테스트` 조치(`admin_update_topik_question`)와 태그 부여/제거 모달(`admin_assign_question_tag`/`admin_remove_question_tag`) 활성. 태그 부여/제거용 별도 입력은 2026-06-12 계약에서 제거했고, 태그 이력과 `tag_assigned`/`tag_removed` 감사 액션으로 추적한다. POL-018 ②(운영주의 태그 활성 `available` 전환 경고)·③(반복방지 활성 과다 `excluded` 권고) 화면 가드 구현. RT-4 관리 쓰기 왕복(화면→DB→화면→감사 4행)·RLS 직접 write 차단 네거티브 검증 — 증적: `logs/metadata-tag-schema-transition-evidence.md` P4 절. 잔여: 감사 로그 **화면**의 실 `admin_audit_logs` 연동(§4.10.2 기지 갭 — 역추적은 DB 단으로 검증).
  - `메타데이터·태그 스키마 전환` (검수/관리 공통) — **2026-06-10 Phase 0 결정 해소**
    - 콘텐츠팀 권장 스키마(`docs/metadata-tag-schema-rule.md` v0.8) 채택·전면 전환이 2026-06-10 오너 지시로 확정됐고, Phase 0 결정 13건(D-1~D-13)이 전부 확정됐다(`docs/architecture/metadata-tag-schema-transition-decision-record.md`). 소유권은 "신규 `topik_writing_*` 오브젝트=이 repo 소유, 호스트=talkpik-dev 공유"로 택일됐고(D-1, v13 오너의 2026-06-09 admin island 제거 결정이 경계 근거), 주제 축 재분류(D-3)·채번(D-4)·역분해(D-5)·`service_status` 정합(D-6)·감사 계약(D-8)·52/53/54 실재(D-9 쿼리 확정)도 해소됐다. ※ 2026-06-11 §0 인바운드 전환으로 D-2·D-7·편차 E1 철회, D-3 트랙 폐기, D-8·D-10·D-11 재정의 — 후술 2026-06-11 기록 참조.
    - 잔여 갭은 "결정 대기"가 아니라 "실행 대기"다: P1(스키마)~P6(상류 연동)는 실행 계획안 §12.3 채점 게이트(직전 페이즈 PASS)에 따라 순차 실행한다. 진행 실적(2026-06-10): P1 PASS(마이그레이션 12파일 프로덕션 적용), **P2 백필 적재 완료**(466행 + 보류 4행, 검증·idempotency·델타 리허설 ALL PASS, 전 행 `service_status='internal_test'`) — 종합 CONDITIONAL(P2-5 콘텐츠팀 샘플 승인 대기). 외부 잔여: D-11 상류 엔드포인트 요청서·콘텐츠팀 발주서 발신(`docs/requests/`). → **[2026-06-11 갱신]** P2-5 승인 게이트·콘텐츠팀 발주서는 인바운드 전환으로 **폐기**(트랙 소멸 — 466행은 초기 코퍼스로 확정), D-11은 "문항 공급(인바운드) API 계약 요청"으로 재작성, 페이즈 구성은 실행계획안 2026-06-11 개정 기준으로 재정의됐다(구 P6 상류 push 폐기).
    - 백필 원천 데이터 품질 메모(P2 표본 적대 감사 실측, 2026-06-10 — 분류 오류 아님): 구 `problems`의 title/hints가 본문과 전혀 다른 시나리오로 오염된 행 3건 — `0027601f`(힌트 '전통 음악 공연 추천' vs 본문 수강 신청), `7a6857b3`(title '회의 일정 변경 요청' vs 본문 도서관 공지), `aae581e2`(힌트 '컴퓨터실 임시 등록' vs 본문 주차 등록). 신규 스키마 분류·rationale은 본문 기준이라 적재 무영향이나, title을 그대로 표시하는 구 problems 기반 화면에서는 혼동 소지가 있다. → **[2026-06-11 갱신]** 콘텐츠팀 회신 트랙 폐기 — 해당 3건은 인터림 코퍼스 참고 기록으로만 유지(구 `problems` 기반 화면은 재정의 P3 컷오버로 해소).
    - 콘텐츠 메타(~45컬럼) 입력/저작 UI는 비범위로 확정(D-10, 2026-06-11 재정의에서도 원칙 유지 — 메타데이터는 외부 공급) — 갭 아님.
  - `2026-06-11 인바운드 모델 전환` (오너 결정 — 결정 기록 `docs/architecture/metadata-tag-schema-transition-decision-record.md` §0, 실행계획안 2026-06-11 개정)
    - 전환 결정: 문제 발원 = 외부(공급) API — 문제 본문+메타데이터(schema-rule §4 + §7, §7.9·검수 필드 제외)가 **완성 상태로 공급**된다. admin은 문항을 저작·생성·분류·검수하지 않으며, admin 역할 = ①수신·적재(외부 상세 API → 인박스 → Supabase `topik_writing_51/52/53/54_questions`) ②관리 포인트=태그(부여/제거) ③노출 통제=`service_status`(기본 `internal_test`)다. v13은 read-only 소비.
    - 검수 개념 전면 삭제: `review_status`·`review_workflow_status`(편차 E1 철회)·`review_passed`·`validation_result` 필드와 검수 화면·검수 쓰기·검수 감사 액션 4종·검수 메모를 admin 표면·스키마·계약·정책에서 제거한다(컬럼 물리 제거는 재정의 P3 마이그레이션). 품질·상태 표현은 태그로만 한다. 상류 push(업로드/배포) 트랙·`question_published`도 폐기. POL-017은 "TOPIK 쓰기 문항 수신·관리 운영정책"으로 재정의, POL-018은 검수 결합 기준 ① 삭제·운영주의 태그 활성 시 `available` 전환 사유 필수·반복과다 `excluded` 권고 유지로 개정.
    - 소멸·해소로 닫힌 기존 갭: ①검수 메모 영구화(구 D-7 — UI-local 가짜 저장 문제는 개념 삭제로 소멸, 2026-06-12에 태그 부여/제거용 운영 메모 필드도 제거) ②P2-5 콘텐츠팀 샘플 승인 대기 ③상류 업로드/upsert 엔드포인트·배포 트리거 미확정 ④문제 번호별 review field profile schema 승격 ⑤배포 승인 체계 — 전부 트랙 소멸로 폐기 처리(상단 `TOPIK 쓰기 문제 검수` 블록 마킹 참조).
    - **신규 갭 ① — 외부 공급 수신 경로**: 종전에는 공급 API 미개발로 차단됐으나, 2026-06-23 상세 API 타입별 페이지네이션 → 무손실 인박스 적재 → 자동 승격 → `question_received` 감사 결선까지 구현됐다. → **[2026-07-13 런타임 갭 해소]** 배포 함수가 확장자 없는 ESM import 때문에 시작 전 `ERR_MODULE_NOT_FOUND`로 500을 반환하던 결함을 매퍼의 `/api` 밖 이동 + `.js` specifier + Node ESM 시작 회귀 테스트로 해소했다. 분류: `해소`(운영 반영은 변경 배포 후 production 시작 프로브로 확인).
    - **신규 갭 ② — 검수 표면·컬럼 제거(재정의 P3)**: 검수 화면(`/assessment/question-bank`의 검수 흐름·요약 카드·`reviewStatus` 필터, `/assessment/question-bank/review/:questionId` 상세)과 검수 감사 액션 분기가 코드에 잔존해 새 모델(검수 없음)과 어긋났던 갭. → **[2026-06-11 갱신 — 코드 측 해소 완료]** 재정의 P3 코드 컷오버(`202f905`)로 화면 재구성(question-bank=문항 목록(조회), manage=문항 관리(관리 포인트)), 상세 라우트 `/assessment/question-bank/:questionId` 개명, 검수 표면 전면 제거, 스위치 기본값 `topik_writing` 플립이 완료됐다. → **[2026-06-11 재갱신 — 갭 종결]** 검수 4컬럼(`review_status`/`review_workflow_status`/`review_passed`/`validation_result`) 물리 제거 마이그레이션 `0013`도 적용 완료(스냅샷 4테이블 검수 컬럼 0건·뷰 16컬럼·RPC 검수 참조 0건 — 증적 로그 P3 재채점 절, §12.4 P3 = PASS). 분류: `해소`.
    - **P5-1 마스터 조회 surface(2026-06-11 구현)**: 주제/태그 마스터(`topik_writing_topic_master`/`topik_writing_tag_master`) 전수(비활성 포함)를 `/system/metadata`의 `TOPIK 쓰기 마스터 데이터 (읽기 전용)` 섹션에서 조회한다(`src/features/assessment/ui/master-catalog-section.tsx` + facade 카탈로그 로더). 신규 라우트 없음 — P5-2 라우트 동기화는 해당 없음. 추천키/반복방지키 JSONB는 문항 상세 조회로 유지(D-10 비범위).
    - **신규 갭 ③ — tag_master 활성/비활성 write 미개방(P5-3 권장)**: 현행 감사 RPC는 문항용 3종뿐이라 tag_master write에는 전용 RPC 신설(마이그레이션)·platform_admin 가드·신규 Target Type(`admin_audit_logs`)·감사 라벨 결정이 필요했다. → **[2026-06-11 같은 날 해소]** 마이그레이션 0014(`admin_update_tag_master_status` — platform_admin 가드·사유 RPC 단 필수) 적용 + 카탈로그 태그 탭 토글 UI(ConfirmAction 사유 필수) + 신규 감사 계약(`AssessmentTagMaster`/`tag_master_status_changed` — 라벨·딥링크 포함) 결선. 동작 확인 프로브 14단계 ALL PASS(가드 3방향 거부 + platform_admin 화면 왕복 + 감사 2행 역추적 + 원복 — `.omx/evidence/p5-3-tag-master-write-report.json`). 분류: `해소`.
    - **신규 갭 ④ — v13 canonical 직접 읽기 이전 단계 증거(2026-07-13~14)**: generated `learner_problem_id`, `canonical_import_id`/`payload_hash`, 번호별 정식 테이블 learner-safe projection을 대상으로 역할별 권한, 700↔700 shadow, 활성 초안 36건 reconciliation, current-content·history/PDF live E2E, Cron 해제·재등록 훈련을 완료했다. 이 결과는 최종 mirror 제거 전 데이터 대사와 회귀 증거이며, legacy/shadow/read mode/rollback sync를 최종 구조에 유지한다는 뜻이 아니다.
    - **신규 갭 ⑤ — v13 identity/FK/snapshot/outbox 최종 교정(2026-07-15, dev 검증 완료·운영 전환 대기)**: v13 `20260714140000`/`20260714141000`/`20260714160000`, Admin `20260714150000`을 dev에 적용해 writing FK를 private identity registry로 이관하고 기존 초안·제출 snapshot을 백필한 뒤 `public.problems` writing 행을 0건으로 만들었습니다. canonical/source-map 700건, identity 704건, draft 328건, submission 280건, snapshot 누락 0건, registry FK 10개를 대사했습니다. migration down/up, outbox 5종 fault-injection, 실제 provider Q54 제출→분석→피드백, 최신 v13 `origin/main` 기반 desktop/mobile headed E2E를 통과했습니다. retained mirror/current legacy/shadow/read mode/rollback sync는 남기지 않습니다. 남은 갭은 운영 DB/Vercel 적용, evidence 기반 활성화와 운영 smoke입니다. 분류: `dev 구현·검증 완료 + 운영 게이트 차단`.
    - **신규 갭 ⑥ — 공급 `updated_at` 계약 미충족(2026-07-16)**: topik-ai 코드에는 `source_created_at/source_updated_at/content_hash/version_decision`, 문항별 advisory lock, metadata-only/이상 시각 보류, 50건 적재·승격 청크, 관리자 인박스/버전 이력 컬럼을 구현했습니다. 그러나 실응답 701건의 `updated_at`이 모두 null이라 정확한 수정 순서를 확정할 수 없습니다. 공급처가 `updated_at`을 채우기로 확정(2026-08-24 오너 결정)되어 신규 마이그레이션을 dev/운영에 적용했습니다(기존 행 `legacy` 백필, canonical 포인터 불변). 공급처가 실제로 채우기 전의 신규 수신은 `invalid_timestamp` held로 인박스에 보존되며, 채워지면 `payload_hash` 변경으로 새 행이 되어 정상 승격됩니다. v13 production 코드/DDL 변경은 없고 canonical 충돌·stale draft 답안 복사·제출 snapshot 관련 단위/마이그레이션 테스트 65건은 통과했습니다. 공급 계약과 guarded 실행 환경을 사용하는 live 교차 E2E만 남습니다. 분류: `DB 적용 완료 + 무시각 수신 분기 적용(2026-08-24 B안)`. 같은 날 실측에서 상류가 `situation_summary` 699건을 재작성하고도 `updated_at`을 채우지 않아, 오너 결정으로 무시각 수신은 content_hash 비교만으로 판정하는 분기를 추가했다(`20260824120000`). 이제 공급 updated_at 실채움은 차단 조건이 아니라 정밀 모드(수정 순서 판정) 전환 조건이다. 첫 실제 교체 승격(dev)이 잠복 결함을 드러냈다: canonical 교체 guard(20260713082500)의 to_regprocedure 존재 검사가 정적 참조와 한 IF 식에 있어, v13 컷오버가 의존 함수를 제거한 2026-07-14 이후 모든 DELETE+INSERT 교체 승격이 42883 으로 죽어 있었다(운영 동일 — 컷오버 후 첫 교체가 이날이라 이제야 관측). PL/pgSQL 은 IF 식의 함수 이름을 평가 전에 플랜하므로 존재 검사 fail-open 은 동적 SQL 호출일 때만 성립한다. `20260824130000` 으로 동적 호출 전환.
  - `EPS TOPIK`, `레벨 테스트`
    - 여전히 Placeholder이며, 편성/배점/발행/결과 정책의 화면 SoT와 데이터 source 경계가 미정이다.
- 분류
  - `부분 구현 + 미확정`
  - 문항 관리 운영 상태 조치: `해소` (2026-06-11 P4 관리 포인트 개방 — `service_status`+태그 write 활성, RT-4·RLS 네거티브 검증)
  - 메타데이터·태그 스키마 전환: `구현 완료` (P0~P6 — 외부 공급 상세 수신·인박스 적재·자동 승격 결선)
  - tag_master 활성/비활성 write: `해소` (P5-3 — 2026-06-11 개방, 신규 갭 ③ 종결 기록 참조)
  - 외부 공급 수신 경로: `해소` (2026-06-23 구현, 2026-07-13 Vercel Node ESM 시작 결함 보완)
  - 검수 표면·컬럼 제거: `해소` (재정의 P3 코드 컷오버 `202f905` + 마이그레이션 `0013` 적용 — 신규 갭 ② 종결 기록 참조)
  - 문항 버전·상태별 사용자 노출: `관리자 UI/코드/DB 적용 완료(2026-08-24) + 공급 updated_at 실채움 대기 + live 교차 검증 필요` — `canonical_import_id` 포인터, 수정 횟수·확장/상세 이력, 원본 생성/수정 시각과 content hash, 인박스 판정, 50건 청크를 구현했다. 승격 버전만 문항관리 이력에 포함하며 metadata-only/이상 응답은 인박스에 유지한다. 공급처의 `updated_at` 채움 확정(2026-08-24)에 따라 신규 DB 계약을 dev·운영에 적용했고, 같은 날 오너 결정(B안)으로 무시각 수신 content 판정 분기(`20260824120000`)를 추가했다 — 무시각 수신도 내용이 바뀌면 승격 후보가 된다(검수완료 게이트 불변). v13 관련 단위/마이그레이션 65건은 통과했고 후속 갭은 guarded live 교차 E2E와 자동 필드 diff이며 과거 복원은 정책 비범위다.
  - v13 canonical 읽기·제출 컷오버: `dev 구현·E2E 완료 + 운영 전환 대기` (14:00/14:10/15:00/16:00 dev 적용, down/up·fault-injection·실제 provider canary·desktop/mobile headed browser 완료, 운영 적용과 evidence 활성화 전 fail-close)

### 4.8 Content

- 대상 파일: `src/app/router/routes.ts`
- 현 상태
  - 라이브러리, 배지, 어휘, 소나기 어휘, 객관식 어휘, 미션 모두 Placeholder
- 미확정/누락/오구현
  - 콘텐츠 승인/배포/노출 정책, 버전 관리, B2C surface 연결, 미션 보상 연동, 학습 콘텐츠 분류 체계가 전혀 고정되지 않았다.
- 분류
  - `미확정 + 누락`

### 4.9 Analytics

- 대상 파일: `src/features/analytics/pages/analytics-overview-page.tsx`
- 현 상태
  - 요약 수치와 차트 대부분이 하드코딩이다.
- 미확정/누락/오구현
  - 어떤 지표가 Dashboard와 중복이고 어떤 지표가 Analytics 고유인지 구분되지 않았다.
  - 기간 필터, 집계 기준, 원본 drill-down 화면이 없다.
  - 비동기 상태 UX가 없다.
- 분류
  - `미확정`: 지표 정의/책임
  - `누락`: 필터/상태/drill-down

#### 4.9.1 관리자 권한 경계 — 해소분과 잔여 구조 갭 (2026-08-05)

- 배경: 관리자 콘솔은 관리 주체가 불명확하던 시기에 "마스터 관리자" 단일 개념으로 개발됐다. 그 결과 권한 카탈로그는 37개 키로 세분돼 있는데 서버 강제는 역할 단위(`private.is_admin`)에 머물렀다.
- ✅ 해소(2026-08-05): 학습 분석·분석 개요 RPC 4종 → `analytics.read`(마이그 `20260805130000`), 대시보드 요약 → `dashboard.read`, 백업 요약 → `system.backups.read`(마이그 `20260805150000`), 학습 원본 8테이블의 관리자 직접 조회 분기 제거(마이그 `migrations-v13/20260805140000`), 러너 비-LIFO down 가드(`scripts/db/migrate-core.mjs`, `--allow-out-of-order-down` 로만 우회).
- 🚨 **정정(2026-08-05)**: 이 항목의 최초 서술은 "학습 원본 RLS 는 v13 소유 도메인이라 이 저장소 단독으로 바꿀 수 없다"였다. **틀렸다.** v13 저작 동결(2026-07-30, 워터마크 `20260729120000`) 이후 **신규 learner 마이그레이션은 이 저장소 `supabase/migrations-v13/` 에서 저작한다**(`supabase/README.md` §2.5.3). 따라서 handoff 도, v13 저장소 변경도 필요하지 않았다. 소유권 경계를 판단할 때 `docs/architecture/shared-supabase-schema-ownership.md` 의 테이블 행만 보고 저작 동결 절을 놓치면 같은 오판이 반복된다.
- 🚨 `누락`(신규, 구조 갭 — 별도 프로그램 필요): **관리자 직접 조회 표면 전체가 아직 역할 기준이다.** dev 실측(2026-08-05): `qual` 에 `is_admin` 계열을 쓰는 정책 **63개**, 권한 키(`admin_has_permission`)를 쓰는 정책 **0개**. 관리자 앱이 PostgREST 로 **직접 읽는** 테이블이 20곳쯤 있어(커뮤니티 게시글·공지/FAQ/정책/이벤트·쿠폰/포인트 원장·알림 템플릿·발송·시스템 로그·메타데이터·문제은행 등) 예컨대 `commerce.payments.read` 없는 관리자도 포인트 원장을 직접 읽는다. 학습 원본은 관리자 앱이 직접 읽지 않아 분기 제거가 무손실이었지만, 이 20여 곳은 **테이블별 권한 키 매핑 + 화면 회귀 실측**이 필요하다. 착수 전 오너 결정 사항: 키 매핑 원칙(화면 게이팅 키를 그대로 쓸지), 정책 교체 vs 정책 분리, 단계 분할.
- 참고(실측): 관리자 조회 RPC는 전부 `postgres` 소유 + `rolbypassrls` + `SECURITY DEFINER` 라 RLS 를 우회한다. 즉 RPC 표면과 테이블 표면은 **독립된 두 게이트**이며, 한쪽만 잠그면 다른 쪽으로 같은 데이터에 도달한다. 이 사실이 위 프로그램의 설계 전제다.
- 🚨 **정정(2026-08-06) — 위 "권한 키 정책 0개 / 미강제 20키"는 dev 만 보고 센 수치다.** 2단계 착수 실사에서 dev 와 운영의 게이트 상태가 갈라져 있음을 발견했다. **운영은 관리자 RPC 76개가 권한 키를 검사하고 dev 는 34개뿐**이었다 — 차이 47개는 dev 가 잃은 것이다. 원인은 코드가 아니라 **적용 순서**: `20260617211000_system_metadata.sql` 등 6/17~6/22 자 파일이 dev 에서 대기 상태로 남아 있다가 phase8 강제 블록(`2026062328xxxx`, 6/24 적용) **뒤에** 7/8~7/16 에 적용됐고, 그 `create or replace` 본문이 새 정의를 덮어 권한 검사를 지웠다. 아무것도 실패하지 않았고 **클린 재생은 정상 상태를 만들기 때문에 shadow 계약으로는 볼 수 없었다**(파일 세트·운영 모두 정상 — `verify-permission-gate-parity` 로 양쪽 실측). 즉 **"미강제"로 보였던 상당수는 dev 환경 결함이고, 진짜 미강제(양 환경 공통)는 60개**다. 재발 방지 2종을 배선했다 — 러너 정순 적용 가드(`--allow-out-of-order-apply` 로만 우회)와 `npm run db:permission-gate-parity`(적용된 파일의 이름 순 최종 정의가 요구하는 키가 라이브에 있는지 환경별 재단정). 드리프트 복구는 `npm run db:permission-gate-repair`(참조 환경이 스스로 통과해야 하고, 시그니처가 다르면 거부). 상세 계획: `~/.claude/plans/parsed-singing-shamir.md`.
- ✅ 해소(2026-08-05): 감사 로그 민감정보 노출. `admin_audit_logs.diff`/`payload` 의 platform_admin 전용 게이트(오너 결정 2026-06-18)가 두 번의 RPC 재정의로 드롭돼 있었고, 원본 테이블은 직접 조회·직접 INSERT 가 모두 열려 있었다. `20260805160000` 이 세 구멍을 함께 닫았다 — 상세는 §7 해소 이력.
- ✅ **부분 해소(2026-08-06, 2A 시스템·회원)**: `20260806120000` 이 시스템·회원 표면을 정렬했다. **강제 형태는 오너 확정으로 역할 검사 + 권한 키 2겹**(`private.is_admin` 뒤에 `admin_has_permission`) — 키만 남기면 org_admin 이 grant 하나로 콘솔 표면에 닿는다. RPC 20종(감사 로그·관리자 계정·권한 목록·회원 목록/상세/부가 조회·강사·추천인·리포트 삭제·내보내기) + 정책 14건(직접 조회 3테이블은 키 정책 교체, 직접 읽지 않는 11테이블은 정책 삭제로 조회를 definer RPC 단일 경로화). `is_platform_admin` 이던 6종은 `is_admin` + 키로 **완화**되어 grant 로 열 수 있게 됐다(grants 0 이라 적용 시점 동작 무변경, 발효는 3단계 첫 부여). 그 완화에 딸린 필수 조치로 **회원 원문 이메일·전화는 platform_admin 또는 `users.export` 보유자에게만 반환**하고 이메일 검색 분기도 같은 조건으로 닫았다 — 반환값만 가리면 검색으로 존재 여부를 역추적할 수 있다. 잔여: 운영·커머스·메시지·커뮤니티(2B)와 문제은행·기관(2C), 그리고 2026-08 트랙이 만든 키 단독 형태 4종의 2겹 정규화.
- `누락`: `/system/permissions` 화면이 등급 5종을 보여주지만 DB 는 3종이고, 등급 변경이 권한 부여를 건드리지 않아 등급 지정 시 권한 0개(빈 화면)가 된다. 등급별 기본 권한은 FE `roleCatalog` 에만 있고 서버에 대응물이 없다. 권한 키는 자유 텍스트(FK·CHECK·카탈로그 없음)라 오타가 저장된다. 라우트는 무방비(메뉴만 게이팅)이고 부모 메뉴는 하위가 전부 숨겨져도 빈 헤더가 남는다. **이 항목은 위 정책 63개 정렬이 선행돼야 안전하다** — 정렬 전에는 비최고 관리자 등급이 어떤 이름이든 공용 게이트를 통과해 쓰기까지 도달한다(예: 문항 수정 경로가 `private.is_content_admin` 만 검사). 계획: `~/.claude/plans/parsed-singing-shamir.md`.

### 4.10 System

#### 4.10.1 관리자 계정/권한

- 대상 파일
  - `src/features/system/pages/system-admins-page.tsx`
  - `src/features/system/pages/system-permissions-page.tsx`
  - `src/features/system/model/permission-store.ts`
- 현 상태
  - `Resolved/Decision-recorded`(2026-06-17): RBAC SoT는 v13 `profiles.app_role`로 확정했다. `src/features/auth/model/auth-store.ts`가 세션의 `profiles.app_role`을 읽고, `src/features/auth/model/app-role-mapping.ts`가 4값 app_role을 5개 RoleKey/permission bundle로 파생한다.
  - `permission-store.ts`의 권한 부여/수정/회수는 local Zustand store와 mock audit만 갱신하며, 실제 RLS/RPC 인가에는 반영되지 않는다.
  - 권한 변경 actor 하드코딩은 잔존한다.
- 미확정/누락/오구현
  - `Resolved/Decision-recorded`(2026-06-17): 실제 RBAC 모델은 `profiles.app_role` + v13 RLS/RPC 헬퍼(`private.is_admin`/`is_content_admin`/`is_platform_admin`)로 고정한다. 화면 permission catalog 37개는 메뉴/표시 게이팅 전용이며 DB 인가 SoT가 아니다.
  - 신규 RBAC 테이블(`system_roles`, `system_permissions`, `role_permissions`, `admin_permissions`)은 기각한다. admin repo의 v13 테이블 DDL 변경 금지 경계와 이중 인가/동기화 회귀 리스크 때문이다.
  - 권한 변경 승인 절차, 2인 승인 여부, 즉시 반영/세션 재검증 정책이 없다.
  - 관리자 `app_role` 변경 주체/RPC/감사 payload 계약은 후속 오너 확인이 필요하다.
- 분류
  - `Resolved/Decision-recorded`: RBAC SoT 모순
  - `미확정`: 권한 변경 승인/세션 재검증/app_role 변경 운영 정책
  - `오구현`: actor 하드코딩, mock-only SoT

#### 4.10.2 감사 로그

- 대상 파일: `src/features/system/pages/system-audit-logs-page.tsx`
- 현 상태
  - Resolved(2026-06-18): Supabase 모드는 `admin_list_audit_logs(p_target_type, p_target_id, p_keyword, p_start, p_end, p_limit=100, p_offset=0)` 읽기 RPC로 live `admin_audit_logs`를 단일 source로 조회한다.
  - `system-audit-logs-data-source.ts`가 `VITE_SYSTEM_AUDIT_LOGS_SOURCE=mock`, `VITE_SUPABASE_DISABLED`, Supabase 설정 여부를 판별한다. mock 모드는 static audit seed(`api/mock-system-audit-logs.ts`)와 store audit 병합 fallback으로만 유지한다.
  - 페이지는 Supabase RPC 또는 mock/store merge 세부를 직접 소유하지 않는다.
- 미확정/누락/오구현
  - Resolved(2026-06-18): 감사 로그 화면 mock SoT·실 `admin_audit_logs` 미읽음 항목은 `20260618001000_admin_audit_logs_read.sql` dev DB 적용으로 해소됨. 모든 admin RPC가 적재한 감사 로그를 화면에서 실조회한다.
  - `diff`/`payload` 민감정보 노출 범위는 아직 미확정이며 화면 미노출 보류 상태다.
  - 상세 링크 매핑은 일부 엔티티만 처리한다.
- 분류
  - `Resolved`: 감사 로그 화면 mock SoT·실 `admin_audit_logs` 미읽음
  - `미확정`: diff/payload 노출 범위
  - `미확정`: 엔티티별 링크 매핑

#### 4.10.3 시스템 로그

- 대상 파일: `src/features/system/pages/system-logs-page.tsx`
- 현 상태
  - 초기 시스템 로그 seed/factory는 `src/features/system/api/mock-system-logs.ts`, 조회 facade는 `system-logs-service.ts`가 담당한다.
  - 페이지는 정적 rows 배열을 직접 소유하지 않는다.
- 미확정/누락/오구현
  - 기술 로그의 소스, 보존 기간, 검색/다운로드 정책, 개인정보 포함 여부 마스킹 규칙이 없다.
- 분류
  - `미확정 + 누락`

#### 4.10.4 메타데이터 관리

- 대상 파일
  - `src/features/system/pages/system-metadata-page.tsx`
  - `src/features/system/api/system-metadata-service.ts`
  - `src/features/system/model/system-metadata-store.ts`
- 현 상태
  - 목록/상세 Drawer/등록·수정 Modal/활성·비활성 ConfirmAction/감사 로그 역추적까지 구현됨
  - page-local seed 없이 service + zustand store 단일 SoT를 사용함
  - `summaryFilter`, `searchField`, `keyword`, `startDate`, `endDate`, `selected` URL 복원 지원
  - 2026-03-27 기준으로 화면 설명과 목록/상세 정보 구조를 `기능/사용처 중심 운영 설정 카탈로그` 관점으로 재정리함
  - 목록은 `설정명`, 기능 카테고리 태그, 운영 값 preview 중심의 압축형 행으로 정리했고, 보조 텍스트는 상세 Drawer로 이동함
  - 상세 Drawer `설정 구조`는 `설정 그룹 -> 운영 값 -> 추가` Tree와 드래그 정렬을 함께 지원함
  - `지금 운영 중인 값` 테이블도 행 드래그로 정렬 순서를 바꾸고, `item_reordered` 이력과 감사 로그를 남김
  - 운영 값 등록/수정 Modal은 현재 mock 데이터 기준으로 같은 설정 그룹 안의 코드/라벨 중복을 즉시 검사함
  - 2026-06-17 기준 운영 설정 카탈로그 그룹/항목은 `system_metadata_groups` + `system_metadata_group_items` Supabase-backed source로 전환 완료. mock fallback은 `VITE_SYSTEM_METADATA_SOURCE=mock` 또는 `VITE_SUPABASE_DISABLED=true`에 한정됨.
  - 그룹/항목 조치 감사는 RPC action `metadata_group_saved`, `metadata_item_saved`, `metadata_group_status_changed`, `metadata_item_status_changed`, `metadata_item_deleted`, `metadata_items_reordered`로 `admin_audit_logs.target_table='SystemMetadataGroup'`, `target_id=groupId`에 적재됨.
- 미확정/누락/오구현
  - Resolved(2026-06-17): 그룹/항목 mock-only source, DB 테이블 후보 상태, 감사 미적재/Target Type 미확정은 `20260617211000_system_metadata.sql` dev DB 적용으로 해소됨. 항목 조치도 그룹 단위 `Target Type = SystemMetadataGroup`으로 확정.
  - 미확정: PK `META-GRP-NNN`/`META-ITEM-NNN` max+1 동시성, `is_default` 단일성 정책, `admin_locations`/이력 정규화.
- 분류
  - `Resolved`: mock-only source, 감사 미적재, item-level 감사 Target Type 미확정
  - `미확정`: PK 동시성, 기본값 단일성 정책, 위치/이력 정규화

#### 4.10.5 백업 관리

- 대상 파일
  - `src/features/dashboard/components/backup-status-card.tsx`
  - `src/features/system/pages/system-backups-page.tsx`
  - `api/backups/report.ts`
  - `supabase/migrations-admin/20260720150000_admin_backup_monitoring.sql`
  - `supabase/migrations-admin/20260720150100_admin_backup_read_rpc_qualification.sql`
  - `supabase/migrations-admin/20260720150200_admin_backup_mirror_summary.sql`
  - `scripts/backup/`
- 현 상태
  - `Resolved/구현됨`(2026-07-20): 대시보드 요약 카드와 `/system/backups` 조회 전용 화면, `system.backups.read` 권한, 목록/상세 URL 복원, 시스템 로그 연결을 구현했다.
  - `Resolved/구현됨`: Vercel 보고 수신은 공유 비밀 서명, 5분 전송 시각, 32KB 제한, 엄격 필드, 중복 안전성, 완료 결과 불변성을 적용한다.
  - `Resolved/구현됨`: admin 소유 백업 실행·대상별 결과·복원 점검·보고 원장과 짝이 되는 down migration을 추가했다. v13 소유 테이블은 변경하지 않았다.
  - `Resolved/실증 완료`(2026-07-21): 온프레미스 스크립트와 사용자 systemd 예약 작업은 하루 4회, 첫째 일요일 복원 점검, 겹침 방지, 부팅 보충, 7일 보관, outbox 재전송을 제공한다. 첫 완전 백업과 격리 복원, restic 전체 읽기 검사, 핵심 DB·Auth·Storage 행수/파일수 대사를 통과했다.
  - `Resolved/구현됨`: 실제 백업은 `topik-prod`만 수행하고, 동일한 비민감 보고를 운영 원본과 `topik-dev` 조회 복사본에 별도 서명·별도 대기열로 전송한다. localhost는 복사본 안내와 마지막 복사 시각을 표시한다.
  - `Resolved/설계 조정`: 기존 AI PostgreSQL과 같은 온프레미스 서버를 쓰되 AI Compose 프로젝트·경로·cron은 변경하지 않는다. TOPIK은 전용 계정·경로·사용자 systemd와 `topik-prod-backup-drill` 임시 Compose 프로젝트를 사용하고, 복원 점검 포트는 확인된 loopback `55433`만 사용한다.
  - `Resolved/dev 적용`: 백업 관리 3개 migration을 `topik-dev`에 적용했고 실제 관리자 요약·목록 호출과 마지막 보고 수신 필드를 확인했다. tracker는 canonical 88개 + remote-only 1개, checksum 누락 0이다.
- 미확정/누락/오구현
  - `운영 연결 대기`: `topik-prod` migration, Vercel 운영/개발 복사용 서버 연결과 서로 다른 보고 비밀값, `/api/backups/report` 배포가 남았다. 온프레미스 보고는 배포 전까지 outbox에 보존된다.
  - `운영 증거 대기`: 수신 API 배포 후 outbox flush와 운영/개발 화면 반영, 예약 활성화 뒤 24시간 4회 연속 5분 내 화면 반영 증거가 남았다.
  - `잔여 위험 수용`: 외부 저장소와 외장 디스크가 없어 온프레미스 디스크와 원본의 동시 장애는 복구할 수 없다.
- 분류
  - `Resolved`: 코드·스키마·화면·운영 스크립트·문서 계약
  - `운영 연결 대기`: DB migration·Vercel 수신부·보고 비밀값 연결
  - `운영 증거 대기`: 두 화면 반영·24시간 연속성
  - `잔여 위험 수용`: 단일 온프레미스 저장소

## 5. 우선 정리 권장 순서

1. 인코딩 깨짐과 전역 한글 라벨 복구
2. 감사 로그 Target Type 표준화와 hardcoded actor 제거
3. Dashboard / Users / Analytics / Notification / System 권한의 page-local 또는 mock-only 조치 SoT 정리
4. Placeholder 라우트별 IA, 데이터 계약, 감사 로그 계약 초안 확정
5. Playwright 기반 핵심 e2e 시나리오 구축

## 6. 갱신 규칙

- 앞으로의 작업이 아래 중 하나에 해당하면, 구현과 함께 이 문서를 같은 작업에서 반드시 갱신한다.
- 기존 항목을 해소했을 때
- 기존 항목의 우선순위, 범위, 원인, 정책 상태가 바뀌었을 때
- 새 미확정/누락/오구현 항목을 발견했을 때
- Placeholder가 실페이지로 전환되었을 때
- 데이터 SoT, 감사 로그 계약, B2C 노출 위치, 상세 진입 패턴, URL 복원 규칙이 바뀌었을 때

## 7. 최근 해소 이력

- 2026-08-05 | `System > 감사 로그` 민감정보 보호 회귀 해소(두 표면) | 오너 결정(2026-06-18)으로 `admin_audit_logs.diff`/`payload`는 platform_admin 전용이어야 하고 `20260618095000`이 조회 RPC에 그 게이트를 넣었으나, 이후 `admin_list_audit_logs`를 재정의한 **두 마이그레이션(`20260623230000`·`20260720104000`)이 게이트를 드롭**해 활성 content_admin이 회원 PII를 포함한 감사 payload 전량을 조회할 수 있는 상태로 돌아가 있었다. 화면 코드는 그 사이에도 "서버가 게이팅한다"는 주석을 유지했고 이를 막는 테스트는 없었다. 더욱이 **RPC만 고쳐도 닫히지 않았다** — `admin_audit_logs`에 `admin_audit_logs_admin_select`(행·컬럼 제한 없는 `is_admin` 조회 → PostgREST로 마스킹 우회)와 `admin_audit_logs_admin_insert`(관리자가 자기 이름으로 감사 기록 위조)가 열려 있었다. `20260805160000`이 ①조회 RPC 게이트를 라이브 정의 수술로 복원(User/Users projection·`admin_accounts` actor 조인 보존을 사전·사후 단정) ②직접 SELECT를 platform_admin 전용으로 축소 ③직접 INSERT 정책 삭제로 세 구멍을 함께 닫았다. 감사 기록 쓰기는 `rolbypassrls` definer RPC 단일 경로라 정책 축소가 기능을 깨지 않으며 마이그레이션이 그 성질을 사후 단정한다. dev 실측: platform_admin은 500행 중 diff 448·payload 500 노출, content_admin은 목록 500행·사유 361행 유지하되 diff·payload 0행·payload 키워드 검색 0건, 원본 테이블 직접 조회 platform 4,560행 vs content 0행, content의 위조 INSERT 거절. 재발 방지는 파일 문자열 스캔이 아니라 **전체 재생 후 최종 상태 검사**(`run-shadow-contract.mjs`의 `verifyAuditSensitiveDataGate`, CI `db-contract` 잡) — 게이트를 드롭한 두 파일이 이미 불변 이력이라 파일 단위 단정은 영구 실패한다. 운영 DB는 미적용이다.
- 2026-08-05 | 학습 원본 직접 조회 우회 + `dashboard.read`·`system.backups.read` 정렬 + 러너 down 순서 가드 해소 | PR #79가 RPC 표면을 잠근 뒤에도 같은 데이터에 도달하는 두 번째 게이트가 열려 있었다. 관리자 조회 RPC는 전부 `postgres` 소유 + `rolbypassrls`라 RLS를 우회하므로, RPC와 테이블은 서로 독립된 게이트다. 학습 원본 8테이블(`writing_submissions`, `writing_feedback`, `writing_submission_metrics`, `feedback_dimension_scores`, `sentence_feedback`, `study_events`, `comparison_reports`, `problem_attempts`)의 정책에서 관리자 분기를 **제거**했다 — 권한 키로 다시 게이팅하지 않은 이유는 관리자 앱이 이 테이블들을 직접 읽지 않기 때문이며(`src/`에 해당 테이블 `.from()` 0건), "원본은 감사 가능한 RPC만"이 더 좁고 설명하기 쉬운 규칙이다. 저작 위치는 v13 저작 동결에 따라 이 저장소 `supabase/migrations-v13/20260805140000`이다(v13 저장소 변경·handoff 불필요 — 최초 판단 정정). 함께 `get_admin_dashboard_stats`를 `dashboard.read`로, `get_admin_backup_summary`를 `system.backups.read`로 맞췄다(`20260805150000`; 후자는 같은 화면의 `get_admin_backup_runs`만 권한을 요구하던 혼재 표면). 러너에는 비-LIFO down 가드를 넣어(`--allow-out-of-order-down`으로만 우회) 문자열 수술 마이그레이션의 down 순서 위반을 막았고, 실제 러너에서 거부되는 것을 확인했다. dev 실측: 권한 없는 활성 `content_admin`의 원본 직접 조회 8테이블 전부 0행, 학습자 본인 조회 77행 불변, 관리자 RPC 282건 정상, 권한 키 독립성(대시보드 키로 백업 요약 미개방) 확인. 잔여 갭은 §4.9.1의 구조 항목(직접 조회 20여 테이블, 정책 63개)이며 운영 DB는 미적용이다.
- 2026-08-05 | `Analytics > 학습 분석`·`통계 개요` 화면·DB 권한 판정 불일치 해소 | 메뉴는 `analytics.read`로 게이팅하는데 서버는 `private.is_admin`(관리자면 전부 허용)이라 권한을 주지 않은 관리자도 통계를 조회할 수 있었다. 마이그 `20260805130000`이 RPC 4종(`get_admin_learning_analytics_filtered`, `..._filter_options`, 구형 `get_admin_learning_analytics(integer)`, `get_admin_analytics_overview`)의 권한 검사를 `public.admin_has_permission(caller, 'analytics.read')`로 전환했다. 라이브 정의를 읽어 검사 블록만 치환해(발생 횟수 = 1 단정 후) `pdf_usage.perTopic`·metadata coverage 계약을 보존하고, 화면 미사용 구형 RPC까지 함께 닫아 직접 호출 우회를 막았다. 화면도 같은 판정을 내도록 두 페이지에 403 게이트(직접 URL 진입)와 권한 오류 시 보유 수치 초기화를 넣었다. dev 실측: 8시나리오 × 4 RPC = 32건 전부 기대대로(활성+grant 허용 / grant 없음·`suspended`·`invited`·학습자 거절), 회수 즉시 거절→재부여 복구, `platform_admin` 응답 수치 전후 동일(생성 시각만 상이), down→재적용 왕복 정합. 행동 변화 1건: 구 `private.is_admin`은 `org_admin`을 역할 단위로 거절했으나 이제 `analytics.read` grant가 있으면 허용된다(오너 규칙에 부합, 라이브 `org_admin` 0건). grant 백필은 없다(관리자 계정이 `platform_admin` 1개뿐이며 권한 함수에서 자동 통과). 잔여 갭은 §4.9.1(원본 테이블 직접 조회·dashboard/backup 혼재·러너 LIFO)이며 운영 DB는 미적용이다.
- 2026-06-18 | `System > 감사 로그` mock SoT·실 `admin_audit_logs` 미읽음 해소 | `admin_list_audit_logs(p_target_type, p_target_id, p_keyword, p_start, p_end, p_limit=100, p_offset=0)` 읽기 RPC와 조회 인덱스 2개(`admin_audit_logs_target_lookup_idx`, `admin_audit_logs_created_at_desc_idx`)를 `supabase/migrations-admin/20260618001000_admin_audit_logs_read.sql`(+ down)로 작성했고 `admin_schema_migrations` tracker 기준 2026-06-18 dev DB 적용 완료했다. 화면 service는 `system-audit-logs-data-source.ts`와 `supabase-system-audit-logs-service.ts`를 통해 Supabase 모드에서 live `admin_audit_logs` 단일 source를 읽고, `VITE_SYSTEM_AUDIT_LOGS_SOURCE=mock`이면 기존 mock/store audit 병합 fallback을 사용한다. 잔여 갭은 `diff`/`payload` 민감정보 노출 범위와 일부 엔티티 상세 링크 매핑이다.
- 2026-06-17 | `System > 시스템 로그` mock-only source 테이블화 해소 | `system_logs` Supabase read-only table을 `admin_schema_migrations` tracker 기준 2026-06-17 dev DB 적용 완료했고, 화면 service는 `system-logs-data-source.ts`를 통한 Supabase-backed source와 mock fallback을 가진다. `system_logs`는 7컬럼(`id`, `level`, `message`, `component`, `trace_id`, `context`, `created_at`)이며 `level`은 `INFO`/`WARN`/`ERROR` 대문자 값을 사용한다. 조회 전용 기술 로그라 admin write·감사 액션은 없고, `admin_audit_logs` 및 v13 `notification_log`와 구분한다. 잔여 갭은 로그 적재 소스/주체, 보존기간·파티셔닝, `trace_id` 의미, level 코드값 장기 표준화다.
- 2026-06-17 | `Users > 회원 목록` P0 결손 RPC 라이브 부재 해소 | `get_admin_users`/`admin_set_user_status` RPC 2종을 `supabase/migrations-admin/20260617210000_admin_users_directory.sql`(+ down)로 작성했고 `admin_schema_migrations` tracker 기준 2026-06-17 dev DB 적용 완료했다. 회원 목록은 Supabase 모드에서 v13 `profiles`/`auth.users` 조인과 `writing_submissions` 집계로 실데이터를 읽고, 정지/해제는 `profiles.status`를 `active`/`blocked`로 토글하며 `Target Type=User`, action `user_status_changed` 감사 로그를 남긴다. 신규 테이블은 없고 v13 `profiles` DDL은 변경하지 않는다. 잔여 갭은 관리자 메모 저장 주체, 사유 code/free-text 정책, 상태/기간/searchField 서버 필터 확장이다.
- 2026-08-01 | `Assessment > TOPIK 쓰기 문항` 문항 중심 기관 배정 진입점 **미제공 확정** | 2026-06-26 부터 여러 계약 문서가 이 페이지에 기관 컬럼·`기관 노출 설정`·일괄 배정 진입점이 **있다고 현재형으로** 기술해 왔으나 구현된 적이 없다(`src/features/assessment/pages/` 에 관련 문자열 0건, 서비스 계층 wrapper 3종만 존재하고 호출자 0). 오너 결정으로 만들지 않기로 확정했고, 기관별 배정은 `Users > 기관 코드`의 `노출 문항` 모달(기관 중심) 단일 경로로만 관리한다. 문서가 없는 기능을 있다고 말하는 상태를 그대로 두면 2026-07-30 오진(문서·라이브 불일치로 "게이팅이 죽었다"는 잘못된 결론)이 재발하므로, 해당 서술을 전부 미제공·철회로 정정하고 라벨 계약은 되살릴 경우의 참고로만 남겼다. 서비스 wrapper 3종은 삭제하지 않고 "호출자 0건은 결정이다" 주석을 달았다.
- 2026-08-06 | `Users > 기관 코드` 상세 탭 재배치(툴바 + 본문 + 설정 Drawer) | 탭 안에 설정·작업·현황이 성격 구분 없이 쌓여 있어 매일 보는 현황이 뒤로 밀렸다. 실측: convention-vn(회원 130명) 회원 탭 전체 6,575px·첫 화면 회원 0명·로스터 시작 ~1,200px, 노출 문항 탭은 사유 입력란 3개·저장 버튼 3개가 공존하고 본체인 배정 도구가 826px 아래. 각 탭을 툴바(요약 지표 + 주요 액션 + 설정 Drawer 트리거) + 본문(현황)으로 재배치하고 편집을 Drawer 3종으로 모았다(재배치 후 5,815px·로스터 첫 행 440px·첫 화면 12행). 배치 기준을 인접성 단독에서 "값 요약은 툴바, 편집은 Drawer"로 개정했다. 재배치가 드러낸 결함 3건을 같은 PR 에서 수리 — 기관 설정 전량 upsert 의 pass-through 로 담당자 저장이 정원을 지우던 것(부분 patch 파사드로 구조 차단), 초대 취소의 좌석 지표 stale, 옵션 토글 실패 시 모달 잔존. 기본 정보 탭에 누락됐던 권한 게이팅도 정렬했다. DB·RPC·감사 계약 무변경(FE 전용).
- 2026-08-01 | `Users > 기관 코드` 기관 단위 노출 모드 도입 | 기관 할당제에 "제한 없음"을 표현할 방법이 없어 기관 3곳이 노출 가능 문항 전량(각 700건)을 배정하는 우회책을 쓰고 있었고, 그 탓에 신규 문항이 자동 포함되지 않는 드리프트가 있었다. `topik_writing_institution_exposure_mode` 원장과 `제한 없음`/`배정분만` 2값을 도입해 학습자 predicate 를 3분기로 확장했다(무소속 / 제한 없음 / 배정분만). 폴백과 신규 코드 시작값은 전부 `배정분만`(현행 동작)이고, 규칙 기반 백필로 가시 문항 수 불변을 증명했다(dev 실측: 적용 전후 4개 기관 모두 동일). 빈 화면 가드 3종이 상태 공간을 닫는다 — 배정·초대 선행조건(모드 인지형으로 갱신), 마지막 배정 삭제 차단(모드 인지형으로 갱신), 모드 전환 차단(신설). 코드 삭제는 모드 원장을 같은 트랜잭션에서 정리해 같은 code 재생성 시 stale 설정 부활도 차단한다. 신규 감사 액션 `institution_exposure_mode_changed`. 운영 DB 는 미적용이다.
- 2026-07-30 | `Assessment > TOPIK 쓰기 문항` · `Users > 기관 코드` 기관 노출 라벨 축 재정의 | 학습자 규칙이 기관 할당제(무소속=`available` 전체, 기관 소속=자기 코드 배정분만)로 확정되면서 구 라벨 `전체 공개`(미매핑)/`기관 한정`(매핑)이 양방향 모두 거짓이 됐다 — 미매핑 문항은 기관 소속 학습자에게 보이지 않고, 배정된 문항도 무소속 학습자에게는 계속 보인다. 셀 라벨을 `미배정`/`기관 N곳 배정`, 일괄 액션명을 `기관 배정`/`배정 해제`로 재정의해 라벨 축을 "누가 보는가"에서 "몇 개 기관에 배정했나"로 옮겼고, 컬럼 헤더에 규칙 한 줄을 병기했다. `Users > 기관 코드` 노출 문항 모달에는 규칙 안내 Alert와 배정 0건 경고문("이 기관 소속 학습자에게는 쓰기 문항이 표시되지 않습니다")을 신설하고, 기관 단위로 오독되던 `실제 노출`/`현재 미노출` 표시를 `배정`/`전역 미노출`로 개명했다(e2e 스펙 8곳 동시 수정). 감사 액션 코드(`question_institutions_changed`/`question_institutions_cleared`)와 RPC 계약은 무변경이다.
- 2026-06-26 | `Assessment > TOPIK 쓰기 문항` 기관 노출 전역 차단 정합화 | `/assessment/question-bank`와 `Users > 기관 코드`의 기관 문항 노출 매핑이 `service_status` 전역 차단 조건을 공통 적용하도록 정리했다. `excluded`/`internal_test` 문항의 신규 기관 추가는 RPC `blocked`로 처리하고, 기존 매핑은 보존하되 `현재 미노출`로 계산한다. 제거/전체 해제는 stale 매핑 정리를 위해 허용한다. v13 사용자 화면 predicate 적용은 `docs/requests/v13-institution-question-exposure-handoff-2026-06-26.md` 후속 범위다.
- 2026-06-26 | `Users > 회원 목록/상세` 가입 생애주기 표시 정합화 | `정상 + 동의 완료 + 미인증` 조합을 정상 표시로 보지 않고, Admin 노출 `회원 상태`를 `registration_status` 기반 `인증 대기`/`약관 대기`/`정상`/`정지`/`탈퇴` 상태로 정리했다. 이메일 미인증 약관 표시는 `동의 불가`로 보정하고, RPC는 `consent_status='none'`, `consent_accepted_at=NULL`로 정규화한다. v13 사용자 앱 가입 플로우 가드는 `docs/architecture/users-registration-lifecycle-v13-handoff.md` 후속 범위다.
- 2026-06-17 | `Operation > 공지사항` mock-only·감사 미적재·reason 미전달 해소 | `operation_notices` Supabase 테이블과 admin RPC 3종을 `admin_schema_migrations` tracker 기준 2026-06-17 dev DB 적용 완료했고, 화면 service는 Supabase-backed hybrid switch와 mock fallback을 가진다. 공지 조치는 `Target Type=OperationNotice`, `target_id=noticeId`, action `notice_saved`/`notice_status_changed`/`notice_deleted`, reason 필수 계약으로 감사 로그를 남긴다. 잔여 갭은 B2C 실제 surface, 상단 고정/예약 게시, HTML sanitize/preview, `NOTICE-NNN` 동시성, `updated_by` 표시명 정합이다.
- 2026-06-17 | `Operation > FAQ` mock-only·감사 미적재·reason 미전달 해소 | `operation_faqs`/`operation_faq_curations`/`operation_faq_metrics` Supabase 테이블과 admin RPC 5종을 `admin_schema_migrations` tracker 기준 2026-06-17 dev DB 적용 완료했고, 화면 service는 Supabase-backed hybrid switch와 mock fallback을 가진다. FAQ 조치는 `Target Type=OperationFaq`/`OperationFaqCuration`, action `faq_saved`/`faq_status_changed`/`faq_deleted`/`faq_curation_saved`/`faq_curation_deleted`, reason 필수 계약으로 감사 로그를 남긴다. 잔여 갭은 `FAQ-NNN`/`FAQCUR-NNN` 동시성, `updated_by` 표시명 정합, metrics 실집계 파이프라인(seed only)이다.
- 2026-06-17 | `Operation > 이벤트` mock-only·감사 미적재·reason 미전달·배너 data URL only 해소 | `operation_events` Supabase 테이블과 admin RPC 4종을 `admin_schema_migrations` tracker 기준 2026-06-17 dev DB 적용 완료했고, 화면 service는 Supabase-backed hybrid switch와 mock fallback을 가진다. 이벤트 조치는 `Target Type=OperationEvent`, `target_id=eventId`, action `event_saved`/`event_scheduled`/`event_published`/`event_ended`, reason 필수 계약으로 감사 로그를 남긴다. 잔여 갭은 `EVT-NNN` 동시성, `updated_by` 표시명 정합, 배너/보상/메시지 정규화, `participant_count` 집계 source다.
- 2026-06-11 | 관리자 준비중 페이지 mock seed/source 경계 정리 | `Community`, `System`, `Message`, `Operation`, `Commerce`, `Billing`의 page-local seed/store seed 직접 참조를 `src/features/**/api/mock-*` seed/factory와 service safe facade로 분리했습니다. 조치 후 live state는 기존 feature store/service에 남기고, 잔여 갭은 실제 API/DB 계약, 권한/actor 정책, `Notification`/`Users 상세`/`Dashboard`/`Analytics` source 정리로 재분류했습니다.
- 2026-06-09 | `Assessment > TOPIK 쓰기 문제은행` 검수/관리 단일 페이지 `tab` 토글 분리 | `src/features/assessment/pages/assessment-question-review-page.tsx`, `src/features/assessment/pages/assessment-question-manage-page.tsx`, `src/features/assessment/api/assessment-question-bank-service.ts`, `src/features/assessment/api/supabase-assessment-question-bank-service.ts`, `src/app/router/app-router.tsx`, `docs/specs/page-ia/assessment-question-bank-page-ia.md`, `docs/specs/page-ia/assessment-question-manage-page-ia.md`를 기준으로 `tab` 쿼리로 `검수 큐`/`문항 관리`를 토글하던 단일 페이지를 `Assessment > TOPIK 쓰기 문제 검수`(`/assessment/question-bank`)와 `Assessment > TOPIK 쓰기 문항 관리`(`/assessment/question-bank/manage`) 두 형제 라우트로 분리했습니다. `tab` 쿼리를 제거하고 각 라우트가 자체 URL 상태(공통 `questionNo`/`domain`/`questionType`/`difficulty`/`keyword`, 검수 전용 `reviewStatus`, 관리 전용 `operationStatus`)를 복원하게 정리했고, 두 페이지는 동일한 Supabase `problems`(question_no 51-54) 조회 결과를 공유 hook으로 함께 씁니다. 다만 문항 관리 운영 상태 조치는 v13 `lifecycle_status` 미적용으로 비활성(스캐폴딩) 상태로 신규 갭에 남겼습니다.
- 2026-03-27 | `System > 메타데이터 관리` 관리 위치 계층 UX 보강 | `src/features/system/pages/system-metadata-page.tsx`, `src/features/system/model/system-metadata-store.ts`, `docs/specs/page-ia/system-metadata-page-ia.md`, `docs/specs/admin-page-tables.md`를 기준으로 목록의 `관리 위치`를 `route > 세부 위치` 형태로 읽히게 바꾸고, 상세 Drawer에는 Breadcrumb 기반 위치 카드와 `설정 그룹 -> 관리 위치 -> 운영 값 -> 사용자 영향` Tree를 추가했습니다. 메타데이터가 계층형 구조를 가진다는 점을 비개발자 운영자도 한눈에 이해할 수 있도록 위치 정보와 구조 정보를 같은 화면에서 검수하게 정리했습니다.
- 2026-03-27 | `System > 메타데이터 관리` 목록 압축과 Tree 기반 운영 값 관리 보강 | `src/features/system/pages/system-metadata-page.tsx`, `src/features/system/model/system-metadata-store.ts`, `tests/e2e/system-metadata.spec.ts`, `docs/specs/page-ia/system-metadata-page-ia.md`, `docs/specs/admin-page-tables.md`를 기준으로 목록 행에서 그룹 ID/설명/관리 방식/총 개수 같은 보조 텍스트를 제거하고, 상세 Drawer `설정 구조`를 `설정 그룹 -> 운영 값 -> 추가` Tree로 단순화했습니다. 운영 값은 Tree와 테이블에서 모두 드래그 정렬할 수 있게 바꾸고, 순서 변경은 `item_reordered` 이력과 감사 로그로 추적하도록 정리했습니다.
- 2026-03-27 | `System > 메타데이터 관리` mock 기준 운영 값 중복 체크 추가 | `src/features/system/pages/system-metadata-page.tsx`, `src/features/system/api/system-metadata-service.ts`, `tests/e2e/system-metadata.spec.ts`, `docs/specs/page-ia/system-metadata-page-ia.md`, `docs/specs/admin-page-tables.md`, `docs/specs/admin-data-contract.md`를 기준으로 운영 값 등록/수정 Modal에 같은 설정 그룹 안의 코드/라벨 중복 validator를 추가하고, 저장 시 service에서도 한 번 더 차단하도록 정리했습니다. 실제 DB unique 제약은 아직 없지만 mock 단계에서도 중복 데이터가 섞이지 않도록 입력 UX와 write path를 같이 맞췄습니다.
- 2026-03-27 | `System > 메타데이터 관리` 첫 진입 운영자용 설명 레이어 보강 | `src/features/system/pages/system-metadata-page.tsx`, `docs/specs/page-ia/system-metadata-page-ia.md`, `docs/specs/admin-page-tables.md`를 기준으로 페이지 상단 3단계 사용 가이드, 섹션 caption, Tooltip 설명 아이콘, Modal 안내 Alert를 추가했습니다. 운영자가 이 페이지 목적과 사용 순서를 처음부터 이해하기 어렵던 문제를 설명 레이어로 보완했습니다.
- 2026-03-27 | `System > 메타데이터 관리` 기능/사용처 중심 UX 재구성 | `src/features/system/pages/system-metadata-page.tsx`, `tests/e2e/system-metadata.spec.ts`, `docs/specs/page-ia/system-metadata-page-ia.md`, `docs/specs/admin-page-tables.md`를 기준으로 페이지 제목과 안내 문구를 `운영 설정 카탈로그` 관점으로 바꾸고, 목록 컬럼/상세 Drawer 섹션 순서를 `설정 -> 사용처 -> 운영 값 -> 영향 범위` 중심으로 재배치했습니다. 기존 메타데이터 레지스트리처럼 보이던 정보 구조를 운영자 업무 언어로 바꿔 비개발자도 페이지 역할을 바로 이해할 수 있게 정리했습니다.
- 2026-03-27 | `System > 메타데이터 관리` 상세 Drawer/입력 Modal UI 일관성 복구 | `src/shared/ui/detail-drawer/detail-drawer.tsx`, `src/shared/ui/descriptions/admin-form-descriptions.tsx`, `src/features/system/pages/system-metadata-page.tsx`, `tests/e2e/system-metadata.spec.ts`를 기준으로 상세 Drawer 폭을 shared preset(기본 `760`)으로 되돌리고, Drawer 내부 테이블은 shared drawer table helper를 사용하도록 정리했습니다. 그룹/항목 Modal도 `Descriptions` 기반 shared 입력 wrapper로 치환해 page-local `Form.Item` 세로 나열 예외를 제거했고, e2e에는 Drawer 폭과 `Descriptions` 구조 검증을 추가했습니다.
- 2026-06-17 | `Operation > 정책 관리` mock-only·감사 미적재·actor 하드코딩 해소 | `operation_policies`/`operation_policy_histories` Supabase 테이블과 admin RPC 4종을 `admin_schema_migrations` tracker 기준 2026-06-17 dev DB 적용 완료했고, 화면 service는 Supabase-backed hybrid switch와 mock fallback을 가진다. 정책 조치는 `Target Type=OperationPolicy`, `target_id=policyId`, action `policy_saved`/`policy_status_changed`/`policy_deleted`/`policy_version_published`, reason 필수 계약으로 감사 로그와 histories snapshot을 남긴다. 잔여 갭은 `POL-NNN`/`PH-NNNN` 동시성, uuid 표시명, `current_version_id` 장기 모델, `requires_consent` 동의 재수집 트리거다.
- 2026-03-27 | `System > 메타데이터 관리` 신규 화면 추가 | `src/features/system/pages/system-metadata-page.tsx`, `src/features/system/api/system-metadata-service.ts`, `src/features/system/model/system-metadata-store.ts`, `src/features/system/pages/system-audit-logs-page.tsx`, `tests/e2e/system-metadata.spec.ts`를 기준으로 운영 메타데이터 그룹/항목을 self-service로 관리하는 시스템 페이지를 추가했습니다. `검색 -> 상세 -> 조치 -> 감사 로그 확인` 흐름과 URL 복원, ConfirmAction, 감사 로그 역추적을 모두 같은 계약으로 맞췄고, 남은 쟁점은 실제 API/DB 계약과 item-level Target Type 세분화입니다.
- 2026-03-26 | `Commerce > 쿠폰 관리` 쿠폰 노출 설정 기능 제거 및 계약 정리 | `src/features/commerce/pages/commerce-coupons-page.tsx`, `src/features/commerce/pages/commerce-coupon-template-create-page.tsx`, `src/features/commerce/api/coupons-service.ts`, `src/features/commerce/model/coupon-store.ts`, `src/features/commerce/model/coupon-template-types.ts`, `src/features/commerce/model/coupon-template-form-schema.ts`, `src/features/system/pages/system-audit-logs-page.tsx`, `src/shared/model/target-type-label.ts`를 기준으로 `쿠폰 노출 설정` 버튼/모달/저장 로직/감사 로그 타깃 라벨/라우팅을 모두 제거했습니다. 이에 따라 쿠폰 관리의 현재 계약은 `쿠폰`과 `정기 쿠폰 템플릿` 2개 엔티티만 유지하며, 관련 문서도 같은 기준으로 동기화했습니다.
- 2026-03-26 | `Operation > 정책 관리` 액션 역할 분리와 히스토리 버전 게시 정리 | `src/features/operation/pages/operation-policies-page.tsx`, `src/features/operation/pages/operation-policy-create-page.tsx`, `src/features/operation/api/policies-service.ts`, `src/features/operation/model/policy-store.ts`, `src/features/operation/model/policy-types.ts`, `tests/e2e/operation-policies.spec.ts`를 기준으로 Drawer 푸터 액션을 `내용 수정`/`새 버전 등록`/`게시-숨김`/`삭제`로 재정의하고, 히스토리 행 우측 액션에 `본문 보기`, `이 버전 게시`를 분리했습니다. `정책 수정`이 곧 새 버전 생성으로 오해되던 흐름을 해소하고, 히스토리 `변경 사유`와 게시 전환 조치가 감사 로그 계약과 함께 추적되도록 정리했습니다.
- 2026-03-26 | `Commerce > 쿠폰 관리` `정기 쿠폰 템플릿` 탭 상단 요약 카드 누락 해소 | `src/features/commerce/pages/commerce-coupons-page.tsx`를 기준으로 `정기 쿠폰 템플릿` 탭에도 `ListSummaryCards`를 상단에 노출하고, `전체 / 진행 중 / 발행 중지` 카드 클릭으로 같은 탭 안에서 상태 필터와 URL(`templateStatus`)이 함께 복원되도록 정리했습니다. 이로써 같은 쿠폰 관리 페이지 안에서 `쿠폰 목록`만 상단 카드가 있고 템플릿 탭은 바로 toolbar로 시작하던 구조 불일치를 해소했습니다.
- 2026-03-26 | `Operation > 정책 관리`를 cross-page 운영 정책 레지스트리로 확장 | `src/features/operation/pages/operation-policies-page.tsx`, `src/features/operation/pages/operation-policy-create-page.tsx`, `src/features/operation/api/policies-service.ts`, `src/features/operation/model/policy-store.ts`, `src/features/operation/model/policy-types.ts`, `docs/specs/admin-policy-source-map.md`를 기준으로 운영 메뉴 하위 정책 관리가 법률/약관 문서만이 아니라 커뮤니티 게시글 제재, 추천인 보상, 포인트/쿠폰/이벤트/FAQ/챗봇/메시지/관리자 권한 변경 정책까지 함께 추적하도록 확장됐습니다. `운영 영역`, `정책 추적 상태`, `연관 관리자 화면`, `추적 근거 문서`를 같은 레코드에 담고, 감사 로그 `OperationPolicy` 역추적도 유지합니다.
- 2026-03-26 | `Operation > 정책 관리` 요약 카드 클릭 필터/정책 히스토리/삭제 조치 구현 | `src/features/operation/pages/operation-policies-page.tsx`, `src/features/operation/api/policies-service.ts`, `src/features/operation/model/policy-store.ts`, `src/features/operation/model/policy-types.ts`를 기준으로 요약 카드가 `summaryFilter` URL 상태와 함께 즉시 테이블을 갱신하도록 연결했고, 정책 히스토리는 Drawer 본문 섹션의 expandable row 테이블로 정리했습니다. 삭제 조치는 `OperationPolicy` 감사 로그 계약을 유지하고, 히스토리 mock SoT는 `OperationPolicyHistoryEntry[] + snapshot` 구조로 관리합니다.
- 2026-03-26 | Playwright 기반 초기 e2e 실행 기반 구축 | `playwright.config.ts`, `tests/e2e/operation-policies.spec.ts`, `package.json`을 추가/갱신해 정책 관리 핵심 플로우(목록 -> 등록 상세 -> TinyMCE 본문 작성 -> 저장 -> 게시)를 자동 검증할 수 있게 했습니다. 전역 갭은 `전면 부재`에서 `초기 기반 구축, 커버리지 제한` 상태로 조정했습니다.
- 2026-03-26 | `Commerce > 포인트 관리` placeholder 라우트 해소 | `src/features/commerce/pages/commerce-points-page.tsx`, `src/features/commerce/api/points-service.ts`, `src/features/commerce/model/point-store.ts`, `src/features/commerce/model/point-schema.ts`, `src/features/commerce/model/point-types.ts`, `src/app/router/app-router.tsx`, `src/shared/model/target-type-label.ts`를 기준으로 `정책 / 포인트 원장 / 소멸 예정` 3탭 목록형 운영 페이지와 상세 Drawer, 수동 조정/정책 저장/소멸 보류 조치를 실제 화면으로 올렸습니다. 다만 적립 원천 SoT, 차감 우선순위, 승인 체계, 소멸/복구 정책은 여전히 living IA와 mock 계약 기준으로 남아 있어 `미확정` 상태를 유지합니다.
- 2026-03-26 | `Commerce > 쿠폰 관리` 등록 상세와 `Operation > 이벤트` 등록 상세의 shell 불일치 해소 | `src/shared/ui/admin-editor-form/admin-editor-form.tsx`를 공통 등록 상세 shell로 추가하고 `src/features/operation/pages/operation-event-create-page.tsx`, `src/features/commerce/pages/commerce-coupon-create-page.tsx`, `src/styles/global.css`를 같은 `좌측 Steps + 우측 현재 section` baseline으로 정리했습니다. 쿠폰 등록 상세는 상단 hero/전용 section 스타일을 제거하고, 도메인 가이드는 `기본 정보` section 내부 Alert로만 남겨 이벤트 등록 상세와 같은 구성/레이아웃으로 맞췄습니다.
- 2026-03-26 | 목록 운영형 페이지 요약 카드 스타일/구현 불일치 해소 | `src/shared/ui/list-summary-cards/list-summary-cards.tsx`를 전역 목록형 요약 카드 컴포넌트로 기준 고정하고 `src/styles/global.css`에서 카드 visual baseline을 기존 다수 페이지의 카드형 스타일에 맞췄습니다. 동시에 `Billing > 결제 내역`, `Billing > 환불 관리`, `Community > 게시글 관리`, `Community > 신고 관리`, `Operation > 이벤트`, `Operation > FAQ`, `System > 관리자 계정`, `System > 감사 로그`, `System > 시스템 로그`의 page-local `Row + Card + Statistic` 구현을 shared `ListSummaryCards`로 치환해 목록 운영형 상단 인상을 전역 공통 패턴으로 통일했습니다.
- 2026-03-26 | `Commerce > 쿠폰 관리` toolbar 구조 불일치 해소 | `src/shared/ui/search-bar/search-bar.tsx`에 검색 입력 없이 `summary/actions`만 사용하는 toolbar 행 옵션을 추가하고, `src/features/commerce/pages/commerce-coupons-page.tsx`와 관련 문서를 `Tabs -> SearchBar(summary + actions)` 공통 목록 패턴으로 다시 정렬했습니다. 이로써 쿠폰 관리만 따로 쓰던 `메인 탭 + 우측 액션 버튼` 전용 헤더/CSS를 제거하고 `Message > 발송 이력`과 같은 구조로 맞췄습니다.
- 2026-03-26 | `Commerce > 쿠폰 관리` 정기 쿠폰 템플릿/노출 설정 placeholder 해소 | `src/features/commerce/pages/commerce-coupons-page.tsx`, `src/features/commerce/pages/commerce-coupon-template-create-page.tsx`, `src/features/commerce/api/coupons-service.ts`, `src/features/commerce/model/coupon-store.ts`를 기준으로 정기 쿠폰 템플릿 목록/상세/생성·수정/발행 중지·재개/삭제와 `쿠폰 노출 설정` modal 저장, 감사 로그 연결을 실제 구현 기준으로 승격했습니다.
- 2026-03-25 | 전역 입력형 `Descriptions` 행 높이 불일치 해소 | `src/styles/global.css`에서 `admin-form-descriptions`, `message-template-form-descriptions`의 bordered row `th/td` 기본 높이를 `56px`로 통일하고 `vertical-align: middle`을 적용해, 텍스트 셀과 `Select`/`Switch` 셀이 섞여 있어도 라벨 셀 높이가 들쭉날쭉하지 않도록 보정했습니다.

- 2026-03-27 | `System > 메타데이터 관리` Tree 삭제 affordance/운영 값 수정 Modal 삭제 버튼 해소 | `src/features/system/pages/system-metadata-page.tsx`, `src/features/system/model/system-metadata-store.ts`, `src/features/system/api/system-metadata-service.ts`, `tests/e2e/system-metadata.spec.ts`를 기준으로 `설정 구조` Tree 노드 hover 삭제와 `운영 값 수정` Modal 삭제 버튼을 같은 ConfirmAction 흐름으로 연결했습니다. 삭제 후 `item_deleted` 이력, 감사 로그, Tree/테이블 갱신이 함께 반영되도록 정리했습니다.

### 4.3.3 Community 게시글/신고 Supabase 전환 해소 기록 (2026-06-17)

- 대상 파일
  - `src/features/community/api/community-data-source.ts`
  - `src/features/community/api/community-service.ts`
  - `src/features/community/api/supabase-community-service.ts`
  - `src/features/community/pages/community-posts-page.tsx`
  - `src/features/community/pages/community-reports-page.tsx`
  - `supabase/migrations-admin/20260617173000_community.sql`
- 현 상태
  - 2026-06-17 기준 Community 게시글/신고는 mock-only에서 Supabase-backed hybrid switch로 전환 완료했다.
  - Supabase 모드는 `community_posts`, `community_post_admin_notes`, `community_reports`와 admin RPC 5종(`admin_hide_community_post`, `admin_show_community_post`, `admin_delete_community_post`, `admin_add_community_post_memo`, `admin_resolve_community_report`)을 사용한다.
  - Supabase 미구성, `VITE_SUPABASE_DISABLED=true`, `VITE_COMMUNITY_SOURCE=mock`은 기존 mock source로 회귀한다.
  - 마이그레이션 `supabase/migrations-admin/20260617173000_community.sql`(+ down)은 `admin_schema_migrations` tracker 기준 2026-06-17 dev DB 적용 완료했다.
- 해소된 항목
  - `Resolved`(2026-06-17): Community 게시글/신고 mock-only SoT. 조회/조치가 Supabase-backed 경로를 가지며 mock은 fallback으로 축소됐다.
  - `Resolved`(2026-06-17): Community 조치 감사 로그 미적재/범용 Target Type. 게시글은 `Target Type=CommunityPost`, action `post_hidden`/`post_shown`/`post_deleted`/`post_memo_added`; 신고는 `Target Type=CommunityReport`, action `report_resolved`로 `admin_audit_logs`에 기록한다.
  - `Resolved`(2026-06-17): 신고 조치 무동작 의미 버그. 이전 mock은 신고만 종결하고 게시글/사용자 조치를 하지 않았으나, `admin_resolve_community_report(..., 'hide_post', ...)`는 같은 트랜잭션에서 대상 게시글을 실제 `hidden` 처리한다. `suspend_user`는 v13 연동 전 intent-only payload(`user_suspend_integration=intent_only_v13_admin_set_user_status_pending`)로 기록한다.
- 미확정/누락/오구현
  - 사용자 정지 실제 연동은 v13 `admin_set_user_status` 연결 전까지 미확정이다.
  - `POST-NNN`/`RP-NNN`/memo id max+1 채번은 동시성 리스크가 남아 있다.
  - `board`, `last_moderation_policy_code`, memo `type`, 신고 `reason_code` code table화가 필요하다.
- 분류
  - `해소`: mock-only source 경계, 게시글/신고 감사 Target Type 세분화, 신고 `hide_post` 실제 게시글 숨김 처리
  - `미확정`: 사용자 정지 연동, 채번 동시성, 코드 테이블화

### 4.6.3 Commerce 포인트 Supabase 전환 해소 기록 (2026-06-17)

- 대상 파일
  - `src/features/commerce/api/commerce-points-data-source.ts`
  - `src/features/commerce/api/points-service.ts`
  - `supabase/migrations-admin/20260617190000_commerce_points.sql`
- 현 상태
  - 2026-06-17 기준 `Commerce > 포인트 관리`는 mock-only에서 Supabase-backed hybrid switch로 전환 완료했다.
  - Supabase 모드는 `commerce_point_policies`, `commerce_point_ledgers`, `commerce_point_expirations`와 admin RPC 5종(`admin_save_commerce_point_policy`, `admin_update_commerce_point_policy_status`, `admin_create_manual_point_adjustment`, `admin_hold_commerce_point_expiration`, `admin_release_commerce_point_expiration`)을 사용한다.
  - Supabase 미구성, `VITE_SUPABASE_DISABLED=true`, `VITE_COMMERCE_POINTS_SOURCE=mock`은 기존 mock source로 회귀한다.
  - 마이그레이션 `supabase/migrations-admin/20260617190000_commerce_points.sql`(+ down)은 `admin_schema_migrations` tracker 기준 2026-06-17 dev DB 적용 완료했다.
- 해소된 항목
  - `Resolved`(2026-06-17): Commerce 포인트 mock-only SoT. 정책/원장/소멸 예정 조회와 주요 조치가 Supabase-backed 경로를 가지며 mock은 fallback으로 축소됐다.
  - `Resolved`(2026-06-17): Commerce 포인트 조치 감사 로그 미적재/범용 Target Type. 정책은 `CommercePointPolicy` action `point_policy_saved`/`point_policy_status_changed`, 수동 조정은 `CommercePointLedger` action `point_manual_adjusted`, 소멸은 `CommercePointExpiration` action `point_expiration_held`/`point_expiration_released`로 `admin_audit_logs`에 기록한다.
  - `Resolved`(2026-06-17): 클라이언트 잔액 계산. Supabase 경로의 수동 조정은 서버 RPC가 사용자별 advisory lock + 최신 ledger `for update`로 최신 `available_balance_after + p_amount`를 계산하며, `balance_after`/`available_balance_after` CHECK와 RPC 가드로 음수 잔액을 차단한다.
- 미확정/누락/오구현
  - 음수 잔액 허용 여부와 차감 우선순위/환불 복구 정책은 미확정이다. 현재 DB/RPC는 음수 잔액을 차단한다.
  - 정책 저장 사유 입력 필드는 별도 UI로 고정되지 않았고, 서비스가 `note`를 `reason`으로 전달한다. 빈 값이면 RPC가 오류를 반환한다.
  - `POL-NNNN`/`PL-NNNN` max+1 채번은 동시성 리스크가 남아 있다.
  - 소멸 자동 처리 cron은 미구현/미확정이다.
  - `user_id`는 v13 `profiles` 느슨참조이며 FK가 없어 표시명/삭제/탈퇴 정합 정책이 필요하다.
- 분류
  - `해소`: mock-only source 경계, 감사 Target Type 세분화, 클라이언트 잔액 계산 제거
  - `미확정`: 음수 잔액 정책, reason UI, 채번 동시성, 소멸 cron, v13 profiles 느슨참조 정합

### 4.6.4 Commerce 쿠폰 Supabase 전환 해소 기록 (2026-06-17)

- `Resolved`: Commerce 쿠폰 mock-only SoT. 쿠폰 본체와 정기 쿠폰 템플릿 조회/저장/복제/상태 변경/삭제가 `commerce_coupons`/`commerce_coupon_subscription_templates` Supabase-backed 경로를 가지며 mock은 fallback으로 축소됐다.
- `Resolved`: `CouponAuditEvent(AL-CPN-)` store만 감사 SoT였던 항목. Supabase 경로는 `admin_audit_logs`에 Target Type `CommerceCoupon`/`CommerceCouponTemplate`과 action `coupon_saved`/`coupon_duplicated`/`coupon_paused`/`coupon_resumed`/`coupon_deleted`/`coupon_template_saved`/`coupon_template_paused`/`coupon_template_resumed`/`coupon_template_deleted`로 기록한다.
- `미확정`: 발급/사용 원장(`commerce_coupon_issues`, `commerce_coupon_redemptions`)은 아직 별도 테이블 계약으로 확정되지 않았다.
- `미확정`: scope-ref, 대상 그룹, 알림 설정은 JSONB/문자열 snapshot 중심이며 정규화 후속 결정이 필요하다.
- `미확정`: `planTier` free-limit는 현재 클라이언트/config 검증으로 유지되며 영속 정책은 후속이다.
- `미확정`: `target_user_ids`는 v13 `profiles` 느슨참조이며 FK가 없어 표시명/삭제/탈퇴 정합 정책이 필요하다.
### 4.6.5 Commerce 환불 Supabase 전환 해소 기록 (2026-06-17)

- 대상 파일
  - `src/features/billing/api/commerce-refunds-data-source.ts`
  - `src/features/billing/api/billing-service.ts`
  - `supabase/migrations-admin/20260617203000_commerce_refunds.sql`
- 현 상태
  - 2026-06-17 기준 `Commerce > 환불 관리`는 mock/Supabase 합성 조회에서 Supabase-backed workflow table로 전환 완료했다.
  - Supabase 모드는 `commerce_refunds`와 admin RPC 2종(`admin_approve_billing_refund`, `admin_reject_billing_refund`)을 사용한다.
  - Supabase 미구성, `VITE_SUPABASE_DISABLED=true`, `VITE_COMMERCE_REFUNDS_SOURCE=mock`은 기존 mock source로 회귀한다.
  - 마이그레이션 `supabase/migrations-admin/20260617203000_commerce_refunds.sql`(+ down)은 `admin_schema_migrations` tracker 기준 2026-06-17 dev DB 적용 완료했다.
- 해소된 항목
  - `Resolved`(2026-06-17): Supabase 모드 환불 read가 v13 `payment_history(status='refunded')` 합성 결과에 의존하던 항목. 환불 처리 대기/승인/거절 워크플로 SoT는 `commerce_refunds`로 고정됐다.
  - `Resolved`(2026-06-17): Supabase 모드 환불 승인/거절 write 차단. `assertMockRefundActionAllowed` 경계가 RPC 경로로 전환되어 승인/거절 조치를 수행한다.
  - `Resolved`(2026-06-17): 환불 조치 감사 로그 Target Type `Commerce` 범용화. Supabase 경로는 `CommerceRefund` Target Type과 action `refund_approved`/`refund_rejected`로 `admin_audit_logs`에 기록한다.
- 미확정/누락/오구현
  - 실제 결제 환불 집행 및 v13 `payment_history.status` 갱신은 미연동이다. 현재 승인 RPC는 payload `intent_only_v13_payment_history_pending=true`로 의도만 기록한다.
  - `payment_id`와 `user_id`는 v13 느슨참조이며 FK가 없어 삭제/탈퇴/결제 원본 정합 정책이 필요하다.
  - `RF-NNNN` max+1 채번은 동시성 리스크가 남아 있다.
  - payments `method` 컬럼 reconcile은 별도 과제로 남아 있다.
- 분류
  - `해소`: 환불 Supabase read SoT, Supabase write 차단, 환불 감사 Target Type 세분화
  - `미확정`: 실제 결제 환불 집행 v13 연동, 느슨참조 정합, 채번 동시성, payments method reconcile
### 2026-06-18 Users 회원 상세 학습 현황

- `Resolved`: 회원 상세에 학습 현황(문제 풀이) 탭이 추가되어 `get_admin_user_learning_overview(target_id)` live RPC와 mock fallback을 모두 가진다.
- `Resolved`: 학습 현황은 신규 테이블 없이 v13 학습 테이블 read-only 집계로 제공한다. v13 DDL/FK 변경 없음.
- `Resolved`: 작문 답안 본문과 문장별 첨삭 본문은 admin 미노출로 결정했다.
- `미확정`: 활동(`study_events`) 탭과 결제(`payment_history`) 탭의 실데이터화는 이번 범위에서 제외했다.
- `미확정`: 작문 첨삭 전문 열람이 필요해질 경우 별도 권한, 감사 로그, PII 열람 정책 결정이 선행되어야 한다.
- `Resolved`(2026-07-08): PDF 내보내기 제한 정책의 "전량 비활성 → v13 내보내기 전면 500" 운영 리스크를 설정형 재설계로 해소했다. 정책은 항상 1행이며 admin 화면에서 무정책 상태를 만들 수 없다(`supabase/migrations-admin/20260708150000_pdf_quota_policy_settings.sql`).
- `Resolved`(2026-07-08): PDF 내보내기 제한 PR8 리뷰 보완. 전체 초기화도 생성 시점에 `pdf_export_quota_reset_targets`로 대상 회원을 실체화하고 0명이면 거부한다. 정책/초기화/이력 시각은 KST 표시 문자열로 반환하며, 정책 변경 이력 row key는 감사 로그 id를 사용한다.
- `Resolved`(2026-07-08): PDF 내보내기 제한 PR8 추가 보완. 정책 저장 자기치유/cleanup DML을 `subject_scope='user' and resource_scope='problem'`로 제한해 다른 scope 정책을 비활성화/삭제하지 않으며, 개인 초기화 대상 회원 검색은 `search_admin_pdf_quota_reset_users` 전용 RPC로 분리해 100명 창 제약과 platform_admin 게이트 재사용을 해소했다.
- `미확정`: admin 화면 밖 경로(platform_admin 직접 테이블 쓰기)로 활성 정책이 0이 되면 v13은 여전히 fail-closed 500이다. v13 claim의 no-active-policy 폴백 하드닝은 v13 소유 후속 제안으로 남긴다.
- `미확정`: 한도 0(의도적 중단) 시 v13 사용자 카피가 "횟수 소진 + resetAt"이라 중단 의도와 안 맞는다. v13 소유 문구 개선 후보.

### 2026-07-08 학습 데이터 수집(problem_attempts 불일치 해소 + 소요시간 수집)

- `Resolved`: 학습 현황 KPI가 빈 `problem_attempts`(v13 사용자 화면 insert 경로 부재, dev 0행)를
  집계해 전 회원 0으로 표시되던 gap을 writing 원천 재정의(마이그 `20260708130000`)로 해소.
  `problem_attempts`는 `객관식 학습(별도 원천)` 분리 블록으로 라벨 유지.
- `Resolved`: 쓰기 소요 시간 미수집 gap — v13 `writing_submission_metrics`(마이그 `20260708113000`)
  + 워크스페이스 계측으로 수집 시작(2026-07-08). 이전 제출은 "미수집" 표기(0분 렌더 금지).
- `Resolved`: 전체 사용자 학습 집계 부재 gap — `get_admin_learning_analytics` + `/analytics/learning`
  탭 신설(활성 학습자 = 학습 이벤트 기준).
- `Resolved`(2026-07-10): 기간 프리셋만 가능하고 문제 유형 조건이 일부 표에만 적용되던 gap을 `get_admin_learning_analytics_filtered` + `get_admin_learning_analytics_filter_options`로 해소했다. 직접 날짜, 51~54번, `topic_main/topic_detail`, 단일 유형의 세부 특성이 KPI와 모든 분석 블록에 동일하게 적용되고 URL로 복원된다.
- `Resolved`(2026-07-10): 구 `problems.tags` 기반 주제 집계를 신규 TOPIK 쓰기 메타데이터 `topic_main/topic_detail` 기준으로 전환했다.
- `Resolved`(2026-07-10): `export_downloaded`를 실제 다운로드로 오인할 수 있던 gap을 `PDF 내보내기 완료 수` 라벨과 직접 귀속/혼합/미분류·귀속률 표시로 해소했다.
- `Resolved`(2026-07-15, 2026-07-16 UI 정리): PDF 사용 분석이 51~54번 합계만 제공해 어떤 주제의 내보내기 완료가 많은지 비교할 수 없던 gap을 `pdf_usage.perTopic`과 문제 유형×대주제×세부 주제별 건수 내림차순 계층표로 해소했다. 직접 귀속 이벤트만 집계하고 혼합·미분류는 특정 주제로 배분하지 않는다. 부모 행에는 고유 대주제 수만 단위 없는 숫자로 표시하고, 확장 자식 행의 `1위`, `2위` 같은 순위 라벨은 제거하되 건수 내림차순은 유지한다.
- `Resolved`(2026-07-13): 현재 제출 280건이 존재해도 환경 재시드로 `problem_id`가 역사 source map과 달라 신규 문항 메타데이터 inner join 결과가 0건이던 회귀를 해소했다. 기본 집계 보존과 별도로 exact-match 환경 별칭 700건을 적용해 참조 제출 280/280·이벤트 3333/3333·문제 58/58을 연결했다. 문제 번호·필수 메타데이터 완전성을 coverage에 포함하고, 수동 held 보존, target ref fail-closed gate, 빈/비어 있지 않은 before-image rollback 검증, 전체 필터 live 매트릭스까지 완료했다.
- `Resolved`(2026-07-15): dev DB에 먼저 적용됐던 구 `20260715130000`의 문제 유형별 주제 통계 함수가 이전 metadata coverage/canonical identity 계약을 덮어써 `/analytics/learning`에 `학습 데이터의 메타데이터 연결 상태를 확인할 수 없습니다` 오류가 표시된 회귀를 `20260715173826_restore_learning_analytics_metadata_contract.sql`로 복구했다. PR의 migration asset은 `20260715130000` up/down이 직전 최신 함수의 주제 블록만 fail-closed로 변환하도록 보강해 clean 적용과 전체 역순 rollback 모두 coverage를 보존한다. canonical private identity 객체가 있으면 빈 공개 mirror 대신 private projection을 사용한다. dev DB 실제 관리자 호출과 live e2e에서 제출 280/280·이벤트 3539/3539, 주제 15/15행의 문항 번호, 오류·경고 배너 없음까지 확인했으며 학습 원본 DML은 없다. 운영 DB는 미적용이다.
- `Resolved`(2026-07-16): 문제 유형별 비교·점수 분포 카드에 데스크톱 강제 동일 높이와 중첩 표 wrapper `height: 100%`를 적용해 자식 콘텐츠가 부모 높이 계산과 어긋날 수 있던 레이아웃 회귀를 해소했다. 각 카드는 콘텐츠 자연 높이를 사용하고 부모 분석 행이 더 큰 자식 높이를 포함한 뒤 다음 섹션을 배치하도록 e2e로 고정했다.
- `미확정`: v13 자체 `get_dashboard_kpi()`(v13 마이그 20260521140000)도 `problem_attempts`를 집계해
  사용자 대시보드 KPI가 0으로 표시됨 — v13 repo에서 writing 원천으로 정렬 필요(계획 Phase 1-4 항목).
- `미확정`: 외부 평가 API가 e2e 학생 계정(blackstarzck@naver.com)의 모든 제출에 409
  ("Email already registered with another account")를 반환 — 외부 서비스(dotoretopik) 계정
  레지스트리 충돌로 v13/admin 결함 아님. 외부 운영자에게 해소 요청 필요(e2e core-writing-flow가
  이 계정으로는 제출 단계에서 실패).
- `미확정`: 차원 점수 커버리지 낮음(dev 기준 피드백 192건 중 24건만 차원 점수 보유) — 화면은 표본 수
  병기로 완화, 외부 평가 API 차원 응답 안정화 후 재검토.
- `미확정`: 보고서·서재 선택 PDF 이벤트가 포함 문제 유형 정보를 충분히 남기지 않는 경우 `혼합`/`미분류`로 유지한다. 실제 파일 저장 완료 횟수가 필요하면 v13 텔레메트리의 별도 이벤트 계약이 선행되어야 한다.
