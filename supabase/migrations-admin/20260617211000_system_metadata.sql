-- =====================================================================
-- topik-ai admin - System metadata - admin-0019
-- System > 메타데이터 관리 group/items mock -> Supabase transition.
-- RLS: admin select only. Writes are SECURITY DEFINER RPCs.
-- UI labels remain Korean; DB enum-like values are ASCII.
-- down: supabase/migrations-admin/down/20260617211000_system_metadata.sql
-- =====================================================================

create table if not exists public.system_metadata_groups (
  group_id                 text primary key,
  group_name               text not null,
  description              text not null,
  owner_role               text not null,
  item_code_prefix         text not null,
  manager_type             text not null,
  owner_module             text not null,
  status                   text not null default 'active',
  sync_status              text not null default 'draft',
  exposure_status          text not null default 'internalOnly',
  linked_admin_pages       jsonb not null default '[]'::jsonb,
  linked_user_surfaces     jsonb not null default '[]'::jsonb,
  schema_candidate_notes   jsonb not null default '[]'::jsonb,
  created_at               timestamptz not null default now(),
  updated_at               timestamptz not null default now(),
  updated_by               text
);

create table if not exists public.system_metadata_group_items (
  item_id          text primary key,
  group_id         text not null references public.system_metadata_groups(group_id) on delete cascade,
  code             text not null,
  label            text not null,
  description      text not null,
  sort_order       smallint not null,
  status           text not null default 'active',
  exposure_status  text not null default 'internalOnly',
  is_default       boolean not null default false,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  updated_by       text
);

alter table public.system_metadata_groups drop constraint if exists system_metadata_groups_group_id_check;
alter table public.system_metadata_groups add constraint system_metadata_groups_group_id_check
  check (group_id ~ '^META-GRP-[0-9]{3,}$');
alter table public.system_metadata_groups drop constraint if exists system_metadata_groups_manager_type_check;
alter table public.system_metadata_groups add constraint system_metadata_groups_manager_type_check
  check (manager_type in ('codeTable','selectOption','exposureRule','segmentField'));
alter table public.system_metadata_groups drop constraint if exists system_metadata_groups_owner_module_check;
alter table public.system_metadata_groups add constraint system_metadata_groups_owner_module_check
  check (owner_module in ('Users','Message','Operation','Commerce','Content','System'));
alter table public.system_metadata_groups drop constraint if exists system_metadata_groups_status_check;
alter table public.system_metadata_groups add constraint system_metadata_groups_status_check
  check (status in ('active','inactive'));
alter table public.system_metadata_groups drop constraint if exists system_metadata_groups_sync_status_check;
alter table public.system_metadata_groups add constraint system_metadata_groups_sync_status_check
  check (sync_status in ('live','review','draft'));
alter table public.system_metadata_groups drop constraint if exists system_metadata_groups_exposure_status_check;
alter table public.system_metadata_groups add constraint system_metadata_groups_exposure_status_check
  check (exposure_status in ('confirmed','inferred','internalOnly','planned'));
alter table public.system_metadata_groups drop constraint if exists system_metadata_groups_linked_admin_pages_array_check;
alter table public.system_metadata_groups add constraint system_metadata_groups_linked_admin_pages_array_check
  check (jsonb_typeof(linked_admin_pages) = 'array');
alter table public.system_metadata_groups drop constraint if exists system_metadata_groups_linked_user_surfaces_array_check;
alter table public.system_metadata_groups add constraint system_metadata_groups_linked_user_surfaces_array_check
  check (jsonb_typeof(linked_user_surfaces) = 'array');
alter table public.system_metadata_groups drop constraint if exists system_metadata_groups_schema_candidate_notes_array_check;
alter table public.system_metadata_groups add constraint system_metadata_groups_schema_candidate_notes_array_check
  check (jsonb_typeof(schema_candidate_notes) = 'array');

alter table public.system_metadata_group_items drop constraint if exists system_metadata_group_items_item_id_check;
alter table public.system_metadata_group_items add constraint system_metadata_group_items_item_id_check
  check (item_id ~ '^META-ITEM-[0-9]{3,}$');
