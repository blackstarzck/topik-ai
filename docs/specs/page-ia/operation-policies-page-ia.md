# Operation > 정책 관리 상세 IA

## 1. 문서 목적

- 정책 관리 화면의 목록, 상세 Drawer, Drawer 내부 히스토리 섹션, 등록 상세, 감사 로그 검증 흐름을 현재 구현 기준으로 고정한다.
- 이용약관, 개인정보 처리방침, 결제ㆍ환불 정책 같은 법률 문서와 커뮤니티/리워드/메시지/권한 변경 정책 같은 운영 정책 레지스트리를 한 카탈로그에서 관리하는 기준을 정리한다.
- 요약 카드 클릭 필터, TinyMCE 본문 작성, 정책 삭제, 정책 히스토리 조회 같은 핵심 운영 상호작용을 문서 SoT로 남긴다.

## 2. 문서 메타

| 항목 | 내용 |
| --- | --- |
| 모듈 | Operation |
| 페이지명 | 정책 관리 |
| 현재 상태 | 구현됨 |
| 페이지 유형 | 목록 운영형 + 등록 상세 페이지 |
| 라우트 | `/operation/policies`, `/operation/policies/create`, `/operation/policies/create/:policyId` |
| 주요 권한 | `operation.policies.manage` |
| 주요 role | `SUPER_ADMIN`, `OPS_ADMIN` |
| 관련 문서 | `docs/specs/admin-page-tables.md`, `docs/specs/admin-data-contract.md`, `docs/specs/admin-action-log.md`, `docs/specs/admin-policy-source-map.md` |

## 3. 페이지 목표와 비목표

### 목표

- 운영자가 정책 문서를 한 화면에서 검색, 검수, 수정한다.
- 코드베이스와 문서에 흩어진 운영 정책 근거를 `OperationPolicy` 카탈로그로 집약한다.
- 등록/수정 상세 페이지에서 TinyMCE로 이미지, 표, 법령 조항, 시행 규칙 같은 서식형 본문을 작성한다.
- `검색 -> 상세 -> 조치 -> 감사 로그 확인` 운영 흐름을 유지한다.

### 비목표

- 전자서명, 법무 승인 워크플로, 외부 법령 원문 자동 수집은 현재 범위에 포함하지 않는다.
- 버전 diff 비교, 재동의 대상 추적, CDN 업로드 자산 영속화는 후속 과제로 남긴다.

## 4. 운영 시나리오

- 시나리오 1: 운영자가 상단 요약 카드(`전체 정책`, `게시 중`, `운영 정책`, `정책 미확정`)를 클릭해 현재 목록 범위를 즉시 바꾼다.
- 시나리오 2: 운영자가 SearchBar와 상세 필터로 정책 ID, 문서명, 추적 상태, 시행일을 검색한다.
- 시나리오 3: 운영자가 목록 행을 클릭해 `DetailDrawer`에서 정책 메타, 운영 범위, 법령, 관리자 메모를 검수한다.
- 시나리오 4: 운영자가 Drawer 본문의 `정책 히스토리` 섹션에서 `변경 유형`과 `액션` 컬럼, expandable row를 통해 해당 버전 스냅샷과 `변경 사유`를 확인한다. expandable row 내부 정보는 단일 `Descriptions`로 정리한다.
- 시나리오 5: 운영자가 `본문 미리보기`, `내용 수정`, `새 버전 등록`, `게시/숨김`, `정책 삭제` 액션을 실행하고, 히스토리 행에서는 `본문 보기`, `이 버전 게시`를 실행한 뒤 감사 로그를 확인한다.

## 5. 화면 구조

