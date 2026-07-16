-- Production is receiving these admin-domain tables for the first time. Remove
-- fixture/demo rows inserted by historical development migrations while keeping
-- code tables, system metadata, notification/auth templates, quota defaults,
-- and operation_policies/operation_policy_histories. POL-001/POL-002 are the
-- source of truth for the user-facing terms/privacy projection and must never
-- be treated as disposable admin demo data.

delete from public.community_post_admin_notes;
delete from public.community_reports;
delete from public.community_posts;

delete from public.operation_faq_curations;
delete from public.operation_faq_metrics;
delete from public.operation_faqs;
delete from public.operation_events;
delete from public.operation_notices;

delete from public.commerce_point_expirations;
delete from public.commerce_point_ledgers;
delete from public.commerce_point_policies;
delete from public.commerce_coupon_subscription_templates;
delete from public.commerce_coupons;
delete from public.commerce_refunds;

delete from public.instructor_admin_notes;
delete from public.instructors;
delete from public.referral_reward_ledgers;
delete from public.referral_relations;
delete from public.referrals;

delete from public.user_activity_events;
delete from public.user_payment_records;
delete from public.user_access_logs;
delete from public.institution_codes;
delete from public.system_logs;
