-- down: drop the user community-posts read RPC.
drop function if exists public.admin_get_user_community_posts(text, int);
