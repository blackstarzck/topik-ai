# TOPIK AI Admin 데이터 소스 전환 가이드

## 1. 목적

- 이 문서는 관리자 프론트엔드의 더미 데이터, API, 데이터베이스 연결 전환 기준을 정의하는 단일 문서다.
- 목표는 더미 데이터를 한 파일에 몰아넣는 것이 아니라, 화면이 데이터 소스 구현 세부를 모르게 만들어 향후 API/DB 전환 비용을 줄이는 것이다.
- 적용 범위는 `Dashboard`, `Users`, `Community`, `Message`, `Operation`, `Commerce`, `Assessment`, `Content`, `Analytics`, `System` 전 모듈의 관리자 데이터 소스다.

## 2. 현재 상태 요약

### 2.1 이미 분리된 패턴

- `Users` 계열은 `mock-*` 파일과 `fetch*Safe` service가 분리되어 있다.
- `Users > 회원 목록/상세`은 v13 Supabase 연결 시 `get_admin_users` RPC를 1차 source로 사용하고, RPC가 `profiles.nickname`을 반환하지 않는 배포에서는 `profiles(id,nickname)` 보강 조회로 닉네임 컬럼을 병합한다. `display_name`은 회원명(`realName`) source이고 `nickname`은 닉네임 source이며, 둘 중 하나가 `NULL`이면 이메일/ID/local-part fallback을 만들지 않고 UI에서 `-`로 표시한다.
- `Community > 게시글 관리/신고 관리`는 `api/mock-community.ts`가 초기 seed/factory를 소유하고, `community-service.ts`가 목록 조회/게시·숨김·삭제/신고 처리 safe facade를 제공한다. 조치 후 live state는 `community-store.ts`에 남긴다.
- `System > 시스템 로그`는 `api/mock-system-logs.ts`와 `system-logs-service.ts`가 목록 source를 소유한다.
- `System > 감사 로그`는 `system-audit-logs-service.ts`가 static audit seed(`api/mock-system-audit-logs.ts`)와 permission/coupon/metadata store audit 병합 책임을 소유한다. 페이지는 merge 세부를 알지 않는다.
- `Message` 계열은 `api/mock-messages.ts`가 `initialGroups/templates/histories` seed/factory를 소유하고, `messages-service.ts`가 실제 렌더 source와 저장/발송/토글/삭제/재시도 action facade를 제공한다. 발송/재시도/그룹 변경 live state는 `message-store.ts`에 남긴다.
- `Message > 대상 그룹`은 세그먼트 옵션/기본값/Query Builder 필드 정의를 `src/features/message/model/message-group-segment-schema.ts`로 분리해 page-local 하드코딩을 줄였다.
- `Operation > 공지사항/FAQ/이벤트`는 기존 service/store 구조를 유지하되, 초기 seed/factory를 `api/mock-operation.ts`로 분리했다. `operation-store.ts`는 조치 후 live state만 담당한다.
- `Operation > 정책 관리`는 `policies-service.ts`를 통해 목록/상세/저장/게시 상태 변경/히스토리 조회/히스토리 버전 게시/삭제를 감싸고, 초기 정책/히스토리 seed는 `api/mock-operation-policies.ts`가 소유한다. 조치 후 정책 live state는 `policy-store.ts`에 남긴다. 정책 이력은 등록/수정/상태 변경/히스토리 버전 게시/삭제 5종 액션으로 기록하며, 각 이력 엔트리는 `snapshot: OperationPolicy`를 포함해 Drawer expandable row에서 해당 시점의 버전 스냅샷을 렌더한다. `OperationPolicy` 계약에는 `relatedAdminPages[]`, `relatedUserPages[]`, `sourceDocuments[]`가 함께 포함되며, `relatedUserPages[]`는 현재 운영상 추정 user surface를 기본값으로 채운다. 정책 등록 상세는 신규 등록, 현재 정책 내용 수정, 기존 정책 기준 새 버전 등록(`mode=version&sourcePolicyId`) 3개 editor mode를 사용한다. cross-page 정책 근거 매핑의 문서 SoT는 `docs/specs/admin-policy-source-map.md`에서 추적한다.
- `Operation > 이벤트 등록 상세`는 Message store를 직접 읽지 않고 `messages-service.ts`의 option DTO(`fetchMessageOptionSourcesSafe`)를 통해 대상 그룹/메시지 템플릿 선택지를 받는다.
- `Commerce > 쿠폰 관리`는 `coupons-service.ts`를 통해 쿠폰/정기 쿠폰 템플릿의 조회/저장/발행 중지/재개/삭제를 감싸고, 초기 seed/factory는 `api/mock-coupons.ts`가 소유한다. `coupon-store.ts`는 live state와 message option snapshot 기반 파생 표시만 담당한다.
- `Commerce > 포인트 관리`는 `api/mock-points.ts`가 정책/원장/소멸 예정 seed/factory를 소유하고, `points-service.ts`가 조회/수동 조정/정책 저장/소멸 보류 facade를 제공한다.
- `Billing > 결제 내역/환불 관리`는 실제 위치인 `src/features/billing`을 유지한다. 초기 결제/환불 seed는 `api/mock-billing.ts`, live state와 환불 승인/반려 write path는 `commerce-store.ts`, 페이지 facade는 `billing-service.ts`가 담당한다.
- `Assessment > TOPIK 쓰기 문제 검수`(`/assessment/question-bank`)와 `Assessment > TOPIK 쓰기 문항 관리`(`/assessment/question-bank/manage`)는 `assessment-question-bank-service.ts`를 통해 Supabase `problems` 테이블의 목록/단건 조회와 `admin_update_problem` RPC 기반 검수 상태 변경만 감싼다. 두 형제 페이지는 동일한 `problems` 조회 결과를 공유 hook으로 공유한다. JSON fixture/store fallback은 사용하지 않으며, Supabase가 설정되지 않았거나 조회가 실패하면 화면의 error/retry 상태로 노출한다. 정적 정책값과 query metadata는 `assessment-question-bank-schema.ts`에 유지한다.

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
- 이벤트 배너 이미지는 현재 mock 기준으로 정렬 가능한 `bannerImages[]`를 SoT로 사용하고, 첫 번째 이미지를 대표 배너로 보고 `bannerImageUrl`, `bannerImageFileName`, `ogImageUrl`를 파생한다.
- DB/API 단계에서는 단일 URL 필드가 아니라 정렬 가능한 asset list 또는 `bannerAssetIds[]`를 기준 계약으로 전환한다.

