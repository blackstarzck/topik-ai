-- User detail > Community tab: read-only list of a member's community posts.
-- Reads the admin-owned public.community_posts table (no DDL change).
-- NOTE: community_posts.author_id currently holds mock text ids in the dev seed,
-- so this returns empty for real profile uuids until author_id is linked to
-- profiles (a seed/data-model follow-up). The RPC itself is correct.
-- down: supabase/migrations-admin/down/20260618124000_admin_user_community_posts.sql

create or replace function public.admin_get_user_community_posts(
  p_target_user_id text,
  p_limit int default 100
)
returns table (
  id text,
  title text,
  board text,
  status text,
  reports_count int,
  created_at timestamptz
)
language plpgsql
stable
security definer
set search_path = pg_catalog, public
as $$
declare
  caller_id uuid := auth.uid();
  v_limit int := least(greatest(coalesce(p_limit, 100), 1), 500);
begin
  if caller_id is null then
    raise exception 'unauthenticated';
  end if;
  if not private.is_admin(caller_id) then
    raise exception 'forbidden: admin required';
  end if;

  return query
    select c.id, c.title, c.board, c.status, c.reports_count, c.created_at
    from public.community_posts c
    where c.author_id = p_target_user_id
    order by c.created_at desc
    limit v_limit;
end;
$$;

revoke all on function public.admin_get_user_community_posts(text, int) from public;
grant execute on function public.admin_get_user_community_posts(text, int) to authenticated;

comment on function public.admin_get_user_community_posts(text, int) is
  'User detail > Community tab. Read-only list of a member''s community_posts by author_id. private.is_admin guard. Reads admin-owned community_posts; no v13/community DDL change.';
