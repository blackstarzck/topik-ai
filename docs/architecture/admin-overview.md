# TOPIK AI Admin 개요

## 1. 목적

- 이 문서는 기존 `정보 구조`, `개발 스택`, `프론트엔드 아키텍처`, `페이지 분석` 문서를 통합한 상위 개요 SoT다.
- 관리자 프론트엔드의 용어, 메뉴 구조, 라우팅, 역할, 기술 스택, 페이지 상태, 문서 운영 기준을 한 곳에서 확인할 수 있게 유지한다.
- 상세 구현 규칙과 페이지별 계약은 개별 SoT 문서에서 관리하고, 이 문서는 상위 기준과 연결 관계를 관리한다.

## 2. 우선순위와 적용 범위

- 우선순위: 사용자 직접 요청 > `AGENTS.md` > 본 문서 > 세부 가이드/스펙 문서
- 적용 범위: `Dashboard`, `Users`, `Community`, `Message`, `Operation`, `Commerce`, `Assessment`, `Content`, `Analytics`, `System`
- 제외 범위: 백엔드 아키텍처, 배포/인프라, DB 스키마 설계

## 3. 문서 운영 원칙

- 데이터 정합성을 우선하며, 엔티티명/필드명/상태값/Target Type/Target ID 기준은 항상 `docs/specs/admin-data-contract.md`, `docs/specs/admin-action-log.md`와 함께 검토한다.
- 디자인, 레이아웃, 컴포넌트 일관성은 개별 페이지 편의보다 우선하며, 공통 UI 기준은 `docs/guidelines/admin-coding-guidelines-antigravity.md`와 `docs/guidelines/admin-ux-ui-design.md`를 기준으로 유지한다.
- 운영/정책 관련 내용은 구현 상태와 무관하게 지속 모니터링 대상으로 두고, 정책/운영 규칙 변경이 확인되면 같은 작업에서 관련 MD를 갱신한다.
- 사용자 요구사항이 MD 문서의 수정/삭제와 직접 관련되면 문서는 코드와 별개로 같은 작업에서 즉시 갱신한다.
- 모든 작업 보고에는 사용자 요구사항이 프로젝트에 미칠 영향 범위를 최소 `영향 모듈`, `데이터 계약`, `공통 UI`, `운영/정책`, `검증 범위` 기준으로 명시한다.

## 4. 용어와 구조 계약

- 메뉴명은 항상 `Users` 복수형을 사용하고 `User` 단수형은 사용하지 않는다.
- 관리자 조치 기록은 `감사 로그`, 기술 로그는 `시스템 로그`로 구분한다.
- `Users > 회원 상세` 탭은 `프로필`, `활동`, `결제`, `커뮤니티`, `로그`, `관리자 메모`로 고정한다.
- 사용자 노출 UI 라벨은 기본 한글을 사용하고, 제품명/외부 서비스명/코드/법적 고유 명칭만 영문 예외로 허용한다.
- 공통 운영 흐름은 `검색 -> 상세 -> 조치 -> 감사 로그 확인`을 기본값으로 유지한다.
- 콘텐츠형 편집 화면은 `작성/수정 -> 확인 -> 발행 -> 감사 로그 확인` 흐름을 추가로 가진다.

## 5. 메뉴와 라우트 맵

| 모듈 | 대표 라우트 | 주요 페이지 |
| --- | --- | --- |
| Dashboard | `/dashboard` | 대시보드 |
| Users | `/users`, `/users/:userId`, `/users/groups`, `/users/referrals` | 회원 목록, 회원 상세, 강사 관리, 추천인 관리 |
| Community | `/community/posts`, `/community/reports` | 게시글 관리, 신고 관리 |
| Message | `/messages/mail`, `/messages/push`, `/messages/groups`, `/messages/history` | 메일, 푸시, 대상 그룹, 발송 이력 |
| Operation | `/operation/notices`, `/operation/faq`, `/operation/events`, `/operation/policies`, `/operation/chatbot` | 공지사항, FAQ, 이벤트, 정책 관리, 챗봇 설정 |
| Commerce | `/commerce/payments`, `/commerce/refunds`, `/commerce/coupons`, `/commerce/points`, `/commerce/store` | 결제 내역, 환불 관리, 쿠폰 관리, 포인트 관리, 이커머스 관리 |
| Assessment | `/assessment/question-bank`, `/assessment/question-bank/review/:questionId`, `/assessment/question-bank/eps-topik`, `/assessment/level-tests` | TOPIK 쓰기 문제은행, 검수 페이지, EPS TOPIK, 레벨 테스트 |
| Content | `/content/library`, `/content/badges`, `/content/vocabulary`, `/content/vocabulary/sonagi`, `/content/vocabulary/multiple-choice`, `/content/missions` | 콘텐츠 관리, 배지, 단어장, 소나기, 객관식 선택, 학습 미션 |
| Analytics | `/analytics/overview` | 통계 개요 |
| System | `/system/admins`, `/system/permissions`, `/system/metadata`, `/system/audit-logs`, `/system/logs` | 관리자 계정, 권한 관리, 메타데이터 관리, 감사 로그, 시스템 로그 |

## 6. 역할과 권한 방향

- `SUPER_ADMIN`: 전체 메뉴 접근 및 고위험 액션 가능
- `OPS_ADMIN`: `Users`, `Community`, `Message`, `Operation`, `Commerce` 중심 운영 담당
- `CONTENT_MANAGER`: `Assessment`, `Content` 중심 운영 담당
- `CS_MANAGER`: 조회, 메모, 신고 처리, 이력 확인 중심
- `READ_ONLY`: 조회 전용
- role은 permission 묶음이며, 실제 메뉴 노출과 액션 허용은 permission 기준으로 해석한다.

