-- =====================================================================
-- topik-ai admin · Users > 기관 코드 회원 배정/해제 + 코드별 회원 조회
--   생성된 institution_codes 코드에 회원(profiles)을 관리자가 직접 배정/해제하고,
--   코드별 소속 회원 목록을 조회한다. (박람회 QR 자가 claim 경로와 병존하는 admin 수동 경로)
--
-- 쓰기 경계: profiles.affiliation_code 는 v13 소유 컬럼이지만 v13 DDL/트리거는 변경하지 않는다.
--   private.protect_profile_columns 트리거가 is_admin(caller) 의 profiles 쓰기를 통째로 우회시키므로
--   admin RPC 가 affiliation_code 를 갱신할 수 있다(admin_set_admin_app_role / admin_set_user_status 선례 동일).
--   UPDATE 는 RETURNING 으로 self-verify 하여, 향후 트리거 정책이 admin 쓰기를 조용히 막으면
--   거짓 감사 기록 대신 즉시 실패한다.
-- 권한 계층: profiles 를 쓰는 RPC 선례(admin_set_user_status / admin_set_admin_app_role)와 동일하게
--   private.is_platform_admin 전용(reason 필수, admin_audit_logs 기록). 회원 PII(이메일)를 노출하는
--   코드별 회원 조회도 회원 디렉터리(get_admin_users)와 동일한 platform_admin 티어로 맞춘다.
-- 멱등: 이미 같은 코드면 no-op(감사·카운트 제외). 비활성('종료') 코드로는 신규 배정 차단.
-- down: supabase/migrations-admin/down/20260623110000_institution_code_membership.sql
-- =====================================================================

-- ── Write: assign one or more users to an institution code ────────────────────
create or replace function public.admin_assign_institution_code(
  p_user_ids uuid[],
  p_code     text,
  p_reason   text
)
returns integer
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  caller_id   uuid := auth.uid();
  v_reason    text := nullif(btrim(coalesce(p_reason, '')), '');
  v_code      text := btrim(coalesce(p_code, ''));
  v_status    text;
  v_label     text;
  v_uid       uuid;
  v_old       text;
  v_email     text;
  v_display   text;
  v_persisted text;
  v_changed   integer := 0;
begin
  if caller_id is null then raise exception 'unauthenticated'; end if;
  if not private.is_platform_admin(caller_id) then raise exception 'forbidden: platform_admin required'; end if;
  if v_reason is null then raise exception 'reason required'; end if;
  if v_code = '' then raise exception 'code required'; end if;
  if p_user_ids is null or array_length(p_user_ids, 1) is null then
    raise exception 'user ids required';
  end if;

  select label, status into v_label, v_status
    from public.institution_codes where code = v_code;
  if not found then raise exception 'unknown code: %', v_code; end if;
  if v_status <> '활성' then raise exception 'cannot assign to a non-active code: %', v_code; end if;

  for v_uid in select distinct x from unnest(p_user_ids) as t(x) where x is not null loop
    select p.affiliation_code,
           u.email::text,
           coalesce(nullif(p.display_name, ''), nullif(p.nickname::text, ''), u.email::text)
      into v_old, v_email, v_display
      from public.profiles p
      left join auth.users u on u.id = p.id
     where p.id = v_uid
     for update of p;
    if not found then raise exception 'unknown user id: %', v_uid; end if;

    if v_old is distinct from v_code then
      update public.profiles
         set affiliation_code = v_code
       where id = v_uid
      returning affiliation_code into v_persisted;

      if v_persisted is distinct from v_code then
        raise exception
          'affiliation_code write suppressed (persisted=%, expected=%); protect_profile_columns may no longer allow admin affiliation writes',
          v_persisted, v_code using errcode = '42501';
      end if;

      insert into public.admin_audit_logs (admin_user_id, action, target_table, target_id, diff, payload)
      values (
        caller_id,
        'institution_code_assigned',
        'User',
        v_uid::text,
        jsonb_build_object('affiliation_code', jsonb_build_object('from', v_old, 'to', v_code)),
        jsonb_build_object('reason', v_reason, 'code', v_code, 'code_label', v_label,
                           'target_email', v_email, 'target_display', v_display)
      );
      v_changed := v_changed + 1;
    end if;
  end loop;

  return v_changed;
end;
$$;

-- ── Write: clear (unassign) the institution code for one or more users ─────────
create or replace function public.admin_clear_institution_code(
  p_user_ids uuid[],
  p_reason   text
)
returns integer
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  caller_id   uuid := auth.uid();
  v_reason    text := nullif(btrim(coalesce(p_reason, '')), '');
  v_uid       uuid;
  v_old       text;
  v_email     text;
  v_display   text;
  v_persisted text;
  v_changed   integer := 0;
