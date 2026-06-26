# Users > 기관 코드 상세 IA

## 1. 문서 목적

- `/users/institution-codes` 페이지가 박람회/기관 유입 코드, 소속 회원, 기관별 노출 문항을 관리하는 기준을 고정합니다.
- 운영 흐름은 `목록 확인 -> 코드 생성/수정/삭제 -> 회원 또는 노출 문항 조치 -> 감사 로그 확인`입니다.
- 사용자 가입 흐름의 `profiles.affiliation_code`와 기관 전용 문항 노출 후보를 함께 추적합니다.

## 2. 문서 메타

| 항목 | 내용 |
| --- | --- |
| 모듈 | `Users` |
| 페이지명 | `기관 코드` |
| 현재 상태 | `구현됨 (mock/Supabase facade)` |
| 페이지 유형 | `목록 운영형 + 모달 조치형` |
| 라우트 | `/users/institution-codes` |
| 주요 권한 | `users.institution-codes.manage` |
| 주요 role | `PLATFORM_ADMIN`, `OPS_ADMIN` |
| 연관 문서 | `docs/architecture/admin-overview.md`, `docs/guidelines/admin-ux-ui-design.md`, `docs/specs/admin-data-contract.md`, `docs/specs/admin-page-tables.md`, `docs/page-sync/users-institution-codes-page-sync.md` |

## 3. 페이지 목표와 비목표

### 목표

- 박람회/기관/캠페인 유입 코드를 생성하고 이름, 유형, 상태, 운영 메모를 관리합니다.
- 불필요해진 기관 코드를 삭제하되, 가입 회원이 남아 있는 코드는 먼저 소속 해제를 요구합니다.
- 코드별 소속 회원을 확인하고, 권한 보유자는 회원을 기관 코드에 배정하거나 소속을 해제합니다.
- 기관 코드별 TOPIK 쓰기 문항 노출 목록을 확인하고 기관 전용 노출 문항을 추가/해제합니다.
- 변경성 조치는 사유와 함께 `InstitutionCode`, `Users`, 또는 문항 관련 감사 로그로 추적합니다.

### 비목표

- v13 가입 화면 자체를 설계하지 않습니다.
- 기관 계약/정산/권한 모델을 이 페이지에서 확정하지 않습니다.
- 문항 본문 편집, 태그 편집, 전체 노출 상태 변경은 `Assessment > 문항` 책임으로 유지합니다.

## 4. 화면 구조

| 영역 | 목적 | 주요 데이터 | 주요 액션 | 다른 관리자 페이지 영향 | 사용자 화면 영향 |
| --- | --- | --- | --- | --- | --- |
| 안내 문구 | 기관 코드 사용 맥락 안내 | QR/가입 유입 설명, mock/Supabase 상태 | 없음 | `Users > 회원 목록/상세` 의미 보강 | 가입 시 기관 코드 입력/QR 유입 |
| 목록 toolbar | 총 건수와 생성 액션 제공 | 전체 코드 수, 활성 코드 수, 누적 회원 수 | 코드 생성 | 공통 본문 상단 액션 배치 기준 적용 | 없음 |
| 코드 테이블 | 기관 코드 목록 비교 | 코드, 이름, 유형, 상태, 회원 수, 생성일 | 더보기 메뉴(`회원 관리`, `노출 문항`, `수정`, 하단 분리 `삭제`) | `Users`, `Assessment` 후속 검증 | 코드 유효성, 기관별 문항 노출 |
| 코드 생성/수정 모달 | 코드 메타데이터 관리 | code, label, kind, status, note, reason | 생성, 수정 | `System > 감사 로그` target=`InstitutionCode` | 가입/기관 유입 코드 상태 반영 |
| 코드 삭제 확인 모달 | 기관 코드 제거 | code, reason | 삭제 | `System > 감사 로그` target=`InstitutionCode` | 가입/기관 유입 코드 사용 중지, 기관 문항 노출 매핑 정리 |
| 회원 관리 모달 | 코드별 소속 회원 관리 | userId, 이름, 닉네임, 이메일, 회원 상태, 가입일 | 회원 추가, 소속 해제 | `Users > 회원 목록/상세` affiliation 필터와 정합 | 기관 회원 구분 |
| 노출 문항 모달 | 기관별 문항 노출 관리 | questionId, 문항 번호, 주제, 유형, serviceStatus, isExposed | 문항 추가, 문항 해제 | `Assessment > 문항`의 기관 노출 상태와 정합 | 기관 전용 TOPIK 쓰기 문항 노출 |

