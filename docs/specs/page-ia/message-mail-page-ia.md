# Message > 메일 상세 IA

## 1. 문서 목적

- 메일 화면의 운영 목적, 데이터 블록, 조치 흐름을 같은 기준으로 정리합니다.
- 구현 전 placeholder 화면은 미확정 정책과 후속 결정 포인트를 빈칸 없이 기록하고, 구현된 화면은 현재 코드/문서 기준 운영 흐름을 고정합니다.
- 운영 기본 흐름 검색 -> 상세 -> 조치 -> 감사 로그 확인 또는 편집형 화면의 작성/수정 -> 확인 -> 발행 -> 감사 로그 확인을 유지합니다.

## 2. 문서 메타

| 항목 | 내용 |
| --- | --- |
| 모듈 | Message |
| 페이지명 | 메일 |
| 현재 상태 | 구현됨 |
| 페이지 유형 | 정책/시나리오 편집형 + 목록 운영형 혼합 |
| 라우트 | /messages/mail, /messages/mail/create, /messages/mail/create/:templateId |
| 주요 권한 | message.mail.manage |
| 주요 role | SUPER_ADMIN, OPS_ADMIN |
| 연관 문서 | docs/architecture/admin-overview.md, docs/specs/admin-page-tables.md, docs/specs/admin-data-usage-map.md, docs/specs/admin-page-flows-mermaid.md |

## 3. 페이지 목표와 비목표

### 목표

- 메일 화면의 핵심 운영 데이터를 검색하고 검수합니다.
- 상세 확인과 조치 후 감사 로그 확인 경로를 같은 화면 문서 기준으로 고정합니다.

### 비목표

- 백엔드 정산, 배치, 외부 서비스 설정 전체를 이 화면이 직접 대체하지 않습니다.
- 연관 화면의 원본 책임을 빼앗지 않고 필요한 경우 원본 화면 이동과 감사 로그 확인 경로를 제공합니다.
- 이미 구현된 화면이라도 현재 코드/문서 SoT를 넘는 임의 규칙을 추가하지 않습니다.

## 4. 운영자 사용 시나리오

- 시나리오 1: 운영자가 메일 화면에서 검색/필터를 적용하고 대상 레코드나 편집 대상을 선택합니다.
- 시나리오 2: 운영자가 등록 모달에서 메타 정보를 생성하고, 생성된 행 클릭 후 등록 상세에서 본문을 작성합니다.
- 시나리오 3: 운영자가 조치 후 Target Type, Target ID 기준으로 감사 로그를 확인하고 관련 관리자 화면으로 후속 검수를 이어갑니다.

## 5. 화면 구조

| 영역 | 목적 | 주요 데이터 | 주요 액션 | 다른 관리자 페이지 영향 | 사용자 화면 영향 |
| --- | --- | --- | --- | --- | --- |
| 상단 요약 | 운영 규모와 우선순위 파악 | 자동 발송 템플릿 수, 수동 발송 템플릿 수, 활성 템플릿 수, 최근 발송 건수 | 없음 | 후속 화면 우선순위 결정 | 직접 또는 간접 영향 |
| 검색/필터 | 탐색 범위 축소 | 목록 카드 본문 상단 탭: 자동 발송/수동 발송, SearchBar, 우측 끝 템플릿 등록 버튼, 검색 대상, 검색어, 수정일/최근 발송일 | 조건 변경, 초기화, 템플릿 메타 등록 | 후속 상세 대상 축소 | 직접 영향 없음 |
| 본문 영역 | 핵심 데이터 비교와 대상 선택 | 템플릿 ID, 카테고리, 템플릿명, 제목, 발송 그룹, 자동 조건, 최근 발송, 최근 수정, 상태, 액션 메뉴 | 행 클릭/액션 실행 | 관련 화면과 연결 | 간접 영향 |
| 상세 영역 | 세부 정보와 조치 근거 확인 | 템플릿 등록 모달, 등록 상세 페이지, 템플릿 정보 수정 모달, 미리보기/테스트 발송/즉시 발송/예약 발송 모달 | 조회/저장/상태 변경 | 감사 로그와 연결 | 직접 또는 간접 영향 |
| 후속 링크 | 원본 화면과 감사 로그 이동 | Target Type, Target ID, 관련 링크 | 원본 화면 이동 | 후속 검수 동선 고정 | 직접 영향 없음 |

