# TOPIK AI Admin 문서 인덱스

## 목적
- 관리자 프론트엔드 문서를 주제별로 찾기 쉽게 정리한 인덱스다.
- 문서 변경 시 어떤 SoT를 함께 갱신해야 하는지 빠르게 판단할 수 있도록 유지한다.

## 문서 분류

### `docs` (루트 보고서·작업 안내서)
- `metadata-tag-schema-rule.md` — 콘텐츠팀용 TOPIK 쓰기 51~54 메타데이터·태그 작업 안내서 + 개발팀 전달용 테이블 스키마(권장안, v0.8)
- `메타데이터-태그-스키마-전환-영향도-보고서.md` — 위 권장 스키마로 DB·관리체계 전환 시의 영향도 분석 보고서
- `메타데이터-태그-스키마-전환-실행계획안.md` — 전환 실행 계획안(2026-06-11 인바운드 개정): P0~P6 단계 — P3=읽기 컷오버+검수 표면·컬럼 제거, P4=관리 포인트(태그·노출) 개방, P6=외부 공급 API 수신 연동 — 와 검증 게이트(§12.3 PASS 채점)
- `v13-admin-상호보완-분석-보고서.html` — v13 ↔ admin 상호보완·커버리지 분석 보고서
- `metadata-tag-schema-transition-handoff.md` — 전환 작업 인수인계 문서(인바운드 전환 직후 상태·재정의 P3 절차·주의사항)
- `알림-기능-개발-실행계획안.md` — 알림(Notification) 기능 개발 실행계획안 rev3(채널 4종·class 정책·발송 이력 3계층·검증 게이트 V-0~V-6)
- `알림-기능-구현-페이즈-가이드.md` — 알림 기능 에이전트 실행용 작업 패키지 분해(WP0-1~WP4-3, 휴먼 결정 게이트 H-1~H-5)
- `알림-기능-QA-시나리오.md` — 알림 기능 게이트별 상세 QA 시나리오(약 80건, 빈발 버그 매핑)

### `docs/requests` (외부 발신 요청·발주 문서)
- `upstream-writing-endpoints-request-2026-06-10.md` — TOPIK 쓰기 문항 공급(인바운드) API 계약 요청서(D-11 재정의 — 2026-06-11 재작성, 구 push 업로드 요청 폐기)
- `problems-read-only-freeze-notice-2026-06-11.md` — v13 `problems` read-only 동결 선언 공지 초안(§7.1-6 이행 — 오너 채널 발신용, 코드 0줄)
- `content-team-order-2026-06-10.md` — [폐기] 콘텐츠팀 재분류 입력표 승인 발주서(인바운드 전환으로 트랙 소멸 — 미발신 종결, 역사 보존)
- `content-team-p2-5-sample-2026-06-11.md` — [폐기] P2-5 10문항 샘플 검토 시트(인바운드 전환으로 게이트 소멸 — 미발신 종결, 역사 보존)

### `docs/templates`
- `admin-page-ia-template.md`
- `admin-page-sync-template.md`

### `docs/page-sync`
- `README.md`
- `analytics-overview-page-sync.md`
- `assessment-level-tests-page-sync.md`
- `assessment-question-bank-eps-topik-page-sync.md`
- `assessment-question-bank-page-sync.md`
- `commerce-coupons-page-sync.md`
- `commerce-payments-page-sync.md`
- `commerce-points-page-sync.md`
- `commerce-refunds-page-sync.md`
- `commerce-store-page-sync.md`
- `community-posts-page-sync.md`
- `community-reports-page-sync.md`
- `content-badges-page-sync.md`
- `content-library-page-sync.md`
- `content-missions-page-sync.md`
- `content-vocabulary-multiple-choice-page-sync.md`
- `content-vocabulary-page-sync.md`
- `content-vocabulary-sonagi-page-sync.md`
- `dashboard-page-sync.md`
- `message-groups-page-sync.md`
- `message-history-page-sync.md`
- `message-inapp-page-sync.md`
- `message-mail-page-sync.md`
- `message-push-page-sync.md`
- `operation-chatbot-page-sync.md`
- `operation-events-page-sync.md`
- `operation-faq-page-sync.md`
- `operation-notices-page-sync.md`
- `operation-policies-page-sync.md`
- `system-admins-page-sync.md`
- `system-audit-logs-page-sync.md`
- `system-logs-page-sync.md`
- `system-metadata-page-sync.md`
- `system-permissions-page-sync.md`
- `users-detail-page-sync.md`
- `users-instructor-management-page-sync.md`
- `users-list-page-sync.md`
- `users-referrals-page-sync.md`

### `docs/guidelines`
- `admin-coding-guidelines-antigravity.md`
- `react-optimization-rule.md`
- `typescript-essential-checklist.md`
- `comments-rule.md`
- `admin-design-guide-antigravity.md`
- `admin-detail-drawer-guidelines.md`
- `admin-ux-ui-design.md`

