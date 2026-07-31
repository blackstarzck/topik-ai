-- =====================================================================
-- 기관 노출 기본값 — "그 기관에 배정된 문항이 0건이면 제한 없음"
--
-- 20260730120000 이 라이브 규칙(기관 할당제)을 계약으로 확정했다. 남은 결함은
-- 의미론이 아니라 **기본값**이다: 할당제에서 "소속 코드 있음 + 그 기관 배정 0건"
-- 은 0문항이다. 그래서 운영자가 "제한 없음"을 표현할 방법이 없어 available 전량을
-- 기관에 일일이 배정하는 우회가 데이터로 남았고(기관 3곳 × 700행), 신규 기관을
-- 만들어 회원을 배정하면 그 회원들은 빈 화면을 보는 것이 기본값이다.
--
-- 이 마이그는 큐레이션을 기관 단위 **옵트인**으로 바꾼다.
--   - 기관이 배정을 1건 이상 보유 → 종전과 동일(배정된 문항만)
--   - 기관이 배정을 0건 보유     → 제한 없음(available 전량)
-- 무소속 학습자 계약(available 전량)은 그대로다.
--
-- 회귀 범위: 적용 시점 기준으로 배정을 가진 모든 기관이 1건 이상을 보유하므로
-- 기존 학습자의 가시 문항 수는 바뀌지 않는다(dev 실측: 무소속 700/700,
-- CAMPAIGN-01 700, PROFESSOR-KWON 700, convention-vn 18 — 적용 전후 동일).
-- 달라지는 것은 "배정 0건 기관" 이라는 아직 존재하지 않는 경우뿐이다.
--
-- 데이터 무변경: exposure 2,118행은 오너 결정으로 전부 의도된 배정이므로 건드리지
-- 않는다(convention-vn 18행 포함).
--
-- 소유: topik-ai (topik_writing 도메인). v13 무변경. 강제 지점이 하나라
-- 목록·상세·라이브러리·RLS·제출 경로가 모두 자동 추종한다.
-- down: supabase/migrations/down/20260731011500_topik_writing_institution_exposure_default_open.sql
-- =====================================================================

-- 선행 조건: 20260730120000 이 확정한 할당제 본문 위에서만 확장한다.
do $base_guard$
declare
  v_body text;
begin
  if to_regprocedure('private.is_writing_question_visible_to_user(text,smallint,uuid)') is null then
    raise exception 'institution_exposure_predicate_missing';
  end if;

  v_body := regexp_replace(
    pg_get_functiondef(
      to_regprocedure('private.is_writing_question_visible_to_user(text,smallint,uuid)')
    ),
    '\s+',
    ' ',
    'g'
  );

  if v_body not ilike '%if v_affiliation_code is null then return true;%' then
    raise exception 'institution_exposure_base_is_not_assignment_model'
      using detail = 'Expected the 20260730120000 assignment-model body before adding the opt-in default. Re-decide the semantics instead of stacking this migration.';
  end if;
  if v_body not ilike '%e.institution_code = v_affiliation_code%' then
    raise exception 'institution_exposure_base_does_not_read_mapping';
  end if;
end
$base_guard$;

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

  -- 무소속 학습자는 available 전량을 본다(20260730120000 계약 유지).
  if v_affiliation_code is null then
    return true;
  end if;

  -- 배정된 문항은 그 기관 학습자에게 보인다.
  -- (question_id, institution_code) 기본키가 이 조회를 커버한다.
  if exists (
    select 1
      from public.topik_writing_question_institution_exposure e
     where e.question_id = p_question_id
       and e.item_number = p_item_number
       and e.institution_code = v_affiliation_code
  ) then
    return true;
  end if;

  -- 배정이 하나도 없는 기관은 큐레이션에 옵트인하지 않은 것으로 본다 → 제한 없음.
  -- 이 분기가 없으면 신규 기관 회원이 0문항을 본다.
  -- 인덱스 ..._code_idx(institution_code) 가 이 조회를 커버한다.
  -- (주의: 이 주석에 매핑 테이블 전체 이름을 적으면 아래 shape guard 의
  --  참조 개수 단정에 걸린다 — pg_get_functiondef 는 주석까지 포함한다.)
  return not exists (
    select 1
      from public.topik_writing_question_institution_exposure e
     where e.institution_code = v_affiliation_code
  );
end;
$$;

revoke all on function private.is_writing_question_visible_to_user(text, smallint, uuid) from public;
revoke all on function private.is_writing_question_visible_to_user(text, smallint, uuid) from anon;
revoke all on function private.is_writing_question_visible_to_user(text, smallint, uuid) from authenticated;
revoke all on function private.is_writing_question_visible_to_user(text, smallint, uuid) from service_role;

-- 계약 문구를 기록하기 전에 배포된 본문이 정확히 기대한 분기 집합인지 검증한다.
-- 20260730120000 의 guard 는 할당제 분기의 **존재**만 봤기 때문에 본문에 분기를
-- 추가해도 통과했다(포함 단정만으로는 확장을 못 잡는다). 그래서 여기서는
-- 존재 단정에 **배제·완결성 단정**(분기 개수·참조 개수·의외 식별자 부재)을 함께 건다.
do $shape_guard$
declare
  v_body text;
  v_returns integer;
  v_mapping_refs integer;
