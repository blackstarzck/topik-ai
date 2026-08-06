# Users > 기관 코드 상세 IA

## 1. 문서 목적

- `/users/institution-codes` 목록과 그 하위 생성/상세 페이지가 박람회/기관 유입 코드, 소속 회원, 기관별 노출 문항을 관리하는 기준을 고정합니다.
- 운영 흐름은 `목록 확인 -> 생성 페이지 또는 상세 탭 진입 -> 코드/회원/노출 문항 조치 -> 감사 로그 확인`입니다.
- 사용자 가입 흐름의 `profiles.affiliation_code`와 기관별 쓰기 문항 배정을 함께 추적합니다.

## 2. 문서 메타

| 항목 | 내용 |
| --- | --- |
| 모듈 | `Users` |
| 페이지명 | `기관 코드` |
| 현재 상태 | `구현됨 (mock/Supabase facade)` |
| 페이지 유형 | `목록 운영형 + 전용 생성/상세(탭) 페이지` |
| 라우트 | `/users/institution-codes`, `/users/institution-codes/create`, `/users/institution-codes/:code` |
| 주요 권한 | `users.institution-codes.manage` |
| 주요 role | `PLATFORM_ADMIN`, `OPS_ADMIN` |
| 연관 문서 | `docs/architecture/admin-overview.md`, `docs/guidelines/admin-ux-ui-design.md`, `docs/specs/admin-data-contract.md`, `docs/specs/admin-page-tables.md`, `docs/page-sync/users-institution-codes-page-sync.md` |

## 3. 페이지 목표와 비목표

### 목표

- 박람회/기관/캠페인 유입 코드를 생성하고 이름, 유형, 상태, 운영 메모를 관리합니다.
- 불필요해진 기관 코드를 삭제하되, 가입 회원이 남아 있는 코드는 먼저 소속 해제를 요구합니다.
- 코드별 소속 회원을 확인하고, 권한 보유자는 회원에게 기관 초대를 보내거나(수락 시 소속 적용, 2026-07-07 전환) 소속을 해제합니다.
- 기관 코드별 TOPIK 쓰기 문항 배정 목록을 확인하고 그 기관 소속 학습자에게 배정할 문항을 추가/해제합니다.
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
| 코드 테이블 | 기관 코드 목록 비교 | 코드, 이름, 유형, 상태, 노출 모드(+배정 건수), 회원 수, 생성일 | 행 클릭 → 상세 `기본 정보` 탭, 더보기 메뉴(`회원 관리`, `노출 문항`, `수정` → 각 상세 탭, 하단 분리 `삭제`는 목록에서 처리) | `Users`, `Assessment` 후속 검증 | 코드 유효성, 기관별 문항 노출 |
| 코드 삭제 확인 모달 | 기관 코드 제거 | code, reason | 삭제 | `System > 감사 로그` target=`InstitutionCode` | 가입/기관 유입 코드 사용 중지, 기관 문항 노출 매핑 정리 |
| 생성 페이지 (`/create`) | 코드 메타데이터 등록 | code, label, kind, note + 노출 모드 읽기 전용 안내 | 생성(성공 시 상세 `노출 문항` 탭으로 이동), 취소 | `System > 감사 로그` target=`InstitutionCode` | 가입/기관 유입 코드 신설 |
| 상세 헤더 (`/:code`) | 코드 식별·현재 상태 확인 | code, label, status, kind, memberCount | 없음(탭 전환) | 없음 | 없음 |
| 상세 `기본 정보` 탭 | 코드 메타데이터 수정 + 운영 담당자 | label, kind, status, note, reason + 생성·수정일 / contactName, contactEmail, reason | 수정, 담당자 정보 저장(각각 별도 사유) | `System > 감사 로그` target=`InstitutionCode` | 가입/기관 유입 코드 상태 반영 |
| 상세 `계약` 탭 | 계약 기간 원장(= 히스토리) 관리 | 툴바: D-day 배지·기간·이력 건수 / 본문: 현재 계약, 계약 행(기간/상태/문서 링크/메모) | 계약 추가·수정·삭제(사유 필수) | `System > 감사 로그` target=`InstitutionCode` | 기관 계약 기간, 만료 연동 노출 제어 |
| 상세 `회원` 탭 | 툴바(좌석 요약 + 회원 초대 Drawer + 회원 정책 Drawer) + 본문 통합 로스터 한 테이블(초대 행은 '초대 대기' 태그 + 이메일 발송 상태 태그) | userId, 이름, 이메일, 상태(회원 상태 또는 초대 대기·이메일 대기/발송됨/실패), 가입·초대일 | 회원 초대(인앱+이메일 알림, 이메일은 즉시 kick), 초대 취소, 소속 해제 | `Users > 회원 목록/상세` affiliation 필터와 정합, 발송 결과는 `메시지 ▸ 발송 이력` | 기관 회원 구분, 알림함 초대 카드 |
| 상세 `노출 문항` 탭 | 툴바(모드·배정 건수·옵션 요약 + 노출 설정 Drawer) + 본문 문항 배정 도구 | exposureMode, assignedQuestionCount, autoHideOnExpiry, autoAssignNewQuestions, questionId, 문항 번호, 주제, 유형, serviceStatus, isExposed | 노출 모드 변경, 계약 연동 옵션 토글, 문항 추가, 문항 해제 | `Assessment > 문항`의 기관 노출 상태와 정합 | 기관 소속 학습자 대상 TOPIK 쓰기 문항 배정 |

