# Migrations Index — 연/월/일 트리

본 문서는 `supabase/migrations/` 의 SQL 파일을 **연 → 월 → 일** 트리 구조로 정리한 시각적 인덱스입니다.

실제 SQL 파일은 **Supabase CLI 호환을 위해 `supabase/migrations/` 디렉토리 바로 아래에 flat 으로 위치**합니다 (CLI는 하위 폴더 SQL을 스캔하지 않음). 본 문서는 가독성을 위한 메타 정리입니다.

명명 규칙·idempotency·CLI 적용 명령은 [`../README.md`](../README.md) 참조.
테이블 컬럼·RLS·RPC의 실행 가능한 정본은 timestamp 순으로 재생한 migration SQL 본문이다. 사람이 읽는 도메인·보안 계약은 `docs/supabase/`를 함께 참조한다.

---

## 2026

### 05 — May

#### 20 (화) — Tier 1 MVP 초기 스키마 + 보강 round-2

##### Round 1 · Tier 1 MVP 초기 스키마 (12개)

| # | timestamp | 파일 | 영역 |
| ---:| --- | --- | --- |
| 1 | `12:00:00` | [`20260520120000_extensions_and_schemas.sql`](./20260520120000_extensions_and_schemas.sql) | `pgcrypto`, `citext`, `private` schema |
| 2 | `12:01:00` | [`20260520120100_profiles_goals.sql`](./20260520120100_profiles_goals.sql) | `profiles`, `learning_goals` |
| 3 | `12:02:00` | [`20260520120200_problems.sql`](./20260520120200_problems.sql) | `problems`, `problem_assets` |
| 4 | `12:03:00` | [`20260520120300_attempts.sql`](./20260520120300_attempts.sql) | `problem_attempts` |
| 5 | `12:04:00` | [`20260520120400_writing.sql`](./20260520120400_writing.sql) | `writing_drafts`, `writing_submissions` |
| 6 | `12:05:00` | [`20260520120500_feedback.sql`](./20260520120500_feedback.sql) | `writing_feedback`, `feedback_dimension_scores`, `sentence_feedback`, `comparison_reports` |
| 7 | `12:06:00` | [`20260520120600_recommendations.sql`](./20260520120600_recommendations.sql) | `recommendation_runs`, `recommendation_items` |
| 8 | `12:07:00` | [`20260520120700_library_events_exports.sql`](./20260520120700_library_events_exports.sql) | `library_items`, `study_events`, `export_files` |
| 9 | `12:08:00` | [`20260520120800_audit.sql`](./20260520120800_audit.sql) | `admin_audit_logs` |
| 10 | `12:09:00` | [`20260520120900_functions.sql`](./20260520120900_functions.sql) | `private.is_admin`, `touch_updated_at`, `supersede_active_draft` |
| 11 | `12:10:00` | [`20260520121000_triggers.sql`](./20260520121000_triggers.sql) | `updated_at` autoupdate, draft 승격 |
| 12 | `12:11:00` | [`20260520121100_rls_policies.sql`](./20260520121100_rls_policies.sql) | 17 테이블 RLS enable + force + 정책 |

##### Round 2 · 마이그레이션 보강 (4개)

| # | timestamp | 파일 | 영역 |
| ---:| --- | --- | --- |
| 13 | `12:12:00` | [`20260520121200_storage_buckets.sql`](./20260520121200_storage_buckets.sql) | `avatars`, `problem-assets`, `generated-exports` buckets |
| 14 | `12:13:00` | [`20260520121300_storage_policies.sql`](./20260520121300_storage_policies.sql) | `storage.objects` RLS 정책 9개 |
| 15 | `12:14:00` | [`20260520121400_profiles_protected_columns.sql`](./20260520121400_profiles_protected_columns.sql) | `app_role`/`plan_label`/`status` 변경 차단 트리거 |
| 16 | `12:15:00` | [`20260520121500_submission_status_function.sql`](./20260520121500_submission_status_function.sql) | `feedback_status` 상태 머신 (service_role 전용) |

근거 ledger: 동일 ledger의 `Round-2 (마이그레이션 보강)` 섹션

#### 21 (수) — Phase 2 auth bootstrap trigger + Phase 5 writing RPC + Phase 6 hardening

| # | timestamp | 파일 | 영역 |
| ---:| --- | --- | --- |
| 17 | `12:00:00` | [`20260521120000_auth_user_profile_bootstrap.sql`](./20260521120000_auth_user_profile_bootstrap.sql) | `auth.users → public.profiles` INSERT 트리거 (`121100:46` 주석의 self-inconsistency 해소) |
| 18 | `13:00:00` | [`20260521130000_phase_5_writing_rpc.sql`](./20260521130000_phase_5_writing_rpc.sql) | Phase 5 SECURITY DEFINER RPC: `submit_writing_with_feedback`, `create_comparison_report_with_metrics` |
| 19 | `14:00:00` | [`20260521140000_phase_6_rpc_and_admin.sql`](./20260521140000_phase_6_rpc_and_admin.sql) | Phase 6: admin role helpers (`is_platform_admin/is_content_admin/is_org_admin`) + profile policy narrowing + writing_submissions explicit deny + `assert_submission_payload` validator + library/export/event ownership-strict RLS + `get_dashboard_kpi` + `admin_change_user_role` + `admin_toggle_problem_publish` + `submit_writing_with_feedback` validator hookup + `get_admin_org_dashboard` |
| 20 | `14:10:00` | [`20260521141000_phase_6_notification_prefs.sql`](./20260521141000_phase_6_notification_prefs.sql) | Phase 6: `profiles.notification_prefs jsonb not null default '{}' + object check` |

#### 26 (화) — Phase 7 profile bio + Phase 8 cleanup 함수

