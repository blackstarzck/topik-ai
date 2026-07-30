-- =====================================================================
-- TALKPIK AI - 2026-06-19 - profiles.affiliation_code
--
-- Adds a nullable sign-up source/affiliation code captured during sign-up.
-- A 박람회 QR carries a code (e.g. 'EXPO2026-BOOTH-A'); it rides sign-up and is
-- stored here so the member is later identifiable as an institutional / 박람회
-- member. The CODE'S MEANING (label/kind/status) is owned by the admin app
-- (topik-ai institution_codes catalog); here it is just an opaque,
-- charset-checked string. Existing users remain valid (NULL).
--
--   - email sign-up : handle_new_user seeds it from raw_user_meta_data.
--   - OAuth sign-up : sign-up metadata is unavailable, so the client calls
--                     claim_affiliation_code() right after auth to backfill.
--
-- A non-NULL affiliation_code is the marker of an institutional/박람회 member;
-- no separate boolean flag is introduced.
-- down: supabase/migrations/down/20260619140000_profiles_affiliation_code.sql
-- =====================================================================

alter table public.profiles
  add column if not exists affiliation_code text;

alter table public.profiles
  drop constraint if exists profiles_affiliation_code_format;
alter table public.profiles
  add constraint profiles_affiliation_code_format
  check (affiliation_code is null or affiliation_code ~ '^[A-Za-z0-9_-]{2,64}$');

comment on column public.profiles.affiliation_code is
  'Sign-up source/affiliation code carried by 박람회 QR (opaque string; meaning owned by admin institution_codes). Nullable for organic/existing users. 2026-06-19.';

-- handle_new_user(): additively also seed affiliation_code from Auth metadata.
-- (Recreated from the 2026-06-17 nationality version — keeps display_name +
--  nationality_country_code, adds affiliation_code.)
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_affiliation_code text := nullif(btrim(new.raw_user_meta_data->>'affiliation_code'), '');
begin
  insert into public.profiles (id, display_name, nationality_country_code, affiliation_code)
  values (
    new.id,
    nullif(btrim(new.raw_user_meta_data->>'display_name'), ''),
    upper(nullif(btrim(new.raw_user_meta_data->>'nationality_country_code'), '')),
    case
      when v_affiliation_code ~ '^[A-Za-z0-9_-]{2,64}$' then v_affiliation_code
      else null
    end
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

revoke all on function public.handle_new_user() from public;

comment on function public.handle_new_user() is
  'After insert on auth.users, create matching public.profiles row idempotently '
  'and seed display_name/nationality_country_code/affiliation_code from raw_user_meta_data. '
  'SECURITY DEFINER with locked search_path. Sign-up affiliation code 2026-06-19.';

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row
  execute function public.handle_new_user();

-- protect_profile_columns(): keep affiliation_code write-once and non-editable
-- through normal profile updates. claim_affiliation_code() sets a transaction
-- local flag before its own update so the trigger can distinguish the trusted
-- one-shot claim path from user-editable profile fields.
create or replace function private.protect_profile_columns()
returns trigger
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
begin
  -- Admins (content_admin / platform_admin) bypass entirely.
  if private.is_admin((select auth.uid())) then
    return new;
  end if;

  if new.app_role is distinct from old.app_role then
    raise exception
      'profiles.app_role can only be changed by admins'
      using errcode = '42501';
  end if;

  if new.plan_label is distinct from old.plan_label then
    raise exception
      'profiles.plan_label can only be changed by admins or billing service'
      using errcode = '42501';
  end if;

  if new.status is distinct from old.status then
    raise exception
      'profiles.status can only be changed by admins'
      using errcode = '42501';
  end if;

  if new.affiliation_code is distinct from old.affiliation_code
     and current_setting('app.claim_affiliation_code', true) is distinct from '1' then
    raise exception
      'profiles.affiliation_code can only be changed by claim_affiliation_code'
      using errcode = '42501';
  end if;

  return new;
end;
$$;

revoke all on function private.protect_profile_columns() from public;

comment on function private.protect_profile_columns() is
  'BEFORE UPDATE on public.profiles. Blocks app_role/plan_label/status changes for non-admins and blocks normal affiliation_code edits.';

-- claim_affiliation_code(): backfill for the OAuth sign-up path (and any case
-- where the code was absent from sign-up metadata). Sets the caller's OWN
-- affiliation_code ONLY IF currently empty — one-shot, not user-editable after.
-- affiliation_code is not a protect_profile_columns column, so this update is
-- permitted for the row owner. We validate charset but NOT against the admin
-- catalog (v13 stays decoupled; the admin app reconciles unknown codes).
create or replace function public.claim_affiliation_code(p_code text)
returns text
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  caller_id uuid := auth.uid();
  v_code    text := btrim(coalesce(p_code, ''));
begin
  if caller_id is null then raise exception 'unauthenticated'; end if;
  if v_code !~ '^[A-Za-z0-9_-]{2,64}$' then return null; end if;

  perform set_config('app.claim_affiliation_code', '1', true);

  update public.profiles
     set affiliation_code = v_code
   where id = caller_id
     and (affiliation_code is null or affiliation_code = '');

  return v_code;
end;
$$;

revoke all    on function public.claim_affiliation_code(text) from public;
grant  execute on function public.claim_affiliation_code(text) to authenticated;

comment on function public.claim_affiliation_code(text) is
  'Caller backfills their own profiles.affiliation_code once (no-op if already set). Used by the OAuth sign-up path where Auth metadata is unavailable. 2026-06-19.';
