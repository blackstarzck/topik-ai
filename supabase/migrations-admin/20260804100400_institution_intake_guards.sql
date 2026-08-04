-- =====================================================================
-- 기관 intake 가드 — 정원, 계약 만료 차단, 기관별 초대 유효기간 기본값
--
-- 🚨 절대 금지: admin_assign_institution_code 와 admin_invite_institution_members 를
--   재정의하지 마라. 20260731100000 이 두 함수의 **라이브 정의를 문자열 수술**로 패치해
--   선행조건 가드를 심어 두었다(앵커 = 각 함수의 `활성` 코드 검사 줄). create or replace
--   로 덮으면 그 가드가 조용히 사라지고, 배정 0건 기관에 회원이 들어가 빈 화면이 된다
--   (PR #69 가 막은 바로 그 경로). 확장은 아래 3축으로만 한다.
--
-- 축 ①: 헬퍼 교체 (20260801100100 선례 — 헬퍼만 create or replace, 호출부 무수정)
--   private.institution_has_writing_assignment 에 "만료 자동 비노출 ON + 계약 무효" 분기를
--   추가한다. 그 상태의 기관에 회원을 넣으면 배정이 있어도 학습자 화면이 비기 때문이다.
--   수술된 두 RPC 는 함수 이름이 같으므로 호출부를 건드리지 않고 의미만 강화된다.
--
--   **block_intake_on_expiry 는 이 헬퍼에 넣지 않는다.** 넣으면 순수 행정 차단인데도
--   수술된 RPC 가 심어둔 고정 메시지 'institution % has no writing question assignment'
--   가 나가 원인을 오인하게 만든다(그 메시지는 수술 본문에 박혀 있어 바꿀 수 없다).
--   auto_hide 는 "학습자가 실제로 아무것도 못 본다" 는 뜻이라 그 메시지와 의미가 맞지만
--   행정 차단은 다르다. 행정 차단은 축 ② 의 wrapper 가 제 메시지로 처리한다.
--
-- 축 ②: 정원·차단·초대 기본값 wrapper RPC 2종 (원함수를 호출하는 신규 함수)
--   배치 단위로 "새로 소비할 좌석 수" 를 계산해 사전 검사하므로 정확하고 친절한 오류를
--   낸다. 초대 wrapper 는 p_expires_in_days 가 null 이면 기관 설정의
--   default_invite_expiry_days(없으면 전역 7일)로 해석한다 — 기관별 초대 유효기간
--   기본값의 서버측 구현 지점이다. FE 전환은 PR-C 에서 한다.
--
-- 축 ③: 초대 정원 백스톱 트리거 (AFTER INSERT FOR EACH ROW)
--   wrapper 를 우회하는 현재·미래의 모든 초대 경로를 덮는다(G2·G3 가 RPC 안이 아니라
--   테이블에 걸린 것과 같은 철학). 초대 RPC 는 대상 1명당 INSERT 1건이므로 row 트리거로
--   원자적 롤백이 성립한다(실측).
--
-- 직접 배정(profiles.affiliation_code)에는 DB 백스톱을 두지 않는다 — profiles 트리거는
--   v13 소유라 이 저장소가 만들 수 없다. wrapper 사전 검사 + FE 로만 덮이는 한계다.
-- respond_institution_invitation(수락)은 불변경 — v13 앱에 새 예외를 던지지 않는 기존
--   방침을 유지한다. 대기 초대가 좌석을 선점 계상하므로 수락 시점에 초과가 불가능하다.
--
-- 경계: profiles 를 읽기만 한다. 수술된 두 RPC 를 건드리지 않으므로
--   ALLOWED_PROFILE_WRITE_FILES 등재도 불필요하다.
-- down: supabase/migrations-admin/down/20260804100400_institution_intake_guards.sql
-- =====================================================================

-- ---------------------------------------------------------------- 축 ①: 헬퍼 교체
create or replace function private.institution_has_writing_assignment(p_code text)
returns boolean
language plpgsql
stable
security definer
set search_path = pg_catalog, public, private
as $$
declare
  v_code       text := nullif(btrim(coalesce(p_code, '')), '');
  v_mode_table regclass;
  v_mode       text;
  v_auto_hide  boolean;
  v_active     boolean;
begin
  if v_code is null then
    return true;
  end if;

  -- 노출 매핑 테이블이 없으면 게이팅 레이어 자체가 없다는 뜻이라 빈 화면 위험도 없다
  -- (20260731100000 의 fail-open 계약 유지).
  if to_regclass('public.topik_writing_question_institution_exposure') is null then
    return true;
  end if;

  v_mode_table := to_regclass('public.topik_writing_institution_exposure_mode');
  if v_mode_table is not null then
    execute
      'select m.exposure_mode from public.topik_writing_institution_exposure_mode m'
      || ' where m.institution_code = $1'
      into v_mode
      using v_code;

    -- 만료 자동 비노출: 옵션이 켜져 있고 계약이 무효면 배정이 있어도 학습자는 아무것도
    -- 보지 못한다 → 회원을 넣어서는 안 된다. `제한 없음` 판정보다 **앞**에 둔다
    -- (뒤에 두면 제한 없음 기관은 만료 상태로도 회원을 받아버린다).
    --
    -- auto_hide 컬럼과 계약 판정 함수는 topik_writing 폴더(20260804100000)가 만든다.
    -- 두 폴더는 tracker 가 달라 부분 적용 창이 존재하므로 **컬럼 단위로** 존재를 확인한
    -- 뒤에만 읽는다(테이블 존재만 보면 컬럼 없는 창에서 42703 으로 실패한다).
    if to_regprocedure('private.institution_writing_contract_active(text)') is not null
       and exists (
         select 1
           from pg_attribute a
          where a.attrelid = v_mode_table
            and a.attname = 'auto_hide_on_expiry'
            and not a.attisdropped
       ) then
      execute
        'select coalesce(m.auto_hide_on_expiry, false)'
        || ' from public.topik_writing_institution_exposure_mode m'
        || ' where m.institution_code = $1'
        into v_auto_hide
        using v_code;

      if coalesce(v_auto_hide, false) then
        execute 'select private.institution_writing_contract_active($1)'
          into v_active
          using v_code;
        if not coalesce(v_active, true) then
          return false;
        end if;
      end if;
    end if;

    -- 모드가 `제한 없음` 이면 배정 0건이어도 소속 학습자가 available 전체를 본다.
    -- 원장이 아직 없으면 `배정분만` 으로 본다(현행 동작).
    if coalesce(v_mode, '배정분만') = '제한 없음' then
      return true;
    end if;
  end if;

  return exists (
    select 1
    from public.topik_writing_question_institution_exposure e
    where e.institution_code = v_code
  );
end;
$$;

revoke all on function private.institution_has_writing_assignment(text) from public;
revoke all on function private.institution_has_writing_assignment(text) from anon;
revoke all on function private.institution_has_writing_assignment(text) from authenticated;
revoke all on function private.institution_has_writing_assignment(text) from service_role;

comment on function private.institution_has_writing_assignment(text) is
  '기관 코드에 회원을 배정·초대해도 그 학습자가 쓰기 문항을 볼 수 있는지. ①`만료 시 자동 비노출` 이 켜져 있고 계약이 무효면 배정 유무와 무관하게 false 다(학습자가 실제로 아무것도 못 본다) — 이 판정은 `제한 없음` 판정보다 앞에 온다. ②`제한 없음` 모드 기관은 배정 0건이어도 true. ③`배정분만`(또는 모드 원장에 행이 없음)에는 배정이 1건 이상이어야 true. 노출 매핑·모드 원장·auto_hide 컬럼·계약 판정 함수가 아직 없으면(폴더 간 부분 적용 창) 각각 fail-open 한다 — 컬럼 존재를 개별 확인하는 이유는 테이블만 확인하면 컬럼 없는 창에서 실패하기 때문이다. block_intake_on_expiry 는 여기서 보지 않는다(행정 차단은 wrapper 가 제 메시지로 처리 — 수술된 RPC 의 고정 메시지가 원인을 오인시킨다). 회원 배정·초대 진입점이 이 함수를 선행조건으로 검사한다. 2026-08-04.';

-- ---------------------------------------------------------------- 축 ②: 공통 사전 검사 헬퍼
-- 두 wrapper 가 같은 규칙을 쓰도록 한 곳에 둔다.
create or replace function private.assert_institution_intake_allowed(
  p_code       text,
  p_new_seats  bigint
)
returns void
language plpgsql
security definer
set search_path = pg_catalog, public, private
as $$
declare
  v_code     text := nullif(btrim(coalesce(p_code, '')), '');
  v_settings public.institution_code_settings%rowtype;
  v_active   boolean := true;
  v_usage    record;
begin
  if v_code is null then
    return;
  end if;

  select * into v_settings
    from public.institution_code_settings
   where institution_code = v_code;

  if to_regprocedure('private.institution_writing_contract_active(text)') is not null then
    execute 'select private.institution_writing_contract_active($1)'
      into v_active
      using v_code;
  end if;
  v_active := coalesce(v_active, true);

  -- 계약 만료 시 행정 차단(노출과 무관한 별개 옵션).
  if coalesce(v_settings.block_intake_on_expiry, false) and not v_active then
    raise exception 'institution % has no active contract; member intake is blocked', v_code
      using detail = '이 기관은 "계약 만료 시 배정·초대 차단" 옵션이 켜져 있고 현재 유효한 계약이 없다.',
            hint = '계약 탭에서 계약 기간을 갱신하거나 차단 옵션을 해제하여라.';
  end if;

  -- 정원 검사. 좌석 = 소속 회원 + 미만료 대기 초대(private.institution_seat_usage).
  if v_settings.max_members is not null then
    select * into v_usage from private.institution_seat_usage(v_code);
    if v_usage.seats_used + coalesce(p_new_seats, 0) > v_settings.max_members then
      raise exception
        'institution % seat limit exceeded: % used + % requested > % allowed',
        v_code, v_usage.seats_used, coalesce(p_new_seats, 0), v_settings.max_members
        using detail = '좌석 사용량 = 소속 회원 + 미만료 대기 초대. 대기 초대도 자리를 선점한다.',
              hint = '정원을 늘리거나, 대기 초대를 취소하거나, 대상 인원을 줄여라.';
    end if;
  end if;
end;
$$;

revoke all on function private.assert_institution_intake_allowed(text, bigint) from public;
revoke all on function private.assert_institution_intake_allowed(text, bigint) from anon;
revoke all on function private.assert_institution_intake_allowed(text, bigint) from authenticated;
revoke all on function private.assert_institution_intake_allowed(text, bigint) from service_role;

comment on function private.assert_institution_intake_allowed(text, bigint) is
  '기관 신규 유입 사전 검사 — 계약 만료 행정 차단(block_intake_on_expiry)과 정원(max_members)을 배치 단위로 확인하고 위반 시 원인별 메시지로 예외를 던진다. p_new_seats = 이 배치가 새로 소비할 좌석 수. 계약 판정 함수가 아직 없으면 유효로 본다(폴더 간 부분 적용 창 fail-open). 두 intake wrapper 가 공유한다. 2026-08-04.';

-- ---------------------------------------------------------------- 축 ②: 배정 wrapper
create or replace function public.admin_assign_institution_code_guarded(
  p_user_ids uuid[],
  p_code     text,
  p_reason   text
)
returns integer
language plpgsql
security definer
set search_path = pg_catalog, public, private
as $$
declare
  caller_id  uuid := auth.uid();
  v_code     text := btrim(coalesce(p_code, ''));
  v_new_seats bigint := 0;
begin
  -- 원함수와 같은 권한 바를 유지한다(더 느슨해지면 wrapper 가 우회로가 된다).
  if caller_id is null then raise exception 'unauthenticated'; end if;
  if not private.is_platform_admin(caller_id) then
    raise exception 'forbidden: platform_admin required';
  end if;
  if v_code = '' then raise exception 'code required'; end if;
  if p_user_ids is null or array_length(p_user_ids, 1) is null then
    raise exception 'user ids required';
  end if;

  -- 이 배치가 새로 소비할 좌석 수 = 아직 이 코드 소속이 아닌 대상 인원.
  -- 이미 같은 코드 소속인 회원은 원함수가 건너뛰므로 좌석을 새로 쓰지 않는다.
  select count(*)
    into v_new_seats
    from (
      select distinct x as id from unnest(p_user_ids) as t(x) where x is not null
    ) ids
    join public.profiles p on p.id = ids.id
   where coalesce(nullif(btrim(p.affiliation_code), ''), '') <> v_code
     and coalesce(p.status, '') <> 'deleted';

  perform private.assert_institution_intake_allowed(v_code, v_new_seats);

  -- 원함수 위임. 문자열 수술로 심어진 선행조건 가드가 그 안에서 그대로 돈다.
  return public.admin_assign_institution_code(p_user_ids, v_code, p_reason);
end;
$$;

revoke all on function public.admin_assign_institution_code_guarded(uuid[], text, text) from public;
revoke all on function public.admin_assign_institution_code_guarded(uuid[], text, text) from anon;
grant execute on function public.admin_assign_institution_code_guarded(uuid[], text, text) to authenticated;

comment on function public.admin_assign_institution_code_guarded(uuid[], text, text) is
  'Users > 기관 직접 배정(정원·계약 차단 사전 검사 포함). 새로 소비할 좌석 수를 배치 단위로 계산해 private.assert_institution_intake_allowed 로 검사한 뒤 public.admin_assign_institution_code 에 위임한다 — 원함수는 문자열 수술로 선행조건 가드가 심어져 있어 재정의가 금지되므로 확장을 wrapper 로 한다. platform_admin 권한 바는 원함수와 동일하다. 2026-08-04.';

-- ---------------------------------------------------------------- 축 ②: 초대 wrapper
create or replace function public.admin_invite_institution_members_guarded(
  p_user_ids        uuid[],
  p_code            text,
  p_reason          text,
  p_expires_in_days integer default null
)
returns integer
language plpgsql
security definer
set search_path = pg_catalog, public, private
as $$
declare
  caller_id   uuid := auth.uid();
  v_code      text := btrim(coalesce(p_code, ''));
  v_new_seats bigint := 0;
  v_days      integer;
begin
  if caller_id is null then raise exception 'unauthenticated'; end if;
  if not private.is_platform_admin(caller_id) then
    raise exception 'forbidden: platform_admin required';
  end if;
  if v_code = '' then raise exception 'code required'; end if;
  if p_user_ids is null or array_length(p_user_ids, 1) is null then
    raise exception 'user ids required';
  end if;

  -- 기관별 초대 유효기간 기본값의 해석 지점. 명시값 > 기관 설정 > 전역 7일.
  select coalesce(p_expires_in_days, s.default_invite_expiry_days, 7)
    into v_days
    from (select 1) one
    left join public.institution_code_settings s
      on s.institution_code = v_code;
  v_days := coalesce(v_days, 7);

  -- 새로 소비할 좌석 수 = 원함수의 스킵 규칙(동일 코드 기소속 / 유효 pending 존재 /
  -- deleted)을 뺀 인원. 만료 경과 pending 은 원함수가 expired 로 전환해 재초대하므로
  -- 좌석을 새로 쓰는 대상에 포함한다.
  select count(*)
    into v_new_seats
    from (
      select distinct x as id from unnest(p_user_ids) as t(x) where x is not null
    ) ids
    join public.profiles p on p.id = ids.id
   where coalesce(nullif(btrim(p.affiliation_code), ''), '') <> v_code
     and coalesce(p.status, '') <> 'deleted'
     and not exists (
       select 1
         from public.institution_code_invitations i
        where i.user_id = p.id
          and i.code = v_code
          and i.status = 'pending'
          and (i.expires_at is null or i.expires_at >= now())
     );

  perform private.assert_institution_intake_allowed(v_code, v_new_seats);

  return public.admin_invite_institution_members(p_user_ids, v_code, p_reason, v_days);
end;
$$;

revoke all on function public.admin_invite_institution_members_guarded(uuid[], text, text, integer) from public;
revoke all on function public.admin_invite_institution_members_guarded(uuid[], text, text, integer) from anon;
grant execute on function public.admin_invite_institution_members_guarded(uuid[], text, text, integer) to authenticated;

comment on function public.admin_invite_institution_members_guarded(uuid[], text, text, integer) is
  'Users > 기관 초대 발송(정원·계약 차단 사전 검사 + 기관별 유효기간 기본값 해석 포함). p_expires_in_days 가 null 이면 institution_code_settings.default_invite_expiry_days, 그것도 없으면 전역 7일로 해석한다 — 기관별 초대 기본값의 서버측 구현 지점이다. 새로 소비할 좌석 수는 원함수의 스킵 규칙(기소속·유효 pending·deleted)을 반영해 계산한다. 원함수 public.admin_invite_institution_members 는 문자열 수술 대상이라 재정의가 금지되므로 확장을 wrapper 로 한다. 2026-08-04.';

-- ---------------------------------------------------------------- 축 ③: 초대 정원 백스톱 트리거
create or replace function private.guard_institution_invitation_seat_limit()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public, private
as $$
declare
  v_max   integer;
  v_usage record;
begin
  -- pending 이 아닌 초대(취소·만료 이관 등)는 좌석을 쓰지 않는다.
  if new.status is distinct from 'pending' then
    return null;
  end if;
  if to_regclass('public.institution_code_settings') is null then
    return null;
  end if;

  select s.max_members
    into v_max
    from public.institution_code_settings s
   where s.institution_code = new.code;

  if v_max is null then
    return null;  -- 정원 무제한.
  end if;

  -- AFTER INSERT 라 방금 들어온 행이 이미 계수에 포함된다.
  select * into v_usage from private.institution_seat_usage(new.code);

  if v_usage.seats_used > v_max then
    raise exception
      'institution % seat limit exceeded: % used > % allowed',
      new.code, v_usage.seats_used, v_max
      using detail = '좌석 사용량 = 소속 회원 + 미만료 대기 초대. 이 초대로 정원을 넘었다.',
            hint = '정원을 늘리거나 대기 초대를 취소한 뒤 다시 시도하여라.';
  end if;

  return null;
end;
$$;

revoke all on function private.guard_institution_invitation_seat_limit() from public;
revoke all on function private.guard_institution_invitation_seat_limit() from anon;
revoke all on function private.guard_institution_invitation_seat_limit() from authenticated;
revoke all on function private.guard_institution_invitation_seat_limit() from service_role;

comment on function private.guard_institution_invitation_seat_limit() is
  '초대 삽입 시 기관 정원을 재계수해 초과를 거부하는 row 트리거(AFTER INSERT). wrapper 사전 검사를 우회하는 현재·미래의 초대 경로를 모두 덮는다(G2·G3 와 같은 철학 — RPC 마다 패치하지 않고 테이블에 건다). 초대 RPC 는 대상 1명당 INSERT 1건이라 row 트리거로 원자적 롤백이 성립한다. 설정 테이블이 없거나 정원이 null 이면 통과. 2026-08-04.';

drop trigger if exists institution_code_invitations_seat_limit_guard
  on public.institution_code_invitations;
create trigger institution_code_invitations_seat_limit_guard
after insert on public.institution_code_invitations
for each row execute function private.guard_institution_invitation_seat_limit();

-- ---------------------------------------------------------------- 사후 단정
do $verify$
declare
  v_def     text;
  v_missing text[] := '{}'::text[];
  v_count   integer;
  v_pos_hide integer;
  v_pos_free integer;
begin
  -- 헬퍼가 만료 판정을 실제로 보는지 + 분기 순서(만료가 무제한 모드 판정보다 앞).
  --
  -- 🚨 위치 비교는 **실행 코드 표현식**으로 한다. pg_get_functiondef 는 본문 주석까지
  -- 포함하므로 `제한 없음` 같은 낱말로 비교하면 그 값을 설명하는 주석에 먼저 걸려
  -- 올바른 코드가 위반으로 판정된다(이 파일 작성 중 실제로 그렇게 오탐이 났다).
  v_def := pg_get_functiondef(to_regprocedure('private.institution_has_writing_assignment(text)'));
  v_pos_hide := position('institution_writing_contract_active(text)' in v_def);
  v_pos_free := position('coalesce(v_mode, ''배정분만'') = ''제한 없음''' in v_def);
  if v_pos_hide = 0 or position('auto_hide_on_expiry' in v_def) = 0 then
    raise exception 'institution_has_writing_assignment_not_contract_aware';
  end if;
  if v_pos_free = 0 or v_pos_hide > v_pos_free then
    raise exception 'intake_guard_expiry_branch_must_precede_unrestricted_branch: hide=% free=%',
      v_pos_hide, v_pos_free;
  end if;

  -- 🚨 수술된 두 RPC 의 가드 호출부가 살아 있는지. 이 파일이 두 함수를 재정의하지
  -- 않았다는 사실을 사후에도 증명한다(재정의하면 이 호출부가 사라진다).
  if position(
    'institution_has_writing_assignment' in
    pg_get_functiondef(to_regprocedure('public.admin_assign_institution_code(uuid[],text,text)'))
  ) = 0 then
    v_missing := v_missing || 'admin_assign_institution_code';
  end if;
  if position(
    'institution_has_writing_assignment' in
    pg_get_functiondef(
      to_regprocedure('public.admin_invite_institution_members(uuid[],text,text,integer)')
    )
  ) = 0 then
    v_missing := v_missing || 'admin_invite_institution_members';
  end if;
  if cardinality(v_missing) > 0 then
    raise exception 'institution_assignment_guard_callsite_lost: %', array_to_string(v_missing, ', ');
  end if;

  -- wrapper 가 원함수를 실제로 위임 호출하는지(복사해서 재구현하면 수술 가드가 빠진다).
  if position(
    'public.admin_assign_institution_code(' in
    pg_get_functiondef(to_regprocedure('public.admin_assign_institution_code_guarded(uuid[],text,text)'))
  ) = 0 then
    raise exception 'assign_wrapper_must_delegate_to_original';
  end if;
  if position(
    'public.admin_invite_institution_members(' in
    pg_get_functiondef(
      to_regprocedure('public.admin_invite_institution_members_guarded(uuid[],text,text,integer)')
    )
  ) = 0 then
    raise exception 'invite_wrapper_must_delegate_to_original';
  end if;

  -- 초대 좌석 백스톱 트리거.
  select count(*)
    into v_count
    from pg_trigger t
   where t.tgrelid = 'public.institution_code_invitations'::regclass
     and not t.tgisinternal
     and t.tgname = 'institution_code_invitations_seat_limit_guard';
  if v_count <> 1 then
    raise exception 'institution_invitation_seat_guard_missing: %', v_count;
  end if;

  -- wrapper 가 anon 에 열려 있지 않은지.
  select count(*)
    into v_count
    from (
      select unnest(array[
        'public.admin_assign_institution_code_guarded(uuid[],text,text)',
        'public.admin_invite_institution_members_guarded(uuid[],text,text,integer)'
      ]) as sig
    ) s
   where has_function_privilege('anon', s.sig, 'EXECUTE');
  if v_count <> 0 then
    raise exception 'intake_wrapper_anon_execute_present: %', v_count;
  end if;
end
$verify$;
