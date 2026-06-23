-- =====================================================================
-- topik-ai admin · 인증(Supabase Auth) 메일 템플릿 관리 · admin-0020
-- v13 회원가입 등 6종 auth 메일 템플릿을 관리자가 편집하는 편집 SoT.
-- 발송은 GoTrue가 수행하며, 본 템플릿은 Management API로 동기화(push)된다.
--   - 브로드캐스트(notification_*) 파이프라인과 분리 — 오발송 방지.
--   - 쓰기 단일 경로: SECURITY DEFINER RPC + admin_audit_logs(사유 필수).
--   - 읽기: RLS admin select (system_metadata와 동일 패턴).
--   - sole-writer 정책: topik-ai만 auth 템플릿을 변경. drift/conflict는 안전 경보.
-- down: supabase/migrations-admin/down/20260622100000_auth_email_templates.sql
-- =====================================================================

-- ---------------------------------------------------------------------
-- 테이블: 6종 auth 메일 편집본 + 동기화/드리프트 상태
-- ---------------------------------------------------------------------
create table if not exists public.auth_email_templates (
  id                     uuid primary key default gen_random_uuid(),
  auth_type              text not null unique,
  subject                text not null default '',
  body_html              text not null default '',
  body_json              jsonb,
  status                 text not null default 'draft',
  sync_status            text not null default 'draft',
  local_hash             text,                 -- md5(subject || '\n' || body_html) of editor copy
  last_synced_live_hash  text,                 -- live hash right after last successful PATCH
  last_live_hash         text,                 -- most recent live hash observed via GET
  last_live_snapshot     jsonb,                -- live keys snapshot for rollback
  last_live_checked_at   timestamptz,
  synced_at              timestamptz,
  synced_by              uuid,
  sync_error             text,
  updated_by             uuid,
  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now()
);

alter table public.auth_email_templates drop constraint if exists auth_email_templates_auth_type_check;
alter table public.auth_email_templates add constraint auth_email_templates_auth_type_check
  check (auth_type in ('confirmation','magic_link','recovery','email_change','invite','reauthentication'));
alter table public.auth_email_templates drop constraint if exists auth_email_templates_status_check;
alter table public.auth_email_templates add constraint auth_email_templates_status_check
  check (status in ('draft','ready','published','archived'));
alter table public.auth_email_templates drop constraint if exists auth_email_templates_sync_status_check;
alter table public.auth_email_templates add constraint auth_email_templates_sync_status_check
  check (sync_status in ('draft','synced','error','drift','conflict'));
-- Gmail clipping guard (notification body 102KB 가드와 동일 정책)
alter table public.auth_email_templates drop constraint if exists auth_email_templates_body_size_check;
alter table public.auth_email_templates add constraint auth_email_templates_body_size_check
  check (octet_length(body_html) <= 102400);

-- ---------------------------------------------------------------------
-- RLS: admin select only. 쓰기는 RPC(SECURITY DEFINER) 단일 경로.
-- ---------------------------------------------------------------------
alter table public.auth_email_templates enable row level security;
alter table public.auth_email_templates force row level security;
drop policy if exists auth_email_templates_admin_select on public.auth_email_templates;
create policy auth_email_templates_admin_select on public.auth_email_templates
  for select to authenticated using (private.is_admin((select auth.uid())));

-- ---------------------------------------------------------------------
-- 시드: 6종 빈 템플릿 (관리자가 본문을 채운 뒤 동기화)
-- ---------------------------------------------------------------------
insert into public.auth_email_templates (auth_type)
select auth_type
from unnest(array[
  'confirmation','magic_link','recovery','email_change','invite','reauthentication'
]) as auth_type
on conflict (auth_type) do nothing;

