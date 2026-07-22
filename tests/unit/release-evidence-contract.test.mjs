import { describe, expect, it } from 'vitest';
import {
  buildDevelopmentEvidence,
  expectedDevelopmentChecks,
} from '../../scripts/ci/write-development-evidence.mjs';
import { verifyDevelopmentEvidence } from '../../scripts/ci/verify-development-evidence.mjs';

const expected = {
  commitSha: 'abc123',
  v13CommitSha: 'def456',
  projectRef: 'fglggyfvzjdsbyckinqa',
};

function evidence(releasePlan, validationProfile) {
  return buildDevelopmentEvidence({
    ...expected,
    baseSha: 'base123',
    releasePlan,
    validationProfile,
    classifierVersion: 2,
    changedFilesDigest: 'a'.repeat(64),
  });
}

describe('development evidence v3', () => {
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
    expect(report.deployApp).toBe(true);
    expect(report.applyMigrations).toBe(false);
    expect(verifyDevelopmentEvidence(report, expected)).toEqual([]);
  });

  it.each(['db-only', 'app-db'])('requires every development DB gate for %s', (plan) => {
    const report = evidence(plan, 'full');
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
});