## 5. 데이터 블록 정의

- 기관 코드: `code`, `label`, `kind`, `status`, `note`, `memberCount`, `createdAt`, `updatedAt`.
- 기관 노출 모드: `exposureMode`(`제한 없음`/`배정분만`, 기본 `배정분만`), `assignedQuestionCount`. `admin_list_institution_exposure_modes` RPC 로 분리 조회해 목록과 병합한다(`admin_list_institution_codes` 는 반환 타입을 바꿀 수 없다 — expand 게이트가 `drop function` 을 차단).
- 소속 회원: `userId`, `realName`, `nickname`, `email`, `status`, `joinedAt`.
- 기관 노출 문항: `questionId`, `itemNumber`, `topicMain`, `situationSummary`, `questionTypeName`, `serviceStatus`, `isExposed`.
- `code`는 QR/가입 흐름에 전달되는 기관 코드 식별자이며, v13 `profiles.affiliation_code`와 같은 값으로 연결됩니다.
- `note`는 내부 운영 메모이며 사용자 화면에 직접 노출하지 않습니다.

## 6. 액션 정의

| 액션 | 성격 | 대상 식별 기준 | 확인/사유 필요 여부 | 성공 후 피드백 | 감사 로그 확인 경로 |
| --- | --- | --- | --- | --- | --- |
| 코드 생성 | 생성 | `InstitutionCode + code` | 필수 필드 검증 + 예약어(`create`) 거부 | notification + 감사 로그 링크, 상세 `노출 문항` 탭으로 이동 | `/system/audit-logs?targetType=InstitutionCode&targetId={code}` |
| 코드 수정 | 수정 | `InstitutionCode + code` | 사유 필수 | notification + 감사 로그 링크 | `/system/audit-logs?targetType=InstitutionCode&targetId={code}` |
| 노출 모드 변경 | 수정 | `InstitutionCode + code` | 사유 필수 + `배정분만` 전환 시 배정 0건·회원 1명 이상이면 화면·서버 양쪽에서 차단 | notification + 감사 로그 링크 | `/system/audit-logs?targetType=InstitutionCode&targetId={code}` |
| 코드 삭제 | 파괴적 | `InstitutionCode + code` | 확인 + 사유 필수, 가입 회원 존재 시 차단 | notification + 감사 로그 링크 | `/system/audit-logs?targetType=InstitutionCode&targetId={code}` |
| 회원 초대 | 수정 | `Users + userId[]` | 사유 필수 + **문항 배정 1건 이상 선행** | 초대 발송 수 표시(기소속·기pending 스킵) | `/system/audit-logs?targetType=Users&targetId={userId}` |
| 초대 취소 | 파괴적 | `Users + userId` | 확인 + 사유 필수 | 취소 대상 표시 | `/system/audit-logs?targetType=Users&targetId={userId}` |
| 소속 해제 | 파괴적 | `Users + userId` | 확인 + 사유 필수 | 변경 대상 표시 | `/system/audit-logs?targetType=Users&targetId={userId}` |
| 기관 노출 문항 추가 | 수정 | `InstitutionCode + code`, `AssessmentQuestion + questionId[]` | 사유 필수 | changed/unchanged/blocked/failed 집계 | `/system/audit-logs?targetType=InstitutionCode&targetId={code}` |
| 기관 노출 문항 해제 | 수정 | `InstitutionCode + code`, `AssessmentQuestion + questionId[]` | 사유 필수 + **회원·대기초대 있으면 마지막 1건 삭제 불가** | changed/unchanged/failed 집계 | `/system/audit-logs?targetType=InstitutionCode&targetId={code}` |

