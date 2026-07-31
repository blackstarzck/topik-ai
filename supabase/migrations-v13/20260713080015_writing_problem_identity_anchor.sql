-- Keep the legacy UUID/FK graph alive while writing content is read from the
-- topik_writing canonical catalog. This function deliberately creates only an
-- identity row. It must never overwrite an existing problem row.

create or replace function private.ensure_writing_problem_anchor(
  p_problem_id uuid,
  p_question_id text,
  p_item_number smallint
)
returns uuid
language plpgsql
security definer
set search_path = pg_catalog, public, private
as $$
declare
  v_problem public.problems%rowtype;
begin
  if p_problem_id is null then
    raise exception 'problem_id required';
  end if;
  if nullif(btrim(p_question_id), '') is null then
    raise exception 'question_id required';
  end if;
  if p_item_number not in (51, 52, 53, 54) then
    raise exception 'item_number must be one of 51/52/53/54';
  end if;
  if p_problem_id is distinct from (md5(p_question_id))::uuid then
    raise exception 'problem_id must equal deterministic learner_problem_id'
      using errcode = 'P0001',
            detail = 'Current learner identity is md5(question_id)::uuid; legacy_problem_id is provenance only.';
  end if;

  insert into public.problems (
    id,
    source,
    author_id,
    domain,
    question_no,
    topik_level,
    difficulty,
    title,
    prompt,
    materials,
    answer_key,
    rubric,
    explanation,
    tags,
    publish_status,
    review_status,
    visibility,
    lifecycle_status,
    lifecycle_reason,
    expires_at,
    created_at,
    updated_at
  )
  values (
    p_problem_id,
    'curated',
    null,
    'writing',
    p_item_number,
    2,
    null,
    '',
    '',
    null,
    null,
    null,
    null,
    '{}'::text[],
    'draft',
    'pending',
    'private',
    'inactive',
    'canonical_identity_anchor',
    null,
    now(),
    now()
  )
  on conflict (id) do nothing;

  select p.*
    into v_problem
    from public.problems p
   where p.id = p_problem_id
   for update;

  if not found then
    raise exception 'writing problem anchor was not created';
  end if;
  if v_problem.domain is distinct from 'writing' then
    raise exception 'problem_id collision: expected writing domain';
  end if;
  if v_problem.question_no is distinct from p_item_number then
    raise exception 'problem_id collision: item_number mismatch';
  end if;
  if v_problem.source is distinct from 'curated' then
    raise exception 'problem_id collision: expected curated source';
  end if;

  return v_problem.id;
end;
$$;

revoke all on function private.ensure_writing_problem_anchor(uuid, text, smallint) from public;
revoke all on function private.ensure_writing_problem_anchor(uuid, text, smallint) from anon;
revoke all on function private.ensure_writing_problem_anchor(uuid, text, smallint) from authenticated;
grant execute on function private.ensure_writing_problem_anchor(uuid, text, smallint) to service_role;

comment on function private.ensure_writing_problem_anchor(uuid, text, smallint) is
  'Creates a content-free writing identity row for deterministic learner_problem_id foreign keys. Existing rows are validated but never overwritten. legacy_problem_id is never accepted as current identity. Service role only.';
