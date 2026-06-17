# Operation > FAQ 페이지 동기화 문서

---
doc_type: admin_page_sync
module: "Operation"
page_name: "FAQ"
route: "/operation/faq"
status: "구현됨"
primary_entity: "OperationFaq"
primary_table_candidate: "operation_faqs, operation_faq_curations, operation_faq_metrics"
owner_agent_scope: "shared"
last_reviewed_at: "2026-06-17"
---

## 1. 문서 목적

- 이 문서는 `FAQ` 관리자 페이지와 사용자 화면 개발 사이의 동기화 기준을 정리합니다.
- 운영자가 이 페이지에서 어떤 관리 포인트를 다루는지, 그 데이터가 사용자 화면에 어떻게 이어질 수 있는지 추적합니다.
- 이 문서는 사용자 화면 동기화 기준이며, DB 스키마 상세 SoT는 `docs/specs/admin-data-contract.md`의 Operation FAQ 데이터 계약을 우선합니다.

## 2. 페이지 요약

| 항목 | 내용 |
| --- | --- |
| 모듈 | `Operation` |
| 페이지명 | `FAQ` |
| 라우트 | `/operation/faq` |
| 현재 상태 | `구현됨` |
| 페이지 유형 | `목록 운영형` |
| 페이지 목적 한 줄 요약 | FAQ 원문, 대표 노출 큐레이션, 조회 지표를 관리하는 화면입니다. |
| 주요 운영자 | `OPS_ADMIN, CONTENT_MANAGER, SUPER_ADMIN` |
| 주요 권한 | `operation.faq.manage` |
| 코드 근거 | `src/features/operation/pages/operation-faq-page.tsx`, `src/features/operation/api/faqs-service.ts`, `src/features/operation/api/operation-faqs-data-source.ts`, `src/features/operation/api/supabase-operation-faqs-service.ts` |
| 연관 SoT 문서 | `docs/specs/page-ia/operation-faq-page-ia.md`, `docs/specs/admin-data-contract.md`, `docs/specs/admin-data-usage-map.md`, `docs/specs/admin-page-tables.md` |

## 3. 이 페이지의 목적

### 목적

- FAQ 마스터/노출 관리/지표 보기를 탭으로 운영합니다.
- 질문, 답변, 검색 키워드, 카테고리, 공개 상태, 노출 위치, 조회 지표를 Supabase-backed hybrid source 기준으로 추적합니다.
- 고객센터 FAQ, 도움말, 홈 추천 FAQ, 결제 도움말에 운영상 추정으로 연결됩니다.

### 비목표

- DB 컬럼/제약의 상세 확정은 이 문서가 아니라 `docs/specs/admin-data-contract.md`에서 담당합니다.
- 사용자 화면의 상세 UI 설계는 별도 사용자 화면 문서에서 결정합니다.

## 4. 이 페이지에서 할 수 있는 것

| 기능/작업 | 설명 | 작업 성격 | 대상 데이터 | 결과 | 감사 로그 필요 여부 |
| --- | --- | --- | --- | --- | --- |
| FAQ 조회 | FAQ 원문/큐레이션/지표 목록과 상세를 확인합니다. | 조회 | OperationFaq, OperationFaqCuration, OperationFaqMetric | 현재 상태 확인 | 불필요 |
| FAQ 원문 관리 | 질문, 답변, 검색 키워드, 카테고리, 공개 상태를 등록/수정/상태 변경/삭제합니다. | 수정 | OperationFaq + faqId | 데이터 반영 및 감사 로그 기록 | 필요 |
| FAQ 노출 관리 | 노출 위치, 순서, 설정 방식, 노출 상태, 노출 기간을 추가/수정/삭제합니다. | 수정 | OperationFaqCuration + curationId | 데이터 반영 및 감사 로그 기록 | 필요 |
| FAQ 지표 확인 | 조회/검색/도움됨 지표를 확인합니다. | 조회 | OperationFaqMetric + faqId | 노출 판단 보조 | 불필요 |

## 5. 관리 데이터베이스(CRUD)

> 아래 표는 관리자 페이지와 사용자 화면 동기화를 위한 요약입니다. DB 컬럼/제약 상세는 `docs/specs/admin-data-contract.md`를 우선합니다.

