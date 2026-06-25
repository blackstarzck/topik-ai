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
- 공지사항 등록/수정/게시/숨김/삭제
- 운영 정책 저장/게시/숨김(법률 문서 + 운영 정책 레지스트리 포함)
- 메시지 발송 설정 변경/발송 실행
- 알림(Notification) 템플릿 등록/수정/상태 변경/삭제, 대상 그룹 등록/수정/삭제, 발송 실행 생성
- 커머스 환불/정책 변경
- 포인트 정책 저장/활성화/중지
- 포인트 수동 적립/차감/회수
- 포인트 소멸 보류/해제/실행
- TOPIK 쓰기 문항의 노출 상태(`service_status`) 변경, 태그 부여/제거, 수신·적재(`question_received` — 외부 공급 API 연동 시 추가)
- Assessment/Content 모듈의 주요 저장 액션
- 관리자 등급(app_role) 변경

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
- 감사 상세의 `diff`(변경 내용)/`payload`(부가 정보)는 민감정보를 포함할 수 있어 **platform_admin에게만** 노출합니다(읽기 RPC `admin_list_audit_logs`가 비-platform admin에게는 NULL 반환). `Log ID`/`Target Type`/`Target ID`/`Action`/`Actor`/`Reason`/`Time` 기본 필드는 전체 admin에게 노출 유지합니다.
- 회원 정지/해제 로그는 `Target Type = User`(`admin_audit_logs.target_table='User'`), `Target ID = userId`를 사용하며, `/users` 또는 `/users/{userId}` 기준 원본 화면과 `/system/audit-logs?targetType=User&targetId={userId}` 후속 검증 경로로 역추적할 수 있어야 합니다.
  - 액션 사전: `user_status_changed`(정지/해제). `active`는 해제/정상, `blocked`는 정지이며, `deleted` 상태 사용자는 RPC에서 변경을 차단합니다.
  - 기록 주체: `admin_set_user_status(target_id uuid, new_status text)` 단일 write 경로. platform_admin 전용이며 `profiles.status`만 토글하고 v13 `profiles` DDL은 변경하지 않습니다.
  - payload/diff 계약: `diff.status.from/to`를 기록하고 `payload.app_role`을 포함합니다. 화면 확인 단계의 사유는 성공 피드백과 감사 로그 확인 경로에 같은 `User + userId` 식별자를 사용해야 하며, reason 입력 UX가 별도로 확장되면 같은 Target Type/ID에 맞춰 저장 계약을 갱신해야 합니다.
- 관리자 등급(app_role) 변경 로그는 `Target Type = AdminAccount`(`admin_audit_logs.target_table='AdminAccount'`), `Target ID = targetUserId`를 사용하며, `/system/permissions?adminId={targetUserId}` 원본 화면과 `/system/audit-logs?targetType=AdminAccount&targetId={targetUserId}` 후속 검증 경로로 역추적할 수 있어야 합니다.
  - 액션 사전: `admin_role_changed`(관리자 `app_role` 변경). 허용 등급은 `platform_admin`/`content_admin`/`org_admin`/`learner`입니다.
  - 기록 주체: `admin_set_admin_app_role(p_target_user_id uuid, p_new_app_role text, p_reason text)` 단일 write 경로. platform_admin 전용, reason 필수, 자기/마지막 platform_admin 강등 차단, `profiles.app_role`만 갱신(다음 로그인 반영, 토큰 미폐기)하며 v13 `profiles` DDL/트리거는 변경하지 않습니다. 조회는 `admin_list_admin_app_roles`(platform_admin 전용, learner 제외).
  - payload/diff 계약: `diff.app_role.from/to`를 기록하고 `payload`에 `reason`/`target_email`/`target_display`/`session_policy='next_login'`을 포함합니다. 화면 카탈로그(37 permission/5 RoleKey)의 부여/회수는 메뉴 게이팅용 mock이며 감사 대상이 아닙니다.
