# TOPIK AI Admin 데이터 소스 전환 가이드

## 1. 목적

- 이 문서는 관리자 프론트엔드의 더미 데이터, API, 데이터베이스 연결 전환 기준을 정의하는 단일 문서다.
- 목표는 더미 데이터를 한 파일에 몰아넣는 것이 아니라, 화면이 데이터 소스 구현 세부를 모르게 만들어 향후 API/DB 전환 비용을 줄이는 것이다.
- 적용 범위는 `Dashboard`, `Users`, `Community`, `Message`, `Operation`, `Commerce`, `Assessment`, `Content`, `Analytics`, `System` 전 모듈의 관리자 데이터 소스다.

## 2. 현재 상태 요약

### 2.1 이미 분리된 패턴

- `Users` 계열은 `mock-*` 파일과 `fetch*Safe` service가 분리되어 있다.
- `Message` 계열은 service가 존재하지만 내부적으로 store와 다른 feature mock을 직접 참조한다.
- `Message > 대상 그룹`은 세그먼트 옵션/기본값/Query Builder 필드 정의를 `src/features/message/model/message-group-segment-schema.ts`로 분리해 page-local 하드코딩을 줄였다.
- `Operation > 공지사항`은 `notices-service.ts`를 통해 조회/상세/저장/게시 상태 변경/삭제를 감싸고, mock SoT는 `Zustand` store에 유지한다.
- `Operation > FAQ`는 `faqs-service.ts`를 통해 FAQ 원문/대표 노출/지표 조회와 FAQ 저장/공개 상태 변경/삭제, 대표 노출 저장/삭제를 감싸고, mock SoT는 `operation-store.ts`와 `faq-schema.ts`에 유지한다.
- `Operation > 정책 관리`는 `policies-service.ts`를 통해 목록/상세/저장/게시 상태 변경/히스토리 조회/히스토리 버전 게시/삭제를 감싸고, `policy-store.ts`에 법률/약관 문서와 운영 정책 레지스트리, `OperationPolicyHistoryEntry[]` mock SoT를 함께 유지한다. 정책 이력은 등록/수정/상태 변경/히스토리 버전 게시/삭제 5종 액션으로 기록하며, 각 이력 엔트리는 `snapshot: OperationPolicy`를 포함해 Drawer expandable row에서 해당 시점의 버전 스냅샷을 렌더한다. `OperationPolicy` 계약에는 `relatedAdminPages[]`, `relatedUserPages[]`, `sourceDocuments[]`가 함께 포함되며, `relatedUserPages[]`는 현재 운영상 추정 user surface를 기본값으로 채운다. 정책 등록 상세는 신규 등록, 현재 정책 내용 수정, 기존 정책 기준 새 버전 등록(`mode=version&sourcePolicyId`) 3개 editor mode를 사용한다. cross-page 정책 근거 매핑의 문서 SoT는 `docs/specs/admin-policy-source-map.md`에서 추적한다.
- `Operation > 이벤트`는 `events-service.ts`를 통해 조회/상세/저장/게시 예약/즉시 게시/종료를 감싸고, `bodyHtml`을 포함한 이벤트 원본 콘텐츠의 mock SoT는 `operation-store.ts`의 `events` 컬렉션에 유지한다.
- `Operation > 이벤트 등록 상세`는 현재 `MessageGroup`, `MessageTemplate`, 이벤트 보상 정책 schema를 참조하는 선택형 입력을 사용한다. 다만 message store/schema를 직접 읽는 mock 단계이므로, DB/API 단계에서는 이벤트 전용 service 응답 뒤로 숨기는 구조로 전환해야 한다.
- `Commerce > 쿠폰 관리`는 `coupons-service.ts`를 통해 쿠폰/정기 쿠폰 템플릿의 조회/저장/발행 중지/재개/삭제를 감싸고, mock SoT는 `coupon-store.ts`, 정적 정책값은 `coupon-form-schema.ts`와 `coupon-template-form-schema.ts`에 유지한다.

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
- 통신/상태/재시도/fail-safe 기준이 바뀌면 `docs/architecture/admin-dev-stack.md`와 `docs/guidelines/admin-coding-guidelines-antigravity.md`도 함께 평가한다.

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
