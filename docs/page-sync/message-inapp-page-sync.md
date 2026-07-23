# Message > 인앱 알림 관리 페이지 동기화 문서

---
doc_type: admin_page_sync
module: "Message"
page_name: "인앱 알림 관리"
route: "/messages/in-app"
status: "구현됨"
primary_entity: "NotificationTemplate"
primary_table_candidate: "notification_templates"
owner_agent_scope: "shared"
last_reviewed_at: "2026-06-12"
---

## 1. 문서 목적

- 이 문서는 `인앱 알림 관리` 관리자 페이지와 사용자 화면(v13 인앱 알림센터·홈 알림 카드) 사이의 동기화 기준을 정리합니다.
- 2026-06-12 알림 기능 supabase 연동으로 신설된 화면의 현재 구현 상태를 기준으로 작성했습니다.
- 전역 계약 SoT는 `docs/specs/notification-contract.md`, 소유권은 `docs/architecture/shared-supabase-schema-ownership.md`입니다.

## 2. 페이지 요약

| 항목 | 내용 |
| --- | --- |
| 모듈 | `Message` |
| 페이지명 | `인앱 알림 관리` |
| 라우트 | `/messages/in-app`, `/messages/in-app/create`, `/messages/in-app/create/:templateId` |
| 현재 상태 | `구현됨` |
| 페이지 목적 한 줄 요약 | in_app 채널 알림 템플릿을 등록/활성화하고 발송 실행해 v13 사용자 수신함에 전달하는 화면입니다. |
| 주요 운영자 | `OPS_ADMIN, SUPER_ADMIN` |
| 주요 권한 | `message.inapp.manage` |
| 코드 근거 | `src/features/message/pages/message-inapp-page.tsx`, `src/features/message/pages/message-channel-page.tsx`, `src/features/message/api/notification-supabase-adapter.ts` |
| 연관 SoT 문서 | `docs/specs/page-ia/message-inapp-page-ia.md`, `docs/specs/notification-contract.md`, `docs/specs/admin-action-log.md`, `docs/specs/admin-data-usage-map.md` |

## 3. 이 페이지의 목적

### 목적

- in_app 채널 템플릿(template_key·class·mandatory·category·link_url)을 관리하고 즉시/예약/테스트 발송을 실행합니다.
- 발송 결과가 v13 인앱 알림센터(벨·수신함)와 B-01 홈 알림 카드에 직접 노출되므로 사용자 화면과 동기화가 필요합니다.

### 비목표

- 발송 집행(대상 산정·전달·dedupe)은 topik-ai 소유 파이프라인(DB dispatcher + pg_cron, `admin_schema_migrations`)이 담당합니다.
- 사용자 수신함 `user_notifications`(v13 소유)의 UI/보존 정책은 v13에서 결정합니다.

## 4. 이 페이지에서 할 수 있는 것

| 기능/작업 | 설명 | 작업 성격 | 대상 데이터 | 결과 | 감사 로그 필요 여부 |
| --- | --- | --- | --- | --- | --- |
| 템플릿 조회 | 목록/검색/미리보기 | 조회 | NotificationTemplate | 현재 상태 확인 | 불필요 |
| 템플릿 등록/수정 | 메타 모달(template_key·class 필수) + 본문 등록 상세 | 수정 | Notification + templateId | RPC 반영 + 감사 기록 | 필요(사유 필수) |
| 상태 변경/삭제 | 활성/비활성/초안 전환, 삭제 | 파괴적 | Notification + templateId | RPC 반영 + 감사 기록 | 필요(확인 + 사유 필수) |
| 발송 실행 | 나에게 보내기(test)/즉시/예약 | 수정 | Notification + dispatchId | dispatch 생성, 파이프라인 집행 | 필요(사유 필수, mandatory면 bypass_reason) |

## 5. 관리 데이터베이스(CRUD)

> supabase 모드 기준 실계약입니다. mock 모드(`VITE_MESSAGE_SOURCE=mock`)는 기존 시드 동작을 유지합니다.

