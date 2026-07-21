# 공유 Supabase 스키마 소유권 (Shared Schema Ownership)

| 항목 | 내용 |
| --- | --- |
| 상태 | 활성 SoT (2026-06-12 제정 — 알림 기능 개발 WP0-1) |
| 적용 대상 | 공유 Supabase 프로젝트 `fglggyfvzjdsbyckinqa`(talkpik-dev) 및 상위 환경 |
| 관련 문서 | topik-ai `AGENTS.md` §2, v13 `AGENTS.md` 비협상 규칙, `docs/알림-기능-개발-실행계획안.md` §5.0 |

## 1. 원칙

공유 Supabase 프로젝트의 스키마 소유권은 **앱 기준이 아니라 도메인/네임스페이스 기준**으로 정한다.

- **v13 소유**: B2C 사용자 경험에 직접 필요한 core user-facing schema.
- **topik-ai 소유**: admin 운영 기능, 운영 이력, 관리자 전용 정책/그룹/템플릿 schema.
- **공유 객체**: user/admin 양쪽에서 읽거나 쓰는 객체는 본 문서에 owner / writer / reader / RLS / migration home을 명시한다.
- **기존 v13 테이블 변경**: owner(v13) 승인 + migration decision record 필수. topik-ai에서의 v13 테이블 DDL 변경은 금지 유지.
- migration tracker 분리: `topik_writing_schema_migrations`(메타데이터·태그 전환), `admin_schema_migrations`(admin 운영·알림), v13 자체 migration 흐름(user-facing). 서로 혼입 금지.

## 2. 객체별 소유권 매트릭스

| 객체 | owner (migration home) | writer | reader | RLS 요약 |
| --- | --- | --- | --- | --- |
| `profiles` (notification_prefs 포함) | v13 | 본인(user), admin RPC | 본인, admin | self select/update, 보호 컬럼 트리거 |
| `get_admin_users` RPC | **topik-ai** (`admin_schema_migrations`, `supabase/migrations-admin`) | 없음(read RPC) | platform_admin | v13 `profiles`/`auth.users` 조인 + `writing_submissions` 집계, 성별/전화번호 표시값 반환. 신규 테이블 0건, v13 DDL 변경 없음 |
| `admin_set_user_status` RPC | **topik-ai** (`admin_schema_migrations`, `supabase/migrations-admin`) | platform_admin RPC | platform_admin | `profiles.status`만 `active`/`blocked`로 토글, `deleted` 차단. `protect_profile_columns` admin bypass 검증됨 |
| `notification_settings` | v13 | 본인(user) | 본인 | owner all (`user_id = auth.uid()`) |
| `notification_log` | v13 | (deprecated — 신규 쓰기 경로 없음) | 본인, platform_admin | owner select. **알림 기능 rev3부터 발송 이력 SoT 아님** (O-9) |
| `user_notifications` | v13 | service role(파이프라인 insert), 본인(`read_at`만 update), **예외: topik-ai `admin_invite_institution_members`의 inline insert(2026-07-07 결정 — 하단 기록)** | 본인 | owner select + read_at-only owner update |
| `institution_code_invitations` | **topik-ai** (`supabase/migrations-admin/20260707140000`) | admin RPC(invite/cancel) + 본인 respond RPC — 직접 클라이언트 쓰기 없음 | 본인(owner select — v13 수락/거부 모달), admin | RLS enable+force, select만(`user_id=auth.uid() or is_admin`), INSERT/UPDATE/DELETE 정책 없음 + revoke |
| 마케팅 수신 동의 저장소 (O-7 확정 시) | v13 | 본인 | 본인, 발송 파이프라인(service role) | owner |
| `notification_templates` | **topik-ai** (`admin_schema_migrations`) | admin RPC | admin, 발송 파이프라인(service role) | admin 전용 |
| `notification_groups` | **topik-ai** | admin RPC | admin, 발송 파이프라인 | admin 전용 |
| `notification_dispatches` | **topik-ai** | admin RPC, 발송 파이프라인(service role) | admin | admin 전용 |
| `notification_delivery_attempts` | **topik-ai** | 발송 파이프라인(service role) | **admin + 본인(owner select — v13 X-09 발송 이력 패널이 읽음)** | service write / owner select / admin select — **공유 객체 decision record: 2026-06-12, 실행계획안 rev3 §5.2·O-9** |
| `operation_notices` | **topik-ai** (`admin_schema_migrations`, `supabase/migrations-admin`) | admin RPC | admin | admin select only(`operation_notices_admin_select`, `private.is_admin`). INSERT/UPDATE/DELETE 정책 없음, 쓰기는 SECURITY DEFINER RPC 경유 |
| `operation_faqs` | **topik-ai** (`admin_schema_migrations`, `supabase/migrations-admin`) | admin RPC | admin | admin select only(`private.is_admin`). INSERT/UPDATE/DELETE 정책 없음, 쓰기는 SECURITY DEFINER RPC 경유 |
| `operation_faq_curations` | **topik-ai** (`admin_schema_migrations`, `supabase/migrations-admin`) | admin RPC | admin | admin select only(`private.is_admin`). INSERT/UPDATE/DELETE 정책 없음, 쓰기는 SECURITY DEFINER RPC 경유 |
| `operation_faq_metrics` | **topik-ai** (`admin_schema_migrations`, `supabase/migrations-admin`) | seed/read | admin | admin select only(`private.is_admin`). admin write RPC 없음, seed/read 전용 |
| `operation_events` | **topik-ai** (`admin_schema_migrations`, `supabase/migrations-admin`) | admin RPC | admin | admin select only(`private.is_admin`). INSERT/UPDATE/DELETE 정책 없음, 쓰기는 SECURITY DEFINER RPC 경유 |
| `operation_policies` | **topik-ai** (`admin_schema_migrations`, `supabase/migrations-admin`) | admin RPC | admin | admin select only(`private.is_admin`). RLS enable+force, 쓰기는 SECURITY DEFINER RPC 경유 |
| `operation_policy_histories` | **topik-ai** (`admin_schema_migrations`, `supabase/migrations-admin`) | admin RPC | admin | admin select only(`private.is_admin`). RLS enable+force, 정책 버전/이력 snapshot은 정책 RPC에서 append |
| `system_logs` | **topik-ai** (`admin_schema_migrations`, `supabase/migrations-admin`) | backend/infra service-role ingest(TBD), admin write none | admin | RLS enable+force, admin select only(`private.is_admin`). Read-only technical logs; no admin write policy/RPC |
| `admin_backup_runs`, `admin_backup_component_results`, `admin_restore_drills`, `admin_backup_report_events` | **topik-ai** (`admin_schema_migrations`, `supabase/migrations-admin`) | Vercel server의 service role 전용 보고 RPC | 권한 있는 admin은 읽기 RPC만 사용 | RLS enable+force. 브라우저 직접 테이블 접근과 쓰기 금지. 실행 90일, 복원 점검 13개월 보관. `topik-prod`는 운영 원본, `topik-dev`는 localhost 조회용 비민감 보고 복사본이며 실제 백업 대상은 `topik-prod`만 사용 |
| `record_admin_backup_report` RPC | **topik-ai** (`admin_schema_migrations`, `supabase/migrations-admin`) | service role | 없음 | 서명 검증을 통과한 Vercel 서버만 호출. 운영 원본/개발 복사본은 별도 비밀값과 고정 프로젝트를 사용하고, 중복 보고는 같은 결과만 허용하며 완료 결과 변경 차단 |
| `get_admin_backup_summary`, `get_admin_backup_runs` RPC | **topik-ai** (`admin_schema_migrations`, `supabase/migrations-admin`) | 없음 | active admin / `system.backups.read` 보유 admin | 조회 전용 최소 투영. 저장 경로·파일명·회원 정보·연결 정보·비밀값 미반환 |
| `admin_audit_logs` | **topik-ai** (admin 운영 감사 도메인) | admin RPC | admin | admin select. **소유권 정정(2026-06-17): v13 소유 아님 — admin 운영 감사 sink는 도메인 기준 topik-ai 소유. admin이 조회 인덱스·읽기 RPC 추가 가능(Phase 0 감사 화면 실연동 unblock)** |
| `topik_writing_*` | topik-ai (`topik_writing_schema_migrations`) | 기존 결정(D-1) | 기존 결정 | `metadata-tag-schema-transition-decision-record.md` §2 |
| `topik_writing_question_version_summary_view` | **topik-ai** (`topik_writing_schema_migrations`, `supabase/migrations`) | 없음(읽기 전용 뷰) | authenticated admin | `security_invoker=true`; 기반 `question_source_map`/`question_import` admin RLS 적용. `PUBLIC`·`anon` 권한 회수, `authenticated` 명시적 SELECT |
| `private.problem_identities`, `private.ensure_writing_problem_identity(uuid,text,smallint)` | **v13** (v13 user-facing migration) | v13 소유 함수만 write | topik-ai 승격 RPC는 함수 interface만 호출, 직접 table read 없음 | private registry. topik-ai는 직접 DDL/DML·FK를 만들지 않고 함수 부재·충돌 시 fail-closed |

