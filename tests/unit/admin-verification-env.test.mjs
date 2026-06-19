import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { afterEach, describe, expect, it } from 'vitest';

import {
  evaluateAdminVerificationEnv,
  formatAdminVerificationEnvReport
} from '../../scripts/check-admin-verification-env.mjs';

let tempDirs = [];

function createTempRoot() {
  const root = mkdtempSync(join(tmpdir(), 'topik-ai-admin-env-'));
  tempDirs.push(root);
  return root;
}

function writeEnv(root, content) {
  const file = join(root, '.env.local');
  mkdirSync(join(file, '..'), { recursive: true });
  writeFileSync(file, content, 'utf8');
}

afterEach(() => {
  for (const dir of tempDirs) {
    rmSync(dir, { recursive: true, force: true });
  }
  tempDirs = [];
});

describe('check-admin-verification-env', () => {
  it('passes when admin verification credentials are configured without printing values', () => {
    const root = createTempRoot();
    writeEnv(root, [
      'E2E_ADMIN_EMAIL=admin@example.com',
      'E2E_ADMIN_PASSWORD=super-secret-password'
    ].join('\n'));

    const result = evaluateAdminVerificationEnv({ rootDir: root });
    const report = formatAdminVerificationEnvReport(result);

    expect(result.failures).toEqual([]);
    expect(report).toContain('Admin verification env check passed.');
    expect(report).toContain('E2E_ADMIN_EMAIL');
    expect(report).toContain('E2E_ADMIN_PASSWORD');
    expect(report).not.toContain('admin@example.com');
    expect(report).not.toContain('super-secret-password');
  });

  it('fails when admin verification credentials are missing', () => {
    const root = createTempRoot();
    writeEnv(root, 'E2E_USER_EMAIL=user@example.com\n');

    const result = evaluateAdminVerificationEnv({ rootDir: root });

    expect(result.failures).toContain('Missing required admin verification env: E2E_ADMIN_EMAIL');
    expect(result.failures).toContain('Missing required admin verification env: E2E_ADMIN_PASSWORD');
  });

  it('fails when admin verification credential names exist but values are empty', () => {
    const root = createTempRoot();
    writeEnv(root, [
      'E2E_ADMIN_EMAIL=',
      'E2E_ADMIN_PASSWORD=   '
    ].join('\n'));

    const result = evaluateAdminVerificationEnv({ rootDir: root });
    const report = formatAdminVerificationEnvReport(result);

    expect(result.failures).toContain('Empty required admin verification env: E2E_ADMIN_EMAIL');
    expect(result.failures).toContain('Empty required admin verification env: E2E_ADMIN_PASSWORD');
    expect(report).not.toContain('admin@example.com');
  });
});
