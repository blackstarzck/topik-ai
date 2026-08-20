import { expect, test } from '@playwright/test';

/**
 * Message > 메일 채널 성공 경로 스모크.
 *
 * 이 화면은 응답 하나(`ChannelSnapshot`)를 templates·groups 두 상태로 나눠 쓰던
 * 수기 fetch 배선을 공용 훅(`useAsyncResource`)으로 옮겼다(gap-register §3.13 ④).
 * 전환 전에는 e2e 커버가 없어서, **응답의 두 절반이 모두 배선됐는지**를 여기서 고정한다 —
 * 목록(templates)과 미리보기의 발송 그룹명(groups)이 각각 화면에 닿아야 한다.
 */
test('메일 템플릿 목록이 로드되고 탭으로 자동/수동 발송이 갈린다', async ({ page }) => {
  await page.goto('/messages/mail');

  await expect(page.getByRole('heading', { name: '메일', exact: true })).toBeVisible();

  const rows = page.locator('.ant-table-tbody tr.ant-table-row');
  await expect(rows.filter({ hasText: '가입 환영 메일' })).toHaveCount(1);
  await expect(rows.filter({ hasText: 'MAIL-AUTO-001' })).toHaveCount(1);

  // 탭 라벨의 건수는 같은 응답에서 파생된다 — 0 이면 목록이 안 실린 것이다.
  await expect(page.getByRole('tab', { name: /자동 발송 \(\d+\)/ })).toBeVisible();

  await page.getByRole('tab', { name: /수동 발송/ }).click();
  await expect(rows.filter({ hasText: '가입 환영 메일' })).toHaveCount(0);

  await page.getByRole('tab', { name: /자동 발송/ }).click();
  await expect(rows.filter({ hasText: '가입 환영 메일' })).toHaveCount(1);
});

test('행을 클릭하면 미리보기 모달에 템플릿과 발송 그룹명이 함께 나온다', async ({ page }) => {
  await page.goto('/messages/mail');

  await page
    .locator('.ant-table-tbody tr.ant-table-row', { hasText: '가입 환영 메일' })
    .click();

  const modal = page.locator('.ant-modal-content');
  await expect(modal).toBeVisible();
  await expect(modal).toContainText('메일 템플릿 미리보기');
  await expect(modal).toContainText('MAIL-AUTO-001');
  // 발송 그룹명은 응답의 groups 쪽에서 온다(templates 만 배선돼도 여기서 걸린다).
  await expect(modal).toContainText('활성 학습자');
});

test('템플릿 등록 버튼이 등록 모달을 연다', async ({ page }) => {
  await page.goto('/messages/mail');

  await page.getByTestId('message-mail-create-button').click();

  const modal = page.locator('.ant-modal-content');
  await expect(modal).toBeVisible();
  await expect(modal).toContainText('자동 발송 템플릿 등록');
});
