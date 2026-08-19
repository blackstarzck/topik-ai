import { expect, test } from '@playwright/test';

// Phase 3b 확산 2차: 사용자 리포트 목록이 useAsyncResource(enabled: canRead)로
// 전환된 뒤에도 mock 모드 성공 경로(권한 통과 → 시드 행 렌더)가 유지되는지 고정한다.
test('system reports list renders mock seed rows for a permitted admin', async ({
  page
}) => {
  await page.goto('/system/reports');

  await expect(page.getByRole('heading', { name: '사용자 리포트' })).toBeVisible();
  await expect(page.getByText('SR-0A1B2C3D4E5F6071')).toBeVisible();
  await expect(
    page.getByText('쓰기 제출 후 결과 화면이 계속 로딩됩니다')
  ).toBeVisible();
});
