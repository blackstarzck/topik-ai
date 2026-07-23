#!/usr/bin/env node

const DEVELOPMENT_PROJECT_REF = 'fglggyfvzjdsbyckinqa';
const EXPECTED = {
  SUPABASE_PROJECT_REF: DEVELOPMENT_PROJECT_REF,
  SUPABASE_EXPECTED_PROJECT_REF: DEVELOPMENT_PROJECT_REF,
  VITE_SUPABASE_URL: `https://${DEVELOPMENT_PROJECT_REF}.supabase.co`,
  V13_CONTRACT_SHA: 'd16113a1d7b2306b9991354b40c3cffe82ad299d',
};

const REQUIRED_SECRETS = [
  'SUPABASE_ACCESS_TOKEN',
  'E2E_ADMIN_EMAIL',
  'E2E_ADMIN_PASSWORD',
  'VITE_SUPABASE_PUBLISHABLE_KEY',
];

const issues = [];
for (const [name, expected] of Object.entries(EXPECTED)) {
  const actual = process.env[name]?.trim().replace(/\/$/, '');
  if (!actual) issues.push(`missing:${name}`);
  else if (actual !== expected) issues.push(`unexpected-value:${name}`);
}
for (const name of REQUIRED_SECRETS) {
  if (!process.env[name]?.trim()) issues.push(`missing-secret:${name}`);
}
if (process.env.GITHUB_REF && process.env.GITHUB_REF !== 'refs/heads/main') {
  issues.push('development-ref-must-be-main');
}

if (issues.length > 0) {
  for (const issue of issues) console.error(`[development-env] ${issue}`);
  process.exit(1);
}

console.log('Development validation environment matches the locked topik-dev target.');