| 엔티티 | 테이블 | CRUD | 관리자 UI 진입점 | 주요 필드 | 감사 로그 Target | 사용자 화면 영향 | 미확정/차이 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| OperationFaq | operation_faqs | Create, Read, Update, Delete | FAQ 마스터 탭/FAQ 상세 Drawer/FAQ 등록·수정 Modal | 질문, 답변, 검색 키워드, 카테고리, 공개 상태, id, created_at, updated_at, updated_by | OperationFaq + faqId | 운영상 추정 | `FAQ-NNN` max+1 채번 동시성, `updated_by` 표시명 매핑 미확정 |
| OperationFaqCuration | operation_faq_curations | Create, Read, Update, Delete | 노출 관리 탭/FAQ 노출 상세 Drawer/FAQ 노출 Modal | faq_id, surface, curation_mode, display_rank, exposure_status, pinned_start_at, pinned_end_at, updated_at, updated_by | OperationFaqCuration + curationId | 운영상 추정 | `FAQCUR-NNN` max+1 채번 동시성, `updated_by` 표시명 매핑 미확정 |
| OperationFaqMetric | operation_faq_metrics | Read | 지표 보기 탭/FAQ 상세 Drawer 지표 요약 | faq_id, view_count, search_hit_count, helpful_count, not_helpful_count, last_viewed_at | 없음 | 내부 전용 | 실집계 파이프라인 미확정. 현재 seed/read 전용 |

### CRUD 상세

| CRUD | 지원 여부 | 화면 동작 | 저장/서비스 후보 | 성공 후 동기화 대상 | 실패 시 fail-safe |
| --- | --- | --- | --- | --- | --- |
| Create | `지원` | FAQ 등록, 노출 추가 | Supabase 모드 admin RPC / mock fallback | 목록, 상세, 감사 로그, 사용자 화면 후보 | error 표시, 재시도, 마지막 성공 상태 fallback |
| Read | `지원` | FAQ 원문/노출/지표 조회 | `operation-faqs-data-source.ts` source switch | URL/필터/탭 복원 | empty/error 처리 |
| Update | `지원` | FAQ 수정/공개 상태 변경, 노출 수정/일시중지/재개 | Supabase 모드 admin RPC / mock fallback | 목록, 상세, 감사 로그 | 실패 시 재조회 또는 rollback |
| Delete | `지원` | FAQ 삭제, 노출 삭제 | Supabase 모드 admin RPC / mock fallback | 목록, 상세, 감사 로그, 사용자 노출 | 확인 모달, 사유 필수, 실패 안내 |

## 6. 관리자 조치와 감사 로그 계약

| 조치 | 파괴적 여부 | 확인 단계 | 사유/근거 입력 | Target Type | Target ID | 감사 로그 확인 경로 |
| --- | --- | --- | --- | --- | --- | --- |
| FAQ 등록/수정 | 아니오 | 저장 전 확인 | 필수 | OperationFaq | faqId | /system/audit-logs?targetType=OperationFaq&targetId={faqId} |
| FAQ 공개/비공개 | 아니오 | 필수 | 필수 | OperationFaq | faqId | /system/audit-logs?targetType=OperationFaq&targetId={faqId} |
| FAQ 삭제 | 예 | 필수 | 필수 | OperationFaq | faqId | /system/audit-logs?targetType=OperationFaq&targetId={faqId} |
| FAQ 노출 추가/수정/일시중지/재개 | 아니오 | 저장 전 확인 | 필수 | OperationFaqCuration | curationId | /system/audit-logs?targetType=OperationFaqCuration&targetId={curationId} |
| FAQ 노출 삭제 | 예 | 필수 | 필수 | OperationFaqCuration | curationId | /system/audit-logs?targetType=OperationFaqCuration&targetId={curationId} |

## 7. 사용자 화면 동기화 포인트

