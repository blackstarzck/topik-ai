import { defineConfig } from '@playwright/test';

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
    headless: true,
    trace: 'off',
    screenshot: 'off',
    video: 'off'
  }
});
