-- down: restore the summary admin_list_instructors (pre-full-detail, from 20260619100000).
drop function if exists public.admin_list_instructors(text, text, text, text, text);

create or replace function public.admin_list_instructors(
  p_search          text default null,
  p_status          text default null,
  p_activity_status text default null,
  p_organization    text default null,
  p_country         text default null
)
returns table (
  id text, real_name text, email text, nickname text, organization text, country text,
  status text, activity_status text, assignment_status text,
  course_count int, student_count int, last_activity_at text, last_action_at text,
  message_group_id text, message_group_name text
)
language plpgsql stable security definer set search_path = pg_catalog, public
as $$
declare
  caller_id uuid := auth.uid();
  v_search text := lower(nullif(btrim(coalesce(p_search, '')), ''));
begin
  if caller_id is null then raise exception 'unauthenticated'; end if;
  if not private.is_admin(caller_id) then raise exception 'forbidden: admin required'; end if;
  return query
    select i.id, i.real_name, i.email, i.nickname, i.organization, i.country,
           i.status, i.activity_status, i.assignment_status,
           i.course_count, i.student_count, i.last_activity_at, i.last_action_at,
           i.message_group_id, i.message_group_name
      from public.instructors i
     where (p_status is null or i.status = p_status)
       and (p_activity_status is null or i.activity_status = p_activity_status)
       and (p_organization is null or i.organization = p_organization)
       and (p_country is null or i.country = p_country)
       and (
         v_search is null
         or i.id ilike '%' || v_search || '%'
         or lower(i.real_name) ilike '%' || v_search || '%'
         or lower(i.email) ilike '%' || v_search || '%'
       )
     order by i.id;
end;
$$;

revoke all on function public.admin_list_instructors(text, text, text, text, text) from public;
grant execute on function public.admin_list_instructors(text, text, text, text, text) to authenticated;
