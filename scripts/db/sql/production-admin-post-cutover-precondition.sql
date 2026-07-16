select (
  (select count(*) from public.admin_schema_migrations) = 49
  and (
    select count(*)
    from public.admin_accounts
    where role = 'platform_admin' and status = 'active'
  ) >= 1
  and not exists (
    select 1
    from public.admin_accounts account
    where account.role = 'platform_admin'
      and account.status = 'active'
      and not private.is_platform_admin(account.id)
  )
) as ok;
