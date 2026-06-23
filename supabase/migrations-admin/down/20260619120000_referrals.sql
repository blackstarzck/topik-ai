-- down: drop referral admin RPCs + tables.
drop function if exists public.admin_adjust_referral_reward(text, int, text);
drop function if exists public.admin_review_referral_anomaly(text, text);
drop function if exists public.admin_set_referral_status(text, text, text);
drop function if exists public.admin_list_referrals(text, text, text);
drop table if exists public.referral_reward_ledgers;
drop table if exists public.referral_relations;
drop table if exists public.referrals;