begin
  if caller_id is null then raise exception 'unauthenticated'; end if;
  if not private.is_platform_admin(caller_id) then raise exception 'forbidden: platform_admin required'; end if;
  if v_reason is null then raise exception 'reason required'; end if;
  if p_user_ids is null or array_length(p_user_ids, 1) is null then
    raise exception 'user ids required';
  end if;

  for v_uid in select distinct x from unnest(p_user_ids) as t(x) where x is not null loop
    select p.affiliation_code,
           u.email::text,
           coalesce(nullif(p.display_name, ''), nullif(p.nickname::text, ''), u.email::text)
      into v_old, v_email, v_display
      from public.profiles p
      left join auth.users u on u.id = p.id
     where p.id = v_uid
     for update of p;
    if not found then raise exception 'unknown user id: %', v_uid; end if;

    if v_old is not null and v_old <> '' then
      update public.profiles
         set affiliation_code = null
       where id = v_uid
      returning affiliation_code into v_persisted;

      if v_persisted is not null then
        raise exception
          'affiliation_code clear suppressed (persisted=%); protect_profile_columns may no longer allow admin affiliation writes',
          v_persisted using errcode = '42501';
      end if;

      insert into public.admin_audit_logs (admin_user_id, action, target_table, target_id, diff, payload)
      values (
        caller_id,
        'institution_code_cleared',
        'User',
        v_uid::text,
        jsonb_build_object('affiliation_code', jsonb_build_object('from', v_old, 'to', null)),
        jsonb_build_object('reason', v_reason, 'prev_code', v_old,
                           'target_email', v_email, 'target_display', v_display)
      );
      v_changed := v_changed + 1;
    end if;
  end loop;

  return v_changed;
end;
$$;

-- ── Read: members assigned to a specific institution code ─────────────────────
create or replace function public.admin_list_institution_code_members(
  p_code   text,
  p_search text default null
)
returns table (
  user_id         uuid,
  email           text,
  display_name    text,
  nickname        text,
  status          text,
  app_role        text,
  plan_label      text,
  created_at      timestamptz,
  last_sign_in_at timestamptz
)
language plpgsql
stable
security definer
set search_path = pg_catalog, public
as $$
declare
  caller_id uuid := auth.uid();
  v_code    text := btrim(coalesce(p_code, ''));
  v_search  text := nullif(btrim(coalesce(p_search, '')), '');
begin
  if caller_id is null then raise exception 'unauthenticated'; end if;
  if not private.is_platform_admin(caller_id) then raise exception 'forbidden: platform_admin required'; end if;
  if v_code = '' then raise exception 'code required'; end if;

  return query
    select p.id,
           u.email::text,
           p.display_name,
           p.nickname::text,
           p.status,
           p.app_role,
           p.plan_label,
           p.created_at,
           u.last_sign_in_at
      from public.profiles p
      left join auth.users u on u.id = p.id
     where p.affiliation_code = v_code
       and (
         v_search is null
         or p.display_name ilike '%' || v_search || '%'
         or p.nickname::text ilike '%' || v_search || '%'
         or u.email ilike '%' || v_search || '%'
       )
     order by p.created_at desc;
end;
$$;

revoke all     on function public.admin_assign_institution_code(uuid[], text, text) from public;
grant  execute on function public.admin_assign_institution_code(uuid[], text, text) to authenticated;
revoke all     on function public.admin_clear_institution_code(uuid[], text) from public;
grant  execute on function public.admin_clear_institution_code(uuid[], text) to authenticated;
revoke all     on function public.admin_list_institution_code_members(text, text) from public;
grant  execute on function public.admin_list_institution_code_members(text, text) to authenticated;

comment on function public.admin_assign_institution_code(uuid[], text, text) is
  'Users > 기관 코드 회원 배정. platform_admin 전용, reason 필수. profiles.affiliation_code 를 코드로 설정(활성 코드만, 멱등 no-op skip), protect_profile_columns admin bypass + RETURNING self-verify. 변경 회원 수(integer) 반환, 회원별 admin_audit_logs(action=institution_code_assigned, target=User) 기록.';
comment on function public.admin_clear_institution_code(uuid[], text) is
  'Users > 기관 코드 회원 해제. platform_admin 전용, reason 필수. profiles.affiliation_code 를 NULL 로(멱등 no-op skip), self-verify. 변경 회원 수 반환, admin_audit_logs(action=institution_code_cleared, target=User) 기록.';
comment on function public.admin_list_institution_code_members(text, text) is
  'Users > 기관 코드별 소속 회원 read. platform_admin 전용. profiles.affiliation_code = p_code 회원을 이름/이메일/닉네임 검색과 함께 반환.';
