# TOPIK AI Admin AGENTS.md (Codex 실행 지침)

## 1. 목적
- 이 문서는 TOPIK AI Admin 프론트엔드 구현 시 Codex가 따라야 하는 실행 규칙이다.
- 원문 기반: `docs/architecture/admin-overview.md`, `docs/guidelines/admin-coding-guidelines-antigravity.md`
- 충돌 시 우선순위: 사용자 직접 요청 > 본 문서 > 기타 일반 규칙

## 2. 적용 범위
- 대상 모듈: `Dashboard`, `Users`, `Community`, `Message`, `Operation`, `Commerce`, `Assessment`, `Content`, `Analytics`, `System`
- 대상 작업: 프론트엔드 구현/리팩토링/코드리뷰/테스트 보강
- 대상 작업(2026-06-10 추가): `topik_writing_*` 네임스페이스의 Supabase 스키마 자산(`supabase/migrations`, 시드, RLS/RPC)과 백필 ETL 스크립트(`scripts/etl`) — 메타데이터·태그 스키마 전환(D-1)으로 이 repo가 해당 네임스페이스의 DDL을 소유·관리한다. 경계·승인 절차는 `docs/architecture/metadata-tag-schema-transition-decision-record.md` §2를 따르고, 기존 v13 테이블 DDL 변경은 금지한다.
- 대상 작업(2026-06-12 추가): admin 운영 네임스페이스의 Supabase 스키마 자산 — 알림 운영 객체(`notification_templates`, `notification_groups`, `notification_dispatches`, `notification_delivery_attempts`)와 관련 admin RPC. 공유 Supabase 스키마 소유권은 앱 기준이 아니라 **도메인 기준**으로 정하며, 경계는 `docs/architecture/shared-supabase-schema-ownership.md`를 따른다. 적용 이력은 `topik_writing_schema_migrations`와 분리된 `admin_schema_migrations` tracker로 추적한다. 기존 v13 테이블 DDL 변경 금지는 동일하게 유지한다.
- 제외 범위: 백엔드 아키텍처, 배포/인프라, v13 소유 테이블의 DB 스키마 설계(이 repo 소유 네임스페이스 외). 양쪽 앱이 읽거나 쓰는 공유 객체는 `docs/architecture/shared-supabase-schema-ownership.md`의 decision record를 따른다.

## 3. 문서 계약 (용어/구조 고정)
- 메뉴명은 항상 `Users`(복수형) 사용, `User` 단수형 금지
- 로그 용어는 `감사 로그`로 통일
- `시스템 로그`는 기술 로그로서 감사 로그와 구분
- Users 상세 탭은 고정: `프로필`, `활동`, `결제`, `커뮤니티`, `로그`, `관리자 메모`
- 사용자 노출 UI 라벨(메뉴, 브레드크럼, 페이지 제목, 탭, 버튼, 상태값)은 기본 한글로 작성한다.
- 예외 영문 표기는 제품명, 외부 서비스명, 코드/식별자, 법적 고유 명칭처럼 한글 치환 시 의미가 손상되는 경우로 한정한다.

## 4. 공통 강제 원칙
- 운영 흐름 `검색 -> 상세 -> 조치 -> 감사 로그 확인`을 훼손하지 않는다.
- 전역에서 공통 사용하는 레이아웃/패턴의 디자인 일관성은 개별 페이지 편의보다 우선한다.
- 페이지 작업 요청은 항상 `docs/architecture/admin-overview.md`, `docs/guidelines/admin-ux-ui-design.md`, `docs/guidelines/admin-detail-drawer-guidelines.md`, `docs/specs/admin-page-tables.md` 같은 공통 일관성 문서를 먼저 확인한 뒤, 해당 페이지 IA와 구현 파일을 본다.
- 사용자가 특정 화면의 UI 변경을 요청하더라도, 먼저 그 변경이 전역 공통 레이아웃/공용 컴포넌트/공통 스타일 규칙에 속하는지 판별한다.
- 사용자가 `~을 참고해서`, `~와 비슷하게`, `~처럼 맞춰서`처럼 레퍼런스 기반 표현을 쓰더라도, 명시적 예외 요구가 없는 한 기존 전역 공통 레이아웃/공용 컴포넌트/일관성 규칙을 우선한다.
- 아래 중 하나라도 해당하면 전역 공통 작업 후보로 간주하고, `shared` 컴포넌트/공통 레이아웃/전역 스타일/공통 문서를 먼저 조사한다:
  - 동일 패턴이 2개 이상 페이지에서 반복된다.
  - 변경 대상이 `PageTitle`, `SearchBar`, 테이블, 상세 Drawer, Modal, Form 레이아웃, 탭, 공통 버튼 배치처럼 운영 공통 골격이다.
  - 페이지 데이터가 아니라 배치, 간격, 정렬, 타이포, 아이콘 위치, 인터랙션 피드백 같은 시각/행동 규칙이다.
