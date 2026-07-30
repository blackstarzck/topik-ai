import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';

import {
  assertEnvironmentMatchesTarget,
  assertQualifiedTracker,
  assertTransactionSafe,
  assertWriteEnvironment,
  buildBatchSql,
  buildProbeSql,
  buildTrackerInsert,
  normalizeBlocked,
  parseMigrationFileName,
  readManifest,
  readMigrationFromArchive,
  resolveAction,
  resolveBatch,
  sqlLiteral,
} from '../../scripts/db/apply-v13-migration.mjs';
import { resolveSqlMaxAttempts, sha256 } from '../../scripts/db/migrate-core.mjs';

const SHA = 'a'.repeat(40);
const DEV_REF = 'fglggyfvzjdsbyckinqa';
const PROD_REF = 'eymlabowhfgtxbiqwxqh';

function manifestWith(overrides = {}) {
  return {
    projectRef: DEV_REF,
    trackerTable: 'supabase_migrations.schema_migrations',
    sourceMigrationsDir: 'supabase/migrations',
    sequence: ['B1'],
    batches: {
      B1: { migrations: ['20260527113000_storage_email_confirmed_hardening.sql'] },
    },
    ...overrides,
  };
}

describe('apply-v13-migration guards', () => {
  it('refuses a development manifest pointed at the production project', () => {
    // Superseded assertNotProduction: production is now reachable, but only through
    // the production manifest and its own approval (ownership transfer D9).
    expect(() => assertEnvironmentMatchesTarget({
      projectRef: PROD_REF,
      manifest: manifestWith(),
      env: {},
    })).toThrow(/development manifest/i);
    expect(assertEnvironmentMatchesTarget({
      projectRef: DEV_REF,
      manifest: manifestWith(),
      env: {},
    })).toEqual({ target: 'development' });
  });

  it('requires a schema-qualified tracker built from plain identifiers', () => {
    expect(assertQualifiedTracker('supabase_migrations.schema_migrations'))
      .toBe('supabase_migrations.schema_migrations');
    expect(() => assertQualifiedTracker('schema_migrations')).toThrow(/schema\.table/);
    expect(() => assertQualifiedTracker('a.b.c')).toThrow(/schema\.table/);
    expect(() => assertQualifiedTracker('public."x"; drop table y')).toThrow(/schema\.table/);
  });

  it('escapes single quotes in SQL literals', () => {
    expect(sqlLiteral("o'brien")).toBe("'o''brien'");
    expect(sqlLiteral(null)).toBe('null');
  });

  it('parses the tracker version and name out of the file name', () => {
    expect(parseMigrationFileName('20260724140000_pdf_export_request_idempotency.sql'))
      .toMatchObject({ version: '20260724140000', name: 'pdf_export_request_idempotency' });
    expect(() => parseMigrationFileName('nope.sql')).toThrow(/Unsupported migration file name/);
  });
});

describe('batch resolution', () => {
  it('refuses to select a migration listed as blocked', () => {
    const manifest = manifestWith({
      batches: { B1: { migrations: ['20260701160000_institution_retry_availability.sql'] } },
      blockedMigrations: [
        { name: '20260701160000_institution_retry_availability.sql', reason: 'would drop writing items' },
      ],
    });
    expect(() => resolveBatch(manifest, 'B1')).toThrow(/Blocked migration cannot be selected/);
    expect(() => resolveBatch(manifest, 'B1')).toThrow(/would drop writing items/);
  });

  it('requires ascending version order inside a batch', () => {
    const manifest = manifestWith({
      batches: {
        B1: {
          migrations: [
            '20260729120000_list_user_problems_canonical_catalog_fix.sql',
            '20260722120000_writing_completion_and_pdf_outcomes.sql',
          ],
        },
      },
    });
    expect(() => resolveBatch(manifest, 'B1')).toThrow(/ascending version order/);
  });

  it('rejects an unknown batch and an empty batch', () => {
    expect(() => resolveBatch(manifestWith(), 'nope')).toThrow(/Unknown batch/);
    expect(() => resolveBatch(manifestWith({ batches: { B1: { migrations: [] } } }), 'B1'))
      .toThrow(/no migrations/);
  });

  it('normalizes blocked entries given as strings or objects', () => {
    const blocked = normalizeBlocked({
      blockedMigrations: [
        '20260629110000_institution_assigned_only_writing_access.sql',
        { name: '20260629170000_non_institution_writing_full_exposure.sql', reason: 'stale source rows' },
      ],
    });
    expect(blocked.get('20260629110000_institution_assigned_only_writing_access.sql'))
      .toBe('blocked by manifest');
    expect(blocked.get('20260629170000_non_institution_writing_full_exposure.sql'))
      .toBe('stale source rows');
  });
});

