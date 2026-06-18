# System > 권한 관리 페이지 동기화 문서

---
doc_type: admin_page_sync
module: "System"
page_name: "권한 관리"
route: "/system/permissions"
status: "구현됨"
primary_entity: "AdminAuthorization (profiles.app_role)"
primary_table_candidate: "v13 profiles.app_role (admin write RPC admin_set_admin_app_role)"
owner_agent_scope: "shared"
last_reviewed_at: "2026-06-18"
---

## 1. 문서 목적

- 이 문서는 `권한 관리` 관리자 페이지와 사용자 화면 개발 사이의 동기화 기준을 정리합니다.
- 운영자가 이 페이지에서 어떤 관리 포인트를 다루는지, 그 데이터가 사용자 화면에 어떻게 이어질 수 있는지 추적합니다.
- 이 문서는 실제 DB 스키마 확정 문서가 아니며, 현재 관리자 프론트엔드/문서 기준의 후보 계약입니다.

## 2. 페이지 요약

| 항목 | 내용 |
| --- | --- |
| 모듈 | `System` |
| 페이지명 | `권한 관리` |
| 라우트 | `/system/permissions` |
| 현재 상태 | `구현됨` |
| 페이지 유형 | `목록 운영형` |
| 페이지 목적 한 줄 요약 | platform_admin이 관리자별 v13 `profiles.app_role`(실인가 SoT)을 변경하고, 파생 RoleKey/permission 카탈로그는 메뉴/표시 게이팅 참고로 조회하는 화면입니다. |
| 주요 운영자 | `SUPER_ADMIN` |
| 주요 권한 | `system.permissions.manage` |
| 코드 근거 | `src/features/system/pages/system-permissions-page.tsx` |
| 연관 SoT 문서 | `docs/specs/page-ia/system-permissions-page-ia.md`, `docs/specs/admin-data-contract.md`, `docs/specs/admin-data-usage-map.md`, `docs/specs/admin-page-tables.md` |

## 3. 이 페이지의 목적

### 목적

- 권한 RoleKey, permission key, 설명, 위험도, 적용 메뉴/액션을 관리자 기준으로 조회합니다.
- 2026-06-17 결정: 실제 인가 SoT는 v13 `profiles.app_role`이며, 이 페이지의 37개 permission catalog는 메뉴/표시 게이팅용 client bundle입니다.
- B2C 직접 노출 없음. 관리자 화면 접근 제어에만 사용됩니다.

### 비목표

- 신규 RBAC 테이블(`system_roles`, `system_permissions`, `role_permissions`, `admin_permissions`)을 인가 SoT로 확정하지 않습니다.
- 화면의 권한 부여/수정/회수 mock 조치를 실제 DB 권한 변경으로 간주하지 않습니다.
- 사용자 화면의 상세 UI 설계는 별도 사용자 화면 문서에서 결정합니다.

## 4. 이 페이지에서 할 수 있는 것

| 기능/작업 | 설명 | 작업 성격 | 대상 데이터 | 결과 | 감사 로그 필요 여부 |
| --- | --- | --- | --- | --- | --- |
| 관리자 목록/등급 조회 | 관리자별 현재 `app_role`과 파생 RoleKey, 카탈로그 권한 수를 확인합니다(platform_admin 전용 조회). | 조회 | `admin_list_admin_app_roles` 결과(`app_role <> learner`) | 현재 상태 확인 | 불필요 |
| 관리자 등급(app_role) 변경 | platform_admin이 관리자별 `app_role`을 변경합니다. 사유 필수, 자기/마지막 platform_admin 강등 차단, 다음 로그인 반영. | 조치(파괴적) | AdminAccount + targetUserId(`profiles.app_role`) | `admin_set_admin_app_role`로 실인가 변경 + 감사 기록 | 필수 |
| 권한 카탈로그 조회 | 37 permission/5 RoleKey 카탈로그를 참고용으로 조회합니다. | 조회(읽기 전용) | client permission catalog | 메뉴 게이팅 참고. 실권한 변경 아님 | 불필요 |

## 5. 관리 데이터베이스(CRUD)

> 아래 표는 실제 DB 확정안이 아니라 관리자 페이지 기준의 데이터 계약 후보입니다. 확정된 백엔드 스키마와 다르면 `미확정/차이`에 근거를 적습니다.

