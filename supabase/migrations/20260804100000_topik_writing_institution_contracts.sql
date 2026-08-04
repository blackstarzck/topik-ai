-- =====================================================================
-- 기관 계약 원장 + 만료 시 자동 비노출 옵션
--
-- 배경: 기관 코드에는 계약 기간 개념이 없었다. 운영은 "언제까지 계약된 기관인지"를
--   기관 코드 note 에 자유 문장으로 적어 왔고, 계약이 끝나도 학습자에게 문항이 계속
--   보였다. 오너 요구(2026-08-01):
--     ① 계약 기간을 1급 데이터로 두고 수정 가능하게
--     ② 기관별 계약 히스토리(25년 --월--일 ~ --월--일, 26년 ...)를 남길 것
--     ③ "계약 만료 시 자동으로 그 기관 학습자에게 문항 전부 비노출" 을 **관리자가
--        기관별로 켜고 끌 수 있는 옵션**으로 (기본 OFF)
--
-- 설계 핵심 — 만료 판정은 lazy(판정식)이며 배정 데이터를 절대 지우지 않는다:
--   만료 시 배정 행을 삭제하는 방식이면 계약을 연장했을 때 무엇을 복구해야 하는지
--   알 수 없다(삭제 전 상태를 별도로 보관해야 하고, 그 사이 수동 변경이 섞이면
--   복구가 불가능해진다). 대신 학습자 predicate 가 "계약이 유효한가"를 매 판정마다
--   계산한다. 계약을 연장하면 **배정 행 수가 하나도 바뀌지 않은 채** 즉시 복구된다.
--   이 성질은 dev 실측 시나리오로 검증한다(배정 행 수 불변 = lazy 증명).
--
-- 계약 행이 곧 히스토리다. 별도 이력 테이블을 두지 않는다 — 기간이 겹치지 않는
--   계약 행들의 집합이 그대로 "25년 ~, 26년 ~" 목록이 된다. 겹침 금지는 주장이
--   아니라 exclusion 제약으로 강제한다(동시 삽입 경쟁까지 막힌다).
--
-- 폴백 방향(중요, 이 저장소의 일관 규칙): 모든 기본값·판정 불명 상황은 **현행 동작**
--   으로 떨어진다.
--     · auto_hide_on_expiry 기본값 = false (도입만으로는 아무것도 바뀌지 않는다)
--     · **계약 행이 하나도 없는 기관은 "유효"로 본다** — 만료할 계약이 없기 때문이다.
--       이 폴백이 없으면 옵션을 켜는 순간 계약 미등록 기관의 전 학습자가 즉시 0문항이
--       되고, 그것은 되돌릴 수 없는 노출 사고다. 옵션은 "계약이 있고 그 계약이 끝났을
--       때"만 물어야 한다.
--     · 미래 시작 계약(예정)만 있으면 아직 유효 계약이 아니므로 비노출 대상이다.
--
-- 왜 계약 원장을 여기(topik_writing)에 두는가: 학습자 predicate 가 매 판정마다 읽는
--   hot path 데이터다. institution_codes 는 admin 네임스페이스(별도 tracker·러너)이고
--   적용 순서가 항상 topik_writing → admin 이라(supabase/README.md) 그쪽에 두면 이
--   predicate 가 항상 먼저 적용되어 테이블이 없는 창이 생긴다. 모드 원장
--   (20260801100000)이 같은 이유로 이 폴더에 있고, 계약은 그 원장과 함께 읽힌다.
--   institution_code 를 하드 FK 없이 값으로만 참조하는 것도 동형이다.
--
-- 함께 수리하는 결함(같은 서브시스템, 1행): 20260801100000 이 도입하고
--   20260801100200 이 이어받은 admin_set_institution_exposure_mode 는
--   `private.admin_has_permission` 을 호출하는데 그 함수는 **public 에만 존재한다**
--   (20260623200000 이 public 으로 만들고, private 변형을 만드는 마이그는 없다).
--   따라서 노출 모드 변경 RPC 는 is_admin 검사를 지난 모든 호출에서 42883 으로
--   실패한다 — 기관 단위 노출 모드의 유일한 쓰기 경로가 죽어 있었다(dev·운영 모두
--   적용됨, 2026-08-03 운영 검증은 학습자 읽기 경로만 확인해 놓쳤다). 이 파일의 신규
--   RPC 는 전부 public.admin_has_permission 을 쓰고, 기존 RPC 의 스키마 한정도 함께
--   고친다.
--
-- 짝 마이그: supabase/migrations/20260804100100 (신규 문항 자동 배정),
--   supabase/migrations-admin/20260804100200 (기관 설정),
--   supabase/migrations-admin/20260804100300 (삭제 정리),
--   supabase/migrations-admin/20260804100400 (intake 가드)
-- down: supabase/migrations/down/20260804100000_topik_writing_institution_contracts.sql
-- =====================================================================

-- ---------------------------------------------------------------- 선행 확장
-- exclusion 제약의 `institution_code with =` 는 text 에 대한 gist 연산자 클래스를
-- 요구하고 그것은 btree_gist 가 제공한다(daterange 의 && 는 내장 range_ops).
-- dev 실측: pg_available_extensions 에 존재하나 미설치(2026-08-04).
-- 기본 연산자 클래스 탐색은 (접근 방법, 입력 타입) 조합에 후보가 하나면 스키마
-- 가시성과 무관하게 해석되므로 extensions 스키마 설치로 충분하다(pgcrypto·uuid-ossp 관례).
create extension if not exists btree_gist with schema extensions;