## 5. 데이터 블록 정의

- 기관 코드: `code`, `label`, `kind`, `status`, `note`, `memberCount`, `createdAt`, `updatedAt`.
- 소속 회원: `userId`, `realName`, `nickname`, `email`, `status`, `joinedAt`.
- 기관 노출 문항: `questionId`, `itemNumber`, `topicMain`, `situationSummary`, `questionTypeName`, `serviceStatus`, `isExposed`.
- `code`는 QR/가입 흐름에 전달되는 기관 코드 식별자이며, v13 `profiles.affiliation_code`와 같은 값으로 연결됩니다.
- `note`는 내부 운영 메모이며 사용자 화면에 직접 노출하지 않습니다.

## 6. 액션 정의

| 액션 | 성격 | 대상 식별 기준 | 확인/사유 필요 여부 | 성공 후 피드백 | 감사 로그 확인 경로 |
| --- | --- | --- | --- | --- | --- |
| 코드 생성 | 생성 | `InstitutionCode + code` | 필수 필드 검증 | notification + 감사 로그 링크 | `/system/audit-logs?targetType=InstitutionCode&targetId={code}` |
| 코드 수정 | 수정 | `InstitutionCode + code` | 사유 필수 | notification + 감사 로그 링크 | `/system/audit-logs?targetType=InstitutionCode&targetId={code}` |
| 코드 삭제 | 파괴적 | `InstitutionCode + code` | 확인 + 사유 필수, 가입 회원 존재 시 차단 | notification + 감사 로그 링크 | `/system/audit-logs?targetType=InstitutionCode&targetId={code}` |
| 회원 배정 | 수정 | `Users + userId[]` | 사유 필수 | 변경 회원 수 표시 | `/system/audit-logs?targetType=Users&targetId={userId}` |
| 소속 해제 | 파괴적 | `Users + userId` | 확인 + 사유 필수 | 변경 대상 표시 | `/system/audit-logs?targetType=Users&targetId={userId}` |
| 기관 노출 문항 추가 | 수정 | `InstitutionCode + code`, `AssessmentQuestion + questionId[]` | 사유 필수 | changed/unchanged/blocked/failed 집계 | `/system/audit-logs?targetType=InstitutionCode&targetId={code}` |
| 기관 노출 문항 해제 | 수정 | `InstitutionCode + code`, `AssessmentQuestion + questionId[]` | 사유 필수 | changed/unchanged/failed 집계 | `/system/audit-logs?targetType=InstitutionCode&targetId={code}` |

## 7. 상태값/정책/운영 규칙

- 기관 코드 상태는 `활성/종료`로 유지합니다.
- 기관 코드 유형은 `박람회/기관/캠페인/기타` 후보로 관리합니다.
- 코드 생성 시 `code`는 영문/숫자/`-`/`_`, 2~64자만 허용합니다.
- 테이블 액션 셀은 shared `TableActionMenu`의 `더보기` 버튼을 사용하고, 일반 액션은 메뉴 본문에 둡니다.
- `삭제`는 `더보기` 메뉴 최하단 footer 영역에 배치하며, 상단 구분선과 danger 강조 버튼으로 일반 액션과 분리합니다.
- 코드 삭제는 사유 입력을 필수로 요구하며, `memberCount > 0`인 코드는 삭제 전에 회원 소속을 해제해야 합니다.
- 코드 삭제 시 해당 코드의 기관 전용 문항 노출 매핑(`topik_writing_question_institution_exposure`)은 함께 정리합니다.
- 회원 배정/해제와 기관 노출 문항 변경은 사유 입력을 요구합니다.
- TOPIK 쓰기 문항의 `service_status`는 기관별 노출보다 우선하는 전역 차단 조건입니다. `available`이 아닌 문항(`excluded`, `internal_test`)은 기관 노출에 새로 추가할 수 없고 RPC는 `blocked`로 반환합니다.
- 이미 기관에 매핑된 문항이 이후 `available`이 아니게 되면 매핑 row는 삭제하지 않고 보존하지만, 모달에서는 `현재 미노출`로 표시하며 제거는 허용합니다.
- 다른 기관 설정 불러오기에서 `available`이 아닌 문항은 새로 추가하지 않고 건너뜁니다.
- mock 모드에서는 생성/수정/삭제/회원 배정/노출 문항 변경이 화면 상태 또는 mock 응답에만 반영될 수 있습니다.

