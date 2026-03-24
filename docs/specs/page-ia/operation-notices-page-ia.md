# Operation > 공지사항 상세 IA

## 1. 문서 목적

- 공지사항 화면의 운영 목적, 데이터 블록, 조치 흐름을 같은 기준으로 정리합니다.
- 목록 검수, 등록 상세 작성, 게시/숨김/삭제 조치, 감사 로그 확인까지 현재 구현 기준을 단일 SoT로 유지합니다.

## 2. 문서 메타

| 항목 | 내용 |
| --- | --- |
| 모듈 | Operation |
| 페이지명 | 공지사항 |
| 현재 상태 | 구현됨 |
| 페이지 유형 | 목록 운영형 + 등록 상세 페이지 |
| 라우트 | `/operation/notices`, `/operation/notices/create`, `/operation/notices/create/:noticeId` |
| 주요 권한 | `operation.notices.manage` |
| 주요 role | `SUPER_ADMIN`, `OPS_ADMIN` |
| 연관 문서 | `docs/specs/admin-page-analysis.md`, `docs/specs/admin-page-tables.md`, `docs/specs/admin-data-usage-map.md`, `docs/specs/admin-page-flows-mermaid.md` |

## 3. 페이지 목표와 비목표

### 목표

- 공지사항 목록을 검수하고 상태를 운영합니다.
- 등록/수정은 별도 상세 페이지에서 제목과 TinyMCE 본문을 작성합니다.
- 게시/숨김/삭제 조치 후 `Target Type`, `Target ID`, 감사 로그 확인 경로를 제공합니다.

### 비목표

- 백엔드 배치, 배포, 스케줄링 정책은 이 화면에서 직접 다루지 않습니다.
- B2C 공지 노출 규칙 전체를 이 문서에서 새로 정의하지 않고, 현재 운영 입력/검수 흐름만 다룹니다.

## 4. 운영자 시나리오

- 시나리오 1: 운영자가 목록 행을 클릭해 HTML 본문을 미리보기 Modal에서 검수합니다.
- 시나리오 2: 운영자가 `공지 등록` 버튼으로 상세 페이지에 진입해 `공지 제목 + TinyMCE 본문`을 저장합니다. 신규 공지는 기본적으로 `숨김` 상태로 저장됩니다.
- 시나리오 3: 운영자가 미리보기 Modal 푸터의 `공지 수정` 버튼으로 수정 상세 페이지로 이동합니다.
- 시나리오 4: 운영자가 목록의 상태 스위치를 사용해 `게시/숨김`을 전환하고, 확인 모달에서 사유를 남긴 뒤 감사 로그를 확인합니다.
- 시나리오 5: 운영자가 목록의 붉은색 삭제 아이콘 버튼으로 공지를 삭제하고, 확인 모달에서 사유를 남긴 뒤 감사 로그를 확인합니다.

## 5. 화면 구조

| 영역 | 목적 | 주요 데이터 | 주요 액션 | 관리자 영향 |
| --- | --- | --- | --- | --- |
| 본문 툴바 | 목록 규모와 등록 진입 제공 | `총 n건`, `공지 등록` 버튼 | 등록 상세 이동 | 별도 SearchBar 없이 목록 운영형 툴바 기준 유지 |
| 목록 테이블 | 공지 검수와 조치 진입 | 공지 ID, 제목, 작성자, 작성일, 상태 스위치, 삭제 아이콘 | 행 클릭 미리보기, 게시/숨김 전환, 삭제 | 운영 핵심 목록 |
| 미리보기 Modal | 저장된 HTML 본문 검수 | 공지 ID, 제목, 상태, HTML 본문 | 닫기, 공지 수정 | 수정 진입 전 검수 단계 |
| 등록 상세 페이지 | 제목/본문 작성 | 공지 제목, TinyMCE 본문 | 저장, 목록 복귀 | 신규 저장은 숨김 상태 |
| 확인 모달 | 파괴적/상태 전환 조치 검증 | 대상 유형, 대상 ID, 사유 | 게시, 숨김, 삭제 실행 | 감사 로그 추적 연결 |

## 6. 데이터 블록 정의

### 본문 툴바

- `총 n건`
- `공지 등록` 버튼 (`size="large"`)

### 목록 테이블

- `공지 ID`
- `제목`
- `작성자`
- `작성일`
- `상태` 스위치
  - on: `게시`
  - off: `숨김`
