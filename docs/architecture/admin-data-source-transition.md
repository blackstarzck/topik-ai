# TOPIK AI Admin 데이터 소스 전환 가이드

## 1. 목적

- 이 문서는 관리자 프론트엔드의 더미 데이터, API, 데이터베이스 연결 전환 기준을 정의하는 단일 문서다.
- 목표는 더미 데이터를 한 파일에 몰아넣는 것이 아니라, 화면이 데이터 소스 구현 세부를 모르게 만들어 향후 API/DB 전환 비용을 줄이는 것이다.
- 적용 범위는 `Dashboard`, `Users`, `Community`, `Message`, `Operation`, `Commerce`, `Assessment`, `Content`, `Analytics`, `System` 전 모듈의 관리자 데이터 소스다.

## 2. 현재 상태 요약

### 2.1 이미 분리된 패턴

- `Users` 계열은 `mock-*` 파일과 `fetch*Safe` service가 분리되어 있다.
- `Users > 회원 목록/상세`은 v13 Supabase 연결 시 `get_admin_users` RPC를 1차 source로 사용하고, RPC가 `profiles.nickname`을 반환하지 않는 배포에서는 `profiles(id,nickname)` 보강 조회로 닉네임 컬럼을 병합한다. `display_name`은 회원명(`realName`) source이고 `nickname`은 닉네임 source이며, 둘 중 하나가 `NULL`이면 이메일/ID/local-part fallback을 만들지 않고 UI에서 `-`로 표시한다.
- `Message` 계열은 service가 존재하지만 내부적으로 store와 다른 feature mock을 직접 참조한다.
- `Message > 대상 그룹`은 세그먼트 옵션/기본값/Query Builder 필드 정의를 `src/features/message/model/message-group-segment-schema.ts`로 분리해 page-local 하드코딩을 줄였다.
- `Operation > 공지사항`은 `notices-service.ts`를 통해 조회/상세/저장/게시 상태 변경/삭제를 감싸고, mock SoT는 `Zustand` store에 유지한다.
- `Operation > FAQ`는 `faqs-service.ts`를 통해 FAQ 원문/대표 노출/지표 조회와 FAQ 저장/공개 상태 변경/삭제, 대표 노출 저장/삭제를 감싸고, mock SoT는 `operation-store.ts`와 `faq-schema.ts`에 유지한다.
- `Operation > 정책 관리`는 `policies-service.ts`를 통해 목록/상세/저장/게시 상태 변경/히스토리 조회/히스토리 버전 게시/삭제를 감싸고, `policy-store.ts`에 법률/약관 문서와 운영 정책 레지스트리, `OperationPolicyHistoryEntry[]` mock SoT를 함께 유지한다. 정책 이력은 등록/수정/상태 변경/히스토리 버전 게시/삭제 5종 액션으로 기록하며, 각 이력 엔트리는 `snapshot: OperationPolicy`를 포함해 Drawer expandable row에서 해당 시점의 버전 스냅샷을 렌더한다. `OperationPolicy` 계약에는 `relatedAdminPages[]`, `relatedUserPages[]`, `sourceDocuments[]`가 함께 포함되며, `relatedUserPages[]`는 현재 운영상 추정 user surface를 기본값으로 채운다. 정책 등록 상세는 신규 등록, 현재 정책 내용 수정, 기존 정책 기준 새 버전 등록(`mode=version&sourcePolicyId`) 3개 editor mode를 사용한다. cross-page 정책 근거 매핑의 문서 SoT는 `docs/specs/admin-policy-source-map.md`에서 추적한다.
- `Operation > 이벤트`는 `events-service.ts`를 통해 조회/상세/저장/게시 예약/즉시 게시/종료를 감싸고, `bodyHtml`을 포함한 이벤트 원본 콘텐츠의 mock SoT는 `operation-store.ts`의 `events` 컬렉션에 유지한다.
- `Operation > 이벤트 등록 상세`는 현재 `MessageGroup`, `MessageTemplate`, 이벤트 보상 정책 schema를 참조하는 선택형 입력을 사용한다. 다만 message store/schema를 직접 읽는 mock 단계이므로, DB/API 단계에서는 이벤트 전용 service 응답 뒤로 숨기는 구조로 전환해야 한다.
- `Commerce > 쿠폰 관리`는 `coupons-service.ts`를 통해 쿠폰/정기 쿠폰 템플릿의 조회/저장/발행 중지/재개/삭제를 감싸고, mock SoT는 `coupon-store.ts`, 정적 정책값은 `coupon-form-schema.ts`와 `coupon-template-form-schema.ts`에 유지한다.
- `Assessment > TOPIK 쓰기 문제 검수`(`/assessment/question-bank`)와 `Assessment > TOPIK 쓰기 문항 관리`(`/assessment/question-bank/manage`)는 `assessment-question-bank-service.ts`를 통해 Supabase `problems` 테이블의 목록/단건 조회와 `admin_update_problem` RPC 기반 검수 상태 변경만 감싼다. 두 형제 페이지는 동일한 `problems` 조회 결과를 공유 hook으로 공유한다. JSON fixture/store fallback은 사용하지 않으며, Supabase가 설정되지 않았거나 조회가 실패하면 화면의 error/retry 상태로 노출한다. 정적 정책값과 query metadata는 `assessment-question-bank-schema.ts`에 유지한다.