## 7. 상태값/정책/운영 규칙

- 기관 코드 상태는 `활성/종료`로 유지합니다.
- 기관 코드 유형은 `박람회/기관/캠페인/기타` 후보로 관리합니다.
- 코드 생성 시 `code`는 영문/숫자/`-`/`_`, 2~64자만 허용합니다.
- 테이블 액션 셀은 shared `TableActionMenu`의 `더보기` 버튼을 사용하고, 일반 액션은 메뉴 본문에 둡니다.
- `삭제`는 `더보기` 메뉴 최하단 footer 영역에 배치하며, 상단 구분선과 danger 강조 버튼으로 일반 액션과 분리합니다.
- 코드 삭제는 사유 입력을 필수로 요구하며, `memberCount > 0`인 코드는 삭제 전에 회원 소속을 해제해야 합니다.
- 코드 삭제 시 해당 코드의 기관별 쓰기 문항 배정 매핑(`topik_writing_question_institution_exposure`)은 함께 정리합니다.
- 회원 초대/취소/해제와 기관 노출 문항 변경은 사유 입력을 요구합니다.
- 회원 초대는 즉시 배정이 아닙니다. pending 초대와 인앱+이메일 알림이 생성되고, 회원이 v13 알림 모달에서 수락해야 `profiles.affiliation_code`가 적용됩니다(거부 시 무변화). 계약: `docs/requests/v13-institution-invitation-handoff-2026-07-07.md`.
- TOPIK 쓰기 문항의 `service_status`는 기관별 노출보다 우선하는 전역 차단 조건입니다. `available`이 아닌 문항(`excluded`, `internal_test`)은 기관 노출에 새로 추가할 수 없고 RPC는 `blocked`로 반환합니다.
- 이미 기관에 매핑된 문항이 이후 `available`이 아니게 되면 매핑 row는 삭제하지 않고 보존하지만, 노출 문항 탭에서는 `전역 미노출`로 표시하며 제거는 허용합니다.
- 다른 기관 설정 불러오기에서 `available`이 아닌 문항은 새로 추가하지 않고 건너뜁니다.
- mock 모드에서는 생성/수정/삭제/회원 초대/노출 문항 변경이 화면 상태 또는 mock 응답에만 반영될 수 있습니다.

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
| 기관 소속 회원 대상 문항 | 확인됨 | 기관 코드별 배정 매핑이 학습자 문항 목록 필터에 강제 적용됩니다 — 무소속 학습자는 `available` 전체, 기관 소속 학습자는 자기 코드 배정분만 봅니다. | 강제 지점은 `private.is_writing_question_visible_to_user`(dev 실측 2026-07-30) |
| 회원 프로필/관리 화면 | 내부 전용 | 기관 소속은 관리자 운영 정보로 우선 관리합니다. | 사용자 직접 수정은 비목표 |

## 10. URL/상태 복원

- 기본 라우트: 목록 `/users/institution-codes`, 생성 `/users/institution-codes/create`, 상세 `/users/institution-codes/:code`.
- 정적 `create` 세그먼트가 동적 `:code` 보다 먼저 매칭되므로, 코드 값 `create`는 생성 폼에서 예약어로 거부합니다(그 코드의 상세 URL 이 영구히 가려지는 것을 막습니다).
- 상세 탭은 `?tab=info|contract|members|questions`로 복원합니다. 미지정 또는 알 수 없는 값이면 `info`로 해석하며, 탭 전환은 `replace`로 기록해 뒤로 가기가 목록으로 돌아가게 합니다.
- 목록의 구 딥링크 `?selected={code}`는 상세(`/users/institution-codes/{code}`)로 `replace` 리다이렉트합니다. 기존 감사 로그 링크·북마크 호환용이며, 감사 로그가 새로 만드는 링크는 상세 URL 을 직접 가리킵니다.
- 목록의 후보 쿼리 파라미터: `page`, `pageSize`, `kind`, `status`. 목록 검색 문자열은 생성 페이지 진입 시 유지되어 취소 시 같은 목록 상태로 복귀합니다.

## 11. 네트워크 상태와 fail-safe

