-- =====================================================================
-- topik-ai admin - Operation FAQ - admin-0010
-- Operation FAQ tables + admin RPC single write path.
--
-- Contract SoT: docs/specs/admin-data-contract.md
-- Ownership:    docs/architecture/shared-supabase-schema-ownership.md
--               (tracker: admin_schema_migrations, separate from topik_writing)
-- RLS model: read = admin(private.is_admin), write = no policies(RPC only).
-- DB enums use ASCII where the UI has Korean labels.
-- down: supabase/migrations-admin/down/20260617123000_operation_faqs.sql
-- =====================================================================

create table if not exists public.operation_faqs (
  id              text primary key,
  question        text not null,
  answer          text not null,
  search_keywords jsonb not null default '[]'::jsonb,
  category        text not null,
  status          text not null default 'hidden',
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  updated_by      text
);

alter table public.operation_faqs
  drop constraint if exists operation_faqs_search_keywords_array_check;
alter table public.operation_faqs
  add constraint operation_faqs_search_keywords_array_check
  check (jsonb_typeof(search_keywords) = 'array');

alter table public.operation_faqs
  drop constraint if exists operation_faqs_category_check;
alter table public.operation_faqs
  add constraint operation_faqs_category_check
  check (category in ('계정','결제','커뮤니티','메시지'));

alter table public.operation_faqs
  drop constraint if exists operation_faqs_status_check;
alter table public.operation_faqs
  add constraint operation_faqs_status_check
  check (status in ('published','hidden'));

create index if not exists operation_faqs_created_desc
  on public.operation_faqs (created_at desc);

create index if not exists operation_faqs_published_created
  on public.operation_faqs (created_at desc)
  where status = 'published';

comment on table public.operation_faqs is
  'Operation > FAQ SoT. status is published/hidden ASCII; UI labels are 공개/비공개. Writes go through admin RPC only.';

create table if not exists public.operation_faq_curations (
  id              text primary key,
  faq_id          text not null references public.operation_faqs(id) on delete cascade,
  surface         text not null,
  curation_mode   text not null,
  display_rank    smallint not null,
  exposure_status text not null,
  pinned_start_at date,
  pinned_end_at   date,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  updated_by      text
);

alter table public.operation_faq_curations
  drop constraint if exists operation_faq_curations_surface_check;
alter table public.operation_faq_curations
  add constraint operation_faq_curations_surface_check
  check (surface in ('help_center','home_top','payment_help','onboarding'));

alter table public.operation_faq_curations
  drop constraint if exists operation_faq_curations_mode_check;
alter table public.operation_faq_curations
  add constraint operation_faq_curations_mode_check
  check (curation_mode in ('manual','auto'));

alter table public.operation_faq_curations
  drop constraint if exists operation_faq_curations_exposure_status_check;
alter table public.operation_faq_curations
  add constraint operation_faq_curations_exposure_status_check
  check (exposure_status in ('active','paused'));

alter table public.operation_faq_curations
  drop constraint if exists operation_faq_curations_display_rank_check;
alter table public.operation_faq_curations
  add constraint operation_faq_curations_display_rank_check
  check (display_rank > 0);

alter table public.operation_faq_curations
  drop constraint if exists operation_faq_curations_pinned_date_order_check;
alter table public.operation_faq_curations
  add constraint operation_faq_curations_pinned_date_order_check
  check (pinned_start_at is null or pinned_end_at is null or pinned_start_at <= pinned_end_at);

alter table public.operation_faq_curations
  drop constraint if exists operation_faq_curations_surface_rank_key;
alter table public.operation_faq_curations
  add constraint operation_faq_curations_surface_rank_key
  unique (surface, display_rank);

create index if not exists operation_faq_curations_faq_id
  on public.operation_faq_curations (faq_id);

comment on table public.operation_faq_curations is
  'Operation > FAQ curation SoT. A surface/display_rank pair is globally unique. Writes go through admin RPC only.';

create table if not exists public.operation_faq_metrics (
  faq_id             text primary key references public.operation_faqs(id) on delete cascade,
  view_count         integer not null default 0,
  search_hit_count   integer not null default 0,
  helpful_count      integer not null default 0,
  not_helpful_count  integer not null default 0,
  last_viewed_at     timestamptz
);

alter table public.operation_faq_metrics
  drop constraint if exists operation_faq_metrics_non_negative_check;
