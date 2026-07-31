-- ============================================================================
-- TALKPIK AI - 2026-07-24 - institution invitation trust boundary
--
-- Institution invitation creation and validation belong to topik-ai.
-- The v13 learner app responds to an invitation by its UUID through the
-- topik-ai-owned respond_institution_invitation RPC under the caller JWT.
-- Raw affiliation codes are no longer accepted from Auth user metadata and
-- the two legacy browser-callable code RPCs are retired.
--
-- This migration deliberately leaves private.protect_profile_columns() and its
-- transaction-local app.claim_affiliation_code compatibility gate unchanged.
-- The topik-ai response RPC uses that gate while updating the invited profile.
-- ============================================================================

begin;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public, private
as $$
declare
  v_attempt int := 0;
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
  'After insert on auth.users, create matching public.profiles row idempotently; seeds non-privileged profile metadata, optional gender/split-phone metadata, generated nickname, and UI locale provenance. Institution affiliation is assigned only through the topik-ai-owned invitation response flow. SECURITY DEFINER with locked search_path.';

revoke all on function public.accept_affiliation_invite(text, boolean)
  from public, anon, authenticated, service_role;
revoke all on function public.claim_affiliation_code(text)
  from public, anon, authenticated, service_role;

drop function if exists public.claim_affiliation_code(text);
drop function if exists public.accept_affiliation_invite(text, boolean);

commit;
