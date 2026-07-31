-- =====================================================================
-- 마지막 배정 삭제 가드 — 회원/대기 초대가 있는 기관의 배정을 0건으로 만들지 못하게 막는다.
--
-- 짝 마이그: supabase/migrations-admin/20260731100000_institution_assignment_prerequisite_guard.sql
--   그쪽은 "배정 0건 기관에 회원을 넣는 것"을 막고, 이쪽은 "회원이 있는 기관의 배정을 0건으로
--   되돌리는 것"을 막는다. 둘이 함께 있어야 빈 화면 상태가 도달 불가해진다.
--
-- 왜 트리거인가: 배정을 지우는 RPC 는 셋이다(admin_set_writing_question_institutions 의
--   set-semantics, admin_clear_writing_question_institutions, admin_remove_institution_writing_questions).
--   셋을 개별로 패치하면 나중에 넷째 경로가 생길 때 조용히 새어나간다. 테이블에 한 번 걸면
--   현재·미래의 모든 삭제 경로가 통과한다.
--
-- 대기 중 초대까지 세는 이유: 초대는 아직 소속이 아니다. "배정 있음 → 초대 발송 → 배정 삭제
--   → 학습자 수락" 순서면 소속 회원 수가 0인 채로 배정이 사라져 수락 직후 빈 화면이 된다.
--   pending 초대를 포함해 세면 그 창이 닫힌다.
--
-- admin_delete_institution_code 는 막히지 않는다(실측): 그 함수는 ①회원 0건 확인 →
--   ②pending 초대 취소 → ③배정 삭제 → ④코드 삭제 순으로 진행하므로, ③ 시점에 회원 0·초대 0 이다.
--
-- institution_codes / institution_code_invitations 는 다른 마이그 폴더(admin, 별도 tracker·러너)
--   소유라 클린 부트스트랩에서 적용 순서가 보장되지 않는다. 없으면 보호할 대상도 없으므로
--   조용히 통과시킨다(fail-open) — 20260625100000 이 하드 FK 를 피한 것과 같은 이유.
-- down: supabase/migrations/down/20260731100100_institution_exposure_last_assignment_guard.sql
-- =====================================================================

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

revoke all on function private.guard_institution_exposure_last_assignment() from public;
revoke all on function private.guard_institution_exposure_last_assignment() from anon;
revoke all on function private.guard_institution_exposure_last_assignment() from authenticated;
revoke all on function private.guard_institution_exposure_last_assignment() from service_role;

comment on function private.guard_institution_exposure_last_assignment() is
  '회원 또는 대기 중 초대가 있는 기관의 쓰기 문항 배정이 0건으로 떨어지는 것을 막는 statement 트리거. 기관 할당제에서 배정 0건은 그 기관 학습자에게 빈 화면을 뜻한다. 삭제 RPC 3종을 개별 패치하는 대신 테이블에 걸어 현재·미래 경로를 모두 덮는다. 짝 가드는 admin 네임스페이스 20260731100000. 2026-07-31.';

-- DELETE 와 UPDATE 를 모두 덮는다. PK 가 (question_id, institution_code) 라서 코드 이동
-- UPDATE 로도 원본 코드가 0건이 될 수 있다. 두 트리거가 같은 transition table 이름을 쓴다.
drop trigger if exists topik_writing_exposure_last_assignment_guard_delete
  on public.topik_writing_question_institution_exposure;
create trigger topik_writing_exposure_last_assignment_guard_delete
after delete on public.topik_writing_question_institution_exposure
referencing old table as removed_rows
for each statement execute function private.guard_institution_exposure_last_assignment();

drop trigger if exists topik_writing_exposure_last_assignment_guard_update
  on public.topik_writing_question_institution_exposure;
create trigger topik_writing_exposure_last_assignment_guard_update
after update on public.topik_writing_question_institution_exposure
referencing old table as removed_rows
for each statement execute function private.guard_institution_exposure_last_assignment();

-- 트리거가 실제로 붙었는지 사후 단정.
do $verify$
declare
  v_count integer;
begin
  select count(*)
    into v_count
    from pg_trigger t
   where t.tgrelid = 'public.topik_writing_question_institution_exposure'::regclass
     and not t.tgisinternal
     and t.tgname in (
       'topik_writing_exposure_last_assignment_guard_delete',
       'topik_writing_exposure_last_assignment_guard_update'
     );
  if v_count <> 2 then
    raise exception 'exposure_last_assignment_guard_triggers_missing: %', v_count;
  end if;
end
$verify$;
