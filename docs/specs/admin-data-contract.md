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
- 예시: `User`, `Instructor`, `Referral`, `CommunityPost`, `CommunityReport`, `MessageTemplate`, `MessageGroup`, `MessageHistory`, `OperationNotice`, `OperationFaq`, `OperationEvent`, `OperationPolicy`, `OperationPolicyHistoryEntry`, `PdfQuotaPolicy`, `PdfQuotaReset`

### 4.2 테이블명 후보

- 데이터베이스 테이블명 후보는 영어 복수형 snake_case를 기본값으로 사용한다.
- 모듈 접두가 없으면 다른 도메인과 충돌하거나 의미가 약해지는 경우에만 모듈 접두를 붙인다.
- 예시: `users`, `instructors`, `referrals`, `community_posts`, `community_reports`, `message_templates`, `message_groups`, `notification_dispatches`, `notification_delivery_attempts`, `operation_notices`, `operation_faqs`, `operation_faq_curations`, `operation_faq_metrics`, `operation_events`, `operation_policies`, `operation_policy_histories`

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
| `Users > 회원 목록`              | `User`                                                                  | v13 `profiles`/`auth.users` + `writing_submissions` 집계, admin RPC `get_admin_users`/`admin_set_user_status`/`admin_export_users` | `supabase-users-service.ts` + `users-service.ts` + `mock-users.ts` fallback + query store              | 검색/정렬/페이지네이션/기관 범위/테이블 필터/내보내기 scope·선택 컬럼은 RPC 또는 URL query 계약, 상태값은 `active`/`blocked`/`deleted` 기반 표준 상태 후보, 성별은 프로필 표시값, 전화번호는 목록 마스킹/상세 원문/내보내기 선택 컬럼을 분리 관리                                                                                                                                | `검색 -> 상세(이동) -> 조치 -> 감사 로그 확인` 유지. Supabase 모드 정지/해제는 `User + userId`, 내보내기는 `User + batch:{uuid}` 감사 로그 기록                                 | `PASS` |
| `Users > 강사 관리`              | `Instructor`                                                            | `instructors`                                                                                               | `instructors-service.ts` + `mock-instructors.ts`                                                      | 국가/소속/활동상태는 `code table candidate`                                                                                                                                                                                       | 행 클릭 `DetailDrawer`와 조치/감사 로그 흐름 일치                                                                                           | `PASS` |
| `Users > 추천인 관리`            | `Referral`                                                              | `referrals`, `referral_relations`, `referral_reward_ledgers`                                                | `referrals-service.ts` + `mock-referrals.ts`                                                          | 상태/이상치/리워드 유형은 `code table candidate`                                                                                                                                                                                  | 행 클릭 `DetailDrawer`와 조치/감사 로그 흐름 일치                                                                                           | `PASS` |
| `Users > 회원 상세`              | `User` + 하위 컬렉션                                                    | `users`, `user_activities`, `user_payments`, `user_community_posts`, `user_access_logs`, `user_admin_memos` | 페이지가 `mock-users`와 로컬 배열을 직접 사용                                                         | 활동/결제/커뮤니티/로그/메모 배열이 모두 `schema candidate`                                                                                                                                                                       | 상세 진입 자체는 맞지만 하위 데이터가 service 경계 밖에 있음                                                                                | `FAIL` |
| `Community > 게시글 관리`        | `CommunityPost`                                                         | `community_posts`, `community_post_admin_notes`                                                             | 페이지가 `initialRows`를 직접 소유                                                                    | 게시글 본문, 상태, 메모, 정책 코드 모두 `schema candidate`                                                                                                                                                                        | 행 클릭 `DetailDrawer`는 적절하나 데이터 SoT 위반                                                                                           | `FAIL` |
| `Community > 신고 관리`          | `CommunityReport`                                                       | `community_reports`                                                                                         | 페이지가 `initialRows`를 직접 소유                                                                    | 신고 사유/처리상태/대상 식별자 모두 `schema candidate`                                                                                                                                                                            | 목록 조치와 상세가 분리된 `Modal` 중심이라 표준 흐름보다 약함                                                                               | `FAIL` |
| `Message > 메일`                 | `MessageTemplate`                                                       | `message_templates`                                                                                         | `messages-service.ts` + `message-store.ts`                                                            | 채널/모드/상태/카테고리는 `code table candidate`                                                                                                                                                                                  | 목록 -> 등록 상세 -> 발송/삭제 -> 감사 로그 흐름 유지                                                                                       | `PASS` |
| `Message > 푸시`                 | `MessageTemplate`                                                       | `message_templates`                                                                                         | `messages-service.ts` + `message-store.ts`                                                            | 채널/모드/상태/카테고리는 `code table candidate`                                                                                                                                                                                  | 목록 -> 등록 상세 -> 발송/삭제 -> 감사 로그 흐름 유지                                                                                       | `PASS` |
| `Message > 대상 그룹`            | `MessageGroup`                                                          | `message_groups`, `message_group_rules`                                                                     | `messages-service.ts` + `message-store.ts` + `message-group-segment-schema.ts`                        | 세그먼트 필드/옵션은 `code table candidate`, 그룹 메타는 `schema candidate`                                                                                                                                                       | 생성/수정 Drawer와 재계산/삭제/감사 로그 흐름 일치                                                                                          | `PASS` |
| `Message > 발송 이력`            | `NotificationDispatch` + `NotificationDeliveryAttempt`                  | `notification_dispatches`, `notification_delivery_attempts`                                                 | `messages-service.ts` + `message-store.ts` + `notification-supabase-adapter.ts`                       | 상태/액션 타입은 `code table candidate`, 발송 본문은 dispatch, 수신자별 결과는 attempt 계층으로 추적                                                                                                                               | 행 클릭 `DetailDrawer`, 재시도, 감사 로그 흐름 일치. `notification_delivery_attempts`는 v13 X-09 owner-read 이력과 공유                         | `PASS` |
| `Message > 템플릿 등록 상세`     | `MessageTemplate`                                                       | `message_templates`                                                                                         | store 직접 조회 + 저장                                                                                | 본문/제목/타겟 그룹은 `schema candidate`                                                                                                                                                                                          | 편집형 상세 페이지 패턴으로 허용 가능                                                                                                       | `WARN` |
| `Operation > 공지사항`           | `OperationNotice`                                                       | `operation_notices`                                                                                         | `notices-service.ts` + `operation-notices-data-source.ts` + `supabase-operation-notices-service.ts` + `operation-store.ts`(mock fallback) | schema candidate에서 실 테이블 계약으로 승격 완료. 상태 저장 enum은 DB ASCII `published`/`hidden`, UI 라벨은 `게시`/`숨김`으로 서비스 경계에서 매핑                                                                               | 목록/미리보기/게시 조치/감사 로그 흐름 유지, Supabase 모드는 admin RPC 경유                                                                  | `PASS` |
| `Operation > 공지사항 등록 상세` | `OperationNotice`                                                       | `operation_notices`                                                                                         | `fetchNoticeSafe` + `saveNoticeSafe` + data-source switch                                             | `title`/`body_html`은 `operation_notices` 필수 컬럼, 신규 저장 기본 상태는 DB `hidden`(`숨김`)                                                                                                                                      | 등록 상세 페이지 패턴으로 적절                                                                                                              | `PASS` |
| `Operation > FAQ`                | `OperationFaq` + `OperationFaqCuration` + `OperationFaqMetric`          | `operation_faqs`, `operation_faq_curations`, `operation_faq_metrics`                                        | `faqs-service.ts` + `operation-faqs-data-source.ts` + `supabase-operation-faqs-service.ts` + `operation-store.ts`(mock fallback) | schema candidate에서 실 테이블 계약으로 승격 완료. status 저장 enum은 DB ASCII `published`/`hidden`, UI 라벨은 `공개`/`비공개`로 서비스 경계에서 매핑. surface/mode/exposure는 ASCII, category는 한글 코드 저장 | 행 클릭 `DetailDrawer`, FAQ 조치와 FAQ 노출 조치를 분리한 감사 로그 흐름 유지. Supabase 모드는 admin RPC 경유, metrics는 seed/read 전용 | `PASS` |
| `Operation > 정책 관리`          | `OperationPolicy`, `OperationPolicyHistoryEntry`                        | `operation_policies`, `operation_policy_histories`                                                          | `policies-service.ts` + `policy-store.ts`                                                             | 운영 영역/정책 유형/노출 위치/추적 상태/상태/히스토리 조치 코드와 연관 관리자/사용자 화면 옵션값은 `code table candidate`, 문서명/버전/시행일/연관 관리자 화면 선택값/연관 사용자 화면 선택값/추적 근거 문서/요약/법령/본문 HTML/관리자 메모/히스토리 사유/히스토리 snapshot은 `schema candidate` | 목록 검색/상세 Drawer/히스토리 expandable row/히스토리 `본문 보기`/히스토리 `이 버전 게시`/본문 미리보기/게시-숨김/삭제/감사 로그 흐름 유지 | `PASS` |
| `Operation > 정책 등록 상세`     | `OperationPolicy`                                                       | `operation_policies`                                                                                        | `fetchPolicySafe` + `savePolicySafe`                                                                  | TinyMCE 본문, 법령/근거, 동의 필요 여부, 연관 관리자/사용자 화면 선택값, 추적 근거 문서는 `schema candidate`                                                                                                                                  | 단계형 등록 상세 페이지 패턴과 목록 복귀 URL 복원 기준, `정책 등록`/`내용 수정`/`새 버전 등록` 3개 editor mode가 구현과 정렬됨              | `PASS` |
| `Operation > 이벤트`             | `OperationEvent`                                                        | `operation_events`                                                                                          | `events-service.ts` + `operation-events-data-source.ts` + `supabase-operation-events-service.ts` + `operation-store.ts`(mock fallback) | schema candidate에서 실 테이블 계약으로 승격 완료. `visibility_status`/`progress_status`/`indexing_policy`는 DB ASCII, `event_type`/`reward_type`은 한글 코드, `exposure_channels`/`banner_images`는 jsonb 배열로 저장 | 목록 검수 + 상세 Drawer + `OperationEvent` 감사 로그 흐름 유지. Supabase 모드는 admin RPC 경유, mock은 fallback으로 축소됨 | `PASS` |
| `Operation > 이벤트 등록 상세`   | `OperationEvent`                                                        | `operation_events`                                                                                          | `fetchEventSafe` + `saveEventSafe` + `scheduleEventPublishSafe` + `publishEventSafe` + `endEventSafe` + data-source switch | 본문 HTML/참여 조건/보상 정책/SEO override 필드는 `operation_events` 실 컬럼 계약으로 승격 완료. 보상 정책/메시지 템플릿은 FK 없이 denormalized snapshot으로 저장 | 등록 상세 페이지 패턴과 저장/게시 예약/즉시 게시/종료 경계가 admin RPC 기준으로 정렬됨 | `PASS` |
| `Operation > PDF 내보내기 제한`  | `PdfQuotaPolicy`, `PdfQuotaPolicyHistoryEntry`, `PdfQuotaReset`, `PdfQuotaResetUserOption` | `pdf_export_quota_policies`, `pdf_export_quota_resets`, `pdf_export_quota_reset_targets`(모두 v13 소유) + 이력은 `admin_audit_logs` 투영 + 개인 초기화 대상 검색은 `profiles`/`auth.users` 최소 필드 투영 | `pdf-quota-service.ts` + `pdf-quota-data-source.ts` + `supabase-pdf-quota-service.ts` + `pdf-quota-store.ts`(mock fallback) | 실 테이블 계약(v13 소유, DDL 불변). `period_unit`은 DB ASCII `day`/`week`/`month`(UI 라벨 일/주/월), `limit_count`는 0 허용(0=의도적 내보내기 중단), `reset_scope`는 `user`/`group`/`global`(UI 라벨 개인/기관 코드/전체). 읽기/쓰기 모두 admin RPC 6종 경유(usages 원장은 admin 쓰기 없음). 개인 초기화 대상 선택은 `search_admin_pdf_quota_reset_users` 서버 검색/페이지네이션으로 처리하며 `get_admin_users` platform_admin 계약을 재사용하지 않는다. 정책/초기화/이력 표시 시각은 RPC의 KST 문자열을 사용하되 정책 `updated_at` 원본 timestamptz는 동시 편집 검사에 유지한다. 정책 이력 row id는 `admin_audit_logs.id`, 초기화 대상은 user/group/global 모두 `reset_targets.user_id` 실체화 | 정책 탭은 설정형(상주 폼 + 변경 이력, 단일 정책 자기치유), 초기화 탭은 목록 운영형. 사유 필수 + 주기 변경·한도 0·전체 초기화 2차 확인 + `PdfQuotaPolicy`/`PdfQuotaReset` 감사 로그 흐름 | `PASS` |
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
  - 감사 로그 `Target Type`이 일부 화면에서 `Message`, `Operation` 단일 값으로 묶여 있다.
- 현재 ID prefix로는 구분 가능하지만, 장기적으로는 `MessageTemplate`, `MessageGroup`, `MessageHistory`, `OperationNotice`, `OperationFaq`, `OperationEvent`, `OperationPolicy`처럼 엔티티 단위 식별이 더 안정적이다.

### 8.3 P3

- `Commerce > 포인트 관리`
  - 페이지 IA 기준으로 `정책 / 포인트 원장 / 소멸 예정` 3탭 구조와 감사 로그 `Target Type` 초안은 정리되었지만, 코드 구현은 아직 placeholder다.
  - 구현 전 `points-service.ts`, `point-store.ts`, `point-schema.ts` 경계와 수동 조정/소멸 보류 승인 체계를 먼저 확정해야 한다.

## 9. 페이지별 필드/키워드/변수명 기준

### 9.1 Users