describe('transaction safety', () => {
  it('rejects statements that cannot run inside a transaction', () => {
    expect(() => assertTransactionSafe('x.sql', 'create index concurrently i on t (c);'))
      .toThrow(/create index concurrently/);
    expect(() => assertTransactionSafe('x.sql', 'vacuum analyze t;')).toThrow(/vacuum/);
    expect(() => assertTransactionSafe('x.sql', 'alter system set work_mem = 1;'))
      .toThrow(/alter system/);
  });

  it('rejects transaction control left over after stripping', () => {
    expect(() => assertTransactionSafe('x.sql', 'begin;\nselect 1;\n')).toThrow(/transaction control/);
    expect(() => assertTransactionSafe('x.sql', 'select 1;\ncommit;\n')).toThrow(/transaction control/);
  });

  it('ignores hostile keywords that only appear in comments', () => {
    expect(() => assertTransactionSafe('x.sql', '-- vacuum is not run here\nselect 1;'))
      .not.toThrow();
    expect(() => assertTransactionSafe('x.sql', '/* create index concurrently later */\nselect 1;'))
      .not.toThrow();
  });
});

describe('generated SQL', () => {
  const files = [{
    fileName: '20260527113000_storage_email_confirmed_hardening.sql',
    version: '20260527113000',
    name: 'storage_email_confirmed_hardening',
    checksum: 'b'.repeat(64),
    body: 'create or replace function private.is_email_confirmed(uid uuid) returns boolean as $$ select true $$ language sql;',
  }];

  it('wraps the batch in one transaction with timeouts and an advisory lock', () => {
    const sql = buildBatchSql({
      trackerTable: 'supabase_migrations.schema_migrations',
      batchName: 'B1',
      files,
      sourceGitSha: SHA,
      operator: 'tester',
      appliedAt: '2026-07-29T00:00:00.000Z',
    });
    expect(sql.startsWith('begin;')).toBe(true);
    expect(sql.trimEnd().endsWith('commit;')).toBe(true);
    expect(sql).toContain("set local lock_timeout = '5s';");
    expect(sql).toContain("set local statement_timeout = '180s';");
    expect(sql).toContain("pg_advisory_xact_lock(hashtextextended('topik-ai:supabase_migrations.schema_migrations', 0))");
    expect(sql).toContain('insert into supabase_migrations.schema_migrations (version, name, statements)');
    expect(sql).toContain(`v13_git_sha=${SHA}`);
    expect(sql).toContain('operator=tester');
    expect(sql).toContain('batch=B1');
  });

  it('requires a full commit sha for provenance', () => {
    expect(() => buildBatchSql({
      trackerTable: 'supabase_migrations.schema_migrations',
      batchName: 'B1',
      files,
      sourceGitSha: 'a2907654',
      operator: 'tester',
      appliedAt: 'now',
    })).toThrow(/full 40-character commit sha/);
  });

  it('overwrites a phantom tracker row instead of leaving it in place', () => {
    // 20260527113000 already has a row with empty statements even though nothing
    // ran. `do nothing` would preserve that false record.
    const insert = buildTrackerInsert({
      trackerTable: 'supabase_migrations.schema_migrations',
      file: files[0],
      statement: 'marker',
    });
    expect(insert).toContain('on conflict (version) do update');
    expect(insert).toContain('statements = excluded.statements');
    expect(insert).not.toContain('do nothing');
  });
});

