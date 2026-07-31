-- =====================================================================
-- TALKPIK AI - nickname availability RPC
-- =====================================================================

create or replace function public.is_nickname_available(candidate text)
returns boolean
language plpgsql
security definer
set search_path = pg_catalog, public
stable
as $$
declare
  caller_id uuid := auth.uid();
  normalized_candidate text := lower(btrim(candidate));
begin
  if caller_id is null then
    raise exception 'unauthenticated';
  end if;

  if normalized_candidate is null or length(normalized_candidate) = 0 then
    return false;
  end if;

  return not exists (
    select 1
    from public.profiles
    where lower(nickname::text) = normalized_candidate
      and id <> caller_id
  );
end;
$$;

revoke all on function public.is_nickname_available(text) from public;
grant execute on function public.is_nickname_available(text) to authenticated;

comment on function public.is_nickname_available(text) is
  'Returns whether a nickname is available to the current user without exposing other profile rows.';
