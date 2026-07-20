import { readFile } from 'node:fs/promises';
import { expect, it } from 'vitest';

const upUrl = new URL(
  '../../supabase/migrations-admin/20260720102000_users_phone_source_alignment.sql',
  import.meta.url,
);
const downUrl = new URL(
  '../../supabase/migrations-admin/down/20260720102000_users_phone_source_alignment.sql',
  import.meta.url,
);

it('reads the v13 split phone contract without changing profiles DDL', async () => {
  const migration = await readFile(upUrl, 'utf8');

  expect(migration).toMatch(
    /create or replace function private\.admin_profile_phone\(p_profile jsonb\)/i,
  );
  expect(migration).toMatch(/p_profile ->> 'phone_country_code'/i);
  expect(migration).toMatch(/p_profile ->> 'phone_number'/i);
  expect(migration).toMatch(/p_profile ->> 'phone'/i);
  expect(migration).toMatch(/get_admin_users\(text,text,integer,integer,text\)/i);
  expect(migration).toMatch(/get_admin_user\(uuid\)/i);
  expect(migration).toMatch(/admin_export_users\(text,boolean,text,text,uuid\[\]/i);
  expect(migration).not.toMatch(/alter\s+table\s+(?:public\.)?profiles/i);
  expect(migration).not.toMatch(/update\s+(?:public\.)?profiles/i);
});

it('has a paired rollback', async () => {
  const rollback = await readFile(downUrl, 'utf8');

  expect(rollback).toMatch(/private\.admin_profile_phone\(to_jsonb\(p\)\)/i);
  expect(rollback).toMatch(/private\.admin_profile_phone\(to_jsonb\(pr\)\)/i);
  expect(rollback).toMatch(
    /drop function if exists private\.admin_profile_phone\(jsonb\)/i,
  );
});