### 2.2 아직 페이지 내부에 남아 있는 패턴

- `Community > 게시글 관리`, `Community > 신고 관리`
- `Notification > 발송 이력`
- `Users > 회원 상세` 탭 파생 데이터

### 2.3 store seed에 묶여 있는 패턴

- `Commerce` 결제/환불/쿠폰 초기 데이터
- `System` 관리자 권한/감사 로그 초기 데이터

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

- page는 `fetch*Safe`, `get*ById`, `create*`, `update*`, `delete*` 같은 service 함수만 사용한다.
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

### 5.1 1순위

- `Community`: 게시글/신고의 page-local `initialRows`
- `Notification`: 발송 이력 page-local `rows`

### 5.2 2순위

- `Users > 회원 상세`: 탭별 파생 더미 데이터를 service/helper로 이동
- `System > 감사 로그`: static rows와 store audit merge 구조를 service 뒤로 숨김

### 5.3 3순위

- `Commerce`: store 내부 `initialPayments`, `initialRefunds`, `initialCoupons`, `initialSubscriptionTemplates` 분리
- `System`: store 내부 `initialAdmins`, `initialAudits` 분리
- `Message`: `mockUsers` 직접 참조를 도메인 helper 또는 service로 치환

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

- 대상 화면: `Assessment > TOPIK 쓰기 문제 검수`(`/assessment/question-bank`), `Assessment > TOPIK 쓰기 문항 관리`(`/assessment/question-bank/manage`)
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

## 10.3 2026-06-09 검수 완료 문항 배포(업로드) 전환 메모 (POL-017)

- 대상 정책: `POL-017` (`docs/specs/admin-policy-source-map.md`). 운영 흐름은 `검수(관리자) -> 배포(API 업로드) -> 노출 통제(관리자 /manage)`로 고정한다.
- 상류 API 원문: `docs/specs/topik-ai-service-api-reference.md`(Swagger `http://58.236.187.135:9009/docs#/`의 Writing 파트). 사용자 노출 데이터 모델은 이 문서를 단일 SoT로 사용한다.
- 데이터 방향
  - 관리자 `problems`(Supabase, v13, question_no 51-54)는 **검수 원본 SoT**다.
  - `검수 완료` 문항은 관리자에서 상류 `TalkPik AI Service`로 **API 업로드(push, 단방향)**되어 사용자 노출용 작문 과제로 등록된다. 즉 과거 "후속 내보내기/배포(파일 스키마)"는 폐기하고, 상류 서비스로의 API 업로드로 확정한다.
  - 사용자 노출은 상류 Writing API(`GET /api/writing/tasks`, `GET /api/writing/tasks/{task_type}`)가 담당하며, 관리자 프론트엔드가 직접 사용자 화면 데이터를 서빙하지 않는다.
