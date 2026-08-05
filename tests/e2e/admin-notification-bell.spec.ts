import { expect, test } from '@playwright/test';

/**
 * 관리자 셸 알림 벨 — 모크 모드.
 *
 * 모크 경로는 **빈 알림함**이다(가짜 알림을 시드하지 않는다 — 알림은 서버 tick 이 계약
 * 만료를 판정해 적재하는 것이고, mock 에 임의 알림을 넣으면 "왜 이 알림이 왔는가"가
 * 화면만 보고 설명되지 않는다). 그래서 이 스펙이 지키는 것은 **셸 배선과 빈 상태**다:
 * 벨이 모든 페이지의 헤더에 있고, 미읽음 0이면 배지가 없고, 열면 빈 상태를 보여주며
 * `모두 읽음` 이 비활성이다. 적재·dedup·버킷 판정은 DB 계층에서 검증한다.
 */

test('알림 벨은 셸 헤더에 있고 미읽음 0이면 배지를 띄우지 않는다', async ({ page }) => {
  await page.goto('/dashboard');
  const loginHeading = page.getByRole('heading', { name: 'TOPIK 관리자 로그인' });
  if (await loginHeading.isVisible().catch(() => false)) {
    test.skip(true, 'Supabase auth is configured for this run; login is not part of this e2e.');
  }

  const bell = page.getByTestId('admin-notification-bell');
  await expect(bell).toBeVisible();
  // 미읽음이 0이면 aria-label 에 건수를 붙이지 않는다(스크린리더에 없는 수를 읽어주지 않는다).
  await expect(bell).toHaveAttribute('aria-label', '알림');
  await expect(page.locator('.ant-badge-count')).toHaveCount(0);
});

test('벨을 열면 빈 상태를 보여주고 모두 읽음이 비활성이다', async ({ page }) => {
  await page.goto('/dashboard');
  const loginHeading = page.getByRole('heading', { name: 'TOPIK 관리자 로그인' });
  if (await loginHeading.isVisible().catch(() => false)) {
    test.skip(true, 'Supabase auth is configured for this run; login is not part of this e2e.');
  }

  await page.getByTestId('admin-notification-bell').click();
  const panel = page.getByTestId('admin-notification-panel');
  await expect(panel).toBeVisible();
  await expect(panel.getByText('알림이 없습니다.')).toBeVisible();
  await expect(panel.getByRole('button', { name: '모두 읽음' })).toBeDisabled();
});

test('벨은 다른 화면으로 이동해도 헤더에 남는다', async ({ page }) => {
  await page.goto('/users/institution-codes');
  const loginHeading = page.getByRole('heading', { name: 'TOPIK 관리자 로그인' });
  if (await loginHeading.isVisible().catch(() => false)) {
    test.skip(true, 'Supabase auth is configured for this run; login is not part of this e2e.');
  }

  await expect(page.getByTestId('admin-notification-bell')).toBeVisible();
  // 세션 태그와 벨이 같은 우측 그룹에 있어 헤더 레이아웃이 깨지지 않는다.
  await expect(page.getByText('현재 세션:', { exact: false })).toBeVisible();
});
