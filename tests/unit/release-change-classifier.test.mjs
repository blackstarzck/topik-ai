import { describe, expect, it } from 'vitest';
import {
  CLASSIFIER_VERSION,
  applyManualReleasePlan,
  classifyChangedFiles,
  parseNameStatus,
} from '../../scripts/ci/classify-release-change.mjs';

function classify(...paths) {
  return classifyChangedFiles(paths.map((path) => ({ status: 'M', path })));
}

function add(...paths) {
  return classifyChangedFiles(paths.map((path) => ({ status: 'A', path })));
}

describe('release change classifier v7', () => {
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

  // 삭제만으로도 blocked 가 됐던 회귀. gitignore 는 삭제하는 커밋을 구해주지 못한다.
  it('keeps Playwright run artifacts on the light path even when removed', () => {
    const removed = classifyChangedFiles([
      { status: 'D', path: 'test-results/.last-run.json' },
      { status: 'A', path: 'playwright-report/index.html' },
    ]);
    expect(removed.blockedReasons).toEqual([]);
    expect(removed.releasePlan).toBe('sync-only');
    expect(removed.validationProfile).toBe('light');
  });

  // v8: Phase 1 이 제거한 루트 스크래치 6개도 같은 함정을 밟지 않는다.
  // 정확한 파일명만 허용 — 다른 루트 신규 파일은 여전히 fail-closed 다.
  it('keeps retired root scratch files on the light path when removed', () => {
    const removed = classifyChangedFiles([
      { status: 'D', path: 'tmp_extract_strings.ps1' },
      { status: 'D', path: 'tmp_fix_korean_map.ps1' },
      { status: 'D', path: 'tmp_fix_korean_map2.ps1' },
      { status: 'D', path: 'preview4174.log' },
      { status: 'D', path: 'preview4176.log' },
      { status: 'D', path: 'preview4176.log.local-backup' },
    ]);
    expect(removed.blockedReasons).toEqual([]);
    expect(removed.releasePlan).toBe('sync-only');
    expect(removed.validationProfile).toBe('light');

    const stranger = classifyChangedFiles([{ status: 'D', path: 'tmp_other_scratch.ps1' }]);
    expect(stranger.releasePlan).toBe('blocked');
    expect(stranger.blockedReasons).toEqual(['unknown-path:tmp_other_scratch.ps1']);
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
      // v9: 이 repo 의 실제 lint 설정은 flat config 가 아니라 .eslintrc.cjs 다
      '.eslintrc.cjs',
      // v8: tsconfig 프로젝트는 이름을 열거하지 않는다 — 새로 추가한 프로젝트가
      // 'unknown' 으로 떨어져 릴리스를 blocked 시킨 사고가 있었다(PR #130).
      'tsconfig.json',
      'tsconfig.app.json',
      'tsconfig.node.json',
      'tsconfig.tests.json',
    ]) {
      const report = classify(path);
      expect(report.releasePlan, path).toBe('app-only');
      expect(report.deployApp, path).toBe(true);
      expect(report.applyMigrations, path).toBe(false);
      expect(report.validationProfile, path).toBe('app');
    }
  });

  it('still validates the control plane when the same change also touches app code', () => {
    // db-contract is the only job gated on the full profile, so an app touch used
    // to silently drop control-plane validation from a mixed change.
    for (const controlPlanePath of [
      '.github/workflows/ci.yml',
      'scripts/ci/classify-release-change.mjs',
      'scripts/db/manifests/writing-development-release.json',
      'scripts/db/migrate-core.mjs',
      'supabase/migrations-admin/down/20260721000000_example.sql',
      'playwright.release-admin.config.ts',
      'supabase/README.md',
    ]) {
      const report = classify('src/main.tsx', controlPlanePath);
      expect(report.validationProfile, controlPlanePath).toBe('full');
      // Escalating how hard we check must not change what the release ships.
      expect(report.releasePlan, controlPlanePath).toBe('app-only');
      expect(report.deployApp, controlPlanePath).toBe(true);
      expect(report.applyMigrations, controlPlanePath).toBe(false);
      expect(report.blockedReasons, controlPlanePath).toEqual([]);
    }
  });

  it('reproduces the mixed change that skipped db-contract on PR #58', () => {
    const report = classify(
      '.github/workflows/release-company-production.yml',
      'logs/admin-doc-update-log.md',
      'scripts/check-migration-ownership-boundary.mjs',
      'scripts/db/apply-v13-migration.mjs',
      'scripts/db/manifests/v13-shared-dev.json',
      'scripts/db/migrate-core.mjs',
      'src/main.tsx',
      'supabase/README.md',
      'tests/unit/apply-v13-migration.test.mjs'
    );
    expect(report.releasePlan).toBe('app-only');
    expect(report.validationProfile).toBe('full');
    expect(report.applyMigrations).toBe(false);
    expect(report.runUnit).toBe(true);
  });

  it('treats supabase/README.md as control plane despite being markdown', () => {
    // It is the single source of truth for the tracker separation, the runner
    // contract, and the boundary rules. pathKind() checks documentation before the
    // control-plane rule, so the generic markdown match used to shadow it.
    const alone = classify('supabase/README.md');
    expect(alone.releasePlan).toBe('sync-only');
    expect(alone.validationProfile).toBe('full');
    expect(alone.deployApp).toBe(false);
    expect(alone.applyMigrations).toBe(false);
    expect(alone.blockedReasons).toEqual([]);

    const mixed = classify('supabase/README.md', 'src/main.tsx');
    expect(mixed.releasePlan).toBe('app-only');
    expect(mixed.validationProfile).toBe('full');
    expect(mixed.applyMigrations).toBe(false);
  });

  it('leaves every other markdown file on the light path', () => {
    for (const path of [
      'AGENTS.md',
      '.claude/CLAUDE.md',
      'MOVED_DOCS.md',
      'docs/architecture/shared-supabase-schema-ownership.md',
      'logs/admin-doc-update-log.md',
      // Inside the otherwise control-plane .github/ tree, but a PR template
      // carries no validation contract, so escalating it would only cost time.
      '.github/pull_request_template.md',
    ]) {
      const report = classify(path);
      expect(report.releasePlan, path).toBe('sync-only');
      expect(report.validationProfile, path).toBe('light');
      expect(report.blockedReasons, path).toEqual([]);
    }
  });

  it('keeps a migration manifest edit out of the migration-applying plans', () => {
    // The manifest declares which migrations a batch releases; editing it must
    // raise validation without telling the pipeline to apply anything.
    const report = classify('scripts/db/manifests/admin-production-cutover.json');
    expect(report.releasePlan).toBe('sync-only');
    expect(report.validationProfile).toBe('full');
    expect(report.applyMigrations).toBe(false);
    expect(report.deployApp).toBe(false);
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

  it('routes a declared unapplied migration rewrite through the db-only path', () => {
    const path = 'supabase/migrations-admin/20260721000000_example.sql';
    const allowedRewrites = new Set([path]);

    const report = classifyChangedFiles([{ status: 'M', path }], { allowedRewrites });
    expect(report.releasePlan).toBe('db-only');
    expect(report.applyMigrations).toBe(true);
    expect(report.validationProfile).toBe('full');
    expect(report.blockedReasons).toEqual([]);
  });

  it('still blocks migration edits that are not declared as unapplied rewrites', () => {
    const path = 'supabase/migrations-admin/20260721000000_example.sql';
    const report = classifyChangedFiles(
      [{ status: 'M', path }],
      { allowedRewrites: new Set(['supabase/migrations-admin/20260101000000_other.sql']) }
    );
    expect(report.releasePlan).toBe('blocked');
    expect(report.blockedReasons).toEqual([`immutable-migration:${path}`]);
  });

  it('never allows deleting or renaming a migration even when declared as a rewrite', () => {
    const path = 'supabase/migrations-admin/20260721000000_example.sql';
    const allowedRewrites = new Set([path]);

    expect(classifyChangedFiles([{ status: 'D', path }], { allowedRewrites }).releasePlan)
      .toBe('blocked');
    expect(classifyChangedFiles([{
      status: 'R100',
      previousPath: path,
      path: 'supabase/migrations-admin/20260721000000_renamed.sql',
    }], { allowedRewrites }).releasePlan).toBe('blocked');
  });

  it('blocks unknown paths and invalid base ranges instead of releasing them', () => {
    expect(classify('unknown-root.config').releasePlan).toBe('blocked');
    const forced = classifyChangedFiles([], { forcedReason: 'zero-base-sha' });
    expect(forced.releasePlan).toBe('blocked');
    expect(forced.blockedReasons).toEqual(['zero-base-sha']);
  });

  it('allows only an explicit app-db replay of a non-blocked latest main', () => {
    const automatic = classifyChangedFiles([]);
    const manual = applyManualReleasePlan(automatic, 'app-db');
    expect(manual.automaticReleasePlan).toBe('sync-only');
    expect(manual.releasePlan).toBe('app-db');
    expect(manual.deployApp).toBe(true);
    expect(manual.applyMigrations).toBe(true);
    expect(manual.validationProfile).toBe('full');
    expect(manual.manualRelease).toBe(true);

    expect(() => applyManualReleasePlan(automatic, 'app-only'))
      .toThrow('Unsupported manual release plan');
    const blocked = classifyChangedFiles([], { forcedReason: 'unresolved-git-sha:test' });
    expect(() => applyManualReleasePlan(blocked, 'app-db'))
      .toThrow('A blocked change cannot be manually released');
  });


  it('routes the adopted v13 learner archive to control-plane, not unknown', () => {
    // Every archived file used to land on 'unknown', which blocked the PR that
    // adopted them. They must raise the validation profile without claiming the
    // release pipeline applies them — the release manifest has no learner
    // namespace until M5b.
    const archive = add(
      'supabase/migrations-v13/20260520120000_extensions_and_schemas.sql',
      'supabase/migrations-v13/down/20260707120000_pdf_export_quota.sql',
    );
    expect(archive.blockedReasons).toEqual([]);
    expect(archive.releasePlan).toBe('sync-only');
    expect(archive.validationProfile).toBe('full');
    expect(archive.applyMigrations).toBe(false);
  });

  it('does not let the archive turn an app change into a database release', () => {
    const mixed = classify(
      'src/app/page.tsx',
      'supabase/migrations-v13/20260729120000_list_user_problems_canonical_catalog_fix.sql',
    );
    expect(mixed.releasePlan).toBe('app-only');
    expect(mixed.validationProfile).toBe('full');
  });

  it('still routes the two release-managed namespaces to migration', () => {
    const managed = add(
      'supabase/migrations/20260801000000_x.sql',
      'supabase/migrations-admin/20260801000000_y.sql',
    );
    expect(managed.releasePlan).toBe('db-only');
    expect(managed.applyMigrations).toBe(true);
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
