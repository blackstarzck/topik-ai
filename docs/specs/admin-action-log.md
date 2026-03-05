# System > 감사 로그

이 문서는 관리자 조치 이력 추적 기능의 기준 문서입니다.
용어는 `감사 로그`로 통일합니다.

## 1) 목적

- 어떤 관리자가 어떤 데이터를 어떻게 변경했는지 추적
- 운영 사고 발생 시 원인 분석과 복구 근거 제공
- 권한 오남용 방지 및 컴플라이언스 대응

## 2) 메뉴 위치

```text
System
 ├ 관리자 계정
 ├ 권한 관리
 ├ 정책 관리
 ├ 감사 로그
 └ 시스템 로그
```

## 3) 반드시 기록해야 하는 액션

- 회원 정지/정지 해제/탈퇴 처리
- 게시글 숨김/삭제
- 공지사항 수정/삭제
- 결제 환불/취소 처리
- 관리자 권한 변경, 관리자 계정 생성/비활성화

## 4) 감사 로그 테이블

| 컬럼 | 설명 |
| --- | --- |
| Log ID | 로그 번호 |
| Admin | 관리자 계정 |
| Action | 수행 액션 코드 |
| Target Type | 대상 종류 (USER/POST/PAYMENT/NOTICE 등) |
| Target ID | 대상 ID |
| Before | 변경 전 데이터 스냅샷 |
| After | 변경 후 데이터 스냅샷 |
| IP | 관리자 IP |
| Time | 실행 시간 |

## 5) 필터

- 관리자
- 행동 유형(Action)
- 대상 타입(Target Type)
- 대상 ID
- 기간

## 6) 예시 로그

| Admin | Action | Target | Time |
| --- | --- | --- | --- |
| admin01 | USER_SUSPEND | user_1032 | 2026-03-05 12:10 |
| admin02 | POST_DELETE | post_882 | 2026-03-05 11:22 |
| admin03 | NOTICE_EDIT | notice_21 | 2026-03-05 10:41 |

## 7) 연계 규칙

- Users/Community/Operation/Billing에서 데이터 변경이 발생하면 감사 로그를 반드시 생성
- 감사 로그의 `Target ID`로 원본 화면 역추적 가능해야 함
- 시스템 로그(기술 로그)와 목적이 다르므로 화면/권한을 분리 운영

## 8) Notification 연계 계약

- 조치 성공 직후 노출되는 `notification`은 감사 로그 레코드와 동일한 사실을 표시해야 합니다.
- notification 필드와 감사 로그 필드 매핑:
  - `대상 유형` -> `Target Type`
  - `대상 ID` -> `Target ID`
  - `조치명` -> `Action`
  - `사유/근거` -> `Reason`
- notification의 `감사 로그 확인` 링크는 아래 우선순위로 생성합니다.
  - 1순위: `auditLogId` 직접 딥링크
  - 2순위: `targetType + targetId` 필터 딥링크
- notification 표시 문자열을 수동 하드코딩하지 않고, 조치 응답/로그 생성 결과를 단일 원천 데이터로 사용합니다.
- 조치 성공 이벤트에서는 `notification` 단일 채널을 사용하고 `message.success` 중복 노출을 금지합니다.