## 8. 다른 관리자 페이지 영향

| 대상 페이지 | 영향 내용 | 연동 방식 | 선행/후행 관계 |
| --- | --- | --- | --- |
| `Users > 회원 목록` | 기관 소속 필터와 일괄 배정/해제 흐름 | `affiliationCode` 기준 | 동등 |
| `Users > 회원 상세` | 개인별 기관 코드 확인 및 수정 | `profiles.affiliation_code` | 후행 검증 |
| `Assessment > 문항` | 문항별 기관 노출 설정과 동일 매핑 공유 | `topik_writing_question_institution_exposure` 후보 | 동등 |
| `System > 감사 로그` | 코드/회원/문항 조치 확인 | Target Type/ID 딥링크 | 필수 후행 |

## 9. 사용자 화면/B2C 영향 참고

| 사용자 화면 후보 | 영향 상태 | 이 페이지 데이터가 반영되는 방식 | 비고 |
| --- | --- | --- | --- |
| 가입/QR 유입 | 확인됨 | 가입 시 입력/저장되는 기관 코드가 `profiles.affiliation_code`로 남습니다. | v13 가입 흐름과 연결 |
| 기관 회원 전용 문항 | 운영상 추정 | 기관 코드별 노출 문항 매핑이 사용자 문항 목록 필터에 사용될 수 있습니다. | 사용자 노출 조건은 v13 구현 확인 필요 |
| 회원 프로필/관리 화면 | 내부 전용 | 기관 소속은 관리자 운영 정보로 우선 관리합니다. | 사용자 직접 수정은 비목표 |

## 10. URL/상태 복원

- 기본 라우트: `/users/institution-codes`
- 현재 구현은 테이블 컬럼 필터와 기본 페이지네이션 중심입니다.
- 후보 쿼리 파라미터: `page`, `pageSize`, `kind`, `status`, `selected`.
- 회원 관리/노출 문항 모달은 추후 `selected`와 `modal` 쿼리로 복원할 수 있습니다.

## 11. 네트워크 상태와 fail-safe

- `pending`: 목록/모달 테이블 loading을 표시합니다.
- `success`: 목록 또는 모달 데이터를 렌더링합니다.
- `empty`: 코드 또는 소속 회원이 없음을 빈 상태로 안내합니다.
- `error`: 오류 Alert 또는 notification을 노출하고, 마지막 성공 데이터가 있으면 유지합니다.
- 요청 취소: 목록/회원 조회는 `AbortController`로 이탈 시 취소합니다.

## 12. 구현 메모

- 구현 파일: `src/features/users/pages/institution-codes-page.tsx`, `src/features/users/model/institution-codes-types.ts`, `src/features/users/model/institution-questions-types.ts`.
- service facade: `src/features/users/api/institution-codes-service.ts`, `src/features/users/api/institution-questions-service.ts`.
- 삭제 RPC: `admin_delete_institution_code(p_code,p_reason)`는 `InstitutionCode + code` 감사 로그를 남기고, 가입 회원 존재 시 삭제를 차단합니다.
- 노출 문항 모달은 좌우 모두 `유형 > 주제 > 문항` Tree를 사용한다. 좌측 Tree는 현재 노출 선택에 없는 추가 가능 후보만 보여주고, 우측 Tree는 현재 노출 선택 항목을 보여준다. 우측에서도 유형/주제 단위 체크 후 일괄 해제가 가능해야 한다.
- `코드 생성` 버튼은 본문 `AdminListCard.toolbar` 우측에 위치해야 하며, 본문 상단 생성 계열 버튼 크기 규칙(`large`)을 적용합니다.

## 13. 오픈 이슈

- 기관 노출 문항의 admin 기준 predicate는 `service_status='available' AND (기관 매핑 없음 OR 사용자 affiliation_code 매핑 존재)`입니다. v13 사용자 화면 전체 적용은 별도 handoff 범위입니다.
- 회원 관리 모달의 회원 검색/페이지네이션은 대량 회원 환경에서 서버 검색으로 확장할 수 있습니다.