- 강사 조치 로그는 `Target Type = Instructor`, `Target ID = instructorId`를 사용합니다.
- 이벤트 조치 로그는 `Target Type = OperationEvent`(`admin_audit_logs.target_table='OperationEvent'`), `Target ID = eventId`를 사용하며, `EVT-` 접두의 대상 ID는 `/operation/events?selected={eventId}` 원본 화면으로 역추적할 수 있어야 합니다.
  - 액션 사전: `event_saved`(등록/수정), `event_scheduled`(게시 예약), `event_published`(즉시 게시), `event_ended`(종료).
  - 기록 주체: admin RPC 4종 단일 write 경로(`admin_save_operation_event(p_id,p_event,p_reason)`/`admin_schedule_operation_event(p_event_id,p_reason)`/`admin_publish_operation_event(p_event_id,p_reason)`/`admin_end_operation_event(p_event_id,p_reason)`). 네 RPC 모두 사유(`p_reason`)가 필수입니다.
  - payload/diff 계약: `payload.reason`을 공통으로 포함하고, 저장/예약/게시/종료는 변경 컬럼별 `{from,to}` diff를 기록합니다. `admin_schedule_operation_event`는 `visibility_status='scheduled'`, `admin_publish_operation_event`는 `visibility_status='exposed'`, `admin_end_operation_event`는 `progress_status='ended'` 및 `visibility_status='hidden'` 전환을 기록합니다. 성공 피드백은 `감사 로그 확인` 링크(`/system/audit-logs?targetType=OperationEvent&targetId={eventId}`)를 노출합니다.
- 공지사항 조치 로그는 `Target Type = OperationNotice`(`admin_audit_logs.target_table='OperationNotice'`), `Target ID = noticeId`를 사용하며, `/operation/notices?preview={noticeId}` 또는 `/operation/notices` 기준으로 원본 화면을 역추적할 수 있어야 합니다.
  - 액션 사전: `notice_saved`(등록/수정), `notice_status_changed`(게시/숨김 전환), `notice_deleted`(삭제).
  - 기록 주체: admin RPC 3종 단일 write 경로(`admin_save_operation_notice(p_id,p_notice,p_reason)`/`admin_toggle_operation_notice_status(p_notice_id,p_next_status,p_reason)`/`admin_delete_operation_notice(p_notice_id,p_reason)`). 세 RPC 모두 사유(`p_reason`)가 필수이며, 상태 변경과 삭제는 화면 확인 단계의 사유를 RPC에 전달하고 저장은 현재 등록 상세 UX에 별도 사유 입력이 없으므로 서비스 경계에서 저장 사유를 보강합니다.
  - payload/diff 계약: `payload.reason`을 공통으로 포함하고, 저장/상태 변경/삭제는 변경 컬럼별 `{from,to}` diff를 기록합니다. 성공 피드백은 `감사 로그 확인` 링크(`/system/audit-logs?targetType=OperationNotice&targetId={noticeId}`)를 노출합니다.