- 사용자 노출 작문 과제 모델(Writing API `GenerateProblemResponse`)과 관리자 화면 모델 매핑 후보
  - `task_type` ← `problems.question_no`(51/52/53/54 → 캠페인 `Q51..Q54` / 연습 `task51`,`task53`,`task54`)
  - `title` ← `problems.title`
  - `instruction` ← `problems.prompt`
  - `topic` ← `problems.topic_category_code`(코드 라벨)
  - `difficulty` ← `problems.difficulty`(숫자 → `easy/medium/hard` 구간)
  - `max_score` ← 문제 번호 규칙(Q51/Q52=10, Q53=30, Q54=50) 파생
- 상류 API/DB 전환 후보(신설/확정 필요)
  - 검수 완료 문항 업로드/upsert 엔드포인트: 현재 상류 스냅샷에 관리자용 작문 과제 생성 엔드포인트가 없어 신설 또는 확정이 필요한 후보다.
  - 사용자 노출 토글(노출/숨김)을 상류에 반영하는 엔드포인트: `/manage` 운영 상태와 연동할 후보다.
- 전환 메모
  - 배포 실행 트리거(`검수 완료` 시 자동 업로드 vs 별도 `배포` 액션)는 후속 구현에서 확정한다. 별도 액션으로 둘 경우 `Target Type = AssessmentQuestion`, `Target ID = questionId` 감사 계약을 따른다(`docs/specs/admin-action-log.md`).
  - 노출/숨김(운영 상태) write 활성화 경로는 2026-06-10 D-6 확정으로 변경됐다: v13 `lifecycle_status` 종속은 폐기되고, 신규 스키마 `service_status` 컬럼 기반으로 P4에서 `OPERATION_WRITE_ENABLED` 게이트를 제거하며 개방한다(§10.4, 결정 기록 D-6).
  - `problems`(검수 원본)와 상류 작문 과제(사용자 노출본)는 서로 다른 저장소이므로, 업로드 시 양쪽 식별자 매핑(예: `publishedTaskId` 후보)을 유지해 재배포/역추적이 가능해야 한다.

## 10.4 메타데이터·태그 스키마 전환 (권장안 v0.8 — 2026-06-10 채택 확정, Phase 0 결정 완료)

- 대상 문서: `docs/metadata-tag-schema-rule.md`(콘텐츠팀 권장 스키마, v0.8). 영향도 분석: `docs/메타데이터-태그-스키마-전환-영향도-보고서.md`. 실행 SoT: `docs/메타데이터-태그-스키마-전환-실행계획안.md`(P0~P6 단계·PASS 채점 게이트).
- 상태: **2026-06-10 프로젝트 오너 지시로 v0.8 채택·전면 전환 착수가 확정됐고, Phase 0 결정 13건(D-1~D-13)이 전부 확정됐다.** 확정값·근거·실측 증거는 `docs/architecture/metadata-tag-schema-transition-decision-record.md`(이하 결정 기록)가 SoT다. 구 "미채택/코드 결선 금지" freeze 가드는 해제됐으며, 이후 착수 통제는 실행 계획안 §12.3 페이즈 채점(직전 페이즈 PASS 시에만 비가역 실행)을 따른다.
- 세 데이터 모델 관계 (유지)
  - ⓐ 신규 스키마: 번호별 4분리 테이블(`topik_writing_51/52/53/54_questions`) + 태그/주제 마스터 + 추천 검색용 읽기전용 UNION 뷰 + 식별자 매핑 테이블 `topik_writing_question_source_map`(편차 E2)
  - ⓑ 구 검수 원본: v13 `problems` — P3 컷오버까지 검수 SoT, 컷오버 후 read-only 레거시 동결(일몰 조건은 결정 기록 §2.3)
  - ⓒ 사용자 노출본: 상류 TalkPik Writing API(§10.3, POL-017) — P6 게이트(D-11 요청서 발신 추적)
