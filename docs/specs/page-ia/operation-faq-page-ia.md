# Operation > FAQ 상세 IA

## 1. 문서 목적

- FAQ 운영 화면의 원문 관리, 노출 큐레이션, 지표 검수 기준을 같은 문서에서 고정합니다.
- 운영 기본 흐름 `검색 -> 상세 -> 조치 -> 감사 로그 확인`을 유지하되, FAQ는 `원문 / 노출 / 지표` 3개 탭을 가진 목록 운영형으로 관리합니다.
- 이 페이지는 실시간 인기 계산 엔진이 아니라, 다른 도메인에서 올라온 신호를 포함해 운영자가 대표 FAQ를 검수하고 확정하는 화면입니다.

## 2. 문서 메타

| 항목 | 내용 |
| --- | --- |
| 모듈 | Operation |
| 페이지명 | FAQ |
| 현재 상태 | 구현됨 |
| 페이지 유형 | 목록 운영형 |
| 라우트 | /operation/faq |
| 주요 권한 | operation.faq.manage |
| 주요 role | SUPER_ADMIN, OPS_ADMIN |
| 연관 문서 | docs/specs/admin-page-tables.md, docs/specs/admin-data-usage-map.md, docs/specs/admin-data-contract.md, docs/specs/admin-action-log.md |

## 3. 페이지 목표와 비목표

### 목표

- FAQ 원문을 질문/답변/검색 키워드/카테고리/공개 상태 기준으로 관리합니다.
- 홈 추천 FAQ, 고객센터 FAQ, 결제 도움말, 온보딩 FAQ 같은 대표 노출 큐레이션을 검수하고 승인합니다.
- 조회수, 검색 유입, 도움됨/도움 안 됨 같은 지표를 바탕으로 어떤 FAQ를 대표 노출할지 판단합니다.

### 비목표

- 실시간 랭킹 산출 로직이나 검색 로그 집계 엔진을 이 페이지에서 직접 수행하지 않습니다.
- 사용자 문의, 챗봇 질문 빈도 같은 외부 신호의 원본 저장소 역할을 이 페이지가 대신하지 않습니다.
- 공지사항처럼 HTML 리치 텍스트 편집기(TinyMCE)를 쓰는 편집 화면으로 확장하지 않습니다. FAQ 원문은 plain text 입력을 기본값으로 유지합니다.

## 4. 운영자 사용 시나리오

- 시나리오 1: 운영자가 `FAQ 마스터` 탭에서 검색/필터를 적용해 FAQ 원문을 찾고 상세 Drawer에서 질문/답변/검색 키워드/연결된 노출 상태를 확인합니다.
- 시나리오 2: 운영자가 상세 Drawer 또는 목록 액션에서 FAQ를 수정하거나 공개/비공개/삭제 조치를 실행하고 감사 로그를 확인합니다.
- 시나리오 3: 운영자가 `노출 관리` 탭에서 특정 화면의 대표 FAQ 노출 위치/순서/설정 방식/노출 상태를 조정합니다.
- 시나리오 4: 운영자가 `지표 보기` 탭에서 조회/검색/도움됨 지표를 확인한 뒤, 대표 FAQ로 올릴 후보를 정하고 원문 또는 노출 Drawer로 후속 조치를 이어갑니다.

## 5. 화면 구조

| 영역 | 목적 | 주요 데이터 | 주요 액션 | 다른 관리자 페이지 영향 | 사용자 화면 영향 |
| --- | --- | --- | --- | --- | --- |
| 상단 요약 | 운영 우선순위 파악 | 전체 FAQ 수, 공개 FAQ 수, 활성 노출 수, 누적 조회수 | 없음 | 후속 검수 우선순위 결정 | 간접 영향 |
| 탭 네비게이션 | 원문/노출/지표 전환 | `FAQ 마스터`, `노출 관리`, `지표 보기` | 탭 전환 | URL 복원과 연동 | 직접 영향 없음 |
| FAQ 마스터 | 원문 CRUD와 공개 상태 관리 | FAQ ID, 질문, 카테고리, 검색 키워드, 공개 상태, 최종 수정 | 등록, 수정, 공개/비공개, 삭제, 상세 보기 | 감사 로그와 연결 | 고객센터 FAQ/도움말 원문 영향 |
| 노출 관리 | 대표 FAQ 노출 규칙 관리 | 노출 ID, 노출 위치, 연결 FAQ, 노출 순서, 설정 방식, 노출 상태 | 노출 추가, 수정, 일시중지/재개, 삭제, 상세 보기 | 감사 로그와 연결 | 홈 추천 FAQ/결제 도움말/온보딩 FAQ 직접 영향 |
| 지표 보기 | 노출 후보 검수 | FAQ별 조회수, 검색 유입, 도움됨/도움 안 됨, 최근 조회 | 원문 상세 열기 | 노출 판단 보조 | 직접 영향 없음 |
| 상세 Drawer | 세부 정보와 조치 근거 확인 | FAQ 상세 Drawer, FAQ 노출 상세 Drawer | 수정, 공개/비공개, 삭제, 노출 추가/수정, 감사 로그 확인 | 후속 검수 동선 고정 | 직접 또는 간접 영향 |