alter table public.system_metadata_group_items drop constraint if exists system_metadata_group_items_sort_order_check;
alter table public.system_metadata_group_items add constraint system_metadata_group_items_sort_order_check
  check (sort_order > 0);
alter table public.system_metadata_group_items drop constraint if exists system_metadata_group_items_status_check;
alter table public.system_metadata_group_items add constraint system_metadata_group_items_status_check
  check (status in ('active','inactive'));
alter table public.system_metadata_group_items drop constraint if exists system_metadata_group_items_exposure_status_check;
alter table public.system_metadata_group_items add constraint system_metadata_group_items_exposure_status_check
  check (exposure_status in ('confirmed','inferred','internalOnly','planned'));

create unique index if not exists system_metadata_groups_name_unique
  on public.system_metadata_groups (lower(group_name));
create unique index if not exists system_metadata_group_items_group_code_unique
  on public.system_metadata_group_items (group_id, upper(code));
create unique index if not exists system_metadata_group_items_group_label_unique
  on public.system_metadata_group_items (group_id, lower(label));
create index if not exists system_metadata_group_items_group_id_sort
  on public.system_metadata_group_items (group_id, sort_order);

alter table public.system_metadata_groups enable row level security;
alter table public.system_metadata_groups force row level security;
drop policy if exists system_metadata_groups_admin_select on public.system_metadata_groups;
create policy system_metadata_groups_admin_select on public.system_metadata_groups
  for select to authenticated using (private.is_admin((select auth.uid())));

alter table public.system_metadata_group_items enable row level security;
alter table public.system_metadata_group_items force row level security;
drop policy if exists system_metadata_group_items_admin_select on public.system_metadata_group_items;
create policy system_metadata_group_items_admin_select on public.system_metadata_group_items
  for select to authenticated using (private.is_admin((select auth.uid())));

create or replace function public.next_system_metadata_group_id()
returns text
language sql
stable
set search_path = pg_catalog, public
as $$
  select 'META-GRP-' || lpad((coalesce(max(substring(group_id from '^META-GRP-([0-9]+)$')::integer), 0) + 1)::text, 3, '0')
  from public.system_metadata_groups
  where group_id ~ '^META-GRP-[0-9]+$';
$$;

create or replace function public.next_system_metadata_item_id()
returns text
language sql
stable
set search_path = pg_catalog, public
as $$
  select 'META-ITEM-' || lpad((coalesce(max(substring(item_id from '^META-ITEM-([0-9]+)$')::integer), 0) + 1)::text, 3, '0')
  from public.system_metadata_group_items
  where item_id ~ '^META-ITEM-[0-9]+$';
$$;