- 운영 정책 조치 로그는 `Target Type = OperationPolicy`, `Target ID = policyId`를 사용하며, `/operation/policies?selected={policyId}` 기준으로 원본 화면을 역추적할 수 있어야 합니다.
- `OperationPolicy`는 이용약관/개인정보 처리방침 같은 법률 문서와 커뮤니티 게시글 제재/추천인 보상/포인트/쿠폰/이벤트/FAQ/챗봇/메시지/권한 변경 정책 같은 운영 정책 레지스트리를 함께 포괄합니다.
- 액션 사전: `policy_saved`(등록/수정/새 버전 저장), `policy_status_changed`(게시/숨김 전환), `policy_deleted`(삭제), `policy_version_published`(히스토리 버전 게시).
- 기록 주체: admin RPC 4종 단일 write 경로(`admin_save_operation_policy(p_id,p_policy,p_reason)`/`admin_toggle_operation_policy_status(p_policy_id,p_next_status,p_reason)`/`admin_delete_operation_policy(p_policy_id,p_reason)`/`admin_publish_operation_policy_version(p_policy_id,p_history_id,p_reason)`). 네 RPC 모두 사유(`p_reason`)가 필수입니다.
- 이력 계약: 네 RPC 모두 `operation_policy_histories`에 시점 `OperationPolicy` snapshot을 append합니다. 삭제는 cascade 전에 삭제 대상 snapshot을 감사·이력화해야 합니다.
- payload/diff 계약: `payload.reason`을 공통으로 포함하고, `policy_version_published`는 from/to version payload와 `current_version_id` 갱신 결과를 기록합니다. 성공 피드백은 `감사 로그 확인` 링크(`/system/audit-logs?targetType=OperationPolicy&targetId={policyId}`)를 노출합니다.
- FAQ 원문 조치 로그는 `Target Type = OperationFaq`(`admin_audit_logs.target_table='OperationFaq'`), `Target ID = faqId`를 사용하며, `/operation/faq?selected={faqId}` 기준으로 원본 화면을 역추적할 수 있어야 합니다.
  - 액션 사전: `faq_saved`(등록/수정), `faq_status_changed`(공개/비공개 전환), `faq_deleted`(삭제).
  - 기록 주체: admin RPC 3종 단일 write 경로(`admin_save_operation_faq(p_id,p_faq,p_reason)`/`admin_toggle_operation_faq_status(p_faq_id,p_next_status,p_reason)`/`admin_delete_operation_faq(p_faq_id,p_reason)`). 세 RPC 모두 사유(`p_reason`)가 필수입니다.
  - payload/diff 계약: `payload.reason`을 공통으로 포함하고, 상태를 `hidden`으로 전환하면 연결된 active 큐레이션을 `paused`로 강등하며 `payload.paused_curation_ids`에 강등된 큐레이션 ID를 기록합니다. 성공 피드백은 `감사 로그 확인` 링크(`/system/audit-logs?targetType=OperationFaq&targetId={faqId}`)를 노출합니다.
- FAQ 대표 노출 조치 로그는 `Target Type = OperationFaqCuration`(`admin_audit_logs.target_table='OperationFaqCuration'`), `Target ID = curationId`를 사용하며, `/operation/faq?tab=curation&curationSelected={curationId}` 기준으로 원본 화면을 역추적할 수 있어야 합니다.
  - 액션 사전: `faq_curation_saved`(추가/수정/일시중지/재개), `faq_curation_deleted`(삭제).
  - 기록 주체: admin RPC 2종 단일 write 경로(`admin_save_operation_faq_curation(p_id,p_curation,p_reason)`/`admin_delete_operation_faq_curation(p_curation_id,p_reason)`). 두 RPC 모두 사유(`p_reason`)가 필수입니다.
  - payload/diff 계약: `payload.reason`을 공통으로 포함합니다. DB는 `UNIQUE(surface, display_rank)`를 강제하고, `hidden` FAQ를 `active` 큐레이션으로 저장하는 것을 차단합니다. 성공 피드백은 `감사 로그 확인` 링크(`/system/audit-logs?targetType=OperationFaqCuration&targetId={curationId}`)를 노출합니다.
- 포인트 정책 조치 로그는 `Target Type = CommercePointPolicy`, `Target ID = pointPolicyId`를 사용합니다.
- 포인트 원장 조치 로그는 `Target Type = CommercePointLedger`, `Target ID = pointLedgerId`를 사용합니다.
- 포인트 소멸 조치 로그는 `Target Type = CommercePointExpiration`, `Target ID = expirationId`를 사용합니다.
- 쿠폰 조치 로그는 `Target Type = CommerceCoupon`, `Target ID = couponId`를 사용합니다.
- 정기 쿠폰 템플릿 조치 로그는 `Target Type = CommerceCouponTemplate`, `Target ID = templateId`를 사용합니다.
- TOPIK 쓰기 문항 조치 로그는 `Target Type = AssessmentQuestion`, `Target ID = questionId`를 사용합니다.
  - 액션 사전은 D-8 개정(2026-06-11 인바운드 전환 — `docs/architecture/metadata-tag-schema-transition-decision-record.md` §0)을 따릅니다: 유지 = `service_status_changed`/`tag_assigned`/`tag_removed`, 추가(후속) = `question_received`(외부 공급 API 수신·적재 — 외부 API 미개발, 공급 연동 시 추가), 폐기 = 검수 4종(`review_completed`/`review_on_hold`/`review_revision_requested`/`review_memo_saved`)·배포 `question_published`.
