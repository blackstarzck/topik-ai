# TOPIK AI Admin 데이터 계약 가이드

## 1. 목적

- 이 문서는 관리자 프론트엔드 단계에서 미래 데이터베이스/API를 염두에 두고 엔티티명, 테이블명 후보, 필드명, 변수명, enum/code table 후보를 정리하는 선행 계약 문서다.
- 목표는 화면 안에 남아 있는 하드코딩 데이터와 휘발성 변수를 page-local 임시값으로 방치하지 않고, 이후 실제 저장소 구조로 이관하기 쉬운 기준을 유지하는 것이다.
- 실제 백엔드 스키마 확정 문서는 아니며, 프론트엔드가 먼저 맞춰야 할 명명 규칙과 검수 기준, 리뷰 완료 범위를 관리한다.

## 2. 적용 범위

- 사이드바 순서로 검수하는 모든 관리자 페이지에 적용한다.
- 현재 기준 모듈 순서: `Dashboard -> Users -> Community -> Message -> Operation -> Commerce -> Assessment -> Content -> Analytics -> System`
- 이 문서는 페이지 IA, 테이블 스펙, 데이터 사용 맵과 함께 읽는다.
  - 화면 블록과 운영 흐름: `docs/specs/page-ia/*.md`
  - 목록/상세 필드와 검색/정렬: `docs/specs/admin-page-tables.md`
  - B2C 노출 위치와 사용 맥락: `docs/specs/admin-data-usage-map.md`
  - mock/store/service 경계: `docs/architecture/admin-data-source-transition.md`

## 3. 매 작업에서 반드시 확인할 항목

- 데이터 정합성: 같은 개념의 데이터가 페이지, store, service, mock, 문서에서 서로 다른 구조나 이름으로 중복되지 않는지 확인한다.
- 용어 정합성: 메뉴명, 상태값, 액션명, 감사 로그 대상명이 기존 계약과 충돌하지 않는지 확인한다.
- 키워드 정합성: 검색어, 필터, 정렬, URL 파라미터 명이 화면/문서/API 후보와 일관되는지 확인한다.
- 변수명 정합성: page, store, service, mock에서 같은 필드를 다른 이름으로 부르지 않는지 확인한다.
- 필수 입력 노출 정합성: `schema candidate` 또는 저장 계약상 비워둘 수 없는 필드는 등록/생성 UI의 `Descriptions` label(`th`)에서 빨간 `*`로 표시되는지 확인한다.
- 관리자 패턴 이탈 여부: 요청이 일반적인 관리자 흐름 `검색 -> 상세 -> 조치 -> 감사 로그 확인`과 다르면 이유와 운영상 필요를 먼저 설명한다.

## 4. 명명 기준

### 4.1 엔티티명

- 도메인 엔티티명은 영어 단수형 PascalCase를 기본값으로 사용한다.
- 기존 코드가 이미 모듈 접두를 포함해 정착했다면 그 이름을 우선 존중한다.
- 예시: `User`, `Instructor`, `Referral`, `CommunityPost`, `CommunityReport`, `MessageTemplate`, `MessageGroup`, `MessageHistory`, `OperationNotice`, `OperationFaq`, `OperationEvent`, `OperationPolicy`, `OperationPolicyHistoryEntry`

### 4.2 테이블명 후보

- 데이터베이스 테이블명 후보는 영어 복수형 snake_case를 기본값으로 사용한다.
- 모듈 접두가 없으면 다른 도메인과 충돌하거나 의미가 약해지는 경우에만 모듈 접두를 붙인다.
- 예시: `users`, `instructors`, `referrals`, `community_posts`, `community_reports`, `message_templates`, `message_groups`, `message_histories`, `message_history_recipients`, `operation_notices`, `operation_faqs`, `operation_faq_curations`, `operation_faq_metrics`, `operation_events`, `operation_policies`, `operation_policy_histories`

### 4.3 컬럼명/필드명 후보

- 데이터베이스 컬럼명 후보는 snake_case를 기본값으로 사용한다.
- TypeScript/interface/service 필드명은 camelCase를 기본값으로 사용한다.
- DB/API/TS 사이의 대응 관계는 1:1로 추적 가능해야 한다.
- 예시: `updated_at <-> updatedAt`, `target_id <-> targetId`, `last_login_at <-> lastLoginAt`

### 4.4 enum/code table 후보

- 상태값, 카테고리, 채널, 권한 코드처럼 고정 집합이 있는 값은 자유 텍스트로 두지 않는다.
- 동일 값이 여러 페이지/모듈에서 반복되면 enum 또는 code table 후보로 분류한다.
- 사용자 노출 한글 라벨과 내부 코드값이 다르면 둘 다 문서에 남긴다.

## 5. 하드코딩 분류 기준

- `schema candidate`
  - 나중에 DB 컬럼 또는 API 필드가 될 가능성이 높은 값
  - page-local 상수/배열/상태에 두지 않는다
- `code table candidate`
  - 상태, 카테고리, 채널, 세그먼트 옵션처럼 메타데이터 API 또는 코드 테이블로 이동할 가능성이 높은 값
  - `model/*-schema.ts` 또는 feature schema 파일로 올린다
- `ui-only`
  - persistence와 무관한 안내 문구, placeholder, 데모용 렌더링 보조값
  - 로컬 보관 가능

## 6. 구현 원칙

- page 컴포넌트는 persistence 후보인 `initialRows`, `mockRows`, 정책 배열, 상태 옵션, 검색 필드 정의를 직접 소유하지 않는 것을 기본 원칙으로 한다.
- read-only 더미 데이터도 가능하면 `api/mock-*.ts`, seed helper, store, schema 파일로 분리한다.
- 조치 후 목록/상세가 함께 반응하는 데이터는 page가 아니라 feature store 또는 service 경계에서 관리한다.
- 고정 옵션과 query builder metadata는 `model/*-schema.ts`를 단일 SoT로 둔다.
- 페이지는 service 계약만 알고, mock/store/API/DB 구현 차이는 service 뒤로 숨긴다.

## 7. 검수 완료 범위 (2026-03-20)

### 7.1 범위

- `Users`
  - 회원 목록
  - 강사 관리
  - 추천인 관리
  - 회원 상세
- `Community`
  - 게시글 관리
  - 신고 관리
- `Message`
  - 메일
  - 푸시
  - 대상 그룹
  - 발송 이력
  - 메시지 템플릿 등록 상세
- `Operation`
  - 공지사항
  - 공지사항 등록 상세
  - FAQ
  - 정책 관리
  - 정책 등록 상세
  - 이벤트
  - 이벤트 등록 상세
- `Commerce`
  - 포인트 관리

### 7.2 페이지별 계약/검수 요약

