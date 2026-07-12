# TOPIK AI Admin 페이지 동기화 문서 (page-sync)

## 1. 이 폴더는 무엇인가

- 관리자(Admin) 페이지별로 **`목적` / `가능한 작업` / `관리 데이터베이스(CRUD) 후보` / `연관 페이지` / `사용자(B2C) 화면 동기화 포인트`** 를 한 장으로 정리한 문서 모음이다.
- 목적은 **별도로 개발 중인 사용자 화면과 관리자 관리 포인트를 동기화**하는 것이다. 운영자가 각 페이지에서 무엇을 다루는지, 그 데이터가 사용자 화면에 어떻게 이어지는지를 한 곳에서 추적한다.
- **라우트 1개 = 문서 1개** 원칙. 현재 이 README를 포함해 41개 파일이 있고, 페이지 동기화 문서는 40개다.
- 모든 페이지 문서는 [`docs/templates/admin-page-sync-template.md`](../templates/admin-page-sync-template.md)의 동일한 13개 섹션 틀을 따른다.
- 템플릿: `docs/templates/admin-page-sync-template.md`
- 기준 라우트: `src/app/router/routes.ts` (`app-router.tsx`는 shell composition)
- 페이지 IA: `docs/specs/page-ia/*.md`
- 데이터 계약: `docs/specs/admin-data-contract.md`
- B2C 노출 맵: `docs/specs/admin-data-usage-map.md`

## 2. 한 문서가 답하는 것 (13개 섹션 구조)

| # | 섹션 | 담는 내용 |
| --- | --- | --- |
| 1 | 문서 목적 | 이 페이지와 사용자 화면 사이의 동기화 기준이라는 선언 |
| 2 | 페이지 요약 | 모듈 / 페이지명 / 라우트 / 현재 상태 / 목적 한 줄 / 주요 운영자 / 주요 권한 / 연관 SoT 문서 |
| 3 | 이 페이지의 목적 | `목적`과 `비목표`(이 페이지에서 직접 담당하지 않는 일) |
| 4 | 이 페이지에서 할 수 있는 것 | 기능·작업 성격(`조회`/`수정`/`파괴적`)·대상 데이터·결과·**감사 로그 필요 여부** |
| 5 | 관리 데이터베이스(CRUD) | 엔티티/테이블 후보·CRUD 지원 여부·UI 진입점·주요 필드 후보·감사 Target·**B2C 영향**·미확정/차이 |
| 6 | 관리자 조치와 감사 로그 계약 | 파괴적 여부·확인 단계·사유 입력·`Target Type`·`Target ID`·감사 로그 확인 경로 |
| 7 | 사용자 화면 동기화 포인트 | B2C 화면 후보·**영향 상태**·반영 방식·동기화 필요 시점 |
| 8 | 연관 페이지 | 연관 관리자 페이지 / 연관 사용자 화면(관계 유형·이동/연동 방식·선·후행) |
| 9 | 상태값/용어/키워드 정합성 | 표준 값·내부 코드 후보·사용자 노출 라벨 |
| 10 | URL/검색/복원 규칙 | 기본 라우트·쿼리 파라미터·목록/Drawer 복원·동기화 식별자 |
| 11 | 네트워크 상태와 fail-safe | `pending`/`success`/`empty`/`error`별 UI와 복구 경로 |
| 12 | 에이전트 작업 메모 | Codex/Claude 확인 포인트와 양쪽 동기화가 필요한 결정 |
| 13 | 미확정 항목 | 미확정 내용·결정 주체·관리자/사용자 화면 영향·추적 문서 |

## 3. 중요: 데이터베이스 정보는 "확정 스키마"가 아니라 "후보 계약"이다

이 폴더의 CRUD/엔티티/테이블/필드는 **실제 백엔드 확정 스키마가 아니라 관리자 프론트엔드 기준의 후보**다. 전역 기준은 아래 SoT 문서를 우선하고, page-sync 문서에는 **페이지별 차이와 CRUD 후보만** 적는다. 확정 스키마와 다르면 각 문서 5번 섹션의 `미확정/차이`에 근거를 남긴다.

