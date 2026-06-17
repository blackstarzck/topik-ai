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
| `admin_audit_logs` | v13 (2026-06-09 기존 결정) | admin RPC | admin | 기존 결정 유지 |
| `topik_writing_*` | topik-ai (`topik_writing_schema_migrations`) | 기존 결정(D-1) | 기존 결정 | `metadata-tag-schema-transition-decision-record.md` §2 |

## 3. 변경 절차

1. 새 객체 추가: owner repo의 migration home에 migration+down 작성 → 본 문서 §2에 행 추가 → 적용.
2. 공유 객체 reader/writer 변경: 양 repo 문서에 반영하고 본 문서의 decision record 칸에 일자·근거 기록.
3. v13 소유 테이블 DDL 변경: v13 오너 승인 + decision record 없이는 금지.

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