-- ---------------------------------------------------------------- 계약 원장
create table if not exists public.topik_writing_institution_contracts (
  contract_id      uuid primary key default gen_random_uuid(),
  institution_code text not null,  -- institution_codes.code 소프트 참조(하드 FK 미사용, 헤더 참조)
  starts_on        date not null,
  ends_on          date,           -- null = 무기한
  doc_url          text,
  note             text,
  created_by       uuid,
  updated_by       uuid,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  constraint topik_writing_institution_contracts_period_check
    check (ends_on is null or ends_on >= starts_on),
  -- 같은 기관의 계약 기간은 겹칠 수 없다. 사전 검사(친절한 오류)와 별도로 제약을 두어
  -- 동시 삽입 경쟁에서도 겹침이 만들어지지 않게 한다. `[]` = 양끝 포함(달력일 계약).
  constraint topik_writing_institution_contracts_no_overlap
    exclude using gist (
      institution_code with =,
      daterange(starts_on, ends_on, '[]') with &&
    )
);

-- RLS 는 모드 원장(20260801100000)·노출 매핑(20260625100000)과 동형: enable 만
-- (force 금지 — force 는 소유자에게도 정책을 강제해 definer 경로를 막는다),
-- 읽기는 admin, 쓰기 정책 0개 → security definer RPC 단일 경로.
alter table public.topik_writing_institution_contracts enable row level security;

drop policy if exists topik_writing_institution_contracts_admin_select
  on public.topik_writing_institution_contracts;
create policy topik_writing_institution_contracts_admin_select
  on public.topik_writing_institution_contracts
  for select to authenticated using (private.is_admin((select auth.uid())));

comment on table public.topik_writing_institution_contracts is
  '기관 코드별 계약 기간 원장. 행 하나 = 계약 한 건이며 이 행들의 집합이 그대로 계약 히스토리다(별도 이력 테이블 없음). 같은 institution_code 의 기간은 exclusion 제약으로 겹칠 수 없다(양끝 포함 달력일, Asia/Seoul 기준). ends_on null = 무기한. 만료 판정은 배정 데이터를 지우지 않는 lazy 방식이며 유일한 정의 지점은 private.institution_writing_contract_active 다 — 계약을 연장하면 배정 행 수가 하나도 바뀌지 않은 채 즉시 복구된다. 계약 행이 하나도 없는 기관은 "유효"로 본다(만료할 계약이 없다 — 폴백은 항상 현행 동작). 쓰기는 admin_create/update/delete_institution_contract RPC 단일 경로. institution_codes.code 소프트 참조(하드 FK 없음: 별개 마이그 네임스페이스라 적용 순서가 보장되지 않는다). 2026-08-04.';

comment on column public.topik_writing_institution_contracts.ends_on is
  '계약 종료일(포함). null = 무기한. 효력은 KST 기준이며 ends_on 당일까지 유효하고 다음 날 00:00 KST 부터 만료다.';

comment on column public.topik_writing_institution_contracts.doc_url is
  '계약 문서 링크(운영 메타). 감사 payload 에 기록하지 않는 담당자 개인정보와 달리 문서 URL 은 기록한다.';

-- ---------------------------------------------------------------- 만료 시 자동 비노출 옵션
alter table public.topik_writing_institution_exposure_mode
  add column if not exists auto_hide_on_expiry boolean not null default false;

comment on column public.topik_writing_institution_exposure_mode.auto_hide_on_expiry is
  '계약 만료 시 그 기관 소속 학습자에게 쓰기 문항을 전부 비노출할지(관리자 옵션, 기본 false). true 이고 계약이 유효하지 않으면 노출 모드와 무관하게 비노출한다 — `제한 없음` 모드 기관도 만료 시 가려진다. 계약 행이 하나도 없는 기관은 유효로 보므로 이 옵션만 켜도 아무것도 가려지지 않는다. 배정 행은 삭제하지 않으므로 계약 연장 시 즉시 복구된다.';

-- ---------------------------------------------------------------- 계약 유효 판정 (단일 정의 지점)
-- predicate·가드·상태 요약 RPC 가 전부 이 함수를 호출한다. "KST 오늘이 계약 기간에
-- 들어가는가" 의 정의를 한 곳에만 둬서 세 경로가 어긋날 수 없게 한다.
create or replace function private.institution_writing_contract_active(p_code text)
returns boolean
language plpgsql
stable
security definer
set search_path = pg_catalog, public, private
as $$
declare
  v_code  text := nullif(btrim(coalesce(p_code, '')), '');
  v_today date := (now() at time zone 'Asia/Seoul')::date;
begin
  if v_code is null then
    return true;
  end if;

  -- 계약을 등재하지 않은 기관은 만료할 계약이 없다 → 유효로 본다. 이 폴백이 없으면
  -- auto_hide 옵션을 켜는 순간 계약 미등록 기관의 전 학습자가 0문항이 된다.
  if not exists (
    select 1
      from public.topik_writing_institution_contracts c
     where c.institution_code = v_code
  ) then
    return true;
  end if;

  return exists (
    select 1
      from public.topik_writing_institution_contracts c
     where c.institution_code = v_code
       and c.starts_on <= v_today
       and (c.ends_on is null or c.ends_on >= v_today)
  );
end;
$$;

revoke all on function private.institution_writing_contract_active(text) from public;
revoke all on function private.institution_writing_contract_active(text) from anon;
revoke all on function private.institution_writing_contract_active(text) from authenticated;
revoke all on function private.institution_writing_contract_active(text) from service_role;

comment on function private.institution_writing_contract_active(text) is
  '기관 코드의 계약이 KST 오늘 기준 유효한지. 계약 행이 하나도 없으면 true(만료할 계약이 없다 — 폴백은 항상 현행 동작). 계약이 있으면 starts_on <= 오늘 <= ends_on(null=무기한) 인 행이 하나라도 있어야 true 이며, 미래 시작 계약(예정)만 있으면 false 다. 학습자 predicate·intake 가드·상태 요약 RPC 가 모두 이 함수를 호출하므로 만료 정의는 여기 한 곳뿐이다. 2026-08-04.';

