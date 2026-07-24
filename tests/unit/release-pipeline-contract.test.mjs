import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const ciWorkflow = readFileSync(resolve('.github/workflows/ci.yml'), 'utf8');
const developmentWorkflow = readFileSync(
  resolve('.github/workflows/release-development.yml'),
  'utf8'
);
const productionWorkflow = readFileSync(
  resolve('.github/workflows/release-production.yml'),
  'utf8'
);
const healthWorkflow = readFileSync(
  resolve('.github/workflows/database-health.yml'),
  'utf8'
);

function position(workflow, text) {
  const index = workflow.indexOf(text);
  expect(index, `${text} must exist in the workflow`).toBeGreaterThan(-1);
  return index;
}

function job(workflow, name, nextName = null) {
  const start = position(workflow, `\n  ${name}:`);
  const end = nextName ? position(workflow, `\n  ${nextName}:`) : workflow.length;
  return workflow.slice(start, end);
}

describe('four-path release pipeline contract', () => {
  it('always exposes one PR gate and blocks unknown changes', () => {
    expect(ciWorkflow).toContain('name: classify');
    expect(ciWorkflow).toContain('name: blocked-validation');
    expect(ciWorkflow).toContain('name: light-validation');
    expect(ciWorkflow).toContain('name: quality');
    expect(ciWorkflow).toContain('name: db-contract');
    expect(ciWorkflow).toContain('name: browser-e2e');
    expect(ciWorkflow).toContain('name: ci-gate');
    expect(ciWorkflow).toContain('blocked:full)');
    expect(ciWorkflow).not.toMatch(/\n\s+paths(?:-ignore)?:/);
    expect(ciWorkflow).not.toContain('environment: development');
    expect(ciWorkflow).not.toContain('environment: Production');
    expect(ciWorkflow).not.toContain('SUPABASE_ACCESS_TOKEN: ${{ secrets.');
  });

  it('runs light and strong sync-only validation without a hosted release', () => {
    const sync = job(developmentWorkflow, 'validate-sync', 'validate-app');
    expect(sync).toContain('npm run harness:docs');
    expect(sync).toContain("validation_profile == 'full'");
    expect(sync).toContain('npm run db:shadow:verify');
    expect(sync).toContain('--release-plan sync-only');
    expect(sync).not.toContain('environment: development');
    expect(sync).not.toContain('--apply');
    expect(sync).not.toContain('vercel');
  });

  it('keeps app-only validation read-only against topik-dev', () => {
    const app = job(developmentWorkflow, 'validate-app', 'validate-database');
    expect(app).toContain('environment: development');
    expect(app).toContain('Verify topik-dev tracker and permission drift without applying migrations');
    expect(app).toContain('--verify-all --require-clean');
    expect(app).toContain('db:users-contract');
    expect(app).toContain('--suite operational-smoke');
    expect(app).toContain('--release-plan app-only');
    expect(app).not.toContain('--apply');
    expect(app).not.toContain('db:shadow:verify');
  });

  it('migrates and fully verifies topik-dev for db-only and app-db', () => {
    const database = job(developmentWorkflow, 'validate-database', 'development-gate');
    const shadow = position(database, 'Rebuild the pinned cross-repository shadow schema');
    const migration = position(database, 'Apply topik-dev migrations in ownership order');
    const contract = position(database, 'Verify topik-dev trackers, Users schema, and permissions');
    const browser = position(
      database,
      'Verify topik-dev CRUD and browser flows with the configured administrator'
    );
    const evidence = position(database, 'Write the PII-free database development evidence');
    expect(shadow).toBeLessThan(migration);
    expect(migration).toBeLessThan(contract);
    expect(contract).toBeLessThan(browser);
    expect(browser).toBeLessThan(evidence);
    expect(database).toContain("release_plan == 'db-only'");
    expect(database).toContain("release_plan == 'app-db'");
    expect(database).toContain('--suite full');
  });

  it('queues main releases and starts Production only from successful development evidence', () => {
    expect(developmentWorkflow).toContain('queue: max');
    expect(productionWorkflow).toContain('queue: max');
    expect(productionWorkflow).toContain('workflow_run:');
    expect(productionWorkflow).toContain('workflows: [Validate development]');
    expect(productionWorkflow).toContain(
      "if: ${{ github.repository == 'blackstarzck/topik-ai' && github.event.workflow_run.conclusion == 'success' }}"
    );
    expect(productionWorkflow).toContain(
      'RELEASE_SHA: ${{ github.event.workflow_run.head_sha }}'
    );
    expect(productionWorkflow).toContain('verify-development-evidence.mjs');
    expect(productionWorkflow).not.toMatch(/on:\s*\n\s+push:/);
  });

  it('allows a confirmed app-db replay only from the latest main workflow', () => {
    expect(developmentWorkflow).toContain('workflow_dispatch:');
    expect(developmentWorkflow).toContain('production_confirmation:');
    expect(developmentWorkflow).toContain('test "$GITHUB_REF" = refs/heads/main');
    expect(developmentWorkflow).toContain('test "$PRODUCTION_CONFIRMATION" = topik-prod');
    expect(developmentWorkflow).toContain('--manual-release-plan "$MANUAL_RELEASE_PLAN"');
    expect(developmentWorkflow).toContain('- app-db');
    expect(productionWorkflow).not.toContain('workflow_dispatch:');
  });

  it('mirrors validated code and treats an older run as superseded', () => {
    const mirror = job(productionWorkflow, 'mirror', 'release-database-only');
    expect(mirror).toContain('https://github.com/keduall/topik-admin.git');
    expect(mirror).toContain('MIRROR_GITHUB_TOKEN: ${{ secrets.MIRROR_GITHUB_TOKEN }}');
    expect(mirror).toContain('persist-credentials: false');
    expect(mirror).toContain('disposition=superseded');
    expect(mirror).toContain('Company mirror has diverged');
  });

  it('runs db-only Production without building or promoting Vercel', () => {
    const database = job(productionWorkflow, 'release-database-only', 'release-app');
    const browserInstall = position(
      database,
      'Install Chromium for Production browser verification'
    );
    const currentApp = position(
      database,
      'Verify the current Production app before the database change'
    );
    expect(database).toContain("release_plan == 'db-only'");
    expect(browserInstall).toBeLessThan(currentApp);
    expect(database).toContain('npx playwright install --with-deps chromium');
    expect(database).toContain('Apply topik-prod expand migrations in ownership order');
    expect(database).toContain('Verify the unchanged Production app after the database change');
    expect(database).toContain('--release-plan db-only');
    expect(database).not.toContain('VERCEL_TOKEN');
    expect(database).not.toContain('vercel build');
    expect(database).not.toContain('vercel deploy');
    expect(database).not.toContain('vercel promote');
  });

  it('builds and promotes Vercel only for app-only and app-db releases', () => {
    const app = job(productionWorkflow, 'release-app');
    expect(app).toContain("release_plan == 'app-only'");
    expect(app).toContain("release_plan == 'app-db'");
    const browserInstall = position(
      app,
      'Install Chromium for Production browser verification'
    );
    const bypassGate = position(app, 'Require the candidate browser bypass secret');
    const candidate = position(app, 'Build an unaliased Production candidate');
    const currentApp = position(
      app,
      'Verify the current Production app before any database change'
    );
    const migration = position(app, 'Apply topik-prod expand migrations for an app-db release');
    const oldApp = position(app, 'Verify the old Production app after an app-db migration');
    const candidateE2e = position(app, 'Verify the candidate with the configured administrator account');
    const promote = position(app, 'Promote the verified candidate without rebuilding');
    expect(browserInstall).toBeLessThan(currentApp);
    expect(app).toContain('npx playwright install --with-deps chromium');
    expect(bypassGate).toBeLessThan(candidate);
    expect(candidate).toBeLessThan(currentApp);
    expect(currentApp).toBeLessThan(migration);
    expect(migration).toBeLessThan(oldApp);
    expect(oldApp).toBeLessThan(candidateE2e);
    expect(candidateE2e).toBeLessThan(promote);
    expect(app).toContain('--skip-domain');
    expect(app).toContain("apply_migrations == 'true'");

    const jobEnvironment = app.slice(0, position(app, '    steps:'));
    const candidateVerification = app.slice(candidateE2e, promote);
    const productionVerification = app.slice(
      promote,
      position(app, 'Write the PII-free app release summary')
    );
    expect(jobEnvironment).not.toContain('VERCEL_AUTOMATION_BYPASS_SECRET');
    expect(candidateVerification).toContain(
      'VERCEL_AUTOMATION_BYPASS_SECRET: ${{ secrets.VERCEL_AUTOMATION_BYPASS_SECRET }}'
    );
    expect(productionVerification).not.toContain('VERCEL_AUTOMATION_BYPASS_SECRET');
    expect(app).not.toMatch(/echo.*\$VERCEL_AUTOMATION_BYPASS_SECRET/);
  });

  it('retains verified app rollback and never runs automatic down migrations', () => {
    expect(productionWorkflow).toContain(
      "if: always() && steps.promote.outcome == 'success' && steps.production_smoke.outcome == 'failure'"
    );
    expect(productionWorkflow).toContain(
      'vercel rollback "${{ steps.previous.outputs.deployment_id }}"'
    );
    expect(productionWorkflow).toContain(
      'Rollback verification did not restore the previous deployment.'
    );
    expect(developmentWorkflow).not.toMatch(/--down\b/);
    expect(productionWorkflow).not.toMatch(/--down\b/);
  });

  it('runs nightly full shadow and read-only drift without deploying or mutating DBs', () => {
    expect(healthWorkflow).toContain('schedule:');
    expect(healthWorkflow).toContain('name: full-shadow-replay');
    expect(healthWorkflow).toContain('name: topik-dev-readonly-drift');
    expect(healthWorkflow).toContain('name: topik-prod-readonly-drift');
    expect(healthWorkflow).toContain('db:shadow:verify');
    expect(healthWorkflow).toContain('--verify-all --require-clean');
    expect(healthWorkflow).toContain('--expected-fingerprint-file');
    expect(healthWorkflow).not.toContain('--apply');
    expect(healthWorkflow).not.toContain('vercel deploy');
    expect(healthWorkflow).not.toContain('vercel promote');
  });
});

