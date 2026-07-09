# Users > 회원 목록 상세 IA

## 1. 문서 목적

- 회원 목록 화면의 운영 목적, 데이터 블록, 조치 흐름을 같은 기준으로 정리합니다.
- 구현 전 placeholder 화면은 미확정 정책과 후속 결정 포인트를 빈칸 없이 기록하고, 구현된 화면은 현재 코드/문서 기준 운영 흐름을 고정합니다.
- 운영 기본 흐름 검색 -> 상세 -> 조치 -> 감사 로그 확인 또는 편집형 화면의 작성/수정 -> 확인 -> 발행 -> 감사 로그 확인을 유지합니다.

## 2. 문서 메타

| 항목 | 내용 |
| --- | --- |
| 모듈 | Users |
| 페이지명 | 회원 목록 |
| 현재 상태 | 구현됨 |
| 페이지 유형 | 목록 운영형 |
| 라우트 | /users |
| 주요 권한 | users.read, users.suspend, users.export |
| 주요 role | SUPER_ADMIN, OPS_ADMIN, CS_MANAGER, READ_ONLY |
| 연관 문서 | docs/architecture/admin-overview.md, docs/specs/admin-page-tables.md, docs/specs/admin-data-usage-map.md, docs/specs/admin-page-flows-mermaid.md |

## 3. 페이지 목표와 비목표

### 목표

- 회원 목록 화면의 핵심 운영 데이터를 검색하고 검수하며, 권한 있는 운영자는 사유를 남기고 회원 정보를 내보냅니다.
- 상세 확인과 조치 후 감사 로그 확인 경로를 같은 화면 문서 기준으로 고정합니다.

### 비목표

- 백엔드 정산, 배치, 외부 서비스 설정 전체를 이 화면이 직접 대체하지 않습니다.
- 연관 화면의 원본 책임을 빼앗지 않고 필요한 경우 원본 화면 이동과 감사 로그 확인 경로를 제공합니다.
- 이미 구현된 화면이라도 현재 코드/문서 SoT를 넘는 임의 규칙을 추가하지 않습니다.

## 4. 운영자 사용 시나리오

- 시나리오 1: 운영자가 회원 목록 화면에서 검색/필터를 적용하고 대상 레코드나 편집 대상을 선택합니다.
- 시나리오 2: 운영자가 회원 상세 흐름으로 세부 정보를 확인하고 필요한 조치를 실행합니다.
- 시나리오 3: 운영자가 조치 후 Target Type, Target ID 기준으로 감사 로그를 확인하고 관련 관리자 화면으로 후속 검수를 이어갑니다.

## 5. 화면 구조

| 영역 | 목적 | 주요 데이터 | 주요 액션 | 다른 관리자 페이지 영향 | 사용자 화면 영향 |
| --- | --- | --- | --- | --- | --- |
| 상단 요약 | 운영 규모와 우선순위 파악 | 요약 없음 | 없음 | 후속 화면 우선순위 결정 | 직접 또는 간접 영향 |
| 검색/필터 | 탐색 범위 축소 | 검색어, 가입 기간, 기관 소속 범위, 성별, 등급, 구독 상태, 회원 상태, 약관 동의, 이메일 인증 | 조건 변경, 초기화, 회원 정보 내보내기 | 후속 상세 대상 축소 | 직접 영향 없음 |
| 본문 영역 | 핵심 데이터 비교와 대상 선택 | 회원명, 이메일, 닉네임, 성별, 전화번호(마스킹), 가입일, 최근 접속, 회원 상태, 약관 동의, 이메일 인증, 등급, 구독 상태 | 행 클릭/편집 | 관련 화면과 연결 | 간접 영향 |
| 상세 영역 | 세부 정보와 조치 근거 확인 | 상세 이동 또는 패널 | 조회/저장/상태 변경 | 감사 로그와 연결 | 직접 또는 간접 영향 |
| 후속 링크 | 원본 화면과 감사 로그 이동 | Target Type, Target ID, 관련 링크 | 원본 화면 이동 | 후속 검수 동선 고정 | 직접 영향 없음 |

