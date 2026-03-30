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

- `src/app/router/app-router.tsx`
- 아래 라우트는 아직 `AdminPlaceholderPage`에 머물러 있어 운영/기능/정책 계약이 코드에 고정되지 않았다.
- `Operation > 챗봇`
- `Commerce > 스토어`
- `Assessment > 문제 은행`
- `Assessment > EPS-TOPIK 문제 은행`
- `Assessment > 레벨 테스트`
- `Content > 콘텐츠 라이브러리`
- `Content > 배지`
- `Content > 어휘`
- `Content > 소나기 어휘`
- `Content > 객관식 어휘`
- `Content > 미션`
- 우선순위: `미확정 + 누락`
- 필요 조치: 각 페이지 IA, 데이터 계약, 감사 로그 계약, URL 복원 규칙, 상태 UX, 상세 진입 패턴을 실제 구현 전 문서와 함께 확정해야 한다.

### 3.3 모듈 명칭과 실제 구현 축 불일치

- `src/app/router/app-router.tsx`
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
- 우선순위: `미확정 + 오구현`
- 필요 조치: 엔티티별 Target Type 표준을 확정하고 감사 로그 목록과 각 페이지 조치 로그를 같은 기준으로 맞춰야 한다.

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
  - 정지/해제/메모 저장은 컴포넌트 로컬 상태만 수정한다.
- 미확정/누락/오구현
  - 조치 결과가 실제 SoT에 반영되지 않아 새로고침 시 유실될 수 있다.
  - 관리자 메모의 저장 주체와 감사 로그 영속 정책이 불명확하다.
  - 조치 사유가 어떤 code table 또는 자유 입력 규칙을 따르는지 확정되지 않았다.
- 분류
  - `오구현`: 조회 SoT와 조치 SoT 불일치
  - `미확정`: 메모/사유의 데이터 계약

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
  - `initialRows`를 페이지 내부에서 관리한다.
- 미확정/누락/오구현
  - 게시글 숨김/노출 정책의 사유 코드와 사후 검증 경로가 없다.
  - 신고, 작성자 제재, 콘텐츠 노출 제한의 연계 정책이 분리되지 않았다.
- 분류
  - `미확정`: 게시글 조치 정책
  - `누락`: 감사 로그/연계 검증 규칙

#### 4.3.2 신고 관리

- 대상 파일: `src/features/community/pages/community-reports-page.tsx`
- 현 상태
  - `initialRows` 기반 정적 데이터
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
  - 저장/발송/토글/삭제는 `useMessageStore()`에 반영
- 미확정/누락/오구현
  - 템플릿 원문, 자동 발송 규칙, 발송 이력의 책임 경계가 조회 API와 조치 store로 분리되어 있다.
  - 발송 채널별 정책 차이(예: 실패 재시도, 예약 가능 범위, 수신 거부 반영)가 코드에 명시되지 않았다.
- 분류
  - `오구현`: read/write SoT 분리
  - `미확정`: 채널별 운영 정책

#### 4.4.2 발송 대상 그룹

- 대상 파일: `src/features/message/pages/message-groups-page.tsx`
- 현 상태
  - 현재 화면은 존재하지만 세그먼트 정의와 실제 사용자 데이터 연결은 mock 스키마 수준이다.
- 미확정/누락/오구현
  - 세그먼트 조건이 실데이터 필드와 1:1로 대응되는지 미확정
  - 그룹 저장 후 실제 발송/미리보기/대상 수 추정 계약이 없다.
- 분류
  - `미확정`: 세그먼트-실데이터 계약
  - `누락`: 그룹 결과 검증 UX

#### 4.4.3 발송 이력

- 대상 파일: `src/features/message/pages/message-history-page.tsx`
- 현 상태
  - 이력 재시도 actor가 하드코딩되어 있다.