| 무엇 | SoT 문서 |
| --- | --- |
| 전역 데이터 계약/명명 기준 | [`docs/specs/admin-data-contract.md`](../specs/admin-data-contract.md) |
| mock/store/service/API 전환 기준 | [`docs/architecture/admin-data-source-transition.md`](../architecture/admin-data-source-transition.md) |
| B2C 노출 영향 맵 | [`docs/specs/admin-data-usage-map.md`](../specs/admin-data-usage-map.md) |
| 감사 로그 Target 계약 | [`docs/specs/admin-action-log.md`](../specs/admin-action-log.md) |
| 페이지별 상세 IA | [`docs/specs/page-ia/*.md`](../specs/page-ia) |
| 기준 라우트 | `src/app/router/app-router.tsx` |
| 문서 작성 틀 | [`docs/templates/admin-page-sync-template.md`](../templates/admin-page-sync-template.md) |

## 4. 상태/영향 표기 규칙

- **페이지 상태**(frontmatter `status`): `구현됨` · `placeholder` · `기획 필요` · `미확정`
- **사용자 화면 영향 상태**(7번 섹션 등): `확인됨` · `운영상 추정` · `내부 전용` · `노출 예정` · `미확정`
- 빈칸을 남기지 않는다. 확인되지 않은 항목은 `미확정`으로 명시해 추정과 확정을 섞지 않는다.
- 메뉴명은 `Users`처럼 프로젝트 표준 메뉴명을 쓰고, 사용자 노출 라벨은 기본 한글로 적는다.

## 5. 문서 목록 (모듈별)

현재 페이지 동기화 문서 40개 — **`구현됨` 30 / `placeholder` 10**. (placeholder = Content 6개 전부 + EPS TOPIK · 레벨 테스트 · 이커머스 관리 · 챗봇 설정)

### Dashboard

| 페이지 | 라우트 | 상태 |
| --- | --- | --- |
| [대시보드](./dashboard-page-sync.md) | `/dashboard` | 구현됨 |

### Users

| 페이지 | 라우트 | 상태 |
| --- | --- | --- |
| [회원 목록](./users-list-page-sync.md) | `/users` | 구현됨 |
| [회원 상세](./users-detail-page-sync.md) | `/users/:userId` | 구현됨 |
| [강사 관리](./users-instructor-management-page-sync.md) | `/users/groups` | 구현됨 |
| [추천인 관리](./users-referrals-page-sync.md) | `/users/referrals` | 구현됨 |
| [기관 코드](./users-institution-codes-page-sync.md) | `/users/institution-codes` | 구현됨 |

### Community

| 페이지 | 라우트 | 상태 |
| --- | --- | --- |
| [게시글 관리](./community-posts-page-sync.md) | `/community/posts` | 구현됨 |
| [신고 관리](./community-reports-page-sync.md) | `/community/reports` | 구현됨 |

### Message

| 페이지 | 라우트 | 상태 |
| --- | --- | --- |
| [메일](./message-mail-page-sync.md) | `/messages/mail` | 구현됨 |
| [푸시](./message-push-page-sync.md) | `/messages/push` | 구현됨 |
| [인앱 알림 관리](./message-inapp-page-sync.md) | `/messages/in-app` | 구현됨 |
| [대상 그룹](./message-groups-page-sync.md) | `/messages/groups` | 구현됨 |
| [발송 이력](./message-history-page-sync.md) | `/messages/history` | 구현됨 |

### Operation

| 페이지 | 라우트 | 상태 |
| --- | --- | --- |
| [공지사항](./operation-notices-page-sync.md) | `/operation/notices` | 구현됨 |
| [FAQ](./operation-faq-page-sync.md) | `/operation/faq` | 구현됨 |
| [이벤트](./operation-events-page-sync.md) | `/operation/events` | 구현됨 |
| [정책 관리](./operation-policies-page-sync.md) | `/operation/policies` | 구현됨 |
| [PDF 내보내기 제한](./operation-pdf-quota-page-sync.md) | `/operation/pdf-quota` | 구현됨 |
| [챗봇 설정](./operation-chatbot-page-sync.md) | `/operation/chatbot` | placeholder |

