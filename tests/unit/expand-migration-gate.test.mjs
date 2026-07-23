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
      drop table public.old_records;
      alter table public.example drop column old_value;
      drop function public.old_api();
      truncate table public.audit_events;
    `)).toEqual(['drop-table', 'drop-column', 'drop-function', 'truncate']);
  });

  it('ignores transaction-local table cleanup and TRUNCATE privilege revocation', () => {
    expect(findContractOperations(`
      drop table if exists _notification_candidates;
      create temp table _notification_candidates on commit drop as select 1;
      revoke insert, update, delete, truncate, references, trigger
        on table public.notification_dispatches
        from authenticated;
    `)).toEqual([]);
  });

  it('allows replacing a zero-argument function introduced earlier in the same release', () => {
    const issues = classifyMigrationDiff(
      [
        {
          status: 'A',
          path: 'supabase/migrations-admin/20260101000000_add_summary.sql',
        },
        {
          status: 'A',
          path: 'supabase/migrations-admin/20260101000100_extend_summary.sql',
        },
      ],
      (migrationPath) => migrationPath.endsWith('add_summary.sql')
        ? `create function public.get_summary() returns integer language sql as $$ select 1 $$;`
        : `
            drop function public.get_summary();
            create function public.get_summary() returns table (value integer)
            language sql as $$ select 1 $$;
          `
    );

    expect(issues).toEqual([]);
  });

  it('still rejects replacing a function that may have existed before the release', () => {
    const issues = classifyMigrationDiff(
      [
        {
          status: 'A',
          path: 'supabase/migrations-admin/20260101000000_update_summary.sql',
        },
        {
          status: 'A',
          path: 'supabase/migrations-admin/20260101000100_replace_summary.sql',
        },
      ],
      (migrationPath) => migrationPath.endsWith('update_summary.sql')
        ? `create or replace function public.get_summary() returns integer language sql as $$ select 1 $$;`
        : `
            drop function public.get_summary();
            create function public.get_summary() returns table (value integer)
            language sql as $$ select 1 $$;
          `
    );

    expect(issues).toEqual([
      'supabase/migrations-admin/20260101000100_replace_summary.sql: contract operation detected (drop-function)',
    ]);
  });

  it('rejects dropping an introduced function without recreating it', () => {
    const issues = classifyMigrationDiff(
      [
        {
          status: 'A',
          path: 'supabase/migrations-admin/20260101000000_add_summary.sql',
        },
        {
          status: 'A',
          path: 'supabase/migrations-admin/20260101000100_drop_summary.sql',
        },
      ],
      (migrationPath) => migrationPath.endsWith('add_summary.sql')
        ? `create function public.get_summary() returns integer language sql as $$ select 1 $$;`
        : `drop function public.get_summary();`
    );

    expect(issues).toEqual([
      'supabase/migrations-admin/20260101000100_drop_summary.sql: contract operation detected (drop-function)',
    ]);
  });

  it('rejects replacing an introduced function with arguments', () => {
    const issues = classifyMigrationDiff(
      [
        {
          status: 'A',
          path: 'supabase/migrations-admin/20260101000000_add_summary.sql',
        },
        {
          status: 'A',
          path: 'supabase/migrations-admin/20260101000100_replace_summary.sql',
        },
      ],
      (migrationPath) => migrationPath.endsWith('add_summary.sql')
        ? `create function public.get_summary(integer) returns integer language sql as $$ select $1 $$;`
        : `
            drop function public.get_summary(integer);
            create function public.get_summary(integer) returns bigint language sql as $$ select $1::bigint $$;
          `
    );

    expect(issues).toEqual([
      'supabase/migrations-admin/20260101000100_replace_summary.sql: contract operation detected (drop-function)',
    ]);
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