- `Users > 회원 목록`
  - query: `page`, `pageSize`, `sort`, `status`, `searchField`, `startDate`, `endDate`, `keyword`
  - 핵심 필드: `id`, `realName`, `email`, `nickname`, `gender`, `phoneMasked`, `phone`, `joinedAt`, `lastLoginAt`, `status`, `tier`, `subscriptionStatus`, `socialProviders`, `termsConsentStatus`, `emailVerificationStatus`
  - 전환 상태: 회원 목록 source는 mock 후보에서 Supabase-backed `get_admin_users` read RPC로 승격 완료했다. 마이그레이션은 `supabase/migrations-admin/20260617210000_admin_users_directory.sql`(+ down)이며, `admin_schema_migrations` tracker 기준 2026-06-17 dev DB 적용 완료했다.
  - v13 source: `realName`은 `profiles.display_name`, `nickname`은 `profiles.nickname`, `gender`는 `profiles.gender`, `phone`은 canonical `profiles.phone_country_code` + `profiles.phone_number` 조합, `email`은 `auth.users.email`, `lastLoginAt`은 `auth.users.last_sign_in_at`, `joinedAt`은 `profiles.created_at`, `tier`는 `profiles.plan_label`, `status`는 `profiles.status`를 사용한다. dev의 optional legacy `profiles.phone`은 row JSON fallback으로만 허용하며 직접 컬럼 참조는 금지한다. 활동 집계는 `writing_submissions`의 `count(*)`와 `max(submitted_at)`이며, 목록 총건수는 `total_count` window 컬럼이다. 두 표시명 필드가 `NULL`이면 이메일/ID/local-part fallback을 만들지 않고 UI에서 `-`로 표시한다.
  - RPC read 계약: `get_admin_users(search text, sort text, page integer, page_size integer, affiliation text default null)`는 platform_admin 전용이며 반환 컬럼은 `user_id`, `email`, `display_name`, `nickname`, `gender`, `phone_masked`, `app_role`, `plan_label`, `status`, `registration_status`, `nationality_country_code`, `social_providers`, `affiliation_code`, `affiliation_label`, `submission_count`, `last_activity`, `last_sign_in_at`, `email_confirmed`, `consent_status`, `consent_accepted_at`, `created_at`, `total_count`다. PostgREST 함수 매칭을 위해 인자명 `search`, `sort`, `page`, `page_size`, `affiliation`은 프론트 JSON 키와 정확히 일치해야 하며, 함수 부재/인자 불일치가 기존 404 원인이었다.
  - 성별 계약: 목록/상세/내보내기 `UserSummary.gender`는 `profiles.gender`를 관리자 표시 라벨로 정규화한 값이다. `male/female/other` 또는 한글 값은 `남성/여성/기타`로 표시하고, 미입력/비공개는 `-`로 표시한다.
  - 전화번호 계약: 목록 `UserSummary.phoneMasked`는 `phone_masked`를 사용하고 원문 전화번호를 표시하지 않는다. 상세 `UserSummary.phone`은 `get_admin_user(target_id uuid)`가 split field를 조합한 단건 값을 받아 프로필 탭에 표시하며, 값이 없으면 `phoneMasked`로 fallback한다. 조합/legacy fallback은 `private.admin_profile_phone(to_jsonb(profile_row))` 한 경계에서 수행한다.
  - 소셜 로그인(socialProviders): `get_admin_users`가 `auth.identities.provider`에서 `'email'`(이메일·비밀번호 가입)을 제외한 소셜 provider를 `social_providers text[]`로 집계해 반환한다(미연동 시 빈 배열). v13/Supabase Auth 소유 `auth.identities`에 대한 읽기 전용 종속이며(기존 `auth.users` 조인과 동일), SECURITY DEFINER 소유자(postgres) 권한으로 읽는다. 회원 목록·상세 공통으로 노출하고, 화면은 `shared/ui/social-provider`의 `SocialProviderTags`로 브랜드 아이콘을 렌더한다(무료 Simple Icons(CC0)·Google 멀티컬러 G를 인라인 SVG로 내장, 외부 핫링크 없음. 빈 배열은 `-`, 아이콘 없는 provider는 라벨 텍스트 폴백). 마이그레이션 `supabase/migrations-admin/20260618130000_admin_users_social_providers.sql`(+ down), `admin_schema_migrations` tracker 기준 2026-06-18 dev DB 적용 완료.
  - 이메일 인증(emailVerificationStatus): `get_admin_users`가 `auth.users.email_confirmed_at IS NOT NULL`을 `email_confirmed boolean`으로 반환한다. 이메일+비밀번호 가입은 확인메일 인증 전까지 `false`(가입 미완료·중도이탈)이며, 소셜(google 등) 가입은 자동 인증되어 항상 `true`다. v13/Supabase Auth 소유 `auth.users`에 대한 읽기 전용 종속이며 write는 없다(표시·식별 전용). 프론트는 `false`만 `'미인증'`으로 매핑하고(`mapEmailVerification`), 회원 목록은 배지+컬럼 필터(`이메일 인증`)로, 회원 상세 프로필 탭은 `이메일 인증` 항목으로 노출한다. `emailVerificationStatus='미인증'`이면 회원 상태는 `인증 대기`, 약관 동의 표시는 `동의 불가`가 되며 `동의 완료`로 표시하지 않는다. `emailVerificationStatus='인증 완료'`이고 필수 약관이 미완료면 회원 상태는 `약관 대기`다. 표시명/닉네임이 비는 별개 원인(가입 경로별 `display_name`/`nickname` 채움 차이)은 본 플래그와 독립적이다.
  - 가입 생애주기 파생 상태: `get_admin_users`는 `registration_status`를 반환한다(`pending_email_verification`/`pending_required_consent`/`active`/`blocked`/`deleted`). 이메일 미인증이면 RPC가 `consent_status='none'`, `consent_accepted_at=NULL`로 정규화한다. `UserSummary.status`는 v13 `profiles.status` 원천 운영 상태(`active`/`blocked`/`deleted`)를 `정상`/`정지`/`탈퇴`로 매핑해 보관하고, 화면의 `회원 상태`는 `registration_status`를 우선 사용한다. 구 RPC/모크 fallback에서는 `status`, `emailVerificationStatus`, `termsConsentStatus`를 조합해 `인증 대기`/`약관 대기`/`정상`/`정지`/`탈퇴`로 파생한다. 관련 마이그레이션은 `supabase/migrations-admin/20260626120000_admin_users_registration_status.sql`(+ down)이다. v13 가입 플로우 원천 해결은 `docs/architecture/users-registration-lifecycle-v13-handoff.md`에 따라 별도 가드와 dry-run/backfill로 처리한다.
  - RPC write 계약: 정지/해제는 `admin_set_user_status(target_id uuid, new_status text)`를 사용한다. `new_status`는 `active`/`blocked`만 허용하고 `deleted`는 차단한다. v13 `profiles` DDL은 변경하지 않고 `profiles.status`만 토글하며, `admin_audit_logs`에는 `action='user_status_changed'`, `target_table='User'`, `target_id=userId`, `diff.status.from/to`, `payload.app_role`을 기록한다.
  - RPC export 계약: `admin_export_users(p_reason, p_include_full_phone, p_affiliation, p_scope, p_selected_user_ids, p_search, p_search_field, p_start_date, p_end_date, p_gender_filters, p_tier_filters, p_subscription_status_filters, p_membership_status_filters, p_terms_consent_status_filters, p_email_verification_status_filters, p_selected_column_keys)`는 platform_admin 전용이며 사유를 필수로 받는다. 반환 행은 목록 필드에 `gender`, `phone_masked`와 선택적 `phone`을 포함하되 XLSX 생성 단계에서 선택 컬럼만 기록한다. 감사 로그는 `target_table='User'`, `target_id='batch:' || uuid`, `action='users_exported'`, `payload.reason/row_count/scope/include_full_phone/selected_column_keys/filter_applied/filter_summary/format='xlsx'`를 기록한다. 감사 로그 payload에는 검색어 원문, 성별 값, 전화번호 값 자체, 파일 내용을 저장하지 않는다.
  - 감사 Target alias 계약: 저장 SoT는 `admin_audit_logs.target_table='User'`다. `admin_list_audit_logs`는 `User`/`Users` 필터를 모두 저장값 `User`에 매칭하고 응답은 `Users`로 projection한다. 관리자 UI도 URL 입력과 RPC row를 `Users`로 정규화해 기존 두 링크 형식을 모두 복원한다.
  - 프론트 계약: `supabase-users-service.ts`는 위 RPC 3종을 호출하며, RPC 인자명과 서비스 JSON 키를 임의 변경하지 않는다. `users.export` 권한은 UI 진입점 게이트이고 서버 권한은 RPC의 platform_admin 가드가 최종 책임을 가진다.
- `Users > 강사 관리`
  - query: `page`, `pageSize`, `sort`, `status`, `activityStatus`, `country`, `organization`, `searchField`, `startDate`, `endDate`, `keyword`
  - 핵심 필드: `id`, `realName`, `email`, `organization`, `country`, `status`, `activityStatus`, `assignmentStatus`, `courseCount`, `studentCount`, `lastActivityAt`, `lastActionAt`
- `Users > 추천인 관리`
  - query: `page`, `pageSize`, `sort`, `searchField`, `status`, `anomalyStatus`, `startDate`, `endDate`, `keyword`
  - 핵심 필드: `id`, `code`, `referrerUserId`, `referrerName`, `status`, `anomalyStatus`, `referredCount`, `confirmedCount`, `totalRewardAmount`, `lastUsedAt`, `lastActionAt`
- `Users > 기관 코드`
  - entity: `InstitutionCode`
  - table/API 후보: `institution_codes` + admin RPC `admin_list_institution_codes`, `admin_create_institution_code`, `admin_update_institution_code`, `admin_delete_institution_code`
  - query 후보: `page`, `pageSize`, `kind`, `status`, `selected`, `modal`
  - 핵심 필드: `code`, `label`, `kind`, `status`, `note`, `memberCount`, `createdAt`, `updatedAt`
  - 연동 필드: v13 `profiles.affiliation_code`는 `InstitutionCode.code`를 값으로 참조하며 하드 FK는 두지 않습니다. 기관 전용 문항 매핑 `topik_writing_question_institution_exposure.institution_code`, 기관 노출 모드 원장 `topik_writing_institution_exposure_mode.institution_code`, 계약 원장 `topik_writing_institution_contracts.institution_code`, 운영 설정 `institution_code_settings.institution_code`도 같은 code를 소프트 참조합니다.
  - enum/code table 후보: `kind`는 `박람회/기관/캠페인/기타`, `status`는 `활성/종료` 한글 라벨을 유지합니다.
  - 계약 원장(2026-08-04): `topik_writing_institution_contracts` 는 행 하나가 계약 한 건이며 그 행들의 집합이 곧 계약 히스토리입니다(별도 이력 테이블 없음). 같은 code 의 기간은 exclusion 제약(`institution_code with =`, `daterange(starts_on, ends_on, '[]') with &&`, btree_gist)으로 겹칠 수 없고, `ends_on is null` 은 무기한입니다. 효력은 KST 달력일 기준이며 `ends_on` 당일까지 유효합니다. 조회 RPC 는 `admin_list_institution_contracts`(히스토리, `contract_status` = `예정`/`유효`/`만료` lazy 계산)와 `admin_list_institution_contract_status`(요약 — `has_active_contract`, `active_ends_on`, `days_left`, `auto_hide_on_expiry`, `writing_hidden_now`)이며 후자가 마스터 관리자 화면의 만료 D-day 데이터 소스입니다. 만료 판정은 `private.institution_writing_contract_active` 단일 정의이고 **계약 행이 하나도 없는 기관은 유효로 봅니다**(만료할 계약이 없으므로 — 폴백은 항상 현행 동작).
  - 기관 운영 설정(2026-08-04): `institution_code_settings` 는 `max_members`(정원, null=무제한), `default_invite_expiry_days`(기관별 초대 유효기간 기본값, null=전역 7일), `block_intake_on_expiry`(계약 만료 시 배정·초대 행정 차단, 노출을 가리는 옵션과 별개), `contact_name`/`contact_email`(운영 담당자)을 담습니다. 행이 없는 기관은 전 항목 기본값으로 해석합니다. 좌석 사용량은 `private.institution_seat_usage`(소속 회원 + **미만료** 대기 초대) 단일 정의이며, 빈 화면 가드용 `private.institution_learner_population`(만료 무관 pending 전량)과 목적이 달라 함수를 공유하지 않습니다 — 정원에서 만료 초대를 세면 자리가 있는데 거부합니다.
  - write 계약: 생성/수정/삭제는 `InstitutionCode + code` 감사 로그를 남깁니다. 신규 코드는 모드·계약·설정 행 없이 생성되어 안전 기본값(`배정분만`, 계약 유효, 정원 무제한, 옵션 전부 off)으로 해석합니다. 삭제는 reason 필수, 가입 회원 존재 시 차단하며 기관 전용 문항 매핑·기관 노출 모드 원장·계약 원장·운영 설정을 같은 트랜잭션에서 정리합니다. 모드·계약·설정 변경과 코드 삭제는 같은 `institution_codes` 행의 `FOR UPDATE` 잠금을 공유해 최초 행 생성과 삭제도 직렬화합니다. 정원을 현재 좌석 사용량보다 낮게 설정하는 것은 거부합니다(표현 불가능한 초과 상태 방지).
  - intake 확장 계약: 정원·계약 차단·초대 기본값은 wrapper RPC `admin_assign_institution_code_guarded`, `admin_invite_institution_members_guarded` 가 담당하며 각각 원함수에 위임합니다. `admin_assign_institution_code` 와 `admin_invite_institution_members` 는 `20260731100000` 이 문자열 수술로 선행조건 가드를 심어 둔 함수라 **재정의가 금지**되어 있습니다(재정의하면 그 가드가 조용히 사라집니다). 초대 정원은 `institution_code_invitations` 의 `AFTER INSERT` row 트리거가 백스톱으로 재계수합니다. 직접 배정에는 DB 백스톱이 없습니다 — `profiles` 트리거는 v13 소유라 이 저장소가 만들 수 없고, wrapper 사전 검사와 FE 로만 덮이는 한계입니다.
- `Users > 회원 상세`
  - URL: `tab`
  - 하위 컬렉션 후보: `activities`, `payments`, `communityPosts`, `accessLogs`, `adminMemos`

### 9.1.1 System 관리자/권한 RBAC SoT 결정 (2026-06-17)

- 결정: (A) `profiles.app_role`을 관리자 인가의 유일 SoT로 확정한다. `src/features/auth/model/session-types.ts`는 v13 `profiles.app_role` 4값(`learner`, `content_admin`, `org_admin`, `platform_admin`)을 SoT로 선언하고, `src/features/auth/model/auth-store.ts`는 로그인 세션에서 `profiles.app_role`을 읽어 `RoleKey`/permission bundle을 파생한다.
- 코드 근거: `src/features/auth/model/app-role-mapping.ts`는 v13 4값을 TOPIK AI Admin 5개 `RoleKey`로 매핑하며, 주석으로 "Real authorization is enforced by v13 RLS/RPC, not by this client-side bundle"이라고 경계를 고정한다. `src/features/system/model/permission-store.ts`의 권한 부여/수정/회수는 Zustand 메모리와 mock audit만 갱신하고 DB/RPC 권한 SoT를 쓰지 않는다.
- RLS/RPC 근거: admin 마이그레이션과 topik writing 마이그레이션은 `private.is_admin`, `private.is_content_admin`, `private.is_platform_admin` 가드로 `profiles.app_role` 기반 인가를 수행한다. `get_admin_users`/`admin_set_user_status`도 `private.is_platform_admin` 전용이며 `profiles.app_role`을 반환/감사 payload에 기록한다.
- 기각안: (B) 신규 `system_roles`/`system_permissions`/`role_permissions`/`admin_permissions` RBAC 레이어는 채택하지 않는다. 이유는 현재 라이브 인가가 v13 `profiles.app_role` + RLS/RPC 헬퍼에 고정되어 있고, admin은 v13 테이블 DDL 변경 금지 경계를 가진 상태에서 별도 권한 테이블을 SoT로 만들면 동기화/이중인가/회귀 리스크가 커지기 때문이다.
- 화면 카탈로그 계약: `permissionCatalog` 37개 permission key와 `roleCatalog` 5개 `RoleKey`는 DB 인가 SoT가 아니라 관리자 메뉴/표시 게이팅 및 운영자 이해를 위한 client bundle이다. 화면의 권한 부여/수정/회수 UI는 실제 인가 반영 조치로 표기하지 않고, `app_role` 매핑 변경 또는 조회/시뮬레이션 전용으로 재정의해야 한다.

| v13 `profiles.app_role` | TOPIK AI Admin `RoleKey` | 화면 권한 bundle | 실인가 의미 | 비고 |
| --- | --- | --- | --- | --- |
| `platform_admin` | `SUPER_ADMIN` | `roleCatalog.SUPER_ADMIN.defaultPermissions` | platform 관리자 RPC/RLS 허용 | 관리자/회원/시스템 고위험 조치의 주된 실인가 역할 |
| `content_admin` | `CONTENT_MANAGER` | `roleCatalog.CONTENT_MANAGER.defaultPermissions` | content/admin 헬퍼 허용 범위 | 평가/콘텐츠/일부 admin read/write 가드에 사용 |
| `org_admin` | `READ_ONLY` | `roleCatalog.READ_ONLY.defaultPermissions` | 별도 admin write 권한으로 확인되지 않음 | 보수적 화면 매핑. 실제 운영 허용 범위는 오너 확인 필요 |
| `learner` | `null` | 없음 | 관리자 접근 불가 | `auth-store`가 unauthorized 처리 |

- 구현 함의: `/system/permissions`에서 개별 permission 부여/회수는 DB 권한 변경으로 간주하지 않는다. 실권한 변경이 필요하면 v13 소유 `profiles.app_role` 변경 경로 또는 별도 오너 승인된 RPC가 필요하며, admin repo에서 v13 `profiles` DDL을 변경하지 않는다.
- 미확정/오너 확인 필요: `org_admin`을 장기적으로 관리자 콘솔 조회 전용으로 유지할지, 관리자 `app_role` 변경을 누가/어떤 RPC로 수행할지, 권한 변경 화면을 조회/시뮬레이션으로 축소할지 `app_role` 매핑 조치 화면으로 바꿀지, 세션 중 `app_role` 변경 시 재인증/토큰 갱신 정책은 후속 결정이 필요하다. → **아래 §9.1.1.a에서 확정(2026-06-18).**

### 9.1.1.a System 관리자 app_role 변경 RPC 확정 (2026-06-18)

- §9.1.1의 미확정 4항목을 다음과 같이 확정한다(오너 결정 2026-06-18).
  - 변경 RPC/주체: 관리자 `app_role` 변경은 `public.admin_set_admin_app_role(p_target_user_id uuid, p_new_app_role text, p_reason text)` 단일 write 경로로만 수행한다. `SECURITY DEFINER`, `private.is_platform_admin` 전용(platform_admin만 변경), `p_reason` 필수, 허용값 `platform_admin`/`content_admin`/`org_admin`/`learner`.
  - 승인 체계: 단독 실행(2인 승인 없음). 자기 자신 platform_admin 강등과 마지막 platform_admin 강등은 RPC에서 차단한다(잠금 방지).
  - 세션 정책: 기존 세션 강제 만료·토큰 폐기는 하지 않는다. `profiles.app_role`만 갱신하며 변경은 다음 로그인 때 반영된다(`payload.session_policy='next_login'`).
  - 화면 정체성: `/system/permissions`는 조회/시뮬레이션 축소가 아니라 관리자별 `app_role` 변경 화면으로 개조한다. 37 permission/5 RoleKey 카탈로그는 메뉴 게이팅·참고용 읽기 전용으로 유지한다.
  - `org_admin → READ_ONLY` 매핑은 장기 정책으로 유지 확정(오너 결정 2026-06-18; org_admin 고유 업무가 생기면 재검토).
