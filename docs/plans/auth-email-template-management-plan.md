# 인증메일(Supabase Auth) 템플릿 관리 + 도메인 연결 — 실행 계획안 (DRAFT)

작성일: 2026-06-22 · 상태: **검토/승인 대기** · 작성: Claude + GPT-5.5 토론 종합

---

## 0. 한 줄 요약

v13 일반 회원가입 시 Supabase GoTrue 기본 발송자로 나가는 인증메일을 **(1) 우리 도메인(Resend Custom SMTP)** 으로 보내고,
**(2) 관리자가 `/messages/mail`에서 6종 auth 메일 템플릿을 직접 편집**한 뒤 **Supabase Management API로 동기화(push)** 해 실제 발송에 반영한다.
완료 기준은 UI 완성이 아니라 **"가입 → 인증메일 수신 → 확인 → 로그인" 라이브 E2E 통과**.

---

## 1. 목표 / 비범위

### 목표
- v13 회원가입 인증메일의 **발신 도메인**을 우리 것으로(예: `no-reply@auth.keduall.com`).
- 관리자가 6종 auth 메일(가입확인·매직링크·비밀번호재설정·이메일변경·초대·재인증) **본문/제목을 우리 앱에서 편집**.
- 편집본을 **우리 DB에 저장(편집 SoT)** 하고 **Supabase Auth 내장 템플릿에 동기화**.
- 위 흐름을 **자동 E2E로 검증**: 발송 / 수신 확인 / 가입 재진입·로그인.

### 비범위 (이번 작업 아님)
- v13 가입 UI 자체 개조(우리는 auth 레이어까지 증명; v13 UI E2E는 크로스레포 후속).
- 마케팅/운영 브로드캐스트 파이프라인(`notification_templates` + `api/notifications/dispatch-email.ts`) 변경 — **그대로 유지, 절대 혼용 금지**.
- `{{ .Data.* }}` 커스텀 변수의 v13 가입 측 주입(별도 v13 계약 필요 시 후속).

---

## 2. 확정 결정 (오너) + 토론 보정

| 항목 | 결정 | 비고 |
|---|---|---|
| 아키텍처 | **A: DB저장 + Management API 동기화** | B(Send Email Hook)는 **SMTP를 무력화**하므로 SMTP 결정과 모순 → A 유지가 일관적 |
| 범위 | **auth 메일 6종 전부** | confirmation·magic_link·recovery·email_change·invite·reauthentication |
| 발신 도메인 | **Resend Custom SMTP** + DNS(SPF/DKIM/DMARC) | 크로스팀/레포 밖. 미설정 시 기본 발송자는 2통/시간·팀원에게만 → 실사용자 발송 불가 |

### A안 핵심 리스크와 전제 (토론 결과)
- `GET/PATCH /v1/projects/{ref}/config/auth`는 **프로젝트 단일 공유 객체**이며 **버전 토큰/CAS 없음**.
- 6종 키(`mailer_subjects_{type}`, `mailer_templates_{type}_content`)는 hosted Management API에 **모두 존재함**(키 부재는 결함 아님).
- **치명 전제:** "topik-ai(및 그 동기화 잡)가 auth 템플릿 필드의 **유일 writer**"가 보장돼야 함. 대시보드 수기 편집이 허용된다면 **GET→PATCH→GET 검증 + drift/conflict 차단**으로만 안전.

---

## 3. 아키텍처 흐름

### 현재 (문제)
```
v13 signUp ──> Supabase GoTrue(기본 템플릿/기본 발송자 onboarding@resend.dev) ──> 사용자
```

### 목표 (A안)
```
[편집]   관리자 ──/messages/mail(인증 탭, TinyMCE)──> RPC admin_save_auth_email_template ──> auth_email_templates(DB=편집 SoT)
[동기화] 관리자 "동기화" ──> /api/auth-email/sync(서버, 토큰 보관)
            ──GET /config/auth(drift 확인)──> PATCH(mailer_*_content/subject) ──GET 재검증──> admin_mark_auth_email_synced
[발송]   v13 signUp ──> Supabase GoTrue(우리 템플릿) ──Resend Custom SMTP(우리 도메인)──> 사용자
```

핵심: **GoTrue가 렌더·발송**(검증된 경로 유지). 우리는 템플릿의 편집 SoT를 갖고 동기화/조정/롤백을 책임진다.

---

## 4. 데이터 모델 — 전용 테이블

`notification_templates` 재사용 금지(브로드캐스트 send-group/auto-manual/CHECK 제약·오발송 위험). **전용 테이블** 신설.

`supabase/migrations-admin/` 신규 마이그(트래커 `admin_schema_migrations`, `scripts/db/admin-migrate.mjs` 적용):