-- ---------------------------------------------------------------------
-- RPC: 템플릿 저장 (auth_type 단위 upsert). 본문 변경 시 sync_status=draft.
-- ---------------------------------------------------------------------
create or replace function public.admin_save_auth_email_template(
  p_auth_type text,
  p_template  jsonb,
  p_reason    text
)
returns uuid
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  caller_id     uuid := auth.uid();
  v_id          uuid;
  v_old         public.auth_email_templates%rowtype;
  v_subject     text := coalesce(p_template->>'subject', '');
  v_body_html   text := coalesce(p_template->>'body_html', '');
  v_status_in   text := nullif(btrim(coalesce(p_template->>'status', '')), '');
  v_status      text;
  v_local_hash  text;
  v_sync_status text;
begin
  if caller_id is null then raise exception 'unauthenticated'; end if;
  if not private.is_admin(caller_id) then raise exception 'forbidden: admin required'; end if;
  if nullif(btrim(coalesce(p_reason, '')), '') is null then
    raise exception 'reason required (operational reason)';
  end if;
  if p_auth_type not in ('confirmation','magic_link','recovery','email_change','invite','reauthentication') then
    raise exception 'invalid auth_type: %', p_auth_type;
  end if;
  if octet_length(v_body_html) > 102400 then
    raise exception 'body_html too large (>100KB): % bytes', octet_length(v_body_html);
  end if;
  if v_status_in is not null and v_status_in not in ('draft','ready','published','archived') then
    raise exception 'invalid status: %', v_status_in;
  end if;

  select * into v_old from public.auth_email_templates where auth_type = p_auth_type for update;

  v_status := coalesce(v_status_in, v_old.status, 'draft');
  v_local_hash := md5(v_subject || chr(10) || v_body_html);
  v_sync_status := case
    when v_old.last_synced_live_hash is not null and v_local_hash = v_old.last_synced_live_hash then 'synced'
    else 'draft'
  end;

  insert into public.auth_email_templates as t (
    auth_type, subject, body_html, body_json, status, sync_status, local_hash, updated_by, updated_at
  ) values (
    p_auth_type, v_subject, v_body_html, p_template->'body_json', v_status, v_sync_status, v_local_hash, caller_id, now()
  )
  on conflict (auth_type) do update set
    subject     = excluded.subject,
    body_html   = excluded.body_html,
    body_json   = excluded.body_json,
    status      = excluded.status,
    sync_status = excluded.sync_status,
    local_hash  = excluded.local_hash,
    updated_by  = excluded.updated_by,
    updated_at  = excluded.updated_at
  returning id into v_id;

  insert into public.admin_audit_logs (admin_user_id, action, target_table, target_id, diff, payload)
  values (
    caller_id, 'auth_email_template_saved', 'AuthEmailTemplate', p_auth_type,
    case when v_old.id is null then '{}'::jsonb
         else jsonb_build_object(
           'subject', jsonb_build_object('from', v_old.subject, 'to', v_subject),
           'body_changed', (v_old.local_hash is distinct from v_local_hash)
         ) end,
    jsonb_build_object('reason', p_reason, 'auth_type', p_auth_type, 'status', v_status)
  );
  return v_id;
end;
$$;
revoke all on function public.admin_save_auth_email_template(text, jsonb, text) from public;
grant execute on function public.admin_save_auth_email_template(text, jsonb, text) to authenticated;

-- ---------------------------------------------------------------------
-- RPC: 동기화 결과 기록. 서버(/api/auth-email/sync)가 Management API로 실제
-- PATCH+GET을 수행하고, 검증된 live 상태를 브라우저가 본 RPC로 기록한다.
--   p_result = { ok bool, live_hash text, snapshot jsonb, error text }
-- ---------------------------------------------------------------------
create or replace function public.admin_mark_auth_email_synced(
  p_auth_type text,
  p_result    jsonb,
  p_reason    text
)
returns uuid
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  caller_id     uuid := auth.uid();
  v_id          uuid;
  v_old         public.auth_email_templates%rowtype;
  v_ok          boolean := coalesce((p_result->>'ok')::boolean, false);
  v_live_hash   text := nullif(btrim(coalesce(p_result->>'live_hash', '')), '');
  v_error       text := nullif(btrim(coalesce(p_result->>'error', '')), '');
  v_sync_status text;
