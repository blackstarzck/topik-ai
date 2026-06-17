# Operation > 이벤트 페이지 동기화 문서

---
doc_type: admin_page_sync
module: "Operation"
page_name: "이벤트"
route: "/operation/events"
status: "구현됨"
primary_entity: "OperationEvent"
primary_table_candidate: "operation_events"
owner_agent_scope: "shared"
last_reviewed_at: "2026-06-17"
---

## 1. 문서 목적

- 이 문서는 `이벤트` 관리자 페이지와 사용자 화면 개발 사이의 동기화 기준을 정리합니다.
- 운영자가 이 페이지에서 어떤 관리 포인트를 다루는지, 그 데이터가 사용자 화면에 어떻게 이어질 수 있는지 추적합니다.
- 2026-06-17 mock-only에서 Supabase-backed hybrid switch로 전환 완료했습니다. `operation_events`와 admin RPC 4종은 `admin_schema_migrations` tracker 기준 dev DB 적용 완료 상태입니다.
- 이 문서는 사용자 화면 동기화 기준이며, DB 스키마 상세 SoT는 `docs/specs/admin-data-contract.md`의 Operation 이벤트 데이터 계약을 우선합니다.

## 2. 페이지 요약

| 항목 | 내용 |
| --- | --- |
| 모듈 | `Operation` |
| 페이지명 | `이벤트` |
| 라우트 | `/operation/events`, `/operation/events/create`, `/operation/events/create/:eventId` |
| 현재 상태 | `구현됨` |
| 페이지 유형 | `목록 운영형 + 등록 상세 페이지` |
| 페이지 목적 한 줄 요약 | 이벤트 메타, HTML 본문, 기간, 노출 상태, SEO/공유 정보를 관리하는 화면입니다. |
| 주요 운영자 | `OPS_ADMIN, SUPER_ADMIN` |
| 주요 권한 | `operation.events.manage` |
| 코드 근거 | `src/features/operation/pages/operation-events-page.tsx`, `src/features/operation/pages/operation-event-create-page.tsx`, `src/features/operation/api/events-service.ts`, `src/features/operation/api/operation-events-data-source.ts`, `src/features/operation/api/supabase-operation-events-service.ts` |
| Supabase 자산 | `supabase/migrations-admin/20260617152000_operation_events.sql`, `supabase/migrations-admin/down/20260617152000_operation_events.sql` |
| 연관 SoT 문서 | `docs/specs/page-ia/operation-events-page-ia.md`, `docs/specs/admin-data-contract.md`, `docs/specs/admin-data-usage-map.md`, `docs/specs/admin-page-tables.md` |

## 3. 이 페이지의 목적

### 목적

- 이벤트 콘텐츠와 노출/예약/숨김 상태를 운영합니다.
- 이벤트명, 요약, HTML 본문, 기간, 노출 상태, 배너, 공유/SEO 메타를 관리자 기준으로 추적합니다.
- 이벤트 목록, 상세, 프로모션 랜딩에 노출 예정으로 연결됩니다.
- 저장/게시 예약/즉시 게시/종료 후 `OperationEvent + eventId` 감사 로그 확인 경로를 제공합니다.

### 비목표

- DB 컬럼/제약의 상세 확정은 이 문서가 아니라 `docs/specs/admin-data-contract.md`에서 담당합니다.
- 사용자 화면의 상세 UI 설계는 별도 사용자 화면 문서에서 결정합니다.
- 배너 asset 정규화, 보상 정책/메시지 템플릿 FK 정규화, 참여자 수 집계 파이프라인은 이번 DB 증분 범위가 아닙니다.

## 4. 이 페이지에서 할 수 있는 것

| 기능/작업 | 설명 | 작업 성격 | 대상 데이터 | 결과 | 감사 로그 필요 여부 |
| --- | --- | --- | --- | --- | --- |
| 이벤트 조회 | 이벤트 목록/상세와 본문 미리보기를 확인합니다. | 조회 | OperationEvent | 현재 상태 확인 | 불필요 |
| 이벤트 저장 | 이벤트명, 요약, HTML 본문, 기간, 노출 상태, 배너, 보상/메시지 snapshot, 공유/SEO 메타를 신규 저장하거나 수정합니다. | 수정 | OperationEvent + eventId | `operation_events` 반영 또는 mock fallback 반영 | 필요 |
| 게시 예약 | 이벤트 노출 상태를 `예약`으로 전환합니다. | 수정 | OperationEvent + eventId | 예약 상태 반영 및 감사 로그 기록 | 필요 |
| 즉시 게시 | 이벤트 노출 상태를 `노출`로 전환합니다. | 수정 | OperationEvent + eventId | B2C 노출 후보 상태 변경 | 필요 |
| 종료 | 이벤트를 종료 처리하고 숨김으로 전환합니다. | 파괴적 조치 | OperationEvent + eventId | 종료 상태 반영 및 사용자 노출 후보 차단 | 필요 |
| 미리보기 | 이벤트 상세/랜딩 본문을 별도 Modal에서 검수합니다. | 조회 | OperationEvent + eventId | 본문 검수 | 불필요 |