```sql
create table public.auth_email_templates (
  id uuid primary key default gen_random_uuid(),
  auth_type text not null unique
    check (auth_type in ('confirmation','magic_link','recovery','email_change','invite','reauthentication')),
  subject     text not null default '',
  body_html   text not null default '',
  body_json   jsonb,
  status      text not null default 'draft'  check (status in ('draft','ready','published','archived')),
  -- 동기화/드리프트 상태
  sync_status text not null default 'draft'  check (sync_status in ('draft','synced','error','drift','conflict')),
  local_hash             text,        -- normalize(subject+body_html) 해시(편집본)
  last_synced_live_hash  text,        -- 마지막 PATCH 성공 직후 라이브 해시
  last_live_hash         text,        -- 가장 최근 GET으로 관측한 라이브 해시
  last_live_snapshot     jsonb,       -- 롤백용 라이브 키 스냅샷
  last_live_checked_at   timestamptz,
  synced_at   timestamptz,
  synced_by   uuid,
  sync_error  text,
  updated_by  uuid,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
-- 6행 시드(빈 기본 템플릿, on conflict do nothing)
```

### sync_status 의미 (드리프트 감지)
- `synced`: `local_hash == last_live_hash == last_synced_live_hash`
- `draft`: 편집본이 마지막 동기화본과 다름(라이브는 아직 동기화본과 동일)
- `drift`: DB 편집본=마지막 동기화본인데 **라이브가 다름**(대시보드 수기 편집 감지)
- `conflict`: 편집본도 바뀌고 라이브도 바뀜 → **동기화 차단, 수동 해소**
- `error`: PATCH 실패 또는 GET 재검증 불일치

> 옵션: `auth_email_template_versions` 히스토리 테이블로 버전/롤백 강화(후속).

---

## 5. RPC / 감사 (admin-owned, SECURITY DEFINER)

- `admin_save_auth_email_template(p_auth_type, p_subject, p_body_html, p_body_json, p_reason)` — 쓰기 + `admin_audit_logs` 기록, `local_hash` 재계산, `sync_status='draft'`.
- `admin_list_auth_email_templates()` — 6행 + 동기화/드리프트 상태 읽기.
- `admin_mark_auth_email_synced(p_auth_type, p_result jsonb, p_reason)` — 동기화 결과(성공/실패/라이브 해시/스냅샷) 기록.

공통: 비-admin 거부, `set search_path = ''`(스키마 한정), 비밀/토큰은 payload·로그에 절대 미기록.

---

## 6. 메타데이터 유형 등록 (요청 사항)

- `system_metadata_groups`에 그룹 **"인증·계정 메일(auth)"**(owner_module=Message, manager_type=selectOption) + 6개 item 시드 → `/system/metadata`에서 관리, 화면 분류에 반영.
- **분류(class) `transactional`은 이미 하드코딩 enum에 존재** → 새 class 불필요.
- 단, 메타데이터 행은 "분류"만 담당. **동작 게이팅(아래 UI)은 코드 변경 동반**.

---

## 7. 관리자 UI — `/messages/mail` "인증 메일" 탭

`src/features/message/pages/message-channel-page.tsx`에 세그먼트 탭(**알림 메일 | 인증 메일**) 추가.

- 6종 목록 + 편집(기존 `MessageHtmlEditor`/TinyMCE **재사용, 새 의존성 0**).
- **유형별 변수 팔레트**(전역 금지):
  - confirmation: `{{ .ConfirmationURL }}`, `{{ .Token }}`, `{{ .TokenHash }}`, `{{ .SiteURL }}`, `{{ .Email }}`, `{{ .RedirectTo }}`
  - magic_link / recovery / invite / reauthentication: 각 유형 허용 변수만
  - email_change: `{{ .Email }}`, `{{ .NewEmail }}` 등(토큰/해시 필드 역명명 주의)
- **게이팅:** 발송 그룹·자동 조건·브로드캐스트 "발송" 버튼 숨김 → `admin_send_notification` 경로 **원천 차단**. 대신:
  - "**Supabase Auth에 동기화**" 액션 + **동기화 상태/드리프트 배지**(synced·draft·drift·conflict·error)
  - **미리보기** + **검증 경고**(필수 변수 누락, `javascript:` 링크 차단, Go-template 구분자 보존)
  - **롤백**(last_live_snapshot로 복원), **드리프트 시 "라이브 채택 / 라이브 덮어쓰기" 선택**
- mock 모드 보존(기존 패턴: `isSupabaseConfigured ? DB : 더미`).

---

## 8. 동기화 서비스 — 서버 엔드포인트

`api/auth-email/sync.ts` (기존 `api/notifications/dispatch-email.ts`와 동급의 Vercel 서버 함수; **토큰은 서버 전용**).