-- ---------------------------------------------------------------- 학습자 predicate
-- 시그니처 불변(create or replace). 20260801100000 본문에 만료 분기만 끼운다.
-- 20260730120000 의 do $contract_guard$ 가 이 본문에서 다음 세 리터럴을 문자열 검사하므로
-- 그대로 보존한다: `if v_affiliation_code is null then return true;`,
-- `topik_writing_question_institution_exposure`, `e.institution_code = v_affiliation_code`.
--
-- 분기 순서가 계약이다: 만료 검사는 `제한 없음` 분기보다 **앞**에 온다. 뒤에 두면
-- `제한 없음` 기관이 만료돼도 전량이 계속 보여 옵션이 무의미해진다.
create or replace function private.is_writing_question_visible_to_user(
  p_question_id text,
  p_item_number smallint,
  p_user_id uuid
)
returns boolean
language plpgsql
security definer
stable
set search_path = pg_catalog, public, private
as $$
declare
  v_affiliation_code text;
  v_exposure_mode text;
  v_auto_hide boolean;
begin
  if p_user_id is null then
    return false;
  end if;

  select nullif(btrim(p.affiliation_code), '')
    into v_affiliation_code
    from public.profiles p
   where p.id = p_user_id;

  if not found then
    return false;
  end if;

  -- Preserve the latest v13 contract: non-institution learners see the full
  -- available pool; institution learners see assigned questions only.
  if v_affiliation_code is null then
    return true;
  end if;

  -- 기관 노출 모드 + 만료 자동 비노출 옵션을 한 번의 SELECT 로 읽는다(hot path 조회 추가 0회).
  -- 행이 없으면 기관 할당제 + 옵션 OFF 를 유지한다 — 폴백은 항상 현행 동작이다.
  select m.exposure_mode, m.auto_hide_on_expiry
    into v_exposure_mode, v_auto_hide
    from public.topik_writing_institution_exposure_mode m
   where m.institution_code = v_affiliation_code;

  -- 만료 자동 비노출: 옵션이 켜져 있고 계약이 유효하지 않으면 모드와 무관하게 가린다.
  -- 계약 조회는 옵션이 켜진 기관에서만 발생하므로 기본 경로 비용은 그대로다.
  if coalesce(v_auto_hide, false)
     and not private.institution_writing_contract_active(v_affiliation_code) then
    return false;
  end if;

  if coalesce(v_exposure_mode, '배정분만') = '제한 없음' then
    return true;
  end if;

  return exists (
    select 1
      from public.topik_writing_question_institution_exposure e
     where e.question_id = p_question_id
       and e.item_number = p_item_number
       and e.institution_code = v_affiliation_code
  );
end;
$$;

revoke all on function private.is_writing_question_visible_to_user(text, smallint, uuid) from public;
revoke all on function private.is_writing_question_visible_to_user(text, smallint, uuid) from anon;
revoke all on function private.is_writing_question_visible_to_user(text, smallint, uuid) from authenticated;
revoke all on function private.is_writing_question_visible_to_user(text, smallint, uuid) from service_role;

-- ---------------------------------------------------------------- 계약 조회 RPC 2종
create or replace function public.admin_list_institution_contracts(
  p_codes text[] default null
)
returns table (
  contract_id      uuid,
  institution_code text,
  starts_on        date,
  ends_on          date,
  contract_status  text,
  doc_url          text,
  note             text,
  created_at       timestamptz,
  updated_at       timestamptz
)
language plpgsql
security definer
stable
set search_path = pg_catalog, public, private
as $$
declare
  caller_id uuid := auth.uid();
  v_today   date := (now() at time zone 'Asia/Seoul')::date;
begin
  if caller_id is null then
    raise exception 'unauthenticated';
  end if;
  if not private.is_admin(caller_id) then
    raise exception 'forbidden: admin required';
  end if;

  return query
  select c.contract_id,
         c.institution_code,
         c.starts_on,
         c.ends_on,
         case
           when c.starts_on > v_today then '예정'
           when c.ends_on is not null and c.ends_on < v_today then '만료'
           else '유효'
         end,
         c.doc_url,
         c.note,
         c.created_at,
         c.updated_at
    from public.topik_writing_institution_contracts c
   where p_codes is null or c.institution_code = any(p_codes)
   order by c.institution_code, c.starts_on desc;
end;
$$;

revoke all on function public.admin_list_institution_contracts(text[]) from public;
revoke all on function public.admin_list_institution_contracts(text[]) from anon;
grant execute on function public.admin_list_institution_contracts(text[]) to authenticated;

comment on function public.admin_list_institution_contracts(text[]) is
  '기관 계약 히스토리 read. contract_status(`예정`/`유효`/`만료`)는 KST 오늘 기준 lazy 계산이며 저장하지 않는다(저장하면 날짜가 바뀔 때 갱신 주체가 필요해진다). 기관별 최신 계약 우선 정렬. 2026-08-04.';

create or replace function public.admin_list_institution_contract_status(
  p_codes text[] default null
)
returns table (
  code                text,
  has_active_contract boolean,
  active_starts_on    date,
  active_ends_on      date,
  days_left           integer,
  contract_count      bigint,
  auto_hide_on_expiry boolean,
  writing_hidden_now  boolean
)
language plpgsql
security definer
stable
set search_path = pg_catalog, public, private
as $$
declare
  caller_id uuid := auth.uid();
  v_today   date := (now() at time zone 'Asia/Seoul')::date;