alter table public.operation_faq_metrics
  add constraint operation_faq_metrics_non_negative_check
  check (
    view_count >= 0
    and search_hit_count >= 0
    and helpful_count >= 0
    and not_helpful_count >= 0
  );

comment on table public.operation_faq_metrics is
  'Operation > FAQ metric read model. Admin has no standalone write RPC; seed/read only in this migration.';

alter table public.operation_faqs enable row level security;
alter table public.operation_faqs force row level security;
drop policy if exists operation_faqs_admin_select on public.operation_faqs;
create policy operation_faqs_admin_select on public.operation_faqs
  for select to authenticated using (private.is_admin((select auth.uid())));

alter table public.operation_faq_curations enable row level security;
alter table public.operation_faq_curations force row level security;
drop policy if exists operation_faq_curations_admin_select on public.operation_faq_curations;
create policy operation_faq_curations_admin_select on public.operation_faq_curations
  for select to authenticated using (private.is_admin((select auth.uid())));

alter table public.operation_faq_metrics enable row level security;
alter table public.operation_faq_metrics force row level security;
drop policy if exists operation_faq_metrics_admin_select on public.operation_faq_metrics;
create policy operation_faq_metrics_admin_select on public.operation_faq_metrics
  for select to authenticated using (private.is_admin((select auth.uid())));

insert into public.operation_faqs (
  id, question, answer, search_keywords, category, status, created_at, updated_at, updated_by
) values
  (
    'FAQ-001',
    '결제 오류가 발생하면 어떤 정보를 먼저 확인해야 하나요?',
    '결제 ID, 결제 수단, 시도 시각을 확인한 뒤 결제 내역과 시스템 로그를 함께 조회합니다.',
    jsonb_build_array('결제 오류', '결제 실패', '카드 결제'),
    '결제',
    'published',
    '2026-03-08 00:00:00+09'::timestamptz,
    '2026-03-08 11:20:00+09'::timestamptz,
    'admin_park'
  ),
  (
    'FAQ-002',
    '회원 정지 처리 후 어떤 로그를 확인해야 하나요?',
    '회원 상세에서 조치 사유를 기록한 뒤 감사 로그에서 대상 유형, 대상 ID, 수행자를 확인합니다.',
    jsonb_build_array('회원 정지', '계정 정지', '감사 로그'),
    '계정',
    'published',
    '2026-03-05 00:00:00+09'::timestamptz,
    '2026-03-05 14:10:00+09'::timestamptz,
    'admin_kim'
  ),
  (
    'FAQ-003',
    '메시지 발송 실패 건은 어디서 재시도하나요?',
    '메시지 발송 이력 상세 Drawer에서 실패 수신자와 실패 원인을 확인한 뒤 재시도 발송을 실행합니다.',
    jsonb_build_array('메시지 실패', '푸시 실패', '메일 재시도'),
    '메시지',
    'hidden',
    '2026-03-03 00:00:00+09'::timestamptz,
    '2026-03-03 09:40:00+09'::timestamptz,
    'admin_kim'
  )
on conflict (id) do nothing;

insert into public.operation_faq_curations (
  id, faq_id, surface, curation_mode, display_rank, exposure_status,
  pinned_start_at, pinned_end_at, created_at, updated_at, updated_by
) values
  (
    'FAQCUR-001',
    'FAQ-001',
    'help_center',
    'manual',
    1,
    'active',
    '2026-03-20'::date,
    null,
    '2026-03-20 10:00:00+09'::timestamptz,
    '2026-03-20 10:00:00+09'::timestamptz,
    'admin_park'
  ),
  (
    'FAQCUR-002',
    'FAQ-002',
    'home_top',
    'manual',
    2,
    'active',
    '2026-03-21'::date,
    null,
    '2026-03-21 09:30:00+09'::timestamptz,
    '2026-03-21 09:30:00+09'::timestamptz,
    'admin_kim'
  ),
  (
    'FAQCUR-003',
    'FAQ-001',
    'payment_help',
    'auto',
    1,
    'active',
    '2026-03-18'::date,
    null,
    '2026-03-22 15:20:00+09'::timestamptz,
    '2026-03-22 15:20:00+09'::timestamptz,
    'admin_park'
  )
on conflict (id) do nothing;

insert into public.operation_faq_metrics (
  faq_id, view_count, search_hit_count, helpful_count, not_helpful_count, last_viewed_at
) values
  ('FAQ-001', 842, 214, 122, 11, '2026-03-23 09:10:00+09'::timestamptz),
  ('FAQ-002', 615, 167, 93, 14, '2026-03-23 08:40:00+09'::timestamptz),
  ('FAQ-003', 148, 42, 19, 7, '2026-03-22 18:05:00+09'::timestamptz)
