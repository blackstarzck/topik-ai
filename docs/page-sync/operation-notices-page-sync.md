# Operation > 공지사항 페이지 동기화 문서

---
doc_type: admin_page_sync
module: "Operation"
page_name: "공지사항"
route: "/operation/notices"
status: "구현됨"
primary_entity: "OperationNotice"
primary_table_candidate: "operation_notices"
owner_agent_scope: "shared"
last_reviewed_at: "2026-06-17"
---

## 1. 문서 목적

- 이 문서는 `공지사항` 관리자 페이지와 사용자 화면 개발 사이의 동기화 기준을 정리합니다.
- 운영자가 이 페이지에서 어떤 관리 포인트를 다루는지, 그 데이터가 사용자 화면에 어떻게 이어질 수 있는지 추적합니다.
- 2026-06-17 mock-only에서 Supabase-backed hybrid switch로 전환 완료했습니다. `operation_notices`와 admin RPC 3종은 `admin_schema_migrations` tracker 기준 dev DB 적용 완료 상태입니다.
- 이 문서는 사용자 화면의 최종 UI/저장소 확정 문서가 아니며, B2C 노출 위치가 확인되기 전까지 노출 surface는 `운영상 추정`으로 분리합니다.

## 2. 페이지 요약

| 항목 | 내용 |
| --- | --- |
| 모듈 | `Operation` |
| 페이지명 | `공지사항` |
| 라우트 | `/operation/notices`, `/operation/notices/create`, `/operation/notices/create/:noticeId` |
| 현재 상태 | `구현됨` |
| 페이지 유형 | `목록 운영형 + 등록 상세 페이지` |
| 페이지 목적 한 줄 요약 | 사용자에게 노출될 공지 콘텐츠를 작성, 미리보기, 게시/숨김, 삭제하는 화면입니다. |
| 주요 운영자 | `OPS_ADMIN, SUPER_ADMIN` |
| 주요 권한 | `operation.notices.manage` |
| 코드 근거 | `src/features/operation/pages/operation-notices-page.tsx`, `src/features/operation/pages/operation-notice-create-page.tsx`, `src/features/operation/api/notices-service.ts`, `src/features/operation/api/operation-notices-data-source.ts`, `src/features/operation/api/supabase-operation-notices-service.ts` |
| Supabase 자산 | `supabase/migrations-admin/20260617120000_operation_notices.sql`, `supabase/migrations-admin/down/20260617120000_operation_notices.sql` |
| 연관 SoT 문서 | `docs/specs/page-ia/operation-notices-page-ia.md`, `docs/specs/admin-data-contract.md`, `docs/specs/admin-data-usage-map.md`, `docs/specs/admin-page-tables.md` |

## 3. 이 페이지의 목적

### 목적

- 공지 제목과 HTML 본문을 작성하고 게시 상태를 운영합니다.
- 공지 ID, 제목, 작성자, HTML 본문, 작성일, 게시 상태를 관리자 기준으로 추적합니다.
- 사용자 공지 목록/상세 노출에 운영상 추정으로 연결됩니다.
- 저장/상태 변경/삭제 후 `OperationNotice + noticeId` 감사 로그 확인 경로를 제공합니다.

### 비목표

- 사용자 화면의 상세 UI 설계와 실제 B2C 저장소/라우트 확정은 별도 사용자 화면 문서에서 결정합니다.
- 예약 게시, 상단 고정, 노출 surface별 정책 세분화는 이번 DB 첫 증분 범위가 아닙니다.
- HTML sanitize/asset upload 서버 정책은 이 문서에서 새로 확정하지 않습니다.

## 4. 이 페이지에서 할 수 있는 것

| 기능/작업 | 설명 | 작업 성격 | 대상 데이터 | 결과 | 감사 로그 필요 여부 |
| --- | --- | --- | --- | --- | --- |
| 공지사항 조회 | 공지사항 목록/상세와 HTML 미리보기를 확인합니다. | 조회 | OperationNotice | 현재 상태 확인 | 불필요 |
| 공지사항 저장 | 공지 제목과 HTML 본문을 신규 저장하거나 수정합니다. 신규 저장은 기본 `숨김`입니다. | 수정 | OperationNotice + noticeId | `operation_notices` 반영 또는 mock fallback 반영 | 필요 |
| 게시/숨김 전환 | 목록 상태 스위치로 `게시`/`숨김`을 전환합니다. | 파괴적 성격 포함 조치 | OperationNotice + noticeId | 사용자 노출 후보 상태 변경 | 필요 |
| 삭제 | 삭제 아이콘으로 공지를 삭제합니다. | 파괴적 조치 | OperationNotice + noticeId | 목록/상세에서 제거 | 필요 |

## 5. 관리 데이터베이스(CRUD)

