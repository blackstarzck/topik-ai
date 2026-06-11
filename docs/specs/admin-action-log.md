# System > 감사 로그

이 문서는 관리자 조치 이력 추적 기능의 기준 문서입니다.

## 목적

- 어떤 관리자가 어떤 대상을 어떻게 변경했는지 추적
- 운영 사고 분석과 복구 근거 제공
- role/permission 변경까지 포함한 거버넌스 확보

## 반드시 기록해야 하는 액션

- 회원 정지/해제/탈퇴
- 강사 정지/해제
- 게시글 숨김/삭제
- FAQ 공개/비공개/삭제
- FAQ 대표 노출 추가/수정/일시중지/재개/삭제
- 이벤트 저장/게시 예약/즉시 게시/종료
- 운영 정책 저장/게시/숨김(법률 문서 + 운영 정책 레지스트리 포함)
- 메시지 발송 설정 변경/발송 실행
- 커머스 환불/정책 변경
- 포인트 정책 저장/활성화/중지
- 포인트 수동 적립/차감/회수
- 포인트 소멸 보류/해제/실행
- TOPIK 쓰기 문항의 노출 상태(`service_status`) 변경, 태그 부여/제거, 수신·적재(`question_received` — 외부 공급 API 연동 시 추가)
- Assessment/Content 모듈의 주요 저장 액션
- 관리자 권한 변경

## 기본 필드

| 필드        | 설명           |
| ----------- | -------------- |
| Log ID      | 로그 식별자    |
| Admin       | 수행 관리자    |
| Action      | 수행 액션      |
| Target Type | 대상 모듈/유형 |
| Target ID   | 대상 식별자    |
| Reason      | 사유/근거      |
| Time        | 수행 시각      |

## 연결 규칙

- Users, Instructor, Community, Message, Operation, Commerce, Assessment, Content 변경 액션은 감사 로그 대상입니다.
- 감사 로그는 `Target Type`, `Target ID` 기준으로 원본 화면을 역추적할 수 있어야 합니다.
- 성공 피드백(notification)은 감사 로그와 동일한 식별 값을 사용해야 합니다.
- 강사 조치 로그는 `Target Type = Instructor`, `Target ID = instructorId`를 사용합니다.
- 이벤트 조치 로그는 현재 `Target Type = Operation`, `Target ID = eventId`를 사용하고, `EVT-` 접두의 대상 ID는 `/operation/events` 원본 화면으로 역추적할 수 있어야 합니다.
- 운영 정책 조치 로그는 `Target Type = OperationPolicy`, `Target ID = policyId`를 사용하며, `/operation/policies?selected={policyId}` 기준으로 원본 화면을 역추적할 수 있어야 합니다.
- `OperationPolicy`는 이용약관/개인정보 처리방침 같은 법률 문서와 커뮤니티 게시글 제재/추천인 보상/포인트/쿠폰/이벤트/FAQ/챗봇/메시지/권한 변경 정책 같은 운영 정책 레지스트리를 함께 포괄합니다.
- 정책 관리의 `내용 수정`, `새 버전 등록`, `게시`, `숨김`, `삭제`, `이 버전 게시` 액션은 모두 `Target Type = OperationPolicy`, `Target ID = policyId` 계약을 유지합니다.
- `게시`, `숨김`, `삭제`, `이 버전 게시`는 확인 + 사유 입력을 필수로 남깁니다.
- `이 버전 게시`는 성공 피드백과 감사 로그에서 `fromVersionId/toVersionId` 또는 이에 준하는 게시 전환 근거를 함께 남길 수 있어야 합니다.
- FAQ 원문 조치 로그는 `Target Type = OperationFaq`, `Target ID = faqId`를 사용합니다.
- FAQ 대표 노출 조치 로그는 `Target Type = OperationFaqCuration`, `Target ID = curationId`를 사용합니다.
- 포인트 정책 조치 로그는 `Target Type = CommercePointPolicy`, `Target ID = pointPolicyId`를 사용합니다.
- 포인트 원장 조치 로그는 `Target Type = CommercePointLedger`, `Target ID = pointLedgerId`를 사용합니다.
- 포인트 소멸 조치 로그는 `Target Type = CommercePointExpiration`, `Target ID = expirationId`를 사용합니다.
- 쿠폰 조치 로그는 `Target Type = CommerceCoupon`, `Target ID = couponId`를 사용합니다.
- 정기 쿠폰 템플릿 조치 로그는 `Target Type = CommerceCouponTemplate`, `Target ID = templateId`를 사용합니다.
- TOPIK 쓰기 문항 조치 로그는 `Target Type = AssessmentQuestion`, `Target ID = questionId`를 사용합니다.
  - 액션 사전은 D-8 개정(2026-06-11 인바운드 전환 — `docs/architecture/metadata-tag-schema-transition-decision-record.md` §0)을 따릅니다: 유지 = `service_status_changed`/`tag_assigned`/`tag_removed`, 추가(후속) = `question_received`(외부 공급 API 수신·적재 — 외부 API 미개발, 공급 연동 시 추가), 폐기 = 검수 4종(`review_completed`/`review_on_hold`/`review_revision_requested`/`review_memo_saved`)·배포 `question_published`.
