-- Restore non-institution default writing exposure while keeping institution users assigned-only.
begin;

create or replace function public.is_writing_problem_visible_to_caller(
  p_problem_id uuid,
  p_question_no smallint
)
returns boolean
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  caller_id uuid := auth.uid();
  caller_code text;
  v_question_id text;
  v_problem_exists boolean := false;
begin
  if caller_id is null then
    return false;
  end if;

  select nullif(btrim(p.affiliation_code), '')
    into caller_code
    from public.profiles p
   where p.id = caller_id;

  select true, nullif(p.materials->>'question_id', '')
    into v_problem_exists, v_question_id
    from public.problems p
   where p.id = p_problem_id
     and p.domain = 'writing'
     and p.question_no = p_question_no;

  if not coalesce(v_problem_exists, false) then
    return false;
  end if;

  -- Non-institution learners keep the full active published writing pool.
  if caller_code is null then
    return true;
  end if;

  if v_question_id is null then
    return false;
  end if;

  if to_regclass('public.topik_writing_question_institution_exposure') is null then
    return false;
  end if;

  return exists (
    select 1
      from public.topik_writing_question_institution_exposure e
     where e.question_id = v_question_id
       and e.item_number = p_question_no
       and e.institution_code = caller_code
  );
end;
$$;

revoke all on function public.is_writing_problem_visible_to_caller(uuid, smallint) from public;
grant execute on function public.is_writing_problem_visible_to_caller(uuid, smallint) to authenticated;

comment on function public.is_writing_problem_visible_to_caller(uuid, smallint) is
  'Writing visibility. Non-institution users see the full writing pool; institution users are assigned-only by profiles.affiliation_code. 2026-06-29.';

create or replace function private.is_writing_problem_visible_to_user(
  p_problem_id uuid,
  p_question_no smallint,
  p_user_id uuid
)
returns boolean
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  caller_code text;
  v_question_id text;
  v_problem_exists boolean := false;
begin
  if p_user_id is null then
    return false;
  end if;

  select nullif(btrim(p.affiliation_code), '')
    into caller_code
    from public.profiles p
   where p.id = p_user_id;

  select true, nullif(p.materials->>'question_id', '')
    into v_problem_exists, v_question_id
    from public.problems p
   where p.id = p_problem_id
     and p.domain = 'writing'
     and p.question_no = p_question_no;

  if not coalesce(v_problem_exists, false) then
    return false;
  end if;

  -- Non-institution learners keep the full active published writing pool.
  if caller_code is null then
    return true;
  end if;

  if v_question_id is null then
    return false;
  end if;

  if to_regclass('public.topik_writing_question_institution_exposure') is null then
    return false;
  end if;

  return exists (
    select 1
      from public.topik_writing_question_institution_exposure e
     where e.question_id = v_question_id
       and e.item_number = p_question_no
       and e.institution_code = caller_code
  );
end;
$$;

revoke all on function private.is_writing_problem_visible_to_user(uuid, smallint, uuid) from public;
grant execute on function private.is_writing_problem_visible_to_user(uuid, smallint, uuid) to service_role;

comment on function private.is_writing_problem_visible_to_user(uuid, smallint, uuid) is
  'Owner-aware writing visibility for service-role submission ingestion. Non-institution users see the full writing pool; institution users are assigned-only by profiles.affiliation_code. 2026-06-29.';

commit;
