import { expect, test } from '@playwright/test';

test('부분 연결을 현재·직전 기간의 제출·이벤트별로 구분해 경고한다', async ({ page }) => {
  await page.goto('/analytics/learning?period=30d&compare=1&question=51&question=53');

  for (const testId of [
    'metadata-coverage-warning-current-submissions',
    'metadata-coverage-warning-previous-submissions',
    'metadata-coverage-warning-current-events',
    'metadata-coverage-warning-previous-events'
  ]) {
    const warning = page.getByTestId(testId);
    await expect(warning).toBeVisible();
    await expect(warning).toContainText(/연결 [\d,]+건 \/ 대상 [\d,]+건/);
  }
  await expect(page.getByTestId('metadata-coverage-unavailable')).toHaveCount(0);
});

test('직전 비교를 끄면 현재 기간 경고만 표시한다', async ({ page }) => {
  await page.goto('/analytics/learning?period=30d&compare=0&question=51&question=53');

  await expect(page.getByTestId('metadata-coverage-warning-current-submissions')).toBeVisible();
  await expect(page.getByTestId('metadata-coverage-warning-current-events')).toBeVisible();
  await expect(page.getByTestId('metadata-coverage-warning-previous-submissions')).toHaveCount(0);
  await expect(page.getByTestId('metadata-coverage-warning-previous-events')).toHaveCount(0);
  await expect(page.getByTestId('metadata-coverage-unavailable')).toHaveCount(0);
});
