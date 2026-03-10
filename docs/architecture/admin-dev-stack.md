# TOPIK AI Admin 개발 스택 (Dev Stack)

## 문서 계약

- 고정 8개 모듈: Dashboard, Users, Community, Message, Operation, Billing, Analytics, System
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

## 기술 선택 배경

TOPIK AI Admin은 운영 효율이 핵심인 B2B 관리자 도구이며, `docs/specs/admin-page-analysis.md`와 `docs/specs/admin-page-tables.md` 기준으로 다수의 목록/상세/조치 흐름을 빠르게 처리해야 합니다. 따라서 UI 일관성, 테이블 중심 생산성, 접근성 기본기, 확장 가능한 상태 모델을 우선으로 기술을 선정합니다.

## 프론트엔드 스택 (권장안)

- UI 프레임워크: `React` + `TypeScript`
- 디자인 시스템/컴포넌트: `Ant Design (AntD)`
- 빌드 도구: `Vite` 권장 (빠른 개발 서버/빌드 단순성 기준)
- 라우팅: `React Router` 권장 (중첩 라우트와 데이터 로딩 경계 분리에 유리)
- HTTP 클라이언트: `axios` (timeout/interceptor/에러 매핑 기반 fail-safe 표준화)

선정 근거는 React의 컴포넌트 분해/상향식 데이터 흐름 원칙, 프론트엔드 상태관리의 Zustand 단일 전략, AntD의 레이아웃/테이블 운영 생산성에 둡니다.

## 라우팅 및 화면 경계 원칙

- 라우트는 IA의 8개 모듈(`Dashboard`, `Users`, `Community`, `Message`, `Operation`, `Billing`, `Analytics`, `System`)을 1차 경계로 구성합니다.
- `Users` 표기는 복수형으로 고정하며, 상세 진입 시 탭은 `프로필`, `활동`, `결제`, `커뮤니티`, `로그`, `관리자 메모` 6개를 고정합니다.
- `System` 모듈의 로그는 `감사 로그`와 `시스템 로그`를 구분해 라우트/메뉴 명세에서 혼용하지 않습니다.
- 페이지 단위 코드 스플리팅은 모듈 경계 기준으로 적용하고, 상세 탭은 필요 시 지연 로딩합니다.

## 버전 정책

- 주요 의존성(`React`, `TypeScript`, `Ant Design`, 라우터, 상태/데이터 라이브러리)은 메이저 버전을 고정(pin)합니다.
- 마이너/패치는 호환성 검증 후 주기적으로 반영하되, 테이블/폼/레이아웃 회귀를 우선 점검합니다.
- 메이저 업그레이드는 문서 기준 용어/IA/테이블 상호작용(정렬/필터/페이지네이션) 영향 분석을 선행한 뒤 단계적으로 수행합니다.
- 버전 정책은 확정된 백엔드/인프라 전제를 요구하지 않으며, 프론트엔드 관점의 안정성 기준으로만 운영합니다.

## 상태 관리 전략

- 원칙: 서버 상태와 클라이언트 UI 상태를 분리합니다.
- 서버 상태(목록 데이터, 상세 조회, 필터 결과, 페이지네이션 메타)는 요청/캐시/동기화 책임이 있는 계층에서 관리합니다.
- 클라이언트 UI 상태(모달 열림, 선택 행, 임시 입력, 탭/패널 열림)는 로컬 컴포넌트 상태 또는 화면 한정 상태 컨테이너로 관리합니다.
- 프론트엔드 상태관리 구현체는 `Zustand`로 단일화합니다.
- 서버 상태와 UI 상태를 동일 라이브러리 안에서 slice 단위로 분리해 결합도를 낮춥니다.

### 프론트엔드 상태관리 라이브러리 사용 가이드 (Zustand 단일)