### 데이터 source

- Supabase 모드의 회원 목록 source는 `get_admin_users(search, sort, page, page_size, affiliation)` RPC입니다.
- read source는 v13 소유 `profiles`와 `auth.users` 조인, `writing_submissions` 제출 수/최근 활동 집계입니다. `profiles.gender`는 성별 표시값으로 읽고, `profiles.phone`은 목록에서 `phone_masked`로만 노출합니다. 신규 테이블은 만들지 않으며 v13 `profiles` DDL은 변경하지 않습니다.
- 정지/해제 source는 `admin_set_user_status(target_id, new_status)` RPC이며 `profiles.status`만 `active`/`blocked`로 토글하고 `deleted`는 차단합니다.
- 회원 정보 내보내기 source는 `admin_export_users(p_reason, p_include_full_phone, p_affiliation, p_scope, p_selected_user_ids, 목록 필터, p_selected_column_keys)` RPC입니다. 사유는 필수이고 기본 범위는 현재 목록 조건입니다. 선택 행이 있으면 선택 회원만 내보낼 수 있으며, 파일에는 사용자 ID 필수 + 선택 컬럼만 포함됩니다. 전화번호 컬럼을 선택하지 않으면 원문 포함은 비활성화합니다.

## 6. 데이터 블록 정의

### 상단 요약 데이터
- 별도 요약 카드 없이 본문 데이터와 상세 패널에서 직접 파악합니다.

### 검색/선택 데이터
- 검색어
- 가입 기간

### 본문 데이터
- 회원명
- 이메일
- 닉네임
- 성별
- 전화번호(마스킹)
- 가입일
- 최근 접속
- 회원 상태
- 약관 동의
- 이메일 인증
- 등급
- 구독 상태 표시

### 상세 데이터
- 별도 상세 패널 없이 원본 화면 이동으로 처리합니다.

## 7. 액션 정의

| 액션 | 성격 | 대상 식별 기준 | 확인/사유 필요 여부 | 성공 후 피드백 | 감사 로그 확인 경로 |
| --- | --- | --- | --- | --- | --- |
| 회원 상세 | 조회 | User + userId | 불필요 | 회원 상세 결과 패널을 열거나 관련 화면으로 이동합니다. | 조회 액션이므로 별도 감사 로그는 필요하지 않거나 원본 화면 흐름을 사용합니다. |
| 회원 정지/해제 | 파괴적 | User + userId | 확인 + 사유 필수 | 회원 정지/해제 완료 후 대상 식별 정보와 후속 확인 경로를 안내합니다. | /system/audit-logs?targetType=User&targetId={userId} |
| 회원 정보 내보내기 | 개인정보 반출 | User + batch:{uuid} | 사유 필수 | 엑셀 파일을 다운로드하고 반출 내역이 감사 로그에 기록되었음을 안내합니다. | /system/audit-logs?targetType=User&targetId=batch:{uuid} |
| 관리자 메모 | 수정 | User + userId | 사유 권장 | 관리자 메모 저장 후 대상 식별 정보와 후속 확인 경로를 안내합니다. | /system/audit-logs?targetType=User&targetId={userId} |

## 8. 상태값/정책/운영 규칙

