# Users > 회원 목록 페이지 동기화 문서

---
doc_type: admin_page_sync
module: "Users"
page_name: "회원 목록"
route: "/users"
status: "구현됨"
primary_entity: "User"
primary_table_candidate: "v13 profiles/auth.users + writing_submissions aggregate"
owner_agent_scope: "shared"
last_reviewed_at: "2026-07-09"
---

## 1. 문서 목적

- 이 문서는 `회원 목록` 관리자 페이지와 사용자 화면 개발 사이의 동기화 기준을 정리합니다.
- 운영자가 이 페이지에서 어떤 관리 포인트를 다루는지, 그 데이터가 사용자 화면에 어떻게 이어질 수 있는지 추적합니다.
- 이 문서는 실제 DB 스키마 확정 문서가 아니며, 현재 관리자 프론트엔드/문서 기준의 후보 계약입니다.

## 2. 페이지 요약

| 항목 | 내용 |
| --- | --- |
| 모듈 | `Users` |
| 페이지명 | `회원 목록` |
| 라우트 | `/users` |
| 현재 상태 | `구현됨` |
| 페이지 유형 | `목록 운영형` |
| 페이지 목적 한 줄 요약 | 회원 기본 정보를 검색하고 상태 조치, 관리자 메모, 사유 기반 회원 정보 내보내기를 관리하는 Users 기본 목록입니다. |
| 주요 운영자 | `OPS_ADMIN, CS_MANAGER, SUPER_ADMIN` |
| 주요 권한 | `users.read, users.manage` |
| 코드 근거 | `src/features/users/pages/users-page.tsx` |
| 연관 SoT 문서 | `docs/specs/page-ia/users-list-page-ia.md`, `docs/specs/admin-data-contract.md`, `docs/specs/admin-data-usage-map.md`, `docs/specs/admin-page-tables.md` |

## 3. 이 페이지의 목적

### 목적

- 회원 검색, 상세 진입, 정지/해제, 관리자 메모, 회원 정보 내보내기를 관리합니다.
- 회원 ID, 이메일, 닉네임, 성별, 전화번호(마스킹), 가입일, 최근 접속, 회원 상태, 약관 동의, 이메일 인증, 등급, 구독 상태를 관리자 기준으로 추적합니다.
- 마이페이지 계정 정보와 로그인 접근 가드에 운영상 추정으로 연결됩니다.

### 비목표

- 실제 백엔드 스키마 최종 확정은 이 문서에서 담당하지 않습니다.
- 사용자 화면의 상세 UI 설계는 별도 사용자 화면 문서에서 결정합니다.

## 4. 이 페이지에서 할 수 있는 것

| 기능/작업 | 설명 | 작업 성격 | 대상 데이터 | 결과 | 감사 로그 필요 여부 |
| --- | --- | --- | --- | --- | --- |
| 회원 목록 조회 | 회원 목록의 목록/상세 또는 예정 데이터 블록을 확인합니다. | 조회 | User | 현재 상태 확인 | 불필요 |
| 회원 목록 관리 | 회원 ID, 이메일, 닉네임, 성별, 전화번호, 가입일, 최근 접속, 회원 상태, 약관 동의, 이메일 인증, 등급, 구독 상태에 대한 조회/상태 변경 또는 예정 계약을 관리합니다. | 수정 | User + userId | 데이터 반영 또는 후속 검증 | 필요 |
| 회원 정보 내보내기 | 현재 목록 조건 또는 선택한 회원 기준으로 컬럼을 선택해 회원 정보 XLSX를 내려받습니다. | 개인정보 반출 | User + batch:{uuid} | 파일 다운로드 및 감사 로그 기록 | 필요 |

## 5. 관리 데이터베이스(CRUD)

> 아래 표는 실제 DB 확정안이 아니라 관리자 페이지 기준의 데이터 계약 후보입니다. 확정된 백엔드 스키마와 다르면 `미확정/차이`에 근거를 적습니다.

