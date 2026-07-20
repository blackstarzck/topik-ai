#!/usr/bin/env node

const EXPECTED = {
  SUPABASE_PROJECT_REF: 'eymlabowhfgtxbiqwxqh',
  SUPABASE_EXPECTED_PROJECT_REF: 'eymlabowhfgtxbiqwxqh',
  VERCEL_ORG_ID: 'team_cj4T9onVZ1Q3e6EOnwZSFycY',
  VERCEL_PROJECT_ID: 'prj_9LWe0OGPPHdjiJvH5isrBrshtOiY',
  PROD_ADMIN_DOMAIN: 'topik-admin.vercel.app',
  V13_CONTRACT_SHA: 'fb5fa73107034edacd698d364d7f97b7b1d6b0c7',
};

const REQUIRED_SECRETS = [
  'SUPABASE_ACCESS_TOKEN',
  'VERCEL_TOKEN',
  'E2E_ADMIN_EMAIL',
  'E2E_ADMIN_PASSWORD',
  'MIRROR_GITHUB_TOKEN',
];

const issues = [];
for (const [name, expected] of Object.entries(EXPECTED)) {
  const actual = process.env[name]?.trim();
  if (!actual) issues.push(`missing:${name}`);
  else if (actual !== expected) issues.push(`unexpected-value:${name}`);
}
for (const name of REQUIRED_SECRETS) {
  if (!process.env[name]?.trim()) issues.push(`missing-secret:${name}`);
}

if (process.env.GITHUB_REF && process.env.GITHUB_REF !== 'refs/heads/main') {
  issues.push('release-ref-must-be-main');
}

if (issues.length > 0) {
  for (const issue of issues) console.error(`[release-env] ${issue}`);
  process.exit(1);
}

console.log('Production release environment is complete and matches the locked targets.');
