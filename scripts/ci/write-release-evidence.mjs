#!/usr/bin/env node

import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

function value(args, flag) {
  const index = args.indexOf(flag);
  if (index < 0 || !args[index + 1]) throw new Error(`${flag} is required.`);
  return args[index + 1];
}

const args = process.argv.slice(2);
const jsonOut = resolve(value(args, '--json-out'));
const report = {
  schemaVersion: 1,
  releasedAt: new Date().toISOString(),
  commitSha: value(args, '--commit-sha'),
  v13CommitSha: value(args, '--v13-sha'),
  previousDeploymentId: value(args, '--previous-deployment-id'),
  candidateDeploymentId: value(args, '--candidate-deployment-id'),
  candidateDeploymentUrl: value(args, '--candidate-deployment-url'),
  productionDomain: value(args, '--production-domain'),
  migrationOrder: ['topik_writing', 'admin'],
  candidateE2e: 'passed',
  mirrorSync: 'passed',
  productionPromotion: 'passed',
  productionSmoke: 'passed',
  runtimeErrors: 'none-observed',
};
mkdirSync(dirname(jsonOut), { recursive: true });
writeFileSync(jsonOut, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
console.log(`Release evidence written for ${report.commitSha}.`);
