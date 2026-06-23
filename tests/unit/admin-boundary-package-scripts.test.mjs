import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const packageJson = JSON.parse(readFileSync(join(process.cwd(), 'package.json'), 'utf8'));

describe('admin-boundary package scripts', () => {
  it('keeps the production handoff harness stricter than the local boundary harness', () => {
    expect(packageJson.scripts['harness:admin-boundary']).toBe('npm run harness:admin-boundary:local');

    const localHarness = packageJson.scripts['harness:admin-boundary:local'];
    expect(localHarness).toContain('npm run check:admin-verification-env');

    const productionHarness = packageJson.scripts['harness:admin-boundary:production'];

    expect(productionHarness).toContain('npm run harness:admin-boundary:local');
    expect(productionHarness).toContain('npm run check:vercel-worker-readiness -- --strict-env');
    expect(productionHarness).toContain('npm run check:notification-worker-smoke -- --dispatch');
    expect(productionHarness).toContain('npm run check:notification-production-evidence -- --require');
    expect(productionHarness).toContain('npm run check:admin-transfer-completion');
  });

  it('exposes a cross-repo local harness for the admin ownership transfer', () => {
    const crossRepoHarness = packageJson.scripts['harness:admin-transfer:local'];

    expect(crossRepoHarness).toEqual(expect.any(String));
    expect(crossRepoHarness).toContain('npm run harness:admin-boundary:local');
    expect(crossRepoHarness).toContain('pnpm --dir ../topik-project/v13 harness:admin-boundary');
  });
});