| 사이드바 경로                    | 엔티티 후보                                                             | 테이블 후보                                                                                                 | 데이터 소스 구조                                                                                      | 하드코딩 분류                                                                                                                                                                                                                     | 관리자 패턴 검수                                                                                                                            | 상태   |
| -------------------------------- | ----------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- | ------ |
| `Users > 회원 목록`              | `User`                                                                  | `users`                                                                                                     | `users-service.ts` + `mock-users.ts` + query store                                                    | 검색 상태는 `schema candidate`, 상태값은 enum 후보                                                                                                                                                                                | `검색 -> 상세(이동) -> 조치 -> 감사 로그 확인` 유지                                                                                         | `PASS` |
| `Users > 강사 관리`              | `Instructor`                                                            | `instructors`                                                                                               | `instructors-service.ts` + `mock-instructors.ts`                                                      | 국가/소속/활동상태는 `code table candidate`                                                                                                                                                                                       | 행 클릭 `DetailDrawer`와 조치/감사 로그 흐름 일치                                                                                           | `PASS` |
| `Users > 추천인 관리`            | `Referral`                                                              | `referrals`, `referral_relations`, `referral_reward_ledgers`                                                | `referrals-service.ts` + `mock-referrals.ts`                                                          | 상태/이상치/리워드 유형은 `code table candidate`                                                                                                                                                                                  | 행 클릭 `DetailDrawer`와 조치/감사 로그 흐름 일치                                                                                           | `PASS` |
| `Users > 회원 상세`              | `User` + 하위 컬렉션                                                    | `users`, `user_activities`, `user_payments`, `user_community_posts`, `user_access_logs`, `user_admin_memos` | 페이지가 `mock-users`와 로컬 배열을 직접 사용                                                         | 활동/결제/커뮤니티/로그/메모 배열이 모두 `schema candidate`                                                                                                                                                                       | 상세 진입 자체는 맞지만 하위 데이터가 service 경계 밖에 있음                                                                                | `FAIL` |
| `Community > 게시글 관리`        | `CommunityPost`                                                         | `community_posts`, `community_post_admin_notes`                                                             | 페이지가 `initialRows`를 직접 소유                                                                    | 게시글 본문, 상태, 메모, 정책 코드 모두 `schema candidate`                                                                                                                                                                        | 행 클릭 `DetailDrawer`는 적절하나 데이터 SoT 위반                                                                                           | `FAIL` |
| `Community > 신고 관리`          | `CommunityReport`                                                       | `community_reports`                                                                                         | 페이지가 `initialRows`를 직접 소유                                                                    | 신고 사유/처리상태/대상 식별자 모두 `schema candidate`                                                                                                                                                                            | 목록 조치와 상세가 분리된 `Modal` 중심이라 표준 흐름보다 약함                                                                               | `FAIL` |
| `Message > 메일`                 | `MessageTemplate`                                                       | `message_templates`                                                                                         | `messages-service.ts` + `message-store.ts`                                                            | 채널/모드/상태/카테고리는 `code table candidate`                                                                                                                                                                                  | 목록 -> 등록 상세 -> 발송/삭제 -> 감사 로그 흐름 유지                                                                                       | `PASS` |
| `Message > 푸시`                 | `MessageTemplate`                                                       | `message_templates`                                                                                         | `messages-service.ts` + `message-store.ts`                                                            | 채널/모드/상태/카테고리는 `code table candidate`                                                                                                                                                                                  | 목록 -> 등록 상세 -> 발송/삭제 -> 감사 로그 흐름 유지                                                                                       | `PASS` |
| `Message > 대상 그룹`            | `MessageGroup`                                                          | `message_groups`, `message_group_rules`                                                                     | `messages-service.ts` + `message-store.ts` + `message-group-segment-schema.ts`                        | 세그먼트 필드/옵션은 `code table candidate`, 그룹 메타는 `schema candidate`                                                                                                                                                       | 생성/수정 Drawer와 재계산/삭제/감사 로그 흐름 일치                                                                                          | `PASS` |
| `Message > 발송 이력`            | `MessageHistory`                                                        | `message_histories`, `message_history_recipients`                                                           | `messages-service.ts` + `message-store.ts`                                                            | 상태/액션 타입은 `code table candidate`                                                                                                                                                                                           | 행 클릭 `DetailDrawer`, 재시도, 감사 로그 흐름 일치                                                                                         | `PASS` |
| `Message > 템플릿 등록 상세`     | `MessageTemplate`                                                       | `message_templates`                                                                                         | store 직접 조회 + 저장                                                                                | 본문/제목/타겟 그룹은 `schema candidate`                                                                                                                                                                                          | 편집형 상세 페이지 패턴으로 허용 가능                                                                                                       | `WARN` |
| `Operation > 공지사항`           | `OperationNotice`                                                       | `operation_notices`                                                                                         | `notices-service.ts` + `operation-store.ts`                                                           | 상태값은 `code table candidate`, HTML 본문은 `schema candidate`                                                                                                                                                                   | 목록/미리보기/게시 조치/감사 로그 흐름 유지                                                                                                 | `PASS` |
| `Operation > 공지사항 등록 상세` | `OperationNotice`                                                       | `operation_notices`                                                                                         | `fetchNoticeSafe` + `saveNoticeSafe`                                                                  | 제목/본문은 `schema candidate`                                                                                                                                                                                                    | 등록 상세 페이지 패턴으로 적절                                                                                                              | `PASS` |
| `Operation > FAQ`                | `OperationFaq` + `OperationFaqCuration` + `OperationFaqMetric`          | `operation_faqs`, `operation_faq_curations`, `operation_faq_metrics`                                        | `faqs-service.ts` + `operation-store.ts` + `faq-schema.ts`                                            | 카테고리/공개상태/노출 위치/설정 방식/노출 상태는 `code table candidate`, 질문/답변/검색 키워드/노출 순서/지표는 `schema candidate`                                                                                               | 행 클릭 `DetailDrawer`, FAQ 조치와 FAQ 노출 조치를 분리한 감사 로그 흐름 유지                                                               | `PASS` |
| `Operation > 정책 관리`          | `OperationPolicy`, `OperationPolicyHistoryEntry`                        | `operation_policies`, `operation_policy_histories`                                                          | `policies-service.ts` + `policy-store.ts`                                                             | 운영 영역/정책 유형/노출 위치/추적 상태/상태/히스토리 조치 코드와 연관 관리자/사용자 화면 옵션값은 `code table candidate`, 문서명/버전/시행일/연관 관리자 화면 선택값/연관 사용자 화면 선택값/추적 근거 문서/요약/법령/본문 HTML/관리자 메모/히스토리 사유/히스토리 snapshot은 `schema candidate` | 목록 검색/상세 Drawer/히스토리 expandable row/히스토리 `본문 보기`/히스토리 `이 버전 게시`/본문 미리보기/게시-숨김/삭제/감사 로그 흐름 유지 | `PASS` |
| `Operation > 정책 등록 상세`     | `OperationPolicy`                                                       | `operation_policies`                                                                                        | `fetchPolicySafe` + `savePolicySafe`                                                                  | TinyMCE 본문, 법령/근거, 동의 필요 여부, 연관 관리자/사용자 화면 선택값, 추적 근거 문서는 `schema candidate`                                                                                                                                  | 단계형 등록 상세 페이지 패턴과 목록 복귀 URL 복원 기준, `정책 등록`/`내용 수정`/`새 버전 등록` 3개 editor mode가 구현과 정렬됨              | `PASS` |
| `Operation > 이벤트`             | `OperationEvent`                                                        | `operation_events`                                                                                          | `events-service.ts` + `operation-store.ts`                                                            | 유형/진행 상태/노출 상태/indexingPolicy는 `code table candidate`, 본문 HTML/보상/배너/랜딩/SEO 메타는 `schema candidate`                                                                                                          | 목록 검수 + 상세 Drawer + 감사 로그 흐름 구현 기준이 코드와 문서에 정렬됨                                                                   | `PASS` |
| `Operation > 이벤트 등록 상세`   | `OperationEvent`                                                        | `operation_events`                                                                                          | `fetchEventSafe` + `saveEventSafe` + `scheduleEventPublishSafe`                                       | 본문 HTML/참여 조건/보상 정책/SEO override 필드는 `schema candidate`                                                                                                                                                              | 등록 상세 페이지 패턴과 저장/게시 예약 경계가 구현 기준으로 정렬됨                                                                          | `PASS` |
| `Commerce > 쿠폰 관리`           | `CommerceCoupon`, `CommerceCouponSubscriptionTemplate`                  | `commerce_coupons`, `commerce_coupon_subscription_templates`                                                | `coupons-service.ts` + `coupon-store.ts` + `coupon-form-schema.ts` + `coupon-template-form-schema.ts` | 상태/혜택/적용 범위/알림 채널/쇼핑 등급/카테고리/상품 참조는 `code table candidate`, 쿠폰/템플릿 메타와 관리자 메모는 `schema candidate`                                                                                          | 목록/템플릿 탭/상세 Drawer/감사 로그 흐름 구현 기준이 정렬됨                                                                                | `PASS` |
| `Commerce > 포인트 관리`         | `CommercePointPolicy`, `CommercePointLedger`, `CommercePointExpiration` | `commerce_point_policies`, `commerce_point_ledgers`, `commerce_point_expirations`                           | placeholder, 문서 기준 `points-service.ts` + `point-store.ts` + `point-schema.ts` 후보                | 정책 상태/정책 유형/원장 유형/발생 원천/소멸 상태는 `code table candidate`, 적립/차감 수량, 잔액, 소멸 예정일, 사유는 `schema candidate`                                                                                          | `탭 -> 목록 -> 상세 Drawer/Modal -> 조치 -> 감사 로그 확인` 초안 확정                                                                       | `WARN` |

