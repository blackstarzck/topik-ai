import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  timeout: 60_000,
  expect: {
    timeout: 10_000
  },
  use: {
    baseURL: 'http://127.0.0.1:4177',
    headless: true
  },
  webServer: {
    command: 'npm run dev -- --host 127.0.0.1 --port 4177',
    url: 'http://127.0.0.1:4177',
    env: {
      ...process.env,
      VITE_SUPABASE_DISABLED: 'true',
      VITE_SUPABASE_URL: 'https://fglggyfvzjdsbyckinqa.supabase.co'
    },
    reuseExistingServer: false,
    timeout: 120_000
  }
});
