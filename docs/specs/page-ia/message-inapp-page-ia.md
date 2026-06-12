# Message > 인앱 알림 관리 상세 IA

## 1. 문서 목적

- 인앱(in_app) 알림 템플릿 관리와 발송 실행 화면의 운영 목적, 데이터 블록, 조치 흐름을 정리합니다.
- 2026-06-12 알림 기능 supabase 연동(WP2)으로 신설된 화면이며, 현재 구현 상태 기준으로 운영 흐름을 고정합니다.
- 운영 기본 흐름 검색 -> 상세 -> 조치 -> 감사 로그 확인 또는 편집형 화면의 작성/수정 -> 확인 -> 발행 -> 감사 로그 확인을 유지합니다.

## 2. 문서 메타

| 항목 | 내용 |
| --- | --- |
| 모듈 | Message |
| 페이지명 | 인앱 알림 관리 |
| 현재 상태 | 구현됨 |
| 페이지 유형 | 정책/시나리오 편집형 + 목록 운영형 혼합 |
| 라우트 | /messages/in-app, /messages/in-app/create, /messages/in-app/create/:templateId |
| 주요 권한 | message.inapp.manage |
| 주요 role | SUPER_ADMIN, OPS_ADMIN |
| 연관 문서 | `notification-contract.md`(docs/specs), docs/architecture/shared-supabase-schema-ownership.md, docs/specs/admin-action-log.md, docs/specs/admin-data-usage-map.md |

## 3. UI 예외

- 예외 없음 (메일/푸시와 동일한 공용 channel page 구조를 사용합니다)

## 4. 페이지 목표와 비목표

### 목표

- in_app 채널 알림 템플릿(`notification_templates`, channel='in_app')을 등록/수정/상태 변경/삭제하고, 발송 실행(즉시/예약/나에게 보내기)을 수행합니다.
- 모든 쓰기 조치 후 `Target Type=Notification` 기준 감사 로그 확인 경로를 고정합니다.

### 비목표

- 발송 집행(대상 산정·전달)은 파이프라인(DB dispatcher + pg_cron, v13 소유)이 담당하며 이 화면이 직접 수행하지 않습니다.
- 사용자 수신함(`user_notifications`, v13 소유) UI는 이 화면 범위가 아닙니다.

## 5. 운영자 사용 시나리오

- 시나리오 1: 운영자가 메타 등록 모달(template_key·class 필수)로 템플릿을 생성하고, 등록 상세에서 본문을 작성한 뒤 활성화(사유 입력)합니다.
- 시나리오 2: 운영자가 `나에게 보내기`로 본인 수신을 확인하고, 그룹 대상 즉시/예약 발송(사유 입력)을 실행합니다.
- 시나리오 3: 운영자가 조치 후 Target Type=Notification, Target ID 기준으로 감사 로그를 확인하고 `Message > 발송 이력`에서 dispatch/attempt 결과를 검수합니다.

## 6. 화면 구조

- 메일(`docs/specs/page-ia/message-mail-page-ia.md`)·푸시와 동일한 공용 channel page(`src/features/message/pages/message-channel-page.tsx`)를 channel='in_app'으로 렌더링합니다. 상단 요약/검색·필터/본문 목록/상세 모달 구조는 메일 IA §5와 동일합니다.
- 등록 상세 라우트는 /messages/in-app/create/:templateId 이며 TinyMCE 본문 에디터 구조를 공유합니다.

## 7. 데이터 블록 정의

- 본문 목록: `notification_templates` (channel='in_app') — 템플릿 ID, template_key, 카테고리, 템플릿명, 분류(class), 상태(활성/비활성/초안 — DB는 active/inactive/draft 매핑), 최근 수정.
- supabase 전용 폼 필드: `template_key`(필수), `class`(transactional·operational·learning·marketing 4종 — 필수), `mandatory`(marketing은 저장 차단 + ON 시 수신 선호 우회·감사 기록 고지 확인 모달), `category`, `link_url`(인앱 클릭 이동 경로), 사유 입력.
- 발송 실행 결과는 `notification_dispatches` + `notification_delivery_attempts`(발송 이력 화면 SoT)로 기록됩니다.
- mock 모드(`VITE_MESSAGE_SOURCE=mock`)에서는 기존 message mock 시드를 사용합니다.

## 8. 액션 정의

| 액션 | 성격 | 대상 식별 기준 | 확인/사유 필요 여부 | RPC | 감사 로그 확인 경로 |
| --- | --- | --- | --- | --- | --- |
| 템플릿 등록/수정 | 수정 | Notification + templateId | 사유 필수 | admin_save_notification_template | /system/audit-logs?targetType=Notification&targetId={templateId} |
| 상태 변경(활성/비활성/초안) | 파괴적 | Notification + templateId | 확인 + 사유 필수 | admin_set_notification_template_status | /system/audit-logs?targetType=Notification&targetId={templateId} |
| 템플릿 삭제 | 파괴적 | Notification + templateId | 확인 + 사유 필수 | admin_delete_notification_template | /system/audit-logs?targetType=Notification&targetId={templateId} |
| 나에게 보내기(test)/즉시/예약 발송 | 수정 | Notification + dispatchId | 사유 필수 | admin_send_notification | /system/audit-logs?targetType=Notification&targetId={dispatchId} |

## 9. 감사 계약

- 모든 쓰기는 admin RPC 단일 경로(SECURITY DEFINER + `private.is_admin` 가드 + 사유 필수)이며 `admin_audit_logs`에 `Target Type=Notification`, `Target ID={row uuid}`로 기록됩니다.
- 액션 사전(`docs/specs/admin-action-log.md`): `notification_template_created`/`updated`/`status_changed`/`deleted`, `notification_dispatch_created`(mandatory 템플릿이면 payload에 `bypass_reason` 포함).

## 10. URL/상태 복원

- 기본 라우트: /messages/in-app (메뉴 진입 기본 쿼리 `tab=auto`)
- 등록 상세 라우트: /messages/in-app/create/:templateId
- 목록 복원 기준은 메일 IA §11과 동일합니다(tab/searchField/keyword/날짜 복원).

## 11. 구현 메모

- 재사용 컴포넌트: 공용 channel page + `message-template-form-fields.tsx`(supabase 전용 필드 분기), PageTitle, SearchBar, AdminDataTable, ConfirmAction, AuditLogLink.
- feature 파일: src/features/message/pages/message-inapp-page.tsx (MessageChannelPage channel='in_app' 래퍼), `notification-supabase-adapter.ts`(src/features/message/api).
- legacy `/notification/send`·`/notification/history`는 각각 `/messages/mail`·`/messages/history`로의 redirect를 한 릴리즈 유지 후 제거 예정(O-10)이며, legacy feature 폴더는 삭제 완료됐습니다.

## 12. 미해결 이슈

- email/push transport 연동(Phase 3 이후) 시 채널 간 발송 가능 상태 표시 통일 필요.