## 8. 우선 수정 필요 항목

### 8.1 P1

- `Users > 회원 상세`
  - `getMockUserById` 직접 호출과 탭별 로컬 배열이 page 안에 남아 있다.
  - 이후 API 연결 시 `user detail aggregate` service 또는 `users-detail-service.ts` 계층이 필요하다.
- `Community > 게시글 관리`
  - 게시글 본문, 관리자 메모, 정책 코드가 페이지 내부 `initialRows`에 묶여 있다.
  - `community-posts-service.ts`와 `community` feature model/store가 먼저 필요하다.
- `Community > 신고 관리`
  - 신고 목록과 처리 상태가 페이지 내부 `initialRows`에 묶여 있다.
  - `community-reports-service.ts`와 model/store 분리가 우선이다.

### 8.2 P2

- `Community > 신고 관리`
  - 목록의 조치 메뉴와 별도의 `TableRowDetailModal`이 분리되어 있어 표준 관리자 흐름보다 약하다.
  - 향후에는 행 클릭 `DetailDrawer` 안에서 신고 정보, 게시글 링크, 사용자 링크, 처리/감사 로그 확인을 한 흐름으로 묶는 편이 적절하다.
- `Message`, `Operation`
  - 감사 로그 `Target Type`이 각각 `Message`, `Operation` 단일 값으로 묶여 있다.
- 현재 ID prefix로는 구분 가능하지만, 장기적으로는 `MessageTemplate`, `MessageGroup`, `MessageHistory`, `OperationNotice`, `OperationFaq`, `OperationPolicy`처럼 엔티티 단위 식별이 더 안정적이다.

### 8.3 P3

- `Commerce > 포인트 관리`
  - 페이지 IA 기준으로 `정책 / 포인트 원장 / 소멸 예정` 3탭 구조와 감사 로그 `Target Type` 초안은 정리되었지만, 코드 구현은 아직 placeholder다.
  - 구현 전 `points-service.ts`, `point-store.ts`, `point-schema.ts` 경계와 수동 조정/소멸 보류 승인 체계를 먼저 확정해야 한다.

## 9. 페이지별 필드/키워드/변수명 기준

### 9.1 Users

- `Users > 회원 목록`
  - query: `page`, `pageSize`, `sort`, `status`, `searchField`, `startDate`, `endDate`, `keyword`
  - 핵심 필드: `id`, `realName`, `email`, `nickname`, `joinedAt`, `lastLoginAt`, `status`, `tier`, `subscriptionStatus`
  - v13 source: `realName`은 `profiles.display_name`, `nickname`은 `profiles.nickname`을 사용한다. `get_admin_users` RPC가 `nickname`을 누락하는 경우 service 계층에서 `profiles(id,nickname)`을 보강 조회하며, 두 필드가 `NULL`이면 이메일/ID/local-part fallback을 만들지 않고 UI에서 `-`로 표시한다.
- `Users > 강사 관리`
  - query: `page`, `pageSize`, `sort`, `status`, `activityStatus`, `country`, `organization`, `searchField`, `startDate`, `endDate`, `keyword`
  - 핵심 필드: `id`, `realName`, `email`, `organization`, `country`, `status`, `activityStatus`, `assignmentStatus`, `courseCount`, `studentCount`, `lastActivityAt`, `lastActionAt`
- `Users > 추천인 관리`
  - query: `page`, `pageSize`, `sort`, `searchField`, `status`, `anomalyStatus`, `startDate`, `endDate`, `keyword`
  - 핵심 필드: `id`, `code`, `referrerUserId`, `referrerName`, `status`, `anomalyStatus`, `referredCount`, `confirmedCount`, `totalRewardAmount`, `lastUsedAt`, `lastActionAt`
- `Users > 회원 상세`
  - URL: `tab`
  - 하위 컬렉션 후보: `activities`, `payments`, `communityPosts`, `accessLogs`, `adminMemos`

### 9.2 Community

- `Community > 게시글 관리`
  - query: `searchField`, `startDate`, `endDate`, `keyword`, `board`, `status`
  - 핵심 필드 후보: `id`, `title`, `content`, `contentHtml`, `authorId`, `authorName`, `board`, `createdAt`, `views`, `comments`, `reports`, `status`, `lastModerationPolicyCode`, `lastModerationReason`, `lastModeratedAt`
- `Community > 신고 관리`
  - query: `searchField`, `startDate`, `endDate`, `keyword`, `status`
  - 핵심 필드 후보: `id`, `targetPostId`, `targetUserId`, `targetUserName`, `reporterId`, `reporterName`, `reason`, `createdAt`, `processStatus`

### 9.3 Message

- `Message > 메일/푸시`
  - query: `tab`, `searchField`, `startDate`, `endDate`, `keyword`, `selected`
  - 핵심 필드: `id`, `channel`, `mode`, `category`, `name`, `summary`, `subject`, `targetGroupIds`, `status`, `triggerLabel`, `bodyHtml`, `bodyJson`, `lastSentAt`, `updatedAt`, `updatedBy`
- `Message > 대상 그룹`
  - query: `searchField`, `startDate`, `endDate`, `keyword`, `selected`, `editor`
  - 핵심 필드: `id`, `name`, `description`, `definitionType`, `builderMode`, `channels`, `memberCount`, `ruleSummary`, `status`, `staticMembers`, `filters`, `queryBuilderText`, `queryBuilderConfig`, `lastCalculatedAt`, `updatedAt`, `updatedBy`
- `Message > 발송 이력`
  - query: `channel`, `mode`, `searchField`, `startDate`, `endDate`, `keyword`, `selected`
  - 핵심 필드: `id`, `channel`, `mode`, `templateId`, `templateName`, `groupIds`, `groupName`, `targetCount`, `successCount`, `failureCount`, `status`, `actionType`, `scheduledAt`, `sentAt`, `actor`

### 9.4 Operation