revoke all on function public.next_system_metadata_group_id() from public;
revoke all on function public.next_system_metadata_item_id() from public;

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
  {"group_id":"META-GRP-001","group_name":"회원 상태","description":"Users 회원 목록과 상세 탭에서 공통으로 쓰는 회원 상태 코드 테이블입니다.","manager_type":"codeTable","owner_module":"Users","owner_role":"OPS_ADMIN","status":"active","sync_status":"live","exposure_status":"confirmed","linked_admin_pages":["/users","/users/:userId"],"linked_user_surfaces":["회원 가입 완료 화면","마이페이지 계정 상태 배지"],"schema_candidate_notes":["user_status_codes","회원 상태는 감사 로그와 검색 필터에 공통으로 연결되는 code table candidate"],"item_code_prefix":"USER_STATUS","created_at":"2026-03-14 09:20:00+09","updated_at":"2026-03-14 09:20:00+09","updated_by":"admin_park"},
  {"group_id":"META-GRP-002","group_name":"발송 세그먼트 필드","description":"대상 그룹과 자동 발송 룰에서 공통으로 사용하는 세그먼트 필드 메타데이터입니다.","manager_type":"segmentField","owner_module":"Message","owner_role":"OPS_ADMIN","status":"active","sync_status":"review","exposure_status":"internalOnly","linked_admin_pages":["/messages/groups","/messages/mail","/messages/push"],"linked_user_surfaces":[],"schema_candidate_notes":["message_group_segment_schema","세그먼트 속성과 1:1 매핑 검증 필요"],"item_code_prefix":"SEGMENT_FIELD","created_at":"2026-03-19 13:05:00+09","updated_at":"2026-03-19 13:05:00+09","updated_by":"admin_kim"},
  {"group_id":"META-GRP-003","group_name":"FAQ 노출 위치","description":"FAQ 큐레이션과 사용자 노출 surface를 묶는 선택 옵션입니다.","manager_type":"exposureRule","owner_module":"Operation","owner_role":"OPS_ADMIN","status":"active","sync_status":"live","exposure_status":"confirmed","linked_admin_pages":["/operation/faq"],"linked_user_surfaces":["고객센터 홈","주문 상세 FAQ 블록"],"schema_candidate_notes":["operation_faq_curations","노출 위치는 code table candidate"],"item_code_prefix":"FAQ_SURFACE","created_at":"2026-03-12 08:40:00+09","updated_at":"2026-03-12 08:40:00+09","updated_by":"admin_kim"},
  {"group_id":"META-GRP-004","group_name":"쿠폰 적용 범위","description":"쿠폰과 정기 쿠폰 템플릿이 공통으로 쓰는 적용 범위 옵션입니다.","manager_type":"selectOption","owner_module":"Commerce","owner_role":"OPS_ADMIN","status":"active","sync_status":"live","exposure_status":"internalOnly","linked_admin_pages":["/commerce/coupons"],"linked_user_surfaces":[],"schema_candidate_notes":["coupon-form-schema.ts","상품/카테고리 참조는 후속 API 연동 필요"],"item_code_prefix":"COUPON_SCOPE","created_at":"2026-03-21 09:00:00+09","updated_at":"2026-03-21 09:00:00+09","updated_by":"admin_han"},
  {"group_id":"META-GRP-005","group_name":"관리자 역할 템플릿","description":"관리자 권한 목록과 역할 설명에 연결되는 운영 메타데이터입니다.","manager_type":"codeTable","owner_module":"System","owner_role":"SUPER_ADMIN","status":"active","sync_status":"review","exposure_status":"internalOnly","linked_admin_pages":["/system/admins","/system/permissions"],"linked_user_surfaces":[],"schema_candidate_notes":["role_catalog","권한 확인 절차가 확정되기 전까지 메타 후보 유지"],"item_code_prefix":"ADMIN_ROLE","created_at":"2026-03-17 18:15:00+09","updated_at":"2026-03-17 18:15:00+09","updated_by":"admin_park"},
  {"group_id":"META-GRP-006","group_name":"배지 등급","description":"콘텐츠 배지 등급과 색상 세트를 관리할 후보 메타 그룹입니다.","manager_type":"codeTable","owner_module":"Content","owner_role":"CONTENT_MANAGER","status":"inactive","sync_status":"draft","exposure_status":"planned","linked_admin_pages":["/content/badges"],"linked_user_surfaces":["배지 획득 화면"],"schema_candidate_notes":["badge_grade_codes","Content 페이지 구현 전까지 초안 유지"],"item_code_prefix":"BADGE_GRADE","created_at":"2026-03-10 15:35:00+09","updated_at":"2026-03-10 15:35:00+09","updated_by":"admin_han"}
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
  {"item_id":"META-ITEM-001","group_id":"META-GRP-001","code":"ACTIVE","label":"정상","description":"정상 이용이 가능한 회원","status":"active","sort_order":1,"is_default":true,"exposure_status":"confirmed","updated_at":"2026-03-14 09:20:00+09","updated_by":"admin_park"},
  {"item_id":"META-ITEM-002","group_id":"META-GRP-001","code":"SUSPENDED","label":"정지","description":"운영 조치로 서비스 이용이 제한된 회원","status":"active","sort_order":2,"is_default":false,"exposure_status":"confirmed","updated_at":"2026-03-14 09:20:00+09","updated_by":"admin_park"},
  {"item_id":"META-ITEM-003","group_id":"META-GRP-001","code":"WITHDRAWN","label":"탈퇴","description":"탈퇴가 완료된 회원","status":"active","sort_order":3,"is_default":false,"exposure_status":"confirmed","updated_at":"2026-03-14 09:20:00+09","updated_by":"admin_park"},
  {"item_id":"META-ITEM-004","group_id":"META-GRP-002","code":"SHOPPING_GRADE","label":"쇼핑 등급","description":"정기 쿠폰과 메시지 세그먼트가 공통 참조하는 등급 필드","status":"active","sort_order":1,"is_default":false,"exposure_status":"internalOnly","updated_at":"2026-03-19 13:05:00+09","updated_by":"admin_kim"},
  {"item_id":"META-ITEM-005","group_id":"META-GRP-002","code":"INACTIVE_DAYS","label":"휴면 일수","description":"최근 활동일 기준 휴면 세그먼트 추출값","status":"active","sort_order":2,"is_default":false,"exposure_status":"internalOnly","updated_at":"2026-03-19 13:05:00+09","updated_by":"admin_kim"},
  {"item_id":"META-ITEM-006","group_id":"META-GRP-003","code":"HELP_HOME","label":"고객센터 홈","description":"고객센터 첫 화면 상단 FAQ 큐레이션","status":"active","sort_order":1,"is_default":true,"exposure_status":"confirmed","updated_at":"2026-03-12 08:40:00+09","updated_by":"admin_kim"},
  {"item_id":"META-ITEM-007","group_id":"META-GRP-003","code":"ORDER_DETAIL","label":"주문 상세","description":"주문 상세 하단 FAQ 모듈","status":"active","sort_order":2,"is_default":false,"exposure_status":"inferred","updated_at":"2026-03-12 08:40:00+09","updated_by":"admin_kim"},
  {"item_id":"META-ITEM-008","group_id":"META-GRP-004","code":"ALL_PRODUCTS","label":"전체 상품","description":"모든 상품에 적용","status":"active","sort_order":1,"is_default":true,"exposure_status":"internalOnly","updated_at":"2026-03-21 09:00:00+09","updated_by":"admin_han"},
  {"item_id":"META-ITEM-009","group_id":"META-GRP-004","code":"SPECIFIC_CATEGORY","label":"특정 카테고리","description":"선택한 카테고리에만 적용","status":"active","sort_order":2,"is_default":false,"exposure_status":"internalOnly","updated_at":"2026-03-21 09:00:00+09","updated_by":"admin_han"},
  {"item_id":"META-ITEM-010","group_id":"META-GRP-005","code":"OPS_ADMIN","label":"운영 관리자","description":"운영, 커뮤니티, 메시지, 커머스 권한 묶음","status":"active","sort_order":1,"is_default":false,"exposure_status":"internalOnly","updated_at":"2026-03-17 18:15:00+09","updated_by":"admin_park"},
  {"item_id":"META-ITEM-011","group_id":"META-GRP-005","code":"CONTENT_MANAGER","label":"콘텐츠 관리자","description":"Assessment, Content 중심 운영 역할","status":"active","sort_order":2,"is_default":false,"exposure_status":"internalOnly","updated_at":"2026-03-17 18:15:00+09","updated_by":"admin_park"},
  {"item_id":"META-ITEM-012","group_id":"META-GRP-006","code":"BRONZE","label":"브론즈","description":"입문 등급","status":"inactive","sort_order":1,"is_default":true,"exposure_status":"planned","updated_at":"2026-03-10 15:35:00+09","updated_by":"admin_han"},
  {"item_id":"META-ITEM-013","group_id":"META-GRP-006","code":"SILVER","label":"실버","description":"중간 등급","status":"inactive","sort_order":2,"is_default":false,"exposure_status":"planned","updated_at":"2026-03-10 15:35:00+09","updated_by":"admin_han"}
]
$seed$::jsonb) as seed(
  item_id text, group_id text, code text, label text, description text, status text,
  sort_order smallint, is_default boolean, exposure_status text, updated_at text, updated_by text
)
on conflict (item_id) do nothing;

