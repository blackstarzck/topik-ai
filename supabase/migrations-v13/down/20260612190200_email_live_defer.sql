-- notification pipeline migration home: topik-ai
--
-- This historical v13 down migration is intentionally a replay-safe no-op.
-- Existing shared databases keep their applied objects and data. Clean v13 replay
-- leaves the admin pipeline absent; topik-ai installs its current definition later
-- through admin_schema_migrations. Do not copy admin tables back into v13.

do $notification_pipeline_replay$
begin
  raise notice 'notification pipeline replay skipped; canonical migration home is topik-ai';
end
$notification_pipeline_replay$;
