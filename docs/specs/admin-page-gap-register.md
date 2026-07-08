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
  - `get_admin_users(search, sort, page, page_size)`는 v13 `profiles`/`auth.users` 조인과 `writing_submissions` 집계를 반환하고, `admin_set_user_status(target_id, new_status)`는 `profiles.status`만 `active`/`blocked`로 토글한다. 신규 테이블은 없고 v13 `profiles` DDL은 변경하지 않는다.
  - `Resolved`(2026-06-26): Admin 노출 `회원 상태`는 `profiles.status` 원천값 단독이 아니라 `get_admin_users.registration_status` 기반 값으로 표시한다. 이메일 미인증은 `인증 대기`, 인증 후 약관 미동의는 `약관 대기`이며, 이메일 미인증 약관 집계는 RPC에서 `none/null`로 정규화한다.
- 미확정/누락/오구현
  - `Resolved`(2026-06-17): 정지/해제 조치 결과는 Supabase 모드에서 `admin_set_user_status` RPC를 통해 실제 `profiles.status`에 반영되고, `admin_audit_logs`에 `target_table='User'`, action `user_status_changed`로 기록된다.
  - `미확정`(v13 handoff): v13 사용자 앱의 가입 플로우는 이메일 미인증 `user_consents` 차단, 필수 약관 전 사용자 기능 활성화 차단, dry-run/backfill로 정리해야 한다.
  - 관리자 메모의 저장 주체와 감사 로그 영속 정책이 불명확하다.
  - 조치 사유가 어떤 code table 또는 자유 입력 규칙을 따르는지 확정되지 않았다.
- 분류
  - `Resolved`: 회원 목록 Supabase read/write RPC 라이브 부재(P0 런타임 실패)
  - `미확정`: 메모/사유의 데이터 계약, v13 가입 생애주기 원천 계약/백필

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

- 대상 파일: `src/features/assessment/pages/assessment-question-bank-page.tsx`, `src/features/assessment/pages/assessment-question-detail-page.tsx`(구 `assessment-question-review-page.tsx` — 재정의 P3 개명), `src/features/assessment/pages/assessment-question-manage-page.tsx`, `src/features/assessment/api/assessment-question-bank-service.ts`, `src/features/assessment/api/topik-writing-question-bank-service.ts`, `src/features/assessment/api/supabase-assessment-question-bank-service.ts`(legacy 롤백 어댑터), `src/app/router/routes.ts`
- 현 상태
  - `TOPIK 쓰기 문제은행` 단일 페이지(`tab` 쿼리 토글)는 두 형제 라우트로 분리되었다. `Assessment > TOPIK 쓰기 문제 검수`(`/assessment/question-bank`)와 `Assessment > TOPIK 쓰기 문항 관리`(`/assessment/question-bank/manage`)가 동일한 Supabase `problems`(question_no 51-54) 조회 결과를 공유 hook으로 함께 쓰며, JSON fixture/store fallback은 제거되었다.
  - 검수 페이지는 `reviewStatus 요약 카드+필터 -> 목록 -> 2depth 검수 페이지(/assessment/question-bank/review/:questionId)`와 `검수 메모 입력 -> 검수 완료 / 수정 필요 / 보류` 흐름을 유지한다. `tab` 쿼리는 제거되고 각 라우트가 자체 URL 상태(공통 `questionNo`/`domain`/`questionType`/`difficulty`/`keyword`, 검수 전용 `reviewStatus`, 관리 전용 `operationStatus`)를 복원한다. ※ 2026-06-11 인바운드 전환에 따라 이 검수 표면은 재정의 P3 코드 컷오버(`202f905`)에서 제거 완료됐으며, 현 단락은 역사 기록이다.
  - `EPS TOPIK`, `레벨 테스트`는 아직 Placeholder