## 3. 변경 절차

1. 새 객체 추가: owner repo의 migration home에 migration+down 작성 → 본 문서 §2에 행 추가 → 적용.
2. 공유 객체 reader/writer 변경: 양 repo 문서에 반영하고 본 문서의 decision record 칸에 일자·근거 기록.
3. v13 소유 테이블 DDL 변경: v13 오너 승인 + decision record 없이는 금지.

2026-07-16 admin public RPC 실행 권한 경계:
- topik-ai 소유 admin public 함수 inventory를 signature 단위로 고정하고 `20260716130000_admin_revoke_anon_rpc_execute.sql`에서 `anon` execute를 회수했다.
- `admin_approve_billing_refund`/`admin_reject_billing_refund`에 남아 있던 `PUBLIC` execute는 `20260716131000_admin_revoke_public_refund_rpc_execute.sql`에서 별도로 회수했다.
- 두 migration은 함수 본문, table/RLS, v13 소유 객체를 변경하지 않는다. `authenticated` 실행은 각 함수 내부의 `admin_accounts`/permission gate를 계속 통과해야 한다.
- dev와 production에 적용했으며 운영 검증에서 admin 소유 함수의 anonymous execute는 0건이다. 신규 admin SECURITY DEFINER 함수는 같은 revoke 계약과 down pair를 함께 추가해야 한다.

2026-07-16 TOPIK 쓰기 관리자 버전 이력 읽기 경계:
- `topik_writing_question_version_summary_view`는 topik-ai 소유 `question_source_map.canonical_import_id`와 `question_import.mapping_status='promoted'`만 결합하는 관리자 조회 전용 뷰다. 인박스 `is_latest`로 현재 버전을 추론하지 않고 `raw`·`held` 행을 집계하지 않는다.
- 뷰는 `security_invoker=true`로 실행되어 기반 테이블의 기존 admin RLS를 그대로 적용한다. `PUBLIC`·`anon` SELECT는 회수하고 `authenticated`에만 명시적으로 부여한다.
- v13 소유 테이블·함수·프론트엔드는 변경하지 않으며, 과거 버전 복원·재활성화 write 경계도 추가하지 않는다.

2026-07-16 TOPIK 쓰기 원본 수정 시각 판정 경계:
- `topik_writing_question_import.source_created_at/source_updated_at/content_hash/version_decision`과 판정·승격 RPC의 owner/migration home은 topik-ai `supabase/migrations`/`topik_writing_schema_migrations`다. v13 소유 초안·제출 테이블 DDL은 변경하지 않는다.
- current pointer writer는 계속 topik-ai `admin_promote_writing_questions`이며 `question_source_map.canonical_import_id`만 원자적으로 전환한다. 외부 `updated_at`과 인박스 `is_latest`는 current pointer가 아니다.
- v13은 기존 learner-safe canonical read, draft import/hash 충돌 가드, submission snapshot을 그대로 사용한다. 이번 변경의 v13 범위는 `metadata_only` 무영향·실제 승격 충돌·완료 제출 스냅샷 보존 교차 테스트뿐이다.
- 2026-07-16 공급 API 701건의 `updated_at`이 모두 null이므로 신규 마이그레이션은 dev/운영 미적용 상태다. 공급 계약 검증이 topik-ai DB 적용의 선행 게이트다.

