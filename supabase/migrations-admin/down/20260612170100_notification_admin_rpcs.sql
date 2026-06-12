-- down: 알림 admin RPC 제거
drop function if exists public.admin_save_notification_template(uuid, jsonb, text);
drop function if exists public.admin_set_notification_template_status(uuid, text, text);
drop function if exists public.admin_delete_notification_template(uuid, text);
drop function if exists public.admin_save_notification_group(uuid, jsonb, text);
drop function if exists public.admin_delete_notification_group(uuid, text);
drop function if exists public.admin_send_notification(uuid, jsonb, timestamptz, text, text);
