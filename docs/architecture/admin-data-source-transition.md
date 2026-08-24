# TOPIK AI Admin 데이터 소스 전환 가이드

## 1. 목적

- 이 문서는 관리자 프론트엔드의 더미 데이터, API, 데이터베이스 연결 전환 기준을 정의하는 단일 문서다.
- 목표는 더미 데이터를 한 파일에 몰아넣는 것이 아니라, 화면이 데이터 소스 구현 세부를 모르게 만들어 향후 API/DB 전환 비용을 줄이는 것이다.
- 적용 범위는 `Dashboard`, `Users`, `Community`, `Message`, `Operation`, `Commerce`, `Assessment`, `Content`, `Analytics`, `System` 전 모듈의 관리자 데이터 소스다.

## 2. 현재 상태 요약

### 2.1 이미 분리된 패턴

- `Users` 계열은 `mock-*` 파일과 `fetch*Safe` service가 분리되어 있다.
- `Users > 회원 목록`은 2026-06-17 P0 결손 RPC 핫픽스로 mock 후보에서 Supabase-backed source로 승격 완료했고, 2026-07-09에는 성별/전화번호 마스킹 컬럼과 회원 정보 내보내기 RPC를 같은 service 경계에 추가했다. Supabase 모드 read는 `get_admin_users(search, sort, page, page_size, affiliation)`, 정지/해제 write는 `admin_set_user_status(target_id, new_status)`, 내보내기는 `admin_export_users(p_reason, p_include_full_phone, p_affiliation, p_scope, p_selected_user_ids, 목록 필터, p_selected_column_keys)`를 사용한다. 기본 목록/상태 RPC는 `supabase/migrations-admin/20260617210000_admin_users_directory.sql`(+ down)에, 성별/전화번호/내보내기 보강은 `supabase/migrations-admin/20260709150000_admin_users_phone_and_export.sql`(+ down)에 작성했다.
- `Users > 회원 목록` read source는 v13 `profiles` + `auth.users` 조인과 `writing_submissions` 집계다. `display_name`은 회원명(`realName`) source이고 `nickname`은 닉네임 source이며, `gender`는 `profiles.gender` 표시값, `phone_masked`는 v13 canonical `profiles.phone_country_code` + `profiles.phone_number`를 조합해 마스킹한 목록 전용 표시값이다. dev에만 남아 있을 수 있는 `profiles.phone`은 JSON 호환 fallback으로만 읽는다. 두 표시명 필드가 `NULL`이면 이메일/ID/local-part fallback을 만들지 않고 UI에서 `-`로 표시한다. `get_admin_users` 인자명은 PostgREST 매칭을 위해 프론트 JSON 키 `search`/`sort`/`page`/`page_size`/`affiliation`과 정확히 일치해야 하며, 함수 부재나 인자 불일치는 404 런타임 실패 원인이 된다.
- `Users > 회원 목록` write source는 `admin_set_user_status` 단일 경로다. 신규 테이블은 없고 v13 `profiles` DDL은 변경하지 않으며, `profiles.status`만 `active`/`blocked`로 토글하고 `deleted`는 차단한다. 감사 로그는 `User + userId`, action `user_status_changed`로 남긴다.
- `Users > 회원 정보 내보내기`는 `admin_export_users` 단일 경로다. 사유는 필수이고 기본 범위는 현재 목록 조건이다. 선택 행이 있으면 선택 회원만 반출할 수 있고, XLSX 컬럼은 사용자 ID 필수 + 운영자 선택 컬럼으로 생성한다. 전화번호 컬럼을 제외하면 원문 포함은 비활성화한다. 감사 payload에는 scope, 선택 컬럼 key, 필터 적용 여부/개수 요약만 남기며, 내보낸 파일 내용과 검색어 원문/성별 값/전화번호 값은 저장하지 않는다.
- `Users > 기관 코드`는 `institution-codes-data-source.ts`가 `VITE_INSTITUTION_CODES_SOURCE=mock`, `VITE_SUPABASE_DISABLED`, Supabase 설정 여부를 판별해 mock과 Supabase를 분기한다. Supabase 모드는 `admin_list_institution_codes`, `admin_create_institution_code`, `admin_update_institution_code`, `admin_delete_institution_code` RPC를 사용하고, 삭제는 가입 회원 존재 시 차단하며 기관 노출 문항 매핑과 기관 노출 모드 원장을 같은 트랜잭션에서 정리한다. mock 모드는 `mock-institution-codes.ts` 시드를 읽고 생성/수정/삭제를 화면 상태에만 반영한다.
- `Users > 회원 목록/상세`의 Admin 노출 `회원 상태`는 `profiles.status` 원천값 단독이 아니라 `get_admin_users.registration_status` 기반 가입 생애주기 값이다. 이메일 미인증이면 `인증 대기`, 인증 후 필수 약관 미동의면 `약관 대기`로 표시하고, 미인증 계정의 약관 집계는 RPC에서 `none/null`로 정규화한다. 원천 가입 플로우 가드는 `docs/architecture/users-registration-lifecycle-v13-handoff.md` 기준 v13 handoff 범위다.
- `Users > 회원 상세`은 별도 탭 파생 데이터 source 정리가 아직 남아 있다.
- `Community > 게시글 관리/신고 관리`는 `api/mock-community.ts`가 초기 seed/factory를 소유하고, `community-service.ts`가 목록 조회/게시·숨김·삭제/신고 처리 safe facade를 제공한다. 조치 후 live state는 `community-store.ts`에 남긴다.
- `System > 시스템 로그`는 2026-06-17 mock-only에서 Supabase read-only source로 전환 완료했다. `system-logs-data-source.ts`가 `VITE_SYSTEM_LOGS_SOURCE=mock`, `VITE_SUPABASE_DISABLED`, Supabase 설정 여부를 판별하고, `system-logs-service.ts`의 `fetchSystemLogsSafe` 계약은 유지한다. Supabase 모드는 `system_logs`를 `created_at desc`로 읽는다. 로그 적재는 backend/infra service-role 경로로 남아 있으며 소스/주체는 미정이다.
- `System > 감사 로그`는 `system-audit-logs-service.ts`가 static audit seed(`api/mock-system-audit-logs.ts`)와 permission/coupon/metadata store audit 병합 책임을 소유한다. 페이지는 merge 세부를 알지 않는다.
- `Message` 계열은 `api/mock-messages.ts`가 `initialGroups/templates/histories` seed/factory를 소유하고, `messages-service.ts`가 실제 렌더 source와 저장/발송/토글/삭제/재시도 action facade를 제공한다. 발송/재시도/그룹 변경 live state는 `message-store.ts`에 남긴다.
- `Message > 대상 그룹`은 세그먼트 옵션/기본값/Query Builder 필드 정의를 `src/features/message/model/message-group-segment-schema.ts`로 분리해 page-local 하드코딩을 줄였다.
- `Operation > 공지사항/FAQ/이벤트`는 기존 service/store 구조를 유지하되, 초기 seed/factory를 `api/mock-operation.ts`로 분리했다. `operation-store.ts`는 조치 후 live state만 담당한다.
- `Operation > 공지사항`은 2026-06-17 mock-only에서 Supabase DB-backed hybrid switch로 전환 완료했다. `operation-notices-data-source.ts`와 `supabase-operation-notices-service.ts`가 Supabase 경로를 담당하고, `notices-service.ts`의 `fetch*Safe`/`save*Safe`/`toggle*Safe`/`delete*Safe` 계약은 유지한다. Supabase 설정이 없거나 `VITE_SUPABASE_DISABLED=true` 또는 `VITE_OPERATION_NOTICES_SOURCE=mock`이면 기존 mock 경로로 회귀한다. Supabase 모드는 `operation_notices` 조회와 admin RPC 3종을 사용하며, 마이그레이션은 `admin_schema_migrations` tracker 기준 2026-06-17 dev DB 적용 완료했다.
- `Operation > FAQ`는 2026-06-17 mock-only에서 Supabase DB-backed hybrid switch로 전환 완료했다. `operation-faqs-data-source.ts`와 `supabase-operation-faqs-service.ts`가 Supabase 경로를 담당하고, `faqs-service.ts`의 `fetch*Safe`/`save*Safe`/`toggle*Safe`/`delete*Safe` 계약은 유지한다. Supabase 설정이 없거나 `VITE_SUPABASE_DISABLED=true` 또는 `VITE_OPERATION_FAQS_SOURCE=mock`이면 기존 mock 경로로 회귀한다. Supabase 모드는 `operation_faqs`/`operation_faq_curations`/`operation_faq_metrics` 조회와 admin RPC 5종을 사용하며, metrics는 admin write RPC가 없는 seed/read 전용이다. 마이그레이션은 `admin_schema_migrations` tracker 기준 2026-06-17 dev DB 적용 완료했다.
- `Operation > 이벤트`는 2026-06-17 mock-only에서 Supabase DB-backed hybrid switch로 전환 완료했다. `operation-events-data-source.ts`와 `supabase-operation-events-service.ts`가 Supabase 경로를 담당하고, `events-service.ts`의 `fetch*Safe`/`save*Safe`/`schedule*Safe`/`publish*Safe`/`end*Safe` 계약은 유지한다. Supabase 설정이 없거나 `VITE_SUPABASE_DISABLED=true` 또는 `VITE_OPERATION_EVENTS_SOURCE=mock`이면 기존 mock 경로로 회귀한다. Supabase 모드는 `operation_events` 조회와 admin RPC 4종을 사용하며, 마이그레이션은 `admin_schema_migrations` tracker 기준 2026-06-17 dev DB 적용 완료했다.
- `Operation > 정책 관리`는 2026-06-17 mock-only에서 Supabase DB-backed hybrid switch로 전환 완료했다. `operation-policies-data-source.ts`와 Supabase 정책 service가 Supabase 경로를 담당하고, `policies-service.ts`의 safe facade 7종(`fetchPoliciesSafe`/`fetchPolicySafe`/`fetchPolicyHistorySafe`/`savePolicySafe`/`togglePolicyStatusSafe`/`deletePolicySafe`/`publishPolicyHistoryVersionSafe`) 계약은 유지한다. Supabase 설정이 없거나 `VITE_SUPABASE_DISABLED=true` 또는 `VITE_OPERATION_POLICIES_SOURCE=mock`이면 기존 mock 경로로 회귀한다. Supabase 모드는 `operation_policies`/`operation_policy_histories` 조회와 admin RPC 4종을 사용하며, 마이그레이션은 `admin_schema_migrations` tracker 기준 2026-06-17 dev DB 적용 완료했다.
- `Operation > 이벤트 등록 상세`는 Message store를 직접 읽지 않고 `messages-service.ts`의 option DTO(`fetchMessageOptionSourcesSafe`)를 통해 대상 그룹/메시지 템플릿 선택지를 받는다.
- `Commerce > 쿠폰 관리`는 `coupons-service.ts`를 통해 쿠폰/정기 쿠폰 템플릿의 조회/저장/발행 중지/재개/삭제를 감싸고, 초기 seed/factory는 `api/mock-coupons.ts`가 소유한다. `coupon-store.ts`는 live state와 message option snapshot 기반 파생 표시만 담당한다.
- `Commerce > 포인트 관리`는 `api/mock-points.ts`가 정책/원장/소멸 예정 seed/factory를 소유하고, `points-service.ts`가 조회/수동 조정/정책 저장/소멸 보류 facade를 제공한다.
- `Billing > 결제 내역/환불 관리`는 실제 위치인 `src/features/billing`을 유지한다. 초기 결제/환불 seed는 `api/mock-billing.ts`, live state와 환불 승인/반려 write path는 `commerce-store.ts`, 페이지 facade는 `billing-service.ts`가 담당한다.
- `Assessment > TOPIK 쓰기 문항`(`/assessment/question-bank`)는 `assessment-question-bank-service.ts`를 통해 신규 `topik_writing_51/52/53/54_questions` + 추천 뷰를 읽고, `admin_update_topik_question`/태그 RPC/기관 노출 RPC(`admin_set_writing_question_institutions`, `admin_clear_writing_question_institutions`)로 관리 포인트를 처리한다. `/assessment/question-bank/manage`는 redirect 역사 경로다. JSON fixture/store fallback은 사용하지 않으며, Supabase가 설정되지 않았거나 조회가 실패하면 화면의 error/retry 상태로 노출한다. 정적 정책값과 query metadata는 `assessment-question-bank-schema.ts`에 유지한다.

### 2.2 아직 페이지 내부에 남아 있는 패턴

- `Notification > 발송 이력`
- `Users > 회원 상세` 탭 파생 데이터

### 2.3 store seed에 묶여 있는 패턴

- `System > 관리자 계정/권한` 초기 데이터와 권한 변경 live state
- `Dashboard`/`Analytics` 일부 요약 지표와 cross-feature store 참조

### 2.4 현재 문제

- 페이지가 `initialRows` 또는 파생 배열을 직접 소유해 API 연결 지점이 화면마다 달라진다.
- 목록 데이터와 상세 데이터가 같은 source에서 보장되지 않아, 향후 실데이터 연결 시 정합성 회귀 위험이 크다.
- 특정 feature가 다른 feature의 mock 파일을 직접 참조해 결합도가 높아진다.
- 화면에서 네트워크 계층과 mock seed 구조를 동시에 알아야 해 service 교체 비용이 커진다.

## 3. 목표 아키텍처

### 3.1 핵심 원칙