- 쓰기 계약: `profiles`는 v13 소유이며 admin repo에서 DDL/트리거를 변경하지 않는다. `private.protect_profile_columns` 트리거가 `is_admin(caller)`(content_admin/platform_admin, active)에 대해 컬럼 보호를 전면 우회하므로 platform_admin 호출자는 `app_role`을 쓸 수 있다(라이브 컬럼 `status`를 쓰는 `admin_set_user_status`와 동일 메커니즘). dev DB(2026-06-18)에서 직접 검증했고, RPC는 `UPDATE ... RETURNING`으로 self-verify하여 트리거가 향후 쓰기를 막으면 거짓 감사 없이 즉시 실패한다.
- 감사 계약: `admin_audit_logs.target_table='AdminAccount'`, `action='admin_role_changed'`, `target_id`=대상 uuid, `diff={app_role:{from,to}}`, `payload={reason,target_email,target_display,session_policy:'next_login'}`.
- 조회 계약: `/system/permissions` 관리자 목록은 `public.admin_list_admin_app_roles(p_search text default null)`(platform_admin 전용, `app_role <> 'learner'` 서버 필터, 검색 지원)로 읽는다. learner를 admin으로 승격하는 흐름은 이 목록 범위 밖이며 Users 디렉터리에서 처리한다.

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
  - Supabase source: `operation_notices`(소유 topik-ai, tracker `admin_schema_migrations`, migration home `supabase/migrations-admin`)
  - status 저장 코드: `published`(`게시`) / `hidden`(`숨김`)
  - write RPC: `admin_save_operation_notice`, `admin_toggle_operation_notice_status`, `admin_delete_operation_notice`
  - 감사 로그: `target_table='OperationNotice'`, `target_id=noticeId`, action `notice_saved`/`notice_status_changed`/`notice_deleted`
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
  - Supabase source: `operation_faqs`, `operation_faq_curations`, `operation_faq_metrics`(소유 topik-ai, tracker `admin_schema_migrations`, migration home `supabase/migrations-admin`)
  - enum 저장 코드:
    - FAQ status: `published`(`공개`) / `hidden`(`비공개`)
    - FAQ category: `계정` / `결제` / `커뮤니티` / `메시지`
    - curation surface: `help_center` / `home_top` / `payment_help` / `onboarding`
    - curation mode: `manual` / `auto`
    - curation exposure status: `active` / `paused`
  - write RPC: `admin_save_operation_faq`, `admin_toggle_operation_faq_status`, `admin_delete_operation_faq`, `admin_save_operation_faq_curation`, `admin_delete_operation_faq_curation`
  - 감사 로그: FAQ 원문은 `target_table='OperationFaq'`, `target_id=faqId`, action `faq_saved`/`faq_status_changed`/`faq_deleted`; 큐레이션은 `target_table='OperationFaqCuration'`, `target_id=curationId`, action `faq_curation_saved`/`faq_curation_deleted`
  - 지표 계약: `operation_faq_metrics`는 admin write RPC가 없는 seed/read 전용 스냅샷이며 실집계 파이프라인은 미확정
- `Operation > 이벤트`
  - query: `searchField`, `keyword`, `startDate`, `endDate`, `status`, `eventType`, `sortField`, `sortOrder`, `selected`
  - 핵심 필드: `id`, `title`, `summary`, `bodyHtml`, `eventType`, `progressStatus`, `visibilityStatus`, `startAt`, `endAt`, `exposureChannels`, `targetGroupId`, `targetGroupName`, `participantCount`, `participantLimit`, `rewardType`, `rewardPolicyId`, `rewardPolicyName`, `rewardPolicySummary`, `bannerImageUrl`, `landingUrl`, `messageTemplateName`, `slug`, `metaTitle`, `metaDescription`, `ogImageUrl`, `canonicalUrl`, `indexingPolicy`, `adminMemo`, `updatedAt`, `updatedBy`
  - Supabase source: `operation_events`(소유 topik-ai, tracker `admin_schema_migrations`, migration home `supabase/migrations-admin`)
  - enum 저장 코드:
    - event type: `프로모션` / `출석` / `챌린지` / `리워드`
    - visibility status: `exposed`(`노출`) / `hidden`(`숨김`) / `scheduled`(`예약`)
    - progress status: `ongoing`(`진행중`) / `upcoming`(`예정`) / `ended`(`종료`) — 읽기 시 기간 기준 파생
    - exposure channels: `앱홈` / `웹홈` / `이벤트탭` jsonb 배열
    - reward type: `없음` / `쿠폰` / `포인트` / `배지`
    - banner image source type: `file` / `url`
    - indexing policy: `index` / `noindex`
  - write RPC: `admin_save_operation_event`, `admin_schedule_operation_event`, `admin_publish_operation_event`, `admin_end_operation_event`
  - 감사 로그: `target_table='OperationEvent'`, `target_id=eventId`, action `event_saved`/`event_scheduled`/`event_published`/`event_ended`
  - 비정규화 결정: `reward_policy_id`/`reward_policy_name`, `message_template_id`/`message_template_name`은 외부 도메인 FK 없이 denormalized 문자열 snapshot으로 저장한다. 배너 이미지는 `banner_images` jsonb 배열과 대표 배너 파생 필드를 함께 사용하며, 정규화/asset FK 전환은 후속이다.
- `Operation > 이벤트 등록 상세`
  - query: 목록 복귀용 `searchField`, `keyword`, `startDate`, `endDate`, `status`, `eventType`, `sortField`, `sortOrder`
  - 핵심 필드: `id`, `slug`, `title`, `summary`, `bodyHtml`, `eventType`, `progressStatus`, `visibilityStatus`, `startAt`, `endAt`, `exposureChannels`, `targetGroupId`, `targetGroupName`, `participantLimit`, `rewardType`, `rewardPolicyId`, `rewardPolicyName`, `bannerImageUrl`, `landingUrl`, `messageTemplateName`, `metaTitle`, `metaDescription`, `ogImageUrl`, `canonicalUrl`, `indexingPolicy`, `adminMemo`, `updatedAt`, `updatedBy`
  - 데이터소스 전환: `operation-events-data-source.ts`가 Supabase 설정과 `VITE_OPERATION_EVENTS_SOURCE`에 따라 mock/Supabase를 분기한다. `VITE_SUPABASE_DISABLED=true` 또는 `VITE_OPERATION_EVENTS_SOURCE=mock`은 기존 mock 경로로 회귀한다.

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

> **2026-06-11 인바운드 전환(결정 기록 §0)**: TOPIK 쓰기 문항의 데이터 흐름이 인바운드 수신 모델로 확정됐다. 문제 발원 = 외부(공급) API(**미개발** — 문제 본문+메타데이터가 완성 상태로 공급), admin 역할 = 수신·적재 + 관리 포인트(태그) + 노출 통제(`service_status`)이며, **검수 개념은 admin 표면·스키마·계약·정책에서 전면 삭제**됐다. 재정의 P3 코드 컷오버(커밋 `202f905`)로 검수 표면 제거·신규 스키마 읽기 전환이 완료되어 본 §9.6은 신규 스키마 기준으로 재작성됐다(구 `problems` 기준 계약은 역사 — git 이력 참조). 검수 4컬럼 물리 제거 마이그레이션 `0013`도 2026-06-11 적용 완료(DB 검수 잔존 0건 — 증적 로그 P3 재채점 절). 페이지 재정의: `/assessment/question-bank`=문항 목록+관리 통합, `/assessment/question-bank/manage`=redirect 역사 경로. 쓰기 계약은 §12.3, 인바운드 수신 계약은 §12.6.

