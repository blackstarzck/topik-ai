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

## 10. 문서 갱신 규칙

- 사이드바 검수가 다음 범위로 진행되면 이 문서의 `검수 완료 범위`와 `페이지별 계약/검수 요약`을 같은 작업에서 갱신한다.
- 엔티티명, 테이블명 후보, 컬럼/필드명, enum/code table 후보, 하드코딩 분류가 바뀌면 이 문서를 먼저 갱신한다.
- 목록/상세 필드나 검색/정렬/URL 복원 키가 바뀌면 `docs/specs/admin-page-tables.md`와 관련 IA 문서를 함께 갱신한다.
- 데이터 source 경계가 바뀌면 `docs/architecture/admin-data-source-transition.md`를 함께 갱신한다.
- 문서를 수정하면 `logs/admin-doc-update-log.md`에 변경 요약을 남긴다.