on conflict (faq_id) do nothing;

create or replace function public.admin_save_operation_faq(
  p_id     text,
  p_faq    jsonb,
  p_reason text
)
returns text
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  caller_id  uuid := auth.uid();
  v_id       text;
  v_question text;
  v_answer   text;
  v_keywords jsonb;
  v_category text;
  v_status   text;
  v_old      public.operation_faqs%rowtype;
  v_diff     jsonb := '{}'::jsonb;
begin
  if caller_id is null then raise exception 'unauthenticated'; end if;
  if not private.is_admin(caller_id) then raise exception 'forbidden: admin required'; end if;
  if nullif(btrim(coalesce(p_reason, '')), '') is null then
    raise exception 'reason required (operational reason)';
  end if;

  v_question := nullif(btrim(coalesce(p_faq->>'question', '')), '');
  v_answer := nullif(btrim(coalesce(p_faq->>'answer', '')), '');
  v_keywords := coalesce(p_faq->'search_keywords', '[]'::jsonb);
  v_category := nullif(btrim(coalesce(p_faq->>'category', '')), '');
  v_status := coalesce(nullif(btrim(coalesce(p_faq->>'status', '')), ''), 'hidden');

  if v_question is null then raise exception 'question required'; end if;
  if v_answer is null then raise exception 'answer required'; end if;
  if jsonb_typeof(v_keywords) <> 'array' then raise exception 'search_keywords must be a JSON array'; end if;
  if v_category is null or v_category not in ('계정','결제','커뮤니티','메시지') then
    raise exception 'invalid category: %', v_category;
  end if;
  if v_status not in ('published','hidden') then
    raise exception 'invalid status: %', v_status;
  end if;

  if nullif(btrim(coalesce(p_id, '')), '') is null then
    select 'FAQ-' || lpad((coalesce(max(substring(id from '^FAQ-([0-9]+)$')::integer), 0) + 1)::text, 3, '0')
      into v_id
      from public.operation_faqs
     where id ~ '^FAQ-[0-9]+$';

    insert into public.operation_faqs (
      id, question, answer, search_keywords, category, status, updated_by
    ) values (
      v_id, v_question, v_answer, v_keywords, v_category, v_status, caller_id::text
    );

    v_diff := jsonb_build_object(
      'question', jsonb_build_object('from', null, 'to', v_question),
      'answer', jsonb_build_object('from', null, 'to', v_answer),
      'search_keywords', jsonb_build_object('from', null, 'to', v_keywords),
      'category', jsonb_build_object('from', null, 'to', v_category),
      'status', jsonb_build_object('from', null, 'to', v_status)
    );
  else
    v_id := btrim(p_id);

    select * into v_old
      from public.operation_faqs
     where id = v_id
     for update;
    if not found then raise exception 'unknown faq id: %', v_id; end if;

    if v_old.question is distinct from v_question then
      v_diff := v_diff || jsonb_build_object(
        'question', jsonb_build_object('from', v_old.question, 'to', v_question)
      );
    end if;
    if v_old.answer is distinct from v_answer then
      v_diff := v_diff || jsonb_build_object(
        'answer', jsonb_build_object('from', v_old.answer, 'to', v_answer)
      );
    end if;
    if v_old.search_keywords is distinct from v_keywords then
      v_diff := v_diff || jsonb_build_object(
        'search_keywords', jsonb_build_object('from', v_old.search_keywords, 'to', v_keywords)
      );
    end if;
    if v_old.category is distinct from v_category then
      v_diff := v_diff || jsonb_build_object(
        'category', jsonb_build_object('from', v_old.category, 'to', v_category)
      );
    end if;
    if v_old.status is distinct from v_status then
      v_diff := v_diff || jsonb_build_object(
        'status', jsonb_build_object('from', v_old.status, 'to', v_status)
      );
    end if;

    update public.operation_faqs
       set question = v_question,
           answer = v_answer,
           search_keywords = v_keywords,
           category = v_category,
           status = v_status,
           updated_by = caller_id::text,
           updated_at = now()
     where id = v_id;

    if v_status = 'hidden' then
      update public.operation_faq_curations
         set exposure_status = 'paused',
             updated_by = caller_id::text,
             updated_at = now()
       where faq_id = v_id
         and exposure_status <> 'paused';
    end if;
  end if;

  insert into public.admin_audit_logs (admin_user_id, action, target_table, target_id, diff, payload)
  values (
    caller_id,
    'faq_saved',
    'OperationFaq',
    v_id,
    v_diff,
    jsonb_build_object(
      'reason', p_reason,
      'mode', case when nullif(btrim(coalesce(p_id, '')), '') is null then 'create' else 'update' end,
      'question', v_question,
      'category', v_category,
      'status', v_status
    )
  );

  return v_id;
