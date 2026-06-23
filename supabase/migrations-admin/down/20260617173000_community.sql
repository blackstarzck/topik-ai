drop function if exists public.admin_resolve_community_report(text, text, text);
drop function if exists public.admin_add_community_post_memo(text, jsonb, text);
drop function if exists public.admin_delete_community_post(text, text);
drop function if exists public.admin_show_community_post(text, text, text);
drop function if exists public.admin_hide_community_post(text, text, text);
drop function if exists public.next_community_post_admin_note_id(text);
drop function if exists public.next_community_post_id();

drop table if exists public.community_reports;
drop table if exists public.community_post_admin_notes;
drop table if exists public.community_posts;