begin
  if caller_id is null then
    raise exception 'unauthenticated';
  end if;
  if not private.is_admin(caller_id) then
    raise exception 'forbidden: admin required';
  end if;

  -- 기관 코드 원장 기준 좌결합(모드 목록 RPC 선례). 계약·모드 행이 없는 코드도
  -- 기본값으로 반환해야 목록 화면이 모든 기관에 대해 계약 컬럼을 그릴 수 있다.
  return query
  select c.code,
         private.institution_writing_contract_active(c.code),
         active.starts_on,
         active.ends_on,
         case
           when active.ends_on is null then null
           else (active.ends_on - v_today)
         end,
         coalesce(counted.contract_count, 0),
         coalesce(m.auto_hide_on_expiry, false),
         coalesce(m.auto_hide_on_expiry, false)
           and not private.institution_writing_contract_active(c.code)
    from public.institution_codes c
    left join public.topik_writing_institution_exposure_mode m
      on m.institution_code = c.code
    left join lateral (
      select k.starts_on, k.ends_on
        from public.topik_writing_institution_contracts k
       where k.institution_code = c.code
         and k.starts_on <= v_today
         and (k.ends_on is null or k.ends_on >= v_today)
       order by k.starts_on desc
       limit 1
    ) active on true
    left join lateral (
      select count(*) as contract_count
        from public.topik_writing_institution_contracts k
       where k.institution_code = c.code
    ) counted on true
   where p_codes is null or c.code = any(p_codes)
   order by c.code;
end;
$$;

revoke all on function public.admin_list_institution_contract_status(text[]) from public;
revoke all on function public.admin_list_institution_contract_status(text[]) from anon;
grant execute on function public.admin_list_institution_contract_status(text[]) to authenticated;

comment on function public.admin_list_institution_contract_status(text[]) is
  '기관 목록·상세용 계약 요약. institution_codes 기준 좌결합이라 계약·모드 행이 없는 코드도 기본값으로 반환한다. days_left 는 유효 계약의 ends_on - KST 오늘(무기한이면 null)이며 마스터 관리자 화면의 만료 D-day 표시 데이터 소스다. writing_hidden_now = 옵션 ON 이고 계약 무효 → 지금 그 기관 학습자에게 쓰기 문항이 보이지 않는 상태. has_active_contract 는 계약 미등재 기관에서 true 다(만료할 계약이 없다). 2026-08-04.';

-- ---------------------------------------------------------------- 계약 쓰기 RPC 3종
create or replace function public.admin_create_institution_contract(
  p_code      text,
  p_starts_on date,
  p_ends_on   date,
  p_reason    text,
  p_note      text default null,
  p_doc_url   text default null
)
returns uuid
language plpgsql
security definer
set search_path = pg_catalog, public, private
as $$
declare
  caller_id  uuid := auth.uid();
  v_code     text := btrim(coalesce(p_code, ''));
  v_reason   text := nullif(btrim(coalesce(p_reason, '')), '');
  v_note     text := nullif(btrim(coalesce(p_note, '')), '');
  v_doc_url  text := nullif(btrim(coalesce(p_doc_url, '')), '');
  v_id       uuid;
  v_overlap  text;
begin
  if caller_id is null then raise exception 'unauthenticated'; end if;
  if not private.is_admin(caller_id) then raise exception 'forbidden: admin required'; end if;
  if not public.admin_has_permission(caller_id, 'users.institution-codes.manage') then
    raise exception 'forbidden: missing permission users.institution-codes.manage';
  end if;
  if v_code = '' then raise exception 'code required'; end if;
  if v_reason is null then raise exception 'reason required'; end if;
  if p_starts_on is null then raise exception 'starts_on required'; end if;
  if p_ends_on is not null and p_ends_on < p_starts_on then
    raise exception 'ends_on must not be earlier than starts_on: % < %', p_ends_on, p_starts_on;
  end if;

  -- 코드 삭제 RPC 와 같은 행 잠금을 공유해 "삭제 정리 직후 orphan 계약 삽입" 경쟁을 막는다
  -- (20260801100200 의 모드 원장 선례와 동형).
  perform 1
    from public.institution_codes c
   where c.code = v_code
   for update;
  if not found then
    raise exception 'unknown code: %', v_code;
  end if;

  -- 사전 검사로 친절한 오류를 낸다. exclusion 제약은 동시 삽입 경쟁용 백스톱이다.
  select string_agg(
           to_char(k.starts_on, 'YYYY-MM-DD') || ' ~ ' ||
           coalesce(to_char(k.ends_on, 'YYYY-MM-DD'), '무기한'),
           ', ' order by k.starts_on
         )
    into v_overlap
    from public.topik_writing_institution_contracts k
   where k.institution_code = v_code
     and daterange(k.starts_on, k.ends_on, '[]')
         && daterange(p_starts_on, p_ends_on, '[]');

  if v_overlap is not null then
    raise exception 'contract period overlaps an existing contract of %: %', v_code, v_overlap
      using detail = '같은 기관의 계약 기간은 겹칠 수 없다. 기존 계약을 수정하거나 종료일을 조정하여라.',
            hint = '계약 히스토리에서 겹치는 계약을 먼저 확인하여라.';
  end if;

  begin
    insert into public.topik_writing_institution_contracts (
      institution_code, starts_on, ends_on, doc_url, note, created_by, updated_by
    ) values (
      v_code, p_starts_on, p_ends_on, v_doc_url, v_note, caller_id, caller_id
    )
    returning contract_id into v_id;
  exception when exclusion_violation then
    -- 사전 검사와 삽입 사이에 다른 트랜잭션이 겹치는 계약을 넣은 경우.
    raise exception 'contract period overlaps an existing contract of %', v_code
      using detail = '동시에 다른 계약이 등록되었다. 계약 히스토리를 새로 고친 뒤 다시 시도하여라.';
  end;

  insert into public.admin_audit_logs (
    admin_user_id, action, target_table, target_id, diff, payload
  ) values (
    caller_id,
    'institution_contract_created',
    'InstitutionCode',
    v_code,
    jsonb_build_object('contract', jsonb_build_object(
      'from', null,
      'to', jsonb_build_object('starts_on', p_starts_on, 'ends_on', p_ends_on)
    )),
    jsonb_build_object(
      'reason', v_reason,
      'code', v_code,
      'contract_id', v_id,
      'starts_on', p_starts_on,
      'ends_on', p_ends_on,
      'doc_url', v_doc_url,
      'note', v_note
    )
  );

  return v_id;