describe('evidence v4 source binding contract', () => {
  it('captures the source tree and migration digest in every development evidence write', () => {
    const treeCaptures = developmentWorkflow.match(
      /--source-tree-sha "\$\(git rev-parse "\$GITHUB_SHA\^\{tree\}"\)"/g
    ) ?? [];
    expect(treeCaptures).toHaveLength(3);
    const digestCaptures = developmentWorkflow.match(
      /--migration-digest "\$\(node scripts\/ci\/compute-migration-digest\.mjs\)"/g
    ) ?? [];
    expect(digestCaptures).toHaveLength(3);
  });

  it('replays the previous release schema before applying migrations to topik-dev', () => {
    const database = job(developmentWorkflow, 'validate-database', 'development-gate');
    const shadowIndex = position(database, 'Rebuild the pinned cross-repository shadow schema');
    const upgradeIndex = position(database, 'Replay the previous release schema and upgrade it to this migration set');
    const applyIndex = position(database, 'Apply topik-dev migrations in ownership order');
    expect(shadowIndex).toBeLessThan(upgradeIndex);
    expect(upgradeIndex).toBeLessThan(applyIndex);
    expect(database).toContain('node scripts/ci/resolve-previous-release.mjs');
    expect(database).toContain('--upgrade-from "$previous_release"');
    expect(database).toContain('development-evidence/upgrade-replay.json');
    expect(database).toContain('COMPANY_RELEASE_READ_TOKEN: ${{ secrets.PROMOTION_GITHUB_TOKEN }}');
    expect(database).toContain('UPGRADE_REPLAY_BASE_OVERRIDE: ${{ vars.UPGRADE_REPLAY_BASE_OVERRIDE }}');
  });

  it('recomputes and compares the tree and migration digest in every production verify', () => {
    const treeChecks = productionWorkflow.match(
      /--tree-sha "\$\(git rev-parse "HEAD\^\{tree\}"\)"/g
    ) ?? [];
    expect(treeChecks).toHaveLength(3);
    const digestChecks = productionWorkflow.match(
      /--migration-digest "\$\(node scripts\/ci\/compute-migration-digest\.mjs\)"/g
    ) ?? [];
    expect(digestChecks).toHaveLength(3);
  });
});

