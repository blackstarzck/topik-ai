-- down: drop the admin-account listing RPC.
drop function if exists public.admin_list_admin_app_roles(text);