begin
  v_body := regexp_replace(
    pg_get_functiondef(
      to_regprocedure('private.is_writing_question_visible_to_user(text,smallint,uuid)')
    ),
    '\s+',
    ' ',
    'g'
  );

  -- 존재 단정 3건.
  if v_body not ilike '%if v_affiliation_code is null then return true;%' then
    raise exception 'institution_exposure_shape_missing_unaffiliated_branch';
  end if;
  if v_body not ilike '%and e.institution_code = v_affiliation_code ) then return true;%' then
    raise exception 'institution_exposure_shape_missing_assigned_branch';
  end if;
  if v_body not ilike '%return not exists ( select 1 from public.topik_writing_question_institution_exposure e where e.institution_code = v_affiliation_code );%' then
    raise exception 'institution_exposure_shape_missing_default_open_branch';
  end if;

  -- 완결성: return 은 정확히 5개(널 사용자·프로필 부재·무소속·배정·기본값)여야 한다.
  -- 'returns boolean' 은 'return ' 과 겹치지 않는다('returns ' 의 s 때문).
  v_returns := (length(v_body) - length(replace(v_body, 'return ', ''))) / length('return ');
  if v_returns <> 5 then
    raise exception 'institution_exposure_shape_unexpected_branch_count'
      using detail = format('expected 5 return statements, found %s — an unreviewed branch changes the learner exposure contract.', v_returns);
  end if;

  -- 배제: 매핑 테이블 참조는 정확히 2회(배정 조회 + 기본값 조회)여야 한다.
  v_mapping_refs := (
    length(v_body) - length(replace(v_body, 'topik_writing_question_institution_exposure', ''))
  ) / length('topik_writing_question_institution_exposure');
  if v_mapping_refs <> 2 then
    raise exception 'institution_exposure_shape_unexpected_mapping_refs'
      using detail = format('expected 2 mapping-table references, found %s.', v_mapping_refs);
  end if;

  -- 배제: 이 predicate 는 profiles 를 읽기만 하고 다른 노출 축을 끌어오지 않는다.
  if v_body ~* '(update|insert into|delete from) public\.profiles' then
    raise exception 'institution_exposure_shape_writes_profiles';
  end if;
  if v_body ilike '%service_status%' then
    raise exception 'institution_exposure_shape_duplicates_service_status_axis'
      using detail = 'service_status is the orthogonal layer enforced by the canonical reader, not by this predicate.';
  end if;
end
$shape_guard$;

comment on table public.topik_writing_question_institution_exposure is
  'TOPIK 쓰기 문항 × 기관코드 노출 매핑(기관 할당제 + 기관 단위 옵트인). 매핑 행 = 해당 institution_codes.code 소속 학습자에게 그 문항을 허용하는 목록이며, 다른 학습자에게 잠그는 장치가 아니다(매핑된 문항도 무소속 학습자에게는 계속 보인다). service_status 위에 얹히는 직교 레이어. 부여/해제는 admin_set/clear_writing_question_institutions(문항중심)와 admin_add/remove_institution_writing_questions(기관중심) RPC 단일 경로(content_admin). 학습자 최종 노출 계약: service_status=available AND (user.affiliation_code 없음 OR 해당 기관의 매핑 0건 OR 매핑.institution_code = user.affiliation_code) — 무소속 학습자는 available 전체를 보고, 배정을 1건 이상 가진 기관의 소속 학습자는 자기 코드에 매핑된 문항만 보며(미매핑 문항은 보이지 않는다), 배정이 0건인 기관의 소속 학습자는 제한 없이 available 전체를 본다. 즉 큐레이션은 기관 단위 옵트인이고, 기관을 만들었다는 사실만으로 문항이 가려지지 않는다. 강제 지점은 private.is_writing_question_visible_to_user 단 하나이며, public.get_available_writing_questions(canonical reader)의 WHERE 절이 목록·상세·라이브러리·RLS·제출 경로를 모두 이 predicate 로 통과시킨다. 이력: 종전 문구 "매핑 없음=전체 공개, 매핑 있음=기관 한정"(문항 단위 전용 잠금)은 구현된 적이 없어 2026-07-30(20260730120000)에 할당제로 정정했고, 2026-07-31(20260731011500)에 배정 0건 기관 기본값을 제한 없음으로 확정했다. 문항 단위 전용 잠금은 이 계약으로 표현할 수 없다.';

comment on function private.is_writing_question_visible_to_user(text, smallint, uuid) is
  '기관 할당제 학습자 가시성 predicate — 기관별 쓰기 문항 노출의 유일한 강제 지점. profiles.affiliation_code 가 없는 학습자에게는 available 문항 전체를 허용한다. 기관 소속 학습자에게는 topik_writing_question_institution_exposure 에 자기 institution_code 로 매핑된 문항을 허용하고, 그 기관의 매핑이 0건이면 큐레이션 미설정으로 보아 제한 없이 허용한다(기관 단위 옵트인 — 신규 기관 회원이 0문항을 보는 기본값을 막는다). public.get_available_writing_questions 의 WHERE 절이 이 함수를 호출하므로 문제목록·상세·라이브러리·RLS 정책·제출 guard 가 모두 여기를 통과한다. 이 본문을 바꾸면 학습자 노출 규칙 자체가 바뀐다 — 분기를 추가·제거하면 같은 마이그의 shape guard(return 5개·매핑 참조 2회)가 실패하므로 계약 문구를 함께 갱신해야 한다. 매핑 테이블은 topik-ai 소유(20260625100000). 2026-07-31.';

comment on function public.get_available_writing_questions(smallint, uuid) is
  'Learner-safe canonical list/detail RPC. Caller identity comes only from auth.uid(); answer, rubric, raw import, and internal review fields are excluded. Institution exposure is enforced here through private.is_writing_question_visible_to_user: learners without profiles.affiliation_code get the full available pool, learners in an institution that has at least one mapping get only the questions mapped to their institution_code in topik_writing_question_institution_exposure, and learners in an institution with no mapping at all are unrestricted (institution-level opt-in curation).';
