-- ============================================================================
-- TALKPIK AI - 2026-06-25 - restrict auth completion gate grants
--
-- `complete_auth_gate` is the authenticated /auth/consent completion RPC.
-- Some remote environments retained explicit anon EXECUTE after the original
-- migration, so revoke anon directly instead of relying only on PUBLIC.
-- ============================================================================

revoke all on function public.complete_auth_gate(text, text, text, boolean) from public;
revoke execute on function public.complete_auth_gate(text, text, text, boolean) from anon;
grant execute on function public.complete_auth_gate(text, text, text, boolean) to authenticated;