- `Assessment > TOPIK 쓰기 문항` (사이드바 라벨 — 조회+관리 통합)
  - 라우트: `/assessment/question-bank`(목록+관리 통합), `/assessment/question-bank/manage`(redirect 역사 경로), 상세 2depth `/assessment/question-bank/{questionId}`(재정의 P3에서 구 `…/review/{questionId}` 개명 완료).
  - query (공통, 두 페이지): 반복 `questionNo`, `topicMain`, `topicDetail`, `questionType`, `difficulty`, `keyword` (+ P4 태그 필터 예약 키 `tag`)
  - query (통합 페이지): `serviceStatus` (구 `operationStatus`·목록 전용 `reviewStatus`는 재정의 P3에서 제거 완료)
  - 각 라우트는 자체 URL 상태를 보존하며 페이지 전환용 `tab` 쿼리 파라미터는 더 이상 사용하지 않습니다. 상세는 `detailTab=history`와 `versionId=<import_id>`를 사용하고 목록 복귀 시 이 두 키만 제거합니다.
  - 엔티티 후보
    - `AssessmentQuestion`
    - `AssessmentQuestionAuditEvent`
    - `AssessmentQuestionVersion` — 같은 `question_id`에 속하는 불변 내용 버전. 내부 `import_id`와 `payload_hash`로 식별하며 원본 순서는 `source_updated_at`으로 판정
    - `AssessmentQuestionCurrentVersion` — 신규 풀이·북마크·임시저장이 해석할 현재 버전 포인터
    - 화면 조회 모델 `AssessmentQuestionVersionSummary`(`questionId`, `canonicalImportId`, `versionCount`, `revisionCount`), `AssessmentQuestionVersionEntry`(`questionId`, `importId`, `payloadHash`, `contentHash`, `sourceCreatedAt`, `sourceUpdatedAt`, `firstSeenAt`, `lastSeenAt`, `ingestCount`), `AssessmentQuestionVersionDetail`(`entry`, `question`)
  - 버전·사용자 노출 계약(SoT: `docs/architecture/writing-question-version-policy.md`)
    - 논리 식별자: `question_id`는 수정 전후 동일 문항을 묶고, 학습 과제·답안 형식·평가 목표가 달라지면 새 `question_id`를 발급한다.
    - 외부 계약: `question_id`는 논리 ID, `created_at`은 문항군 불변 UTC ISO-8601, `updated_at`은 수정 시 단조 증가하는 UTC ISO-8601이며 미수정이면 `created_at`과 같다. 한 응답의 `question_id`는 중복될 수 없다.
    - 버전 판정: 동일 `payload_hash`는 수신 횟수만 갱신한다. 가장 최신의 유효한 수신본(`promoted` 또는 검수 완료 수신)보다 더 최신인 `source_updated_at`과 다른 `content_hash`가 함께 확인된 경우만 `content_changed` 새 버전이며, 같은 내용은 `metadata_only` 수신 행으로만 보존한다. 같거나 과거인 시각의 내용 충돌과 생성 시각/번호/ID 충돌은 held다. 서비스 현재 버전 판별은 이 비교 기준과 분리해 `canonical_import_id`만 사용한다.
    - 버전 식별자는 내부 `import_id`를 유지하고 `updated_at`을 URL/PK로 쓰지 않는다.
    - 북마크·임시저장: `question_id` 기준으로 현재 버전을 해석하며 과거 버전을 사용자 노출용으로 고정하지 않는다.
    - 제출: 서버 제출 확정 시점의 `canonical_import_id`, `payload_hash`, learner-safe `question_snapshot`을 함께 고정하고 채점·피드백·과거 결과에서 재사용한다.
    - 현재 문항 테이블 upsert는 최신 조회용 projection이며 불변 버전 이력의 SoT가 아니다.
    - 관리자 문항 이력은 `mapping_status='promoted'`인 승격 버전만 포함합니다. `raw`·`held`·`metadata_only`는 모든 수신 행을 보여주는 인박스에서만 확인하고, 현재 판별은 `question_source_map.canonical_import_id`만 사용하며 인박스 `is_latest`나 `source_updated_at`을 추론하지 않습니다.
  - 현재 Supabase source (facade 스위치 `question-bank-data-source.ts` 기본 `topik_writing` — 재정의 P3 컷오버 완료)
    - 목록: 추천 뷰 `topik_writing_question_recommendation_view`(E4 확장 컬럼 포함) + 활성 태그 집계(`topik_writing_question_tags`)
    - 상세: 번호별 테이블 `topik_writing_51/52/53/54_questions`(번호별 전용 필드 포함)
    - 버전 요약: 읽기 전용 `topik_writing_question_version_summary_view`(`question_id`, `canonical_import_id`, `version_count`, `revision_count`). `revision_count=greatest(승격 버전 수-1, 0)`이며 현재 포인터가 없으면 UI는 `버전 연결 없음`으로 분리합니다.
    - 버전 목록·과거 상세: `topik_writing_question_import`의 `mapping_status='promoted'` 행. `source_created_at`, `source_updated_at`, `content_hash`, `payload_hash`를 포함하며 과거 상세는 반드시 `question_id + import_id`를 함께 검증하고 `raw_payload`를 기존 상세 mapper로 변환합니다.
    - 인박스: `topik_writing_question_import` 모든 수신 행의 `is_latest`, `mapping_status`, `version_decision`, `hold_reason`, 원본 시각과 두 hash를 표시합니다. `is_latest`는 마지막 수신 원문일 뿐 현재 서비스 버전이 아닙니다.
    - 마스터: `topik_writing_topic_master`(주제 17/85 — 검색 옵션), `topik_writing_tag_master`(활성 사전 — 태그 편집 옵션 축, '서비스_노출상태' 그룹은 facade에서 필터)
    - 마스터 카탈로그(P5-1 — 2026-06-11): 동일 마스터 2테이블의 **전수 조회**(비활성·전 그룹 포함, 필터 없음) facade `fetchQuestionBankTopicMasterCatalogSafe`/`fetchQuestionBankTagMasterCatalogSafe` — `/system/metadata`의 `TOPIK 쓰기 마스터 데이터` 섹션이 소비(legacy 모드는 빈 배열). 화면 모델: `TopikWritingTopicMasterCatalogRow`(topicId/topicMain/topicDetail/sourceName/isActive/sortOrder/memo), `TopikWritingTagMasterCatalogRow`(tagCode/tagNameKo/tagGroup/description/usageRule/exampleQuestionId/isActive/updatedAt)
    - 마스터 쓰기(P5-3 개방 — 2026-06-11): tag_master **활성/비활성 토글 단일** — `admin_update_tag_master_status`(0014, SECURITY DEFINER, **platform_admin 가드** — 문항 RPC의 content_admin과 분리, 사유 필수·미존재·무변경 거부, `admin_audit_logs` 기록: `tag_master_status_changed`/`AssessmentTagMaster`/tag_code/diff `{is_active:{from,to}}`/payload `{note, active_assignment_count}`). facade `updateTagMasterStatusSafe`(사유 공백 거부, mock 분기 동반, legacy 거부). 주제 마스터·마스터 값 편집(이름·설명·그룹 등)은 조회 전용 유지 — 직접 테이블 write는 RLS 차단(쓰기 정책 0건)
    - 쓰기(P4 개방 완료 — 2026-06-11, 태그 별도 입력 제거 — 2026-06-12, 기관 노출 정합화 — 2026-06-26): `admin_update_topik_question`(`service_status` 단일 화이트리스트, 사유 `__note`→`payload.note`)/`admin_assign_question_tag`/`admin_remove_question_tag`(별도 메모 인자 없음)/`admin_set_writing_question_institutions`/`admin_clear_writing_question_institutions`/`admin_add_institution_writing_questions`/`admin_remove_institution_writing_questions` — SECURITY DEFINER 감사 RPC(§12.3), `admin_audit_logs` 기록. facade: `updateAssessmentQuestionServiceStatusSafe`(사유 공백 거부)/`assignQuestionTagSafe`/`removeQuestionTagSafe`/기관 노출 facade. 직접 테이블 write는 RLS 차단(쓰기 정책 0건)
    - 최종 source: Supabase가 구성된 환경은 `topik_writing` canonical repository만 사용합니다. env `VITE_QUESTION_BANK_SOURCE`와 v13 `problems` 읽기 어댑터, 구 `admin_update_problem` 경로는 제거됐습니다. Supabase 미구성 CI·스모크 환경만 결정적 mock을 사용합니다.
  - 핵심 필드
    - Supabase 원천(공통): `question_id`, `item_number`, `topic_main`/`topic_detail`(+보조 주제), `question_type_name`, `target_level`/`difficulty_level`, `scenario_type`, `situation_summary`, `learning_objective`, 문항 본문, 모범답안, `auto_checks_passed`(수신 정합 검사 — 존치), `content_team_memo`(수신 메타데이터 — admin 쓰기 없음), `service_status`, `recommendation_keys`, `created_at`, `updated_at` + 번호별 전용 컬럼(51 빈칸 메타/52 완성 단위·단서/53 자료 수치 `source_data`/54 문항 질문 등 — page-IA §5.2)
    - 화면 모델: `questionId`, `questionNumber`, `topicMain`/`topicDetail`, `questionTypeName`, `targetLevel`/`difficultyLevel`, `scenarioType`, `situationSummary`, `serviceStatus`, `institutionExposure`, `recommendationKeys`, `updatedAt` + 상세 전용(학습 목표, 문항 본문, 번호별 전용 블록, 모범답안, `autoChecksPassed`, `contentTeamMemo` 읽기 전용) + 버전 조회 모델(요약/이력/과거 상세)
    - (제거 완료 — 재정의 P3, `202f905`) 구 화면 모델의 `reviewStatus`/`validationStatus`/`reviewMemo`/`operationStatus`/`usageCount`/`linkedExamCount`/`revisionHistory` 등 검수·구 운영 축 필드는 제거됐다. 검수 4컬럼(`review_status`/`review_workflow_status`/`review_passed`/`validation_result`)도 마이그레이션 `0013`에서 물리 제거 완료됐다(2026-06-11 적용 — 스냅샷 4테이블 검수 컬럼 0건)
  - 계약 메모
    - `AssessmentQuestionSeed`, feature 내부 JSON fixture, Zustand 문제은행 store는 source 계약에서 제거되었습니다. Supabase 조회가 실패해도 JSON fixture를 fallback으로 읽지 않습니다(Supabase 미구성 시 명시적 `mock` 모드 — D-12).
    - 목록 `상황 요약` 컬럼은 `situation_summary`를 1줄 말줄임 + hover 툴팁(전문/시나리오 유형)으로 표시하고, `주제(종합/세부)` 컬럼은 `topic_main`/`topic_detail` 2단으로 표시합니다.
    - Supabase source가 없는 표시값은 임의 생성하지 않고 `-`, `미지정`, 빈 목록 sentinel로 표시합니다(legacy 롤백 소스의 `serviceStatus`=`미지정`, 태그=빈 값 포함).
    - 과거 `raw_payload`를 상세 mapper로 변환할 때 현재 운영 값인 `serviceStatus`를 과거 payload의 상태처럼 노출하지 않습니다. 버전 ID, 원본 생성/수정 시각, content/payload hash, 수신 시각/재수신 정보는 별도 버전 정보로 표시합니다.
    - 수신/승격은 `question_id` advisory transaction lock으로 직렬화하고 각 bulk RPC는 ID 정렬을 유지합니다. API는 50건 적재 청크를 모두 성공한 뒤 50개 ID 승격 청크를 실행하며 재시도는 payload/import 멱등 계약을 사용합니다.
    - 2026-07-16 상류 실응답 701건의 `updated_at`이 모두 null이므로 신규 source timestamp 판정 마이그레이션은 공급 계약 검증 전 dev/운영 적용 보류입니다.
    - 버전 요약·이력 조회 실패는 기존 목록/현재 상세 요청과 분리된 safe 조회 경계에서 처리하고, 해당 컬럼·탭만 error/retry 상태로 격리합니다.
    - 이전 버전 대비 자동 필드 diff와 과거 버전 복원·재활성화는 현재 계약 범위가 아닙니다.
    - **[폐기 — 2026-06-11 인바운드 전환]** 구판 계약("`reviewStatus = 검수 완료` → 운영정책 `POL-017`에 따라 상류 `TalkPik AI Service`로 배포(API 업로드)")은 폐기됐습니다. 상류 push(업로드/배포) 트랙 자체가 소멸했고, `POL-017`은 "TOPIK 쓰기 문항 수신·관리 운영정책"으로 재정의됐습니다. 상류 Writing API(`GET /api/writing/tasks`)의 작문 과제는 v13 사용자 노출용이며 admin 배포 대상이 아닙니다. admin의 노출 통제는 `service_status` 컬럼(§12.3), 문항 품질·상태 표현은 태그로만 합니다.
    - **[폐기 — 2026-06-11 인바운드 전환]** 배포 연동 필드 후보(`reviewExportStatus`, `reviewExportedAt`, 상류 작문 과제 식별자 `publishedTaskId`)는 push 트랙 소멸로 계약 후보에서 제거합니다. 단 `topik_writing_question_source_map.published_task_id` 컬럼은 물리적으로 존재하므로 용도 재검토 예정으로 표시합니다(§12.1).
    - (제거 완료 — 재정의 P3, `202f905`) 구 `reviewMemo` UI-local annotation과 검수 메모 영구화 계약(구 D-7)은 검수 개념 삭제로 철회·제거됐습니다. 태그 부여/제거용 운영 메모 필드도 2026-06-12 계약에서 제거했습니다. `content_team_memo`는 수신 메타데이터로 존치하되 admin 쓰기는 없습니다(상세 `문항 상태` 카드에 읽기 전용 표시).
    - 노출 상태(`serviceStatus`)는 재정의 P3에서 `service_status` 실값 표시로 전환 완료됐습니다(구 `operationStatus` `미지정` sentinel 단계 종료 — legacy 롤백 소스에서만 `미지정`). 통합 문항 페이지(`/assessment/question-bank`)의 운영 조치(노출 가능/노출 제외/내부 테스트)와 태그 부여/제거(태그 편집 모달)는 **P4 관리 포인트 개방(2026-06-11) + 2026-06-23 통합**으로 활성입니다. 노출 상태 전환은 확인+사유(필수) → RPC → 감사 로그 흐름(ConfirmAction + AuditLogLink)을 유지하고, 태그 부여/제거는 사유 없이 태그 이력과 감사 액션으로 추적합니다. POL-018 ②③ 화면 가드 포함. 구 "준비 중" 경고 Alert와 `OPERATION_WRITE_ENABLED`/`SERVICE_STATUS_WRITE_ENABLED` 게이트는 제거됐습니다(RT-4 왕복 증적: `logs/metadata-tag-schema-transition-evidence.md` P4 절).
    - 기관 노출 매핑(`topik_writing_question_institution_exposure`)은 `service_status` 위에 얹히는 기관 할당 레이어입니다. 실제 노출 판단은 `service_status='available' AND NOT (기관 만료 자동 비노출 ON AND 계약 무효) AND (사용자 affiliation_code 없음 OR 기관 노출 모드 = 제한 없음 OR 매핑.institution_code = 사용자 affiliation_code)`입니다 — 무소속 학습자는 `available` 문항 전체를 보고, 기관 노출 모드가 `제한 없음` 인 기관의 소속 학습자도 전체를 보며(배정 목록은 보존되지만 게이팅에 참여하지 않습니다), `배정분만` 기관의 소속 학습자만 배정된 문항으로 제한됩니다. 모드 원장은 `topik_writing_institution_exposure_mode` 이고 행이 없으면 `배정분만` 입니다. 2026-08-04 만료 분기를 추가했습니다(`supabase/migrations/20260804100000_...`): `auto_hide_on_expiry` 가 켜져 있고 계약이 유효하지 않으면 노출 모드와 무관하게 전부 거부하며, **이 분기는 `제한 없음` 분기보다 반드시 앞에 옵니다**(뒤에 두면 `제한 없음` 기관이 만료돼도 전량이 계속 보여 옵션이 무의미해집니다 — 마이그의 사후 do-block 이 위치를 단정합니다). 만료는 배정 행을 지우지 않는 lazy 판정이므로 계약을 연장하면 배정 행 수가 하나도 바뀌지 않은 채 즉시 복구됩니다. 매핑 행은 허용 목록이며 다른 학습자에게 잠그는 장치가 아닙니다. 강제 지점은 `private.is_writing_question_visible_to_user` 단 하나이고 `public.get_available_writing_questions`가 모든 학습자 경로를 그 predicate로 통과시킵니다. 2026-07-30 오너 결정으로 라이브 규칙을 계약으로 확정했습니다(`supabase/migrations/20260730120000_topik_writing_institution_exposure_contract_correction.sql`). 2026-07-31 선행조건 가드를 추가했습니다: 배정 0건 기관에는 회원 직접 배정·초대 발송이 거부되고(`admin_assign_institution_code`/`admin_invite_institution_members`), 소속 회원 또는 대기 중 초대가 있는 기관은 배정을 0건으로 되돌릴 수 없습니다(exposure statement 트리거) — 배정 0건 기관의 소속 학습자가 쓰기 문항을 하나도 보지 못하는 상태를 도달 불가로 만듭니다(`supabase/migrations-admin/20260731100000_...`, `supabase/migrations/20260731100100_...`). `service_status!='available'` 문항은 신규 기관 매핑 추가가 blocked 처리되고, 기존 매핑은 삭제하지 않되 `전역 미노출`으로 계산합니다. 제거/전체 해제는 stale 매핑 정리를 위해 상태와 무관하게 허용합니다.
    - 통합 문항 페이지와 2depth 상세는 동일한 신규 스키마 조회 결과(facade 공유 hook)를 공유하므로, 위 Supabase 원천 / 화면 모델 필드 매핑은 변경 없이 동일하게 적용됩니다.
    - 과거 JSON 검수 문서용 `reviewDocument` 타입과 화면 분기는 제거되었습니다. 상세 payload/JSONB 문서가 다시 필요하면 새 Supabase/API 계약을 확정한 뒤 별도 타입으로 추가합니다.
    - 콘텐츠팀 권장 스키마(`docs/metadata-tag-schema-rule.md` v0.8)는 **2026-06-10 채택 확정**됐고 채택 계약은 §12에서 추적합니다(결정 기록: `docs/architecture/metadata-tag-schema-transition-decision-record.md` — 2026-06-11 §0 인바운드 전환 반영). 재정의 P3 읽기 컷오버 완료(`202f905`)에 따라 본 §9.6은 신규 스키마·인바운드 모델 기준으로 재작성됐고, 구 `problems` 기준 §9.6 계약은 git 이력의 역사 기록입니다(legacy 어댑터는 롤백 봉인 경로로만 잔존).
  - enum / code table candidate
    - `questionNumber`: `51`, `52`, `53`, `54`
    - `serviceStatus`: `available`(노출 가능) / `excluded`(노출 제외) / `internal_test`(내부 테스트, 기본값) + 표시 전용 sentinel `미지정`(legacy 롤백 소스) — D-6, 유일한 물리 노출 상태
    - `topicMain`/`topicDetail`: `topik_writing_topic_master` 시드(17주제/85세부) 기반 — 하드코딩 enum 아님
    - `questionTypeName`: 신규 스키마 `question_type_name` 수신값 표시 — 하드코딩 enum 아님
    - `difficultyLevel`: `1`~`6` 정수(급수 `target_level` 병기 — 구 `상`/`중`/`하` 축은 재정의 P3에서 제거 완료)
    - 태그: `tag_master` 사전(schema-rule §2) 기반 — 활성 태그 수 집계 표시 + 태그 편집 모달(P4 개방 완료, 부여/제거)
    - (제거 완료 — 재정의 P3) 구 `domain` 8값·`questionTypeLabel` 4값·`reviewStatus` 5값·`operationStatus` 4값·`validationStatus` 3값·`sourceType` enum은 전부 제거됐습니다
  - 하드코딩 분류
    - `schema candidate`
      - 문항 본문, 정답/가이드, 수신 배치 메타데이터
    - `code table candidate`
      - 문제 번호, 노출 상태(`service_status`), 자동 점검 상태(`auto_checks_passed`)
    - `ui-only`
      - 페이지 안내 문구, 관리 포인트 준비 중 경고 Alert, empty/error/pending 메시지, mock 모드 안내
  - 감사 로그 / URL 계약
    - `Target Type = AssessmentQuestion`
    - `Target ID = questionId`
    - 원본 화면 역추적 경로: `/assessment/question-bank/{questionId}` (재정의 P3에서 구 `…/review/{questionId}` 개명 완료)

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

- 번호별 분리 문제 테이블: `topik_writing_51_questions`, `topik_writing_52_questions`, `topik_writing_53_questions`, `topik_writing_54_questions` (v0.8 실측: 공통 35컬럼 + 편차 E1 `review_workflow_status` + 번호별 전용 16~21컬럼 — 51:21·52:17·53:19·54:16). ※ 편차 E1은 2026-06-11 철회 — `review_workflow_status` 등 검수 컬럼은 P1 산출물로 물리 잔존했으며 재정의 P3 마이그레이션 `0013`에서 제거 완료(2026-06-11 적용, §12.4)
- 태그: `topik_writing_tag_master`(태그 값 사전) + `topik_writing_question_tags`(문제-태그 매핑) — 인바운드 모델의 admin 관리 포인트(부여/제거)
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
| `recommendation_keys`, `avoid_repeat_keys`, 태그 | (source 없음) | net-new. 초기값은 ETL 파생(P2) + 태그는 인바운드 모델의 admin 관리 포인트로 운영 개방 완료(P4 — 2026-06-11, 태그 편집 모달 + RPC) |
| `content_team_memo` | (없음 — 검수 메모 UI-local 가짜 저장) | **[D-7 철회(2026-06-11), 2026-06-12 보강]** 검수 메모 영구화 계약 폐기. `content_team_memo`는 **수신 메타데이터**로 존치(admin 쓰기 없음). 태그 부여/제거용 운영 메모 필드는 두지 않음 |

### 12.3 쓰기·감사 계약 (D-8 — 2026-06-11 개정)

- admin 쓰기 계약은 **태그 + `service_status` + 기관 노출 매핑**으로 한정한다(인바운드 모델의 관리 포인트·노출 통제). 그 외 문항 본문·메타데이터는 외부 공급분이며 admin 쓰기가 없다.
- 모든 신규 테이블 직접 write는 RLS로 차단하고, 쓰기는 SECURITY DEFINER RPC 단일 경로로만 허용: `admin_update_topik_question`(화이트리스트 patch — 재정의 후 허용 범위는 `service_status` 중심으로 축소. DB측 검수 필드 patch 경로는 마이그레이션 `0013`에서 제거 완료), `admin_assign_question_tag`/`admin_remove_question_tag`(이력 보존형, 별도 메모 인자 없음), `admin_set_writing_question_institutions`/`admin_clear_writing_question_institutions`, `admin_add_institution_writing_questions`/`admin_remove_institution_writing_questions`. RPC는 `admin_audit_logs`에 actor=`auth.uid()` + 컬럼 diff 또는 payload를 기록한다 — `target_table='AssessmentQuestion'`, `target_id=question_id`. **화면 결선은 P4 관리 포인트 개방(2026-06-11), 2026-06-23 통합, 2026-06-26 기관 정합화로 완료**다.
- 액션 코드(2026-06-26 개정): 유지=`service_status_changed`/`tag_assigned`/`tag_removed`, 기관 매핑=`question_institutions_changed`/`question_institutions_cleared`, 신설 예정=`question_received`(외부 공급 API 수신·적재 시점 기록 — 공급 연동 시 확정), 폐기=검수 4종(`review_completed`/`review_on_hold`/`review_revision_requested`/`review_memo_saved`)·`question_published`(상류 push). 폐기 액션의 RPC 분기는 재정의 P3 마이그레이션 `0013`에서 제거 완료됐다(2026-06-11 적용).
- 구 `admin_update_problem` RPC는 v13 admin island 제거(2026-06-09)로 라이브 DB에 존재하지 않음(실측). 동등 보장의 비교 대상은 v13 마이그레이션 파일의 계약 원문이다.

### 12.4 v0.8 원안 대비 편차 목록 (승인 완료 — E1은 2026-06-11 철회)

| 편차 | 내용 | 사유 |
| --- | --- | --- |
| E1 | 4테이블 공통 컬럼 `review_workflow_status` 추가 | **[철회 — 2026-06-11]** 검수 개념 삭제로 편차 자체가 폐기. 컬럼은 P1 산출물로 물리 잔존했으며 재정의 P3 마이그레이션 `0013`에서 제거 완료(2026-06-11 적용). (종전 사유 D-2: 현행 검수 진행 2축 보존 — 역사 기록) |
| E2 | 매핑 테이블 `topik_writing_question_source_map` 추가 (+`legacy_topic_category_code` 보존 컬럼) | D-4 채번 idempotency·레거시 역추적 (구 "배포 증적" 용도는 push 폐기로 소멸 — `published_task_id` 용도 재검토 예정) |
| E3 | tag_master 시드에서 '서비스_노출상태' 그룹 제외 + 운영주의 그룹 '운영 제외' 값 추가 | D-6: `service_status` 컬럼과의 이중 기록 차단 |
| E4 | 추천 뷰에 admin 목록용 6컬럼 확장(`situation_summary`/`question_type_name`/`content_team_memo`/`review_workflow_status`/`created_at`/`updated_at`) | §7.9 12컬럼만으로 목록 화면 요구 충족 불가. ※ 이 중 `review_workflow_status`는 E1 철회에 따라 재정의 P3 마이그레이션 `0013`의 뷰 재생성(16컬럼)에서 제거 완료(2026-06-11 적용) |

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

## 13. Operation 공지사항 데이터 계약 (2026-06-17 신설)

- 엔티티/테이블: `OperationNotice` / `operation_notices`.
- 승격 상태: 기존 `schema candidate`/mock-only 계약에서 Supabase 실 테이블 계약으로 승격 완료했습니다.
- 소유권: topik-ai, migration home `supabase/migrations-admin`, tracker `admin_schema_migrations`. 마이그레이션은 `supabase/migrations-admin/20260617120000_operation_notices.sql`(+ down)이며 2026-06-17 dev DB 적용 완료했습니다. v13 소유 테이블 DDL은 변경하지 않으며 `admin_audit_logs`에는 RPC가 INSERT만 수행합니다.
- 테이블 제약/인덱스: `id text primary key`, `status text not null check (status in ('published','hidden')) default 'hidden'`, `created_at desc` 인덱스와 `status='published'` 부분 인덱스를 사용합니다.
- 컬럼 계약