| # | timestamp | 파일 | 영역 |
| ---:| --- | --- | --- |
| 21 | `17:00:00` | [`20260526170000_phase_7_profile_bio.sql`](./20260526170000_phase_7_profile_bio.sql) | Phase 7: `profiles.bio` column |
| 22 | `18:00:00` | [`20260526180000_cleanup_unconfirmed_users.sql`](./20260526180000_cleanup_unconfirmed_users.sql) | Phase 8: `private.cleanup_unconfirmed_users(retention_days, dry_run, max_batch)` SECURITY DEFINER 함수 (storage.objects + auth.users 정리, profiles는 FK CASCADE). pg_cron 자동 스케줄은 23번 마이그레이션에서 별도 등록 |

#### 27 (수) — Phase 8 follow-up · pg_cron 자동 스케줄 + Storage hardening

| # | timestamp | 파일 | 영역 |
| ---:| --- | --- | --- |
| 23 | `11:00:00` | [`20260527110000_register_cleanup_cron.sql`](./20260527110000_register_cleanup_cron.sql) | Phase 8 follow-up: `cleanup_unconfirmed_users` pg_cron job (매일 04:00 UTC, idempotent unschedule-then-register). jobname은 원격에 이미 등록된 이름과 일치(2026-05-27 사용자 Dashboard 조회로 확인). pg_cron extension 미설치 환경에서는 fail 없이 skip (raise notice). v1 보고서 자체 검수(Codex GPT-5)에서 22번 마이그레이션의 cron 자동 스케줄 주장이 실제 미등록임을 적발 후 source-of-truth 통합 |
| 24 | `11:30:00` | [`20260527113000_storage_email_confirmed_hardening.sql`](./20260527113000_storage_email_confirmed_hardening.sql) | Phase 8 follow-up P1: `private.is_email_confirmed(uid)` SECURITY DEFINER helper + storage.objects RLS 정책 강화(avatars/exports owner_insert/update에 email_confirmed_at IS NOT NULL 조건 추가). 이메일 미인증 사용자의 파일 업로드 차단 |
| 25 | `14:00:00` | [`20260527140000_cleanup_retention_floor.sql`](./20260527140000_cleanup_retention_floor.sql) | Phase 8 follow-up v2.3 P0: `private.cleanup_unconfirmed_users` 재정의 — retention_days < 30 + dry_run=false 시 raise exception. dry_run preview는 허용. v1 "30일 미만 절대 안 건드림" 주장의 코드 정공법 보호 (Codex 검수 적발 후 fix). 권한 revoke 재선언 포함 |

근거 ledger:
- 22-25: Phase 8 v2.x 자체 검수 정정 + follow-up. (구현 보고서는 2026-06-05 워크플로우 하네스 정리 때 함께 삭제됨 — 마이그레이션 22~25 파일 본문 참조.)

### 06 — June

#### 02 (화) — Conformance: billing / notifications / settings / admin RPC + 조직(net-new)

> ⚠ 본 5개 마이그레이션은 **작성만 완료** 상태이며 coordinator 검토·적용 전입니다. 특히 26번(`org.sql`)은 Tier 1 MVP 스키마에 없던 **net-new scope**라 적용 전 IA 스펙 대조 확인 필요.

| # | timestamp | 파일 | 영역 |
| ---:| --- | --- | --- |
| 26 | `12:00:00` | [`20260602120000_handle_new_user_display_name.sql`](./20260602120000_handle_new_user_display_name.sql) | `handle_new_user()` 재정의 — `profiles.display_name` 를 `raw_user_meta_data->>'display_name'` (nullif empty) 로 시드. 트리거 바인딩 idempotent 재선언 |
| 27 | `12:01:00` | [`20260602120100_billing.sql`](./20260602120100_billing.sql) | `subscription_plans`(public read), `subscriptions`(owner read + platform_admin read), `payment_history`(owner read) + RLS + updated_at 트리거 + 예시 플랜 3종 seed (월/분기/연, KRW placeholder, `__seed` 태그) |
| 28 | `12:02:00` | [`20260602120200_notifications_and_settings.sql`](./20260602120200_notifications_and_settings.sql) | `notification_settings`(owner-all), `notification_log`(owner read) + `profiles.learning_locale`/`profiles.content_prefs` 컬럼(G-01). 기존 `notification_prefs` 3-boolean 유지 |
| 29 | `12:03:00` | [`20260602120300_org.sql`](./20260602120300_org.sql) | **NET-NEW**: `organizations`, `org_members`, `assignments`, `assignment_submissions` + `private.is_org_member/is_org_manager` 헬퍼 + org-scoped RLS (X-08/X-10) |
| 30 | `12:04:00` | [`20260602120400_admin_and_user_rpcs.sql`](./20260602120400_admin_and_user_rpcs.sql) | Admin RPC: `get_admin_users`, `get_admin_user_stats`, `admin_set_user_status`, `admin_update_problem`, `admin_delete_problem`, `admin_add_problem_asset`, `admin_remove_problem_asset`, `get_admin_audit_logs` + `get_admin_org_dashboard` 확장(drop→recreate, 4→6 컬럼 additive) + `list_user_problems`(C-02, SECURITY INVOKER) |

#### 08 (월) — Conformance decisions #2/#4 backing schema (✅ 2026-06-09 적용 완료)

> ✅ **적용 완료(2026-06-09)**: 31·32는 라이브 dev DB에 적용됨. 적용 당시 31(legal)이 누락돼 있던 것을 발견해 함께 적용했고, `schema_migrations`도 백필. wireframe-db-conformance 결정 #2·#4 확정에 따른 사용자 화면 backing 스키마. 둘 다 admin 소유 공유 영역(`admin-data-contract` 이름 정합은 LATER admin-build 단계). 원문 run artifact는 2026-06-16 문서 정리로 제거했고, durable conclusion은 이 문단과 migration 설명에 보존한다.

