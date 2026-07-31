import { expect, test, type Page } from '@playwright/test';

/**
 * Users > 기관 코드 — 기관 단위 노출 모드(`제한 없음` / `배정분만`) — D-12 모크 모드.
 *
 * mock 시드 의도(mock-institution-codes.ts):
 *   · EXPO2026-BOOTH-A  모드 원장에 행 없음 → `배정분만`, 배정 0건, 회원 0명
 *   · EXPO2026-BOOTH-B  `제한 없음`, 배정 1건, 회원 0명
 *   · CONVENTION-VN     `제한 없음`, 배정 0건, 회원 130명  ← 배정분만 전환 차단 케이스
 * Supabase 구성 실행은 로그인 자격이 없어 skip.
 */
async function openList(page: Page): Promise<void> {
  await page.goto('/users/institution-codes');
  const loginHeading = page.getByRole('heading', { name: 'TOPIK 관리자 로그인' });
  if (await loginHeading.isVisible().catch(() => false)) {
    test.skip(true, 'Supabase auth is configured for this run; login is not part of this e2e.');
  }
}

function row(page: Page, code: string) {
  return page.locator('tbody tr.ant-table-row').filter({ hasText: code });
}

async function openEditModal(page: Page, code: string) {
  await row(page, code).getByRole('button', { name: '더보기' }).click();
  await page
    .locator('.table-action-menu__popup:visible')
    .getByRole('menuitem', { name: '수정', exact: true })
    .click();
  const modal = page.locator('.ant-modal-content').filter({ hasText: '기관 코드 수정 ·' });
  await expect(modal).toBeVisible();
  return modal;
}

test('목록: 노출 모드 컬럼과 배정 보존 표기를 렌더한다', async ({ page }) => {
  await openList(page);

  await expect(page.getByRole('columnheader', { name: /노출 모드/ })).toBeVisible();

  // 행 없음 → 기본값 해석
  await expect(row(page, 'EXPO2026-BOOTH-A').getByText('배정분만')).toBeVisible();
  // 제한 없음 + 배정 1건 → "보존" 표기로 모드 복귀 시 살아난다는 약속을 남긴다
  await expect(row(page, 'EXPO2026-BOOTH-B').getByText('제한 없음')).toBeVisible();
  await expect(row(page, 'EXPO2026-BOOTH-B').getByText('배정 2건 보존')).toBeVisible();
  // 제한 없음 + 배정 0건 → 보조 문구 없음
  await expect(row(page, 'CONVENTION-VN').getByText('제한 없음')).toBeVisible();
});

/*
 * 컬럼 필터는 e2e 로 덮지 않는다. `createDefinedColumnFilterProps` 는 형제 컬럼
 * (`종류`·`상태`)이 이미 동일하게 쓰는 공용 유틸이고 그쪽도 e2e 커버가 없다.
 * antd 필터 드롭다운을 구동하는 테스트는 위젯 구조에 취약한 반면, 값이 올바르게
 * 렌더되는지는 위 "노출 모드 컬럼" 테스트가 이미 증명한다.
 */

test('수정 모달: 배정 0건 + 회원 있음이면 배정분만 전환을 차단한다', async ({ page }) => {
  await openList(page);
  const modal = await openEditModal(page, 'CONVENTION-VN');

  // 현재 제한 없음 → 수정 가능
  await expect(modal.getByRole('button', { name: '수정' })).toBeEnabled();

  await modal.getByRole('radio', { name: '배정분만' }).check();
  await expect(
    modal.getByText(
      '배정된 문항이 0건입니다. 지금 배정분만으로 바꾸면 이 코드 소속 학습자 130명에게 쓰기 문항이 한 건도 보이지 않습니다.'
    )
  ).toBeVisible();
  await expect(modal.getByRole('button', { name: '노출 문항 열기' })).toBeVisible();
  await expect(modal.getByRole('button', { name: '수정' })).toBeDisabled();

  // 제한 없음으로 되돌리면 즉시 해제된다.
  await modal.getByRole('radio', { name: '제한 없음' }).check();
  await expect(modal.getByRole('button', { name: '수정' })).toBeEnabled();
});

test('수정 모달: 배정이 있는 배정분만 코드는 경고 없이 수정 가능하다', async ({ page }) => {
  await openList(page);
  const modal = await openEditModal(page, 'EXPO2026-BOOTH-A');

  // A부스는 모드 원장 행이 없어 실효 모드가 기본값(배정분만)으로 초기화된다.
  await expect(modal.getByRole('radio', { name: '배정분만' })).toBeChecked();
  // 배정이 1건 있으므로 빈 화면 위험이 없다 → 차단·경고 Alert 모두 뜨지 않아야 한다.
  await expect(modal.getByText(/배정된 문항이 0건입니다/)).toHaveCount(0);
  await expect(modal.getByRole('button', { name: '수정' })).toBeEnabled();
});

test('수정 모달: 모드를 바꿔도 배정 건수는 보존된다(모크)', async ({ page }) => {
  await openList(page);
  await expect(row(page, 'EXPO2026-BOOTH-B').getByText('배정 2건 보존')).toBeVisible();

  const modal = await openEditModal(page, 'EXPO2026-BOOTH-B');
  await modal.getByRole('radio', { name: '배정분만' }).check();
  await modal.getByPlaceholder('감사 로그에 기록됩니다.').fill('e2e: 모드 왕복');
  await modal.getByRole('button', { name: '수정' }).click();

  await expect(page.getByText(/기관 코드 수정 완료/)).toBeVisible();
  // 모드는 바뀌고 배정 건수는 그대로여야 한다 — 모드 전환이 배정을 지우지 않는다는 계약.
  await expect(row(page, 'EXPO2026-BOOTH-B').getByText('배정분만')).toBeVisible();
  await expect(row(page, 'EXPO2026-BOOTH-B').getByText('배정 2건')).toBeVisible();
});

test('생성: 실제 기본값인 배정분만을 안내하고 생성 행에도 그대로 반영한다', async ({ page }) => {
  await openList(page);
  await page.getByRole('button', { name: '코드 생성' }).click();

  const modal = page.locator('.ant-modal-content').filter({ hasText: '기관 코드 생성' });
  await expect(modal).toBeVisible();
  await expect(modal.getByText('배정분만', { exact: true })).toBeVisible();
  await expect(
    modal.getByText(
      '새 코드는 배정분만으로 시작합니다. 회원 소속·초대 전에 노출 문항을 최소 1건 배정하거나, 수정에서 제한 없음으로 바꾸세요.'
    )
  ).toBeVisible();
  // 입력 컨트롤이 아니어야 한다(라디오 없음).
  await expect(modal.getByRole('radio', { name: '배정분만' })).toHaveCount(0);

  await modal.getByPlaceholder('EXPO2026-BOOTH-A').fill('EXPO2026-NEW');
  await modal.getByPlaceholder('2026 한국어교육 박람회 · A부스').fill('2026 신규 박람회');
  await modal.getByRole('button', { name: '생성' }).click();

  await expect(page.getByText(/기관 코드 생성 완료/)).toBeVisible();
  await expect(row(page, 'EXPO2026-NEW').getByText('배정분만')).toBeVisible();
});