| DB 컬럼 | 화면/서비스 필드 | 분류 | 비고 |
| --- | --- | --- | --- |
| `id` | `id` | 확정 PK | 자연키 `NOTICE-NNN` 유지. 신규 RPC 채번은 현재 첫 증분에서 max+1 방식입니다. |
| `title` | `title` | 확정 컬럼 | `text not null`, 공지 제목 |
| `body_html` | `bodyHtml` | 확정 컬럼 | `text not null`, TinyMCE HTML 본문 |
| `status` | `status` | 확정 enum | DB ASCII `published`/`hidden`, UI 라벨 `게시`/`숨김` |
| `author` | `author` | 확정 컬럼 | `text not null`, 작성자 |
| `created_at` | `createdAt` | 확정 컬럼 | `timestamptz`, 기본 `now()` |
| `updated_at` | `updatedAt` | 확정 컬럼 | `timestamptz` |
| `updated_by` | `updatedBy` | 확정 컬럼 | 마지막 수정자. 현재 호출자 uuid 저장이며 표시명 매핑은 후속 정합 필요 |

- 읽기 계약: RLS enable+force. admin은 `operation_notices_admin_select` 정책(`private.is_admin`)으로 조회합니다. anon/비admin은 조회할 수 없습니다.
- 쓰기 계약: 화면 직접 테이블 write는 허용하지 않고, SECURITY DEFINER RPC 3종(`admin_save_operation_notice(p_id,p_notice jsonb,p_reason)`, `admin_toggle_operation_notice_status(p_notice_id,p_next_status,p_reason)`, `admin_delete_operation_notice(p_notice_id,p_reason)`)만 사용합니다. `p_reason`은 필수이며 INSERT/UPDATE/DELETE RLS 정책은 만들지 않습니다.
- 감사 계약: RPC는 `admin_audit_logs`에 `target_table='OperationNotice'`, `target_id=noticeId`, action `notice_saved`/`notice_status_changed`/`notice_deleted`, `diff`, `payload.reason`을 기록합니다.
- 데이터소스 전환: `notices-service.ts`의 `fetchNoticesSafe`/`fetchNoticeSafe`/`saveNoticeSafe`/`toggleNoticeStatusSafe`/`deleteNoticeSafe` safe 반환 계약은 유지하고, `operation-notices-data-source.ts`가 Supabase 설정과 `VITE_OPERATION_NOTICES_SOURCE`에 따라 mock/Supabase를 분기합니다. `VITE_SUPABASE_DISABLED=true`는 기존 mock 경로로 회귀합니다.
- 미확정: 자연키 `NOTICE-NNN`의 max+1 채번 동시성 리스크(sequence/table 채번 전환 여부), `updated_by` uuid의 관리자 표시명 매핑, B2C 실제 노출 surface, 상단 고정/예약 게시 정책, HTML sanitize/preview 서버 정책은 page-sync와 gap register에서 계속 추적합니다.

## 13.1 Operation FAQ 데이터 계약 (2026-06-17 신설)

- 엔티티/테이블: `OperationFaq` / `operation_faqs`, `OperationFaqCuration` / `operation_faq_curations`, `OperationFaqMetric` / `operation_faq_metrics`.
- 승격 상태: 기존 `schema candidate`/mock-only 계약에서 Supabase 실 테이블 계약으로 승격 완료했습니다.
- 소유권: topik-ai, migration home `supabase/migrations-admin`, tracker `admin_schema_migrations`. 마이그레이션은 `supabase/migrations-admin/20260617123000_operation_faqs.sql`(+ down)이며 2026-06-17 dev DB 적용 완료했습니다. v13 소유 테이블 DDL은 변경하지 않으며 `admin_audit_logs`에는 RPC가 INSERT만 수행합니다.
- 테이블 제약/인덱스:
  - `operation_faqs`: `id text primary key`, 자연키 `FAQ-NNN`(RPC max+1), `question`/`answer text not null`, `search_keywords jsonb default '[]'` + array CHECK, `category text check (category in ('계정','결제','커뮤니티','메시지'))`, `status text check (status in ('published','hidden')) default 'hidden'`, `created_at desc` 인덱스, `status='published'` 부분 인덱스.
  - `operation_faq_curations`: `id text primary key`, 자연키 `FAQCUR-NNN`, `faq_id` FK -> `operation_faqs(id)` ON DELETE CASCADE, `surface text check (surface in ('help_center','home_top','payment_help','onboarding'))`, `curation_mode text check (curation_mode in ('manual','auto'))`, `display_rank smallint check (display_rank > 0)`, `exposure_status text check (exposure_status in ('active','paused'))`, `pinned_start_at`/`pinned_end_at date`, `UNIQUE(surface, display_rank)`, `faq_id` 인덱스.
  - `operation_faq_metrics`: `faq_id text primary key` FK -> `operation_faqs(id)` ON DELETE CASCADE, `view_count`/`search_hit_count`/`helpful_count`/`not_helpful_count int default 0 check (>= 0)`, `last_viewed_at timestamptz`. admin write RPC가 없는 seed/read 전용입니다.
- FAQ 원문 컬럼 계약

| DB 컬럼 | 화면/서비스 필드 | 분류 | 비고 |
| --- | --- | --- | --- |
| `id` | `id` | 확정 PK | 자연키 `FAQ-NNN` 유지. 신규 RPC 채번은 현재 증분에서 max+1 방식입니다. |
| `question` | `question` | 확정 컬럼 | `text not null`, FAQ 질문 |
| `answer` | `answer` | 확정 컬럼 | `text not null`, FAQ 답변. HTML 편집기가 아니라 plain text 입력 기준 |
| `search_keywords` | `searchKeywords` | 확정 컬럼 | `jsonb` array CHECK, 기본 `[]` |
| `category` | `category` | 확정 enum | DB 저장 한글 코드 `계정`/`결제`/`커뮤니티`/`메시지` |
| `status` | `status` | 확정 enum | DB ASCII `published`/`hidden`, UI 라벨 `공개`/`비공개` |
| `created_at` | `createdAt` | 확정 컬럼 | `timestamptz`, 기본 `now()` |
| `updated_at` | `updatedAt` | 확정 컬럼 | `timestamptz` |
| `updated_by` | `updatedBy` | 확정 컬럼 | 마지막 수정자. 현재 호출자 uuid 저장이며 표시명 매핑은 후속 정합 필요 |

- FAQ 큐레이션 컬럼 계약

| DB 컬럼 | 화면/서비스 필드 | 분류 | 비고 |
| --- | --- | --- | --- |
| `id` | `id` | 확정 PK | 자연키 `FAQCUR-NNN` 유지. 신규 RPC 채번은 현재 증분에서 max+1 방식입니다. |
| `faq_id` | `faqId` | 확정 FK | `operation_faqs(id)` ON DELETE CASCADE |
| `surface` | `surface` | 확정 enum | ASCII `help_center`/`home_top`/`payment_help`/`onboarding` |
| `curation_mode` | `curationMode` | 확정 enum | ASCII `manual`/`auto` |
| `display_rank` | `displayRank` | 확정 컬럼 | `smallint`, 1 이상. `UNIQUE(surface, display_rank)` 적용 |
| `exposure_status` | `exposureStatus` | 확정 enum | ASCII `active`/`paused` |
| `pinned_start_at` | `pinnedStartAt` | 확정 컬럼 | 선택 date |
| `pinned_end_at` | `pinnedEndAt` | 확정 컬럼 | 선택 date |
| `updated_at` | `updatedAt` | 확정 컬럼 | `timestamptz` |
| `updated_by` | `updatedBy` | 확정 컬럼 | 마지막 수정자. 현재 호출자 uuid 저장이며 표시명 매핑은 후속 정합 필요 |

- FAQ 지표 컬럼 계약

| DB 컬럼 | 화면/서비스 필드 | 분류 | 비고 |
| --- | --- | --- | --- |
| `faq_id` | `faqId` | 확정 PK/FK | `operation_faqs(id)` ON DELETE CASCADE |
| `view_count` | `viewCount` | 확정 지표 | `int >= 0`, 기본 0 |
| `search_hit_count` | `searchHitCount` | 확정 지표 | `int >= 0`, 기본 0 |
| `helpful_count` | `helpfulCount` | 확정 지표 | `int >= 0`, 기본 0 |
| `not_helpful_count` | `notHelpfulCount` | 확정 지표 | `int >= 0`, 기본 0 |
| `last_viewed_at` | `lastViewedAt` | 확정 지표 | `timestamptz`, 선택 |

- 읽기 계약: RLS enable+force. admin은 `private.is_admin` 기반 select 정책으로 3테이블을 조회합니다. anon/비admin은 조회할 수 없습니다.
- 쓰기 계약: 화면 직접 테이블 write는 허용하지 않고, SECURITY DEFINER RPC 5종(`admin_save_operation_faq`, `admin_toggle_operation_faq_status`, `admin_delete_operation_faq`, `admin_save_operation_faq_curation`, `admin_delete_operation_faq_curation`)만 사용합니다. `p_reason`은 필수이며 INSERT/UPDATE/DELETE RLS 정책은 만들지 않습니다. `admin_toggle_operation_faq_status`가 `hidden`으로 전환하면 연결 active 큐레이션을 `paused`로 강등합니다.
- 감사 계약: RPC는 `admin_audit_logs`에 FAQ 원문 `target_table='OperationFaq'`, `target_id=faqId`, action `faq_saved`/`faq_status_changed`/`faq_deleted`; 큐레이션 `target_table='OperationFaqCuration'`, `target_id=curationId`, action `faq_curation_saved`/`faq_curation_deleted`, `diff`, `payload.reason`을 기록합니다. hidden 전환으로 강등된 큐레이션은 `payload.paused_curation_ids`에 남깁니다.
- 데이터소스 전환: `faqs-service.ts`의 safe 반환 계약은 유지하고, `operation-faqs-data-source.ts`가 Supabase 설정과 `VITE_OPERATION_FAQS_SOURCE`에 따라 mock/Supabase를 분기합니다. `VITE_SUPABASE_DISABLED=true`는 기존 mock 경로로 회귀합니다. `supabase-operation-faqs-service.ts`가 status ASCII와 UI 라벨, DB row와 화면 모델 매핑을 담당합니다.
- 미확정: 자연키 `FAQ-NNN`/`FAQCUR-NNN`의 max+1 채번 동시성 리스크(sequence/table 채번 전환 여부), `updated_by` uuid의 관리자 표시명 매핑, `operation_faq_metrics` 실집계 파이프라인(seed only)은 page-sync와 gap register에서 계속 추적합니다.

## 13.2 Operation 이벤트 데이터 계약 (2026-06-17 신설)

- 엔티티/테이블: `OperationEvent` / `operation_events`.
- 승격 상태: 기존 `schema candidate`/mock-only 계약에서 Supabase 실 테이블 계약으로 승격 완료했습니다.
- 소유권: topik-ai, migration home `supabase/migrations-admin`, tracker `admin_schema_migrations`. 마이그레이션은 `supabase/migrations-admin/20260617152000_operation_events.sql`(+ down)이며 2026-06-17 dev DB 적용 완료했습니다. v13 소유 테이블 DDL은 변경하지 않으며 `admin_audit_logs`에는 RPC가 INSERT만 수행합니다.
- 테이블 제약/인덱스: `id text primary key`, 자연키 `EVT-NNN`(RPC max+1), `visibility_status in ('exposed','hidden','scheduled')`, `progress_status in ('ongoing','upcoming','ended')`, `event_type in ('프로모션','출석','챌린지','리워드')`, `reward_type in ('없음','쿠폰','포인트','배지')`, `banner_image_source_type in ('file','url')`, `indexing_policy in ('index','noindex')`, `exposure_channels`/`banner_images` jsonb array CHECK를 사용합니다. 인덱스는 `created_at desc`와 `visibility_status='exposed'` 부분 인덱스를 사용합니다.
- 초기 seed: 3행(`EVT-001` exposed/ongoing, `EVT-002` scheduled/upcoming, `EVT-003` hidden/ended).
- 컬럼 계약

| DB 컬럼 | 화면/서비스 필드 | 분류 | 비고 |
| --- | --- | --- | --- |
| `id` | `id` | 확정 PK | 자연키 `EVT-NNN` 유지. 신규 RPC 채번은 현재 증분에서 max+1 방식입니다. |
| `title` | `title` | 확정 컬럼 | `text not null`, 이벤트명 |
| `summary` | `summary` | 확정 컬럼 | 이벤트 요약 |
| `body_html` | `bodyHtml` | 확정 컬럼 | 이벤트 상세/랜딩 HTML 본문 |
| `slug` | `slug` | 확정 컬럼 | 사용자 랜딩 URL 후보 식별자 |
| `event_type` | `eventType` | 확정 enum | DB 저장 한글 코드 `프로모션`/`출석`/`챌린지`/`리워드` |
| `visibility_status` | `visibilityStatus` | 확정 enum | DB ASCII `exposed`/`hidden`/`scheduled`, UI 라벨 `노출`/`숨김`/`예약` |
| `progress_status` | `progressStatus` | 확정 enum | DB ASCII `ongoing`/`upcoming`/`ended`, UI 라벨 `진행중`/`예정`/`종료`. 읽기 시 기간 기준으로 파생합니다. |
| `start_at` | `startAt` | 확정 컬럼 | 이벤트 시작일 |
| `end_at` | `endAt` | 확정 컬럼 | 이벤트 종료일 |
| `exposure_channels` | `exposureChannels` | 확정 jsonb array | 한글 채널 값 `앱홈`/`웹홈`/`이벤트탭` 배열 |
| `target_group_id` | `targetGroupId` | denormalized 참조 | Message 그룹 외부 FK 없이 문자열 snapshot으로 저장 |
| `target_group_name` | `targetGroupName` | denormalized 표시값 | Message 그룹명 snapshot |
| `participant_count` | `participantCount` | 확정 컬럼 + 집계 후보 | 현재 표시용 수치. 실집계 source는 후속 확정 필요 |
| `participant_limit` | `participantLimit` | 확정 컬럼 | 참여 제한 수. null이면 제한 없음 |
| `reward_type` | `rewardType` | 확정 enum | DB 저장 한글 코드 `없음`/`쿠폰`/`포인트`/`배지` |
| `reward_policy_id` | `rewardPolicyId` | denormalized 참조 | Commerce/Reward 외부 FK 없이 문자열 snapshot으로 저장 |
| `reward_policy_name` | `rewardPolicyName` | denormalized 표시값 | 보상 정책명 snapshot |
| `message_template_id` | `messageTemplateId` | denormalized 참조 | Message 템플릿 외부 FK 없이 문자열 snapshot으로 저장 |
| `message_template_name` | `messageTemplateName` | denormalized 표시값 | 메시지 템플릿명 snapshot |
| `banner_image_url` | `bannerImageUrl` | 확정 컬럼 | 대표 배너 URL 파생/저장값 |
| `banner_image_source_type` | `bannerImageSourceType` | 확정 enum | ASCII `file`/`url` |
| `banner_image_file_name` | `bannerImageFileName` | 확정 컬럼 | 대표 배너 파일명 또는 표시명 |
| `banner_images` | `bannerImages` | 확정 jsonb array | 정렬 가능한 배너 이미지 배열. 정규 asset 테이블은 후속 |
| `landing_url` | `landingUrl` | 확정 컬럼 | 프로모션 랜딩/상세 URL 후보 |
| `meta_title` | `metaTitle` | 확정 컬럼 | 공유/SEO title override |
| `meta_description` | `metaDescription` | 확정 컬럼 | 공유/SEO description override |
| `og_image_url` | `ogImageUrl` | 확정 컬럼 | 공유 이미지 URL |
| `canonical_url` | `canonicalUrl` | 확정 컬럼 | canonical URL override |
| `indexing_policy` | `indexingPolicy` | 확정 enum | ASCII `index`/`noindex` |
| `admin_memo` | `adminMemo` | 확정 컬럼 | 관리자 내부 메모 |
| `created_at` | `createdAt` | 확정 컬럼 | `timestamptz`, 기본 `now()` |
| `updated_at` | `updatedAt` | 확정 컬럼 | `timestamptz` |
| `updated_by` | `updatedBy` | 확정 컬럼 | 마지막 수정자 uuid. 관리자 표시명 매핑은 후속 정합 필요 |

