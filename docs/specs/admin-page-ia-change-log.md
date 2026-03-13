# TOPIK AI Admin 페이지별 상세 IA 변경 로그

## 목적

- 페이지별 상세 IA 문서(`docs/specs/page-ia/*.md`)의 생성/수정 이력을 별도로 추적합니다.
- 문서가 왜 바뀌었는지와 어떤 정책/영향도 정보가 추가되었는지 빠르게 확인할 수 있게 합니다.

## 기록 규칙

- 페이지별 상세 IA 문서를 생성하거나 수정하면 이 문서에 1건 이상 기록합니다.
- 같은 요청에서 여러 IA 문서를 함께 수정한 경우 한 항목으로 묶을 수 있습니다.
- 일반 문서 변경 로그는 `logs/admin-doc-update-log.md`에도 함께 남깁니다.

## 로그 형식

| Date | Page | Change Type | Updated Files | Summary |
| --- | --- | --- | --- | --- |
| 2026-03-13 | `Users > 추천인 관리` | Drawer 컬럼 단순화 | `docs/specs/page-ia/users-referrals-page-ia.md`, `docs/specs/admin-page-tables.md` | 추천 관계 및 보상 테이블에서 `가입/확정`, `이상치/검수 메모`를 각각 묶어 표시하고, 하위 원장 테이블은 `유형`, `금액`, `처리 시각`, `사유`만 남기도록 문서 기준을 정리 |
| 2026-03-13 | `Users > 추천인 관리` | Drawer 테이블 구조 전환 | `docs/specs/page-ia/users-referrals-page-ia.md`, `docs/specs/admin-page-tables.md` | 상세 Drawer의 `추천 관계 및 보상`을 관계 테이블로 전환하고, 각 관계의 보상 원장을 행 확장 하위 테이블로, 관계 미귀속 항목은 `코드 단위 조정` 테이블로 분리하는 기준을 문서에 반영 |
| 2026-03-13 | `Users > 추천인 관리` | 사용자 링크 스타일 조정 | `docs/guidelines/admin-ux-ui-design.md`, `docs/specs/page-ia/users-referrals-page-ia.md`, `docs/specs/admin-page-tables.md` | 사용자명 클릭 링크의 공통 `table-navigation-link` 스타일에서 밑줄 규칙을 제거하고, 페이지 IA와 테이블 스펙의 링크 표현도 같은 기준으로 정리 |
| 2026-03-13 | `Users > 추천인 관리` | 사용자 링크 스타일/관계 상태 위치 정리 | `docs/guidelines/admin-ux-ui-design.md`, `docs/specs/page-ia/users-referrals-page-ia.md`, `docs/specs/admin-page-tables.md` | 피추천인 사용자명 클릭 링크를 공통 `table-navigation-link` 스타일로 통일하고, 추천 관계 상태값을 기존 우측 액션 위치로 이동하는 규칙을 UX 가이드와 IA 문서에 반영 |
| 2026-03-13 | `Users > 추천인 관리` | Drawer 관계 목록 정리 | `docs/specs/page-ia/users-referrals-page-ia.md`, `docs/specs/admin-page-tables.md` | 추천 관계 목록의 피추천인을 실명 기준 링크로 표시하고, `가입`/`확정`을 세로 배치하며, `정상` 기본 메모는 노출하지 않는 규칙과 상태값 세트를 문서에 반영 |
| 2026-03-13 | `Users > 추천인 관리` | 표시 규칙 정리 | `docs/specs/page-ia/users-referrals-page-ia.md`, `docs/specs/admin-page-tables.md` | 추천인 회원 테이블 셀은 사용자 이름만 노출하고, `더보기` 메뉴의 `상세 보기` 대신 행 클릭으로 Drawer를 여는 규칙을 IA와 테이블 스펙에 반영 |
| 2026-03-13 | `Users > 추천인 관리` | 규칙/필터 동기화 반영 | `docs/specs/page-ia/users-referrals-page-ia.md`, `docs/specs/admin-page-tables.md`, `docs/specs/admin-data-usage-map.md` | 추천인 1명당 코드 1개 규칙을 IA에 명시하고, `코드 상태`/`이상치 여부`를 테이블 컬럼 필터와 URL/store 동기화 기준으로 재정의했다 |
| 2026-03-13 | `Users > 추천인 관리` | 구현 반영 | `docs/specs/page-ia/users-referrals-page-ia.md`, `docs/specs/admin-page-analysis.md`, `docs/specs/admin-page-tables.md` | 추천인 관리 실페이지 구현에 맞춰 상태를 `구현됨`으로 전환하고, 실제 컬럼/필터/Drawer/액션/감사 로그 딥링크 기준을 문서에 동기화 |
| 2026-03-13 | `Users > 강사 관리` | Drawer 컬렉션 테이블화 | `docs/specs/page-ia/users-instructor-management-page-ia.md`, `docs/specs/admin-page-tables.md`, `docs/guidelines/admin-ux-ui-design.md` | 강사 상세 Drawer의 `담당 과정`, `최근 메시지 발송 이력`, `관리자 메모`를 리스트 대신 테이블 기준으로 정리하고, 긴 메모 본문은 expandable row에서 확인하는 규칙을 문서에 반영 |
| 2026-03-13 | `Users > 강사 관리 / Users > 추천인 관리 / Message > 발송 이력` | Drawer 테이블 레이아웃 규칙 적용 | `docs/specs/page-ia/users-instructor-management-page-ia.md`, `docs/specs/page-ia/users-referrals-page-ia.md`, `docs/specs/page-ia/message-history-page-ia.md`, `docs/specs/admin-page-tables.md`, `docs/guidelines/admin-ux-ui-design.md` | Drawer 내부 테이블에 첫 번째 열 고정, 최대 5행 높이, 오른쪽 아래 페이지네이션, 섹션 간격 32px 규칙을 공통 적용하도록 IA와 테이블 스펙을 갱신 |
| 2026-03-13 | IA 문서 구조 정리 | 구조 통합 | `docs/specs/admin-page-analysis.md`, `docs/specs/admin-page-tables.md`, `docs/specs/page-ia/users-referrals-page-ia.md`, `docs/README.md` | `admin-page-ia-drafts.md`와 겹치던 페이지 목적/화면 블록 설명을 `admin-page-analysis.md`와 `page-ia/*.md` 체계로 합치고, `admin-page-ia-drafts.md`는 제거하기로 정리 |
| 2026-03-13 | 공통 IA 템플릿 | 추가 | `docs/templates/admin-page-ia-template.md` | 페이지별 상세 IA를 동일한 형식으로 작성하기 위한 공통 템플릿을 신설하고, 미확정 정책/사용자 영향/B2C 추적 항목을 기본 섹션으로 고정 |
| 2026-03-13 | `Users > 추천인 관리` | 신규 작성 | `docs/specs/page-ia/users-referrals-page-ia.md` | 추천인 관리의 화면 구조, 관리자/사용자 영향도, 미확정 정책(추천 확정 시점/보상 수단/수동 보정 권한)과 추후 결정 포인트를 상세 IA로 정리 |
| 2026-03-13 | 전 관리자 라우트 페이지 | 신규 작성/확장 | `docs/specs/page-ia/*.md`, `docs/specs/admin-page-analysis.md`, `docs/README.md`, `logs/admin-doc-update-log.md` | `admin-page-ia-template.md` 기준으로 redirect alias와 not-found를 제외한 전체 관리자 라우트 페이지의 상세 IA 문서를 작성하고, 문서 현황/인덱스를 새 구조에 맞게 동기화 |