- feature 경계를 유지한다. 전역 단일 mock 저장소를 만들지 않는다.
- 각 도메인 데이터는 feature 내부에서 단일 SoT를 가진다.
- 페이지 컴포넌트는 더미 배열이나 seed 상수를 직접 소유하지 않는다.
- 목록, 상세, 조치 후 상태 갱신은 같은 도메인 source를 기준으로 읽고 쓴다.
- mock에서 API로 바뀌더라도 페이지는 service 인터페이스를 그대로 사용한다.
- 변경 가능한 더미 데이터는 store에 둘 수 있지만, page는 store seed를 직접 알지 않고 service를 통해서만 접근한다.
- 공통 엔티티 생성 규칙만 shared factory 또는 helper로 분리한다. 실제 도메인 데이터셋은 feature별로 유지한다.

### 3.2 권장 구조

```text
src/features/<feature>/
  api/
    <domain>-service.ts
    mock-<domain>.ts
  model/
    <domain>-types.ts
    <domain>-store.ts        # 조치 후 상태 변경이 필요한 경우만 사용
  pages/
    <feature>-page.tsx       # data source 구현 세부를 직접 소유하지 않음
```

### 3.3 페이지 금지 패턴

- 페이지 파일 안 `const initialRows = [...]`
- 페이지 파일 안 `useState(initialRows)`로 데이터 source를 직접 소유
- 상세 화면에서 목록과 무관한 별도 더미 상세 배열을 새로 생성
- 다른 feature의 mock dataset을 page에서 직접 import

## 4. 데이터 소스 계층 규칙

### 4.1 service 계층

- page는 `fetch*Safe`, `get*Safe`, `create*Safe`, `update*Safe`, `delete*Safe`, `toggle*Safe` 같은 service 함수만 사용한다.
- 새 action facade는 조치 실패가 화면 전체 중단으로 번지지 않도록 `safe-request` 또는 동등한 `{ ok, data, error }` 반환 계약을 유지한다.
- service는 mock이든 API든 동일한 반환 계약을 유지한다.
- 네트워크형 화면은 `pending`, `success`, `empty`, `error`를 유지할 수 있도록 service 계층에서 `safe-request` 패턴을 우선 사용한다.

### 4.2 mock source 계층

- read-only mock은 `api/mock-*.ts`에서 관리한다.
- 조치 후 목록과 상세가 함께 바뀌는 mock은 feature store를 사용하되, 초기 seed는 별도 mock 파일 또는 seed helper로 분리한다.
- 상세 데이터가 목록 행의 확장 정보라면 `getById` 또는 `buildDetail` helper를 통해 같은 source에서 파생한다.
- 폼 옵션, 기본값, Query Builder 필드 정의처럼 나중에 메타데이터 API나 코드 테이블로 치환될 정적 정책값은 page가 아니라 feature `model/*-schema.ts`에서 단일 SoT로 관리한다.
- 이벤트 등록 상세의 대상 그룹/메시지 템플릿/보상 정책 옵션은 page-local 자유 입력으로 남기지 않고, 각 도메인 service 또는 schema source를 통해 `select` 옵션으로 주입한다.
- 이벤트 배너 이미지는 화면 모델 기준으로 정렬 가능한 `bannerImages[]`를 SoT로 사용하고, 첫 번째 이미지를 대표 배너로 보고 `bannerImageUrl`, `bannerImageFileName`, `ogImageUrl`를 파생한다. Supabase 모드는 `operation_events.banner_images` jsonb 배열과 `banner_image_source_type`(`file`/`url`)으로 보관한다.
- 장기 asset 서비스 단계에서는 단일 URL 필드가 아니라 정렬 가능한 asset list 또는 `bannerAssetIds[]`를 기준 계약으로 전환한다.

### 4.3 shared 계층

- shared에는 공통 엔티티 포맷터, 날짜 생성 규칙, 테스트용 factory만 둔다.
- shared가 feature 도메인 레코드 전체를 소유하지 않는다.
- (2026-08-18) mock/supabase 판별 로직은 `src/shared/api/data-source.ts`의 `resolveDataSource(forceMockEnvKey)`/`isForcedMock`이 단일 정의다. 각 feature `*-data-source.ts`는 도메인 타입·강제 env 키·기본값 계약을 유지하는 thin wrapper로 남는다 — 파일·env 키 계약이 불변이므로 이 문서의 도메인별 서술(§2.1 등)은 그대로 유효하다.
- (2026-08-18) 서비스 계층 공통 가드(`requireClient`/`throwIfAborted`/`sleep`/`requireReason`)는 `src/shared/api/supabase-service-utils.ts`, ISO 타임스탬프 표시 포맷(`toDateOnly`/`toDateTimeMinutes`/`toDateTimeSeconds`)은 `src/shared/model/date-format.ts`, NOT_FOUND 오류 생성은 `src/shared/api/api-error.ts`의 `createNotFoundError`가 단일 정의다. feature 서비스 파일에 동일 본문 로컬 복제를 새로 만들지 않는다.

## 5. 모듈별 우선 정리 대상

### 5.1 2026-06-11 정리 완료 범위

- `Community`: 게시글/신고 page-local seed 제거, `api/mock-community.ts` + service/store 경계 적용
- `System`: 시스템 로그 seed/service 분리, 감사 로그 static/store audit 병합 책임 service 이동
- `Message`: `api/mock-messages.ts` seed/factory 분리, page direct store action 제거, Message option DTO 제공
- `Operation`: 공지/FAQ/이벤트/정책 seed를 `api/mock-operation*.ts`로 분리, 이벤트 등록의 Message store 직접 참조 제거
- `Commerce`: 쿠폰/포인트 seed를 `api/mock-coupons.ts`, `api/mock-points.ts`로 분리하고 cross-feature mock/store 직접 참조 제거
- `Billing`: `features/billing` 폴더명은 유지하고 결제/환불 seed를 `api/mock-billing.ts`로 분리

### 5.2 잔여 1순위

- `Notification`: 발송 이력 page-local `rows`
- `Users > 회원 상세`: 탭별 파생 더미 데이터를 service/helper로 이동
- `System > 관리자 계정/권한`: store seed와 권한 변경 정책을 service/API 후보로 분리

### 5.3 잔여 2순위

- `Dashboard`/`Analytics`: 요약 지표와 cross-feature store 참조의 source 경계 확정
- `Content`: Placeholder 라우트별 IA/API 계약 확정

## 6. API/DB 전환 기준

### 6.1 API로 바꿀 때 유지해야 하는 것

- 페이지의 검색, 상세, 조치, 감사 로그 확인 흐름
- URL 기반 목록/필터/탭 복원
- `pending/success/empty/error` UX
- 조치 후 `Target Type`, `Target ID`, 감사 로그 확인 경로

### 6.2 API로 바꿀 때 먼저 치워야 하는 것

- page-local seed
- 상세 화면 내부 하드코딩 파생 레코드
- cross-feature mock direct import
- store seed와 page state의 중복 소유

## 7. 문서 업데이트 매트릭스

### 7.1 API, mock, repository/service 경계가 바뀐 경우

- 반드시 `docs/architecture/admin-data-source-transition.md`를 평가하고 반영한다.
- 통신/상태/재시도/fail-safe 기준이 바뀌면 `docs/architecture/admin-overview.md`와 `docs/guidelines/admin-coding-guidelines-antigravity.md`도 함께 평가한다.

### 7.2 화면의 목록/상세 필드, 검색 조건, 정렬, 테이블 source가 바뀐 경우

- `docs/specs/admin-page-tables.md`
- 관련 `docs/specs/page-ia/*.md`

### 7.3 조치 후 감사 로그 계약, Target Type/ID, 후속 검증 경로가 바뀐 경우

- `docs/specs/admin-action-log.md`
- 관련 `docs/specs/page-ia/*.md`

### 7.4 관리자 데이터의 B2C 노출 위치나 사용 맥락이 바뀐 경우

- `docs/specs/admin-data-usage-map.md`

### 7.5 문서를 추가/이동/삭제한 경우

- `docs/README.md`
- `logs/admin-doc-update-log.md`

## 8. API/DB 연관 작업의 Definition of Done

- page가 mock seed를 직접 소유하지 않는다.
- list/detail/action이 같은 도메인 source를 기준으로 연결된다.
- service 인터페이스만 교체하면 mock에서 API로 전환할 수 있는 구조다.
- 관련 문서가 같은 작업에서 함께 갱신된다.
- 검증을 수행했거나, 미수행 사유와 영향을 결과에 명시한다.

## 9. 비권장 대안

- `src/mocks/all-admin-data.ts` 같은 전역 단일 데이터 파일
- feature 경계를 깨고 다른 feature dataset을 직접 가져오는 구조
- 페이지 내부 `initialRows`를 유지한 채 service만 얇게 추가하는 구조
- 목록은 service, 상세는 page-local 상수로 남기는 절충안

## 9.1 2026-06-11 mock seed/source 정리 실행 기록

- 정리 원칙: `api/mock-*`는 도메인 타입 기반 초기 seed/factory만 export한다. React, page, store import는 금지한다. 조치 후 바뀌는 상태는 기존처럼 feature store 또는 service live state에 둔다.
- 적용 inventory: `Community`, `System`, `Message`, `Operation`, `Commerce`, `Billing`.
- 페이지 경계: 이번 범위의 page는 mock 파일, store seed, 타 feature store/mock을 직접 import하지 않는다. 목록 조회, URL 필터 복원, 상세 열기, 조치 후 상태 반영, 감사 로그 링크는 service facade를 통해 확인한다.
- System audit 예외: 감사 로그 화면은 여러 도메인 store audit을 보여줘야 하므로 `system-audit-logs-service.ts`가 static audit seed와 permission/coupon/metadata audit 병합을 담당한다. 이는 page direct merge가 아니라 system service 책임으로 본다.
- Message/Operation/Commerce option 예외: 이벤트/쿠폰 등록 화면이 메시지 그룹·템플릿 선택지를 필요로 하므로 Message store 직접 참조 대신 `messages-service.ts`의 option DTO를 사용한다.
- Billing 위치: 결제/환불은 `features/commerce`로 옮기지 않고 실제 구현 위치인 `features/billing`에서 같은 seed/service/store 원칙을 적용한다.
- E2E 단위 게이트:
  - `npx playwright test tests/e2e/community-source.spec.ts`
  - `npx playwright test tests/e2e/system-logs.spec.ts tests/e2e/system-audit-logs.spec.ts`
  - `npx playwright test tests/e2e/message-source.spec.ts`
  - `npx playwright test tests/e2e/operation-notices.spec.ts tests/e2e/operation-faq.spec.ts tests/e2e/operation-events.spec.ts tests/e2e/operation-policies.spec.ts`
  - `npx playwright test tests/e2e/commerce-coupons.spec.ts tests/e2e/commerce-coupons-action-column.spec.ts tests/e2e/commerce-points.spec.ts tests/e2e/commerce-billing-source.spec.ts`
  - Playwright web server는 mock auth 진입을 보장하기 위해 `VITE_SUPABASE_DISABLED=true`로 실행한다.
## 10. 2026-03-27 메타데이터 관리 전환 메모

- 대상 화면: `System > 메타데이터 관리`
- 현재 SoT
  - `src/features/system/api/system-metadata-service.ts`
  - `src/features/system/model/system-metadata-store.ts`
  - `src/features/system/model/system-metadata-types.ts`
- 현재 구조
  - 페이지는 메타 그룹/항목 seed를 직접 소유하지 않고 service를 통해 단일 source를 조회합니다.
  - 그룹 생성/수정, 항목 생성/수정, 활성/비활성, 항목 정렬 변경 조치는 모두 `system-metadata-store.ts`의 단일 write path를 사용합니다.
  - 내부 계약은 `linkedAdminPages[]`와 `linkedAdminLocations[]`를 유지하지만, 현재 운영자 UI는 `관리 위치`를 목록/상세 주요 정보에서 제거하고 `기본 정보 + 설정 구조 + 운영 값` 흐름으로 단순화했습니다.
  - 시스템 감사 로그 페이지는 `useSystemMetadataStore().audits`를 병합해 역추적 경로를 구성합니다.
- API/DB 전환 후보
  - `GET /system/metadata-groups`
  - `POST /system/metadata-groups`
  - `PATCH /system/metadata-groups/:groupId`
  - `POST /system/metadata-groups/:groupId/items`
  - `PATCH /system/metadata-groups/:groupId/items/:itemId`
  - `POST /system/metadata-groups/:groupId/items/reorder`
  - `POST /system/metadata-groups/:groupId/status`
- 테이블 후보
  - `system_metadata_groups`
  - `system_metadata_group_items`
  - `system_metadata_group_histories`
- 전환 메모
  - 그룹/항목 조치는 현재 `Target Type = SystemMetadataGroup` 단일 계약을 사용합니다.
  - 운영 값 드래그 정렬도 그룹 단위 write path와 감사 계약을 공유합니다.
  - 항목 단위 Target Type 분리 여부는 실제 백엔드 감사 스키마 확정 시 함께 결정합니다.
  - API/DB 전환 시에도 `관리 route 연결` 입력값과 `관리 위치 계층` 읽기값을 분리해 유지하거나, 서버가 `linkedAdminPages[]`를 받아 `linkedAdminLocations[]`를 파생하는 구조를 유지해야 합니다.

