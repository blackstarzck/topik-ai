-- =====================================================================
-- 기관 운영 설정 — 정원, 초대 유효기간 기본값, 만료 시 intake 차단, 담당자 메타
--
-- 오너 확정 옵션(2026-08-01) 중 "관리자 RPC 시점에만 필요한" 것들을 모은다. 계약
--   원장과 노출 옵션 2종은 학습자 predicate 가 매 판정마다 읽는 hot path 라서
--   topik_writing 네임스페이스에 뒀지만(20260804100000·20260804100100), 이 설정들은
--   회원 배정·초대 RPC 가 호출 시점에 한 번 읽으면 되므로 admin 네임스페이스가 맞다.
--   같은 폴더에 두면 institution_codes·institution_code_invitations 와 적용 순서가
--   보장되어 폴더 간 fail-open 방어 코드가 필요 없다.
--
-- 항목:
--   · max_members — 정원(좌석 수). null = 무제한.
--   · default_invite_expiry_days — 이 기관 초대의 기본 유효기간. null = 전역 기본 7일.
--   · block_intake_on_expiry — 계약 만료 시 배정·초대를 행정적으로 차단. 노출을 가리는
--     auto_hide_on_expiry 와 **별개 옵션**이다. 비노출까지는 원하지 않으면서 신규 유입만
--     막고 싶은 기관을 위한 칸이다.
--   · contact_name / contact_email — 운영 담당자. **감사 payload 에 값을 기록하지 않는다**
--     (개인정보). 변경 사실은 필드명만 남긴다 — 사용자 리포트 인수 때 정한 것과 같은 규칙.
--
-- 정원 계수는 private.institution_seat_usage 가 단일 정의 지점이다. 기존
--   private.institution_learner_population(20260801100000)을 쓰지 않는 이유: 그 함수는
--   status='pending' 만 보고 **만료 경과 여부를 따지지 않아** 죽은 초대를 좌석으로
--   과대 계상한다. dev 실측(2026-08-04) — pending 3건이 전부 만료 경과 상태였다. 빈 화면
--   가드 용도로는 과대 계상이 안전한 방향이지만(막는 쪽), 정원 용도로는 정반대로 위험하다
--   (실제로 자리가 있는데 초대를 거부한다). 두 목적에 같은 함수를 쓰면 안 된다.
--
-- 짝 마이그: 20260804100300(삭제 정리), 20260804100400(intake 가드 — 이 설정을 읽는다)
-- 경계: profiles 를 읽기만 하고 쓰지 않는다.
-- down: supabase/migrations-admin/down/20260804100200_institution_code_settings.sql
-- =====================================================================

-- ---------------------------------------------------------------- 설정 테이블
create table if not exists public.institution_code_settings (
  institution_code           text primary key,  -- institution_codes.code 소프트 참조
  max_members                integer,
  default_invite_expiry_days integer,
  block_intake_on_expiry     boolean not null default false,
  contact_name               text,
  contact_email              text,
  updated_by                 uuid,
  created_at                 timestamptz not null default now(),
  updated_at                 timestamptz not null default now(),
  constraint institution_code_settings_max_members_check
    check (max_members is null or max_members > 0),
  constraint institution_code_settings_invite_expiry_check
    check (default_invite_expiry_days is null
           or (default_invite_expiry_days >= 1 and default_invite_expiry_days <= 365))
);

-- RLS 는 모드·계약 원장과 동형: enable 만(force 금지), 읽기는 admin, 쓰기 정책 0개
-- → security definer RPC 단일 경로.
alter table public.institution_code_settings enable row level security;

drop policy if exists institution_code_settings_admin_select
  on public.institution_code_settings;
create policy institution_code_settings_admin_select
  on public.institution_code_settings
  for select to authenticated using (private.is_admin((select auth.uid())));

comment on table public.institution_code_settings is
  '기관 코드별 운영 설정. 행이 없는 기관은 전 항목 기본값(정원 무제한, 초대 유효기간 전역 7일, 만료 시 intake 차단 off)으로 해석한다 — 폴백은 항상 현행 동작이다. 정원 판정은 private.institution_seat_usage 단일 정의를 쓴다. 담당자 이름·이메일은 운영 메타이며 감사 payload 에 값을 기록하지 않는다(개인정보). 쓰기는 admin_update_institution_settings RPC 단일 경로. institution_codes.code 소프트 참조. 2026-08-04.';

