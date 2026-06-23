-- Down migration for 20260617190000_commerce_points.sql

drop function if exists public.admin_release_commerce_point_expiration(text, text);
drop function if exists public.admin_hold_commerce_point_expiration(text, text);
drop function if exists public.admin_create_manual_point_adjustment(text, integer, text);
drop function if exists public.admin_update_commerce_point_policy_status(text, text, text);
drop function if exists public.admin_save_commerce_point_policy(text, jsonb, text);
drop function if exists public.next_commerce_point_ledger_id();
drop function if exists public.next_commerce_point_policy_id();

drop policy if exists commerce_point_expirations_admin_select on public.commerce_point_expirations;
drop policy if exists commerce_point_ledgers_admin_select on public.commerce_point_ledgers;
drop policy if exists commerce_point_policies_admin_select on public.commerce_point_policies;

drop index if exists public.commerce_point_expirations_expire_at;
drop index if exists public.commerce_point_expirations_user_id;
drop index if exists public.commerce_point_ledgers_user_occurred_at;

drop table if exists public.commerce_point_expirations;
drop table if exists public.commerce_point_ledgers;
drop table if exists public.commerce_point_policies;
