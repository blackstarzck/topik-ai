import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { expect, test, type Page } from '@playwright/test';

import { loginIfNeeded } from './admin-login';

/**
 * 릴리스 전/후 비교 측정기 — runbook §3 의 `baselineCompared` 를 **숫자로** 수행한다.
 *
 * 쓰는 법: 같은 spec 을 두 번 돌려 결과 JSON 을 대조한다.
 * 1. **전** — 직전 릴리스 SHA 로 워크트리를 만들고 **비교 대상과 같은 DB** 를 가리키게
 *    빌드한 뒤, `RELEASE_VERIFY_BASE_URL` 없이 돌린다(로컬 preview 가 뜬다).
 * 2. **후** — 새 배포 도메인을 `RELEASE_VERIFY_BASE_URL` 로 주고 돌린다.
 *
 * 🚨 **행 수를 비교축으로 쓸 수 있는 경우는 두 대상이 같은 DB 를 볼 때뿐이다.** 운영 검증에서
 * "전"은 dev DB, "후"는 prod DB 가 되므로 행 수 차이는 데이터 차이지 회귀가 아니다
 * (2026-08-21 릴리스에서 실제로 겪었다 — 의심은 운영 DB 직접 조회로 가렸다). 그럴 때 유효한
 * 축은 **표시 규칙**(글자 크기 집합·링크색 집합)이다.
 *
 * 🚨 **한 화면을 한 번만 재면 거짓 변화가 나온다.** 같은 릴리스에서 dashboard 행 수가
 * `0 → 4` 로 보였는데 데이터 도착 전을 잡은 것이었다(3라운드로는 4=4). `PROBE_ROUNDS` 를
 * 2 이상으로 두고 합집합을 쓴다.
 *
 * 필요한 환경변수: `E2E_ADMIN_EMAIL`, `E2E_ADMIN_PASSWORD`, `PROBE_OUT`(결과 JSON 경로),
 * `PROBE_LABEL`(어느 쪽인지), `PROBE_ROUNDS`(기본 3).
 */

const adminEmail = process.env.E2E_ADMIN_EMAIL;
const adminPassword = process.env.E2E_ADMIN_PASSWORD;
const outFile = process.env.PROBE_OUT;
const label = process.env.PROBE_LABEL ?? 'unknown';
const rounds = Math.max(1, Number.parseInt(process.env.PROBE_ROUNDS ?? '3', 10));

const probedScreens = [
  { key: 'dashboard', url: '/dashboard' },
  { key: 'users', url: '/users' },
  { key: 'analytics-learning', url: '/analytics/learning' },
  { key: 'commerce-points', url: '/commerce/points' },
  { key: 'commerce-payments', url: '/commerce/payments' },
  { key: 'commerce-refunds', url: '/commerce/refunds' }
] as const;

async function measure(page: Page) {
  return page.evaluate(() => {
    /** 크기별 **대표 엘리먼트** — 설명되지 않는 변화를 추적할 수 있어야 한다. */
    const fontOwners: Record<string, string> = {};
    const fontSizes = new Set<string>();
    const linkColors = new Set<string>();
    let textNodes = 0;

    for (const element of Array.from(document.querySelectorAll('*'))) {
      const own = Array.from(element.childNodes)
        .filter((n) => n.nodeType === Node.TEXT_NODE && n.textContent?.trim())
        .map((n) => n.textContent?.trim() ?? '')
        .join('');
      if (!own) continue;
      textNodes += 1;

      const style = window.getComputedStyle(element);
      if (!element.closest('.anticon')) {
        fontSizes.add(style.fontSize);
        if (!fontOwners[style.fontSize]) {
          const cls = typeof element.className === 'string' ? element.className : '';
          fontOwners[style.fontSize] =
            `${element.tagName.toLowerCase()}.${cls.slice(0, 60) || '(no class)'} :: ${own.slice(0, 40)}`;
        }
      }
      if (element.tagName === 'A' || element.closest('a')) linkColors.add(style.color);
    }

    return {
      fontSizes: Array.from(fontSizes),
      fontOwners,
      linkColors: Array.from(linkColors),
      textNodes,
      tableRows: document.querySelectorAll('.ant-table-tbody > tr.ant-table-row').length,
      errorAlerts: document.querySelectorAll('.ant-alert-error').length
    };
  });
}

test('전/후 비교용 화면 측정값을 수집한다', async ({ page }) => {
  if (!adminEmail || !adminPassword) throw new Error('E2E_ADMIN_EMAIL, E2E_ADMIN_PASSWORD 필요');
  if (!outFile) throw new Error('PROBE_OUT 필요');

  await page.goto('/users');
  await loginIfNeeded(page, { email: adminEmail, password: adminPassword });
  await expect(page.locator('.page-title-block')).toBeVisible({ timeout: 60_000 });

  const result: Record<string, unknown> = { label, rounds };
  for (const screen of probedScreens) {
    const fontSizes = new Set<string>();
    const linkColors = new Set<string>();
    let last: Awaited<ReturnType<typeof measure>> | null = null;

    for (let round = 0; round < rounds; round += 1) {
      await page.goto(screen.url);
      await expect(page.locator('.page-title-block')).toBeVisible({ timeout: 60_000 });
      await expect(page.locator('.admin-data-table--loading')).toHaveCount(0);
      last = await measure(page);
      for (const size of last.fontSizes) fontSizes.add(size);
      for (const color of last.linkColors) linkColors.add(color);
    }

    result[screen.key] = {
      ...last,
      fontSizes: Array.from(fontSizes).sort(
        (a, b) => Number.parseFloat(a) - Number.parseFloat(b)
      ),
      linkColors: Array.from(linkColors).sort()
    };
    console.log(`PROBE ${screen.key} done (${rounds} round(s))`);
  }

  const dir = outFile.slice(0, Math.max(outFile.lastIndexOf('/'), outFile.lastIndexOf('\\')));
  if (dir && !existsSync(dir)) mkdirSync(dir, { recursive: true });
  writeFileSync(outFile, JSON.stringify(result, null, 1), 'utf8');
  console.log(`PROBE written ${outFile}`);
});