| 항목 | 현재 상태 | 관리자 페이지 영향 | 사용자 화면 영향 | 추후 결정 필요 내용 |
| --- | --- | --- | --- | --- |
| 상태값/운영 규칙 | 확정 | `profiles.status` 원천은 정지/탈퇴 같은 운영 상태로 유지하되, `get_admin_users.registration_status`가 Admin의 `회원 상태`를 결정합니다. 이메일 미인증이면 약관은 `동의 완료`로 표시하지 않고 `동의 불가`로 표시합니다. | 사용자 화면의 가입 완료/접근 가드 기준과 맞춰야 합니다. | v13 사용자 앱 가입 플로우도 동등한 가입 생애주기 계약과 가드가 필요합니다. |
| URL/상태 복원 | 확정 | 목록/탭/버전/선택 상태를 새로고침과 뒤로가기에서도 가능한 한 재현해야 합니다. | 운영자는 같은 검색/상세 맥락으로 복귀할 수 있습니다. | 필수 쿼리 파라미터를 변경하면 연관 화면도 함께 검토해야 합니다. |
| 감사 추적 | 확정 | 조치가 있으면 Target Type, Target ID, 사유, 수행자 기준으로 감사 로그 확인 경로를 제공합니다. | 직접 B2C 노출이 없어도 운영 증적 확보가 필요합니다. | 조치성 액션과 조회성 액션의 로깅 범위를 분리 관리합니다. |
| 개인정보 반출 | 확정 | 회원 정보 내보내기는 사유 입력과 감사 로그 기록을 필수로 하며, 파일에는 선택한 컬럼만 포함됩니다. 사용자 ID는 필수이고 전화번호 원문 포함은 전화번호 컬럼 선택 + 권한 있는 운영자만 선택합니다. | B2C 화면을 변경하지 않지만 회원 개인정보 처리 감사 대상입니다. | 내보내기 파일 자체는 감사 로그 payload에 저장하지 않고 행수, 사유, scope, 선택 컬럼 key, 원문 포함 여부, 안전한 필터 요약만 기록합니다. |

## 9. 다른 관리자 페이지 영향

| 대상 페이지 | 영향 내용 | 연동 방식 | 선행/후행 관계 |
| --- | --- | --- | --- |
| Users > 회원 상세 | 선택 회원의 상세 검수 | 행 클릭 또는 ID 링크 | 후행 관계 |
| System > 감사 로그 | 조치가 있는 경우 Target Type, Target ID 기준으로 사후 검증을 수행합니다. | AuditLogLink 또는 딥링크 | 조치 후 필수 |

## 10. 사용자 화면/B2C 영향 참고

| 사용자 화면 후보 | 영향 상태 | 이 페이지 데이터가 반영되는 방식 | 비고 |
| --- | --- | --- | --- |
| 마이페이지 계정 정보, 로그인 사용자 식별, 구독 상태 표시 | 운영상 추정 | 운영자가 조회·조치하는 회원 기본 원천 데이터 | 회원 기본 목록 |

## 11. URL/상태 복원

- 기본 라우트: /users
- 필수 쿼리 파라미터 후보: page, pageSize, searchField, keyword, startDate, endDate, affiliation, gender, tier, subscriptionStatus, membershipStatus, termsConsentStatus, emailVerificationStatus
- Drawer/Modal 복원 여부: 권장
- 유지되어야 하는 상태: 목록 조건과 선택된 상세 패널 상태를 함께 복원하는 구조를 권장합니다.

## 12. 네트워크 상태와 fail-safe

- pending: 스켈레톤 또는 loading 상태를 표시하고, 직전 성공 데이터가 있으면 유지합니다.
- page/pageSize 변경 시에도 테이블 본문은 loading 애니메이션을 유지하고, 직전 성공 목록을 fallback으로 남깁니다.
- success: 정상 결과를 렌더링합니다.
- empty: 조건에 맞는 데이터가 없음을 페이지 맥락에 맞게 명확히 안내합니다.
- error: 오류 코드/메시지, 재시도 버튼, 마지막 성공 상태 fallback 문구를 함께 노출합니다.
- 마지막 성공 상태 fallback: 화면 전체를 비우지 않고 직전 성공 데이터나 읽기 전용 요약을 유지합니다.
- 요청 취소/재시도: 화면 이탈 시 abort, 조회 실패 시 retry, 파괴적 액션은 중복 제출 방지가 필요합니다.

## 13. 구현 메모

