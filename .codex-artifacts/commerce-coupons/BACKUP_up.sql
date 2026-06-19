-- =====================================================================
-- topik-ai admin - Commerce coupons - admin-0018
-- Commerce > 쿠폰 관리 mock -> Supabase transition.
-- RLS: admin select only. Writes are SECURITY DEFINER RPCs.
-- UI labels remain Korean; DB enum-like values are ASCII.
-- down: supabase/migrations-admin/down/20260617193000_commerce_coupons.sql
-- =====================================================================

create table if not exists public.commerce_coupons (
  id text primary key,
  coupon_name text not null,
  coupon_kind text not null,
  coupon_status text not null default 'waiting',
  issue_state text not null default 'normal',
  issue_target_type text,
  target_group_ids jsonb not null default '[]'::jsonb,
  target_group_names jsonb not null default '[]'::jsonb,
  target_user_ids jsonb not null default '[]'::jsonb,
  auto_issue_trigger_type text,
  code_generation_mode text,
  coupon_code text not null default '',
  code_count integer,
  audience text,
  benefit_type text not null,
  benefit_value integer not null default 0,
  min_order_amount integer not null default 0,
  max_discount_amount integer,
  applicable_scope text not null default 'allProducts',
  applicable_scope_reference_ids jsonb not null default '[]'::jsonb,
  excluded_product_ids jsonb not null default '[]'::jsonb,
  is_stackable boolean not null default false,
  is_secret_coupon boolean not null default false,
  issue_limit_mode text not null default 'unlimited',
  issue_limit integer,
  download_limit_mode text not null default 'unlimited',
  download_limit integer,
  usage_limit_mode text not null default 'unlimited',
  usage_limit integer,
  validity_mode text not null default 'fixedDate',
  valid_from date,
  valid_until date,
  expire_after_days integer,
  linked_message_template_id text not null default '',
  linked_message_template_name text not null default '',
  linked_crm_campaign_id text not null default '',
  linked_crm_campaign_name text not null default '',
  linked_event_id text not null default '',
  linked_event_name text not null default '',
  download_url text not null default '',
  issue_count integer not null default 0,
  download_count integer not null default 0,
  use_count integer not null default 0,
  last_issued_at timestamptz,
  last_downloaded_at timestamptz,
  last_used_at timestamptz,
  policy_notes jsonb not null default '[]'::jsonb,
  admin_memo text not null default '',
  issue_alert jsonb not null default '{}'::jsonb,
  expire_alert jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  updated_by text
);

create table if not exists public.commerce_coupon_subscription_templates (
  id text primary key,
  template_name text not null,
  issue_target_type text not null default 'shoppingGrade',
  target_grade_ids jsonb not null default '[]'::jsonb,
  target_grade_names jsonb not null default '[]'::jsonb,
  benefit_type text not null,
  benefit_value integer not null default 0,
  min_order_amount integer not null default 0,
  max_discount_amount integer,
  applicable_scope text not null default 'allProducts',
  applicable_scope_reference_ids jsonb not null default '[]'::jsonb,
  applicable_scope_reference_names jsonb not null default '[]'::jsonb,
  excluded_product_mode text not null default 'none',
  excluded_product_ids jsonb not null default '[]'::jsonb,
  excluded_product_names jsonb not null default '[]'::jsonb,
  is_stackable boolean not null default false,
  issue_schedule jsonb not null default '{"dayOfMonth":1,"hour":7,"minute":0}'::jsonb,
  usage_end_schedule jsonb not null default '{"dayOfMonth":28,"hour":23,"minute":59}'::jsonb,
  status text not null default 'active',
  issued_coupon_count integer not null default 0,
  last_issued_at timestamptz,
  next_issued_at timestamptz,
  issue_alert_enabled boolean not null default false,
  expire_alert_enabled boolean not null default false,
  alert_channel text not null default 'webAppPush',
  admin_memo text not null default '',
  policy_notes jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  updated_by text
);

alter table public.commerce_coupons drop constraint if exists commerce_coupons_coupon_kind_check;
alter table public.commerce_coupons add constraint commerce_coupons_coupon_kind_check
  check (coupon_kind in ('customerDownload','autoIssue','couponCode','manualIssue'));
alter table public.commerce_coupons drop constraint if exists commerce_coupons_coupon_status_check;
alter table public.commerce_coupons add constraint commerce_coupons_coupon_status_check
  check (coupon_status in ('waiting','active','ended'));
alter table public.commerce_coupons drop constraint if exists commerce_coupons_issue_state_check;
alter table public.commerce_coupons add constraint commerce_coupons_issue_state_check
  check (issue_state in ('normal','paused'));
alter table public.commerce_coupons drop constraint if exists commerce_coupons_issue_target_type_check;
alter table public.commerce_coupons add constraint commerce_coupons_issue_target_type_check
  check (issue_target_type is null or issue_target_type in ('allMembers','specificGroup','specificMembers'));
alter table public.commerce_coupons drop constraint if exists commerce_coupons_auto_issue_trigger_type_check;
alter table public.commerce_coupons add constraint commerce_coupons_auto_issue_trigger_type_check
  check (auto_issue_trigger_type is null or auto_issue_trigger_type in ('firstSignup','firstOrderComplete','shoppingGradeChange','birthday'));