end;
$$;

revoke all on function public.admin_create_institution_contract(text, date, date, text, text, text) from public;
revoke all on function public.admin_create_institution_contract(text, date, date, text, text, text) from anon;
grant execute on function public.admin_create_institution_contract(text, date, date, text, text, text) to authenticated;

comment on function public.admin_create_institution_contract(text, date, date, text, text, text) is
  '기관 계약을 추가한다(사유 필수, 권한 users.institution-codes.manage). 기간 겹침은 사전 검사로 친절한 오류를 내고 exclusion 제약이 동시 삽입 경쟁을 막는다. institution_codes 행을 잠가 코드 삭제와 직렬화한다. 감사 action = institution_contract_created. 2026-08-04.';

create or replace function public.admin_update_institution_contract(
  p_contract_id uuid,
  p_starts_on   date,
  p_ends_on     date,
  p_reason      text,
  p_note        text default null,
  p_doc_url     text default null
)
returns uuid
language plpgsql
security definer
set search_path = pg_catalog, public, private
as $$
declare
  caller_id uuid := auth.uid();
  v_reason  text := nullif(btrim(coalesce(p_reason, '')), '');
  v_note    text := nullif(btrim(coalesce(p_note, '')), '');
  v_doc_url text := nullif(btrim(coalesce(p_doc_url, '')), '');
  v_old     public.topik_writing_institution_contracts%rowtype;
  v_overlap text;
begin
  if caller_id is null then raise exception 'unauthenticated'; end if;
  if not private.is_admin(caller_id) then raise exception 'forbidden: admin required'; end if;
  if not public.admin_has_permission(caller_id, 'users.institution-codes.manage') then
    raise exception 'forbidden: missing permission users.institution-codes.manage';
  end if;
  if p_contract_id is null then raise exception 'contract id required'; end if;
  if v_reason is null then raise exception 'reason required'; end if;
  if p_starts_on is null then raise exception 'starts_on required'; end if;
  if p_ends_on is not null and p_ends_on < p_starts_on then
    raise exception 'ends_on must not be earlier than starts_on: % < %', p_ends_on, p_starts_on;
  end if;

  select * into v_old
    from public.topik_writing_institution_contracts
   where contract_id = p_contract_id
   for update;
  if not found then raise exception 'unknown contract: %', p_contract_id; end if;

  select string_agg(
           to_char(k.starts_on, 'YYYY-MM-DD') || ' ~ ' ||
           coalesce(to_char(k.ends_on, 'YYYY-MM-DD'), '무기한'),
           ', ' order by k.starts_on
         )
    into v_overlap
    from public.topik_writing_institution_contracts k
   where k.institution_code = v_old.institution_code
     and k.contract_id <> p_contract_id
     and daterange(k.starts_on, k.ends_on, '[]')
         && daterange(p_starts_on, p_ends_on, '[]');

  if v_overlap is not null then
    raise exception 'contract period overlaps an existing contract of %: %',
      v_old.institution_code, v_overlap
      using detail = '같은 기관의 계약 기간은 겹칠 수 없다.';
  end if;

  begin
    update public.topik_writing_institution_contracts
       set starts_on  = p_starts_on,
           ends_on    = p_ends_on,
           note       = v_note,
           doc_url    = v_doc_url,
           updated_by = caller_id,
           updated_at = now()
     where contract_id = p_contract_id;
  exception when exclusion_violation then
    raise exception 'contract period overlaps an existing contract of %', v_old.institution_code;
  end;

  insert into public.admin_audit_logs (
    admin_user_id, action, target_table, target_id, diff, payload
  ) values (
    caller_id,
    'institution_contract_updated',
    'InstitutionCode',
    v_old.institution_code,
    jsonb_build_object(
      'starts_on', jsonb_build_object('from', v_old.starts_on, 'to', p_starts_on),
      'ends_on', jsonb_build_object('from', v_old.ends_on, 'to', p_ends_on)
    ),
    jsonb_build_object(
      'reason', v_reason,
      'code', v_old.institution_code,
      'contract_id', p_contract_id,
      'doc_url', v_doc_url,
      'note', v_note,
      'prev_doc_url', v_old.doc_url,
      'prev_note', v_old.note
    )
  );

  return p_contract_id;
end;
$$;

revoke all on function public.admin_update_institution_contract(uuid, date, date, text, text, text) from public;
revoke all on function public.admin_update_institution_contract(uuid, date, date, text, text, text) from anon;
grant execute on function public.admin_update_institution_contract(uuid, date, date, text, text, text) to authenticated;

comment on function public.admin_update_institution_contract(uuid, date, date, text, text, text) is
  '기관 계약 기간·문서·메모를 수정한다(사유 필수, 권한 users.institution-codes.manage). 자기 자신을 제외한 겹침을 검사한다. 계약 연장은 배정 행을 건드리지 않고 만료 판정만 바꾸므로 auto_hide 로 가려졌던 학습자가 즉시 복구된다. 감사 action = institution_contract_updated(diff 에 기간 전후). 2026-08-04.';

create or replace function public.admin_delete_institution_contract(
  p_contract_id uuid,
  p_reason      text
)
returns uuid
language plpgsql
security definer
set search_path = pg_catalog, public, private
as $$
declare
  caller_id  uuid := auth.uid();
  v_reason   text := nullif(btrim(coalesce(p_reason, '')), '');
  v_old      public.topik_writing_institution_contracts%rowtype;
  v_was_active boolean;
  v_population record;