- 아래에 해당하면 특정 페이지 또는 특정 컴포넌트 한정 작업으로 우선 분류한다:
  - 도메인 데이터, 권한, 상태값, 액션 정책처럼 화면 맥락 의존성이 강하다.
  - 같은 공통 컴포넌트를 쓰더라도 해당 페이지에서만 예외 정책이 문서화되어 있다.
  - 전역 반영 시 다른 모듈의 운영 흐름이나 용어 계약을 깨뜨릴 위험이 크다.
- 페이지 단위 탭, 검색, 필터, 주요 액션 버튼 같은 상호작용 UI는 반드시 페이지 본문 컨테이너 안에 배치한다. `PageTitle`/브레드크럼과 overlay(`Drawer`, `Modal`, `Popover`)만 예외로 둔다.
- `등록/추가/생성` 계열 버튼은 본문 기준 테이블 또는 주요 데이터 블록의 우측 상단에 둔다. `SearchBar`가 있으면 같은 줄 우측 끝에 함께 배치한다.
- 본문 상단의 `등록/추가/생성` 계열 버튼은 항상 Ant Design `size="large"`를 사용한다.
- 파괴적 액션(정지/삭제/환불/숨김/사용자 정지)은 확인 단계와 사유/근거 입력 수단을 제공한다.
- 표준 상태값(`정상/정지/탈퇴`, `게시/숨김`, `완료/취소/환불`)을 임의로 변경하지 않는다.
- 네트워크/서버 상태는 최소 `pending`, `success(result)`, `empty`, `error`를 UI에서 구분해 노출한다.
- 장애 대응은 `try-catch` 단일 패턴에 의존하지 않고, 프레임워크/라이브러리의 fail-safe(예: Error Boundary, 라우트 fallback, 요청 재시도/취소/타임아웃, 마지막 성공 상태 fallback)를 함께 적용한다.
- 통신 오류가 발생해도 전체 서비스가 중단되지 않도록 화면/기능 단위로 장애를 격리한다.

## 5. 기준 문서 맵 (중복 최소 원칙)
- 프로젝트 코딩 품질 원문: `docs/guidelines/admin-coding-guidelines-antigravity.md`
- TypeScript 구현 표준 원문: `docs/guidelines/typescript-essential-checklist.md`
- 코드 주석 정책 원문: `docs/guidelines/comments-rule.md`
- React 최적화 원문: `docs/guidelines/react-optimization-rule.md`
- UX/UI 디자인 일관성 원문: `docs/guidelines/admin-ux-ui-design.md`
- 행 클릭 상세 Drawer 레이아웃 원문: `docs/guidelines/admin-detail-drawer-guidelines.md`
- 상태/아키텍처 원문: `docs/architecture/admin-overview.md`
- 데이터 소스 전환 원문: `docs/architecture/admin-data-source-transition.md`
- Supabase 마이그레이션 디렉터리/네임스페이스 안내: `supabase/README.md` (`migrations` vs `migrations-admin`, tracker 분리·러너·롤백·경계 규칙)
- 공유 Supabase 스키마 소유권 원문: `docs/architecture/shared-supabase-schema-ownership.md`
- 데이터 계약/명명 기준 원문: `docs/specs/admin-data-contract.md`
- 페이지 테이블/필드 계약 원문: `docs/specs/admin-page-tables.md`
- 조치 감사 로그 계약 원문: `docs/specs/admin-action-log.md`
- 페이지별 미확정/누락/오구현 레지스트리: `docs/specs/admin-page-gap-register.md`
- 페이지별 상세 IA 원문: `docs/specs/page-ia/*.md`
- 페이지별 상세 IA 템플릿 원문: `docs/templates/admin-page-ia-template.md`
- 페이지별 상세 IA 변경 로그: `docs/specs/admin-page-ia-change-log.md`
- 페이지별 관리자↔사용자(B2C) 화면 동기화 문서: `docs/page-sync/*.md` (폴더 목적·구조·문서 목록 인덱스: `docs/page-sync/README.md`)
- 페이지별 동기화 문서 작성 틀: `docs/templates/admin-page-sync-template.md`
- 관리 데이터/B2C 노출 추적 원문: `docs/specs/admin-data-usage-map.md`
- 운영 점검 요약 허브: `docs/checklists/admin-essential-checklist.md`
- 검증 하네스 문서: `docs/harness/index.md`
- 본 문서는 실행 지침과 리뷰 게이트만 유지하며, 상세 기술 규칙은 원문에서 단일 관리한다.
- 상태관리 구현체는 `Zustand` 단일 원칙을 유지한다.

## 6. 리뷰 게이트 (위반 시 수정 후 머지)

