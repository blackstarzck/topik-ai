-- down: drop the user admin-memo RPCs and table.
drop function if exists public.admin_delete_user_memo(text, text);
drop function if exists public.admin_add_user_memo(text, text, text);
drop function if exists public.admin_list_user_memos(text);
drop table if exists public.user_admin_memos;