- 현재 코드베이스에서 재사용할 컴포넌트: PageTitle, SearchBar, AdminDataTable, ConfirmAction, AuditLogLink
- 예상 feature 파일: src/features/users/pages/*
- Supabase source 메모: `supabase-users-service.ts`는 `get_admin_users(search, sort, page, page_size, affiliation)`, `admin_set_user_status(target_id, new_status)`, `admin_export_users(p_reason, p_include_full_phone, p_affiliation, p_scope, p_selected_user_ids, 목록 필터, p_selected_column_keys)`를 호출합니다. 목록/내보내기 표시 필드에는 `gender`와 `phone_masked`가 포함되며, 인자명은 PostgREST 함수 매칭 키이므로 임의 변경하지 않습니다.
- 상태 표시 메모: `UserSummary.status`는 v13 `profiles.status` 원천 운영 상태로 보관하지만, 목록 컬럼의 `회원 상태`는 `get_admin_users.registration_status`를 우선 사용합니다. `정상 + 동의 완료 + 미인증`은 정상 표시가 아니며, 미인증 사용자의 약관 표시는 `동의 불가`로 보정합니다. 목록에는 내부 백필 진단 태그를 노출하지 않습니다.
- 감사 메모: 정지/해제는 `admin_audit_logs.target_table='User'`, action `user_status_changed`, `target_id=userId`로 기록합니다.
- 목록 상태 메모: `구독 상태` 컬럼은 외부 구독 원천 데이터를 보여주는 정보용 컬럼이므로 스위치 조치 없이 텍스트 상태로 표시합니다.
- 권한/로그 처리 메모: 파괴적 액션에는 확인 단계와 사유 입력, Target Type, Target ID, 감사 로그 확인 경로를 함께 둡니다.
- 목록 재조회 메모: `page`, `pageSize` 변경 시 목록을 다시 조회하고, 공통 `AdminDataTable` loading 애니메이션으로 페이지 전환 상태를 노출합니다.
- 내보내기 메모: 현재 UI는 개인정보 반출 기본 범위를 현재 목록 조건으로 두며, 검색어·가입일·기관 소속·성별·등급·구독 상태·회원 상태·약관 동의·이메일 인증 필터를 RPC에 전달합니다. 선택 행이 있으면 `선택한 회원만` scope를 사용할 수 있습니다. 사유, scope, 행수, 선택 컬럼 key, 안전한 필터 요약은 `admin_audit_logs.payload`에 기록합니다.
- 툴바 배치 메모: `SearchBar` 본문에는 검색/상세 검색과 기관 소속 필터를 두고, `회원 정보 내보내기`는 우측 액션 슬롯에 배치합니다. 총 건수는 상단 `SearchBar` 요약이 아니라 테이블 하단 페이지네이션 줄의 좌측에 표시합니다.

## 14. 오픈 이슈

- 일괄 상태 변경 정책 미정. 회원 정보 내보내기는 2026-07-09 기준 사유 필수 + 감사 로그 + 현재 목록 조건/선택 행 scope로 확정했습니다.
- 목록 표시 RPC는 여전히 `get_admin_users(search, sort, page, page_size, affiliation)`를 사용하고, 성별/상태류 테이블 필터는 URL query state와 클라이언트 목록 필터로 유지합니다. 내보내기 RPC는 같은 필터 값을 서버에 전달해 페이지네이션과 무관한 전체 매칭 행을 반환합니다.
## 15. 사용자 표시 규칙

- 목록 본문 테이블의 첫 번째 사용자 식별 컬럼은 raw ID나 `이름 (ID)` 조합 대신 `이름`만 파란 링크로 표시합니다.
- 회원 ID는 행 이동 대상과 감사 로그 Target ID로 유지하되, 목록의 회원명 셀에는 괄호로 반복 노출하지 않습니다.
- `profiles.display_name` 또는 `profiles.nickname`이 `NULL`이면 이메일/ID/local-part를 임의 표시명으로 만들지 않고 해당 셀에 `-`를 표시합니다.
- 회원 링크는 `Users > 회원 상세`로 이동하는 단일 동선으로 유지합니다.
- 검색 조건은 이름과 ID를 모두 지원하되, 셀 표시 자체는 `이름` 단독 표기를 기본으로 합니다.
- 약관 동의는 가입 폼에서 필수 약관을 체크한 이력이지만, 이메일 미인증 계정에서는 완료 상태로 인정하지 않습니다.
