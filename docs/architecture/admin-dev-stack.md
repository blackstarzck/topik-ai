# TOPIK AI Admin 개발 스택

## 문서 계약

- 기준 모듈: Dashboard, Users, Community, Message, Operation, Commerce, Assessment, Content, Analytics, System
- 메뉴명은 `Users`(복수형)로 표기하며 `User` 단수형을 사용하지 않습니다.
- 로그 용어는 `감사 로그`, `시스템 로그`로 구분합니다.
- 상태관리 구현체는 `Zustand` 단일 원칙을 유지합니다.

## 스택

- UI 프레임워크: `React` + `TypeScript`
- 컴포넌트/디자인 시스템: `Ant Design`
- 빌드 도구: `Vite`
- 라우팅: `React Router`
- 통신 계층: `axios`
- 상태관리: `Zustand`

## 라우팅 원칙

- 라우트는 모듈 경계를 1차 단위로 유지합니다.
- 운영 모듈과 콘텐츠 모듈을 같은 앱 안에 두되, 상위 메뉴를 분리해 역할 경계를 명확히 합니다.
- 상세 정의가 없는 신규 모듈도 placeholder route를 먼저 확보합니다.
- 이전 경로는 가능한 한 redirect로 유지해 탐색 경로를 깨지 않습니다.

## 권한 원칙

- role은 permission 묶음이고, 메뉴 노출과 액션 허용은 permission 기준으로 판단합니다.
- 신규 모듈 추가 시 route보다 먼저 permission key와 role 기본값을 정의합니다.
- `CONTENT_MANAGER`는 Assessment, Content 모듈의 기본 role입니다.

## 성능/복원력 기준

- 테이블 중심 화면은 server-side pagination/filter/sort를 기본값으로 둡니다.
- 네트워크/서버 상태는 최소 `pending`, `success`, `empty`, `error`를 구분합니다.
- fail-safe는 `try-catch` 단독이 아니라 Error Boundary, fallback, retry, timeout을 함께 고려합니다.
- placeholder 페이지도 route 단위 코드 스플리팅을 유지합니다.