- `노출 가능`/`노출 제외`/`내부 테스트`(`service_status_changed`) 전환 조치와 태그 부여/제거(`tag_assigned`/`tag_removed`)는 **P4 관리 포인트 개방(2026-06-11)으로 활성**이며, 확인 + 사유 입력(필수)을 남기고 시스템 감사 로그에서 문항 관리 화면 `/assessment/question-bank/manage` 기준으로 원본 화면을 역추적할 수 있어야 합니다(상세 라우트는 재정의 P3에서 `/assessment/question-bank/{questionId}`로 개명 완료 — `202f905`).
  - **P4 write 계약(2026-06-11 결선)**: 노출 전환 사유는 `__note` 예약 키 → `admin_audit_logs.payload.note`, 태그 사유는 `question_tags.memo` + `payload.tag_memo`에 저장됩니다. diff는 `{service_status:{from,to}}` / `{tag:{from,to}}` 형식입니다. 성공 피드백은 대상 식별 정보 + `감사 로그 확인` 링크(`/system/audit-logs?targetType=AssessmentQuestion&targetId={questionId}`)를 노출합니다. RT-4 왕복·RLS 차단 증적: `logs/metadata-tag-schema-transition-evidence.md` P4 절.
  - 주의(기지 갭 — `docs/specs/admin-page-gap-register.md` §4.10.2): 감사 로그 화면은 현재 모크 store SoT라 실 `admin_audit_logs` 행이 화면에 표시되지 않습니다. 실데이터 역추적은 DB 단(`admin_audit_logs` 조회)으로 검증하며, 화면 실데이터 연동은 후속 범위입니다.
- 폐기(화면 제거 완료): `검수 완료`/`보류`/`수정 필요` 조치와 `검수 메모 저장`(메모 본문을 `Reason`으로 사용) 계약은 2026-06-11 검수 개념 삭제로 폐기됐습니다. 구 2depth 검수 페이지는 재정의 P3에서 제거 완료됐고(`202f905` — 기존 감사 행은 "(구)" 역사 라벨로 표시), DB측 `admin_update_topik_question` RPC의 검수 액션 경로도 마이그레이션 `0013`에서 제거 완료됐습니다(2026-06-11 적용 — RPC 원문 검수 참조 0건). 운영 메모는 태그 부여/제거 사유 `question_tags.memo`로만 기록합니다.
- 폐기: 운영정책 `POL-017` 구판의 `배포(API 업로드)` 후보 액션(`question_published`, `publishedTaskId` 근거 포함)은 상류 push 폐기(2026-06-11 §0)로 철회됐습니다. `POL-017`은 "TOPIK 쓰기 문항 수신·관리 운영정책"(수신(외부 API, 미개발) → 적재 → 관리 포인트(태그) + 노출(`service_status`) → v13 read-only)으로 재정의됐고, 수신·적재가 구현되면 `question_received` 액션이 같은 `Target Type = AssessmentQuestion`, `Target ID = questionId` 계약으로 기록돼야 합니다.
- 메타데이터 그룹/항목 조치 로그는 `Target Type = SystemMetadataGroup`, `Target ID = groupId`를 사용합니다.
- 메타데이터 항목 조치도 현재는 그룹 단위 추적을 우선 적용하며, 시스템 감사 로그에서 `/system/metadata?selected={groupId}` 기준으로 원본 화면을 역추적할 수 있어야 합니다.
- 메타데이터의 `운영 값 순서 변경(item_reordered)`도 같은 계약을 사용하며, 드래그 정렬 직후 감사 로그에서 해당 그룹 단위 이력을 확인할 수 있어야 합니다.

## 2026-06-11 개정 메모 > 인바운드 전환 — TOPIK 쓰기 액션 사전 개정