## 6. 데이터 블록 정의

### 상단 요약 데이터
- 전체 FAQ 수
- 공개 FAQ 수
- 활성 노출 수
- 누적 조회수

### FAQ 마스터 탭
- 검색어
- 최종 수정일
- 카테고리
- 공개 상태
- FAQ ID
- 질문
- 검색 키워드
- 답변
- 등록일/최종 수정일/수정자

### 노출 관리 탭
- 노출 ID
- 연결 FAQ ID
- 노출 위치(`help_center`, `home_top`, `payment_help`, `onboarding`)
- 설정 방식(`manual`, `auto`)
- 노출 순서
- 노출 상태(`active`, `paused`)
- 노출 기간
- 최종 수정일/수정자

### 지표 보기 탭
- FAQ ID
- 질문
- 검색 키워드
- 조회수
- 검색 유입
- 도움됨/도움 안 됨
- 최근 조회 시각

## 7. 액션 정의

| 액션 | 성격 | 대상 식별 기준 | 확인/사유 필요 여부 | 성공 후 피드백 | 감사 로그 확인 경로 |
| --- | --- | --- | --- | --- | --- |
| FAQ 등록 | 수정 | OperationFaq + faqId | 사유 권장 | FAQ 등록 완료 후 `Target Type`, `Target ID`, 감사 로그 링크를 안내합니다. | /system/audit-logs?targetType=OperationFaq&targetId={faqId} |
| FAQ 수정 | 수정 | OperationFaq + faqId | 사유 권장 | FAQ 수정 완료 후 대상 식별 정보와 감사 로그 링크를 안내합니다. | /system/audit-logs?targetType=OperationFaq&targetId={faqId} |
| FAQ 공개/비공개 | 수정 | OperationFaq + faqId | 확인 + 사유 필수 | 공개/비공개 완료 후 대상 식별 정보와 감사 로그 링크를 안내합니다. 비공개 전환 시 연결된 노출 규칙은 자동으로 대기 상태가 됩니다. | /system/audit-logs?targetType=OperationFaq&targetId={faqId} |
| FAQ 삭제 | 파괴적 | OperationFaq + faqId | 확인 + 사유 필수 | 삭제 완료 후 대상 식별 정보와 감사 로그 링크를 안내합니다. 연결된 노출 규칙과 지표 연결도 함께 정리됩니다. | /system/audit-logs?targetType=OperationFaq&targetId={faqId} |
| FAQ 노출 추가/수정 | 수정 | OperationFaqCuration + curationId | 사유 권장 | 노출 저장 완료 후 대상 식별 정보와 감사 로그 링크를 안내합니다. | /system/audit-logs?targetType=OperationFaqCuration&targetId={curationId} |
| FAQ 노출 일시중지/재개 | 수정 | OperationFaqCuration + curationId | 확인 + 사유 필수 | 노출 상태 변경 후 대상 식별 정보와 감사 로그 링크를 안내합니다. | /system/audit-logs?targetType=OperationFaqCuration&targetId={curationId} |
| FAQ 노출 삭제 | 파괴적 | OperationFaqCuration + curationId | 확인 + 사유 필수 | 노출 삭제 후 대상 식별 정보와 감사 로그 링크를 안내합니다. | /system/audit-logs?targetType=OperationFaqCuration&targetId={curationId} |

## 8. 상태값/정책/운영 규칙

| 항목 | 현재 상태 | 관리자 페이지 영향 | 사용자 화면 영향 | 추후 결정 필요 내용 |
| --- | --- | --- | --- | --- |
| FAQ 공개 상태 | 확정 | `공개/비공개`를 유지하고 변경 시 관련 노출 규칙 상태를 함께 검토합니다. | 고객센터 FAQ/도움말 원문 노출 여부에 직접 영향 | 향후 soft delete 정책과 공개 상태 관계 정의 |
| FAQ 노출 상태 | 확정 | `active/paused` 내부 코드와 한글 라벨을 함께 유지합니다. | 대표 FAQ 노출 여부에 직접 영향 | 예약 노출 상태 추가 여부 |
| 노출 위치 | 확정 | `help_center`, `home_top`, `payment_help`, `onboarding`를 코드 테이블 후보로 유지합니다. | 고객센터, 홈, 결제 도움말, 온보딩 영역에 직접 영향 | surface 추가 시 코드 테이블/API 확장 필요 |
| 설정 방식 | 확정 | `manual`, `auto` 내부 코드와 한글 라벨을 함께 유지합니다. | 직접 노출 영향은 없고 운영 근거를 남깁니다. | auto 추천 원천 신호 정의 필요 |
| URL/상태 복원 | 확정 | 탭, 검색, 필터, 정렬, 선택된 FAQ/노출 Drawer 상태를 새로고침과 뒤로가기에서도 재현해야 합니다. | 운영자는 같은 검수 맥락으로 복귀할 수 있습니다. | 신규 필터 추가 시 쿼리 계약 동기화 필요 |