const promotionWorkflow = readFileSync(resolve('.github/workflows/release-promotion.yml'), 'utf8');
const gateWorkflow = readFileSync(resolve('.github/workflows/promotion-gate.yml'), 'utf8');
const companyStgWorkflow = readFileSync(
  resolve('.github/workflows/release-company-stg.yml'),
  'utf8'
);
const companyProductionWorkflow = readFileSync(
  resolve('.github/workflows/release-company-production.yml'),
  'utf8'
);

describe('company promotion pipeline contract', () => {
  it('promotes only validated sources and holds while the legacy path is active', () => {
    expect(promotionWorkflow).toContain('workflows: [Validate development]');
    expect(promotionWorkflow).toContain("github.event.workflow_run.conclusion == 'success'");
    expect(promotionWorkflow).toContain('actions/workflows/release-production.yml');
    expect(promotionWorkflow).toContain("steps.interlock.outputs.legacy_state != 'active'");
    expect(promotionWorkflow).toContain('$RELEASE_SHA:refs/heads/promote/$RELEASE_SHA');
    expect(promotionWorkflow).toContain('--base stg --head "promote/$RELEASE_SHA"');
    expect(promotionWorkflow).toContain('--tree-sha "$(git rev-parse "HEAD^{tree}")"');
    expect(promotionWorkflow).toContain('PROMOTION_GITHUB_TOKEN');
    expect(promotionWorkflow).not.toContain('vercel');
    expect(promotionWorkflow).not.toContain('--apply');
  });

  it('gates stg and main promotions with drift checks and a blackstarzck attestation', () => {
    expect(gateWorkflow).toContain('branches: [stg, main]');
    expect(gateWorkflow).toContain('node scripts/ci/company-promotion-gate.mjs');
    expect(gateWorkflow).toContain('EVIDENCE_GITHUB_TOKEN: ${{ secrets.EVIDENCE_GITHUB_TOKEN }}');
    expect(gateWorkflow).toContain('ATTESTATION_GITHUB_TOKEN: ${{ secrets.ATTESTATION_GITHUB_TOKEN }}');
    // A main-targeted PR reads the company staging-evidence artifact through the
    // GITHUB_TOKEN REST API, which requires the actions:read permission scope.
    expect(gateWorkflow).toContain('actions: read');
    expect(gateWorkflow).toContain('--approve');
    expect(gateWorkflow).not.toContain('--apply');
    expect(gateWorkflow).not.toContain('vercel');
  });

  it('reuses topik-dev on stg without applying migrations', () => {
    expect(companyStgWorkflow).toContain('branches: [stg]');
    expect(companyStgWorkflow).toContain('environment: staging');
    expect(companyStgWorkflow).toContain('node scripts/ci/write-stg-evidence.mjs');
    expect(companyStgWorkflow).toContain('--verify-all --require-clean');
    expect(companyStgWorkflow).toContain('staging-evidence-${{ env.STG_SHA }}');
    // Every write-stg-evidence invocation (verify-source and write) reads the
    // source-repository evidence, so each step must map the read token or it
    // fails at runtime — pin both occurrences to prevent that regression.
    expect(
      companyStgWorkflow.split('EVIDENCE_GITHUB_TOKEN: ${{ secrets.EVIDENCE_GITHUB_TOKEN }}').length - 1,
    ).toBeGreaterThanOrEqual(2);
    expect(companyStgWorkflow).not.toContain('--apply');
    expect(companyStgWorkflow).not.toContain('db:shadow:verify');
  });

  it('re-verifies the full promotion contract before any production mutation', () => {
    const verify = job(companyProductionWorkflow, 'verify', 'release-database-only');
    expect(verify).toContain('node scripts/ci/verify-company-release.mjs');
    expect(verify).not.toContain('--apply');
    expect(verify).not.toContain('vercel');

    const database = job(companyProductionWorkflow, 'release-database-only', 'release-app');
    expect(database).toContain('needs: verify');
    const dbPreflight = position(database, 'Compare topik-prod trackers read-only before any mutation');
    const dbApply = position(database, 'Apply topik-prod expand migrations in ownership order');
    expect(dbPreflight).toBeLessThan(dbApply);
    expect(database).not.toContain('vercel build');

    const app = job(companyProductionWorkflow, 'release-app');
    expect(app).toContain('needs: verify');
    expect(app).toContain('VITE_RELEASE_SHA: ${{ needs.verify.outputs.source_sha }}');
    const appPreflight = position(app, 'Compare topik-prod trackers read-only before any mutation');
    const appApply = position(app, 'Apply topik-prod expand migrations for an app-db release');
    const promote = position(app, 'Promote the verified candidate without rebuilding');
    expect(appPreflight).toBeLessThan(appApply);
    expect(appApply).toBeLessThan(promote);
    expect(app).toContain('Roll back the Production alias when post-promotion checks fail');
  });
});

