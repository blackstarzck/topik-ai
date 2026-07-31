-- ============================================================================
-- TALKPIK AI - 2026-07-10 - revoke anon EXECUTE on superseded / library RPCs
--
-- Two SECURITY DEFINER functions retained explicit anon EXECUTE on some remote
-- environments (grant drift), diverging from the intended authenticated-only
-- contract. Both functions already reject unauthenticated callers internally
-- (auth.uid() is null -> raises), so this is defense-in-depth hardening, not a
-- data-exposure fix.
--
-- 1) complete_auth_gate(text, text, text, boolean, text, text)
--    Locale-aware overload introduced by
--    20260625113000_auto_locale_detection.sql (created + granted to
--    authenticated there; PUBLIC revoked, but no explicit anon revoke).
--    It was functionally superseded by the gender/phone overloads
--    (7-arg / 9-arg) in 20260709153000 and 20260709165000, but never dropped.
--    The live delegation chain is 9-arg -> 7-arg -> 4-arg base, and the app
--    invokes only the 7/9-arg overloads via named-param RPC
--    (src/app/auth/consent/actions.ts), so this 6-arg overload is unreachable.
--    DROP removes the function together with its anon grant. NOTE: PostgreSQL
--    REVOKE ... ON FUNCTION has no IF EXISTS, so DROP FUNCTION IF EXISTS is the
--    idempotent, forward-only way to retire this overload and close its anon
--    drift window in one statement.
--
-- 2) list_user_library_problem_items()
--    Authenticated-only library availability RPC. 20260709170000 revoked
--    PUBLIC but did not revoke an explicit anon grant, so revoke anon directly
--    (mirrors 20260625001257 for complete_auth_gate 4-arg). Idempotent:
--    revoking a privilege that is not held is a harmless no-op.
--
-- Forward-only. Does NOT touch the 4-arg base or the 7/9-arg overloads (still
-- used) and does NOT alter any function body.
-- ============================================================================

drop function if exists public.complete_auth_gate(text, text, text, boolean, text, text);

revoke execute on function public.list_user_library_problem_items() from anon;
