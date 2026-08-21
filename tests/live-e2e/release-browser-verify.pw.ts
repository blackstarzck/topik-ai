import { existsSync, mkdirSync } from 'node:fs';
import { expect, test, type ConsoleMessage, type Page, type Request } from '@playwright/test';

import { loginIfNeeded } from './admin-login';

/**
 * 릴리스 브라우저 검증 — runbook §3 체크리스트를 **기계로** 수행한다.
 *
 * 이 파일이 있는 이유. §3 은 원래 사람이 브라우저를 직접 몰아 7항목을 확인하는 절차였다.
 * 사람이 하면 (a) 릴리스마다 범위가 흔들리고 (b) 통과 근거가 남지 않고 (c) 다음 사람이
 * 같은 판단을 재현할 수 없다. 2026-08-21 릴리스에서 이 spec 으로 옮겼다.
 *
 * 대상은 설정이 정한다(`playwright.release-verify.config.ts`) — 스테이징 프리뷰든 운영
 * 도메인이든 같은 계측을 쓴다. 그래야 두 단계의 결과를 비교할 수 있다.
 *
 * 🚨 **운영을 볼 때도 읽기 전용이다.** 쓰기 흐름은 이 spec 에 넣지 않는다(쿠폰 CRUD 같은
 * 것은 dev 대상 spec 에만 있다).
 *
 * 필요한 환경변수
 * - `E2E_ADMIN_EMAIL` / `E2E_ADMIN_PASSWORD` — 검증용 관리자
 * - `RELEASE_EXPECTED_SHA` — 배포가 실어야 하는 source SHA(`shaMatch` 축)
 * - `RELEASE_SHOT_DIR` — 스크린샷 저장 위치(release manifest 폴더 하위를 쓴다)
 */

const adminEmail = process.env.E2E_ADMIN_EMAIL;
const adminPassword = process.env.E2E_ADMIN_PASSWORD;
const expectedSha = process.env.RELEASE_EXPECTED_SHA;
const shotDir = process.env.RELEASE_SHOT_DIR;

/** `FONT_SIZE`(base 14 파생 + 앱 고유 metric)가 허용하는 값. 원본 = src/shared/styles/design-tokens.ts */
const ALLOWED_FONT_SIZES_PX = [14, 16, 20, 24, 28, 30, 38];

/**
 * 검증할 화면.
 *
 * 🔑 이 목록은 **릴리스가 바꾼 화면**을 담는다 — 릴리스마다 손볼 자리다. 목록에 없는 화면은
 * 검사되지 않는다는 점을 잊지 마라(§3.19.1 의 감사 목록 사각지대와 같은 함정).
 */
const auditedScreens = [
  { key: 'dashboard', url: '/dashboard' },
  { key: 'users', url: '/users' },
  { key: 'analytics-learning', url: '/analytics/learning' },
  { key: 'commerce-points', url: '/commerce/points' },
  { key: 'commerce-payments', url: '/commerce/payments' },
  { key: 'commerce-refunds', url: '/commerce/refunds' }
] as const;

type Findings = { consoleErrors: string[]; failedRequests: string[] };

function watch(page: Page): Findings {
  const findings: Findings = { consoleErrors: [], failedRequests: [] };

  page.on('console', (message: ConsoleMessage) => {
    if (message.type() !== 'error') return;
    findings.consoleErrors.push(`${page.url()} :: ${message.text().slice(0, 220)}`);
  });
  page.on('pageerror', (error) => {
    findings.consoleErrors.push(`${page.url()} :: pageerror ${error.message.slice(0, 220)}`);
  });

  page.on('requestfailed', (request: Request) => {
    const failure = request.failure()?.errorText ?? 'unknown';
    // 🚨 `page.goto` 가 취소한 요청이 net::ERR_ABORTED 로 잡혀 거짓 실패를 만든다.
    //    abort 만 제외한다 — 상태코드 실패는 절대 삼키지 않는다.
    if (failure.includes('ERR_ABORTED')) return;
    findings.failedRequests.push(`${request.method()} ${request.url()} :: ${failure}`);
  });
  page.on('response', (response) => {
    if (response.status() < 400) return;
    findings.failedRequests.push(
      `${response.status()} ${response.request().method()} ${response.url()}`
    );
  });

  return findings;
}

/** 페이지 본문이 마운트될 때까지 — 셸(`<main>`)은 페이지보다 먼저 그려져 앵커가 못 된다. */
async function waitForPageContent(page: Page) {
  await expect(page.locator('.page-title-block')).toBeVisible({ timeout: 60_000 });
  // 표가 있는 화면은 로딩이 걷힐 때까지. `toHaveCount(0)` 은 여기서 **완료 대기**로 쓰는 것이
  // 맞다(부재 증명에 쓰면 안 되지만 대기에는 정확한 도구다).
  await expect(page.locator('.admin-data-table--loading')).toHaveCount(0);
}

