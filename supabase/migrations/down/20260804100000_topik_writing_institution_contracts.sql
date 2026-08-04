-- Rollback: 20260804100000_topik_writing_institution_contracts.sql
--
-- 선행 조건 — 짝 마이그 20260804100100(신규 문항 자동 배정)이 적용돼 있으면 그 down 을
-- **먼저** 실행하여라. 그쪽이 모드 원장에 auto_assign_new_questions 컬럼과 문항 4테이블
-- 트리거를 추가하므로, 이 파일이 먼저 돌면 그 트리거 함수가 참조하는 계약 판정 함수가
-- 사라져 다음 노출 전환에서 실패한다.
--
-- **계약 원장 테이블은 남긴다.** predicate 가 더는 읽지 않으므로 학습자 가시성에 무해하고
-- (auto_hide 컬럼이 사라지면 만료 분기 자체가 없다), 운영자가 입력한 계약 히스토리가
-- 보존되며 down→up 재적용 시 그대로 살아난다. 모드 원장 테이블을 남긴
-- 20260801100000 의 down 과 같은 판단이다. 테이블까지 지우려면 이 파일 실행 후 수동으로:
--   drop table public.topik_writing_institution_contracts;
--
-- btree_gist 확장도 남긴다(다른 객체가 쓸 수 있고, 확장 제거는 이 마이그의 관심사가 아니다).

-- ---------------------------------------------------------------- 신규 RPC 6종 제거
drop function if exists public.admin_set_institution_auto_hide_on_expiry(text, boolean, text);
drop function if exists public.admin_delete_institution_contract(uuid, text);
drop function if exists public.admin_update_institution_contract(uuid, date, date, text, text, text);
drop function if exists public.admin_create_institution_contract(text, date, date, text, text, text);
drop function if exists public.admin_list_institution_contract_status(text[]);
drop function if exists public.admin_list_institution_contracts(text[]);

-- ---------------------------------------------------------------- predicate 원복 (20260801100000 본문)
-- 만료 분기와 auto_hide 참조를 제거한다. 컬럼 drop 보다 **먼저** 해야 한다.
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

comment on function private.is_writing_question_visible_to_user(text, smallint, uuid) is
  '기관 할당제 학습자 가시성 predicate — 기관별 쓰기 문항 노출의 유일한 강제 지점. 세 분기다: ①profiles.affiliation_code 가 없는 학습자에게는 available 문항 전체를 허용한다. ②소속 기관의 노출 모드가 `제한 없음` 이면(topik_writing_institution_exposure_mode) 역시 전체를 허용한다 — 배정 매핑은 보존되지만 게이팅에 참여하지 않는다. ③그 외(`배정분만`, 원장에 행이 없는 경우 포함)에는 topik_writing_question_institution_exposure 에 자기 institution_code 로 매핑된 문항만 허용한다. 폴백은 항상 `배정분만`(=현행 동작)이다. public.get_available_writing_questions 의 WHERE 절이 이 함수를 호출하므로 문제목록·상세·라이브러리·RLS 정책·제출 guard 가 모두 여기를 통과한다. 이 본문을 바꾸면 학습자 노출 규칙 자체가 바뀐다. 2026-08-01.';

-- ---------------------------------------------------------------- G3 원복 (20260801100000 본문)
-- INSERT 를 전환으로 오인하는 원래 동작으로 되돌린다. 그 상태에서 auto_hide 토글 RPC 는
-- 이미 제거됐으므로 해당 경로는 다시 도달 불가가 된다.
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

comment on function private.guard_institution_exposure_mode_switch() is
  '`제한 없음` → `배정분만` 전환이 배정 0건 + 회원/대기초대 있는 기관을 빈 화면으로 만드는 것을 막는 트리거. 2026-08-01.';

-- ---------------------------------------------------------------- 옵션 컬럼 제거
alter table public.topik_writing_institution_exposure_mode
  drop column if exists auto_hide_on_expiry;

-- ---------------------------------------------------------------- 계약 판정 헬퍼 제거
drop function if exists private.institution_writing_contract_active(text);

-- ---------------------------------------------------------------- 모드 원장 comment 원복
comment on table public.topik_writing_institution_exposure_mode is
  '기관 코드별 쓰기 문항 노출 모드. `제한 없음` = 그 기관 소속 학습자도 service_status=available 문항 전체를 보고 이후 승격되는 신규 문항이 자동 포함된다(배정 목록은 보존되며 게이팅에 참여하지 않는다). `배정분만` = topik_writing_question_institution_exposure 에 배정된 문항만 본다. 행이 없는 기관은 `배정분만` 으로 해석한다 — 폴백은 항상 현행 동작이다. 부여/변경은 admin_set_institution_exposure_mode RPC 단일 경로. institution_codes.code 소프트 참조(하드 FK 없음: 별개 마이그 네임스페이스라 적용 순서가 보장되지 않는다).';
