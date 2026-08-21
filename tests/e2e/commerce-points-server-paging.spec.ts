import { expect, test } from '@playwright/test';

/**
 * 포인트 화면 서버 페이징 계약.
 *
 * 전량 조회 + 클라이언트 필터·정렬·페이징을 서버로 옮기면서 **조용히 깨질 수 있는 것**들을
 * 고정한다(gap-register §3.18):
 *
 * - 요약 카드는 **필터 무관 전체 기준**이다. 필터를 적용해 세면 카드가 자기 자신을 0 으로
 *   만든다(상태 필터 역할이므로).
 * - 툴바 `총 N건`·페이지네이션 총량은 **필터 적용 후 전체 건수**다(현재 페이지 길이가 아니다).
 * - `selected` 는 **현재 페이지 밖의 id** 일 수 있다. 이전 배선은 목록에서 못 찾으면 URL 에서
 *   지웠는데, 페이징에서는 정상 링크까지 지워진다 → 단건 조회로 복원해야 한다.
 */
const CARD = '.list-summary-card';
const ROW = 'tr.ant-table-row';

test('요약 카드는 필터를 적용해도 전체 기준을 유지한다', async ({ page }) => {
  await page.goto('/commerce/points');

  const allCard = page.locator(CARD, { hasText: '전체 정책' });
  await expect(allCard).toContainText('4건');
  await expect(page.locator(ROW)).toHaveCount(4);

  // 상태 카드 클릭 = 서버 필터
  await page.locator(CARD, { hasText: '운영 중 정책' }).click();
  await expect(page).toHaveURL(/policyStatus=/);
  await expect(page.locator(ROW)).toHaveCount(2);

  // 🚨 필터가 걸린 뒤에도 전체 카드는 4건이어야 한다(필터로 세면 2건이 된다).
  await expect(allCard).toContainText('4건');
});

test('탭 라벨과 툴바 건수가 서버 수치를 쓴다', async ({ page }) => {
  await page.goto('/commerce/points');

  await expect(page.locator('.ant-tabs-tab', { hasText: '정책' })).toContainText('4');
  await expect(page.locator('.ant-tabs-tab', { hasText: '포인트 원장' })).toContainText('8');
  await expect(page.locator('.ant-tabs-tab', { hasText: '소멸 예정' })).toContainText('5');

  await page.locator('.ant-tabs-tab', { hasText: '포인트 원장' }).click();
  await expect(page).toHaveURL(/tab=ledger/);
  await expect(page.locator(ROW)).toHaveCount(8);
  await expect(page.locator(CARD, { hasText: '전체 원장' })).toContainText('8건');
});

test('열거형 컬럼 정렬이 서버 조건으로 나간다', async ({ page }) => {
  await page.goto('/commerce/points');

  await page.locator('th', { hasText: '상태' }).first().click();
  await expect(page).toHaveURL(/policySortField=status/);
  await expect(page).toHaveURL(/policySortOrder=ascend/);
  await expect(page.locator(ROW)).toHaveCount(4);
});

test('현재 페이지 밖의 selected 도 단건 조회로 복원한다', async ({ page }) => {
  // 취소 상태만 남기는 필터 + 완료 건을 selected 로 → 페이지에 없는 id
  await page.goto('/commerce/points?tab=ledger&ledgerStatus=%EC%B7%A8%EC%86%8C&selected=PL-2008');

  await expect(page.locator(ROW)).toHaveCount(1);
  await expect(page.locator(`${ROW}[data-row-key="PL-2008"]`)).toHaveCount(0);

  const drawer = page.locator('.ant-drawer-body');
  await expect(drawer).toBeVisible();
  await expect(drawer).toContainText('PL-2008');
  // 🚨 정상 링크를 지우지 않는다.
  await expect(page).toHaveURL(/selected=PL-2008/);
});

test('존재하지 않는 selected 는 URL 에서 정리한다', async ({ page }) => {
  await page.goto('/commerce/points?tab=ledger&selected=PL-9999');

  await expect(page.locator(ROW)).toHaveCount(8);
  await expect(page.locator('.ant-drawer-body')).toHaveCount(0);
  await expect(page).not.toHaveURL(/selected=PL-9999/);
});

test('보류 모달 후보는 목록 페이지가 아니라 보류 가능 전체에서 온다', async ({ page }) => {
  // 취소만 보이게 필터해도(현재 페이지에 예정·보류 0건) 후보 목록은 채워져야 한다.
  await page.goto(
    '/commerce/points?tab=expiration&expirationStatus=%EC%99%84%EB%A3%8C'
  );

  await page.getByRole('button', { name: '소멸 보류 등록' }).click();
  const modal = page.locator('.ant-modal-content');
  await expect(modal).toBeVisible();

  await modal.locator('.ant-select').first().click();
  // 후보가 하나라도 있어야 한다 — 페이지 행만 썼다면 0개다.
  await expect(page.locator('.ant-select-item-option').first()).toBeVisible();
});