## 10.1 2026-03-27 보강 메모 > 메타데이터 운영 값 삭제 write path
- `system-metadata-service.ts`는 운영 값 삭제를 위한 safe wrapper(`deleteMetadataItemSafe`)를 제공합니다.
- `system-metadata-store.ts`는 운영 값 삭제, 기본값 재승격, 정렬 재정규화, `item_deleted` 이력 적재를 같은 write path에서 처리합니다.
- 실제 API/DB 전환 시에도 같은 단일 write path 책임을 유지해야 합니다.

## 10.2 2026-03-30 Assessment TOPIK 쓰기 문제은행 전환 메모

> **[2026-06-11 인바운드 전환 — 본 절은 역사 기록으로 동결]** 아래 서술의 **검수 표면·검수 쓰기(검수 페이지, `reviewStatus` 축, 검수 상태 변경 RPC, 검수 메모)는 2026-06-11 인바운드 전환(§10.3, 결정 기록 §0)에 따라 재정의 P3 코드 컷오버(커밋 `202f905`)에서 전부 제거 완료**됐고, 페이지 정체성은 "문항 목록(조회)" + "문항 관리(관리 포인트: 태그·노출)"로 재정의됐다. 현행 동작의 SoT는 `docs/specs/admin-data-contract.md` §9.6(신규 스키마 기준 재작성)과 양 page-IA이며, 본 §10.2는 구 코드 동작의 사실 기록으로만 유지한다(2depth 상세 파일은 `assessment-question-detail-page.tsx`로 개명, 라우트는 `/assessment/question-bank/:questionId`).

- 대상 화면: `Assessment > TOPIK 쓰기 문제 검수`(`/assessment/question-bank` — 재정의: "TOPIK 쓰기 문항 목록"), `Assessment > TOPIK 쓰기 문항 관리`(`/assessment/question-bank/manage`)
  - 현재 SoT
    - `src/features/assessment/api/assessment-question-bank-service.ts`
    - `src/features/assessment/model/assessment-question-bank-schema.ts`
    - `src/features/assessment/model/assessment-question-bank-types.ts`
    - `src/features/assessment/model/assessment-question-bank-presenter.ts`
    - 삭제됨: 구 `src/features/assessment/api/supabase-assessment-question-bank-service.ts`(`problems` rollback adapter)
    - `src/features/assessment/pages/assessment-question-bank-page.tsx`
    - `src/features/assessment/pages/assessment-question-manage-page.tsx`
    - `src/features/assessment/pages/assessment-question-review-page.tsx`
    - `src/features/assessment/model/use-assessment-question-list.ts`
    - `src/features/assessment/model/use-assessment-question-filters.ts`
    - `src/features/assessment/ui/assessment-question-bank-toolbar.tsx`
  - 현재 구조
    - 기존 `/assessment/question-bank` 단일 페이지의 `tab` 쿼리 토글(`검수 큐`/`문항 관리`)은 제거하고, `/assessment/question-bank`(검수)와 `/assessment/question-bank/manage`(관리) 두 형제 route/페이지로 분리했습니다. 각 route가 자체 URL 상태(검수=`reviewStatus`, 관리=`operationStatus`, 공통=`questionNo`/`domain`/`questionType`/`difficulty`/`keyword`)를 보존합니다.
    - 페이지는 문항 seed를 직접 소유하지 않고 service를 통해 단일 source를 조회합니다. 두 페이지는 동일한 Supabase `problems` 조회 결과를 공유 hook으로 공유하므로 목록 source가 갈라지지 않습니다.
    - 검수 페이지 목록과 관리 페이지 목록은 모두 같은 조회 결과를 사용하고, 검수 상세는 `/assessment/question-bank/review/:questionId` 2depth route에서 단건 조회 결과를 사용합니다.
    - 목록/단건 조회 source는 Supabase `problems` 테이블이며, `question_no in (51, 52, 53, 54)` 조건으로 TOPIK 쓰기 문항만 읽습니다. JSON fixture, Zustand store, local seed fallback은 제거되어 사용하지 않습니다.
    - Supabase client가 설정되지 않았거나 `problems` 조회가 실패하면 임시 JSON 데이터를 가져오지 않고 `pending/error/empty` 네트워크 상태 UI로 처리합니다.
    - 검수 상태 변경은 `admin_update_problem` RPC를 통해 `review_status`와 `review_workflow_status`를 갱신한 뒤 같은 `problems` row를 재조회합니다.
    - 검수 메모는 v13 `problems`에 내부 메모 컬럼이 없으므로 현재 화면 내 조치 전 annotation으로만 유지합니다. 영구 저장이 필요하면 additive column/API 계약을 먼저 확정해야 합니다.
    - 운영 상태 변경은 `lifecycle_status` 적용 전까지 비활성화되어 있으며, JSON/store fallback write path를 제공하지 않습니다. 관리 페이지에는 운영 조치 UI(노출 후보/숨김 후보/운영 제외)를 비활성 스캐폴딩으로 미리 배치했습니다. 현재 `operationStatus`는 모든 문항에서 `미지정` sentinel로 표시되고, 페이지 상단에 "운영 상태 관리는 준비 중입니다" 경고 Alert를 노출하며, 운영 조치 버튼은 disabled입니다. 확인+사유 → 감사 로그(ConfirmAction + AuditLogLink) 흐름은 코드에 미리 연결돼 있으나 `admin_update_problem` write path는 데이터 계약상 비활성입니다.
    - 문제 번호, 도메인, 유형, 난이도, 검수 상태, 운영 상태, 자동 점검 상태 메타데이터는 schema 파일에서 단일 SoT로 관리합니다.
    - `AssessmentQuestion` 화면 모델은 `problems.id`, `question_no`, `title`, `prompt`, `difficulty`, `review_status`, `review_workflow_status`, `topic_category_code`, `explanation`, `answer_key`, `rubric`, `created_at`, `updated_at`을 매핑합니다.
    - `questionText`는 `problems.prompt`를 사용하고, 검수 상세에서는 문제 번호별 profile에 따라 공통 `문항 지시문` 또는 전용 `문항` row에 표시합니다. `topic`은 `problems.title`, `domain`은 `topic_category_code`의 코드 라벨을 사용합니다.
    - `questionTypeLabel`은 TOPIK 쓰기 문제 번호 규칙으로 파생하고, `difficultyLevel`은 `problems.difficulty` 숫자 구간으로 파생합니다. source가 없는 표시값은 임의 생성하지 않고 빈 값/`-`/`미상`/`미지정` 같은 sentinel로 노출합니다.
    - 검수 상세 `채점 기준`은 Supabase `problems.rubric` 배열을 `scoringCriteria[]`로 매핑해 표시합니다. 과거 JSON 검수 문서용 `reviewDocument` 분기와 타입은 제거되어 현재 코드 source가 아닙니다.
  - API/DB 전환 후보
    - `GET /assessment/questions`
    - `GET /assessment/questions/:questionId`
    - `PATCH /assessment/questions/:questionId/review-memo`
    - `PATCH /assessment/questions/:questionId/review-status`
    - `PATCH /assessment/questions/:questionId/operation-status`
    - `GET /assessment/question-batches`
- 전환 메모
  - `reviewStatus`와 `operationStatus`는 같은 컬럼으로 합치지 않고 별도 필드로 유지합니다.
  - 운영 상태 쓰기 활성화는 "후속 활성화" 상태입니다. 관리 페이지의 운영 조치 UI와 ConfirmAction + AuditLogLink 흐름은 이미 연결돼 있으므로, v13 `lifecycle_status`가 도착하면 `OPERATION_WRITE_ENABLED` 플래그를 켜고 service write path를 un-stub하는 한 번의 변경으로 활성화합니다. 그 전까지는 disabled 스캐폴딩과 `미지정` sentinel을 유지합니다.
  - `generationBatchId`, `promptVersion`, `generationModel`은 AI 생성 출처 추적용 메타데이터로 유지합니다.
  - 검수 이력 diff, 재생성 배치, 시험 세트 편성 연결은 후속 API로 확장하되 현재 route/service 계약은 유지합니다.

## 10.3 TOPIK 쓰기 문항 데이터 흐름 — 인바운드 수신 모델 (POL-017, 2026-06-11 전면 개정)

> **2026-06-11 오너 결정으로 본 절의 종전 아웃바운드 push 모델(`검수 → 배포(API 업로드) → 노출 통제`)은 폐기·대체됐다.** 확정 근거·재정의 전모는 `docs/architecture/metadata-tag-schema-transition-decision-record.md` §0. 본 개정으로 admin 문서는 2026-06-09 v13 경계 결정 원문("admin이 외부 API로부터 문제를 받아와, 노출 관리 포인트를 적용해, Supabase에 쓴다; v13은 read-only")과 같은 방향이 됐다.

- 대상 정책: `POL-017`(재정의 — "TOPIK 쓰기 문항 수신·관리 운영정책", `docs/specs/admin-policy-source-map.md`). 운영 흐름은 `수신(외부 공급 API) -> 인박스 무손실·버전 적재 -> 번호별 정식 카탈로그 승격 -> 관리 포인트(태그) + 노출 통제(service_status) -> 학습자 안전 RPC를 통한 v13 read-only 소비`로 고정한다.
- 데이터 방향 (인바운드)
  - **문제 발원 = 외부(공급) API.** 문제 본문·정답·메타데이터(`docs/metadata-tag-schema-rule.md` §4 메타데이터 + §7 테이블 스키마, §7.9 제외·검수 필드 제외)가 **완성 상태로** 공급된다. admin은 문제를 저작·생성·분류·검수하지 않는다.
  - **외부 공급 API 수신 경로는 구현 상태**다. 타입별 상세 API를 페이지네이션해 인박스에 적재하고 번호별 정식 테이블로 승격한다. 공급 계약 원문과 변경 통지 추적은 `docs/requests/upstream-writing-endpoints-request-2026-06-10.md`를 따른다.
  - admin은 수신분을 Supabase `topik_writing_51/52/53/54_questions` + `question_source_map`에 적재하고(idempotent), **관리 포인트(태그 — schema-rule §2)**와 **노출 통제(`service_status` — D-6)**를 부여한다.
  - v13 사용자 기능은 admin이 적재·관리한 데이터를 **read-only**로 소비한다. 관리자 프론트엔드가 직접 사용자 화면 데이터를 서빙하지 않는다.
- 검수 개념 삭제 (결정 기록 §0-3)
  - `review_status`/`review_workflow_status`(편차 E1 철회)/`review_passed`/`validation_result`와 검수 화면·검수 쓰기·검수 감사 액션은 admin에서 제거한다. 컬럼 물리 제거는 재정의 P3 마이그레이션. 문제 품질·상태 표현은 태그(관리 포인트)로만 한다.
  - 검수 페이지·검수 쓰기 경로는 재정의 P3 구현에서 제거 완료됐다(`202f905` — §10.2는 역사 기록). 검수 4컬럼 물리 제거도 마이그레이션 `0013`으로 완료됐다(2026-06-11 적용 — 스냅샷 4테이블 검수 컬럼 0건·뷰 16컬럼·RPC 검수 참조 0건).
- 인터림/전환 역사
  - P2 백필 466행 = **초기 코퍼스**(유효 저장 데이터, 전 행 `service_status='internal_test'`). 신규 공급은 구현된 외부 상세 API 수신 경로로만 받는다.
  - `problems` 보존과 env 기반 구 읽기 어댑터 봉인은 2026-06-11 P3 당시의 과도기 결정이었다. 최종 v13 14:00 교정은 writing FK를 private registry로 옮기고 row snapshot을 백필한 뒤 `public.problems` writing 행을 삭제하므로, 이 과도기 경로를 현재 콘텐츠·과거 기록·rollback 계약으로 사용하지 않는다.