2026-07-14 TOPIK 쓰기 learner identity registry 경계 교정:
- `private.problem_identities`와 `private.ensure_writing_problem_identity(uuid,text,smallint)`의 owner/migration home은 v13이다. Admin 소유 `topik_writing_question_source_map.learner_problem_id`는 그대로 유지하며, 승격 트랜잭션에서 v13 함수를 호출해 결정성 UUID·`question_id`·`item_number` 충돌을 검증한다.
- topik-ai가 v13 private table에 FK를 추가하면 양 tracker의 적용·rollback 순서가 결합되므로 의도적으로 추가하지 않는다. 직접 table read/write 대신 owner 함수 interface를 사용하고, 선행 함수가 없으면 `20260714150000` 마이그레이션이 중단된다.
- v13 교정 마이그레이션 `20260714140000`은 writing 관련 FK를 `private.problem_identities`로 이관하고, 기존 초안·제출에는 학습자 안전 필드만 담은 불변 `legacy_cutover_snapshot`을 백필한 뒤 `public.problems`의 writing 행을 삭제한다. 이후 과거 기록 조회도 mirror 행에 의존하지 않는다. v13 `20260714140000`과 Admin `20260714150000`, v13 CHECK 권한 교정 `20260714160000`은 dev DB에 적용했고 실제 FK·snapshot·mirror 삭제 대사와 cross-app headed browser를 통과했다. 운영 DB는 미적용이며 destructive down rehearsal은 아직 수행하지 않았다.

2026-06-17 `admin_audit_logs` 소유권 정정:
- 종전 §2 행은 `admin_audit_logs`를 v13 소유(2026-06-09 결정)로 기재했으나, 오너 결정(2026-06-17)으로 **도메인 기준 topik-ai(admin 운영) 소유**로 정정한다. admin 운영 조치의 감사 sink이므로 admin 도메인 자산이다.
- 영향: admin은 `admin_audit_logs`에 조회 인덱스(예: `(target_table, target_id)`, `created_at desc`)와 읽기 경로(admin select 정책 또는 `admin_list_audit_logs` 읽기 RPC)를 추가할 수 있다. 이는 **Phase 0 — `/system/audit-logs` 화면의 라이브 감사 로그 실연동**을 막던 v13 소유권 제약을 해소한다.
- 무변경 유지: 쓰기는 기존대로 admin RPC INSERT 단일 경로(diff/payload 기록). 기존 컬럼 계약(`admin_user_id, action, target_table, target_id, diff, payload, created_at`)은 그대로 둔다.

2026-06-17 Users 회원 목록 P0 결손 RPC 핫픽스 기록:
- 근거: `supabase/migrations-admin/20260617210000_admin_users_directory.sql` + `supabase/migrations-admin/down/20260617210000_admin_users_directory.sql`.
- 적용: `admin_schema_migrations` tracker 기준 2026-06-17 dev DB 적용 완료.
- 경계: 신규 테이블은 만들지 않는다. `profiles`, `auth.users`, `writing_submissions`는 v13 소유이며, `get_admin_users(search text, sort text, page integer, page_size integer, affiliation text default null)`가 platform_admin 전용 read RPC로 `profiles` + `auth.users` 조인과 `writing_submissions` 집계, `gender`, `phone_masked`, `total_count` window를 제공한다. 전화번호 원천은 v13의 `profiles.phone_country_code` + `profiles.phone_number`이며, dev에만 남아 있을 수 있는 `profiles.phone`은 JSON 호환 fallback으로만 읽는다. `admin_export_users`도 이 projection을 공유하며 v13 DDL을 변경하지 않는다.
- 쓰기 경계: `admin_set_user_status(target_id uuid, new_status text)`는 platform_admin 전용 write RPC이며 `new_status`는 `active`/`blocked`만 허용하고 `deleted` 사용자는 차단한다. v13 `profiles` DDL은 변경하지 않고 `profiles.status` 컬럼만 토글한다.
- 트리거/감사: `profiles.status` 토글은 `protect_profile_columns` 트리거의 admin `auth.uid()` bypass로 통과 검증됐다. 감사 로그는 `admin_audit_logs`에 `action='user_status_changed'`, `target_table='User'`, `target_id=userId`로 기록한다.

2026-06-17 Operation 공지사항 전환 기록:
- 근거: `supabase/migrations-admin/20260617120000_operation_notices.sql` + `supabase/migrations-admin/down/20260617120000_operation_notices.sql`.
- 적용: `admin_schema_migrations` tracker 기준 2026-06-17 dev DB 적용 완료.
- 경계: `operation_notices`는 topik-ai 소유 admin 운영 객체이며, admin은 select만 RLS 정책으로 읽고 쓰기는 admin RPC 3종(`admin_save_operation_notice`, `admin_toggle_operation_notice_status`, `admin_delete_operation_notice`) 단일 경로로 수행한다.

2026-06-17 Operation FAQ 전환 기록:
- 근거: `supabase/migrations-admin/20260617123000_operation_faqs.sql` + `supabase/migrations-admin/down/20260617123000_operation_faqs.sql`.
- 적용: `admin_schema_migrations` tracker 기준 2026-06-17 dev DB 적용 완료.
- 경계: `operation_faqs`, `operation_faq_curations`, `operation_faq_metrics`는 topik-ai 소유 admin 운영 객체다. admin은 3테이블을 select만 RLS 정책으로 읽고, FAQ 원문/큐레이션 쓰기는 admin RPC 5종(`admin_save_operation_faq`, `admin_toggle_operation_faq_status`, `admin_delete_operation_faq`, `admin_save_operation_faq_curation`, `admin_delete_operation_faq_curation`) 단일 경로로 수행한다. `operation_faq_metrics`는 admin write RPC가 없는 seed/read 전용 지표 스냅샷이다.