- `노출 가능`/`노출 제외`/`내부 테스트`(`service_status_changed`) 전환 조치와 태그 부여/제거(`tag_assigned`/`tag_removed`)는 **P4 관리 포인트 개방(2026-06-11)으로 활성**이며, 시스템 감사 로그에서 문항 관리 화면 `/assessment/question-bank/manage` 기준으로 원본 화면을 역추적할 수 있어야 합니다(상세 라우트는 재정의 P3에서 `/assessment/question-bank/{questionId}`로 개명 완료 — `202f905`). 노출 상태 전환은 확인 + 사유 입력(필수)을 유지하고, 태그 부여/제거는 별도 사유 입력 없이 처리합니다.
  - **P4 write 계약(2026-06-11 결선, 태그 별도 입력 제거 2026-06-12)**: 노출 전환 사유는 `__note` 예약 키 → `admin_audit_logs.payload.note`에 저장합니다. 태그 부여/제거는 별도 메모 필드를 쓰지 않고 diff `{tag:{from,to}}`로만 현재 변경을 기록합니다. diff는 `{service_status:{from,to}}` / `{tag:{from,to}}` 형식입니다. 성공 피드백은 대상 식별 정보 + `감사 로그 확인` 링크(`/system/audit-logs?targetType=AssessmentQuestion&targetId={questionId}`)를 노출합니다. RT-4 왕복·RLS 차단 증적: `logs/metadata-tag-schema-transition-evidence.md` P4 절.
  - 주의(기지 갭 — `docs/specs/admin-page-gap-register.md` §4.10.2): 감사 로그 화면은 현재 모크 store SoT라 실 `admin_audit_logs` 행이 화면에 표시되지 않습니다. 실데이터 역추적은 DB 단(`admin_audit_logs` 조회)으로 검증하며, 화면 실데이터 연동은 후속 범위입니다.
- 폐기(화면 제거 완료): `검수 완료`/`보류`/`수정 필요` 조치와 `검수 메모 저장`(메모 본문을 `Reason`으로 사용) 계약은 2026-06-11 검수 개념 삭제로 폐기됐습니다. 구 2depth 검수 페이지는 재정의 P3에서 제거 완료됐고(`202f905` — 기존 감사 행은 "(구)" 역사 라벨로 표시), DB측 `admin_update_topik_question` RPC의 검수 액션 경로도 마이그레이션 `0013`에서 제거 완료됐습니다(2026-06-11 적용 — RPC 원문 검수 참조 0건). 태그 부여/제거용 운영 메모 계약도 2026-06-12에 제거했습니다.
- 폐기: 운영정책 `POL-017` 구판의 `배포(API 업로드)` 후보 액션(`question_published`, `publishedTaskId` 근거 포함)은 상류 push 폐기(2026-06-11 §0)로 철회됐습니다. `POL-017`은 "TOPIK 쓰기 문항 수신·관리 운영정책"(수신(외부 API, 미개발) → 적재 → 관리 포인트(태그) + 노출(`service_status`) → v13 read-only)으로 재정의됐고, 수신·적재가 구현되면 `question_received` 액션이 같은 `Target Type = AssessmentQuestion`, `Target ID = questionId` 계약으로 기록돼야 합니다.
- 태그 마스터 조치 로그(P5-3 — 2026-06-11 개방)는 `Target Type = AssessmentTagMaster`, `Target ID = tagCode`를 사용합니다.
  - 액션 = `tag_master_status_changed`(라벨 "태그 마스터 상태 변경"). 원본 화면 역추적 경로 = `/system/metadata`(마스터 카탈로그 섹션 태그 탭).
  - write 계약: `/system/metadata` 마스터 카탈로그의 활성/비활성 토글 단일 — RPC `admin_update_tag_master_status`(마이그레이션 0014, SECURITY DEFINER) 경유. 가드 = **platform_admin**(문항 RPC의 content_admin과 분리 — 마스터 사전 변경은 전 문항 부여 옵션에 영향) + 사유 필수(RPC 단 강제) + 미존재·무변경 토글 거부. diff는 `{is_active:{from,to}}`, payload는 `{note, active_assignment_count}`(토글 시점 활성 부여 수 — 부여 이력은 유지) 형식입니다. 성공 피드백은 대상 식별 정보 + `감사 로그 확인` 링크(`/system/audit-logs?targetType=AssessmentTagMaster&targetId={tagCode}`)를 노출합니다.
  - 주제 마스터와 마스터 값 편집(이름·설명 등)은 여전히 조회 전용이라 감사 액션이 없습니다.
