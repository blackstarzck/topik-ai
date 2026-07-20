import { describe, expect, it } from 'vitest';
import {
  assertManifestProjectRef,
  classifyMigrationVerification,
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
    expect(parseMigrationArgs([
      '--verify-all',
      '--require-clean',
      '--json-out',
      'report.json',
    ])).toMatchObject({
      action: 'verifyAll',
      requireClean: true,
      jsonOut: 'report.json',
    });
    expect(() => parseMigrationArgs(['--status', '--require-clean'])).toThrow(
      '--require-clean is only valid'
    );
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

  it('fails closed for every dirty tracker state', () => {
    const localRecords = [
      { name: '20260101000000_first.sql', checksum: 'sha-first' },
      { name: '20260102000000_second.sql', checksum: 'sha-second' },
      { name: '20260103000000_third.sql', checksum: 'sha-third' },
      { name: '20260104000000_blocked.sql', checksum: 'sha-blocked' },
    ];
    const report = classifyMigrationVerification({
      localRecords,
      selectedEntries: localRecords.slice(0, 3),
      blockedMigrations: ['20260104000000_blocked.sql'],
      approvedRemoteOnly: ['20251231000000_approved.sql'],
      appliedRows: [
        { name: localRecords[1].name, checksum_sha256: null },
        { name: localRecords[2].name, checksum_sha256: 'wrong-sha' },
        { name: localRecords[3].name, checksum_sha256: 'sha-blocked' },
        { name: '20251230000000_unknown.sql', checksum_sha256: 'remote' },
        { name: '20251231000000_approved.sql', checksum_sha256: 'remote' },
      ],
      manifestMissing: ['20260105000000_missing.sql'],
      missingDown: ['20260106000000_no_down.sql'],
    });

    expect(report.clean).toBe(false);
    expect(report.issues).toMatchObject({
      pending: [localRecords[0].name],
      checksumMissing: [localRecords[1].name],
      checksumMismatch: [localRecords[2].name],
      blockedApplied: [localRecords[3].name],
      remoteOnly: ['20251230000000_unknown.sql'],
      manifestMissing: ['20260105000000_missing.sql'],
      missingDown: ['20260106000000_no_down.sql'],
    });
    expect(report.remoteOnlyApproved).toEqual(['20251231000000_approved.sql']);
  });

  it('accepts a complete tracker with an unapplied blocked migration', () => {
    const localRecords = [
      { name: '20260101000000_first.sql', checksum: 'sha-first' },
      { name: '20260102000000_blocked.sql', checksum: 'sha-blocked' },
    ];
    const report = classifyMigrationVerification({
      localRecords,
      selectedEntries: [localRecords[0]],
      blockedMigrations: [localRecords[1].name],
      appliedRows: [
        { name: localRecords[0].name, checksum_sha256: localRecords[0].checksum },
      ],
    });

    expect(report.clean).toBe(true);
    expect(report.migrations[1].state).toBe('blocked-not-applied');
  });

  it('rejects a manifest bound to a different Supabase project', () => {
    expect(() => assertManifestProjectRef('topik-dev', 'topik-prod')).toThrow(
      'does not match target'
    );
  });
});
