-- =====================================================================
-- TALKPIK AI - 2026-07-01 - confirmed institution invite acceptance
--
-- Adds a user-confirmed affiliation invite RPC. v13 keeps affiliation codes
-- opaque; admin-owned code catalog/name/expiry validation remains outside this
-- user app. The RPC only performs format validation and one-shot profile update.
-- =====================================================================

begin;

create or replace function public.accept_affiliation_invite(
  p_code text,
  p_confirmed boolean default false
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_caller_id uuid := (select auth.uid());
  v_code text := btrim(coalesce(p_code, ''));
  v_current_code text;
  v_profile_status text;
  v_updated_code text;
begin
  if v_caller_id is null then
    return jsonb_build_object('status', 'failed');
  end if;

  if p_confirmed is distinct from true then
    return jsonb_build_object('status', 'failed');
  end if;

  if v_code !~ '^[A-Za-z0-9_-]{2,64}$' then
    return jsonb_build_object('status', 'invalid');
  end if;

  select nullif(btrim(affiliation_code), ''), status
    into v_current_code, v_profile_status
    from public.profiles
   where id = v_caller_id;

  if not found then
    return jsonb_build_object('status', 'profile_not_found');
  end if;

  if v_profile_status is distinct from 'active' then
    return jsonb_build_object('status', 'failed');
  end if;

  if v_current_code is not null then
    if v_current_code = v_code then
      return jsonb_build_object('status', 'already_affiliated_same');
    end if;

    return jsonb_build_object('status', 'already_affiliated_other');
  end if;

  perform set_config('app.claim_affiliation_code', '1', true);

  update public.profiles
     set affiliation_code = v_code
   where id = v_caller_id
     and status = 'active'
     and (affiliation_code is null or affiliation_code = '')
  returning affiliation_code into v_updated_code;

  if v_updated_code = v_code then
    return jsonb_build_object('status', 'accepted');
  end if;

  select nullif(btrim(affiliation_code), '')
    into v_current_code
    from public.profiles
   where id = v_caller_id;

  if v_current_code = v_code then
    return jsonb_build_object('status', 'already_affiliated_same');
  end if;

  if v_current_code is not null then
    return jsonb_build_object('status', 'already_affiliated_other');
  end if;

  return jsonb_build_object('status', 'failed');
end;
$$;

revoke all on function public.accept_affiliation_invite(text, boolean) from public;
revoke all on function public.accept_affiliation_invite(text, boolean) from anon;
grant execute on function public.accept_affiliation_invite(text, boolean) to authenticated;

comment on function public.accept_affiliation_invite(text, boolean) is
  'Confirmed one-shot affiliation invite acceptance. Updates only the authenticated caller profile when active and affiliation_code is empty. 2026-07-01.';

create or replace function public.claim_affiliation_code(p_code text)
returns text
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_result jsonb := public.accept_affiliation_invite(p_code, true);
  v_status text := v_result->>'status';
  v_code text := btrim(coalesce(p_code, ''));
begin
  if v_status in ('accepted', 'already_affiliated_same') then
    return v_code;
  end if;

  return null;
end;
$$;

revoke all on function public.claim_affiliation_code(text) from public;
grant execute on function public.claim_affiliation_code(text) to authenticated;

comment on function public.claim_affiliation_code(text) is
  'Deprecated compatibility wrapper for accept_affiliation_invite(p_code, true). New v13 UX must use explicit invite confirmation. 2026-07-01.';

commit;