- 단일 원칙(프론트엔드 한정): 상태관리 라이브러리는 `Zustand`만 사용합니다.
- 서버 상태 slice: 목록/상세 조회 결과, 페이지네이션 메타, 필터 상태, 로딩/오류 상태를 모듈 단위 slice로 관리합니다.
- UI 상태 slice: 선택 행, 배치 액션, 패널/모달 열림 상태, 현재 탭 등 화면 상호작용 상태를 분리 관리합니다.
- 갱신 원칙: 조치 성공 후 영향 범위에 맞는 slice만 선택적으로 갱신하고, 전역 전체 리프레시는 지양합니다.
- URL 동기화 원칙: `page`, `pageSize`, `sort`, `filters`, `tab`은 URL과 동기화해 새로고침/공유 시 동일한 운영 컨텍스트를 재현합니다.
- 금지 패턴: 동일 엔티티를 여러 slice에 중복 저장하지 않으며, 파생 데이터는 selector로 계산합니다.

## 통신 복원력 기준 (Fail-safe)

- 네트워크/서버 상태는 최소 `pending`, `success(result)`, `empty`, `error`를 구분해 UX에 반영합니다.
- 예외 처리는 `try-catch` 단일 방식에 의존하지 않고, Error Boundary/라우트 fallback/timeout/cancel/retry를 조합합니다.
- 요청 실패 시 마지막 성공 상태를 유지하고, 재시도 경로를 제공해 운영 핵심 흐름이 중단되지 않게 설계합니다.

## 데이터 테이블 중심 패턴

- 기본 정책은 server-side pagination/filter/sort입니다. 클라이언트 전량 적재 후 후처리는 기본 전략으로 채택하지 않습니다.
- 테이블 쿼리 파라미터(page, pageSize, sort, filters)는 URL 또는 명시적 상태 모델과 동기화해 재현 가능한 운영 흐름을 보장합니다.
- 대용량 목록은 `AntD Table`의 `virtual`(v5.9+)과 `scroll.y` 조합을 우선 검토하고, 행 높이/열 렌더링 비용을 함께 관리합니다.
- 목록 액션(상세 이동, 상태 변경, 숨김/삭제 등)은 낙관적 갱신 남용보다 정확한 재조회/부분 갱신 기준을 우선합니다.

## 접근성(a11y) 최소 기준

- 키보드만으로 주요 운영 흐름(검색, 행 선택, 상세 진입, 확인/취소)을 완료할 수 있어야 합니다.
- 폼 컨트롤은 레이블, 도움 텍스트, 오류 메시지 연결을 명시하고 placeholder만으로 의미를 전달하지 않습니다.
- 포커스 표시를 제거하지 않으며, 모달/드로어 열림 시 포커스 트랩과 닫힘 후 복귀를 보장합니다.
- 텍스트/상태 배지는 대비 기준을 충족하고, 색상만으로 상태를 구분하지 않습니다.

## 성능 기준

- 병목 우선순위는 테이블 렌더 경로(셀 렌더 함수, 고비용 포맷팅, 불필요한 전체 리렌더)로 둡니다.
- `useMemo`/`useCallback`은 측정 기반으로 적용하며, 일괄적/관성적 메모이제이션을 금지합니다.
- 컬럼 정의와 핸들러 참조 안정성은 유지하되, 가독성 저하를 초래하는 과도한 추상화는 지양합니다.
- 대량 데이터 화면은 가시 영역 렌더링(virtualization)과 요청 단위 축소를 함께 적용합니다.

## 제외 범위

- 본 문서는 프론트엔드 개발 스택과 운영 화면 구현 원칙만 다룹니다.
- 백엔드 아키텍처, 배포 파이프라인, 인프라 구성, DB 스키마/모델 설계는 제외 범위입니다.
- `Learning`, `Content/Course` 관련 기능은 IA 기준 프로젝트 범위에서 제외합니다.

## 외부 레퍼런스

- React: Thinking in React - https://react.dev/learn/thinking-in-react
- Zustand: Introduction - https://zustand.docs.pmnd.rs/getting-started/introduction
- Ant Design v5: Customize Theme - https://5x.ant.design/docs/react/customize-theme
- Ant Design v5: Layout - https://5x.ant.design/components/layout/
- Ant Design Table Ajax Demo - https://ant.design/components/table/#table-demo-ajax
- Ant Design Virtual Table - https://ant.design/docs/blog/virtual-table/