- `Operation > 공지사항`
  - query: `status`, `sortField`, `sortOrder`, `preview`
  - 핵심 필드: `id`, `title`, `author`, `createdAt`, `status`, `bodyHtml`, `updatedAt`, `updatedBy`
- `Operation > 정책 관리`
  - query: `status`, `category`, `policyType`, `trackingStatus`, `summaryFilter`, `sortField`, `sortOrder`, `searchField`, `keyword`, `startDate`, `endDate`, `selected`
- 핵심 필드: `id`, `category`, `policyType`, `title`, `versionLabel`, `effectiveDate`, `exposureSurfaces`, `requiresConsent`, `trackingStatus`, `relatedAdminPages`, `relatedUserPages`, `sourceDocuments`, `summary`, `legalReferences`, `bodyHtml`, `adminMemo`, `status`, `createdAt`, `updatedAt`, `updatedBy`, `policyHistories[].id`, `policyHistories[].action`, `policyHistories[].versionLabel`, `policyHistories[].status`, `policyHistories[].trackingStatus`, `policyHistories[].changedAt`, `policyHistories[].changedBy`, `policyHistories[].note`, `policyHistories[].snapshot`
- `Operation > 정책 등록 상세`
  - query: 목록 복귀용 `status`, `category`, `policyType`, `trackingStatus`, `sortField`, `sortOrder`, `searchField`, `keyword`, `startDate`, `endDate`
- 핵심 필드: `id`, `category`, `policyType`, `title`, `versionLabel`, `effectiveDate`, `exposureSurfaces`, `requiresConsent`, `trackingStatus`, `relatedAdminPages`, `relatedUserPages`, `sourceDocuments`, `summary`, `legalReferences`, `bodyHtml`, `adminMemo`, `status`, `updatedAt`, `updatedBy`
- `Operation > FAQ`
  - query:
    - 공통: `tab`
    - FAQ 마스터: `searchField`, `keyword`, `startDate`, `endDate`, `category`, `status`, `sortField`, `sortOrder`, `selected`
    - 노출 관리: `curationSearchField`, `curationKeyword`, `curationSurface`, `curationMode`, `curationExposureStatus`, `curationSortField`, `curationSortOrder`, `curationSelected`
    - 지표 보기: `metricSearchField`, `metricKeyword`, `metricSortField`, `metricSortOrder`
  - 핵심 필드:
    - FAQ 원문: `id`, `question`, `answer`, `searchKeywords`, `category`, `status`, `createdAt`, `updatedAt`, `updatedBy`
    - FAQ 노출: `id`, `faqId`, `surface`, `curationMode`, `displayRank`, `exposureStatus`, `pinnedStartAt`, `pinnedEndAt`, `updatedAt`, `updatedBy`
    - FAQ 지표: `faqId`, `viewCount`, `searchHitCount`, `helpfulCount`, `notHelpfulCount`, `lastViewedAt`
- `Operation > 이벤트`
  - query: `searchField`, `keyword`, `startDate`, `endDate`, `status`, `eventType`, `sortField`, `sortOrder`, `selected`
  - 핵심 필드: `id`, `title`, `summary`, `bodyHtml`, `eventType`, `progressStatus`, `visibilityStatus`, `startAt`, `endAt`, `exposureChannels`, `targetGroupId`, `targetGroupName`, `participantCount`, `participantLimit`, `rewardType`, `rewardPolicyId`, `rewardPolicyName`, `rewardPolicySummary`, `bannerImageUrl`, `landingUrl`, `messageTemplateName`, `slug`, `metaTitle`, `metaDescription`, `ogImageUrl`, `canonicalUrl`, `indexingPolicy`, `adminMemo`, `updatedAt`, `updatedBy`
- `Operation > 이벤트 등록 상세`
  - query: 목록 복귀용 `searchField`, `keyword`, `startDate`, `endDate`, `status`, `eventType`, `sortField`, `sortOrder`
  - 핵심 필드: `id`, `slug`, `title`, `summary`, `bodyHtml`, `eventType`, `progressStatus`, `visibilityStatus`, `startAt`, `endAt`, `exposureChannels`, `targetGroupId`, `targetGroupName`, `participantLimit`, `rewardType`, `rewardPolicyId`, `rewardPolicyName`, `bannerImageUrl`, `landingUrl`, `messageTemplateName`, `metaTitle`, `metaDescription`, `ogImageUrl`, `canonicalUrl`, `indexingPolicy`, `adminMemo`, `updatedAt`, `updatedBy`

### 9.5 Commerce

- `Commerce > 쿠폰 관리`
  - 공통 query: `view`, `keyword`, `selected`
  - `쿠폰 목록` 탭 query: `statusTab`, `couponKind`, `sortField`, `sortOrder`
  - `정기 쿠폰 템플릿` 탭 query: `view=subscriptionTemplate`, `templateStatus`
  - 핵심 필드:
    - 쿠폰: `couponId`, `couponName`, `couponKind`, `couponStatus`, `issueState`, `issueTargetType`, `targetGroupIds`, `targetUserIds`, `benefitType`, `benefitValue`, `maxDiscountAmount`, `minOrderAmount`, `applicableScope`, `isStackable`, `validityMode`, `validFrom`, `validUntil`, `expireAfterDays`, `issueCount`, `downloadCount`, `useCount`, `issueAlertEnabled`, `expireAlertEnabled`, `adminMemo`, `updatedAt`, `updatedBy`
    - 정기 쿠폰 템플릿: `templateId`, `templateName`, `targetGradeIds`, `benefitType`, `benefitValue`, `maxDiscountAmount`, `minOrderAmount`, `applicableScope`, `applicableScopeReferenceIds`, `excludedProductMode`, `excludedProductIds`, `isStackable`, `issueSchedule`, `usageEndSchedule`, `status`, `issuedCouponCount`, `lastIssuedAt`, `nextIssuedAt`, `issueAlertEnabled`, `expireAlertEnabled`, `alertChannel`, `adminMemo`, `updatedAt`, `updatedBy`
- `Commerce > 포인트 관리`
  - 공통 query: `tab`, `selected`
  - `정책` 탭 query: `policyPage`, `policyPageSize`, `policySearchField`, `policyKeyword`, `policyStatus`, `policyType`
  - `포인트 원장` 탭 query: `ledgerPage`, `ledgerPageSize`, `ledgerSearchField`, `ledgerKeyword`, `ledgerType`, `ledgerSourceType`, `ledgerStatus`, `ledgerStartDate`, `ledgerEndDate`
  - `소멸 예정` 탭 query: `expirationPage`, `expirationPageSize`, `expirationSearchField`, `expirationKeyword`, `expirationStatus`, `expirationStartDate`, `expirationEndDate`
  - 핵심 필드:
    - 포인트 정책: `pointPolicyId`, `policyName`, `policyType`, `policyStatus`, `triggerType`, `grantAmount`, `deductRuleSummary`, `expirationRuleSummary`, `updatedAt`, `updatedBy`
    - 포인트 원장: `pointLedgerId`, `userId`, `userName`, `ledgerType`, `ledgerSourceType`, `policyId`, `policyName`, `changeAmount`, `balanceAfter`, `expiresAt`, `ledgerStatus`, `reasonCode`, `reasonDetail`, `createdAt`, `createdBy`
    - 소멸 예정: `expirationId`, `userId`, `userName`, `sourceLedgerId`, `scheduledAt`, `scheduledAmount`, `availableAmount`, `expirationStatus`, `holdReason`, `processedAt`, `processedBy`

