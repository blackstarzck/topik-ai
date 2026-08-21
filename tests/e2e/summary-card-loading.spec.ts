import { expect, test } from '@playwright/test';

import { stretchAsyncFetchDelay } from './harness/admin-flow-helpers';

/**
 * 요약 카드는 조회가 끝나기 전에 수치를 보여주지 않는다.
 *
 * 이전에는 데이터가 빈 배열인 첫 프레임에 계산식이 그대로 돌아 `0건`·`₩0` 을 **정상 수치처럼**
 * 보여줬다(gap-register §3.17.3). 표에는 antd 로딩 오버레이가 있었지만 카드에는 없었다.
 *
 * 🚨 **관측 창이 있는 화면을 골라야 한다.** mock 경로에 인위적 지연이 없는 화면
 * (billing·assessment 는 zustand store 를 즉시 반환한다)은 pending 이 마이크로태스크 한 번에
 * 끝나 로딩 프레임을 볼 수 없다. 여기서는 지연이 있는 화면만 쓴다 —
 * `/system/logs`(180ms)·`/commerce/coupons`(220ms). 그 지연을 2.5초로 늘려 관측한다.
 */
const CARD = '.list-summary-card';
const VALUE_SKELETON = '.list-summary-card__value .ant-skeleton';

test('요약 카드는 조회 중에 0 이 아니라 스켈레톤을 보여준다', async ({ page }) => {
  await page.addInitScript(stretchAsyncFetchDelay);
  await page.goto('/system/logs');

  const firstCard = page.locator(CARD).first();
  await expect(firstCard).toBeVisible();

  // 로딩 중: 값 자리에 스켈레톤이 있고 라벨만 보인다.
  await expect(page.locator(VALUE_SKELETON).first()).toBeVisible();
  const loadingText = (await firstCard.innerText()).replace(/\s/g, '');
  expect(loadingText, '로딩 중에는 수치를 그리지 않는다').not.toMatch(/\d/);

  // 조회가 끝나면 스켈레톤이 사라지고 실제 수치가 나온다.
  await expect(page.locator(VALUE_SKELETON)).toHaveCount(0, { timeout: 20000 });
  await expect(firstCard).toContainText('건');
});

test('로딩 중에는 클릭형 카드가 노출되지 않는다', async ({ page }) => {
  // 값이 없으면 필터로 쓸 수 없다 — 로딩 중에는 정적으로 그린다.
  await page.addInitScript(stretchAsyncFetchDelay);
  await page.goto('/commerce/coupons');

  await expect(page.locator(CARD).first()).toBeVisible();
  expect(
    await page.locator('.list-summary-card--interactive').count(),
    '로딩 중에는 interactive 카드가 없다'
  ).toBe(0);

  await expect(page.locator(VALUE_SKELETON)).toHaveCount(0, { timeout: 20000 });
  expect(
    await page.locator('.list-summary-card--interactive').count(),
    '조회가 끝나면 다시 클릭할 수 있다'
  ).toBeGreaterThan(0);
});

test('조회가 끝난 화면에는 스켈레톤이 남지 않는다', async ({ page }) => {
  // 지연을 늘리지 않은 정상 조회 — `empty` 나 `success` 는 로딩이 아니므로 값을 그린다.
  await page.goto('/system/logs');

  await expect(page.locator(CARD).first()).toBeVisible();
  await expect(page.locator(VALUE_SKELETON)).toHaveCount(0, { timeout: 20000 });
  await expect(page.locator(CARD).first()).toContainText('건');
});
