import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

const workerPath = '/api/notifications/dispatch-email';
const requiredServerEnv = [
  'SUPABASE_URL',
  'SUPABASE_SERVICE_ROLE_KEY',
  'NOTIFICATION_WORKER_SECRET',
  'CRON_SECRET',
  'SMTP_HOST',
  'SMTP_PORT',
  'SMTP_USER',
  'SMTP_PASS',
  'SMTP_FROM',
  'SITE_URL'
];
const smokeEnv = ['TOPIK_AI_PRODUCTION_URL'];
const envAliases = {
  SUPABASE_URL: ['VITE_SUPABASE_URL'],
  SUPABASE_SERVICE_ROLE_KEY: ['SUPABASE_SECRET_KEY']
};

function readJson(path, label, failures) {
  try {
    return JSON.parse(readFileSync(path, 'utf8'));
  } catch (error) {
    failures.push(`${label} is not readable JSON: ${error instanceof Error ? error.message : String(error)}`);
    return null;
  }
}

export function parseEnvFile(path) {
  if (!existsSync(path)) return new Map();
  const lines = readFileSync(path, 'utf8').split(/\r?\n/);
  const entries = new Map();
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const match = /^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/.exec(trimmed);
    if (!match) continue;
    entries.set(match[1], match[2]);
  }
  return entries;
}

export function hasConfiguredEnv(name, envMap, env = process.env) {
  const value = env[name] ?? envMap.get(name);
  return typeof value === 'string' && value.trim().length > 0;
}

export function hasConfiguredEnvWithAliases(name, envMap, env = process.env) {
  if (hasConfiguredEnv(name, envMap, env)) return true;
  return (envAliases[name] ?? []).some((alias) => hasConfiguredEnv(alias, envMap, env));
}

export function evaluateVercelWorkerReadiness({
  rootDir = process.cwd(),
  env = process.env
} = {}) {
  const projectJsonPath = join(rootDir, '.vercel', 'project.json');
  const vercelJsonPath = join(rootDir, 'vercel.json');
  const envExamplePath = join(rootDir, '.env.example');
  const envLocalPath = join(rootDir, '.env.local');
  const failures = [];
  const warnings = [];

  if (!existsSync(projectJsonPath)) {
    failures.push('.vercel/project.json is missing. Link this repo to the intended Vercel project before production worker verification.');
  } else {
    const project = readJson(projectJsonPath, '.vercel/project.json', failures);
    if (project && (!project.projectId || !project.orgId)) {
      failures.push('.vercel/project.json must contain projectId and orgId.');
    }
  }

  if (!existsSync(vercelJsonPath)) {
    failures.push('vercel.json is missing.');
  } else {
    const config = readJson(vercelJsonPath, 'vercel.json', failures);
    if (config) {
      const hasCron = Array.isArray(config.crons)
        && config.crons.some((cron) => cron?.path === workerPath && cron?.schedule === '0 0 * * *');
      if (!hasCron) {
        failures.push(`vercel.json must schedule ${workerPath} daily at 00:00 UTC for the Vercel Hobby fallback.`);
      }

      const rewrites = Array.isArray(config.rewrites) ? config.rewrites : [];
      const apiExcluded = rewrites.some((rewrite) => typeof rewrite?.source === 'string' && rewrite.source.includes('(?!api/'));
      if (!apiExcluded) {
        failures.push('vercel.json SPA rewrite must exclude /api/ so the worker is served as a function.');
      }
    }
  }

  const exampleEnv = parseEnvFile(envExamplePath);
  for (const name of [...requiredServerEnv, ...smokeEnv]) {
    if (!exampleEnv.has(name)) {
      failures.push(`.env.example must document ${name}.`);
    }
  }

  const localEnv = parseEnvFile(envLocalPath);
  for (const name of requiredServerEnv) {
    if (!hasConfiguredEnvWithAliases(name, localEnv, env)) {
      const aliases = envAliases[name]?.length
        ? ` or supported alias ${envAliases[name].join('/')}`
        : '';
      warnings.push(`${name}${aliases} is not configured in process env or .env.local. It must be set in production runtime env before dispatch verification.`);
    }
  }
  for (const name of smokeEnv) {
    if (!hasConfiguredEnv(name, localEnv, env)) {
      warnings.push(`${name} is not configured in process env or .env.local. Smoke checks require it, but the worker runtime does not.`);
    }
  }

  return { failures, warnings };
}

export function formatReadinessReport({ failures, warnings }) {
  const lines = [];
  if (failures.length > 0) {
    lines.push('Vercel worker readiness check failed:');
    for (const failure of failures) {
      lines.push(`- ${failure}`);
    }
  }
  if (warnings.length > 0) {
    lines.push('Vercel worker readiness warnings:');
    for (const warning of warnings) {
      lines.push(`- ${warning}`);
    }
  }
  if (failures.length === 0) {
    lines.push(
      warnings.length === 0
        ? 'Vercel worker readiness check passed.'
        : 'Vercel worker structural readiness passed; production runtime readiness is not verified.'
    );
  }
  if (failures.length > 0 || warnings.length > 0) {
    lines.push('Next production handoff steps:');
    lines.push('- Link the intended Vercel project so .vercel/project.json contains projectId and orgId.');
    lines.push('- Configure missing runtime env names in Vercel production env or .env.local for verification.');
    lines.push('- Re-run npm run check:vercel-worker-readiness -- --strict-env before authenticated smoke.');
  }
  return lines.join('\n');
}

export function shouldFailReadiness(result, { strictEnv = false } = {}) {
  return result.failures.length > 0 || (strictEnv && result.warnings.length > 0);
}

function main() {
  const strictEnv = process.argv.includes('--strict-env');
  const result = evaluateVercelWorkerReadiness();
  const report = formatReadinessReport(result);
  if (shouldFailReadiness(result, { strictEnv })) {
    console.error(report);
    process.exit(1);
  }
  if (result.warnings.length > 0) {
    console.warn(report);
    return;
  }
  console.log(report);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main();
}