### 9.6 Assessment

> **2026-06-11 인바운드 전환(결정 기록 §0)**: TOPIK 쓰기 문항의 데이터 흐름이 인바운드 수신 모델로 확정됐다. 문제 발원 = 외부(공급) API(**미개발** — 문제 본문+메타데이터가 완성 상태로 공급), admin 역할 = 수신·적재 + 관리 포인트(태그) + 노출 통제(`service_status`)이며, **검수 개념은 admin 표면·스키마·계약·정책에서 전면 삭제**됐다. 아래 §9.6 본문의 검수 관련 서술은 현행 코드/DB 사실 기록으로만 유지하며, 해당 표면·필드는 제거 예정(재정의 P3 마이그레이션)이다. 페이지 재정의: `/assessment/question-bank`=문항 목록(조회), `/assessment/question-bank/manage`=문항 관리(관리 포인트). 타깃 계약은 §12(특히 §12.3 쓰기 계약, §12.6 인바운드 수신 계약).

- `Assessment > TOPIK 쓰기 문제 검수` / `Assessment > TOPIK 쓰기 문항 관리` (현행 사이드바 라벨 — 인바운드 전환에 따라 `문항 목록`/`문항 관리`로 재정의 예정)
  - 라우트 분리: 기존 단일 페이지의 `tab` 쿼리 토글을 제거하고 두 개의 형제 라우트/페이지로 분리했습니다. `/assessment/question-bank`(path 유지)와 `/assessment/question-bank/manage`. 상세 2depth `/assessment/question-bank/review/{questionId}`는 현행 유지이나, 검수 개념 삭제에 따라 재정의 P3에서 개명 예정입니다.
  - query (공통, 두 페이지): 반복 `questionNo`, `domain`, `questionType`, `difficulty`, `keyword`
  - query (`/assessment/question-bank` 전용): `reviewStatus` — 검수 필터는 2026-06-11 인바운드 전환으로 제거 예정(재정의 P3)
  - query (관리 전용, `/assessment/question-bank/manage`): `operationStatus`
  - 각 라우트는 자체 URL 상태를 보존하며 `tab` 쿼리 파라미터는 더 이상 사용하지 않습니다.
  - 엔티티 후보
    - `AssessmentQuestion`
    - `AssessmentQuestionAuditEvent`
  - 현재 Supabase source
    - `problems`
    - `admin_update_problem` RPC — **주의(실측 2026-06-10)**: 코드는 이 RPC를 호출하지만 v13 admin island 제거(2026-06-09)로 라이브 DB에 함수가 존재하지 않아 검수 상태 write는 현재 서버에서 실패한다. 2026-06-11 인바운드 전환으로 검수 write 자체가 폐기 대상이며, 재정의 P3 컷오버 이후 admin 쓰기 경로는 `admin_update_topik_question`(`service_status`)·태그 RPC(§12.3)로 한정된다.
    - `admin_audit_logs` (RPC write 감사 로그)
  - 핵심 필드
    - Supabase 원천: `problems.id`, `question_no`, `title`, `prompt`, `difficulty`, `review_status`, `review_workflow_status`, `topic_category_code`, `explanation`, `answer_key`, `rubric`, `created_at`, `updated_at` — 이 중 `review_status`/`review_workflow_status`는 물리적으로 존재·적재돼 있는 현행 사실이며, 2026-06-11 인바운드 전환으로 제거 예정(재정의 P3 마이그레이션)
    - 화면 모델: `questionId`, `questionNumber`, `topic`, `questionText`, `domain`, `questionTypeLabel`, `difficultyLevel`, `sourceType`, `reviewStatus`, `operationStatus`, `validationStatus`, `usageCount`, `linkedExamCount`, `reviewMemo`, `managementNote`, `modelAnswer`, `scoringCriteria`, `revisionHistory`, `generatedAt`, `updatedAt` — 이 중 `reviewStatus`/`validationStatus`/`reviewMemo`는 검수 개념 삭제로 제거 예정(재정의 P3)
  - 계약 메모 (현행 코드 사실 기준 — 검수 관련 항목은 2026-06-11 인바운드 전환으로 제거 예정)
    - `AssessmentQuestionSeed`, feature 내부 JSON fixture, Zustand 문제은행 store는 현재 source 계약에서 제거되었습니다. Supabase 조회가 실패해도 JSON fixture를 fallback으로 읽지 않습니다.
    - `questionText`는 목록형 `문항` 컬럼의 표시 필드이며, Supabase `problems.prompt`를 사용합니다. 검수 상세에서는 문제 번호별 profile에 따라 공통 `문항 지시문` 또는 전용 `문항` row에 같은 source를 표시합니다.
    - `topic`은 `problems.title`, `domain`은 `problems.topic_category_code`를 코드 라벨로 매핑해 사용합니다.
    - `questionTypeLabel`은 `question_no`의 TOPIK 쓰기 형식 규칙으로 파생하고, `difficultyLevel`은 `problems.difficulty` 숫자 구간으로 파생합니다.
    - `modelAnswer`는 `answer_key.text` 또는 문자열형 `answer_key`에서 읽고, `scoringCriteria`는 `problems.rubric` 배열을 문자열 배열로 매핑합니다.
    - `reviewStatus`는 `review_workflow_status`가 있으면 workflow stage를 우선하고, 없으면 `review_status`를 `검수 대기/검수 완료/수정 필요`로 매핑합니다. (현행 코드 사실 — 검수 표면·필드는 2026-06-11 인바운드 전환으로 제거 예정, 재정의 P3 마이그레이션)
    - **[폐기 — 2026-06-11 인바운드 전환]** 구판 계약("`reviewStatus = 검수 완료` → 운영정책 `POL-017`에 따라 상류 `TalkPik AI Service`로 배포(API 업로드)")은 폐기됐습니다. 상류 push(업로드/배포) 트랙 자체가 소멸했고, `POL-017`은 "TOPIK 쓰기 문항 수신·관리 운영정책"으로 재정의됐습니다. 상류 Writing API(`GET /api/writing/tasks`)의 작문 과제는 v13 사용자 노출용이며 admin 배포 대상이 아닙니다. admin의 노출 통제는 `service_status` 컬럼(§12.3), 문항 품질·상태 표현은 태그로만 합니다.
    - **[폐기 — 2026-06-11 인바운드 전환]** 배포 연동 필드 후보(`reviewExportStatus`, `reviewExportedAt`, 상류 작문 과제 식별자 `publishedTaskId`)는 push 트랙 소멸로 계약 후보에서 제거합니다. 단 `topik_writing_question_source_map.published_task_id` 컬럼은 물리적으로 존재하므로 용도 재검토 예정으로 표시합니다(§12.1).
    - `reviewMemo`는 v13 `problems`에 내부 메모 컬럼이 없어 현재도 UI-local annotation으로만 존재합니다(영구 저장 없음). 2026-06-11 인바운드 전환으로 검수 메모 개념 자체가 삭제돼 영구화 계약(구 D-7)은 철회됐고, 해당 UI는 제거 예정(재정의 P3)입니다. 운영 메모는 태그 부여/제거 사유 `question_tags.memo`로만 기록합니다. `content_team_memo`는 수신 메타데이터로 존치하되 admin 쓰기는 없습니다.
    - `operationStatus`는 현재 `미지정` sentinel로만 노출하고, 운영 상태 변경 write path는 비활성화되어 있습니다. 문항 관리 페이지(`/assessment/question-bank/manage`)에는 운영 조치(노출 후보/숨김 후보/운영 제외) UI가 비활성(disabled) 스캐폴딩으로 존재하며, 확인+사유 → 감사 로그 흐름(ConfirmAction + AuditLogLink)이 코드에 미리 연결되어 있습니다. 구 활성화 조건(v13 `lifecycle_status` 도착 대기)은 D-6(2026-06-10)으로 폐기됐고, 신규 스키마 `service_status` 축으로 재정의 P3(표시 전환)·P4(`OPERATION_WRITE_ENABLED` 게이트 제거 + write 개방)에서 해소합니다. 그 전까지는 페이지 상단에 "운영 상태 관리는 준비 중입니다" 경고 Alert를 노출합니다.
    - 두 페이지(문항 목록 — 현행 라벨 `문제 검수` — 와 문항 관리)는 동일한 Supabase `problems`(question_no 51-54) 조회 결과를 공유 hook으로 공유하므로, 아래 Supabase 원천 / 화면 모델 필드 매핑은 두 페이지에서 변경 없이 동일하게 적용됩니다.
    - 과거 JSON 검수 문서용 `reviewDocument` 타입과 화면 분기는 제거되었습니다. 상세 payload/JSONB 문서가 다시 필요하면 새 Supabase/API 계약을 확정한 뒤 별도 타입으로 추가합니다.
    - 현재 화면에서 Supabase source가 없는 표시값은 임의 생성하지 않고 `-`, `미상`, `미지정`, 빈 배열 같은 sentinel로 표시합니다.
    - 콘텐츠팀 권장 스키마(`docs/metadata-tag-schema-rule.md` v0.8)는 **2026-06-10 채택 확정**됐고 채택 계약은 §12에서 추적합니다(결정 기록: `docs/architecture/metadata-tag-schema-transition-decision-record.md` — 2026-06-11 §0 인바운드 전환 반영). 재정의 P3 읽기 컷오버(검수 컷오버 개념은 삭제 — 검수 표면은 컷오버가 아니라 제거 대상) 전까지는 이 §9.6 계약(엔티티 `AssessmentQuestion`, 테이블 `problems`)이 코드 SoT로 병행 유효하며, 컷오버 시 §9.6을 신규 스키마·인바운드 모델 기준으로 재작성합니다.
  - enum / code table candidate
    - `questionNumber`: `51`, `52`, `53`, `54`
    - `domain`: `생활`, `학습`, `사회`, `문화`, `경제`, `교육`, `환경`, `기술`
    - `questionTypeLabel`: `빈칸 완성`, `연결 표현`, `자료 설명`, `의견 서술`
    - `difficultyLevel`: `상`, `중`, `하`
    - `reviewStatus`: `검수 대기`, `검수 중`, `보류`, `검수 완료`, `수정 필요` — 검수 개념 삭제로 enum 자체가 제거 예정(재정의 P3)
    - `operationStatus`: `미지정`, `노출 후보`, `숨김 후보`, `운영 제외` — D-6 확정에 따라 `service_status`(`available`/`excluded`/`internal_test`) 축으로 대체 예정
    - `validationStatus`: `정상`, `주의`, `재검토` — `validation_result` 필드 제거 방침에 따라 제거 예정(재정의 P3, 수신 정합 검사는 `auto_checks_passed`로 존치)
    - `sourceType`: `AI 자동 생성` — 인바운드 전환으로 문제 발원은 외부(공급) API로 재정의(라벨 재검토 예정)
  - 하드코딩 분류
    - `schema candidate`
      - 문항 본문, 정답/가이드, 운영 메모(태그 사유 `question_tags.memo`), 배치 메타데이터 — 검수 메모·검수 이력은 2026-06-11 검수 개념 삭제로 계약 후보에서 제외(잔존 UI는 제거 예정)
    - `code table candidate`
      - 문제 번호, 운영 상태(→ `service_status`), 자동 점검 상태 — 검수 상태는 제거 예정(재정의 P3)
    - `ui-only`
      - 페이지 안내 문구, 운영 상태 준비 중 경고 Alert, empty/error/pending 메시지
  - 감사 로그 / URL 계약
    - `Target Type = AssessmentQuestion`
    - `Target ID = questionId`
    - 원본 화면 역추적 경로: `/assessment/question-bank/review/{questionId}` (검수 개념 삭제에 따라 재정의 P3에서 개명 예정)

