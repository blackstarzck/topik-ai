select (
  to_regclass('public.instructors') is not null
  and to_regclass('public.instructor_admin_notes') is not null
  and to_regprocedure('public.admin_list_instructors(text,text,text,text,text)') is not null
  and to_regclass('public.referrals') is not null
  and to_regclass('public.referral_relations') is not null
  and to_regclass('public.referral_reward_ledgers') is not null
  and to_regprocedure('public.admin_list_referrals(text,text,text)') is not null
  and to_regclass('public.user_activity_events') is not null
  and to_regclass('public.user_payment_records') is not null
  and to_regclass('public.user_access_logs') is not null
  and to_regprocedure('public.admin_get_user_activity(uuid,integer)') is not null
  and to_regclass('public.institution_codes') is not null
  and to_regprocedure('public.admin_list_institution_codes(text,text)') is not null
  and to_regclass('public.auth_email_templates') is not null
  and to_regprocedure('public.admin_save_auth_email_template(text,jsonb,text)') is not null
) as ok;