## 5. 관리 데이터베이스(CRUD)

> 아래 표는 관리자 페이지와 사용자 화면 동기화를 위한 요약입니다. DB 컬럼/제약 상세는 `docs/specs/admin-data-contract.md`를 우선합니다.

| 엔티티 | 테이블 | CRUD | 관리자 UI 진입점 | 주요 필드 | 감사 로그 Target | 사용자 화면 영향 | 미확정/차이 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| OperationEvent | `operation_events` | Create, Read, Update | 이벤트 목록/상세 Drawer/등록 상세/미리보기 Modal | 이벤트 ID, 이벤트명, 요약, HTML 본문, 유형, 기간, 노출 상태, 진행 상태, 노출 채널, 배너, 보상/메시지 snapshot, 공유/SEO 메타, 관리자 메모, 생성/수정 시각, 수정자 | `OperationEvent + eventId` | 이벤트 목록/상세/프로모션 랜딩 노출 예정 | 자연키 `EVT-NNN` max+1 채번 동시성, `updated_by` 표시명 매핑, 배너/보상/메시지 정규화, `participant_count` 집계 source 미확정 |

### CRUD 상세

| CRUD | 지원 여부 | 화면 동작 | 저장/서비스 source | 성공 후 동기화 대상 | 실패 시 fail-safe |
| --- | --- | --- | --- | --- | --- |
| Create | `지원` | 이벤트 등록 상세에서 저장 | `admin_save_operation_event(p_id,p_event,p_reason)` 또는 mock fallback | 목록, 상세, 감사 로그, 사용자 화면 후보 | error 표시, 재시도, 마지막 성공 상태 fallback |
| Read | `지원` | 이벤트 목록/단건 조회와 미리보기 | `operation_events` select 또는 mock fallback | URL/필터/정렬/selected 복원 | empty/error 처리 |
| Update | `지원` | 이벤트 수정 저장, 게시 예약, 즉시 게시, 종료 | admin RPC 4종 또는 mock fallback | 목록, 상세, 감사 로그, 사용자 노출 후보 | 실패 시 재조회 또는 action-level notification |
| Delete | `미지원` | 물리 삭제 없음. 종료는 상태 전환으로 처리 | 해당 없음 | 해당 없음 | 삭제 요구는 후속 정책 결정 필요 |

### 데이터소스 전환

- 기본 서비스 facade는 `events-service.ts`의 `fetchEventsSafe`, `fetchEventSafe`, `saveEventSafe`, `scheduleEventPublishSafe`, `publishEventSafe`, `endEventSafe`입니다.
- Supabase 설정이 없거나 `VITE_SUPABASE_DISABLED=true`이면 기존 mock 경로(`mock-operation.ts` + `operation-store.ts`)를 사용합니다.
- Supabase 설정이 있고 `VITE_OPERATION_EVENTS_SOURCE`가 `mock`이 아니면 `operation_events` + admin RPC 4종 경로를 사용합니다.
- DB `visibility_status`는 `exposed`/`hidden`/`scheduled`이고, 화면 라벨은 기존 표준 상태값 `노출`/`숨김`/`예약`을 유지합니다. DB `progress_status`는 `ongoing`/`upcoming`/`ended`이며 읽기 시 기간 기준으로 파생합니다.

## 6. 관리자 조치와 감사 로그 계약

| 조치 | 파괴적 여부 | 확인 단계 | 사유/근거 입력 | Target Type | Target ID | 감사 action | 감사 로그 확인 경로 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 이벤트 등록/수정 | 아니오 | 저장 전 확인 | 필수 | OperationEvent | eventId | `event_saved` | `/system/audit-logs?targetType=OperationEvent&targetId={eventId}` |
| 게시 예약 | 아니오 | 필수 | 필수 | OperationEvent | eventId | `event_scheduled` | `/system/audit-logs?targetType=OperationEvent&targetId={eventId}` |
| 즉시 게시 | 아니오 | 필수 | 필수 | OperationEvent | eventId | `event_published` | `/system/audit-logs?targetType=OperationEvent&targetId={eventId}` |
| 종료 | 예 | 필수 | 필수 | OperationEvent | eventId | `event_ended` | `/system/audit-logs?targetType=OperationEvent&targetId={eventId}` |

