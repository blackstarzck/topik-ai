import { expect, test, type Response } from '@playwright/test';

const adminEmail = process.env.E2E_ADMIN_EMAIL;
const adminPassword = process.env.E2E_ADMIN_PASSWORD;
const expectedCoverageKeys = [
  'metadataEligibleSubmissions',
  'metadataMappedSubmissions',
  'metadataEligibleEvents',
  'metadataMappedEvents',
  'metadataEligibleProblems',
  'metadataMappedProblems'
] as const;

test.beforeAll(() => {
  if (!adminEmail || !adminPassword) {
    throw new Error('E2E_ADMIN_EMAIL and E2E_ADMIN_PASSWORD are required.');
  }
});

test('dev DB의 metadata coverage 계약이 화면 오류 없이 복원된다', async ({ page }) => {
  const analyticsResponses: Response[] = [];
  const rpcFailures: string[] = [];

  page.on('response', (response) => {
    if (!response.url().includes('/rest/v1/rpc/get_admin_learning_analytics_filtered')) {
      return;
    }
    analyticsResponses.push(response);
    if (response.status() >= 400) {
      rpcFailures.push(`${response.status()} ${response.url()}`);
    }
  });

  await page.goto('/analytics/learning');
  if (await page.getByRole('heading', { name: 'TOPIK 관리자 로그인' }).isVisible()) {
    await page.getByLabel('이메일').fill(adminEmail ?? '');
    await page.getByLabel('비밀번호').fill(adminPassword ?? '');
    await page.getByRole('button', { name: '로그인' }).click();
  }

  await expect(page.getByRole('heading', { name: '학습 분석' })).toBeVisible();
  await expect.poll(() => analyticsResponses.length).toBeGreaterThan(0);
  await expect(page.locator('.analytics-kpi-card')).toHaveCount(8);
  await expect(page.getByTestId('metadata-coverage-unavailable')).toHaveCount(0);
  await expect(page.locator('[data-testid^="metadata-coverage-warning-"]')).toHaveCount(0);
  expect(rpcFailures).toEqual([]);

  const latestResponse = analyticsResponses.at(-1);
  expect(latestResponse?.status()).toBe(200);
  const rows = await latestResponse?.json() as Array<{
    summary?: Record<string, unknown>;
    topic_stats?: Array<{ questionNo?: unknown }>;
  }> | undefined;
  const row = rows?.[0];

  expect(row).toBeDefined();
  for (const key of expectedCoverageKeys) {
    expect(row?.summary).toHaveProperty(key);
    expect(row?.summary?.[key]).toEqual(expect.any(Number));
  }
  expect(row?.topic_stats?.length).toBeGreaterThan(0);
  expect(row?.topic_stats?.every((topic) => Number.isInteger(topic.questionNo))).toBe(true);
});