- 2026-06-11 오너 결정(인바운드 수신 모델 — `docs/architecture/metadata-tag-schema-transition-decision-record.md` §0)으로 검수 개념이 admin에서 전면 삭제되고 상류 push(배포) 트랙이 폐기됐다.
- 액션 사전(D-8 개정): 유지 = `service_status_changed`·`tag_assigned`·`tag_removed`, 추가(후속) = `question_received`(외부 공급 API 수신·적재 — 외부 API 미개발, 공급 연동 시 결선), 폐기 = 검수 계열 `review_completed`·`review_on_hold`·`review_revision_requested`·`review_status_changed`·`review_memo_saved` + 배포 `question_published`.
- 아래 2026-06-10 메모의 검수 액션·검수 사유(`__note` → `payload.review_note`)·검수 선행 가드 서술은 현행 **DB측 RPC**(`admin_update_topik_question`) 사실로 유지한다(D-2/D-7 철회, D-6 노출 제외 기준 ① 삭제). 화면·facade 측 검수 경로는 재정의 P3에서 제거 완료됐고(`202f905` — 감사 표면은 폐기 액션을 "(구)" 역사 라벨로 렌더), RPC측도 마이그레이션 `0013`에서 제거 완료됐다(2026-06-11 적용). 아래 메모는 역사 기록.
- SECURITY DEFINER + `private.is_content_admin` 가드, 컬럼 diff 기록, '서비스_노출상태' 태그 그룹 부여 차단(D-6)은 그대로 유지된다.

## 2026-06-10 보강 메모 > 메타데이터·태그 스키마 전환 P1 — 신규 감사 RPC 계약 예고 (2026-06-11 개정 메모로 일부 대체)

- P1에서 신규 감사 RPC 3종이 프로덕션에 생성되었다(`supabase/migrations/20260610201200_topik_writing_admin_rpcs.sql`). 화면 결선은 P4(운영 쓰기·태그)에서 수행하며, 그 전까지 화면은 구 계약을 유지한다(2026-06-11 개정: 구 P3 검수 쓰기 결선은 폐기 — 재정의 P3는 조회 컷오버 + 검수 표면·컬럼 제거).
- 공통 계약: SECURITY DEFINER + `private.is_content_admin` 가드, `admin_audit_logs`에 actor=`auth.uid()`, `Target Type(target_table) = AssessmentQuestion`, `Target ID = question_id`(신규 TEXT 채번 ID), 컬럼 diff `{col:{from,to}}` 기록. 검수 사유 본문은 예약 patch 키 `__note`로 전달되어 `payload.review_note`에 저장됐다(구 DB측 RPC 사실 — D-7 철회. 화면 호출 경로는 재정의 P3에서, RPC측 경로는 마이그레이션 `0013`(2026-06-11 적용)에서 제거 완료).
- 액션 코드 사전(D-8 — 2026-06-11 개정 반영): `admin_update_topik_question` → `service_status_changed`(P4 — 유지) / 검수 계열 `review_completed`·`review_revision_requested`·`review_on_hold`·`review_status_changed`(기타 워크플로 전이)·`review_memo_saved`(메모 단독)는 폐기 — 화면 호출 경로는 재정의 P3에서 제거 완료(`202f905`), DB측 RPC 잔존 경로도 마이그레이션 `0013`에서 제거 완료(2026-06-11 적용). `admin_assign_question_tag` → `tag_assigned`, `admin_remove_question_tag` → `tag_removed`(유지). 구 배포(P6) `question_published` 예약은 push 폐기로 철회.
- 가드: (구) `service_status='available'` 전환은 `review_status='approved'`가 선행돼야 하며 위반 시 RPC가 거부했다 — D-6 노출 제외 기준 ① 철회로 마이그레이션 `0013`(2026-06-11 적용)에서 제거 완료. 화면 모달 문구는 재정의 P3에서 POL-018 ② 기준으로 교체 완료. '서비스_노출상태' 태그 그룹 부여 차단은 RPC에 유지된다(D-6).
- P1 검증 증적(역사 기록): 파일럿 왕복에서 `tag_assigned`/`review_status_changed` 감사 행과 `payload.review_note` 기록을 확인함(`logs/metadata-tag-schema-transition-evidence.md` P1 절).
- 감사 표면(`/system/audit-logs`) 액션 라벨 맵: 폐기된 검수 액션의 "(구)" 역사 라벨은 재정의 P3에서 반영 완료(`202f905` — 기존 감사 행 렌더 전용). 유지·신규 액션 라벨 최종 점검은 P4에서 완료 — `service_status_changed`(노출 상태 변경)/`tag_assigned`(태그 부여)/`tag_removed`(태그 제거)/`question_received`(문항 수신) 라벨 확인 + `AssessmentQuestion` Target ID 딥링크를 P3 개명 라우트(`/assessment/question-bank/{questionId}`)로 수정(구 `/review/` 경로 잔존 버그 해소).

## 2026-03-27 보강 메모 > System 메타데이터 운영 값 삭제
- `System > 메타데이터 관리`의 운영 값 삭제는 Tree hover 삭제와 `운영 값 수정` Modal 삭제 버튼 두 경로를 모두 지원합니다.
- 두 경로 모두 `Target Type = SystemMetadataGroup`, `Target ID = groupId` 감사 계약을 유지합니다.
- 운영 값 삭제 후 확인 경로는 `/system/audit-logs?targetType=SystemMetadataGroup&targetId={groupId}` 입니다.
- history/action 값에는 `item_deleted`를 사용합니다.
