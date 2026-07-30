import { describe, expect, it } from 'vitest';
import {
  classifyMigrationDiff,
  findContractOperations,
  isLearnerHistoryPath,
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

  it('allows a declared unapplied rewrite to modify a pending migration in place', () => {
    const issues = classifyMigrationDiff(
      [
        {
          status: 'M',
          path: 'supabase/migrations-admin/20260101000000_pending_rewrite.sql',
        },
      ],
      () => 'create or replace function private.example() returns int language sql as $$ select 1 $$;',
      {
        allowedRewrites: new Set([
          'supabase/migrations-admin/20260101000000_pending_rewrite.sql',
        ]),
      }
    );

    expect(issues).toEqual([]);
  });

  it('still scans a declared rewrite for destructive contract operations', () => {
    const issues = classifyMigrationDiff(
      [
        {
          status: 'M',
          path: 'supabase/migrations-admin/20260101000000_pending_rewrite.sql',
        },
      ],
      () => 'drop table public.example;',
      {
        allowedRewrites: new Set([
          'supabase/migrations-admin/20260101000000_pending_rewrite.sql',
        ]),
      }
    );

    expect(issues).toEqual([
      'supabase/migrations-admin/20260101000000_pending_rewrite.sql: contract operation detected (drop-table)',
    ]);
  });

  it('never allows deleting a migration even when declared as a rewrite', () => {
    const issues = classifyMigrationDiff(
      [
        {
          status: 'D',
          path: 'supabase/migrations-admin/20260101000000_pending_rewrite.sql',
        },
      ],
      () => 'select 1;',
      {
        allowedRewrites: new Set([
          'supabase/migrations-admin/20260101000000_pending_rewrite.sql',
        ]),
      }
    );

    expect(issues).toEqual([
      'supabase/migrations-admin/20260101000000_pending_rewrite.sql: applied migrations are immutable (D)',
    ]);
  });
});

describe('adopted learner history in the expand gate', () => {
  const WATERMARK = '20260729120000';
  const HISTORY = 'supabase/migrations-v13/20260714140000_writing_problem_identity_registry_cutover.sql';
  const AUTHORED = 'supabase/migrations-v13/20260801000000_new_learner_change.sql';
  // Real shape of the adopted history: the identity cutover drops functions and
  // deletes rows. That ran months ago, so re-judging it would block the adoption.
  const HISTORICAL_SQL = 'drop function if exists private.retired_helper();\nalter table public.problems drop column legacy_anchor;\n';

  function classify(entries, bodies) {
    return classifyMigrationDiff(
      entries,
      (path) => bodies[path],
      { learnerHistoryWatermark: WATERMARK }
    );
  }

  it('identifies learner paths at or below the watermark as history', () => {
    expect(isLearnerHistoryPath(HISTORY, WATERMARK)).toBe(true);
    expect(isLearnerHistoryPath(`supabase/migrations-v13/${WATERMARK}_edge.sql`, WATERMARK)).toBe(true);
    expect(isLearnerHistoryPath(AUTHORED, WATERMARK)).toBe(false);
    expect(isLearnerHistoryPath('supabase/migrations-admin/20260101000000_x.sql', WATERMARK)).toBe(false);
    // Without a watermark nothing is exempt, so the gate fails closed.
    expect(isLearnerHistoryPath(HISTORY, null)).toBe(false);
  });

  it('admits adopted history whose contract operations already ran', () => {
    expect(classify([{ status: 'A', path: HISTORY }], { [HISTORY]: HISTORICAL_SQL })).toEqual([]);
  });

  it('still refuses to let adopted history be edited or deleted', () => {
    for (const status of ['M', 'D']) {
      expect(classify([{ status, path: HISTORY }], { [HISTORY]: HISTORICAL_SQL })).toEqual([
        `${HISTORY}: applied migrations are immutable (${status})`,
      ]);
    }
  });

  it('holds learner migrations authored above the watermark to the expand-only rule', () => {
    const issues = classify([{ status: 'A', path: AUTHORED }], {
      [AUTHORED]: 'drop table public.something;\n',
    });
    expect(issues).toEqual([`${AUTHORED}: contract operation detected (drop-table)`]);
  });

  it('accepts an additive learner migration authored above the watermark', () => {
    const issues = classify([{ status: 'A', path: AUTHORED }], {
      [AUTHORED]: 'alter table public.profiles add column if not exists nickname text;\n',
    });
    expect(issues).toEqual([]);
  });

  it('covers learner down migrations with the same immutability rule', () => {
    const down = 'supabase/migrations-v13/down/20260801000000_new_learner_change.sql';
    expect(classify([{ status: 'A', path: down }], { [down]: 'select 1;' })).toEqual([]);
    expect(classify([{ status: 'M', path: down }], { [down]: 'select 1;' })).toEqual([
      `${down}: applied migrations are immutable (M)`,
    ]);
  });
});
