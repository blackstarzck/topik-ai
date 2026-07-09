import { expect, test } from '@playwright/test';

test('회원 목록은 성별/전화번호 컬럼과 내보내기 모달을 제공한다', async ({
  page
}) => {
  await page.goto('/users');

  await expect(page.getByRole('heading', { name: '회원 목록' })).toBeVisible();
  await expect(page.getByText('성별', { exact: true }).first()).toBeVisible();
  await expect(page.getByText('전화번호', { exact: true }).first()).toBeVisible();
  await expect(page.getByText('남성', { exact: true }).first()).toBeVisible();
  await expect(page.getByText(/\d{3}-\*{4}-\d{4}/).first()).toBeVisible();

  const exportButton = page.getByRole('button', { name: '회원 정보 내보내기' });
  await expect(exportButton).toBeVisible();
  await expect(exportButton).toHaveClass(/ant-btn-lg/);

  const searchBar = page.locator('.search-bar', { has: exportButton });
  const searchBarBox = await searchBar.boundingBox();
  const exportButtonBox = await exportButton.boundingBox();
  expect(searchBarBox).not.toBeNull();
  expect(exportButtonBox).not.toBeNull();
  expect(searchBarBox!.x + searchBarBox!.width - (exportButtonBox!.x + exportButtonBox!.width)).toBeLessThan(32);

  const footerTotal = page
    .locator('.users-table--footer-total-left .ant-pagination-total-text')
    .filter({ hasText: /^총 \d+건$/ });
  await expect(footerTotal).toBeVisible();
  const tableBox = await page.locator('.users-table--footer-total-left').boundingBox();
  const footerTotalBox = await footerTotal.boundingBox();
  expect(tableBox).not.toBeNull();
  expect(footerTotalBox).not.toBeNull();
  expect(footerTotalBox!.x).toBeLessThan(tableBox!.x + tableBox!.width * 0.25);

  await exportButton.click();

  const modal = page.locator('.ant-modal-content', {
    hasText: '회원 정보 내보내기'
  });
  await expect(modal).toBeVisible();
  await expect(modal.getByText('개인정보 반출 작업입니다')).toBeVisible();
  await expect(modal.getByText(/현재 목록 조건: 기관 소속: 전체 회원/)).toBeVisible();
  await expect(modal.getByText('대상 회원')).toBeVisible();
  await expect(modal.getByText('현재 목록 조건', { exact: true })).toBeVisible();
  await expect(modal.getByText('선택한 회원만 (0명)', { exact: true })).toBeVisible();
  await expect(modal.getByText('내보낼 컬럼')).toBeVisible();
  await expect(modal.getByLabel('사용자 ID')).toBeChecked();
  await expect(modal.getByLabel('사용자 ID')).toBeDisabled();
  await expect(modal.getByRole('checkbox', { name: '전화번호' })).toBeChecked();
  await expect(modal.getByRole('button', { name: '전체 선택' })).toBeVisible();
  await expect(modal.getByRole('button', { name: '선택 해제' })).toBeVisible();
  await modal.getByRole('button', { name: '선택 해제' }).click();
  await expect(modal.getByLabel('사용자 ID')).toBeChecked();
  await expect(modal.getByRole('checkbox', { name: '전화번호' })).not.toBeChecked();
  await modal.getByRole('button', { name: '전체 선택' }).click();
  await expect(modal.getByRole('checkbox', { name: '전화번호' })).toBeChecked();
  await expect(modal.getByText('내보내기 사유')).toBeVisible();
  await expect(modal.getByText('전화번호 처리')).toBeVisible();
  await expect(modal.getByText('마스킹(권장)')).toBeVisible();
  await expect(
    modal.getByText('원문 포함 — 파일에 전화번호 전체가 기록됩니다')
  ).toBeVisible();

  await modal.getByRole('button', { name: '취소' }).click();

  const firstDataRow = page.getByRole('row').filter({ has: page.getByRole('link') }).first();
  const firstDataRowCheckbox = firstDataRow.getByRole('checkbox');
  await firstDataRowCheckbox.click();
  await expect(firstDataRowCheckbox).toBeChecked();
  await exportButton.click();
  await expect(modal).toBeVisible();
  await expect(modal.getByText('선택한 회원만 (1명)', { exact: true })).toBeVisible();
  await expect(modal.getByLabel(/선택한 회원만/)).toBeEnabled();

  await modal.getByRole('checkbox', { name: '전화번호' }).uncheck();
  await expect(
    modal.getByText('전화번호 컬럼을 선택하지 않아 전화번호는 파일에 포함되지 않습니다.')
  ).toBeVisible();
  await expect(modal.getByLabel(/원문 포함/)).toBeDisabled();
  await modal.getByLabel('내보내기 사유').fill('E2E 컬럼 선택 다운로드 검증');
  const downloadPromise = page.waitForEvent('download');
  await modal.getByRole('button', { name: '엑셀 다운로드' }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toContain('회원정보_');
});

test('회원 상세 프로필은 성별/전화번호 항목을 표시한다', async ({ page }) => {
  await page.goto('/users/U00001?tab=profile');

  await expect(page.getByRole('heading', { name: 'Users 상세' })).toBeVisible();
  await expect(page.getByText('성별', { exact: true })).toBeVisible();
  await expect(page.getByText('남성', { exact: true })).toBeVisible();
  await expect(page.getByText('전화번호', { exact: true })).toBeVisible();
  await expect(page.getByText('010-1000-1000', { exact: true })).toBeVisible();
});
