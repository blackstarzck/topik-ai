-- ============================================================================
-- TALKPIK AI - 2026-07-09 - split profile phone country code and local number
--
-- Follow-up safety migration for environments that already applied
-- 20260709153000 when phone_number briefly stored the selected calling code
-- together with local digits. The durable contract is:
--   phone_country_code = ISO 3166-1 alpha-2 country code, for example KR
--   phone_number       = local digits only, for example 1012345678
-- ============================================================================

alter table public.profiles
  add column if not exists phone_country_code text;

alter table public.profiles
  drop constraint if exists profiles_phone_country_code_check;

alter table public.profiles
  add constraint profiles_phone_country_code_check
  check (
    phone_country_code is null
    or phone_country_code ~ '^[A-Z]{2}$'
  ) not valid;

alter table public.profiles
  validate constraint profiles_phone_country_code_check;

comment on column public.profiles.phone_country_code is
  'Optional self-reported phone country code stored as an ISO 3166-1 alpha-2 country code, for example KR.';

comment on column public.profiles.phone_number is
  'Optional self-reported local phone number digits without the selected country calling code.';

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public, private
as $$
declare
  v_attempt int := 0;
  v_affiliation_code text := nullif(btrim(new.raw_user_meta_data->>'affiliation_code'), '');
  v_gender text := lower(nullif(btrim(new.raw_user_meta_data->>'gender'), ''));
  v_phone_country_code text := upper(nullif(btrim(new.raw_user_meta_data->>'phone_country_code'), ''));
  v_phone_number text := nullif(btrim(new.raw_user_meta_data->>'phone_number'), '');
  v_requested_ui_locale text := lower(nullif(btrim(new.raw_user_meta_data->>'ui_locale'), ''));
  v_requested_ui_locale_source text := lower(nullif(btrim(new.raw_user_meta_data->>'ui_locale_source'), ''));
  v_ui_locale text := case
    when v_requested_ui_locale in ('ko','en','vi') then v_requested_ui_locale
    else 'ko'
  end;
  v_ui_locale_source text := case
    when v_requested_ui_locale in ('ko','en','vi')
         and v_requested_ui_locale_source in ('auto','manual') then v_requested_ui_locale_source
    when v_requested_ui_locale in ('ko','en','vi') then 'auto'
    else 'default'
  end;
  v_nickname citext;
begin
  if v_affiliation_code is not null
     and v_affiliation_code !~ '^[A-Za-z0-9_-]{2,64}$' then
    v_affiliation_code := null;
  end if;

  if v_gender is not null
     and v_gender not in ('male', 'female') then
    v_gender := null;
  end if;

  if v_phone_country_code is not null
     and v_phone_country_code !~ '^[A-Z]{2}$' then
    v_phone_country_code := null;
  end if;

  v_phone_number := nullif(left(regexp_replace(coalesce(v_phone_number, ''), '[^0-9]', '', 'g'), 20), '');
  if v_phone_number is null then
    v_phone_country_code := null;
  end if;

  loop
    v_attempt := v_attempt + 1;
    v_nickname := private.generate_default_nickname();

    begin
      insert into public.profiles (
        id,
        display_name,
        gender,
        nationality_country_code,
        affiliation_code,
        nickname,
        phone_country_code,
        phone_number,
        ui_locale,
        ui_locale_source
      )
      values (
        new.id,
        nullif(btrim(new.raw_user_meta_data->>'display_name'), ''),
        v_gender,
        upper(nullif(btrim(new.raw_user_meta_data->>'nationality_country_code'), '')),
        v_affiliation_code,
        v_nickname,
        v_phone_country_code,
        v_phone_number,
        v_ui_locale,
        v_ui_locale_source
      )
      on conflict (id) do nothing;
      return new;
    exception
      when unique_violation then
        if v_attempt >= 5 then
          raise;
        end if;
    end;
  end loop;
end;
$$;

revoke all on function public.handle_new_user() from public;

comment on function public.handle_new_user() is
  'After insert on auth.users, create matching public.profiles row idempotently; seeds required profile metadata, optional gender/split-phone metadata, generated nickname, and UI locale provenance. SECURITY DEFINER with locked search_path.';

drop function if exists public.complete_auth_gate(text, text, text, text, text, boolean);
drop function if exists public.complete_auth_gate(text, text, text, text, text, boolean, text, text);

