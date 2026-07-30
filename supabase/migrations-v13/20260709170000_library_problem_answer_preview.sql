-- =====================================================================
-- Saved writing problem rows can show the user's latest answer preview.
-- Keep the 2026-07-01 availability/privacy gates intact.
-- =====================================================================

drop function if exists public.list_user_library_problem_items();

create or replace function public.list_user_library_problem_items()
returns table (
  item_id uuid,
  problem_id uuid,
  title text,
  question_no smallint,
  answer_text text,
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
  with saved_problem_items as (
    select
      li.id as item_id,
      li.problem_id,
      coalesce(li.tags, '{}'::text[]) as tags,
      li.saved_at,
      p.id as joined_problem_id,
      p.title,
      p.question_no,
      p.publish_status,
      p.visibility,
      p.lifecycle_status,
      p.lifecycle_reason,
      case
        when p.id is not null
         and p.publish_status = 'published'
         and p.visibility = 'public'
         and p.question_no is not null
        then public.is_writing_problem_visible_to_caller(p.id, p.question_no)
        else false
      end as institution_visible
    from public.library_items li
    left join public.problems p on p.id = li.problem_id
    where li.user_id = caller_id
      and li.item_type = 'problem'
  )
  select
    spi.item_id,
    spi.problem_id,
    case
      when spi.joined_problem_id is not null
       and spi.publish_status = 'published'
       and spi.visibility = 'public'
       and spi.institution_visible
      then spi.title
      else null
    end as title,
    case
      when spi.joined_problem_id is not null
       and spi.publish_status = 'published'
       and spi.visibility = 'public'
       and spi.institution_visible
      then spi.question_no
      else null
    end as question_no,
    case
      when spi.joined_problem_id is not null
       and spi.publish_status = 'published'
       and spi.visibility = 'public'
       and spi.institution_visible
      then coalesce(latest_draft.answer_text, latest_submission.answer_text)
      else null
    end as answer_text,
    spi.tags,
    spi.saved_at,
    case
      when spi.joined_problem_id is null then 'hard_unavailable'
      when spi.publish_status = 'published'
       and spi.visibility = 'public'
       and spi.institution_visible
       and spi.lifecycle_status = 'active'
      then 'available'
      when spi.publish_status = 'published'
       and spi.visibility = 'public'
       and spi.institution_visible
      then 'soft_unavailable'
      else 'hard_unavailable'
    end as availability_status,
    case
      when spi.joined_problem_id is null then null
      when spi.publish_status = 'published'
       and spi.visibility = 'public'
       and spi.institution_visible
       and spi.lifecycle_status is distinct from 'active'
      then spi.lifecycle_reason
      else null
    end as availability_reason,
    (
      spi.joined_problem_id is not null
      and spi.publish_status = 'published'
      and spi.visibility = 'public'
      and spi.institution_visible
      and spi.lifecycle_status = 'active'
    ) as can_retry
  from saved_problem_items spi
  left join lateral (
    select d.answer_text
    from public.writing_drafts d
    where d.user_id = caller_id
      and d.problem_id = spi.problem_id
      and d.autosave_status <> 'superseded'
      and nullif(btrim(coalesce(d.answer_text, '')), '') is not null
    order by coalesce(d.last_saved_at, d.updated_at, d.created_at) desc
    limit 1
  ) latest_draft on true
  left join lateral (
    select s.answer_text
    from public.writing_submissions s
    where s.user_id = caller_id
      and s.problem_id = spi.problem_id
      and nullif(btrim(s.answer_text), '') is not null
    order by s.submitted_at desc
    limit 1
  ) latest_submission on true
  order by spi.saved_at desc;
end;
$$;

revoke all on function public.list_user_library_problem_items() from public;
grant execute on function public.list_user_library_problem_items() to authenticated;
comment on function public.list_user_library_problem_items() is
  'Returns caller-owned saved problem library rows. Retry and identity exposure follow institution writing visibility; available rows include the caller latest draft/submission answer preview as of 2026-07-09.';