### 4.3 shared 계층

- shared에는 공통 엔티티 포맷터, 날짜 생성 규칙, 테스트용 factory만 둔다.
- shared가 feature 도메인 레코드 전체를 소유하지 않는다.

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
    - `src/features/assessment/api/supabase-assessment-question-bank-service.ts`
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

- 대상 정책: `POL-017`(재정의 — "TOPIK 쓰기 문항 수신·관리 운영정책", `docs/specs/admin-policy-source-map.md`). 운영 흐름은 `수신(외부 공급 API) -> 적재(Supabase) -> 관리 포인트(태그) + 노출 통제(service_status) -> v13 read-only 소비`로 고정한다.
- 데이터 방향 (인바운드)
  - **문제 발원 = 외부(공급) API.** 문제 본문·정답·메타데이터(`docs/metadata-tag-schema-rule.md` §4 메타데이터 + §7 테이블 스키마, §7.9 제외·검수 필드 제외)가 **완성 상태로** 공급된다. admin은 문제를 저작·생성·분류·검수하지 않는다.
  - **외부 공급 API는 미개발 상태**다. 공급 계약은 `docs/requests/upstream-writing-endpoints-request-2026-06-10.md`(2026-06-11 인바운드 기준 재작성)로 요청하며, 수신 연동 구현은 계약 회신 게이트에 종속된다.
  - admin은 수신분을 Supabase `topik_writing_51/52/53/54_questions` + `question_source_map`에 적재하고(idempotent), **관리 포인트(태그 — schema-rule §2)**와 **노출 통제(`service_status` — D-6)**를 부여한다.
  - v13 사용자 기능은 admin이 적재·관리한 데이터를 **read-only**로 소비한다. 관리자 프론트엔드가 직접 사용자 화면 데이터를 서빙하지 않는다.