end;
$$;
revoke all on function public.admin_save_operation_faq(text, jsonb, text) from public;
grant execute on function public.admin_save_operation_faq(text, jsonb, text) to authenticated;

create or replace function public.admin_toggle_operation_faq_status(
  p_faq_id      text,
  p_next_status text,
  p_reason      text
)
returns text
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  caller_id              uuid := auth.uid();
  v_old                  public.operation_faqs%rowtype;
  v_paused_curation_ids  jsonb := '[]'::jsonb;
begin
  if caller_id is null then raise exception 'unauthenticated'; end if;
  if not private.is_admin(caller_id) then raise exception 'forbidden: admin required'; end if;
  if nullif(btrim(coalesce(p_reason, '')), '') is null then
    raise exception 'reason required (operational reason)';
  end if;
  if p_next_status not in ('published','hidden') then
    raise exception 'invalid status: %', p_next_status;
  end if;

  select * into v_old
    from public.operation_faqs
   where id = p_faq_id
   for update;
  if not found then raise exception 'unknown faq id: %', p_faq_id; end if;
  if v_old.status = p_next_status then
    raise exception 'faq already %', p_next_status;
  end if;

  update public.operation_faqs
     set status = p_next_status,
         updated_by = caller_id::text,
         updated_at = now()
   where id = p_faq_id;

  if p_next_status = 'hidden' then
    with paused as (
      update public.operation_faq_curations
         set exposure_status = 'paused',
             updated_by = caller_id::text,
             updated_at = now()
       where faq_id = p_faq_id
         and exposure_status <> 'paused'
       returning id
    )
    select coalesce(jsonb_agg(id), '[]'::jsonb)
      into v_paused_curation_ids
      from paused;
  end if;

  insert into public.admin_audit_logs (admin_user_id, action, target_table, target_id, diff, payload)
  values (
    caller_id,
    'faq_status_changed',
    'OperationFaq',
    p_faq_id,
    jsonb_build_object('status', jsonb_build_object('from', v_old.status, 'to', p_next_status)),
    jsonb_build_object(
      'reason', p_reason,
      'question', v_old.question,
      'paused_curation_ids', v_paused_curation_ids
    )
  );

  return p_faq_id;
end;
$$;
revoke all on function public.admin_toggle_operation_faq_status(text, text, text) from public;
grant execute on function public.admin_toggle_operation_faq_status(text, text, text) to authenticated;

create or replace function public.admin_delete_operation_faq(
  p_faq_id text,
  p_reason text
)
returns text
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  caller_id        uuid := auth.uid();
  v_old            public.operation_faqs%rowtype;
  v_curation_count integer := 0;
  v_metric_count   integer := 0;
begin
  if caller_id is null then raise exception 'unauthenticated'; end if;
  if not private.is_admin(caller_id) then raise exception 'forbidden: admin required'; end if;
  if nullif(btrim(coalesce(p_reason, '')), '') is null then
    raise exception 'reason required (operational reason)';
  end if;

  select * into v_old
    from public.operation_faqs
   where id = p_faq_id
   for update;
  if not found then raise exception 'unknown faq id: %', p_faq_id; end if;

  select count(*) into v_curation_count
    from public.operation_faq_curations
   where faq_id = p_faq_id;
  select count(*) into v_metric_count
    from public.operation_faq_metrics
   where faq_id = p_faq_id;

  delete from public.operation_faqs where id = p_faq_id;

  insert into public.admin_audit_logs (admin_user_id, action, target_table, target_id, payload)
  values (
    caller_id,
    'faq_deleted',
    'OperationFaq',
    p_faq_id,
    jsonb_build_object(
      'reason', p_reason,
      'question', v_old.question,
      'category', v_old.category,
      'status', v_old.status,
      'curation_count', v_curation_count,
      'metric_count', v_metric_count,
      'created_at', v_old.created_at,
      'updated_at', v_old.updated_at
    )
  );

  return p_faq_id;