| 영역 | 목적 | 주요 데이터 | 주요 액션 | 관리자 영향 |
| --- | --- | --- | --- | --- |
| 상단 요약 카드 | 현재 정책 규모와 운영 상태 파악 | 전체 정책, 게시 중, 운영 정책, 정책 미확정 | 카드 클릭 필터 | 목록 범위 빠른 전환 |
| 본문 툴바 | 검색/필터/등록 진입 | 검색어, 운영 영역, 정책 유형, 추적 상태, 시행일, 총 건수 | 새 정책 등록 | 목록 진입점 |
| 목록 테이블 | 정책 문서 검수와 상세 진입 | 정책 ID, 운영 영역, 정책 유형, 문서명, 추적 상태, 버전, 시행일, 상태, 최근 수정, 수정자 | 행 클릭, 상태 스위치 | 운영 정책 목록 |
| 상세 Drawer | 메타 정보와 운영 메모 검수 | 기본 정보, 정책 요약, 운영 범위 및 추적 근거, 법령 및 근거, 관리자 메모, 정책 히스토리 | 본문 미리보기, 내용 수정, 새 버전 등록, 게시/숨김, 정책 삭제, 감사 로그 확인 | 상세 검수 중심 |
| 본문 미리보기 Modal | TinyMCE HTML 결과 검수 | HTML 본문 | 현재 정책 미리보기일 때만 내용 수정, 닫기 | 본문 QA |
| 등록 상세 페이지 | 정책 메타/본문 작성 | 운영 영역, 정책 유형, 문서명, 버전, 시행일, 노출 위치, 동의 여부, 추적 상태, 연관 관리자 화면, 연관 사용자 화면, 추적 문서, 요약, 법령 및 근거, 본문 HTML, 관리자 메모 | 저장, 목록 복귀 | 신규 등록 / 현재 정책 내용 수정 / 새 버전 등록 |

## 6. 데이터 블록 정의

### 상단 요약 카드

- `전체 정책`
  - 전체 `OperationPolicy` 건수
  - 클릭 시 `summaryFilter`를 제거하고 전체 목록으로 복귀한다.
- `게시 중`
  - `status = 게시`
  - 클릭 시 `summaryFilter=published`
- `운영 정책`
  - `category !== 법률/약관`
  - 클릭 시 `summaryFilter=operational`
- `정책 미확정`
  - `trackingStatus = 정책 미확정`
  - 클릭 시 `summaryFilter=pending`

### 본문 툴바

- SearchBar 검색 필드: `전체`, `정책 ID`, `운영 영역`, `문서명`, `추적 상태`, `연관 관리자 화면`, `연관 사용자 화면`, `추적 문서`, `버전`, `법령/근거`
- 상세 필터:
  - `운영 영역`
  - `정책 유형`
  - `정책 추적 상태`
  - `시행일`
- 우측 액션: `새 정책 등록` (`size="large"`)

### 목록 테이블

- 컬럼
  - `정책 ID`
  - `운영 영역`
  - `정책 유형`
  - `문서명`
  - `추적 상태`
  - `버전`
  - `시행일`
  - `상태`
  - `최근 수정`
  - `수정자`
- 행 클릭이 `DetailDrawer`의 유일한 상세 진입 경로다.

### 상세 Drawer

- `기본 정보`
  - 정책 ID, 운영 영역, 정책 유형, 문서명, 버전, 시행일, 상태, 추적 상태, 동의 필요, 노출 위치, 최근 수정
- `정책 요약`
- `운영 범위 및 추적 근거`
  - 연관 관리자 화면
  - 연관 사용자 화면
  - 추적 근거 문서
- `법령 및 근거`
- `관리자 메모`
- `정책 히스토리`
  - 컬럼: `버전`, `상태`, `변경 유형`, `변경 시각`, `수정자`, `액션`
  - 상단 요약 카드형 텍스트는 두지 않고, 행 확장 안내 문구만 둔다.
- 행 클릭 시 expandable row에서 해당 시점의 정책 스냅샷을 단일 `Descriptions`로 확인한다. `버전 요약`과 `변경 사유`도 별도 텍스트 블록이 아니라 같은 `Descriptions` item으로 포함한다.
- 히스토리 행 액션
  - `본문 보기`
  - `이 버전 게시`
  - 상태 UX
    - `pending`: 로딩 Alert + 테이블 loading
    - `success`: 테이블 렌더
    - `empty`: 빈 상태 Alert + 빈 테이블
    - `error`: 오류 Alert + 섹션 헤더 `다시 시도`