2026-06-17 Operation 이벤트 전환 기록:
- 근거: `supabase/migrations-admin/20260617152000_operation_events.sql` + `supabase/migrations-admin/down/20260617152000_operation_events.sql`.
- 적용: `admin_schema_migrations` tracker 기준 2026-06-17 dev DB 적용 완료.
- 경계: `operation_events`는 topik-ai 소유 admin 운영 객체다. admin은 select만 RLS 정책으로 읽고, 이벤트 저장/예약/게시/종료 쓰기는 admin RPC 4종(`admin_save_operation_event`, `admin_schedule_operation_event`, `admin_publish_operation_event`, `admin_end_operation_event`) 단일 경로로 수행한다.

2026-06-17 Operation 정책 관리 전환 기록:
- 근거: `supabase/migrations-admin/20260617170000_operation_policies.sql` + `supabase/migrations-admin/down/20260617170000_operation_policies.sql`.
- 적용: `admin_schema_migrations` tracker 기준 2026-06-17 dev DB 적용 완료.
- 경계: `operation_policies`, `operation_policy_histories`는 topik-ai 소유 admin 운영 객체다. admin은 select만 RLS 정책으로 읽고, 정책 저장/상태 변경/삭제/히스토리 버전 게시는 admin RPC 4종(`admin_save_operation_policy`, `admin_toggle_operation_policy_status`, `admin_delete_operation_policy`, `admin_publish_operation_policy_version`) 단일 경로로 수행한다.

## 4. 제정 근거

- 알림 기능 개발 실행계획안 rev3 §5.0 (2026-06-12). 종전 규칙("v13: admin-oriented schema 추가 금지" / "topik-ai: `topik_writing_*`만 소유")은 admin이 실데이터 계약을 갖기 시작하면서 도메인 기준 소유권으로 개정됐다.
- 개정 승인: 오너의 알림 기능 자율 실행 지시(2026-06-12 /goal) — 증적 `logs/notification-feature-evidence.md` WP0-1.

## 2026-06-17 Community 게시글/신고 Supabase 소유권 보강

| 객체 | owner (migration home) | writer | reader | RLS 요약 |
| --- | --- | --- | --- | --- |
| `community_posts` | **topik-ai** (`admin_schema_migrations`, `supabase/migrations-admin`) | admin RPC | admin | RLS enable+force, admin select only(`private.is_admin`). 직접 table write 경로 없음 |
| `community_post_admin_notes` | **topik-ai** (`admin_schema_migrations`, `supabase/migrations-admin`) | admin RPC | admin | RLS enable+force, admin select only(`private.is_admin`). `post_id`는 `community_posts(id)` ON DELETE CASCADE |
| `community_reports` | **topik-ai** (`admin_schema_migrations`, `supabase/migrations-admin`) | admin RPC | admin | RLS enable+force, admin select only(`private.is_admin`). 신고 종결은 RPC 단일 트랜잭션 |

- 근거: `supabase/migrations-admin/20260617173000_community.sql` + `supabase/migrations-admin/down/20260617173000_community.sql`.
- 적용: `admin_schema_migrations` tracker 기준 2026-06-17 dev DB 적용 완료.
- 쓰기 경계: SECURITY DEFINER admin RPC 5종(`admin_hide_community_post`, `admin_show_community_post`, `admin_delete_community_post`, `admin_add_community_post_memo`, `admin_resolve_community_report`)만 사용한다. 모든 조치 RPC는 admin 권한을 검사하고 운영 사유를 요구하며 `admin_audit_logs`에 기록한다.
- v13 경계: v13 소유 테이블 DDL은 변경하지 않는다. 신고 조치 `suspend_user`는 payload `user_suspend_integration=intent_only_v13_admin_set_user_status_pending`으로 의도만 기록하며 실제 사용자 정지는 v13 `admin_set_user_status` 연동 전까지 미연동 상태다.

## 2026-06-17 Commerce 포인트 Supabase 소유권 보강

| 객체 | owner (migration home) | writer | reader | RLS 요약 |
| --- | --- | --- | --- | --- |
| `commerce_point_policies` | **topik-ai** (`admin_schema_migrations`, `supabase/migrations-admin`) | admin RPC | admin | RLS enable+force, admin select only(`private.is_admin`). 직접 table write 경로 없음 |
| `commerce_point_ledgers` | **topik-ai** (`admin_schema_migrations`, `supabase/migrations-admin`) | admin RPC | admin | RLS enable+force, admin select only(`private.is_admin`). `user_id`는 v13 `profiles.id` 느슨참조이며 FK 없음 |
| `commerce_point_expirations` | **topik-ai** (`admin_schema_migrations`, `supabase/migrations-admin`) | admin RPC | admin | RLS enable+force, admin select only(`private.is_admin`). `user_id`는 v13 `profiles.id` 느슨참조이며 FK 없음 |

- 근거: `supabase/migrations-admin/20260617190000_commerce_points.sql` + `supabase/migrations-admin/down/20260617190000_commerce_points.sql`.
- 적용: `admin_schema_migrations` tracker 기준 2026-06-17 dev DB 적용 완료.
- 경계: `commerce_point_policies`, `commerce_point_ledgers`, `commerce_point_expirations`는 topik-ai 소유 admin 운영 객체이며, v13 소유 테이블 DDL은 변경하지 않는다. 회원 연결은 `user_id` text snapshot/느슨참조로 유지하고 FK를 두지 않는다.
- 쓰기 경로: SECURITY DEFINER admin RPC 5종(`admin_save_commerce_point_policy`, `admin_update_commerce_point_policy_status`, `admin_create_manual_point_adjustment`, `admin_hold_commerce_point_expiration`, `admin_release_commerce_point_expiration`)만 사용하며 모두 reason 필수와 `admin_audit_logs` 기록을 강제한다.

