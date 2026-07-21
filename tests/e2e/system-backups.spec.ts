import { expect, test } from '@playwright/test';

test('dashboard backup card is isolated and links authorized administrators to details', async ({
  page
}) => {
  await page.goto('/dashboard');

  const card = page.locator('.ant-card').filter({ hasText: '백업 상태' });
  await expect(card).toBeVisible();
  await expect(card).toContainText('종합 상태');
  await expect(card).toContainText('실행 시각');
  await expect(card.locator('.ant-table-tbody > tr.ant-table-row')).toHaveCount(4);
  await expect(card.getByRole('button', { name: '백업 관리 보기' })).toBeVisible();

  await card.getByRole('button', { name: '백업 관리 보기' }).click();
  await expect(page).toHaveURL(/\/system\/backups$/);
  await expect(page.getByRole('heading', { name: '백업 관리' })).toBeVisible();
});

test('backup management keeps filters and selected detail in the URL and remains read-only', async ({
  page
}) => {
  await page.goto('/system/backups?result=partial_failure');

  await expect(page.getByText('부분 실패', { exact: true }).first()).toBeVisible();
  await expect(page.getByText('운영 백업 상태의 개발환경 복사본입니다.')).toBeVisible();
  await expect(page.getByRole('button', { name: /백업 실행|복원 실행/ })).toHaveCount(0);

  const row = page.locator('tbody tr').filter({ hasText: '부분 실패' }).first();
  await row.click();
  await expect.poll(() => new URL(page.url()).searchParams.get('runId')).not.toBeNull();

  const drawer = page.locator('.ant-drawer-content');
  await expect(drawer).toBeVisible();
  await expect(drawer).toContainText('데이터베이스 검사');
  await expect(drawer).toContainText('파일 저장소 검사');
  await expect(drawer.getByRole('link', { name: '연결된 시스템 로그 보기' })).toBeVisible();
  await expect.poll(() => new URL(page.url()).searchParams.get('result')).toBe('partial_failure');
});

test('backup list exposes running, failed, delayed, and no-component-record states', async ({ page }) => {
  await page.goto('/system/backups');

  for (const label of ['진행 중', '실패', '지연', '기록 없음']) {
    await expect(page.getByText(label, { exact: true }).first()).toBeVisible();
  }
});