- `pending`: 목록/상세 탭 테이블 loading을 표시합니다.
- `success`: 목록 또는 상세 탭 데이터를 렌더링합니다.
- `empty`: 코드 또는 소속 회원이 없음을 빈 상태로 안내합니다.
- `error`: 오류 Alert 또는 notification을 노출하고, 마지막 성공 데이터가 있으면 유지합니다.
- 상세 코드 조회 실패(삭제됨·주소 오류)는 error Alert + `기관 코드 목록으로` 복귀 버튼으로 격리합니다. 노출 모드 원장 조회는 코드 조회와 독립적으로 실패할 수 있고, 실패해도 기본값(`배정분만`)으로 해석되며 나머지 탭은 계속 동작합니다.
- 요청 취소: 목록/회원/상세 조회는 `AbortController`로 이탈 시 취소합니다.

## 12. 구현 메모

- 구현 파일: `src/features/users/pages/institution-codes-page.tsx`(목록·삭제), `src/features/users/pages/institution-code-create-page.tsx`(생성), `src/features/users/pages/institution-code-detail-page.tsx`(상세 셸), `src/features/users/ui/institution-code-detail/`(탭 4개 + 공용 툴바 + 설정 Drawer 3종), `src/features/users/ui/institution-question-exposure-panel.tsx`, `src/features/users/model/institution-codes-types.ts`, `src/features/users/model/institution-questions-types.ts`.
- 상세 셸이 코드 메타·노출 모드 원장 행·계약 요약·운영 설정·노출 옵션을 한 번 조회해 탭에 내리고, 탭의 변경은 `onChanged` 콜백으로 셸 재조회를 유발합니다. 배정 건수·회원 수처럼 여러 탭이 함께 읽는 값이 stale 해지지 않게 하는 단일 경로입니다.
- 탭은 `destroyOnHidden`으로 두어 구 모달의 `destroyOnHidden` 초기화 의미(미저장 트리 선택·검색어 리셋)를 유지합니다. 설정 Drawer 도 같은 계약을 따릅니다(`destroyOnHidden`) — 닫으면 미저장 입력이 버려지며, 저장소에 미저장 확인 다이얼로그 패턴이 없어 새로 만들지 않았습니다.
- Drawer 는 탭 컴포넌트 안에 둡니다. 열림 상태를 URL 로 승격하면 e2e 가 `goto` 로 진입하고 싶어지는데, mock 원장이 모듈 메모리라 `goto` 는 시드를 초기화합니다(변경 검증이 조용히 깨집니다).
- mock 경로의 코드 생성/수정/삭제는 `src/features/users/api/mock-institution-codes.ts`의 모듈 메모리에 반영합니다. 생성·수정이 별도 라우트가 되어 목록 복귀 시 리마운트 재조회가 일어나므로, 페이지 로컬 상태 patch 로는 방금 만든 코드가 사라집니다. 시드 배열은 **끝에만** 추가합니다(e2e 가 `.first()` 행을 A부스로 가정).
- service facade: `src/features/users/api/institution-codes-service.ts`, `src/features/users/api/institution-questions-service.ts`.
- 삭제 RPC: `admin_delete_institution_code(p_code,p_reason)`는 `InstitutionCode + code` 감사 로그를 남기고, 가입 회원 존재 시 삭제를 차단합니다. 성공 시 pending 초대 취소, 문항 배정 매핑 삭제, 기관 노출 모드 원장 삭제를 같은 트랜잭션에서 수행합니다. 모드 변경 RPC와 동일한 코드 행 잠금을 사용해 동시 요청도 직렬화합니다.
- 노출 문항 패널은 좌우 모두 `유형 > 주제 > 문항` Tree를 사용한다. 좌측 Tree는 현재 노출 선택에 없는 추가 가능 후보만 보여주고, 우측 Tree는 현재 노출 선택 항목을 보여준다. 우측에서도 유형/주제 단위 체크 후 일괄 해제가 가능해야 한다.
- `코드 생성` 버튼은 본문 `AdminListCard.toolbar` 우측에 위치해야 하며, 본문 상단 생성 계열 버튼 크기 규칙(`large`)을 적용합니다.

## 13. 오픈 이슈

