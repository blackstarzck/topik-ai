import { describe, expect, it } from 'vitest';
import {
  parseMigrationArgs,
  resolveManifestBatch,
  stripOuterTransaction,
} from '../../scripts/db/migrate-core.mjs';

describe('database migration safety runner', () => {
  it('requires one explicit action', () => {
    expect(() => parseMigrationArgs([])).toThrow('Choose exactly one action');
    expect(() => parseMigrationArgs(['--status', '--apply'])).toThrow(
      'Choose exactly one action'
    );
    expect(parseMigrationArgs(['--status'])).toMatchObject({ action: 'status' });
  });

  it('removes only a single supported outer transaction pair', () => {
    const sql = [
      '-- migration',
      'begin;',
      'create table public.example (id bigint);',
      'commit;',
    ].join('\n');

    expect(stripOuterTransaction(sql)).toBe(
      ['-- migration', 'create table public.example (id bigint);'].join('\n')
    );
    expect(() => stripOuterTransaction('begin;\nselect 1;\ncommit;\ncommit;')).toThrow(
      'unsupported transaction control'
    );
  });

  it('resolves manifest ranges and explicit adopt entries deterministically', () => {
    const localMigrations = [
      '20260101000000_first.sql',
      '20260102000000_second.sql',
      '20260103000000_third.sql',
    ];
    const manifest = {
      batches: {
        range: {
          from: localMigrations[0],
          to: localMigrations[1],
        },
        adopt: {
          migrations: [
            {
              name: localMigrations[2],
              mode: 'adopt',
              precondition: '../sql/check.sql',
            },
          ],
        },
      },
    };

    expect(resolveManifestBatch({
      manifest,
      batchName: 'range',
      localMigrations,
    }).entries).toEqual([
      { name: localMigrations[0], mode: 'apply' },
      { name: localMigrations[1], mode: 'apply' },
    ]);
    expect(resolveManifestBatch({
      manifest,
      batchName: 'adopt',
      localMigrations,
    }).entries[0]).toMatchObject({
      name: localMigrations[2],
      mode: 'adopt',
    });
  });
});
