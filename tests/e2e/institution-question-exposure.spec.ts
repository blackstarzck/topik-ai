import { expect, test, type Page, type Locator } from '@playwright/test';

/**
 * 기관 중심 노출 문항 관리(회원 > 기관 코드 > 노출 문항 모달) — D-12 모크 모드.
 * 좌우 antd Tree(유형>주제>문항) Transfer형. 좌 트리에서 체크 → ›로 노출 추가,
 * 우측 트리에서 유형/주제/문항 체크 → ‹로 제거, 다른 기관 설정 불러오기.
 * 모크는 화면 왕복만 재현(실DB·감사 없음).
 * Supabase 구성 실행은 로그인 자격이 없어 skip.
 */
async function skipIfAuthRequired(page: Page): Promise<void> {
  const loginHeading = page.getByRole('heading', { name: 'TOPIK 관리자 로그인' });
  if (await loginHeading.isVisible().catch(() => false)) {
    test.skip(true, 'Supabase auth is configured for this run; login is not part of this e2e.');
  }
}

async function openModal(page: Page): Promise<Locator> {
  await page.goto('/users/institution-codes');
  await skipIfAuthRequired(page);
  const firstRow = page.locator('tbody tr.ant-table-row').first();
  await firstRow.getByRole('button', { name: '더보기' }).click();
  await page
    .locator('.table-action-menu__popup:visible')
    .getByRole('menuitem', { name: '노출 문항', exact: true })
    .click();
  const modal = page.locator('.ant-modal-content').filter({ hasText: '노출 문항 ·' });
  await expect(modal).toBeVisible();
  return modal;
}

test('노출 문항 모달: 좌우 유형 트리를 렌더한다', async ({ page }) => {
  const modal = await openModal(page);

  await expect(
    modal.getByText('추가 후보 · 3건 (추가 가능 2건 · 비활성 1건)')
  ).toBeVisible();
  await expect(
    modal.getByText('노출 선택 · 배정 0건 / 전역 미노출 1건')
  ).toBeVisible();
  await expect(modal.getByText('전역 미노출')).toBeVisible();
  await expect(modal.getByText('51번 · 빈칸 완성')).toBeVisible();
  await expect(modal.getByText('52번 · 연결 표현')).toBeVisible();
  // 변경 없으면 적용 비활성.
  await expect(modal.getByRole('button', { name: /적용/ })).toBeDisabled();
});

test('노출 문항 모달: 전역 비활성 문항은 추가 불가로 표시한다(모크)', async ({
  page
}) => {
  const modal = await openModal(page);

  await modal.getByPlaceholder('유형·주제·문항 검색').fill('53-9901');
  await expect(modal.getByText('추가 불가')).toBeVisible();
  await expect(modal.getByText('내부 테스트')).toBeVisible();
  await expect(modal.locator('.ant-tree-checkbox-disabled')).toBeVisible();
});

test('기관 코드 삭제: 확인 사유 후 목록에서 제거하고 감사 링크를 노출한다(모크)', async ({ page }) => {
  await page.goto('/users/institution-codes');
  await skipIfAuthRequired(page);

  const targetRow = page
    .locator('tbody tr.ant-table-row')
    .filter({ hasText: 'EXPO2026-BOOTH-A' });
  await expect(targetRow).toBeVisible();

  await targetRow.getByRole('button', { name: '더보기' }).click();
  const dropdown = page.locator('.table-action-menu__popup:visible');
  await expect(dropdown.getByRole('menuitem', { name: '회원 관리', exact: true })).toBeVisible();
  await expect(dropdown.getByRole('menuitem', { name: '노출 문항', exact: true })).toBeVisible();
  await expect(dropdown.getByRole('menuitem', { name: '수정', exact: true })).toBeVisible();

  const footer = page.locator('.table-action-menu__footer:visible');
  const deleteButton = footer.getByRole('button', { name: '삭제' });
  await expect(footer).toBeVisible();
  await expect(deleteButton).toBeVisible();
  await expect
    .poll(() => footer.evaluate((element) => window.getComputedStyle(element).borderTopStyle))
    .toBe('solid');
  await expect
    .poll(() =>
      deleteButton.evaluate((element) => window.getComputedStyle(element).backgroundColor)
    )
    .toBe('rgb(255, 77, 79)');

  await deleteButton.click();

  const modal = page.locator('.ant-modal-content').filter({ hasText: '기관 코드 삭제' });
  await expect(modal).toBeVisible();
  await expect(modal).toContainText('대상 유형: 기관 코드');
  await expect(modal.getByRole('button', { name: '삭제 실행' })).toBeDisabled();

  await modal.getByPlaceholder('삭제 사유를 입력하세요.').fill('e2e: 기관 코드 삭제');
  await modal.getByRole('button', { name: '삭제 실행' }).click();

  const notice = page
    .locator('.ant-notification-notice')
    .filter({ hasText: '기관 코드 삭제 완료' });
  await expect(notice).toBeVisible();
  await expect(notice.getByRole('link', { name: '감사 로그 확인' })).toBeVisible();
  await expect(
    page.locator('tbody tr.ant-table-row').filter({ hasText: 'EXPO2026-BOOTH-A' })
  ).toHaveCount(0);
});