- 미확정/누락/오구현
  - `TOPIK 쓰기 문제 검수` — **[2026-06-11 인바운드 전환으로 블록 전체 폐기/대체]** 검수 개념이 admin에서 전면 삭제돼(결정 기록 §0) 아래 갭들은 트랙 소멸로 닫혔다. 잔여 실작업은 후술 신규 갭 ②(검수 표면·컬럼 제거 미구현)로 승계된다.
    - **[대체]** 검수 상태와 운영 상태는 분리 구현됐다. 사용자 공개/숨김 통제 책임은 운영정책 `POL-017`로 통합 문항 페이지(`/assessment/question-bank`)에 확정되었으나, 구판 POL-017의 "배포 승인 체계" 미확정은 push 트랙 폐기로 소멸했다. POL-017은 "TOPIK 쓰기 문항 수신·관리 운영정책"으로 재정의됐고, 노출 통제는 `service_status` 축(write 활성화는 재정의 P4)으로 일원화됐다. 2026-06-26 기관 노출 정합화로 최종 노출 predicate 후보는 `service_status='available' AND (기관 매핑 없음 OR profiles.affiliation_code 매핑 존재)`로 문서화했다.
    - **[폐기]** ~~문제 번호별 review field profile schema를 별도 계약으로 승격할 필요~~ — 검수 표면 자체가 제거 대상이라 승격 트랙 소멸. (현재 검수 상세가 sentinel/빈 이력로 표시되는 것은 코드 사실로 유효 — 신규 갭 ②에서 화면 제거/재구성으로 해소)
    - **[폐기]** ~~`검수 완료` 문항 배포(관리자 → 상류 `TalkPik AI Service` API 업로드 → Writing 작문 과제 `GET /api/writing/tasks`)와 상류 업로드/upsert 엔드포인트·배포 트리거 미확정~~ — 상류 push(업로드/배포) 트랙 자체가 2026-06-11 폐기됐다. Writing API는 v13 사용자 노출용이며, admin 통합 방향은 인바운드 수신(공급 API 신설 요청 중 — 미개발, 신규 갭 ①)이다.
    - **[폐기]** ~~`수정 히스토리` 빈 이력, 필드별 diff·버전 간 비교 뷰 부재~~ — 검수 상세 표면 제거 대상에 흡수(신규 갭 ②).
    - **[폐기]** ~~AI 재생성, 배치 재시도, 프롬프트 버전 비교, 검수 히스토리 diff~~ — admin은 문항을 저작·생성·검수하지 않는다(인바운드 모델). 트랙 소멸.
    - **[대체]** 1차 사용자 노출 경로의 구판 서술(POL-017 구판: 상류 Writing API 배포)은 폐기됐다. v13 사용자 기능은 Supabase 적재분을 read-only로 소비하며, EPS TOPIK / 레벨 테스트 세트 편성 화면의 문항 소비 계약(태그·`service_status` 기준)은 여전히 후속 구현이 필요하다.
    - **[폐기]** ~~배치별 대량 검수 액션과 후속 내보내기/배포 액션의 관리자 SoT 연결~~ — 검수 액션·배포 액션 모두 폐기(감사 액션 개정: 검수 4종·`question_published` 폐기).
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
    - 전환 결정: 문제 발원 = 외부(공급) API(**미개발**) — 문제 본문+메타데이터(schema-rule §4 + §7, §7.9·검수 필드 제외)가 **완성 상태로 공급**된다. admin은 문항을 저작·생성·분류·검수하지 않으며, admin 역할 = ①수신·적재(외부 API → Supabase `topik_writing_51/52/53/54_questions`+`question_source_map`) ②관리 포인트=태그(부여/제거) ③노출 통제=`service_status`(기본 `internal_test`)다. v13은 read-only 소비.
    - 검수 개념 전면 삭제: `review_status`·`review_workflow_status`(편차 E1 철회)·`review_passed`·`validation_result` 필드와 검수 화면·검수 쓰기·검수 감사 액션 4종·검수 메모를 admin 표면·스키마·계약·정책에서 제거한다(컬럼 물리 제거는 재정의 P3 마이그레이션). 품질·상태 표현은 태그로만 한다. 상류 push(업로드/배포) 트랙·`question_published`도 폐기. POL-017은 "TOPIK 쓰기 문항 수신·관리 운영정책"으로 재정의, POL-018은 검수 결합 기준 ① 삭제·운영주의 태그 활성 시 `available` 전환 사유 필수·반복과다 `excluded` 권고 유지로 개정.
    - 소멸·해소로 닫힌 기존 갭: ①검수 메모 영구화(구 D-7 — UI-local 가짜 저장 문제는 개념 삭제로 소멸, 2026-06-12에 태그 부여/제거용 운영 메모 필드도 제거) ②P2-5 콘텐츠팀 샘플 승인 대기 ③상류 업로드/upsert 엔드포인트·배포 트리거 미확정 ④문제 번호별 review field profile schema 승격 ⑤배포 승인 체계 — 전부 트랙 소멸로 폐기 처리(상단 `TOPIK 쓰기 문제 검수` 블록 마킹 참조).
    - **신규 갭 ① — 외부 공급 API 미개발(수신 경로 미구현, 차단)**: 문항 수신·적재 경로(외부 API → Supabase)가 공급측 미개발로 구현 불가다. 공급 계약(D-11 재작성: 문항 공급(인바운드) API 계약 요청)이 확정되기 전까지 신규 문항 유입이 없고, `question_received` 감사 액션도 확정 불가다. 인터림은 P2 백필 466행 초기 코퍼스(전 행 `service_status='internal_test'`)로 운영한다. 분류: `미확정 + 누락`(외부 의존 — 차단).
    - **신규 갭 ② — 검수 표면·컬럼 제거(재정의 P3)**: 검수 화면(`/assessment/question-bank`의 검수 흐름·요약 카드·`reviewStatus` 필터, `/assessment/question-bank/review/:questionId` 상세)과 검수 감사 액션 분기가 코드에 잔존해 새 모델(검수 없음)과 어긋났던 갭. → **[2026-06-11 갱신 — 코드 측 해소 완료]** 재정의 P3 코드 컷오버(`202f905`)로 화면 재구성(question-bank=문항 목록(조회), manage=문항 관리(관리 포인트)), 상세 라우트 `/assessment/question-bank/:questionId` 개명, 검수 표면 전면 제거, 스위치 기본값 `topik_writing` 플립이 완료됐다. → **[2026-06-11 재갱신 — 갭 종결]** 검수 4컬럼(`review_status`/`review_workflow_status`/`review_passed`/`validation_result`) 물리 제거 마이그레이션 `0013`도 적용 완료(스냅샷 4테이블 검수 컬럼 0건·뷰 16컬럼·RPC 검수 참조 0건 — 증적 로그 P3 재채점 절, §12.4 P3 = PASS). 분류: `해소`.
    - **P5-1 마스터 조회 surface(2026-06-11 구현)**: 주제/태그 마스터(`topik_writing_topic_master`/`topik_writing_tag_master`) 전수(비활성 포함)를 `/system/metadata`의 `TOPIK 쓰기 마스터 데이터 (읽기 전용)` 섹션에서 조회한다(`src/features/assessment/ui/master-catalog-section.tsx` + facade 카탈로그 로더). 신규 라우트 없음 — P5-2 라우트 동기화는 해당 없음. 추천키/반복방지키 JSONB는 문항 상세 조회로 유지(D-10 비범위).
    - **신규 갭 ③ — tag_master 활성/비활성 write 미개방(P5-3 권장)**: 현행 감사 RPC는 문항용 3종뿐이라 tag_master write에는 전용 RPC 신설(마이그레이션)·platform_admin 가드·신규 Target Type(`admin_audit_logs`)·감사 라벨 결정이 필요했다. → **[2026-06-11 같은 날 해소]** 마이그레이션 0014(`admin_update_tag_master_status` — platform_admin 가드·사유 RPC 단 필수) 적용 + 카탈로그 태그 탭 토글 UI(ConfirmAction 사유 필수) + 신규 감사 계약(`AssessmentTagMaster`/`tag_master_status_changed` — 라벨·딥링크 포함) 결선. 동작 확인 프로브 14단계 ALL PASS(가드 3방향 거부 + platform_admin 화면 왕복 + 감사 2행 역추적 + 원복 — `.omx/evidence/p5-3-tag-master-write-report.json`). 분류: `해소`.
  - `EPS TOPIK`, `레벨 테스트`
    - 여전히 Placeholder이며, 편성/배점/발행/결과 정책의 화면 SoT와 데이터 source 경계가 미정이다.