### 6.1 프로젝트 품질 게이트
- 최적화/데이터 정합성/영향도/재활용/확장성 5축 중 영향 항목을 작업 결과에 명시한다.
- 데이터, 용어, 키워드, 변수명 정합성 검토 결과를 작업 결과에 명시한다.
- 조치성 기능은 `Target Type`, `Target ID`, 감사 로그 확인 경로를 제공한다.
- URL 복원 시 동일한 목록/필터/정렬/탭 결과가 재현되어야 한다.
- 페이지 단위 UI가 본문 밖으로 분리되지 않아야 하며, `등록/추가/생성` 버튼은 본문 우측 상단 또는 `SearchBar` 우측 끝에 있어야 한다.
- 본문 상단의 `등록/추가/생성` 버튼은 항상 `large` 크기여야 한다.
- 하드코딩된 휘발성 변수/데이터가 persistence 후보라면 page-local 상수/상태에 남기지 않고, 미래 DB/API 계약 기준으로 분리하거나 분리 계획을 문서에 남긴다.
- 작업 완료 시 변경 영향 핵심 플로우에 대한 e2e 테스트를 반드시 수행하고, 결과를 작업 보고에 명시한다.
- e2e 테스트에는 기능 동작 확인뿐 아니라 공통 문서/공용 컴포넌트 기준의 UI 일관성 검토를 포함한다. 최소 헤더/본문/푸터 구조, 본문 내 UI 배치, 버튼 크기/정렬, 상태/라벨 표기, 여백/정렬 baseline 중 변경 영향 항목을 함께 확인한다.
- e2e 테스트를 실행하지 못한 경우에는 완료로 간주하지 않으며, 차단 원인과 필요한 환경/후속 조치를 즉시 보고한다.
- 네트워크 상태(`pending/success(empty 포함)/error`)별 UX와 복구 경로(재시도/fallback/가이드)가 확인 가능해야 한다.
- 통신 실패 시 fail-safe가 동작해 페이지 전체 중단 없이 운영 핵심 흐름을 지속할 수 있어야 한다.

### 6.2 React 최적화 게이트
- 리스트 key에 index를 사용하지 않는다.
- 반복 컴포넌트에 inline 객체/함수 props를 남발하지 않는다.
- 기준 충족 대용량 테이블에서 virtualization 누락을 금지한다.
- derived state 복사를 금지한다.
- effect 의존성 누락/cleanup 누락을 금지한다.
- 서버 상태를 로컬 상태로 중복 관리하지 않는다.
- 라우트 단위 코드 스플리팅 누락을 금지한다.