| 사용자 화면 후보 | 영향 상태 | 관리자 데이터 | 사용자 화면에 반영되는 방식 | 동기화 필요 시점 | 비고 |
| --- | --- | --- | --- | --- | --- |
| 고객센터 FAQ, 도움말, 홈 추천 FAQ, 결제 도움말, 온보딩 FAQ | 운영상 추정 | 질문, 답변, 검색 키워드, 카테고리, 공개 상태, 노출 위치, 노출 순서, 설정 방식, 노출 상태 | 고객센터 FAQ, 도움말과 대표 노출 surface에 운영상 추정으로 연결됩니다. | 관리자 변경 후 또는 원본 데이터 갱신 후 | 실제 사용자 화면 저장소 확인 전까지 추정은 추정으로 유지 |
| FAQ 운영 지표 | 내부 전용 | 조회수, 검색 유입, 도움됨, 도움 안 됨, 최근 조회 시각 | 사용자 화면에 직접 노출하지 않고 관리자 노출 판단 보조로만 사용합니다. | 지표 적재/집계 후 | 현재 seed/read 전용이며 실집계 파이프라인은 미확정 |

## 8. 이 페이지와 연관있는 페이지(예상)

### 관리자 페이지

| 연관 관리자 페이지 | 관계 유형 | 연관 이유 | 이동/연동 방식 | 선행/후행 관계 | 확정 상태 |
| --- | --- | --- | --- | --- | --- |
| Operation > 정책 관리 | 참고/후속 | FAQ 데이터의 원본 확인 또는 후속 검증 | 식별자 또는 필터 기반 이동 | 선행 또는 후행 | 운영상 추정 |
| System > 메타데이터 관리 | 참고/후속 | FAQ 데이터의 원본 확인 또는 후속 검증 | 식별자 또는 필터 기반 이동 | 선행 또는 후행 | 운영상 추정 |
| System > 감사 로그 | 필수 후행 | FAQ 데이터의 원본 확인 또는 후속 검증 | 식별자 또는 필터 기반 이동 | 후행 | 확정 |

### 사용자 화면

| 연관 사용자 화면 후보 | 관계 유형 | 연관 이유 | 관리자 변경 후 예상 영향 | 확정 상태 |
| --- | --- | --- | --- | --- |
| 고객센터 FAQ | 데이터 노출 후보 | 질문, 답변, 검색 키워드, 카테고리, 공개 상태, 노출 위치, 조회 지표 | FAQ 데이터 변경 시 표시/접근/알림이 달라질 수 있습니다. | 운영상 추정 |
| 도움말 | 데이터 노출 후보 | 질문, 답변, 검색 키워드, 카테고리, 공개 상태, 노출 위치, 조회 지표 | FAQ 데이터 변경 시 표시/접근/알림이 달라질 수 있습니다. | 운영상 추정 |
| 홈 추천 FAQ | 데이터 노출 후보 | 질문, 답변, 검색 키워드, 카테고리, 공개 상태, 노출 위치, 조회 지표 | FAQ 데이터 변경 시 표시/접근/알림이 달라질 수 있습니다. | 운영상 추정 |
| 결제 도움말 | 데이터 노출 후보 | 질문, 답변, 검색 키워드, 카테고리, 공개 상태, 노출 위치, 조회 지표 | FAQ 데이터 변경 시 표시/접근/알림이 달라질 수 있습니다. | 운영상 추정 |

## 9. 상태값/용어/키워드 정합성

| 구분 | 표준 값/용어 | 내부 코드 후보 | 사용자 노출 라벨 | 비고 |
| --- | --- | --- | --- | --- |
| 공개/비공개 | 공개/비공개 | DB `published`/`hidden` | 공개/비공개 | `supabase-operation-faqs-service.ts`에서 DB ASCII와 UI 라벨을 매핑합니다. |
| 카테고리 | 계정/결제/커뮤니티/메시지 | DB 한글 코드 `계정`/`결제`/`커뮤니티`/`메시지` | 계정/결제/커뮤니티/메시지 | DB CHECK로 허용값을 제한합니다. |
| 노출 위치 | 고객센터/홈 상단/결제 도움말/온보딩 | DB `help_center`/`home_top`/`payment_help`/`onboarding` | 한글 라벨 | DB CHECK로 허용값을 제한합니다. |
| 노출 상태 | 활성/일시중지 | DB `active`/`paused` | 활성/일시중지 | hidden FAQ를 active 큐레이션으로 저장할 수 없습니다. |
| 설정 방식 | 수동/자동 | DB `manual`/`auto` | 수동/자동 | auto 원천 신호는 후속 정책에서 다룹니다. |

