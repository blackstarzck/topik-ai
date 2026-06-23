# System > 관리자 계정 페이지 동기화 문서

---
doc_type: admin_page_sync
module: "System"
page_name: "관리자 계정"
route: "/system/admins"
status: "구현됨"
primary_entity: "AdminAccount"
primary_table_candidate: "v13 profiles.app_role"
owner_agent_scope: "shared"
last_reviewed_at: "2026-06-17"
---

## 1. 문서 목적

- 이 문서는 `관리자 계정` 관리자 페이지와 사용자 화면 개발 사이의 동기화 기준을 정리합니다.
- 운영자가 이 페이지에서 어떤 관리 포인트를 다루는지, 그 데이터가 사용자 화면에 어떻게 이어질 수 있는지 추적합니다.
- 이 문서는 실제 DB 스키마 확정 문서가 아니며, 현재 관리자 프론트엔드/문서 기준의 후보 계약입니다.

## 2. 페이지 요약

| 항목 | 내용 |
| --- | --- |
| 모듈 | `System` |
| 페이지명 | `관리자 계정` |
| 라우트 | `/system/admins` |
| 현재 상태 | `구현됨` |
| 페이지 유형 | `목록 운영형` |
| 페이지 목적 한 줄 요약 | v13 `profiles.app_role`에서 파생한 관리자 계정/역할/권한 수를 조회하고 감사 로그로 추적하는 시스템 운영 화면입니다. |
| 주요 운영자 | `SUPER_ADMIN` |
| 주요 권한 | `system.admins.manage` |
| 코드 근거 | `src/features/system/pages/system-admins-page.tsx` |
| 연관 SoT 문서 | `docs/specs/page-ia/system-admins-page-ia.md`, `docs/specs/admin-data-contract.md`, `docs/specs/admin-data-usage-map.md`, `docs/specs/admin-page-tables.md` |

## 3. 이 페이지의 목적

### 목적

- 관리자 계정의 ID, 이름, RoleKey, 파생 권한 수, 상태, 최근 접속을 관리자 기준으로 조회합니다.
- 2026-06-17 결정: 실제 관리자 인가 SoT는 v13 `profiles.app_role`이며, 화면의 RoleKey/권한 수는 `app_role`에서 파생된 표시/메뉴 게이팅 정보입니다.
- B2C 직접 노출 없음. 관리자 콘솔 접근 제어에만 사용됩니다.

### 비목표

- 신규 `admin_accounts`/RBAC 테이블을 관리자 인가 SoT로 확정하지 않습니다.
- 화면의 관리자 역할/권한 수 변경은 실제 DB 권한 변경이 아니며, 실권한 변경은 `profiles.app_role` 변경 경로가 별도로 확정되어야 합니다.
- 사용자 화면의 상세 UI 설계는 별도 사용자 화면 문서에서 결정합니다.

## 4. 이 페이지에서 할 수 있는 것

| 기능/작업 | 설명 | 작업 성격 | 대상 데이터 | 결과 | 감사 로그 필요 여부 |
| --- | --- | --- | --- | --- | --- |
| 관리자 계정 조회 | 관리자 계정 목록/상세와 파생 RoleKey/권한 수를 확인합니다. | 조회 | `profiles.app_role` 파생 Admin | 현재 상태 확인 | 불필요 |
| 관리자 역할 변경 | 관리자 실권한 변경이 필요한 경우 `profiles.app_role` 변경 경로로만 수행합니다. | 후속 후보 | Admin + `profiles.app_role` | 실제 인가 반영 | 필요 |

## 5. 관리 데이터베이스(CRUD)

> 아래 표는 실제 DB 확정안이 아니라 관리자 페이지 기준의 데이터 계약 후보입니다. 확정된 백엔드 스키마와 다르면 `미확정/차이`에 근거를 적습니다.

