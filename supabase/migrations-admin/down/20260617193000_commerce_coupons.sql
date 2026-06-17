-- Down migration for 20260617193000_commerce_coupons.sql

drop function if exists public.admin_delete_commerce_coupon_template(text, text);
drop function if exists public.admin_set_commerce_coupon_template_status(text, text, text);
drop function if exists public.admin_save_commerce_coupon_template(text, jsonb, text);
drop function if exists public.admin_delete_commerce_coupon(text, text);
drop function if exists public.admin_set_commerce_coupon_issue_state(text, text, text);
drop function if exists public.admin_duplicate_commerce_coupon(text, text);
drop function if exists public.admin_save_commerce_coupon(text, jsonb, text);
drop function if exists public.next_commerce_coupon_template_id();
drop function if exists public.next_commerce_coupon_id();

drop policy if exists commerce_coupon_templates_admin_select
  on public.commerce_coupon_subscription_templates;
drop policy if exists commerce_coupons_admin_select on public.commerce_coupons;

drop index if exists public.commerce_coupon_templates_status;
drop index if exists public.commerce_coupon_templates_updated_at;
drop index if exists public.commerce_coupons_coupon_status;
drop index if exists public.commerce_coupons_coupon_kind;
drop index if exists public.commerce_coupons_updated_at;

drop table if exists public.commerce_coupon_subscription_templates;
drop table if exists public.commerce_coupons;
