# TOPIK AI Admin 프론트엔드 아키텍처 (Frontend Architecture)

## 문서 계약

- 고정 8개 모듈: Dashboard, Users, Community, Notification, Operation, Billing, Analytics, System
- 메뉴명은 `Users`(복수형)로 표기하며, `User` 단수형 사용을 금지합니다. (참조: `docs/architecture/admin-information-architecture.md:63`)
- 감사 로그 용어는 `감사 로그`로 통일합니다. (참조: `docs/architecture/admin-information-architecture.md:64`, `docs/specs/admin-action-log.md:4`)
- `시스템 로그`는 기술 로그로 감사 로그와 구분합니다. (참조: `docs/architecture/admin-information-architecture.md:65`)
- Users 상세 탭 고정: `프로필`, `활동`, `결제`, `커뮤니티`, `로그`, `관리자 메모` (참조: `docs/architecture/admin-information-architecture.md:66`)
- 금지 범위 및 용어: `Learning`, `Content/Course` (참조: `docs/architecture/admin-information-architecture.md:67`)

## 근거 문서

- `docs/architecture/admin-information-architecture.md`
- `docs/specs/admin-page-analysis.md`
- `docs/specs/admin-page-tables.md`
- `docs/specs/admin-user-detail-page-structure.md`
- `docs/specs/admin-action-log.md`

## 개요

이 문서는 **프론트엔드 한정** 아키텍처 blueprint를 정의합니다. 목표는 IA 기준 8개 모듈의 화면 구조를 일관되게 운영하고, 테이블 중심 업무 흐름(검색 -> 상세 -> 조치 -> 로그 확인)을 안정적으로 구현하는 것입니다.

- 범위 기준: 라우팅, 화면 모듈 경계, 상태 관리, API 호출 레이어, 공통 UI 패턴, 운영 추적(권한/로그), 성능/a11y
- 운영 흐름 귀결: Users/Community/Operation/Billing의 데이터 변경 액션은 `감사 로그`로 추적 가능해야 함
- 로그 분리 원칙: `감사 로그`는 관리자 조치 이력, `시스템 로그`는 기술 로그

## 설계 원칙

- IA 우선: 메뉴/라우트/컴포넌트 경계는 `docs/architecture/admin-information-architecture.md`의 8개 모듈을 1차 기준으로 삼음
- 기능 단위 모듈화: 화면 단위가 아니라 Feature 단위(목록/상세/조치/로그 연결)로 폴더와 책임을 분리
- 상태 책임 분리: `server-state`(원격 데이터 정합성)와 `UI-state`(상호작용 상태)를 분리해 결합도를 낮춤
- 추적 가능성 우선: 변경 액션은 화면 성공/실패와 무관하게 감사 로그 조회 경로를 제공
- 확장 가능성: 라이브러리 선택은 권장/검토 수준으로 두고, 특정 구현체를 필수 의존성으로 고정하지 않음

## 구조/라우팅

### IA 8모듈 라우팅/메뉴 매핑

| IA 모듈 | 라우트 예시 | 주요 페이지 |
| --- | --- | --- |
| Dashboard | `/dashboard` | 서비스 현황, Work Queue, Alerts |
| Users | `/users`, `/users/:userId` | 회원 목록, 회원 상세(6개 탭) |
| Community | `/community/posts`, `/community/reports` | 게시글 관리, 신고 관리 |
| Notification | `/notification/send`, `/notification/history` | 알림 발송, 발송 이력 |
| Operation | `/operation/notices`, `/operation/faq` | 공지사항, FAQ, 배너/이벤트 |
| Billing | `/billing/payments`, `/billing/refunds` | 결제 내역, 환불 관리 |
| Analytics | `/analytics/*` | 사용자/커뮤니티/알림/매출 통계 |
| System | `/system/admins`, `/system/permissions`, `/system/audit-logs`, `/system/logs` | 관리자 계정, 권한 관리, 감사 로그, 시스템 로그 |

### Users 상세 라우팅 고정 규칙

- `Users` 상세는 6개 탭 고정: `프로필`, `활동`, `결제`, `커뮤니티`, `로그`, `관리자 메모`
- 라우트는 탭 상태를 URL에 반영: `/users/:userId?tab=profile` 형태를 기본으로 권장
- 탭 간 이동 시 조회 파라미터를 유지해 운영자가 컨텍스트를 잃지 않도록 설계

### 폴더 구조 제안 (Feature 단위, blueprint)

```text
src/
  app/
    router/
      routes.tsx
      guards/
    providers/
      query-provider.tsx
      auth-provider.tsx
      notification-provider.tsx
  shared/
    api/
      client.ts
      error-mapper.ts
    ui/
      table/
      filter-bar/
      status-badge/
      confirm-action/
    lib/
      query-key-factory.ts
      permission.ts
      audit-log-link.ts
  features/
    dashboard/
      pages/
      widgets/
    users/
      pages/
      model/
      api/
      ui/
    community/
      pages/
      model/
      api/
      ui/
    notification/
      pages/
      model/
      api/
      ui/
    operation/
      pages/
      model/
      api/
      ui/
    billing/
      pages/
      model/
      api/
      ui/
    analytics/
      pages/
      api/
      ui/
    system/
      pages/
      model/
      api/
      ui/
```

