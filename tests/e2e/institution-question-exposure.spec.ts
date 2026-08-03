import { expect, test, type Page, type Locator } from '@playwright/test';

/**
 * 기관 중심 노출 문항 관리(회원 > 기관 코드 > 상세 `노출 문항` 탭) — D-12 모크 모드.
 * 좌우 antd Tree(유형>주제>문항) Transfer형. 좌 트리에서 체크 → ›로 노출 추가,
 * 우측 트리에서 유형/주제/문항 체크 → ‹로 제거, 다른 기관 설정 불러오기.
 * 모크는 화면 왕복만 재현(실DB·감사 없음).
 * Supabase 구성 실행은 로그인 자격이 없어 skip.
 *
 * 스코프는 패널 testid 로 잡는다 — 같은 탭 위쪽에 노출 모드 섹션이 함께 있어서
 * (사유 입력·라디오가 중복되므로) 페이지 전체를 스코프로 쓰면 모호해진다.
 */
async function skipIfAuthRequired(page: Page): Promise<void> {
  const loginHeading = page.getByRole('heading', { name: 'TOPIK 관리자 로그인' });
  if (await loginHeading.isVisible().catch(() => false)) {
    test.skip(true, 'Supabase auth is configured for this run; login is not part of this e2e.');
  }
}

async function openPanelFor(page: Page, code?: string): Promise<Locator> {
  await page.goto('/users/institution-codes');
  await skipIfAuthRequired(page);
  const targetRow = code
    ? page.locator('tbody tr.ant-table-row').filter({ hasText: code })
    : page.locator('tbody tr.ant-table-row').first();
  await targetRow.getByRole('button', { name: '더보기' }).click();
  await page
    .locator('.table-action-menu__popup:visible')
    .getByRole('menuitem', { name: '노출 문항', exact: true })
    .click();
  await expect(page).toHaveURL(/\/users\/institution-codes\/[^/?]+\?tab=questions$/);
  const panel = page.getByTestId('institution-question-exposure-panel');
  await expect(panel).toBeVisible();
  return panel;
}

test('노출 문항 탭: 좌우 유형 트리를 렌더한다', async ({ page }) => {
  const panel = await openPanelFor(page);

  await expect(
    panel.getByText('추가 후보 · 3건 (추가 가능 2건 · 비활성 1건)')
  ).toBeVisible();
  await expect(
    panel.getByText('노출 선택 · 배정 0건 / 전역 미노출 1건')
  ).toBeVisible();
  await expect(panel.getByText('전역 미노출')).toBeVisible();
  await expect(panel.getByText('51번 · 빈칸 완성')).toBeVisible();
  await expect(panel.getByText('52번 · 연결 표현')).toBeVisible();
  // 변경 없으면 적용 비활성.
  await expect(panel.getByRole('button', { name: /적용/ })).toBeDisabled();
});

/**
 * A부스는 모드 원장에 행이 없어 `배정분만` 로 해석된다(mock 시드 의도).
 * 이 두 문구는 모드에 따라 거짓이 되는 지점이라 회귀 가치가 가장 높다.
 */
test('노출 문항 탭: 배정분만 모드 문구를 고정한다', async ({ page }) => {
  const panel = await openPanelFor(page);

  await expect(
    panel.getByText(
      '배정분만 모드입니다. 이 기관 소속 학습자는 여기서 배정한 문항만 봅니다. 소속 없는 학습자는 노출 허용한 문항을 모두 봅니다.'
    )
  ).toBeVisible();
  await expect(panel.getByText('배정분만', { exact: true })).toBeVisible();

  // 우패널을 비워 빈 상태 문구를 드러낸다(시드 1건은 전역 미노출 항목).
  await panel.getByPlaceholder('노출 문항 검색').fill('9901');
  const rightPanel = panel.getByTestId('institution-question-right-panel');
  await rightPanel.getByRole('treeitem', { name: /9901/ }).locator('.ant-tree-checkbox').click();
  await panel.getByRole('button', { name: '노출에서 제거' }).click();
  await panel.getByPlaceholder('노출 문항 검색').fill('');

  await expect(
    panel.getByText(
      '배정된 문항이 없습니다. 이 기관 소속 학습자에게는 쓰기 문항이 표시되지 않습니다.'
    )
  ).toBeVisible();
});

/** B부스는 `제한 없음` 시드 → warning 승격 + 배정 편집이 여전히 가능해야 한다. */
test('노출 문항 탭: 제한 없음 모드는 경고로 알리되 배정 편집은 막지 않는다', async ({
  page
}) => {
  const panel = await openPanelFor(page, 'EXPO2026-BOOTH-B');

  await expect(
    panel.getByText(
      '제한 없음 모드입니다. 이 기관 소속 학습자도 노출 허용한 문항을 모두 보므로, 아래 배정은 지금 학습자 화면에 영향을 주지 않습니다.'
    )
  ).toBeVisible();
  await expect(
    panel.getByText('배정분만으로 바꾸면 그때 적용됩니다. 모드는 이 탭 위쪽 노출 모드에서 바꿉니다.')
  ).toBeVisible();
  await expect(panel.getByText('제한 없음', { exact: true })).toBeVisible();

  // disable 하지 않기로 한 판단을 테스트로 고정한다 — `제한 없음` 이어도 배정 편집이
  // 살아 있어야 한다(의도된 동선이 "먼저 배정 → 그다음 배정분만 전환"이라 잠그면 데드락).
  // B부스는 시드 2건이 모두 배정돼 있어 좌패널에 추가 후보가 없다 → 우패널로 검증한다.
  await panel.getByPlaceholder('노출 문항 검색').fill('9901');
  await panel
    .getByTestId('institution-question-right-panel')
    .getByRole('treeitem', { name: /9901/ })
    .first()
    .locator('.ant-tree-checkbox')
    .click();
  await expect(panel.getByRole('button', { name: '노출에서 제거' })).toBeEnabled();
});

