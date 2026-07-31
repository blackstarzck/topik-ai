-- Pin the canonical writing question version and learner-safe render snapshot
-- on each submission. Existing legacy submissions remain valid with null
-- canonical fields.

alter table public.writing_submissions
  add column if not exists canonical_question_id text,
  add column if not exists canonical_import_id bigint,
  add column if not exists canonical_payload_hash text,
  add column if not exists question_snapshot jsonb;

alter table public.writing_submissions
  drop constraint if exists writing_submissions_canonical_import_id_fkey;
alter table public.writing_submissions
  add constraint writing_submissions_canonical_import_id_fkey
  foreign key (canonical_import_id)
  references public.topik_writing_question_import(import_id)
  on delete restrict;

-- A mutable draft must keep the same canonical version that was rendered.
-- Legacy drafts remain valid with all three columns null.
alter table public.writing_drafts
  add column if not exists canonical_question_id text,
  add column if not exists canonical_import_id bigint,
  add column if not exists canonical_payload_hash text,
  add column if not exists question_snapshot jsonb;

alter table public.writing_drafts
  drop constraint if exists writing_drafts_canonical_import_id_fkey;
alter table public.writing_drafts
  add constraint writing_drafts_canonical_import_id_fkey
  foreign key (canonical_import_id)
  references public.topik_writing_question_import(import_id)
  on delete restrict;

alter table public.writing_drafts
  drop constraint if exists writing_drafts_canonical_context_all_or_none;
alter table public.writing_drafts
  add constraint writing_drafts_canonical_context_all_or_none
  check (
    (
      canonical_question_id is null
      and canonical_import_id is null
      and canonical_payload_hash is null
      and question_snapshot is null
    )
    or (
      nullif(btrim(canonical_question_id), '') is not null
      and canonical_import_id is not null
      and nullif(btrim(canonical_payload_hash), '') is not null
      and jsonb_typeof(question_snapshot) = 'object'
    )
  );

create index if not exists writing_drafts_canonical_question_version_idx
  on public.writing_drafts (
    canonical_question_id,
    canonical_import_id,
    canonical_payload_hash
  )
  where canonical_question_id is not null;

alter table public.writing_submissions
  drop constraint if exists writing_submissions_canonical_context_all_or_none;
alter table public.writing_submissions
  add constraint writing_submissions_canonical_context_all_or_none
  check (
    (
      canonical_question_id is null
      and canonical_import_id is null
      and canonical_payload_hash is null
      and question_snapshot is null
    )
    or (
      nullif(btrim(canonical_question_id), '') is not null
      and canonical_import_id is not null
      and nullif(btrim(canonical_payload_hash), '') is not null
      and jsonb_typeof(question_snapshot) = 'object'
    )
  );

create index if not exists writing_submissions_canonical_question_version_idx
  on public.writing_submissions (
    canonical_question_id,
    canonical_import_id,
    canonical_payload_hash
  )
  where canonical_question_id is not null;

comment on column public.writing_submissions.canonical_question_id is
  'Canonical topik_writing question identity used for this submission.';
comment on column public.writing_submissions.canonical_import_id is
  'Exact promoted inbox version used for rendering and grading this submission.';
comment on column public.writing_submissions.canonical_payload_hash is
  'Immutable payload hash paired with canonical_import_id.';
comment on column public.writing_submissions.question_snapshot is
  'Learner-safe render snapshot. Answer, rubric, raw import, and internal review fields are forbidden.';
comment on column public.writing_drafts.canonical_question_id is
  'Canonical topik_writing question identity rendered into this mutable draft.';
comment on column public.writing_drafts.canonical_import_id is
  'Exact promoted inbox version rendered into this mutable draft.';
comment on column public.writing_drafts.canonical_payload_hash is
  'Immutable payload hash paired with the draft canonical_import_id.';
comment on column public.writing_drafts.question_snapshot is
  'Server-populated learner-safe render snapshot for stale-draft recovery. Client-provided snapshot values are never trusted.';

