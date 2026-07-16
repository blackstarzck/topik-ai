with tracker as (
  select count(*)::integer as migration_count
  from public.admin_schema_migrations
),
admin_state as (
  select
    count(*) filter (
      where role = 'platform_admin' and status = 'active'
    )::integer as active_platform_admins,
    count(*)::integer as admin_accounts
  from public.admin_accounts
),
audit_state as (
  select count(*)::integer as bootstrap_audits
  from public.admin_audit_logs
  where action = 'admin_bootstrapped'
),
demo_state as (
  select jsonb_build_object(
    'notices', (select count(*) from public.operation_notices),
    'faqs', (select count(*) from public.operation_faqs),
    'events', (select count(*) from public.operation_events),
    'policies', (select count(*) from public.operation_policies),
    'communityPosts', (select count(*) from public.community_posts),
    'coupons', (select count(*) from public.commerce_coupons),
    'pointPolicies', (select count(*) from public.commerce_point_policies),
    'refunds', (select count(*) from public.commerce_refunds),
    'instructors', (select count(*) from public.instructors),
    'referrals', (select count(*) from public.referrals),
    'institutionCodes', (select count(*) from public.institution_codes),
    'systemLogs', (select count(*) from public.system_logs)
  ) as business_rows
),
security_state as (
  select
    count(*) filter (where c.relrowsecurity)::integer as rls_enabled,
    count(*)::integer as checked_tables
  from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public'
    and c.relname = any(array[
      'admin_accounts',
      'admin_permission_grants',
      'admin_audit_logs',
      'operation_notices',
      'operation_faqs',
      'operation_events',
      'operation_policies',
      'community_posts',
      'commerce_coupons',
      'system_logs'
    ])
),
rpc_security_state as (
  select
    count(*) filter (
      where has_function_privilege('anon', p.oid, 'execute')
    )::integer as anon_executable_admin_functions
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public'
    and p.prosecdef
    and p.proname = any(array[
      'admin_get_self',
      'admin_set_admin_role',
      'admin_set_user_status',
      'admin_save_operation_notice',
      'admin_save_commerce_coupon_template',
      'admin_send_notification',
      'get_admin_dashboard_stats'
    ])
)
select
  tracker.migration_count,
  admin_state.admin_accounts,
  admin_state.active_platform_admins,
  audit_state.bootstrap_audits,
  demo_state.business_rows,
  security_state.rls_enabled,
  security_state.checked_tables,
  rpc_security_state.anon_executable_admin_functions,
  private.is_platform_admin(
    (select id from public.admin_accounts where role = 'platform_admin' and status = 'active' limit 1)
  ) as platform_helper_ok
from tracker
cross join admin_state
cross join audit_state
cross join demo_state
cross join security_state
cross join rpc_security_state;