end;
$$;
revoke all on function public.admin_delete_operation_faq(text, text) from public;
grant execute on function public.admin_delete_operation_faq(text, text) to authenticated;

create or replace function public.admin_save_operation_faq_curation(
  p_id       text,
  p_curation jsonb,
  p_reason   text
)
returns text
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  caller_id    uuid := auth.uid();
  v_id         text;
  v_faq_id     text;
  v_surface    text;
  v_mode       text;
  v_rank       smallint;
  v_exposure   text;
  v_start_at   date;
  v_end_at     date;
  v_faq        public.operation_faqs%rowtype;
  v_old        public.operation_faq_curations%rowtype;
  v_diff       jsonb := '{}'::jsonb;
begin
  if caller_id is null then raise exception 'unauthenticated'; end if;
  if not private.is_admin(caller_id) then raise exception 'forbidden: admin required'; end if;
  if nullif(btrim(coalesce(p_reason, '')), '') is null then
    raise exception 'reason required (operational reason)';
  end if;

  v_faq_id := nullif(btrim(coalesce(p_curation->>'faq_id', '')), '');
  v_surface := nullif(btrim(coalesce(p_curation->>'surface', '')), '');
  v_mode := nullif(btrim(coalesce(p_curation->>'curation_mode', '')), '');
  v_exposure := nullif(btrim(coalesce(p_curation->>'exposure_status', '')), '');
  v_start_at := nullif(btrim(coalesce(p_curation->>'pinned_start_at', '')), '')::date;
  v_end_at := nullif(btrim(coalesce(p_curation->>'pinned_end_at', '')), '')::date;

  begin
    v_rank := (p_curation->>'display_rank')::smallint;
  exception
    when invalid_text_representation or numeric_value_out_of_range then
      raise exception 'display_rank must be a smallint';
  end;

  if v_faq_id is null then raise exception 'faq_id required'; end if;
  if v_surface is null or v_surface not in ('help_center','home_top','payment_help','onboarding') then
    raise exception 'invalid surface: %', v_surface;
  end if;
  if v_mode is null or v_mode not in ('manual','auto') then
    raise exception 'invalid curation_mode: %', v_mode;
  end if;
  if v_exposure is null or v_exposure not in ('active','paused') then
    raise exception 'invalid exposure_status: %', v_exposure;
  end if;
  if v_rank is null or v_rank <= 0 then raise exception 'display_rank must be positive'; end if;
  if v_start_at is not null and v_end_at is not null and v_start_at > v_end_at then
    raise exception 'pinned_start_at must be before or equal to pinned_end_at';
  end if;

  select * into v_faq
    from public.operation_faqs
   where id = v_faq_id;
  if not found then raise exception 'unknown faq id: %', v_faq_id; end if;

  if v_exposure = 'active' and v_faq.status = 'hidden' then
    raise exception 'hidden faq cannot have active curation';
  end if;

  if nullif(btrim(coalesce(p_id, '')), '') is null then
    select 'FAQCUR-' || lpad((coalesce(max(substring(id from '^FAQCUR-([0-9]+)$')::integer), 0) + 1)::text, 3, '0')
      into v_id
      from public.operation_faq_curations
     where id ~ '^FAQCUR-[0-9]+$';

    if exists (
      select 1
        from public.operation_faq_curations
       where surface = v_surface
         and display_rank = v_rank
    ) then
      raise exception 'duplicate faq curation surface/display_rank';
    end if;

    insert into public.operation_faq_curations (
      id, faq_id, surface, curation_mode, display_rank, exposure_status,
      pinned_start_at, pinned_end_at, updated_by
    ) values (
      v_id, v_faq_id, v_surface, v_mode, v_rank, v_exposure,
      v_start_at, v_end_at, caller_id::text
    );

    v_diff := jsonb_build_object(
      'faq_id', jsonb_build_object('from', null, 'to', v_faq_id),
      'surface', jsonb_build_object('from', null, 'to', v_surface),
      'curation_mode', jsonb_build_object('from', null, 'to', v_mode),
      'display_rank', jsonb_build_object('from', null, 'to', v_rank),
      'exposure_status', jsonb_build_object('from', null, 'to', v_exposure),
      'pinned_start_at', jsonb_build_object('from', null, 'to', v_start_at),
      'pinned_end_at', jsonb_build_object('from', null, 'to', v_end_at)
    );
  else
    v_id := btrim(p_id);

    select * into v_old
      from public.operation_faq_curations
     where id = v_id
     for update;
    if not found then raise exception 'unknown faq curation id: %', v_id; end if;

    if exists (
      select 1
        from public.operation_faq_curations
       where surface = v_surface
         and display_rank = v_rank
         and id <> v_id
    ) then
      raise exception 'duplicate faq curation surface/display_rank';
    end if;

    if v_old.faq_id is distinct from v_faq_id then
      v_diff := v_diff || jsonb_build_object(
        'faq_id', jsonb_build_object('from', v_old.faq_id, 'to', v_faq_id)
      );
    end if;
    if v_old.surface is distinct from v_surface then
      v_diff := v_diff || jsonb_build_object(
        'surface', jsonb_build_object('from', v_old.surface, 'to', v_surface)
      );
    end if;
    if v_old.curation_mode is distinct from v_mode then
      v_diff := v_diff || jsonb_build_object(
        'curation_mode', jsonb_build_object('from', v_old.curation_mode, 'to', v_mode)
      );
    end if;
    if v_old.display_rank is distinct from v_rank then
      v_diff := v_diff || jsonb_build_object(
        'display_rank', jsonb_build_object('from', v_old.display_rank, 'to', v_rank)
      );
    end if;
    if v_old.exposure_status is distinct from v_exposure then
      v_diff := v_diff || jsonb_build_object(
        'exposure_status', jsonb_build_object('from', v_old.exposure_status, 'to', v_exposure)
      );
    end if;
    if v_old.pinned_start_at is distinct from v_start_at then
      v_diff := v_diff || jsonb_build_object(
        'pinned_start_at', jsonb_build_object('from', v_old.pinned_start_at, 'to', v_start_at)
      );
    end if;
    if v_old.pinned_end_at is distinct from v_end_at then
      v_diff := v_diff || jsonb_build_object(
        'pinned_end_at', jsonb_build_object('from', v_old.pinned_end_at, 'to', v_end_at)
      );
    end if;

    update public.operation_faq_curations
       set faq_id = v_faq_id,
           surface = v_surface,
           curation_mode = v_mode,
           display_rank = v_rank,
           exposure_status = v_exposure,
           pinned_start_at = v_start_at,
           pinned_end_at = v_end_at,
           updated_by = caller_id::text,
           updated_at = now()
     where id = v_id;
  end if;

  insert into public.admin_audit_logs (admin_user_id, action, target_table, target_id, diff, payload)
  values (
    caller_id,
    'faq_curation_saved',
    'OperationFaqCuration',
    v_id,
    v_diff,
    jsonb_build_object(
      'reason', p_reason,
      'mode', case when nullif(btrim(coalesce(p_id, '')), '') is null then 'create' else 'update' end,
      'faq_id', v_faq_id,
      'surface', v_surface,
      'display_rank', v_rank,
      'exposure_status', v_exposure
    )
  );

  return v_id;