| 엔티티 후보 | 테이블 후보 | CRUD | 관리자 UI 진입점 | 주요 필드 후보 | 감사 로그 Target | 사용자 화면 영향 | 미확정/차이 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| AdminAuthorization | v13 `profiles.app_role` | Read + app_role 변경(platform_admin) 확정 | 권한 관리 본문/등급 변경 Modal | `app_role`, 파생 `RoleKey`, 파생 permission keys, 상태, 최근 로그인 | AdminAccount + targetUserId | 내부 전용 | `profiles.app_role`이 유일 SoT. write=`admin_set_admin_app_role`, read=`admin_list_admin_app_roles`. 신규 RBAC 테이블 없음 |
| SystemPermissionCatalog | 없음(client bundle: `permissionCatalog`) | Read/표시 전용 | 권한 정의/역할 템플릿 | permission key, 권한명, 모듈, 범위 설명, 위험도, RoleKey defaultPermissions | 없음 | 내부 전용 | 메뉴/표시 게이팅 전용. DB 인가 SoT 아님 |

### CRUD 상세

| CRUD | 지원 여부 | 화면 동작 | 저장/서비스 후보 | 성공 후 동기화 대상 | 실패 시 fail-safe |
| --- | --- | --- | --- | --- | --- |
| Create | `미지원` | 신규 permission/role 생성 없음 | 해당 없음 | 해당 없음 | 해당 없음 |
| Read | `지원` | RoleKey/permission catalog 및 관리자별 파생 권한 조회 | `permission-store.ts` + auth session mapping | URL/필터/상세 복원 | empty/error 처리 |
| Update | `지원` | 관리자별 `app_role` 변경(platform_admin 전용). permission row 수정이 아님 | `admin_set_admin_app_role`(write) / `admin_list_admin_app_roles`(read) | 목록, 상세, 감사 로그(AdminAccount) | 서버 가드(forbidden/lockout/self-demote) 메시지 노출 + 재조회 |
| Delete | `미지원` | permission 삭제/회수는 DB 인가 삭제가 아님 | 해당 없음 | 해당 없음 | 해당 없음 |

## 6. 관리자 조치와 감사 로그 계약

| 조치 | 파괴적 여부 | 확인 단계 | 사유/근거 입력 | Target Type | Target ID | 감사 로그 확인 경로 |
| --- | --- | --- | --- | --- | --- | --- |
| 관리자 등급(app_role) 변경 | 예 | 필수(확인 Modal) | 필수 | AdminAccount | targetUserId | /system/audit-logs?targetType=AdminAccount&targetId={targetUserId} |
| 권한 카탈로그 부여/회수(mock) | 아니오 | 해당 없음 | 해당 없음 | 해당 없음(실권한 변경 아님) | 해당 없음 | 카탈로그는 메뉴 게이팅 참고, 감사 비대상 |

## 7. 사용자 화면 동기화 포인트

| 사용자 화면 후보 | 영향 상태 | 관리자 데이터 | 사용자 화면에 반영되는 방식 | 동기화 필요 시점 | 비고 |
| --- | --- | --- | --- | --- | --- |
| 직접 연관 사용자 화면 없음 | 내부 전용 | `profiles.app_role`, RoleKey 매핑, permission key, 설명, 위험도, 적용 메뉴/액션 | B2C 직접 노출 없음. 관리자 화면 메뉴/표시 게이팅에만 사용됩니다. 실제 서버 인가는 v13 RLS/RPC가 수행합니다. | app_role 또는 매핑 갱신 후 | 확정: permission catalog는 인가 SoT 아님 |

## 8. 이 페이지와 연관있는 페이지(예상)

### 관리자 페이지

| 연관 관리자 페이지 | 관계 유형 | 연관 이유 | 이동/연동 방식 | 선행/후행 관계 | 확정 상태 |
| --- | --- | --- | --- | --- | --- |
| System > 관리자 계정 | 참고/후속 | 관리자별 `app_role`/RoleKey 파생 상태 확인 | 식별자 또는 필터 기반 이동 | 선행 또는 후행 | 확정 |
| System > 감사 로그 | 필수 후행 | 권한 관리 데이터의 원본 확인 또는 후속 검증 | 식별자 또는 필터 기반 이동 | 후행 | 확정 |

### 사용자 화면

| 연관 사용자 화면 후보 | 관계 유형 | 연관 이유 | 관리자 변경 후 예상 영향 | 확정 상태 |
| --- | --- | --- | --- | --- |
| 직접 연관 사용자 화면 없음 | 내부 운영 | role, permission key, 설명, 위험도, 적용 메뉴/액션 | 사용자 화면 영향 없음 | 내부 전용 |