test('노출 문항 탭: 전역 비활성 문항은 추가 불가로 표시한다(모크)', async ({
  page
}) => {
  const panel = await openPanelFor(page);

  await panel.getByPlaceholder('유형·주제·문항 검색').fill('53-9901');
  await expect(panel.getByText('추가 불가')).toBeVisible();
  await expect(panel.getByText('내부 테스트')).toBeVisible();
  await expect(panel.locator('.ant-tree-checkbox-disabled')).toBeVisible();
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

test('노출 문항 탭: 트리 체크 → › 이동 → 적용 왕복(모크)', async ({ page }) => {
  const panel = await openPanelFor(page);

  // 검색으로 leaf를 펼쳐 노출(맨 끝 체크박스 = 문항 leaf)을 체크.
  await panel.getByPlaceholder('유형·주제·문항 검색').fill('51-9901');
  await panel
    .getByTestId('institution-question-left-panel')
    .getByRole('treeitem', { name: /51-9901/ })
    .locator('.ant-tree-checkbox')
    .click();
  await panel.getByRole('button', { name: '노출에 추가' }).click();
  await expect(
    panel.getByText('노출 선택 · 배정 1건 / 전역 미노출 1건')
  ).toBeVisible();
  await expect(
    panel.getByText('추가 후보 · 2건 (추가 가능 1건 · 비활성 1건)')
  ).toBeVisible();
  await expect(panel.getByTestId('institution-question-left-panel')).toContainText(
    '문항이 없습니다.'
  );

  await panel.getByPlaceholder('감사 로그에 기록됩니다.').fill('e2e: 트리 이동 적용');
  await panel.getByRole('button', { name: /적용/ }).click();

  await expect(page.getByText(/노출 문항 추가 완료/)).toBeVisible();
  await expect(
    panel.getByText('노출 선택 · 배정 1건 / 전역 미노출 1건')
  ).toBeVisible();
});

test('노출 문항 탭: 우측 트리에서 유형 단위로 노출 해제한다(모크)', async ({ page }) => {
  const panel = await openPanelFor(page);

  await panel.locator('.ant-select-selector').click();
  await page
    .locator('.ant-select-item-option')
    .filter({ hasText: 'EXPO2026-BOOTH-B' })
    .click();
  await panel.getByRole('button', { name: '불러오기' }).click();
  await expect(
    panel.getByText('노출 선택 · 배정 1건 / 전역 미노출 1건')
  ).toBeVisible();

  const rightTree = panel.locator('.ant-tree').last();
  await expect(rightTree.getByText('51번 · 빈칸 완성')).toBeVisible();
  await expect(rightTree.getByText('52번 · 연결 표현')).toBeVisible();

  await rightTree.locator('.ant-tree-checkbox').first().click();
  await panel.getByRole('button', { name: '노출에서 제거' }).click();

  await expect(
    panel.getByText('노출 선택 · 배정 0건 / 전역 미노출 1건')
  ).toBeVisible();
  await expect(
    panel.getByText('추가 후보 · 3건 (추가 가능 2건 · 비활성 1건)')
  ).toBeVisible();
  await expect(rightTree.getByText('51번 · 빈칸 완성')).toHaveCount(0);
  await expect(rightTree.getByText('52번 · 연결 표현')).toBeVisible();
});

test('노출 문항 탭: 다른 기관 설정 불러오기(모크)', async ({ page }) => {
  const panel = await openPanelFor(page);
  await expect(
    panel.getByText('노출 선택 · 배정 0건 / 전역 미노출 1건')
  ).toBeVisible();

  // 소스 기관(B부스, 시드 2건 중 excluded 1건) 선택 후 덮어쓰기 → available 1건만 반영.
  await panel.locator('.ant-select-selector').click();
  await page
    .locator('.ant-select-item-option')
    .filter({ hasText: 'EXPO2026-BOOTH-B' })
    .click();
  await panel.getByRole('radio', { name: '덮어쓰기' }).check();
  await panel.getByRole('button', { name: '불러오기' }).click();

  await expect(
    panel.getByText('전역 노출 상태가 노출 가능이 아닌 문항 1건은 불러오지 않았습니다.')
  ).toBeVisible();
  await expect(panel.getByText('노출 선택 · 배정 1건')).toBeVisible();
  await expect(
    panel.getByText('추가 후보 · 3건 (추가 가능 1건 · 비활성 2건)')
  ).toBeVisible();
});