create or replace function public.admin_save_metadata_group(
  p_group_id text,
  p_group    jsonb,
  p_reason   text
)
returns text
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  caller_id uuid := auth.uid();
  v_id text;
  v_old public.system_metadata_groups%rowtype;
  v_saved public.system_metadata_groups%rowtype;
  v_is_create boolean := nullif(btrim(coalesce(p_group_id, '')), '') is null;
begin
  if caller_id is null then raise exception 'unauthenticated'; end if;
  if not private.is_admin(caller_id) then raise exception 'forbidden: admin required'; end if;
  if nullif(btrim(coalesce(p_reason, '')), '') is null then raise exception 'reason required (operational reason)'; end if;
  if nullif(btrim(coalesce(p_group->>'group_name', '')), '') is null then raise exception 'group_name required'; end if;

  if (p_group->>'manager_type') not in ('codeTable','selectOption','exposureRule','segmentField') then
    raise exception 'invalid manager_type: %', p_group->>'manager_type';
  end if;
  if (p_group->>'owner_module') not in ('Users','Message','Operation','Commerce','Content','System') then
    raise exception 'invalid owner_module: %', p_group->>'owner_module';
  end if;
  if (p_group->>'sync_status') not in ('live','review','draft') then
    raise exception 'invalid sync_status: %', p_group->>'sync_status';
  end if;
  if (p_group->>'exposure_status') not in ('confirmed','inferred','internalOnly','planned') then
    raise exception 'invalid exposure_status: %', p_group->>'exposure_status';
  end if;
  if jsonb_typeof(coalesce(p_group->'linked_admin_pages', '[]'::jsonb)) <> 'array' then raise exception 'linked_admin_pages must be array'; end if;
  if exists (
    select 1 from public.system_metadata_groups
    where lower(group_name) = lower(btrim(p_group->>'group_name'))
      and (v_is_create or group_id <> btrim(p_group_id))
  ) then
    raise exception 'duplicated group_name: %', p_group->>'group_name';
  end if;

  if v_is_create then
    perform pg_advisory_xact_lock(hashtext('system_metadata_group_id'));
    v_id := public.next_system_metadata_group_id();
  else
    v_id := btrim(p_group_id);
    select * into v_old from public.system_metadata_groups where group_id = v_id for update;
    if not found then raise exception 'unknown metadata group id: %', v_id; end if;
  end if;

  insert into public.system_metadata_groups (
    group_id, group_name, description, manager_type, owner_module, owner_role, status,
    sync_status, exposure_status, linked_admin_pages, linked_user_surfaces,
    schema_candidate_notes, item_code_prefix, created_at, updated_at, updated_by
  ) values (
    v_id,
    btrim(p_group->>'group_name'),
    btrim(coalesce(p_group->>'description', '')),
    p_group->>'manager_type',
    p_group->>'owner_module',
    btrim(coalesce(p_group->>'owner_role', '')),
    coalesce(v_old.status, 'active'),
    p_group->>'sync_status',
    p_group->>'exposure_status',
    coalesce(p_group->'linked_admin_pages', '[]'::jsonb),
    coalesce(p_group->'linked_user_surfaces', '[]'::jsonb),
    coalesce(p_group->'schema_candidate_notes', '[]'::jsonb),
    upper(btrim(coalesce(p_group->>'item_code_prefix', ''))),
    coalesce(v_old.created_at, now()),
    now(),
    coalesce(nullif(btrim(p_group->>'updated_by'), ''), caller_id::text)
  )
  on conflict (group_id) do update set
    group_name = excluded.group_name,
    description = excluded.description,
    manager_type = excluded.manager_type,
    owner_module = excluded.owner_module,
    owner_role = excluded.owner_role,
    sync_status = excluded.sync_status,
    exposure_status = excluded.exposure_status,
    linked_admin_pages = excluded.linked_admin_pages,
    linked_user_surfaces = excluded.linked_user_surfaces,
    schema_candidate_notes = excluded.schema_candidate_notes,
    item_code_prefix = excluded.item_code_prefix,
    updated_at = excluded.updated_at,
    updated_by = excluded.updated_by
  returning * into v_saved;

  insert into public.admin_audit_logs (admin_user_id, action, target_table, target_id, diff, payload)
  values (
    caller_id, 'metadata_group_saved', 'SystemMetadataGroup', v_id,
    case when v_is_create then '{}'::jsonb else jsonb_build_object('group_name', jsonb_build_object('from', v_old.group_name, 'to', v_saved.group_name)) end,
    jsonb_build_object('reason', p_reason, 'group_name', v_saved.group_name)
  );
  return v_id;
