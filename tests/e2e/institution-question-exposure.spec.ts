import { expect, test, type Page, type Locator } from '@playwright/test';

/**
 * 기관 중심 노출 문항 관리(회원 > 기관 코드 > 노출 문항 모달) — D-12 모크 모드.
 * antd Tree(유형>주제>문항) + 노출 선택 목록 Transfer형. 좌 트리에서 체크 → ›로 노출 추가,
 * 우측에서 ‹로 제거, 다른 기관 설정 불러오기. 모크는 화면 왕복만 재현(실DB·감사 없음).
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
  await firstRow.getByRole('button', { name: '노출 문항' }).click();
  const modal = page.locator('.ant-modal-content').filter({ hasText: '노출 문항 ·' });
  await expect(modal).toBeVisible();
  return modal;
}

test('노출 문항 모달: 유형 트리와 노출 선택 목록을 렌더한다', async ({ page }) => {
  const modal = await openModal(page);

  await expect(modal.getByText('노출 선택 · 0건')).toBeVisible();
  await expect(modal.getByText('51번 · 빈칸 완성')).toBeVisible();
  // 변경 없으면 적용 비활성.
  await expect(modal.getByRole('button', { name: /적용/ })).toBeDisabled();
});

test('노출 문항 모달: 트리 체크 → › 이동 → 적용 왕복(모크)', async ({ page }) => {
  const modal = await openModal(page);

  // 검색으로 leaf를 펼쳐 노출(맨 끝 체크박스 = 문항 leaf)을 체크.
  await modal.getByPlaceholder('유형·주제·문항 검색').fill('51-9901');
  await modal.locator('.ant-tree-checkbox').last().click();
  await modal.getByRole('button', { name: '노출에 추가' }).click();
  await expect(modal.getByText('노출 선택 · 1건')).toBeVisible();

  await modal.getByPlaceholder('감사 로그에 기록됩니다.').fill('e2e: 트리 이동 적용');
  await modal.getByRole('button', { name: /적용/ }).click();

  await expect(page.getByText(/노출 문항 추가 완료/)).toBeVisible();
  await expect(modal.getByText('노출 선택 · 1건')).toBeVisible();
});

test('노출 문항 모달: 다른 기관 설정 불러오기(모크)', async ({ page }) => {
  const modal = await openModal(page);
  await expect(modal.getByText('노출 선택 · 0건')).toBeVisible();

  // 소스 기관(B부스, 시드 2건) 선택 후 불러오기 → 우측 2건 반영.
  await modal.locator('.ant-select-selector').click();
  await page
    .locator('.ant-select-item-option')
    .filter({ hasText: 'EXPO2026-BOOTH-B' })
    .click();
  await modal.getByRole('button', { name: '불러오기' }).click();

  await expect(modal.getByText('노출 선택 · 2건')).toBeVisible();
});