alter table public.commerce_coupons drop constraint if exists commerce_coupons_code_generation_mode_check;
alter table public.commerce_coupons add constraint commerce_coupons_code_generation_mode_check
  check (code_generation_mode is null or code_generation_mode in ('single','bulk'));
alter table public.commerce_coupons drop constraint if exists commerce_coupons_audience_check;
alter table public.commerce_coupons add constraint commerce_coupons_audience_check
  check (audience is null or audience in ('memberOnly','memberAndGuest'));
alter table public.commerce_coupons drop constraint if exists commerce_coupons_benefit_type_check;
alter table public.commerce_coupons add constraint commerce_coupons_benefit_type_check
  check (benefit_type in ('amountDiscount','rateDiscount','freeShipping','fixedPrice'));
alter table public.commerce_coupons drop constraint if exists commerce_coupons_applicable_scope_check;
alter table public.commerce_coupons add constraint commerce_coupons_applicable_scope_check
  check (applicable_scope in ('allProducts','specificCategory','specificProduct'));
alter table public.commerce_coupons drop constraint if exists commerce_coupons_limit_modes_check;
alter table public.commerce_coupons add constraint commerce_coupons_limit_modes_check
  check (
    issue_limit_mode in ('unlimited','limited') and
    download_limit_mode in ('unlimited','limited') and
    usage_limit_mode in ('unlimited','limited')
  );
alter table public.commerce_coupons drop constraint if exists commerce_coupons_validity_mode_check;
alter table public.commerce_coupons add constraint commerce_coupons_validity_mode_check
  check (validity_mode in ('fixedDate','afterIssued','unlimited'));
alter table public.commerce_coupons drop constraint if exists commerce_coupons_jsonb_array_check;
alter table public.commerce_coupons add constraint commerce_coupons_jsonb_array_check
  check (
    jsonb_typeof(target_group_ids) = 'array' and
    jsonb_typeof(target_group_names) = 'array' and
    jsonb_typeof(target_user_ids) = 'array' and
    jsonb_typeof(applicable_scope_reference_ids) = 'array' and
    jsonb_typeof(excluded_product_ids) = 'array' and
    jsonb_typeof(policy_notes) = 'array'
  );

alter table public.commerce_coupon_subscription_templates drop constraint if exists commerce_coupon_templates_issue_target_type_check;
alter table public.commerce_coupon_subscription_templates add constraint commerce_coupon_templates_issue_target_type_check
  check (issue_target_type = 'shoppingGrade');
alter table public.commerce_coupon_subscription_templates drop constraint if exists commerce_coupon_templates_benefit_type_check;
alter table public.commerce_coupon_subscription_templates add constraint commerce_coupon_templates_benefit_type_check
  check (benefit_type in ('amountDiscount','rateDiscount','freeShipping','fixedPrice'));
alter table public.commerce_coupon_subscription_templates drop constraint if exists commerce_coupon_templates_applicable_scope_check;
alter table public.commerce_coupon_subscription_templates add constraint commerce_coupon_templates_applicable_scope_check
  check (applicable_scope in ('allProducts','specificCategory','specificProduct'));
alter table public.commerce_coupon_subscription_templates drop constraint if exists commerce_coupon_templates_excluded_product_mode_check;
alter table public.commerce_coupon_subscription_templates add constraint commerce_coupon_templates_excluded_product_mode_check
  check (excluded_product_mode in ('none','specific'));
alter table public.commerce_coupon_subscription_templates drop constraint if exists commerce_coupon_templates_status_check;
alter table public.commerce_coupon_subscription_templates add constraint commerce_coupon_templates_status_check
  check (status in ('active','paused'));
alter table public.commerce_coupon_subscription_templates drop constraint if exists commerce_coupon_templates_alert_channel_check;
alter table public.commerce_coupon_subscription_templates add constraint commerce_coupon_templates_alert_channel_check
  check (alert_channel in ('webAppPush'));
alter table public.commerce_coupon_subscription_templates drop constraint if exists commerce_coupon_templates_jsonb_shape_check;
alter table public.commerce_coupon_subscription_templates add constraint commerce_coupon_templates_jsonb_shape_check
  check (
    jsonb_typeof(target_grade_ids) = 'array' and
    jsonb_typeof(target_grade_names) = 'array' and
    jsonb_typeof(applicable_scope_reference_ids) = 'array' and
    jsonb_typeof(applicable_scope_reference_names) = 'array' and
    jsonb_typeof(excluded_product_ids) = 'array' and
    jsonb_typeof(excluded_product_names) = 'array' and
    jsonb_typeof(policy_notes) = 'array' and
    jsonb_typeof(issue_schedule) = 'object' and
    jsonb_typeof(usage_end_schedule) = 'object'
  );

create index if not exists commerce_coupons_updated_at on public.commerce_coupons (updated_at desc);
create index if not exists commerce_coupons_coupon_kind on public.commerce_coupons (coupon_kind);
create index if not exists commerce_coupons_coupon_status on public.commerce_coupons (coupon_status);
create index if not exists commerce_coupon_templates_updated_at
  on public.commerce_coupon_subscription_templates (updated_at desc);
create index if not exists commerce_coupon_templates_status
  on public.commerce_coupon_subscription_templates (status);