| 엔티티 | 테이블 | CRUD | 관리자 UI 진입점 | 주요 필드 | 감사 로그 Target | 사용자 화면 영향 | 미확정/차이 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| OperationNotice | `operation_notices` | Create, Read, Update, Delete | 공지사항 목록/미리보기 Modal/등록 상세 | `id`, `title`, `body_html`, `status`, `author`, `created_at`, `updated_at`, `updated_by` | `OperationNotice + noticeId` | 사용자 공지 목록/상세 운영상 추정 | 자연키 `NOTICE-NNN` max+1 채번은 동시 생성 race 리스크가 있어 후속 sequence/table 채번 검토 필요. `updated_by`는 현재 호출자 uuid 저장이라 관리자 표시명 매핑 후속 정합 필요 |

### CRUD 상세

| CRUD | 지원 여부 | 화면 동작 | 저장/서비스 source | 성공 후 동기화 대상 | 실패 시 fail-safe |
| --- | --- | --- | --- | --- | --- |
| Create | `지원` | 공지 등록 상세에서 제목/본문 저장 | `admin_save_operation_notice(p_id,p_notice,p_reason)` 또는 mock fallback | 목록, 상세, 감사 로그, 사용자 화면 후보 | error 표시, 재시도, 마지막 성공 상태 fallback |
| Read | `지원` | 공지사항 목록/단건 조회와 미리보기 | `operation_notices` select 또는 mock fallback | URL/필터/정렬/preview 복원 | empty/error 처리 |
| Update | `지원` | 공지 수정 상세 저장, 게시/숨김 전환 | `admin_save_operation_notice`, `admin_toggle_operation_notice_status(p_notice_id,p_next_status,p_reason)` 또는 mock fallback | 목록, 상세, 감사 로그 | 실패 시 재조회 또는 action-level notification |
| Delete | `지원` | 삭제 확인 모달에서 사유 입력 후 삭제 | `admin_delete_operation_notice(p_notice_id,p_reason)` 또는 mock fallback | 목록, 상세, 감사 로그, 사용자 노출 후보 | 확인 모달, 사유 필수, 실패 안내 |

### 데이터소스 전환

- 기본 서비스 facade는 `notices-service.ts`의 `fetchNoticesSafe`, `fetchNoticeSafe`, `saveNoticeSafe`, `toggleNoticeStatusSafe`, `deleteNoticeSafe`입니다.
- Supabase 설정이 없거나 `VITE_SUPABASE_DISABLED=true`이면 기존 mock 경로(`mock-operation.ts` + `operation-store.ts`)를 사용합니다.
- Supabase 설정이 있고 `VITE_OPERATION_NOTICES_SOURCE`가 `mock`이 아니면 `operation_notices` + admin RPC 3종 경로를 사용합니다.
- DB status는 `published`/`hidden`이고, 화면 라벨은 기존 표준 상태값 `게시`/`숨김`을 유지합니다.

## 6. 관리자 조치와 감사 로그 계약

| 조치 | 파괴적 여부 | 확인 단계 | 사유/근거 입력 | Target Type | Target ID | 감사 action | 감사 로그 확인 경로 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 공지 등록 | 아니오 | 없음 | 서비스 기본 사유 보강 | OperationNotice | noticeId | `notice_saved` | `/system/audit-logs?targetType=OperationNotice&targetId={noticeId}` |
| 공지 수정 | 아니오 | 없음 | 서비스 기본 사유 보강 | OperationNotice | noticeId | `notice_saved` | `/system/audit-logs?targetType=OperationNotice&targetId={noticeId}` |
| 게시/숨김 전환 | 예 | 필수 | 필수 | OperationNotice | noticeId | `notice_status_changed` | `/system/audit-logs?targetType=OperationNotice&targetId={noticeId}` |
| 삭제 | 예 | 필수 | 필수 | OperationNotice | noticeId | `notice_deleted` | `/system/audit-logs?targetType=OperationNotice&targetId={noticeId}` |

- RPC 계약: `admin_save_operation_notice`, `admin_toggle_operation_notice_status`, `admin_delete_operation_notice`.
- 모든 RPC는 reason을 필수로 받고 `admin_audit_logs.target_table='OperationNotice'`, `target_id=noticeId`를 기록합니다.

## 7. 사용자 화면 동기화 포인트

| 사용자 화면 후보 | 영향 상태 | 관리자 데이터 | 사용자 화면에 반영되는 방식 | 동기화 필요 시점 | 비고 |
| --- | --- | --- | --- | --- | --- |
| 사용자 공지 목록, 사용자 공지 상세 | 운영상 추정 | 공지 ID, 제목, 작성자, HTML 본문, 작성일, 게시 상태 | `published`(`게시`) 공지만 사용자 노출 후보로 사용하는 방향 | 관리자 변경 후 또는 원본 데이터 갱신 후 | 실제 사용자 화면 저장소/라우트 확인 전까지 추정은 추정으로 유지 |

## 8. 이 페이지와 연관있는 페이지(예상)

### 관리자 페이지

| 연관 관리자 페이지 | 관계 유형 | 연관 이유 | 이동/연동 방식 | 선행/후행 관계 | 확정 상태 |
| --- | --- | --- | --- | --- | --- |
| System > 감사 로그 | 필수 후행 | 공지사항 조치 이력 확인 | `targetType=OperationNotice&targetId={noticeId}` | 후행 | 확정 |