## 2026-06-17 Commerce 쿠폰 Supabase 소유권 보강

| Object | Owner | Write path | Read path | Boundary |
| --- | --- | --- | --- | --- |
| `commerce_coupons` | **topik-ai** (`admin_schema_migrations`, `supabase/migrations-admin`) | admin RPC | admin | RLS enable+force, admin select only(`private.is_admin`). 직접 table write 경로 없음. `target_user_ids`는 v13 `profiles.id` 느슨참조이며 FK 없음 |
| `commerce_coupon_subscription_templates` | **topik-ai** (`admin_schema_migrations`, `supabase/migrations-admin`) | admin RPC | admin | RLS enable+force, admin select only(`private.is_admin`). 정기 발급 스케줄은 `issue_schedule`/`usage_end_schedule` JSONB로 보관 |

- 마이그레이션: `supabase/migrations-admin/20260617193000_commerce_coupons.sql` 및 down migration.
- 적용: `admin_schema_migrations` tracker 기준 2026-06-17 dev DB 적용 완료.
- 연결 경로: SECURITY DEFINER admin RPC 7종(`admin_save_commerce_coupon`, `admin_duplicate_commerce_coupon`, `admin_set_commerce_coupon_issue_state`, `admin_delete_commerce_coupon`, `admin_save_commerce_coupon_template`, `admin_set_commerce_coupon_template_status`, `admin_delete_commerce_coupon_template`)만 사용하며 모두 reason 필수와 `admin_audit_logs` 기록을 강제한다.
- Target Type은 쿠폰 본체 `CommerceCoupon`, 정기 템플릿 `CommerceCouponTemplate`로 분리한다. 기존 v13 소유 테이블 DDL은 변경하지 않으며, 발급/사용 원장과 scope-ref/대상 그룹/알림 정규화는 후속 소유권 결정 대상으로 남긴다.
## 2026-06-17 Commerce 환불 Supabase 소유권 보강

| Object | Owner | Write path | Read path | Boundary |
| --- | --- | --- | --- | --- |
| `commerce_refunds` | **topik-ai** (`admin_schema_migrations`, `supabase/migrations-admin`) | admin RPC | admin | RLS enable+force, admin select only(`private.is_admin`). 직접 table write 경로 없음. `payment_id`/`user_id`는 v13 `payment_history`/사용자 식별자 느슨참조이며 FK 없음 |

- 마이그레이션: `supabase/migrations-admin/20260617203000_commerce_refunds.sql` 및 down migration.
- 적용: `admin_schema_migrations` tracker 기준 2026-06-17 dev DB 적용 완료.
- 연결 경계: `commerce_refunds`는 환불 처리 대기/승인/거절 워크플로 SoT만 소유한다. 실제 결제 환불 집행과 v13 `payment_history.status` 갱신은 v13 소유라 미연동이며, 승인 RPC payload에 `intent_only_v13_payment_history_pending=true`를 기록한다.
- 쓰기 경로: SECURITY DEFINER admin RPC 2종 `admin_approve_billing_refund`, `admin_reject_billing_refund`만 사용한다. 두 RPC 모두 reason 필수, `pending` 상태만 처리, 감사 Target Type `CommerceRefund`를 기록한다.
## 2026-06-17 System 메타데이터 그룹/항목 Supabase 소유권 보강

| Object | Owner | Write path | Read path | Boundary |
| --- | --- | --- | --- | --- |
| `system_metadata_groups` | **topik-ai** (`admin_schema_migrations`, `supabase/migrations-admin`) | admin RPC | admin | RLS enable+force, admin select only(`private.is_admin`). `group_id` = `META-GRP-NNN`, group metadata 16 columns + JSONB arrays. Direct table write path 없음 |
| `system_metadata_group_items` | **topik-ai** (`admin_schema_migrations`, `supabase/migrations-admin`) | admin RPC | admin | RLS enable+force, admin select only(`private.is_admin`). `group_id` FK -> `system_metadata_groups(group_id)` ON DELETE CASCADE, group-scoped code/label unique |

- 마이그레이션: `supabase/migrations-admin/20260617211000_system_metadata.sql` + `supabase/migrations-admin/down/20260617211000_system_metadata.sql`.
- 적용: `admin_schema_migrations` tracker 기준 2026-06-17 dev DB 적용 완료.
- 쓰기 경계: SECURITY DEFINER admin RPC 6종(`admin_save_metadata_group`, `admin_save_metadata_item`, `admin_toggle_metadata_group_status`, `admin_toggle_metadata_item_status`, `admin_delete_metadata_item`, `admin_reorder_metadata_items`)만 사용한다. 모든 RPC는 `reason` 필수다.
- 감사 경계: 모든 그룹/항목 조치는 `admin_audit_logs.target_table='SystemMetadataGroup'`, `target_id=groupId`로 기록한다. 항목 조치도 item-level Target Type을 만들지 않고 그룹 단위로 추적한다.

## 2026-06-17 System system_logs Supabase ownership update

| Object | Owner | Write path | Read path | Boundary |
| --- | --- | --- | --- | --- |
| `system_logs` | **topik-ai** (`admin_schema_migrations`, `supabase/migrations-admin`) | backend/infra service-role ingest(TBD), admin write none | admin | RLS enable+force, admin select only(`private.is_admin`). No admin write policy/RPC |

- Migration: `supabase/migrations-admin/20260617213000_system_logs.sql` + `supabase/migrations-admin/down/20260617213000_system_logs.sql`.
- Applied: `admin_schema_migrations` tracker, 2026-06-17 dev DB applied.
- Boundary: `system_logs` is a read-only technical log table for the admin System logs page. It is distinct from `admin_audit_logs` and unrelated to v13 `notification_log`.
- Open items: ingest source/actor, retention/partitioning, `trace_id` semantics, and whether level codes remain uppercase `INFO`/`WARN`/`ERROR`.