## 6. 데이터 블록 정의

### 상단 요약 데이터
- 자동 발송 템플릿 수
- 수동 발송 템플릿 수
- 활성 템플릿 수
- 최근 발송 건수

### 검색/선택 데이터
- 목록 카드 본문 상단 탭: 자동 발송/수동 발송
- SearchBar 우측 끝 등록 버튼: `자동 발송 템플릿 등록` 또는 `수동 발송 템플릿 등록`
  - 클릭 시 현재 탭 기준 메타 정보 등록 모달을 열고, 저장 후 테이블을 즉시 갱신합니다.
  - 생성된 행을 클릭하면 현재 템플릿 미리보기 Modal을 열고, 푸터의 `템플릿 수정` 버튼에서 `/messages/mail/create/:templateId` 등록 상세 페이지로 이동합니다.
- 검색 대상
- 검색어
- 수정일/최근 발송일

### 본문 데이터
- 템플릿 ID
- 카테고리
- 템플릿명
- 제목
- 발송 그룹
- 자동 조건
- 최근 발송
- 최근 수정
- 상태
- 액션 메뉴

### 상세 데이터
- 템플릿 등록 모달
  - 카테고리, 상태, 템플릿명, 요약, 제목, 발송 그룹, 자동 조건을 Ant Design `Descriptions` 기반 입력 테이블로 편집합니다.
  - 본문 섹션은 두지 않고 메타 정보만 생성합니다.
- 등록 상세 페이지 (`/messages/mail/create/:templateId`)
  - `Descriptions` 기반 메타 영역 없이 TinyMCE 본문 에디터만 화면 높이를 채우는 구조를 사용합니다.
  - TinyMCE 툴바의 `환경변수` 메뉴에서 `{{user_name}}`, `{{user_id}}`, `{{user_email}}`, `{{group_name}}`, `{{template_name}}`, `{{sent_at}}`, `{{service_name}}`, `{{app_link}}`, `{{support_email}}` 토큰을 삽입할 수 있습니다.
  - 저장 시 HTML 본문을 기준으로 JSON 본문을 내부 생성하고, 완료 후 목록으로 복귀하면서 기존 탭/검색 쿼리를 복원합니다.
- 템플릿 정보 수정 모달
  - 템플릿 등록 모달과 같은 메타 필드만 `Descriptions` 기반 입력 테이블로 편집합니다.
- 미리보기/테스트 발송/즉시 발송/예약 발송 모달
  - `나에게 보내기`, `즉시 실행`, `발송 실행`, `예약 발송`의 설정 항목은 `Descriptions` 기반 입력 테이블로 편집합니다.
  - `미리보기`는 TinyMCE에 저장된 HTML 본문을 전용 Modal에서 그대로 렌더링하고, 내부 JSON 원문은 노출하지 않습니다.
  - `예약 발송`의 `예약 시각`은 날짜와 시간을 함께 선택하는 `DatePicker(showTime)`를 사용합니다.
- 자동 발송 탭 상태 컬럼
  - `활성/비활성`은 상태 컬럼의 스위치에서 직접 전환하고, 확인 + 사유 입력 후 `Target Type=Message`, `Target ID=templateId`, 감사 로그 확인 경로를 안내합니다.
  - `초안`은 직접 발송 대상이 아니므로 배지로 유지합니다.
- 자동 발송 탭 더보기 메뉴
  - `템플릿 정보 수정`, `나에게 보내기`, `즉시 실행`, `템플릿 삭제`를 제공합니다.

## 7. 액션 정의