begin
  if caller_id is null then raise exception 'unauthenticated'; end if;
  if not private.is_admin(caller_id) then raise exception 'forbidden: admin required'; end if;
  if not public.admin_has_permission(caller_id, 'users.institution-codes.manage') then
    raise exception 'forbidden: missing permission users.institution-codes.manage';
  end if;
  if p_contract_id is null then raise exception 'contract id required'; end if;
  if v_reason is null then raise exception 'reason required'; end if;

  select * into v_old
    from public.topik_writing_institution_contracts
   where contract_id = p_contract_id
   for update;
  if not found then raise exception 'unknown contract: %', p_contract_id; end if;

  -- 삭제 전 상태를 감사에 보존한다(하드 삭제 허용 — 오너 결정). 유효 계약을 지우면
  -- auto_hide 기관은 즉시 비노출로 바뀌므로 그 사실과 영향 인구를 함께 남긴다.
  v_was_active := private.institution_writing_contract_active(v_old.institution_code);
  select * into v_population
    from private.institution_learner_population(v_old.institution_code);

  delete from public.topik_writing_institution_contracts
   where contract_id = p_contract_id;

  insert into public.admin_audit_logs (
    admin_user_id, action, target_table, target_id, diff, payload
  ) values (
    caller_id,
    'institution_contract_deleted',
    'InstitutionCode',
    v_old.institution_code,
    jsonb_build_object('contract', jsonb_build_object(
      'from', jsonb_build_object('starts_on', v_old.starts_on, 'ends_on', v_old.ends_on),
      'to', null
    )),
    jsonb_build_object(
      'reason', v_reason,
      'code', v_old.institution_code,
      'contract_id', p_contract_id,
      'starts_on', v_old.starts_on,
      'ends_on', v_old.ends_on,
      'doc_url', v_old.doc_url,
      'note', v_old.note,
      'had_active_contract', v_was_active,
      'member_count', v_population.member_count,
      'pending_invitation_count', v_population.pending_invitation_count
    )
  );

  return p_contract_id;
end;
$$;

revoke all on function public.admin_delete_institution_contract(uuid, text) from public;
revoke all on function public.admin_delete_institution_contract(uuid, text) from anon;
grant execute on function public.admin_delete_institution_contract(uuid, text) to authenticated;

comment on function public.admin_delete_institution_contract(uuid, text) is
  '기관 계약을 하드 삭제한다(사유 필수, 권한 users.institution-codes.manage). 삭제 전 전량 값과 had_active_contract·영향 인구를 감사 payload 에 보존한다(오너 결정: 하드 삭제 허용, 복구는 감사 기록으로). 유효 계약을 지우면 auto_hide 옵션이 켜진 기관은 즉시 비노출로 전환된다. 감사 action = institution_contract_deleted. 2026-08-04.';

-- ---------------------------------------------------------------- 옵션 토글 RPC
-- G3(모드 전환 가드) 선행 수리가 필요하다. G3 는 `before insert or update of exposure_mode`
-- 라서 이 토글이 모드 원장 행을 **처음 만들 때**(INSERT) 도 발화한다. 새 행은 컬럼 기본값
-- `배정분만` 으로 들어가므로 G3 의 현재 본문은 그것을 "제한 없음 → 배정분만 전환" 으로 오인해
-- 배정 0건 + 회원 있는 기관에서 "cannot switch ... to 배정분만" 으로 **잘못 차단**한다.
-- 행이 없던 기관의 실효 모드는 이미 `배정분만`(폴백)이므로 INSERT 는 전환이 아니다 —
-- 그 상태에서 학습자는 이미 아무것도 보지 못했고, INSERT 를 막아도 구제되지 않는다.
-- 오늘 이 경로는 도달 불가였다(기존 유일한 쓰기 RPC 는 v_old <> v_mode 일 때만 INSERT 하므로
-- INSERT 되는 값은 항상 `제한 없음` 이라 첫 분기에서 통과했다). 이 토글이 처음으로 도달
-- 가능하게 만들므로 여기서 함께 고친다. 실제 전환(UPDATE)에 대한 보호는 그대로다.
create or replace function private.guard_institution_exposure_mode_switch()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public, private
as $$
declare
  v_population record;
begin
  if new.exposure_mode <> '배정분만' then
    return new;
  end if;
  -- INSERT: 행이 없던 기관의 실효 모드도 `배정분만` 이었으므로 전환이 아니다.
  if tg_op = 'INSERT' then
    return new;
  end if;
  if tg_op = 'UPDATE' and old.exposure_mode = '배정분만' then
    return new;  -- 실제 전환이 아니다.
  end if;

  if exists (
    select 1
      from public.topik_writing_question_institution_exposure e
     where e.institution_code = new.institution_code
  ) then
    return new;  -- 배정이 있으면 빈 화면이 아니다.
  end if;

  select *
    into v_population
    from private.institution_learner_population(new.institution_code);

  if v_population.member_count > 0 or v_population.pending_invitation_count > 0 then
    raise exception
      'cannot switch institution % to 배정분만 with zero writing assignments: % member(s) and % pending invitation(s) would see no writing questions',
      new.institution_code, v_population.member_count, v_population.pending_invitation_count
      using detail = '배정분만 모드에서는 그 기관에 배정된 문항만 보이며, 배정이 0건이면 학습자 화면이 비어 있다.',
            hint = '문항을 최소 1건 배정한 뒤 전환하거나(Users > 기관 코드 > 노출 문항), 회원 소속을 먼저 해제하여라.';
  end if;

  return new;
end;
$$;

revoke all on function private.guard_institution_exposure_mode_switch() from public;
revoke all on function private.guard_institution_exposure_mode_switch() from anon;
revoke all on function private.guard_institution_exposure_mode_switch() from authenticated;
revoke all on function private.guard_institution_exposure_mode_switch() from service_role;

