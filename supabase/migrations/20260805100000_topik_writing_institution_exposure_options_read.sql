-- =====================================================================
-- 기관 노출 옵션 2종의 **읽기** 경로를 만든다.
--
-- 결함: 20260804100000·20260804100100 이 `auto_hide_on_expiry` 와
--   `auto_assign_new_questions` 를 도입하고 각각 쓰기 RPC 를 달았지만, 값을 되읽는 RPC 는
--   `auto_hide_on_expiry` 만 있다(admin_list_institution_contract_status). 즉
--   **`auto_assign_new_questions` 는 write-only 였다** — 관리 화면의 Switch 가 자기 현재
--   상태를 그릴 수 없다. PR-C 에서 UI 를 붙이다가 드러났다.
--
-- 왜 기존 RPC 를 확장하지 않는가: `returns table` 의 컬럼을 추가하려면 drop + create 가
--   필요하고 check-expand-migrations 가 forward 마이그의 `drop function` 을 차단한다
--   (20260801100000 헤더가 같은 이유로 모드 조회를 별도 RPC 로 분리했다). 따라서 신규
--   읽기 RPC 를 추가한다.
--
-- auto_hide 를 여기서도 돌려주는 이유: 두 토글이 한 화면에 나란히 있으므로 상태를 한 번의
--   조회로 받는 편이 화면 코드가 단순하다. 두 RPC 가 같은 컬럼을 읽으므로 값이 갈라질
--   여지는 없다(계산이 아니라 컬럼 그대로다).
--
-- down: supabase/migrations/down/20260805100000_topik_writing_institution_exposure_options_read.sql
-- =====================================================================

create or replace function public.admin_list_institution_exposure_options(
  p_codes text[] default null
)
returns table (
  code                      text,
  auto_hide_on_expiry       boolean,
  auto_assign_new_questions boolean,
  updated_at                timestamptz
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

  -- 기관 코드 원장 기준 좌결합(모드·계약·설정 조회 RPC 와 같은 관례). 원장에 행이 없는
  -- 코드도 기본값 false 로 반환해야 화면이 모든 기관에 토글을 그릴 수 있다.
  return query
  select c.code,
         coalesce(m.auto_hide_on_expiry, false),
         coalesce(m.auto_assign_new_questions, false),
         m.updated_at
    from public.institution_codes c
    left join public.topik_writing_institution_exposure_mode m
      on m.institution_code = c.code
   where p_codes is null or c.code = any(p_codes)
   order by c.code;
end;
$$;

revoke all on function public.admin_list_institution_exposure_options(text[]) from public;
revoke all on function public.admin_list_institution_exposure_options(text[]) from anon;
grant execute on function public.admin_list_institution_exposure_options(text[]) to authenticated;

comment on function public.admin_list_institution_exposure_options(text[]) is
  '기관별 노출 연동 옵션 2종(만료 시 자동 비노출 · 신규 문항 자동 배정) read. institution_codes 기준 좌결합이라 모드 원장에 행이 없는 코드도 false 기본값으로 반환한다. auto_assign_new_questions 를 되읽는 유일한 경로다 — 20260804100100 이 쓰기 RPC 만 만들어 write-only 였던 것을 보완한다(2026-08-05). auto_hide 는 admin_list_institution_contract_status 와 같은 컬럼을 읽으므로 값이 갈라지지 않는다.';

-- ---------------------------------------------------------------- 사후 단정
do $verify$
declare
  v_result text;
begin
  if to_regprocedure('public.admin_list_institution_exposure_options(text[])') is null then
    raise exception 'exposure_options_read_rpc_missing';
  end if;

  -- 두 옵션이 실제로 반환 목록에 있는지. 하나만 있으면 write-only 결함이 남는다.
  select pg_get_function_result(
           to_regprocedure('public.admin_list_institution_exposure_options(text[])')
         )
    into v_result;
  if position('auto_assign_new_questions' in v_result) = 0
     or position('auto_hide_on_expiry' in v_result) = 0 then
    raise exception 'exposure_options_read_rpc_incomplete: %', v_result;
  end if;

  if has_function_privilege(
       'anon', 'public.admin_list_institution_exposure_options(text[])', 'EXECUTE'
     ) then
    raise exception 'exposure_options_read_rpc_anon_execute_present';
  end if;
end
$verify$;