- 알림(Notification) 조치 로그(2026-06-12 supabase 연동 — WP2)는 `Target Type = Notification`, `Target ID = {row uuid}`(템플릿/그룹/발송 실행 행의 uuid)를 사용합니다.
  - 액션 사전: 템플릿 = `notification_template_created`(템플릿 등록)/`notification_template_updated`(템플릿 수정)/`notification_template_status_changed`(상태 변경 — diff `{status:{from,to}}`)/`notification_template_deleted`(템플릿 삭제), 그룹 = `notification_group_created`/`notification_group_updated`/`notification_group_deleted`, 발송 = `notification_dispatch_created`(발송 실행 생성 — 즉시/예약/나에게 보내기).
  - 기록 주체: admin RPC 6종 단일 write 경로(`admin_save_notification_template`/`admin_set_notification_template_status`/`admin_delete_notification_template`/`admin_save_notification_group`/`admin_delete_notification_group`/`admin_send_notification` — SECURITY DEFINER + `private.is_admin` 가드 + **사유 RPC 단 필수**). 화면 직접 테이블 쓰기는 없습니다(RLS 쓰기 정책 0).
  - payload 계약: 공통 `reason`. 템플릿 저장은 `template_key`/`channel`/`class`/`mandatory`, 삭제는 `template_key`, 그룹은 `name`을 포함합니다. `notification_dispatch_created`는 `reason`, `template_key`, `channel`, `class`, `mandatory`, `target_type`(group/test), `target_group_ids`, `scheduled_at`을 포함하고 **mandatory 템플릿이면 `bypass_reason`**(수신 선호 우회 근거)이 함께 남습니다 — `docs/specs/notification-contract.md` §2 class 정책.
  - 역추적 딥링크: `/system/audit-logs?targetType=Notification&targetId={id}`. 원본 화면은 채널별 `/messages/mail`·`/messages/push`·`/messages/in-app`(템플릿), `/messages/groups`(그룹), `/messages/history`(발송 실행)입니다.
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

## 2026-06-17 CommunityPost/CommunityReport 감사 로그 계약

### CommunityPost

- Target Type: `CommunityPost` (`admin_audit_logs.target_table='CommunityPost'`).
- Target ID: `postId` (`POST-NNN`).
- 원본 화면 딥링크: `/community/posts`, 감사 확인 경로 `/system/audit-logs?targetType=CommunityPost&targetId={postId}`.
- RPC/action 사전:
  - `admin_hide_community_post(p_post_id,p_reason,p_policy_code)` -> action `post_hidden`, diff `status.from/to`, payload `reason`, `policy_code`, `title`.
  - `admin_show_community_post(p_post_id,p_reason,p_policy_code)` -> action `post_shown`, diff `status.from/to`, payload `reason`, `policy_code`, `title`.
  - `admin_delete_community_post(p_post_id,p_reason)` -> action `post_deleted`, diff `deleted.from=false/to=true`, payload `reason`, `title`.
  - `admin_add_community_post_memo(p_post_id,p_memo,p_reason)` -> action `post_memo_added`, payload `reason`, `memo_id`, `memo_title`, `memo_type`.
- 모든 게시글 조치 RPC는 admin 권한과 운영 사유를 요구한다. 메모 RPC는 메모 제목/본문을 필수로 요구하며 `p_reason`은 payload에 optional로 저장된다.

### CommunityReport

