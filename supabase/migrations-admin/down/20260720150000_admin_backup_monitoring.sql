drop function if exists public.get_admin_backup_runs(timestamptz, timestamptz, text, text, text, integer, integer);
drop function if exists public.get_admin_backup_summary();
drop function if exists public.record_admin_backup_report(jsonb, text);

drop table if exists public.admin_backup_report_events;
drop table if exists public.admin_restore_drills;
drop table if exists public.admin_backup_component_results;
drop table if exists public.admin_backup_runs;