- 읽기 계약: RLS enable+force. admin은 `private.is_admin` 기반 select 정책으로 조회합니다. anon/비admin은 조회할 수 없습니다.
- 쓰기 계약: 화면 직접 테이블 write는 허용하지 않고, SECURITY DEFINER RPC 4종(`admin_save_operation_event`, `admin_schedule_operation_event`, `admin_publish_operation_event`, `admin_end_operation_event`)만 사용합니다. `p_reason`은 필수이며 INSERT/UPDATE/DELETE RLS 정책은 만들지 않습니다.
- 감사 계약: RPC는 `admin_audit_logs`에 `target_table='OperationEvent'`, `target_id=eventId`, action `event_saved`/`event_scheduled`/`event_published`/`event_ended`, `diff`, `payload.reason`을 기록합니다. 예약은 `visibility_status='scheduled'`, 게시는 `visibility_status='exposed'`, 종료는 `progress_status='ended'` 및 `visibility_status='hidden'`을 기록합니다.
- 데이터소스 전환: `events-service.ts`의 safe 반환 계약은 유지하고, `operation-events-data-source.ts`가 Supabase 설정과 `VITE_OPERATION_EVENTS_SOURCE`에 따라 mock/Supabase를 분기합니다. `VITE_SUPABASE_DISABLED=true`는 기존 mock 경로로 회귀합니다. `supabase-operation-events-service.ts`가 ASCII status와 UI 라벨, DB row와 화면 모델 매핑을 담당합니다.
- 미확정: 자연키 `EVT-NNN`의 max+1 채번 동시성 리스크(sequence/table 채번 전환 여부), `updated_by` uuid의 관리자 표시명 매핑, 배너 이미지/보상 정책/메시지 템플릿 정규화, `participant_count` 집계 source는 page-sync와 gap register에서 계속 추적합니다.

## 13.3 Operation 정책 관리 데이터 계약 (2026-06-17 신설)

- 엔티티/테이블: `OperationPolicy` / `operation_policies`, `OperationPolicyHistory` / `operation_policy_histories`.
- 전환 상태: 기존 `schema candidate`/mock-only 계약에서 Supabase 실 테이블 계약으로 승격 완료했다. 마이그레이션은 `supabase/migrations-admin/20260617170000_operation_policies.sql`(+ down)이며, `admin_schema_migrations` tracker 기준 2026-06-17 dev DB 적용 완료했다.
- 소유권: topik-ai, migration home `supabase/migrations-admin`. v13 소유 테이블 DDL은 변경하지 않는다.

### 13.3.1 `operation_policies` 컬럼 계약

| DB 컬럼 | 화면/서비스 필드 | 분류 | 비고 |
| --- | --- | --- | --- |
| `id` | `id` | 확정 PK | text PK, 자연키 `POL-NNN`. 신규 RPC 채번은 현재 max+1 방식 |
| `category` | `category` | 확정 enum | `policy-types.ts` 한글 코드값 |
| `policy_type` | `policyType` | 확정 enum | 16종 한글 코드값(`policy-types.ts`) |
| `title` | `title` | 확정 컬럼 | 정책 문서명 |
| `status` | `status` | 확정 enum | DB ASCII `published`/`hidden`, UI 라벨 `게시`/`숨김` |
| `tracking_status` | `trackingStatus` | 확정 enum | `policy-types.ts` 한글 코드값 |
| `exposure_surfaces` | `exposureSurfaces` | 확정 jsonb array | 노출 위치 배열 |
| `related_admin_pages` | `relatedAdminPages` | 확정 jsonb array | 연관 관리자 화면 배열 |
| `related_user_pages` | `relatedUserPages` | 확정 jsonb array | 연관 사용자 화면 배열 |
| `source_documents` | `sourceDocuments` | 확정 jsonb array | 추적 근거 문서 배열 |
| `legal_references` | `legalReferences` | 확정 jsonb array | 법령/근거 배열 |
| `requires_consent` | `requiresConsent` | 확정 컬럼 | boolean, 사용자 동의 필요 여부 |
| `effective_date` | `effectiveDate` | 확정 컬럼 | date, 시행일 |
| `version_label` | `versionLabel` | 확정 컬럼 | 버전 표시값 |
| `summary` | `summary` | 확정 컬럼 | 정책 요약 |
| `body_html` | `bodyHtml` | 확정 컬럼 | TinyMCE HTML 본문 |
| `admin_memo` | `adminMemo` | 확정 컬럼 | 관리자 메모 |
| `current_version_id` | `currentVersionId` | 확정 컬럼 | 최신 히스토리 추적용 `operation_policy_histories.id` 후보 |
| `created_at` | `createdAt` | 확정 컬럼 | timestamptz |
| `updated_at` | `updatedAt` | 확정 컬럼 | timestamptz |
| `updated_by` | `updatedBy` | 확정 컬럼 | RPC caller uuid 기록, 표시명 매핑은 미확정 |

### 13.3.2 `operation_policy_histories` 컬럼 계약

| DB 컬럼 | 화면/서비스 필드 | 분류 | 비고 |
| --- | --- | --- | --- |
| `id` | `id` | 확정 PK | text PK, 자연키 `PH-NNNN` |
| `policy_id` | `policyId` | 확정 FK | `operation_policies(id)` ON DELETE CASCADE, `policy_id` 인덱스 |
| `action` | `action` | 확정 enum | 저장/상태 변경/삭제/버전 게시 이력 action |
| `version_label` | `versionLabel` | 확정 컬럼 | 시점 버전 표시값 |
| `changed_at` | `changedAt` | 확정 컬럼 | 변경 시각 |
| `changed_by` | `changedBy` | 확정 컬럼 | RPC caller uuid 기록, 표시명 매핑은 미확정 |
| `snapshot` | `snapshot` | 확정 jsonb | 시점 `OperationPolicy` snapshot |

### 13.3.3 RPC 계약

- 읽기 계약: RLS enable+force. admin은 `private.is_admin` 기반 select 정책으로 `operation_policies`, `operation_policy_histories`를 조회한다.
- 쓰기 계약: 직접 테이블 write를 만들지 않고 SECURITY DEFINER admin RPC만 사용한다. 4개 RPC 모두 reason 필수이며, 매 조치 시 `admin_audit_logs.target_table='OperationPolicy'`, `target_id=policyId`를 기록하고 `operation_policy_histories`에 snapshot을 append한다.
- `admin_save_operation_policy(p_id, p_policy jsonb, p_reason)` → audit action `policy_saved`, 신규/수정 저장 후 현재 snapshot append.
- `admin_toggle_operation_policy_status(p_policy_id, p_next_status, p_reason)` → audit action `policy_status_changed`, DB status ASCII `published`/`hidden` 전환 후 snapshot append.
- `admin_delete_operation_policy(p_policy_id, p_reason)` → audit action `policy_deleted`, cascade 삭제 전 snapshot을 감사하고 histories append.
- `admin_publish_operation_policy_version(p_policy_id, p_history_id, p_reason)` → audit action `policy_version_published`, 해당 history snapshot을 헤드로 게시하고 `current_version_id`를 갱신하며 payload에는 from/to version을 포함한다.
- helper 3종: `operation_policy_snapshot`, `next_operation_policy_id`, `next_operation_policy_history_id`. public execute는 revoke한다.

- 데이터소스 전환: `operation-policies-data-source.ts`가 `VITE_OPERATION_POLICIES_SOURCE=mock` 또는 `VITE_SUPABASE_DISABLED=true`이면 mock으로 회귀한다. `policies-service.ts`의 safe facade 7종(`fetchPoliciesSafe`, `fetchPolicySafe`, `fetchPolicyHistorySafe`, `savePolicySafe`, `togglePolicyStatusSafe`, `deletePolicySafe`, `publishPolicyHistoryVersionSafe`) 계약은 유지한다. `savePolicySafe`/`togglePolicyStatusSafe`에는 reason이 추가됐고, `deletePolicySafe`/`publishPolicyHistoryVersionSafe`는 기존 reason 계약을 유지한다.
- 미확정: `POL-NNN`/`PH-NNNN` max+1 동시성, `changed_by`/`updated_by` uuid 표시명, `current_version_id` 화면 모델 정합, `requires_consent` 기반 B2C 동의 재수집 트리거.

## 14. 알림(Notification) 데이터 계약 (2026-06-12 신설)

> 단일 SoT: **`docs/specs/notification-contract.md`** — 채널 4종(`in_app`/`email`/`push`/`zalo`), class 4종(`transactional`/`operational`/`learning`/`marketing` + mandatory 규칙), template_key 7종, dispatch/attempt status enum, dedupe_key 2단 형식. 본 절은 색인이다.

- 엔티티/테이블 (소유: 이 repo, tracker `admin_schema_migrations`, 디렉터리 `supabase/migrations-admin/`): `notification_templates`, `notification_groups`, `notification_dispatches`, `notification_delivery_attempts`, `notification_email_config`(`id=true` singleton, `mode`, nullable `fail_user_id`). RPC: `admin_send_notification`.
- 파이프라인 객체(소유: 이 repo, migration home `20260723011242_notification_pipeline_ownership_transfer.sql`): `private.render_notification_text`, `private.dispatch_scheduled_notifications`, `private.dispatch_admin_notifications`, `private.dispatch_notification_event`, `private.dispatch_notifications`, `private.notification_email_transport`, `private.finalize_email_attempt`, `private.retry_failed_email_attempts`, `private.is_marketing_consented`, pg_cron job `dispatch_notifications`. v13의 동일 이름 과거 migration은 replay-safe no-op이며 tracker를 혼합하지 않는다.
- v13 소유 연관 객체: `user_notifications`(인앱 수신함), `profiles.notification_prefs`, `notification_settings`. `notification_log`는 deprecated(발송 이력 SoT 아님 — O-9). 공유 객체(attempts의 v13 read 등)는 `docs/architecture/shared-supabase-schema-ownership.md`를 따른다.
- 발송 이력은 dispatch(발송 실행)–attempt(수신자×채널) 2계층이 SoT다. opt-out 제외는 `skipped`/`opted_out`으로 집계한다(미기록 금지).
- 기존 message 기능(`mail`/`push` 채널 UI)은 channel 계약상 `email`/`push`로 매핑하며, `push`를 `in_app`으로 재해석하지 않는다(인앱은 별도 1급 채널).

## 13.4 Community 게시글/신고 데이터 계약 (2026-06-17 확정)

- 엔티티/테이블: `CommunityPost` / `community_posts`, `CommunityPostAdminNote` / `community_post_admin_notes`, `CommunityReport` / `community_reports`.
- 전환 상태: mock-only 후보에서 Supabase 테이블 계약으로 승격 완료. 마이그레이션은 `supabase/migrations-admin/20260617173000_community.sql`(+ `supabase/migrations-admin/down/20260617173000_community.sql`)이며 `admin_schema_migrations` tracker 기준 2026-06-17 dev DB 적용 완료.
- 소유권: topik-ai, migration home `supabase/migrations-admin`. v13 소유 테이블 DDL은 변경하지 않는다.

### 13.4.1 `community_posts` 컬럼 계약

| DB 컬럼 | 화면/서비스 필드 | 분류 | 비고 |
| --- | --- | --- | --- |
| `id` | `id` | 확정 PK | text PK, seed/RPC 자연키 `POST-NNN`. 신규 helper는 현재 max+1 방식 |
| `title` | `title` | 확정 컬럼 | 게시글 제목 |
| `content_html` | `contentHtml` | 확정 컬럼 | 게시글 원문 HTML, 기본 `''` |
| `author_id` | `authorId` | 확정 컬럼 | 작성자 ID snapshot |
| `author_name` | `authorName` | 확정 컬럼 | 작성자 표시명 snapshot |
| `board` | `board` | 확정 enum 후보 | CHECK는 현재 seed 한글 board 코드값. 장기 code table 후보 |
| `status` | `status` | 확정 enum | DB ASCII `published`/`hidden`, UI 라벨 `게시`/`숨김` |
| `last_moderation_policy_code` | `lastModerationPolicyCode` | 확정 enum 후보 | null 또는 `SPAM`/`ABUSE`/`AD`/`PRIVACY`/`DUPLICATE`/`OTHER` |
| `reports_count` | `reportsCount` | 확정 컬럼 | integer >= 0, 기본 0 |
| `created_at` | `createdAt` | 확정 컬럼 | timestamptz |
| `updated_at` | `updatedAt` | 확정 컬럼 | timestamptz |
| `updated_by` | `updatedBy` | 확정 컬럼 | RPC caller uuid text 또는 seed |

### 13.4.2 `community_post_admin_notes` 컬럼 계약

| DB 컬럼 | 화면/서비스 필드 | 분류 | 비고 |
| --- | --- | --- | --- |
| `id` | `id` | 확정 PK | text PK, `POST-NNN-MEMO-NN` helper max+1 |
| `post_id` | `postId` | 확정 FK | `community_posts(id)` ON DELETE CASCADE |
| `title` | `title` | 확정 컬럼 | 메모 제목 |
| `type` | `type` | 확정 enum 후보 | CHECK는 현재 메모 유형 코드값. 장기 code table 후보 |
| `author_id` | `authorId` | 확정 컬럼 | 관리자 ID snapshot 또는 caller uuid |
| `author_name` | `authorName` | 확정 컬럼 | 관리자 표시명 snapshot |
| `content` | `content` | 확정 컬럼 | 메모 본문 |
| `created_at` | `createdAt` | 확정 컬럼 | timestamptz |

### 13.4.3 `community_reports` 컬럼 계약

| DB 컬럼 | 화면/서비스 필드 | 분류 | 비고 |
| --- | --- | --- | --- |
| `id` | `id` | 확정 PK | text PK, seed 자연키 `RP-NNN` |
| `target_post_id` | `targetPostId` | 느슨참조 | `community_posts(id)` ON DELETE SET NULL |
| `target_user_id` | `targetUserId` | 확정 컬럼 | 신고 대상 사용자 ID snapshot |
| `target_user_name` | `targetUserName` | 확정 컬럼 | 신고 대상 사용자 표시명 snapshot |
| `reporter_id` | `reporterId` | 확정 컬럼 | 신고자 ID snapshot |
| `reporter_name` | `reporterName` | 확정 컬럼 | 신고자 표시명 snapshot |
| `reason` | `reason` | 확정 컬럼 | 신고 사유 텍스트 |
| `reason_code` | `reasonCode` | 확정 enum 후보 | null 또는 운영 정책 코드 후보 |
| `process_status` | `processStatus` | 확정 enum | DB ASCII `pending`/`resolved`, UI 라벨 `처리 대기`/`처리 완료` |
| `resolution_action` | `resolutionAction` | 확정 enum | null 또는 `hide_post`/`suspend_user`/`dismiss` |
| `resolved_by` | `resolvedBy` | 확정 컬럼 | RPC caller uuid text |
| `resolved_at` | `resolvedAt` | 확정 컬럼 | timestamptz |
| `created_at` | `createdAt` | 확정 컬럼 | timestamptz |

### 13.4.4 RPC/쓰기 계약

- 읽기: RLS enable+force, admin select policy(`private.is_admin`)만 둔다.
- 게시글 조치 RPC: `admin_hide_community_post(p_post_id,p_reason,p_policy_code)`, `admin_show_community_post(p_post_id,p_reason,p_policy_code)`, `admin_delete_community_post(p_post_id,p_reason)`, `admin_add_community_post_memo(p_post_id,p_memo jsonb,p_reason)`.
- 신고 조치 RPC: `admin_resolve_community_report(p_report_id,p_action,p_reason)`이며 `p_action in ('hide_post','suspend_user','dismiss')`.
- 감사 계약: 게시글 RPC는 `target_table='CommunityPost'`, action `post_hidden`/`post_shown`/`post_deleted`/`post_memo_added`; 신고 RPC는 `target_table='CommunityReport'`, action `report_resolved`를 기록한다.
- 신고 의미 정합화: `hide_post`는 같은 트랜잭션에서 대상 게시글을 `status='hidden'`으로 실제 변경한다. `suspend_user`는 payload `user_suspend_integration=intent_only_v13_admin_set_user_status_pending`으로 의도만 남기며 실제 정지는 미연동이다. `dismiss`는 신고만 종결한다. 모든 경우 `process_status='resolved'`, `resolution_action`, `resolved_by`, `resolved_at`을 기록한다.
- 미확정: `POST-NNN`/`RP-NNN` 및 memo helper max+1 동시성, `board`/`last_moderation_policy_code`/memo `type` code table화, `suspend_user`와 v13 `admin_set_user_status` 실제 연동.

## 13.5 Commerce 포인트 데이터 계약 (2026-06-17 확정)