| 엔티티 후보 | 테이블 후보 | CRUD | 관리자 UI 진입점 | 주요 필드 후보 | 감사 로그 Target | 사용자 화면 영향 | 미확정/차이 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| User | v13 `profiles`/`auth.users` + `writing_submissions` 집계 | Read, 상태 Update, Export | 회원 목록 본문/상태 조치/내보내기 모달 | 회원 ID, 이메일, 표시명, 닉네임, 성별, 전화번호(목록 마스킹/내보내기 기본 마스킹), 가입일, 최근 접속, 회원 상태(파생), `profiles.status` 원천 운영 상태, 약관 동의, 이메일 인증, 등급(`plan_label`), 제출 수, 최근 활동 | User + userId, User + batch:{uuid} | 운영상 추정 | Supabase 모드 source는 `get_admin_users`; 정지/해제는 `admin_set_user_status`가 `profiles.status`만 토글; 내보내기는 `admin_export_users`가 현재 목록 조건/선택 행 scope와 선택 컬럼 key를 감사 로그에 남김 |

### CRUD 상세

| CRUD | 지원 여부 | 화면 동작 | 저장/서비스 후보 | 성공 후 동기화 대상 | 실패 시 fail-safe |
| --- | --- | --- | --- | --- | --- |
| Create | `미지원` | 회원 목록에서 생성하지 않음 | 없음 | 없음 | 해당 없음 |
| Read | `지원` | 회원 목록 조회 | `get_admin_users(search, sort, page, page_size, affiliation)` | URL/필터/탭 복원 | empty/error 처리 |
| Update | `지원` | 회원 정지/해제 | `admin_set_user_status(target_id, new_status)` | 목록, 상세, 감사 로그 | 실패 시 재조회 또는 rollback |
| Export | `지원` | 회원 정보 내보내기 | `admin_export_users(p_reason, p_include_full_phone, p_affiliation, p_scope, p_selected_user_ids, 목록 필터, p_selected_column_keys)` | 감사 로그 | 실패 시 파일 다운로드 없이 오류 표시 |
| Delete | `미지원` | 탈퇴/deleted 전환은 이 화면 조치 범위 밖 | 없음 | 없음 | `deleted`는 RPC에서 상태 변경 차단 |

## 6. 관리자 조치와 감사 로그 계약

| 조치 | 파괴적 여부 | 확인 단계 | 사유/근거 입력 | Target Type | Target ID | 감사 로그 확인 경로 |
| --- | --- | --- | --- | --- | --- | --- |
| 회원 정지/해제 | 예 | 필수 | 필수 | User | userId | /system/audit-logs?targetType=User&targetId={userId} |
| 회원 정보 내보내기 | 개인정보 반출 | 필수 | 필수 | User | batch:{uuid} | /system/audit-logs?targetType=User&targetId=batch:{uuid} |

## 7. 사용자 화면 동기화 포인트

| 사용자 화면 후보 | 영향 상태 | 관리자 데이터 | 사용자 화면에 반영되는 방식 | 동기화 필요 시점 | 비고 |
| --- | --- | --- | --- | --- | --- |
| 마이페이지 > 계정 정보, 로그인/접근 가드 | 운영상 추정 | 회원 ID, 이메일, 닉네임, 성별, 전화번호, 가입일, 최근 접속, 회원 상태, 약관 동의, 이메일 인증, 등급, 구독 상태 | 마이페이지 계정 정보와 로그인 접근 가드에 운영상 추정으로 연결됩니다. 내보내기 감사 로그는 B2C 화면에 노출하지 않습니다. | 관리자 변경 후 또는 원본 데이터 갱신 후 | 실제 사용자 화면 저장소 확인 전까지 추정은 추정으로 유지 |

## 8. 이 페이지와 연관있는 페이지(예상)

### 관리자 페이지

