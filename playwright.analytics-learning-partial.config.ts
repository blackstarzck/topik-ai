import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  testMatch: 'analytics-learning-coverage-partial.pw.ts',
  timeout: 60_000,
  expect: {
    timeout: 10_000
  },
  use: {
    baseURL: 'http://127.0.0.1:4199',
    headless: true
  },
  webServer: {
    command: 'npm run dev -- --host 127.0.0.1 --port 4199',
    url: 'http://127.0.0.1:4199',
    env: {
      ...process.env,
      VITE_SUPABASE_DISABLED: 'true',
      VITE_ANALYTICS_METADATA_COVERAGE_FIXTURE: 'partial'
    },
    reuseExistingServer: false,
    timeout: 120_000
  }
});