## 7. Codex 작업 절차
- 작업 시작 전: 요청 수행에 필요한 정보가 충분한지 먼저 점검한다.
- 정보가 부족하면 부족한 항목을 명시하고, 추정이 필요한 경우 가정과 리스크를 명확히 밝힌다.
- 코드베이스 기준으로 요청이 잘못되었거나 불일치하면 반드시 그 사실을 짚고, 근거(파일/구조/동작)를 제시한 뒤 대안을 제안한다.
- 작업 시작 전: 영향 모듈, 품질 축(최소 1개), 파괴적 액션 여부를 먼저 식별한다.
- 작업 시작 전: 사용자 요구사항이 프로젝트에 미칠 영향 범위를 최소 `영향 모듈`, `데이터 계약`, `공통 UI`, `운영/정책`, `검증 범위` 기준으로 먼저 정리한다.
- 작업 시작 전: 요청을 `전역 공통 작업` / `특정 페이지 작업` / `특정 컴포넌트 작업` 중 무엇으로 볼지 먼저 분류하고, 그렇게 판단한 코드/문서 근거를 제시한다.
- 작업 시작 전: 페이지 작업이면 공통 일관성 문서(`admin-overview`, `admin-ux-ui-design`, `admin-detail-drawer-guidelines`, `admin-page-tables`)를 먼저 확인하고, 그 기준에서 예외가 필요한지부터 판별한다.
- 작업 시작 전: 사용자가 사이드바 기준 순차 검수를 진행 중인 것으로 보고, 현재 요청 페이지의 데이터/용어/키워드/변수명 정합성을 `docs/specs/admin-data-contract.md` 기준으로 먼저 점검한다.
- 작업 시작 전: 현재 요청이 `docs/specs/admin-page-gap-register.md`의 기존 항목을 해소/변경하거나 새 항목을 추가해야 하는 작업인지 먼저 판별하고, 해당되면 같은 작업에서 문서 갱신을 완료 조건에 포함한다.
- 전역 공통 작업 후보라면, 페이지 파일부터 고치지 말고 공용 컴포넌트, 공통 스타일, 공통 가이드 문서에 이미 같은 책임이 있는지 먼저 확인한다.
- 특정 페이지 또는 특정 컴포넌트 한정 작업으로 판단했다면, 왜 전역 공통 규칙으로 올리지 않는지 영향 범위와 회귀 리스크 기준으로 설명한다.
- 요청이 일반적인 관리자 페이지의 목록/상세/조치/감사 로그 흐름과 다른 방향이라면, 그 차이와 유지해야 하는 운영상 이유를 먼저 설명한다.
- 구현 중 하드코딩된 휘발성 변수/데이터를 발견하면 `schema candidate`, `code table candidate`, `UI-only` 중 하나로 분류하고, page-local 임시값으로 방치하지 않는다.
- 구현 후: 코드/설정/플로우 변경에 따른 MD 문서 영향 평가를 반드시 수행한다.
- MD 수정이 필요하면 동일 작업에서 즉시 반영하고, 미반영 상태로 작업을 종료하지 않는다.
- 페이지별 상세 IA 문서(`docs/specs/page-ia/*.md`) 또는 IA 템플릿(`docs/templates/admin-page-ia-template.md`)을 수정한 경우 `docs/specs/admin-page-ia-change-log.md`에도 변경 요약을 같은 작업에서 반드시 기록한다.
- 행 클릭 상세 Drawer의 헤더/푸터/본문 슬롯 위치, 감사 로그 링크 위치, 섹션 배치, 공용 `DetailDrawer` 사용 규칙이 바뀌면 `docs/guidelines/admin-detail-drawer-guidelines.md`와 관련 공통/페이지 IA 문서를 같은 작업에서 반드시 갱신한다.
- 관리자 테이블/폼/정적 데이터/정책 데이터가 변경되거나, 해당 데이터의 B2C 노출 위치/사용 맥락이 바뀌면 `docs/specs/admin-data-usage-map.md`를 같은 작업에서 반드시 평가하고 반영한다.
- `docs/specs/admin-data-usage-map.md`에는 B2C 노출 위치를 `확인됨/운영상 추정/내부 전용/노출 예정` 중 하나로 명시해 추정과 확정을 혼합하지 않는다.
- 페이지의 목적, 가능한 작업, 관리 데이터(CRUD) 후보, 감사 로그 계약, 사용자(B2C) 화면 동기화 포인트가 바뀌면 해당 페이지의 `docs/page-sync/*.md`(인덱스 `docs/page-sync/README.md`)를 같은 작업에서 반드시 평가하고 반영한다. page-sync 문서는 확정 스키마가 아니라 후보 계약이므로, 전역 기준은 `admin-data-contract.md`/`admin-data-usage-map.md`/`admin-action-log.md`를 우선하고 차이는 5번 섹션 `미확정/차이`에 남긴다.
- API, mock, 데이터베이스, 응답 스키마, repository/service 경계, 더미데이터 SoT 구조가 바뀌면 `docs/architecture/admin-data-source-transition.md`를 같은 작업에서 반드시 평가하고 반영한다.
- 엔티티명, 테이블명 후보, 컬럼/필드명, 변수명, enum/code table 후보, 하드코딩된 schema candidate 분류가 바뀌면 `docs/specs/admin-data-contract.md`를 같은 작업에서 반드시 평가하고 반영한다.
- API 혹은 데이터베이스와 연관된 작업에서 목록/상세 필드, 검색 조건, 테이블 source가 바뀌면 `docs/specs/admin-page-tables.md`와 관련 `docs/specs/page-ia/*.md`를 같은 작업에서 반드시 평가하고 반영한다.
- API 혹은 데이터베이스와 연관된 작업에서 조치 후 감사 로그 계약(`Target Type`, `Target ID`, 후속 검증 경로 포함)이 바뀌면 `docs/specs/admin-action-log.md`와 관련 `docs/specs/page-ia/*.md`를 같은 작업에서 반드시 평가하고 반영한다.
- 기존 미확정/누락/오구현 항목을 해소하거나 상태를 바꾸거나, 새 항목을 발견하면 `docs/specs/admin-page-gap-register.md`를 같은 작업에서 반드시 갱신한다.
- 문서 파일(`docs/**`)을 추가/삭제/이동한 경우 `docs/README.md` 인덱스를 같은 작업에서 반드시 갱신한다.
- MD를 수정한 경우 `logs/admin-doc-update-log.md`에 변경 요약을 1건 기록한다.
- 운영/정책 관련 내용이 바뀌면 관련 MD를 지속 모니터링 대상으로 평가하고, 반영 여부 또는 미반영 사유를 결과에 남긴다.
- 작업 완료 직전에는 기본적으로 `npm run harness:check`를 실행해 구조/문서 드리프트를 먼저 점검한다.
- 작업 완료 직전에는 반드시 변경 영향 핵심 플로우 e2e 테스트를 실행하고, 통과/실패/차단 여부와 근거를 결과에 기록한다.
- PR 머지가 확인된 세션은 `npm run git:sessions:cleanup -- --apply`와 `npm run git:sessions:audit -- --json --strict`를 실행해 worktree, 로컬/원격 브랜치, stale ref, 세션 manifest 정리를 완료 게이트에 포함한다. dirty·미병합·복구 필요 항목은 삭제하지 않고 분류와 후속 담당을 보고한다.
- e2e 결과 보고에는 기능 통과 여부와 별도로, 어떤 공통 일관성 문서를 기준으로 어떤 UI baseline을 확인했는지와 예외 여부를 함께 기록한다.
- 구현 중: 6장 리뷰 게이트 위반 시 즉시 대안 구현으로 전환한다.
- 작업 완료 시: 적용한 품질 축과 게이트 충족 여부를 결과에 명시한다.
- 작업 완료 시: 사용자 요구사항이 프로젝트에 미친 영향 범위를 변경 요약과 별도로 명시한다.