begin
  if caller_id is null then raise exception 'unauthenticated'; end if;
  if not private.is_admin(caller_id) then raise exception 'forbidden: admin required'; end if;
  if nullif(btrim(coalesce(p_reason, '')), '') is null then
    raise exception 'reason required (operational reason)';
  end if;
  if p_auth_type not in ('confirmation','magic_link','recovery','email_change','invite','reauthentication') then
    raise exception 'invalid auth_type: %', p_auth_type;
  end if;

  select * into v_old from public.auth_email_templates where auth_type = p_auth_type for update;
  if not found then raise exception 'unknown auth_type: %', p_auth_type; end if;

  if v_ok then
    v_sync_status := case
      when v_live_hash is null then 'synced'
      when v_live_hash = v_old.local_hash then 'synced'
      else 'drift'   -- live differs from editor copy right after a "successful" push → flag, don't lie
    end;
    update public.auth_email_templates set
      sync_status           = v_sync_status,
      synced_at             = now(),
      synced_by             = caller_id,
      last_synced_live_hash = coalesce(v_live_hash, local_hash),
      last_live_hash        = coalesce(v_live_hash, local_hash),
      last_live_snapshot    = coalesce(p_result->'snapshot', last_live_snapshot),
      last_live_checked_at  = now(),
      sync_error            = null,
      status                = case when status in ('draft','ready') then 'published' else status end,
      updated_by            = caller_id,
      updated_at            = now()
    where auth_type = p_auth_type
    returning id into v_id;
  else
    v_sync_status := 'error';
    update public.auth_email_templates set
      sync_status          = 'error',
      sync_error           = v_error,
      last_live_checked_at = now(),
      updated_by           = caller_id,
      updated_at           = now()
    where auth_type = p_auth_type
    returning id into v_id;
  end if;

  insert into public.admin_audit_logs (admin_user_id, action, target_table, target_id, diff, payload)
  values (
    caller_id,
    case when v_ok then 'auth_email_synced' else 'auth_email_sync_failed' end,
    'AuthEmailTemplate', p_auth_type,
    jsonb_build_object('sync_status', jsonb_build_object('from', v_old.sync_status, 'to', v_sync_status)),
    jsonb_build_object('reason', p_reason, 'auth_type', p_auth_type, 'ok', v_ok, 'error', v_error)
  );
  return v_id;
end;
$$;
revoke all on function public.admin_mark_auth_email_synced(text, jsonb, text) from public;
grant execute on function public.admin_mark_auth_email_synced(text, jsonb, text) to authenticated;

-- ---------------------------------------------------------------------
-- 메타데이터: '인증·계정 메일' 그룹 + 6 유형 (요청 사항 — System > 메타데이터 관리 노출)
-- 분류(class) transactional은 message 모듈 하드코딩 enum에 이미 존재 → 신규 class 없음.
-- ---------------------------------------------------------------------
insert into public.system_metadata_groups (
  group_id, group_name, description, manager_type, owner_module, owner_role, status,
  sync_status, exposure_status, linked_admin_pages, linked_user_surfaces,
  schema_candidate_notes, item_code_prefix, created_at, updated_at, updated_by
)
select
  group_id, group_name, description, manager_type, owner_module, owner_role, status,
  sync_status, exposure_status, linked_admin_pages, linked_user_surfaces,
  schema_candidate_notes, item_code_prefix, created_at::timestamptz, updated_at::timestamptz, updated_by