- 푸터 액션
  - `본문 미리보기`
  - `내용 수정`
  - `새 버전 등록`
  - `게시/숨김`
  - `정책 삭제`
  - 푸터 액션의 관리 대상은 항상 현재 선택된 `OperationPolicy`이며, 히스토리 행 단위 조치는 `본문 보기`, `이 버전 게시`만 분리한다.

### 등록 상세 페이지

- Step
  - `기본 정보`
  - `노출 및 동의`
  - `추적 근거`
  - `법령 및 요약`
  - `정책 본문`
  - `관리자 메모`
- `추적 근거`
  - `정책 추적 상태`
  - `연관 관리자 화면`: 다중 선택 `Select`
  - `연관 사용자 화면`: 다중 선택 `Select`, 현재는 운영상 추정 후보를 기본값으로 제안
  - `추적 근거 문서`: 기존과 동일하게 줄바꿈 입력
- TinyMCE 본문은 이미지, 표, 법령 조항, 시행 규칙 같은 서식형 콘텐츠의 현재 SoT다.

## 7. 액션 정의

| 액션 | 성격 | 대상 계약 | 확인/사유 | 성공 피드백 | 감사 로그 경로 |
| --- | --- | --- | --- | --- | --- |
| 정책 등록 | 등록 | `OperationPolicy + policyId` | 사유 없음 | 등록 완료 notification + 감사 로그 링크 | `/system/audit-logs?targetType=OperationPolicy&targetId={policyId}` |
| 내용 수정 | 수정 | `OperationPolicy + policyId` | 사유 없음 | 수정 완료 notification + 감사 로그 링크 | `/system/audit-logs?targetType=OperationPolicy&targetId={policyId}` |
| 새 버전 등록 | 등록 | `OperationPolicy + policyId` | 사유 없음 | 새 버전 등록 완료 notification + 감사 로그 링크 | `/system/audit-logs?targetType=OperationPolicy&targetId={policyId}` |
| 본문 미리보기 | 조회 | `OperationPolicy + policyId` | 불필요 | HTML 검수 | 해당 없음 |
| 정책 히스토리 | 조회 | `OperationPolicy + policyId` | 불필요 | Drawer 섹션 + expandable row 테이블 | 해당 없음 |
| 이 버전 게시 | 고위험 조치 | `OperationPolicy + policyId` | 확인 + 사유 필수 | 게시 전환 완료 notification + 감사 로그 링크 | `/system/audit-logs?targetType=OperationPolicy&targetId={policyId}` |
| 게시 | 고위험 조치 | `OperationPolicy + policyId` | 확인 + 사유 필수 | 게시 완료 notification + 감사 로그 링크 | `/system/audit-logs?targetType=OperationPolicy&targetId={policyId}` |
| 숨김 | 고위험 조치 | `OperationPolicy + policyId` | 확인 + 사유 필수 | 숨김 완료 notification + 감사 로그 링크 | `/system/audit-logs?targetType=OperationPolicy&targetId={policyId}` |
| 정책 삭제 | 파괴적 조치 | `OperationPolicy + policyId` | 확인 + 사유 필수 | 삭제 완료 notification + 감사 로그 링크 | `/system/audit-logs?targetType=OperationPolicy&targetId={policyId}` |

## 8. 상태값과 운영 규칙

