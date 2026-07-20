import { describe, expect, it } from 'vitest';
import {
  classifyMigrationDiff,
  findContractOperations,
} from '../../scripts/db/check-expand-migrations.mjs';

describe('automatic release expand-migration gate', () => {
  it('allows additive schema changes', () => {
    expect(findContractOperations(`
      create table if not exists public.example (id uuid primary key);
      alter table public.example add column if not exists label text;
      create or replace function public.example_read() returns int language sql as $$
        select 1;
      $$;
    `)).toEqual([]);
  });

  it('rejects destructive contract operations', () => {
    expect(findContractOperations(`
      alter table public.example drop column old_value;
      drop function public.old_api();
    `)).toEqual(['drop-column', 'drop-function']);
  });

  it('rejects mutation or deletion of an existing migration', () => {
    const issues = classifyMigrationDiff(
      [
        {
          status: 'M',
          path: 'supabase/migrations-admin/20260101000000_existing.sql',
        },
        {
          status: 'D',
          path: 'supabase/migrations-admin/down/20260101000000_existing.sql',
        },
      ],
      () => 'select 1;'
    );

    expect(issues).toEqual([
      'supabase/migrations-admin/20260101000000_existing.sql: applied migrations are immutable (M)',
      'supabase/migrations-admin/down/20260101000000_existing.sql: applied migrations are immutable (D)',
    ]);
  });

  it('allows destructive SQL only inside a newly added down pair', () => {
    expect(classifyMigrationDiff([
      {
        status: 'A',
        path: 'supabase/migrations-admin/down/20260101000000_new.sql',
      },
    ], () => 'drop table public.example;')).toEqual([]);
  });
});
