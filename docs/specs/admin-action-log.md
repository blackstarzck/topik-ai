# System > 감사 로그

이 문서는 관리자 조치 이력 추적 기능의 기준 문서입니다.

## 목적

- 어떤 관리자가 어떤 대상을 어떻게 변경했는지 추적
- 운영 사고 분석과 복구 근거 제공
- role/permission 변경까지 포함한 거버넌스 확보

## 반드시 기록해야 하는 액션

- 회원 정지/해제/탈퇴
- 강사 정지/해제
- 게시글 숨김/삭제
- 메시지 발송 설정 변경/발송 실행
- 커머스 환불/정책 변경
- Assessment/Content 모듈의 주요 저장 액션
- 관리자 권한 변경

## 기본 필드

| 필드 | 설명 |
| --- | --- |
| Log ID | 로그 식별자 |
| Admin | 수행 관리자 |
| Action | 수행 액션 |
| Target Type | 대상 모듈/유형 |
| Target ID | 대상 식별자 |
| Reason | 사유/근거 |
| Time | 수행 시각 |

## 연결 규칙

- Users, Instructor, Community, Message, Operation, Commerce, Assessment, Content 변경 액션은 감사 로그 대상입니다.
- 감사 로그는 `Target Type`, `Target ID` 기준으로 원본 화면을 역추적할 수 있어야 합니다.
- 성공 피드백(notification)은 감사 로그와 동일한 식별 값을 사용해야 합니다.
- 강사 조치 로그는 `Target Type = Instructor`, `Target ID = instructorId`를 사용합니다.