alter table public.commerce_coupons enable row level security;
alter table public.commerce_coupons force row level security;
drop policy if exists commerce_coupons_admin_select on public.commerce_coupons;
create policy commerce_coupons_admin_select on public.commerce_coupons
  for select to authenticated using (private.is_admin((select auth.uid())));

alter table public.commerce_coupon_subscription_templates enable row level security;
alter table public.commerce_coupon_subscription_templates force row level security;
drop policy if exists commerce_coupon_templates_admin_select on public.commerce_coupon_subscription_templates;
create policy commerce_coupon_templates_admin_select on public.commerce_coupon_subscription_templates
  for select to authenticated using (private.is_admin((select auth.uid())));

create or replace function public.next_commerce_coupon_id()
returns text
language sql
stable
set search_path = pg_catalog, public
as $$
  select 'CPN-' || lpad((coalesce(max(substring(id from '^CPN-([0-9]+)$')::integer), 0) + 1)::text, 4, '0')
  from public.commerce_coupons
  where id ~ '^CPN-[0-9]+$';
$$;

create or replace function public.next_commerce_coupon_template_id()
returns text
language sql
stable
set search_path = pg_catalog, public
as $$
  select 'CPT-' || lpad((coalesce(max(substring(id from '^CPT-([0-9]+)$')::integer), 0) + 1)::text, 4, '0')
  from public.commerce_coupon_subscription_templates
  where id ~ '^CPT-[0-9]+$';
$$;

revoke all on function public.next_commerce_coupon_id() from public;
revoke all on function public.next_commerce_coupon_template_id() from public;