| 액션 | 성격 | 대상 식별 기준 | 확인/사유 필요 여부 | 성공 후 피드백 | 감사 로그 확인 경로 |
| --- | --- | --- | --- | --- | --- |
| 메타 등록 | 수정 | Message + templateId | 사유 권장 | 생성 완료 후 대상 식별 정보, 다음 단계, 후속 확인 경로를 안내합니다. | /system/audit-logs?targetType=Message&targetId={templateId} |
| 본문 저장 | 수정 | Message + templateId | 사유 권장 | 본문 저장 완료 후 대상 식별 정보와 후속 확인 경로를 안내합니다. | /system/audit-logs?targetType=Message&targetId={templateId} |
| 삭제 | 파괴적 | Message + templateId | 확인 + 사유 필수 | 삭제 완료 후 대상 식별 정보와 후속 확인 경로를 안내합니다. | /system/audit-logs?targetType=Message&targetId={templateId} |
| 템플릿 수정 | 수정 | Message + templateId | 불필요 | 행 클릭 미리보기 Modal 푸터의 `템플릿 수정` 버튼에서 본문 등록 상세 페이지로 이동해 TinyMCE 본문을 수정합니다. | 조회 이동 동선이므로 원본 화면 흐름을 사용합니다. |
| 템플릿 정보 수정 | 수정 | Message + templateId | 사유 권장 | 메타 정보 수정 완료 후 대상 식별 정보와 후속 확인 경로를 안내합니다. | /system/audit-logs?targetType=Message&targetId={templateId} |
| 미리보기 | 조회 | Message + templateId | 불필요 | 행 클릭으로 TinyMCE에 저장된 HTML 본문을 전용 Modal로 확인하고, 빈 본문이면 등록 상세 작성 경로를 안내합니다. | 조회 액션이므로 별도 감사 로그는 필요하지 않거나 원본 화면 흐름을 사용합니다. |
| 나에게 보내기 | 발송 조치 | Notification + dispatchId | 사유 필수 | 현재 관리자 본인 대상 실행을 생성하고 발송 이력 ID, 전달 상태, 감사 로그 확인 경로를 안내합니다. | /system/audit-logs?targetType=Notification&targetId={dispatchId} |
| 즉시 발송 | 수정 | Message + historyId | 사유 필수 | 발송 그룹/방식/사유 입력 Modal에서 실행되며, 완료 후 발송 이력 ID와 감사 로그 확인 경로를 안내합니다. | /system/audit-logs?targetType=Message&targetId={historyId} |
| 예약 발송 | 수정 | Message + historyId | 사유 필수 | 발송 그룹/방식/사유 입력 Modal에서 예약 등록되며, 완료 후 발송 이력 ID와 감사 로그 확인 경로를 안내합니다. | /system/audit-logs?targetType=Message&targetId={historyId} |
| 활성화/비활성화 | 파괴적 | Message + templateId | 확인 + 사유 필수 | 자동 발송 탭 상태 컬럼의 스위치에서 실행되며, 완료 후 대상 식별 정보와 후속 확인 경로를 안내합니다. | /system/audit-logs?targetType=Message&targetId={templateId} |

## 8. 상태값/정책/운영 규칙

