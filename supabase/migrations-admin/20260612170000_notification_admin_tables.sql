-- =====================================================================
-- topik-ai admin · 알림 기능 WP0-5 · admin-0001
-- admin 운영 4테이블: templates / groups / dispatches / delivery_attempts
--
-- 계약 SoT: docs/specs/notification-contract.md
-- 소유권:   docs/architecture/shared-supabase-schema-ownership.md
--           (tracker: admin_schema_migrations — topik_writing와 분리)
-- RLS 모델: 읽기 = admin(private.is_admin), 쓰기 = 정책 없음(RPC 단일 경로,
--           파이프라인은 service_role). 예외: delivery_attempts는 본인 행
--           owner select 허용(v13 X-09 발송 이력 패널이 읽음 — 공유 계약).
-- DB enum은 ASCII로 저장하고 UI 한글 표기는 코드에서 매핑한다.
-- down: supabase/migrations-admin/down/20260612170000_notification_admin_tables.sql
-- =====================================================================

-- ---------------------------------------------------------------------
-- notification_templates : 템플릿 원본 (channel별 변형 — unique(template_key, channel))
-- ---------------------------------------------------------------------
create table if not exists public.notification_templates (
  id               uuid primary key default gen_random_uuid(),
  template_key     text not null,
  channel          text not null,
  class            text not null,
  mandatory        boolean not null default false,
  mode             text not null,
  category         text not null,
  name             text not null,
  summary          text not null default '',
  subject          text not null default '',
  body_html        text not null default '',
  body_json        jsonb,
  variables        jsonb not null default '[]'::jsonb,
  trigger_key      text,
  target_group_ids jsonb not null default '[]'::jsonb,
  status           text not null default 'draft',
  last_sent_at     timestamptz,
  updated_by       uuid,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  unique (template_key, channel)
);

alter table public.notification_templates
  drop constraint if exists notification_templates_channel_check;
alter table public.notification_templates
  add constraint notification_templates_channel_check
  check (channel in ('in_app','email','push','zalo'));

alter table public.notification_templates
  drop constraint if exists notification_templates_class_check;
alter table public.notification_templates
  add constraint notification_templates_class_check
  check (class in ('transactional','operational','learning','marketing'));

-- marketing은 mandatory(선호 우회) 저장 자체를 차단한다 (contract §2).
alter table public.notification_templates
  drop constraint if exists notification_templates_marketing_not_mandatory;
alter table public.notification_templates
  add constraint notification_templates_marketing_not_mandatory
  check (not (class = 'marketing' and mandatory));

alter table public.notification_templates
  drop constraint if exists notification_templates_mode_check;
alter table public.notification_templates
  add constraint notification_templates_mode_check
  check (mode in ('auto','manual'));

alter table public.notification_templates
  drop constraint if exists notification_templates_category_check;
alter table public.notification_templates
  add constraint notification_templates_category_check
  check (category in ('study','exam_schedule','notice','event','marketing'));

alter table public.notification_templates
  drop constraint if exists notification_templates_status_check;
alter table public.notification_templates
  add constraint notification_templates_status_check
  check (status in ('active','inactive','draft'));

comment on table public.notification_templates is
  '알림 템플릿 원본. channel별 변형 행(unique(template_key,channel)). class/mandatory 규칙은 notification-contract.md §2. 쓰기는 admin RPC 단일 경로.';

-- ---------------------------------------------------------------------
-- notification_groups : 발송 대상 그룹 (정적/조건 기반)
-- ---------------------------------------------------------------------
create table if not exists public.notification_groups (
  id                 uuid primary key default gen_random_uuid(),
  name               text not null,
  description        text not null default '',
  definition_type    text not null,
  builder_mode       text not null default 'simple',
  channels           jsonb not null default '[]'::jsonb,
  member_count       integer not null default 0,
  rule_summary       text not null default '',
  filters            jsonb not null default '{}'::jsonb,
  query_config       jsonb,
  static_member_ids  jsonb not null default '[]'::jsonb,
  status             text not null default 'draft',
  last_calculated_at timestamptz,
  updated_by         uuid,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);

alter table public.notification_groups
  drop constraint if exists notification_groups_definition_type_check;
alter table public.notification_groups
  add constraint notification_groups_definition_type_check
  check (definition_type in ('static','query'));

alter table public.notification_groups
  drop constraint if exists notification_groups_builder_mode_check;
alter table public.notification_groups
  add constraint notification_groups_builder_mode_check
  check (builder_mode in ('simple','query-builder'));

alter table public.notification_groups
  drop constraint if exists notification_groups_status_check;
alter table public.notification_groups
  add constraint notification_groups_status_check
  check (status in ('active','draft'));

comment on table public.notification_groups is
  '알림 발송 대상 그룹(정적 명단/조건 기반). 쓰기는 admin RPC 단일 경로. UI 한글 라벨(정적 그룹/조건 기반 그룹, 사용중/초안)은 코드 매핑.';