test('릴리스 검증 대상의 runbook §3 체크리스트를 수행한다', async ({ page }) => {
  if (!adminEmail || !adminPassword) throw new Error('E2E_ADMIN_EMAIL, E2E_ADMIN_PASSWORD 필요');
  if (!shotDir) throw new Error('RELEASE_SHOT_DIR 필요');
  if (!existsSync(shotDir)) mkdirSync(shotDir, { recursive: true });

  const findings = watch(page);

  // ── login ────────────────────────────────────────────────────────────────
  await page.goto('/users');
  await loginIfNeeded(page, { email: adminEmail, password: adminPassword });
  await waitForPageContent(page);
  console.log('CHECK login=pass');

  // ── shaMatch — 배포가 의도한 source 를 싣고 있는가 ────────────────────────
  const renderedSha = await page
    .locator('meta[name="release-sha"]')
    .getAttribute('content')
    .catch(() => null);
  console.log(`INFO renderedSha=${renderedSha ?? '(없음)'} expected=${expectedSha ?? '(미지정)'}`);
  if (expectedSha) {
    expect(renderedSha, 'meta[name=release-sha] 가 source SHA 와 같아야 한다').toBe(expectedSha);
    console.log('CHECK shaMatch=pass');
  }

  // ── coreFlows + screenshotsSaved ─────────────────────────────────────────
  for (const screen of auditedScreens) {
    await page.goto(screen.url);
    await waitForPageContent(page);
    await page.screenshot({ path: `${shotDir}/${screen.key}.png`, fullPage: true });
    console.log(`FLOW ${screen.key} ok`);
  }

  // 목록만 보면 read-only 흐름을 다 밟은 것이 아니다 — 상세까지 들어간다.
  await page.goto('/users');
  await waitForPageContent(page);
  const firstRow = page.locator('.ant-table-tbody > tr.ant-table-row').first();
  await expect(firstRow).toBeVisible({ timeout: 60_000 });
  await firstRow.locator('td').nth(1).click();
  await waitForPageContent(page);
  await page.screenshot({ path: `${shotDir}/users-detail.png`, fullPage: true });
  console.log('FLOW users-detail ok');
  console.log('CHECK coreFlows=pass');
  console.log('CHECK screenshotsSaved=pass');

  // ── 글자 크기 스케일 — 소스 스캔이 못 보는 antd 내부 값까지 렌더된 값으로 본다 ──
  await page.goto('/analytics/learning');
  await waitForPageContent(page);
  const fontAudit = await page.evaluate(() => {
    const sizes = new Set<number>();
    for (const element of Array.from(document.querySelectorAll('*'))) {
      if (element.closest('.anticon')) continue;
      const own = Array.from(element.childNodes)
        .filter((n) => n.nodeType === Node.TEXT_NODE && n.textContent?.trim())
        .map((n) => n.textContent?.trim() ?? '')
        .join('');
      if (!own) continue;
      sizes.add(Number.parseFloat(window.getComputedStyle(element).fontSize));
    }
    return Array.from(sizes).sort((a, b) => a - b);
  });
  const offScale = fontAudit.filter((px) => !ALLOWED_FONT_SIZES_PX.includes(px));
  console.log(`FONT sizes=${JSON.stringify(fontAudit)} offScale=${JSON.stringify(offScale)}`);
  // 🔑 양성 앵커 — 아무것도 못 셌으면 아래 부정 단언이 공짜로 통과한다.
  expect(fontAudit.length, '텍스트를 하나도 세지 못했습니다').toBeGreaterThan(0);
  expect(offScale, '스케일 밖 글자 크기').toEqual([]);

  // ── consoleErrors / failedRequests ───────────────────────────────────────
  console.log(`CONSOLE_ERRORS ${findings.consoleErrors.length}`);
  for (const line of findings.consoleErrors.slice(0, 20)) console.log(`  ! ${line}`);
  console.log(`FAILED_REQUESTS ${findings.failedRequests.length}`);
  for (const line of findings.failedRequests.slice(0, 20)) console.log(`  ! ${line}`);

  expect(findings.consoleErrors, '콘솔 오류').toEqual([]);
  expect(findings.failedRequests, '실패 요청').toEqual([]);
  console.log('CHECK consoleErrors=pass');
  console.log('CHECK failedRequests=pass');
});
