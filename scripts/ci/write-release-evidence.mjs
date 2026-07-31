#!/usr/bin/env node

import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

function value(args, flag, { required = true } = {}) {
  const index = args.indexOf(flag);
  if (index < 0 || !args[index + 1]) {
    if (!required) return null;
    throw new Error(`${flag} is required.`);
  }
  return args[index + 1];
}

const args = process.argv.slice(2);
const jsonOut = resolve(value(args, '--json-out'));
const releasePlan = value(args, '--release-plan');
if (!['app-only', 'db-only', 'app-db'].includes(releasePlan)) {
  throw new Error('--release-plan must be app-only, db-only, or app-db.');
}
const deployApp = releasePlan === 'app-only' || releasePlan === 'app-db';
const applyMigrations = releasePlan === 'db-only' || releasePlan === 'app-db';
const deploymentFields = {
  previousDeploymentId: value(args, '--previous-deployment-id', { required: deployApp }),
  candidateDeploymentId: value(args, '--candidate-deployment-id', { required: deployApp }),
  candidateDeploymentUrl: value(args, '--candidate-deployment-url', { required: deployApp }),
};
const report = {
  schemaVersion: 3,
  releasedAt: new Date().toISOString(),
  releasePlan,
  deployApp,
  applyMigrations,
  commitSha: value(args, '--commit-sha'),
  productionDomain: value(args, '--production-domain'),
  ...deploymentFields,
  migrationOrder: ['topik_writing', 'admin'],
  migrationApplication: applyMigrations ? 'passed' : 'not-required',
  oldAppPostMigrationSmoke: applyMigrations ? 'passed' : 'not-required',
  candidateE2e: deployApp ? 'passed' : 'not-required',
  mirrorSync: 'passed',
  productionPromotion: deployApp ? 'passed' : 'not-required',
  productionSmoke: 'passed',
  runtimeErrors: deployApp ? 'none-observed' : 'not-required',
};
mkdirSync(dirname(jsonOut), { recursive: true });
writeFileSync(jsonOut, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
console.log(`Release evidence written for ${report.commitSha} (${report.releasePlan}).`);