insert into public.commerce_coupons (
  id, coupon_name, coupon_kind, coupon_status, issue_state, issue_target_type,
  target_group_ids, target_group_names, target_user_ids, auto_issue_trigger_type,
  code_generation_mode, coupon_code, code_count, audience, benefit_type,
  benefit_value, min_order_amount, max_discount_amount, applicable_scope,
  is_stackable, is_secret_coupon, issue_limit_mode, issue_limit,
  download_limit_mode, download_limit, usage_limit_mode, usage_limit,
  validity_mode, valid_from, valid_until, expire_after_days,
  linked_message_template_id, linked_message_template_name,
  linked_crm_campaign_id, linked_crm_campaign_name, linked_event_id,
  linked_event_name, download_url, issue_count, download_count, use_count,
  last_issued_at, last_downloaded_at, last_used_at, policy_notes, admin_memo,
  issue_alert, expire_alert, created_at, updated_at, updated_by
) values
  ('CPN-0001','채널 친구 추가 시크릿 쿠폰','customerDownload','active','normal','allMembers','[]','[]','[]',null,null,'',null,null,'amountDiscount',3000,10000,null,'allProducts',false,true,'limited',3000,'limited',3000,'limited',1,'afterIssued','2026-03-01','2026-05-31',14,'PUSH-MAN-002','주말 캠페인 안내','','','EVT-COUPON-001','봄맞이 쿠폰 랜딩','https://topik.ai/coupons/cpn-0001',1280,984,462,'2026-03-24 18:10:00+09','2026-03-24 18:20:00+09','2026-03-24 19:40:00+09','["고객 다운로드 쿠폰은 링크 노출 위치를 함께 확인합니다."]','랜딩 메시지 CTA와 연결된 시크릿 쿠폰입니다.','{"enabled":true,"channel":"alimtalk","templateId":"PUSH-MAN-002","templateName":"주말 캠페인 안내","timingLabel":"다운로드 즉시"}','{"enabled":false,"channel":"webPush","templateId":"","templateName":"","timingLabel":"사용 안 함"}','2026-03-01 09:10:00+09','2026-03-24 19:40:00+09','admin_park'),
  ('CPN-0002','웰컴 쿠폰 10%','autoIssue','active','normal',null,'[]','[]','[]','firstSignup',null,'',null,null,'rateDiscount',10,15000,10000,'allProducts',false,false,'unlimited',null,'unlimited',null,'limited',1,'afterIssued','2026-03-01','2026-12-31',30,'MAIL-AUTO-001','가입 환영 메일','CRM-WELCOME-001','자동 발행 쿠폰 안내','EVT-COUPON-003','월간 혜택 프로모션','',820,0,314,'2026-03-25 09:00:00+09',null,'2026-03-25 11:15:00+09','["자동 발행 쿠폰은 트리거 조건을 함께 확인합니다."]','첫 회원가입 자동 발행과 CRM 안내를 함께 검수합니다.','{"enabled":true,"channel":"alimtalk","templateId":"MAIL-AUTO-001","templateName":"가입 환영 메일","timingLabel":"발급 즉시"}','{"enabled":true,"channel":"alimtalk","templateId":"MAIL-AUTO-002","templateName":"결제 실패 리마인드","timingLabel":"만료 1일 전"}','2026-03-02 11:00:00+09','2026-03-25 11:15:00+09','admin_kim'),
  ('CPN-0003','생일 축하 쿠폰','autoIssue','active','paused',null,'[]','[]','[]','birthday',null,'',null,null,'amountDiscount',5000,30000,null,'allProducts',false,false,'unlimited',null,'unlimited',null,'limited',1,'afterIssued','2026-02-01','2026-12-31',7,'','','','','','','',105,0,24,'2026-03-10 00:10:00+09',null,'2026-03-12 14:55:00+09','["자동 발행 쿠폰은 트리거 조건을 함께 확인합니다."]','생년월일 누락 회원이 많아 발행 재개 전 데이터 검수가 필요합니다.','{"enabled":false,"channel":"alimtalk","templateId":"","templateName":"","timingLabel":"사용 안 함"}','{"enabled":true,"channel":"webPush","templateId":"","templateName":"","timingLabel":"만료 1일 전"}','2026-02-01 09:00:00+09','2026-03-18 12:10:00+09','admin_lee'),
  ('CPN-0004','인플루언서 제휴 코드','couponCode','active','normal',null,'[]','[]','[]',null,'single','TOPIKTEST01',1,'memberAndGuest','amountDiscount',2000,15000,null,'allProducts',false,false,'unlimited',null,'unlimited',null,'limited',1,'fixedDate','2026-03-20','2026-04-20',null,'','','','','','','',84,0,27,null,null,'2026-03-24 20:05:00+09','["쿠폰 코드는 외부 노출 범위를 함께 확인합니다."]','제휴 코드 오사용 방지를 위해 대량 코드 수정은 허용하지 않습니다.','{"enabled":false,"channel":"webPush","templateId":"","templateName":"","timingLabel":"사용 안 함"}','{"enabled":false,"channel":"webPush","templateId":"","templateName":"","timingLabel":"사용 안 함"}','2026-03-20 13:00:00+09','2026-03-24 20:05:00+09','admin_park'),
  ('CPN-0005','리텐션 타깃 방문 쿠폰','manualIssue','waiting','normal','specificGroup','["GRP-002"]','["이탈 예정 강사"]','[]',null,null,'',null,null,'amountDiscount',4000,20000,null,'allProducts',true,false,'limited',1000,'unlimited',null,'limited',1,'fixedDate','2026-03-28','2026-04-05',null,'PUSH-AUTO-001','학습 독려 알림','CRM-MANUAL-001','지정 발행 쿠폰 알림','EVT-COUPON-002','장바구니 CRM 리텐션','',0,0,0,null,null,null,'["지정 발행 쿠폰은 대상 그룹을 함께 확인합니다."]','최근 구매 이탈 그룹에만 발행 예정입니다.','{"enabled":true,"channel":"webPush","templateId":"","templateName":"","timingLabel":"발급 즉시"}','{"enabled":true,"channel":"alimtalk","templateId":"MAIL-AUTO-002","templateName":"결제 실패 리마인드","timingLabel":"만료 1일 전"}','2026-03-24 16:10:00+09','2026-03-24 16:10:00+09','admin_kim'),
  ('CPN-0006','장바구니 리마인드 쿠폰','customerDownload','ended','normal','allMembers','[]','[]','[]',null,null,'',null,null,'amountDiscount',1000,5000,null,'allProducts',false,true,'unlimited',null,'unlimited',null,'limited',1,'afterIssued','2026-03-01','2026-03-20',3,'PUSH-MAN-001','학습 공지 푸시','CRM-CART-001','장바구니 상품 구매 유도','','','https://topik.ai/coupons/cpn-0006',620,410,188,'2026-03-19 22:30:00+09','2026-03-20 00:05:00+09','2026-03-20 11:20:00+09','["고객 다운로드 쿠폰은 링크 노출 위치를 함께 확인합니다."]','종료된 쿠폰이지만 운영 보기용으로 기록을 유지합니다.','{"enabled":true,"channel":"alimtalk","templateId":"PUSH-MAN-001","templateName":"학습 공지 푸시","timingLabel":"발급 즉시"}','{"enabled":false,"channel":"webPush","templateId":"","templateName":"","timingLabel":"사용 안 함"}','2026-03-01 18:20:00+09','2026-03-20 11:20:00+09','admin_park')
on conflict (id) do nothing;

insert into public.commerce_coupon_subscription_templates (
  id, template_name, issue_target_type, target_grade_ids, target_grade_names,
  benefit_type, benefit_value, min_order_amount, max_discount_amount,
  applicable_scope, applicable_scope_reference_ids, applicable_scope_reference_names,
  excluded_product_mode, excluded_product_ids, excluded_product_names,
  is_stackable, issue_schedule, usage_end_schedule, status, issued_coupon_count,
  last_issued_at, next_issued_at, issue_alert_enabled, expire_alert_enabled,
  alert_channel, admin_memo, policy_notes, created_at, updated_at, updated_by
) values
  ('CPT-0001','웰컴 회원 정기 쿠폰','shoppingGrade','["SHOP-GRADE-WELCOME"]','["웰컴"]','amountDiscount',3000,10000,null,'allProducts','[]','[]','none','[]','[]',false,'{"dayOfMonth":1,"hour":7,"minute":0}','{"dayOfMonth":28,"hour":23,"minute":59}','active',1820,'2026-03-01 07:00:00+09','2026-04-01 07:00:00+09',true,false,'webAppPush','웰컴 등급 대상 월별 리텐션 쿠폰입니다.','["정기 쿠폰은 대상 등급과 사용 종료 일정을 함께 확인합니다."]','2026-01-02 10:30:00+09','2026-03-24 14:10:00+09','admin_kim'),
  ('CPT-0002','VIP 재구매 유도 쿠폰','shoppingGrade','["SHOP-GRADE-VIP"]','["VIP"]','rateDiscount',12,30000,15000,'specificCategory','["CAT-TOPIK-READING","CAT-TOPIK-SPEAKING"]','["TOPIK 읽기","TOPIK 말하기"]','specific','["PRD-COURSE-003"]','["TOPIK 집중 과정"]',true,'{"dayOfMonth":1,"hour":7,"minute":0}','{"dayOfMonth":21,"hour":23,"minute":30}','paused',420,'2026-02-01 07:00:00+09','2026-04-01 07:00:00+09',true,true,'webAppPush','VIP 등급 전환 프로모션과 겹치지 않도록 3월 발행을 중지했습니다.','["정기 쿠폰은 대상 등급과 사용 종료 일정을 함께 확인합니다."]','2026-01-10 09:20:00+09','2026-03-10 18:05:00+09','admin_park')
