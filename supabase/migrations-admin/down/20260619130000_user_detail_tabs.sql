-- down: drop user-detail tab read RPCs + admin-owned tables.
drop function if exists public.admin_get_user_access_logs(uuid, int);
drop function if exists public.admin_get_user_payments(uuid, int);
drop function if exists public.admin_get_user_activity(uuid, int);
drop table if exists public.user_access_logs;
drop table if exists public.user_payment_records;
drop table if exists public.user_activity_events;
