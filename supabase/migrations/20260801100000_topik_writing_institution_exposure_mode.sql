-- =====================================================================
-- 기관 단위 노출 모드 — `제한 없음` / `배정분만`
--
-- 배경: 기관 할당제(계약 SoT = topik_writing_question_institution_exposure 테이블
--   comment, 20260730120000)에는 "이 기관은 제한 없음"을 표현할 방법이 없었다. 그래서
--   기관 3곳이 노출 가능 문항 전량(각 700건)을 배정해 두는 우회책을 썼고, 두 문제가 남았다:
--     ① 드리프트 — 이후 승격되는 신규 문항은 그 기관에 자동 포함되지 않는다.
--     ② 기관을 새로 만들 때마다 "제한 없음"을 표현하려고 전량을 담아야 한다.
--   이 마이그는 모드를 1급 개념으로 만들어 그 우회책을 정식 기능으로 대체한다.
--
-- 오너 결정(2026-07-31):
--   · 값 이름은 `제한 없음` / `배정분만`. `전체 공개` 는 20260730120000·PR #66 에서
--     문항축 라벨로 폐기한 단어라 재사용하지 않는다(축 혼동 방지).
--   · 기존 기관의 초기값은 의도대로 나눈다 — 전량 배정 기관은 `제한 없음`,
--     부분 배정 기관(convention-vn 18건)은 `배정분만`. **오늘 보이는 문항 수는 불변이어야 한다.**
--   · 관리자 전환 지점은 기관 코드 `수정` 모달(사유 필수).
--
-- 왜 모드 원장을 여기(topik_writing)에 두는가: institution_codes 는 admin 네임스페이스
--   (별도 tracker·러너)이고 적용 순서가 항상 topik_writing → admin 이다(supabase/README.md).
--   모드를 그쪽 컬럼에 두면 이 predicate 가 항상 먼저 적용되어 컬럼이 없는 창이 생기고
--   영구적인 방어 코드가 필요해진다. 원장을 predicate 와 같은 파일에서 만들면 그 의존이
--   아예 사라진다. institution_code 를 하드 FK 없이 값으로만 참조하는 것은
--   topik_writing_question_institution_exposure(20260625100000) 와 동형이다.
--
-- 폴백 방향(중요): 모든 기본값·coalesce 는 `배정분만` 이다. `제한 없음` 으로 폴백하면
--   부분 배정 기관의 소속 학습자가 즉시 전체 풀을 보게 된다 — 되돌릴 수 없는 노출 사고다.
--
-- down: supabase/migrations/down/20260801100000_topik_writing_institution_exposure_mode.sql
-- =====================================================================