| 연관 관리자 페이지 | 관계 유형 | 연관 이유 | 이동/연동 방식 | 선행/후행 관계 | 확정 상태 |
| --- | --- | --- | --- | --- | --- |
| Users > 회원 상세 | 참고/후속 | 회원 목록 데이터의 원본 확인 또는 후속 검증 | 식별자 또는 필터 기반 이동 | 선행 또는 후행 | 운영상 추정 |
| Commerce > 결제 내역 | 참고/후속 | 회원 목록 데이터의 원본 확인 또는 후속 검증 | 식별자 또는 필터 기반 이동 | 선행 또는 후행 | 운영상 추정 |
| System > 감사 로그 | 필수 후행 | 회원 목록 데이터의 원본 확인 또는 후속 검증 | 식별자 또는 필터 기반 이동 | 후행 | 확정 |

### 사용자 화면

| 연관 사용자 화면 후보 | 관계 유형 | 연관 이유 | 관리자 변경 후 예상 영향 | 확정 상태 |
| --- | --- | --- | --- | --- |
| 마이페이지 > 계정 정보 | 데이터 노출 후보 | 회원 ID, 이메일, 닉네임, 성별, 가입일, 최근 접속, 회원 상태, 약관 동의, 이메일 인증, 등급, 구독 상태 | 회원 목록 데이터 변경 시 표시/접근/알림이 달라질 수 있습니다. | 운영상 추정 |
| 로그인/접근 가드 | 데이터 노출 후보 | 회원 ID, 이메일, 닉네임, 성별, 가입일, 최근 접속, 회원 상태, 약관 동의, 이메일 인증, 등급, 구독 상태 | 회원 목록 데이터 변경 시 표시/접근/알림이 달라질 수 있습니다. | 운영상 추정 |

## 9. 상태값/용어/키워드 정합성

| 구분 | 표준 값/용어 | 내부 코드 후보 | 사용자 노출 라벨 | 비고 |
| --- | --- | --- | --- | --- |
| 회원 상태 | 인증 대기/약관 대기/정상/정지/탈퇴 | `profiles.status` + `auth.users.email_confirmed_at` + 필수 약관 동의 집계 | 인증 대기/약관 대기/정상/정지/탈퇴 | Admin 노출 파생 상태입니다. 이메일 미인증이면 `정상`으로 표시하지 않습니다. |
| 약관 동의 | 동의 완료/일부 동의/미동의/동의 불가 | `consent_status`, `consent_accepted_at` | 동의 완료/일부 동의/미동의/동의 불가 | 이메일 미인증이면 `get_admin_users`가 `none/null`로 정규화하고 화면은 `동의 불가`로 표시합니다. |
| 이메일 인증 | 인증 완료/미인증 | `auth.users.email_confirmed_at` | 인증 완료/미인증 | 가입 완료 여부입니다. 약관 동의와 같은 의미로 표시하지 않습니다. |
| 구독 상태 | 구독 상태 | page-specific enum candidate | 구독 상태 | 정확한 상태 세트는 IA와 데이터 계약 문서를 우선합니다. |

### 9.1 Supabase source 계약

- 마이그레이션: `supabase/migrations-admin/20260617210000_admin_users_directory.sql`(+ down), tracker `admin_schema_migrations`, 2026-06-17 dev DB 적용 완료.
- 신규 테이블 0건. `profiles`, `auth.users`, `writing_submissions`는 v13 소유이며, v13 `profiles` DDL은 변경하지 않는다.
- read RPC: `get_admin_users(search text, sort text, page integer, page_size integer, affiliation text default null)`는 platform_admin 전용이다. PostgREST 매칭을 위해 인자명 `search`/`sort`/`page`/`page_size`/`affiliation`은 프론트 JSON 키와 정확히 일치해야 한다. 목록은 성별 `gender`와 전화번호 `phone_masked`를 반환한다.
- write RPC: `admin_set_user_status(target_id uuid, new_status text)`는 platform_admin 전용이며 `active`/`blocked`만 허용하고 `deleted`는 차단한다. 감사 로그는 `target_table='User'`, action `user_status_changed`다.
- export RPC: `admin_export_users(p_reason, p_include_full_phone, p_affiliation, p_scope, p_selected_user_ids, p_search, p_search_field, p_start_date, p_end_date, p_gender_filters, p_tier_filters, p_subscription_status_filters, p_membership_status_filters, p_terms_consent_status_filters, p_email_verification_status_filters, p_selected_column_keys)`는 platform_admin 전용이며 사유 필수, 감사 action `users_exported`, Target ID `batch:{uuid}`를 사용한다. 파일에는 사용자 ID 필수 + 선택 컬럼만 포함되며, 감사 payload에는 검색어 원문/성별 값/전화번호 값/파일 내용을 저장하지 않는다.

