import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

const REQUIRED_ADMIN_ENV = [
  'E2E_ADMIN_EMAIL',
  'E2E_ADMIN_PASSWORD'
];

function parseEnvValues(path) {
  if (!existsSync(path)) return new Map();
  const values = new Map();
  const lines = readFileSync(path, 'utf8').split(/\r?\n/);
  for (const line of lines) {
    const match = /^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=(.*)$/.exec(line);
    if (match) values.set(match[1], match[2].trim());
  }
  return values;
}

export function evaluateAdminVerificationEnv({ rootDir = process.cwd() } = {}) {
  const values = parseEnvValues(join(rootDir, '.env.local'));
  const failures = [];
  for (const name of REQUIRED_ADMIN_ENV) {
    if (!values.has(name)) {
      failures.push(`Missing required admin verification env: ${name}`);
      continue;
    }
    if (!values.get(name)) {
      failures.push(`Empty required admin verification env: ${name}`);
    }
  }

  return {
    failures,
    requiredNames: REQUIRED_ADMIN_ENV
  };
}

export function formatAdminVerificationEnvReport(result) {
  if (result.failures.length > 0) {
    return [
      'Admin verification env check failed:',
      ...result.failures.map((failure) => `- ${failure}`)
    ].join('\n');
  }

  return [
    'Admin verification env check passed.',
    `Required admin env names present: ${result.requiredNames.join(', ')}`
  ].join('\n');
}

function main() {
  const result = evaluateAdminVerificationEnv();
  const report = formatAdminVerificationEnvReport(result);
  if (result.failures.length > 0) {
    console.error(report);
    process.exit(1);
  }
  console.log(report);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main();
}
