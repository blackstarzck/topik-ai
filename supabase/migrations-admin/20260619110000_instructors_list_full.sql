-- Users > 강사 관리: admin_list_instructors returns FULL detail (incl. nested jsonb
-- + admin notes) so the directory page's "find-in-list" drawer works with a plain
-- data-source swap (no detail-fetch refactor). The summary version (20260619100000)
-- had no frontend caller yet. CREATE OR REPLACE can't widen the return type, so drop+recreate.
-- down: supabase/migrations-admin/down/20260619110000_instructors_list_full.sql

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
  message_group_id text, message_group_name text,
  specialties jsonb, introduction text, assigned_courses jsonb, recent_messages jsonb,
  admin_notes jsonb
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
           i.message_group_id, i.message_group_name,
           i.specialties, i.introduction, i.assigned_courses, i.recent_messages,
           coalesce((
             select jsonb_agg(jsonb_build_object(
                      'id', n.id, 'adminName', n.admin_name,
                      'content', n.content, 'createdAt', to_char(n.created_at, 'YYYY-MM-DD'))
                    order by n.created_at desc)
               from public.instructor_admin_notes n
              where n.instructor_id = i.id
           ), '[]'::jsonb) as admin_notes
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

comment on function public.admin_list_instructors(text, text, text, text, text) is
  'Users > 강사 관리 directory list (full detail incl nested jsonb + admin notes). private.is_admin guard, optional search/status/activity/org/country filters.';
