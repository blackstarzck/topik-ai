import { defineConfig } from '@playwright/test';

// 권한 없는 관리자 fixture 전용 config — 기본 mock 세션은 SUPER_ADMIN(전 권한)이라
// analytics.read 부재 상태를 재현할 수 없다. VITE_ADMIN_PERMISSIONS_FIXTURE 는
// permission-store 의 mock 시드에서만 읽힌다(선례: analytics-learning-partial config).
export default defineConfig({
  testDir: './tests/e2e',
  testMatch: 'analytics-permission.pw.ts',
  timeout: 60_000,
  expect: {
    timeout: 10_000
  },
  use: {
    baseURL: 'http://127.0.0.1:4200',
    headless: true
  },
  webServer: {
    command: 'npm run dev -- --host 127.0.0.1 --port 4200',
    url: 'http://127.0.0.1:4200',
    env: {
      ...process.env,
      VITE_SUPABASE_DISABLED: 'true',
      VITE_ADMIN_PERMISSIONS_FIXTURE: 'no-analytics'
    },
    reuseExistingServer: false,
    timeout: 120_000
  }
});