comment on column public.institution_code_settings.max_members is
  '정원(좌석 수). null = 무제한. 좌석 사용량은 소속 회원 + 미만료 대기 초대이며(private.institution_seat_usage) 초대는 수락 전에도 자리를 선점한다 — 그래서 수락 시점에 정원을 초과할 수 없다.';

comment on column public.institution_code_settings.default_invite_expiry_days is
  '이 기관 초대의 기본 유효기간(일). null = 전역 기본 7일. admin_invite_institution_members_guarded 가 p_expires_in_days 를 받지 않았을 때 이 값으로 해석한다(20260804100400).';

comment on column public.institution_code_settings.block_intake_on_expiry is
  '계약 만료 시 회원 배정·초대를 차단할지(기본 false). 노출을 가리는 auto_hide_on_expiry 와 별개 옵션이다 — 비노출 없이 신규 유입만 막고 싶은 기관을 위한 것이다.';

-- ---------------------------------------------------------------- 좌석 사용량 (단일 정의 지점)
create or replace function private.institution_seat_usage(
  p_code text,
  out member_count bigint,
  out pending_invitation_count bigint,
  out seats_used bigint
)
language plpgsql
stable
security definer
set search_path = pg_catalog, public, private
as $$
declare
  v_code text := nullif(btrim(coalesce(p_code, '')), '');
begin
  member_count := 0;
  pending_invitation_count := 0;
  seats_used := 0;
  if v_code is null then
    return;
  end if;

  select count(*)
    into member_count
    from public.profiles p
   where nullif(btrim(p.affiliation_code), '') = v_code;

  -- **미만료** pending 만 센다. institution_learner_population 과 다른 지점이며 이
  -- 차이가 이 함수의 존재 이유다(헤더 참조). 만료 판정은 초대 기능의 lazy 규약과
  -- 같다 — expires_at 이 null 이면 만료 없음으로 본다(20260708120000 백필 이후 기존
  -- pending 은 모두 값이 있다).
  select count(*)
    into pending_invitation_count
    from public.institution_code_invitations i
   where i.code = v_code
     and i.status = 'pending'
     and (i.expires_at is null or i.expires_at >= now());

  seats_used := member_count + pending_invitation_count;
end;
$$;

revoke all on function private.institution_seat_usage(text) from public;
revoke all on function private.institution_seat_usage(text) from anon;
revoke all on function private.institution_seat_usage(text) from authenticated;
revoke all on function private.institution_seat_usage(text) from service_role;

comment on function private.institution_seat_usage(text) is
  '기관 정원 계산용 좌석 사용량 — 소속 회원 수 + **미만료** 대기 초대 수. private.institution_learner_population 과 달리 만료 경과한 pending 을 제외한다: 빈 화면 가드에서는 과대 계상이 안전한 방향(막는 쪽)이지만 정원에서는 정반대로 위험하다(자리가 있는데 거부). dev 실측 2026-08-04 기준 pending 3건이 전부 만료 경과였다. 대기 초대가 자리를 선점하므로 수락 시점에 정원 초과가 발생하지 않는다. 2026-08-04.';