| 엔티티 후보 | 테이블 후보 | CRUD | 관리자 UI 진입점 | 주요 필드 후보 | 감사 로그 Target | 사용자 화면 영향 | 미확정/차이 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| NotificationTemplate | notification_templates (channel='in_app') | Create / Read / Update / Delete | 목록 + 메타 모달 + 등록 상세 | template_key, channel, class, mandatory, category, name, subject, body_html, link_url, status | Notification + templateId | 확인됨 | DB status는 active/inactive/draft, UI는 활성/비활성/초안 매핑 |
| NotificationDispatch | notification_dispatches | Create / Read | 발송 모달(즉시/예약/테스트) | template_key, channels, target_type(group/test), status, actor_id, reason, dedupe_key, scheduled_at | Notification + dispatchId | 확인됨 | 집행·상태 전이는 파이프라인 담당 |
| NotificationDeliveryAttempt | notification_delivery_attempts | Read | 발송 이력 상세 Drawer | dispatch_id, user_id, channel, status(6종), template_key | Notification + dispatchId | 확인됨 | v13 X-09도 owner-select read(공유 객체) |

### CRUD 상세

| CRUD | 지원 여부 | 화면 동작 | 저장/서비스 후보 | 성공 후 동기화 대상 | 실패 시 fail-safe |
| --- | --- | --- | --- | --- | --- |
| Create | `지원` | 메타 등록 모달(사유 필수) | `admin_save_notification_template` RPC | 목록, 감사 로그 | error 표시, 재시도 |
| Read | `지원` | 목록/미리보기 조회 | `notification-supabase-adapter.ts` | URL/탭/검색 복원 | empty/error 처리 |
| Update | `지원` | 메타 수정/본문 저장/상태 변경(사유 필수) | `admin_save_notification_template`/`admin_set_notification_template_status` RPC | 목록, 상세, 감사 로그 | 실패 시 재조회 |
| Delete | `지원` | 템플릿 삭제(확인 + 사유 필수) | `admin_delete_notification_template` RPC | 목록, 감사 로그 | 확인 모달, 실패 안내 |

## 6. 관리자 조치와 감사 로그 계약

| 조치 | 파괴적 여부 | 확인 단계 | 사유/근거 입력 | Target Type | Target ID | 감사 로그 확인 경로 |
| --- | --- | --- | --- | --- | --- | --- |
| 템플릿 등록/수정 | 아니오 | 불필요 | 필수 | Notification | templateId | /system/audit-logs?targetType=Notification&targetId={templateId} |
| 상태 변경/삭제 | 예 | 필수 | 필수 | Notification | templateId | /system/audit-logs?targetType=Notification&targetId={templateId} |
| 발송 실행 | 아니오(운영 영향 큼) | 필수(mandatory면 우회 고지 모달) | 필수 | Notification | dispatchId | /system/audit-logs?targetType=Notification&targetId={dispatchId} |

- 액션 사전: `notification_template_created`/`updated`/`status_changed`/`deleted`, `notification_dispatch_created` — `docs/specs/admin-action-log.md` 참조.

## 7. 사용자 화면 동기화 포인트

| 사용자 화면 후보 | 영향 상태 | 관리자 데이터 | 사용자 화면에 반영되는 방식 | 동기화 필요 시점 | 비고 |
| --- | --- | --- | --- | --- | --- |
| v13 인앱 알림센터(벨/수신함) | 확인됨 | 템플릿 제목/본문/link_url/category | 파이프라인이 `user_notifications`에 적재해 벨 뱃지·수신함에 표시 | 발송 집행 후(pg_cron 10분 tick) | V-2/V-3 게이트 실증 |
| v13 B-01 홈 알림 카드 | 확인됨 | category, 제목, link_url | 최신 5건 피드, 클릭=읽음+이동 | 동일 | v13 `04-B-01-home-dashboard` 문서 |
| v13 X-09 발송 이력 패널 | 확인됨 | delivery attempts(상태 6종) | owner-select 최근 5건 | 동일 | 공유 객체 계약 |