describe('repository execution guards', () => {
  const SOURCE_GUARD = "github.repository == 'blackstarzck/topik-ai'";
  const COMPANY_GUARD = "github.repository == 'keduall/topik-admin'";
  const workflows = [
    ['ci.yml', ciWorkflow, SOURCE_GUARD],
    ['release-development.yml', developmentWorkflow, SOURCE_GUARD],
    ['release-production.yml', productionWorkflow, SOURCE_GUARD],
    ['database-health.yml', healthWorkflow, SOURCE_GUARD],
    ['release-promotion.yml', promotionWorkflow, SOURCE_GUARD],
    ['promotion-gate.yml', gateWorkflow, COMPANY_GUARD],
    ['release-company-stg.yml', companyStgWorkflow, COMPANY_GUARD],
    ['release-company-production.yml', companyProductionWorkflow, COMPANY_GUARD],
  ];

  function jobEntries(workflow) {
    const jobsIndex = position(workflow, '\njobs:');
    const body = workflow.slice(jobsIndex + '\njobs:'.length);
    const headings = [...body.matchAll(/^  ([A-Za-z][\w-]*):[ \t]*\r?\n/gm)];
    expect(headings.length).toBeGreaterThan(0);
    return headings.map((heading, index) => ({
      id: heading[1],
      block: body.slice(heading.index, headings[index + 1]?.index ?? body.length),
    }));
  }

  it('guards every job so mirrored workflow copies never run outside their home repository', () => {
    for (const [name, workflow, expectedGuard] of workflows) {
      for (const { id, block } of jobEntries(workflow)) {
        expect(block, `${name}#${id} must guard on github.repository`).toContain(expectedGuard);
      }
    }
  });

  it('keeps result gates evaluating after failures alongside the repository guard', () => {
    expect(job(ciWorkflow, 'ci-gate')).toContain(`${SOURCE_GUARD} && always()`);
    expect(job(developmentWorkflow, 'development-gate')).toContain(
      `${SOURCE_GUARD} && always()`
    );
  });
});
