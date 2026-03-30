import { expect, test } from 'playwright/test';

test('포인트 관리 페이지에 진입하고 주요 탭을 전환할 수 있다', async ({ page }) => {
  await page.goto('/commerce/points');

  await expect(page.getByRole('heading', { name: '포인트 관리' })).toBeVisible();
  await expect(page.getByText('운영 정책 미확정 항목이 남아 있습니다.')).toBeVisible();

  await page.getByRole('tab', { name: /포인트 원장/ }).click();
  await expect(page.getByRole('button', { name: '포인트 수동 조정' })).toBeVisible();
  await expect(page.getByRole('listitem').filter({ hasText: '총 8건' })).toBeVisible();

  await page.getByRole('tab', { name: /소멸 예정/ }).click();
  await expect(page.getByRole('button', { name: '소멸 보류 등록' })).toBeVisible();
  await expect(page.getByRole('listitem').filter({ hasText: '총 5건' })).toBeVisible();
});

test('요약 카드 클릭으로 현재 탭 테이블을 즉시 필터링할 수 있다', async ({ page }) => {
  await page.goto('/commerce/points');

  await page.getByRole('button', { name: /^운영 중 정책/ }).click();

  await expect
    .poll(() => new URL(page.url()).searchParams.get('policyStatus'))
    .toBe('운영 중');
  await expect(page.getByRole('listitem').filter({ hasText: '총 2건' })).toBeVisible();
  await expect(page.getByText('결제 포인트 사용', { exact: true })).toHaveCount(0);
});

test('더보기 클릭은 행 상세 Drawer를 열지 않는다', async ({ page }) => {
  await page.goto('/commerce/points');

  const moreButton = page.getByRole('button', { name: '더보기' }).first();
  await expect(moreButton).toBeVisible();
  await moreButton.click();

  await expect(page.getByText(/포인트 정책 상세 · POL-/)).toHaveCount(0);
  await expect(page.getByRole('menuitem', { name: '정책 수정' })).toBeVisible();
});

test('운영 중지 액션은 footer 강조 영역으로 분리된다', async ({ page }) => {
  await page.goto('/commerce/points');

  await page.getByRole('button', { name: '더보기' }).first().click();

  const footer = page.locator('.table-action-menu__footer');
  const stopButton = footer.getByRole('button', { name: '운영 중지' });

  await expect(footer).toBeVisible();
  await expect(stopButton).toBeVisible();
  await expect(page.locator('.table-action-menu__content').getByText('정책 수정')).toBeVisible();
  await expect
    .poll(() => footer.evaluate((element) => window.getComputedStyle(element).borderTopStyle))
    .toBe('solid');
  await expect
    .poll(() => stopButton.evaluate((element) => window.getComputedStyle(element).backgroundColor))
    .toBe('rgb(255, 77, 79)');
});

test('액션 컬럼은 우측 고정 클래스가 적용된다', async ({ page }) => {
  await page.goto('/commerce/points');

  await expect(page.getByRole('columnheader', { name: '액션' })).toHaveClass(
    /ant-table-cell-fix-right/
  );
});
test('테이블 헤더와 셀 텍스트는 왼쪽 정렬 baseline을 유지한다', async ({ page }) => {
  await page.goto('/commerce/points');

  const firstHeaderCell = page.locator('.admin-data-table .ant-table-thead > tr > th').first();
  const firstBodyCell = page.locator('.admin-data-table .ant-table-tbody > tr > td').first();

  await expect
    .poll(() => firstHeaderCell.evaluate((element) => window.getComputedStyle(element).textAlign))
    .toBe('left');
  await expect
    .poll(() => firstBodyCell.evaluate((element) => window.getComputedStyle(element).textAlign))
    .toBe('left');
});
test('points tables keep native table DOM instead of virtual body', async ({ page }) => {
  await page.goto('/commerce/points');

  await expect(page.locator('.admin-data-table table').first()).toBeVisible();
  await expect(page.locator('.admin-data-table .ant-table-body-virtual')).toHaveCount(0);
});