end;
$$;

create or replace function public.admin_save_metadata_item(
  p_item_id text,
  p_item    jsonb,
  p_reason  text
)
returns text
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  caller_id uuid := auth.uid();
  v_id text;
  v_group_id text := btrim(coalesce(p_item->>'group_id', ''));
  v_old public.system_metadata_group_items%rowtype;
  v_saved public.system_metadata_group_items%rowtype;
  v_is_create boolean := nullif(btrim(coalesce(p_item_id, '')), '') is null;
begin
  if caller_id is null then raise exception 'unauthenticated'; end if;
  if not private.is_admin(caller_id) then raise exception 'forbidden: admin required'; end if;
  if nullif(btrim(coalesce(p_reason, '')), '') is null then raise exception 'reason required (operational reason)'; end if;
  if nullif(v_group_id, '') is null then raise exception 'group_id required'; end if;
  if not exists (select 1 from public.system_metadata_groups where group_id = v_group_id) then raise exception 'unknown metadata group id: %', v_group_id; end if;
  if (p_item->>'status') not in ('active','inactive') then raise exception 'invalid item status: %', p_item->>'status'; end if;
  if (p_item->>'exposure_status') not in ('confirmed','inferred','internalOnly','planned') then raise exception 'invalid exposure_status: %', p_item->>'exposure_status'; end if;
  if coalesce((p_item->>'sort_order')::integer, 0) < 1 then raise exception 'sort_order must be greater than 0'; end if;

  if exists (
    select 1 from public.system_metadata_group_items
    where group_id = v_group_id and upper(code) = upper(btrim(p_item->>'code'))
      and (v_is_create or item_id <> btrim(p_item_id))
  ) then raise exception 'duplicated item code: %', p_item->>'code'; end if;
  if exists (
    select 1 from public.system_metadata_group_items
    where group_id = v_group_id and lower(label) = lower(btrim(p_item->>'label'))
      and (v_is_create or item_id <> btrim(p_item_id))
  ) then raise exception 'duplicated item label: %', p_item->>'label'; end if;

  if v_is_create then
    perform pg_advisory_xact_lock(hashtext('system_metadata_item_id'));
    v_id := public.next_system_metadata_item_id();
  else
    v_id := btrim(p_item_id);
    select * into v_old from public.system_metadata_group_items where item_id = v_id for update;
    if not found then raise exception 'unknown metadata item id: %', v_id; end if;
    v_group_id := v_old.group_id;
  end if;

  if coalesce((p_item->>'is_default')::boolean, false) then
    update public.system_metadata_group_items
       set is_default = false, updated_at = now()
     where group_id = v_group_id and item_id <> v_id;
  end if;

  insert into public.system_metadata_group_items (
    item_id, group_id, code, label, description, sort_order, status, exposure_status,
    is_default, created_at, updated_at, updated_by
  ) values (
    v_id, v_group_id, upper(btrim(p_item->>'code')), btrim(p_item->>'label'),
    btrim(coalesce(p_item->>'description', '')), (p_item->>'sort_order')::smallint,
    p_item->>'status', p_item->>'exposure_status', coalesce((p_item->>'is_default')::boolean, false),
    coalesce(v_old.created_at, now()), now(), coalesce(nullif(btrim(p_item->>'updated_by'), ''), caller_id::text)
  )
  on conflict (item_id) do update set
    code = excluded.code,
    label = excluded.label,
    description = excluded.description,
    sort_order = excluded.sort_order,
    status = excluded.status,
    exposure_status = excluded.exposure_status,
    is_default = excluded.is_default,
    updated_at = excluded.updated_at,
    updated_by = excluded.updated_by
  returning * into v_saved;

  update public.system_metadata_groups
     set updated_at = now(), updated_by = v_saved.updated_by
   where group_id = v_group_id;

  insert into public.admin_audit_logs (admin_user_id, action, target_table, target_id, diff, payload)
  values (
    caller_id, 'metadata_item_saved', 'SystemMetadataGroup', v_group_id,
    case when v_is_create then '{}'::jsonb else jsonb_build_object('code', jsonb_build_object('from', v_old.code, 'to', v_saved.code)) end,
    jsonb_build_object('reason', p_reason, 'item_id', v_id, 'label', v_saved.label)
  );
  return v_group_id;