## 10. 문서 갱신 규칙

- 사이드바 검수가 다음 범위로 진행되면 이 문서의 `검수 완료 범위`와 `페이지별 계약/검수 요약`을 같은 작업에서 갱신한다.
- 엔티티명, 테이블명 후보, 컬럼/필드명, enum/code table 후보, 하드코딩 분류가 바뀌면 이 문서를 먼저 갱신한다.
- 목록/상세 필드나 검색/정렬/URL 복원 키가 바뀌면 `docs/specs/admin-page-tables.md`와 관련 IA 문서를 함께 갱신한다.
- 데이터 source 경계가 바뀌면 `docs/architecture/admin-data-source-transition.md`를 함께 갱신한다.
- 문서를 수정하면 `logs/admin-doc-update-log.md`에 변경 요약을 남긴다.
## 11. 2026-03-27 메타데이터 관리 계약

### 11.1 엔티티 / 테이블 후보

- `SystemMetadataGroup`
  - table candidate: `system_metadata_groups`
- `SystemMetadataItem`
  - table candidate: `system_metadata_group_items`
- `SystemMetadataHistoryEntry`
  - table candidate: `system_metadata_group_histories`

### 11.2 필드 계약

- `SystemMetadataGroup`
  - `groupId`, `groupName`, `description`, `managerType`, `ownerModule`, `ownerRole`, `status`, `syncStatus`, `exposureStatus`, `linkedAdminPages[]`, `linkedAdminLocations[]`, `linkedUserSurfaces[]`, `schemaCandidateNotes[]`, `itemCodePrefix`, `updatedAt`, `updatedBy`, `lastReviewedAt`
  - `linkedAdminLocations[].locationId`, `linkedAdminLocations[].route`, `linkedAdminLocations[].path[]`, `linkedAdminLocations[].note`
- `SystemMetadataItem`
  - `itemId`, `groupId`, `code`, `label`, `description`, `status`, `sortOrder`, `isDefault`, `exposureStatus`, `updatedAt`, `updatedBy`
- `SystemMetadataHistoryEntry`
  - `historyId`, `groupId`, `action`, `reason`, `changedBy`, `createdAt`

### 11.3 enum / code table candidate

- `managerType`
  - `codeTable`, `selectOption`, `exposureRule`, `segmentField`
- `syncStatus`
  - `live`, `review`, `draft`
- `exposureStatus`
  - `confirmed`, `inferred`, `internalOnly`, `planned`
- `status`
  - `active`, `inactive`
- `historyAction`
  - `group_created`, `group_updated`, `group_activated`, `group_deactivated`, `item_created`, `item_reordered`, `item_updated`, `item_activated`, `item_deactivated`

### 11.4 하드코딩 분류

- unique candidate
  - `SystemMetadataGroup.groupName`는 전체 그룹 기준 unique
  - `SystemMetadataItem.code`, `SystemMetadataItem.label`은 같은 `groupId` 안에서 unique
- 현재 mock 단계에서는 form validator + service validation으로 먼저 중복을 차단하고, API/DB 단계에서 unique 제약으로 승격합니다.

- `schema candidate`
  - 그룹명, 설명, 관리 route 연결, 관리 위치 계층, 연결 사용자 화면, schema/code table 메모, 코드 prefix
