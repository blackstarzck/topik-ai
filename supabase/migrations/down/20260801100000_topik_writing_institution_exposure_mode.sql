-- Rollback: 20260801100000_topik_writing_institution_exposure_mode.sql
--
-- 순서 주의 — 이 파일은 코드(predicate·가드)만 원복한다. 계약 comment 3건 원복은
-- 20260730120000 을 재실행해서 처리한다(그 파일은 $contract_guard$ + comment 3건뿐이고
-- 멱등하다. 아래에서 predicate 를 원본으로 되돌린 뒤 실행해야 가드가 통과한다):
--
--   node scripts/db/run-sql.mjs --write --file supabase/migrations/20260730120000_topik_writing_institution_exposure_contract_correction.sql
--
-- **모드 원장 테이블은 남긴다.** predicate 가 더는 읽지 않으므로 학습자 가시성에 무해하고,
-- admin 짝 마이그(20260801100100)의 헬퍼가 아직 참조할 수 있으며, down→up 재적용 시
-- 운영자가 설정한 모드가 보존된다. 테이블까지 지우려면 이 파일 실행 후 수동으로:
--   drop table public.topik_writing_institution_exposure_mode;

-- ---------------------------------------------------------------- G3 제거
drop trigger if exists topik_writing_institution_exposure_mode_switch_guard
  on public.topik_writing_institution_exposure_mode;
drop function if exists private.guard_institution_exposure_mode_switch();

-- ---------------------------------------------------------------- 관리 RPC 2종 제거
drop function if exists public.admin_set_institution_exposure_mode(text, text, text);
drop function if exists public.admin_list_institution_exposure_modes(text[]);

-- ---------------------------------------------------------------- G2 원복 (20260731100100 본문)
create or replace function private.guard_institution_exposure_last_assignment()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public, private
as $$
declare
  v_code text;
  v_members bigint;
  v_pending bigint;
  v_has_invitations boolean :=
    to_regclass('public.institution_code_invitations') is not null;
begin
  -- 기관 코드 원장이 아직 없으면 이 가드가 보호할 상태가 없다.
  if to_regclass('public.institution_codes') is null then
    return null;
  end if;

  -- 이 문장에서 행이 빠진 기관 중, 배정이 0건이 됐고 아직 살아 있는 코드만 후보다.
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
  loop
    select count(*)
      into v_members
      from public.profiles p
     where nullif(btrim(p.affiliation_code), '') = v_code;

    v_pending := 0;
    if v_has_invitations then
      execute
        'select count(*) from public.institution_code_invitations i'
        || ' where i.code = $1 and i.status = ''pending'''
        into v_pending
        using v_code;
    end if;

    if v_members > 0 or v_pending > 0 then
      raise exception
        'cannot remove the last writing assignment of institution %: % member(s) and % pending invitation(s) would see no writing questions',
        v_code, v_members, v_pending
        using detail = 'Institution learners see only questions assigned to their institution_code, so an institution with zero assignments shows an empty writing list.',
              hint = 'Unassign the members (or cancel the invitations) first, or keep at least one question assigned to this institution.';
    end if;
  end loop;

  return null;
end;
$$;

comment on function private.guard_institution_exposure_last_assignment() is
  '회원 또는 대기 중 초대가 있는 기관의 쓰기 문항 배정이 0건으로 떨어지는 것을 막는 statement 트리거. 기관 할당제에서 배정 0건은 그 기관 학습자에게 빈 화면을 뜻한다. 삭제 RPC 3종을 개별 패치하는 대신 테이블에 걸어 현재·미래 경로를 모두 덮는다. 짝 가드는 admin 네임스페이스 20260731100000. 2026-07-31.';

-- ---------------------------------------------------------------- 학습자 인구 헬퍼 제거
-- G2 원복본이 더는 쓰지 않는다. G3 도 제거됐다.
drop function if exists private.institution_learner_population(text);

-- ---------------------------------------------------------------- predicate 원복 (20260713080015 본문)
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
