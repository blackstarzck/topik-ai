-- down: drop the Users detail learning overview read RPC.
drop function if exists public.get_admin_user_learning_overview(uuid);
