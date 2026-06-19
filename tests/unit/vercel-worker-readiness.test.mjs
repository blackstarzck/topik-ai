import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { afterEach, describe, expect, it } from 'vitest';

import {
  evaluateVercelWorkerReadiness,
  formatReadinessReport,
  hasConfiguredEnvWithAliases,
  parseEnvFile,
  shouldFailReadiness
} from '../../scripts/check-vercel-worker-readiness.mjs';

const REQUIRED_ENV = {
  SUPABASE_URL: 'https://example.supabase.co',
  SUPABASE_SERVICE_ROLE_KEY: 'service-role-secret',
  NOTIFICATION_WORKER_SECRET: 'worker-secret',
  CRON_SECRET: 'cron-secret',
  RESEND_API_KEY: 'resend-secret',
  RESEND_FROM: 'Talkpik <notify@example.com>',
  SITE_URL: 'https://app.example.com',
  TOPIK_AI_PRODUCTION_URL: 'https://admin.example.com'
};

let tempDirs = [];

function createTempRoot() {
  const root = mkdtempSync(join(tmpdir(), 'topik-ai-readiness-'));
  tempDirs.push(root);
  return root;
}

function writeJson(file, value) {
  writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

function writeReadyFiles(root) {
  mkdirSync(join(root, '.vercel'), { recursive: true });
  writeJson(join(root, '.vercel', 'project.json'), {
    projectId: 'prj_test',
    orgId: 'team_test'
  });
  writeJson(join(root, 'vercel.json'), {
    crons: [{ path: '/api/notifications/dispatch-email', schedule: '*/15 * * * *' }],
    rewrites: [{ source: '/((?!api/|.*\\..*).*)', destination: '/index.html' }]
  });
  writeFileSync(
    join(root, '.env.example'),
    `${Object.keys(REQUIRED_ENV)
      .map((name) => `${name}=`)
      .join('\n')}\n`,
    'utf8'
  );
}

afterEach(() => {
  for (const dir of tempDirs) {
    rmSync(dir, { recursive: true, force: true });
  }
  tempDirs = [];
});

describe('check-vercel-worker-readiness', () => {
  it('fails closed when the Vercel project link is missing', () => {
    const root = createTempRoot();
    writeJson(join(root, 'vercel.json'), {
      crons: [{ path: '/api/notifications/dispatch-email', schedule: '*/15 * * * *' }],
      rewrites: [{ source: '/((?!api/|.*\\..*).*)', destination: '/index.html' }]
    });
    writeFileSync(
      join(root, '.env.example'),
      `${Object.keys(REQUIRED_ENV)
        .map((name) => `${name}=`)
        .join('\n')}\n`,
      'utf8'
    );

    const result = evaluateVercelWorkerReadiness({ rootDir: root, env: REQUIRED_ENV });

    expect(result.failures).toContain(
      '.vercel/project.json is missing. Link this repo to the intended Vercel project before production worker verification.'
    );
  });

  it('reports missing runtime env by variable name without leaking values', () => {
    const root = createTempRoot();
    writeReadyFiles(root);

    const result = evaluateVercelWorkerReadiness({
      rootDir: root,
      env: { RESEND_API_KEY: 'super-secret-value' }
    });
    const report = formatReadinessReport(result);

    expect(result.failures).toEqual([]);
    expect(result.warnings).toContain(
      'SUPABASE_SERVICE_ROLE_KEY or supported alias SUPABASE_SECRET_KEY is not configured in process env or .env.local. It must be set in production runtime env before dispatch verification.'
    );
    expect(report).toContain('RESEND_FROM is not configured');
    expect(report).toContain('Next production handoff steps:');
    expect(report).toContain('Link the intended Vercel project so .vercel/project.json contains projectId and orgId.');
    expect(report).toContain('Configure missing runtime env names in Vercel production env or .env.local for verification.');
    expect(report).not.toContain('super-secret-value');
    expect(shouldFailReadiness(result)).toBe(false);
    expect(shouldFailReadiness(result, { strictEnv: true })).toBe(true);
  });

  it('passes with linked Vercel config and all required env configured', () => {
    const root = createTempRoot();
    writeReadyFiles(root);

    const result = evaluateVercelWorkerReadiness({ rootDir: root, env: REQUIRED_ENV });

    expect(result).toEqual({ failures: [], warnings: [] });
    expect(formatReadinessReport(result)).toBe('Vercel worker readiness check passed.');
  });

  it('accepts supported local aliases for Supabase URL and service role names', () => {
    const root = createTempRoot();
    writeReadyFiles(root);
    const env = {
      ...REQUIRED_ENV,
      SUPABASE_URL: '',
      SUPABASE_SERVICE_ROLE_KEY: '',
      VITE_SUPABASE_URL: 'https://example.supabase.co',
      SUPABASE_SECRET_KEY: 'service-role-secret'
    };

    const result = evaluateVercelWorkerReadiness({ rootDir: root, env });

    expect(result).toEqual({ failures: [], warnings: [] });
    expect(hasConfiguredEnvWithAliases('SUPABASE_SERVICE_ROLE_KEY', new Map(), env)).toBe(true);
  });

  it('parses documented env names without exposing comments or blank lines', () => {
    const root = createTempRoot();
    const file = join(root, '.env.example');
    writeFileSync(file, '# comment\n\nCRON_SECRET=\nRESEND_FROM=Talkpik\n', 'utf8');

    const parsed = parseEnvFile(file);

    expect([...parsed.keys()]).toEqual(['CRON_SECRET', 'RESEND_FROM']);
  });
});
