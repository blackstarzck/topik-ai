drop function if exists public.admin_list_audit_logs(text, text, text, timestamptz, timestamptz, int, int);
drop index if exists public.admin_audit_logs_created_at_desc_idx;
drop index if exists public.admin_audit_logs_target_lookup_idx;