test('노출 문항 모달: 트리 체크 → › 이동 → 적용 왕복(모크)', async ({ page }) => {
  const modal = await openModal(page);

  // 검색으로 leaf를 펼쳐 노출(맨 끝 체크박스 = 문항 leaf)을 체크.
  await modal.getByPlaceholder('유형·주제·문항 검색').fill('51-9901');
  await modal
    .getByTestId('institution-question-left-panel')
    .getByRole('treeitem', { name: /51-9901/ })
    .locator('.ant-tree-checkbox')
    .click();
  await modal.getByRole('button', { name: '노출에 추가' }).click();
  await expect(
    modal.getByText('노출 선택 · 배정 1건 / 전역 미노출 1건')
  ).toBeVisible();
  await expect(
    modal.getByText('추가 후보 · 2건 (추가 가능 1건 · 비활성 1건)')
  ).toBeVisible();
  await expect(modal.getByTestId('institution-question-left-panel')).toContainText(
    '문항이 없습니다.'
  );

  await modal.getByPlaceholder('감사 로그에 기록됩니다.').fill('e2e: 트리 이동 적용');
  await modal.getByRole('button', { name: /적용/ }).click();

  await expect(page.getByText(/노출 문항 추가 완료/)).toBeVisible();
  await expect(
    modal.getByText('노출 선택 · 배정 1건 / 전역 미노출 1건')
  ).toBeVisible();
});

test('노출 문항 모달: 우측 트리에서 유형 단위로 노출 해제한다(모크)', async ({ page }) => {
  const modal = await openModal(page);

  await modal.locator('.ant-select-selector').click();
  await page
    .locator('.ant-select-item-option')
    .filter({ hasText: 'EXPO2026-BOOTH-B' })
    .click();
  await modal.getByRole('button', { name: '불러오기' }).click();
  await expect(
    modal.getByText('노출 선택 · 배정 1건 / 전역 미노출 1건')
  ).toBeVisible();

  const rightTree = modal.locator('.ant-tree').last();
  await expect(rightTree.getByText('51번 · 빈칸 완성')).toBeVisible();
  await expect(rightTree.getByText('52번 · 연결 표현')).toBeVisible();

  await rightTree.locator('.ant-tree-checkbox').first().click();
  await modal.getByRole('button', { name: '노출에서 제거' }).click();

  await expect(
    modal.getByText('노출 선택 · 배정 0건 / 전역 미노출 1건')
  ).toBeVisible();
  await expect(
    modal.getByText('추가 후보 · 3건 (추가 가능 2건 · 비활성 1건)')
  ).toBeVisible();
  await expect(rightTree.getByText('51번 · 빈칸 완성')).toHaveCount(0);
  await expect(rightTree.getByText('52번 · 연결 표현')).toBeVisible();
});

test('노출 문항 모달: 다른 기관 설정 불러오기(모크)', async ({ page }) => {
  const modal = await openModal(page);
  await expect(
    modal.getByText('노출 선택 · 배정 0건 / 전역 미노출 1건')
  ).toBeVisible();

  // 소스 기관(B부스, 시드 2건 중 excluded 1건) 선택 후 덮어쓰기 → available 1건만 반영.
  await modal.locator('.ant-select-selector').click();
  await page
    .locator('.ant-select-item-option')
    .filter({ hasText: 'EXPO2026-BOOTH-B' })
    .click();
  await modal.getByRole('radio', { name: '덮어쓰기' }).check();
  await modal.getByRole('button', { name: '불러오기' }).click();

  await expect(
    modal.getByText('전역 노출 상태가 노출 가능이 아닌 문항 1건은 불러오지 않았습니다.')
  ).toBeVisible();
  await expect(modal.getByText('노출 선택 · 배정 1건')).toBeVisible();
  await expect(
    modal.getByText('추가 후보 · 3건 (추가 가능 1건 · 비활성 2건)')
  ).toBeVisible();
});
