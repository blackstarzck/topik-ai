-- Users RPC phone source alignment.
--
-- profiles is owned by v13 and is read-only from this repository. The current
-- v13 contract stores phone data in phone_country_code + phone_number, while
-- older dev databases may still expose a compatibility column named phone.
-- Convert the profile row to jsonb so the admin RPCs can prefer the canonical
-- split fields without requiring the optional legacy column to exist.
--
-- down: supabase/migrations-admin/down/20260720102000_users_phone_source_alignment.sql

create or replace function private.admin_profile_phone(p_profile jsonb)
returns text
language sql
immutable
set search_path = pg_catalog
as $$
  select case
    when nullif(regexp_replace(coalesce(p_profile ->> 'phone_number', ''), '\D', '', 'g'), '') is not null
      then concat_ws(
        ' ',
        upper(nullif(btrim(p_profile ->> 'phone_country_code'), '')),
        regexp_replace(p_profile ->> 'phone_number', '\D', '', 'g')
      )
    else nullif(btrim(p_profile ->> 'phone'), '')
  end;
$$;

revoke all on function private.admin_profile_phone(jsonb) from public;

comment on function private.admin_profile_phone(jsonb) is
  'Admin Users phone projection. Prefers v13 profiles.phone_country_code + phone_number and falls back to the optional legacy phone JSON key. Does not change profiles DDL.';

do $$
declare
  v_definition text;
  v_patched text;
begin
  select pg_get_functiondef('public.get_admin_users(text,text,integer,integer,text)'::regprocedure)
    into v_definition;

  if v_definition ~ E'p\\.phone([^_a-zA-Z0-9]|$)' then
    v_patched := replace(
      v_definition,
      'p.phone',
      'private.admin_profile_phone(to_jsonb(p))'
    );
    execute v_patched;
  elsif position('private.admin_profile_phone(to_jsonb(p))' in v_definition) = 0 then
    raise exception 'unsupported get_admin_users phone projection';
  end if;

  select pg_get_functiondef('public.get_admin_user(uuid)'::regprocedure)
    into v_definition;

  if v_definition ~ E'p\\.phone([^_a-zA-Z0-9]|$)' then
    v_patched := replace(
      v_definition,
      'p.phone',
      'private.admin_profile_phone(to_jsonb(p))'
    );
    execute v_patched;
  elsif position('private.admin_profile_phone(to_jsonb(p))' in v_definition) = 0 then
    raise exception 'unsupported get_admin_user phone projection';
  end if;

  select pg_get_functiondef(
    'public.admin_export_users(text,boolean,text,text,uuid[],text,text,date,date,text[],text[],text[],text[],text[],text[],text[])'::regprocedure
  ) into v_definition;

  if v_definition ~ E'pr\\.phone([^_a-zA-Z0-9]|$)' then
    v_patched := replace(
      v_definition,
      'pr.phone',
      'private.admin_profile_phone(to_jsonb(pr))'
    );
    execute v_patched;
  elsif position('private.admin_profile_phone(to_jsonb(pr))' in v_definition) = 0 then
    raise exception 'unsupported admin_export_users phone projection';
  end if;
end;
$$;

-- Fail closed if a legacy direct-column dependency survived the patch.
do $$
declare
  v_definition text;
begin
  select pg_get_functiondef('public.get_admin_users(text,text,integer,integer,text)'::regprocedure)
    into v_definition;
  if v_definition ~ E'p\\.phone([^_a-zA-Z0-9]|$)' then
    raise exception 'get_admin_users still depends on profiles.phone';
  end if;

  select pg_get_functiondef('public.get_admin_user(uuid)'::regprocedure)
    into v_definition;
  if v_definition ~ E'p\\.phone([^_a-zA-Z0-9]|$)' then
    raise exception 'get_admin_user still depends on profiles.phone';
  end if;

  select pg_get_functiondef(
    'public.admin_export_users(text,boolean,text,text,uuid[],text,text,date,date,text[],text[],text[],text[],text[],text[],text[])'::regprocedure
  ) into v_definition;
  if v_definition ~ E'pr\\.phone([^_a-zA-Z0-9]|$)' then
    raise exception 'admin_export_users still depends on profiles.phone';
  end if;
end;
$$;