| 항목 | 현재 상태 | 관리자 페이지 영향 | 사용자 화면 영향 | 추후 결정 필요 내용 |
| --- | --- | --- | --- | --- |
| 상태값/운영 규칙 | 확정 | Message 모듈의 현재 코드/문서 기준 상태값과 운영 규칙을 유지하고 변경 시 연관 화면과 문서를 함께 갱신해야 합니다. | 사용자 화면 문구와 상태 기준의 운영 원천이 됩니다. | 상태 세트 변경 시 연관 문서와 화면을 함께 갱신해야 합니다. |
| URL/상태 복원 | 확정 | 목록/탭/버전/선택 상태를 새로고침과 뒤로가기에서도 가능한 한 재현해야 합니다. | 운영자는 같은 검색/상세 맥락으로 복귀할 수 있습니다. | 필수 쿼리 파라미터를 변경하면 연관 화면도 함께 검토해야 합니다. |
| 감사 추적 | 확정 | 조치가 있으면 Target Type, Target ID, 사유, 수행자 기준으로 감사 로그 확인 경로를 제공합니다. | 직접 B2C 노출이 없어도 운영 증적 확보가 필요합니다. | 조치성 액션과 조회성 액션의 로깅 범위를 분리 관리합니다. |
| 입력 레이아웃 | 확정 | 메일 템플릿 등록은 목록 본문 우측 상단 버튼에서 메타 등록 모달로 시작하고, 생성된 행 클릭은 미리보기 Modal을 열며, 푸터의 `템플릿 수정`으로 `/messages/mail/create/:templateId` 본문 등록 상세에 진입합니다. 템플릿 정보 수정은 같은 `Descriptions` 메타 모달을 사용합니다. | 운영자가 목록에서 즉시 내용을 검수한 뒤 필요할 때만 본문 편집으로 진입할 수 있습니다. | 등록 후에는 기존 목록의 탭/검색 쿼리 상태로 복귀해 저장 검증 흐름을 유지합니다. |
| 본문 편집 방식 | 확정 | 메일 템플릿 등록 상세 페이지는 TinyMCE 본문 에디터만 전체 높이로 노출하고, JSON 본문은 저장 시 내부 생성합니다. 관리자 UI 어디에서도 JSON 본문을 직접 편집하지 않습니다. 툴바의 `환경변수` 메뉴에서 회원/발송/시스템 토큰을 삽입할 수 있습니다. | 사용자 이메일 수신함에 전달되는 제목/요약/본문의 편집 품질과 정합성에 직접 영향을 줍니다. | 메타 수정과 본문 편집을 분리해 본문 등록 상세를 최종 작성 단계로 유지합니다. |

## 9. 다른 관리자 페이지 영향

| 대상 페이지 | 영향 내용 | 연동 방식 | 선행/후행 관계 |
| --- | --- | --- | --- |
| Message > 대상 그룹 | 참조 세그먼트 검수 | 그룹 링크 | 선행 관계 |
| Message > 발송 이력 | 실행 결과 후속 검수 | 템플릿명 검색 이동 | 후행 관계 |
| System > 감사 로그 | 조치가 있는 경우 Target Type, Target ID 기준으로 사후 검증을 수행합니다. | AuditLogLink 또는 딥링크 | 조치 후 필수 |

## 10. 사용자 화면/B2C 영향 참고

| 사용자 화면 후보 | 영향 상태 | 이 페이지 데이터가 반영되는 방식 | 비고 |
| --- | --- | --- | --- |
| 사용자 이메일 수신함 | 운영상 추정 | B2C에 직접 노출되는 운영 콘텐츠 원천 | 메일 템플릿 |

## 11. URL/상태 복원

- 기본 라우트: /messages/mail
- 등록 상세 라우트: /messages/mail/create/:templateId
- 필수 쿼리 파라미터 후보: page, pageSize, searchField, keyword, startDate, endDate, selected
- Drawer/Modal 복원 여부: 권장
- 등록 상세 페이지에서 목록으로 복귀할 때는 진입 시점의 `tab`, `searchField`, `keyword`, `startDate`, `endDate`를 그대로 복원합니다.
- 유지되어야 하는 상태: 목록 조건과 선택된 상세 패널 상태를 함께 복원하는 구조를 권장합니다.

## 12. 네트워크 상태와 fail-safe

- pending: 스켈레톤 또는 loading 상태를 표시하고, 직전 성공 데이터가 있으면 유지합니다.
- success: 정상 결과를 렌더링합니다.
- empty: 조건에 맞는 데이터가 없음을 페이지 맥락에 맞게 명확히 안내합니다.
- error: 오류 코드/메시지, 재시도 버튼, 마지막 성공 상태 fallback 문구를 함께 노출합니다.
- 마지막 성공 상태 fallback: 화면 전체를 비우지 않고 직전 성공 데이터나 읽기 전용 요약을 유지합니다.
- 요청 취소/재시도: 화면 이탈 시 abort, 조회 실패 시 retry, 파괴적 액션은 중복 제출 방지가 필요합니다.