| # | timestamp | 파일 | 영역 |
| ---:| --- | --- | --- |
| 31 | `12:00:00` | [`20260608120000_legal_documents_and_consents.sql`](./20260608120000_legal_documents_and_consents.sql) | `legal_documents`(버전별 약관/개인정보, published 공개 read + admin all), `user_consents`(per-user 동의 ledger, append-only owner read+insert) + RLS + updated_at 트리거. 약관 동의 영속화(#2=B). admin `operation_policies`/`requiresConsent` 의미 매핑 |
| 32 | `12:01:00` | [`20260608120100_problems_lifecycle_expiry.sql`](./20260608120100_problems_lifecycle_expiry.sql) | `problems` additive 컬럼: `lifecycle_status`(active/inactive/expired, C-02 배지·행 비활성), `lifecycle_reason`(사유), `expires_at`(문제 전용 만료, `recommendation_runs.expires_at`와 분리) + 부분 인덱스. 만료 *기준* 미정 → 컬럼만, 자동만료 로직 없음(#4) |

#### 08 (월) — Wireframe writing problem fixture seed (DB 적용 완료)

| # | timestamp | 파일 | 영역 |
| ---:| --- | --- | --- |
| 33 | `12:02:00` | [`20260608120200_seed_writing_problem_fixtures.sql`](./20260608120200_seed_writing_problem_fixtures.sql) | Wireframe 08~11 JSON 기반 `problems` seed 466개. `materials.seed_source='wireframe_problem_fixtures'` + `source_file` + `source_item_id`로 중복 방지. 검수 통과분은 published/public/approved, 미통과분은 draft/private/pending. 스키마 변경 없음. |

#### 08 (월) — Admin integration Phase C: 문제은행 정합 컬럼 + 감사 메모 (✅ 적용 완료)

> Admin(topik-ai) 쓰기 문제은행 정합. GPT-5.5 교차검토 D-B/D-C 결정 반영. 둘 다 additive·idempotent, PROPOSED(코드 확정 전 CHECK 없음). 2026-06-09 적용 확인. 삭제된 planning artifact의 durable conclusion은 이 문단과 migration 설명에 보존한다.

| # | timestamp | 파일 | 영역 |
| ---:| --- | --- | --- |
| 35 | `12:03:00` | [`20260608120300_problems_topic_category_review_workflow.sql`](./20260608120300_problems_topic_category_review_workflow.sql) | `problems` additive 컬럼 `topic_category_code`(D-B: 주제 분류, `domain` 영역과 구분) + `review_workflow_status`(D-C: 진행 검수단계, `review_status` 최종결과와 분리) + `admin_update_problem` allowlist 13키 확장. nullable·CHECK 없음(PROPOSED). |
| 36 | `12:04:00` | [`20260608120400_admin_update_problem_audit_note.sql`](./20260608120400_admin_update_problem_audit_note.sql) | `admin_update_problem` create-or-replace: 예약 patch 키 `__note`(컬럼 아님)를 추출해 `admin_audit_logs.payload`에 `{"review_note":...}`로 기록. 시그니처 불변, 기존 동작 보존. 검수 사유/메모의 감사 보관. |

#### 09 (화) — User problem list writing state RPC (✅ 적용 완료)

| # | timestamp | 파일 | 영역 |
| ---:| --- | --- | --- |
| 34 | `12:00:00` | [`20260609120000_list_user_problems_writing_state.sql`](./20260609120000_list_user_problems_writing_state.sql) | `list_user_problems` 재정의. 사용자 문제 목록에서 쓰기 진행 상태를 `writing_drafts`/`writing_submissions` 기준으로 계산하고 `solve_state`, `latest_submission_id`, feedback/lifecycle/publish/review 상태를 additive 반환한다. `published` 문제만 노출하고 lifecycle 비활성/만료는 행 비활성 근거로 반환한다. |

#### 09 (화) — v13 admin 섬 제거 (✅ 적용 완료, 소유자 결정)

> 문제는 외부 API에서 **검수 완료** 상태로 수급 → v13은 노출제어(공개/비공개+만료)만. v13 admin CRUD/검수/사용자·조직 관리 불필요 → 코드 + DB 동반 제거. 보존: `app_role`·`admin_audit_logs`·`private.is_*_admin`. durable conclusion은 AGENTS의 관리자 범위 경계와 이 migration 설명에 보존한다.

| # | timestamp | 파일 | 영역 |
| ---:| --- | --- | --- |
| 37 | `13:00:00` | [`20260609130000_remove_v13_admin_island.sql`](./20260609130000_remove_v13_admin_island.sql) | admin RPC 11개(`admin_update_problem`·`delete`·`add/remove_problem_asset`·`toggle_problem_publish`·`change_user_role`·`set_user_status`·`get_admin_users`·`get_admin_user_stats`·`get_admin_audit_logs`·`get_admin_org_dashboard`) drop + org 테이블 4개(`organizations`·`org_members`·`assignments`·`assignment_submissions`) drop(cascade) + org 헬퍼 2개(`private.is_org_member`·`is_org_manager`) drop. **보존**: `app_role`·`admin_audit_logs`·`is_*_admin`. forward-only·idempotent. |

#### 10 (수) — Google OAuth 약관 게이트 seed (작성 완료)

| # | timestamp | 파일 | 영역 |
| ---:| --- | --- | --- |
| 38 | `10:40:17` | [`20260610104017_seed_initial_legal_documents.sql`](./20260610104017_seed_initial_legal_documents.sql) | `/auth/consent`가 참조할 `terms`/`privacy` published placeholder 문서를 `ko/en/vi` 로케일별 seed. 스키마 변경 없음. `on conflict (doc_type, version, locale) do nothing`으로 idempotent. |

#### 12 (금) — 알림 기능: 인앱 수신함 (notification WP0-4)

| # | timestamp | 파일 | 영역 |
| ---:| --- | --- | --- |
| 39 | `16:00:00` | [`20260612160000_user_notifications.sql`](./20260612160000_user_notifications.sql) | `user_notifications` 인앱 수신함(벨 뱃지/알림센터/B-01 카드). owner select + `read_at` 단일 컬럼 grant update, insert/delete는 service_role 파이프라인 전용. `delivery_attempt_id`는 topik-ai 소유 `notification_delivery_attempts` soft 참조(FK 없음 — 소유권 계약). |
| 40 | `18:00:00` | [`20260612180000_notification_dispatcher.sql`](./20260612180000_notification_dispatcher.sql) | 역사적 replay-safe no-op. dispatcher migration home은 topik-ai `supabase/migrations-admin/20260723011242_notification_pipeline_ownership_transfer.sql`로 이관됐다. |
| 41 | `18:01:00` | [`20260612180100_register_notification_cron.sql`](./20260612180100_register_notification_cron.sql) | 역사적 replay-safe no-op. `dispatch_notifications` cron은 topik-ai admin migration이 소유한다. |
| 42 | `19:00:00` | [`20260612190000_notification_email_pipeline.sql`](./20260612190000_notification_email_pipeline.sql) | 역사적 replay-safe no-op. `notification_email_config`와 이메일 파이프라인은 topik-ai admin migration이 소유한다. |
| 43 | `19:01:00` | [`20260612190100_email_transport_fail_user.sql`](./20260612190100_email_transport_fail_user.sql) | 역사적 replay-safe no-op. fail-user 최종 정의는 topik-ai forward migration에 포함된다. |
| 44 | `19:02:00` | [`20260612190200_email_live_defer.sql`](./20260612190200_email_live_defer.sql) | 역사적 replay-safe no-op. live defer 최종 정의는 topik-ai forward migration에 포함된다. |
| 45 | `20:00:00` | [`20260612200000_user_marketing_consent.sql`](./20260612200000_user_marketing_consent.sql) | H-2 마케팅 동의 저장소. `user_marketing_consent`(가산형, profiles 미변경): `consented_at`/`unsubscribed_at`/`unsubscribe_token uuid unique`/`source`. 유효 동의 = `consented_at not null AND unsubscribed_at null`. owner select/insert/update RLS + force, service_role read. |
| 46 | `20:01:00` | [`20260612200100_marketing_consent_in_dispatch.sql`](./20260612200100_marketing_consent_in_dispatch.sql) | 역사적 replay-safe no-op. H-2 consent gate 함수는 topik-ai forward migration이 소유하며, v13은 `user_marketing_consent` 테이블 owner로 남는다. |
| 47 | `22:10:00` | [`20260612221000_fix_legal_documents_public_read_policy.sql`](./20260612221000_fix_legal_documents_public_read_policy.sql) | `legal_documents_published_read` 정책에서 공개 published read와 `private.is_platform_admin()` admin helper를 분리. anon 공개 약관 조회가 helper 실행 권한 오류(42501)로 실패하지 않도록 `status='published'`만 평가. |

#### 17 (Writing submission visibility guard)

| # | timestamp | 파일 | 영역 |
| ---:| --- | --- | --- |
| 48 | `05:50:40` | [`20260617055040_guard_writing_submission_problem_visibility.sql`](./20260617055040_guard_writing_submission_problem_visibility.sql) | Adds `private.assert_writing_problem_submittable` and redefines `submit_writing_with_feedback` so writing submissions are inserted only for `writing` problems that are `published`, `public`, `active`, and match the submitted question number. |
| 49 | `18:30:00` | [`20260617183000_list_user_problems_recommended_sort.sql`](./20260617183000_list_user_problems_recommended_sort.sql) | Redefines `list_user_problems` with C-02 `recommended` filtering through active recommendation rows and exact UI sort semantics for newest, oldest, difficulty ascending, and difficulty descending. |
| 50 | `21:30:00` | [`20260617213000_required_random_nickname.sql`](./20260617213000_required_random_nickname.sql) | Requires new profiles to receive a non-identifying default nickname (`talkpik-...`) during auth bootstrap, backfills blank existing nicknames, and retries random nickname generation on unique collisions. Does not derive nickname from email or provider metadata. |
| 51 | `21:40:00` | [`20260617214000_nickname_availability_rpc.sql`](./20260617214000_nickname_availability_rpc.sql) | Adds `public.is_nickname_available(candidate text)` as a SECURITY DEFINER RPC so the profile UI can check nickname availability without exposing other users' profile rows through RLS. |
| 52 | `14:30:00` | [`20260618143000_external_writing_submission_sync.sql`](./20260618143000_external_writing_submission_sync.sql) | Adds service-role-only RPCs for external Writing API submission records and feedback sync while keeping direct `writing_submissions` inserts denied. |
| 53 | `14:00:00` | [`20260619140000_profiles_affiliation_code.sql`](./20260619140000_profiles_affiliation_code.sql) | Adds nullable `profiles.affiliation_code`, validates Auth metadata before seeding it in `handle_new_user()`, blocks normal profile edits to the column through `private.protect_profile_columns()`, and exposes authenticated one-shot `claim_affiliation_code(p_code)` for OAuth sign-up bridging. |
| 54 | `15:00:00` | [`20260619150000_writing_submission_draft_dedup.sql`](./20260619150000_writing_submission_draft_dedup.sql) | Adds partial unique index `writing_submissions_draft_active_unique (draft_id) where draft_id is not null and feedback_status <> 'failed'` and makes `create_external_writing_submission` idempotent per draft (select-before-insert + `unique_violation` catch-and-reselect) to prevent duplicate submissions from multi-tab / network-retry / double-click. Re-attempts (new `draft_id`) and failed retries stay allowed. Renames the function's local `draft_id` to `v_draft_id` to avoid a column/variable name collision. No RLS change. |

#### 22 (월) — 회원 탈퇴 소프트 삭제 (self-service 계정 삭제)

> 사용자 앱의 계정 탈퇴 소프트 삭제와 30일 복구 유예를 추가했다. 하드 삭제 cron, Storage 파기와 복구 RPC는 이 migration에 포함하지 않는다. 실제 계약은 SQL 본문과 `docs/supabase/security-and-ownership.md`를 따른다.

| # | timestamp | 파일 | 영역 |
| ---:| --- | --- | --- |
| 55 | `12:00:00` | [`20260622120000_account_deletion_soft_delete.sql`](./20260622120000_account_deletion_soft_delete.sql) | `profiles.deleted_at` 컬럼 추가 + `private.protect_profile_columns()` 보완(본인 `active→deleted` 단방향 예외, 그 외 status 변경·역방향 복구는 계속 admin 전용 차단) + `public.request_account_deletion()` SECURITY DEFINER RPC(호출자 본인 status=deleted·deleted_at=now(), 멱등, anon revoke·authenticated grant). admin_audit_logs 기록은 의도적 생략(admin_user_id ON DELETE RESTRICT → self-audit가 향후 하드삭제를 막는 함정). |
| 56 | `15:40:00` | [`20260622154000_archive_seed_writing_fixtures.sql`](./20260622154000_archive_seed_writing_fixtures.sql) | Wireframe seed writing fixtures(`tags`의 `seed:wireframe_problem_fixtures` 또는 `materials.seed_source`)를 물리 삭제하지 않고 `published/active` 사용자 문제 풀에서 제외하기 위해 `publish_status=archived`, `lifecycle_status=inactive`으로 전환한다. 기존 제출/초안 FK와 진단 가능성은 보존한다. |

---

## 새 마이그레이션을 추가할 때

1. **timestamp 결정**: 현재 시각 KST를 `YYYYMMDDHHMMSS` 형식으로. 예) 2026-06-05 09:30:00 → `20260605093000`.
2. **파일 작성**: `supabase/migrations/<timestamp>_<짧은_설명>.sql` 로 flat 위치에 둠. 하위 폴더 만들지 말 것 — Supabase CLI가 못 본다.
3. **본 INDEX.md 갱신**: 해당 날짜 섹션에 표 한 줄 추가. 새 연/월/일이면 트리 헤더 (`### 06`, `#### 05`) 부터 추가.
4. **`supabase/README.md`** 의 요약 정보가 영향받으면 같이 갱신.
5. `docs/supabase/`의 사람용 계약과 필요한 경우 `README.md`/`AGENTS.md`의 경계 규칙도 같이 갱신.

## 빠른 검증 체크리스트

- [ ] timestamp 가 기존 마지막 파일보다 큰가?
- [ ] 파일명에 한글·공백·대문자 없는가? (소문자 + snake_case)
- [ ] SQL이 idempotent (`if not exists`, `or replace`, `drop ... if exists`)?
- [ ] FK 참조 테이블이 이전 timestamp 파일에 존재하는가?
- [ ] RLS-적용 대상이라면 RLS enable + force + 정책이 같은 또는 후속 마이그레이션에 있는가?
- [ ] INDEX.md / `docs/supabase/` / 관련 source·tests / 필요시 README.md 또는 AGENTS.md 중 영향받는 owner를 모두 갱신했는가?
## 2026-06-23 추가 migration

| # | timestamp | file | scope |
| ---:| --- | --- | --- |
| 57 | `10:30:00` | [`20260623103000_auth_completion_gate.sql`](./20260623103000_auth_completion_gate.sql) | Expands `/auth/consent` into a single auth completion gate by adding `public.complete_auth_gate(...)`, restoring the final `handle_new_user()` definition to seed `display_name`, `nationality_country_code`, `affiliation_code`, and `nickname`, and backfilling blank nicknames to `talkpik-*`. |

## 2026-06-25 추가 migration

| # | timestamp | file | scope |
| ---:| --- | --- | --- |
| 58 | `00:12:57` | [`20260625001257_restrict_auth_completion_gate_anon.sql`](./20260625001257_restrict_auth_completion_gate_anon.sql) | Removes explicit `anon` execute permission from `public.complete_auth_gate(text,text,text,boolean)` after remote grant drift, while preserving authenticated execution for the `/auth/consent` completion gate. |
| 59 | `11:30:00` | [`20260625113000_auto_locale_detection.sql`](./20260625113000_auto_locale_detection.sql) | Adds `profiles.ui_locale_source` provenance (`legacy/default/auto/manual`) and updates `handle_new_user()` to seed validated UI locale metadata without persisting raw request language hints. Also introduces the locale-aware `complete_auth_gate(text,text,text,boolean,text,text)` overload (granted to `authenticated`, PUBLIC revoked; no explicit anon revoke). NOTE: this overload was later superseded by the 7/9-arg gender/phone overloads (72/74) but not dropped there; migration #76 (`20260710093000`) drops it to close the anon grant-drift window. |
| 60 | `12:00:00` | [`20260625120000_feedback_language_dimension.sql`](./20260625120000_feedback_language_dimension.sql) | Adds `language` to `feedback_dimension_scores.dimension` and the `private.assert_submission_payload` dimension validator so external feedback sync can persist backend-normalized language trait scores. |
| 61 | `15:30:00` | [`20260625153000_auto_submission_library_item.sql`](./20260625153000_auto_submission_library_item.sql) | Adds `private.ensure_submission_library_item(uuid, uuid)` and redefines `public.create_external_writing_submission(jsonb)` so backend-created writing submissions are idempotently saved to F-01 `library_items` when inserted or when draft dedup returns an existing submission. |

## 2026-06-26 migration

| # | timestamp | file | scope |
| ---:| --- | --- | --- |
| 62 | `11:00:00` | [`20260626110000_writing_institution_visibility_predicate.sql`](./20260626110000_writing_institution_visibility_predicate.sql) | Adds institution-scoped writing problem visibility helpers and applies them to `list_user_problems` and `private.assert_writing_problem_submittable` so mapping absence remains public and mapping presence requires matching `profiles.affiliation_code`. |

## 2026-06-29 migration

| # | timestamp | file | scope |
| ---:| --- | --- | --- |
| 63 | `11:00:00` | [`20260629110000_institution_assigned_only_writing_access.sql`](./20260629110000_institution_assigned_only_writing_access.sql) | Redefines writing visibility as institution assigned-only for institution users and unmapped-public only for non-institution users. Superseded for non-institution access by `20260629170000_non_institution_writing_full_exposure.sql`. |
| 64 | `12:00:00` | [`20260629120000_auth_email_verified_access_gate.sql`](./20260629120000_auth_email_verified_access_gate.sql) | Adds an email-confirmed guard to `public.complete_auth_gate(...)` and `user_consents_owner_insert` so `profiles.status='active'` alone cannot create signup completion consent records. |
| 65 | `15:30:00` | [`20260629153000_enforce_same_problem_comparison.sql`](./20260629153000_enforce_same_problem_comparison.sql) | Enforces R-01 comparison reports as same-problem comparisons: RPC and table trigger reject different `problem_id` submissions while allowing `previous_submission_id` to be null. |
| 66 | `17:00:00` | [`20260629170000_non_institution_writing_full_exposure.sql`](./20260629170000_non_institution_writing_full_exposure.sql) | Restores non-institution users to the full writing problem pool while preserving institution assigned-only visibility through `profiles.affiliation_code`. |

## 2026-07-01 migration

| # | timestamp | file | scope |
| ---:| --- | --- | --- |
| 67 | `14:00:00` | [`20260701140000_accept_affiliation_invite.sql`](./20260701140000_accept_affiliation_invite.sql) | Adds confirmed one-shot `public.accept_affiliation_invite(p_code,p_confirmed)` for user-approved institution invite acceptance, keeps legacy `claim_affiliation_code` as a deprecated wrapper, and prevents automatic switching from another institution code. |
| 68 | `16:00:00` | [`20260701160000_institution_retry_availability.sql`](./20260701160000_institution_retry_availability.sql) | Redefines saved writing problem retry availability so `list_user_library_problem_items()` follows `is_writing_problem_visible_to_caller`; institution-hidden saved problems remain in the ledger but expose no retry action. |

## 2026-07-07 migration

| # | timestamp | file | scope |
| ---:| --- | --- | --- |
| 69 | `12:00:00` | [`20260707120000_pdf_export_quota.sql`](./20260707120000_pdf_export_quota.sql) | Adds DB-backed PDF export quota policy, usage, reset, and reset-target ledgers plus SECURITY DEFINER RPCs for atomic per-user/per-problem claim, commit, and release. Seeds the default 3-per-month Asia/Seoul policy and keeps admin management for topik-ai. |

## 2026-07-08 migration

| # | timestamp | file | scope |
| ---:| --- | --- | --- |
| 70 | `11:30:00` | [`20260708113000_writing_submission_metrics.sql`](./20260708113000_writing_submission_metrics.sql) | Adds immutable per-submission writing solve-time metrics for topik-ai learning analytics while keeping answer content out of the metric row and avoiding `problem_attempts` for writing. |

## 2026-07-09 migration

| # | timestamp | file | scope |
| ---:| --- | --- | --- |
| 71 | `12:00:00` | [`20260709120000_dashboard_kpi_writing_source.sql`](./20260709120000_dashboard_kpi_writing_source.sql) | Redefines `public.get_dashboard_kpi()` so dashboard/growth submission counts use `writing_submissions` and streak uses `study_events` KST learning days, preserving the existing RPC return contract. |
| 72 | `15:30:00` | [`20260709153000_profiles_optional_gender_phone.sql`](./20260709153000_profiles_optional_gender_phone.sql) | Adds nullable `profiles.gender`, `profiles.phone_country_code`, and `profiles.phone_number`, seeds them from email signup Auth metadata, and adds new `complete_auth_gate` overloads so `/auth/consent` can save the optional fields without making them signup requirements. |
| 73 | `15:40:00` | [`20260709154000_profiles_phone_prompt_dismissed.sql`](./20260709154000_profiles_phone_prompt_dismissed.sql) | Adds nullable `profiles.phone_number_prompt_dismissed_at` timestamp so the non-blocking workspace phone-number reminder banner can be permanently dismissed per account. New rows default to NULL (not dismissed); no backfill or RLS/trigger change needed. |
| 74 | `16:50:00` | [`20260709165000_profiles_split_phone_country_code.sql`](./20260709165000_profiles_split_phone_country_code.sql) | Follows up the optional phone profile migration for already-applied environments by adding `profiles.phone_country_code`, replacing the optional auth-gate RPC overloads with split phone country/local-number parameters, and restating `handle_new_user()` split phone metadata seeding. |
| 75 | `17:00:00` | [`20260709170000_library_problem_answer_preview.sql`](./20260709170000_library_problem_answer_preview.sql) | Redefines `public.list_user_library_problem_items()` so available bookmarked problem rows can include the caller's latest active draft/submission `answer_text` preview while preserving the existing availability and metadata privacy gates. |

## 2026-07-10 migration

| # | timestamp | file | scope |
| ---:| --- | --- | --- |
| 76 | `09:30:00` | [`20260710093000_revoke_anon_superseded_auth_gate.sql`](./20260710093000_revoke_anon_superseded_auth_gate.sql) | Hardens anon EXECUTE grant drift on two authenticated-only SECURITY DEFINER RPCs: drops the superseded locale-aware `complete_auth_gate(text,text,text,boolean,text,text)` overload (created by #59, never dropped by 72/74; unreachable — app calls only 7/9-arg, delegation chain 9→7→4-arg base) which removes its anon grant, and revokes `anon` EXECUTE on `list_user_library_problem_items()` (#75 revoked PUBLIC only). Forward-only, idempotent; both functions already reject unauthenticated callers, so this is defense-in-depth. Remote apply is handled by the separate ops procedure (not applied from v13). |
| 77 | `09:40:00` | [`20260710094000_auth_gate_trusted_consent_docs.sql`](./20260710094000_auth_gate_trusted_consent_docs.sql) | Fixes a consent desync: the base `complete_auth_gate(text,text,text,boolean)` overload selected required consent docs with only `status='published' AND requires_consent` and, unlike the app layer (`fetchRequiredConsentDocuments` trust filter `source_policy_id`/`is_placeholder`), could pick a newer UNTRUSTED published row as `latest per doc_type` and record consent against it while post-auth checks the trusted row → permanent /auth/consent bounce. Adds the same trust filter to all four doc-selection subqueries (count + insert × localized + ko-fallback). create-or-replace preserves other logic; re-asserts authenticated-only grant. Remote apply via ops (not from v13). |
| 78 | `09:50:00` | [`20260710095000_profiles_country_code_iso_check.sql`](./20260710095000_profiles_country_code_iso_check.sql) | Adds IMMUTABLE `public.is_supported_country_code(text)` over the 249-code ISO 3166-1 alpha-2 set (mirrors `src/lib/geo/country-codes.ts` ISO_COUNTRY_CODES, derived from country-flag-icons@1.6.17) and re-points both `profiles_phone_country_code_check` and `profiles_nationality_country_code_format` at it. `phone_country_code` is tightened from the loose `^[A-Z]{2}$` shape check to the ISO set; `nationality_country_code` keeps the exact same accepted set (249 == 249, verified identical to the prior 20260617195000 inline array and to the app list) but is now single-sourced via the function. RPC/trigger phone regex left unchanged on purpose (the CHECK is the authoritative backstop, and re-creating the base `complete_auth_gate(text,text,text,boolean)` would risk regressing the 20260710094000 trusted-consent filter). Dev data already valid (nationality ISO, phone NULL) so no backfill; NOT VALID → VALIDATE, forward-only, idempotent. Remote apply via the ops procedure (not from v13). |

## 2026-07-13 migration

> Migrations 79-83 record the first canonical-read cutover. They are applied to the dev project only and are superseded by the 2026-07-14 identity-registry corrective migration. Production remains unchanged.

| # | timestamp | file | scope |
| ---:| --- | --- | --- |
| 79 | `08:00:15` | [`20260713080015_writing_problem_identity_anchor.sql`](./20260713080015_writing_problem_identity_anchor.sql) | Adds the service-role-only writing identity anchor and requires the learner UUID to equal `md5(question_id)::uuid`; provenance-only `legacy_problem_id` is not accepted as a learner identifier. |
| 80 | `08:15:59` | [`20260713081559_writing_question_version_snapshot.sql`](./20260713081559_writing_question_version_snapshot.sql) | Pins the canonical question/import/hash and learner-safe snapshot on drafts and submissions, including an atomic stale-draft supersede-and-copy path. |
| 81 | `08:30:00` | [`20260713083000_writing_canonical_read_security_gate.sql`](./20260713083000_writing_canonical_read_security_gate.sql) | Introduces the initial canonical reader, runtime control, fail-closed submission gate, and draft reconciliation evidence. The later identity-registry migration removes its legacy/shadow read modes. |
| 82 | `08:40:00` | [`20260713084000_writing_cutover_serialization_guard.sql`](./20260713084000_writing_cutover_serialization_guard.sql) | Serializes the initial runtime and mirror-Cron transition and requires fresh reconciliation evidence before cutover mutations. |
| 83 | `08:45:00` | [`20260713084500_retire_writing_problem_mirror_cron.sql`](./20260713084500_retire_writing_problem_mirror_cron.sql) | Retires only `sync-writing-problems`, snapshots its definition, rejects an in-flight target run, and leaves unrelated Cron jobs unchanged. The target job is absent in dev. |

## 2026-07-14 migration

> Migrations 84-86 plus the Admin-owned bridge migration `20260714150000` are applied to the dev project. Migration 85 was applied from the Admin operations surface, exercised through a down/up rehearsal, and verified by operations-owned live fault injection plus a real provider Q54 canary. The canary was fail-closed afterward, so dev remains `blocked + unverified` until an explicit service-resume operation selects the recorded evidence. Production remains unchanged.

| # | timestamp | file | scope |
| ---:| --- | --- | --- |
| 84 | `14:00:00` | [`20260714140000_writing_problem_identity_registry_cutover.sql`](./20260714140000_writing_problem_identity_registry_cutover.sql) | Replaces `public.problems` writing anchors with the private immutable `problem_identities` registry, preserves learner-safe history snapshots and rollback backups, retargets every audited FK with validation, removes writing catalog rows after proof gates, and makes canonical reads permanent while submissions stay fail-closed. |
| 85 | `14:10:00` | [`20260714141000_writing_submission_outbox.sql`](./20260714141000_writing_submission_outbox.sql) | Adds a private durable submission intent/outbox with one-shot claims, explicit accepted/ambiguous/failed states, separate provider submission IDs, retry-safe accepted materialization, redacted service-only reconciliation/audit RPCs, and an independently verified evidence gate for enabling canonical submission. Installation alone never enables submission. |
| 86 | `16:00:00` | [`20260714160000_writing_snapshot_constraint_execution_fix.sql`](./20260714160000_writing_snapshot_constraint_execution_fix.sql) | Grants authenticated and service-role writers execute permission on the immutable, table-free forbidden-key classifier used by writing snapshot CHECK constraints. Anonymous execution remains denied; the fix changes no data and exposes no snapshot constructor. |

## 2026-07-18 migration

| # | timestamp | file | scope |
| ---:| --- | --- | --- |
| 87 | `12:00:00` | [`20260718120000_auth_gate_exact_consent_snapshots.sql`](./20260718120000_auth_gate_exact_consent_snapshots.sql) | Adds snapshot-aware `complete_auth_gate` overloads that lock the official legal-document set, compare the exact displayed `{id, version}` array inside the transaction, and insert only the captured missing rows. Restores the email-confirmed guard, rejects ambiguous/incomplete official sets, grants only the new JSONB signatures to `authenticated`, and revokes `PUBLIC`/`anon`/`authenticated` access from the unsafe boolean-only 4/7/9-argument overloads. Forward-only; remote apply and production evidence remain topik-ai operations work. |

## 2026-07-22 migration

| # | timestamp | file | scope |
| ---:| --- | --- | --- |
| 88 | `12:00:00` | [`20260722120000_writing_completion_and_pdf_outcomes.sql`](./20260722120000_writing_completion_and_pdf_outcomes.sql) | Defines learner completion as a submission and linked feedback both reaching `complete`, separates materialized attempt counts from completed counts in `list_user_problems`, aligns dashboard KPI counts, and adds sanitized terminal `failure_code`/`failed_at` fields to the PDF export ledger. Forward-only; v13 does not apply it remotely. |

## 2026-07-23 migration

| # | timestamp | file | scope |
| ---:| --- | --- | --- |
| 89 | `17:00:00` | [`20260723170000_system_reports.sql`](./20260723170000_system_reports.sql) | Adds a private, direct-access-denied system report ledger and a service-role-only idempotent submission RPC. Stores only approved contact, report, coarse diagnostics, optional authenticated user, and shortened app-version fields. |
| 90 | `23:45:27` | [`20260723234527_consent_account_deletion_rls.sql`](./20260723234527_consent_account_deletion_rls.sql) | Makes `complete_auth_gate()` the only `user_consents` writer; adds active-profile restrictive policies to private user rows and quota reset targets; preserves published-public problem/asset reads while closing private catalog paths; guards seven authenticated `SECURITY DEFINER` user-data RPCs while preserving the active-user library list contract, and revokes the stale legacy submit RPC; makes profile lifecycle columns RPC-only through column privileges plus trigger context; adds `get_my_account_state()`; and makes `avatars` private with active-owner Storage policies shared by avatars and generated exports. Forward-only; remote apply is handled by the separate operations procedure, not v13. |

## 2026-07-24 migration

| # | timestamp | file | scope |
| ---:| --- | --- | --- |
| 91 | `12:00:00` | [`20260724120000_user_data_reference_integrity.sql`](./20260724120000_user_data_reference_integrity.sql) | Keeps learner CRUD on publishable key + user JWT + owner RLS while narrowing authenticated UPDATE to the app's current state columns, preserving explicit system-job privileges, and adding an invoker trigger that rejects malformed, duplicate, or foreign `review_set_created` library item IDs. `problem-assets` remains unchanged for a separate private/signed-URL cross-app plan. |
| 92 | `13:00:00` | [`20260724130000_institution_invite_trust_boundary.sql`](./20260724130000_institution_invite_trust_boundary.sql) | Stops `handle_new_user()` from trusting raw `affiliation_code` Auth metadata, revokes and drops the legacy `accept_affiliation_invite`/`claim_affiliation_code` browser RPCs, and preserves the transaction-local profile protection gate used by the topik-ai-owned JWT invitation response flow. Forward-only; v13 does not apply it remotely. |
| 93 | `14:00:00` | [`20260724140000_pdf_export_request_idempotency.sql`](./20260724140000_pdf_export_request_idempotency.sql) | Adds a JWT-only atomic export-attempt acquisition RPC with active-user/source-ownership checks, strict bounded route-option validation, exportable submission/report library-target binding, DB-generated attempt leases, and same-request payload binding; removes authenticated direct INSERT/UPDATE/DELETE on `export_files`; requires a matching acquired export before quota binding; and adds service-only atomic current-attempt complete/fail functions. The cutover closes legacy NULL-request queued exports as `failed/legacy_unknown` and releases legacy reservations with `request_identity_cutover` before backfill. Remote rollout requires the linked topik-ai maintenance handoff; v13 does not apply it remotely. |

## 2026-07-29 migration

| # | timestamp | file | scope |
| ---:| --- | --- | --- |
| 94 | `12:00:00` | [`20260729120000_list_user_problems_canonical_catalog_fix.sql`](./20260729120000_list_user_problems_canonical_catalog_fix.sql) | Repairs the `list_user_problems` catalog CTE. Migration 88 was authored on top of the pre-cutover definition from `20260713083000` and calls `private.is_writing_canonical_read_enabled()` and `private.is_canonical_writing_problem_anchor(uuid)` in three places, both of which `20260714140000` dropped. PL/pgSQL resolves names at call time, so migration 88 installs cleanly and then raises `42883` on every problem-list request. This migration restores the post-cutover catalog CTE that `20260714140000` established: `public.problems` contributes non-writing rows only, and the canonical writing branch reads `public.get_available_writing_questions(null, null)` unconditionally. Signature, the 24 returned fields, completion versus attempt counts, sort tie-breaker, and grants are unchanged. A closing `do` block reads `pg_get_functiondef` and fails the transaction if either retired helper survives or the canonical reader is missing. Forward-only, no paired down; remote apply is topik-ai operations work and must run in the same transaction as migration 88 so the broken definition is never committed. |