흐름:
1. admin 신원/권한 검증(서버측), sync 시도 rate-limit.
2. **GET** `/v1/projects/{ref}/config/auth` → 라이브 해시 계산 → **drift/conflict면 차단**.
3. **단일 PATCH**로 변경된 키(들) 일괄 전송(6종 개별 PATCH 금지 — 부분 롤아웃 창 방지). `429`면 백오프.
4. **GET 재검증**: 패치한 키의 정규화 본문이 DB와 일치할 때만 `synced`.
5. `admin_mark_auth_email_synced`로 결과·라이브 해시·스냅샷 기록(실패 시 라이브 상태를 거짓으로 `synced` 처리하지 않음).

신규 env(서버 전용): `SUPABASE_MANAGEMENT_API_TOKEN`, `SUPABASE_PROJECT_REF`(dev=`fglggyfvzjdsbyckinqa`).

---

## 9. E2E 전략 (오너 필수 3종)

원칙: **기존 mock 하니스(`VITE_SUPABASE_DISABLED=true`)를 라이브로 바꾸지 않는다.** auth E2E는 **별도 스위트** + 명시적 env 가드 + serial + snapshot/restore.

### 두 게이트
| 게이트 | 도구 | 증명 범위 | 실행 |
|---|---|---|---|
| **G1 빠른 스모크** | `supabase.auth.admin.generateLink` + supabase-js | 토큰 발급 → 확인 → 로그인 **메커니즘** (메일 발송/렌더 미검증) | 매 PR(라이브 시크릿 필요), 빠름 |
| **G2 라이브 수신 게이트** | Playwright + supabase-js + **메일박스 API(Mailosaur/MailSlurp)** + Management API | sync→GoTrue→Resend SMTP→**실제 메일 수신·본문 일치**→확인→로그인 전체 사슬 | opt-in(`AUTH_LIVE_E2E=1`) / 릴리스·야간, serial | 

> **수신 확인(오너 필수)** 은 실제 메일박스로만 증명 가능 → **G2는 필수 게이트**. 단 비용/공유 프로젝트 변경/30통·시간 제한 때문에 매 PR이 아닌 **opt-in/릴리스 게이트**로 운용.

### 3종 시나리오 매핑
- **E2E-1 인증메일 발송**: `supabase.auth.signUp(email,password)` 호출 성공 → (G1) generateLink로 토큰 발급 확인, (G2) 실제 트리거.
- **E2E-2 인증메일 수신 확인**: G2에서 메일박스 폴링 → 수신 메일 제목/본문에 **우리 템플릿 마커 포함**(= "관리자 편집본이 실제로 사용됨" 증명).
- **E2E-3 가입 재진입·로그인**: 메일 링크에서 `token_hash` 추출 → `verifyOtp({token_hash,type})` 확인 → `signInWithPassword` 성공. **부정 케이스**: 미확인 로그인 실패, 동일 이메일 재가입 동작.

### 위생 규칙
- 유니크 주소(`auth-ci-{runId}@{mailboxDomain}`), 테스트 종료 시 `auth.admin.deleteUser` 정리.
- G2: 사전 GET 스냅샷 → 종료 시 원복 PATCH(실패 시에도 finally 원복).
- URL **클릭하지 않고** `token_hash`로 `verifyOtp`(스캐너 prefetch로 일회용 토큰 소진 회피).
- 테스트 대상 `auth_type`만 시드/동기화(블래스트 반경 최소화).

### G2 의사코드(요지)
```ts
test.describe.configure({ mode: 'serial' })
test('가입확인 메일이 관리자 템플릿으로 발송·수신되고 로그인된다', async ({ request }) => {
  test.skip(process.env.AUTH_LIVE_E2E !== '1', 'opt-in only')
  // 1) 라이브 auth config 스냅샷(GET)
  // 2) admin_save_auth_email_template(confirmation, 마커 포함 본문)
  // 3) POST /api/auth-email/sync {auth_type:'confirmation'}
  // 4) GET /config/auth → mailer_*_confirmation_*에 마커 포함 검증
  // 5) supabase.auth.signUp(email,password,{options.data})
  // 6) 메일박스 폴링 → subject/html에 마커 포함(E2E-2)
  // 7) html에서 token_hash 추출 → verifyOtp (E2E-3 확인)
  // 8) signInWithPassword 성공 단언 (E2E-3 로그인)
  // finally) deleteUser + config 원복 PATCH
})
```

---

## 10. 보안 / 운영

- `SUPABASE_MANAGEMENT_API_TOKEN`·service-role 키 = **서버 전용**, 브라우저/DB/로그/감사 payload/에러에 절대 노출 금지. 가능하면 **최소 권한 머신 유저/파인그레인드 토큰**.
- 동기화는 **공유 프로젝트(v13 가입에 즉시 영향)** → admin 게이트 + 감사 + 드리프트 확인 + (권장)릴리스 윈도우.
- **롤백 런북**: last_live_snapshot 1-클릭 복원, 동기화 시도/검증 결과 모두 감사 기록.
- 콘텐츠 안전: 허용 태그/속성 sanitize하되 `{{ }}` 구분자 보존, `javascript:` 차단, 필수 변수 누락 경고.