- 검수 개념 삭제 (결정 기록 §0-3)
  - `review_status`/`review_workflow_status`(편차 E1 철회)/`review_passed`/`validation_result`와 검수 화면·검수 쓰기·검수 감사 액션은 admin에서 제거한다. 컬럼 물리 제거는 재정의 P3 마이그레이션. 문제 품질·상태 표현은 태그(관리 포인트)로만 한다.
  - 검수 페이지·검수 쓰기 경로는 재정의 P3 구현에서 제거 완료됐다(`202f905` — §10.2는 역사 기록). 검수 4컬럼 물리 제거도 마이그레이션 `0013`으로 완료됐다(2026-06-11 적용 — 스냅샷 4테이블 검수 컬럼 0건·뷰 16컬럼·RPC 검수 참조 0건).
- 인터림 상태 (외부 API 미개발 동안)
  - P2 백필 466행 = **초기 코퍼스**(유효 저장 데이터, 전 행 `service_status='internal_test'`). 신규 공급은 API 가동 후 수신 경로로만 받는다.
  - `problems`는 v13 사용자 기능이 읽는 동안 보존한다(일몰 조건은 결정 기록 §2.3 — "검수 SoT" 위상은 소멸, 레거시 원천).
  - **`problems` read-only 동결 선언(2026-06-11, §7.1-6 이행)**: P3 컷오버 완료에 따라 `problems`는 admin 기준 read-only 레거시로 동결됐다(신규 admin write 금지 — 코드상 write 경로는 원래 부재, 선언·기록만). 공지 초안: `docs/requests/problems-read-only-freeze-notice-2026-06-11.md`(발신은 오너 채널). 구 읽기 어댑터는 env `VITE_QUESTION_BANK_SOURCE=legacy` 봉인으로 P4 종료까지 보존(롤백 경로, 실행계획안 §12.2).
- 전환 메모
  - **운영 write 경계(P4 개방 완료 — 2026-06-11, 태그 별도 입력 제거 — 2026-06-12)**: 관리 포인트 write는 `/assessment/question-bank/manage` 단일 화면에서 RPC 단일 경로로만 수행한다 — 노출 통제 `admin_update_topik_question`(화이트리스트 `service_status` 단일, 사유 `__note`) + 태그 `admin_assign_question_tag`/`admin_remove_question_tag`(별도 메모 인자 없음). `OPERATION_WRITE_ENABLED`/`SERVICE_STATUS_WRITE_ENABLED` 게이트는 제거됐고, 직접 테이블 write는 RLS(쓰기 정책 0건)로 전면 차단된다(P4-4 네거티브 검증). legacy 롤백 소스는 읽기 전용(조치 불가 — facade 명시 오류). POL-018 ②③ 화면 가드 포함. 증적: `logs/metadata-tag-schema-transition-evidence.md` P4 절.
  - 수신·적재 시 `question_source_map`에 공급측 식별자를 보존해 재수신(idempotent)·역추적을 보장한다. `published_task_id` 컬럼은 구 push 모델 잔재로 용도 재검토 예정.
  - 수신 감사: 공급 연동 구현 시 `question_received` 감사 액션을 추가한다(결정 기록 D-8 개정).
  - **마스터 surface(P5-1 조회 + P5-3 토글 — 2026-06-11)**: 주제/태그 마스터(`topik_writing_topic_master`/`topik_writing_tag_master`)를 `/system/metadata`의 `TOPIK 쓰기 마스터 데이터` 섹션에서 전수(비활성 포함) 조회한다. source 경계는 facade `assessment-question-bank-service.ts`의 카탈로그 로더(`fetchQuestionBankTopicMasterCatalogSafe`/`fetchQuestionBankTagMasterCatalogSafe`, mock/topik_writing/legacy 분기 — legacy는 빈 배열)이며, 섹션 컴포넌트는 `src/features/assessment/ui/master-catalog-section.tsx`(시스템 페이지가 마운트)다. **유일한 write = tag_master 활성/비활성 토글(P5-3)**: facade `updateTagMasterStatusSafe` → RPC `admin_update_tag_master_status`(0014 — platform_admin 가드·사유 필수, 감사 `tag_master_status_changed`/`AssessmentTagMaster`). 주제 마스터·마스터 값 편집은 조회 전용 유지, 직접 테이블 write는 RLS 차단.

