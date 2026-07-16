-- Restore the state that existed after the anon-direct-grant hardening.
grant execute on function public.admin_approve_billing_refund(text, text)
  to public;
grant execute on function public.admin_reject_billing_refund(text, text)
  to public;
