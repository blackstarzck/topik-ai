#!/usr/bin/env node

const COMMON_EXPECTED = {
  SUPABASE_PROJECT_REF: 'eymlabowhfgtxbiqwxqh',
  SUPABASE_EXPECTED_PROJECT_REF: 'eymlabowhfgtxbiqwxqh',
  PROD_ADMIN_DOMAIN: 'topik-admin.vercel.app',
};

const APP_EXPECTED = {
  VERCEL_ORG_ID: 'team_cj4T9onVZ1Q3e6EOnwZSFycY',
  VERCEL_PROJECT_ID: 'prj_9LWe0OGPPHdjiJvH5isrBrshtOiY',
};

const COMMON_REQUIRED_SECRETS = [
  'SUPABASE_ACCESS_TOKEN',
  'E2E_ADMIN_EMAIL',
  'E2E_ADMIN_PASSWORD',
];

const args = process.argv.slice(2);
const modeIndex = args.indexOf('--mode');
const mode = modeIndex >= 0 ? args[modeIndex + 1] : 'app';
if (!['app', 'database'].includes(mode)) {
  console.error('[release-env] --mode must be app or database');
  process.exit(1);
}

const expected = mode === 'app'
  ? { ...COMMON_EXPECTED, ...APP_EXPECTED }
  : COMMON_EXPECTED;
const requiredSecrets = mode === 'app'
  ? [...COMMON_REQUIRED_SECRETS, 'VERCEL_TOKEN']
  : COMMON_REQUIRED_SECRETS;

const issues = [];
for (const [name, expectedValue] of Object.entries(expected)) {
  const actual = process.env[name]?.trim();
  if (!actual) issues.push(`missing:${name}`);
  else if (actual !== expectedValue) issues.push(`unexpected-value:${name}`);
}
for (const name of requiredSecrets) {
  if (!process.env[name]?.trim()) issues.push(`missing-secret:${name}`);
}

if (process.env.GITHUB_REF && process.env.GITHUB_REF !== 'refs/heads/main') {
  issues.push('release-ref-must-be-main');
}

if (issues.length > 0) {
  for (const issue of issues) console.error(`[release-env] ${issue}`);
  process.exit(1);
}

console.log(`Production ${mode} release environment matches the locked targets.`);