- 소유권·호스트 확정 (D-1)
  - 신규 오브젝트는 현행 v13 Supabase 프로젝트 `fglggyfvzjdsbyckinqa`(talkpik-dev)에 생성하고, 마이그레이션 자산(`supabase/migrations`)은 이 repo(topik-ai)가 소유·관리한다(시나리오 B의 공유 호스트 변형).
  - 경계 근거: v13 오너 결정(2026-06-09, v13 repo `supabase/migrations/20260609130000_remove_v13_admin_island.sql`) — "문제 데이터의 작성·노출 통제는 admin(topik-ai)이 담당, v13은 read-only". 공유 자산(`admin_audit_logs`, `private.is_*_admin` 헬퍼, `profiles.app_role`)은 재사용하고, 기존 v13 테이블 DDL 변경은 0건 원칙(P1 무변경 diff 게이트로 증명).
  - v13 측 스테이징/브랜치 DB 없음(실측 — Management API branches 0건). additive 마이그레이션 + down 스크립트 + 적용 직후 무변경 diff + RT-1 파일럿 적재 왕복으로 검증을 대체한다.
- 마이그레이션 적용 절차 (P1 확정·적용 완료 2026-06-10)
  - 마이그레이션 작성 → 오너 승인(v13 오너=admin 오너 동일인, 단일 승인) → 프로덕션 적용 → §5.4 게이트(8오브젝트 스모크 + RLS 역할 매트릭스 + 뷰 anon 차단 네거티브 테스트 + 기존 테이블 무변경 diff + RT-1).
  - 적용 수단: 이 머신에 supabase CLI 인증/DB 패스워드가 없어 CLI `db push` 대신 **Supabase Management API**(`/v1/projects/{ref}/database/query`)를 표준 적용 경로로 사용한다. 도구: `npm run db:migrate`(`scripts/db/migrate.mjs`, 적용 이력은 자체 네임스페이스 추적 테이블 `topik_writing_schema_migrations`에 기록), `npm run db:migrate:status`, 롤백 `node scripts/db/migrate.mjs --down <파일명>`(`supabase/migrations/down/` 스크립트).
  - 무변경 증명: `npm run db:snapshot`(`scripts/db/schema-snapshot.mjs`)으로 적용 전/후 스키마 표면(테이블 컬럼/함수/정책/뷰)을 스냅샷하고 `--diff --exclude-own`으로 자기 네임스페이스 제외 diff 0건을 확인한다.
  - 적용 기록(2026-06-10): 마이그레이션 12파일 전부 적용 완료, 자기 네임스페이스 제외 diff 0건, RLS 매트릭스(anon/비admin 0행·admin 허용)·RT-1 파일럿 4경로 왕복 일치 — 증적은 `logs/metadata-tag-schema-transition-evidence.md` P1 절.
- 가드레일 (갱신)
  - 신규 식별자의 코드 결선은 실행 계획안 §12.3 채점 규칙을 따른다: 가역적 선행 개발(스크립트·코드·문서 초안)은 허용, 비가역 실행(프로덕션 DDL 적용·실데이터 적재·컷오버 배포·write 개방·상류 호출)은 직전 페이즈 PASS 후에만 한다.
  - `service_status`(`available`/`excluded`/`internal_test`)가 유일한 물리 노출 상태다(D-6). '서비스_노출상태' 태그 그룹은 시드에서 제외하고 RPC에서 부여를 차단한다. `operationStatus` 4값 union은 P3에서 제거한다. v13 `lifecycle_status` 종속은 해소됐다(신규 스키마가 자체 노출 컬럼 보유).
  - 검수 상태는 ASCII enum 저장 + admin 한국어 라벨 매핑의 2축(`review_status` 3값 + `review_workflow_status` 5값, 편차 E1)으로 확정(D-2).
  - 채택 계약·식별자 매핑·편차 목록(E1~E4)은 `docs/specs/admin-data-contract.md` §12에서 추적한다.
