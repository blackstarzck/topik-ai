-- Down · admin-0021 · get_admin_users 약관 동의 컬럼 롤백
-- consent_status/consent_accepted_at 제거 — admin-0020(20260617210000) 원본으로 복원.
drop function if exists public.get_admin_users(text, text, integer, integer);

create function public.get_admin_users(
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
    case when v_sort = 'name' then lower(coalesce(counted.display_name, counted.email)) end asc nulls last,
    counted.last_sign_in_at desc nulls last,
    counted.created_at desc
  offset (v_page - 1) * v_size
  limit v_size;
end;
$$;

revoke all on function public.get_admin_users(text, text, integer, integer) from public;
grant execute on function public.get_admin_users(text, text, integer, integer) to authenticated;