## 8. 이 페이지와 연관있는 페이지(예상)

### 관리자 페이지

| 연관 관리자 페이지 | 관계 유형 | 연관 이유 | 이동/연동 방식 | 선행/후행 관계 | 확정 상태 |
| --- | --- | --- | --- | --- | --- |
| Message > 대상 그룹 | 선행 | 발송 대상 그룹 참조 | 그룹 선택 | 선행 | 확정 |
| Message > 발송 이력 | 필수 후행 | dispatch/attempt 결과 검수 | 발송 후 이동 | 후행 | 확정 |
| System > 감사 로그 | 필수 후행 | 조치 이력 검증 | Target Type=Notification 딥링크 | 후행 | 확정 |

### 사용자 화면

| 연관 사용자 화면 후보 | 관계 유형 | 연관 이유 | 관리자 변경 후 예상 영향 | 확정 상태 |
| --- | --- | --- | --- | --- |
| v13 인앱 알림센터/B-01 알림 카드 | 데이터 노출 | 발송된 알림이 직접 표시됨 | 제목/본문/이동 경로/노출 빈도 변경 | 확인됨 |

## 9. 상태값/용어/키워드 정합성

| 구분 | 표준 값/용어 | 내부 코드 후보 | 사용자 노출 라벨 | 비고 |
| --- | --- | --- | --- | --- |
| 템플릿 상태 | 활성/비활성/초안 | active/inactive/draft | 활성/비활성/초안 | DB ASCII ↔ UI 한글 매핑 |
| 분류(class) | transactional/operational/learning/marketing | 동일 | 동일(코드 노출) | `docs/specs/notification-contract.md` §2 |
| 발송 상태 | dispatch 7종 / attempt 6종 | DispatchStatus/AttemptStatus | 한글 라벨 | 계약 §4 |

## 10. URL/검색/복원 규칙

- 기본 라우트: `/messages/in-app` (메뉴 기본 쿼리 `tab=auto`)
- 등록 상세 라우트: `/messages/in-app/create/:templateId`
- 목록 복원 기준: 탭/검색 대상/검색어/날짜 범위 복원 (메일 화면과 동일)
- 사용자 화면 동기화에 필요한 식별자: Notification + templateId / dispatchId

## 11. 네트워크 상태와 fail-safe

| 상태 | UI 노출 | 운영자가 할 수 있는 것 | 사용자 화면 동기화 영향 |
| --- | --- | --- | --- |
| pending | 목록/상세 loading 표시 | 대기 또는 취소 | 동기화 지연 |
| success | 데이터 표시 + 감사 링크 알림 | 후속 조치 | 동기화 가능 |
| empty | 빈 상태 안내 | 등록 유도 | 직접 영향 없음 |
| error | 오류 안내/재시도 | 재시도 | 동기화 보류 |

## 12. 에이전트 작업 메모

- Codex 확인 포인트:
  - `message-channel-page.tsx`의 channel='in_app' 분기와 `notification-supabase-adapter.ts` RPC 호출, e2e(app-routes) 라우트 등록 일치 확인
- Claude 확인 포인트:
  - v13 인앱 알림센터/B-01 카드 노출 문구와 link_url 시드(/dashboard, /growth, /library) 정합 검토
- 양쪽 동기화가 필요한 결정:
  - email/push transport 연동 시점, `user_notifications` 보존 기간(O-6), legacy redirect 제거 시점(O-10)

## 13. 미확정 항목

| 항목 | 미확정 내용 | 필요한 결정 주체 | 관리자 페이지 영향 | 사용자 화면 영향 | 추적 문서 |
| --- | --- | --- | --- | --- | --- |
| email/push transport | provider 연동(Phase 3 이후) | 기획/오너 | 채널별 발송 가능 상태 표시 | 수신 채널 확장 | `docs/알림-기능-개발-실행계획안.md` §7 |
| legacy redirect 제거 | `/notification/*` redirect 한 릴리즈 유지 후 제거(O-10) | 오너 | 라우트 정리 | 없음 | `docs/specs/admin-page-gap-register.md` |