## 데이터/상태

### 상태 분리 원칙 (`server-state` vs `UI-state`)

- `server-state`: 목록/상세 데이터, 필터 결과, 페이지네이션 메타, 권한 정책 스냅샷
- `UI-state`: 모달/드로어 열림, 선택 행, 임시 폼 입력, 활성 탭, 배치 액션 선택
- 동기화 기준: URL 쿼리 파라미터는 재현 가능한 운영 상태(page, pageSize, sort, filters, tab)를 우선 반영

### 테이블 중심 데이터 패턴

- 쿼리 파라미터 표준: `page`, `pageSize`, `sort`, `filters`, `keyword`, `dateFrom`, `dateTo`
- 캐시 키 전략: `[module, resource, queryParams]` 형태로 목록/상세/통계를 분리
- invalidation 원칙:
  - 상태 변경 액션(정지, 숨김, 삭제, 환불, 권한 변경) 성공 시 관련 목록/상세 캐시 invalidate
  - 범위 최소화: 전역 무효화 대신 영향 받은 리소스 키만 선택적으로 invalidate
  - 로그 연계: 변경 액션 후 `감사 로그` 관련 조회 키를 함께 갱신 후보에 포함

### API 레이어 경계

- `shared/api`: HTTP client, 공통 에러 매핑, 인증 만료 처리, 재시도 정책
- `features/*/api`: 모듈별 endpoint 조합, request/response DTO 변환, 화면 모델 매핑
- 페이지 레이어는 endpoint 세부사항을 직접 알지 않고 feature API만 호출

### 오류/알림/로딩 정책

- 로딩: 초기 로딩(페이지 스켈레톤)과 후속 로딩(테이블 inline spinner)을 구분
- 오류: 사용자 액션 실패는 토스트 + 행/폼 인접 오류 메시지 동시 제공
- 알림: 성공/실패 알림 문구는 액션 단위 템플릿화(예: 회원 정지 성공/실패)
- 복구: 네트워크 오류 시 재시도 버튼, 파라미터 보존, 마지막 성공 상태 fallback 제공

## 공통 컴포넌트/레이어

- `AdminDataTable`: 서버 정렬/필터/페이지네이션, 컬럼 설정, 가상 스크롤 옵션을 공통화
- `FilterBar`: 검색어/기간/상태 필터 조합과 URL 동기화 책임 분리
- `ActionConfirm`: 파괴적 액션(삭제/정지/환불) 확인 모달과 사유 입력 규칙 재사용
- `PermissionGate`: 권한 체크 후 버튼/액션/라우트 접근 제어
- `AuditLogLink`: 대상 ID 기준으로 `감사 로그` 화면으로 이동하는 공통 링크

## 운영(로그/권한)

### 권한 연계 포인트

- 라우트 레벨: 모듈 접근 권한 없음 -> 접근 차단 + 안내 화면
- 액션 레벨: 버튼 노출, 활성화 여부, 확인 모달 실행 권한을 분리
- 데이터 레벨: 권한 없는 컬럼/민감 필드는 마스킹 또는 미노출

### 감사 로그 연계 포인트

- 조치 화면(Users/Community/Operation/Billing)에서 성공 액션 직후 로그 조회 진입 경로 제공
- 액션 payload는 로그 추적 가능한 최소 식별자(`Target Type`, `Target ID`)를 유지
- 운영 기본 시나리오를 일관화: 검색 -> 상세 -> 조치 -> `감사 로그` 확인

## 비기능(성능/a11y)

### 성능 (테이블 중심)

- 대용량 목록은 virtual scrolling(`virtual` + `scroll.y`)을 검토하고, 행 높이/셀 렌더 비용을 함께 측정
- 테이블 요청은 server-side pagination/filter/sort를 기본값으로 유지
- 컬럼 렌더 함수는 순수 함수로 유지하고, 고비용 포맷팅은 사전 계산/메모화 적용
- 캐시 invalidation은 최소 단위로 제한해 불필요한 전체 리패치를 줄임

### 접근성 (a11y)

- 키보드만으로 검색 -> 행 선택 -> 상세 이동 -> 액션 확인 플로우를 완료 가능해야 함
- 테이블/필터/액션 버튼에 명확한 label을 제공하고 상태를 색상 외 텍스트로 병행 표시
- 모달/드로어는 포커스 트랩, ESC 닫기, 닫힘 후 포커스 복귀를 보장
- 로딩/오류/성공 상태는 스크린리더가 인지 가능한 텍스트로 노출

### 참고 레퍼런스 (cite-only)

- React: https://react.dev/learn/thinking-in-react
- React: https://react.dev/learn/scaling-up-with-reducer-and-context
- Ant Design Table Ajax: https://ant.design/components/table/#table-demo-ajax
- Ant Design Virtual Table: https://ant.design/docs/blog/virtual-table/

## 제외 범위

- 본 문서는 **프론트엔드 한정**이며 백엔드 비즈니스 로직, DB 스키마/인덱스, 배포 인프라 설계를 포함하지 않음
- 서버 토폴로지, 메시지 큐, 배치 워커, CI/CD 파이프라인, 클라우드 리소스 구성은 제외
- IA 제외 항목인 `Learning`, `Content/Course`는 본 아키텍처 설계 범위에 포함하지 않음