end;
$$;

create or replace function public.admin_toggle_metadata_group_status(
  p_group_id text,
  p_next_status text,
  p_reason text
)
returns text
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  caller_id uuid := auth.uid();
  v_old_status text;
begin
  if caller_id is null then raise exception 'unauthenticated'; end if;
  if not private.is_admin(caller_id) then raise exception 'forbidden: admin required'; end if;
  if nullif(btrim(coalesce(p_reason, '')), '') is null then raise exception 'reason required (operational reason)'; end if;
  if p_next_status not in ('active','inactive') then raise exception 'invalid metadata group status: %', p_next_status; end if;
  select status into v_old_status from public.system_metadata_groups where group_id = p_group_id for update;
  if not found then raise exception 'unknown metadata group id: %', p_group_id; end if;
  update public.system_metadata_groups set status = p_next_status, updated_at = now(), updated_by = caller_id::text where group_id = p_group_id;
  insert into public.admin_audit_logs (admin_user_id, action, target_table, target_id, diff, payload)
  values (caller_id, 'metadata_group_status_changed', 'SystemMetadataGroup', p_group_id,
          jsonb_build_object('status', jsonb_build_object('from', v_old_status, 'to', p_next_status)),
          jsonb_build_object('reason', p_reason));
  return p_group_id;
