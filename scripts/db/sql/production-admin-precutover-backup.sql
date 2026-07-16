do $$
begin
  if to_regclass('private.admin_prod_cutover_20260716_manifest') is not null then
    raise exception 'production cutover backup already exists';
  end if;
end
$$;

create table private.admin_prod_cutover_20260716_manifest as
select
  now() as created_at,
  'eymlabowhfgtxbiqwxqh'::text as project_ref,
  (select count(*) from public.profiles)::bigint as profiles_count,
  (select count(*) from public.admin_audit_logs)::bigint as admin_audit_logs_count,
  (select count(*) from public.admin_schema_migrations)::bigint as admin_tracker_count,
  (select count(*) from public.topik_writing_schema_migrations)::bigint as writing_tracker_count;

create table private.admin_prod_cutover_20260716_profiles
as table public.profiles;

create table private.admin_prod_cutover_20260716_admin_audit_logs
as table public.admin_audit_logs;

create table private.admin_prod_cutover_20260716_notification_templates
as table public.notification_templates;

create table private.admin_prod_cutover_20260716_notification_groups
as table public.notification_groups;

create table private.admin_prod_cutover_20260716_notification_dispatches
as table public.notification_dispatches;

create table private.admin_prod_cutover_20260716_notification_delivery_attempts
as table public.notification_delivery_attempts;

create table private.admin_prod_cutover_20260716_admin_tracker
as table public.admin_schema_migrations;

create table private.admin_prod_cutover_20260716_writing_tracker
as table public.topik_writing_schema_migrations;

revoke all on private.admin_prod_cutover_20260716_manifest from public, anon, authenticated, service_role;
revoke all on private.admin_prod_cutover_20260716_profiles from public, anon, authenticated, service_role;
revoke all on private.admin_prod_cutover_20260716_admin_audit_logs from public, anon, authenticated, service_role;
revoke all on private.admin_prod_cutover_20260716_notification_templates from public, anon, authenticated, service_role;
revoke all on private.admin_prod_cutover_20260716_notification_groups from public, anon, authenticated, service_role;
revoke all on private.admin_prod_cutover_20260716_notification_dispatches from public, anon, authenticated, service_role;
revoke all on private.admin_prod_cutover_20260716_notification_delivery_attempts from public, anon, authenticated, service_role;
revoke all on private.admin_prod_cutover_20260716_admin_tracker from public, anon, authenticated, service_role;
revoke all on private.admin_prod_cutover_20260716_writing_tracker from public, anon, authenticated, service_role;