- 엔티티/테이블: `CommercePointPolicy` / `commerce_point_policies`, `CommercePointLedger` / `commerce_point_ledgers`, `CommercePointExpiration` / `commerce_point_expirations`.
- 전환 상태: mock-only 후보에서 Supabase 테이블 계약으로 승격 완료. 마이그레이션은 `supabase/migrations-admin/20260617190000_commerce_points.sql`(+ down)이며 `admin_schema_migrations` tracker 기준 2026-06-17 dev DB 적용 완료.
- 소유권: topik-ai, migration home `supabase/migrations-admin`. v13 `profiles`는 `user_id` text 느슨참조이며 FK 없음.
- `commerce_point_policies` 19컬럼: `id`, `name`, `policy_type`, `category`, `amount`, `points`, `status`, `description`, `condition_summary`, `earn_debit_rule`, `expiration_rule`, `target_condition`, `trigger_source`, `duplication_rule`, `manual_adjustment_rule`, `note`, `created_at`, `updated_at`, `updated_by`. `id`는 `POL-NNNN`, `policy_type/category`는 `earn`/`debit`/`expire`, `status`는 `draft`/`active`/`inactive`.
- `commerce_point_ledgers` 20컬럼: `id`, `user_id`, `user_name`, `entry_type`, `source_type`, `amount`, `balance_after`, `available_balance_after`, `status`, `expiration_at`, `source`, `source_id`, `source_label`, `policy_id`, `policy_name`, `reason`, `approval_memo`, `occurred_at`, `created_at`, `created_by`. `id`는 `PL-NNNN`, `entry_type`은 `earn`/`debit`/`revoke`/`restore`/`expire`, `source_type`은 `referral`/`mission`/`event`/`payment`/`refund`/`admin`/`system`, `status`는 `completed`/`held`/`cancelled`. `balance_after`와 `available_balance_after`는 CHECK `>= 0`.
- `commerce_point_expirations` 17컬럼: `id`, `user_id`, `user_name`, `source_type`, `scheduled_amount`, `available_amount`, `expire_at`, `status`, `hold_reason`, `held_by`, `held_at`, `processed_at`, `related_ledger_id`, `policy_id`, `policy_name`, `calculation_memo`, `created_at`. `id`는 `EXP-NNNN`, `status`는 `scheduled`/`held`/`completed`/`cancelled`, `scheduled_amount`와 `available_amount`는 CHECK `>= 0`.
- UI 라벨: DB enum-like 값은 ASCII 저장을 유지하고, 한글 라벨은 `point-types`/`point-schema` 기준으로 매핑한다.
- RPC/잔액 계약: 직접 table write 없이 SECURITY DEFINER admin RPC 5종만 사용한다. `admin_create_manual_point_adjustment(p_user_id,p_amount,p_reason)`는 사용자별 `pg_advisory_xact_lock`과 최신 ledger `for update`를 사용해 최신 `available_balance_after + p_amount`를 `balance_after`/`available_balance_after`로 서버에서 계산한다. 음수 잔액은 RPC 가드와 CHECK 제약으로 차단하며, Supabase 경로에서 클라이언트 잔액 계산은 하지 않는다.
- helper: `next_commerce_point_policy_id()`, `next_commerce_point_ledger_id()`는 public execute를 revoke한다. 현재 `POL-NNNN`/`PL-NNNN` max+1 채번은 장기 동시성 정책 미확정이다.
- 미확정: 음수 잔액 허용/차감 우선순위/환불 복구 정책, 정책 저장 사유 UI 필드 부재(note -> reason 전달, 빈 값 RPC 오류), `EXP-NNNN` 생성 helper/자동 소멸 cron, `user_id` FK 없는 느슨참조 표시명 정합.

## 2026-06-17 Commerce 쿠폰 데이터 계약

### `commerce_coupons`

- 전환 상태: mock-only 후보에서 Supabase 테이블 계약으로 승격 완료. 마이그레이션은 `supabase/migrations-admin/20260617193000_commerce_coupons.sql`(+ down)이며 `admin_schema_migrations` tracker 기준 2026-06-17 dev DB 적용 완료.
- 53컬럼: `id`, `coupon_name`, `coupon_kind`, `coupon_status`, `issue_state`, `issue_target_type`, `target_group_ids`, `target_group_names`, `target_user_ids`, `auto_issue_trigger_type`, `code_generation_mode`, `coupon_code`, `code_count`, `audience`, `benefit_type`, `benefit_value`, `min_order_amount`, `max_discount_amount`, `applicable_scope`, `applicable_scope_reference_ids`, `excluded_product_ids`, `is_stackable`, `is_secret_coupon`, `issue_limit_mode`, `issue_limit`, `download_limit_mode`, `download_limit`, `usage_limit_mode`, `usage_limit`, `validity_mode`, `valid_from`, `valid_until`, `expire_after_days`, `linked_message_template_id`, `linked_message_template_name`, `linked_crm_campaign_id`, `linked_crm_campaign_name`, `linked_event_id`, `linked_event_name`, `download_url`, `issue_count`, `download_count`, `use_count`, `last_issued_at`, `last_downloaded_at`, `last_used_at`, `policy_notes`, `admin_memo`, `issue_alert`, `expire_alert`, `created_at`, `updated_at`, `updated_by`.
- enum/check: `coupon_kind`=`customerDownload`/`autoIssue`/`couponCode`/`manualIssue`, `coupon_status`=`waiting`/`active`/`ended`, `issue_state`=`normal`/`paused`, `issue_target_type`=`allMembers`/`specificGroup`/`specificMembers`, `auto_issue_trigger_type`=`firstSignup`/`firstOrderComplete`/`shoppingGradeChange`/`birthday`, `code_generation_mode`=`single`/`bulk`, `audience`=`memberOnly`/`memberAndGuest`, `benefit_type`=`amountDiscount`/`rateDiscount`/`freeShipping`/`fixedPrice`, `applicable_scope`=`allProducts`/`specificCategory`/`specificProduct`, limit mode=`unlimited`/`limited`, `validity_mode`=`fixedDate`/`afterIssued`/`unlimited`.
- JSONB 배열: `target_group_ids`, `target_group_names`, `target_user_ids`, `applicable_scope_reference_ids`, `excluded_product_ids`, `policy_notes`. JSONB 객체: `issue_alert`, `expire_alert`. `target_user_ids`는 v13 `profiles` 느슨참조이며 FK 없음.

### `commerce_coupon_subscription_templates`

- 30컬럼: `id`, `template_name`, `issue_target_type`, `target_grade_ids`, `target_grade_names`, `benefit_type`, `benefit_value`, `min_order_amount`, `max_discount_amount`, `applicable_scope`, `applicable_scope_reference_ids`, `applicable_scope_reference_names`, `excluded_product_mode`, `excluded_product_ids`, `excluded_product_names`, `is_stackable`, `issue_schedule`, `usage_end_schedule`, `status`, `issued_coupon_count`, `last_issued_at`, `next_issued_at`, `issue_alert_enabled`, `expire_alert_enabled`, `alert_channel`, `admin_memo`, `policy_notes`, `created_at`, `updated_at`, `updated_by`.
- enum/check: `issue_target_type='shoppingGrade'`, `excluded_product_mode`=`none`/`specific`, `status`=`active`/`paused`, `alert_channel='webAppPush'`. `issue_schedule`과 `usage_end_schedule`은 JSONB 객체이며 적용/제외 범위와 정책 메모는 JSONB 배열로 저장한다.

### Admin RPC / 감사 계약

- 쿠폰 본체 Target Type은 `CommerceCoupon`: `admin_save_commerce_coupon` -> `coupon_saved`, `admin_duplicate_commerce_coupon` -> `coupon_duplicated`, `admin_set_commerce_coupon_issue_state` -> `coupon_paused`/`coupon_resumed`, `admin_delete_commerce_coupon` -> `coupon_deleted`.
- 정기 템플릿 Target Type은 `CommerceCouponTemplate`: `admin_save_commerce_coupon_template` -> `coupon_template_saved`, `admin_set_commerce_coupon_template_status` -> `coupon_template_paused`/`coupon_template_resumed`, `admin_delete_commerce_coupon_template` -> `coupon_template_deleted`.
- 모든 write RPC는 reason 필수이며 `admin_audit_logs`에 기록한다. 후속 미확정은 발급/사용 원장(`commerce_coupon_issues`, `commerce_coupon_redemptions`), scope-ref/대상 그룹/알림 정규화, `planTier` 영속화, v13 `target_user_ids` 정합 정책이다.
## 2026-06-17 Commerce 환불 데이터 계약

- 엔티티/테이블: `CommerceRefund` / `commerce_refunds`.
- 전환 상태: mock/Supabase 합성 조회에서 Supabase workflow table 계약으로 전환 완료. 마이그레이션은 `supabase/migrations-admin/20260617203000_commerce_refunds.sql`(+ down)이며 `admin_schema_migrations` tracker 기준 2026-06-17 dev DB 적용 완료.
- 소유권: topik-ai, migration home `supabase/migrations-admin`. `payment_id`와 `user_id`는 v13 `payment_history`/사용자 식별자 느슨참조이며 FK가 없다.
- `commerce_refunds` 12컬럼: `id`, `payment_id`, `user_id`, `user_nickname`, `requested_amount`, `reason`, `status`, `requested_at`, `processed_by`, `processed_at`, `review_reason`, `created_at`.
- 제약/enum: `id`는 `RF-NNNN` 형식(`^RF-[0-9]+$`), `requested_amount >= 0`, `status in ('pending','approved','rejected')`. UI 라벨은 `pending=처리 대기`, `approved=승인`, `rejected=거절`.
- RLS: enable+force, admin select policy만 허용한다. 직접 table write 경로는 만들지 않는다.
- helper: `next_commerce_refund_id()`는 `RF-NNNN` max+1 채번이며 public execute를 revoke한다.
- seed: `pending`/`approved`/`rejected` 각 1건, 총 3건.
- Admin RPC / 감사 계약: `admin_approve_billing_refund(p_refund_id,p_reason)` -> `refund_approved`, `admin_reject_billing_refund(p_refund_id,p_reason)` -> `refund_rejected`. Target Type은 `CommerceRefund`, Target ID는 `refundId`, reason은 필수이고 `pending` 상태만 처리한다.
- v13 경계: 실제 결제 환불 집행과 v13 `payment_history.status` 갱신은 미연동이다. 승인 payload는 `intent_only_v13_payment_history_pending=true`를 기록한다.
- 미확정: 실제 결제 환불 집행 v13 연동, `payment_id` 느슨참조 정합, `RF-NNNN` max+1 동시성, payments `method` 컬럼 reconcile.
## 11.7 2026-06-17 System 메타데이터 그룹/항목 Supabase 계약

- 전환 상태: `system_metadata_groups`/`system_metadata_group_items`는 더 이상 후보가 아니라 `admin_schema_migrations` tracker로 2026-06-17 dev DB 적용된 topik-ai 소유 admin 테이블이다.
- 마이그레이션: `supabase/migrations-admin/20260617211000_system_metadata.sql` + down migration.
- `SystemMetadataGroup` table: `public.system_metadata_groups`
  - PK: `group_id` text, `META-GRP-NNN` 형식
  - columns(16): `group_id`, `group_name`, `description`, `owner_role`, `item_code_prefix`, `manager_type`, `owner_module`, `status`, `sync_status`, `exposure_status`, `linked_admin_pages`, `linked_user_surfaces`, `schema_candidate_notes`, `created_at`, `updated_at`, `updated_by`
  - JSONB arrays: `linked_admin_pages`, `linked_user_surfaces`, `schema_candidate_notes`
  - unique: lower(`group_name`)
- `SystemMetadataItem` table: `public.system_metadata_group_items`
  - PK: `item_id` text, FK: `group_id` -> `system_metadata_groups(group_id)` ON DELETE CASCADE
  - columns(12): `item_id`, `group_id`, `code`, `label`, `description`, `sort_order`, `status`, `exposure_status`, `is_default`, `created_at`, `updated_at`, `updated_by`
  - unique: (`group_id`, upper(`code`)), (`group_id`, lower(`label`))
- enum/check store 값: `manager_type` = `codeTable`/`selectOption`/`exposureRule`/`segmentField`; `owner_module` = `Users`/`Message`/`Operation`/`Commerce`/`Content`/`System`; `status` = `active`/`inactive`; `sync_status` = `live`/`review`/`draft`; `exposure_status` = `confirmed`/`inferred`/`internalOnly`/`planned`; `sort_order > 0`. DB store 값은 ASCII이고 UI는 한글 라벨로 매핑한다.
- 데이터소스: `system-metadata-data-source.ts`는 `VITE_SYSTEM_METADATA_SOURCE=mock` 또는 `VITE_SUPABASE_DISABLED=true`일 때 mock fallback을 사용한다. 그 외 Supabase 모드에서 `system-metadata-service.ts` Safe 7종 계약은 유지된다.
- 응답 계약: 프론트는 기존처럼 `SystemMetadataGroup.items[]` 중첩 배열을 받는다. Supabase 서비스가 `system_metadata_groups` + `system_metadata_group_items`를 조회한 뒤 `group_id` 기준으로 중첩 매핑한다.
- 감사 계약: `Target Type = SystemMetadataGroup`, `Target ID = groupId`, 딥링크 `/system/metadata?selected={groupId}`. 항목 조치도 그룹 단위 target을 사용한다.
- DB audit action strings: `metadata_group_saved`, `metadata_item_saved`, `metadata_group_status_changed`, `metadata_item_status_changed`, `metadata_item_deleted`, `metadata_items_reordered`. 모든 write RPC는 `reason` 필수다.
- 미확정: `META-GRP-NNN`/`META-ITEM-NNN` next-id max+1 동시성, `is_default` 단일성 정책의 최종 업무 규칙, `admin_locations`/history 정규화 여부.
- 비범위: `/system/metadata`에 임베드된 AssessmentMasterCatalog(`topik_writing_*`)는 이번 SystemMetadataGroup 전환과 무관하며 기존 Supabase 계약을 유지한다.

## 11.8 2026-06-17 System 시스템 로그 Supabase 계약

- 엔티티/테이블: `SystemLog` / `public.system_logs`.
- 전환 상태: mock-only 후보에서 Supabase read-only table 계약으로 전환 완료. 마이그레이션은 `supabase/migrations-admin/20260617213000_system_logs.sql`(+ down)이며 `admin_schema_migrations` tracker 기준 2026-06-17 dev DB 적용 완료.
- 소유권: topik-ai, migration home `supabase/migrations-admin`. `system_logs`는 기술 로그이며 `admin_audit_logs` 감사 로그와 별개다. v13 `notification_log`와도 무관하다.
- `system_logs` 7컬럼: `id`, `level`, `message`, `component`, `trace_id`, `context`, `created_at`.
- 제약/enum: `id` text PK, `level in ('INFO','WARN','ERROR')`, `trace_id` text null, `context` jsonb null, `created_at` timestamptz. `level`은 현재 대문자 저장 코드값을 유지한다.
- 인덱스: `created_at desc`, `level` 부분 인덱스(`WARN`,`ERROR`), `component`.
- RLS: enable+force, admin select policy(`private.is_admin`)만 허용한다. admin write policy/RPC는 없다.
- 데이터소스: `system-logs-data-source.ts`가 `VITE_SYSTEM_LOGS_SOURCE=mock` 또는 `VITE_SUPABASE_DISABLED=true`이면 mock fallback을 사용한다. Supabase 모드는 `system_logs`를 `created_at desc`로 읽고, `system-logs-service.ts`의 `fetchSystemLogsSafe` 계약은 유지한다.
- seed: INFO/WARN/ERROR 분포의 4건.
- 비범위/미확정: 로그 적재 소스/주체, 보존기간·파티셔닝, `trace_id` 의미, `level` 코드값 장기 표준화 여부.

## 11.9 2026-06-18 System 감사 로그 읽기 RPC 계약

- 엔티티/테이블: `AuditLog` / `public.admin_audit_logs`.
- 전환 상태: `/system/audit-logs`는 mock/store 병합 후보에서 Supabase live read 계약으로 승격 완료했다. 마이그레이션은 `supabase/migrations-admin/20260618001000_admin_audit_logs_read.sql`(+ `supabase/migrations-admin/down/20260618001000_admin_audit_logs_read.sql`)이며 `admin_schema_migrations` tracker 기준 2026-06-18 dev DB 적용 완료했다.
- DB 경계: 신규 테이블은 없고 `admin_audit_logs` 컬럼, RLS, write path는 변경하지 않는다. 추가 인덱스는 `admin_audit_logs_target_lookup_idx`(`target_table`, `target_id`)와 `admin_audit_logs_created_at_desc_idx`(`created_at desc`)다.
- 읽기 RPC: `admin_list_audit_logs(p_target_type text default null, p_target_id text default null, p_keyword text default null, p_start timestamptz default null, p_end timestamptz default null, p_limit int default 100, p_offset int default 0)`.
- 보안/동작: `SECURITY DEFINER`, `private.is_admin(auth.uid())` 가드, read-only. `profiles(admin_user_id -> id)` 조인으로 `profiles.display_name`을 `actor`로 반환한다.
- 필터/정렬: `target_table`, `target_id`, keyword `ILIKE`(`action`, `target_id`, `payload::text`), `created_at` 범위 필터를 지원하고 `created_at desc`로 정렬한다. `p_limit`은 1~500으로 보정하며 `p_offset`은 0 이상이다.
- 반환 컬럼: `log_id`, `target_type`, `target_id`, `action`, `actor`, `reason`, `diff`, `payload`, `created_at`, `total_count`.
- 화면 표시 경계: `reason`은 `payload->>'reason'`에서 파생한다. `diff`/`payload`는 반환 계약에는 포함되지만 민감정보 노출 범위가 미확정이므로 화면 미노출 보류 상태다.
## 2026-06-18 Users 회원 상세 학습 현황 데이터 계약

### 오너 결정 기록