comment on function private.guard_institution_exposure_mode_switch() is
  '`제한 없음` → `배정분만` 실제 전환이 배정 0건 + 회원/대기초대 있는 기관을 빈 화면으로 만드는 것을 막는 트리거. INSERT 는 전환이 아니다 — 행이 없던 기관의 실효 모드도 `배정분만`(폴백)이므로 새 행 생성은 가시 집합을 바꾸지 않는다(2026-08-04 정정: auto_hide 토글이 모드 행을 처음 만들 때 잘못 차단되던 경로). 2026-08-04.';

create or replace function public.admin_set_institution_auto_hide_on_expiry(
  p_code    text,
  p_enabled boolean,
  p_reason  text
)
returns text
language plpgsql
security definer
set search_path = pg_catalog, public, private
as $$
declare
  caller_id   uuid := auth.uid();
  v_code      text := btrim(coalesce(p_code, ''));
  v_reason    text := nullif(btrim(coalesce(p_reason, '')), '');
  v_enabled   boolean := coalesce(p_enabled, false);
  v_old       boolean;
  v_active    boolean;
  v_population record;
begin
  if caller_id is null then raise exception 'unauthenticated'; end if;
  if not private.is_admin(caller_id) then raise exception 'forbidden: admin required'; end if;
  if not public.admin_has_permission(caller_id, 'users.institution-codes.manage') then
    raise exception 'forbidden: missing permission users.institution-codes.manage';
  end if;
  if v_code = '' then raise exception 'code required'; end if;
  if v_reason is null then raise exception 'reason required'; end if;

  perform 1
    from public.institution_codes c
   where c.code = v_code
   for update;
  if not found then
    raise exception 'unknown code: %', v_code;
  end if;

  select m.auto_hide_on_expiry
    into v_old
    from public.topik_writing_institution_exposure_mode m
   where m.institution_code = v_code
   for update;

  v_old := coalesce(v_old, false);
  if v_old = v_enabled then
    return v_code;  -- 변경 없음 — 감사 행을 남기지 않는다(화면이 항상 호출해도 안전).
  end if;

  -- upsert 의 do update 목록에 **exposure_mode 를 넣지 않는다**. 넣으면 ①기존 모드를
  -- 덮어쓰고 ②`update of exposure_mode` 인 G3 트리거가 값 변화 없이도 발화한다.
  -- 새 행 INSERT 시 exposure_mode 는 컬럼 기본값 `배정분만`(= 행이 없을 때의 실효값)이다.
  insert into public.topik_writing_institution_exposure_mode (
    institution_code, auto_hide_on_expiry, reason, changed_by, updated_at
  ) values (
    v_code, v_enabled, v_reason, caller_id, now()
  )
  on conflict (institution_code) do update set
    auto_hide_on_expiry = excluded.auto_hide_on_expiry,
    reason = excluded.reason,
    changed_by = excluded.changed_by,
    updated_at = now();

  v_active := private.institution_writing_contract_active(v_code);
  select *
    into v_population
    from private.institution_learner_population(v_code);

  insert into public.admin_audit_logs (
    admin_user_id, action, target_table, target_id, diff, payload
  ) values (
    caller_id,
    'institution_contract_auto_hide_changed',
    'InstitutionCode',
    v_code,
    jsonb_build_object('auto_hide_on_expiry', jsonb_build_object('from', v_old, 'to', v_enabled)),
    jsonb_build_object(
      'reason', v_reason,
      'code', v_code,
      'has_active_contract', v_active,
      'writing_hidden_now', v_enabled and not v_active,
      'member_count', v_population.member_count,
      'pending_invitation_count', v_population.pending_invitation_count
    )
  );

  return v_code;
end;
$$;

revoke all on function public.admin_set_institution_auto_hide_on_expiry(text, boolean, text) from public;
revoke all on function public.admin_set_institution_auto_hide_on_expiry(text, boolean, text) from anon;
grant execute on function public.admin_set_institution_auto_hide_on_expiry(text, boolean, text) to authenticated;

comment on function public.admin_set_institution_auto_hide_on_expiry(text, boolean, text) is
  '기관의 "계약 만료 시 자동 비노출" 옵션을 켜고 끈다(사유 필수, 권한 users.institution-codes.manage). 값이 그대로면 감사 행 없이 조기 반환한다. 모드 원장에 행이 없으면 새로 만들되 exposure_mode 는 기본값(`배정분만` = 행 없을 때의 실효값)으로 두고 upsert 의 do update 목록에 넣지 않는다 — 기존 모드를 덮어쓰거나 모드 전환 가드를 발화시키지 않기 위해서다. 감사 action = institution_contract_auto_hide_changed(payload 에 writing_hidden_now 로 즉시 효과 기록). 2026-08-04.';

-- ---------------------------------------------------------------- 계약 comment 재-stamp
-- 20260801100000 이 stamp 한 학습자 노출 계약 문구에는 만료 분기가 없다.
-- create or replace 는 comment 를 보존하므로 여기서 명시적으로 덮어써야 한다.
comment on function private.is_writing_question_visible_to_user(text, smallint, uuid) is
  '기관 할당제 학습자 가시성 predicate — 기관별 쓰기 문항 노출의 유일한 강제 지점. 네 분기다: ①profiles.affiliation_code 가 없는 학습자에게는 available 문항 전체를 허용한다. ②소속 기관이 `만료 시 자동 비노출`(topik_writing_institution_exposure_mode.auto_hide_on_expiry) 을 켰고 계약이 유효하지 않으면 모드와 무관하게 전부 거부한다 — 이 분기는 `제한 없음` 분기보다 반드시 앞에 온다(뒤에 두면 제한 없음 기관이 만료돼도 전량이 계속 보인다). 계약 유효 판정은 private.institution_writing_contract_active 단일 정의이며 계약 행이 없는 기관은 유효로 본다. ③노출 모드가 `제한 없음` 이면 전체를 허용한다 — 배정 매핑은 보존되지만 게이팅에 참여하지 않는다. ④그 외(`배정분만`, 원장에 행이 없는 경우 포함)에는 topik_writing_question_institution_exposure 에 자기 institution_code 로 매핑된 문항만 허용한다. 폴백은 항상 현행 동작이다(모드 `배정분만`, 옵션 OFF, 계약 유효). 만료는 배정 행을 지우지 않는 lazy 판정이므로 계약 연장 시 즉시 복구된다. public.get_available_writing_questions 의 WHERE 절이 이 함수를 호출하므로 문제목록·상세·라이브러리·RLS 정책·제출 guard 가 모두 여기를 통과한다. 이 본문을 바꾸면 학습자 노출 규칙 자체가 바뀐다. 2026-08-04.';