- `code table candidate`
  - 그룹 유형, 동기화 상태, 노출 상태, 활성 상태, 항목 코드 집합
- `ui-only`
  - 요약 안내 문구, 빈 상태/오류 상태 메시지

### 11.5 감사 로그 / URL 계약

- `Target Type = SystemMetadataGroup`
- `Target ID = groupId`
- 시스템 감사 로그에서 메타데이터 관리 상세 역추적 경로는 `/system/metadata?selected={groupId}`를 사용합니다.
- 메타데이터 관리 URL 복원 쿼리는 `summaryFilter`, `searchField`, `keyword`, `startDate`, `endDate`, `selected`를 사용합니다.

## 11.6 2026-03-27 보강 메모 > 메타데이터 삭제 계약
- `SystemMetadataHistoryEntry.action` 후보에 `item_deleted`를 추가합니다.
- `SystemMetadataGroup.items[]` 삭제 시 남은 값의 `sortOrder`는 1부터 다시 정규화합니다.
- 삭제된 값이 기본값(`isDefault`)이었다면 남아 있는 첫 번째 값이 기본값으로 승격됩니다.

## 12. 메타데이터·태그 스키마 전환 계약 (2026-06-10 채택 확정 / 2026-06-11 인바운드 전환 반영)

> 콘텐츠팀 권장 스키마 `docs/metadata-tag-schema-rule.md`(v0.8)의 채택 계약 추적 섹션이다. **2026-06-10 채택·전면 전환이 확정됐고 Phase 0 결정 13건(D-1~D-13)이 확정됐다**(결정 기록: `docs/architecture/metadata-tag-schema-transition-decision-record.md`). 실행 SoT: 실행계획안 2026-06-11 개정. 재정의 P3 컷오버 전까지 §9.6 현행 계약이 코드 SoT로 병행 유효하다.
>
> **2026-06-11 인바운드 전환(결정 기록 §0)**: 문제 발원 = 외부(공급) API(**미개발** — 문제 본문+메타데이터를 schema-rule §4 + §7(§7.9 제외, 검수 필드 제외) 기준 완성 상태로 공급), admin = 수신·적재 + 태그(관리 포인트) + `service_status`(노출 통제). **검수 개념은 전면 삭제**됐고(D-2·D-7·편차 E1 철회 — 컬럼 물리 제거는 재정의 P3 마이그레이션), 상류 push(배포/업로드) 트랙·P2-5 콘텐츠팀 승인 게이트·콘텐츠팀 발주 트랙은 폐기됐다. 아래 절의 검수 관련 서술은 P1~P2 산출물의 역사 기록으로만 유지한다. 인바운드 수신 계약은 §12.6.

### 12.1 채택 테이블 (8개 신규 오브젝트 + 매핑 테이블, 호스트: talkpik-dev `fglggyfvzjdsbyckinqa`, 자산 소유: 이 repo `supabase/migrations`)

> **P1 적용 완료(2026-06-10)**: 아래 오브젝트 전부 + 감사 RPC 3종 + RLS가 프로덕션에 생성됐고(마이그레이션 12파일, 기존 테이블 무변경 diff 0건), 주제(85행)/태그(19종) 마스터 시드 완료. 공통 컬럼 집합은 이 시점부로 동결 계약이다(변경은 4테이블 동시 마이그레이션). 증적: `logs/metadata-tag-schema-transition-evidence.md` P1 절.

- 번호별 분리 문제 테이블: `topik_writing_51_questions`, `topik_writing_52_questions`, `topik_writing_53_questions`, `topik_writing_54_questions` (v0.8 실측: 공통 35컬럼 + 편차 E1 `review_workflow_status` + 번호별 전용 16~21컬럼 — 51:21·52:17·53:19·54:16). ※ 편차 E1은 2026-06-11 철회 — `review_workflow_status` 등 검수 컬럼은 P1 산출물로 물리 잔존하며 재정의 P3 마이그레이션에서 제거 예정(§12.4)
- 태그: `topik_writing_tag_master`(태그 값 사전) + `topik_writing_question_tags`(문제-태그 매핑) — 인바운드 모델의 admin 관리 포인트(부여/제거 + 사유 `memo`)
- 주제 마스터: `topik_writing_topic_master` (17개 고정 종합 주제)
- 추천 검색용 읽기전용 UNION 뷰: `topik_writing_question_recommendation_view` (`security_invoker=true` 필수 + admin 목록용 확장 컬럼, 편차 E4)
- 식별자 매핑: `topik_writing_question_source_map` (편차 E2 — `question_id` PK, `item_number`, `legacy_problem_id` UNIQUE, `legacy_topic_category_code` 참고 보존, `published_task_id`(상류 push 폐기로 배포 용도 소멸 — 컬럼은 물리 존재, 용도 재검토 예정), `backfill_batch`)
- `topik_writing_question_tags`는 4분할 부모 테이블을 단일 FK로 참조할 수 없어 `question_id + item_number` 합성 참조(RPC 레벨 검증 + 부분 인덱스)로 무결성을 보장한다.

### 12.2 식별자 매핑 확정 (구 충돌 후보 → D-1~D-13 결정으로 해소)

> **P2 백필 적재 완료(2026-06-10)**: 아래 매핑으로 `problems` 470행 → 466행 적재(51:90/52:76/53:62/54:238) + 4행 보류(`audit_seed` 예시, hold_reason 기록), `question_source_map` 470행 전수(`legacy_problem_id` 대사 일치, `legacy_publish_status/visibility` 보존). 채번은 전량 신규(D-4 선조회 0건→idempotent 재사용 확인), 검증 5종+RT-2+idempotency+델타 리허설 ALL PASS. 전 행 `service_status='internal_test'`. 증적: `logs/metadata-tag-schema-transition-evidence.md` P2 절.
>
> **2026-06-11 갱신**: P2-5 콘텐츠팀 샘플 승인 게이트는 인바운드 전환으로 **폐기**됐다(트랙 소멸 — 메타데이터는 외부에서 완성 상태로 공급되므로 admin 경유 분류·승인 절차가 존재하지 않음). 백필 466행은 **초기 코퍼스**(유효 저장 데이터)로 확정됐고, 외부 공급 API 가동 후 공급측 데이터로의 대체(재공급) 여부는 공급 계약에서 결정한다.