- 미확정/누락/오구현
  - 실패 건 재시도 범위, 재시도 정책, 중복 발송 방지 기준이 불명확하다.
  - 이력 상세에서 원본 템플릿/대상 그룹/실패 사유의 역추적 경로가 충분히 고정되지 않았다.
- 분류
  - `미확정`: 재시도 정책
  - `오구현`: actor 하드코딩

#### 4.4.4 Notification 레거시 페이지

- 대상 파일
  - `src/features/notification/pages/notification-send-page.tsx`
  - `src/features/notification/pages/notification-history-page.tsx`
- 현 상태
  - 라우트는 redirect만 사용하고 실페이지는 레거시로 남아 있다.
- 미확정/누락/오구현
  - 제거 대상인지, 내부 호환용 보존 대상인지 명확하지 않다.
- 분류
  - `미확정`: 레거시 정리 정책

### 4.5 Operation

#### 4.5.1 공지사항

- 대상 파일: `src/features/operation/pages/operation-notices-page.tsx`
- 현 상태
  - 비교적 관리자 패턴이 잘 갖춰져 있으나 여전히 mock/store 경계다.
- 미확정/누락/오구현
  - 공지의 게시 범위, 상단 고정, 노출 surface(B2C 앱/웹/센터)별 정책 세분화가 충분히 고정되지 않았다.
  - 에디터 콘텐츠 sanitize/preview 정책이 문서까지 완전히 닫히지 않았다.
- 분류
  - `미확정`: 게시 정책 세분화

#### 4.5.2 FAQ

- 대상 파일: `src/features/operation/pages/operation-faq-page.tsx`
- 현 상태
  - 원문/노출/지표 3탭 구조가 존재한다.
- 미확정/누락/오구현
  - 지표 탭 데이터가 실제 FAQ 노출 결과를 반영하는지, 단순 mock snapshot인지 불명확하다.
  - 대표 FAQ 5개 큐레이션 정책의 노출 우선순위/중복 허용/시간 조건이 아직 고정되지 않았다.
- 분류
  - `미확정`: 큐레이션 정책, 지표 산식

#### 4.5.3 이벤트

- 대상 파일
  - `src/features/operation/pages/operation-events-page.tsx`
  - `src/features/operation/pages/operation-event-create-page.tsx`
  - `src/features/operation/api/events-service.ts`
  - `src/features/operation/model/operation-store.ts`
- 현 상태
  - 목록/상세/등록 상세는 존재한다.
  - 최근 배너 업로드/참조형 입력까지 mock 기준으로 정리되었다.
- 미확정/누락/오구현
  - `rewardPolicyId`, 메시지 템플릿, 대상 그룹 참조는 입력 UI만 있고 실제 관리 주체 페이지/계약이 연결되지 않았다.
  - 참여 현황, 리워드 지급, 발송 템플릿의 후속 운영 플로우가 아직 닫히지 않았다.
  - 배너 파일 업로드가 저장소/서버 업로드 없이 화면 state에만 존재한다.
- 분류
  - `미확정`: 참조 대상 엔티티 소유권
  - `누락`: 업로드 영속 경로, 참여/지급 후속 플로우

#### 4.5.4 정책 관리

- 대상 파일
  - `src/features/operation/pages/operation-policies-page.tsx`
  - `src/features/operation/pages/operation-policy-create-page.tsx`
  - `src/features/operation/api/policies-service.ts`
  - `src/features/operation/model/policy-store.ts`
- 현 상태
  - 목록/상세 Drawer/본문 미리보기/등록 상세/TinyMCE 본문 작성까지 구현되었다.
  - 법률 문서뿐 아니라 커뮤니티 게시글 제재, 추천인 보상, 포인트/쿠폰/이벤트/FAQ/챗봇/메시지/권한 변경 정책까지 `운영 영역`, `정책 추적 상태`, `연관 관리자 화면`, `추적 근거 문서` 기준으로 같은 카탈로그에서 추적한다.
  - `docs/specs/admin-policy-source-map.md`를 기준으로 코드/문서 근거를 정책 관리 seed/UI와 함께 유지한다.