## 7. 기술 스택과 복원력 기준

- UI 프레임워크: `React` + `TypeScript`
- 디자인 시스템: `Ant Design`
- 라우팅: `React Router`
- 상태관리: `Zustand`
- 통신 계층: `axios`
- 빌드 도구: `Vite`
- 테이블 중심 화면은 server-side pagination/filter/sort를 기본값으로 둔다.
- 네트워크/서버 상태는 최소 `pending`, `success`, `empty`, `error`를 구분한다.
- fail-safe는 `try-catch` 단독이 아니라 Error Boundary, fallback, retry, timeout, 마지막 성공 상태 fallback까지 함께 고려한다.
- placeholder 화면도 route, breadcrumb, permission key, URL 축은 먼저 확보한다.

## 8. 페이지 상태 맵

| 페이지 | 현재 상태 | 페이지 유형 |
| --- | --- | --- |
| 대시보드 | 구현됨 | 대시보드형 |
| 회원 목록 | 구현됨 | 목록 운영형 |
| 회원 상세 | 구현됨 | 상세 드릴다운형 |
| 강사 관리 | 구현됨 | 목록 운영형 |
| 추천인 관리 | 구현됨 | 목록 운영형 |
| 게시글 관리 | 구현됨 | 목록 운영형 |
| 신고 관리 | 구현됨 | 목록 운영형 |
| 메일 | 구현됨 | 정책/시나리오 편집형 + 목록 운영형 혼합 |
| 푸시 | 구현됨 | 정책/시나리오 편집형 + 목록 운영형 혼합 |
| 대상 그룹 | 구현됨 | 목록 운영형 |
| 발송 이력 | 구현됨 | 목록 운영형 |
| 공지사항 | 구현됨 | 목록 운영형 |
| FAQ | 구현됨 | 목록 운영형 |
| 이벤트 | 구현됨 | 목록 운영형 + 등록 상세 페이지 |
| 정책 관리 | 구현됨 | 목록 운영형 + 등록 상세 페이지 |
| 챗봇 설정 | placeholder | 정책/시나리오 편집형 |
| 결제 내역 | 구현됨 | 목록 운영형 |
| 환불 관리 | 구현됨 | 목록 운영형 |
| 쿠폰 관리 | 구현됨 | 목록 운영형 + 등록 상세 페이지 |
| 포인트 관리 | 구현됨 | 목록 운영형 + 상세 Drawer + 입력 Modal 조합 |
| 이커머스 관리 | placeholder | 목록 운영형 |
| TOPIK 쓰기 문제은행 | 구현됨 | 목록 운영형 + 2depth 검수 페이지 |
| EPS TOPIK | placeholder | 편집/미리보기 병행형 |
| 레벨 테스트 | placeholder | 편집/미리보기 병행형 |
| 콘텐츠 관리 | placeholder | 카탈로그/자산 관리형 |
| 배지 | placeholder | 카탈로그/자산 관리형 |
| 단어장 | placeholder | 카탈로그/자산 관리형 |
| 소나기 | placeholder | 편집/미리보기 병행형 |
| 객관식 선택 | placeholder | 편집/미리보기 병행형 |
| 학습 미션 | placeholder | 정책/시나리오 편집형 |
| 통계 개요 | 구현됨 | 대시보드형 |
| 관리자 계정 | 구현됨 | 목록 운영형 |
| 권한 관리 | 구현됨 | 목록 운영형 |
| 메타데이터 관리 | 구현됨 | 목록 운영형 |
| 감사 로그 | 구현됨 | 목록 운영형 |
| 시스템 로그 | 구현됨 | 목록 운영형 |

## 9. 모듈 책임 요약

- `Users`: 회원 운영, 상세 검수, 강사 운영, 추천 관계/보상 검수
- `Community`: 게시글 moderation, 신고 처리, 제재 연계
- `Message`: 메일/푸시 발송 정책, 대상 그룹, 이력/재시도 검수
- `Operation`: 공지/FAQ/이벤트/정책/챗봇 등 서비스 운영성 콘텐츠와 규칙 관리
- `Commerce`: 결제/환불/쿠폰/포인트/상품 운영
- `Assessment`: 시험/문항/검수 워크스페이스
- `Content`: 학습 자산/보상형 콘텐츠 카탈로그와 편집
- `Analytics`: 핵심 운영 KPI와 교차 분석 진입
- `System`: 관리자 계정/권한/메타데이터/감사 로그/시스템 로그 운영

## 10. 문서 연결 기준

- 공통 구현/UX 기준: `docs/guidelines/admin-coding-guidelines-antigravity.md`, `docs/guidelines/admin-ux-ui-design.md`
- 검증 하네스: `docs/harness/index.md`
- 상세 Drawer 기준: `docs/guidelines/admin-detail-drawer-guidelines.md`
- 데이터 소스 경계: `docs/architecture/admin-data-source-transition.md`
- 데이터 계약/명명: `docs/specs/admin-data-contract.md`
- 페이지별 테이블/입력: `docs/specs/admin-page-tables.md`
- 감사 로그 계약: `docs/specs/admin-action-log.md`
- 관리 데이터 B2C 노출 추적: `docs/specs/admin-data-usage-map.md`
- 정책 소스 추적: `docs/specs/admin-policy-source-map.md`
- 미확정/누락/오구현 추적: `docs/specs/admin-page-gap-register.md`
- 페이지별 상세 계약: `docs/specs/page-ia/*.md`
- 머지 게이트와 증빙: `docs/checklists/admin-essential-checklist.md`