create or replace function private.jsonb_has_forbidden_writing_snapshot_key(
  p_value jsonb
)
returns boolean
language plpgsql
immutable
set search_path = pg_catalog
as $$
declare
  v_key text;
  v_child jsonb;
  v_forbidden text[] := array[
    'answer_key',
    'resolved_text',
    'model_answer',
    'canonical_answer',
    'accepted_answers',
    'accepted_synonyms',
    'target_note',
    'key_findings',
    'scoring_notes',
    'scoring_focus',
    'model_outline',
    'rubric',
    'content_team_memo',
    'raw_payload',
    'raw_response_text',
    'source_data'
  ];
begin
  if p_value is null then
    return false;
  end if;

  if jsonb_typeof(p_value) = 'object' then
    for v_key, v_child in select key, value from jsonb_each(p_value)
    loop
      if lower(v_key) = any(v_forbidden) then
        return true;
      end if;
      if private.jsonb_has_forbidden_writing_snapshot_key(v_child) then
        return true;
      end if;
    end loop;
  elsif jsonb_typeof(p_value) = 'array' then
    for v_child in select value from jsonb_array_elements(p_value)
    loop
      if private.jsonb_has_forbidden_writing_snapshot_key(v_child) then
        return true;
      end if;
    end loop;
  end if;

  return false;
end;
$$;

revoke all on function private.jsonb_has_forbidden_writing_snapshot_key(jsonb) from public;
revoke all on function private.jsonb_has_forbidden_writing_snapshot_key(jsonb) from anon;
revoke all on function private.jsonb_has_forbidden_writing_snapshot_key(jsonb) from authenticated;

