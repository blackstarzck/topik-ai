-- down: remove backfilled admins (those that still have a matching non-learner
-- profiles row). Grants cascade. Invited admins (no profiles row) are untouched.
-- Not reversible after Phase 7 deletes the admins' profiles rows.
delete from public.admin_accounts a
where exists (
  select 1 from public.profiles p
  where p.id = a.id and p.app_role <> 'learner'
);