### Commerce

| 페이지 | 라우트 | 상태 |
| --- | --- | --- |
| [결제 내역](./commerce-payments-page-sync.md) | `/commerce/payments` | 구현됨 |
| [환불 관리](./commerce-refunds-page-sync.md) | `/commerce/refunds` | 구현됨 |
| [쿠폰 관리](./commerce-coupons-page-sync.md) | `/commerce/coupons` | 구현됨 |
| [포인트 관리](./commerce-points-page-sync.md) | `/commerce/points` | 구현됨 |
| [이커머스 관리](./commerce-store-page-sync.md) | `/commerce/store` | placeholder |

### Assessment

| 페이지 | 라우트 | 상태 |
| --- | --- | --- |
| [TOPIK 쓰기 문항 목록](./assessment-question-bank-page-sync.md) | `/assessment/question-bank` | 구현됨 |
| [EPS TOPIK](./assessment-question-bank-eps-topik-page-sync.md) | `/assessment/question-bank/eps-topik` | placeholder |
| [레벨 테스트](./assessment-level-tests-page-sync.md) | `/assessment/level-tests` | placeholder |

### Content

| 페이지 | 라우트 | 상태 |
| --- | --- | --- |
| [콘텐츠 관리](./content-library-page-sync.md) | `/content/library` | placeholder |
| [배지](./content-badges-page-sync.md) | `/content/badges` | placeholder |
| [단어장](./content-vocabulary-page-sync.md) | `/content/vocabulary` | placeholder |
| [소나기](./content-vocabulary-sonagi-page-sync.md) | `/content/vocabulary/sonagi` | placeholder |
| [객관식 선택](./content-vocabulary-multiple-choice-page-sync.md) | `/content/vocabulary/multiple-choice` | placeholder |
| [학습 미션](./content-missions-page-sync.md) | `/content/missions` | placeholder |

### Analytics

| 페이지 | 라우트 | 상태 |
| --- | --- | --- |
| [통계 개요](./analytics-overview-page-sync.md) | `/analytics/overview` | 구현됨 |
| [학습 분석](./analytics-learning-page-sync.md) | `/analytics/learning` | 구현됨 |

### System

| 페이지 | 라우트 | 상태 |
| --- | --- | --- |
| [관리자 계정](./system-admins-page-sync.md) | `/system/admins` | 구현됨 |
| [권한 관리](./system-permissions-page-sync.md) | `/system/permissions` | 구현됨 |
| [메타데이터 관리](./system-metadata-page-sync.md) | `/system/metadata` | 구현됨 |
| [감사 로그](./system-audit-logs-page-sync.md) | `/system/audit-logs` | 구현됨 |
| [시스템 로그](./system-logs-page-sync.md) | `/system/logs` | 구현됨 |

## 6. 작성·갱신 규칙

- 새 페이지 동기화 문서는 [`admin-page-sync-template.md`](../templates/admin-page-sync-template.md)를 복제해 `docs/page-sync/*.md` 경로에 만든다.
- 페이지의 `목적` / `가능한 작업` / `CRUD 후보` / `감사 로그 계약` / `B2C 동기화 포인트`가 바뀌면 해당 page-sync 문서를 **같은 작업에서** 평가·반영한다. (`AGENTS.md` §7 문서 동기화 규칙)
- `docs/**` 문서를 추가/삭제/이동하면 같은 작업에서 [`docs/README.md`](../README.md) 인덱스를 갱신하고, MD를 수정하면 [`logs/admin-doc-update-log.md`](../../logs/admin-doc-update-log.md)에 변경 요약을 1건 기록한다.
- B2C 노출 위치/맥락이 바뀌면 [`admin-data-usage-map.md`](../specs/admin-data-usage-map.md), 엔티티/테이블/필드 후보가 바뀌면 [`admin-data-contract.md`](../specs/admin-data-contract.md), 감사 계약이 바뀌면 [`admin-action-log.md`](../specs/admin-action-log.md)를 함께 평가·반영한다.
- 구조/문서 드리프트 검증은 `npm run harness:check`를 사용한다.