## 9. 다른 관리자 페이지 영향

| 대상 페이지 | 영향 내용 | 연동 방식 | 선행/후행 관계 |
| --- | --- | --- | --- |
| System > 감사 로그 | FAQ 원문 조치와 FAQ 노출 조치를 각각 다른 Target Type으로 검증합니다. | AuditLogLink 딥링크 | 조치 후 필수 |
| Operation > 공지사항 | FAQ는 plain text 원문 관리, 공지사항은 TinyMCE 기반 HTML 편집이라는 편집 패턴 차이를 유지합니다. | 운영 문서 기준 구분 | 용도 구분 필요 |

## 10. 사용자 화면/B2C 영향 참고

| 사용자 화면 후보 | 영향 상태 | 이 페이지 데이터가 반영되는 방식 | 비고 |
| --- | --- | --- | --- |
| 고객센터 FAQ, 도움말 | 운영상 추정 | `FAQ 마스터`의 질문/답변/카테고리/공개 상태를 원문 데이터로 사용 | FAQ 원문 SoT |
| 홈 추천 FAQ | 노출 예정 | `노출 관리`의 `home_top` 규칙으로 대표 FAQ 5개 내외를 큐레이션 | 대표 노출 큐레이션 |
| 결제 도움말 | 노출 예정 | `payment_help` 규칙으로 결제 관련 대표 FAQ를 별도 묶음으로 노출 | 결제 맥락별 FAQ |
| 온보딩 FAQ | 노출 예정 | `onboarding` 규칙으로 신규 사용자 안내용 FAQ를 노출 | 초기 학습/가입 도움말 |

## 11. URL/상태 복원

- 기본 라우트: /operation/faq
- 필수 쿼리 파라미터
  - 공통: `tab`
  - FAQ 마스터: `searchField`, `keyword`, `startDate`, `endDate`, `category`, `status`, `sortField`, `sortOrder`, `selected`
  - 노출 관리: `curationSearchField`, `curationKeyword`, `curationSurface`, `curationMode`, `curationExposureStatus`, `curationSortField`, `curationSortOrder`, `curationSelected`
  - 지표 보기: `metricSearchField`, `metricKeyword`, `metricSortField`, `metricSortOrder`
- Drawer/Modal 복원 여부: FAQ 상세 Drawer와 FAQ 노출 상세 Drawer 복원 필수, 등록/수정 Modal 복원 불필요

## 12. 네트워크 상태와 fail-safe

- pending: loading 상태를 표시하고, 직전 성공 데이터가 있으면 유지합니다.
- success: 정상 결과를 렌더링합니다.
- empty: 조건에 맞는 데이터가 없음을 탭 맥락에 맞게 안내합니다.
- error: 오류 코드/메시지, 재시도 버튼, 마지막 성공 상태 fallback 문구를 함께 노출합니다.
- 마지막 성공 상태 fallback: 화면 전체를 비우지 않고 직전 성공 데이터를 유지합니다.
- 요청 취소/재시도: 화면 이탈 시 abort, 조회 실패 시 retry, 파괴적 액션은 중복 제출 방지가 필요합니다.

## 13. 구현 메모

- 현재 코드베이스에서 재사용할 컴포넌트: PageTitle, SearchBar, AdminDataTable, ConfirmAction, AuditLogLink, DetailDrawer
- FAQ 원문/노출/지표의 mock SoT는 `operation-store.ts`, service 경계는 `faqs-service.ts`, 코드 테이블 후보는 `faq-schema.ts`에서 관리합니다.
- FAQ 등록/수정 Modal은 질문, 카테고리, 검색 키워드, 답변, 공개 상태를 plain text 기반으로 편집합니다.
- FAQ 노출 Modal은 연결 FAQ, 노출 위치, 노출 순서, 설정 방식, 노출 상태, 노출 기간을 관리합니다.

## 14. 오픈 이슈

- `auto` 추천 모드가 실제로 어떤 원천 지표(검색어, 문의, 챗봇 질문, 조회수)를 받아오는지는 아직 미정입니다.
- 홈 추천 FAQ/온보딩 FAQ의 화면별 최대 노출 개수와 예약 노출 정책은 후속 정책 문서에서 확정이 필요합니다.
