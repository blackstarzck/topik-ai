import { describe, expect, it } from 'vitest';
import {
  buildDevelopmentEvidence,
  expectedDevelopmentChecks,
} from '../../scripts/ci/write-development-evidence.mjs';
import { verifyDevelopmentEvidence } from '../../scripts/ci/verify-development-evidence.mjs';

const expected = {
  commitSha: 'abc123',
  projectRef: 'fglggyfvzjdsbyckinqa',
};

const SOURCE_TREE_SHA = 'b'.repeat(40);
const MIGRATION_DIGEST = 'c'.repeat(64);

function evidence(releasePlan, validationProfile) {
  return buildDevelopmentEvidence({
    ...expected,
    baseSha: 'base123',
    releasePlan,
    validationProfile,
    classifierVersion: 2,
    changedFilesDigest: 'a'.repeat(64),
    sourceTreeSha: SOURCE_TREE_SHA,
    migrationDigest: MIGRATION_DIGEST,
  });
}

describe('development evidence v5', () => {
  it('records a light sync without claiming build or hosted checks', () => {
    const report = evidence('sync-only', 'light');
    expect(report.checks).toEqual(expectedDevelopmentChecks('sync-only', 'light'));
    expect(report.checks.build).toBe('not-required');
    expect(report.checks.operationalSmoke).toBe('not-required');
    expect(verifyDevelopmentEvidence(report, expected)).toEqual([]);
  });

  it('records strong control-plane validation without a release', () => {
    const report = evidence('sync-only', 'full');
    expect(report.checks.build).toBe('passed');
    expect(report.checks.shadow).toBe('passed');
    expect(report.deployApp).toBe(false);
    expect(report.applyMigrations).toBe(false);
    expect(verifyDevelopmentEvidence(report, expected)).toEqual([]);
  });

  it('requires read-only DB and operational checks for app-only changes', () => {
    const report = evidence('app-only', 'app');
    expect(report.checks.tracker).toBe('passed');
    expect(report.checks.crud).toBe('not-required');
    expect(report.checks.shadow).toBe('not-required');
    expect(report.checks.upgradeReplay).toBe('not-required');
    expect(report.deployApp).toBe(true);
    expect(report.applyMigrations).toBe(false);
    expect(verifyDevelopmentEvidence(report, expected)).toEqual([]);
  });

  it.each(['db-only', 'app-db'])('requires every development DB gate for %s', (plan) => {
    const report = evidence(plan, 'full');
    expect(report.checks.upgradeReplay).toBe('passed');
    expect(Object.values(report.checks)).not.toContain('not-required');
    expect(report.applyMigrations).toBe(true);
    expect(report.deployApp).toBe(plan === 'app-db');
    expect(verifyDevelopmentEvidence(report, expected)).toEqual([]);
  });

  it('rejects forged flags and a forged pass for a required check', () => {
    const report = evidence('db-only', 'full');
    report.deployApp = true;
    report.checks.crud = 'not-required';
    expect(verifyDevelopmentEvidence(report, expected)).toEqual(expect.arrayContaining([
      'invalid-deploy-app',
      'invalid-check:crud',
    ]));
  });

  it('rejects mismatched identity and malformed classification data', () => {
    const report = evidence('app-only', 'app');
    report.commitSha = 'different';
    report.changedFilesDigest = 'not-a-digest';
    report.migrationOrder = ['admin', 'topik_writing'];
    expect(verifyDevelopmentEvidence(report, expected)).toEqual(expect.arrayContaining([
      'mismatch:commitSha',
      'invalid-changed-files-digest',
      'invalid-migration-order',
    ]));
  });

  it('binds evidence to the recomputed source tree and migration digest', () => {
    const report = evidence('db-only', 'full');
    expect(report.sourceTreeSha).toBe(SOURCE_TREE_SHA);
    expect(report.migrationDigest).toBe(MIGRATION_DIGEST);
    expect(verifyDevelopmentEvidence(report, {
      ...expected,
      sourceTreeSha: SOURCE_TREE_SHA,
      migrationDigest: MIGRATION_DIGEST,
    })).toEqual([]);

    expect(verifyDevelopmentEvidence(report, {
      ...expected,
      sourceTreeSha: 'd'.repeat(40),
      migrationDigest: 'e'.repeat(64),
    })).toEqual(expect.arrayContaining([
      'mismatch:sourceTreeSha',
      'mismatch:migrationDigest',
    ]));
  });

  it('rejects malformed tree and migration digests even without expected values', () => {
    const report = evidence('sync-only', 'light');
    report.sourceTreeSha = 'not-a-tree';
    report.migrationDigest = 'not-a-digest';
    expect(verifyDevelopmentEvidence(report, expected)).toEqual(expect.arrayContaining([
      'invalid-source-tree-sha',
      'invalid-migration-digest',
    ]));
  });

  it('refuses to build evidence without the v4 binding fields', () => {
    expect(() => buildDevelopmentEvidence({
      ...expected,
      baseSha: 'base123',
      releasePlan: 'sync-only',
      validationProfile: 'light',
      classifierVersion: 2,
      changedFilesDigest: 'a'.repeat(64),
    })).toThrow('sourceTreeSha');
  });
});

describe('learner archive in the release digest (ownership transfer M4)', () => {
  it('records schema 5 without a v13 contract sha', () => {
    // M4 removed the pin, so the evidence no longer carries it. The learner history
    // is bound by migrationDigest instead — see compute-migration-digest.
    const report = evidence('app-db', 'full');
    expect(report.schemaVersion).toBe(5);
    expect(report).not.toHaveProperty('v13CommitSha');
    expect(verifyDevelopmentEvidence(report, expected)).toEqual([]);
  });

  it('rejects evidence still declaring the retired schema version', () => {
    const stale = { ...evidence('app-db', 'full'), schemaVersion: 4 };
    expect(verifyDevelopmentEvidence(stale, expected)).toContain(
      'unsupported-schema-version'
    );
  });

  it('folds the learner archive bytes into the migration digest', async () => {
    const digest = await import('../../scripts/ci/compute-migration-digest.mjs');
    // Dropping the archive must move the digest; otherwise the archive is not
    // actually covered and a tampered learner file would ship unnoticed.
    expect(digest.computeMigrationDigest()).not.toBe(
      digest.computeMigrationDigest({ learnerArchive: null })
    );
    expect(digest.LEARNER_ARCHIVE_CONTRACT.namespace).toBe('v13_learner_archive');
  });
});
