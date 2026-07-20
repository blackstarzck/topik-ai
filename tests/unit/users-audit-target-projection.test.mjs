import { readFile } from 'node:fs/promises';
import { expect, it } from 'vitest';

const migrationPath = new URL(
  '../../supabase/migrations-admin/20260720104000_users_audit_target_projection.sql',
  import.meta.url,
);

it('normalizes Users audit filters to the persisted User target', async () => {
  const sql = await readFile(migrationPath, 'utf8');

  expect(sql).toMatch(/lower\(v_target_type\) in \('user', 'users'\)/);
  expect(sql).toMatch(/v_target_type := 'User'/);
  expect(sql).toMatch(
    /v_target_type = 'User' and lower\(l\.target_table\) = 'users'/,
  );
});

it('projects persisted User audit targets as Users for the admin UI', async () => {
  const sql = await readFile(migrationPath, 'utf8');

  expect(sql).toMatch(
    /when lower\(counted\.target_table\) in \('user', 'users'\) then 'Users'/,
  );
  expect(sql).toMatch(/security definer/i);
  expect(sql).toMatch(/set search_path = pg_catalog, public/i);
  expect(sql).toMatch(
    /revoke all on function public\.admin_list_audit_logs[\s\S]+from public/i,
  );
});