end;
$$;

create or replace function public.admin_toggle_metadata_item_status(
  p_item_id text,
  p_next_status text,
  p_reason text
)
returns text
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  caller_id uuid := auth.uid();
  v_old public.system_metadata_group_items%rowtype;
begin
  if caller_id is null then raise exception 'unauthenticated'; end if;
  if not private.is_admin(caller_id) then raise exception 'forbidden: admin required'; end if;
  if nullif(btrim(coalesce(p_reason, '')), '') is null then raise exception 'reason required (operational reason)'; end if;
  if p_next_status not in ('active','inactive') then raise exception 'invalid metadata item status: %', p_next_status; end if;
  select * into v_old from public.system_metadata_group_items where item_id = p_item_id for update;
  if not found then raise exception 'unknown metadata item id: %', p_item_id; end if;
  update public.system_metadata_group_items set status = p_next_status, updated_at = now(), updated_by = caller_id::text where item_id = p_item_id;
  update public.system_metadata_groups set updated_at = now(), updated_by = caller_id::text where group_id = v_old.group_id;
  insert into public.admin_audit_logs (admin_user_id, action, target_table, target_id, diff, payload)
  values (caller_id, 'metadata_item_status_changed', 'SystemMetadataGroup', v_old.group_id,
          jsonb_build_object('item_id', p_item_id, 'status', jsonb_build_object('from', v_old.status, 'to', p_next_status)),
          jsonb_build_object('reason', p_reason, 'label', v_old.label));
  return v_old.group_id;
end;
$$;

create or replace function public.admin_delete_metadata_item(
  p_item_id text,
  p_reason text
)
returns text
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  caller_id uuid := auth.uid();
  v_old public.system_metadata_group_items%rowtype;
  v_fallback_id text;
begin
  if caller_id is null then raise exception 'unauthenticated'; end if;
  if not private.is_admin(caller_id) then raise exception 'forbidden: admin required'; end if;
  if nullif(btrim(coalesce(p_reason, '')), '') is null then raise exception 'reason required (operational reason)'; end if;
  select * into v_old from public.system_metadata_group_items where item_id = p_item_id for update;
  if not found then raise exception 'unknown metadata item id: %', p_item_id; end if;
  delete from public.system_metadata_group_items where item_id = p_item_id;
  if v_old.is_default then
    select item_id into v_fallback_id
      from public.system_metadata_group_items
     where group_id = v_old.group_id
     order by sort_order asc, label asc
     limit 1;
    if v_fallback_id is not null then
      update public.system_metadata_group_items set is_default = (item_id = v_fallback_id) where group_id = v_old.group_id;
    end if;
  end if;
  update public.system_metadata_group_items ranked
     set sort_order = ordered.next_sort_order
    from (
      select item_id, row_number() over (order by sort_order asc, label asc)::smallint as next_sort_order
      from public.system_metadata_group_items
      where group_id = v_old.group_id
    ) ordered
   where ranked.item_id = ordered.item_id;
  update public.system_metadata_groups set updated_at = now(), updated_by = caller_id::text where group_id = v_old.group_id;
  insert into public.admin_audit_logs (admin_user_id, action, target_table, target_id, diff, payload)
  values (caller_id, 'metadata_item_deleted', 'SystemMetadataGroup', v_old.group_id, to_jsonb(v_old),
          jsonb_build_object('reason', p_reason, 'item_id', p_item_id, 'label', v_old.label));
  return v_old.group_id;
