-- These two refund RPCs retained PostgreSQL's implicit PUBLIC EXECUTE grant.
-- Keep authenticated execution, but remove unauthenticated inheritance.
revoke execute on function public.admin_approve_billing_refund(text, text)
  from public, anon;
revoke execute on function public.admin_reject_billing_refund(text, text)
  from public, anon;

grant execute on function public.admin_approve_billing_refund(text, text)
  to authenticated;
grant execute on function public.admin_reject_billing_refund(text, text)
  to authenticated;