## 2026-06-18 System admin_audit_logs read path update

- Migration: `supabase/migrations-admin/20260618001000_admin_audit_logs_read.sql` + `supabase/migrations-admin/down/20260618001000_admin_audit_logs_read.sql`.
- Applied: `admin_schema_migrations` tracker, 2026-06-18 dev DB applied.
- Ownership/boundary: `admin_audit_logs` remains topik-ai owned admin audit sink. No new table, no column change, no RLS change, and no write-path change.
- Read indexes added: `admin_audit_logs_target_lookup_idx` on `(target_table, target_id)` and `admin_audit_logs_created_at_desc_idx` on `(created_at desc)`.
- Read path: `/system/audit-logs` reads through `admin_list_audit_logs(p_target_type, p_target_id, p_keyword, p_start, p_end, p_limit=100, p_offset=0)`, a read-only `SECURITY DEFINER` RPC guarded by `private.is_admin`.
- Actor resolution: the read RPC left joins `profiles` by `admin_user_id` and exposes `profiles.display_name` as `actor`, with uuid/system fallback.
- Write path remains existing admin RPC INSERTs from notices, FAQ, events, policies, community, commerce, users, and metadata domains.

## 2026-06-18 System 관리자 app_role 변경 RPC 소유권 보강

| Object | Owner | Write path | Read path | Boundary |
| --- | --- | --- | --- | --- |
| `profiles.app_role` (write) | **v13** (table/trigger) · 변경 RPC는 **topik-ai** 소유 | admin RPC `admin_set_admin_app_role` | admin RPC `admin_list_admin_app_roles` + `get_admin_users` | platform_admin 전용. v13 `profiles` DDL/트리거 무변경. `private.protect_profile_columns`의 `is_admin(caller)` 우회로 admin write 허용(`status` 토글 선례와 동일), dev DB 2026-06-18 검증. self-verify(`RETURNING`) write |

- 마이그레이션: `supabase/migrations-admin/20260618093000_admin_set_app_role.sql`(write RPC) + `supabase/migrations-admin/20260618094000_admin_list_admin_app_roles.sql`(admins-only read RPC), 각 down migration 포함.
- 적용: `admin_schema_migrations` tracker 기준 2026-06-18 dev DB 적용 완료. 신규 테이블 0, 신규 함수 2, 테이블/정책/RLS 변경 없음.
- 쓰기 경계: `admin_set_admin_app_role(p_target_user_id, p_new_app_role, p_reason)`는 platform_admin 전용, reason 필수, 자기/마지막 platform_admin 강등 차단. `profiles.app_role`만 갱신하고 세션은 다음 로그인 때 반영(토큰 미폐기).
- 감사 경계: `admin_audit_logs.target_table='AdminAccount'`, `action='admin_role_changed'`, `diff={app_role:{from,to}}`, `payload={reason,target_email,target_display,session_policy:'next_login'}`.
- 조회 경계: `admin_list_admin_app_roles(p_search)`는 platform_admin 전용으로 `app_role <> 'learner'`를 SQL에서 필터해 learner 페이지 잠식 없이 staff만 반환한다.

## 2026-06-18 System 감사 로그 diff/payload 노출 게이팅

- 결정(오너 2026-06-18): `admin_audit_logs.diff`/`payload`는 민감정보(회원 PII·정책 본문·환불/정지 사유 등)를 포함할 수 있어 **platform_admin에게만** 노출한다. content_admin/org_admin은 목록·필터·actor·`reason`은 보지만 diff/payload는 서버에서 NULL로 받는다(전송 단계 차단, 방어적 게이팅).
- 마이그레이션: `supabase/migrations-admin/20260618095000_audit_logs_diff_payload_platform_only.sql`(+down). 읽기 RPC `admin_list_audit_logs` CREATE OR REPLACE만, 테이블/RLS/쓰기 경로 무변경(함수 수 불변).
- 경계: `private.is_platform_admin(caller)`일 때만 diff/payload를 반환하고 payload 키워드 검색 분기도 허용한다. `reason`(payload->>'reason')은 전체 admin에게 유지. dev DB 검증 완료(platform=노출, content_admin=NULL·payload 검색 불가).
## 2026-06-18 Users 상세 학습 테이블 read 참조

| Object | Owner | Write path | Read path | Boundary |
| --- | --- | --- | --- | --- |
| `problem_attempts` | v13 | v13 learner/service flow | topik-ai admin RPC `get_admin_user_learning_overview(target_id)` | read-only aggregate/reference. No FK, trigger, policy, or column change from topik-ai. |
| `problems` | v13 / Assessment content owner boundary | v13/content flow | topik-ai admin RPC `get_admin_user_learning_overview(target_id)` | read-only join for domain/question metadata. `prompt` is not returned. |
| `writing_submissions` | v13 | v13 writing flow | topik-ai admin RPC `get_admin_user_learning_overview(target_id)` | read-only count/recent metadata. `answer_text` and `answer_json` are not returned. |
| `writing_feedback` | v13 | v13 writing feedback flow | topik-ai admin RPC `get_admin_user_learning_overview(target_id)` | read-only score/status metadata. |
| `feedback_dimension_scores` | v13 | v13 writing feedback flow | topik-ai admin RPC `get_admin_user_learning_overview(target_id)` | read-only weakness dimension aggregation. |
| `sentence_feedback` | v13 | v13 writing feedback flow | no topik-ai admin read in this feature | sentence-level PII/text feedback remains excluded. |
| `learning_goals` | v13 | v13 learner goal flow | topik-ai admin RPC `get_admin_user_learning_overview(target_id)` | read-only weak area aggregation. |

- Migration home: `supabase/migrations-admin/20260618120000_admin_user_learning_overview.sql` only creates/replaces a read RPC and its down pair. It creates no tables and changes no v13 DDL.
- Access gate: `private.is_platform_admin(auth.uid())`, `SECURITY DEFINER`, fixed `search_path`.
- Privacy decision: admin learning overview can show operational aggregates, scores, and weakness labels, but not answer body or sentence correction body.

