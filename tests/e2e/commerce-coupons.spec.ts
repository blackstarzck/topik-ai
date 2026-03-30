import { expect, test } from '@playwright/test';

test('정기 쿠폰 템플릿 생성이 동작하고 쿠폰 노출 설정은 노출되지 않는다', async ({ page }) => {
  await page.goto('/commerce/coupons');

  await expect(page.getByRole('heading', { name: '쿠폰' })).toBeVisible();
  await page.getByRole('tab', { name: '정기 쿠폰 템플릿' }).click();
  await expect(page.getByPlaceholder('정기 쿠폰명')).toBeVisible();

  await page.getByRole('button', { name: '쿠폰 만들기' }).click();
  await page.getByText('정기 쿠폰 템플릿 만들기').click();

  await expect(
    page.getByRole('heading', { name: '정기 쿠폰 템플릿 등록' })
  ).toBeVisible();

  const templateName = `정기 QA 쿠폰 ${Date.now()}`;
  await page.getByPlaceholder('정기 쿠폰명을 입력해 주세요.').fill(templateName);
  await page.getByRole('button', { name: '템플릿 생성' }).click();

  await expect(page.getByText('정기 쿠폰 템플릿을 생성했어요')).toBeVisible();
  await expect(
    page.getByRole('cell', { name: new RegExp(`${templateName}.*금액 할인`) })
  ).toBeVisible();
  await page.getByRole('dialog').getByRole('button', { name: '닫기' }).click();
  await expect(page.getByRole('dialog')).not.toBeVisible();

  await expect(page.getByRole('button', { name: '쿠폰 노출 설정' })).toHaveCount(0);
});
