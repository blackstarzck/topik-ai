import { expect, test, type Page } from '@playwright/test';

/**
 * Users > 기관 코드 — 계약 탭 · 계약 연동 옵션 · 회원 정책 — 모크 모드.
 *
 * mock 시드 의도(mock-institution-contracts.ts) — 날짜는 **오늘 기준 상대값**이다.
 * 절대값을 박으면 시간이 지나 전부 `만료` 가 되어 D-day 검증이 조용히 다른 것을 본다.
 *   · EXPO2026-BOOTH-A  계약 today-30 ~ today+40 → `유효`, D-40 / 정원 50 · 초대 기본 14일
 *   · EXPO2026-BOOTH-B  계약 today-60 ~ today-1  → `만료`
 *   · CONVENTION-VN     계약 0건                 → `계약 없음`(정상 상태, `만료` 와 구분)
 *
 * ⚠️ mock 영속화는 **모듈 메모리**다. 변경을 검증할 때는 `page.goto` 로 재진입하면 안 된다
 * (앱 전체 리로드로 시드 복귀). 탭 전환·브레드크럼 같은 인앱 내비게이션만 쓴다.
 */

function shiftDays(days: number): string {
  const now = new Date();
  now.setDate(now.getDate() + days);
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const dd = String(now.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

async function openContractTab(page: Page, code: string): Promise<void> {
  await page.goto(`/users/institution-codes/${code}?tab=contract`);
  const loginHeading = page.getByRole('heading', { name: 'TOPIK 관리자 로그인' });
  if (await loginHeading.isVisible().catch(() => false)) {
    test.skip(true, 'Supabase auth is configured for this run; login is not part of this e2e.');
  }
  await expect(page.getByTestId('institution-contract-summary')).toBeVisible();
}

/** antd RangePicker 는 두 입력을 차례로 채우고 Enter 로 확정한다. */
async function fillPeriod(page: Page, startsOn: string, endsOn: string): Promise<void> {
  const dialog = page.locator('.ant-modal-content');
  await dialog.getByPlaceholder('시작일').click();
  await dialog.getByPlaceholder('시작일').fill(startsOn);
  await page.keyboard.press('Enter');
  await dialog.getByPlaceholder('종료일').fill(endsOn);
  await page.keyboard.press('Enter');
}

/**
 * 노출 설정 Drawer 를 연다. 옵션 토글 2종이 여기 들어 있다.
 *
 * 🚨 Drawer 도 `role="dialog"` 라, Drawer 가 열린 상태에서 확인 모달을 띄우면
 * `getByRole('dialog')` 가 2개를 잡아 strict violation 이 난다. 그래서 이 파일의 모달
 * 접근은 전부 `.ant-modal-content` 로 좁혀 두었다.
 */
async function openExposureSettings(page: Page): Promise<void> {
  await page.getByTestId('institution-exposure-settings-open-button').click();
  await expect(page.getByTestId('institution-exposure-settings-drawer')).toBeVisible();
}

/** Drawer 를 닫는다 — 마스크가 본문 Alert·배지 단언을 가린다. */
async function closeDrawer(page: Page): Promise<void> {
  await page.getByRole('button', { name: '취소' }).click();
  await expect(page.locator('.ant-drawer-open')).toHaveCount(0);
}

test('계약 요약은 유효·만료·미등록을 서로 다른 문구로 구분한다', async ({ page }) => {
  await openContractTab(page, 'EXPO2026-BOOTH-A');
  const badge = page.getByTestId('institution-contract-badge-EXPO2026-BOOTH-A').first();
  await expect(badge).toContainText('D-40');
  await expect(
    page.getByTestId('institution-contract-summary')
  ).toContainText(`${shiftDays(-30)} ~ ${shiftDays(40)}`);

  // 만료 기관: `만료` 로 표시되고 기간 문자열은 붙지 않는다(유효 계약이 없으므로).
  await openContractTab(page, 'EXPO2026-BOOTH-B');
  await expect(
    page.getByTestId('institution-contract-badge-EXPO2026-BOOTH-B').first()
  ).toContainText('만료');

  // 계약 미등록: `만료` 가 아니라 `계약 없음` 이며, 노출이 제한되지 않는다는 안내가 붙는다.
  await openContractTab(page, 'CONVENTION-VN');
  await expect(
    page.getByTestId('institution-contract-badge-CONVENTION-VN').first()
  ).toContainText('계약 없음');
  await expect(page.getByText('만료할 계약이 없으므로 노출은 제한되지 않습니다.')).toBeVisible();
});

test('계약 기간이 겹치면 거부하고, 겹치지 않는 기간은 히스토리에 쌓인다', async ({ page }) => {
  await openContractTab(page, 'EXPO2026-BOOTH-A');

  // ── 겹침: 기존 계약(today-30 ~ today+40) 안쪽 기간을 요청한다.
  await page.getByRole('button', { name: '계약 추가' }).click();
  await fillPeriod(page, shiftDays(-5), shiftDays(5));
  await page
    .getByRole('dialog')
    .getByPlaceholder('감사 로그에 기록됩니다.')
    .fill('e2e: 겹치는 계약');
  await page.locator('.ant-modal-content').getByRole('button', { name: '추가' }).click();

  await expect(page.getByText('계약 추가 실패')).toBeVisible();
  await expect(
    page.getByText('계약 기간이 기존 계약과 겹칩니다.', { exact: false })
  ).toBeVisible();

  // ── 겹치지 않는 미래 기간: 성공하고 `예정` 으로 쌓인다.
  await fillPeriod(page, shiftDays(41), shiftDays(80));
  await page.locator('.ant-modal-content').getByRole('button', { name: '추가' }).click();
  await expect(page.getByText('계약 추가 완료')).toBeVisible();

  const history = page.locator('tbody tr.ant-table-row');
  await expect(history).toHaveCount(2);
  await expect(
    history.filter({ hasText: `${shiftDays(41)} ~ ${shiftDays(80)}` })
  ).toContainText('예정');
});

test('만료 기관에 자동 비노출을 켜면 비노출 상태가 배지와 경고로 드러난다', async ({ page }) => {
  // 만료 계약만 있는 기관에서 옵션을 켜야 실제 비노출이 성립한다.
  await page.goto('/users/institution-codes/EXPO2026-BOOTH-B?tab=questions');
  const loginHeading = page.getByRole('heading', { name: 'TOPIK 관리자 로그인' });
  if (await loginHeading.isVisible().catch(() => false)) {
    test.skip(true, 'Supabase auth is configured for this run; login is not part of this e2e.');
  }

  await openExposureSettings(page);
  const autoHide = page.getByTestId('institution-auto-hide-switch');
  await expect(autoHide).toHaveAttribute('aria-checked', 'false');
  await autoHide.click();

  // 옵션 변경은 사유가 필수다 — 확인 모달로 받는다.
  const dialog = page.locator('.ant-modal-content');
  await expect(dialog).toContainText('만료 시 자동 비노출 켜기');
  await dialog.getByPlaceholder('옵션 변경 사유를 입력하세요.').fill('e2e: 만료 시 자동 비노출');
  await dialog.getByRole('button', { name: '켜기' }).click();

  await expect(page.getByText('만료 시 자동 비노출 켜짐')).toBeVisible();
  await expect(autoHide).toHaveAttribute('aria-checked', 'true');
  // 비노출 경보는 본문에 있다 — 설정을 닫아야 마스크 없이 보인다.
  await closeDrawer(page);
  // 계약이 만료 상태이므로 즉시 비노출이 성립한다.
  await expect(page.getByText('만료·비노출').first()).toBeVisible();
  await expect(
    page.getByText('계약이 만료되어 지금 이 기관 학습자에게 쓰기 문항이 보이지 않습니다.')
  ).toBeVisible();
});

test('유효 계약 기관은 자동 비노출을 켜도 가려지지 않는다', async ({ page }) => {
  await page.goto('/users/institution-codes/EXPO2026-BOOTH-A?tab=questions');
  const loginHeading = page.getByRole('heading', { name: 'TOPIK 관리자 로그인' });
  if (await loginHeading.isVisible().catch(() => false)) {
    test.skip(true, 'Supabase auth is configured for this run; login is not part of this e2e.');
  }

  await openExposureSettings(page);
  await page.getByTestId('institution-auto-hide-switch').click();
  const dialog = page.locator('.ant-modal-content');
  await dialog.getByPlaceholder('옵션 변경 사유를 입력하세요.').fill('e2e: 유효 계약에서 옵션 ON');
  await dialog.getByRole('button', { name: '켜기' }).click();

  await expect(page.getByText('만료 시 자동 비노출 켜짐')).toBeVisible();
  // 성공 알림을 확인한 뒤 닫는다 — 부정 단언 전에 "실제로 켜졌다"가 먼저 증명돼야
  // `toHaveCount(0)` 이 vacuous pass 가 되지 않는다.
  await closeDrawer(page);
  // 계약이 유효하므로 옵션을 켜도 비노출이 아니다 — 이 구분이 옵션의 핵심 계약이다.
  await expect(page.getByText('만료·비노출')).toHaveCount(0);
});

test('신규 문항 자동 배정 토글은 만료 옵션과 독립이다', async ({ page }) => {
  await page.goto('/users/institution-codes/EXPO2026-BOOTH-A?tab=questions');
  const loginHeading = page.getByRole('heading', { name: 'TOPIK 관리자 로그인' });
  if (await loginHeading.isVisible().catch(() => false)) {
    test.skip(true, 'Supabase auth is configured for this run; login is not part of this e2e.');
  }

  await openExposureSettings(page);
  const autoAssign = page.getByTestId('institution-auto-assign-switch');
  await autoAssign.click();
  const dialog = page.locator('.ant-modal-content');
  await expect(dialog).toContainText('신규 문항 자동 배정 켜기');
  await dialog.getByPlaceholder('옵션 변경 사유를 입력하세요.').fill('e2e: 자동 배정 ON');
  await dialog.getByRole('button', { name: '켜기' }).click();

  await expect(page.getByText('신규 문항 자동 배정 켜짐')).toBeVisible();
  await expect(autoAssign).toHaveAttribute('aria-checked', 'true');
  // 한쪽만 켰으므로 다른 토글은 그대로여야 한다(같은 원장 행을 쓰지만 컬럼이 다르다).
  await expect(page.getByTestId('institution-auto-hide-switch')).toHaveAttribute(
    'aria-checked',
    'false'
  );
});

test('회원 정책은 좌석 사용량을 보여주고 초대 기본값을 폼에 채운다', async ({ page }) => {
  await page.goto('/users/institution-codes/EXPO2026-BOOTH-A?tab=members');
  const loginHeading = page.getByRole('heading', { name: 'TOPIK 관리자 로그인' });
  if (await loginHeading.isVisible().catch(() => false)) {
    test.skip(true, 'Supabase auth is configured for this run; login is not part of this e2e.');
  }

  // 좌석 요약은 툴바에 상시 노출된다 — 판단에 필요한 현황이라 Drawer 뒤로 숨기지 않았다.
  await expect(page.getByTestId('institution-seat-usage')).toHaveText('0 / 50');

  // 정책 편집은 Drawer 안이다(2026-08-06 재배치).
  await page.getByTestId('institution-member-policy-open-button').click();
  await expect(page.getByTestId('institution-member-policy-drawer')).toBeVisible();
  await expect(page.getByTestId('institution-member-policy-section')).toBeVisible();
  await expect(page.locator('#defaultInviteExpiryDays')).toHaveValue('14');
  await expect(page.locator('#maxMembers')).toHaveValue('50');
  await page.getByRole('button', { name: '취소' }).click();
  await expect(page.locator('.ant-drawer-open')).toHaveCount(0);

  // 기관 설정의 초대 유효기간 기본값(14일)이 초대 폼에 채워져야 한다 — 전역 7일이 아니다.
  await page.getByTestId('institution-invite-open-button').click();
  await expect(page.getByTestId('institution-invite-drawer')).toBeVisible();
  await expect(page.locator('#expiresInDays')).toHaveValue('14');
});

test('정원을 현재 좌석 사용량보다 낮게 저장할 수 없다', async ({ page }) => {
  // CONVENTION-VN 은 회원 130명이고 설정 행이 없다(정원 무제한).
  await page.goto('/users/institution-codes/CONVENTION-VN?tab=members');
  const loginHeading = page.getByRole('heading', { name: 'TOPIK 관리자 로그인' });
  if (await loginHeading.isVisible().catch(() => false)) {
    test.skip(true, 'Supabase auth is configured for this run; login is not part of this e2e.');
  }

  await expect(page.getByTestId('institution-seat-usage')).toHaveText('130 / 무제한');

  await page.getByTestId('institution-member-policy-open-button').click();
  await expect(page.getByTestId('institution-member-policy-drawer')).toBeVisible();
  await page.locator('#maxMembers').fill('10');
  await page
    .getByTestId('institution-member-policy-section')
    .getByPlaceholder('감사 로그에 기록됩니다.')
    .fill('e2e: 정원을 사용량 아래로');
  await page.getByRole('button', { name: '회원 정책 저장' }).click();

  await expect(page.getByText('회원 정책 저장 실패')).toBeVisible();
  await expect(
    page.getByText('정원을 현재 좌석 사용량보다 낮게 설정할 수 없습니다.', { exact: false })
  ).toBeVisible();
});

test('목록 계약 컬럼이 세 상태를 구분해 보여준다', async ({ page }) => {
  await page.goto('/users/institution-codes');
  const loginHeading = page.getByRole('heading', { name: 'TOPIK 관리자 로그인' });
  if (await loginHeading.isVisible().catch(() => false)) {
    test.skip(true, 'Supabase auth is configured for this run; login is not part of this e2e.');
  }

  await expect(
    page.getByTestId('institution-contract-badge-EXPO2026-BOOTH-A')
  ).toContainText('D-40');
  await expect(
    page.getByTestId('institution-contract-badge-EXPO2026-BOOTH-B')
  ).toContainText('만료');
  await expect(
    page.getByTestId('institution-contract-badge-CONVENTION-VN')
  ).toContainText('계약 없음');
});