## 2026-07-08 학습 데이터 수집(writing 재정의 + 학습 분석) read 참조 추가

| Object | Owner | Write path | Read path | Boundary |
| --- | --- | --- | --- | --- |
| `writing_submission_metrics` | v13 (신규, v13 마이그 `20260708113000`) | v13 학습자 브라우저 insert-once(RLS: 본인+본인 제출 검증) | topik-ai admin RPC `get_admin_user_learning_overview`, `get_admin_learning_analytics` | read-only aggregate. 숫자/id만 보유(원문 없음). topik-ai는 DDL 무변경. |
| `study_events` | v13 | v13 학습 이벤트 로거 | 위 RPC 2종(streak·열람률·활성 학습자 집계) + 기존 활동 탭 RPC | read-only. payload 본문은 반환하지 않음(집계만). |

- `get_admin_user_learning_overview`는 writing 중심으로 재정의(마이그 `20260708130000`) — 기존
  read 참조 표의 테이블 경계는 그대로 유지되고, `problem_attempts`는 objective 분리 블록 한정으로 축소.
- `get_admin_learning_analytics`(마이그 `20260708140000`)는 `private.is_admin` 순수 집계 RPC로
  개인 식별자(user_id/email 등)를 반환하지 않는다.
- v13 소유 신규 테이블(`writing_submission_metrics`)의 DDL/RLS는 v13 repo 마이그레이션이 SoT이며
  topik-ai는 읽기 집계만 한다(도입 배경·오너 결정은 admin-data-contract 2026-07-08 절).

### 2026-07-10 학습 분석 필터 확장 read 경계

| Object | Owner | Write path | Read path | Boundary |
| --- | --- | --- | --- | --- |
| `writing_submissions`, `writing_feedback`, `feedback_dimension_scores`, `writing_submission_metrics` | v13 | v13 writing flow | `get_admin_learning_analytics_filtered` | read-only aggregate. 답안·문장 첨삭 본문과 개인 식별자 미반환. |
| `study_events` | v13 | v13 telemetry | `get_admin_learning_analytics_filtered` | 귀속 가능한 학습 이벤트와 `export_downloaded` 집계만 사용. payload 원문 미반환. |
| `topik_writing_question_source_map`, `topik_writing_question_recommendation_view` 및 기반 `topik_writing_51/52/53/54_questions` | topik_writing domain (this repo) | topik_writing migration/ETL | `get_admin_learning_analytics_filtered`, `get_admin_learning_analytics_filter_options` | 문제 유형·주제·세부 특성 read-only 참조. 기존 v13 테이블 DDL 무변경. |
| `topik_writing_problem_aliases`, `topik_writing_problem_question_map` | topik_writing domain (this repo) | topik_writing migration + exact-match reconciliation ETL | `get_admin_learning_analytics_filtered` | 환경 재시드로 달라진 현재 `problems.id`를 canonical question에 추가 연결한다. 기존 source map 재바인딩과 v13 `problems` DDL/DML은 금지하며, 수동 `held` 별칭은 별도 승인 없이 재활성화하지 않는다. |

- 두 신규 admin RPC의 migration home은 `supabase/migrations-admin/`와 같은 이름의 `down/` 파일이며 tracker는 `admin_schema_migrations`다.
- `private.is_admin()` + `SECURITY DEFINER` read-only 경계를 사용하고, topik_writing 객체의 소유권이나 쓰기 경로를 admin Analytics로 이전하지 않는다.
- 별칭 edge는 자체 `mapping_status`/`hold_reason`을 가지며 역사 source-map hold를 상속하거나 덮어쓰지 않는다. 적용 전후 보호 데이터 hash, 1 problem→1 question, 고아 별칭, 필수 메타데이터 coverage를 별도 gate로 검증한다.

## 2026-07-07 기관 초대(동의 기반 소속 배정) 경계 기록

- 기능: 관리자 '회원 추가/배정'을 즉시 배정에서 **pending 초대**로 전환. 사용자가 v13 알림
  모달에서 수락해야 `profiles.affiliation_code` 적용. 마이그레이션
  `20260707140000_institution_invitations.sql` + `20260707141000_institution_invitation_respond.sql`.
- **`user_notifications` inline insert 예외**: v13 마이그 주석("파이프라인 전용 insert")과 달리
  `admin_invite_institution_members`(SECURITY DEFINER, owner postgres)가 초대 인앱 알림 행을
  직접 insert한다. 사유: (1) per-user payload(`invitation_id`)가 필요하나 v13 그룹 디스패처는
  per-user payload를 전달할 수 없음, (2) transactional 강제 이메일 attempt를 함께 적재해야 함.
  v13 DDL/RLS/트리거 변경 없음. 오너 승인: 2026-07-07 구현 계획 승인에 포함.
- **`profiles.affiliation_code` 사용자 동의 쓰기**: `respond_institution_invitation`은 호출자가
  비관리자(학습자)라 `protect_profile_columns`의 admin bypass가 적용되지 않는다. v13이 공식
  제공하는 트랜잭션 GUC `app.claim_affiliation_code='1'`(v13 20260619140000, claim/accept 경로)을
  세팅 후 UPDATE + RETURNING self-verify. v13이 플래그명을 바꾸면 조용한 실패 대신 42501로
  즉시 실패한다. boundary allowlist: `check-migration-ownership-boundary.mjs`
  `ALLOWED_PROFILE_WRITE_FILES`에 20260707141000(affiliation_code 한정) 등록.
- v13 `accept_affiliation_invite(p_code,p_confirmed)`(QR 가입용, 기존 소속 있으면 전환 거부)는
  변경하지 않고 공존한다. 초대 수락은 별도 RPC(`respond_institution_invitation`)이며 기존 타기관
  소속을 **덮어쓴다**(관리자 '소속 변경' 유스케이스, prev_code 감사·반환).