### 사용자 화면

| 연관 사용자 화면 후보 | 관계 유형 | 연관 이유 | 관리자 변경 후 예상 영향 | 확정 상태 |
| --- | --- | --- | --- | --- |
| 사용자 공지 목록 | 데이터 노출 후보 | 공지 제목/상태/작성일 | 게시/숨김/삭제에 따라 표시 여부가 달라질 수 있습니다. | 운영상 추정 |
| 사용자 공지 상세 | 데이터 노출 후보 | 공지 제목/HTML 본문 | 본문 수정과 게시 상태가 사용자 접근 가능성에 영향을 줄 수 있습니다. | 운영상 추정 |

## 9. 상태값/용어/키워드 정합성

| 구분 | 표준 값/용어 | DB 코드 | 사용자 노출 라벨 | 비고 |
| --- | --- | --- | --- | --- |
| 게시/숨김 | 게시/숨김 | `published`/`hidden` | 게시/숨김 | 한글 UI 라벨은 유지하고, 저장 코드는 ASCII enum으로 분리합니다. |

## 10. URL/검색/복원 규칙

- 기본 라우트: `/operation/notices`
- 필수 쿼리/경로 파라미터: 없음
- 선택 쿼리 파라미터: `status`, `sortField`, `sortOrder`, `preview`
- 목록 복원 기준: 상태 필터, 정렬, 미리보기 대상 복원
- 등록/수정 상세 라우트: `/operation/notices/create`, `/operation/notices/create/:noticeId`
- 사용자 화면 동기화에 필요한 식별자: `OperationNotice + noticeId`

## 11. 네트워크 상태와 fail-safe

| 상태 | UI 노출 | 운영자가 할 수 있는 것 | 사용자 화면 동기화 영향 |
| --- | --- | --- | --- |
| pending | 목록/상세 loading 표시 | 대기 또는 취소 | 동기화 지연 |
| success | 현재 데이터 표시 | 후속 조치 또는 원본 확인 | 동기화 가능 |
| empty | 빈 상태와 등록 유도 | 등록/후속 확인 | 직접 영향 없음 |
| error | 재시도와 마지막 성공 상태 fallback 제공 | 재시도 또는 마지막 성공 상태 확인 | 동기화 보류 |

## 12. 에이전트 작업 메모

- Codex 확인 포인트:
  - 공지사항 구현과 `docs/specs/page-ia/operation-notices-page-ia.md` 문서 일치 확인
  - data-source switch, status 매핑, reason 전달, `OperationNotice` 감사 Target 확인
- Claude 확인 포인트:
  - 공지 목록/상세의 실제 B2C 저장소/라우트 확인
  - 정책 문구, 노출/비노출 기준, HTML sanitize/preview 서버 정책 검토
- 양쪽 동기화가 필요한 결정:
  - 자연키 `NOTICE-NNN` 장기 채번 방식
  - `updated_by` uuid의 관리자 표시명 매핑
  - 사용자 화면 노출 위치 확정
  - 예약 게시/상단 고정/중요 공지 정책

## 13. 미확정 항목

| 항목 | 미확정 내용 | 필요한 결정 주체 | 관리자 페이지 영향 | 사용자 화면 영향 | 추적 문서 |
| --- | --- | --- | --- | --- | --- |
| 자연키 채번 | 첫 증분 RPC는 기존 `NOTICE-NNN` 자연키와 seed를 유지하지만, 동시 생성 race를 막는 sequence/table 채번 방식은 별도 확정이 필요합니다. | 백엔드/DB | 신규 저장 RPC 구현 변경 가능 | 직접 영향 없음 | docs/specs/admin-data-contract.md |
| 수정자 표시명 | `updated_by`가 현재 호출자 uuid를 저장하며, 관리자 표시명으로 보여줄 매핑 정책은 아직 확정되지 않았습니다. | 백엔드/프론트 | 목록/상세 수정자 표시 정합 필요 | 직접 영향 없음 | docs/specs/admin-data-contract.md |
| B2C 노출 surface | 사용자 공지 목록/상세 후보는 운영상 추정이며 실제 사용자 저장소/라우트가 확인되지 않았습니다. | 기획/백엔드/프론트 | 필터/미리보기/검증 경로 확장 가능 | 표시/접근 정책 변동 가능 | docs/specs/admin-data-usage-map.md |
| 예약/상단 고정 정책 | 예약 게시, 상단 고정, 중요 공지 우선순위는 현재 스키마와 UI 범위 밖입니다. | 기획/백엔드 | 컬럼/RPC/UI 추가 가능 | 목록 정렬/노출 우선순위 변동 가능 | docs/specs/admin-page-gap-register.md |
| HTML sanitize/preview | TinyMCE HTML sanitize, 이미지/asset upload, 사용자 렌더링 안전 정책은 서버 계약이 필요합니다. | 백엔드/보안/프론트 | 저장 검증/미리보기 정책 변경 가능 | 사용자 화면 XSS/자산 표시 정책과 직접 연결 | docs/specs/admin-page-gap-register.md |