- 미확정/누락/오구현
  - 정책 버전별 diff 검수, 재동의 대상 추적, 문서 승인 체계는 아직 구현되지 않았다.
  - TinyMCE 이미지/자산 업로드의 서버 영속 경로와 sanitize 정책이 아직 고정되지 않았다.
  - cross-page 정책 근거 매핑은 현재 문자열 배열과 MD SoT 조합으로 관리되며, 실데이터/API 단계에서 참조형 엔티티로 승격할지 여부는 아직 미확정이다.
- 분류
  - `미확정`: 버전/재동의/승인 정책, 근거 매핑의 엔티티화 범위
  - `누락`: 에디터 자산 영속 경로

#### 4.5.5 챗봇

- 대상 파일: `src/app/router/app-router.tsx`
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
  - 페이지는 zustand mock store를 직접 읽는다.
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
  - 환불 조치자 `admin_park`가 하드코딩되어 있다.
- 미확정/누락/오구현
  - 부분 환불, 중복 환불 방지, PG 환불 결과 동기화 정책이 없다.
  - 환불 사유와 승인 근거가 code table인지 자유 입력인지 고정되지 않았다.
- 분류
  - `오구현`: actor 하드코딩
  - `미확정`: 환불 정책/계약

#### 4.6.3 쿠폰/포인트/스토어

- 대상 파일
  - `src/app/router/app-router.tsx`
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
    - Free/Pro 플랜 제한, 메시지 템플릿 검수 상태, 회원 그룹/회원 검색, 쿠폰 사용 내역은 실데이터 연동이 아닌 mock 규칙에 머물러 있다.
    - `정기 쿠폰 템플릿`의 저장/수정/발행 중지/재개/삭제는 구현되었지만, 참조 데이터(`쇼핑 등급`, `카테고리`, `상품`)는 아직 mock code table candidate 기준이다.
    - 아임웹 기준의 `적용 제외 상품`, 알림 preview, 시간 단위 제어는 실엔티티 검색/선택 UI, 메시지 템플릿 실연동, API 계약이 확정되지 않아 mock 단계 구현에 머물러 있다.
  - 포인트
    - 포인트 적립 원천 분류(`추천`, `미션`, `이벤트`, `결제`, `환불`, `관리자`, `시스템`)와 원장 단위 SoT가 코드상 확정되지 않았다.
    - 차감/회수 우선순위, 음수 잔액 허용 여부, 수동 조정 승인 체계가 미확정이다.
    - 소멸 예정/보류/복구 정책과 사전 안내 연결 규칙이 미확정이다.
    - 현재 구현은 local mock snapshot과 page-local query store 기준이라 실제 사용자 포인트 잔액, 주문/환불 원장, 메시지 발송 이력과 아직 연결되지 않았다.
    - `정책 등록/수정`은 현재 Modal 기반인데, 공통 UX 문서상 작성/편집 맥락이 강한 화면은 전용 편집 페이지 또는 별도 편집 영역을 우선한다. 포인트 정책 편집도 메타데이터 중심 전용 화면으로 승격할지 후속 결정이 필요하다.
  - 스토어
    - 스토어 상품/재고/노출 정책이 코드상 전혀 고정되지 않았다.
- 분류
  - 쿠폰: `미확정`
  - 포인트: `미확정`
  - 스토어: `미확정 + 누락`

### 4.7 Assessment

- 대상 파일: `src/features/assessment/pages/assessment-question-bank-page.tsx`, `src/features/assessment/api/assessment-question-bank-service.ts`, `src/features/assessment/model/assessment-question-bank-store.ts`, `src/app/router/app-router.tsx`
- 현 상태
  - `TOPIK 쓰기 문제은행`은 mock service/store 기반 실페이지로 전환되었고, `EPS TOPIK`, `레벨 테스트`는 아직 Placeholder