- Target Type: `CommunityReport` (`admin_audit_logs.target_table='CommunityReport'`).
- Target ID: `reportId` (`RP-NNN`).
- 원본 화면 딥링크: `/community/reports`, 감사 확인 경로 `/system/audit-logs?targetType=CommunityReport&targetId={reportId}`.
- RPC/action 사전: `admin_resolve_community_report(p_report_id,p_action,p_reason)` -> action `report_resolved`.
- `p_action` 값과 의미:
  - `hide_post`: 신고를 `resolved`로 종결하고, 대상 게시글이 있으면 같은 트랜잭션에서 `community_posts.status='hidden'`, `last_moderation_policy_code=reason_code or 'OTHER'`로 실제 변경한다.
  - `suspend_user`: 신고를 `resolved`로 종결하고, payload `user_suspend_integration=intent_only_v13_admin_set_user_status_pending`으로 사용자 정지 의도만 기록한다. Community 신고 조치와 Users `admin_set_user_status` 실제 호출 연결은 별도 후속 범위다.
  - `dismiss`: 신고를 `resolved`로 종결하되 게시글/사용자 조치는 하지 않는다.
- 감사 diff/payload: diff는 `process_status.from/to`를 기록하고, payload는 `action`, `reason`, `affected_post_id`, `affected_user_id`, `user_suspend_integration`을 포함한다.

## 2026-06-17 CommercePointPolicy/CommercePointLedger/CommercePointExpiration 감사 로그 계약

### CommercePointPolicy

- Target Type: `CommercePointPolicy` (`admin_audit_logs.target_table='CommercePointPolicy'`).
- Target ID: `pointPolicyId` (`POL-NNNN`).
- 원본 화면 딥링크: `/commerce/points`, 감사 확인 경로 `/system/audit-logs?targetType=CommercePointPolicy&targetId={pointPolicyId}`.
- RPC/action 사전:
  - `admin_save_commerce_point_policy(p_id,p_policy,p_reason)` -> action `point_policy_saved`, payload `reason`, `name`, `policy_type`.
  - `admin_update_commerce_point_policy_status(p_policy_id,p_next_status,p_reason)` -> action `point_policy_status_changed`, diff `status.from/to`, payload `reason`, `name`.
- 모든 정책 write RPC는 reason 필수다. DB status는 ASCII `draft`/`active`/`inactive`이며 UI 한글 라벨은 `point-types`/`point-schema`에서 매핑한다.

### CommercePointLedger

- Target Type: `CommercePointLedger` (`admin_audit_logs.target_table='CommercePointLedger'`).
- Target ID: `pointLedgerId` (`PL-NNNN`).
- 원본 화면 딥링크: `/commerce/points`, 감사 확인 경로 `/system/audit-logs?targetType=CommercePointLedger&targetId={pointLedgerId}`.
- RPC/action 사전:
  - `admin_create_manual_point_adjustment(p_user_id,p_amount,p_reason)` -> action `point_manual_adjusted`, diff `available_balance_after.from/to`, payload `reason`, `user_id`, `amount`.
- 서버측 잔액 계약: RPC가 사용자별 advisory lock + 최신 ledger `for update`로 최신 `available_balance_after`를 읽고 `balance_after = available_balance_after = latestAvailable + p_amount`를 계산한다. 음수 잔액은 RPC 가드와 `commerce_point_ledgers_nonnegative_balance_check`로 차단한다. Supabase 경로에서 클라이언트 잔액 계산은 제거된 계약으로 본다.

### CommercePointExpiration

- Target Type: `CommercePointExpiration` (`admin_audit_logs.target_table='CommercePointExpiration'`).
- Target ID: `expirationId` (`EXP-NNNN`).
- 원본 화면 딥링크: `/commerce/points`, 감사 확인 경로 `/system/audit-logs?targetType=CommercePointExpiration&targetId={expirationId}`.
- RPC/action 사전:
  - `admin_hold_commerce_point_expiration(p_expiration_id,p_reason)` -> action `point_expiration_held`, diff `status.from/to`, payload `reason`, `user_id`.
  - `admin_release_commerce_point_expiration(p_expiration_id,p_reason)` -> action `point_expiration_released`, diff `status.from/to`, payload `reason`, `user_id`.
- 모든 소멸 보류/해제 RPC는 reason 필수다. DB status는 ASCII `scheduled`/`held`/`completed`/`cancelled`이며 UI 한글 라벨은 `point-types`/`point-schema`에서 매핑한다.

## 2026-06-17 Commerce 쿠폰 감사 로그 계약