describe('object probes', () => {
  it('builds one boolean column per probe kind', () => {
    const built = buildProbeSql([
      { kind: 'function', identity: 'private.is_email_confirmed(uuid)' },
      { kind: 'table', identity: 'private.system_reports' },
      { kind: 'column', identity: 'public.export_files.failure_code' },
      { kind: 'trigger', identity: 'public.study_events.trg_validate_review_set_study_event' },
    ]);
    expect(built.keys.map((key) => key.alias)).toEqual(['p0', 'p1', 'p2', 'p3']);
    expect(built.sql).toContain("to_regprocedure('private.is_email_confirmed(uuid)') is not null as p0");
    expect(built.sql).toContain("to_regclass('private.system_reports') is not null as p1");
    expect(built.sql).toContain("c.column_name = 'failure_code'");
    expect(built.sql).toContain("t.tgname = 'trg_validate_review_set_study_event'");
    expect(built.sql).toContain('not t.tgisinternal');
  });

  it('rejects unknown kinds and malformed identities', () => {
    expect(() => buildProbeSql([{ kind: 'policy', identity: 'x' }])).toThrow(/Unsupported probe kind/);
    expect(() => buildProbeSql([{ kind: 'function', identity: 'no_schema()' }]))
      .toThrow(/schema\.name\(args\)/);
    expect(() => buildProbeSql([{ kind: 'table', identity: 'public.t; drop table u' }]))
      .toThrow(/schema\.table/);
    expect(buildProbeSql([])).toBeNull();
  });
});

describe('write environment contract', () => {
  it('requires the expected ref, no-retry, and no production confirmation', () => {
    const base = {
      SUPABASE_PROJECT_REF: DEV_REF,
      SUPABASE_EXPECTED_PROJECT_REF: DEV_REF,
      SUPABASE_SQL_MAX_ATTEMPTS: '1',
    };
    expect(() => assertWriteEnvironment(base)).not.toThrow();
    expect(() => assertWriteEnvironment({ ...base, SUPABASE_EXPECTED_PROJECT_REF: PROD_REF }))
      .toThrow(/SUPABASE_EXPECTED_PROJECT_REF/);
    expect(() => assertWriteEnvironment({ ...base, SUPABASE_SQL_MAX_ATTEMPTS: '4' }))
      .toThrow(/SUPABASE_SQL_MAX_ATTEMPTS=1/);
    expect(() => assertWriteEnvironment({ ...base, SUPABASE_SQL_MAX_ATTEMPTS: undefined }))
      .toThrow(/SUPABASE_SQL_MAX_ATTEMPTS=1/);
    expect(() => assertWriteEnvironment({ ...base, SUPABASE_PRODUCTION_CONFIRM: PROD_REF }))
      .toThrow(/SUPABASE_PRODUCTION_CONFIRM/);
  });

  it('defaults to a read-only action and refuses two actions at once', () => {
    expect(resolveAction([])).toBe('status');
    expect(resolveAction(['--write'])).toBe('write');
    expect(resolveAction(['--dry-run'])).toBe('dry-run');
    expect(() => resolveAction(['--write', '--dry-run'])).toThrow(/exactly one action/);
  });
});

describe('runSql retry knob', () => {
  it('keeps the historical default and accepts an explicit single attempt', () => {
    expect(resolveSqlMaxAttempts({})).toBe(4);
    expect(resolveSqlMaxAttempts({ SUPABASE_SQL_MAX_ATTEMPTS: '' })).toBe(4);
    expect(resolveSqlMaxAttempts({ SUPABASE_SQL_MAX_ATTEMPTS: '1' })).toBe(1);
    expect(resolveSqlMaxAttempts({ SUPABASE_SQL_MAX_ATTEMPTS: '2' })).toBe(2);
  });

  it('rejects values that would silently fall back to retrying', () => {
    for (const raw of ['0', '-1', 'many', '1.5', '2x']) {
      expect(() => resolveSqlMaxAttempts({ SUPABASE_SQL_MAX_ATTEMPTS: raw }))
        .toThrow(/positive integer/);
    }
  });
});

