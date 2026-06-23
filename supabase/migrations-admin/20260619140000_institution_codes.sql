-- Users > 박람회/기관 코드: admin-owned sign-up source(institution) code catalog.
-- Owner decision (2026-06-19): 박람회 등으로 유입되는 기관 회원은 QR이 운반하는 "코드"를
-- 달고 가입한다. 코드의 의미(라벨/종류/상태)는 여기(admin)가 소유하고, 회원별 소속 값은
-- v13 사용자 앱이 가입 시 profiles.affiliation_code 에 기록한다(거기서는 단순 문자열).
-- (v13: supabase/migrations/20260619140000_profiles_affiliation_code.sql)
-- 모델 ① : 박람회/캠페인 1건 = 코드 1행. 기관 내 역할 계층/권한은 도입하지 않음(보류).
-- 적용 순서: v13 profiles.affiliation_code 컬럼을 먼저 적용해야 admin_list_institution_codes
--           의 member_count(=profiles 카운트)가 호출 시 동작한다. plpgsql 은 이름 해석을
--           실행 시점으로 미루므로 함수 "생성" 순서는 엄격하지 않다.
-- down: supabase/migrations-admin/down/20260619140000_institution_codes.sql

create table if not exists public.institution_codes (
  code        text primary key
              check (code ~ '^[A-Za-z0-9_-]{2,64}$'),
  label       text not null,
  kind        text not null default '박람회'
              check (kind in ('박람회', '기관', '캠페인', '기타')),
  status      text not null default '활성'
              check (status in ('활성', '종료')),
  note        text,
  created_by  uuid,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index if not exists institution_codes_status_idx on public.institution_codes (status);

comment on table public.institution_codes is
  'NET-NEW (2026-06-19): admin-owned catalog of sign-up source/institution codes carried by 박람회 QR. profiles.affiliation_code(v13)가 code 를 값으로 참조(FK 아님). 모델 ① — 박람회/캠페인당 1행.';

alter table public.institution_codes enable row level security;
alter table public.institution_codes force  row level security;

create policy institution_codes_admin_select on public.institution_codes
  for select to authenticated using (private.is_admin((select auth.uid())));

-- ── Read: list (+ member_count from profiles.affiliation_code) ────────────────
create or replace function public.admin_list_institution_codes(
  p_search text default null,
  p_status text default null
)
returns table (
  code text, label text, kind text, status text, note text,
  member_count bigint, created_at timestamptz, updated_at timestamptz
)
language plpgsql stable security definer set search_path = pg_catalog, public
as $$
declare
  caller_id uuid := auth.uid();
  v_search text := lower(nullif(btrim(coalesce(p_search, '')), ''));
begin
  if caller_id is null then raise exception 'unauthenticated'; end if;
  if not private.is_admin(caller_id) then raise exception 'forbidden: admin required'; end if;
  return query
    select c.code, c.label, c.kind, c.status, c.note,
           (select count(*) from public.profiles p where p.affiliation_code = c.code) as member_count,
           c.created_at, c.updated_at
      from public.institution_codes c
     where (p_status is null or c.status = p_status)
       and (
         v_search is null
         or lower(c.code)  ilike '%' || v_search || '%'
         or lower(c.label) ilike '%' || v_search || '%'
       )
     order by c.created_at desc;
end;
$$;

-- ── Write: create ─────────────────────────────────────────────────────────────
create or replace function public.admin_create_institution_code(
  p_code text, p_label text, p_kind text default '박람회', p_note text default null
)
returns text
language plpgsql security definer set search_path = pg_catalog, public
as $$
declare
  caller_id uuid  := auth.uid();
  v_code    text  := btrim(coalesce(p_code, ''));
  v_label   text  := btrim(coalesce(p_label, ''));
  v_kind    text  := coalesce(nullif(btrim(coalesce(p_kind, '')), ''), '박람회');
  v_note    text  := nullif(btrim(coalesce(p_note, '')), '');
begin
  if caller_id is null then raise exception 'unauthenticated'; end if;
  if not private.is_admin(caller_id) then raise exception 'forbidden: admin required'; end if;
  if v_code !~ '^[A-Za-z0-9_-]{2,64}$' then
    raise exception 'invalid code (letters/digits/-/_ , 2-64 chars): %', p_code;
  end if;
  if v_label = '' then raise exception 'label required'; end if;
  if v_kind not in ('박람회', '기관', '캠페인', '기타') then raise exception 'invalid kind: %', v_kind; end if;
  if exists (select 1 from public.institution_codes where code = v_code) then
    raise exception 'code already exists: %', v_code;
  end if;

  insert into public.institution_codes (code, label, kind, note, created_by)
       values (v_code, v_label, v_kind, v_note, caller_id);

  insert into public.admin_audit_logs (admin_user_id, action, target_table, target_id, diff, payload)
  values (caller_id, 'institution_code_created', 'InstitutionCode', v_code,
          jsonb_build_object('label', v_label, 'kind', v_kind),
          jsonb_build_object('note', v_note));
  return v_code;
end;
$$;

-- ── Write: update (label / kind / status / note) ─────────────────────────────
create or replace function public.admin_update_institution_code(
  p_code text, p_label text, p_kind text, p_status text, p_note text, p_reason text
)
returns text
language plpgsql security definer set search_path = pg_catalog, public
as $$
declare
  caller_id uuid := auth.uid();
  v_old     public.institution_codes%rowtype;
  v_label   text := btrim(coalesce(p_label, ''));
  v_kind    text := coalesce(nullif(btrim(coalesce(p_kind, '')), ''), '박람회');
  v_status  text := coalesce(nullif(btrim(coalesce(p_status, '')), ''), '활성');
  v_note    text := nullif(btrim(coalesce(p_note, '')), '');
begin
  if caller_id is null then raise exception 'unauthenticated'; end if;
  if not private.is_admin(caller_id) then raise exception 'forbidden: admin required'; end if;
  if nullif(btrim(coalesce(p_reason, '')), '') is null then raise exception 'reason required'; end if;
  if v_label = '' then raise exception 'label required'; end if;
  if v_kind not in ('박람회', '기관', '캠페인', '기타') then raise exception 'invalid kind: %', v_kind; end if;
  if v_status not in ('활성', '종료') then raise exception 'invalid status: %', v_status; end if;

  select * into v_old from public.institution_codes where code = p_code for update;
  if not found then raise exception 'unknown code: %', p_code; end if;

  update public.institution_codes
     set label = v_label, kind = v_kind, status = v_status, note = v_note, updated_at = now()
   where code = p_code;

  insert into public.admin_audit_logs (admin_user_id, action, target_table, target_id, diff, payload)
  values (caller_id, 'institution_code_updated', 'InstitutionCode', p_code,
          jsonb_build_object(
            'label',  jsonb_build_object('from', v_old.label,  'to', v_label),
            'kind',   jsonb_build_object('from', v_old.kind,   'to', v_kind),
            'status', jsonb_build_object('from', v_old.status, 'to', v_status)),
          jsonb_build_object('reason', btrim(p_reason)));
  return p_code;
end;
$$;

revoke all    on function public.admin_list_institution_codes(text, text) from public;
grant  execute on function public.admin_list_institution_codes(text, text) to authenticated;
revoke all    on function public.admin_create_institution_code(text, text, text, text) from public;
grant  execute on function public.admin_create_institution_code(text, text, text, text) to authenticated;
revoke all    on function public.admin_update_institution_code(text, text, text, text, text, text) from public;
grant  execute on function public.admin_update_institution_code(text, text, text, text, text, text) to authenticated;

-- Small dev seed for screen visibility; production starts empty / fed by ops.
insert into public.institution_codes (code, label, kind, note)
values
  ('EXPO2026-BOOTH-A', '2026 한국어교육 박람회 · A부스', '박람회', '현장 QR 가입 · A부스'),
  ('EXPO2026-BOOTH-B', '2026 한국어교육 박람회 · B부스', '박람회', '현장 QR 가입 · B부스')
on conflict (code) do nothing;
