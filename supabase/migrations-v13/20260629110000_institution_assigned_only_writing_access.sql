-- Institution assigned-only writing access.
--
-- Replaces the 2026-06-26 "unmapped means public for everyone" contract with:
--   - non-institution users: only unmapped/public writing questions
--   - institution users: only questions mapped to their affiliation_code

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
begin
  if caller_id is null then
    return false;
  end if;

  select nullif(btrim(p.affiliation_code), '')
    into caller_code
    from public.profiles p
   where p.id = caller_id;

  select nullif(p.materials->>'question_id', '')
    into v_question_id
    from public.problems p
   where p.id = p_problem_id
     and p.domain = 'writing'
     and p.question_no = p_question_no;

  if v_question_id is null then
    return false;
  end if;

  -- The exposure table is the visibility source of truth. Without it there is
  -- no reliable way to distinguish public/unmapped questions from missing
  -- admin data, so fail closed.
  if to_regclass('public.topik_writing_question_institution_exposure') is null then
    return false;
  end if;

  if caller_code is null then
    return not exists (
      select 1
        from public.topik_writing_question_institution_exposure e
       where e.question_id = v_question_id
         and e.item_number = p_question_no
    );
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
  'Assigned-only writing visibility. Non-institution users may see unmapped public questions; institution users may only see questions mapped to profiles.affiliation_code. Requires problems.materials.question_id. 2026-06-29.';

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
begin
  if p_user_id is null then
    return false;
  end if;

  select nullif(btrim(p.affiliation_code), '')
    into caller_code
    from public.profiles p
   where p.id = p_user_id;

  select nullif(p.materials->>'question_id', '')
    into v_question_id
    from public.problems p
   where p.id = p_problem_id
     and p.domain = 'writing'
     and p.question_no = p_question_no;

  if v_question_id is null then
    return false;
  end if;

  if to_regclass('public.topik_writing_question_institution_exposure') is null then
    return false;
  end if;

  if caller_code is null then
    return not exists (
      select 1
        from public.topik_writing_question_institution_exposure e
       where e.question_id = v_question_id
         and e.item_number = p_question_no
    );
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
  'Owner-aware assigned-only writing visibility for service-role submission ingestion. 2026-06-29.';

commit;
