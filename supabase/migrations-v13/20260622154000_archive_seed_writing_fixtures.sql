-- Remove wireframe seed writing fixtures from the user-facing problem pool.
--
-- Keep rows for referential integrity and historical diagnostics, but make them
-- ineligible for list_user_problems and writing routes that require published,
-- active problems.

update public.problems
set
  publish_status = 'archived',
  lifecycle_status = 'inactive',
  lifecycle_reason = coalesce(
    nullif(lifecycle_reason, ''),
    'seed_fixture_removed_from_user_flow'
  )
where publish_status = 'published'
  and (
    coalesce(tags, '{}'::text[]) && array['seed:wireframe_problem_fixtures']::text[]
    or materials->>'seed_source' = 'wireframe_problem_fixtures'
  );