end;
$$;

create or replace function public.admin_reorder_metadata_items(
  p_group_id text,
  p_ordered_item_ids jsonb,
  p_reason text
)
returns text
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  caller_id uuid := auth.uid();
  v_existing_count integer;
  v_ordered_count integer;
begin
  if caller_id is null then raise exception 'unauthenticated'; end if;
  if not private.is_admin(caller_id) then raise exception 'forbidden: admin required'; end if;
  if nullif(btrim(coalesce(p_reason, '')), '') is null then raise exception 'reason required (operational reason)'; end if;
  if jsonb_typeof(p_ordered_item_ids) <> 'array' then raise exception 'ordered item ids must be array'; end if;
  if not exists (select 1 from public.system_metadata_groups where group_id = p_group_id) then raise exception 'unknown metadata group id: %', p_group_id; end if;

  select count(*) into v_existing_count from public.system_metadata_group_items where group_id = p_group_id;
  select count(distinct value) into v_ordered_count from jsonb_array_elements_text(p_ordered_item_ids);
  if v_existing_count <> v_ordered_count then raise exception 'ordered item ids do not match group item count'; end if;
  if exists (
    select 1
    from jsonb_array_elements_text(p_ordered_item_ids) ordered(item_id)
    left join public.system_metadata_group_items item
      on item.item_id = ordered.item_id and item.group_id = p_group_id
    where item.item_id is null
  ) then raise exception 'ordered item ids contain unknown item'; end if;

  update public.system_metadata_group_items item
     set sort_order = ordered.next_sort_order, updated_at = now(), updated_by = caller_id::text
    from (
      select value as item_id, ordinality::smallint as next_sort_order
      from jsonb_array_elements_text(p_ordered_item_ids) with ordinality
    ) ordered
   where item.item_id = ordered.item_id and item.group_id = p_group_id;

  update public.system_metadata_groups set updated_at = now(), updated_by = caller_id::text where group_id = p_group_id;
  insert into public.admin_audit_logs (admin_user_id, action, target_table, target_id, diff, payload)
  values (caller_id, 'metadata_items_reordered', 'SystemMetadataGroup', p_group_id,
          jsonb_build_object('ordered_item_ids', p_ordered_item_ids),
          jsonb_build_object('reason', p_reason));
  return p_group_id;
end;
$$;

revoke all on function public.admin_save_metadata_group(text, jsonb, text) from public;
revoke all on function public.admin_save_metadata_item(text, jsonb, text) from public;
revoke all on function public.admin_toggle_metadata_group_status(text, text, text) from public;
revoke all on function public.admin_toggle_metadata_item_status(text, text, text) from public;
revoke all on function public.admin_delete_metadata_item(text, text) from public;
revoke all on function public.admin_reorder_metadata_items(text, jsonb, text) from public;
grant execute on function public.admin_save_metadata_group(text, jsonb, text) to authenticated;
grant execute on function public.admin_save_metadata_item(text, jsonb, text) to authenticated;
grant execute on function public.admin_toggle_metadata_group_status(text, text, text) to authenticated;
grant execute on function public.admin_toggle_metadata_item_status(text, text, text) to authenticated;
grant execute on function public.admin_delete_metadata_item(text, text) to authenticated;
grant execute on function public.admin_reorder_metadata_items(text, jsonb, text) to authenticated;