## 8. 전역 Do / Do Not
DO
- 문서 계약의 용어/범위를 코드 규칙보다 우선 적용한다.
- 변경 요청을 받으면 먼저 전역 공통 레이아웃인지, 특정 페이지인지, 특정 컴포넌트인지 분류하고 그 근거를 결과에 남긴다.
- 사이드바 순차 검수 맥락을 기본값으로 두고, 매 작업마다 데이터/용어/키워드/변수명 정합성을 먼저 점검한다.
- 조치 후 검증 가능성(감사 로그 확인 가능)을 항상 보장한다.
- 작업 완료 시 변경 영향 핵심 플로우 e2e 테스트를 반드시 실행하고 결과를 보고한다.
- 변경 영향이 문서에 미치면 관련 MD를 같은 작업에서 함께 업데이트한다.
- 페이지 단위 UI와 `등록/추가/생성` 버튼 배치 규칙을 공통 문서와 현재 화면 구현에 함께 반영한다.
- 본문 상단의 `등록/추가/생성` 버튼 크기를 예외 없이 `large`로 통일한다.
- 페이지별 상세 IA 문서나 IA 템플릿을 수정하면 `docs/specs/admin-page-ia-change-log.md`와 `logs/admin-doc-update-log.md`를 함께 갱신한다.
- 행 클릭 상세 Drawer 레이아웃 규칙이 바뀌면 `docs/guidelines/admin-detail-drawer-guidelines.md`를 기준 문서로 함께 갱신한다.
- 운영 데이터가 B2C 어디에 노출되고 어떻게 사용되는지 `docs/specs/admin-data-usage-map.md`로 추적 가능하게 유지한다.
- 데이터 소스 전환 기준과 mock/API 경계는 `docs/architecture/admin-data-source-transition.md`를 기준으로 유지한다.
- 미래 DB/API 기준의 엔티티/테이블/필드/변수명 계약은 `docs/specs/admin-data-contract.md`를 기준으로 누적 유지한다.
- 현재 작업이 `docs/specs/admin-page-gap-register.md` 항목의 생성/해소/상태 변경과 관련되면, 코드 수정과 함께 레지스트리도 같은 작업에서 갱신한다.
- 사용자 노출 UI 라벨은 기본 한글 표기를 유지하고, 동일 개념을 영어/한글로 혼용하지 않는다.

DO NOT
- 정보 부족 또는 코드베이스 불일치를 인지하고도 명시 없이 작업을 진행하지 않는다.
- 전역 일관성 이슈를 발견하고도 특정 페이지 핫픽스로만 덮은 채 작업을 종료하지 않는다.
- 특정 페이지 요구를 근거 없이 shared 컴포넌트나 전역 스타일 변경으로 과확장하지 않는다.
- persistence 후보인 하드코딩 데이터를 page 컴포넌트 local const/state에 남긴 채 작업을 종료하지 않는다.
- 변경 영향 핵심 플로우 e2e 테스트 없이 작업을 완료로 보고하지 않는다.
- `Users`와 `User` 표기를 혼용하지 않는다.
- `감사 로그`와 `시스템 로그`를 혼용하지 않는다.
- 페이지 단위 탭/필터/주요 액션 버튼을 카드 헤더 `extra`나 본문 밖 독립 영역에 둔 채 작업을 종료하지 않는다.
- 사용자에게 보이는 메뉴/브레드크럼/버튼/탭에 영문 기본값을 남긴 채 작업을 종료하지 않는다.

## 9. 사용자 맞춤 협업 프로토콜 (2026-03-04 합의)
- 결과 우선순위는 `일관성` > `정확성` > `속도`로 둔다.
- 페이지 작업의 기본 시작 순서는 `공통 일관성 문서 확인 -> 데이터/용어 계약 확인 -> 페이지 IA 확인 -> 구현 파일 확인`으로 고정한다.
- 사용자는 사이드바에 나열된 페이지를 순차 검수 중인 것으로 간주하고, 이후 모든 요청에서 현재 페이지의 데이터/용어/키워드/변수명 정합성과 일반 관리자 패턴 이탈 여부를 먼저 점검한다.
- 레이아웃/디자인 변경은 항상 `전역 공통 반영 필요 여부`를 먼저 판단하고, 판단 결과와 근거를 중간 업데이트 또는 결과 보고에 포함한다.
- 코드베이스와 요청이 충돌하면 근거를 제시하고, `추천안 1개 + 대안 최대 2개`를 제시한 뒤 진행한다.
- 정보 부족 판단은 Codex 기준으로 수행한다. 아래 중 하나라도 충족하면 정보 부족으로 본다:
  - 입력/출력 요구(완료 조건 포함)가 불명확함
  - API/데이터 계약 또는 권한 조건이 불명확함
  - 변경 영향 범위(모듈/화면/상태/로그)가 불명확함
  - 검증 방법(테스트/수동 확인 기준)이 정의되지 않음
- 기본 Definition of Done:
  - 요구사항을 충족한다.
  - 영향 범위 기준 정합성 점검을 완료한다.
  - `lint`/관련 테스트/빌드 점검과 함께 변경 영향 핵심 플로우 e2e 테스트를 수행한다.
  - e2e 검증에는 공통 문서 기준 UI 일관성 확인이 포함되며, 확인한 baseline과 예외 여부를 결과에 남긴다.
  - e2e 테스트를 포함한 검증을 못 했거나 실패한 경우 원인과 영향을 결과에 명시하고, 완료 조건 미충족으로 취급한다.