| 엔티티 후보 | 테이블 후보 | CRUD | 관리자 UI 진입점 | 주요 필드 후보 | 감사 로그 Target | 사용자 화면 영향 | 미확정/차이 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| AdminAccount | v13 `profiles` + `auth.users` | Read 확정, app_role 변경 경로 미확정 | 관리자 계정 본문/상세 | 관리자 ID, 이름, 이메일, `app_role`, 파생 RoleKey, 권한 수, 상태, 최근 접속 | Admin + adminId | 내부 전용 | 신규 `admin_accounts` 테이블 없음. `profiles.app_role`이 인가 SoT |
| AdminPermissionBundle | 없음(client `roleCatalog`/`permissionCatalog`) | Read/표시 전용 | 관리자 계정 상세/권한 관리 | RoleKey, permission count, permission keys | 없음 | 내부 전용 | 메뉴/표시 게이팅 전용. DB 인가 SoT 아님 |

### CRUD 상세

| CRUD | 지원 여부 | 화면 동작 | 저장/서비스 후보 | 성공 후 동기화 대상 | 실패 시 fail-safe |
| --- | --- | --- | --- | --- | --- |
| Create | `미확정` | 관리자 초대/생성 정책 미확정 | v13 auth/profile 경로 필요 | 목록, 상세 | error 표시, 재시도, 마지막 성공 상태 fallback |
| Read | `지원` | 관리자 계정 조회 | `permission-store.ts` mock/session 파생, 후속 Supabase read 후보 | URL/필터/탭 복원 | empty/error 처리 |
| Update | `후속 후보` | 실권한 변경은 `profiles.app_role` 변경으로만 가능 | app_role 변경 RPC 후보(미확정) | 목록, 상세, 감사 로그 | 실패 시 재조회 또는 rollback |
| Delete | `미확정` | 관리자 삭제/비활성/회수 정책 미확정 | v13 auth/profile 경로 필요 | 목록, 상세, 감사 로그 | 확인 모달, 사유 필수, 실패 안내 |

## 6. 관리자 조치와 감사 로그 계약

| 조치 | 파괴적 여부 | 확인 단계 | 사유/근거 입력 | Target Type | Target ID | 감사 로그 확인 경로 |
| --- | --- | --- | --- | --- | --- | --- |
| 관리자 역할/app_role 변경(후속 후보) | 예 | 필수 | 필수 | Admin | adminId | /system/audit-logs?targetType=Admin&targetId={adminId} |
| 관리자 계정 비활성/회수(후속 후보) | 예 | 필수 | 필수 | Admin | adminId | /system/audit-logs?targetType=Admin&targetId={adminId} |

## 7. 사용자 화면 동기화 포인트

| 사용자 화면 후보 | 영향 상태 | 관리자 데이터 | 사용자 화면에 반영되는 방식 | 동기화 필요 시점 | 비고 |
| --- | --- | --- | --- | --- | --- |
| 직접 연관 사용자 화면 없음 | 내부 전용 | 관리자 ID, 이름, 이메일, `profiles.app_role`, 파생 RoleKey, 상태, 최근 접속 | B2C 직접 노출 없음. 관리자 콘솔 접근 제어에만 사용됩니다. 실제 서버 인가는 v13 RLS/RPC가 수행합니다. | app_role 또는 계정 상태 변경 후 | 확정: RoleKey/permission count는 파생 표시값 |

## 8. 이 페이지와 연관있는 페이지(예상)

### 관리자 페이지

| 연관 관리자 페이지 | 관계 유형 | 연관 이유 | 이동/연동 방식 | 선행/후행 관계 | 확정 상태 |
| --- | --- | --- | --- | --- | --- |
| System > 권한 관리 | 참고/후속 | 관리자별 `app_role` -> RoleKey -> permission bundle 파생 기준 확인 | 식별자 또는 필터 기반 이동 | 선행 또는 후행 | 확정 |
| System > 감사 로그 | 필수 후행 | 관리자 계정 데이터의 원본 확인 또는 후속 검증 | 식별자 또는 필터 기반 이동 | 후행 | 확정 |

### 사용자 화면

| 연관 사용자 화면 후보 | 관계 유형 | 연관 이유 | 관리자 변경 후 예상 영향 | 확정 상태 |
| --- | --- | --- | --- | --- |
| 직접 연관 사용자 화면 없음 | 내부 운영 | 관리자 ID, 이름, 이메일, role, 상태, 최근 접속 | 사용자 화면 영향 없음 | 내부 전용 |