on conflict (id) do nothing;

create or replace function public.admin_save_commerce_coupon(
  p_id text,
  p_coupon jsonb,
  p_reason text
)
returns text
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  caller_id uuid := auth.uid();
  v_id text;
  v_old public.commerce_coupons%rowtype;
  v_saved public.commerce_coupons%rowtype;
  v_is_create boolean := nullif(btrim(coalesce(p_id, '')), '') is null;
begin
  if caller_id is null then raise exception 'unauthenticated'; end if;
  if not private.is_admin(caller_id) then raise exception 'forbidden: admin required'; end if;
  if nullif(btrim(coalesce(p_reason, '')), '') is null then raise exception 'reason required (operational reason)'; end if;
  if nullif(btrim(coalesce(p_coupon->>'coupon_name', '')), '') is null then raise exception 'coupon_name required'; end if;

  if v_is_create then
    perform pg_advisory_xact_lock(hashtext('commerce_coupon_id'));
    v_id := public.next_commerce_coupon_id();
  else
    v_id := btrim(p_id);
    select * into v_old from public.commerce_coupons where id = v_id for update;
    if not found then raise exception 'unknown commerce coupon id: %', v_id; end if;
  end if;

  insert into public.commerce_coupons (
    id, coupon_name, coupon_kind, coupon_status, issue_state, issue_target_type,
    target_group_ids, target_user_ids, auto_issue_trigger_type,
    code_generation_mode, coupon_code, code_count, audience, benefit_type,
    benefit_value, min_order_amount, max_discount_amount, applicable_scope,
    is_stackable, is_secret_coupon, issue_limit_mode, issue_limit,
    download_limit_mode, download_limit, usage_limit_mode, usage_limit,
    validity_mode, valid_from, valid_until, expire_after_days,
    linked_message_template_id, linked_crm_campaign_id, linked_event_id,
    admin_memo, issue_alert, expire_alert, updated_by
  ) values (
    v_id,
    btrim(p_coupon->>'coupon_name'),
    p_coupon->>'coupon_kind',
    coalesce(p_coupon->>'coupon_status', 'waiting'),
    coalesce(p_coupon->>'issue_state', 'normal'),
    nullif(p_coupon->>'issue_target_type', ''),
    coalesce(p_coupon->'target_group_ids', '[]'::jsonb),
    coalesce(p_coupon->'target_user_ids', '[]'::jsonb),
    nullif(p_coupon->>'auto_issue_trigger_type', ''),
    nullif(p_coupon->>'code_generation_mode', ''),
    coalesce(p_coupon->>'coupon_code', ''),
    nullif(p_coupon->>'code_count', '')::integer,
    nullif(p_coupon->>'audience', ''),
    p_coupon->>'benefit_type',
    coalesce((p_coupon->>'benefit_value')::integer, 0),
    coalesce((p_coupon->>'min_order_amount')::integer, 0),
    nullif(p_coupon->>'max_discount_amount', '')::integer,
    coalesce(p_coupon->>'applicable_scope', 'allProducts'),
    coalesce((p_coupon->>'is_stackable')::boolean, false),
    coalesce((p_coupon->>'is_secret_coupon')::boolean, false),
    coalesce(p_coupon->>'issue_limit_mode', 'unlimited'),
    nullif(p_coupon->>'issue_limit', '')::integer,
    coalesce(p_coupon->>'download_limit_mode', 'unlimited'),
    nullif(p_coupon->>'download_limit', '')::integer,
    coalesce(p_coupon->>'usage_limit_mode', 'unlimited'),
    nullif(p_coupon->>'usage_limit', '')::integer,
    coalesce(p_coupon->>'validity_mode', 'fixedDate'),
    nullif(p_coupon->>'valid_from', '')::date,
    nullif(p_coupon->>'valid_until', '')::date,
    nullif(p_coupon->>'expire_after_days', '')::integer,
    coalesce(p_coupon->>'linked_message_template_id', ''),
    coalesce(p_coupon->>'linked_crm_campaign_id', ''),
    coalesce(p_coupon->>'linked_event_id', ''),
    coalesce(p_coupon->>'admin_memo', ''),
    coalesce(p_coupon->'issue_alert', '{}'::jsonb),
    coalesce(p_coupon->'expire_alert', '{}'::jsonb),
    caller_id::text
  )
  on conflict (id) do update set
    coupon_name = excluded.coupon_name,
    coupon_kind = excluded.coupon_kind,
    coupon_status = excluded.coupon_status,
    issue_state = excluded.issue_state,
    issue_target_type = excluded.issue_target_type,
    target_group_ids = excluded.target_group_ids,
    target_user_ids = excluded.target_user_ids,
    auto_issue_trigger_type = excluded.auto_issue_trigger_type,
    code_generation_mode = excluded.code_generation_mode,
    coupon_code = excluded.coupon_code,
    code_count = excluded.code_count,
    audience = excluded.audience,
    benefit_type = excluded.benefit_type,
    benefit_value = excluded.benefit_value,
    min_order_amount = excluded.min_order_amount,
    max_discount_amount = excluded.max_discount_amount,
    applicable_scope = excluded.applicable_scope,
    is_stackable = excluded.is_stackable,
    is_secret_coupon = excluded.is_secret_coupon,
    issue_limit_mode = excluded.issue_limit_mode,
    issue_limit = excluded.issue_limit,
    download_limit_mode = excluded.download_limit_mode,
    download_limit = excluded.download_limit,
    usage_limit_mode = excluded.usage_limit_mode,
    usage_limit = excluded.usage_limit,
    validity_mode = excluded.validity_mode,
    valid_from = excluded.valid_from,
    valid_until = excluded.valid_until,
    expire_after_days = excluded.expire_after_days,
    linked_message_template_id = excluded.linked_message_template_id,
    linked_crm_campaign_id = excluded.linked_crm_campaign_id,
    linked_event_id = excluded.linked_event_id,
    admin_memo = excluded.admin_memo,
    issue_alert = excluded.issue_alert,
    expire_alert = excluded.expire_alert,
    updated_at = now(),
    updated_by = excluded.updated_by
  returning * into v_saved;

  insert into public.admin_audit_logs (admin_user_id, action, target_table, target_id, diff, payload)
  values (
    caller_id, 'coupon_saved', 'CommerceCoupon', v_id,
    case when v_is_create then '{}'::jsonb else jsonb_build_object('coupon_status', jsonb_build_object('from', v_old.coupon_status, 'to', v_saved.coupon_status)) end,
    jsonb_build_object('reason', p_reason, 'coupon_name', v_saved.coupon_name, 'coupon_kind', v_saved.coupon_kind)
  );
  return v_id;