- 전환 메모
  - **운영 write 경계(P4 개방 완료 — 2026-06-11, 태그 별도 입력 제거 — 2026-06-12, 2026-06-23 통합, 2026-06-26 기관 정합화)**: 관리 포인트 write는 `/assessment/question-bank` 단일 통합 화면에서 RPC 단일 경로로만 수행한다 — 노출 통제 `admin_update_topik_question`(화이트리스트 `service_status` 단일, 사유 `__note`) + 태그 `admin_assign_question_tag`/`admin_remove_question_tag`(별도 메모 인자 없음) + 기관 노출 `admin_set_writing_question_institutions`/`admin_clear_writing_question_institutions`(문항 중심) 및 `admin_add_institution_writing_questions`/`admin_remove_institution_writing_questions`(기관 중심). `service_status`는 기관 노출보다 우선하는 전역 차단 조건이며, `excluded`/`internal_test` 신규 기관 추가는 blocked로 기록하고 매핑을 만들지 않는다. 기존 매핑 제거는 stale 정리를 위해 허용한다. `OPERATION_WRITE_ENABLED`/`SERVICE_STATUS_WRITE_ENABLED` 게이트와 `problems` legacy adapter는 제거됐고, 직접 테이블 write는 RLS(쓰기 정책 0건)로 전면 차단된다(P4-4 네거티브 검증). POL-018 ②③ 화면 가드 포함. 증적: `logs/metadata-tag-schema-transition-evidence.md` P4 절.
  - 수신·적재 시 `question_source_map`에 공급측 식별자를 보존해 재수신(idempotent)·역추적을 보장한다. `published_task_id` 컬럼은 구 push 모델 잔재로 용도 재검토 예정.
  - **수신 경로(P6 구현, 2026-06-23; 배포 시작 결함 보완 2026-07-13; 승격 범위 교정 2026-07-14)**: `api/writing-tasks/ingest.ts`가 상류 상세 API를 타입별 페이지네이션하고 `topik_writing_question_import`에 무손실 적재한 뒤 §7 번호별 테이블로 자동 승격한다. 승격 RPC에는 이번 요청에서 실제 적재한 `source_task_id[]`만 전달하며, 빈 배열을 `null`로 바꾸거나 기존 전역 `held` backlog를 암묵적으로 재처리하지 않는다. 관리자 POST와 cron GET은 인증 경계를 분리하며, 적재/승격은 service-role RPC 단일 경로를 사용한다. `question_received`는 `AssessmentQuestionImport + source_task_id`와 `AssessmentQuestion + question_id`에 각각 기록한다. Vercel 함수의 상대 ESM import는 `.js` 산출물 확장자를 명시하고 Node ESM 시작 회귀 테스트로 보호한다.
  - **원본 수정 시각 기반 버전 판정(마이그레이션 `20260716052957`, 2026-08-24 dev·운영 적용 — 공급 `updated_at` 채움 확정에 따라 차단 해제)**: 외부 `question_id`를 문항군 키, `created_at`을 불변 기준선, `updated_at`을 원본 수정 순서로 사용하고 canonical 학습·채점 projection의 `content_hash`를 함께 비교합니다. `updated_at`이 더 최신이고 내용이 달라진 경우만 승격하며, `metadata_only`·과거/동일 시각 내용 충돌·식별/시각 오류는 인박스 held로 보존합니다. `payload_hash` 원문 멱등 키와 `(source_task_id,payload_hash)` unique는 유지하고, 현재 노출 포인터는 계속 `question_source_map.canonical_import_id`만 사용합니다. 문항별 transaction advisory lock과 정렬된 bulk 입력으로 비교/삽입/승격을 직렬화합니다.
  - **수신 청크 경계(2026-07-16)**: 약 701건을 50건 단위로 순차 적재하고 모든 적재 청크가 성공한 뒤에만 50개 ID 단위 승격을 시작합니다. 오류 응답은 `promoted`, `metadata_only`, `held`, `duplicate`, `failed` 의미를 분리하고 오류 참조 ID를 반환하며 재실행은 기존 payload/import 멱등 계약을 사용합니다.
  - **적용 선행 게이트**: 2026-07-16 실응답은 총 701건·중복 ID 0건·`created_at` 누락 0건이지만 `updated_at` 701건이 모두 null입니다. 공급 API가 UTC ISO-8601 non-null·`updated_at>=created_at`·문항군 `created_at` 불변 계약을 충족하기 전에는 신규 마이그레이션을 dev/운영 tracker에 적용하지 않습니다. v13 운영 코드/DDL은 변경하지 않고 기존 draft 충돌/submit snapshot 회귀만 교차 검증합니다.
  - **정식 카탈로그 버전 고정 계약(마이그레이션 `20260713080015`, 공유 dev DB 적용 2026-07-14·운영 미적용)**: `topik_writing_question_source_map.learner_problem_id`는 `md5(question_id)::uuid` generated UNIQUE 값으로 v13 FK와 일치하고, `legacy_problem_id`는 과거 ETL provenance로만 보존한다. `canonical_import_id`는 현재 정식 문항이 승격된 정확한 인박스 버전을 가리킨다. 학습자 RPC `get_available_writing_questions`는 번호별 정식 51~54 테이블과 이 버전의 `payload_hash`만 결합하며, 인박스의 `is_latest`를 정식 문항 선택 기준으로 사용하지 않는다. 따라서 아직 승격되지 않은 새 수신 버전이 기존 정식 문항을 덮거나 숨기지 않는다. 초기 백필과 v13 활성화 게이트는 typed row를 고정 인박스 `raw_payload`에서 재구성한 record와 완전 비교해 ID만 맞는 잘못된 버전 pin도 거부한다.
  - **재수신 멱등 계약(교정 마이그레이션 `20260714130000`, 공유 dev DB 적용 2026-07-14·운영 미적용)**: source map이 이미 같은 `canonical_import_id`를 가리키고 identity/item/hash가 일치하면 정식 본문을 delete/reinsert하지 않고 인박스·source map의 bookkeeping만 `promoted`로 복구한다. 같은 import의 hash/identity 불일치는 `held`/fail-closed다. 최종 `20260714150000`에서는 죽은 read-mode freeze를 제거하므로, 검증된 새 import는 current canonical 본문을 교체할 수 있고 기존 draft/submission은 각 row snapshot에 고정된다.
  - **관리자 버전 이력 읽기 경계(마이그레이션 `20260716003518`, 공유 dev DB 적용 2026-07-16·운영 미적용)**: `topik_writing_question_version_summary_view`는 `question_source_map.canonical_import_id`를 현재 포인터로 사용하고 `mapping_status='promoted'`인 인박스 행만 집계해 `version_count`와 `revision_count`를 제공합니다. facade는 목록 요약 일괄 조회, 문항별 승격 이력, `question_id + import_id` 과거 `raw_payload` 상세를 각각 safe 경계로 분리합니다. 과거 상세는 현행 상세 mapper를 재사용하되 `service_status`를 과거 운영 상태처럼 표시하지 않습니다. `raw`·`held`는 인박스에서만 확인하고, 조회 실패는 기존 목록/현재 상세를 중단하지 않습니다. dev에서 702행 canonical/promoted/revision 대사, admin 허용·non-admin 0행·anon 권한 오류, down/up 재적용, security/performance advisor 신규 관련 lint 0건을 확인했습니다. 자동 필드 diff와 과거 버전 복원·재활성화, v13 변경은 범위 밖입니다.
  - **외부 식별자 라우팅 계약(2026-07-14 보강)**: 공급측 `question_id`는 opaque·불변 값이며 문항 번호를 인코딩한다고 가정하지 않는다. 번호별 테이블은 `item_number`로 라우팅한다. 기존 접두형 ID 파싱은 추천 뷰 조회를 생략하는 빠른 경로일 뿐이며, 임의 형식 ID는 추천 뷰의 `item_number` 조회 후 상세·노출 상태·태그 RPC를 호출한다.
  - **권한 분리**: 학습자 RPC는 문제 풀이에 필요한 허용 필드만 반환하고 정답·모범답안·채점표·원시 응답·내부 메타데이터를 제외한다. Q53의 schema-less `source_data.chart_a/chart_b`도 객체 전체를 전달하지 않고 chart/series 허용 키와 숫자 값만 재구성한다. 정확한 원시 버전 조회 `get_writing_question_grading_payload`와 제출 시 버전·노출을 재검증하는 `private.assert_writing_question_submittable`은 service-role 전용이다.
  - **최종 식별자·과거 기록 교정(`20260714140000`/`20260714150000`, dev 적용·운영 미적용)**: v13은 writing 관련 FK를 소유 `private.problem_identities`로 이관하고, 기존 초안·제출마다 금지 필드를 제외한 불변 `legacy_cutover_snapshot`을 백필한 뒤 `public.problems`의 writing 행을 삭제한다. Admin 승격은 `learner_problem_id`로 v13 소유 `private.ensure_writing_problem_identity`만 호출하며 registry table에 FK/직접 DML을 추가하지 않는다. 현재 본문·정답의 유일한 SoT는 번호별 정식 51~54 카탈로그와 source map이고, 과거 기록은 각 초안·제출 row snapshot에서 읽는다. retained mirror, current legacy/shadow/read mode, rollback sync 경로는 최종 구조에 남기지 않는다.
  - **최종 dev 검증과 남은 운영 게이트(2026-07-15)**: v13 `20260714140000`/`20260714141000`/`20260714160000`, Admin `20260714150000`을 dev DB에 적용했다. canonical 공개 700건/source-map pin 700건, private writing identity 704건, `public.problems` writing 0건, draft 328건, submission 280건, history snapshot 누락 0건, registry 대상 FK 10개를 대사했다. identity/outbox down/up, outbox 5종 fault-injection, 실제 provider Q54 제출→분석→피드백 canary, 최신 v13 `origin/main` 기반 cross-app headed Chromium desktop 10/10·mobile 7/7(데스크톱 전용 3개 의도적 skip)을 통과했고 pageerror·console error·5xx는 0건이다. canary 정리 뒤 intent 0건과 기준 수량 복귀를 확인하고 dev 제출은 `blocked + unverified`로 fail-close했다. 남은 게이트는 운영 DB/Vercel 적용, evidence 기반 원자 활성화와 운영 smoke다.
  - **마스터 surface(P5-1 조회 + P5-3 토글 — 2026-06-11)**: 주제/태그 마스터(`topik_writing_topic_master`/`topik_writing_tag_master`)를 `/system/metadata`의 `TOPIK 쓰기 마스터 데이터` 섹션에서 전수(비활성 포함) 조회한다. source 경계는 facade `assessment-question-bank-service.ts`의 카탈로그 로더(`fetchQuestionBankTopicMasterCatalogSafe`/`fetchQuestionBankTagMasterCatalogSafe`, 운영 `topik_writing`·Supabase 미구성 시 mock)이며, 섹션 컴포넌트는 `src/features/assessment/ui/master-catalog-section.tsx`(시스템 페이지가 마운트)다. **유일한 write = tag_master 활성/비활성 토글(P5-3)**: facade `updateTagMasterStatusSafe` → RPC `admin_update_tag_master_status`(0014 — platform_admin 가드·사유 필수, 감사 `tag_master_status_changed`/`AssessmentTagMaster`). 주제 마스터·마스터 값 편집은 조회 전용 유지, 직접 테이블 write는 RLS 차단.

## 10.4 메타데이터·태그 스키마 전환 (권장안 v0.8 — 2026-06-10 채택 확정, Phase 0 결정 완료)

- 대상 문서: `docs/metadata-tag-schema-rule.md`(콘텐츠팀 권장 스키마, v0.8). 영향도 분석: `docs/메타데이터-태그-스키마-전환-영향도-보고서.md`. 실행 SoT: `docs/메타데이터-태그-스키마-전환-실행계획안.md`(P0~P6 단계·PASS 채점 게이트).
- 상태: **2026-06-10 프로젝트 오너 지시로 v0.8 채택·전면 전환 착수가 확정됐고, Phase 0 결정 13건(D-1~D-13)이 전부 확정됐다.** 확정값·근거·실측 증거는 `docs/architecture/metadata-tag-schema-transition-decision-record.md`(이하 결정 기록)가 SoT다. 구 "미채택/코드 결선 금지" freeze 가드는 해제됐으며, 이후 착수 통제는 실행 계획안 §12.3 페이즈 채점(직전 페이즈 PASS 시에만 비가역 실행)을 따른다.
- 세 데이터 모델 관계 (2026-06-11 인바운드 전환 개정)
  - ⓐ 신규 스키마: 번호별 4분리 테이블(`topik_writing_51/52/53/54_questions`) + 태그/주제 마스터 + 추천 검색용 읽기전용 UNION 뷰 + 식별자 매핑 테이블 `topik_writing_question_source_map`(편차 E2) — **admin 문항·운영 SoT(수신·태그·노출)**
  - ⓑ 레거시 원천: v13 `problems` — 인터림 코퍼스의 백필 원천(역사), 컷오버 후 read-only 레거시 동결(일몰 조건은 결정 기록 §2.3 — "검수 SoT" 위상은 2026-06-11 §0으로 소멸)
  - ⓒ 외부(공급) API: **문제 발원 주체 — 수신 연동 구현**(§10.3, POL-017 재정의, D-11 공급 계약·변경 통지 추적). 종전 "상류 노출본(push 대상)" 위상은 폐기
- 소유권·호스트 확정 (D-1)
  - 신규 오브젝트는 현행 v13 Supabase 프로젝트 `fglggyfvzjdsbyckinqa`(talkpik-dev)에 생성하고, 마이그레이션 자산(`supabase/migrations`)은 이 repo(topik-ai)가 소유·관리한다(시나리오 B의 공유 호스트 변형).
  - 경계 근거: v13 오너 결정(2026-06-09, v13 repo `supabase/migrations/20260609130000_remove_v13_admin_island.sql`) — "문제 데이터의 작성·노출 통제는 admin(topik-ai)이 담당, v13은 read-only". 공유 자산(`admin_audit_logs`, `private.is_*_admin` 헬퍼, `profiles.app_role`)은 재사용하고, 기존 v13 테이블 DDL 변경은 0건 원칙(P1 무변경 diff 게이트로 증명).
  - v13 측 스테이징/브랜치 DB 없음(실측 — Management API branches 0건). additive 마이그레이션 + down 스크립트 + 적용 직후 무변경 diff + RT-1 파일럿 적재 왕복으로 검증을 대체한다.
- 스키마 소유권 일반화 (2026-06-12, 알림 기능 개발 WP0-1)
  - 종전 "topik-ai는 `topik_writing_*`만 소유" 한정을 **도메인 기준 소유권 모델**로 일반화했다. SoT: `docs/architecture/shared-supabase-schema-ownership.md` (owner/writer/reader/RLS/migration home 매트릭스).
  - admin 운영 네임스페이스(알림: `notification_templates`/`notification_groups`/`notification_dispatches`/`notification_delivery_attempts`/`notification_email_config` + admin RPC + DB dispatcher/email/marketing 함수 + pg_cron)는 topik-ai가 소유하며, 적용 이력은 `topik_writing_schema_migrations`와 분리된 **`admin_schema_migrations`** tracker(`npm run db:admin:migrate`)로 추적한다. migration 파일은 `supabase/migrations-admin/`에 둔다. 파이프라인 단일 migration home은 `20260723011242_notification_pipeline_ownership_transfer.sql`이며, v13의 과거 pipeline migration은 clean replay용 no-op이다.
  - 기존 v13 테이블 DDL 변경 0건 원칙과 무변경 diff 게이트는 알림 네임스페이스에도 동일하게 적용한다.