- 기본 수정 범위:
  - 저장소 내 소스/문서/설정 파일 수정 가능
  - `.sisyphus/**`는 사용자가 요청했거나 근거 보강이 필요한 경우에만 수정
- 요구사항 오류 지적 방식:
  - 완곡한 우회 대신 명확하게 잘못된 점을 짚는다.
  - 반드시 파일/구조/동작 근거를 함께 제시한다.
- 보고 형식 기본값:
  - 변경 요약
  - 변경 파일 목록
  - 검증 결과(실행/미실행 포함)
  - 리스크와 후속 제안
- 중간 업데이트는 탐색/수정/검증 단계 전후로 짧고 자주 공유한다.
- 커밋 정책:
  - 작업 완료 시 커밋 필요성은 Codex가 판단한다.
  - 커밋이 필요하다고 판단되면 커밋 메시지와 범위를 제안하고 진행 여부를 확인한다.

## 10. React 최적화 우선 적용 방침
- React 최적화 판단의 상세 기준은 `docs/guidelines/react-optimization-rule.md`를 단일 원문으로 사용한다.
- 성능/렌더링 관련 변경은 6.2 React 최적화 게이트를 통과해야 한다.
- 상태관리 구현체는 `Zustand` 원칙을 유지하고, 서버 상태 라이브러리 관련 세부는 프로젝트 채택안에 맞춰 해석한다.

## 11. Git 관리
이 저장소의 버전 관리 규약을 한곳에 모은다. 마이그레이션 디렉터리 세부는 `supabase/README.md`를, 커밋 필요성 판단은 §9 커밋 정책을 단일 원문으로 본다(중복 최소 원칙).

