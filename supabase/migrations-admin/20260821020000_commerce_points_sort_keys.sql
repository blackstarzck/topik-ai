-- 포인트 화면 서버 페이징을 위한 한국어 라벨 정렬 계약
--
-- 배경: 포인트 3개 탭(정책·원장·소멸 예정)은 지금 전량을 받아 화면에서 필터·정렬·페이징한다.
--   서버 페이징으로 바꾸면 필터·기간·검색·건수는 그대로 옮겨지지만(번역 맵과 CHECK 제약이
--   정확히 일치해 `.eq(코드)` 가 화면의 `=== 라벨` 과 같은 행을 고른다), **정렬만 달라진다** —
--   화면은 한국어 라벨로 정렬하고(`localeCompare('ko-KR')`) DB 열에는 영어 코드가 들어 있다.
--
--   예) 정책 `상태` 오름차순
--     지금(라벨): 운영 중 → 중지 → 초안
--     코드 순서:  active → draft → inactive = 운영 중 → 초안 → 중지
--
--   PostgREST 에는 CASE 정렬이 없으므로 순서를 보존하려면 DB 가 정렬키를 제공해야 한다.
--
-- 이 파일: 사용자 정렬 가능한 열거형 열 **7개**에 대해 한국어 오름차순을 숫자 순위로 고정하는
--   생성 컬럼(generated always as ... stored)을 추가한다. 값이 아니라 **정렬 순서**만 다루므로
--   기존 조회·쓰기 경로에는 영향이 없다(읽지 않으면 존재하지 않는 것과 같다).
--
-- 순위의 근거: 화면 비교자 `localeCompare(v, 'ko-KR', { numeric: true, sensitivity: 'base' })`
--   로 실측한 순서다. 같은 순위 표가 TS 쪽
--   `src/features/commerce/model/point-enum-codec.ts` 에도 있고,
--   `tests/unit/point-enum-codec.test.ts` 가 이 파일을 읽어 두 표가 어긋나지 않게 막는다.
--
-- 정렬 동률: 순위가 같은 행의 상대 순서는 호출부가 `id` 를 후속 정렬로 붙여 고정한다
--   (그러지 않으면 페이지 경계에서 행이 중복·누락된다). 이 파일은 순위만 제공한다.
--
-- 인덱스: 일부러 만들지 않는다. 관리자 화면은 `LIMIT 20` 으로 읽고, 원장은 포인트 이벤트마다
--   INSERT 가 도는 표라 추측 인덱스는 쓰기 비용만 늘린다. 느려지면 실측 후 별도로 추가한다.

begin;

-- ── 정책: policy_type / status ───────────────────────────────────────────────
alter table public.commerce_point_policies
  drop column if exists policy_type_sort_rank;
alter table public.commerce_point_policies
  add column policy_type_sort_rank smallint
  generated always as (
    case policy_type
      when 'expire' then 1  -- 소멸
      when 'earn'   then 2  -- 적립
      when 'debit'  then 3  -- 차감
      else 99
    end
  ) stored;

alter table public.commerce_point_policies
  drop column if exists status_sort_rank;
alter table public.commerce_point_policies
  add column status_sort_rank smallint
  generated always as (
    case status
      when 'active'   then 1  -- 운영 중
      when 'inactive' then 2  -- 중지
      when 'draft'    then 3  -- 초안
      else 99
    end
  ) stored;

-- ── 원장: entry_type / source_type / status ──────────────────────────────────
alter table public.commerce_point_ledgers
  drop column if exists entry_type_sort_rank;
alter table public.commerce_point_ledgers
  add column entry_type_sort_rank smallint
  generated always as (
    case entry_type
      when 'restore' then 1  -- 복구
      when 'expire'  then 2  -- 소멸
      when 'earn'    then 3  -- 적립
      when 'debit'   then 4  -- 차감
      when 'revoke'  then 5  -- 회수
      else 99
    end
  ) stored;

