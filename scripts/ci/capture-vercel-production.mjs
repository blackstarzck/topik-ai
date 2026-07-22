#!/usr/bin/env node

import { appendFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

function value(args, flag) {
  const index = args.indexOf(flag);
  if (index < 0 || !args[index + 1]) throw new Error(`${flag} is required.`);
  return args[index + 1];
}

const args = process.argv.slice(2);
const domain = value(args, '--domain');
const lookup = domain.replace(/^https?:\/\//, '').replace(/\/$/, '');
const teamId = value(args, '--team-id');
const jsonOut = resolve(value(args, '--json-out'));
const token = process.env.VERCEL_TOKEN;
if (!token) throw new Error('VERCEL_TOKEN is required.');

const response = await fetch(
  `https://api.vercel.com/v13/deployments/${encodeURIComponent(lookup)}?teamId=${encodeURIComponent(teamId)}`,
  { headers: { Authorization: `Bearer ${token}` } }
);
if (!response.ok) {
  throw new Error(`Unable to resolve current production deployment (${response.status}).`);
}
const deployment = await response.json();
const deploymentId = deployment.id ?? deployment.uid;
if (!deploymentId || !deployment.url) {
  throw new Error('Current production deployment response is missing id or url.');
}

const report = {
  schemaVersion: 1,
  capturedAt: new Date().toISOString(),
  domain,
  deploymentId,
  deploymentUrl: `https://${deployment.url}`,
  readyState: deployment.readyState ?? null,
  sourceCommitSha: deployment.meta?.githubCommitSha ?? null,
};
mkdirSync(dirname(jsonOut), { recursive: true });
writeFileSync(jsonOut, `${JSON.stringify(report, null, 2)}\n`, 'utf8');

if (process.env.GITHUB_OUTPUT) {
  appendFileSync(
    process.env.GITHUB_OUTPUT,
    `deployment_id=${report.deploymentId}\ndeployment_url=${report.deploymentUrl}\n`,
    'utf8'
  );
}
console.log(`Captured production deployment ${report.deploymentId}.`);