### 11.1 리모트 / 배포
- `origin` → `github.com/blackstarzck/topik-ai.git` — **PR 대상**(PR #1~#3 머지처).
- `keduall`·`collab` → `github.com/keduall/topik-admin.git`(동일 URL, 회사 저장소).
- 기본·PR 브랜치는 `main`. PR은 `gh` CLI로 origin `main` 대상 생성.
- **GitHub 실행 계정과 Git commit author는 별도 계약으로 확인한다.** push·merge 전에 대상 remote, `gh auth status`의 활성 계정, `gh api user --jq .login`, `git config user.name`, `git config user.email`을 대조한다.
- `blackstarzck/topik-ai`의 `main` PR merge는 GitHub 계정 `blackstarzck`으로만 실행한다. 자격 정보가 없거나 확인에 실패하면 `BLOCKED`로 일시중단하며 `guestkeduall-design` 등 다른 계정으로 대체하지 않는다.
- **계정 선택은 전역 `gh auth switch`가 아니라 프로세스 한정 자격 주입으로 한다.** 스크립트 mutation은 `scripts/git/account-context.mjs`(`withAccount`/`runGhAs`/`runGitPushAs`)를 사용한다: keyring에서 대상 계정 토큰을 읽어 해당 spawn의 `GH_TOKEN` env로만 주입하고, 실행 전 `gh api user` 신원 대조(preflight)로 wrong-account를 원천 차단한다. 저장소→계정 매핑의 단일 출처는 이 모듈의 `ACCOUNTS`다. 전역 활성 계정은 병렬 세션과 공유되므로 변경하지 않으며, 수동(대화형) 작업에서 부득이 `gh auth switch`를 쓴 경우 작업 종료 전 원상복구한다.
- `blackstarzck`와 `guestkeduall-design`은 보호 경로의 공동 CODEOWNER다. 승인된 publish·merge 작업에서 두 `gh` 세션과 `guestkeduall-design`의 collaborator write 권한이 모두 확인되면, 필수 검사 통과·미해결 review thread 없음·최종 push 이후라는 조건 아래 PR 작성자가 아닌 계정으로 CODEOWNER 승인을 제출하고 `blackstarzck`으로 전환해 merge까지 계속한다. self-review, 필수 검사 우회, stale approval 재사용은 금지하며 계정 또는 권한 확인에 실패하면 `BLOCKED`로 중단한다.
- `collab` 또는 `keduall` remote로 push·merge할 때는 GitHub 계정 `guestkeduall-design`과 Git commit author `guestkeduall-design <guestkeduall@gmail.com>`을 사용한다. 해당 GitHub 자격 정보가 없거나 Git identity가 일치하지 않으면 작업을 일시중단한다. 이미 생성된 다른 author의 commit은 이 규칙을 맞추기 위해 자동 rewrite하지 않고 사용자에게 보고한다.
- **Vercel Git 연동은 commit author로 배포를 검증한다.** main에 push되는 배포 트리거/머지 커밋은 Vercel에 연결된 계정(`guestkeduall-design <guestkeduall@gmail.com>`)이 author여야 한다. 다른 author(예: `chanchan2@keduall.com`)는 팀 계정에 매핑되지 않아 배포가 평가되지 않는다.
- 이미 push된 `main` 히스토리를 force-rewrite하지 않는다 — author 문제는 no-op 트리거 커밋으로 해소한다.

### 11.2 브랜치 전략
- **브랜치 생성은 사용자 동의가 필수다.** 작업이 `main`에서 시작되더라도 임의로 새 브랜치를 만들지 않는다. 새 브랜치가 필요하면 이름·목적을 제안하고 동의를 받은 뒤에만 생성한다(커밋/푸시 승인과 별개 게이트).
- 새 Codex/Claude 세션은 최신 `origin/main` 기반 detached worktree를 먼저 만들고 목적을 외부 manifest에 등록한다. Codex는 `npm run git:session -- start --agent codex --task "<요약>"`, Claude는 `--agent claude`를 사용한다.
- detached worktree 생성 뒤 기존 manifest·브랜치·PR과 작업 목적을 대조한다. 정확한 연속 작업은 기존 브랜치를 재사용하고, 해당 브랜치가 다른 worktree에서 사용 중이면 새 worktree를 만들지 않고 그 worktree를 재사용한다. 읽기 전용 조사·리뷰는 detached 상태로 끝낼 수 있다.
- 신규 변경일 때만 브랜치 이름과 목적을 제안해 사용자 승인을 받는다. 브랜치 생성 승인은 commit·push·PR 승인을 포함하지 않는다.
- `main`: 기본·PR 대상·Vercel 배포 브랜치. **직접 커밋 지양** — 작업은 브랜치에서 하고 PR로 합친다.
- `feat/*`: 기능 작업(`feat/operation-notices-db`, `feat/admin-account-separation` 등).
- `codex/*`: 에이전트 작업(`codex/users-registration-lifecycle-admin` 등).
- `docs/*`: 문서 전용 작업.

### 11.3 워크트리(동시 세션) 주의 — 중요
- 이 저장소는 **다중 git worktree**로 운영된다(`git worktree list`로 확인): 메인 워크스페이스 + `~/.codex/worktrees/<id>/topik-ai` 여러 개. 각 워크트리는 서로 다른 브랜치/커밋·자체 `.env.local`·자체 dev 서버를 가질 수 있다.
- 세션 상태의 단일 외부 장부는 `~/.agent-sessions/topik-ai/<worktree-id>.json`이다. 저장소, worktree 경로, 에이전트, 작업 요약, 브랜치, PR 번호, 상태, 생성·갱신 시각을 기록하고 `npm run git:session -- sync`로 현재 branch/PR/dirty 상태를 동기화한다. worktree 없이 발견한 기존 미제출 브랜치는 `sync --branch <name> --agent <codex|claude> --task "<요약>"`으로 `ORPHAN_REVIEW` 등록한다. 비밀값·diff 본문은 기록하지 않는다.
- 통합 감사는 `npm run git:sessions:audit -- --json --strict`를 사용하며 분류값은 `DETACHED_PROBE`, `ACTIVE`, `MERGED_CLEANUP`, `ORPHAN_REVIEW`, `DIRTY_BLOCKED`, `SAFE_QUARANTINE`, `FOREIGN_REPO`, `RECOVERY_REQUIRED`, `MAIN_HISTORY_DRIFT`로 고정한다.
- `npm run git:sessions:cleanup`은 dry-run이 기본이다. 실제 정리는 `-- --apply`를 명시한 경우에만 수행하며, fetch/prune → clean 확인 → 필요한 recovery bundle 생성·검증 → worktree·로컬 브랜치·머지된 원격 head·stale ref 정리 → 안전 조건을 만족하는 로컬 `main` 정렬 → 재감사 순서를 지킨다.
- 강제 브랜치 삭제 전에는 `~/.agent-sessions/topik-ai/recovery`에 bundle을 만들고 `git bundle verify`를 통과해야 한다. 명시적으로 폐기할 clean 미병합 브랜치는 `npm run git:session -- archive --branch <name> --apply`로만 처리한다. 자동 `archive-*` 브랜치 생성은 금지한다.
- recovery bundle과 `SAFE_QUARANTINE` 항목은 7일 보존한다. empty 또는 `.omx`·`.vite`·로그 등 알려진 생성물-only 물리 디렉터리만 quarantine할 수 있다. 유효한 Git worktree, source, `.env.local`, renamed/invalid `.git`은 자동 정리하지 않는다. 다른 저장소 소유 항목은 `FOREIGN_REPO`로 감사만 하고 그 저장소에서 처리한다.
- 로컬 `main` 자동 정렬은 worktree clean, `origin/main` 대비 ahead-only, `origin/main`이 조상, 양쪽 tree 동일 조건을 모두 만족할 때만 bundle 생성·검증 후 `reset --keep origin/main`으로 수행한다. 하나라도 다르면 `MAIN_HISTORY_DRIFT`로 중단한다.
- PR 머지 후 cleanup 담당자는 머지 완료 세션의 worktree·manifest·로컬 브랜치가 제거되고 원격 head·stale origin ref가 남지 않았음을 최종 감사로 확인한다. `DIRTY_BLOCKED`, 미병합 `ORPHAN_REVIEW`, `RECOVERY_REQUIRED`는 자동 삭제하지 않고 후속 담당과 복구 경로를 남긴다.
- **실행 중인 dev 서버가 내 편집을 반영한다고 가정하지 않는다.** 어느 워크트리·포트에서 도는지, `process.cwd()`가 어디인지(서버측 env는 그 cwd의 `.env.local`에서 로딩됨) 먼저 확인한다. 동시 편집 중에는 탐색 Read 결과가 stale일 수 있다.
- **다른 세션의 미커밋 변경을 함께 커밋하지 않는다.** 공유 파일을 동시 편집했다면 내 hunk만 스테이징한다:
  - `.codex-artifacts/stage_mine.py`(git diff 훅 필터 → patch) 사용.
  - 클린 체크아웃 기법: patch 생성 → 파일 백업 → `git checkout HEAD <file>` → `git apply --recount` → `git add` → 백업 복원. (`git apply --cached`는 동시 hunk가 new측 라인을 시프트시켜 실패할 수 있어, 일단 HEAD 클린 상태에 적용해야 한다.)
  - 함정: Python subprocess가 git 출력을 cp949로 디코드해 한글이 깨질 수 있다 → `encoding='utf-8'` 강제.

### 11.4 커밋 메시지 규약
한 줄 제목 + 구조화 본문이 이 저장소의 표준이다.
- **제목**: 간결한 명령형. conventional-commit 형식(`feat(scope): 요약`, `docs(scope): 요약`, `test(e2e): 요약`, `chore(env): 요약`)을 함께 사용한다. 무엇을 했는지보다 의도가 드러나게.
- **본문(구조화 필드, 실제 사용 중)**:
  - `Constraint:` 사용자 요청/구속 조건
  - `Rejected:` 기각한 대안 + 사유(복수 가능)
  - `Confidence:` high / medium / low
  - `Scope-risk:` narrow / moderate / broad
  - `Directive:` 향후 유지할 규칙·교훈
  - `Tested:` 실행한 게이트(`harness:check`, `typecheck`, `lint`, `build`, e2e 스펙 등)
  - `Not-tested:` 미검증 항목(예: 운영 DB 마이그레이션 미적용)
  - `Co-authored-by:` 트레일러(Codex 작업분은 `OmX <omx@oh-my-codex.dev>`).

### 11.5 커밋 / 푸시 정책 (게이트)
- 커밋·푸시는 사용자가 요청하거나 필요성이 확인될 때만 한다. 필요하다고 판단되면 메시지·범위를 제안하고 진행 여부를 확인한다(§9 계승).
- **커밋 전 게이트**:
  - `npm run harness:check` (mojibake · doc-crosslinks · route-doc-coverage · message-history-boundary · lint · typecheck)
  - 경계/마이그레이션 작업이면 `npm run harness:admin-boundary` (migration-boundary · client-source-secrets · notification-cross-app-state 등)
  - 변경 영향 핵심 플로우 **e2e**(§6.1·§9 DoD)
- **mojibake 검사 필수** — 특히 Codex가 `.sql`/`.tsx`를 편집한 직후. `npm run check:mojibake`는 fragment 한정이라 불완전하므로 lint + 수동 `?+한글` 스캔을 병행하고, 깨졌으면 UTF-8로 재작성한다. 한글이 많은 파일은 Codex보다 직접 작성이 안전하다.
- **비밀/PII 커밋 금지** — `.env.local`·`.env.*.local`은 `.gitignore`로 보호된다. 단 DB 백업 덤프(`.db-backup-*`)는 자동 무시되지 않고 회원 PII를 포함하므로 push 전 반드시 확인한다.

### 11.6 Supabase 마이그레이션 경계 (커밋·적용)
원문: `supabase/README.md`. 하나의 공유 DB를 **도메인 기준** 두 네임스페이스로 분리한다.
- `supabase/migrations/` → `topik_writing` 도메인. tracker `topik_writing_schema_migrations`, 러너 `npm run db:migrate`.
- `supabase/migrations-admin/` → admin 운영 도메인. tracker `admin_schema_migrations`, 러너 `npm run db:admin:migrate`.
- **경계 규칙**: 두 tracker를 섞지 않는다 · v13 소유 테이블 DDL 변경 금지 · 소유권은 앱이 아니라 도메인 기준. `npm run check:migration-boundary`가 게이트.
- 각 마이그는 `down/`에 같은 파일명으로 롤백 SQL을 짝지어 둔다. 적용은 Management API(`SUPABASE_ACCESS_TOKEN`).
- **dev DB와 운영 DB는 분리**된다. 작업은 dev DB(`fglggyfvzjdsbyckinqa`)에 적용·검증하고, 운영 DB 적용은 PR 머지 후 별도 후속 단계다 — 커밋·머지가 운영 DB에 자동 반영되지 않는다.
- 신규 마이그를 **구버전 정의 위에 작성하지 않는다**(직전 컬럼/함수를 덮어쓸 위험). 최신 정의를 베이스로 작성하고, 신규 쓰기 파일은 boundary 게이트의 허용 목록에 등록한다.
