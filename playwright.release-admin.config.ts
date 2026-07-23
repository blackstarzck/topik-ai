import { defineConfig } from '@playwright/test';

export function releaseProtectionHeaders(
  env: Record<string, string | undefined> = process.env
) {
  const bypassSecret = env.VERCEL_AUTOMATION_BYPASS_SECRET?.trim();
  if (!bypassSecret) return undefined;

  return {
    'x-vercel-protection-bypass': bypassSecret,
    'x-vercel-set-bypass-cookie': 'true'
  };
}

export default defineConfig({
  testDir: './tests/live-e2e',
  testMatch: 'prod-admin-readonly.pw.ts',
  timeout: 180_000,
  expect: {
    timeout: 20_000
  },
  workers: 1,
  retries: 0,
  reporter: [['line']],
  use: {
    baseURL: process.env.ADMIN_E2E_BASE_URL ?? process.env.PROD_ADMIN_E2E_BASE_URL,
    extraHTTPHeaders: releaseProtectionHeaders(),
    headless: true,
    trace: 'off',
    screenshot: 'off',
    video: 'off'
  }
});