- RPC 계약: `admin_save_operation_event`, `admin_schedule_operation_event`, `admin_publish_operation_event`, `admin_end_operation_event`.
- 모든 RPC는 reason을 필수로 받고 `admin_audit_logs.target_table='OperationEvent'`, `target_id=eventId`를 기록합니다.

## 7. 사용자 화면 동기화 포인트

| 사용자 화면 후보 | 영향 상태 | 관리자 데이터 | 사용자 화면에 반영되는 방식 | 동기화 필요 시점 | 비고 |
| --- | --- | --- | --- | --- | --- |
| 이벤트 목록, 이벤트 상세, 프로모션 랜딩 | 노출 예정 | 이벤트명, 요약, HTML 본문, 기간, 노출 상태, 배너, 공유/SEO 메타 | `exposed`(`노출`) 이벤트를 사용자 노출 후보로 사용하는 방향입니다. | 관리자 변경 후 또는 원본 데이터 갱신 후 | 실제 사용자 화면 저장소/라우트 확인 전까지 `노출 예정`으로 유지 |

## 8. 이 페이지와 연관있는 페이지(예상)

### 관리자 페이지

| 연관 관리자 페이지 | 관계 유형 | 연관 이유 | 이동/연동 방식 | 선행/후행 관계 | 확정 상태 |
| --- | --- | --- | --- | --- | --- |
| Commerce > 쿠폰 관리 | 참고/후속 | 이벤트 보상 정책 후보 | 보상 정책 ID/이름 snapshot 또는 후속 링크 | 선행 또는 후행 | 운영상 추정 |
| Commerce > 포인트 관리 | 참고/후속 | 이벤트 보상 정책 후보 | 보상 정책 ID/이름 snapshot 또는 후속 링크 | 선행 또는 후행 | 운영상 추정 |
| Message > 대상 그룹/템플릿 | 참고/후속 | 이벤트 대상 그룹과 안내 메시지 후보 | 대상 그룹/템플릿 ID/이름 snapshot | 선행 또는 후행 | 운영상 추정 |
| System > 감사 로그 | 필수 후행 | 이벤트 조치 이력 확인 | `targetType=OperationEvent&targetId={eventId}` | 후행 | 확정 |

### 사용자 화면

| 연관 사용자 화면 후보 | 관계 유형 | 연관 이유 | 관리자 변경 후 예상 영향 | 확정 상태 |
| --- | --- | --- | --- | --- |
| 이벤트 목록 | 데이터 노출 후보 | 이벤트명, 요약, HTML 본문, 기간, 노출 상태, 배너, 공유/SEO 메타 | 이벤트 데이터 변경 시 표시/접근/알림이 달라질 수 있습니다. | 노출 예정 |
| 이벤트 상세 | 데이터 노출 후보 | 이벤트명, 요약, HTML 본문, 기간, 노출 상태, 배너, 공유/SEO 메타 | 이벤트 데이터 변경 시 표시/접근/알림이 달라질 수 있습니다. | 노출 예정 |
| 프로모션 랜딩 | 데이터 노출 후보 | 이벤트명, 요약, HTML 본문, 기간, 노출 상태, 배너, 공유/SEO 메타 | 이벤트 데이터 변경 시 표시/접근/알림이 달라질 수 있습니다. | 노출 예정 |

## 9. 상태값/용어/키워드 정합성

| 구분 | 표준 값/용어 | DB 코드 | 사용자 노출 라벨 | 비고 |
| --- | --- | --- | --- | --- |
| 이벤트 유형 | 프로모션/출석/챌린지/리워드 | 한글 코드 `프로모션`/`출석`/`챌린지`/`리워드` | 프로모션/출석/챌린지/리워드 | DB CHECK로 허용값을 제한합니다. |
| 노출 상태 | 노출/예약/숨김 | `exposed`/`scheduled`/`hidden` | 노출/예약/숨김 | 한글 UI 라벨은 유지하고, 저장 코드는 ASCII enum으로 분리합니다. |
| 진행 상태 | 진행중/예정/종료 | `ongoing`/`upcoming`/`ended` | 진행중/예정/종료 | 기간 기준 읽기 파생값입니다. |
| 노출 채널 | 앱홈/웹홈/이벤트탭 | jsonb array `앱홈`/`웹홈`/`이벤트탭` | 앱홈/웹홈/이벤트탭 | B2C surface 확정 전까지 노출 예정으로 추적합니다. |
| 보상 유형 | 없음/쿠폰/포인트/배지 | 한글 코드 `없음`/`쿠폰`/`포인트`/`배지` | 없음/쿠폰/포인트/배지 | 보상 정책은 FK 없이 snapshot으로 저장합니다. |
| indexingPolicy | index/noindex | `index`/`noindex` | index/noindex | 공개 이벤트만 선택 override 합니다. |

