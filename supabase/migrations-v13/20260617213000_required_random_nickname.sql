-- TALKPIK AI - 2026-06-17 - required non-identifying random nickname
--
-- Every profile should have a public-safe nickname before community features
-- such as boards are enabled. Never derive it from email/provider identity.

create or replace function private.generate_default_nickname()
returns citext
language sql
volatile
set search_path = pg_catalog, public
as $$
  select ('talkpik-' || substr(replace(gen_random_uuid()::text, '-', ''), 1, 12))::citext;
$$;

revoke all on function private.generate_default_nickname() from public;

comment on function private.generate_default_nickname() is
  'Generates a non-identifying default public nickname. Does not use email, provider id, or auth metadata.';

update public.profiles
set nickname = ('talkpik-' || substr(replace(id::text, '-', ''), 1, 12))::citext
where nickname is null or btrim(nickname::text) = '';

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_attempt int := 0;
  v_nickname citext;
begin
  loop
    v_attempt := v_attempt + 1;
    v_nickname := private.generate_default_nickname();

    begin
      insert into public.profiles (id, display_name, nationality_country_code, nickname)
      values (
        new.id,
        nullif(btrim(new.raw_user_meta_data->>'display_name'), ''),
        upper(nullif(btrim(new.raw_user_meta_data->>'nationality_country_code'), '')),
        v_nickname
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
  'After insert on auth.users, create matching public.profiles row idempotently '
  'and seed display_name/nationality_country_code from raw_user_meta_data plus '
  'a required non-identifying random nickname. SECURITY DEFINER with locked search_path.';

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row
  execute function public.handle_new_user();

