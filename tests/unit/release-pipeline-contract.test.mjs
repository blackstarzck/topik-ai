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

function position(workflow, text) {
  const index = workflow.indexOf(text);
  expect(index, `${text} must exist in the workflow`).toBeGreaterThan(-1);
  return index;
}

describe('development-first release pipeline contract', () => {
  it('keeps PR checks offline from hosted development and production targets', () => {
    expect(ciWorkflow).toContain('name: quality');
    expect(ciWorkflow).toContain('name: db-contract');
    expect(ciWorkflow).toContain('name: browser-e2e');
    expect(ciWorkflow).toContain('Rebuild the v13, writing, and admin schema in shadow Supabase');
    expect(ciWorkflow).not.toContain('environment: development');
    expect(ciWorkflow).not.toContain('environment: production');
    expect(ciWorkflow).not.toContain('SUPABASE_ACCESS_TOKEN: ${{ secrets.');
  });

  it('migrates and verifies topik-dev before writing transferable evidence', () => {
    const migration = position(
      developmentWorkflow,
      'Apply topik-dev migrations in ownership order'
    );
    const contract = position(
      developmentWorkflow,
      'Verify topik-dev trackers, Users schema, and permissions'
    );
    const browser = position(
      developmentWorkflow,
      'Verify topik-dev CRUD and browser flows with the configured administrator'
    );
    const evidence = position(
      developmentWorkflow,
      'Write the PII-free development evidence'
    );
    expect(migration).toBeLessThan(contract);
    expect(contract).toBeLessThan(browser);
    expect(browser).toBeLessThan(evidence);
    expect(developmentWorkflow).toContain('environment: development');
    expect(developmentWorkflow).toContain('writing-development-release.json');
    expect(developmentWorkflow).toContain('--target development');
  });

  it('starts Production only from the successful development workflow SHA', () => {
    expect(productionWorkflow).toContain('workflow_run:');
    expect(productionWorkflow).toContain('workflows: [Validate development]');
    expect(productionWorkflow).toContain(
      "if: github.event.workflow_run.conclusion == 'success'"
    );
    expect(productionWorkflow).toContain(
      'RELEASE_SHA: ${{ github.event.workflow_run.head_sha }}'
    );
    expect(productionWorkflow).toContain('development-evidence-${{ env.RELEASE_SHA }}');
    expect(productionWorkflow).toContain('verify-development-evidence.mjs');
    expect(productionWorkflow).not.toMatch(/on:\s*\n\s+push:/);
  });

  it('fast-forwards the mirror before topik-prod and promotes only after candidate E2E', () => {
    const mirror = position(
      productionWorkflow,
      'Fast-forward the development-verified SHA to the private deployment mirror'
    );
    const migrations = position(
      productionWorkflow,
      'Apply topik-prod expand migrations in ownership order'
    );
    const candidateE2e = position(
      productionWorkflow,
      'Verify the candidate with the configured administrator account'
    );
    const promote = position(
      productionWorkflow,
      'Promote the verified candidate without rebuilding'
    );
    expect(mirror).toBeLessThan(migrations);
    expect(migrations).toBeLessThan(candidateE2e);
    expect(candidateE2e).toBeLessThan(promote);
    expect(productionWorkflow).toContain('--skip-domain');
    expect(productionWorkflow).not.toContain('--token');
    expect(productionWorkflow).toContain(
      'JSON.stringify({token:process.env.VERCEL_TOKEN})'
    );
  });

  it('uses a repository-scoped token for the mirror and retains verified rollback', () => {
    expect(productionWorkflow).toContain(
      'MIRROR_GITHUB_TOKEN: ${{ secrets.MIRROR_GITHUB_TOKEN }}'
    );
    expect(productionWorkflow).toContain(
      'GIT_ASKPASS="$RUNNER_TEMP/github-mirror-askpass.sh"'
    );
    expect(productionWorkflow).toContain('https://github.com/keduall/topik-admin.git');
    expect(productionWorkflow).not.toContain('MIRROR_DEPLOY_KEY');
    expect(productionWorkflow).not.toContain('ssh-keyscan');
    expect(productionWorkflow).toContain(
      "if: always() && steps.promote.outcome == 'success' && steps.production_smoke.outcome == 'failure'"
    );
    expect(productionWorkflow).toContain(
      'vercel rollback "${{ steps.previous.outputs.deployment_id }}"'
    );
    expect(productionWorkflow).toContain(
      'Rollback verification did not restore the previous deployment.'
    );
  });
});