## 10. URL/검색/복원 규칙

- 기본 라우트: `/operation/events`
- 필수 쿼리/경로 파라미터: 없음
- 선택 쿼리 파라미터: `searchField`, `keyword`, `startDate`, `endDate`, `status`, `eventType`, `sortField`, `sortOrder`, `selected`
- 목록 복원 기준: 목록/필터/정렬/상세 대상 복원
- 상세 Drawer/Modal/하위 라우트 복원 여부: `/operation/events/create`, `/operation/events/create/:eventId`
- 사용자 화면 동기화에 필요한 식별자: `OperationEvent + eventId`

## 11. 네트워크 상태와 fail-safe

| 상태 | UI 노출 | 운영자가 할 수 있는 것 | 사용자 화면 동기화 영향 |
| --- | --- | --- | --- |
| pending | pending 상태에서 목록/상세 loading 표시 | 대기 또는 취소 | 동기화 지연 |
| success | success 상태에서 데이터 표시 | 후속 조치 또는 원본 확인 | 동기화 가능 |
| empty | empty 상태에서 빈 상태와 필터 초기화 또는 등록 유도 | 필터 초기화 또는 등록/후속 확인 | 직접 영향 없음 |
| error | error 상태에서 재시도와 마지막 성공 상태 fallback 제공 | 재시도 또는 마지막 성공 상태 확인 | 동기화 보류 |

## 12. 에이전트 작업 메모

- Codex 확인 포인트:
  - `src/features/operation/pages/operation-events-page.tsx`, `src/features/operation/pages/operation-event-create-page.tsx` 구현과 `docs/specs/page-ia/operation-events-page-ia.md` 문서 일치 확인
  - `operation-events-data-source.ts` source switch와 `supabase-operation-events-service.ts` 매핑 확인
  - admin RPC 4종 reason 필수, 감사 로그 Target `OperationEvent` 확인
- Claude 확인 포인트:
  - 이벤트 목록, 상세, 프로모션 랜딩에 노출 예정으로 연결됩니다.
  - 정책 문구와 노출/비노출 기준 검토
- 양쪽 동기화가 필요한 결정:
  - `EVT-NNN` 장기 채번 방식
  - 사용자 화면 노출 위치 확정
  - 배너 이미지/보상 정책/메시지 템플릿 정규화
  - `participant_count` 집계 source

## 13. 미확정 항목

| 항목 | 미확정 내용 | 필요한 결정 주체 | 관리자 페이지 영향 | 사용자 화면 영향 | 추적 문서 |
| --- | --- | --- | --- | --- | --- |
| 자연키 채번 | `EVT-NNN` 신규 RPC 채번이 현재 max+1 방식이라 동시 생성 race를 막는 장기 방식(sequence/table 등)이 미확정입니다. | 백엔드/DB | 동시 등록 안정성 영향 | 직접 영향 없음 | docs/specs/admin-data-contract.md |
| 수정자 표시 | `updated_by`는 호출자 uuid 저장이며 관리자 표시명 매핑 정책이 미확정입니다. | 백엔드/프론트 | 목록/Drawer 수정자 표시 정합 영향 | 직접 영향 없음 | docs/specs/admin-data-contract.md |
| 배너/보상/메시지 정규화 | 배너는 jsonb 배열, 보상 정책과 메시지 템플릿은 denormalized 문자열 snapshot이며 FK/asset 테이블 정규화가 미확정입니다. | 기획/백엔드/프론트 | 등록 상세 옵션, 상세 Drawer 링크, 후속 운영 이동 영향 | 이벤트 상세/랜딩 배너와 보상/메시지 연결 영향 | docs/specs/admin-data-contract.md |
| 참여자 수 집계 | `participant_count`의 실제 집계 source와 갱신 주기가 미확정입니다. | 백엔드/데이터 | 목록/상세 참여 현황 정확도 영향 | 참여 현황 노출 시 정합 영향 | docs/specs/page-ia/operation-events-page-ia.md |
| B2C 노출 surface | 이벤트 목록/상세/프로모션 랜딩의 실제 저장소와 라우트는 추가 확정이 필요합니다. | 기획/백엔드/프론트 | 노출 채널/랜딩 URL 정책 영향 | 이벤트 목록, 상세, 프로모션 랜딩에 노출 예정으로 연결됩니다. | docs/specs/admin-data-usage-map.md |