-- ---------------------------------------------------------------- 설정 조회 RPC
create or replace function public.admin_list_institution_settings(
  p_codes text[] default null
)
returns table (
  code                       text,
  max_members                integer,
  default_invite_expiry_days integer,
  block_intake_on_expiry     boolean,
  contact_name               text,
  contact_email              text,
  member_count               bigint,
  pending_invitation_count   bigint,
  seats_used                 bigint,
  updated_at                 timestamptz
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

  -- 기관 코드 원장 기준 좌결합(모드·계약 요약 RPC 선례). 설정 행이 없는 코드도
  -- 기본값 + 실제 좌석 사용량으로 반환해야 화면이 모든 기관에 정원 게이지를 그릴 수 있다.
  return query
  select c.code,
         s.max_members,
         s.default_invite_expiry_days,
         coalesce(s.block_intake_on_expiry, false),
         s.contact_name,
         s.contact_email,
         usage.member_count,
         usage.pending_invitation_count,
         usage.seats_used,
         s.updated_at
    from public.institution_codes c
    left join public.institution_code_settings s
      on s.institution_code = c.code
    left join lateral private.institution_seat_usage(c.code) usage on true
   where p_codes is null or c.code = any(p_codes)
   order by c.code;
end;
$$;

revoke all on function public.admin_list_institution_settings(text[]) from public;
revoke all on function public.admin_list_institution_settings(text[]) from anon;
grant execute on function public.admin_list_institution_settings(text[]) to authenticated;

comment on function public.admin_list_institution_settings(text[]) is
  '기관 운영 설정 + 좌석 사용량 read. institution_codes 기준 좌결합이라 설정 행이 없는 코드도 기본값(정원 무제한·초대 기본 null=전역 7일·차단 off)으로 반환한다. seats_used = 소속 회원 + 미만료 대기 초대(private.institution_seat_usage). 담당자 값은 관리자 화면 표시용으로 반환하되 감사에는 기록하지 않는다. 2026-08-04.';

-- ---------------------------------------------------------------- 설정 쓰기 RPC
create or replace function public.admin_update_institution_settings(
  p_code                       text,
  p_max_members                integer,
  p_default_invite_expiry_days integer,
  p_block_intake_on_expiry     boolean,
  p_contact_name               text,
  p_contact_email              text,
  p_reason                     text
)
returns text
language plpgsql
security definer
set search_path = pg_catalog, public, private
as $$
declare
  caller_id  uuid := auth.uid();
  v_code     text := btrim(coalesce(p_code, ''));
  v_reason   text := nullif(btrim(coalesce(p_reason, '')), '');
  v_name     text := nullif(btrim(coalesce(p_contact_name, '')), '');
  v_email    text := nullif(btrim(coalesce(p_contact_email, '')), '');
  v_block    boolean := coalesce(p_block_intake_on_expiry, false);
  v_old      public.institution_code_settings%rowtype;
  v_changed  text[] := '{}'::text[];
  v_usage    record;
begin
  if caller_id is null then raise exception 'unauthenticated'; end if;
  if not private.is_admin(caller_id) then raise exception 'forbidden: admin required'; end if;
  if not public.admin_has_permission(caller_id, 'users.institution-codes.manage') then
    raise exception 'forbidden: missing permission users.institution-codes.manage';
  end if;
  if v_code = '' then raise exception 'code required'; end if;
  if v_reason is null then raise exception 'reason required'; end if;
  if p_max_members is not null and p_max_members < 1 then
    raise exception 'max_members must be positive: %', p_max_members;
  end if;
  if p_default_invite_expiry_days is not null
     and (p_default_invite_expiry_days < 1 or p_default_invite_expiry_days > 365) then
    raise exception 'default_invite_expiry_days must be between 1 and 365: %',
      p_default_invite_expiry_days;
  end if;

  perform 1
    from public.institution_codes c
   where c.code = v_code
   for update;
  if not found then
    raise exception 'unknown code: %', v_code;
  end if;

  select * into v_old
    from public.institution_code_settings
   where institution_code = v_code
   for update;

  -- 정원을 현재 좌석 사용량보다 낮게 잡는 것은 막는다. 이미 들어와 있는 회원을
  -- 내보낼 방법이 이 RPC 에는 없으므로, 통과시키면 "정원 초과 상태" 라는 표현 불가능한
  -- 상태가 원장에 남는다.
  if p_max_members is not null then
    select * into v_usage from private.institution_seat_usage(v_code);
    if p_max_members < v_usage.seats_used then
      raise exception
        'max_members % is lower than current seat usage % for %',
        p_max_members, v_usage.seats_used, v_code
        using detail = '좌석 사용량 = 소속 회원 + 미만료 대기 초대. 정원을 줄이려면 먼저 회원 소속을 해제하거나 대기 초대를 취소하여라.',
              hint = '현재 사용량 이상으로 정원을 설정하여라.';
    end if;
  end if;

  insert into public.institution_code_settings (
    institution_code, max_members, default_invite_expiry_days,
    block_intake_on_expiry, contact_name, contact_email, updated_by, updated_at
  ) values (
    v_code, p_max_members, p_default_invite_expiry_days,
    v_block, v_name, v_email, caller_id, now()
  )
  on conflict (institution_code) do update set
    max_members = excluded.max_members,
    default_invite_expiry_days = excluded.default_invite_expiry_days,
    block_intake_on_expiry = excluded.block_intake_on_expiry,
    contact_name = excluded.contact_name,
    contact_email = excluded.contact_email,
    updated_by = excluded.updated_by,
    updated_at = now();

  -- 변경된 **필드명만** 모은다. 담당자 항목은 값이 개인정보라 이름만 남기고,
  -- 나머지 항목은 운영 판단에 필요하므로 diff 에 전후 값을 남긴다.
  if v_old.institution_code is null then
    v_changed := v_changed || 'created'::text;
  else
    if v_old.max_members is distinct from p_max_members then
      v_changed := v_changed || 'max_members'::text;
    end if;
    if v_old.default_invite_expiry_days is distinct from p_default_invite_expiry_days then
      v_changed := v_changed || 'default_invite_expiry_days'::text;
    end if;
    if v_old.block_intake_on_expiry is distinct from v_block then
      v_changed := v_changed || 'block_intake_on_expiry'::text;
    end if;
    if v_old.contact_name is distinct from v_name then
      v_changed := v_changed || 'contact_name'::text;
    end if;
    if v_old.contact_email is distinct from v_email then
      v_changed := v_changed || 'contact_email'::text;
    end if;
  end if;

  if cardinality(v_changed) = 0 then
    return v_code;  -- 변경 없음 — 감사 행을 남기지 않는다(화면이 항상 호출해도 안전).
  end if;

  insert into public.admin_audit_logs (
    admin_user_id, action, target_table, target_id, diff, payload
  ) values (
    caller_id,
    'institution_settings_changed',
    'InstitutionCode',
    v_code,
    jsonb_build_object(
      'max_members', jsonb_build_object('from', v_old.max_members, 'to', p_max_members),
      'default_invite_expiry_days', jsonb_build_object(
        'from', v_old.default_invite_expiry_days, 'to', p_default_invite_expiry_days),
      'block_intake_on_expiry', jsonb_build_object(
        'from', v_old.block_intake_on_expiry, 'to', v_block)
    ),
    jsonb_build_object(
      'reason', v_reason,
      'code', v_code,
      'changed_fields', to_jsonb(v_changed),
      'contact_value_logged', false
    )
  );

  return v_code;
end;
$$;

revoke all on function public.admin_update_institution_settings(
  text, integer, integer, boolean, text, text, text
) from public;
revoke all on function public.admin_update_institution_settings(
  text, integer, integer, boolean, text, text, text
) from anon;
grant execute on function public.admin_update_institution_settings(
  text, integer, integer, boolean, text, text, text
) to authenticated;

comment on function public.admin_update_institution_settings(text, integer, integer, boolean, text, text, text) is
  '기관 운영 설정을 전량값으로 upsert 한다(사유 필수, 권한 users.institution-codes.manage). 정원을 현재 좌석 사용량보다 낮게 설정하는 것은 거부한다(표현 불가능한 초과 상태 방지). 실제 변경이 없으면 감사 행 없이 조기 반환한다. 감사 action = institution_settings_changed 이며 **담당자 이름·이메일 값은 payload·diff 에 기록하지 않고 변경된 필드명만 남긴다**(개인정보) — payload.contact_value_logged=false 로 그 계약을 명시한다. 2026-08-04.';

-- ---------------------------------------------------------------- 사후 단정
do $verify$
declare
  v_def   text;
  v_count integer;
begin
  if to_regclass('public.institution_code_settings') is null then
    raise exception 'institution_code_settings_table_missing';
  end if;

  select count(*)
    into v_count
    from pg_constraint c
   where c.conrelid = 'public.institution_code_settings'::regclass
     and c.contype = 'c'
     and c.conname in (
       'institution_code_settings_max_members_check',
       'institution_code_settings_invite_expiry_check'
     );
  if v_count <> 2 then
    raise exception 'institution_code_settings_check_constraints_missing: %', v_count;
  end if;

  -- 좌석 계수가 만료를 걸러내는지. 이 단정이 없으면 institution_learner_population 를
  -- 그대로 복사한 회귀를 잡을 수 없다.
  v_def := pg_get_functiondef(to_regprocedure('private.institution_seat_usage(text)'));
  if position('expires_at' in v_def) = 0 then
    raise exception 'institution_seat_usage_must_filter_expired_invitations';
  end if;

  -- 감사에 담당자 값이 실리지 않는지. 필드명 리터럴은 있어도 값 컬럼 참조는 없어야 한다.
  v_def := pg_get_functiondef(
    to_regprocedure('public.admin_update_institution_settings(text,integer,integer,boolean,text,text,text)')
  );
  if position('''contact_name'', v_name' in v_def) > 0
     or position('''contact_email'', v_email' in v_def) > 0 then
    raise exception 'institution_settings_audit_must_not_log_contact_values';
  end if;

  select count(*)
    into v_count
    from (
      select unnest(array[
        'public.admin_list_institution_settings(text[])',
        'public.admin_update_institution_settings(text,integer,integer,boolean,text,text,text)'
      ]) as sig
    ) s
   where has_function_privilege('anon', s.sig, 'EXECUTE');
  if v_count <> 0 then
    raise exception 'institution_settings_rpc_anon_execute_present: %', v_count;
  end if;
end
$verify$;
