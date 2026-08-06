import { expect, test, type Page } from '@playwright/test';

/**
 * 기관 초대(동의 기반 소속 배정) — 모크 모드.
 * 3개 진입점(기관코드 상세 `회원` 탭 / 회원목록 일괄 초대 / 회원상세 기관탭)이
 * 즉시 배정 대신 초대 UI(라벨·안내문·대기 중 초대 섹션)로 렌더되는지 검증한다.
 * 모크는 화면 왕복만 재현(실DB·알림 발송 없음). Supabase 구성 실행은 로그인 자격이 없어 skip.
 */
async function skipIfAuthRequired(page: Page): Promise<void> {
  const loginHeading = page.getByRole('heading', { name: 'TOPIK 관리자 로그인' });
  if (await loginHeading.isVisible().catch(() => false)) {
    test.skip(true, 'Supabase auth is configured for this run; login is not part of this e2e.');
  }
}

test('기관코드 상세 회원 탭: 초대 폼과 통합 로스터(소속+대기 중 초대)를 렌더한다', async ({ page }) => {
  await page.goto('/users/institution-codes');
  await skipIfAuthRequired(page);

  const firstRow = page.locator('tbody tr.ant-table-row').first();
  await firstRow.getByRole('button', { name: '더보기' }).click();
  await page
    .locator('.table-action-menu__popup:visible')
    .getByRole('menuitem', { name: '회원 관리', exact: true })
    .click();

  // 모달이 아니라 상세 페이지 `회원` 탭으로 간다(2026-08-03 전용 페이지 전환).
  await expect(page).toHaveURL(/\/users\/institution-codes\/[^/?]+\?tab=members$/);
  const tabPanel = page.locator('.ant-tabs-tabpane-active');
  await expect(tabPanel).toBeVisible();

  // 본문은 로스터 하나다 — 초대(작업)와 정책(설정)은 툴바 뒤로 갔다(2026-08-06 재배치).
  // 통합 로스터 헤더(소속 회원 + 대기 중 초대를 한 테이블로 관리) + 상태 컬럼.
  await expect(
    tabPanel.getByText(/소속 회원 \d+명 · 대기 중 초대 \d+건/)
  ).toBeVisible();
  // antd 고정 헤더 테이블은 th를 2벌 렌더하므로 first()로 좁힌다.
  await expect(tabPanel.getByText('가입·초대일').first()).toBeVisible();

  // 배정 → 초대 전환: 라벨/버튼/안내문(+발송 이력 확인 경로)은 초대 Drawer 안에 있다.
  // Drawer 는 body portal 이라 tabPanel 스코프 밖이다 — 스코프를 Drawer 로 바꾼다.
  await tabPanel.getByTestId('institution-invite-open-button').click();
  const inviteDrawer = page.getByTestId('institution-invite-drawer');
  await expect(inviteDrawer).toBeVisible();

  await expect(inviteDrawer.getByText('회원 초대', { exact: true })).toBeVisible();
  await expect(
    inviteDrawer.getByText('초대 알림(인앱+이메일)이 발송되고, 회원이 수락해야 소속이 적용됩니다.')
  ).toBeVisible();
  await expect(
    inviteDrawer.getByText('발송 내역은 메시지 ▸ 발송 이력에서 확인할 수 있습니다.')
  ).toBeVisible();
  // 만료 기간(기본 7일) 입력.
  await expect(inviteDrawer.getByText('만료 기간', { exact: true })).toBeVisible();
  await expect(
    inviteDrawer.getByText('이 기간 안에 응답하지 않으면 초대가 만료됩니다.')
  ).toBeVisible();
  await expect(page.getByRole('button', { name: '선택 회원 초대' })).toBeVisible();
});

test('회원목록: 다중 선택 시 기관 초대 모달을 연다', async ({ page }) => {
  await page.goto('/users');
  await skipIfAuthRequired(page);

  // 첫 두 행 선택 → 일괄 액션 바 노출.
  const checkboxes = page.locator('tbody tr.ant-table-row input[type="checkbox"]');
  await checkboxes.first().check();
  await checkboxes.nth(1).check();

  await expect(page.getByText(/명 선택됨/)).toBeVisible();
  await page.getByRole('button', { name: '기관 초대' }).click();

  const modal = page.locator('.ant-modal-content').filter({ hasText: '기관 초대' });
  await expect(modal).toBeVisible();
  await expect(modal.getByText(/초대 알림\(인앱\+이메일\)을 보냅니다/)).toBeVisible();
  await expect(modal.getByRole('button', { name: '초대 발송' })).toBeVisible();
  await expect(modal.getByText('기관 코드', { exact: true })).toBeVisible();
  await expect(modal.getByText('만료 기간', { exact: true })).toBeVisible();
});

test('회원상세 기관탭: 기관 초대 카드를 렌더한다', async ({ page }) => {
  // U00004는 모크에서 EXPO2026-BOOTH-A 소속 → 초대 카드와 해제 버튼이 함께 노출된다.
  await page.goto('/users/U00004?tab=affiliation');
  await skipIfAuthRequired(page);

  await expect(page.getByText('기관 초대', { exact: true }).first()).toBeVisible();
  await expect(
    page.getByText(
      '즉시 배정이 아니라 초대 알림(인앱+이메일)이 발송되고, 회원이 수락해야 소속이 적용됩니다. 발송 내역은 메시지 ▸ 발송 이력에서 확인할 수 있습니다.'
    )
  ).toBeVisible();
  await expect(page.getByRole('button', { name: '기관 초대 보내기' })).toBeVisible();
  await expect(page.getByRole('button', { name: '소속 해제' })).toBeVisible();
  await expect(page.getByText('만료 기간', { exact: true })).toBeVisible();
});
