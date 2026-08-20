import { expect, test } from '@playwright/test';

import { stretchAsyncFetchDelay } from './harness/admin-flow-helpers';

/**
 * 회원 목록의 선택·페이징 계약.
 *
 * 서버 조회는 `affiliation` 하나만 쓴다 — 페이징·검색·나머지 필터는 클라이언트에서
 * 처리한다. 그런데 재조회 deps 에 `page`/`pageSize` 가 들어 있어서 페이지를 넘길 때마다
 * 같은 데이터를 다시 받았고, 그 과정에서 선택이 초기화됐다(gap-register §3.13 ⑩).
 *
 * 🔑 조회 지연을 늘리지 않으면 **재조회 유무를 구분할 수 없다**(지연이 짧아 로딩이
 * 순간적으로 지나간다). `stretchAsyncFetchDelay` 로 2.5초로 늘려서, 재조회가 있었다면
 * 로딩 오버레이가 그 시간 동안 떠 있는 상태로 관측되게 만든다.
 */
const LOADING_OVERLAY = '.admin-data-table--loading';
const SELECT_ALL_CHECKBOX = '.ant-table-thead .ant-checkbox-input';

test('페이지를 넘겨도 선택이 유지되고 목록을 다시 받지 않는다', async ({ page }) => {
  await page.addInitScript(stretchAsyncFetchDelay);
  await page.goto('/users');

  // 초기 조회가 끝난 뒤에 선택한다(로딩 중 선택은 초기화 대상이다).
  await expect(page.locator(LOADING_OVERLAY)).toHaveCount(0, { timeout: 20000 });
  await expect(page.getByText('총 420건')).toBeVisible();

  await page.locator(SELECT_ALL_CHECKBOX).check();
  await expect(page.getByText('20명 선택됨')).toBeVisible();

  // 🚨 hasText: '2' 는 21페이지 버튼에도 걸린다(strict mode 위반) → 정확한 클래스로.
  await page.locator('.ant-pagination-item-2').click();
  await expect(page).toHaveURL(/page=2/);
  await expect(page.locator('.ant-pagination-item-active')).toHaveText('2');

  // 재조회 없음. 재조회가 있었다면 늘린 지연(2.5초) 동안 로딩 오버레이가 떠 있다.
  //
  // 🚨 `expect(locator).toHaveCount(0)` 으로는 못 잡는다 — 그건 "0 이 될 때까지" 기다리므로
  // 로딩이 떴다가 사라지면 그냥 통과한다(실제로 그렇게 red 를 놓쳤다). 재시도하지 않는
  // `.count()` 로 그 순간의 상태를 본다.
  for (const settle of [0, 300, 900]) {
    if (settle > 0) {
      await page.waitForTimeout(settle);
    }
    expect(await page.locator(LOADING_OVERLAY).count(), `settle=${settle}ms`).toBe(0);
  }

  // 선택 유지.
  await expect(page.getByText('20명 선택됨')).toBeVisible();
});

test('기관 소속 필터가 바뀌면 선택이 초기화된다', async ({ page }) => {
  await page.goto('/users');

  await expect(page.locator(LOADING_OVERLAY)).toHaveCount(0, { timeout: 20000 });
  await page.locator(SELECT_ALL_CHECKBOX).check();
  await expect(page.getByText('20명 선택됨')).toBeVisible();

  // 대상 집합이 바뀌는 변경이므로 이전 선택은 무효다.
  await page.getByTitle('전체 회원').click();
  await page.locator('.ant-select-item-option', { hasText: '기관 회원만' }).click();

  await expect(page).toHaveURL(/affiliation=%40affiliated/);
  await expect(page.getByText('총 120건')).toBeVisible();
  await expect(page.getByText('20명 선택됨')).toHaveCount(0);
});