## 9. 상태값/용어/키워드 정합성

| 구분 | 표준 값/용어 | 내부 코드 후보 | 사용자 노출 라벨 | 비고 |
| --- | --- | --- | --- | --- |
| 관리자 상태 | 활성/비활성 | `AdminStatus` 화면 enum | 활성/비활성 | v13 profile status와의 장기 매핑은 후속 확인 필요 |
| v13 역할 | `learner`/`content_admin`/`org_admin`/`platform_admin` | `profiles.app_role` | 파생 RoleKey/한글 역할명 | 실제 인가 SoT |
| RoleKey | `SUPER_ADMIN`/`OPS_ADMIN`/`CONTENT_MANAGER`/`CS_MANAGER`/`READ_ONLY` | client RoleKey | 슈퍼 관리자/운영 관리자/콘텐츠 관리자/CS 담당자/조회 전용 | 메뉴/표시 게이팅 bundle |

## 10. URL/검색/복원 규칙

- 기본 라우트: `/system/admins`
- 필수 쿼리/경로 파라미터: 없음
- 선택 쿼리 파라미터: page, pageSize, keyword, status, tab, selected 등 페이지별 후보
- 목록 복원 기준: 목록/필터/정렬/탭/상세 대상 복원
- 상세 Drawer/Modal/하위 라우트 복원 여부: 행 클릭 Drawer/Modal 후보
- 사용자 화면 동기화에 필요한 식별자: Admin + adminId 또는 `profiles.app_role`

## 11. 네트워크 상태와 fail-safe

| 상태 | UI 노출 | 운영자가 할 수 있는 것 | 사용자 화면 동기화 영향 |
| --- | --- | --- | --- |
| pending | pending 상태에서 목록/상세 loading 표시 | 대기 또는 취소 | 동기화 지연 |
| success | success 상태에서 데이터 표시 | 후속 조치 또는 원본 확인 | 동기화 가능 |
| empty | empty 상태에서 빈 상태와 필터 초기화 또는 등록 유도 | 필터 초기화 또는 등록/후속 확인 | 직접 영향 없음 |
| error | error 상태에서 재시도와 마지막 성공 상태 fallback 제공 | 재시도 또는 마지막 성공 상태 확인 | 동기화 보류 |

## 12. 에이전트 작업 메모

- Codex 확인 포인트:
  - `src/features/system/pages/system-admins-page.tsx` 구현과 `docs/specs/page-ia/system-admins-page-ia.md` 문서 일치 확인
  - `profiles.app_role` -> RoleKey -> permission count 파생 경계 확인
- Claude 확인 포인트:
  - B2C 직접 노출 없음. 관리자 콘솔 접근 제어에만 사용됩니다.
  - 정책 문구와 노출/비노출 기준 검토
- 양쪽 동기화가 필요한 결정:
  - 관리자 초대/회수/비활성 정책 확정
  - app_role 변경 RPC/승인 정책 확정
  - 감사 로그 Target Type은 `Admin + adminId` 기준 유지 여부 확정

## 13. 미확정 항목

| 항목 | 미확정 내용 | 필요한 결정 주체 | 관리자 페이지 영향 | 사용자 화면 영향 | 추적 문서 |
| --- | --- | --- | --- | --- | --- |
| RBAC SoT | `Resolved/Decision-recorded`: 실제 인가 SoT는 v13 `profiles.app_role`; RoleKey/permission count는 파생 표시값입니다. | 오너 위임 결정 완료 | 신규 `admin_accounts`/RBAC SoT 후보 제거, 화면 조치 의미 재정의 필요 | B2C 직접 영향 없음 | docs/specs/admin-data-contract.md |
| 관리자 계정 운영 | 실제 로그인 관리자 식별자, 계정 초대/회수/비활성 정책, app_role 변경 RPC와 세션 재검증 정책은 미확정입니다. | 오너/백엔드/프론트 | 필터/액션/감사 로그 계약 변동 가능 | B2C 직접 노출 없음 | docs/specs/page-ia/system-admins-page-ia.md |