alter table public.commerce_point_ledgers
  drop column if exists source_type_sort_rank;
alter table public.commerce_point_ledgers
  add column source_type_sort_rank smallint
  generated always as (
    case source_type
      when 'payment'  then 1  -- 결제
      when 'admin'    then 2  -- 관리자
      when 'mission'  then 3  -- 미션
      when 'system'   then 4  -- 시스템
      when 'event'    then 5  -- 이벤트
      when 'referral' then 6  -- 추천
      when 'refund'   then 7  -- 환불
      else 99
    end
  ) stored;

alter table public.commerce_point_ledgers
  drop column if exists status_sort_rank;
alter table public.commerce_point_ledgers
  add column status_sort_rank smallint
  generated always as (
    case status
      when 'held'      then 1  -- 보류
      when 'completed' then 2  -- 완료
      when 'cancelled' then 3  -- 취소
      else 99
    end
  ) stored;

-- ── 소멸 예정: source_type / status ──────────────────────────────────────────
alter table public.commerce_point_expirations
  drop column if exists source_type_sort_rank;
alter table public.commerce_point_expirations
  add column source_type_sort_rank smallint
  generated always as (
    case source_type
      when 'payment'  then 1  -- 결제
      when 'admin'    then 2  -- 관리자
      when 'mission'  then 3  -- 미션
      when 'system'   then 4  -- 시스템
      when 'event'    then 5  -- 이벤트
      when 'referral' then 6  -- 추천
      when 'refund'   then 7  -- 환불
      else 99
    end
  ) stored;

alter table public.commerce_point_expirations
  drop column if exists status_sort_rank;
alter table public.commerce_point_expirations
  add column status_sort_rank smallint
  generated always as (
    case status
      when 'held'      then 1  -- 보류
      when 'scheduled' then 2  -- 예정
      when 'completed' then 3  -- 완료
      when 'cancelled' then 4  -- 취소
      else 99
    end
  ) stored;

-- ── 사후 단정: 7개 컬럼이 모두 생성 컬럼으로 존재한다 ────────────────────────
do $$
declare
  expected_columns text[] := array[
    'commerce_point_policies.policy_type_sort_rank',
    'commerce_point_policies.status_sort_rank',
    'commerce_point_ledgers.entry_type_sort_rank',
    'commerce_point_ledgers.source_type_sort_rank',
    'commerce_point_ledgers.status_sort_rank',
    'commerce_point_expirations.source_type_sort_rank',
    'commerce_point_expirations.status_sort_rank'
  ];
  found_count int;
begin
  select count(*)
    into found_count
    from information_schema.columns
   where table_schema = 'public'
     and (table_name || '.' || column_name) = any (expected_columns)
     and is_generated = 'ALWAYS';

  if found_count <> array_length(expected_columns, 1) then
    raise exception '정렬키 생성 컬럼이 % 개만 만들어졌습니다(기대 %).',
      found_count, array_length(expected_columns, 1);
  end if;
end
$$;

-- ── 사후 단정: 순위에 미매핑(99)이 남아 있지 않다 ────────────────────────────
-- CHECK 제약이 닫혀 있으므로 99 는 나올 수 없다. 나오면 제약이 넓어진 것이고,
-- 그 상태로 서버 정렬을 쓰면 화면 순서와 갈린다.
do $$
declare
  stray int;
begin
  select
    (select count(*) from public.commerce_point_policies
      where policy_type_sort_rank = 99 or status_sort_rank = 99)
  + (select count(*) from public.commerce_point_ledgers
      where entry_type_sort_rank = 99 or source_type_sort_rank = 99 or status_sort_rank = 99)
  + (select count(*) from public.commerce_point_expirations
      where source_type_sort_rank = 99 or status_sort_rank = 99)
    into stray;

  if stray <> 0 then
    raise exception '정렬 순위에 미매핑 코드가 % 행 있습니다. CHECK 제약과 순위 표가 어긋났습니다.', stray;
  end if;
end
$$;

commit;