-- ---------------------------------------------------------------- 모드 원장
create table if not exists public.topik_writing_institution_exposure_mode (
  institution_code text primary key,  -- institution_codes.code 소프트 참조(하드 FK 미사용, 위 헤더 참조)
  exposure_mode    text not null default '배정분만'
                   check (exposure_mode in ('제한 없음', '배정분만')),
  reason           text,
  changed_by       uuid,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

-- RLS 는 exposure 매핑 테이블(20260625100000)과 동형: enable 만(force 금지 — force 는
-- 소유자에게도 정책을 강제해 definer 경로를 막는다), 읽기는 admin, 쓰기 정책 0개
-- → security definer RPC 단일 경로.
alter table public.topik_writing_institution_exposure_mode enable row level security;

drop policy if exists topik_writing_institution_exposure_mode_admin_select
  on public.topik_writing_institution_exposure_mode;
create policy topik_writing_institution_exposure_mode_admin_select
  on public.topik_writing_institution_exposure_mode
  for select to authenticated using (private.is_admin((select auth.uid())));

comment on table public.topik_writing_institution_exposure_mode is
  '기관 코드별 쓰기 문항 노출 모드. `제한 없음` = 그 기관 소속 학습자도 service_status=available 문항 전체를 보고 이후 승격되는 신규 문항이 자동 포함된다(배정 목록은 보존되며 게이팅에 참여하지 않는다). `배정분만` = topik_writing_question_institution_exposure 에 배정된 문항만 본다. 행이 없는 기관은 `배정분만` 으로 해석한다 — 폴백은 항상 현행 동작이다. 부여/변경은 admin_set_institution_exposure_mode RPC 단일 경로. institution_codes.code 소프트 참조(하드 FK 없음: 별개 마이그 네임스페이스라 적용 순서가 보장되지 않는다).';

comment on column public.topik_writing_institution_exposure_mode.exposure_mode is
  '`제한 없음` 또는 `배정분만`. 기본값 `배정분만`. 문항축 라벨(`미배정`/`기관 N곳 배정`)과 다른 축이며, 2026-07-30 에 폐기된 문항축 라벨 `전체 공개` 와는 무관한 값이다.';

-- ---------------------------------------------------------------- 백필
-- 규칙: 적용 시점의 노출 가능 풀 전량이 이미 배정된 기관만 `제한 없음` 으로 올린다.
-- 코드명을 하드코딩하지 않는 이유 — 이 조건에서는 두 모드의 가시 집합이 정의상 동일하므로
-- "동작 불변"이 주장이 아니라 증명이 된다. 환경(dev/prod/shadow)마다 배정 데이터가 달라도
-- 같은 규칙이 각 환경에서 옳은 답을 낸다.
do $backfill$
declare
  v_pool_total bigint;
  v_promoted integer := 0;
  v_violation text;
begin
  -- 풀 정의는 public.get_available_writing_questions 의 FROM/JOIN/WHERE 와 동일하게 유지한다.
  create temporary table topik_writing_mode_backfill_pool
  on commit drop
  as
  select q.question_id, q.item_number
    from private.topik_writing_question_learner_projection q
    join public.topik_writing_question_source_map sm
      on sm.question_id = q.question_id
     and sm.item_number = q.item_number
     and sm.learner_problem_id is not null
     and sm.canonical_import_id is not null
    join public.topik_writing_question_import imp
      on imp.import_id = sm.canonical_import_id
     and imp.source_task_id = q.question_id
     and imp.promoted_question_id = q.question_id
     and imp.item_number = q.item_number
     and imp.mapping_status = 'promoted'
   where q.service_status = 'available';

  select count(*) into v_pool_total from topik_writing_mode_backfill_pool;

  -- 빈 풀 방어: 풀이 0건이면 "전량 배정" 조건이 모든 기관에 공허하게 참이 되어
  -- 신규·shadow 환경의 전 기관이 `제한 없음` 으로 뒤집힌다.
  if v_pool_total = 0 then
    raise notice 'topik_writing institution exposure mode backfill skipped: available pool is empty';
    return;
  end if;

  insert into public.topik_writing_institution_exposure_mode (
    institution_code,
    exposure_mode,
    reason
  )
  select codes.institution_code,
         '제한 없음',
         '20260801100000 백필: 적용 시점의 노출 가능 문항 전량이 이미 배정돼 있어 모드 전환으로 가시 문항 집합이 달라지지 않는다.'
    from (
      select distinct institution_code
        from public.topik_writing_question_institution_exposure
    ) codes
   where not exists (
     select 1
       from topik_writing_mode_backfill_pool p
      where not exists (
        select 1
          from public.topik_writing_question_institution_exposure e
         where e.institution_code = codes.institution_code
           and e.question_id = p.question_id
           and e.item_number = p.item_number
      )
   )
  on conflict (institution_code) do nothing;

  get diagnostics v_promoted = row_count;

  -- 사후 단정: `제한 없음` 으로 기록된 기관은 예외 없이 풀 전량을 덮고 있어야 한다.
  -- 하나라도 어긋나면 그 기관의 가시 집합이 커지므로 마이그 전체를 롤백한다.
  select string_agg(m.institution_code, ', ')
    into v_violation
    from public.topik_writing_institution_exposure_mode m
   where m.exposure_mode = '제한 없음'
     and exists (
       select 1
         from topik_writing_mode_backfill_pool p
        where not exists (
          select 1
            from public.topik_writing_question_institution_exposure e
           where e.institution_code = m.institution_code
             and e.question_id = p.question_id
             and e.item_number = p.item_number
        )
     );

  if v_violation is not null then
    raise exception 'institution_exposure_mode_backfill_would_change_visibility: %', v_violation;
  end if;

  raise notice 'topik_writing institution exposure mode backfill: % code(s) promoted to 제한 없음 (pool=%)',
    v_promoted, v_pool_total;
end
$backfill$;

-- ---------------------------------------------------------------- 학습자 predicate
-- 시그니처 불변(create or replace). 무소속 분기 뒤에 모드 분기를 끼운다.
-- 20260730120000 의 do $contract_guard$ 가 이 본문에서 다음 세 리터럴을 문자열 검사하므로
-- 그대로 보존한다: `if v_affiliation_code is null then return true;`,
-- `topik_writing_question_institution_exposure`, `e.institution_code = v_affiliation_code`.
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

  -- 기관 노출 모드. 행이 없으면 기관 할당제를 유지한다 — 폴백은 항상 현행 동작이다.
  select m.exposure_mode
    into v_exposure_mode
    from public.topik_writing_institution_exposure_mode m
   where m.institution_code = v_affiliation_code;

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

-- ---------------------------------------------------------------- 학습자 인구 헬퍼
-- G2·G3 공용. institution_code_invitations 는 admin 네임스페이스 소유라 적용 순서가
-- 보장되지 않는다 → to_regclass fail-open + 동적 EXECUTE(20260731100100 과 같은 패턴).
create or replace function private.institution_learner_population(
  p_code text,
  out member_count bigint,
  out pending_invitation_count bigint
)
language plpgsql
stable
security definer
set search_path = pg_catalog, public, private
as $$
begin
  select count(*)
    into member_count
    from public.profiles p
   where nullif(btrim(p.affiliation_code), '') = p_code;

  pending_invitation_count := 0;
  if to_regclass('public.institution_code_invitations') is not null then
    execute
      'select count(*) from public.institution_code_invitations i'
      || ' where i.code = $1 and i.status = ''pending'''
      into pending_invitation_count
      using p_code;
  end if;
end;
$$;

revoke all on function private.institution_learner_population(text) from public;
revoke all on function private.institution_learner_population(text) from anon;
revoke all on function private.institution_learner_population(text) from authenticated;
revoke all on function private.institution_learner_population(text) from service_role;

comment on function private.institution_learner_population(text) is
  '기관 코드의 소속 회원 수와 대기 중 초대 수. 빈 화면 가드(마지막 배정 삭제·모드 전환)가 공용으로 쓴다. institution_code_invitations 가 없으면 대기 초대를 0 으로 본다(admin 네임스페이스라 적용 순서 미보장). 2026-08-01.';

-- ---------------------------------------------------------------- G2 갱신
-- 20260731100100 의 트리거 함수를 모드 인지형으로 교체한다. `제한 없음` 기관은 배정이
-- 0건이 되어도 학습자가 available 전체를 보므로 막을 이유가 없다. 트리거 자체는 재생성 불필요.
create or replace function private.guard_institution_exposure_last_assignment()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public, private
as $$
declare
  v_code text;
  v_population record;
begin
  -- 기관 코드 원장이 아직 없으면 이 가드가 보호할 상태가 없다.
  if to_regclass('public.institution_codes') is null then
    return null;
  end if;

  -- 이 문장에서 행이 빠진 기관 중 ①배정이 0건이 됐고 ②아직 살아 있으며
  -- ③`배정분만` 모드인 코드만 후보다. `제한 없음` 기관은 배정 0건이 빈 화면을 뜻하지 않는다.
  for v_code in
    select distinct removed.institution_code
    from removed_rows removed
    where not exists (
      select 1
      from public.topik_writing_question_institution_exposure e
      where e.institution_code = removed.institution_code
    )
      and exists (
        select 1
        from public.institution_codes c
        where c.code = removed.institution_code
      )
      and coalesce(
        (
          select m.exposure_mode
          from public.topik_writing_institution_exposure_mode m
          where m.institution_code = removed.institution_code
        ),
        '배정분만'
      ) = '배정분만'
  loop
    select *
      into v_population
      from private.institution_learner_population(v_code);

    if v_population.member_count > 0 or v_population.pending_invitation_count > 0 then
      raise exception
        'cannot remove the last writing assignment of institution %: % member(s) and % pending invitation(s) would see no writing questions',
        v_code, v_population.member_count, v_population.pending_invitation_count
        using detail = '이 기관은 배정분만 모드이므로 배정된 문항만 학습자에게 보인다. 배정이 0건이면 쓰기 문항 목록이 비어 있다.',
              hint = '문항 배정을 최소 1건 남기거나, 회원 소속을 먼저 해제하거나, 기관 코드를 제한 없음 모드로 바꾸어라.';
    end if;
  end loop;

  return null;
end;
$$;

comment on function private.guard_institution_exposure_last_assignment() is
  '배정분만 모드 기관의 쓰기 문항 배정이 0건으로 떨어지는 것을 막는 statement 트리거(회원 또는 대기 중 초대가 있을 때). 제한 없음 모드 기관은 배정 0건이 빈 화면을 뜻하지 않으므로 제외한다. 삭제 RPC 3종을 개별 패치하는 대신 테이블에 걸어 현재·미래 경로를 모두 덮는다. 2026-08-01 모드 인지형으로 갱신.';

-- ---------------------------------------------------------------- G3 신설: 모드 전환 가드
-- `제한 없음` → `배정분만` 전환은 배정 0건 + 회원/대기초대가 있으면 즉시 빈 화면을 만든다.
-- 기존 가드 둘은 institution_codes / exposure 만 감시하므로 이 경로는 비어 있었다.
-- RPC 안이 아니라 테이블 트리거에 두는 이유는 G2 와 같다 — 미래에 다른 쓰기 경로가 생겨도 덮인다.
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

drop trigger if exists topik_writing_institution_exposure_mode_switch_guard
  on public.topik_writing_institution_exposure_mode;
create trigger topik_writing_institution_exposure_mode_switch_guard
before insert or update of exposure_mode
on public.topik_writing_institution_exposure_mode
for each row execute function private.guard_institution_exposure_mode_switch();

-- ---------------------------------------------------------------- 관리 RPC 2종
-- 기존 institution_codes RPC 를 확장하지 않는 이유: check-expand-migrations 가 신규 forward
-- 마이그의 `drop function` 을 차단하므로 반환 타입·인자 변경(= drop + create)이 불가능하다.
-- 따라서 모드는 별도 read/write RPC 로 제공하고 화면이 병합한다.
create or replace function public.admin_list_institution_exposure_modes(
  p_codes text[] default null
)
returns table (
  code text,
  exposure_mode text,
  assigned_question_count bigint,
  reason text,
  updated_at timestamptz
)
language plpgsql
security definer
stable
set search_path = pg_catalog, public, private
as $$
declare
  caller_id uuid := auth.uid();
begin
  if caller_id is null then
    raise exception 'unauthenticated';
  end if;
  if not private.is_admin(caller_id) then
    raise exception 'forbidden: admin required';
  end if;

  -- 기관 코드 원장을 기준으로 좌결합한다. 모드 테이블만 훑으면 "모드 행은 없지만 배정은
  -- 있는" 코드가 배정 0건으로 보고되어 관리 화면의 빈 화면 가드가 오작동한다.
  -- institution_codes 는 admin 네임스페이스지만 이 RPC 는 관리자 호출 시점에만 실행되므로
  -- 적용 순서 문제가 없다(plpgsql 은 호출 시 해석한다).
  return query
  select c.code,
         coalesce(m.exposure_mode, '배정분만'),
         (
           select count(*)
             from public.topik_writing_question_institution_exposure e
            where e.institution_code = c.code
         ),
         coalesce(m.reason, ''),
         m.updated_at
    from public.institution_codes c
    left join public.topik_writing_institution_exposure_mode m
      on m.institution_code = c.code
   where p_codes is null or c.code = any(p_codes)
   order by c.code;
end;
$$;

revoke all on function public.admin_list_institution_exposure_modes(text[]) from public;
revoke all on function public.admin_list_institution_exposure_modes(text[]) from anon;
grant execute on function public.admin_list_institution_exposure_modes(text[]) to authenticated;

comment on function public.admin_list_institution_exposure_modes(text[]) is
  '기관 코드별 실효 노출 모드와 배정 건수. institution_codes 기준 좌결합이라 모드 원장에 행이 없는 코드도 `배정분만` + 실제 배정 건수로 반환한다(모드 테이블만 훑으면 "행 없지만 배정 있는" 코드가 0건으로 보고되어 관리 화면 가드가 오작동한다). admin_list_institution_codes 는 반환 타입을 바꿀 수 없어(expand 게이트가 함수 삭제·재생성을 차단한다) 모드를 이 RPC 로 분리 조회하고 화면이 병합한다. 2026-08-01.';

create or replace function public.admin_set_institution_exposure_mode(
  p_code text,
  p_mode text,
  p_reason text
)
returns text
language plpgsql
security definer
set search_path = pg_catalog, public, private
as $$
declare
  caller_id uuid := auth.uid();
  v_code   text := btrim(coalesce(p_code, ''));
  v_mode   text := btrim(coalesce(p_mode, ''));
  v_reason text := nullif(btrim(coalesce(p_reason, '')), '');
  v_old    text;
  v_assigned bigint;
  v_population record;
begin
  if caller_id is null then raise exception 'unauthenticated'; end if;
  if not private.is_admin(caller_id) then raise exception 'forbidden: admin required'; end if;
  if not private.admin_has_permission(caller_id, 'users.institution-codes.manage') then
    raise exception 'forbidden: missing permission users.institution-codes.manage';
  end if;
  if v_code = '' then raise exception 'code required'; end if;
  if v_reason is null then raise exception 'reason required'; end if;
  if v_mode not in ('제한 없음', '배정분만') then
    raise exception 'invalid exposure mode: %', v_mode;
  end if;
  if not exists (select 1 from public.institution_codes c where c.code = v_code) then
    raise exception 'unknown code: %', v_code;
  end if;

  select m.exposure_mode
    into v_old
    from public.topik_writing_institution_exposure_mode m
   where m.institution_code = v_code
   for update;

  -- 행이 없으면 현재 유효값은 기본값이다.
  v_old := coalesce(v_old, '배정분만');
  if v_old = v_mode then
    return v_code;  -- 변경 없음 — 감사 행을 남기지 않는다(모달이 항상 호출해도 안전).
  end if;

  insert into public.topik_writing_institution_exposure_mode (
    institution_code, exposure_mode, reason, changed_by, updated_at
  ) values (
    v_code, v_mode, v_reason, caller_id, now()
  )
  on conflict (institution_code) do update set
    exposure_mode = excluded.exposure_mode,
    reason = excluded.reason,
    changed_by = excluded.changed_by,
    updated_at = now();

  select count(*)
    into v_assigned
    from public.topik_writing_question_institution_exposure e
   where e.institution_code = v_code;

  select *
    into v_population
    from private.institution_learner_population(v_code);

  insert into public.admin_audit_logs (
    admin_user_id, action, target_table, target_id, diff, payload
  ) values (
    caller_id,
    'institution_exposure_mode_changed',
    'InstitutionCode',
    v_code,
    jsonb_build_object('exposure_mode', jsonb_build_object('from', v_old, 'to', v_mode)),
    jsonb_build_object(
      'reason', v_reason,
      'code', v_code,
      'assignment_count', v_assigned,
      'member_count', v_population.member_count,
      'pending_invitation_count', v_population.pending_invitation_count
    )
  );

  return v_code;
end;
$$;

revoke all on function public.admin_set_institution_exposure_mode(text, text, text) from public;
revoke all on function public.admin_set_institution_exposure_mode(text, text, text) from anon;
grant execute on function public.admin_set_institution_exposure_mode(text, text, text) to authenticated;

comment on function public.admin_set_institution_exposure_mode(text, text, text) is
  '기관 코드의 쓰기 문항 노출 모드를 변경한다(사유 필수, platform 권한 users.institution-codes.manage). 값이 그대로면 감사 행 없이 조기 반환한다. 배정 0건 + 회원/대기초대 있는 상태로 `배정분만` 전환은 모드 테이블 트리거가 거부한다. 감사 action = institution_exposure_mode_changed, Target = InstitutionCode + code. 2026-08-01.';

-- ---------------------------------------------------------------- 계약 comment 재-stamp
-- 20260730120000 이 stamp 한 문구는 "미배정 문항은 기관 소속 학습자에게 보이지 않는다"를
-- 무조건으로 단정한다. 모드 도입 후에는 `배정분만` 기관에 한해서만 참이다.
-- create or replace 는 comment 를 보존하므로 여기서 명시적으로 덮어써야 한다.
comment on table public.topik_writing_question_institution_exposure is
  'TOPIK 쓰기 문항 × 기관코드 배정 매핑(기관 할당제). 매핑 행 = 해당 institution_codes.code 소속 학습자에게 그 문항을 허용하는 목록이며, 다른 학습자에게 잠그는 장치가 아니다(매핑된 문항도 무소속 학습자에게는 계속 보인다). service_status 위에 얹히는 직교 레이어. 부여/해제는 admin_set/clear_writing_question_institutions(문항중심)와 admin_add/remove_institution_writing_questions(기관중심) RPC 단일 경로(content_admin). 학습자 최종 노출 계약: service_status=available AND (user.affiliation_code 없음 OR 기관 노출 모드 = 제한 없음 OR 매핑.institution_code = user.affiliation_code). 즉 무소속 학습자는 available 전체를 보고, `제한 없음` 모드 기관의 소속 학습자도 available 전체를 보며(이 매핑은 보존되지만 게이팅에 참여하지 않는다), `배정분만` 모드 기관의 소속 학습자만 배정된 문항으로 제한된다(미배정 문항은 보이지 않는다). 모드 원장은 topik_writing_institution_exposure_mode 이며 행이 없으면 `배정분만` 이다. 강제 지점은 private.is_writing_question_visible_to_user 단 하나이고, public.get_available_writing_questions(canonical reader)의 WHERE 절이 목록·상세·라이브러리·RLS·제출 경로를 모두 이 predicate 로 통과시킨다. 2026-07-30 오너 결정으로 할당제를 계약으로 확정했고(종전 문구 "매핑 없음=전체 공개"는 구현된 적이 없다), 2026-08-01 기관 단위 모드를 추가했다.';

comment on function private.is_writing_question_visible_to_user(text, smallint, uuid) is
  '기관 할당제 학습자 가시성 predicate — 기관별 쓰기 문항 노출의 유일한 강제 지점. 세 분기다: ①profiles.affiliation_code 가 없는 학습자에게는 available 문항 전체를 허용한다. ②소속 기관의 노출 모드가 `제한 없음` 이면(topik_writing_institution_exposure_mode) 역시 전체를 허용한다 — 배정 매핑은 보존되지만 게이팅에 참여하지 않는다. ③그 외(`배정분만`, 원장에 행이 없는 경우 포함)에는 topik_writing_question_institution_exposure 에 자기 institution_code 로 매핑된 문항만 허용한다. 폴백은 항상 `배정분만`(=현행 동작)이다. public.get_available_writing_questions 의 WHERE 절이 이 함수를 호출하므로 문제목록·상세·라이브러리·RLS 정책·제출 guard 가 모두 여기를 통과한다. 이 본문을 바꾸면 학습자 노출 규칙 자체가 바뀐다. 2026-08-01.';

comment on function public.get_available_writing_questions(smallint, uuid) is
  'Learner-safe canonical list/detail RPC. Caller identity comes only from auth.uid(); answer, rubric, raw import, and internal review fields are excluded. Institution exposure is enforced here through private.is_writing_question_visible_to_user: learners without profiles.affiliation_code get the full available pool, learners whose institution is in 제한 없음 mode also get the full pool, and learners whose institution is in 배정분만 mode get only the questions mapped to their institution_code in topik_writing_question_institution_exposure. The per-institution mode ledger is topik_writing_institution_exposure_mode and defaults to 배정분만 when no row exists.';

-- ---------------------------------------------------------------- 사후 단정
do $verify$
declare
  v_count integer;
begin
  if to_regclass('public.topik_writing_institution_exposure_mode') is null then
    raise exception 'institution_exposure_mode_table_missing';
  end if;

  select count(*)
    into v_count
    from pg_trigger t
   where t.tgrelid = 'public.topik_writing_institution_exposure_mode'::regclass
     and not t.tgisinternal
     and t.tgname = 'topik_writing_institution_exposure_mode_switch_guard';
  if v_count <> 1 then
    raise exception 'institution_exposure_mode_switch_guard_missing: %', v_count;
  end if;

  -- predicate 가 모드를 실제로 읽는지(문자열 수술·오적용 방지).
  if position(
    'topik_writing_institution_exposure_mode' in
    pg_get_functiondef(
      to_regprocedure('private.is_writing_question_visible_to_user(text,smallint,uuid)')
    )
  ) = 0 then
    raise exception 'institution_exposure_mode_predicate_not_wired';
  end if;

  -- G2 가 모드를 보는지.
  if position(
    'topik_writing_institution_exposure_mode' in
    pg_get_functiondef(
      to_regprocedure('private.guard_institution_exposure_last_assignment()')
    )
  ) = 0 then
    raise exception 'institution_exposure_mode_last_assignment_guard_not_wired';
  end if;

  -- 20260730120000 의 계약 가드가 검사하는 세 리터럴이 살아 있는지(down→up 재적용 안전).
  if position(
    'if v_affiliation_code is null then' in
    pg_get_functiondef(
      to_regprocedure('private.is_writing_question_visible_to_user(text,smallint,uuid)')
    )
  ) = 0 then
    raise exception 'institution_exposure_contract_literal_lost';
  end if;
end
$verify$;