---

## 11. 외부 선행 종속 (라이브 게이트 전 필요)

1. **Resend Custom SMTP + DNS**(SPF/DKIM/DMARC, 전용 서브도메인) — v13/운영팀. 미완 시 G2 불가.
2. **Management API 토큰 + dev ref(`fglggyfvzjdsbyckinqa`)** — sync 엔드포인트/G2/G1.
3. **메일박스 제공자 결정**(Mailosaur 권장 / MailSlurp 대안) + CI 시크릿 — G2 수신 검증.

---

## 12. 단계별 실행 계획 (E2E를 게이트로)

| Phase | 산출물 | 종료 기준(게이트) |
|---|---|---|
| **P0 가드레일** | dev에서 GET `/config/auth` 확인·스냅샷, sole-writer 정책 합의, 토큰 보관/회전 방식, SMTP/DNS·메일박스·CI 시크릿 확보 | GET 동작 + 원복 가능 + 대시보드 편집 정책(금지/드리프트 수용) 합의 |
| **P1 스키마/RPC/감사** | `auth_email_templates`(+6 시드), RPC 3종, 메타데이터 그룹/6항목 | 마이그 적용, 비-admin 거부, 단위/RPC 테스트(저장·목록·감사·잘못된 type) |
| **P2 UI/검증** | 인증 탭, 유형별 변수 팔레트, 게이팅, 미리보기/검증, 드리프트·동기화 배지, 롤백 | mock UI 테스트 통과, **브로드캐스트로 절대 안 나감**, 한글/라벨 게이트 |
| **P3 동기화 서비스** | `/api/auth-email/sync`(GET→PATCH→GET, 일괄 PATCH, 429 백오프, 스냅샷/해시) | conflict 차단, 라이브 일치 시에만 `synced`, 실패는 거짓 synced 금지, 대시보드 편집=`drift` 감지 |
| **P4 G1 스모크(PR CI)** | `generateLink` 기반 확인/로그인 스모크 + 정리 | PR CI에서 빠르게 통과, 생명주기 정리, "발송/렌더 미검증" 명시 |
| **P5 G2 라이브 게이트(릴리스)** | cloud dev + 메일박스 라이브 스위트(P9 시나리오), 스냅샷/원복 | **가입→수신(마커)→확인→로그인 통과**, 실패 시 템플릿 원복, 리포트에 마커·정리·원복 검증 — **확인메일 지원 릴리스 게이트** |
| **P6 6종 확장** | 유형별 변수 검증 매트릭스 + 키매핑 동기화 테스트 + (가능 시)유형별 라이브 | 6종 편집·동기화·드리프트·롤백 가능, 미허용 변수 미노출, reauthentication 로컬 갭 문서화 |
| **P7 운영 준비** | 운영 토큰/DNS/SMTP 체크리스트, 롤백 런북, 드리프트 모니터/재조정 버튼 | 운영 publish는 명시적 admin 액션, 최신 dev E2E 통과, 롤백 검증, v13 측 영향 합의 |

---

## 13. 결정 필요 사항 (오너)

1. **대시보드 수기 편집 정책**: 금지(권장, 단순) vs 허용+드리프트 수용(복잡)? → A안 안전성의 핵심.
2. **메일박스 제공자**: Mailosaur(권장) / MailSlurp / 기타? (G2 수신 검증 비용·시크릿)
3. **G2 실행 주기**: opt-in 수동 / 야간 스케줄 / 릴리스 전 필수?
4. **레이어1(SMTP/DNS) 담당/일정**: v13·운영팀 협의 — 체크리스트 별도 제공 가능.
5. **Management 토큰**: 지금 제공 가능? (없으면 코드/마이그/UI까지 완성 후 dev 동기화만 마지막 검증)

---

## 14. 미해결/주의 (리스크 레지스터)

- 공유 프로젝트 블래스트 반경(동기화=v13 즉시 영향).
- `/config/auth` CAS 부재 → 경합/덮어쓰기(유일 writer 정책으로만 완화).
- 일회용 링크 prefetch → OTP/`token_hash` 검증으로 회피, 제공자 클릭 추적 비활성.
- email_change 이중 토큰/역명명 주의.
- 로컬 CLI config는 `reauthentication` 누락 → 로컬 6종 패리티 불완전(필요 시 문서화).
- `{{ .Data.* }}`는 v13가 `options.data` 주입해야 동작 → UI에서 보장 변수로 광고 금지.
