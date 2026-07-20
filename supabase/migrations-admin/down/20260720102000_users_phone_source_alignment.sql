-- Down: restore the prior direct profiles.phone projections.

do $$
declare
  v_definition text;
begin
  select pg_get_functiondef('public.get_admin_users(text,text,integer,integer,text)'::regprocedure)
    into v_definition;
  if position('private.admin_profile_phone(to_jsonb(p))' in v_definition) > 0 then
    execute replace(
      v_definition,
      'private.admin_profile_phone(to_jsonb(p))',
      'p.phone'
    );
  end if;

  select pg_get_functiondef('public.get_admin_user(uuid)'::regprocedure)
    into v_definition;
  if position('private.admin_profile_phone(to_jsonb(p))' in v_definition) > 0 then
    execute replace(
      v_definition,
      'private.admin_profile_phone(to_jsonb(p))',
      'p.phone'
    );
  end if;

  select pg_get_functiondef(
    'public.admin_export_users(text,boolean,text,text,uuid[],text,text,date,date,text[],text[],text[],text[],text[],text[],text[])'::regprocedure
  ) into v_definition;
  if position('private.admin_profile_phone(to_jsonb(pr))' in v_definition) > 0 then
    execute replace(
      v_definition,
      'private.admin_profile_phone(to_jsonb(pr))',
      'pr.phone'
    );
  end if;
end;
$$;

drop function if exists private.admin_profile_phone(jsonb);