## 13. 구현 메모

- 현재 코드베이스에서 재사용할 컴포넌트: PageTitle, SearchBar, AdminDataTable, ConfirmAction, AuditLogLink
- 예상 feature 파일: src/features/message/pages/*
- 권한/로그 처리 메모: 파괴적 액션에는 확인 단계와 사유 입력, Target Type, Target ID, 감사 로그 확인 경로를 함께 둡니다.

## 14. 오픈 이슈

- 템플릿 승인과 발송 승인 권한 분리 여부 미정
- `notification_dispatches.recipient_count`가 테스트 발송에서 `0`으로 남지만 실제 `notification_delivery_attempts`는 1건 생성되는 정합성 갭이 있습니다. 발송 이력의 실제 전달 집계는 attempts를 기준으로 신뢰하고, ledger count 보정은 파이프라인 소유 경계에서 후속 처리합니다.
- Vercel Production의 브라우저용 Supabase 연결은 `topik-prod`이지만 서버 함수용 `SUPABASE_URL`/service key 조합은 현재 관리자 JWT를 `invalid_session`으로 거부합니다. 서버 환경 교정과 재배포 전에는 Vercel 워커 실발송 완료로 간주하지 않습니다.

## 15. 2026-06-12 알림 기능 supabase 연동

- 데이터 소스 분기: `VITE_MESSAGE_SOURCE`로 `mock`↔`supabase`를 전환합니다(`src/features/message/api/message-data-source.ts`). Supabase 구성 시 기본 `supabase`이며, `mock` 강제 시 기존 시드 동작(회귀 e2e 경로)을 유지합니다.
- supabase 모드 write는 admin RPC 단일 경로입니다: 템플릿 저장/상태 변경/삭제(`admin_save_notification_template`/`admin_set_notification_template_status`/`admin_delete_notification_template`) + 발송 실행(`admin_send_notification`). 모든 쓰기는 **사유 필수**이며 감사 로그는 `Target Type=Notification`, `Target ID={row uuid}`로 남습니다(액션 사전: `docs/specs/admin-action-log.md`).
- supabase 전용 폼 필드: `template_key`(필수), 분류 `class`(transactional·operational·learning·marketing 4종 — 필수), `mandatory`(marketing은 저장 차단, ON 시 수신 선호 우회·감사 기록 고지 확인 모달), `category`, `link_url`(인앱 클릭 이동 경로), 사유 입력. 테이블은 `notification_templates`(channel='email'), 계약 SoT는 `notification-contract.md`(docs/specs).
- 발송(나에게 보내기/즉시/예약)은 `admin_send_notification`이 `notification_dispatches` 실행 행을 생성하고 DB 파이프라인이 email attempt를 `pending`으로 만든 뒤 topik-ai 서버의 SMTP 워커가 전달합니다. SMTP 성공(resolve) 후에만 attempt를 `sent`로 기록하고 `provider_message_id`/`sent_at`을 저장하며, 실패는 `smtp_error`와 retry count로 남깁니다.
- 채널 매핑: `/messages/mail`=email, `/messages/push`=push(준비 중 — 발송 비활성), `/messages/in-app`=in_app(신규 — `docs/specs/page-ia/message-inapp-page-ia.md`). 스키마 소유권은 `docs/architecture/shared-supabase-schema-ownership.md`를 따릅니다.
- 2026-07-16 승인된 운영 실발송에서 현재 관리자 본인 대상 메일 1건이 SMTP 수락됐고 운영 DB/발송 이력 화면 모두 `성공`을 확인했습니다. 단, 이 성공은 현재 워커 소스를 운영 DB+SMTP로 실행한 결과이며 배포된 Vercel 함수는 서버 Supabase 환경 불일치로 인증 smoke가 아직 실패합니다.
