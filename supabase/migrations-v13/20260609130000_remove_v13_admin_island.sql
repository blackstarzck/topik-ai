-- =====================================================================
-- TALKPIK AI · Remove the v13 admin island · 2026-06-09
--
-- OWNER DECISION (2026-06-09): v13 is the user-facing app. The admin code that
-- existed in THIS repo was leftover scaffolding from an earlier "build everything
-- here" phase (see docs/admin-scope-boundary.md "History note"). The real admin is
-- the separate topik-ai repo. The NEW data flow for problems is: the ADMIN (topik-ai)
-- fetches problems/questions from an EXTERNAL/third-party API (ALREADY REVIEW-COMPLETE),
-- applies the exposure management point (public/private), and WRITES them to this
-- Supabase DB; v13 only READS that data (read-only). Therefore v13 needs NO problem
-- CRUD, NO review workflow, and NO admin user/org management here — they belong to the
-- admin (topik-ai), not v13.
--
-- The boundary doc reserved "keep vs roll back" of the admin-oriented RPCs + org
-- schema for the OWNER. The owner has now chosen to remove the entire v13 admin
-- island. This migration removes the admin-oriented DATABASE objects. The matching
-- admin UI/lib/route files are deleted in the same change.
--
-- PRESERVED (load-bearing — the whole app depends on these, NOT admin-only):
--   * profiles.app_role (+ enum)           — used by (workspace)/layout, profile
--   * admin_audit_logs (table)             — foundational/shared
--   * private.is_admin / is_content_admin / is_org_admin / is_platform_admin
--                                          — RLS helpers (is_platform_admin alone
--                                            gates 12 policies across the app)
--   * all user RPCs (list_user_problems, get_dashboard_kpi, submit_writing_*, ...)
--
-- additive-safe in spirit: this is a forward-only REMOVAL of objects that are
-- unused by any user-facing feature. All drops are idempotent (if exists). prod =
-- do not apply (report-only); dev only.
-- =====================================================================


-- ---------------------------------------------------------------------
-- 1. Admin RPCs (problem write + user management + admin dashboards/audit read)
--    None are referenced in any RLS policy (they are SECURITY DEFINER action
--    RPCs), so dropping them does not cascade into user-table policies.
-- ---------------------------------------------------------------------
drop function if exists public.admin_update_problem(uuid, jsonb);
drop function if exists public.admin_delete_problem(uuid);
drop function if exists public.admin_add_problem_asset(uuid, text, text, integer);
drop function if exists public.admin_remove_problem_asset(uuid);
drop function if exists public.admin_toggle_problem_publish(uuid, text);
drop function if exists public.admin_change_user_role(uuid, text);
drop function if exists public.admin_set_user_status(uuid, text);
drop function if exists public.get_admin_users(text, text, integer, integer);
drop function if exists public.get_admin_user_stats();
drop function if exists public.get_admin_audit_logs(uuid, integer);
drop function if exists public.get_admin_org_dashboard();


-- ---------------------------------------------------------------------
-- 2. Org schema (NET-NEW from 20260602120300_org.sql; never used by a
--    user-facing feature). CASCADE drops their RLS policies, FKs and indexes.
--    Order child→parent is not required with CASCADE, but listed parent-last
--    for clarity.
-- ---------------------------------------------------------------------
drop table if exists public.assignment_submissions cascade;
drop table if exists public.assignments            cascade;
drop table if exists public.org_members            cascade;
drop table if exists public.organizations          cascade;


-- ---------------------------------------------------------------------
-- 3. Org membership helpers — only ever referenced by the org-table policies
--    dropped in step 2, so they are now orphaned. (Role helpers
--    private.is_*_admin are KEPT — they are load-bearing for the whole app.)
-- ---------------------------------------------------------------------
drop function if exists private.is_org_member(uuid, uuid);
drop function if exists private.is_org_manager(uuid, uuid);