from jsonb_to_recordset($seed$
[
  {"group_id":"META-GRP-007","group_name":"인증·계정 메일","description":"회원가입 인증 등 Supabase Auth 계정 메일 6종 유형. /messages/mail 인증 메일 탭에서 본문을 편집하고 Supabase Auth에 동기화합니다.","manager_type":"selectOption","owner_module":"Message","owner_role":"OPS_ADMIN","status":"active","sync_status":"review","exposure_status":"internalOnly","linked_admin_pages":["/messages/mail"],"linked_user_surfaces":["회원가입 인증 메일","비밀번호 재설정 메일","매직링크 로그인 메일","이메일 변경 확인 메일"],"schema_candidate_notes":["auth_email_templates","Supabase Auth 내장 템플릿과 Management API로 동기화"],"item_code_prefix":"AUTH_EMAIL","created_at":"2026-06-22 10:00:00+09","updated_at":"2026-06-22 10:00:00+09","updated_by":"admin_system"}
]
$seed$::jsonb) as seed(
  group_id text, group_name text, description text, manager_type text, owner_module text,
  owner_role text, status text, sync_status text, exposure_status text, linked_admin_pages jsonb,
  linked_user_surfaces jsonb, schema_candidate_notes jsonb, item_code_prefix text,
  created_at text, updated_at text, updated_by text
)
on conflict (group_id) do nothing;

insert into public.system_metadata_group_items (
  item_id, group_id, code, label, description, status, sort_order, is_default,
  exposure_status, created_at, updated_at, updated_by
)
select
  item_id, group_id, code, label, description, status, sort_order, is_default,
  exposure_status, updated_at::timestamptz, updated_at::timestamptz, updated_by
from jsonb_to_recordset($seed$
[
  {"item_id":"META-ITEM-014","group_id":"META-GRP-007","code":"CONFIRMATION","label":"가입 인증","description":"회원가입 시 이메일 인증 확인 메일","status":"active","sort_order":1,"is_default":true,"exposure_status":"confirmed","updated_at":"2026-06-22 10:00:00+09","updated_by":"admin_system"},
  {"item_id":"META-ITEM-015","group_id":"META-GRP-007","code":"MAGIC_LINK","label":"매직링크 로그인","description":"비밀번호 없이 링크/OTP로 로그인하는 메일","status":"active","sort_order":2,"is_default":false,"exposure_status":"confirmed","updated_at":"2026-06-22 10:00:00+09","updated_by":"admin_system"},
  {"item_id":"META-ITEM-016","group_id":"META-GRP-007","code":"RECOVERY","label":"비밀번호 재설정","description":"비밀번호 재설정 링크 메일","status":"active","sort_order":3,"is_default":false,"exposure_status":"confirmed","updated_at":"2026-06-22 10:00:00+09","updated_by":"admin_system"},
  {"item_id":"META-ITEM-017","group_id":"META-GRP-007","code":"EMAIL_CHANGE","label":"이메일 변경 확인","description":"이메일 주소 변경 확인 메일","status":"active","sort_order":4,"is_default":false,"exposure_status":"confirmed","updated_at":"2026-06-22 10:00:00+09","updated_by":"admin_system"},
  {"item_id":"META-ITEM-018","group_id":"META-GRP-007","code":"INVITE","label":"초대","description":"관리자 초대 가입 메일","status":"active","sort_order":5,"is_default":false,"exposure_status":"planned","updated_at":"2026-06-22 10:00:00+09","updated_by":"admin_system"},
  {"item_id":"META-ITEM-019","group_id":"META-GRP-007","code":"REAUTHENTICATION","label":"재인증","description":"민감 작업 전 재인증 OTP 메일","status":"active","sort_order":6,"is_default":false,"exposure_status":"confirmed","updated_at":"2026-06-22 10:00:00+09","updated_by":"admin_system"}
]
$seed$::jsonb) as seed(
  item_id text, group_id text, code text, label text, description text, status text,
  sort_order smallint, is_default boolean, exposure_status text, updated_at text, updated_by text
)
on conflict (item_id) do nothing;
