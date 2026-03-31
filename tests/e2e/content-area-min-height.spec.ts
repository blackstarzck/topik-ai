import { expect, test, type Locator, type Page } from '@playwright/test';

async function getBottom(locator: Locator): Promise<number> {
  const box = await locator.boundingBox();

  expect(box).not.toBeNull();
  return box!.y + box!.height;
}

async function getRight(locator: Locator): Promise<number> {
  const box = await locator.boundingBox();

  expect(box).not.toBeNull();
  return box!.x + box!.width;
}

async function expectContentCardToFillPage(
  page: Page,
  url: string,
  cardSelector: string
): Promise<void> {
  await page.goto(url);
  await expect(page.locator('.page-title-block').first()).toBeVisible();

  const pageRoot = page
    .locator('.route-transition-container > :has(.page-title-block)')
    .first();
  const card = page.locator(cardSelector).first();

  await expect(pageRoot).toBeVisible();
  await expect(card).toBeVisible();

  const [pageBottom, cardBottom] = await Promise.all([
    getBottom(pageRoot),
    getBottom(card)
  ]);

  expect(Math.abs(pageBottom - cardBottom)).toBeLessThanOrEqual(2);
}

async function expectTableViewportToFillCard(
  page: Page,
  url: string,
  cardSelector: string,
  tableViewportSelector: string
): Promise<void> {
  await page.goto(url);
  await expect(page.locator('.page-title-block').first()).toBeVisible();

  const cardBody = page.locator(`${cardSelector} .ant-card-body`).first();
  const tableViewport = page.locator(tableViewportSelector).first();

  await expect(cardBody).toBeVisible();
  await expect(tableViewport).toBeVisible();

  const [cardBodyBottom, tableViewportBottom] = await Promise.all([
    getBottom(cardBody),
    getBottom(tableViewport)
  ]);

  expect(cardBodyBottom - tableViewportBottom).toBeLessThanOrEqual(32);
}

async function expectTableLayoutToStayWithinCard(
  page: Page,
  url: string,
  cardSelector: string,
  selectors: string[]
): Promise<void> {
  await page.setViewportSize({ width: 352, height: 844 });
  await page.goto(url);
  await expect(page.locator('.page-title-block').first()).toBeVisible();

  const cardBody = page.locator(`${cardSelector} .ant-card-body`).first();
  await expect(cardBody).toBeVisible();

  const cardBodyRight = await getRight(cardBody);

  for (const selector of selectors) {
    const target = page.locator(selector).first();
    await expect(target).toBeVisible();

    const targetRight = await getRight(target);
    expect(targetRight - cardBodyRight).toBeLessThanOrEqual(2);
  }
}

test('list page body cards fill to the bottom of the page', async ({ page }) => {
  await expectContentCardToFillPage(page, '/commerce/payments', '.admin-list-card');
});

test('placeholder cards fill to the bottom of the page', async ({ page }) => {
  await expectContentCardToFillPage(page, '/commerce/store', '.admin-page-fill-card');
});

test('editor cards fill to the bottom of the page', async ({ page }) => {
  await expectContentCardToFillPage(page, '/operation/notices/create', '.admin-list-card');
});

test('mail auto-send table viewport fills to the card bottom', async ({ page }) => {
  await expectTableViewportToFillCard(
    page,
    '/messages/mail?tab=auto',
    '.admin-list-card',
    '.admin-list-card .admin-data-table .ant-table-content'
  );
});

test('push auto-send table viewport fills to the card bottom', async ({ page }) => {
  await expectTableViewportToFillCard(
    page,
    '/messages/push?tab=auto',
    '.admin-list-card',
    '.admin-list-card .admin-data-table .ant-table-content'
  );
});

test('events table viewport fills to the card bottom', async ({ page }) => {
  await expectTableViewportToFillCard(
    page,
    '/operation/events',
    '.admin-list-card',
    '.admin-list-card .admin-data-table .ant-table-content'
  );
});

test('table wrapper and pagination stay within the card width', async ({ page }) => {
  await expectTableLayoutToStayWithinCard(page, '/users', '.admin-list-card', [
    '.admin-list-card .admin-data-table .ant-spin-nested-loading',
    '.admin-list-card .ant-pagination'
  ]);
});
