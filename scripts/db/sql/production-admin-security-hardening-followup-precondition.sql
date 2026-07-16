select (
  (select count(*) from public.admin_schema_migrations) = 82
  and exists (
    select 1
    from public.admin_schema_migrations
    where name = '20260716130000_admin_revoke_anon_rpc_execute.sql'
  )
  and not exists (
    select 1
    from public.admin_schema_migrations
    where name = '20260716131000_admin_revoke_public_refund_rpc_execute.sql'
  )
) as ok;
