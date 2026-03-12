# TOPIK AI Admin 정보 구조(IA)

이 문서는 관리자 페이지 문서들의 기준 축입니다. 메뉴명, 탭명, 로그 용어, role 방향은 본 문서를 기준으로 통일합니다.

## 1) 최종 메뉴 구조 (GNB/LNB)

```text
TOPIK AI Admin

├ Dashboard
│
├ Users
│  ├ 회원 목록
│  ├ 강사 관리
│  ├ 추천인 관리
│  └ 회원 상세
│     ├ 프로필
│     ├ 활동
│     ├ 결제
│     ├ 커뮤니티
│     ├ 로그
│     └ 관리자 메모
│
├ Community
│  ├ 게시글 관리
│  └ 신고 관리
│
├ Message
│  ├ 메일
│  │  ├ 자동 발송
│  │  └ 수동 발송
│  ├ 푸시
│  │  ├ 자동 발송
│  │  └ 수동 발송
│  ├ 대상 그룹
│  └ 발송 이력
│
├ Operation
│  ├ 공지사항
│  ├ FAQ
│  ├ 이벤트
│  └ 챗봇 설정
│
├ Commerce
│  ├ 결제 내역
│  ├ 환불 관리
│  ├ 쿠폰 관리
│  ├ 포인트 관리
│  └ 이커머스 관리
│
├ Assessment
│  ├ 문제은행
│  │  └ EPS TOPIK
│  └ 레벨 테스트
│
├ Content
│  ├ 콘텐츠 관리
│  ├ 배지
│  ├ 단어장
│  │  ├ 소나기
│  │  └ 객관식 선택
│  └ 학습 미션
│
├ Analytics
│  └ 통계 개요
│
└ System
   ├ 관리자 계정
   ├ 권한 관리
   ├ 감사 로그
   └ 시스템 로그
```

## 2) 문서 간 용어 통일 규칙

- 메뉴명은 `Users`(복수형)로 표기합니다. `User` 단수형은 사용하지 않습니다.
- 관리자 행동 기록은 `감사 로그`로 통일합니다.
- `시스템 로그`는 서버/API 기술 로그, `감사 로그`는 관리자 조치 로그로 구분합니다.
- `회원 상세` 탭은 `프로필 / 활동 / 결제 / 커뮤니티 / 로그 / 관리자 메모`로 고정합니다.
- 결제/쿠폰/포인트/상품 운영 묶음은 `Commerce`로 통일합니다.
- `Assessment`와 `Content`는 상세 기능 정의 전이라도 메뉴 자리와 role 경계는 선반영합니다.

## 3) role 방향

- `SUPER_ADMIN`: 전체 메뉴 접근 및 고위험 액션 가능
- `OPS_ADMIN`: Users, Community, Message, Operation, Commerce 중심 운영 담당
- `CONTENT_MANAGER`: Assessment, Content 중심 운영 담당
- `CS_MANAGER`: 조회, 메모, 신고 처리, 이력 확인 중심
- `READ_ONLY`: 조회 전용

## 4) 문서 연결 관계

- `docs/specs/admin-page-analysis.md`: 각 모듈 목적과 핵심 기능 정의
- `docs/specs/admin-page-tables.md`: 페이지별 목록 컬럼/필터/액션 정의
- `docs/specs/admin-data-usage-map.md`: 관리자 데이터와 B2C 노출 위치/사용 맥락 매핑
- `docs/specs/admin-user-detail-page-structure.md`: `Users > 회원 상세` 상세 설계
- `docs/specs/admin-action-log.md`: `System > 감사 로그` 상세 설계

## 5) 운영 관점 원칙

- 운영 기본 흐름은 `검색 -> 상세 진입 -> 조치 -> 감사 로그 확인`입니다.
- placeholder 상태의 메뉴도 브레드크럼, 권한, 감사 추적 관점에서 먼저 자리잡아야 합니다.
- 데이터 변경 액션은 반드시 `감사 로그`에 남겨 추적 가능해야 합니다.
