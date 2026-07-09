# Operation > PDF 내보내기 제한 상세 IA

## 1. 문서 목적

- PDF 내보내기 쿼터 정책(한도/주기)과 개인·기관 코드·전체 초기화 운영 화면의 구조를 현재 구현 기준으로 고정한다.
- v13 사용자 앱이 강제하는 쿼터 계약(`docs/requests/v13-pdf-export-quota-handoff-2026-07-07.md`)의 관리 포인트를 topik-ai에서 어떻게 다루는지 문서 SoT로 남긴다.
- period-local 초기화, 기관 코드 스냅샷, 주기 변경 부작용 같은 오해하기 쉬운 의미론을 화면 고지와 함께 명문화한다.

## 2. 문서 메타

| 항목 | 내용 |
| --- | --- |
| 모듈 | Operation |
| 페이지명 | PDF 내보내기 제한 |
| 현재 상태 | 구현됨 |
| 페이지 유형 | 정책/시나리오 편집형(정책 탭 — 단일 설정 서브패턴, `docs/guidelines/admin-ux-ui-design.md` §2) + 목록 운영형(초기화 탭) |
| 라우트 | `/operation/pdf-quota` (`?tab=resets`) |
| 주요 권한 | `operation.pdf-quota.manage` |
| 주요 role | `SUPER_ADMIN`, `OPS_ADMIN` |
| 관련 문서 | `docs/specs/admin-page-tables.md`, `docs/specs/admin-data-contract.md`, `docs/specs/admin-action-log.md`, `docs/architecture/shared-supabase-schema-ownership.md`(2026-07-07 PDF 쿼터 기록) |

## 3. 페이지 목표와 비목표

### 목표

- 운영자가 PDF 내보내기 한도(n회)와 주기(일/주/월)를 정책으로 관리한다.
- 개인, 기관 코드(그룹), 전체 범위의 쿼터 초기화를 사유와 함께 실행하고 이력을 추적한다.
- `검색 -> 상세 -> 조치 -> 감사 로그 확인` 운영 흐름을 유지한다.

### 비목표

- 회원별 사용량(used/remaining) 실시간 조회 화면은 P1로 보류한다(v13 claim 카운트 로직 복제로 인한 드리프트 리스크).
- 쿼터 원장(`pdf_export_quota_usages`)에 대한 admin 쓰기 경로는 만들지 않는다.
- prod 적용은 별도 게이트로 이번 범위가 아니다.

## 4. 운영 시나리오

- 시나리오 1: 운영자가 정책 탭에서 활성 정책(예: 3회/월)을 5회/주로 수정한다. 주기 변경 시 "기존 사용량이 카운트에서 제외되어 사실상 전원 초기화" 경고를 확인하고 사유를 입력한다.
- 시나리오 2: 운영자가 초기화 탭에서 특정 회원 + 특정 문항의 이번 주기 사용량을 초기화한다(민원 대응).
- 시나리오 3: 운영자가 기관 코드를 선택해 소속 회원 전체를 초기화한다. 대상 수는 실행 시점 스냅샷으로 확정된다.
- 시나리오 4: 운영자가 전체 초기화를 실행한다. 2차 확인 모달을 거쳐야 하며 모든 대상 회원이 실행 시점 스냅샷으로 확정된다.
- 시나리오 5: 운영자가 초기화 이력에서 처리자·사유·대상 수를 검수하고 감사 로그 링크로 이동한다.

## 5. 화면 구조

### 5.1 탭 1 — 정책 (설정형, 2026-07-08 재설계)

2026-07-08 오너 결정으로 "다중 행 + 활성/비활성 토글 + 모달" 구조를 폐기하고
**상주 설정 폼 + 변경 이력**으로 전환했다. 종전 구조는 정책 교체가
"전부 비활성화 → 활성화" 2단계가 되면서 무정책 공백(전 사용자 내보내기 500)을
만들 수 있었다.

