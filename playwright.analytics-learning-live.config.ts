import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests/live-e2e',
  testMatch: 'analytics-learning-live.pw.ts',
  timeout: 600_000,
  expect: {
    timeout: 15_000
  },
  workers: 1,
  use: {
    baseURL: 'http://127.0.0.1:4197',
    headless: true
  },
  webServer: {
    command: 'npm run dev -- --host 127.0.0.1 --port 4197',
    url: 'http://127.0.0.1:4197',
    reuseExistingServer: false,
    timeout: 120_000
  }
});
