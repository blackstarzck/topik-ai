# TOPIK AI Admin 프론트엔드 아키텍처

## 문서 계약

- 기준 모듈: Dashboard, Users, Community, Message, Operation, Commerce, Assessment, Content, Analytics, System
- 메뉴명은 `Users`(복수형)로 표기하며 `User` 단수형을 사용하지 않습니다.
- 로그 용어는 `감사 로그`, `시스템 로그`로 구분합니다.
- Users 상세 탭은 `프로필`, `활동`, `결제`, `커뮤니티`, `로그`, `관리자 메모` 6개를 고정합니다.
- role 확장의 기본 축은 `SUPER_ADMIN`, `OPS_ADMIN`, `CONTENT_MANAGER`, `CS_MANAGER`, `READ_ONLY`입니다.

## 개요

이 문서는 프론트엔드 한정 blueprint입니다. 목표는 운영형 모듈과 콘텐츠형 모듈을 같은 앱 안에서 분리된 책임으로 운영하고, role/permission 기준으로 메뉴와 액션을 확장 가능하게 유지하는 것입니다.

- 범위: 라우팅, 화면 모듈 경계, 상태 관리, 권한/role, 공통 UI 패턴
- 핵심 흐름: `검색 -> 상세 -> 조치 -> 감사 로그 확인`
- placeholder 원칙: 상세 기능이 미정이어도 메뉴 자리, route, breadcrumb, permission key는 먼저 확보

## 라우팅/메뉴 경계

| 모듈 | 대표 라우트 | 주요 페이지 |
| --- | --- | --- |
| Dashboard | `/dashboard` | 운영 현황 |
| Users | `/users`, `/users/:userId`, `/users/groups`, `/users/referrals` | 회원 목록, 회원 상세, 강사 관리, 추천인 관리 |
| Community | `/community/posts`, `/community/reports` | 게시글 관리, 신고 관리 |
| Message | `/messages/mail`, `/messages/push`, `/messages/groups`, `/messages/history` | 메일, 푸시, 대상 그룹, 발송 이력 |
| Operation | `/operation/notices`, `/operation/faq`, `/operation/events`, `/operation/chatbot` | 공지사항, FAQ, 이벤트, 챗봇 설정 |
| Commerce | `/commerce/payments`, `/commerce/refunds`, `/commerce/coupons`, `/commerce/points`, `/commerce/store` | 결제 내역, 환불 관리, 쿠폰 관리, 포인트 관리, 이커머스 관리 |
| Assessment | `/assessment/question-bank`, `/assessment/question-bank/eps-topik`, `/assessment/level-tests` | 문제은행, EPS TOPIK, 레벨 테스트 |
| Content | `/content/library`, `/content/badges`, `/content/vocabulary`, `/content/vocabulary/sonagi`, `/content/vocabulary/multiple-choice`, `/content/missions` | 콘텐츠 관리, 배지, 단어장, 소나기, 객관식 선택, 학습 미션 |
| Analytics | `/analytics/overview` | 통계 개요 |
| System | `/system/admins`, `/system/permissions`, `/system/audit-logs`, `/system/logs` | 관리자 계정, 권한 관리, 감사 로그, 시스템 로그 |

## 권한/role 구조

- role은 permission 묶음이며, 메뉴 노출과 액션 활성화는 permission 기준으로 해석합니다.
- `SUPER_ADMIN`: 전체 접근
- `OPS_ADMIN`: Users, Community, Message, Operation, Commerce 중심
- `CONTENT_MANAGER`: Assessment, Content 중심
- `CS_MANAGER`: 조회/메모/신고 처리/이력 확인 중심
- `READ_ONLY`: 조회 중심

## 상태와 URL

- URL은 페이지, 정렬, 필터, 탭 상태를 복원 가능한 수준으로 유지합니다.
- 서버 상태와 UI 상태는 분리하며, 상태관리 구현체는 `Zustand` 단일 원칙을 유지합니다.
- placeholder 페이지도 고유 route와 breadcrumb를 가져야 하며, 나중에 실페이지로 대체되어도 URL 축은 유지합니다.

## 공통 UI 패턴

- 목록 화면: SearchBar + Table + 후속 액션
- 상세형 화면: 링크 이동 또는 Drawer/Modal 기반 drill-down
- 파괴적 액션: 확인 단계 + 사유 입력 + 감사 로그 진입 경로
- placeholder 화면: role 후보, 예정 기능, 메모를 담은 공용 `AdminPlaceholderPage` 사용

## 운영 로그 연결

- Users, Community, Message, Operation, Commerce, Assessment, Content의 변경 액션은 모두 감사 로그 추적 대상입니다.
- 성공 피드백에는 `Target Type`, `Target ID`, 감사 로그 링크를 제공해야 합니다.