- 마이그레이션 적용 절차 (P1 확정·적용 완료 2026-06-10)
  - 마이그레이션 작성 → 오너 승인(v13 오너=admin 오너 동일인, 단일 승인) → 프로덕션 적용 → §5.4 게이트(8오브젝트 스모크 + RLS 역할 매트릭스 + 뷰 anon 차단 네거티브 테스트 + 기존 테이블 무변경 diff + RT-1).
  - 적용 수단: 이 머신에 supabase CLI 인증/DB 패스워드가 없어 CLI `db push` 대신 **Supabase Management API**(`/v1/projects/{ref}/database/query`)를 표준 적용 경로로 사용한다. 도구: `npm run db:migrate`(`scripts/db/migrate.mjs`, 적용 이력은 자체 네임스페이스 추적 테이블 `topik_writing_schema_migrations`에 기록), `npm run db:migrate:status`, 롤백 `node scripts/db/migrate.mjs --down <파일명>`(`supabase/migrations/down/` 스크립트).
  - 무변경 증명: `npm run db:snapshot`(`scripts/db/schema-snapshot.mjs`)으로 적용 전/후 스키마 표면(테이블 컬럼/함수/정책/뷰)을 스냅샷하고 `--diff --exclude-own`으로 자기 네임스페이스 제외 diff 0건을 확인한다.
  - 적용 기록(2026-06-10): 마이그레이션 12파일 전부 적용 완료, 자기 네임스페이스 제외 diff 0건, RLS 매트릭스(anon/비admin 0행·admin 허용)·RT-1 파일럿 4경로 왕복 일치 — 증적은 `logs/metadata-tag-schema-transition-evidence.md` P1 절.
- 백필 적재 기록 (P2 — 2026-06-10 실행 완료)
  - D-3 재분류 입력표 466행(분류 24배치 + 표본 60행·q52 cf=ref 22행 2단 적대 감사 보정 완료) 기반 ETL(extract→transform→load→verify)로 `problems` 470행을 백필: **466행 적재**(51:90/52:76/53:62/54:238) + 4행 보류(`audit_seed` 예시 행 — D-5 역분해 실패 경로), `question_source_map` 470행 전수 매핑(legacy 노출 신호 보존). 전 행 `service_status='internal_test'`(D-6 — 사용자 노출 차단), `problems`는 읽기 전용으로만 접근(당시 기준 — "검수 SoT" 위상은 2026-06-11 §0으로 소멸).
  - 검증: 5종(재조립/보존/수량/축/RT-2 재조회 왕복) + D-6 + source_map 대사 ALL PASS, idempotency(2회 연속 적재 전 테이블 sha256 동일), 델타 재적재 리허설(덤프 사본 방식 — 검수 변경 2건 따라잡기 + 원상 수렴 발산 0건). 증적: `logs/metadata-tag-schema-transition-evidence.md` P2 절.
  - P2 종합 판정: 2026-06-10 채점 시점 **CONDITIONAL**(P2-5 콘텐츠팀 샘플 승인 대기) → **2026-06-11 인바운드 전환으로 P2-5 게이트 폐기(트랙 소멸), P2 재채점 PASS**(증적 로그 추기 참조). 인터림 코퍼스 466행은 초기 코퍼스로 유지.
- 가드레일 (2026-06-11 갱신)
  - 신규 식별자의 코드 결선은 실행 계획안 §12.3 채점 규칙을 따른다: 가역적 선행 개발(스크립트·코드·문서 초안)은 허용, 비가역 실행(프로덕션 DDL 적용·실데이터 적재·컷오버 배포·write 개방·외부 연동 호출)은 직전 페이즈 PASS 후에만 한다.
  - `service_status`(`available`/`excluded`/`internal_test`)가 유일한 물리 노출 상태다(D-6 유지). '서비스_노출상태' 태그 그룹은 시드에서 제외하고 RPC에서 부여를 차단한다. `operationStatus` 4값 union은 재정의 P3에서 제거한다. v13 `lifecycle_status` 종속은 해소됐다(신규 스키마가 자체 노출 컬럼 보유).
  - ~~검수 상태 2축(D-2)~~ — **2026-06-11 §0으로 철회**(검수 개념 삭제, 편차 E1 철회). `review_status`/`review_workflow_status`/`review_passed`/`validation_result` 컬럼 물리 제거는 재정의 P3 마이그레이션.
  - 채택 계약·식별자 매핑·편차 목록(E2~E4 — E1 철회)은 `docs/specs/admin-data-contract.md` §12에서 추적한다.

## 10.4.1 2026-06-17 Users 회원 목록 Supabase 전환 메모

- 대상 화면: `Users > 회원 목록`(`/users`).
- 전환 상태: P0 결손 RPC 핫픽스로 Supabase 모드 404 런타임 실패를 해소했다. `get_admin_users`/`admin_set_user_status` RPC 2종은 `supabase/migrations-admin/20260617210000_admin_users_directory.sql`에 작성했고, 대응 down 스크립트를 둔다. 적용 이력은 `admin_schema_migrations`가 담당하며, 2026-06-17 dev DB 적용 완료했다.
- 2026-07-09 보강: `supabase/migrations-admin/20260709150000_admin_users_phone_and_export.sql`은 같은 RPC를 `affiliation` 인자와 `gender`, `phone_masked` 반환 컬럼으로 확장하고, 회원 정보 내보내기 RPC `admin_export_users`를 추가한다. 이 보강 마이그레이션은 이 문서 기준 작성 자산이며 dev DB 적용 여부는 별도 검증 로그에서 확인한다.
- 2026-07-20 운영 정합화: `20260720102000_users_phone_source_alignment.sql`은 세 Users RPC의 전화번호 원천을 v13 split field로 정렬해 운영 DB의 `column p.phone does not exist` 오류를 해소한다. `20260720104000_users_audit_target_projection.sql`은 저장 계약 `target_table='User'`를 유지하면서 조회 응답과 UI 필터를 `Users`로 정규화한다. 두 마이그레이션은 dev/prod에 동일 적용되며 v13 테이블 DDL/DML은 변경하지 않는다.
- 데이터소스 경계: `supabase-users-service.ts`는 회원 목록 read, 상태 write, 회원 정보 export RPC를 호출한다. read RPC 인자명은 `search`, `sort`, `page`, `page_size`, `affiliation`으로 프론트 JSON 키와 정확히 일치해야 PostgREST가 함수를 매칭한다.
- Supabase read 경로: `get_admin_users(search text, sort text, page integer, page_size integer, affiliation text default null)`는 platform_admin 전용이며 `profiles` + `auth.users`를 조인하고 `writing_submissions` 제출 수/최근 제출 시각을 집계한다. 반환 컬럼은 `user_id`, `email`, `display_name`, `nickname`, `gender`, `phone_masked`, `app_role`, `plan_label`, `status`, `registration_status`, `nationality_country_code`, `social_providers`, `affiliation_code`, `affiliation_label`, `submission_count`, `last_activity`, `last_sign_in_at`, `email_confirmed`, `consent_status`, `consent_accepted_at`, `created_at`, `total_count`다.
- Supabase write 경로: `admin_set_user_status(target_id uuid, new_status text)`는 platform_admin 전용이며 `new_status`는 `active`/`blocked`만 허용하고 `deleted` 사용자는 차단한다. 신규 테이블은 없고 v13 `profiles` DDL은 변경하지 않으며 `profiles.status`만 토글한다.
- 감사/사유 경계: 감사 로그는 `target_table='User'`, `target_id=userId`, action `user_status_changed`, `diff.status.from/to`, `payload.app_role`을 사용한다. 화면 사유 입력/저장 계약을 확장할 경우에도 `User + userId` Target Type/ID는 유지한다.
- 내보내기 경계: `admin_export_users(p_reason,p_include_full_phone,p_affiliation,p_scope,p_selected_user_ids,목록 필터,p_selected_column_keys)`는 사유 필수, Target Type `User`, Target ID `batch:{uuid}`, action `users_exported`로 반출 이력을 남긴다. 파일 내용, 검색어 원문, 성별 값, 전화번호 값 자체는 감사 로그 payload에 저장하지 않는다.
- 가입 생애주기 경계: topik-ai는 v13 원천 테이블 DDL을 변경하지 않고 Admin 소유 `get_admin_users` RPC에서 `registration_status`와 미인증 약관 정규화를 제공한다. v13에는 이메일 미인증 `user_consents` insert 차단, 필수 약관 전 사용자 기능 활성화 차단, dry-run/backfill 계획을 handoff한다.

## 10.5 2026-06-17 Operation 공지사항 Supabase 전환 메모

- 대상 화면: `Operation > 공지사항`(`/operation/notices`, `/operation/notices/create`, `/operation/notices/create/:noticeId`).
- 전환 상태: mock-only에서 Supabase-backed hybrid 스위치 구조로 전환 완료. `operation_notices` 테이블과 admin RPC 3종은 `supabase/migrations-admin/20260617120000_operation_notices.sql`에 작성했고, 대응 down 스크립트는 `supabase/migrations-admin/down/`에 둔다. 적용 이력은 `admin_schema_migrations`가 담당하며, 2026-06-17 dev DB 적용 완료했다.
- 데이터소스 경계: `notices-service.ts`의 safe facade 계약(`{ ok, data, error }`)은 유지하고, `operation-notices-data-source.ts`가 `isSupabaseConfigured`와 `VITE_OPERATION_NOTICES_SOURCE`를 판별한다. Supabase 미구성, `VITE_SUPABASE_DISABLED=true`, `VITE_OPERATION_NOTICES_SOURCE=mock`은 기존 mock source(`mock-operation.ts` + `operation-store.ts`)로 회귀한다.
- Supabase 경로: `supabase-operation-notices-service.ts`가 `operation_notices` row를 `OperationNotice` 화면 모델로 매핑하고, DB status ASCII `published`/`hidden`을 UI 라벨 `게시`/`숨김`으로 변환한다. 저장/상태 변경/삭제는 SECURITY DEFINER admin RPC 3종(`admin_save_operation_notice`, `admin_toggle_operation_notice_status`, `admin_delete_operation_notice`) 경유이며, 직접 테이블 write 경로는 만들지 않는다.
- 감사/사유 경계: 세 RPC 모두 reason 필수이며, 감사 로그는 `target_table='OperationNotice'`, `target_id=noticeId`, action `notice_saved`/`notice_status_changed`/`notice_deleted`를 사용한다. 상태 변경과 삭제는 확인 모달 사유를 RPC까지 전달하고, 등록/수정 상세에는 별도 사유 입력 UX가 없으므로 서비스 경계에서 저장 사유를 보강한다.
- 잔여 정책: B2C 실제 노출 surface는 사용자 공지 목록/상세 기준의 운영상 추정으로 남긴다. 상단 고정/예약 게시, HTML sanitize/preview 서버 정책, 자연키 `NOTICE-NNN` max+1 동시성 리스크, `updated_by` uuid 표시명 정합은 `docs/page-sync/operation-notices-page-sync.md`와 `docs/specs/admin-page-gap-register.md`에서 계속 추적한다.

## 10.6 2026-06-17 Operation FAQ Supabase 전환 메모

- 대상 화면: `Operation > FAQ`(`/operation/faq`).
- 전환 상태: mock-only에서 Supabase-backed hybrid 스위치 구조로 전환 완료. `operation_faqs`, `operation_faq_curations`, `operation_faq_metrics` 테이블과 admin RPC 5종은 `supabase/migrations-admin/20260617123000_operation_faqs.sql`에 작성했고, 대응 down 스크립트는 `supabase/migrations-admin/down/`에 둔다. 적용 이력은 `admin_schema_migrations`가 담당하며, 2026-06-17 dev DB 적용 완료했다.
- 데이터소스 경계: `faqs-service.ts`의 safe facade 계약(`{ ok, data, error }`)은 유지하고, `operation-faqs-data-source.ts`가 `isSupabaseConfigured`, `VITE_SUPABASE_DISABLED`, `VITE_OPERATION_FAQS_SOURCE`를 판별한다. Supabase 미구성, `VITE_SUPABASE_DISABLED=true`, `VITE_OPERATION_FAQS_SOURCE=mock`은 기존 mock source(`mock-operation.ts` + `operation-store.ts`)로 회귀한다.
- Supabase 경로: `supabase-operation-faqs-service.ts`가 3테이블 row를 FAQ 마스터/노출/지표 화면 모델로 매핑하고, DB status ASCII `published`/`hidden`을 UI 라벨 `공개`/`비공개`로 변환한다. `surface`, `curation_mode`, `exposure_status`는 DB와 서비스 경계에서 ASCII 코드를 유지하고, category는 한글 코드(`계정`/`결제`/`커뮤니티`/`메시지`)를 저장한다.
- 감사/사유 경계: FAQ 원문 저장/상태 변경/삭제는 `admin_save_operation_faq`, `admin_toggle_operation_faq_status`, `admin_delete_operation_faq` RPC를 사용하고, 큐레이션 저장/삭제는 `admin_save_operation_faq_curation`, `admin_delete_operation_faq_curation` RPC를 사용한다. 5개 RPC 모두 reason 필수이며, 감사 로그는 `OperationFaq`/`OperationFaqCuration` Target Type과 action `faq_saved`/`faq_status_changed`/`faq_deleted`/`faq_curation_saved`/`faq_curation_deleted`를 사용한다.
- 잔여 정책: B2C 실제 FAQ 노출 surface는 고객센터/도움말 기준 운영상 추정으로 남긴다. 자연키 `FAQ-NNN`/`FAQCUR-NNN` max+1 채번 동시성 리스크, `updated_by` uuid 표시명 정합, `operation_faq_metrics` 실집계 파이프라인(seed only)은 `docs/page-sync/operation-faq-page-sync.md`와 `docs/specs/admin-page-gap-register.md`에서 계속 추적한다.