| Target Type | Target ID | Action | 발생 경로 | 필수 사유 | 확인 경로 |
| --- | --- | --- | --- | --- | --- |
| `CommerceCoupon` | `commerce_coupons.id` | `coupon_saved` | `admin_save_commerce_coupon` | 필수 | `/commerce/coupons` 및 `/system/audit-logs?targetType=CommerceCoupon&targetId={couponId}` |
| `CommerceCoupon` | `commerce_coupons.id` | `coupon_duplicated` | `admin_duplicate_commerce_coupon` | 필수 | `/commerce/coupons` 및 `/system/audit-logs?targetType=CommerceCoupon&targetId={couponId}` |
| `CommerceCoupon` | `commerce_coupons.id` | `coupon_paused` | `admin_set_commerce_coupon_issue_state(p_state='paused')` | 필수 | `/commerce/coupons` 및 `/system/audit-logs?targetType=CommerceCoupon&targetId={couponId}` |
| `CommerceCoupon` | `commerce_coupons.id` | `coupon_resumed` | `admin_set_commerce_coupon_issue_state(p_state='normal')` | 필수 | `/commerce/coupons` 및 `/system/audit-logs?targetType=CommerceCoupon&targetId={couponId}` |
| `CommerceCoupon` | `commerce_coupons.id` | `coupon_deleted` | `admin_delete_commerce_coupon` | 필수 | `/commerce/coupons` 및 `/system/audit-logs?targetType=CommerceCoupon&targetId={couponId}` |
| `CommerceCouponTemplate` | `commerce_coupon_subscription_templates.id` | `coupon_template_saved` | `admin_save_commerce_coupon_template` | 필수 | `/commerce/coupons` 및 `/system/audit-logs?targetType=CommerceCouponTemplate&targetId={templateId}` |
| `CommerceCouponTemplate` | `commerce_coupon_subscription_templates.id` | `coupon_template_paused` | `admin_set_commerce_coupon_template_status(p_status='paused')` | 필수 | `/commerce/coupons` 및 `/system/audit-logs?targetType=CommerceCouponTemplate&targetId={templateId}` |
| `CommerceCouponTemplate` | `commerce_coupon_subscription_templates.id` | `coupon_template_resumed` | `admin_set_commerce_coupon_template_status(p_status='active')` | 필수 | `/commerce/coupons` 및 `/system/audit-logs?targetType=CommerceCouponTemplate&targetId={templateId}` |
| `CommerceCouponTemplate` | `commerce_coupon_subscription_templates.id` | `coupon_template_deleted` | `admin_delete_commerce_coupon_template` | 필수 | `/commerce/coupons` 및 `/system/audit-logs?targetType=CommerceCouponTemplate&targetId={templateId}` |

- 쿠폰 발행 상태 pause/resume은 `coupon_kind='autoIssue'`에만 허용된다.
- Supabase 경로에서는 기존 store `CouponAuditEvent(AL-CPN-)` 기반 감사가 `admin_audit_logs`로 대체된다. mock fallback 경로의 store 감사는 개발용 보존으로만 본다.
## 2026-06-17 CommerceRefund 감사 로그 계약

- 환불 조치 로그는 범용 `Commerce`가 아니라 `Target Type = CommerceRefund`, `Target ID = refundId`를 사용합니다.
- 원본 화면 딥링크: `/commerce/refunds`, 감사 확인 경로 `/system/audit-logs?targetType=CommerceRefund&targetId={refundId}`.
- RPC/action 사전:
  - `admin_approve_billing_refund(p_refund_id,p_reason)` -> action `refund_approved`, `admin_audit_logs.target_table='CommerceRefund'`, `target_id=p_refund_id`.
  - `admin_reject_billing_refund(p_refund_id,p_reason)` -> action `refund_rejected`, `admin_audit_logs.target_table='CommerceRefund'`, `target_id=p_refund_id`.
- 두 RPC 모두 admin 권한과 reason 필수 조건을 검증하고, `commerce_refunds.status='pending'`인 건만 처리합니다.
- `refund_approved` payload에는 `reason`, `payment_id`, `requested_amount`, `intent_only_v13_payment_history_pending=true`를 기록합니다. 실제 v13 `payment_history.status` 환불 갱신은 v13 소유라 아직 수행하지 않습니다.
- `refund_rejected` payload에는 `reason`, `payment_id`, `requested_amount`를 기록합니다.
## 2026-06-17 보강 메모 > System 메타데이터 그룹/항목 Supabase 감사 계약

