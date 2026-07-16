select (
  (select count(*) from public.admin_schema_migrations) = 44
  and to_regclass('public.admin_accounts') is null
  and (select count(*) from public.profiles where app_role <> 'learner') = 0
) as ok;