## 10. URL/검색/복원 규칙

- 기본 라우트: `/users`
- 필수 쿼리/경로 파라미터: 없음
- 선택 쿼리 파라미터: page, pageSize, searchField, keyword, startDate, endDate, affiliation, gender, tier, subscriptionStatus, membershipStatus, termsConsentStatus, emailVerificationStatus
- 목록 복원 기준: 목록/필터/정렬/탭/상세 대상 복원
- 상세 Drawer/Modal/하위 라우트 복원 여부: 행 클릭 Drawer/Modal 후보
- 사용자 화면 동기화에 필요한 식별자: User + userId

## 11. 네트워크 상태와 fail-safe

| 상태 | UI 노출 | 운영자가 할 수 있는 것 | 사용자 화면 동기화 영향 |
| --- | --- | --- | --- |
| pending | pending 상태에서 목록/상세 loading 표시 | 대기 또는 취소 | 동기화 지연 |
| success | success 상태에서 데이터 표시 | 후속 조치 또는 원본 확인 | 동기화 가능 |
| empty | empty 상태에서 빈 상태와 필터 초기화 또는 등록 유도 | 필터 초기화 또는 등록/후속 확인 | 직접 영향 없음 |
| error | error 상태에서 재시도와 마지막 성공 상태 fallback 제공 | 재시도 또는 마지막 성공 상태 확인 | 동기화 보류 |

## 12. 에이전트 작업 메모

- Codex 확인 포인트:
  - `src/features/users/pages/users-page.tsx` 구현과 `docs/specs/page-ia/users-list-page-ia.md` 문서 일치 확인
  - `supabase-users-service.ts`의 `get_admin_users`/`admin_set_user_status` 호출 인자명과 감사 로그 Target 확인
- Claude 확인 포인트:
  - 마이페이지 계정 정보와 로그인 접근 가드에 운영상 추정으로 연결됩니다.
  - 정책 문구와 노출/비노출 기준 검토
- 양쪽 동기화가 필요한 결정:
  - 실제 DB/API 필드 확정
  - 사용자 화면 노출 위치 확정
  - 감사 로그 Target Type 세분화

## 13. 미확정 항목

| 항목 | 미확정 내용 | 필요한 결정 주체 | 관리자 페이지 영향 | 사용자 화면 영향 | 추적 문서 |
| --- | --- | --- | --- | --- | --- |
| 서버 페이지네이션/정렬 확장 | `get_admin_users`는 `search`, `sort`, `page`, `page_size`를 받지만 상태/기간/검색필드별 서버 필터 확장은 아직 별도 확정이 필요합니다. | 기획/백엔드/프론트 | 필터/정렬 계약 변동 가능 | 직접 영향 낮음 | docs/specs/page-ia/users-list-page-ia.md |
| 구독 상태 source | 회원 목록의 구독 상태 표시 원천은 `get_admin_users` 반환 컬럼 밖이므로 별도 결제/구독 SoT 확정이 필요합니다. | 기획/백엔드/프론트 | 컬럼 표시/필터 변동 가능 | 마이페이지 구독 상태 표시와 연결 가능 | docs/specs/admin-data-usage-map.md |
| 관리자 메모 | 관리자 메모의 저장 주체와 감사 로그 영속 정책은 이번 RPC 핫픽스 범위 밖입니다. | 기획/백엔드/프론트 | 메모 조치/감사 로그 계약 변동 가능 | 직접 영향 없음 | docs/specs/page-ia/users-list-page-ia.md |