- Target Type: `SystemMetadataGroup`
- Target ID: `groupId`
- 원본 화면 딥링크: `/system/metadata?selected={groupId}`
- 항목 조치도 그룹 단위로 추적한다. `system_metadata_group_items.item_id`는 payload/diff에 포함될 수 있지만 감사 target은 `SystemMetadataGroup + groupId`다.
- 모든 write RPC는 `reason`을 필수로 요구한다.

| RPC | action | target_table | target_id | 비고 |
| --- | --- | --- | --- | --- |
| `admin_save_metadata_group` | `metadata_group_saved` | `SystemMetadataGroup` | `groupId` | 그룹 등록/수정, 그룹명 중복 차단 |
| `admin_save_metadata_item` | `metadata_item_saved` | `SystemMetadataGroup` | `groupId` | 항목 등록/수정, 그룹 내 code/label 중복 차단 |
| `admin_toggle_metadata_group_status` | `metadata_group_status_changed` | `SystemMetadataGroup` | `groupId` | 그룹 활성/비활성 |
| `admin_toggle_metadata_item_status` | `metadata_item_status_changed` | `SystemMetadataGroup` | `groupId` | 항목 활성/비활성 |
| `admin_delete_metadata_item` | `metadata_item_deleted` | `SystemMetadataGroup` | `groupId` | 항목 삭제, 정렬 재정규화 |
| `admin_reorder_metadata_items` | `metadata_items_reordered` | `SystemMetadataGroup` | `groupId` | 전체 항목 ID 일치 검증 후 정렬 |

## 2026-06-18 감사 로그 조회(reader) 계약

- `/system/audit-logs`의 live source는 읽기 전용 RPC `admin_list_audit_logs(p_target_type, p_target_id, p_keyword, p_start, p_end, p_limit=100, p_offset=0)`입니다.
- 이 RPC는 새 write action이 아니며, 기존 admin RPC들이 `admin_audit_logs`에 적재한 감사 로그를 조회하기 위한 reader 계약입니다.
- Supabase 모드에서는 `admin_audit_logs`가 단일 source이고, 모든 도메인 Target Type(`User`, `OperationNotice`, `OperationFaq`, `OperationEvent`, `OperationPolicy`, `CommunityPost`, `CommunityReport`, `CommercePointPolicy`, `CommercePointLedger`, `CommercePointExpiration`, `CommerceCoupon`, `CommerceCouponTemplate`, `CommerceRefund`, `SystemMetadataGroup` 등)을 같은 화면에서 표시합니다.
- RPC는 `SECURITY DEFINER` + `private.is_admin` 가드로 동작하고, `profiles(admin_user_id -> id)` 조인을 통해 `profiles.display_name`을 `actor`로 해석합니다.
- 필터는 `target_table`, `target_id`, keyword `ILIKE`, `created_at` 범위이며, 정렬은 `created_at desc`, 페이지네이션은 `p_limit`/`p_offset`입니다.
- 반환 컬럼은 `log_id`, `target_type`, `target_id`, `action`, `actor`, `reason`, `diff`, `payload`, `created_at`, `total_count`입니다. 단, `diff`/`payload` 민감정보 노출 범위는 미확정이므로 화면 노출은 보류합니다.
## 2026-06-18 Users 학습 현황 조회 감사 로그 기준

- `Users > 회원 상세 > 학습 현황`은 조회 전용 read RPC(`get_admin_user_learning_overview`)이므로 별도 `admin_audit_logs` write를 만들지 않는다.
- 조회 데이터는 답안 본문/문장 첨삭 본문을 제외한 집계와 메타데이터로 제한한다.
- 회원 정지/해제 같은 조치성 액션은 기존 `Target Type=Users`, `Target ID=userId`, 사유 필수, `/system/audit-logs?targetType=Users&targetId={userId}` 확인 경로를 유지한다.
- 향후 답안 본문 또는 sentence feedback 열람이 승인되면 조회 행위 자체를 별도 감사 대상으로 재검토한다.
