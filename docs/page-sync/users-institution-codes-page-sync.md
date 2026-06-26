# Users > 기관 코드 페이지 동기화 문서

---
doc_type: admin_page_sync
module: "Users"
page_name: "기관 코드"
route: "/users/institution-codes"
status: "구현됨"
primary_entity: "InstitutionCode"
primary_table_candidate: "institution_codes, profiles.affiliation_code, topik_writing_question_institution_exposure"
owner_agent_scope: "shared"
last_reviewed_at: "2026-06-26"
---

## 1. 문서 목적

- `Users > 기관 코드` 관리자 페이지와 사용자 가입/기관 전용 문항 노출 흐름의 동기화 포인트를 정리합니다.
- 이 문서는 확정 DB 스키마가 아니라 관리자 화면 기준 후보 계약입니다. 전역 SoT는 `docs/specs/admin-data-contract.md`, `docs/specs/admin-data-usage-map.md`, `docs/specs/admin-action-log.md`를 우선합니다.

## 2. 페이지 요약

| 항목 | 내용 |
| --- | --- |
| 모듈 | `Users` |
| 페이지명 | `기관 코드` |
| 라우트 | `/users/institution-codes` |
| 현재 상태 | `구현됨` |
| 페이지 유형 | `목록 운영형 + 모달 조치형` |
| 주요 권한 | `users.institution-codes.manage` |
| 코드 근거 | `src/features/users/pages/institution-codes-page.tsx` |
| 연관 SoT 문서 | `docs/specs/page-ia/users-institution-codes-page-ia.md`, `docs/specs/admin-data-contract.md`, `docs/specs/admin-data-usage-map.md`, `docs/specs/admin-action-log.md` |

## 3. 관리자 페이지 목적

- 박람회/기관/캠페인 유입 코드를 등록하고 활성 상태를 관리합니다.
- 사용하지 않는 코드를 삭제하되, 가입 회원이 남은 코드는 삭제 전에 소속 해제를 요구합니다.
- 코드별 소속 회원을 배정/해제해 `profiles.affiliation_code`와 정합을 맞춥니다.
- 기관 코드별 TOPIK 쓰기 문항 노출을 추가/해제합니다.

## 4. 관리자 페이지에서 할 수 있는 것

| 기능/작업 | 설명 | 작업 성격 | 대상 데이터 | 결과 | 감사 로그 필요 여부 |
| --- | --- | --- | --- | --- | --- |
| 기관 코드 조회 | 코드, 이름, 유형, 상태, 회원 수를 확인합니다. | 조회 | InstitutionCode | 현재 상태 확인 | 불필요 |
| 기관 코드 생성/수정 | 코드 메타데이터와 상태를 관리합니다. | 생성/수정 | InstitutionCode + code | 코드 목록 반영 | 필요 |
| 기관 코드 삭제 | 가입 회원이 없는 기관 코드를 제거합니다. | 삭제/파괴적 | InstitutionCode + code | 코드 목록 제거, 기관 노출 문항 매핑 정리 | 필요 |
| 회원 배정/해제 | 선택 회원의 기관 소속을 배정하거나 해제합니다. | 수정/파괴적 | Users + userId | 회원 affiliation 반영 | 필요 |
| 기관 노출 문항 추가/해제 | 기관 코드에 연결된 문항 노출 매핑을 변경합니다. | 수정 | InstitutionCode + questionId[] | 기관 문항 노출 반영 | 필요 |

## 5. 관리 데이터베이스(CRUD)

| 엔티티 후보 | 테이블 후보 | CRUD | 관리자 UI 진입점 | 주요 필드 후보 | 감사 로그 Target | 사용자 화면 영향 | 미확정/차이 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| InstitutionCode | institution_codes | Create, Read, Update, Delete | 본문 목록/생성/수정 모달, 삭제 확인 모달 | code, label, kind, status, note, member_count | InstitutionCode + code | 가입/QR 유입 코드 유효성 | 삭제는 가입 회원 존재 시 차단, 기관 노출 문항 매핑은 함께 정리 |
| UserInstitutionAffiliation | profiles.affiliation_code | Read, Update | 회원 관리 모달 | user_id, affiliation_code, status | Users + userId | 기관 회원 구분 | 사용자 직접 수정 여부는 비목표 |
| InstitutionQuestionExposure | topik_writing_question_institution_exposure | Create, Read, Delete | 노출 문항 모달 | institution_code, question_id, is_exposed, service_status(조회 표시) | InstitutionCode + code / AssessmentQuestion + questionId | 기관 전용 문항 노출 | `service_status='available'`이 전역 선행 조건이며, `excluded`/`internal_test` 신규 추가는 blocked |

## 6. 관리자 조치와 감사 로그 계약

| 조치 | 파괴적 여부 | 확인 단계 | 사유/근거 입력 | Target Type | Target ID | 감사 로그 확인 경로 |
| --- | --- | --- | --- | --- | --- | --- |
| 코드 생성 | 아니오 | 필드 검증 | 선택/서버 기록 | InstitutionCode | code | `/system/audit-logs?targetType=InstitutionCode&targetId={code}` |
| 코드 수정 | 아니오 | 필드 검증 | 필수 | InstitutionCode | code | `/system/audit-logs?targetType=InstitutionCode&targetId={code}` |
| 코드 삭제 | 예 | 확인 모달 | 필수 | InstitutionCode | code | `/system/audit-logs?targetType=InstitutionCode&targetId={code}` |
| 회원 배정 | 아니오 | 모달 확인 | 필수 | Users | userId | `/system/audit-logs?targetType=Users&targetId={userId}` |
| 소속 해제 | 예 | 확인 모달 | 필수 | Users | userId | `/system/audit-logs?targetType=Users&targetId={userId}` |
| 노출 문항 추가/해제 | 아니오 | 모달 확인 | 필수 | InstitutionCode | code | `/system/audit-logs?targetType=InstitutionCode&targetId={code}` |