end;
$$;

create or replace function public.admin_duplicate_commerce_coupon(
  p_coupon_id text,
  p_reason text
)
returns text
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  caller_id uuid := auth.uid();
  v_source public.commerce_coupons%rowtype;
  v_id text;
begin
  if caller_id is null then raise exception 'unauthenticated'; end if;
  if not private.is_admin(caller_id) then raise exception 'forbidden: admin required'; end if;
  if nullif(btrim(coalesce(p_reason, '')), '') is null then raise exception 'reason required (operational reason)'; end if;
  select * into v_source from public.commerce_coupons where id = p_coupon_id for update;
  if not found then raise exception 'unknown commerce coupon id: %', p_coupon_id; end if;

  perform pg_advisory_xact_lock(hashtext('commerce_coupon_id'));
  v_id := public.next_commerce_coupon_id();
  insert into public.commerce_coupons
  select v_id, coupon_name || ' 복사본', coupon_kind, 'waiting', 'normal',
         issue_target_type, target_group_ids, target_group_names, target_user_ids,
         auto_issue_trigger_type, code_generation_mode, coupon_code, code_count,
         audience, benefit_type, benefit_value, min_order_amount, max_discount_amount,
         applicable_scope, applicable_scope_reference_ids, excluded_product_ids,
         is_stackable, is_secret_coupon, issue_limit_mode, issue_limit,
         download_limit_mode, download_limit, usage_limit_mode, usage_limit,
         validity_mode, valid_from, valid_until, expire_after_days,
         linked_message_template_id, linked_message_template_name,
         linked_crm_campaign_id, linked_crm_campaign_name, linked_event_id,
         linked_event_name, download_url, 0, 0, 0, null, null, null,
         policy_notes, admin_memo, issue_alert, expire_alert, now(), now(), caller_id::text
    from public.commerce_coupons
   where id = p_coupon_id;

  insert into public.admin_audit_logs (admin_user_id, action, target_table, target_id, diff, payload)
  values (caller_id, 'coupon_duplicated', 'CommerceCoupon', v_id, '{}'::jsonb,
          jsonb_build_object('reason', p_reason, 'source_id', p_coupon_id, 'coupon_name', v_source.coupon_name));
  return v_id;
end;
$$;

create or replace function public.admin_set_commerce_coupon_issue_state(
  p_coupon_id text,
  p_state text,
  p_reason text
)
returns text
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  caller_id uuid := auth.uid();
  v_old public.commerce_coupons%rowtype;
  v_action text;