## 10.7 2026-06-17 Operation 이벤트 Supabase 전환 메모

- 대상 화면: `Operation > 이벤트`(`/operation/events`, `/operation/events/create`, `/operation/events/create/:eventId`).
- 전환 상태: mock-only에서 Supabase-backed hybrid 스위치 구조로 전환 완료. `operation_events` 테이블과 admin RPC 4종은 `supabase/migrations-admin/20260617152000_operation_events.sql`에 작성했고, 대응 down 스크립트는 `supabase/migrations-admin/down/`에 둔다. 적용 이력은 `admin_schema_migrations`가 담당하며, 2026-06-17 dev DB 적용 완료했다.
- 데이터소스 경계: `events-service.ts`의 safe facade 계약(`{ ok, data, error }`)은 유지하고, `operation-events-data-source.ts`가 `isSupabaseConfigured`, `VITE_SUPABASE_DISABLED`, `VITE_OPERATION_EVENTS_SOURCE`를 판별한다. Supabase 미구성, `VITE_SUPABASE_DISABLED=true`, `VITE_OPERATION_EVENTS_SOURCE=mock`은 기존 mock source(`mock-operation.ts` + `operation-store.ts`)로 회귀한다.
- Supabase 경로: `supabase-operation-events-service.ts`가 `operation_events` row를 `OperationEvent` 화면 모델로 매핑한다. DB `visibility_status`는 ASCII `exposed`/`hidden`/`scheduled`이고 UI 라벨은 `노출`/`숨김`/`예약`이다. DB `progress_status`는 ASCII `ongoing`/`upcoming`/`ended`이며 읽기 시 날짜 기준으로 파생한다. `event_type`/`reward_type`은 한글 코드를 저장하고, `exposure_channels`와 `banner_images`는 jsonb 배열로 보관한다.
- 감사/사유 경계: 이벤트 저장/예약/즉시 게시/종료는 `admin_save_operation_event`, `admin_schedule_operation_event`, `admin_publish_operation_event`, `admin_end_operation_event` RPC를 사용한다. 4개 RPC 모두 reason 필수이며, 감사 로그는 `OperationEvent` Target Type과 action `event_saved`/`event_scheduled`/`event_published`/`event_ended`를 사용한다. 종료는 `progress_status='ended'` 및 `visibility_status='hidden'`으로 전환한다.
- 잔여 정책: B2C 실제 이벤트 목록/상세/프로모션 랜딩 노출은 `노출 예정`으로 남긴다. 자연키 `EVT-NNN` max+1 채번 동시성 리스크, `updated_by` uuid 표시명 정합, 배너 이미지/보상 정책/메시지 템플릿 정규화, `participant_count` 집계 source는 `docs/page-sync/operation-events-page-sync.md`와 `docs/specs/admin-page-gap-register.md`에서 계속 추적한다.

## 10.8 2026-06-17 Operation 정책 관리 Supabase 전환 메모

- 대상 화면: `Operation > 정책 관리`(`/operation/policies`, `/operation/policies/create`, `/operation/policies/create/:policyId`).
- 전환 상태: mock-only에서 Supabase-backed hybrid 스위치 구조로 전환 완료. `operation_policies`, `operation_policy_histories` 테이블과 admin RPC 4종은 `supabase/migrations-admin/20260617170000_operation_policies.sql`에 작성했고, 대응 down 스크립트는 `supabase/migrations-admin/down/`에 둔다. 적용 이력은 `admin_schema_migrations`가 담당하며, 2026-06-17 dev DB 적용 완료했다.
- 데이터소스 경계: `policies-service.ts`의 safe facade 7종 계약은 유지하고, `operation-policies-data-source.ts`가 `VITE_OPERATION_POLICIES_SOURCE=mock` 및 `VITE_SUPABASE_DISABLED`를 판별한다. Supabase 미구성, `VITE_SUPABASE_DISABLED=true`, `VITE_OPERATION_POLICIES_SOURCE=mock`은 기존 mock source(`mock-operation-policies.ts` + `policy-store.ts`)로 회귀한다.
- Supabase 경로: `operation_policies.status`는 DB ASCII `published`/`hidden`이고 UI 라벨은 `게시`/`숨김`이다. `exposure_surfaces`, `related_admin_pages`, `related_user_pages`, `source_documents`, `legal_references`는 jsonb 배열로 보관한다. `current_version_id`는 최신 히스토리 추적에 사용한다.
- 감사/사유 경계: 정책 저장/상태 변경/삭제/히스토리 버전 게시는 `admin_save_operation_policy`, `admin_toggle_operation_policy_status`, `admin_delete_operation_policy`, `admin_publish_operation_policy_version` RPC를 사용한다. 4개 RPC 모두 reason 필수이며, 감사 로그는 `OperationPolicy` Target Type과 action `policy_saved`/`policy_status_changed`/`policy_deleted`/`policy_version_published`를 사용하고, 각 조치마다 `operation_policy_histories`에 snapshot을 append한다.
- 잔여 정책: 자연키 `POL-NNN`/`PH-NNNN` max+1 채번 동시성, `changed_by`/`updated_by` uuid 표시명 정합, `current_version_id` 화면 모델, `requires_consent` 기반 B2C 동의 재수집 트리거는 `docs/page-sync/operation-policies-page-sync.md`와 `docs/specs/admin-page-gap-register.md`에서 계속 추적한다.

## 10.9 2026-06-17 Community 게시글/신고 Supabase 전환 메모

- 대상 화면: `Community > 게시글 관리`(`/community/posts`), `Community > 신고 관리`(`/community/reports`).
- 전환 상태: mock-only에서 Supabase-backed hybrid switch 구조로 전환 완료. `community_posts`, `community_post_admin_notes`, `community_reports` 테이블과 admin RPC 5종은 `supabase/migrations-admin/20260617173000_community.sql`에 작성했고, 대응 down 스크립트는 `supabase/migrations-admin/down/`에 둔다. 적용 이력은 `admin_schema_migrations`가 담당하며, 2026-06-17 dev DB 적용 완료했다.
- 데이터소스 경계: `community-service.ts`의 safe facade 7종 계약은 유지하고, `community-data-source.ts`가 `VITE_COMMUNITY_SOURCE=mock` 및 `VITE_SUPABASE_DISABLED`를 판별한다. Supabase 미구성, `VITE_SUPABASE_DISABLED=true`, `VITE_COMMUNITY_SOURCE=mock`은 기존 mock source(`mock-community.ts` + `community-store.ts`)로 회귀한다. `resolveCommunityReportSafe`는 `reportId + action + reason` 계약으로 확장됐다.
- Supabase 경로: `community_posts.status`는 DB ASCII `published`/`hidden`이고 UI 라벨은 `게시`/`숨김`이다. `community_reports.process_status`는 DB ASCII `pending`/`resolved`, `resolution_action`은 `hide_post`/`suspend_user`/`dismiss`다.
- 감사/사유 경계: 게시글 숨김/게시/삭제/메모는 `CommunityPost` Target Type과 action `post_hidden`/`post_shown`/`post_deleted`/`post_memo_added`를 사용한다. 신고 종결은 `CommunityReport` Target Type과 action `report_resolved`를 사용한다. 게시글 딥링크는 `/community/posts`, 신고 딥링크는 `/community/reports`다.
- 신고 조치 의미 정합화: 이전 mock은 신고만 종결하고 게시글/사용자 조치를 하지 않았으나, Supabase RPC는 `hide_post`일 때 같은 트랜잭션에서 대상 게시글을 실제 `hidden` 처리한다. `suspend_user`는 payload `user_suspend_integration=intent_only_v13_admin_set_user_status_pending` 의도만 기록하고 실제 정지는 v13 `admin_set_user_status` 연동 후 확정한다. `dismiss`는 종결만 수행한다.
- 잔여 정책: `POST-NNN`/`RP-NNN` max+1 채번 동시성, board/policy_code/memo type code table화, 사용자 정지 v13 연동은 page-sync와 gap register에서 계속 추적한다.

## 10.10 2026-06-17 Commerce 포인트 Supabase 전환 메모

- 대상 화면: `Commerce > 포인트 관리`(`/commerce/points`).
- 전환 상태: mock-only에서 Supabase-backed hybrid switch 구조로 전환 완료. `commerce_point_policies`, `commerce_point_ledgers`, `commerce_point_expirations` 테이블과 admin RPC 5종은 `supabase/migrations-admin/20260617190000_commerce_points.sql`에 작성했고, 대응 down 스크립트는 `supabase/migrations-admin/down/`에 둔다. 적용 이력은 `admin_schema_migrations`가 담당하며, 2026-06-17 dev DB 적용 완료했다.
- 데이터소스 경계: `points-service.ts`의 safe facade 7종 계약은 유지하고, `commerce-points-data-source.ts`가 `VITE_COMMERCE_POINTS_SOURCE=mock` 및 `VITE_SUPABASE_DISABLED`를 판별한다. Supabase 미구성, `VITE_SUPABASE_DISABLED=true`, `VITE_COMMERCE_POINTS_SOURCE=mock`은 기존 mock source(`mock-points.ts` + point store 경로)로 회귀한다.
- Supabase 경로: DB enum-like 값은 ASCII(`draft`/`active`/`inactive`, `earn`/`debit`/`scheduled` 등)를 저장하고 UI 한글 라벨은 `point-types`/`point-schema`에서 매핑한다. RLS는 3테이블 모두 enable+force 및 admin select only다.
- 서버측 잔액 계산: 수동 포인트 조정은 `admin_create_manual_point_adjustment(p_user_id,p_amount,p_reason)`만 사용한다. RPC가 사용자별 advisory lock과 최신 ledger `for update`를 통해 최신 `available_balance_after`를 읽고 `balance_after`/`available_balance_after`를 계산한다. 음수 잔액은 RPC 가드와 CHECK 제약으로 차단하며, Supabase 경로에서 클라이언트 잔액 계산은 제거된 계약이다.
- 감사/사유 경계: 정책 저장/상태 변경, 수동 조정, 소멸 보류/해제는 각각 `CommercePointPolicy`/`CommercePointLedger`/`CommercePointExpiration` Target Type과 action `point_policy_saved`/`point_policy_status_changed`/`point_manual_adjusted`/`point_expiration_held`/`point_expiration_released`를 사용한다. 5개 RPC 모두 reason 필수다.
- 잔여 정책: 음수 잔액 허용 여부와 차감 우선순위/환불 복구 정책, 정책 저장 사유 UI 필드 부재(note -> reason 전달), `POL-NNNN`/`PL-NNNN` max+1 채번 동시성, 소멸 자동 처리 cron, `user_id`의 v13 profiles 느슨참조(FK 없음)는 page-sync와 gap register에서 계속 추적한다.

## 10.11 2026-06-17 Commerce 쿠폰 Supabase 전환 메모

- 대상 화면: `Commerce > 쿠폰 관리`(`/commerce/coupons`).
- 전환 상태: mock-only에서 Supabase-backed hybrid switch 구조로 전환 완료. `commerce_coupons`, `commerce_coupon_subscription_templates` 테이블과 admin RPC 7종은 `supabase/migrations-admin/20260617193000_commerce_coupons.sql`에 작성했고, 대응 down 스크립트를 둔다. 적용 이력은 `admin_schema_migrations`가 담당하며, 2026-06-17 dev DB 적용 완료했다.
- 데이터소스 경계: `coupons-service.ts`의 `*Safe` 14종 계약은 유지하고, `commerce-coupons-data-source.ts`가 `VITE_COMMERCE_COUPONS_SOURCE=mock` 및 `VITE_SUPABASE_DISABLED`를 판별한다. Supabase 미구성, `VITE_SUPABASE_DISABLED=true`, `VITE_COMMERCE_COUPONS_SOURCE=mock`은 기존 mock source/store 경로로 회귀한다.
- Supabase 경로: DB enum-like 값은 대부분 ASCII camelCase(`customerDownload`, `autoIssue`, `amountDiscount`, `allProducts` 등)를 저장하고 UI 한글 라벨은 coupon-types 계층에서 매핑한다. 배열과 scope-ref는 JSONB로 보관한다.
- 감사/사유 경계: Supabase 경로의 쿠폰/템플릿 저장·복제·일시중지·재개·삭제는 `CommerceCoupon`/`CommerceCouponTemplate` Target Type과 action `coupon_saved`/`coupon_duplicated`/`coupon_paused`/`coupon_resumed`/`coupon_deleted`/`coupon_template_saved`/`coupon_template_paused`/`coupon_template_resumed`/`coupon_template_deleted`를 사용한다. 7개 write RPC 모두 reason 필수이며 store `CouponAuditEvent(AL-CPN-)` 감사는 mock fallback 경로로 축소된다.
- 유지 계약: `planTier` free-limit와 `validate*` 계열 검증은 현재 클라이언트/config 기준으로 유지한다.
- 잔여 정책: 발급/사용 원장(`commerce_coupon_issues`, `commerce_coupon_redemptions`), scope-ref/대상 그룹/알림 정규화, `planTier` 영속화, `target_user_ids` v13 profiles 느슨참조 정합은 후속 전환 대상으로 추적한다.
## 10.12 2026-06-17 Commerce 환불 Supabase 전환 메모