| 항목 | 현재 상태 | 관리자 영향 | B2C 영향 |
| --- | --- | --- | --- |
| 정책 상태 | `게시`, `숨김` | 목록 switch와 Drawer 푸터 버튼으로 전환 | `게시`만 사용자 노출 후보 |
| 운영 영역 | `법률/약관`, `커뮤니티/안전`, `결제/리워드`, `운영/콘텐츠`, `메시지/알림`, `관리자/보안` | 법률 문서와 운영 규칙 문서를 같은 카탈로그에서 구분 관리 | 사용자 노출 정책과 내부 전용 정책을 혼동하지 않도록 구분 |
| 정책 유형 | 이용약관, 개인정보 처리방침, 결제ㆍ환불 정책, 청소년 보호정책, 커뮤니티 게시글 제재 정책, 추천인 보상 정책, 포인트 운영정책, 쿠폰 운영정책, 이벤트 운영정책, FAQ 노출 정책, 챗봇 상담 전환 정책, 메일 발송 운영정책, 푸시 발송 운영정책, 발송 실패/재시도 정책, 관리자 권한 변경 정책, 마케팅 정보 수신 동의 | 같은 화면에서 통합 관리 | 회원가입/결제/고객센터/앱 설정/내부 운영 기준 문서 후보 |
| 정책 추적 상태 | `코드 반영`, `문서 추적`, `정책 미확정` | 어떤 정책이 구현 기반인지 빠르게 구분 | `문서 추적`, `정책 미확정`은 사용자 노출 기준 문서로 바로 연결하지 않음 |
| 히스토리 조치 코드 | `created`, `updated`, `status_changed`, `version_published`, `deleted` | Drawer 내부 히스토리 테이블의 정렬 기준 데이터로 사용 | 내부 검수 전용 |

## 9. URL / 상태 복원

- 목록 라우트: `/operation/policies`
- 등록 상세 라우트: `/operation/policies/create`, `/operation/policies/create/:policyId`
- 쿼리 파라미터
  - `status`
  - `category`
  - `policyType`
  - `trackingStatus`
  - `summaryFilter`
  - `sortField`
  - `sortOrder`
  - `searchField`
  - `keyword`
  - `startDate`
  - `endDate`
  - `selected`
- 등록/수정 상세에서 목록으로 돌아오면 기존 검색/필터/정렬/요약 카드 상태를 유지한다.
- `mode=version`, `sourcePolicyId`를 사용해 기존 정책을 기준으로 새 버전 등록 상세를 열 수 있으며, 목록 복귀 시 해당 editor 전용 파라미터는 제거한다.
- `selected`가 있으면 같은 문서의 `DetailDrawer`를 복원한다.

## 10. 네트워크 상태와 fail-safe

- 목록
  - `pending`: 초기 로딩 또는 마지막 성공 상태 fallback 유지
  - `success`: 목록과 상세 Drawer 정상 렌더링
  - `empty`: 전체 데이터 부재 안내
  - `error`: 오류 Alert + `다시 시도` + 마지막 성공 상태 fallback
- 히스토리 섹션
  - `pending`: 로딩 Alert + 테이블 loading
- `success`: `변경 유형` 컬럼과 expandable row를 포함한 히스토리 테이블. expandable row는 단일 `Descriptions`로 버전 스냅샷을 렌더한다.
  - `empty`: 빈 상태 Alert
  - `error`: 오류 Alert + `다시 시도`
- 삭제/게시/숨김 실패는 action-level notification으로 격리하고 목록 전체는 유지한다.

## 11. 구현 메모

- 사용 컴포넌트: `PageTitle`, `ListSummaryCards`, `SearchBar`, `AdminListCard`, `AdminDataTable`, `DetailDrawer`, `HtmlPreviewModal`, `ConfirmAction`, `AdminEditorForm`
- 관련 코드
  - `src/features/operation/pages/operation-policies-page.tsx`
  - `src/features/operation/pages/operation-policy-create-page.tsx`
  - `src/features/operation/api/policies-service.ts`
  - `src/features/operation/model/policy-store.ts`
  - `src/features/operation/model/policy-types.ts`
- 정책 히스토리 mock SoT는 `OperationPolicyHistoryEntry[]`로 관리하며, 현재 조치 이력은 등록/수정/상태 변경/히스토리 버전 게시/삭제 5종으로 기록한다. 각 이력 엔트리는 `snapshot: OperationPolicy`를 포함해 expandable row에서 해당 시점의 버전 스냅샷을 렌더한다.
- cross-page 정책 근거 매핑은 `docs/specs/admin-policy-source-map.md`를 기준으로 seed/UI와 함께 관리한다.
- `정책 본문 미리보기` Modal은 별도 메타 `Descriptions` 없이 헤더 제목과 HTML 본문만 렌더한다. 현재 정책 미리보기일 때만 `내용 수정` 푸터 버튼을 노출하고, 히스토리 `본문 보기`는 읽기 전용으로 사용한다.