- `액션` 삭제 아이콘 버튼

### 미리보기 Modal

- `공지 ID`
- `제목`
- `상태`
- 저장된 HTML 본문
- 푸터 액션: `공지 수정`, `닫기`

### 등록 상세 페이지

- `공지 제목`
- TinyMCE 본문
- 신규 공지 기본 저장 정책 안내

## 7. 액션 정의

| 액션 | 성격 | 대상 식별 기준 | 확인/사유 필요 여부 | 성공 피드백 | 감사 로그 경로 |
| --- | --- | --- | --- | --- | --- |
| 공지 등록 | 수정 | `Operation + noticeId` | 사유 없음 | 저장 완료 notification과 감사 로그 링크 제공 | `/system/audit-logs?targetType=Operation&targetId={noticeId}` |
| 공지 수정 | 수정 | `Operation + noticeId` | 사유 없음 | 수정 완료 notification과 감사 로그 링크 제공 | `/system/audit-logs?targetType=Operation&targetId={noticeId}` |
| 미리보기 | 조회 | `Operation + noticeId` | 불필요 | HTML 본문 검수 | 해당 없음 |
| 상태 스위치 on | 파괴적 성격 포함 조치 | `Operation + noticeId` | 확인 + 사유 필수 | 게시 완료 notification과 감사 로그 링크 제공 | `/system/audit-logs?targetType=Operation&targetId={noticeId}` |
| 상태 스위치 off | 파괴적 성격 포함 조치 | `Operation + noticeId` | 확인 + 사유 필수 | 숨김 완료 notification과 감사 로그 링크 제공 | `/system/audit-logs?targetType=Operation&targetId={noticeId}` |
| 삭제 아이콘 | 파괴적 조치 | `Operation + noticeId` | 확인 + 사유 필수 | 삭제 완료 notification과 감사 로그 링크 제공 | `/system/audit-logs?targetType=Operation&targetId={noticeId}` |

## 8. 상태값과 운영 규칙

| 항목 | 현재 상태 | 관리자 영향 | B2C 영향 |
| --- | --- | --- | --- |
| 공지 상태 | `게시`, `숨김` | 목록 상태 스위치로 전환 | `게시`만 사용자 노출 후보 |
| 신규 저장 정책 | 확정 | 신규 공지는 저장 시 `숨김` 상태로 보관 | 검수 전 노출 방지 |
| 수정 진입 | 확정 | 목록 행 클릭 미리보기 Modal과 푸터 `공지 수정` 버튼으로 이동 | 직접 영향 없음 |
| 삭제 진입 | 확정 | 더보기 드롭다운 없이 삭제 아이콘으로만 제공 | 삭제 시 노출 중단 |

## 9. URL/상태 복원

- 목록 라우트: `/operation/notices`
- 등록 상세 라우트: `/operation/notices/create`, `/operation/notices/create/:noticeId`
- 쿼리 파라미터: `status`, `sortField`, `sortOrder`, `preview`
- `preview`가 있으면 같은 공지를 미리보기 Modal에서 복원합니다.
- 등록/수정 상세에서 목록으로 돌아오면 기존 목록 필터/정렬 상태를 유지합니다.

## 10. 네트워크 상태와 fail-safe

- `pending`: loading 상태를 표시하고, 직전 성공 데이터가 있으면 유지합니다.
- `success`: 현재 목록 또는 상세 데이터를 정상 렌더링합니다.
- `empty`: 공지가 없거나 필터 결과가 없는 상태를 별도 안내합니다.
- `error`: 오류 메시지, 오류 코드, `다시 시도` 버튼을 노출하고 마지막 성공 상태 fallback을 유지합니다.
- 상태 전환/삭제 실패는 목록 전체를 중단시키지 않고 action-level notification으로 격리합니다.

## 11. 구현 메모

- 사용 컴포넌트: `PageTitle`, `AdminListCard`, `AdminDataTable`, `HtmlPreviewModal`, `ConfirmAction`, `AuditLogLink`, TinyMCE HTML Editor
- 관련 코드: `src/features/operation/pages/operation-notices-page.tsx`, `src/features/operation/pages/operation-notice-create-page.tsx`, `src/features/operation/api/notices-service.ts`
- 미리보기 Modal 푸터의 `공지 수정` 버튼은 공지사항 페이지에서만 사용하는 page-level 액션 슬롯입니다.
