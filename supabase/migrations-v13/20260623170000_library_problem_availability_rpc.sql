-- =====================================================================
-- Preserve saved library problem ledger rows when the underlying problem
-- becomes unavailable, without leaking hard-hidden problem identity.
-- =====================================================================

create or replace function public.list_user_library_problem_items()
returns table (
  item_id uuid,
  problem_id uuid,
  title text,
  question_no smallint,
  tags text[],
  saved_at timestamptz,
  availability_status text,
  availability_reason text,
  can_retry boolean
)
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  caller_id uuid := auth.uid();
begin
  if caller_id is null then
    raise exception 'unauthenticated';
  end if;

  return query
  select
    li.id as item_id,
    li.problem_id,
    case
      when p.id is not null
       and p.publish_status = 'published'
       and p.visibility = 'public'
      then p.title
      else null
    end as title,
    case
      when p.id is not null
       and p.publish_status = 'published'
       and p.visibility = 'public'
      then p.question_no
      else null
    end as question_no,
    coalesce(li.tags, '{}'::text[]) as tags,
    li.saved_at,
    case
      when p.id is null then 'hard_unavailable'
      when p.publish_status = 'published'
       and p.visibility = 'public'
       and p.lifecycle_status = 'active'
      then 'available'
      when p.publish_status = 'published'
       and p.visibility = 'public'
      then 'soft_unavailable'
      else 'hard_unavailable'
    end as availability_status,
    case
      when p.id is null then null
      when p.publish_status = 'published'
       and p.visibility = 'public'
       and p.lifecycle_status <> 'active'
      then p.lifecycle_reason
      else null
    end as availability_reason,
    (
      p.id is not null
      and p.publish_status = 'published'
      and p.visibility = 'public'
      and p.lifecycle_status = 'active'
    ) as can_retry
  from public.library_items li
  left join public.problems p on p.id = li.problem_id
  where li.user_id = caller_id
    and li.item_type = 'problem'
  order by li.saved_at desc;
end;
$$;

revoke all on function public.list_user_library_problem_items() from public;
grant execute on function public.list_user_library_problem_items() to authenticated;
comment on function public.list_user_library_problem_items() is
  'Returns the caller-owned saved problem library rows with availability metadata. Hard-hidden problem identity is not exposed.';
