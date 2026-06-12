# TOPIK AI Admin 페이지 동기화 문서 인덱스

이 폴더는 관리자 페이지별 목적, 가능한 작업, 관리 데이터베이스(CRUD) 후보, 연관 관리자/사용자 페이지를 사용자 화면 개발과 동기화하기 위해 정리한 문서를 모읍니다.

- 템플릿: `docs/templates/admin-page-sync-template.md`
- 기준 라우트: `src/app/router/routes.ts` (`app-router.tsx`는 shell composition)
- 페이지 IA: `docs/specs/page-ia/*.md`
- 데이터 계약: `docs/specs/admin-data-contract.md`
- B2C 노출 맵: `docs/specs/admin-data-usage-map.md`

## DB/API 연결 준비 정보

현재 저장소에는 실제 SQL, Prisma, migration 파일이 없고, DB 연결 준비 정보는 후보 계약 문서로 관리합니다.

- 전역 데이터 계약: `docs/specs/admin-data-contract.md`
- mock/store/service/API 전환 기준: `docs/architecture/admin-data-source-transition.md`
- 페이지별 CRUD 후보: `docs/page-sync/*.md`의 `관리 데이터베이스(CRUD)` 섹션
- B2C 노출 영향: `docs/specs/admin-data-usage-map.md`
- 감사 로그 Target 계약: `docs/specs/admin-action-log.md`

각 page-sync 문서의 데이터베이스 정보는 실제 백엔드 확정 스키마가 아니라 관리자 프론트엔드 기준의 엔티티/테이블/필드 후보입니다.

## 문서 목록

### Dashboard

- [대시보드](./dashboard-page-sync.md) - `/dashboard`

### Users

- [회원 목록](./users-list-page-sync.md) - `/users`
- [회원 상세](./users-detail-page-sync.md) - `/users/:userId`
- [강사 관리](./users-instructor-management-page-sync.md) - `/users/groups`
- [추천인 관리](./users-referrals-page-sync.md) - `/users/referrals`

### Community

- [게시글 관리](./community-posts-page-sync.md) - `/community/posts`
- [신고 관리](./community-reports-page-sync.md) - `/community/reports`

### Message

- [메일](./message-mail-page-sync.md) - `/messages/mail`
- [푸시](./message-push-page-sync.md) - `/messages/push`
- [대상 그룹](./message-groups-page-sync.md) - `/messages/groups`
- [발송 이력](./message-history-page-sync.md) - `/messages/history`

### Operation

- [공지사항](./operation-notices-page-sync.md) - `/operation/notices`
- [FAQ](./operation-faq-page-sync.md) - `/operation/faq`
- [이벤트](./operation-events-page-sync.md) - `/operation/events`
- [정책 관리](./operation-policies-page-sync.md) - `/operation/policies`
- [챗봇 설정](./operation-chatbot-page-sync.md) - `/operation/chatbot`

### Commerce

- [결제 내역](./commerce-payments-page-sync.md) - `/commerce/payments`
- [환불 관리](./commerce-refunds-page-sync.md) - `/commerce/refunds`
- [쿠폰 관리](./commerce-coupons-page-sync.md) - `/commerce/coupons`
- [포인트 관리](./commerce-points-page-sync.md) - `/commerce/points`
- [이커머스 관리](./commerce-store-page-sync.md) - `/commerce/store`

### Assessment

- [TOPIK 쓰기 문제은행](./assessment-question-bank-page-sync.md) - `/assessment/question-bank`
- [EPS TOPIK](./assessment-question-bank-eps-topik-page-sync.md) - `/assessment/question-bank/eps-topik`
- [레벨 테스트](./assessment-level-tests-page-sync.md) - `/assessment/level-tests`

### Content

- [콘텐츠 관리](./content-library-page-sync.md) - `/content/library`
- [배지](./content-badges-page-sync.md) - `/content/badges`
- [단어장](./content-vocabulary-page-sync.md) - `/content/vocabulary`
- [소나기](./content-vocabulary-sonagi-page-sync.md) - `/content/vocabulary/sonagi`
- [객관식 선택](./content-vocabulary-multiple-choice-page-sync.md) - `/content/vocabulary/multiple-choice`
- [학습 미션](./content-missions-page-sync.md) - `/content/missions`

### Analytics

- [통계 개요](./analytics-overview-page-sync.md) - `/analytics/overview`

### System

- [관리자 계정](./system-admins-page-sync.md) - `/system/admins`
- [권한 관리](./system-permissions-page-sync.md) - `/system/permissions`
- [메타데이터 관리](./system-metadata-page-sync.md) - `/system/metadata`
- [감사 로그](./system-audit-logs-page-sync.md) - `/system/audit-logs`
- [시스템 로그](./system-logs-page-sync.md) - `/system/logs`
