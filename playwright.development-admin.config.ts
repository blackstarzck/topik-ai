import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests/live-e2e',
  testMatch: [
    'prod-admin-readonly.pw.ts',
    'prod-admin-coupon-crud.pw.ts'
  ],
  timeout: 180_000,
  expect: {
    timeout: 20_000
  },
  workers: 1,
  retries: 0,
  reporter: [['line']],
  use: {
    baseURL: 'http://127.0.0.1:4188',
    headless: true,
    trace: 'off',
    screenshot: 'off',
    video: 'off'
  },
  webServer: {
    command: 'npm run preview -- --host 127.0.0.1 --port 4188',
    url: 'http://127.0.0.1:4188',
    reuseExistingServer: false,
    timeout: 120_000
  }
});
