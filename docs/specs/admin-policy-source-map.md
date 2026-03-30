# 관리자 정책 소스 맵

## 1. 목적

- 이 문서는 관리자 코드베이스와 MD 문서에 흩어진 운영/정책 근거를 `Operation > 정책 관리`에서 어떤 정책 레코드로 집약하는지 추적하는 SoT다.
- 법률/약관 문서와 운영 규칙 문서를 같은 카탈로그에서 다루되, 사용자 노출 문서와 관리자 전용 정책 후보를 혼합하지 않도록 `운영 영역`, `정책 추적 상태`, `연관 관리자 화면`, `추적 근거 문서`를 함께 기록한다.

## 2. 상태 기준

| 값 | 의미 |
| --- | --- |
| `코드 반영` | 현재 코드/화면에 실제 정책 또는 운영 규칙이 반영되어 있다. |
| `문서 추적` | 현재는 IA/운영 문서 중심으로 추적하고 있으며, 일부 규칙이 미완성 또는 mock 단계다. |
| `정책 미확정` | placeholder 또는 오픈 이슈 단계로, 정책 항목은 추적 중이지만 화면/승인 체계가 확정되지 않았다. |

## 3. 정책 카탈로그 매핑

| 정책 ID | 정책 유형 | 운영 영역 | 정책 추적 상태 | 연관 관리자 화면 | 추적 근거 문서 |
| --- | --- | --- | --- | --- | --- |
| `POL-001` | 이용약관 | 법률/약관 | 코드 반영 | `Operation > 정책 관리`, `Users > 회원 목록`, `Users > 회원 상세` | `docs/specs/page-ia/operation-policies-page-ia.md`, `docs/specs/admin-data-usage-map.md` |
| `POL-002` | 개인정보 처리방침 | 법률/약관 | 코드 반영 | `Operation > 정책 관리`, `Users > 회원 상세`, `Message > 메일` | `docs/specs/page-ia/operation-policies-page-ia.md`, `docs/specs/admin-data-usage-map.md` |
| `POL-003` | 결제ㆍ환불 정책 | 결제/리워드 | 문서 추적 | `Commerce > 결제 내역`, `Commerce > 환불 관리`, `Commerce > 포인트 관리` | `docs/specs/page-ia/commerce-refunds-page-ia.md`, `docs/specs/page-ia/commerce-payments-page-ia.md`, `docs/specs/admin-page-gap-register.md` |
| `POL-004` | 청소년 보호정책 | 커뮤니티/안전 | 코드 반영 | `Community > 게시글 관리`, `Community > 신고 관리`, `Operation > 정책 관리` | `docs/specs/page-ia/community-posts-page-ia.md`, `docs/specs/admin-page-gap-register.md` |
| `POL-005` | 커뮤니티 게시글 제재 정책 | 커뮤니티/안전 | 코드 반영 | `Community > 게시글 관리`, `Community > 신고 관리`, `System > 감사 로그` | `docs/specs/page-ia/community-posts-page-ia.md`, `src/features/community/pages/community-posts-page.tsx` |
| `POL-006` | 추천인 보상 정책 | 결제/리워드 | 문서 추적 | `Users > 추천인 관리`, `Commerce > 포인트 관리`, `System > 감사 로그` | `docs/specs/page-ia/users-referrals-page-ia.md`, `src/features/users/pages/users-referrals-page.tsx` |
| `POL-007` | 포인트 운영정책 | 결제/리워드 | 문서 추적 | `Commerce > 포인트 관리`, `Users > 추천인 관리`, `Operation > 이벤트` | `docs/specs/page-ia/commerce-points-page-ia.md`, `docs/specs/admin-page-gap-register.md` |
| `POL-008` | 쿠폰 운영정책 | 결제/리워드 | 코드 반영 | `Commerce > 쿠폰 관리`, `Operation > 이벤트`, `Message > 메일` | `docs/specs/page-ia/commerce-coupons-page-ia.md`, `docs/specs/page-ia/operation-events-page-ia.md` |
| `POL-009` | 이벤트 운영정책 | 운영/콘텐츠 | 문서 추적 | `Operation > 이벤트`, `Commerce > 쿠폰 관리`, `Message > 대상 그룹` | `docs/specs/page-ia/operation-events-page-ia.md`, `docs/specs/admin-page-gap-register.md` |
| `POL-010` | FAQ 노출 정책 | 운영/콘텐츠 | 코드 반영 | `Operation > FAQ`, `Operation > 챗봇`, `System > 감사 로그` | `docs/specs/page-ia/operation-faq-page-ia.md`, `docs/specs/admin-data-usage-map.md` |
| `POL-011` | 챗봇 상담 전환 정책 | 운영/콘텐츠 | 정책 미확정 | `Operation > 챗봇`, `Operation > FAQ`, `Message > 메일` | `docs/specs/page-ia/operation-chatbot-page-ia.md`, `docs/specs/admin-page-gap-register.md` |
| `POL-012` | 메일 발송 운영정책 | 메시지/알림 | 코드 반영 | `Message > 메일`, `Message > 대상 그룹`, `Message > 발송 이력` | `docs/specs/page-ia/message-mail-page-ia.md`, `docs/specs/page-ia/message-history-page-ia.md` |
| `POL-013` | 푸시 발송 운영정책 | 메시지/알림 | 코드 반영 | `Message > 푸시`, `Message > 대상 그룹`, `Message > 발송 이력` | `docs/specs/page-ia/message-push-page-ia.md`, `docs/specs/page-ia/message-history-page-ia.md` |
| `POL-014` | 발송 실패/재시도 정책 | 메시지/알림 | 정책 미확정 | `Message > 발송 이력`, `Message > 메일`, `Message > 푸시` | `docs/specs/page-ia/message-history-page-ia.md`, `docs/specs/admin-page-gap-register.md` |
| `POL-015` | 관리자 권한 변경 정책 | 관리자/보안 | 문서 추적 | `System > 권한 관리`, `System > 관리자 계정`, `System > 감사 로그` | `docs/specs/page-ia/system-permissions-page-ia.md`, `docs/specs/admin-page-gap-register.md`, `src/features/system/pages/system-permissions-page.tsx` |
| `POL-016` | 마케팅 정보 수신 동의 | 메시지/알림 | 코드 반영 | `Message > 메일`, `Message > 푸시`, `Users > 회원 상세` | `docs/specs/page-ia/message-mail-page-ia.md`, `docs/specs/page-ia/message-push-page-ia.md`, `docs/specs/admin-data-usage-map.md` |

## 4. 운영 원칙

- `Operation > 정책 관리`는 법률/약관 문서와 운영 규칙 문서를 모두 수용하지만, `정책 추적 상태`가 `문서 추적` 또는 `정책 미확정`인 문서는 사용자 노출 기준 문서로 바로 간주하지 않는다.
- 운영 정책 후보가 새로 생기면 먼저 이 문서에 `정책 유형`, `운영 영역`, `추적 상태`, `연관 관리자 화면`, `추적 근거 문서`를 추가한 뒤 정책 관리 seed/UI와 관련 IA를 함께 갱신한다.
- placeholder 화면이나 오픈 이슈에서 추출한 정책 후보는 `정책 미확정`으로 시작하고, 실페이지 구현 또는 승인 체계 확정 후 상태를 올린다.