- **기관 노출 모드(2026-08-01)**: 기관마다 `제한 없음` 또는 `배정분만` 을 둡니다. `제한 없음` 이면 그 기관 소속 학습자도 `available` 문항 전체를 보고 이후 승격되는 신규 문항이 자동 포함됩니다(배정 목록은 보존되지만 게이팅에 참여하지 않습니다). `배정분만` 이면 배정된 문항만 봅니다. 모드 원장(`topik_writing_institution_exposure_mode`)에 행이 없으면 `배정분만` 으로 해석합니다 — 폴백과 신규 코드의 시작 모드는 항상 현행 동작인 `배정분만`입니다.
- **탭 배치 원칙(2026-08-06 개정)**: 각 탭은 **툴바(요약 지표 + 주요 액션 + 설정 Drawer 트리거) + 본문(현황)** 구조입니다. 기준은 **"값 요약은 같은 화면(툴바)에, 편집은 Drawer 에"** 입니다.

  구 기준("그 값이 바꾸는 것을 같은 화면에서 볼 수 있는가", 2026-08-05 PR-C)은 인접성만 보고 **빈도와 위계를 보지 않았습니다.** 그 결과 회원 130명 기관에서 회원 탭 첫 화면에 회원이 한 명도 안 보였고(전체 6,575px, 로스터 시작 ~1,200px), 노출 문항 탭에는 사유 입력란 3개·저장 버튼 3개가 공존하면서 본체인 배정 도구가 826px 아래로 밀렸습니다. 재배치 후 실측: 페이지 5,815px, 로스터 첫 행 440px, 첫 화면에 회원 12행.

  인접성 자체는 유지합니다 — 설정은 여전히 자기 탭 안에 있고, 판단에 필요한 수치(좌석 N/M, 모드·배정 건수·옵션 on/off, D-day·이력 건수)는 툴바에 상시 노출됩니다. 편집만 한 단계 뒤로 갑니다.

  소속 배치: 계약 기간은 `계약` 탭, 노출 모드 + 계약 연동 옵션 2종은 `노출 문항` 탭의 노출 설정 Drawer(사유 한 벌), 정원·초대 유효기간 기본값·만료 시 유입 차단은 `회원` 탭의 회원 정책 Drawer, 운영 담당자는 `기본 정보` 탭입니다(계약은 여러 건인 원장이고 담당자는 기관당 하나인 연락처라 코드·이름·상태와 성격이 같습니다).
