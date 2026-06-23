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
| `get_admin_users` RPC | **topik-ai** (`admin_schema_migrations`, `supabase/migrations-admin`) | 없음(read RPC) | platform_admin | v13 `profiles`/`auth.users` 조인 + `writing_submissions` 집계. 신규 테이블 0건, v13 DDL 변경 없음 |
| `admin_set_user_status` RPC | **topik-ai** (`admin_schema_migrations`, `supabase/migrations-admin`) | platform_admin RPC | platform_admin | `profiles.status`만 `active`/`blocked`로 토글, `deleted` 차단. `protect_profile_columns` admin bypass 검증됨 |
| `notification_settings` | v13 | 본인(user) | 본인 | owner all (`user_id = auth.uid()`) |
| `notification_log` | v13 | (deprecated — 신규 쓰기 경로 없음) | 본인, platform_admin | owner select. **알림 기능 rev3부터 발송 이력 SoT 아님** (O-9) |
| `user_notifications` | v13 | service role(파이프라인 insert), 본인(`read_at`만 update) | 본인 | owner select + read_at-only owner update |
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
| `admin_audit_logs` | **topik-ai** (admin 운영 감사 도메인) | admin RPC | admin | admin select. **소유권 정정(2026-06-17): v13 소유 아님 — admin 운영 감사 sink는 도메인 기준 topik-ai 소유. admin이 조회 인덱스·읽기 RPC 추가 가능(Phase 0 감사 화면 실연동 unblock)** |
| `topik_writing_*` | topik-ai (`topik_writing_schema_migrations`) | 기존 결정(D-1) | 기존 결정 | `metadata-tag-schema-transition-decision-record.md` §2 |

## 3. 변경 절차

1. 새 객체 추가: owner repo의 migration home에 migration+down 작성 → 본 문서 §2에 행 추가 → 적용.
2. 공유 객체 reader/writer 변경: 양 repo 문서에 반영하고 본 문서의 decision record 칸에 일자·근거 기록.
3. v13 소유 테이블 DDL 변경: v13 오너 승인 + decision record 없이는 금지.

2026-06-17 `admin_audit_logs` 소유권 정정:
- 종전 §2 행은 `admin_audit_logs`를 v13 소유(2026-06-09 결정)로 기재했으나, 오너 결정(2026-06-17)으로 **도메인 기준 topik-ai(admin 운영) 소유**로 정정한다. admin 운영 조치의 감사 sink이므로 admin 도메인 자산이다.
- 영향: admin은 `admin_audit_logs`에 조회 인덱스(예: `(target_table, target_id)`, `created_at desc`)와 읽기 경로(admin select 정책 또는 `admin_list_audit_logs` 읽기 RPC)를 추가할 수 있다. 이는 **Phase 0 — `/system/audit-logs` 화면의 라이브 감사 로그 실연동**을 막던 v13 소유권 제약을 해소한다.
- 무변경 유지: 쓰기는 기존대로 admin RPC INSERT 단일 경로(diff/payload 기록). 기존 컬럼 계약(`admin_user_id, action, target_table, target_id, diff, payload, created_at`)은 그대로 둔다.

2026-06-17 Users 회원 목록 P0 결손 RPC 핫픽스 기록:
- 근거: `supabase/migrations-admin/20260617210000_admin_users_directory.sql` + `supabase/migrations-admin/down/20260617210000_admin_users_directory.sql`.
- 적용: `admin_schema_migrations` tracker 기준 2026-06-17 dev DB 적용 완료.
- 경계: 신규 테이블은 만들지 않는다. `profiles`, `auth.users`, `writing_submissions`는 v13 소유이며, `get_admin_users(search text, sort text, page integer, page_size integer)`가 platform_admin 전용 read RPC로 `profiles` + `auth.users` 조인과 `writing_submissions` 집계, `total_count` window를 제공한다.
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