| 결정 | 결정값 | 근거 | 트레이드오프 | 결정일 |
| --- | --- | --- | --- | --- |
| 범위 | (b) 요약 KPI + 영역별 정답률 + 약점 + 최근 풀이 이력 | v13 `problem_attempts`, `problems`, `writing_submissions`, `writing_feedback`, `feedback_dimension_scores`, `learning_goals` read만으로 관리자가 학습자 상태를 파악할 수 있는 최대 범위다. 신규 테이블 0건, v13 DDL 변경 0건을 지킨다. | 추천 실행/작문 첨삭 전문까지 포함하는 (c)는 PII와 추천 정책 검증 범위가 커서 제외한다. | 2026-06-18 |
| 거버넌스·프라이버시 | 답안 본문(`writing_submissions.answer_text`)과 문장 첨삭 본문(`sentence_feedback.original_text/corrected_text/comment`)은 admin 화면에 노출하지 않는다. | 운영자는 학습 상태 판단에 집계, 점수, 약점 차원, 최근 제출 메타데이터만으로 충분하다. 학습 PII 본문은 별도 승인·감사 정책 없이는 노출하지 않는다. | 세부 작문 품질 판단은 제한되지만 개인정보 노출면과 감사 부담이 줄어든다. | 2026-06-18 |
| 더미 탭 동시 전환 | 활동(`study_events`)·결제(`payment_history`) 탭 실데이터화는 이번 범위에서 제외한다. | 이번 변경의 핵심은 문제 풀이 학습 현황이며, 두 탭을 동시에 전환하면 결제/활동 계약과 UI 회귀 범위가 커진다. | 기존 더미 탭은 남지만 학습 현황 탭은 live RPC + mock fallback으로 완결한다. | 2026-06-18 |

### RPC / 화면 모델

- RPC: `get_admin_user_learning_overview(target_id uuid)`
- 위치: `supabase/migrations-admin/20260618120000_admin_user_learning_overview.sql` 및 down 파일.
- 권한: `SECURITY DEFINER`, `private.is_platform_admin(auth.uid())`, `set search_path = pg_catalog, public`.
- 읽기 source: v13 소유 `problem_attempts`, `problems`, `writing_submissions`, `writing_feedback`, `feedback_dimension_scores`, `learning_goals`.
- 반환 모델: `UserLearningOverview` (`kpis`, `domainAccuracy`, `weaknesses`, `recentAttempts`, `recentWriting`).
- PII 제외: `selected_answer`, `problems.prompt`, `writing_submissions.answer_text`, `sentence_feedback.*text/comment`는 반환하지 않는다.
- mock fallback: `getMockUserLearningOverview(userId)`가 `VITE_SUPABASE_DISABLED` 모드 렌더 안전성을 유지한다.

## 2026-07-08 Users 학습 현황 writing 중심 재정의 + Analytics 학습 분석 데이터 계약

학습 데이터 수집 계획(docs/checklists/users-learning-data-collection-report-and-plan.md) Phase 1~3 구현.
오너 위임 결정(2026-07-08, 전 항목 기본 추천안): ① 소요 시간 = writing 전용 metrics 계약
(`writing_submission_metrics`, v13 소유) ② 전체 학습 분석 = Analytics 하위 탭 ③ 점수 =
원점수+100점 정규화 병기(행별 `score_max` 기준 — 51번에 10점/100점 만점 혼재 실측)
④ 답안 원문 기본 제외 유지 ⑤ 활성 학습자 = 학습 이벤트(study_events) 기준(로그인 아님).

### 배경(불일치 해소)

- 기존 학습 현황 KPI(총 풀이 수·정답률·평균 점수·누적 학습시간·북마크·streak·주간 학습분)는
  전부 `problem_attempts` 원천이었으나 v13 사용자 화면에 insert 경로가 없어(추천 dedup select만,
  dev DB 0행) 모든 회원에게 0이 표시되고 있었다. TOPIK 쓰기 기준 원천을 writing 계열로 재정의한다.
- `problem_attempts`는 객관식(읽기/듣기) attempt 원천으로 분리 유지하고, 화면에서는
  `objectiveAttempts` 별도 라벨 블록("객관식 학습(별도 원천)")으로 표시한다.

### v13 수집 계약 — `writing_submission_metrics` (v13 소유, 마이그 `20260708113000`)

- 1 제출 = 1 불변 행(PK `submission_id`). insert-once(본인+본인 제출 검증 RLS), update/delete 정책 없음.
- `elapsed_seconds` = 화면 타이머(마운트 누적, 0~86400), `active_seconds` = 최근 30초 내 타이핑이
  있던 초 누적(항상 elapsed 이하), `started_at`/`submitted_at` 병행 보존.
- 원문/초안/첨삭 텍스트 없음(숫자·id만 — study_events payload와 동일 PII 기조).
- 행 부재 = "미수집"(수집 시작 이전 제출). 소비자는 0분으로 렌더하면 안 된다.
- 계측: v13 4개 워크스페이스(51/52/53/54) 공용 훅 `useWritingTimeMetrics` + 제출 성공 콜백에서
  `recordWritingSubmissionMetrics` fire-and-forget(중복 submission_id insert는 무해 실패).

### RPC 재정의: `get_admin_user_learning_overview(target_id uuid)` (마이그 `20260708130000`)

- 권한: 기존과 동일(platform_admin 전용, SECURITY DEFINER, read-only).
- 읽기 source: `writing_submissions` ⋈ `writing_feedback` ⋈ `feedback_dimension_scores` ⋈ `problems`
  ⋈ `study_events`(streak·열람) ⋈ `learning_goals` ⋈ `writing_submission_metrics` (+`problem_attempts`는
  objective 블록 한정).
- 반환 모델(`UserLearningOverview` 재정의): `kpis`(제출/피드백 상태/정규화 평균/열람률/재제출/streak
  [학습 이벤트 기준]/주간 학습분[미수집 null]/metricsCount/평균 elapsed·active/최근 활동일),
  `perQuestion`(51~54 generate_series — 원점 평균+대표 만점 mode+정규화+소요), `tagStats`(상위 12),
  `weaknesses`(tag<70점·n≥2 / writing_dimension / goal), `recentWriting`(5건 — 문항 title 120자 절단,
  열람 여부, 재제출 여부, 소요, 약점 차원; 원문 없음), `objectiveAttempts`, `onboarding`(기존 모양 유지).
- 0 vs 미수집: 시간 계열은 `metricsCount=0`이면 null(미수집)로 반환하고 화면은 "미수집"으로 표기한다.

### 신규 RPC: `get_admin_learning_analytics(period_days integer default 30)` (마이그 `20260708140000`)

- 권한: `private.is_admin` (순수 집계, 개인 식별자 미반환 — 기존 `get_admin_analytics_overview`와 동일 표면).
- `period_days`: 7/30/90 = 최근 N일, 0 = 전체. 직전 동일기간 비교값은 N>0에서만(전체는 null).
- 반환: `summary`(활성 학습자[study_events distinct]·제출/제출자·완료/실패율·정규화 평균·열람률·
  재제출·처리시간 평균+중앙값[고착 재동기화로 평균 부풀 수 있어 중앙값 병기]·elapsed 평균+중앙값·
  metricsCount·차원 커버리지), `per_question`, `score_distribution`(환산 5구간), `weak_dimensions`
  (표본 수 병기), `tag_stats`(상위 12).
- 화면: `/analytics/learning` (Analytics 하위 탭, `analytics.read`), 서비스
  `analytics-learning-service.ts`, mock 모드 결정적 목업.
- 활성 사용자 정의 주의: 통계 개요의 "활성 사용자"는 로그인 기준(2026-07-07 오너 합의 유지),
  학습 분석의 "학습 활성 사용자"는 학습 이벤트 기준 — 라벨로 구분해 공존한다.

### 2026-07-10 필터 확장 RPC: `get_admin_learning_analytics_filtered(...)` + `get_admin_learning_analytics_filter_options()`

- 기존 `get_admin_learning_analytics(period_days)`는 호환용으로 유지하고 `/analytics/learning`의 신규 facade는 두 확장 RPC를 사용한다.
- 집계 입력은 KST 날짜 범위, 이전 동일 기간 비교 여부, 문제 유형 51~54 배열, `topic_main/topic_detail`, 유형별 세부 조건 JSON이다. 화면 기본값은 최근 30일·51~54 전체·이전 기간 비교다.
- 문제 유형 배열과 같은 세부 필드 안의 값은 OR, 날짜·문제 유형·주제·서로 다른 세부 필드 사이는 AND다. `전체` 기간은 이전 기간 비교를 반환하지 않는다.
- 기본 기간·문제 유형 집계와 주제·세부 특성 조건은 제출·이벤트 `problem_id`를 현재 canonical identity 또는 전환 시 이관한 private historical identity snapshot에 연결해 51~54번과 canonical metadata를 판별한다. 이미 적용된 `20260714090000`은 원형을 유지하고, 후속 `20260715103000`이 유효한 과거 alias를 Admin private snapshot으로 한 번 복사한 뒤 최신 coverage RPC의 `problems`/공개 alias map 조인을 private identity projection으로 교체한다. 현재·직전 제출·이벤트·PDF 귀속의 대상·연결·미연결 coverage 계약은 그대로 유지한다. `topik_writing_question_recommendation_view.topic_main/topic_detail`이 주제 SoT이며 `legacy_problem_id`, 공개 환경별 alias map, 구 `problems.title/tags`는 runtime current-content 집계에 사용하지 않는다.
- 학습 활성 사용자는 `submission_id` 또는 `problem_id`로 현재 분석 범위에 귀속 가능한 `study_events`의 고유 사용자다. 귀속 불가능 이벤트는 임의 배분하지 않고 커버리지로 반환한다.
- 반환 블록은 적용 범위 메타데이터, 8개 KPI와 이전 기간·표본·커버리지, 문제 유형별 비교, 4구간 점수 분포, 문제 유형별 표준 평가 차원, 주제별 성과, PDF 사용 분석이다. `pdf_usage`는 `perQuestion`과 직접 귀속 이벤트의 `perTopic[{questionNo,topicMain,topicDetail,count}]`을 포함하며 `perTopic`은 건수 내림차순이다. 개인 식별자·답안 원문·문장 첨삭 본문은 반환하지 않는다. 화면의 취약 평가 영역 섹션은 2026-07-15 오너 지시로 제거되어 `weak_dimensions`(및 summary의 차원 커버리지)는 RPC가 반환하지만 화면·CSV가 사용하지 않는다.
- summary의 메타데이터 연결 계약은 `metadataEligible/Mapped/UnmappedSubmissions`, 각 `Prev`, `metadataEligible/MappedEvents`, 각 `Prev`, 제출·이벤트 coverage rate, `metadataEligible/MappedProblems`다. coverage 분모는 기간·문제 유형까지만 적용하고 주제·세부 조건으로 축소하지 않아 필터가 미매핑 행을 숨기지 못하게 한다.
- 배포 전 coverage gate는 target/expected project ref를 모두 명시하고, 모든 metric이 비음수 정수이며 `mapped <= eligible`인지 fail-closed로 확인한 뒤 100% 연결을 요구한다. 환경 별칭 reconciliation은 기존 `held` 상태를 자동 해제하지 않고, apply/restore에서 대상 cardinality와 source-map anchor 생성·제거를 검증한다.
- `PDF 내보내기 완료 수`는 `study_events.event_type='export_downloaded'` 건수이며 실제 파일 저장 완료를 의미하지 않는다. 단일 제출만 문제 유형/주제로 직접 귀속하고 확정할 수 없는 보고서·서재 선택은 `혼합` 또는 `미분류`로 보존한다. 문제 유형×주제 집계는 직접 귀속·현재 scope 일치 이벤트만 포함하고 혼합·미분류를 임의 배분하지 않으며, 주제 연결이 없는 직접 귀속 행은 null 주제로 보존한다.
- 2026-07-15: `pdf_usage.perTopic`을 문제 유형(51~54) × `topic_main` × `topic_detail` 단위로 추가했다(마이그 `20260715190000`). `count desc → questionNo → topicMain → topicDetail` 순으로 반환하며 합계는 동일 scope의 직접 귀속 수와 일치한다.
- 필터 옵션 RPC는 `topic_main → topic_detail`과 51~54번별 세부 특성의 distinct 옵션만 반환한다. 두 RPC 모두 `private.is_admin()` + `SECURITY DEFINER` read-only 계약을 따른다.
- 2026-07-15: `topic_stats`를 문제 유형(51~54) × `topic_main` × `topic_detail` 단위로 분해해 각 행에 `questionNo`를 포함한다. 마이그 `20260715130000`은 직전 최신 함수에서 주제 CTE와 JSON projection만 fail-closed로 교체해 metadata coverage·identity 계약을 보존하며, down도 같은 블록만 역변환한다. 정렬은 주제쌍 제출 합계 내림차순 → 대주제 → 세부 주제 → 문제 유형이다.
- 2026-07-15: dev 선적용 과정에서 발생했던 metadata coverage summary 누락은 `20260715173826`으로 복구했다. clean migration 자산에서는 `20260715130000`부터 coverage를 보존하고, `20260715173826`은 canonical identity 객체가 모두 존재할 때만 private identity projection을 사용하며 일부 설치 상태는 fail-closed로 거부한다. 전체 신규 down을 역순 적용해도 `20260713120000` metadata 계약을 유지한다.
- URL 복원 키는 `period`, `from`, `to`, `compare`, 반복 `question`, `topicMain`, `topicDetail`, 반복 `d.<field>`다. CSV 공개 열은 `section, question_type, topic_main, topic_detail, metric, category, value, unit, sample_count, coverage, period_start, period_end`로 고정한다.

### 기존 계약 검증(2026-07-08, dev)

- SQL 프로브: 제출 최다 사용자 개인 RPC 실값, 가드(비관리자 forbidden), payload에 `answer_text` 무포함.
- 실브라우저 풀루프: 신규 학습자 계정으로 v13 실제 52번 제출 → `writing_submission_metrics` 행
  (elapsed 7s/active 7s) 생성 → 개인/전체 RPC와 admin 화면(회원 상세 학습 탭·학습 분석)에서 동일 값 확인.
- 기존 e2e 학생 계정은 외부 평가 API 409("Email already registered with another account")로 제출이
  차단된 상태 — v13/admin 코드 결함 아님(외부 서비스 계정 레지스트리 충돌, 별도 해소 필요).
## 46. System 백업 관리 데이터 계약 (2026-07-20)

### 엔티티와 원본

| 엔티티 | 원본 | 역할 |
| --- | --- | --- |
| BackupRun | `admin_backup_runs` | 한 번의 전체 백업 실행 |
| BackupComponentResult | `admin_backup_component_results` | 데이터베이스·파일 저장소별 결과와 검사 |
| RestoreDrill | `admin_restore_drills` | 월간 격리 복원 점검 |
| BackupReportEvent | `admin_backup_report_events` | 보고 중복·완료 변경 차단용 내부 원장 |

### 서버 보고 계약

- 보고 종류는 `backup_started`, `backup_completed`, `restore_drill_completed`만 허용합니다.
- 공통 식별자는 UUID 작업 번호, 보고 번호, 원본 프로젝트 `topik-prod`입니다.
- 실제 백업 대상은 `topik-prod` 하나입니다. 같은 비민감 보고 본문을 운영 원본과 `topik-dev` 조회 복사본에 각각 저장하지만, `topik-dev` 데이터베이스나 파일 저장소를 백업했다는 뜻은 아닙니다.
- 운영 원본과 개발 복사본은 서로 다른 공유 비밀값, 대상이 포함된 서명, 고정된 서버 연결을 사용합니다. 한쪽 전송 실패는 다른 쪽 기록과 실제 백업 결과를 바꾸지 않습니다.
- 전체 상태는 `running`, `succeeded`, `partial_failure`, `failed`, `delayed`입니다.
- 대상별 상태는 `pending`, `succeeded`, `failed`, `not_run`, 검사 상태는 `pending`, `passed`, `failed`, `not_run`입니다.
- 전송 가능 정보는 시작·종료·다음 예정 시각, 데이터베이스 결과·용량, 파일 결과·개수·용량, 검사 결과, 디스크 사용률, 짧은 오류 분류입니다.
- 파일명, 저장 경로, 회원 정보, 연결 정보, 비밀키, 원문 오류는 계약에 포함하지 않습니다.
- 완료 보고의 전체 상태는 대상별 결과로 서버가 다시 계산하며 맞지 않으면 거부합니다.
- 같은 보고 번호와 같은 내용은 성공으로 재처리하고, 같은 보고 번호로 다른 내용을 보내거나 완료 결과를 바꾸는 요청은 거부합니다.

### 조회·권한·보관

- 대시보드 요약 조회는 active admin, 상세 목록 조회는 `system.backups.read` 권한이 필요합니다.
- 요약에는 보고 원장의 가장 최근 수신 시각을 포함합니다. localhost는 이 값을 `마지막 복사 시각`으로 표시하고 개발환경 복사본임을 명확히 안내합니다.
- 브라우저의 원본 테이블 직접 쓰기와 서비스 역할 함수를 통한 임의 호출은 금지합니다.
- 실행·대상별 결과·일반 보고 원장은 90일, 복원 점검과 해당 보고 원장은 13개월 보관합니다.
- 완료 자동 작업은 `system_logs`의 `backup-service`로 연결하고 `admin_audit_logs`에는 쓰지 않습니다.
