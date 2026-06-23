# [리뷰 요청] docs/page-sync 정합성 검사 결과 — Claude가 정리, Codex가 검증

다른 에이전트(Claude)가 `docs/page-sync/` 37개 페이지 동기화 문서의 정합성 검사를 수행하고 아래처럼 정리했다.
너(Codex)는 이 정리 내용을 **실제 저장소 파일과 SoT 문서에 직접 대조**해 검증하라.

## 제약
- **절대 파일을 수정하지 마라.** 리뷰 결과(텍스트)만 출력한다.
- 근거는 반드시 `파일경로:라인` 형태로 제시한다.
- SoT 대조 기준: `docs/specs/admin-action-log.md`, `docs/specs/admin-data-contract.md`, `docs/specs/admin-data-usage-map.md`, `src/app/router/app-router.tsx`, `AGENTS.md`.

---

## 검사 방법 (Claude 수행)
1. 자동 게이트(mojibake / crosslink / route-doc) — 전부 PASS.
2. 구조 — 37/37 문서 13개 섹션 완비, frontmatter 유효, 누락/에러 0.
3. 내용·SoT 심층 감사 — 워크플로(112 에이전트): SoT 기준 추출 → 문서별 감사 → 적대적 검증(거짓양성 50건 기각) → 교차문서.
- 결과 합계: 확정 결함 20 / 기각 50 / 경미(low) 50 / 교차문서 5.

## 확정 결함 20건

### A. 감사 로그 Target Type ↔ admin-action-log.md 불일치 (9건)
SoT(admin-action-log.md)가 정의한 Target Type 목록과 page-sync 문서 §6 표기가 어긋남.
- (a) SoT가 다른 값을 명시했는데 문서가 틀리게 씀:
  - operation-events: 문서 `OperationEvent` → SoT는 `Operation`(이벤트는 Target Type=Operation으로 명시).
  - message-groups: 문서 `MessageGroup` → SoT는 메시지 계열 전부 `Notification`.
  - message-push: 문서 `MessageTemplate` → SoT는 `Notification`.
  - system-metadata: 문서 §6 `SystemMetadataGroup` vs §4/§5 `SystemMetadata`(비표준) 내부 불일치 → SoT는 `SystemMetadataGroup`.
  - commerce-points: §6에 `CommercePointPolicy` 행만 있고 `CommercePointLedger` 행 누락(SoT엔 둘 다 존재).
- (b) SoT에 항목 자체가 없음(결정 필요):
  - commerce-payments: `CommercePayment` — SoT 미정의.
  - commerce-refunds: `CommerceRefund` — SoT 미정의.
  - operation-notices: `OperationNotice` — SoT 미정의.
  - system-permissions: `SystemPermission` — SoT 미정의.
- 참고: message-mail도 `MessageTemplate`을 쓰므로 push와 동일 결함 가능성(감사 에이전트가 mail은 놓쳤을 수 있음).

### B. 테이블/엔티티명 ↔ admin-data-contract.md 불일치 (3건)
- commerce-payments: 문서 `commerce_payments` → 계약엔 `user_payments`.
- system-audit-logs: 문서 `audit_logs` → 계약은 `admin_audit_logs`.
- system-metadata: 문서 `system_metadata_items` → 계약은 `system_metadata_group_items`.

### C. B2C 영향 상태 ↔ admin-data-usage-map.md 모순 (3건)
세 문서가 `운영상 추정`으로 적었으나 usage-map은 `내부 전용`(본문 서술과도 어긋남):
- system-metadata, community-reports(신고 큐), operation-policies(운영 정책 레지스트리).

### D. 조회 전용 페이지인데 설명이 쓰기 동작 서술 (3건)
- analytics-overview, dashboard: §4 작업성격 `조회`인데 설명은 "등록/수정/상태 변경"(§5는 Read만 지원).
- content-badges: placeholder인데 Read만 `지원`으로 단정(메인표는 '후보').

### E. CRUD 지원 여부 미해소 잔재 (2건)
- commerce-points, operation-policies: status=`구현됨`인데 §5 지원 여부가 `지원 또는 후보`로 미확정.

## 교차문서 5건 + Claude 판정
1. `/users/groups`=강사 관리인데 'groups'가 message-groups에선 '그룹' 의미 → **Claude 판정: 코드 라우트 실태(문서 잘못 아님)**.
2. Users만 복수형 모듈명 → **Claude 판정: 거짓양성. AGENTS.md가 'Users 복수형 강제'라 고치면 안 됨**.
3. /messages·/users만 복수 prefix → **Claude 판정: 공식 라우트 실태(문서 잘못 아님)**.
4. mail/push=`MessageTemplate` vs inapp=`NotificationTemplate` 접두 혼재 → **Claude 판정: 실제 모델링 이슈(인앱은 알림 시스템 소속이라 일부 의도적)**.
5. `MessageTemplate`을 mail·push가 공유 → 위와 연계.

## Claude의 권고 3개
1. **[정책 결정 필요] 감사 Target Type SoT 정렬** — (a)군은 SoT 값으로 기계 교정, (b)군(payments/refunds/notices/permissions)은 admin-action-log.md에 신규 등록할지 vs 기존 타입 매핑할지 오너 결정.
2. **[기계적 수정 가능]** B군(테이블명)·C군(B2C 상태)·D군(조회 전용 설명)·E군(지원여부)·§9 표 미치환 잔재(`page-specific enum candidate` 등) — SoT에 정답이 있어 바로 수정.
3. **[건드리지 말 것]** 교차문서 Users 복수형(규칙), 라우트 네이밍 2건(코드 실태).

---

## 리뷰 요청 사항 (각각 동의/수정/반박을 근거와 함께)
1. **확정 20건의 사실 정확성** — 실제 문서/SoT와 맞는가? 과장·오류·허위 지적이 있나? 특히 A군 Target Type 9건과 B군 테이블명 3건을 admin-action-log.md / admin-data-contract.md 라인으로 확인.
2. **기각·"건드리지 말 것" 분류의 타당성** — 특히 (i) Users 복수형이 정말 AGENTS.md 규칙으로 보호되는지, (ii) 라우트 형태가 코드 실태로 문서 잘못이 아닌지, (iii) C군 b2c 상태가 정말 SoT와 모순인지.
3. **권고1의 (a)정답존재 vs (b)결정필요 분류가 정확한가** — (b)로 분류한 4건이 정말 SoT에 전혀 없는지, 혹은 기존 타입으로 매핑 가능한지.
4. **누락 결함** — Claude가 놓친 page-sync 정합성 문제가 있나? (예: message-mail Target Type, 다른 문서의 미발견 결함)
5. **권고 우선순위·실행 방향**이 타당한가?