### `docs/architecture`
- `admin-overview.md`
- `admin-data-source-transition.md`
- `shared-supabase-schema-ownership.md` — 공유 Supabase 스키마 소유권 매트릭스(객체별 owner/writer/reader/RLS/migration home — 2026-06-12 알림 기능 WP0-1)
- `metadata-tag-schema-transition-decision-record.md` — 메타데이터·태그 스키마 전환 결정 기록(**§0 = 2026-06-11 인바운드 모델 전환 확정** + D-1~D-13 처분 + v13 경계 합의)
- `d3-classification-ownership-decision-brief.md` — [폐기] D-3 분류 작성 주체 결정 브리프(인바운드 전환으로 목적 소멸 — 역사 보존)

### `docs/harness`
- `index.md`

### `docs/specs`
- `topik-ai-service-api-reference.md`
- `admin-data-contract.md`
- `notification-contract.md` — 알림 채널/class/template_key/status/dedupe 단일 계약 (2026-06-12)
- `admin-page-gap-register.md`
- `admin-page-ia-change-log.md`
- `admin-page-tables.md`
- `admin-policy-source-map.md`
- `admin-page-flows-mermaid.md`
- `admin-action-log.md`
- `admin-data-usage-map.md`
- `page-ia/analytics-overview-page-ia.md`
- `page-ia/assessment-level-tests-page-ia.md`
- `page-ia/assessment-question-bank-eps-topik-page-ia.md`
- `page-ia/assessment-question-bank-page-ia.md`
- `page-ia/assessment-question-manage-page-ia.md`
- `page-ia/commerce-coupons-page-ia.md`
- `page-ia/commerce-payments-page-ia.md`
- `page-ia/commerce-points-page-ia.md`
- `page-ia/commerce-refunds-page-ia.md`
- `page-ia/commerce-store-page-ia.md`
- `page-ia/community-posts-page-ia.md`
- `page-ia/community-reports-page-ia.md`
- `page-ia/content-badges-page-ia.md`
- `page-ia/content-library-page-ia.md`
- `page-ia/content-missions-page-ia.md`
- `page-ia/content-vocabulary-multiple-choice-page-ia.md`
- `page-ia/content-vocabulary-page-ia.md`
- `page-ia/content-vocabulary-sonagi-page-ia.md`
- `page-ia/dashboard-page-ia.md`
- `page-ia/message-groups-page-ia.md`
- `page-ia/message-history-page-ia.md`
- `page-ia/message-inapp-page-ia.md`
- `page-ia/message-mail-page-ia.md`
- `page-ia/message-push-page-ia.md`
- `page-ia/operation-chatbot-page-ia.md`
- `page-ia/operation-events-page-ia.md`
- `page-ia/operation-faq-page-ia.md`
- `page-ia/operation-notices-page-ia.md`
- `page-ia/operation-policies-page-ia.md`
- `page-ia/system-admins-page-ia.md`
- `page-ia/system-audit-logs-page-ia.md`
- `page-ia/system-logs-page-ia.md`
- `page-ia/system-metadata-page-ia.md`
- `page-ia/system-permissions-page-ia.md`
- `page-ia/users-detail-page-ia.md`
- `page-ia/users-instructor-management-page-ia.md`
- `page-ia/users-list-page-ia.md`
- `page-ia/users-referrals-page-ia.md`

### `docs/checklists`
- `admin-essential-checklist.md`
- `codex-response-completion-checklist.md`

## 운영 문서
- 실행 지침: `AGENTS.md`
- 문서 변경 로그: `logs/admin-doc-update-log.md`

## 관리 규칙
- 상위 개요, 메뉴 구조, 라우팅, 역할, 페이지 상태는 `docs/architecture/admin-overview.md`를 우선 확인한다.
- 하네스 구조와 기본 검증 명령은 `docs/harness/index.md`를 우선 확인한다.
- `docs/**` 문서를 추가/삭제/이동하면 같은 작업에서 `docs/README.md`를 반드시 갱신한다.
- MD 문서를 수정하면 `logs/admin-doc-update-log.md`에 변경 요약을 기록한다.
- 사용자 요구사항이 MD 문서 수정/삭제와 직접 관련되면 같은 작업에서 해당 MD를 즉시 갱신한다.
- 운영/정책 관련 내용은 구현과 별개로 지속 모니터링 대상으로 두고, 변경 여부와 영향도를 결과에 기록한다.
- 구조/문서 드리프트 검증은 기본적으로 `npm run harness:check`를 사용한다.
- 행 클릭 상세 Drawer 규칙이 바뀌면 `docs/guidelines/admin-detail-drawer-guidelines.md`와 관련 IA 문서를 함께 갱신한다.
- 관리자 테이블/정책/B2C 노출 위치가 바뀌면 `docs/specs/admin-data-usage-map.md`를 함께 평가하고 반영한다.
- 엔티티명, 테이블명 후보, 컬럼/필드명, 변수명, enum/code table 후보, schema candidate 분류가 바뀌면 `docs/specs/admin-data-contract.md`를 함께 평가하고 반영한다.
- API/mock/데이터베이스/응답 스키마/repository-service 경계/더미데이터 SoT 구조가 바뀌면 `docs/architecture/admin-data-source-transition.md`를 함께 평가하고 반영한다.
- 페이지 목적, 운영 플로우, 데이터 계약, 감사 로그 계약, URL 복원 규칙, 상세 진입 패턴의 미확정/누락/오구현 항목을 새로 발견하거나 해소하면 `docs/specs/admin-page-gap-register.md`를 같은 작업에서 반드시 갱신한다.