- **현황 경보는 본문에 남깁니다.** 만료 비노출("지금 학습자에게 안 보인다"), 만료 유입 차단, 정원 소진은 설정을 열어보기 전에 알아야 하는 상태라 Drawer 안에 넣지 않습니다. Drawer 안에는 **입력에 대한 경보**(배정 0건 전환 차단 등)만 둡니다.
- **툴바 요약의 배정 건수 SoT 는 모드 원장 값**(`assignedQuestionCount`)입니다. 배정 패널이 자체 계산하는 수는 저장 전 로컬 선택이 섞여 있어 요약에 쓰면 실제와 어긋납니다.
- **D-day 배지는 단일 컴포넌트**(`institution-contract-dday-badge.tsx`)로 목록 컬럼·상세 헤더·계약 탭이 공유합니다. 색·문구 결정은 모델의 순수 함수(`resolveContractTone`/`resolveContractDdayLabel`)에 둡니다 — 화면마다 기준이 갈라져 오진을 낳은 구 노출 모드 라벨(PR #66)을 반복하지 않기 위한 것입니다.
- **`계약 없음` 과 `만료` 를 반드시 구분합니다.** 계약 미등재 기관은 만료할 계약이 없어 노출이 제한되지 않는 **정상 상태**이고, `만료` 는 조치가 필요한 상태입니다. 둘을 같은 톤으로 묶으면 운영자가 불필요한 계약을 만듭니다. 유효 계약이 없을 때는 기간 문자열을 붙이지 않습니다(`- 만료` 는 정보가 아니라 잡음이며 프리뷰 실측에서 잡았습니다).
- **만료는 배정을 지우지 않습니다.** 계약을 연장하면 배정 행이 그대로인 상태로 노출만 즉시 복구됩니다(서버 lazy 판정). 화면은 연장 후 재배정을 안내하지 않으며, 수정 성공 알림이 그 사실을 명시합니다.
- **옵션 값을 못 읽었으면 토글을 잠급니다.** 기본값 false 로 그려두면 "이미 켜져 있는데 꺼진 것처럼 보이는" 상태에서 잘못된 쓰기가 나갑니다. 자동 배정 값을 되읽는 경로는 `admin_list_institution_exposure_options`(`20260805100000`)뿐입니다 — PR-B 가 쓰기 RPC 만 만들어 write-only 였던 것을 PR-C 에서 보완했습니다.
- **초대는 `_guarded` wrapper RPC 로만 나갑니다.** 기관 코드 상세뿐 아니라 `회원 목록`의 일괄 배정과 `회원 상세`의 기관 소속 탭도 같은 경로를 씁니다 — 한 곳이라도 원함수를 직접 부르면 그 진입점에서 정원·만료 차단이 조용히 우회됩니다. 만료 기간을 비워 보내면 서버가 기관 설정의 기본값(없으면 전역 7일)으로 해석하므로 화면이 7 을 하드코딩하지 않습니다.
- **모드 전환 지점**: 상세 `노출 문항` 탭의 **노출 설정 Drawer** 안 라디오 2안(변경 사유 필수, 적용 버튼은 Drawer footer). 모드 축은 이 탭이 소유하며 `기본 정보` 탭에는 진입점조차 없습니다. 판단 재료인 현재 모드·배정 건수는 탭 툴바가 상시 노출하므로 Drawer 를 열지 않고도 상태를 읽을 수 있습니다. 생성 페이지에는 읽기 전용 안내만 두어, 배정 0건 상태로 `배정분만` 을 고를 수 있는 경로를 만들지 않습니다.
- **모드 전환 차단(2026-08-01)**: 배정이 0건인데 소속 회원 또는 대기 중 초대가 있는 기관은 `배정분만` 으로 전환할 수 없습니다. 전환 즉시 그 학습자에게 쓰기 문항이 하나도 보이지 않기 때문입니다. 노출 설정 Drawer 안에서 error Alert + footer 의 `노출 모드 변경` 비활성으로 막고, 서버는 모드 원장 트리거로 거부합니다. e2e 는 이 부재 단언을 **Drawer 를 연 뒤** 수행해야 합니다 — 닫힌 채로 하면 섹션이 없어서 무조건 통과하는 vacuous pass 가 됩니다.
- **배정 편집은 두 모드에서 모두 허용**합니다. 의도된 동선이 "먼저 배정 → 그다음 `배정분만` 전환"이라, `제한 없음` 에서 배정 편집을 잠그면 그 순서가 불가능해집니다. 대신 패널이 warning 으로 "지금은 학습자 화면에 영향을 주지 않는다"를 알리고 모드 변경 지점(노출 설정)을 가리킵니다.
- **회원 배정·초대 선행조건(2026-07-31)**: 기관에 쓰기 문항이 1건도 배정되지 않은 상태에서는 회원 직접 배정과 초대 발송이 서버에서 거부됩니다. 기관 할당제이므로 배정 0건 기관의 소속 학습자는 쓰기 문항을 하나도 보지 못하기 때문입니다. 먼저 `노출 문항` 탭에서 문항을 배정한 뒤 회원을 넣습니다. 생성 직후 상세 `노출 문항` 탭으로 이동하는 동선이 이 선행조건을 화면으로 옮긴 것입니다.
- **기관 설정 upsert 는 부분 patch 파사드로만 호출합니다**(`patchInstitutionSettingsSafe`). 서버 RPC 가 정원·초대 기본값·유입 차단·담당자를 **전량** 받는 upsert 라, 화면마다 "내가 안 고치는 필드"를 손으로 실어 나르면 하나만 빠뜨려도 다른 설정이 조용히 초기화됩니다(담당자 폼이 설정 미로드 상태에서 저장하면 정원이 지워지던 결함이 실제로 있었습니다). 파사드는 현재 값을 non-null 로 요구해 "못 읽었으면 저장할 수 없다"를 타입으로 드러냅니다.
- **마지막 배정 삭제 차단(2026-07-31)**: 소속 회원 또는 대기 중 초대가 있는 기관은 배정을 0건으로 되돌릴 수 없습니다. 회원 소속을 먼저 해제하거나 초대를 취소해야 합니다. 코드 삭제(`admin_delete_institution_code`)는 회원 0건 확인·초대 취소를 먼저 하므로 이 차단에 걸리지 않으며, 문항 배정과 모드 원장을 모두 정리해 코드 재생성 시 stale 상태를 남기지 않습니다.
- 기관 노출 문항의 predicate는 `service_status='available' AND (사용자 affiliation_code 없음 OR 기관 노출 모드 = 제한 없음 OR 매핑.institution_code = 사용자 affiliation_code)`입니다 — 무소속 학습자와 `제한 없음` 모드 기관의 소속 학습자는 `available` 문항 전체를 보고, `배정분만` 모드 기관의 소속 학습자는 자기 코드에 배정된 문항만 봅니다. v13 학습자 경로에는 `private.is_writing_question_visible_to_user`로 이미 강제 적용 중입니다(dev 실측 2026-07-30).
- 상세 `회원` 탭의 회원 검색/페이지네이션은 대량 회원 환경에서 서버 검색으로 확장할 수 있습니다.