## 7. 사용자 화면 동기화 포인트

| 사용자 화면 후보 | 영향 상태 | 관리자 데이터 | 사용자 화면에 반영되는 방식 | 동기화 필요 시점 | 비고 |
| --- | --- | --- | --- | --- | --- |
| 가입/QR 유입 | 확인됨 | InstitutionCode.code, profiles.affiliation_code | 사용자가 입력/QR로 유입된 코드가 회원 프로필에 기록됩니다. | 가입/코드 입력 시 | v13 가입 흐름과 연결 |
| 기관 전용 TOPIK 쓰기 문항 | 노출 예정 | InstitutionQuestionExposure + service_status | `service_status='available'`이고 기관 매핑이 없거나 사용자 `affiliation_code`와 매핑이 일치할 때만 노출하는 predicate 후보입니다. | 문항 목록 조회 시 | v13 적용은 handoff 후속 범위 |
| 회원 프로필/소속 표시 | 내부 전용 | profiles.affiliation_code | 관리자 운영 정보로 우선 사용합니다. | 관리자 조회 시 | 사용자 self-service 수정은 비목표 |

## 8. 연결되는 페이지

| 연결 관리자 페이지 | 관계 유형 | 연결 이유 | 이동/연동 방식 | 선행/후행 관계 | 확정 상태 |
| --- | --- | --- | --- | --- | --- |
| Users > 회원 목록 | 동등 | 기관 소속 필터/일괄 배정과 같은 affiliation 데이터를 공유합니다. | affiliationCode 필터/배정 | 동등 | 확인됨 |
| Users > 회원 상세 | 후속 검증 | 특정 회원의 기관 소속과 상태를 검수합니다. | userId 기반 이동 | 후행 | 확인됨 |
| Assessment > 문항 | 동등 | 기관 노출 문항 매핑을 공유합니다. | questionId 기반 검수 | 동등 | 운영상 추정 |
| System > 감사 로그 | 필수 후행 | 모든 변경성 조치의 증거를 확인합니다. | Target Type/ID 딥링크 | 후행 | 확인됨 |

## 9. 상태값과 용어 정합성

| 구분 | 표시 값/용어 | 내부 코드 후보 | 사용자 노출 여부 | 비고 |
| --- | --- | --- | --- | --- |
| 기관 코드 상태 | 활성, 종료 | active, ended 후보 | 가입 흐름에 간접 영향 | 현재 UI 라벨은 한글 |
| 기관 코드 유형 | 박람회, 기관, 캠페인, 기타 | expo, institution, campaign, other 후보 | 내부 운영 중심 | 코드 입력 UI에는 직접 노출하지 않음 |
| 회원 상태 | 정상, 정지, 탈퇴 후보 | profiles.status | 관리자 확인용 | Users 전역 상태값과 맞춤 |

## 10. URL/검색 복원 규칙

- 기본 라우트: `/users/institution-codes`
- 선택 쿼리 후보: `page`, `pageSize`, `kind`, `status`, `selected`, `modal`.
- 목록/필터/모달 복원은 후속 개선 후보입니다.

## 11. 네트워크 상태와 fail-safe

| 상태 | UI 노출 | 운영자가 할 수 있는 것 | 사용자 화면 동기화 영향 |
| --- | --- | --- | --- |
| pending | 목록/모달 loading | 대기 또는 닫기 | 동기화 지연 |
| success | 데이터 표시 | 후속 조치 | 동기화 가능 |
| empty | 빈 상태 안내 | 코드 생성 또는 필터 변경 | 직접 영향 없음 |
| error | 오류 Alert 또는 notification | 재시도 또는 마지막 성공 상태 확인 | 동기화 보류 |

## 12. 에이전트 작업 메모

- `src/features/users/pages/institution-codes-page.tsx`와 `docs/specs/page-ia/users-institution-codes-page-ia.md`를 함께 확인합니다.
- 기관 코드 변경은 `Users`, `Assessment`, `System > 감사 로그` 영향이 있으므로 문서/테스트를 같이 평가합니다.
- 코드 삭제는 `admin_delete_institution_code(p_code,p_reason)` 경로로만 수행하고, `profiles.affiliation_code`가 남은 회원은 먼저 회원 관리 모달에서 소속 해제해야 합니다.
- admin 기준 기관별 문항 필터 조건은 `service_status='available' AND (기관 매핑 없음 OR 사용자 affiliation_code 매핑 존재)`입니다. v13 사용자 화면 적용은 `docs/requests/v13-institution-question-exposure-handoff-2026-06-26.md`의 후속 범위입니다.

## 13. 미확정 항목

| 항목 | 미확정 내용 | 필요한 결정 주체 | 관리자 페이지 영향 | 사용자 화면 영향 | 추적 문서 |
| --- | --- | --- | --- | --- | --- |
| 기관별 문항 노출 조건의 v13 적용 | admin/RPC predicate는 확정됐지만 v13 사용자 조회·추천·제출 guard 적용은 후속 | v13/백엔드 | handoff 문서 기준 구현 | 기관 전용 문항 목록 | `docs/requests/v13-institution-question-exposure-handoff-2026-06-26.md` |
| 코드 상태 서버 정책 | 종료 코드의 신규 가입/배정 차단 수준 확인 필요 | 백엔드/운영 | 상태 변경 조치 영향 | 가입 실패/안내 문구 | `docs/specs/admin-data-contract.md` |
