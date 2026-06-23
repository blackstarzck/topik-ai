-- Down migration for 20260617203000_commerce_refunds.sql

drop function if exists public.admin_reject_billing_refund(text, text);
drop function if exists public.admin_approve_billing_refund(text, text);
drop function if exists public.next_commerce_refund_id();

drop policy if exists commerce_refunds_admin_select on public.commerce_refunds;

drop index if exists public.commerce_refunds_requested_at;
drop index if exists public.commerce_refunds_status;

drop table if exists public.commerce_refunds;