- 미확정/누락/오구현
  - `TOPIK 쓰기 문제은행`
    - 검수 상태와 운영 상태는 분리 구현됐지만, 최종 공개/숨김 정책과 승인 체계는 아직 확정되지 않았다.
    - AI 재생성, 배치 재시도, 프롬프트 버전 비교, 검수 히스토리 diff는 아직 구현되지 않았다.
    - EPS TOPIK / 레벨 테스트 세트 편성 화면에서 검수 완료 문항을 소비하는 계약은 후속 구현이 필요하다.
  - `EPS TOPIK`, `레벨 테스트`
    - 여전히 Placeholder이며, 편성/배점/발행/결과 정책의 화면 SoT와 데이터 source 경계가 미정이다.
- 분류
  - `부분 구현 + 미확정`

### 4.8 Content

- 대상 파일: `src/app/router/app-router.tsx`
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
  - 전부 local zustand store 기반
  - 권한 변경 actor 하드코딩
- 미확정/누락/오구현
  - 실제 RBAC 모델과 화면 권한 매트릭스가 문서/코드에 완전히 고정되지 않았다.
  - 권한 변경 승인 절차, 2인 승인 여부, 즉시 반영/세션 재검증 정책이 없다.
- 분류
  - `미확정`: 권한 정책
  - `오구현`: actor 하드코딩, mock-only SoT

#### 4.10.2 감사 로그

- 대상 파일: `src/features/system/pages/system-audit-logs-page.tsx`
- 현 상태
  - 일부는 `permissionAudits`에서, 일부는 `staticRows`에서 조합한다.
- 미확정/누락/오구현
  - 도메인별 감사 로그가 단일 SoT가 아니라 페이지 내부 정적 행과 섞여 있다.
  - `Target Type`이 범용적이며, 상세 링크 매핑도 일부 엔티티만 처리한다.
- 분류
  - `오구현`: 감사 로그 SoT 혼합
  - `미확정`: 엔티티별 링크 매핑

#### 4.10.3 시스템 로그

- 대상 파일: `src/features/system/pages/system-logs-page.tsx`
- 현 상태
  - 정적 rows 배열 기반
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
- 미확정/누락/오구현
  - 실제 API/DB 테이블(`system_metadata_groups`, `system_metadata_group_items`, `system_metadata_group_histories`)과 승인 절차는 아직 문서 후보 단계다.
  - 메타 항목 조치를 그룹 단위 `Target Type = SystemMetadataGroup`으로 묶을지, item-level Target Type을 분리할지는 미확정이다.
- 분류
  - `미확정`: API/DB 계약, 승인 절차, item-level 감사 로그 세분화

## 5. 우선 정리 권장 순서

1. 인코딩 깨짐과 전역 한글 라벨 복구
2. 감사 로그 Target Type 표준화와 hardcoded actor 제거
3. Dashboard / Users / Community / Message / Commerce / Analytics / System의 page-local 또는 mock-only 조치 SoT 정리
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

