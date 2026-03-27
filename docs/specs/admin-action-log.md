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
- FAQ 공개/비공개/삭제
- FAQ 대표 노출 추가/수정/일시중지/재개/삭제
- 이벤트 저장/게시 예약/즉시 게시/종료
- 운영 정책 저장/게시/숨김(법률 문서 + 운영 정책 레지스트리 포함)
- 메시지 발송 설정 변경/발송 실행
- 커머스 환불/정책 변경
- 포인트 정책 저장/활성화/중지
- 포인트 수동 적립/차감/회수
- 포인트 소멸 보류/해제/실행
- Assessment/Content 모듈의 주요 저장 액션
- 관리자 권한 변경

## 기본 필드

| 필드        | 설명           |
| ----------- | -------------- |
| Log ID      | 로그 식별자    |
| Admin       | 수행 관리자    |
| Action      | 수행 액션      |
| Target Type | 대상 모듈/유형 |
| Target ID   | 대상 식별자    |
| Reason      | 사유/근거      |
| Time        | 수행 시각      |

## 연결 규칙

- Users, Instructor, Community, Message, Operation, Commerce, Assessment, Content 변경 액션은 감사 로그 대상입니다.
- 감사 로그는 `Target Type`, `Target ID` 기준으로 원본 화면을 역추적할 수 있어야 합니다.
- 성공 피드백(notification)은 감사 로그와 동일한 식별 값을 사용해야 합니다.
- 강사 조치 로그는 `Target Type = Instructor`, `Target ID = instructorId`를 사용합니다.
- 이벤트 조치 로그는 현재 `Target Type = Operation`, `Target ID = eventId`를 사용하고, `EVT-` 접두의 대상 ID는 `/operation/events` 원본 화면으로 역추적할 수 있어야 합니다.
- 운영 정책 조치 로그는 `Target Type = OperationPolicy`, `Target ID = policyId`를 사용하며, `/operation/policies?selected={policyId}` 기준으로 원본 화면을 역추적할 수 있어야 합니다.
- `OperationPolicy`는 이용약관/개인정보 처리방침 같은 법률 문서와 커뮤니티 게시글 제재/추천인 보상/포인트/쿠폰/이벤트/FAQ/챗봇/메시지/권한 변경 정책 같은 운영 정책 레지스트리를 함께 포괄합니다.
- 정책 관리의 `내용 수정`, `새 버전 등록`, `게시`, `숨김`, `삭제`, `이 버전 게시` 액션은 모두 `Target Type = OperationPolicy`, `Target ID = policyId` 계약을 유지합니다.
- `게시`, `숨김`, `삭제`, `이 버전 게시`는 확인 + 사유 입력을 필수로 남깁니다.
- `이 버전 게시`는 성공 피드백과 감사 로그에서 `fromVersionId/toVersionId` 또는 이에 준하는 게시 전환 근거를 함께 남길 수 있어야 합니다.
- FAQ 원문 조치 로그는 `Target Type = OperationFaq`, `Target ID = faqId`를 사용합니다.
- FAQ 대표 노출 조치 로그는 `Target Type = OperationFaqCuration`, `Target ID = curationId`를 사용합니다.
- 포인트 정책 조치 로그는 `Target Type = CommercePointPolicy`, `Target ID = pointPolicyId`를 사용합니다.
- 포인트 원장 조치 로그는 `Target Type = CommercePointLedger`, `Target ID = pointLedgerId`를 사용합니다.
- 포인트 소멸 조치 로그는 `Target Type = CommercePointExpiration`, `Target ID = expirationId`를 사용합니다.
- 쿠폰 조치 로그는 `Target Type = CommerceCoupon`, `Target ID = couponId`를 사용합니다.
- 정기 쿠폰 템플릿 조치 로그는 `Target Type = CommerceCouponTemplate`, `Target ID = templateId`를 사용합니다.