begin
  if caller_id is null then raise exception 'unauthenticated'; end if;
  if not private.is_admin(caller_id) then raise exception 'forbidden: admin required'; end if;
  if nullif(btrim(coalesce(p_reason, '')), '') is null then raise exception 'reason required (operational reason)'; end if;
  if p_state not in ('normal','paused') then raise exception 'invalid coupon issue state: %', p_state; end if;
  select * into v_old from public.commerce_coupons where id = p_coupon_id for update;
  if not found then raise exception 'unknown commerce coupon id: %', p_coupon_id; end if;
  if v_old.coupon_kind <> 'autoIssue' then raise exception 'only autoIssue coupons can change issue state'; end if;

  update public.commerce_coupons
     set issue_state = p_state, updated_at = now(), updated_by = caller_id::text
   where id = p_coupon_id;

  v_action := case when p_state = 'paused' then 'coupon_paused' else 'coupon_resumed' end;
  insert into public.admin_audit_logs (admin_user_id, action, target_table, target_id, diff, payload)
  values (caller_id, v_action, 'CommerceCoupon', p_coupon_id,
          jsonb_build_object('issue_state', jsonb_build_object('from', v_old.issue_state, 'to', p_state)),
          jsonb_build_object('reason', p_reason, 'coupon_name', v_old.coupon_name));
  return p_coupon_id;
end;
$$;

create or replace function public.admin_delete_commerce_coupon(
  p_coupon_id text,
  p_reason text
)
returns text
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  caller_id uuid := auth.uid();
  v_old public.commerce_coupons%rowtype;
begin
  if caller_id is null then raise exception 'unauthenticated'; end if;
  if not private.is_admin(caller_id) then raise exception 'forbidden: admin required'; end if;
  if nullif(btrim(coalesce(p_reason, '')), '') is null then raise exception 'reason required (operational reason)'; end if;
  select * into v_old from public.commerce_coupons where id = p_coupon_id for update;
  if not found then raise exception 'unknown commerce coupon id: %', p_coupon_id; end if;
  delete from public.commerce_coupons where id = p_coupon_id;
  insert into public.admin_audit_logs (admin_user_id, action, target_table, target_id, diff, payload)
  values (caller_id, 'coupon_deleted', 'CommerceCoupon', p_coupon_id, to_jsonb(v_old), jsonb_build_object('reason', p_reason, 'coupon_name', v_old.coupon_name));
  return p_coupon_id;
end;
$$;

create or replace function public.admin_save_commerce_coupon_template(
  p_id text,
  p_template jsonb,
  p_reason text
)
returns text
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  caller_id uuid := auth.uid();
  v_id text;
  v_old public.commerce_coupon_subscription_templates%rowtype;
  v_saved public.commerce_coupon_subscription_templates%rowtype;
  v_is_create boolean := nullif(btrim(coalesce(p_id, '')), '') is null;
begin
  if caller_id is null then raise exception 'unauthenticated'; end if;
  if not private.is_admin(caller_id) then raise exception 'forbidden: admin required'; end if;
  if nullif(btrim(coalesce(p_reason, '')), '') is null then raise exception 'reason required (operational reason)'; end if;
  if nullif(btrim(coalesce(p_template->>'template_name', '')), '') is null then raise exception 'template_name required'; end if;

  if v_is_create then
    perform pg_advisory_xact_lock(hashtext('commerce_coupon_template_id'));
    v_id := public.next_commerce_coupon_template_id();
  else
    v_id := btrim(p_id);
    select * into v_old from public.commerce_coupon_subscription_templates where id = v_id for update;
    if not found then raise exception 'unknown commerce coupon template id: %', v_id; end if;
  end if;

  insert into public.commerce_coupon_subscription_templates (
    id, template_name, target_grade_ids, benefit_type, benefit_value,
    min_order_amount, max_discount_amount, applicable_scope,
    applicable_scope_reference_ids, excluded_product_mode, excluded_product_ids,
    is_stackable, issue_schedule, usage_end_schedule, status,
    issue_alert_enabled, expire_alert_enabled, alert_channel, admin_memo,
    updated_by
  ) values (
    v_id,
    btrim(p_template->>'template_name'),
    coalesce(p_template->'target_grade_ids', '[]'::jsonb),
    p_template->>'benefit_type',
    coalesce((p_template->>'benefit_value')::integer, 0),
    coalesce((p_template->>'min_order_amount')::integer, 0),
    nullif(p_template->>'max_discount_amount', '')::integer,
    coalesce(p_template->>'applicable_scope', 'allProducts'),
    coalesce(p_template->'applicable_scope_reference_ids', '[]'::jsonb),
    coalesce(p_template->>'excluded_product_mode', 'none'),
    coalesce(p_template->'excluded_product_ids', '[]'::jsonb),
    coalesce((p_template->>'is_stackable')::boolean, false),
    coalesce(p_template->'issue_schedule', '{"dayOfMonth":1,"hour":7,"minute":0}'::jsonb),
    coalesce(p_template->'usage_end_schedule', '{"dayOfMonth":28,"hour":23,"minute":59}'::jsonb),
    coalesce(p_template->>'status', 'active'),
    coalesce((p_template->>'issue_alert_enabled')::boolean, false),
    coalesce((p_template->>'expire_alert_enabled')::boolean, false),
    coalesce(p_template->>'alert_channel', 'webAppPush'),
    coalesce(p_template->>'admin_memo', ''),
    caller_id::text
  )
  on conflict (id) do update set
    template_name = excluded.template_name,
    target_grade_ids = excluded.target_grade_ids,
    benefit_type = excluded.benefit_type,
    benefit_value = excluded.benefit_value,
    min_order_amount = excluded.min_order_amount,
    max_discount_amount = excluded.max_discount_amount,
    applicable_scope = excluded.applicable_scope,
    applicable_scope_reference_ids = excluded.applicable_scope_reference_ids,
    excluded_product_mode = excluded.excluded_product_mode,
    excluded_product_ids = excluded.excluded_product_ids,
    is_stackable = excluded.is_stackable,
    issue_schedule = excluded.issue_schedule,
    usage_end_schedule = excluded.usage_end_schedule,
    status = excluded.status,
    issue_alert_enabled = excluded.issue_alert_enabled,
    expire_alert_enabled = excluded.expire_alert_enabled,
    alert_channel = excluded.alert_channel,
    admin_memo = excluded.admin_memo,
    updated_at = now(),
    updated_by = excluded.updated_by
  returning * into v_saved;

  insert into public.admin_audit_logs (admin_user_id, action, target_table, target_id, diff, payload)
  values (
    caller_id, 'coupon_template_saved', 'CommerceCouponTemplate', v_id,
    case when v_is_create then '{}'::jsonb else jsonb_build_object('status', jsonb_build_object('from', v_old.status, 'to', v_saved.status)) end,
    jsonb_build_object('reason', p_reason, 'template_name', v_saved.template_name)
  );
  return v_id;