- 분류
  - `부분 구현 + 미확정`
  - 문항 관리 운영 상태 조치: `해소` (2026-06-11 P4 관리 포인트 개방 — `service_status`+태그 write 활성, RT-4·RLS 네거티브 검증)
  - 메타데이터·태그 스키마 전환: `진행 중` (P0~P5 PASS — 잔여 P6(외부 공급 수신 연동, D-11 회신 게이트))
  - tag_master 활성/비활성 write: `해소` (P5-3 — 2026-06-11 개방, 신규 갭 ③ 종결 기록 참조)
  - 외부 공급 API 미개발(수신 경로): `미확정 + 누락` (공급 계약 확정 전 차단)
  - 검수 표면·컬럼 제거: `해소` (재정의 P3 코드 컷오버 `202f905` + 마이그레이션 `0013` 적용 — 신규 갭 ② 종결 기록 참조)

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

- 2026-06-18 | `System > 감사 로그` mock SoT·실 `admin_audit_logs` 미읽음 해소 | `admin_list_audit_logs(p_target_type, p_target_id, p_keyword, p_start, p_end, p_limit=100, p_offset=0)` 읽기 RPC와 조회 인덱스 2개(`admin_audit_logs_target_lookup_idx`, `admin_audit_logs_created_at_desc_idx`)를 `supabase/migrations-admin/20260618001000_admin_audit_logs_read.sql`(+ down)로 작성했고 `admin_schema_migrations` tracker 기준 2026-06-18 dev DB 적용 완료했다. 화면 service는 `system-audit-logs-data-source.ts`와 `supabase-system-audit-logs-service.ts`를 통해 Supabase 모드에서 live `admin_audit_logs` 단일 source를 읽고, `VITE_SYSTEM_AUDIT_LOGS_SOURCE=mock`이면 기존 mock/store audit 병합 fallback을 사용한다. 잔여 갭은 `diff`/`payload` 민감정보 노출 범위와 일부 엔티티 상세 링크 매핑이다.
- 2026-06-17 | `System > 시스템 로그` mock-only source 테이블화 해소 | `system_logs` Supabase read-only table을 `admin_schema_migrations` tracker 기준 2026-06-17 dev DB 적용 완료했고, 화면 service는 `system-logs-data-source.ts`를 통한 Supabase-backed source와 mock fallback을 가진다. `system_logs`는 7컬럼(`id`, `level`, `message`, `component`, `trace_id`, `context`, `created_at`)이며 `level`은 `INFO`/`WARN`/`ERROR` 대문자 값을 사용한다. 조회 전용 기술 로그라 admin write·감사 액션은 없고, `admin_audit_logs` 및 v13 `notification_log`와 구분한다. 잔여 갭은 로그 적재 소스/주체, 보존기간·파티셔닝, `trace_id` 의미, level 코드값 장기 표준화다.
- 2026-06-17 | `Users > 회원 목록` P0 결손 RPC 라이브 부재 해소 | `get_admin_users`/`admin_set_user_status` RPC 2종을 `supabase/migrations-admin/20260617210000_admin_users_directory.sql`(+ down)로 작성했고 `admin_schema_migrations` tracker 기준 2026-06-17 dev DB 적용 완료했다. 회원 목록은 Supabase 모드에서 v13 `profiles`/`auth.users` 조인과 `writing_submissions` 집계로 실데이터를 읽고, 정지/해제는 `profiles.status`를 `active`/`blocked`로 토글하며 `Target Type=User`, action `user_status_changed` 감사 로그를 남긴다. 신규 테이블은 없고 v13 `profiles` DDL은 변경하지 않는다. 잔여 갭은 관리자 메모 저장 주체, 사유 code/free-text 정책, 상태/기간/searchField 서버 필터 확장이다.
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
- `미확정`: admin 화면 밖 경로(platform_admin 직접 테이블 쓰기)로 활성 정책이 0이 되면 v13은 여전히 fail-closed 500이다. v13 claim의 no-active-policy 폴백 하드닝은 v13 소유 후속 제안으로 남긴다.
- `미확정`: 한도 0(의도적 중단) 시 v13 사용자 카피가 "횟수 소진 + resetAt"이라 중단 의도와 안 맞는다. v13 소유 문구 개선 후보.