- 대상 화면: `Commerce > 환불 관리`(`/commerce/refunds`).
- 전환 상태: mock/Supabase 합성 조회에서 Supabase-backed workflow table 구조로 전환 완료. `commerce_refunds` 테이블과 admin RPC 2종, helper `next_commerce_refund_id()`는 `supabase/migrations-admin/20260617203000_commerce_refunds.sql`에 작성했고, 대응 down 스크립트를 둔다. 적용 이력은 `admin_schema_migrations`가 담당하며, 2026-06-17 dev DB 적용 완료했다.
- 데이터소스 경계: `billing-service.ts`의 `fetchRefunds/approve/reject*Safe` 계약은 유지하고, `commerce-refunds-data-source.ts`가 `VITE_COMMERCE_REFUNDS_SOURCE=mock` 및 `VITE_SUPABASE_DISABLED`를 판별한다. Supabase 미구성, `VITE_SUPABASE_DISABLED=true`, `VITE_COMMERCE_REFUNDS_SOURCE=mock`은 기존 mock source/store 경로로 회귀한다.
- Supabase read 경로: 환불 목록은 더 이상 v13 `payment_history(status='refunded')` 합성 결과가 아니라 `commerce_refunds`를 읽는다. 처리 대기/승인/거절 워크플로 SoT는 `commerce_refunds`이고, 결제 내역 payments read는 v13 `payment_history` 그대로 유지한다.
- Supabase write 경로: 기존 Supabase 모드 승인/거절 write 차단(`assertMockRefundActionAllowed`)은 해제되고, 승인/거절은 `admin_approve_billing_refund(p_refund_id,p_reason)`, `admin_reject_billing_refund(p_refund_id,p_reason)` RPC를 사용한다. 두 RPC 모두 reason 필수이며 `pending` 상태만 처리한다.
- 감사/사유 경계: 감사 로그는 `CommerceRefund` Target Type과 action `refund_approved`/`refund_rejected`를 사용한다. 승인 payload에는 `intent_only_v13_payment_history_pending=true`를 남겨 실제 v13 `payment_history.status` 환불 집행이 아직 미연동임을 표시한다.
- 잔여 정책: 실제 결제 환불 집행 v13 연동, `payment_id`/`user_id` FK 없는 느슨참조 정합, `RF-NNNN` max+1 채번 동시성, payments `method` 컬럼 reconcile은 후속 과제로 추적한다.
## 10.1.1 2026-06-17 System 메타데이터 그룹/항목 Supabase 전환

- 전환 상태: `System > 메타데이터 관리`의 그룹/항목은 mock-only 단계에서 Supabase-backed hybrid source로 전환 완료.
- 마이그레이션: `supabase/migrations-admin/20260617211000_system_metadata.sql` + down migration, `admin_schema_migrations` tracker 기준 2026-06-17 dev DB 적용 완료.
- 테이블: `system_metadata_groups`(16컬럼, `group_id` PK `META-GRP-NNN`, JSONB `linked_admin_pages`/`linked_user_surfaces`/`schema_candidate_notes`) + `system_metadata_group_items`(12컬럼, `item_id` PK, `group_id` FK ON DELETE CASCADE, group-scoped code/label unique).
- 데이터소스: `system-metadata-data-source.ts`는 `VITE_SYSTEM_METADATA_SOURCE=mock` 또는 `VITE_SUPABASE_DISABLED=true`일 때 mock fallback을 사용한다.
- 서비스 계약: `system-metadata-service.ts` Safe 7종 계약은 유지한다. Supabase 서비스가 groups + group_items를 조회해 기존 `SystemMetadataGroup.items[]` 중첩 반환 형태로 매핑한다.
- write path: admin RPC 6종(`admin_save_metadata_group`, `admin_save_metadata_item`, `admin_toggle_metadata_group_status`, `admin_toggle_metadata_item_status`, `admin_delete_metadata_item`, `admin_reorder_metadata_items`)만 사용하며 모두 `reason` 필수다.
- audit actions: `metadata_group_saved`, `metadata_item_saved`, `metadata_group_status_changed`, `metadata_item_status_changed`, `metadata_item_deleted`, `metadata_items_reordered`. 모든 감사 target은 `SystemMetadataGroup + groupId`다.
- 비범위: `/system/metadata`에 임베드된 AssessmentMasterCatalog(`topik_writing_*`)는 이미 Supabase-backed이며 이번 System metadata groups/items 전환과 무관하다.
- 남은 미확정: PK next-id max+1 동시성, `is_default` 단일성 정책, `admin_locations`/이력 정규화.

## 10.13 2026-06-17 System 시스템 로그 Supabase 전환 메모

- 대상 화면: `System > 시스템 로그`(`/system/logs`).
- 전환 상태: mock-only에서 Supabase-backed read-only source 구조로 전환 완료. `system_logs` 테이블은 `supabase/migrations-admin/20260617213000_system_logs.sql`에 작성했고, 대응 down 스크립트는 `supabase/migrations-admin/down/`에 둔다. 적용 이력은 `admin_schema_migrations`가 담당하며, 2026-06-17 dev DB 적용 완료했다.
- 데이터소스 경계: `system-logs-service.ts`의 `fetchSystemLogsSafe` 계약은 유지하고, `system-logs-data-source.ts`가 `VITE_SYSTEM_LOGS_SOURCE=mock`, `VITE_SUPABASE_DISABLED`, Supabase 설정 여부를 판별한다. Supabase 미구성, `VITE_SUPABASE_DISABLED=true`, `VITE_SYSTEM_LOGS_SOURCE=mock`은 기존 mock source로 회귀한다.
- Supabase read 경로: `system_logs`를 `created_at desc`로 조회한다. 컬럼은 `id`, `level`, `message`, `component`, `trace_id`, `context`, `created_at`이며 level은 현재 `INFO`/`WARN`/`ERROR` 대문자 값을 저장한다.
- write/감사 경계: admin write policy/RPC는 없다. 로그 적재는 backend/infra service-role 경로로 남아 있으며 소스/주체는 미정이다. 조회 전용 기술 로그라서 admin 감사 액션은 생성하지 않으며, `admin_audit_logs`와 구분한다.
- 잔여 정책: 로그 적재 소스/주체, 보존기간·파티셔닝, `trace_id` 의미, level 코드값 장기 표준화 여부는 page-sync와 gap register에서 계속 추적한다.

## 10.14 2026-06-18 System 감사 로그 Supabase 전환 메모

- 대상 화면: `System > 감사 로그`(`/system/audit-logs`).
- 전환 상태: mock/store audit 병합 source에서 Supabase-backed live read source 구조로 전환 완료. 읽기 RPC와 조회 인덱스는 `supabase/migrations-admin/20260618001000_admin_audit_logs_read.sql`에 작성했고, 대응 down 스크립트는 `supabase/migrations-admin/down/`에 둔다. 적용 이력은 `admin_schema_migrations`가 담당하며, 2026-06-18 dev DB 적용 완료했다.
- 데이터소스 경계: `system-audit-logs-data-source.ts`가 `VITE_SYSTEM_AUDIT_LOGS_SOURCE=mock`, `VITE_SUPABASE_DISABLED`, Supabase 설정 여부를 판별한다. Supabase 미구성, `VITE_SUPABASE_DISABLED=true`, `VITE_SYSTEM_AUDIT_LOGS_SOURCE=mock`은 기존 mock source와 store audit 병합 경로로 회귀한다.
- Supabase read 경로: `supabase-system-audit-logs-service.ts`가 `admin_list_audit_logs(p_target_type, p_target_id, p_keyword, p_start, p_end, p_limit, p_offset)`를 호출한다. Supabase 모드의 `fetchSystemAuditLogsSafe`는 `admin_audit_logs`를 단일 source로 사용하고, 모든 admin RPC가 적재한 감사 로그를 화면에서 실조회한다.
- RPC 계약: `SECURITY DEFINER` + `private.is_admin` 가드, `profiles(admin_user_id -> id)` 조인으로 `display_name` actor 해석, 필터는 target type/id, keyword `ILIKE`, created_at 범위, 정렬은 `created_at desc`, 페이지네이션은 `limit/offset`이다.
- DB 경계: 신규 테이블은 없고 `admin_audit_logs` 컬럼/RLS/쓰기 경로는 변경하지 않는다. 조회 인덱스만 `admin_audit_logs_target_lookup_idx`(`target_table`, `target_id`)와 `admin_audit_logs_created_at_desc_idx`(`created_at desc`) 2개를 추가했다.
- 잔여 정책: `diff`/`payload` 민감정보 노출 범위는 미확정이므로 화면 노출은 보류한다.
## 2026-06-18 Users 회원 상세 학습 현황 source 전환

- 화면: `/users/:userId` `학습 현황` 탭.
- safe facade: `fetchUserLearningOverviewSafe(userId, signal)`.
- Supabase source: `get_admin_user_learning_overview(target_id uuid)`.
- mock fallback: `getMockUserLearningOverview(userId)`.
- fallback 조건: Supabase 미구성 또는 `VITE_SUPABASE_DISABLED=true`일 때 기존 mock 모드를 유지한다.
- 전환 범위: 학습 현황 탭만 live read로 연결한다. 기존 `활동`/`결제` 탭 더미 데이터는 이번 범위에서 유지한다.
- 보안/프라이버시: 답안 본문과 sentence feedback 본문은 source와 화면 모델에서 제외한다.

## 2026-07-08 학습 현황 writing 재정의 + Analytics 학습 분석 신설

- 회원 상세 `학습 현황` 탭: 동일 RPC명(`get_admin_user_learning_overview`)을 writing 중심 반환
  모양으로 재정의(마이그 `20260708130000`, down 파일로 직전 정의 복원 가능). 화면 모델
  `UserLearningOverview`와 mock(`getMockUserLearningOverview`)을 같은 모양으로 갱신.
- 신규 화면 `/analytics/learning`(학습 분석): safe facade `fetchLearningAnalyticsSafe(periodDays,
  signal)` → `get_admin_learning_analytics(period_days)`(마이그 `20260708140000`), mock 모드는
  페이지 내 결정적 목업. 기간 0=전체.
- 신규 v13 수집 원천: `writing_submission_metrics`(v13 마이그 `20260708113000`) — admin은 읽기 집계만.
- 적용 상태: dev DB 적용·검증 완료(실브라우저 풀루프 포함), 운영 DB 미적용(기존 미적용분과 동일 트랙).

### 2026-07-10 Analytics 학습 분석 다차원 필터 확장

- `/analytics/learning` facade는 `get_admin_learning_analytics_filtered(...)`와 `get_admin_learning_analytics_filter_options()`를 사용한다. 기존 `get_admin_learning_analytics(period_days)`는 호환성을 위해 유지한다.
- `20260715190000_admin_learning_analytics_pdf_topics.sql`은 최신 metadata coverage·canonical identity 함수 계약을 보존하면서 `pdf_usage.perTopic`을 직접 귀속 `export_downloaded`의 문제 유형×대주제×세부 주제별 건수로 확장한다. safe facade는 마이그레이션 지연 환경에서 `perTopic=[]`으로 fail-safe 처리하고 mock·CSV·화면은 같은 응답 모양을 사용한다. 2026-07-15 dev DB에 적용했으며 운영 DB는 미적용이다.
- 마이그레이션 `20260715130000_admin_learning_analytics_topic_stats_by_question.sql`은 직전 최신 RPC를 `pg_get_functiondef`로 읽고 주제 집계·응답 projection만 fail-closed로 교체한다. 문제 유형별 `topic_stats.questionNo`와 주제 전체 제출 수 정렬을 추가하면서 `20260713120000`의 metadata coverage·identity·필터 계약을 그대로 보존하고, down도 동일 블록만 역변환한다.
- dev DB에 먼저 적용됐던 구 `20260715130000` 자산이 오래된 함수 본문을 기준으로 metadata coverage와 canonical identity 참조를 제거한 이력은 `20260715173826_restore_learning_analytics_metadata_contract.sql`로 복구했다. PR 머지 전 migration asset은 clean up/down과 역순 전체 rollback 모두 metadata coverage를 보존하도록 보강했으며, `20260715173826` down은 문제 유형별 주제 계약을 유지한 채 canonical private projection만 public 관계로 되돌린다. dev DB 실제 관리자 RPC에서는 제출 280/280·이벤트 3539/3539 연결, coverage 오류 배너 없음, 주제 15행의 `questionNo`를 확인했다. 운영 DB는 미적용이다.
- 마이그레이션 `20260710120000_admin_learning_analytics_filtered.sql`은 2026-07-13 dev DB에 적용했다. 같은 이름의 down SQL로 RPC 2종과 tracker 행이 제거되는 것을 확인한 뒤 재적용했으며, 관리자 호출·비인증 거부·KST 날짜/문제 유형/주제/세부 조건/이전 기간·PII 미반환과 `security definer`/빈 `search_path`/실행 권한 경계를 검증했다. 운영 DB는 미적용이다.
- live source는 writing 제출·피드백·평가 차원·계측·학습 이벤트와 `topik_writing_question_source_map`/`topik_writing_question_recommendation_view`의 신규 메타데이터를 read-only로 조합한다. `20260714090000`부터 제출 `problem_id`를 `learner_problem_id`로 연결하고 현재 제목·태그는 canonical projection에서 읽는다. 주제 필터는 `topic_main/topic_detail` 단일 기준이며 `legacy_problem_id`나 `problems.tags`를 사용하지 않는다.
- safe facade와 결정적 mock은 같은 query/response 모양을 사용한다. 조건 재조회 실패 시 마지막 성공 결과를 유지하고, Supabase 비활성 환경에서만 mock fallback을 사용한다.
- 기간·문제 유형·주제·세부 특성은 한 번 만든 filtered source에서 KPI, 유형 비교, 점수 분포, 주제 성과, PDF 분석으로 파생한다(취약 차원 화면 블록은 2026-07-15 제거, RPC 반환은 유지). PDF는 `export_downloaded` 내보내기 완료 이벤트이며 직접 귀속/혼합/미분류를 분리하고, 직접 귀속만 문제 유형×주제 순위로 세분화한다.