-- Rebuild the exact JSON shape emitted by the authenticated learner-safe RPC.
-- Server-side draft/submission writers temporarily bind auth.uid() to the row
-- owner for this internal catalog lookup, then restore both PostgREST claim
-- settings on every path. This is the only snapshot constructor.
create or replace function private.get_writing_question_snapshot_from_catalog(
  p_problem_id uuid,
  p_question_id text,
  p_canonical_import_id bigint,
  p_payload_hash text,
  p_item_number smallint,
  p_user_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, private
as $$
declare
  v_previous_sub text := current_setting('request.jwt.claim.sub', true);
  v_previous_claims text := current_setting('request.jwt.claims', true);
  v_impersonated_claims jsonb;
  v_expected_snapshot jsonb;
begin
  if p_user_id is null then
    raise exception 'unauthenticated';
  end if;

  begin
    v_impersonated_claims := coalesce(
      nullif(v_previous_claims, '')::jsonb,
      '{}'::jsonb
    ) || jsonb_build_object('sub', p_user_id::text);
  exception when invalid_text_representation then
    v_impersonated_claims := jsonb_build_object('sub', p_user_id::text);
  end;

  perform set_config('request.jwt.claim.sub', p_user_id::text, true);
  perform set_config(
    'request.jwt.claims',
    v_impersonated_claims::text,
    true
  );

  begin
    select jsonb_build_object(
      'question_id', canonical.question_id,
      'canonical_import_id', canonical.canonical_import_id::text,
      'payload_hash', canonical.payload_hash,
      'item_number', canonical.item_number,
      'topik_level', canonical.topik_level,
      'difficulty', canonical.difficulty,
      'title', canonical.title,
      'prompt', canonical.prompt,
      'tags', coalesce(canonical.tags, '{}'::text[]),
      'materials', canonical.materials
    )
      into v_expected_snapshot
      from public.get_available_writing_questions(
        p_item_number,
        p_problem_id
      ) canonical
     where canonical.question_id = p_question_id
       and canonical.canonical_import_id = p_canonical_import_id
       and canonical.payload_hash = p_payload_hash
     limit 1;
  exception when others then
    perform set_config(
      'request.jwt.claim.sub',
      coalesce(v_previous_sub, ''),
      true
    );
    perform set_config(
      'request.jwt.claims',
      coalesce(v_previous_claims, ''),
      true
    );
    raise;
  end;

  perform set_config(
    'request.jwt.claim.sub',
    coalesce(v_previous_sub, ''),
    true
  );
  perform set_config(
    'request.jwt.claims',
    coalesce(v_previous_claims, ''),
    true
  );

  if v_expected_snapshot is null then
    raise exception 'canonical_snapshot_catalog_missing'
      using errcode = 'P0001',
            detail = 'The pinned canonical question is not learner-visible to this row owner.';
  end if;

  return v_expected_snapshot;
end;
$$;

revoke all on function private.get_writing_question_snapshot_from_catalog(uuid, text, bigint, text, smallint, uuid) from public;
revoke all on function private.get_writing_question_snapshot_from_catalog(uuid, text, bigint, text, smallint, uuid) from anon;
revoke all on function private.get_writing_question_snapshot_from_catalog(uuid, text, bigint, text, smallint, uuid) from authenticated;
revoke all on function private.get_writing_question_snapshot_from_catalog(uuid, text, bigint, text, smallint, uuid) from service_role;

create or replace function private.assert_writing_submission_snapshot_matches_catalog(
  p_problem_id uuid,
  p_question_id text,
  p_canonical_import_id bigint,
  p_payload_hash text,
  p_item_number smallint,
  p_user_id uuid,
  p_snapshot jsonb
)
returns void
language plpgsql
security definer
set search_path = pg_catalog, public, private
as $$
declare
  v_expected_snapshot jsonb;
begin
  v_expected_snapshot := private.get_writing_question_snapshot_from_catalog(
    p_problem_id,
    p_question_id,
    p_canonical_import_id,
    p_payload_hash,
    p_item_number,
    p_user_id
  );

  if p_snapshot is distinct from v_expected_snapshot then
    raise exception 'canonical_snapshot_catalog_mismatch'
      using errcode = 'P0001',
            detail = 'Submitted snapshot must exactly equal the learner-safe canonical RPC projection for the pinned version.';
  end if;
end;
$$;

revoke all on function private.assert_writing_submission_snapshot_matches_catalog(uuid, text, bigint, text, smallint, uuid, jsonb) from public;
revoke all on function private.assert_writing_submission_snapshot_matches_catalog(uuid, text, bigint, text, smallint, uuid, jsonb) from anon;
revoke all on function private.assert_writing_submission_snapshot_matches_catalog(uuid, text, bigint, text, smallint, uuid, jsonb) from authenticated;
revoke all on function private.assert_writing_submission_snapshot_matches_catalog(uuid, text, bigint, text, smallint, uuid, jsonb) from service_role;

create or replace function private.populate_writing_draft_question_snapshot()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public, private
as $$
begin
  if new.canonical_question_id is null then
    new.question_snapshot := null;
    return new;
  end if;

  -- Ignore any client-provided value and reconstruct the exact learner-safe
  -- snapshot under the draft owner's visibility context.
  new.question_snapshot := private.get_writing_question_snapshot_from_catalog(
    new.problem_id,
    new.canonical_question_id,
    new.canonical_import_id,
    new.canonical_payload_hash,
    new.question_no,
    new.user_id
  );

  if private.jsonb_has_forbidden_writing_snapshot_key(new.question_snapshot) then
    raise exception 'canonical_snapshot_contains_forbidden_key';
  end if;

  return new;
end;
$$;

revoke all on function private.populate_writing_draft_question_snapshot() from public;
revoke all on function private.populate_writing_draft_question_snapshot() from anon;
revoke all on function private.populate_writing_draft_question_snapshot() from authenticated;
revoke all on function private.populate_writing_draft_question_snapshot() from service_role;

drop trigger if exists writing_drafts_populate_question_snapshot
  on public.writing_drafts;
create trigger writing_drafts_populate_question_snapshot
before insert or update of
  problem_id,
  question_no,
  user_id,
  canonical_question_id,
  canonical_import_id,
  canonical_payload_hash,
  question_snapshot
on public.writing_drafts
for each row
execute function private.populate_writing_draft_question_snapshot();

create or replace function public.replace_stale_writing_draft(
  p_draft_id uuid,
  p_current_question_id text,
  p_current_import_id bigint,
  p_current_payload_hash text
)
returns uuid
language plpgsql
security definer
set search_path = pg_catalog, public, private
as $$
declare
  v_owner_id uuid := auth.uid();
  v_draft public.writing_drafts%rowtype;
  v_snapshot jsonb;
  v_new_draft_id uuid;
begin
  if v_owner_id is null then
    raise exception 'unauthenticated';
  end if;

  select *
    into v_draft
    from public.writing_drafts draft
   where draft.id = p_draft_id
     and draft.user_id = v_owner_id
     and draft.autosave_status <> 'superseded'
   for update;

  if not found then
    raise exception 'stale_draft_not_owned_or_inactive';
  end if;

  v_snapshot := private.get_writing_question_snapshot_from_catalog(
    v_draft.problem_id,
    p_current_question_id,
    p_current_import_id,
    p_current_payload_hash,
    v_draft.question_no,
    v_owner_id
  );

  if v_draft.canonical_question_id = p_current_question_id
     and v_draft.canonical_import_id = p_current_import_id
     and v_draft.canonical_payload_hash = p_current_payload_hash
     and v_draft.question_snapshot is not distinct from v_snapshot then
    return v_draft.id;
  end if;

  update public.writing_drafts
     set autosave_status = 'superseded',
         updated_at = now()
   where id = v_draft.id;

  insert into public.writing_drafts (
    user_id,
    problem_id,
    question_no,
    answer_text,
    answer_json,
    char_count,
    autosave_status,
    last_saved_at,
    canonical_question_id,
    canonical_import_id,
    canonical_payload_hash,
    question_snapshot
  ) values (
    v_owner_id,
    v_draft.problem_id,
    v_draft.question_no,
    v_draft.answer_text,
    v_draft.answer_json,
    v_draft.char_count,
    'clean',
    coalesce(v_draft.last_saved_at, now()),
    p_current_question_id,
    p_current_import_id,
    p_current_payload_hash,
    v_snapshot
  )
  returning id into v_new_draft_id;

  return v_new_draft_id;
end;
$$;

revoke all on function public.replace_stale_writing_draft(uuid, text, bigint, text) from public;
revoke all on function public.replace_stale_writing_draft(uuid, text, bigint, text) from anon;
grant execute on function public.replace_stale_writing_draft(uuid, text, bigint, text) to authenticated;
revoke all on function public.replace_stale_writing_draft(uuid, text, bigint, text) from service_role;

comment on function public.replace_stale_writing_draft(uuid, text, bigint, text) is
  'Authenticated atomic stale-draft recovery. Preserves the answer in a superseded row, copies it to the current canonical version, and rebuilds the learner-safe snapshot server-side.';

create or replace function private.validate_writing_submission_canonical_context()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public, private
as $$
begin
  if new.canonical_question_id is null then
    return new;
  end if;

  if new.question_snapshot->>'question_id' is distinct from new.canonical_question_id
     or (new.question_snapshot->>'canonical_import_id')::bigint is distinct from new.canonical_import_id
     or new.question_snapshot->>'payload_hash' is distinct from new.canonical_payload_hash
     or (new.question_snapshot->>'item_number')::smallint is distinct from new.question_no then
    raise exception 'canonical_snapshot_identity_mismatch';
  end if;

  if private.jsonb_has_forbidden_writing_snapshot_key(new.question_snapshot) then
    raise exception 'canonical_snapshot_contains_forbidden_key';
  end if;

  perform private.assert_writing_question_submittable(
    new.problem_id,
    new.canonical_question_id,
    new.canonical_import_id,
    new.canonical_payload_hash,
    new.question_no,
    new.user_id
  );

  perform private.assert_writing_submission_snapshot_matches_catalog(
    new.problem_id,
    new.canonical_question_id,
    new.canonical_import_id,
    new.canonical_payload_hash,
    new.question_no,
    new.user_id,
    new.question_snapshot
  );

  return new;
end;
$$;

revoke all on function private.validate_writing_submission_canonical_context() from public;
revoke all on function private.validate_writing_submission_canonical_context() from anon;
revoke all on function private.validate_writing_submission_canonical_context() from authenticated;

drop trigger if exists writing_submissions_validate_canonical_context
  on public.writing_submissions;
create trigger writing_submissions_validate_canonical_context
before insert or update of
  problem_id,
  question_no,
  canonical_question_id,
  canonical_import_id,
  canonical_payload_hash,
  question_snapshot
on public.writing_submissions
for each row
execute function private.validate_writing_submission_canonical_context();

create or replace function public.create_external_writing_submission_v2(
  submission jsonb
)
returns uuid
language plpgsql
security definer
set search_path = pg_catalog, public, private
as $$
declare
  owner_id uuid;
  external_submission_id uuid;
  v_draft_id uuid;
  v_parent_submission_id uuid;
  next_status text;
  existing_id uuid;
  v_draft_canonical_question_id text;
  v_draft_canonical_import_id bigint;
  v_draft_canonical_payload_hash text;
  v_draft_question_snapshot jsonb;
begin
  if not (submission ? 'user_id')
     or jsonb_typeof(submission->'user_id') <> 'string' then
    raise exception 'submission.user_id required (string uuid)';
  end if;

  begin
    owner_id := (submission->>'user_id')::uuid;
    external_submission_id := (submission->>'external_submission_id')::uuid;
  exception when others then
    raise exception 'submission user/external id must be a valid uuid';
  end;

  perform private.assert_submission_payload(submission, '[]'::jsonb, '[]'::jsonb);

  if not (submission ? 'canonical_question_id')
     or not (submission ? 'canonical_import_id')
     or not (submission ? 'canonical_payload_hash')
     or not (submission ? 'question_snapshot') then
    raise exception 'canonical_submission_context_required';
  end if;

  perform private.assert_writing_question_submittable(
    (submission->>'problem_id')::uuid,
    submission->>'canonical_question_id',
    (submission->>'canonical_import_id')::bigint,
    submission->>'canonical_payload_hash',
    (submission->>'question_no')::smallint,
    owner_id
  );

  next_status := coalesce(submission->>'feedback_status', 'analyzing');
  if next_status not in ('analyzing', 'failed') then
    raise exception 'submission.feedback_status must be analyzing or failed';
  end if;

  v_draft_id := case
    when submission ? 'draft_id' and jsonb_typeof(submission->'draft_id') = 'string'
      then (submission->>'draft_id')::uuid
    else null
  end;
  v_parent_submission_id := case
    when submission ? 'parent_submission_id'
      and jsonb_typeof(submission->'parent_submission_id') = 'string'
      then (submission->>'parent_submission_id')::uuid
    else null
  end;

  if v_draft_id is not null then
    select
      draft.canonical_question_id,
      draft.canonical_import_id,
      draft.canonical_payload_hash,
      draft.question_snapshot
      into
        v_draft_canonical_question_id,
        v_draft_canonical_import_id,
        v_draft_canonical_payload_hash,
        v_draft_question_snapshot
      from public.writing_drafts draft
     where draft.id = v_draft_id
       and draft.user_id = owner_id
       and draft.problem_id = (submission->>'problem_id')::uuid
       and draft.question_no = (submission->>'question_no')::smallint;

    if not found then
      raise exception 'draft_not_owned';
    end if;

    if v_draft_canonical_question_id is distinct from submission->>'canonical_question_id'
       or v_draft_canonical_import_id is distinct from (submission->>'canonical_import_id')::bigint
       or v_draft_canonical_payload_hash is distinct from submission->>'canonical_payload_hash'
       or v_draft_question_snapshot is distinct from submission->'question_snapshot' then
      raise exception 'canonical_draft_version_conflict';
    end if;
  end if;

  if v_parent_submission_id is not null and not exists (
    select 1
      from public.writing_submissions
     where id = v_parent_submission_id
       and user_id = owner_id
       and problem_id = (submission->>'problem_id')::uuid
       and question_no = (submission->>'question_no')::smallint
  ) then
    raise exception 'parent_submission_not_owned';
  end if;

  if v_draft_id is not null and next_status <> 'failed' then
    select id
      into existing_id
      from public.writing_submissions
     where draft_id = v_draft_id
       and feedback_status <> 'failed'
       and canonical_question_id = submission->>'canonical_question_id'
       and canonical_import_id = (submission->>'canonical_import_id')::bigint
       and canonical_payload_hash = submission->>'canonical_payload_hash'
     limit 1;
    if existing_id is not null then
      perform private.ensure_submission_library_item(owner_id, existing_id);
      return existing_id;
    end if;

    if exists (
      select 1
        from public.writing_submissions
       where draft_id = v_draft_id
         and feedback_status <> 'failed'
    ) then
      raise exception 'canonical_submission_version_conflict';
    end if;
  end if;

  begin
    insert into public.writing_submissions (
      id,
      user_id,
      problem_id,
      draft_id,
      question_no,
      answer_text,
      answer_json,
      char_count,
      feedback_status,
      parent_submission_id,
      canonical_question_id,
      canonical_import_id,
      canonical_payload_hash,
      question_snapshot
    )
    values (
      external_submission_id,
      owner_id,
      (submission->>'problem_id')::uuid,
      v_draft_id,
      (submission->>'question_no')::smallint,
      submission->>'answer_text',
      case when submission ? 'answer_json' then submission->'answer_json' else null end,
      (submission->>'char_count')::int,
      next_status,
      v_parent_submission_id,
      submission->>'canonical_question_id',
      (submission->>'canonical_import_id')::bigint,
      submission->>'canonical_payload_hash',
      submission->'question_snapshot'
    );
  exception when unique_violation then
    if v_draft_id is not null then
      select id
        into existing_id
        from public.writing_submissions
       where draft_id = v_draft_id
         and feedback_status <> 'failed'
         and canonical_question_id = submission->>'canonical_question_id'
         and canonical_import_id = (submission->>'canonical_import_id')::bigint
         and canonical_payload_hash = submission->>'canonical_payload_hash'
       limit 1;
      if existing_id is not null then
        perform private.ensure_submission_library_item(owner_id, existing_id);
        return existing_id;
      end if;

      if exists (
        select 1
          from public.writing_submissions
         where draft_id = v_draft_id
           and feedback_status <> 'failed'
      ) then
        raise exception 'canonical_submission_version_conflict';
      end if;
    end if;
    raise;
  end;

  perform private.ensure_submission_library_item(owner_id, external_submission_id);

  update public.writing_drafts
     set autosave_status = 'superseded',
         updated_at = now()
   where user_id = owner_id
     and problem_id = (submission->>'problem_id')::uuid
     and autosave_status <> 'superseded';

  return external_submission_id;
end;
$$;

revoke all on function public.create_external_writing_submission_v2(jsonb) from public;
revoke all on function public.create_external_writing_submission_v2(jsonb) from anon;
revoke all on function public.create_external_writing_submission_v2(jsonb) from authenticated;
grant execute on function public.create_external_writing_submission_v2(jsonb) to service_role;

comment on function public.create_external_writing_submission_v2(jsonb) is
  'Canonical service writer. Atomically validates exact question version/exposure and stores a learner-safe render snapshot.';
