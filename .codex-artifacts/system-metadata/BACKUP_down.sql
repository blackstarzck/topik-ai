drop function if exists public.admin_reorder_metadata_items(text, jsonb, text);
drop function if exists public.admin_delete_metadata_item(text, text);
drop function if exists public.admin_toggle_metadata_item_status(text, text, text);
drop function if exists public.admin_toggle_metadata_group_status(text, text, text);
drop function if exists public.admin_save_metadata_item(text, jsonb, text);
drop function if exists public.admin_save_metadata_group(text, jsonb, text);
drop function if exists public.next_system_metadata_item_id();
drop function if exists public.next_system_metadata_group_id();

drop policy if exists system_metadata_group_items_admin_select on public.system_metadata_group_items;
drop policy if exists system_metadata_groups_admin_select on public.system_metadata_groups;

drop table if exists public.system_metadata_group_items;
drop table if exists public.system_metadata_groups;
