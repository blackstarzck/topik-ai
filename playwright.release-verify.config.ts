import { defineConfig } from '@playwright/test';

/**
 * 릴리스 브라우저 검증 전용 설정 — runbook §3(MCP 검증 프로토콜)을 사람 손 대신 이 설정으로 돈다.
 *
 * 두 대상을 같은 계측으로 재는 것이 목적이다.
 * - **원격**: `RELEASE_VERIFY_BASE_URL` 을 주면 그 도메인을 본다(스테이징 프리뷰 / 운영).
 * - **로컬**: 주지 않으면 현재 워크트리를 `npm run preview` 로 띄운다 — 직전 릴리스 SHA
 *   워크트리에서 돌려 **전/후 비교의 "전"** 을 만드는 용도다.
 *
 * 🚨 Vercel 보호 프리뷰는 **헤더**로만 우회한다. 쿼리 문자열에 시크릿을 넣으면 URL 이
 * 로그·히스토리에 남는다(브라우저 도구가 이를 차단하는 것이 옳다).
 *
 * 🚨 기본 e2e 스위트(`playwright.config.ts`, `testDir: ./tests/e2e`)는 이 spec 들을 수집하지
 * 않는다 — 릴리스 때만 명시적으로 돈다.
 */
const baseURL = process.env.RELEASE_VERIFY_BASE_URL?.trim();
const bypassSecret = process.env.VERCEL_AUTOMATION_BYPASS_SECRET?.trim();
const LOCAL_PORT = 4190;

export default defineConfig({
  testDir: './tests/live-e2e',
  testMatch: /release-(browser-verify|baseline-probe)\.pw\.ts$/,
  // 화면 6개를 여러 라운드 도는 경우가 있어 기본값보다 넉넉히 둔다.
  timeout: 300_000,
  expect: { timeout: 30_000 },
  workers: 1,
  retries: 0,
  reporter: [['line']],
  use: {
    baseURL: baseURL || `http://127.0.0.1:${LOCAL_PORT}`,
    headless: true,
    trace: 'off',
    screenshot: 'off',
    video: 'off',
    extraHTTPHeaders:
      baseURL && bypassSecret
        ? {
            'x-vercel-protection-bypass': bypassSecret,
            'x-vercel-set-bypass-cookie': 'true'
          }
        : {}
  },
  ...(baseURL
    ? {}
    : {
        webServer: {
          command: `npm run preview -- --host 127.0.0.1 --port ${LOCAL_PORT}`,
          url: `http://127.0.0.1:${LOCAL_PORT}`,
          reuseExistingServer: false,
          timeout: 180_000
        }
      })
});