end;
$$;

create or replace function public.admin_set_commerce_coupon_template_status(
  p_template_id text,
  p_status text,
  p_reason text
)
returns text
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  caller_id uuid := auth.uid();
  v_old public.commerce_coupon_subscription_templates%rowtype;
  v_action text;
begin
  if caller_id is null then raise exception 'unauthenticated'; end if;
  if not private.is_admin(caller_id) then raise exception 'forbidden: admin required'; end if;
  if nullif(btrim(coalesce(p_reason, '')), '') is null then raise exception 'reason required (operational reason)'; end if;
  if p_status not in ('active','paused') then raise exception 'invalid coupon template status: %', p_status; end if;
  select * into v_old from public.commerce_coupon_subscription_templates where id = p_template_id for update;
  if not found then raise exception 'unknown commerce coupon template id: %', p_template_id; end if;

  update public.commerce_coupon_subscription_templates
     set status = p_status, updated_at = now(), updated_by = caller_id::text
   where id = p_template_id;

  v_action := case when p_status = 'paused' then 'coupon_template_paused' else 'coupon_template_resumed' end;
  insert into public.admin_audit_logs (admin_user_id, action, target_table, target_id, diff, payload)
  values (caller_id, v_action, 'CommerceCouponTemplate', p_template_id,
          jsonb_build_object('status', jsonb_build_object('from', v_old.status, 'to', p_status)),
          jsonb_build_object('reason', p_reason, 'template_name', v_old.template_name));
  return p_template_id;
end;
$$;

create or replace function public.admin_delete_commerce_coupon_template(
  p_template_id text,
  p_reason text
)
returns text
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  caller_id uuid := auth.uid();
  v_old public.commerce_coupon_subscription_templates%rowtype;
begin
  if caller_id is null then raise exception 'unauthenticated'; end if;
  if not private.is_admin(caller_id) then raise exception 'forbidden: admin required'; end if;
  if nullif(btrim(coalesce(p_reason, '')), '') is null then raise exception 'reason required (operational reason)'; end if;
  select * into v_old from public.commerce_coupon_subscription_templates where id = p_template_id for update;
  if not found then raise exception 'unknown commerce coupon template id: %', p_template_id; end if;
  delete from public.commerce_coupon_subscription_templates where id = p_template_id;
  insert into public.admin_audit_logs (admin_user_id, action, target_table, target_id, diff, payload)
  values (caller_id, 'coupon_template_deleted', 'CommerceCouponTemplate', p_template_id, to_jsonb(v_old), jsonb_build_object('reason', p_reason, 'template_name', v_old.template_name));
  return p_template_id;
end;
$$;

revoke all on function public.admin_save_commerce_coupon(text, jsonb, text) from public;
revoke all on function public.admin_duplicate_commerce_coupon(text, text) from public;
revoke all on function public.admin_set_commerce_coupon_issue_state(text, text, text) from public;
revoke all on function public.admin_delete_commerce_coupon(text, text) from public;
revoke all on function public.admin_save_commerce_coupon_template(text, jsonb, text) from public;
revoke all on function public.admin_set_commerce_coupon_template_status(text, text, text) from public;
revoke all on function public.admin_delete_commerce_coupon_template(text, text) from public;
grant execute on function public.admin_save_commerce_coupon(text, jsonb, text) to authenticated;
grant execute on function public.admin_duplicate_commerce_coupon(text, text) to authenticated;
grant execute on function public.admin_set_commerce_coupon_issue_state(text, text, text) to authenticated;
grant execute on function public.admin_delete_commerce_coupon(text, text) to authenticated;
grant execute on function public.admin_save_commerce_coupon_template(text, jsonb, text) to authenticated;
grant execute on function public.admin_set_commerce_coupon_template_status(text, text, text) to authenticated;
grant execute on function public.admin_delete_commerce_coupon_template(text, text) to authenticated;