- v13 사용자 화면 계약: `docs/requests/v13-institution-invitation-handoff-2026-07-07.md`.

## 2026-07-07 PDF 내보내기 쿼터 소유권 기록

| 객체 | owner (migration home) | writer | reader | RLS 요약 |
| --- | --- | --- | --- | --- |
| `pdf_export_quota_policies` | **v13** (`supabase/migrations/20260707120000_pdf_export_quota.sql`, v13 CLI tracker) | topik-ai admin RPC(정책 저장 — Phase 3) | 사용자(활성 정책만), admin | RLS enable+force. select는 `is_active or is_platform_admin`, 쓰기 정책은 `is_platform_admin` ALL만 |
| `pdf_export_quota_usages` | **v13** (동일 migration) | v13 RPC 단일 경로(claim/commit/release) — admin 직접 쓰기 없음 | 본인(reserved 제외), platform_admin | RLS enable+force. owner select(`status <> 'reserved'`) + platform_admin select. INSERT/UPDATE/DELETE 정책 없음 |
| `pdf_export_quota_resets` | **v13** (동일 migration) | topik-ai admin RPC(리셋 생성 — Phase 3). 수정/삭제 금지, 보상 리셋만 | 본인 대상/global, platform_admin | RLS enable+force. 쓰기 정책은 `is_platform_admin` ALL만 |
| `pdf_export_quota_reset_targets` | **v13** (동일 migration) | topik-ai admin RPC(개인/그룹/전체 대상 실체화 — Phase 3) | 본인, platform_admin | RLS enable+force. 쓰기 정책은 `is_platform_admin` ALL만 |
| `claim_pdf_export_quota(uuid, uuid[])` RPC | **v13** | v13 사용자 라우트(`/api/export/pdf`, `/api/export/pdf/print`) | — | SECURITY DEFINER, `authenticated` grant, `p_user_id = auth.uid()` 강제 |
| `commit_pdf_export_quota` / `release_pdf_export_quota` RPC | **v13** | v13 서버(service role) 전용 | — | `authenticated`/`anon` revoke, `service_role` grant만. topik-ai에서 호출 금지 |

- 근거: v13 `supabase/migrations/20260707120000_pdf_export_quota.sql` + 같은 이름의 down migration, v13 handoff 사본 `docs/requests/v13-pdf-export-quota-handoff-2026-07-07.md`.
- 적용: 2026-07-07 dev DB(talkpik-dev) 적용 완료. 적용 수단은 topik-ai `scripts/db/run-sql.mjs`(Management API)이며, v13 CLI tracker 정합을 위해 `supabase_migrations.schema_migrations`에 `20260707120000` repair 행을 함께 삽입했다(v13에는 원격 적용 수단이 없어 topik-ai 러너를 사용 — 오너 승인 2026-07-07).
- 소유권 경계: 쿼터 4테이블 + RPC 3종의 DDL은 **v13 소유**다. topik-ai는 DDL을 변경하지 않고, 관리(정책 저장, 리셋 생성)와 조회는 Phase 3의 topik-ai 소유 admin RPC(`admin_schema_migrations`)로만 수행한다. usages 원장에는 admin 쓰기 경로를 만들지 않는다.
- 의미론 주의: 활성 정책 해석은 `priority asc, created_at desc limit 1`(낮은 priority 우선). 리셋은 생성된 주기 안에서만 유효(period-local)하며 다음 주기 선예약 불가. 개인/그룹/전체 초기화는 생성 시점에 concrete `reset_targets.user_id` 행으로 실체화한다. `period_unit` 변경 시 기존 usages의 주기 경계 불일치로 사실상 전체 카운트 리셋 효과가 난다.

2026-07-08 정책 관리 "단일 설정 + 변경 이력" 전환 기록:
- 근거: `supabase/migrations-admin/20260708150000_pdf_quota_policy_settings.sql` + down. 오너 결정 2026-07-08.
- 배경: 구 `admin_save_pdf_quota_policy(uuid,...,boolean,...)`는 활성/비활성 토글 기반이라 정책 교체 중 무정책 공백(전 사용자 내보내기 500)이 생길 수 있었다. 구 시그니처는 명시적으로 drop.
- 신 계약: `admin_save_pdf_quota_policy(p_limit_count,p_period_unit,p_period_timezone,p_reason,p_expected_updated_at)`는 항상 현재 `subject_scope='user' and resource_scope='problem'` 정책 1행을 갱신/복구(자기치유 — advisory lock 직렬화, 활성 행 없으면 최신 행 복구, 0행이면 생성, 같은 scope의 중복 활성만 일괄 비활성 후 `deactivated_ids` 감사 기록)한다. `limit_count = 0`은 의도적 내보내기 중단(v13은 429). 비활성화 단독 경로 없음.
- 이력 read: `get_admin_pdf_quota_policy_history`가 `admin_audit_logs(pdf_quota_policy_saved)`에서 감사 id, KST 시각, 비민감 화이트리스트 필드만 `operation.pdf-quota.manage` 권한자에게 반환(2026-06-18 diff/payload 게이팅의 action 한정 범위 예외).
- 개인 초기화 대상 검색: `search_admin_pdf_quota_reset_users(p_search,p_page,p_page_size)`는 `get_admin_users`의 platform_admin 게이트와 분리해 `operation.pdf-quota.manage` 권한자에게 최소 회원 필드와 서버 페이지네이션만 제공한다.
- DML 정리: `subject_scope='user' and resource_scope='problem'` 범위에서 usages가 참조하지 않는 비활성 정책 행만 마이그레이션에서 삭제(FK NO ACTION 회피, down으로 복원 불가). 다른 policy scope는 비활성화/삭제하지 않는다.
- v13 무변경: DDL·claim·commit/release 계약 그대로. platform_admin 직접 테이블 쓰기로 활성 행이 0이 되는 admin 화면 밖 경로는 여전히 fail-closed(500) — v13 claim 폴백 하드닝은 후속 제안.