create or replace function public.complete_auth_gate(
  p_display_name text,
  p_nickname text,
  p_nationality_country_code text,
  p_gender text,
  p_phone_country_code text,
  p_phone_number text,
  p_accept_required_consents boolean
)
returns void
language plpgsql
security definer
set search_path = pg_catalog, public, private
as $$
declare
  v_user_id uuid := auth.uid();
  v_gender text := lower(nullif(btrim(p_gender), ''));
  v_phone_country_code text := upper(nullif(btrim(p_phone_country_code), ''));
  v_phone_number text := nullif(btrim(p_phone_number), '');
begin
  if v_user_id is null then
    raise exception 'auth_completion_required: unauthenticated'
      using errcode = '42501';
  end if;

  if v_gender is not null
     and v_gender not in ('male', 'female') then
    raise exception 'auth_completion_invalid: gender'
      using errcode = 'P0001';
  end if;

  if v_phone_country_code is not null
     and v_phone_country_code !~ '^[A-Z]{2}$' then
    v_phone_country_code := null;
  end if;

  v_phone_number := nullif(left(regexp_replace(coalesce(v_phone_number, ''), '[^0-9]', '', 'g'), 20), '');
  if v_phone_number is null then
    v_phone_country_code := null;
  end if;

  perform public.complete_auth_gate(
    p_display_name,
    p_nickname,
    p_nationality_country_code,
    p_accept_required_consents
  );

  update public.profiles
     set gender = v_gender,
         phone_country_code = v_phone_country_code,
         phone_number = v_phone_number
   where id = v_user_id
     and (
       gender is distinct from v_gender
       or phone_country_code is distinct from v_phone_country_code
       or phone_number is distinct from v_phone_number
     );
end;
$$;

revoke all on function public.complete_auth_gate(text, text, text, text, text, text, boolean) from public;
revoke execute on function public.complete_auth_gate(text, text, text, text, text, text, boolean) from anon;
grant execute on function public.complete_auth_gate(text, text, text, text, text, text, boolean) to authenticated;

comment on function public.complete_auth_gate(text, text, text, text, text, text, boolean) is
  'Completes the existing auth gate and stores optional gender/split-phone profile fields in the same RPC transaction.';

create or replace function public.complete_auth_gate(
  p_display_name text,
  p_nickname text,
  p_nationality_country_code text,
  p_gender text,
  p_phone_country_code text,
  p_phone_number text,
  p_accept_required_consents boolean,
  p_ui_locale text,
  p_ui_locale_source text
)
returns void
language plpgsql
security definer
set search_path = pg_catalog, public, private
as $$
declare
  v_user_id uuid := auth.uid();
  v_ui_locale text := case
    when lower(nullif(btrim(p_ui_locale), '')) in ('ko','en','vi')
      then lower(nullif(btrim(p_ui_locale), ''))
    else null
  end;
  v_ui_locale_source text := case
    when lower(nullif(btrim(p_ui_locale_source), '')) in ('auto','manual')
      then lower(nullif(btrim(p_ui_locale_source), ''))
    else null
  end;
begin
  if v_user_id is null then
    raise exception 'auth_completion_required: unauthenticated'
      using errcode = '42501';
  end if;

  if v_ui_locale is not null and v_ui_locale_source is not null then
    update public.profiles
       set ui_locale = v_ui_locale,
           ui_locale_source = v_ui_locale_source
     where id = v_user_id
       and status = 'active'
       and ui_locale_source = 'default';
  end if;

  perform public.complete_auth_gate(
    p_display_name,
    p_nickname,
    p_nationality_country_code,
    p_gender,
    p_phone_country_code,
    p_phone_number,
    p_accept_required_consents
  );
end;
$$;

revoke all on function public.complete_auth_gate(text, text, text, text, text, text, boolean, text, text) from public;
revoke execute on function public.complete_auth_gate(text, text, text, text, text, text, boolean, text, text) from anon;
grant execute on function public.complete_auth_gate(text, text, text, text, text, text, boolean, text, text) to authenticated;

comment on function public.complete_auth_gate(text, text, text, text, text, text, boolean, text, text) is
  'Completes the auth gate after atomically applying a default-source UI locale seed and optional gender/split-phone profile fields.';
