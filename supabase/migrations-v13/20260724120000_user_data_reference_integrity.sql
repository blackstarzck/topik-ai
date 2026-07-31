-- Learner-owned CRUD continues to use the publishable key + user JWT + RLS.
-- This migration adds column privileges as defense in depth so owner-scoped
-- UPDATE policies cannot be used to retarget immutable references.

alter table public.library_items enable row level security;
alter table public.library_items force row level security;
alter table public.recommendation_items enable row level security;
alter table public.recommendation_items force row level security;
alter table public.export_files enable row level security;
alter table public.export_files force row level security;

-- Clear table-level and column-level privilege drift for public client roles.
revoke update on table public.library_items from public, anon, authenticated;
revoke update (
  id,
  user_id,
  item_type,
  attempt_id,
  submission_id,
  report_id,
  export_id,
  problem_id,
  note,
  tags,
  saved_at
) on table public.library_items from public, anon, authenticated;

revoke update on table public.recommendation_items from public, anon, authenticated;
revoke update (
  id,
  run_id,
  user_id,
  problem_id,
  rank,
  reason,
  estimated_minutes,
  weakness_tags,
  status
) on table public.recommendation_items from public, anon, authenticated;

revoke update on table public.export_files from public, anon, authenticated;
revoke update (
  id,
  user_id,
  source_type,
  source_id,
  storage_path,
  options,
  status,
  created_at,
  ready_at
) on table public.export_files from public, anon, authenticated;

-- The current learner app changes only these state columns. RLS still decides
-- which rows the authenticated JWT may update.
grant update (tags) on table public.library_items to authenticated;
grant update (status) on table public.recommendation_items to authenticated;
grant update (storage_path, status, ready_at)
  on table public.export_files to authenticated;

-- Preserve explicit system-job access instead of depending on PUBLIC drift.
grant select, insert, update, delete
  on table public.library_items to service_role;
grant select, insert, update, delete
  on table public.recommendation_items to service_role;
grant select, insert, update, delete
  on table public.export_files to service_role;

create or replace function private.validate_review_set_study_event()
returns trigger
language plpgsql
security invoker
set search_path = pg_catalog, public
as $$
declare
  item_text text;
  item_ids uuid[] := array[]::uuid[];
  item_id uuid;
  item_count integer;
  distinct_item_count integer;
  owned_item_count integer;
  payload_count numeric;
begin
  if new.event_type <> 'review_set_created' then
    return new;
  end if;

  if new.payload is null
     or jsonb_typeof(new.payload) <> 'object'
     or not (new.payload ? 'item_ids')
     or jsonb_typeof(new.payload -> 'item_ids') <> 'array'
     or not (new.payload ? 'count')
     or jsonb_typeof(new.payload -> 'count') <> 'number' then
    raise exception using
      errcode = '22023',
      message = 'invalid_review_set_payload';
  end if;

  item_count := jsonb_array_length(new.payload -> 'item_ids');
  if item_count = 0 then
    raise exception using
      errcode = '22023',
      message = 'invalid_review_set_payload';
  end if;

  if exists (
    select 1
    from jsonb_array_elements(new.payload -> 'item_ids') as entry(value)
    where jsonb_typeof(entry.value) <> 'string'
  ) then
    raise exception using
      errcode = '22023',
      message = 'invalid_review_set_payload';
  end if;

  begin
    payload_count := (new.payload ->> 'count')::numeric;
  exception
    when invalid_text_representation or numeric_value_out_of_range then
      raise exception using
        errcode = '22023',
        message = 'invalid_review_set_payload';
  end;

  if payload_count <> trunc(payload_count)
     or payload_count <> item_count then
    raise exception using
      errcode = '22023',
      message = 'invalid_review_set_payload';
  end if;

  for item_text in
    select entry.value #>> '{}'
    from jsonb_array_elements(new.payload -> 'item_ids') as entry(value)
  loop
    begin
      item_id := item_text::uuid;
    exception
      when invalid_text_representation then
        raise exception using
          errcode = '22023',
          message = 'invalid_review_set_payload';
    end;
    item_ids := array_append(item_ids, item_id);
  end loop;

  select count(*), count(distinct selected.item_id)
  into item_count, distinct_item_count
  from unnest(item_ids) as selected(item_id);

  if item_count <> distinct_item_count then
    raise exception using
      errcode = '22023',
      message = 'invalid_review_set_payload';
  end if;

  select count(*)
  into owned_item_count
  from public.library_items as item
  where item.user_id = new.user_id
    and item.id = any(item_ids);

  if owned_item_count <> item_count then
    raise exception using
      errcode = '23503',
      message = 'invalid_review_set_items';
  end if;

  return new;
end;
$$;

revoke all on function private.validate_review_set_study_event()
  from public, anon, authenticated;

drop trigger if exists trg_validate_review_set_study_event
  on public.study_events;
create trigger trg_validate_review_set_study_event
before insert or update of user_id, event_type, payload
on public.study_events
for each row execute function private.validate_review_set_study_event();

comment on function private.validate_review_set_study_event() is
  'Invoker trigger guard: review_set_created payload item_ids must be distinct UUIDs owned by study_events.user_id, and payload.count must match.';