## 10. URL/검색/복원 규칙

- 기본 라우트: `/operation/faq`
- 필수 쿼리/경로 파라미터: 없음
- 선택 쿼리 파라미터: `tab`, FAQ 마스터 `searchField`/`keyword`/`startDate`/`endDate`/`category`/`status`/`sortField`/`sortOrder`/`selected`, 노출 관리 `curationSearchField`/`curationKeyword`/`curationSurface`/`curationMode`/`curationExposureStatus`/`curationSortField`/`curationSortOrder`/`curationSelected`, 지표 보기 `metricSearchField`/`metricKeyword`/`metricSortField`/`metricSortOrder`
- 목록 복원 기준: 목록/필터/정렬/탭/상세 대상 복원
- 상세 Drawer/Modal/하위 라우트 복원 여부: FAQ 상세 Drawer는 `selected={faqId}`, FAQ 노출 상세 Drawer는 `tab=curation&curationSelected={curationId}`로 복원합니다. 등록/수정 Modal 복원은 필수 아님
- 사용자 화면 동기화에 필요한 식별자: OperationFaq + faqId

## 11. 네트워크 상태와 fail-safe

| 상태 | UI 노출 | 운영자가 할 수 있는 것 | 사용자 화면 동기화 영향 |
| --- | --- | --- | --- |
| pending | pending 상태에서 목록/상세 loading 표시 | 대기 또는 취소 | 동기화 지연 |
| success | success 상태에서 데이터 표시 | 후속 조치 또는 원본 확인 | 동기화 가능 |
| empty | empty 상태에서 빈 상태와 필터 초기화 또는 등록 유도 | 필터 초기화 또는 등록/후속 확인 | 직접 영향 없음 |
| error | error 상태에서 재시도와 마지막 성공 상태 fallback 제공 | 재시도 또는 마지막 성공 상태 확인 | 동기화 보류 |

## 12. 에이전트 작업 메모

- Codex 확인 포인트:
  - `src/features/operation/pages/operation-faq-page.tsx` 구현과 `docs/specs/page-ia/operation-faq-page-ia.md` 문서 일치 확인
  - `operation-faqs-data-source.ts` source switch와 `supabase-operation-faqs-service.ts` 매핑 확인
  - admin RPC 5종 reason 필수, 감사 로그 Target `OperationFaq`/`OperationFaqCuration` 확인
- Claude 확인 포인트:
  - 고객센터 FAQ, 도움말, 홈 추천 FAQ, 결제 도움말에 운영상 추정으로 연결됩니다.
  - 정책 문구와 노출/비노출 기준 검토
- 양쪽 동기화가 필요한 결정:
  - `FAQ-NNN`/`FAQCUR-NNN` 장기 채번 방식
  - 사용자 화면 노출 위치 확정
  - metrics 실집계 파이프라인

## 13. 미확정 항목

| 항목 | 미확정 내용 | 필요한 결정 주체 | 관리자 페이지 영향 | 사용자 화면 영향 | 추적 문서 |
| --- | --- | --- | --- | --- | --- |
| 자연키 채번 | `FAQ-NNN`/`FAQCUR-NNN` 신규 RPC 채번이 현재 max+1 방식이라 동시 생성 race를 막는 장기 방식(sequence/table 등)이 미확정입니다. | 백엔드/DB | 동시 등록 안정성 영향 | 직접 영향 없음 | docs/specs/admin-data-contract.md |
| 수정자 표시 | `updated_by`는 호출자 uuid 저장이며 관리자 표시명 매핑 정책이 미확정입니다. | 백엔드/프론트 | 목록/Drawer 수정자 표시 정합 영향 | 직접 영향 없음 | docs/specs/admin-data-contract.md |
| FAQ metrics 실집계 | `operation_faq_metrics`는 현재 seed/read 전용이며 조회/검색/도움됨 실집계 파이프라인이 미확정입니다. | 기획/백엔드/데이터 | 지표 보기 신뢰도와 노출 판단 보조 영향 | 사용자 지표 직접 노출 없음 | docs/specs/admin-data-usage-map.md |