comment on table public.topik_writing_institution_exposure_mode is
  '기관 코드별 쓰기 문항 노출 모드와 계약 연동 옵션. exposure_mode `제한 없음` = 그 기관 소속 학습자도 service_status=available 문항 전체를 보고 이후 승격되는 신규 문항이 자동 포함된다(배정 목록은 보존되며 게이팅에 참여하지 않는다). `배정분만` = topik_writing_question_institution_exposure 에 배정된 문항만 본다. 행이 없는 기관은 `배정분만` 으로 해석한다 — 폴백은 항상 현행 동작이다. auto_hide_on_expiry = 계약 만료 시 모드와 무관하게 전부 비노출(기본 false), auto_assign_new_questions = 신규 문항이 노출 전환될 때 이 기관에 자동 배정(기본 false, 20260804100100). 부여/변경은 admin_set_institution_exposure_mode / admin_set_institution_auto_hide_on_expiry / admin_set_institution_auto_assign RPC 단일 경로. institution_codes.code 소프트 참조(하드 FK 없음: 별개 마이그 네임스페이스라 적용 순서가 보장되지 않는다).';

-- ---------------------------------------------------------------- 사후 단정
do $verify$
declare
  v_def       text;
  v_pos_hide  integer;
  v_pos_free  integer;
  v_count     integer;
begin
  if to_regclass('public.topik_writing_institution_contracts') is null then
    raise exception 'institution_contracts_table_missing';
  end if;

  -- 겹침 금지가 제약으로 강제되는지(사전 검사만 남으면 동시 삽입에서 겹침이 생긴다).
  select count(*)
    into v_count
    from pg_constraint c
   where c.conrelid = 'public.topik_writing_institution_contracts'::regclass
     and c.contype = 'x'
     and c.conname = 'topik_writing_institution_contracts_no_overlap';
  if v_count <> 1 then
    raise exception 'institution_contracts_overlap_constraint_missing: %', v_count;
  end if;

  if not exists (
    select 1
      from pg_attribute a
     where a.attrelid = 'public.topik_writing_institution_exposure_mode'::regclass
       and a.attname = 'auto_hide_on_expiry'
       and not a.attisdropped
  ) then
    raise exception 'auto_hide_on_expiry_column_missing';
  end if;

  v_def := pg_get_functiondef(
    to_regprocedure('private.is_writing_question_visible_to_user(text,smallint,uuid)')
  );

  -- predicate 가 계약 판정을 실제로 부르는지.
  v_pos_hide := position('private.institution_writing_contract_active(v_affiliation_code)' in v_def);
  if v_pos_hide = 0 then
    raise exception 'institution_contract_predicate_not_wired';
  end if;

  -- 분기 순서 계약: 만료 검사가 무제한 모드 분기보다 앞이어야 한다.
  --
  -- 🚨 위치 비교는 **실행 코드 표현식**으로 한다. pg_get_functiondef 는 본문 주석까지
  -- 포함하므로 `제한 없음` 같은 낱말로 비교하면 그 값을 설명하는 주석에 먼저 걸려
  -- 올바른 코드가 위반으로 판정된다.
  v_pos_free := position('coalesce(v_exposure_mode, ''배정분만'') = ''제한 없음''' in v_def);
  if v_pos_free = 0 or v_pos_hide > v_pos_free then
    raise exception 'institution_contract_expiry_branch_must_precede_unrestricted_branch: hide=% free=%',
      v_pos_hide, v_pos_free;
  end if;

  -- 모드와 옵션을 한 SELECT 로 읽는지(hot path 조회 추가 방지).
  if position('m.exposure_mode, m.auto_hide_on_expiry' in v_def) = 0 then
    raise exception 'institution_contract_predicate_extra_lookup';
  end if;

  -- 20260730120000 의 계약 가드가 검사하는 리터럴 3종이 살아 있는지(down→up 재적용 안전).
  if position('if v_affiliation_code is null then' in v_def) = 0
     or position('topik_writing_question_institution_exposure' in v_def) = 0
     or position('e.institution_code = v_affiliation_code' in v_def) = 0 then
    raise exception 'institution_exposure_contract_literal_lost';
  end if;

  -- G3 가 INSERT 를 전환으로 오인하지 않는지.
  if position('tg_op = ''INSERT''' in
       pg_get_functiondef(to_regprocedure('private.guard_institution_exposure_mode_switch()'))
     ) = 0 then
    raise exception 'institution_exposure_mode_switch_guard_insert_fix_missing';
  end if;

  -- 신규 RPC 가 anon 에 열려 있지 않은지.
  select count(*)
    into v_count
    from (
      select unnest(array[
        'public.admin_list_institution_contracts(text[])',
        'public.admin_list_institution_contract_status(text[])',
        'public.admin_create_institution_contract(text,date,date,text,text,text)',
        'public.admin_update_institution_contract(uuid,date,date,text,text,text)',
        'public.admin_delete_institution_contract(uuid,text)',
        'public.admin_set_institution_auto_hide_on_expiry(text,boolean,text)'
      ]) as sig
    ) s
   where has_function_privilege('anon', s.sig, 'EXECUTE');
  if v_count <> 0 then
    raise exception 'institution_contract_rpc_anon_execute_present: %', v_count;
  end if;
end
$verify$;