end;
$$;
revoke all on function public.admin_save_operation_faq_curation(text, jsonb, text) from public;
grant execute on function public.admin_save_operation_faq_curation(text, jsonb, text) to authenticated;

create or replace function public.admin_delete_operation_faq_curation(
  p_curation_id text,
  p_reason      text
)
returns text
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  caller_id uuid := auth.uid();
  v_old     public.operation_faq_curations%rowtype;
begin
  if caller_id is null then raise exception 'unauthenticated'; end if;
  if not private.is_admin(caller_id) then raise exception 'forbidden: admin required'; end if;
  if nullif(btrim(coalesce(p_reason, '')), '') is null then
    raise exception 'reason required (operational reason)';
  end if;

  select * into v_old
    from public.operation_faq_curations
   where id = p_curation_id
   for update;
  if not found then raise exception 'unknown faq curation id: %', p_curation_id; end if;

  delete from public.operation_faq_curations where id = p_curation_id;

  insert into public.admin_audit_logs (admin_user_id, action, target_table, target_id, payload)
  values (
    caller_id,
    'faq_curation_deleted',
    'OperationFaqCuration',
    p_curation_id,
    jsonb_build_object(
      'reason', p_reason,
      'faq_id', v_old.faq_id,
      'surface', v_old.surface,
      'display_rank', v_old.display_rank,
      'exposure_status', v_old.exposure_status
    )
  );

  return p_curation_id;
end;
$$;
revoke all on function public.admin_delete_operation_faq_curation(text, text) from public;
grant execute on function public.admin_delete_operation_faq_curation(text, text) to authenticated;