| 신규 (ⓐ 채택 스키마) | 구 (ⓑ v13 `problems` / 화면 모델) | 확정 결정 |
| --- | --- | --- |
| `question_id` (TEXT 전역 PK, `topik-writing-{NN}-{0001}`) | `problems.id` (UUID) | D-4: `question_source_map` 선조회 idempotent 채번(`ORDER BY created_at, id`), 양방향 매핑 영구 보존 |
| `item_number` (51~54, 테이블별 CHECK) | `question_no` | 직매핑 (51→51테이블 … 54→54테이블 라우팅) |
| `topic_main` (17주제) + `topic_detail` | `topic_category_code` (8값 SUBJECT 축) | D-3 **[폐기(트랙 소멸) — 2026-06-11]**: 재분류·승인 트랙은 인바운드 전환으로 폐기(향후 분류 메타데이터는 외부 공급). 본 행은 백필 산출물 기록 — 적재된 466행의 분류값은 유효 저장 데이터로 유지, 원값은 source_map에 참고 보존 |
| `review_status` ASCII 3값(`approved`/`needs_revision`/`on_hold`) + `review_workflow_status` 5값(E1) | `review_status`(`approved`/`pending`/`rejected`) + `review_workflow_status` | **[역사 기록 — D-2 철회(2026-06-11)]** 검수 개념 삭제로 본 이관 사전은 P2 백필 산출물 기록으로만 유지(컬럼 물리 제거는 재정의 P3 마이그레이션). 종전 확정값: ASCII enum 저장 + 한국어 라벨 매핑, 2축 유지. 이관 사전: `pending`→`needs_revision`+`not_started`, `approved`→`approved`+`done`, `rejected`→`needs_revision`+`revision_requested` |
| `service_status`(`available`/`excluded`/`internal_test`, 기본 `internal_test`) | `operationStatus` (전부 sentinel, write 비활성) | D-6(유지): `service_status` 컬럼이 유일한 물리 노출 상태이자 인바운드 모델의 admin 노출 통제 축. 노출상태 태그 그룹 시드 제외, '운영 제외'=`excluded`+운영주의 태그(사유 필수 — POL-018 ②). `lifecycle_status` 종속 해소. 검수 결합 기준(구 POL-018 ①)은 2026-06-11 삭제 |
| `blank_1/2_*` 정규화 컬럼 + 공통 `answer_key` JSONB 보존 | `answer_key`/`materials` (JSONB) | D-5(유지): 원본 보존+정규화 병행, 필수 컬럼 역분해 실패는 적재 보류. 실측: `materials.blanks`에 정규화 원본 존재(손실 위험 하향) |
| `recommendation_keys`, `avoid_repeat_keys`, 태그 | (source 없음) | net-new. 초기값은 ETL 파생(P2) + 태그는 인바운드 모델의 admin 관리 포인트로 운영 개방(재정의 P4) |
| `content_team_memo` | (없음 — 검수 메모 UI-local 가짜 저장) | **[D-7 철회(2026-06-11)]** 검수 메모 영구화 계약 폐기. `content_team_memo`는 **수신 메타데이터**로 존치(admin 쓰기 없음). 운영 메모는 태그 사유 `question_tags.memo`로만 기록 |

### 12.3 쓰기·감사 계약 (D-8 — 2026-06-11 개정)

- admin 쓰기 계약은 **태그 + `service_status`** 2종으로 한정한다(인바운드 모델의 관리 포인트·노출 통제). 그 외 문항 본문·메타데이터는 외부 공급분이며 admin 쓰기가 없다.
- 모든 신규 테이블 직접 write는 RLS로 차단하고, 쓰기는 SECURITY DEFINER RPC 단일 경로로만 허용: `admin_update_topik_question`(화이트리스트 patch — 재정의 후 허용 범위는 `service_status` 중심으로 축소, 검수 필드 patch는 제거 예정), `admin_assign_question_tag`/`admin_remove_question_tag`(이력 보존형, 사유 `memo` 기록). RPC는 `admin_audit_logs`에 actor=`auth.uid()` + 컬럼 diff(`{col:{from,to}}`)를 기록한다 — `target_table='AssessmentQuestion'`, `target_id=question_id`.
- 액션 코드(2026-06-11 개정): 유지=`service_status_changed`/`tag_assigned`/`tag_removed`, 신설 예정=`question_received`(외부 공급 API 수신·적재 시점 기록 — 공급 연동 시 확정), 폐기=검수 4종(`review_completed`/`review_on_hold`/`review_revision_requested`/`review_memo_saved`)·`question_published`(상류 push). 폐기 액션의 RPC 분기는 P1 산출물에 물리 잔존하며 재정의 P3 마이그레이션에서 제거한다.
- 구 `admin_update_problem` RPC는 v13 admin island 제거(2026-06-09)로 라이브 DB에 존재하지 않음(실측). 동등 보장의 비교 대상은 v13 마이그레이션 파일의 계약 원문이다.

### 12.4 v0.8 원안 대비 편차 목록 (승인 완료 — E1은 2026-06-11 철회)

| 편차 | 내용 | 사유 |
| --- | --- | --- |
| E1 | 4테이블 공통 컬럼 `review_workflow_status` 추가 | **[철회 — 2026-06-11]** 검수 개념 삭제로 편차 자체가 폐기. 컬럼은 P1 산출물로 물리 잔존하며 재정의 P3 마이그레이션에서 제거 예정. (종전 사유 D-2: 현행 검수 진행 2축 보존 — 역사 기록) |
| E2 | 매핑 테이블 `topik_writing_question_source_map` 추가 (+`legacy_topic_category_code` 보존 컬럼) | D-4 채번 idempotency·레거시 역추적 (구 "배포 증적" 용도는 push 폐기로 소멸 — `published_task_id` 용도 재검토 예정) |
| E3 | tag_master 시드에서 '서비스_노출상태' 그룹 제외 + 운영주의 그룹 '운영 제외' 값 추가 | D-6: `service_status` 컬럼과의 이중 기록 차단 |
| E4 | 추천 뷰에 admin 목록용 6컬럼 확장(`situation_summary`/`question_type_name`/`content_team_memo`/`review_workflow_status`/`created_at`/`updated_at`) | §7.9 12컬럼만으로 목록 화면 요구 충족 불가. ※ 이 중 `review_workflow_status`는 E1 철회에 따라 재정의 P3에서 뷰 컬럼 제거 예정 |

### 12.5 운영 원칙

- 메타데이터(불변 사실 — 외부 공급)/태그(가변 운영값 — admin 관리 포인트) 물리 분리 원칙을 따른다. 콘텐츠 메타(~45컬럼) 입력/저작 UI는 비범위 원칙 유지(D-10 재정의, 2026-06-11) — 메타데이터는 외부(공급) API가 완성 상태로 공급하며, 구 콘텐츠팀 입력표→ETL 경로는 폐기됐다(P2 백필은 인터림 역사 기록).
- 공통 컬럼 집합은 P1 종료 시 계약으로 동결하고, 변경은 4테이블 동시 마이그레이션으로만 허용한다(컬럼 drift 방지). 검수 컬럼 제거(재정의 P3)도 이 규칙에 따라 4테이블 동시 마이그레이션으로 수행한다.

### 12.6 인바운드 수신 계약 (2026-06-11 신설 — 외부 공급 API 미개발)

> 인바운드 모델의 수신·적재 계약 자리표시 절이다. 외부 공급 API가 **미개발 상태**라 필드 단위 계약은 미확정이며, 공급 계약 확정 시 본 절을 승격한다.

- 문제 발원 = 외부(공급) API. 문제 본문+메타데이터(schema-rule §4 메타데이터 + §7 테이블 스키마, §7.9 추천 뷰 제외, 검수 필드 제외)가 **완성 상태로 공급**되며, admin은 문항을 저작·생성·분류·검수하지 않는다.
- 수신·적재 경로: 외부 API → Supabase `topik_writing_51/52/53/54_questions` + `topik_writing_question_source_map`. 신규 행 기본값 `service_status='internal_test'`(D-6). `auto_checks_passed`는 수신·적재 자동 정합 검사 표식으로 존치·기록한다.
- 감사: 수신·적재 시 `question_received` 액션 기록(공급 연동 시 확정 — §12.3).
- 추진 경로: 공급 계약(엔드포인트/페이로드/인증/델타 규칙)은 D-11 재작성 요청 문서("문항 공급(인바운드) API 계약 요청")로 추진한다.
- 인터림: 공급 개시 전까지 P2 백필 466행이 초기 코퍼스다(전 행 `service_status='internal_test'`).