### 2026-07-13 Analytics 학습 분석 메타데이터 연결 복구

- dev DB에는 최근 30일 `writing_submissions` 280건이 남아 있었지만, 환경 재시드 뒤 현재 `problems.id`와 역사 `topik_writing_question_source_map.legacy_problem_id`가 달라져 메타데이터 inner join 결과가 0건이었다. 학습 원천 삭제가 아니라 식별자 연결 회귀였다.
- `20260713103000_admin_learning_analytics_unmapped_fallback.sql`은 기본 기간·문제 유형 통계를 보존하는 중간 fail-safe다. 최종 연결은 `20260713072205_topik_writing_problem_alias.sql`의 `topik_writing_problem_aliases`와 통합 뷰 `topik_writing_problem_question_map`을 사용한다. 기존 source map은 다시 묶거나 덮어쓰지 않는다.
- `reconcile-learning-analytics-metadata.mjs`는 `md5(question_id)::uuid` 현재 문제를 문항 번호·정규화 prompt·answer key로 모두 일치시킨 경우에만 환경별 별칭을 적용한다. 기존 `held` 별칭은 재실행으로 자동 해제하지 않는다. dev에서 메타데이터 문항 700건 모두 exact match, hold 0건이었고 누락 source-map anchor 232건과 별칭 700건을 원자 적용했다.
- `20260713120000_admin_learning_analytics_metadata_coverage.sql`은 통합 매핑을 사용하며, 기본 기간·문제 유형 집계는 항상 `problems.question_no`를 사용한다. 주제·세부 특성 결과와 mapped coverage는 문제 번호 일치, 대·세부 주제, 번호별 필수 메타데이터가 모두 완전한 연결만 사용하고 summary에 현재/직전 기간의 제출·이벤트 연결 대상/완료/비율과 문제 연결 수를 반환한다.
- 배포 전 `npm run check:learning-analytics-metadata-coverage -- --project-ref <target> --expected-project-ref <target>`는 대상 project ref 일치와 metric 계약을 먼저 검증하고, 실제 참조 제출·이벤트·문제의 100% 연결, problem fan-out 0, 고아 별칭 0, hold 0, 필수 메타데이터 누락 0을 차단식으로 검사한다. dev 최종값은 제출 280/280, 이벤트 3333/3333, 문제 58/58이다.
- 적용 후 관리자 화면에서 최근 30일 학습자 91명, 제출 280건, 51~54번 제출 217/39/11/13건을 확인했다. 빈 before-image의 별칭 700건·source-map anchor 232건 전체 rollback/reapply와 비어 있지 않은 before-image의 별칭 700건 복원을 각각 검증했다. 기간 5종, 51~54번, 주제 2단계, 세부 필드 10종, 필드 내 OR·필드 간 AND를 dev DB 독립 기준값과 대조했다. 운영 DB는 미적용이다.

### 2026-07-15 Writing mirror 제거 이후 Analytics identity 교정

- 앞의 2026-07-13 별칭·`problems.question_no` 계약은 mirror 제거 전 복구 단계의 역사 기록입니다. 최종 runtime은 `public.problems` writing 행과 공개 `topik_writing_problem_question_map`을 읽지 않습니다.
- 이미 적용된 `20260714090000_admin_writing_analytics_learner_identity.sql`은 수정하지 않습니다. 후속 `20260715103000_admin_writing_analytics_canonical_coverage.sql`이 유효한 과거 ID→canonical 문항 매핑을 Admin 전용 `private.admin_writing_historical_identity_aliases`로 한 번 이관하고, 현재 canonical identity와 합친 private projection으로 최신 filtered analytics RPC의 제출·이벤트·PDF 귀속 조인을 교체합니다.
- migration은 기존 filtered RPC의 정확한 정의를 private rollback table에 저장하고, coverage CTE/응답 shape가 예상과 다르거나 초안·제출 identity를 100% 해석할 수 없으면 중단합니다. down은 저장한 함수 원형을 먼저 복구한 뒤 private helper를 제거합니다.
- dev DB down/up에서 원형 함수 복구와 helper 제거를 확인했습니다. 재적용 결과 private historical alias 468건, 제출 280/280, 초안 328/328, 이벤트 3532/3532가 연결됐고 함수 정의의 `public.problems`/공개 alias map 의존성은 0건입니다. 운영 DB는 미적용입니다.

## Operation > PDF 내보내기 제한 — 정책 변경 이력 (2026-07-08)

- 화면: `/operation/pdf-quota` 정책 탭 변경 이력 테이블.
- safe facade: `fetchPdfQuotaPolicyHistorySafe({page, pageSize}, signal)`.
- Supabase source: `get_admin_pdf_quota_policy_history(p_page, p_page_size)` — `admin_audit_logs(pdf_quota_policy_saved)`의 감사 id, KST 시각, 비민감 화이트리스트 투영(별도 테이블 없음).
- mock fallback: `mockPdfQuotaPolicyHistory` + `usePdfQuotaStore.savePolicy`의 이력 append(구형 부분 기록 행 1건 포함 — fallback 렌더 경로 유지 검증).
- fallback 조건: Supabase 미구성 또는 `VITE_SUPABASE_DISABLED=true` 또는 `VITE_OPERATION_PDF_QUOTA_SOURCE=mock`.
- 전환 범위: 정책 저장은 신 시그니처 `admin_save_pdf_quota_policy(4+1인자)`로 교체(구 6인자 시그니처 drop). 초기화 탭 경로는 무변경.

## Operation > PDF 내보내기 제한 — 개인 초기화 대상 검색 (2026-07-08)

- 화면: `/operation/pdf-quota?tab=resets` 초기화 실행 모달의 개인 범위 `대상 회원` Select.
- safe facade: `fetchPdfQuotaResetUserOptionsSafe({search, page, pageSize}, signal)`.
- Supabase source: `search_admin_pdf_quota_reset_users(p_search, p_page, p_page_size)` — `operation.pdf-quota.manage` 권한 기준, `profiles`/`auth.users` 최소 필드, 서버 검색/페이지네이션. `get_admin_users`의 platform_admin 게이트와 100명 창 제약을 재사용하지 않는다.
- mock fallback: `mockUsers`에서 동일 search/page/pageSize 계약으로 필터링해 100명 초과 회원 선택 회귀를 e2e에서 검증한다.
- fallback 조건: Supabase 미구성 또는 `VITE_SUPABASE_DISABLED=true` 또는 `VITE_OPERATION_PDF_QUOTA_SOURCE=mock`.

## 11. 2026-07-16 Supabase 환경 라우팅 계약

- 환경 대상은 `localhost`와 Vercel `Development`에서 `topik-dev`(`fglggyfvzjdsbyckinqa`), Vercel `Preview`와 `Production`에서 `topik-prod`(`eymlabowhfgtxbiqwxqh`)로 고정한다.
- 브라우저 연결값은 `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`, `VITE_SUPABASE_DISABLED`를 사용한다. `VITE_*`에는 service-role/secret 키를 넣지 않는다.
- 서버 함수 연결값은 `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_PROJECT_REF`, 필요 시 `SUPABASE_MANAGEMENT_API_TOKEN`을 사용한다. 배포 환경에서는 dev 기본값이나 브라우저용 alias에 기대지 않고 대상별 canonical 변수로 명시한다.
- 로컬 `.env.local`은 `topik-dev`를 유지한다. Vercel 환경값 변경은 기존 배포에 소급되지 않으므로 변경 뒤 새 배포가 필요하다.
- 2026-07-16 Vercel 프로젝트 환경 레코드의 대상 매핑을 위 계약으로 정리하고 최신 소스를 Production alias `https://topik-ai.vercel.app`에 배포했다. 현재 bundle은 `admin_get_self` 인증과 Supabase 쿠폰 source를 사용하며, 브라우저에서 `topik-prod`의 `commerce_coupon_subscription_templates` 요청 `200`을 확인했다.
- 같은 날 운영 DB 컷오버를 완료했다. `topik-prod`는 admin canonical tracker 83개, TOPIK 쓰기 tracker 32개가 적용됐고, 공급 `updated_at` 전제조건 미충족인 writing migration 1개는 manifest에서 차단했다(해당 차단은 2026-08-24 공급 `updated_at` 채움 확정으로 해제·적용 완료). `topik-dev`는 admin canonical 83개와 superseded remote-only 이력 1개, writing 32개를 유지한다.
- 후속 실발송 검증에서 브라우저 번들과 운영 DB는 `topik-prod`로 일치하지만, 배포된 서버 함수 3개가 같은 운영 관리자 JWT를 `invalid_session`으로 거부했다. 따라서 Vercel의 canonical 서버 전용 `SUPABASE_URL`/`SUPABASE_SERVICE_ROLE_KEY` 조합은 아직 운영 프로젝트와 일치한다고 볼 수 없으며, 환경값 교정 뒤 새 배포와 인증 smoke가 필요하다.
- Vercel의 `Ready` 상태는 빌드와 배포 alias가 사용 가능하다는 뜻이지, 서버 함수의 Supabase/SMTP 런타임 통합 검증을 포함하지 않는다.
- 현재 설정된 관리자 계정은 `admin_accounts`의 active `platform_admin`이며 최종 `profiles.app_role`은 `learner`다. 인증 SoT는 `admin_get_self`/`admin_accounts`이고 bootstrap 감사 로그를 남긴다.
- Production URL에서 현재 관리자 로그인과 `CommerceCouponTemplate` 생성·상세·수정·삭제·감사 로그 브라우저 E2E 1/1을 통과했다. 테스트 업무 행은 삭제 후 0건이고, 저장 감사 2건·삭제 감사 1건과 삭제 사유를 DB에서 대사했다. 비인증 server function smoke도 API 3개 `POST`와 알림 워커 `GET` 모두 `401`을 반환한다.
## 12. System 백업 관리 데이터 소스 (2026-07-20)

- 실제 자동 백업 대상은 `topik-prod`의 데이터베이스와 전체 파일 저장소뿐입니다. `topik-dev` 자체는 백업하지 않습니다.
- 대시보드 백업 카드와 `/system/backups`의 source는 `admin_backup_runs`, `admin_backup_component_results`, `admin_restore_drills`입니다. 운영 배포는 `topik-prod`의 원본 보고를 읽고, localhost는 `topik-dev`에 독립 저장된 같은 보고의 복사본을 읽습니다.
- 브라우저는 `get_admin_backup_summary`와 `get_admin_backup_runs` 읽기 RPC만 사용합니다. localhost에서 복사본을 읽을 때는 화면에 개발환경 복사본임을 표시하고 `admin_backup_report_events.received_at` 기준 마지막 복사 시각을 함께 보여줍니다.
- mock은 명시적으로 선택했거나 Supabase가 비활성인 검사 환경에서만 사용합니다. localhost에 정상적인 `topik-dev` 연결이 있으면 복사본을 읽습니다.
- 온프레미스 보고는 `POST /api/backups/report`로 같은 본문을 운영 원본과 개발 복사본에 각각 전송합니다. 각 전송은 서로 다른 공유 비밀값과 전송 대상이 포함된 서명을 사용하며, Vercel 서버는 대상별로 고정된 Supabase 프로젝트만 호출합니다.
- 운영 원본 전송과 개발 복사본 전송의 대기열·재시도는 서로 독립적입니다. 개발 복사 실패가 실제 백업이나 운영 원본 기록을 실패로 바꾸지 않습니다.
- 보고 수신은 전송 시각·본문 크기·엄격 필드·상태 정합성을 확인한 뒤 서버 전용 `record_admin_backup_report` RPC를 호출합니다. 파일명·경로·회원 정보·비밀값은 어느 환경에도 전달하지 않습니다.
- 백업 카드 요청은 기존 대시보드 데이터와 별도로 수행하고 실패를 카드 단위로 격리합니다.
- `topik-dev`에는 `20260720150000`·`20260720150100`·`20260720150200`을 적용했고 관리자 요약·목록 조회 및 마지막 복사 시각 필드를 실제 호출로 확인했습니다. 아직 실제 보고가 없어 마지막 복사 시각이 비어 있는 것은 정상입니다.
- 2026-07-21 온프레미스 수동 백업·복원 점검과 예약 활성화는 먼저 완료됐고 보고는 outbox에 보존됩니다. 남은 연결 순서는 `topik-prod` admin migration 적용 → Vercel의 운영·개발 복사용 서버 연결 확인과 새 배포 → outbox flush → 두 저장 대상 반영 확인 → 24시간 연속 보고 확인입니다.
