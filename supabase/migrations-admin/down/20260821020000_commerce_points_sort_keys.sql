-- down: 포인트 정렬키 생성 컬럼 제거
--
-- 생성 컬럼은 값을 보관하지 않고 원본 열에서 파생되므로, 지워도 잃는 데이터가 없다.
-- 앱이 이 컬럼을 읽기 시작한 뒤에 되돌리면 조회가 실패하므로, down 은 **앱을 먼저
-- 되돌린 뒤**에만 적용한다.

begin;

alter table public.commerce_point_expirations
  drop column if exists status_sort_rank;
alter table public.commerce_point_expirations
  drop column if exists source_type_sort_rank;

alter table public.commerce_point_ledgers
  drop column if exists status_sort_rank;
alter table public.commerce_point_ledgers
  drop column if exists source_type_sort_rank;
alter table public.commerce_point_ledgers
  drop column if exists entry_type_sort_rank;

alter table public.commerce_point_policies
  drop column if exists status_sort_rank;
alter table public.commerce_point_policies
  drop column if exists policy_type_sort_rank;

-- 사후 단정: 7개 컬럼이 모두 사라졌다.
do $$
declare
  remaining int;
begin
  select count(*)
    into remaining
    from information_schema.columns
   where table_schema = 'public'
     and table_name in (
       'commerce_point_policies',
       'commerce_point_ledgers',
       'commerce_point_expirations'
     )
     and column_name like '%\_sort\_rank';

  if remaining <> 0 then
    raise exception '정렬키 컬럼이 % 개 남아 있습니다.', remaining;
  end if;
end
$$;

commit;