- 2026-03-27 | `System > 메타데이터 관리` 관리 위치 계층 UX 보강 | `src/features/system/pages/system-metadata-page.tsx`, `src/features/system/model/system-metadata-store.ts`, `docs/specs/page-ia/system-metadata-page-ia.md`, `docs/specs/admin-page-tables.md`를 기준으로 목록의 `관리 위치`를 `route > 세부 위치` 형태로 읽히게 바꾸고, 상세 Drawer에는 Breadcrumb 기반 위치 카드와 `설정 그룹 -> 관리 위치 -> 운영 값 -> 사용자 영향` Tree를 추가했습니다. 메타데이터가 계층형 구조를 가진다는 점을 비개발자 운영자도 한눈에 이해할 수 있도록 위치 정보와 구조 정보를 같은 화면에서 검수하게 정리했습니다.
- 2026-03-27 | `System > 메타데이터 관리` 목록 압축과 Tree 기반 운영 값 관리 보강 | `src/features/system/pages/system-metadata-page.tsx`, `src/features/system/model/system-metadata-store.ts`, `tests/e2e/system-metadata.spec.ts`, `docs/specs/page-ia/system-metadata-page-ia.md`, `docs/specs/admin-page-tables.md`를 기준으로 목록 행에서 그룹 ID/설명/관리 방식/총 개수 같은 보조 텍스트를 제거하고, 상세 Drawer `설정 구조`를 `설정 그룹 -> 운영 값 -> 추가` Tree로 단순화했습니다. 운영 값은 Tree와 테이블에서 모두 드래그 정렬할 수 있게 바꾸고, 순서 변경은 `item_reordered` 이력과 감사 로그로 추적하도록 정리했습니다.
- 2026-03-27 | `System > 메타데이터 관리` mock 기준 운영 값 중복 체크 추가 | `src/features/system/pages/system-metadata-page.tsx`, `src/features/system/api/system-metadata-service.ts`, `tests/e2e/system-metadata.spec.ts`, `docs/specs/page-ia/system-metadata-page-ia.md`, `docs/specs/admin-page-tables.md`, `docs/specs/admin-data-contract.md`를 기준으로 운영 값 등록/수정 Modal에 같은 설정 그룹 안의 코드/라벨 중복 validator를 추가하고, 저장 시 service에서도 한 번 더 차단하도록 정리했습니다. 실제 DB unique 제약은 아직 없지만 mock 단계에서도 중복 데이터가 섞이지 않도록 입력 UX와 write path를 같이 맞췄습니다.
- 2026-03-27 | `System > 메타데이터 관리` 첫 진입 운영자용 설명 레이어 보강 | `src/features/system/pages/system-metadata-page.tsx`, `docs/specs/page-ia/system-metadata-page-ia.md`, `docs/specs/admin-page-tables.md`를 기준으로 페이지 상단 3단계 사용 가이드, 섹션 caption, Tooltip 설명 아이콘, Modal 안내 Alert를 추가했습니다. 운영자가 이 페이지 목적과 사용 순서를 처음부터 이해하기 어렵던 문제를 설명 레이어로 보완했습니다.
- 2026-03-27 | `System > 메타데이터 관리` 기능/사용처 중심 UX 재구성 | `src/features/system/pages/system-metadata-page.tsx`, `tests/e2e/system-metadata.spec.ts`, `docs/specs/page-ia/system-metadata-page-ia.md`, `docs/specs/admin-page-tables.md`를 기준으로 페이지 제목과 안내 문구를 `운영 설정 카탈로그` 관점으로 바꾸고, 목록 컬럼/상세 Drawer 섹션 순서를 `설정 -> 사용처 -> 운영 값 -> 영향 범위` 중심으로 재배치했습니다. 기존 메타데이터 레지스트리처럼 보이던 정보 구조를 운영자 업무 언어로 바꿔 비개발자도 페이지 역할을 바로 이해할 수 있게 정리했습니다.
- 2026-03-27 | `System > 메타데이터 관리` 상세 Drawer/입력 Modal UI 일관성 복구 | `src/shared/ui/detail-drawer/detail-drawer.tsx`, `src/shared/ui/descriptions/admin-form-descriptions.tsx`, `src/features/system/pages/system-metadata-page.tsx`, `tests/e2e/system-metadata.spec.ts`를 기준으로 상세 Drawer 폭을 shared preset(기본 `760`)으로 되돌리고, Drawer 내부 테이블은 shared drawer table helper를 사용하도록 정리했습니다. 그룹/항목 Modal도 `Descriptions` 기반 shared 입력 wrapper로 치환해 page-local `Form.Item` 세로 나열 예외를 제거했고, e2e에는 Drawer 폭과 `Descriptions` 구조 검증을 추가했습니다.
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
