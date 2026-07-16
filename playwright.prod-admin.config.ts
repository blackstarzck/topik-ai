import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests/live-e2e',
  testMatch: 'prod-admin-coupon-crud.pw.ts',
  timeout: 180_000,
  expect: {
    timeout: 15_000
  },
  workers: 1,
  use: {
    baseURL: process.env.PROD_ADMIN_E2E_BASE_URL ?? 'http://127.0.0.1:4188',
    headless: true,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure'
  }
});