describe('v13-shared-dev manifest integrity', () => {
  const { manifest } = readManifest('scripts/db/manifests/v13-shared-dev.json');

  it('only declares expectPresent where a cross-batch dependency justifies it', () => {
    // expectPresent is a precondition: the runner probes it before writing and
    // aborts when it is missing. Objects the batch itself creates belong in
    // expectPresentAfter. Five batches originally listed their own outputs under
    // expectPresent, so the very first --write aborted its own preflight.
    for (const batchName of manifest.sequence) {
      const batch = manifest.batches[batchName];
      if ((batch.expectPresent ?? []).length === 0) continue;
      expect(
        batch.requires,
        `${batchName} declares preconditions but no requires — are those its own outputs?`
      ).toBeTruthy();
      expect(batch.requires.length, batchName).toBeGreaterThan(0);
    }
  });

  it('targets development and the v13 CLI ledger, never a topik-ai tracker', () => {
    expect(manifest.projectRef).toBe(DEV_REF);
    expect(manifest.trackerTable).toBe('supabase_migrations.schema_migrations');
    expect(manifest.trackerTable).not.toContain('topik_writing_schema_migrations');
    expect(manifest.trackerTable).not.toContain('admin_schema_migrations');
  });

  it('declares the approved batches in order', () => {
    expect(manifest.sequence).toEqual(['B1', 'B2', 'B3', 'B4', 'B6', 'B7', 'B8', 'B9', 'B10']);
    expect(Object.keys(manifest.batches).sort()).toEqual([...manifest.sequence].sort());
    for (const batchName of manifest.sequence) {
      expect(() => resolveBatch(manifest, batchName)).not.toThrow();
    }
  });

  it('leaves system_reports to the admin namespace instead of a second tracker', () => {
    // topik-ai adopted the v13 canonical file byte for byte into
    // supabase/migrations-admin, so applying it here too would record one
    // migration in both admin_schema_migrations and the v13 CLI ledger.
    const selected = manifest.sequence.flatMap((batchName) => manifest.batches[batchName].migrations);
    expect(selected.some((fileName) => fileName.includes('system_reports'))).toBe(false);

    const adopted = manifest.adoptedElsewhere ?? [];
    const entry = adopted.find((item) => item.name === '20260723170000_system_reports.sql');
    expect(entry, 'system_reports must stay recorded as adopted elsewhere').toBeTruthy();
    expect(entry.tracker).toBe('admin_schema_migrations');
    expect(entry.reason).toBeTruthy();
    for (const item of adopted) {
      expect(() => parseMigrationFileName(item.name)).not.toThrow();
      expect(manifest.batches[item.formerBatch], `${item.name} batch must be gone`).toBeUndefined();
    }
  });

  it('never lists a blocked or deferred migration inside a batch', () => {
    const blocked = new Set(normalizeBlocked(manifest).keys());
    const deferred = new Set((manifest.deferredMigrations ?? []).map((entry) => entry.name));
    expect(blocked.size).toBe(5);
    expect(deferred.size).toBe(2);
    const selected = manifest.sequence
      .flatMap((batchName) => manifest.batches[batchName].migrations);
    for (const fileName of selected) {
      expect(blocked.has(fileName), `${fileName} is blocked`).toBe(false);
      expect(deferred.has(fileName), `${fileName} is deferred`).toBe(false);
    }
  });

  it('pairs the list_user_problems repair with the migration that regresses it', () => {
    expect(manifest.batches.B4.migrations).toEqual([
      '20260722120000_writing_completion_and_pdf_outcomes.sql',
      '20260729120000_list_user_problems_canonical_catalog_fix.sql',
    ]);
  });

  it('records the apply-order dependencies discovered on the live database', () => {
    expect(manifest.batches.B6.requires).toContain('B1');
    expect(manifest.batches.B6.requires).toContain('B4');
    expect(manifest.batches.B8.requires).toContain('B3');
  });

  it('leaves sourceGitSha unpinned so the merged repair commit must be named', () => {
    expect(manifest.sourceGitSha).toBeNull();
    expect(manifest.sourceGitShaComment).toMatch(/does NOT yet contain the repair migration/);
  });

  it('gives every blocked and deferred entry a reason', () => {
    for (const entry of manifest.blockedMigrations) {
      expect(entry.reason, entry.name).toBeTruthy();
    }
    for (const entry of manifest.deferredMigrations) {
      expect(entry.reason, entry.name).toBeTruthy();
    }
  });
});