- 상주 폼: 한도 InputNumber(**min 0** — 0회는 의도적 '내보내기 중단'), 주기 Select(일/주/월), 기준 시간대 Select(주요 timezone 목록, 기본 Asia/Seoul), 사유 TextArea(필수).
- 우측 상단: `정책 저장`(primary, size="large"). 폼은 정책 로드 완료 후에만 렌더하고 정책이 바뀌면 key 리마운트한다(antd initialValues 함정 회피, 저장 성공 시 사유 자동 초기화).
- 툴바 요약: `현재 정책: n회/주기 · 시간대 · 마지막 변경 시각`(+ 한도 0이면 `내보내기 중단됨` Tag). 표시 시각은 RPC가 내려준 KST 문자열을 사용하고, 동시 편집 비교용 `updated_at` 원본 timestamptz와 분리한다.
- 경고·확인:
  - 상시 '주기 변경 부작용' Alert + 주기 변경 감지 시 오류색 Alert.
  - 한도 0 입력 시 '전 사용자 내보내기 중단' 경고.
  - **주기 변경 또는 한도 0 저장은 2차 확인 모달**(파괴적 조치 확인 규칙).
- 변경 이력 섹션(폼 하단): 변경 시각(KST), 처리자, 한도 from→to, 주기 from→to, 기준 시간대, 사유. 감사 로그 기반 read RPC로 페이지네이션 조회하며 행 key는 `admin_audit_logs.id`를 사용한다. 구형 감사 행(변경 키만 기록)은 결과값 fallback(`N회 (결과값)`)으로 표시.
- 단일 정책 불변식: RPC가 항상 "현재 정책 1행"을 갱신/복구(자기치유)하며 비활성화 단독 경로가 없다. 전부 비활성 드리프트 상태에서는 "저장하면 자동 복구됩니다" 배너를 노출.
- 동시 편집: 저장 시 `p_expected_updated_at`으로 낙관적 검사. 불일치면 "다른 관리자가 변경했습니다" 안내 + 최신 값 리로드.

### 5.2 탭 2 — 초기화

- 테이블 컬럼: 실행일, 범위(개인/기관 코드/전체 Tag), 대상 수, 문항(특정 UUID 또는 전체 문항), 사유/근거, 처리자(admin 이름+이메일).
- 툴바: 범위 필터 Select + 총 건수. 우측 상단 `초기화 실행`(primary, size="large").
- 초기화 실행 모달: 범위 Radio(개인/기관 코드/전체), 개인=회원 Select(users-service 재사용), 기관 코드=기관 코드 Select(institution-codes-service 재사용), 문항 ID(선택, UUID 검증), 사유 TextArea(필수).
  - 상시 고지: "이번 주기 사용량만 초기화, 다음 주기 영향 없음. 기관 코드/전체 대상은 실행 시점 스냅샷."
  - 전체 범위 선택 시 "실행 시점 회원 스냅샷으로 대상 목록 확정" 경고 Alert + 실행 시 2차 확인 모달(danger).
- 이력 행은 수정/삭제 불가. 잘못된 조치는 보상 초기화로만 정정한다.

## 6. 데이터/RPC 계약

