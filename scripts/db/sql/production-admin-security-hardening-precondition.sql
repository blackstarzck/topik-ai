select (
  (select count(*) from public.admin_schema_migrations) = 81
  and not exists (
    select 1
    from public.admin_schema_migrations
    where name = '20260716130000_admin_revoke_anon_rpc_execute.sql'
  )
  and not exists (
    select 1
    from public.admin_schema_migrations
    where name = '20260713140000_admin_learning_analytics_dual_id_coverage.sql'
  )
) as ok;