describe('readMigrationFromArchive', () => {
  const APPLIED = '20260520120000_extensions_and_schemas.sql';
  let archiveDir;
  let tempRoots = [];

  function seed(body, overrides = {}) {
    archiveDir = mkdtempSync(join(tmpdir(), 'v13-apply-archive-'));
    tempRoots.push(archiveDir);
    mkdirSync(archiveDir, { recursive: true });
    writeFileSync(join(archiveDir, APPLIED), body);
    return {
      files: [
        {
          name: APPLIED,
          sha256: sha256(Buffer.from(body)),
          disposition: 'applied',
          ...overrides,
        },
      ],
    };
  }

  afterEach(() => {
    for (const root of tempRoots) rmSync(root, { recursive: true, force: true });
    tempRoots = [];
  });

  it('returns the archived body with the BOM stripped and line endings normalized', () => {
    const manifest = seed('\uFEFFselect 1;\r\nselect 2;\r\n');
    const body = readMigrationFromArchive({ archiveDir, manifest, fileName: APPLIED });
    expect(body).toBe('select 1;\nselect 2;\n');
  });

  it('refuses a file whose bytes drifted from the manifest', () => {
    const manifest = seed('select 1;\n');
    writeFileSync(join(archiveDir, APPLIED), 'select 1; -- edited\n');
    expect(() => readMigrationFromArchive({ archiveDir, manifest, fileName: APPLIED }))
      .toThrow(/sha256 drift/);
  });

  it('refuses blocked and deferred migrations with their recorded reason', () => {
    for (const disposition of ['blocked', 'deferred']) {
      const manifest = seed('select 1;\n', { disposition, reason: 'would regress the cutover' });
      expect(() => readMigrationFromArchive({ archiveDir, manifest, fileName: APPLIED }))
        .toThrow(/would regress the cutover/);
    }
  });

  it('refuses a replay-only migration another namespace owns', () => {
    const manifest = seed('select 1;\n', {
      disposition: 'adopted-elsewhere',
      replayOnly: true,
      adoptedAs: 'supabase/migrations-admin/20260723170000_system_reports.sql',
      reason: 'adopted byte for byte',
    });
    expect(() => readMigrationFromArchive({ archiveDir, manifest, fileName: APPLIED }))
      .toThrow(/two trackers/);
  });

  it('refuses a file the manifest does not list and one missing from disk', () => {
    const manifest = seed('select 1;\n');
    expect(() => readMigrationFromArchive({ archiveDir, manifest, fileName: 'nope.sql' }))
      .toThrow(/not listed in the learner archive manifest/);
    rmSync(join(archiveDir, APPLIED));
    expect(() => readMigrationFromArchive({ archiveDir, manifest, fileName: APPLIED }))
      .toThrow(/missing from the archive/);
  });
});

describe('batch provenance records the body source', () => {
  it('marks whether the bodies came from the archive or a v13 checkout', () => {
    const file = { version: '20260520120000', name: 'x', fileName: 'x.sql', checksum: 'c', body: 'select 1;' };
    for (const bodySource of ['archive', 'git']) {
      const sql = buildBatchSql({
        trackerTable: 'supabase_migrations.schema_migrations',
        batchName: 'B1',
        files: [file],
        sourceGitSha: SHA,
        operator: 'tester',
        appliedAt: '2026-07-30T00:00:00.000Z',
        bodySource,
      });
      expect(sql).toContain(`body_source=${bodySource};`);
      expect(sql).toContain(`v13_git_sha=${SHA};`);
    }
  });
});
