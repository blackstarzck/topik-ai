-- =====================================================================
-- topik-ai admin · Users directory · admin-0020
-- Users > 회원 목록 mock→Supabase 전환을 막던 P0 결손 RPC 2종 추가.
--   - get_admin_users(search, sort, page, page_size) : 회원 목록 read
--   - admin_set_user_status(target_id, new_status)   : 정지/해제 write(감사)
--
-- 계약 SoT: docs/specs/admin-data-contract.md (§9.1 Users > 회원 목록)
-- 프론트 계약: src/features/users/api/supabase-users-service.ts
--   PostgREST는 RPC 인자를 "이름"으로 매칭하므로 파라미터명은 프론트가 보내는
--   JSON 키(search/sort/page/page_size · target_id/new_status)와 정확히 일치해야 한다.
--   (404 "Could not find the function ... in the schema cache" 의 원인 = 함수 부재)
--
-- 소유권: v13 소유 public.profiles / auth.users / public.writing_submissions 는
--   "느슨한 참조 + 읽기"만 한다(FK 신설 없음). 유일한 write 는 profiles.status 토글.
--   profiles.status 변경은 private.protect_profile_columns 트리거가 admin 을 bypass
--   허용하므로(platform_admin 호출자 auth.uid() 기준) SECURITY DEFINER 경로에서 통과한다.
-- 권한 모델: 읽기/쓰기 모두 platform_admin 전용(private.is_platform_admin).
--   계약상 회원 본체는 platform_admin 표면이며 content_admin 과 분리한다.
-- 감사: admin_set_user_status 는 admin_audit_logs 에 user_status_changed 기록.
-- down: supabase/migrations-admin/down/20260617210000_admin_users_directory.sql
-- =====================================================================

-- ---------------------------------------------------------------------
-- 회원 목록 read RPC
--   반환 컬럼은 supabase-users-service.ts 의 AdminUserRow 와 1:1 대응.
--   member 모집단 = 전체 profiles(역할 무관: learner + 운영진). 화면이 상태/검색을
--   클라이언트에서 다시 거르므로 역할 필터는 두지 않는다(필요 시 후속 필터).
--   submission_count/last_activity 는 writing_submissions 집계(쓰기 제출 기준).
-- ---------------------------------------------------------------------
create or replace function public.get_admin_users(
  search    text    default null,
  sort      text    default 'activity',
  page      integer default 1,
  page_size integer default 100
)
returns table (
  user_id          uuid,
  email            text,
  display_name     text,
  nickname         text,
  app_role         text,
  plan_label       text,
  status           text,
  submission_count bigint,
  last_activity    timestamptz,
  last_sign_in_at  timestamptz,
  created_at       timestamptz,
  total_count      bigint
)
language plpgsql
stable
security definer
set search_path = pg_catalog, public
as $$
#variable_conflict use_column
declare
  caller_id uuid := auth.uid();
  v_search  text := nullif(btrim(coalesce(search, '')), '');
  v_sort    text := lower(coalesce(nullif(btrim(sort), ''), 'activity'));
  v_page    integer := greatest(coalesce(page, 1), 1);
  v_size    integer := least(greatest(coalesce(page_size, 100), 1), 500);
begin
  if caller_id is null then raise exception 'unauthenticated'; end if;
  if not private.is_platform_admin(caller_id) then
    raise exception 'forbidden: platform_admin required';
  end if;

  return query
  with subs as (
    select ws.user_id,
           count(*)             as submission_count,
           max(ws.submitted_at) as last_activity
    from public.writing_submissions ws
    group by ws.user_id
  ),
  base as (
    select
      p.id                                 as user_id,
      u.email::text                        as email,
      p.display_name                       as display_name,
      p.nickname::text                     as nickname,
      p.app_role                           as app_role,
      p.plan_label                         as plan_label,
      p.status                             as status,
      coalesce(s.submission_count, 0)::bigint as submission_count,
      s.last_activity                      as last_activity,
      u.last_sign_in_at                    as last_sign_in_at,
      p.created_at                         as created_at
    from public.profiles p
    left join auth.users u on u.id = p.id
    left join subs s on s.user_id = p.id
    where v_search is null
       or p.display_name ilike '%' || v_search || '%'
       or p.nickname::text ilike '%' || v_search || '%'
       or u.email ilike '%' || v_search || '%'
  ),
  counted as (
    select base.*, count(*) over () as total_count
    from base
  )
  select
    counted.user_id,
    counted.email,
    counted.display_name,
    counted.nickname,
    counted.app_role,
    counted.plan_label,
    counted.status,
    counted.submission_count,
    counted.last_activity,
    counted.last_sign_in_at,
    counted.created_at,
    counted.total_count
  from counted
  order by
    -- 'name' 정렬은 표시명 오름차순, 그 외(activity/latest/default)는 최근 로그인→가입 순.
    case when v_sort = 'name' then lower(coalesce(counted.display_name, counted.email)) end asc nulls last,
    counted.last_sign_in_at desc nulls last,
    counted.created_at desc
  offset (v_page - 1) * v_size
  limit v_size;
end;
$$;

revoke all on function public.get_admin_users(text, text, integer, integer) from public;
grant execute on function public.get_admin_users(text, text, integer, integer) to authenticated;

comment on function public.get_admin_users(text, text, integer, integer) is
  'Users > 회원 목록 read. platform_admin 전용, profiles+auth.users 조인, writing_submissions 집계. 인자명은 PostgREST 매칭을 위해 search/sort/page/page_size 고정.';

-- ---------------------------------------------------------------------
-- 회원 상태 변경 write RPC (정지 blocked / 해제 active 만 허용 — 탈퇴 deleted 차단)
--   프론트는 reason 을 보내지 않으므로 인자는 (target_id, new_status) 만.
-- ---------------------------------------------------------------------
create or replace function public.admin_set_user_status(
  target_id  uuid,
  new_status text
)
returns uuid
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  caller_id  uuid := auth.uid();
  v_old      text;
  v_role     text;
begin
  if caller_id is null then raise exception 'unauthenticated'; end if;
  if not private.is_platform_admin(caller_id) then
    raise exception 'forbidden: platform_admin required';
  end if;
  if target_id is null then raise exception 'target_id required'; end if;
  if new_status not in ('active', 'blocked') then
    raise exception 'invalid status: % (only active|blocked)', new_status;
  end if;

  select p.status, p.app_role into v_old, v_role
    from public.profiles p
   where p.id = target_id
   for update;
  if not found then raise exception 'unknown user id: %', target_id; end if;
  if v_old = 'deleted' then
    raise exception 'cannot change status of a deleted user';
  end if;
  if v_old = new_status then
    raise exception 'user already %', new_status;
  end if;

  update public.profiles
     set status = new_status
   where id = target_id;

  insert into public.admin_audit_logs (admin_user_id, action, target_table, target_id, diff, payload)
  values (
    caller_id,
    'user_status_changed',
    'User',
    target_id::text,
    jsonb_build_object('status', jsonb_build_object('from', v_old, 'to', new_status)),
    jsonb_build_object('app_role', v_role)
  );

  return target_id;
end;
$$;

revoke all on function public.admin_set_user_status(uuid, text) from public;
grant execute on function public.admin_set_user_status(uuid, text) to authenticated;

comment on function public.admin_set_user_status(uuid, text) is
  'Users > 회원 정지/해제. platform_admin 전용, active|blocked 만 허용(deleted 차단), admin_audit_logs(user_status_changed) 기록.';
