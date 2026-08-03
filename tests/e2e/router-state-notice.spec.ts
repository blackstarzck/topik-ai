import { expect, test, type Page } from '@playwright/test';

/**
 * 등록/수정 화면이 router state 로 넘긴 "저장 완료" 알림이 **정확히 한 번** 뜨는지 고정한다.
 * 계약과 구현은 `src/shared/model/use-router-state-notice.ts` 단일 지점.
 *
 * 두 결함을 각각 실제 흐름으로 덮는다(2026-08-03 실측, 수정 전 상태):
 * - 공지: 소비 기록 ref 가 없어 StrictMode 이중 effect 실행으로 **알림 2개**. dev 전용이지만
 *   e2e 가 dev 서버를 쓰므로 Playwright strict-mode locator 위반까지 일으켰다.
 * - 쿠폰: state 를 지우지 않아 history 엔트리에 남고, 다른 화면에 갔다 뒤로 오면 리마운트로
 *   ref 가 리셋되어 **오래된 알림이 다시** 떴다. 프로덕션 빌드에서도 재현되던 쪽이다.
 */
function notices(page: Page) {
  return page.locator('.ant-notification-notice');
}

/**
 * 알림이 스스로 사라지길 기다린다. 닫기 버튼 클릭은 antd 종료 애니메이션과 경쟁해
 * `element is not stable` / `detached from the DOM` 으로 불안정하다.
 */
async function waitForNoticesToClear(page: Page): Promise<void> {
  await expect(notices(page)).toHaveCount(0, { timeout: 20_000 });
}

test('공지 등록 완료 알림은 정확히 한 번만 뜬다', async ({ page }) => {
  await page.goto('/operation/notices');
  await page.getByRole('button', { name: '공지 등록' }).click();

  await expect(page.getByRole('heading', { name: /공지/ }).first()).toBeVisible();
  await page
    .getByPlaceholder('공지 제목을 입력하세요.')
    .fill(`이중 알림 회귀 ${Date.now()}`);
  await page.frameLocator('iframe').locator('body').fill('회귀 테스트 본문');

  await page.getByRole('button', { name: '저장' }).click();

  await expect.poll(() => new URL(page.url()).pathname).toBe('/operation/notices');
  await expect(notices(page).first()).toBeVisible();
  // 두 번째 알림이 뒤늦게 올라올 여지를 준 뒤 개수를 센다 — 수정 전에는 여기서 2가 나왔다.
  await page.waitForTimeout(1_000);
  await expect(notices(page)).toHaveCount(1);
  await expect(page.getByText('공지 등록 완료')).toHaveCount(1);

  // state 를 지우므로 뒤로/앞으로 그 엔트리에 재진입해도 다시 뜨지 않는다.
  expect(await page.evaluate(() => window.history.state?.usr ?? null)).toBeNull();
});

test('쿠폰 템플릿 저장 알림은 다른 화면에 갔다 뒤로 와도 다시 뜨지 않는다', async ({ page }) => {
  await page.goto('/commerce/coupons');
  await page.getByRole('tab', { name: '정기 쿠폰 템플릿' }).click();

  await page.getByRole('button', { name: '쿠폰 만들기' }).click();
  await page.getByText('정기 쿠폰 템플릿 만들기').click();
  await expect(page.getByRole('heading', { name: '정기 쿠폰 템플릿 등록' })).toBeVisible();

  await page
    .getByPlaceholder('정기 쿠폰명을 입력해 주세요.')
    .fill(`재발화 회귀 ${Date.now()}`);
  await page.getByRole('button', { name: '템플릿 생성' }).click();

  await expect(page.getByText('정기 쿠폰 템플릿을 생성했어요')).toHaveCount(1);
  // 소비 즉시 state 를 비운다 — 이게 없으면 아래 재진입에서 알림이 되살아난다.
  expect(await page.evaluate(() => window.history.state?.usr ?? null)).toBeNull();

  await page.getByRole('dialog').getByRole('button', { name: '닫기' }).click();
  await waitForNoticesToClear(page);

  // 목록을 언마운트한 뒤 같은 history 엔트리로 되돌아온다.
  await page.locator('a[href="/commerce/payments"]').first().click();
  await expect.poll(() => new URL(page.url()).pathname).toBe('/commerce/payments');
  await page.goBack();
  await expect.poll(() => new URL(page.url()).pathname).toBe('/commerce/coupons');

  await page.waitForTimeout(1_000);
  await expect(notices(page)).toHaveCount(0);
});
