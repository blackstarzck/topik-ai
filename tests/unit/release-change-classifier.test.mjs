import { describe, expect, it } from 'vitest';
import {
  CLASSIFIER_VERSION,
  classifyChangedFiles,
  parseNameStatus,
} from '../../scripts/ci/classify-release-change.mjs';

function classify(...paths) {
  return classifyChangedFiles(paths.map((path) => ({ status: 'M', path })));
}

function add(...paths) {
  return classifyChangedFiles(paths.map((path) => ({ status: 'A', path })));
}

describe('release change classifier v2', () => {
  it('keeps documentation and offline tests on the light sync-only path', () => {
    const docs = classify('docs/architecture/admin-cicd-pipeline.md', 'AGENTS.md');
    expect(docs.releasePlan).toBe('sync-only');
    expect(docs.validationProfile).toBe('light');
    expect(docs.deployApp).toBe(false);
    expect(docs.applyMigrations).toBe(false);

    const tests = classify('tests/unit/example.test.ts', 'tests/e2e/example.spec.ts');
    expect(tests.releasePlan).toBe('sync-only');
    expect(tests.runUnit).toBe(true);
    expect(tests.runE2e).toBe(true);
  });

  it('strongly validates release control-plane changes without releasing', () => {
    for (const path of [
      '.github/workflows/ci.yml',
      'scripts/ci/run-release-e2e.mjs',
      'scripts/db/migrate.mjs',
      'tests/live-e2e/prod-admin-readonly.pw.ts',
      '.env.example',
      'playwright.release-admin.config.ts',
      'supabase/migrations-admin/down/20260721000000_example.sql',
    ]) {
      const report = classify(path);
      expect(report.releasePlan, path).toBe('sync-only');
      expect(report.validationProfile, path).toBe('full');
    }
  });

  it('routes runtime code and build inputs through the app-only path', () => {
    for (const path of [
      'src/features/users/pages/users-page.tsx',
      'src/features/users/api/users-service.ts',
      'api/admin/invite.ts',
      'public/logo.svg',
      'package-lock.json',
      'vercel.json',
    ]) {
      const report = classify(path);
      expect(report.releasePlan, path).toBe('app-only');
      expect(report.deployApp, path).toBe(true);
      expect(report.applyMigrations, path).toBe(false);
      expect(report.validationProfile, path).toBe('app');
    }
  });

  it('routes a newly added forward migration through the db-only path', () => {
    const report = add('supabase/migrations-admin/20260721000000_example.sql');
    expect(report.releasePlan).toBe('db-only');
    expect(report.deployApp).toBe(false);
    expect(report.applyMigrations).toBe(true);
    expect(report.validationProfile).toBe('full');
  });

  it('uses app-db only when runtime code and a new migration are both present', () => {
    const report = classifyChangedFiles([
      { status: 'M', path: 'src/features/users/api/users-service.ts' },
      { status: 'A', path: 'supabase/migrations-admin/20260721000000_example.sql' },
    ]);
    expect(report.releasePlan).toBe('app-db');
    expect(report.deployApp).toBe(true);
    expect(report.applyMigrations).toBe(true);
  });

  it('blocks edits, deletion, and rename of forward migration history', () => {
    expect(classify('supabase/migrations/20260721000000_example.sql').releasePlan)
      .toBe('blocked');
    expect(classifyChangedFiles([{
      status: 'D',
      path: 'supabase/migrations-admin/20260721000000_example.sql',
    }]).releasePlan).toBe('blocked');
    expect(classifyChangedFiles([{
      status: 'R100',
      previousPath: 'supabase/migrations-admin/20260721000000_old.sql',
      path: 'supabase/migrations-admin/20260721000000_new.sql',
    }]).releasePlan).toBe('blocked');
  });

  it('blocks unknown paths and invalid base ranges instead of releasing them', () => {
    expect(classify('unknown-root.config').releasePlan).toBe('blocked');
    const forced = classifyChangedFiles([], { forcedReason: 'zero-base-sha' });
    expect(forced.releasePlan).toBe('blocked');
    expect(forced.blockedReasons).toEqual(['zero-base-sha']);
  });

  it('produces a stable digest independent of git output order', () => {
    const left = classify('docs/a.md', 'tests/unit/a.test.ts');
    const right = classify('tests/unit/a.test.ts', 'docs/a.md');
    expect(left.changedFilesDigest).toBe(right.changedFilesDigest);
    expect(left.classifierVersion).toBe(CLASSIFIER_VERSION);
  });

  it('parses modified, deleted, and renamed git name-status records', () => {
    expect(parseNameStatus('M\0src/a.ts\0D\0src/b.ts\0R100\0src/c.ts\0src/d.ts\0'))
      .toEqual([
        { status: 'M', path: 'src/a.ts' },
        { status: 'D', path: 'src/b.ts' },
        { status: 'R100', previousPath: 'src/c.ts', path: 'src/d.ts' },
      ]);
  });
});