| 경로 | RPC | 비고 |
| --- | --- | --- |
| 정책 목록 | `get_admin_pdf_quota_policies()` | read RPC. RLS가 platform_admin 전용이라 direct select 대신 사용. created_at/updated_at_display는 KST 표시 문자열, updated_at은 동시 편집 검사 원본 timestamptz |
| 정책 변경 이력 | `get_admin_pdf_quota_policy_history(p_page, p_page_size)` | admin_audit_logs(`pdf_quota_policy_saved`) 기반, 감사 id + KST 시각 + 비민감 화이트리스트 필드만 pdf-quota 권한자에게 반환(2026-06-18 게이팅의 범위 예외) |
| 초기화 이력 | `get_admin_pdf_quota_resets(p_page, p_page_size, p_scope)` | KST 실행일 + target_count 집계 + 처리자(admin_audit_logs 기반) + total_count |
| 개인 초기화 대상 검색 | `search_admin_pdf_quota_reset_users(p_search, p_page, p_page_size)` | `operation.pdf-quota.manage` 권한 기준의 경량 회원 검색 RPC. `get_admin_users`(platform_admin) 재사용 금지, 이메일/닉네임/회원 ID 서버 검색 + 페이지네이션 |
| 정책 저장 | `admin_save_pdf_quota_policy(p_limit_count, p_period_unit, p_period_timezone, p_reason, p_expected_updated_at)` | 항상 현재 정책 1행 갱신/복구(자기치유, advisory lock 직렬화), 한도 0 허용, 낙관적 동시 편집 검사, 사유 필수. 구 시그니처(활성/비활성 토글)는 20260708150000에서 drop |
| 초기화 생성 | `admin_create_pdf_quota_reset(p_scope, p_user_id, p_group_code, p_problem_id, p_reason)` | user/group/global 모두 `pdf_export_quota_reset_targets`에 concrete user_id를 실체화. group/global은 생성 시점 스냅샷이며 0명이면 raise, 반환 `{resetId, targetCount}` |

- 테이블 소유권: `pdf_export_quota_*` 4테이블은 v13 소유(DDL 변경 금지). topik-ai는 위 admin RPC(`admin_schema_migrations`, `supabase/migrations-admin/20260708100000`, `20260708150000`)로만 읽고 쓴다.
- `pdf_export_quota_resets.created_by`는 v13 `profiles` FK라 admin 계정(프로필 없음)은 null로 저장되고, 처리자는 `admin_audit_logs`로 추적한다.

## 7. 상태/오류 처리

- 목록: pending(스피너), empty(안내 Alert), error(메시지+오류 코드+다시 시도), success.
- 정책 없음: "활성 정책이 없으면 v13 내보내기가 실패합니다" 안내.
- RPC 거부(권한/검증)는 notification error로 메시지와 오류 코드를 노출한다.

## 8. 감사 로그

- 정책 저장: `action='pdf_quota_policy_saved'`, `target_table='PdfQuotaPolicy'`, diff에 old/new, payload에 reason·period_unit_changed.
- 초기화 생성: `action='pdf_quota_reset_created'`, `target_table='PdfQuotaReset'`, payload에 reason·scope·group_code·problem_id·target_count.
- 성공 notification에 `AuditLogLink` 제공.

## 9. 결정 기록

- 2026-07-07 오너 결정: 그룹 = 기관 코드(`profiles.affiliation_code`), 마이그레이션 적용은 topik-ai 러너, SOT 제안 수락.
- 2026-07-07 채택 권고: 단일 활성 정책, 사용량 조회 P1 보류, 그룹 리셋 생성 시점 스냅샷, prod 적용 범위 제외.
- 2026-07-08 오너 결정: 정책 탭을 설정형(상주 폼 + 변경 이력)으로 재설계 — 다중 행/활성 토글 폐기(무정책 공백 제거). 한도 0 허용(의도적 중단, v13은 429로 동작), 이력은 감사 로그 기반 read RPC, usages 미참조 비활성 잔여 행은 마이그레이션에서 삭제.
- 2026-07-08 PR8 보완: 전체 초기화도 생성 시점에 `pdf_export_quota_reset_targets`로 모든 대상 회원을 실체화한다. 정책/초기화/이력 표시 시각은 KST 문자열로 반환하고, 정책 변경 이력 row key는 감사 로그 id를 사용한다.
- 2026-07-08 PR8 추가 보완: 정책 자기치유의 중복 활성 비활성화와 비활성 잔여 행 정리는 `subject_scope='user' and resource_scope='problem'` 범위로 제한한다. 개인 초기화 모달은 `search_admin_pdf_quota_reset_users` 전용 RPC로 대상 회원을 서버 검색/페이지네이션한다.
- 2026-07-08 범위 제외(후속 후보): v13 claim의 no-active-policy 폴백 하드닝(현재 fail closed 500), 한도 0일 때 v13 사용자 카피(resetAt 안내가 의도적 중단과 안 맞음).
