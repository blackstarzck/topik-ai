import { expect, test } from '@playwright/test';

test('미인증 회원은 가입 대기와 약관 동의 불가로 표시한다', async ({
  page
}) => {
  await page.goto('/users?keyword=member17%40topik.ai');

  await expect(page.getByRole('heading', { name: '회원 목록' })).toBeVisible();
  await expect(page.getByText('회원 상태').first()).toBeVisible();
  await expect(page.getByText('이메일 인증').first()).toBeVisible();

  const unverifiedRow = page
    .locator('tbody tr', { hasText: 'member17@topik.ai' })
    .first();
  await expect(unverifiedRow).toBeVisible();
  await expect(unverifiedRow.getByText('인증 대기', { exact: true })).toBeVisible();
  await expect(unverifiedRow.getByText('동의 불가', { exact: true })).toBeVisible();
  await expect(unverifiedRow.getByText('미인증', { exact: true })).toBeVisible();
  await expect(unverifiedRow.getByText('v13 백필 대상', { exact: true })).toHaveCount(0);
  await expect(unverifiedRow.getByText('원천 기록 있음', { exact: true })).toHaveCount(0);
  await expect(unverifiedRow.getByText('정상', { exact: true })).toHaveCount(0);
  await expect(unverifiedRow.getByText('동의 완료', { exact: true })).toHaveCount(0);

  await page.goto('/users/U00017?tab=profile');
  await expect(page.getByRole('heading', { name: 'Users 상세' })).toBeVisible();
  await expect(page.getByText('회원 상태', { exact: true })).toBeVisible();
  await expect(page.getByText('인증 대기', { exact: true })).toBeVisible();
  await expect(page.getByText('이메일 인증', { exact: true })).toBeVisible();
  await expect(page.getByText('미인증', { exact: true })).toBeVisible();
  await expect(page.getByText('약관 동의', { exact: true })).toBeVisible();
  await expect(page.getByText('동의 불가', { exact: true })).toBeVisible();
  await expect(page.getByText('가입 상태 진단', { exact: true })).toHaveCount(0);
  await expect(page.getByText(/v13 백필 검토/)).toHaveCount(0);

  await page.goto('/users/U00017?tab=learning');
  await expect(page.getByRole('tab', { name: '학습 현황' })).toHaveAttribute(
    'aria-selected',
    'true'
  );
  await expect(page.getByText('이메일 인증 대기', { exact: true })).toBeVisible();
  await expect(page.getByText('동의 불가', { exact: true })).toBeVisible();
});