-- ---------------------------------------------------------------------
-- notification_dispatches : 발송 실행 ledger (관리자 1회 발송 / 스케줄러 1슬롯)
-- ---------------------------------------------------------------------
create table if not exists public.notification_dispatches (
  id               uuid primary key default gen_random_uuid(),
  template_id      uuid references public.notification_templates(id) on delete set null,
  template_key     text not null,
  channels         jsonb not null default '[]'::jsonb,
  target_type      text not null,
  target_group_ids jsonb not null default '[]'::jsonb,
  target_snapshot  jsonb,
  recipient_count  integer not null default 0,
  status           text not null default 'draft',
  actor_id         uuid,
  reason           text,
  dedupe_key       text not null unique,
  scheduled_at     timestamptz,
  started_at       timestamptz,
  completed_at     timestamptz,
  created_at       timestamptz not null default now()
);

alter table public.notification_dispatches
  drop constraint if exists notification_dispatches_target_type_check;
alter table public.notification_dispatches
  add constraint notification_dispatches_target_type_check
  check (target_type in ('group','schedule','event','test'));

alter table public.notification_dispatches
  drop constraint if exists notification_dispatches_status_check;
alter table public.notification_dispatches
  add constraint notification_dispatches_status_check
  check (status in ('draft','scheduled','running','completed','partial_failed','failed','canceled'));

create index if not exists notification_dispatches_created
  on public.notification_dispatches (created_at desc);
create index if not exists notification_dispatches_status
  on public.notification_dispatches (status)
  where status in ('scheduled','running');

comment on table public.notification_dispatches is
  '발송 실행 단위 ledger(관리자 이력 화면의 SoT 1계층). dedupe_key unique로 슬롯/캠페인 재실행 차단.';

-- ---------------------------------------------------------------------
-- notification_delivery_attempts : 수신자×채널 전달 결과 (SoT 2계층)
-- v13 X-09 발송 이력 패널이 본인 행을 읽는 공유 객체 (ownership 문서 §2).
-- user_id FK→profiles cascade: 탈퇴 시 본인 전달 행 정리 (notification_log와
-- 동일 자세). profiles DDL 변경 아님 — 수신 측 제약만 추가된다.
-- ---------------------------------------------------------------------
create table if not exists public.notification_delivery_attempts (
  id                  uuid primary key default gen_random_uuid(),
  dispatch_id         uuid not null references public.notification_dispatches(id) on delete cascade,
  user_id             uuid not null references public.profiles(id) on delete cascade,
  channel             text not null,
  status              text not null default 'pending',
  dedupe_key          text,
  provider_message_id text,
  error_code          text,
  error_message       text,
  retry_count         integer not null default 0,
  sent_at             timestamptz,
  created_at          timestamptz not null default now(),
  unique (dispatch_id, user_id, channel)
);

alter table public.notification_delivery_attempts
  drop constraint if exists notification_delivery_attempts_channel_check;
alter table public.notification_delivery_attempts
  add constraint notification_delivery_attempts_channel_check
  check (channel in ('in_app','email','push','zalo'));

alter table public.notification_delivery_attempts
  drop constraint if exists notification_delivery_attempts_status_check;
alter table public.notification_delivery_attempts
  add constraint notification_delivery_attempts_status_check
  check (status in ('pending','sent','failed','skipped','opted_out','deduped'));

-- 사용자×유형×회차 단위 중복 차단 (스케줄/이벤트형). 관리자 수동 발송은 null.
create unique index if not exists notification_delivery_attempts_dedupe
  on public.notification_delivery_attempts (dedupe_key)
  where dedupe_key is not null;

-- v13 X-09 발송 이력 패널 경로 (최근 5건)
create index if not exists notification_delivery_attempts_user_created
  on public.notification_delivery_attempts (user_id, created_at desc);

-- 관리자 상세 drawer 집계 경로
create index if not exists notification_delivery_attempts_dispatch_status
  on public.notification_delivery_attempts (dispatch_id, status);

comment on table public.notification_delivery_attempts is
  '수신자×채널 전달 결과(SoT 2계층). opt-out 제외는 skipped/opted_out으로 집계(미기록 금지). 본인 행 owner select — v13 X-09 공유 계약.';

-- =====================================================================
-- RLS — 읽기: admin(전부) + attempts는 본인 행. 쓰기: 정책 없음(RPC/service_role).
-- =====================================================================

alter table public.notification_templates enable row level security;
alter table public.notification_templates force  row level security;
drop policy if exists notification_templates_admin_select on public.notification_templates;
create policy notification_templates_admin_select on public.notification_templates
  for select to authenticated using (private.is_admin((select auth.uid())));

alter table public.notification_groups enable row level security;
alter table public.notification_groups force  row level security;
drop policy if exists notification_groups_admin_select on public.notification_groups;
create policy notification_groups_admin_select on public.notification_groups
  for select to authenticated using (private.is_admin((select auth.uid())));

alter table public.notification_dispatches enable row level security;
alter table public.notification_dispatches force  row level security;
drop policy if exists notification_dispatches_admin_select on public.notification_dispatches;
create policy notification_dispatches_admin_select on public.notification_dispatches
  for select to authenticated using (private.is_admin((select auth.uid())));

alter table public.notification_delivery_attempts enable row level security;
alter table public.notification_delivery_attempts force  row level security;
drop policy if exists notification_delivery_attempts_owner_or_admin_select on public.notification_delivery_attempts;
create policy notification_delivery_attempts_owner_or_admin_select on public.notification_delivery_attempts
  for select to authenticated
  using ( user_id = (select auth.uid()) or private.is_admin((select auth.uid())) );