## 9. 상태값/용어/키워드 정합성

| 구분 | 표준 값/용어 | 내부 코드 후보 | 사용자 노출 라벨 | 비고 |
| --- | --- | --- | --- | --- |
| v13 역할 | `learner`/`content_admin`/`org_admin`/`platform_admin` | `profiles.app_role` | 화면에는 파생 RoleKey/한글 역할명 노출 | 실제 인가 SoT |
| RoleKey | `SUPER_ADMIN`/`OPS_ADMIN`/`CONTENT_MANAGER`/`CS_MANAGER`/`READ_ONLY` | client RoleKey | 슈퍼 관리자/운영 관리자/콘텐츠 관리자/CS 담당자/조회 전용 | 메뉴/표시 게이팅 bundle |
| 권한 위험도 | `low`/`medium`/`high` | client enum | Low/Medium/High | 표시/검토용, DB 인가 SoT 아님 |

## 10. URL/검색/복원 규칙

- 기본 라우트: `/system/permissions`
- 필수 쿼리/경로 파라미터: 없음
- 선택 쿼리 파라미터: page, pageSize, keyword, status, tab, selected 등 페이지별 후보
- 목록 복원 기준: 목록/필터/정렬/탭/상세 대상 복원
- 상세 Drawer/Modal/하위 라우트 복원 여부: 행 클릭 Drawer/Modal 후보
- 사용자 화면 동기화에 필요한 식별자: AdminAccount + targetUserId (`profiles.app_role`)

## 11. 네트워크 상태와 fail-safe

| 상태 | UI 노출 | 운영자가 할 수 있는 것 | 사용자 화면 동기화 영향 |
| --- | --- | --- | --- |
| pending | pending 상태에서 목록/상세 loading 표시 | 대기 또는 취소 | 동기화 지연 |
| success | success 상태에서 데이터 표시 | 후속 조치 또는 원본 확인 | 동기화 가능 |
| empty | empty 상태에서 빈 상태와 필터 초기화 또는 등록 유도 | 필터 초기화 또는 등록/후속 확인 | 직접 영향 없음 |
| error | error 상태에서 재시도와 마지막 성공 상태 fallback 제공 | 재시도 또는 마지막 성공 상태 확인 | 동기화 보류 |

## 12. 에이전트 작업 메모

- Codex 확인 포인트:
  - `src/features/system/pages/system-permissions-page.tsx` 구현과 `docs/specs/page-ia/system-permissions-page-ia.md` 문서 일치 확인
  - `src/features/auth/model/app-role-mapping.ts`, `src/features/auth/model/auth-store.ts`, `src/features/system/model/permission-store.ts`의 app_role -> RoleKey -> permission bundle 파생 경계 확인
- Claude 확인 포인트:
  - B2C 직접 노출 없음. 관리자 화면 접근 제어에만 사용됩니다.
  - 정책 문구와 노출/비노출 기준 검토
- 양쪽 동기화가 필요한 결정:
  - app_role 변경 RPC/승인 정책 확정
  - 화면을 조회/시뮬레이션 전용으로 축소할지, app_role 변경 관리 화면으로 바꿀지 확정
  - 감사 로그 Target Type은 `AdminAccount + targetUserId`, action `admin_role_changed`로 확정(2026-06-18)

## 13. 미확정 항목

| 항목 | 미확정 내용 | 필요한 결정 주체 | 관리자 페이지 영향 | 사용자 화면 영향 | 추적 문서 |
| --- | --- | --- | --- | --- | --- |
| RBAC SoT | `Resolved/Decision-recorded`: 실제 인가 SoT는 v13 `profiles.app_role`; permission catalog는 메뉴/표시 게이팅 전용입니다. | 오너 위임 결정 완료 | 신규 RBAC 테이블 후보 제거, 화면 조치 의미 재정의 필요 | B2C 직접 영향 없음 | docs/specs/admin-data-contract.md |
| app_role 변경 운영 | `Resolved/Decision-recorded`(2026-06-18): platform_admin 전용 `admin_set_admin_app_role`, 단독 실행, 다음 로그인 반영(토큰 미폐기), org_admin→READ_ONLY 임시 유지. | 오너 결정 완료 | 액션/감사 `AdminAccount`/`admin_role_changed` 확정 | B2C 직접 영향 없음 | docs/specs/admin-data-contract.md §9.1.1.a |
