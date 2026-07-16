select (
  (select count(*) from public.admin_schema_migrations) = 45
  and to_regclass('public.admin_accounts') is not null
  and (select count(*) from public.admin_accounts) = 0
  and (
    select count(*)
    from public.profiles
    where app_role = 'platform_admin' and status = 'active'
  ) = 1
) as ok;