## 10.4 메타데이터·태그 스키마 전환 (권장안 v0.8 — 2026-06-10 채택 확정, Phase 0 결정 완료)

- 대상 문서: `docs/metadata-tag-schema-rule.md`(콘텐츠팀 권장 스키마, v0.8). 영향도 분석: `docs/메타데이터-태그-스키마-전환-영향도-보고서.md`. 실행 SoT: `docs/메타데이터-태그-스키마-전환-실행계획안.md`(P0~P6 단계·PASS 채점 게이트).
- 상태: **2026-06-10 프로젝트 오너 지시로 v0.8 채택·전면 전환 착수가 확정됐고, Phase 0 결정 13건(D-1~D-13)이 전부 확정됐다.** 확정값·근거·실측 증거는 `docs/architecture/metadata-tag-schema-transition-decision-record.md`(이하 결정 기록)가 SoT다. 구 "미채택/코드 결선 금지" freeze 가드는 해제됐으며, 이후 착수 통제는 실행 계획안 §12.3 페이즈 채점(직전 페이즈 PASS 시에만 비가역 실행)을 따른다.
- 세 데이터 모델 관계 (2026-06-11 인바운드 전환 개정)
  - ⓐ 신규 스키마: 번호별 4분리 테이블(`topik_writing_51/52/53/54_questions`) + 태그/주제 마스터 + 추천 검색용 읽기전용 UNION 뷰 + 식별자 매핑 테이블 `topik_writing_question_source_map`(편차 E2) — **admin 문항·운영 SoT(수신·태그·노출)**
  - ⓑ 레거시 원천: v13 `problems` — 인터림 코퍼스의 백필 원천(역사), 컷오버 후 read-only 레거시 동결(일몰 조건은 결정 기록 §2.3 — "검수 SoT" 위상은 2026-06-11 §0으로 소멸)
  - ⓒ 외부(공급) API: **문제 발원 주체 — 미개발**(§10.3, POL-017 재정의, D-11 공급 계약 요청 추적). 종전 "상류 노출본(push 대상)" 위상은 폐기
- 소유권·호스트 확정 (D-1)
  - 신규 오브젝트는 현행 v13 Supabase 프로젝트 `fglggyfvzjdsbyckinqa`(talkpik-dev)에 생성하고, 마이그레이션 자산(`supabase/migrations`)은 이 repo(topik-ai)가 소유·관리한다(시나리오 B의 공유 호스트 변형).
  - 경계 근거: v13 오너 결정(2026-06-09, v13 repo `supabase/migrations/20260609130000_remove_v13_admin_island.sql`) — "문제 데이터의 작성·노출 통제는 admin(topik-ai)이 담당, v13은 read-only". 공유 자산(`admin_audit_logs`, `private.is_*_admin` 헬퍼, `profiles.app_role`)은 재사용하고, 기존 v13 테이블 DDL 변경은 0건 원칙(P1 무변경 diff 게이트로 증명).
  - v13 측 스테이징/브랜치 DB 없음(실측 — Management API branches 0건). additive 마이그레이션 + down 스크립트 + 적용 직후 무변경 diff + RT-1 파일럿 적재 왕복으로 검증을 대체한다.
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
