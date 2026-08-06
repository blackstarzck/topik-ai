import { expect, test, type Page } from '@playwright/test';

/**
 * Users > 기관 코드 — 기관 단위 노출 모드(`제한 없음` / `배정분만`) — D-12 모크 모드.
 *
 * mock 시드 의도(mock-institution-codes.ts):
 *   · EXPO2026-BOOTH-A  모드 원장에 행 없음 → `배정분만`, 배정 1건, 회원 0명
 *   · EXPO2026-BOOTH-B  `제한 없음`, 배정 2건, 회원 0명
 *   · CONVENTION-VN     `제한 없음`, 배정 0건, 회원 130명  ← 배정분만 전환 차단 케이스
 * Supabase 구성 실행은 로그인 자격이 없어 skip.
 *
 * ⚠️ mock 영속화는 **모듈 메모리**다. 변경을 검증하려면 `page.goto` 대신 인앱 내비게이션
 * (브레드크럼 링크)으로 이동해야 한다 — goto 는 앱 전체를 리로드해 시드로 되돌린다.
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

/** 목록 더보기 메뉴로 상세 탭에 진입한다(모달 → 페이지 전환 후 진입점). */
async function openDetailTab(
  page: Page,
  code: string,
  menuLabel: '수정' | '노출 문항' | '회원 관리',
  expectedTab: 'info' | 'questions' | 'members'
): Promise<void> {
  await row(page, code).getByRole('button', { name: '더보기' }).click();
  await page
    .locator('.table-action-menu__popup:visible')
    .getByRole('menuitem', { name: menuLabel, exact: true })
    .click();
  await expect(page).toHaveURL(
    new RegExp(`/users/institution-codes/${code}\\?tab=${expectedTab}$`)
  );
  await expect(page.getByRole('heading', { name: `기관 코드 · ${code}` })).toBeVisible();
}

/**
 * 노출 설정 Drawer 를 열고 모드 섹션 Locator 를 돌려준다.
 *
 * 🚨 Drawer 를 열지 않은 채 이 스코프로 부정 단언(`toHaveCount(0)`)을 하면 섹션 자체가
 * 없어서 **무조건 통과**한다(vacuous pass). 그래서 여는 것과 스코프 잡는 것을 한 함수로
 * 묶어, 부정 단언이 항상 "열린 Drawer 안에서 그 문구가 없다"를 뜻하게 만든다.
 */
async function openModeSettings(page: Page) {
  await page.getByTestId('institution-exposure-settings-open-button').click();
  await expect(page.getByTestId('institution-exposure-settings-drawer')).toBeVisible();
  return page.getByTestId('institution-exposure-mode-section');
}

/** Drawer 를 닫는다 — 마스크가 본문 단언과 브레드크럼 클릭을 가린다. */
async function closeDrawer(page: Page): Promise<void> {
  await page.getByRole('button', { name: '취소' }).click();
  await expect(page.locator('.ant-drawer-open')).toHaveCount(0);
}

/** 브레드크럼으로 목록 복귀 — mock 모듈 메모리를 보존하는 유일한 경로. */
async function backToListViaBreadcrumb(page: Page): Promise<void> {
  await page.locator('.ant-breadcrumb').getByRole('link', { name: '기관 코드' }).click();
  await expect(page).toHaveURL(/\/users\/institution-codes$/);
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

test('노출 문항 탭: 배정 0건 + 회원 있음이면 배정분만 전환을 차단한다', async ({ page }) => {
  await openList(page);
  await openDetailTab(page, 'CONVENTION-VN', '노출 문항', 'questions');
  // 툴바 요약이 현재 모드를 보여준다 — 설정을 열지 않아도 상태는 읽힌다.
  await expect(page.getByTestId('institution-exposure-summary')).toContainText('제한 없음');

  const section = await openModeSettings(page);

  // 현재 제한 없음 → 차단 Alert 없음
  await expect(section.getByRole('radio', { name: '제한 없음' })).toBeChecked();
  await expect(section.getByText(/배정된 문항이 0건입니다/)).toHaveCount(0);

  await section.getByRole('radio', { name: '배정분만' }).check();
  await expect(
    section.getByText(
      '배정된 문항이 0건입니다. 지금 배정분만으로 바꾸면 이 코드 소속 학습자 130명에게 쓰기 문항이 한 건도 보이지 않습니다.'
    )
  ).toBeVisible();

  // 사유를 채워도 차단은 유지된다 — 막는 이유가 사유 누락이 아니라 빈 화면 위험이다.
  await section.getByPlaceholder('감사 로그에 기록됩니다.').fill('e2e: 차단 확인');
  // 적용 버튼은 Drawer footer 에 있다(모드 섹션 밖).
  await expect(page.getByRole('button', { name: '노출 모드 변경' })).toBeDisabled();

  // 제한 없음으로 되돌리면 즉시 해제된다.
  await section.getByRole('radio', { name: '제한 없음' }).check();
  await expect(section.getByText(/배정된 문항이 0건입니다/)).toHaveCount(0);
});

test('노출 문항 탭: 배정이 있는 배정분만 코드는 경고를 띄우지 않는다', async ({ page }) => {
  await openList(page);
  await openDetailTab(page, 'EXPO2026-BOOTH-A', '수정', 'info');

  // 🚨 부정 단언 앞에는 **반드시 양성 앵커**를 세운다. 탭 children 은 코드 조회가 끝나야
  // 렌더되는데(셸이 `institution ? … : null`), 앵커 없이 count 0 을 재면 아직 아무것도 안 그려진
  // t≈0 에 통과해 버린다 — info 탭에 모드 트리거를 실제로 붙여도 green 인 vacuous pass 였다.
  await expect(page.getByRole('button', { name: '수정' })).toBeVisible();

  // `수정` 은 기본 정보 탭이다. 모드는 이 탭에 없고 진입점(설정 트리거)조차 없다 —
  // 모드 축은 노출 문항 탭이 소유한다.
  await expect(page.getByRole('radio', { name: '배정분만' })).toHaveCount(0);
  await expect(page.getByTestId('institution-exposure-settings-open-button')).toHaveCount(0);

  await page.getByRole('tab', { name: '노출 문항' }).click();
  // 앵커 먼저(탭 전환 직후에도 같은 함정) → 그다음 본문에 라디오가 없음을 단언한다.
  await expect(page.getByTestId('institution-exposure-settings-open-button')).toBeVisible();
  await expect(page.getByRole('radio', { name: '배정분만' })).toHaveCount(0);

  const section = await openModeSettings(page);
  // A부스는 모드 원장 행이 없어 실효 모드가 기본값(배정분만)으로 초기화된다.
  await expect(section.getByRole('radio', { name: '배정분만' })).toBeChecked();
  // 배정이 1건 있으므로 빈 화면 위험이 없다 → 차단·경고 Alert 모두 뜨지 않아야 한다.
  // (Drawer 가 열려 있으므로 이 부정 단언은 "섹션은 있는데 문구가 없다"를 뜻한다.)
  await expect(section.getByText(/배정된 문항이 0건입니다/)).toHaveCount(0);
});

test('노출 설정: 취소로 닫으면 고른 값과 사유를 버린다', async ({ page }) => {
  // Drawer 는 탭에 상시 마운트돼 있어 state 가 닫아도 살아남는다. 리셋을 열 때 하지 않으면
  // 버린 선택이 재오픈 때 되살아나고, 적용 버튼이 처음부터 활성이라 확인 절차 없이
  // 한 번의 클릭으로 기관 전원의 노출 범위가 바뀐다.
  await openList(page);
  // 배정이 있는 코드를 쓴다 — 배정 0건 코드는 빈 화면 가드가 버튼을 정당하게 잠가서
  // '취소가 초안을 버렸는가' 를 구분할 수 없다(B부스: 제한 없음 · 배정 2건).
  await openDetailTab(page, 'EXPO2026-BOOTH-B', '노출 문항', 'questions');

  const section = await openModeSettings(page);
  await section.getByRole('radio', { name: '배정분만' }).check();
  await section.getByPlaceholder('감사 로그에 기록됩니다.').fill('e2e: 버려질 초안');
  await expect(page.getByRole('button', { name: '노출 모드 변경' })).toBeEnabled();

  await closeDrawer(page);

  const reopened = await openModeSettings(page);
  // 실제 모드(제한 없음)로 되돌아와야 하고, 사유도 비어 있어야 한다.
  await expect(reopened.getByRole('radio', { name: '제한 없음' })).toBeChecked();
  await expect(reopened.getByPlaceholder('감사 로그에 기록됩니다.')).toHaveValue('');
  // 바뀐 게 없으므로 적용 버튼은 비활성이어야 한다 — 여기가 1클릭 사고를 막는 지점이다.
  await expect(page.getByRole('button', { name: '노출 모드 변경' })).toBeDisabled();
});

test('노출 문항 탭: 모드를 바꿔도 배정 건수는 보존된다(모크)', async ({ page }) => {
  await openList(page);
  await expect(row(page, 'EXPO2026-BOOTH-B').getByText('배정 2건 보존')).toBeVisible();

  await openDetailTab(page, 'EXPO2026-BOOTH-B', '노출 문항', 'questions');
  const section = await openModeSettings(page);
  await section.getByRole('radio', { name: '배정분만' }).check();
  await section.getByPlaceholder('감사 로그에 기록됩니다.').fill('e2e: 모드 왕복');
  // 적용 버튼은 Drawer footer 에 있다(섹션 밖).
  await page.getByRole('button', { name: '노출 모드 변경' }).click();

  await expect(page.getByText(/노출 모드 변경 완료/)).toBeVisible();

  // 목록 복귀 전에 Drawer 를 닫는다 — 마스크가 브레드크럼 클릭을 삼킨다.
  await closeDrawer(page);
  // 목록 복귀는 브레드크럼으로 — goto 는 mock 모듈 메모리를 초기화한다.
  await backToListViaBreadcrumb(page);
  // 모드는 바뀌고 배정 건수는 그대로여야 한다 — 모드 전환이 배정을 지우지 않는다는 계약.
  await expect(row(page, 'EXPO2026-BOOTH-B').getByText('배정분만')).toBeVisible();
  await expect(row(page, 'EXPO2026-BOOTH-B').getByText('배정 2건')).toBeVisible();
});

test('생성 페이지: 실제 기본값인 배정분만을 안내하고 생성 행에도 그대로 반영한다', async ({
  page
}) => {
  await openList(page);
  await page.getByRole('button', { name: '코드 생성' }).click();

  await expect(page).toHaveURL(/\/users\/institution-codes\/create$/);
  await expect(page.getByRole('heading', { name: '기관 코드 생성' })).toBeVisible();
  await expect(page.getByText('배정분만', { exact: true })).toBeVisible();
  await expect(
    page.getByText(
      '새 코드는 배정분만으로 시작합니다. 생성 후 노출 문항 탭에서 문항을 최소 1건 배정하거나 제한 없음으로 바꾸세요.'
    )
  ).toBeVisible();
  // 입력 컨트롤이 아니어야 한다(라디오 없음).
  await expect(page.getByRole('radio', { name: '배정분만' })).toHaveCount(0);

  await page.getByPlaceholder('EXPO2026-BOOTH-A').fill('EXPO2026-NEW');
  await page.getByPlaceholder('2026 한국어교육 박람회 · A부스').fill('2026 신규 박람회');
  await page.getByRole('button', { name: '생성' }).click();

  // 생성 직후에는 목록이 아니라 상세 노출 문항 탭으로 간다 — 배정 선행조건을 동선으로 옮겼다.
  await expect(page.getByText(/기관 코드 생성 완료/)).toBeVisible();
  await expect(page).toHaveURL(/\/users\/institution-codes\/EXPO2026-NEW\?tab=questions$/);

  await backToListViaBreadcrumb(page);
  await expect(row(page, 'EXPO2026-NEW').getByText('배정분만')).toBeVisible();
});

test('생성 페이지: 상세 라우트를 가리는 예약어 코드를 거부한다', async ({ page }) => {
  await openList(page);
  await page.getByRole('button', { name: '코드 생성' }).click();
  await expect(page).toHaveURL(/\/users\/institution-codes\/create$/);

  await page.getByPlaceholder('EXPO2026-BOOTH-A').fill('create');
  await page.getByPlaceholder('2026 한국어교육 박람회 · A부스').fill('예약어 시도');
  await page.getByRole('button', { name: '생성' }).click();

  await expect(page.getByText('예약어라 코드로 사용할 수 없습니다.')).toBeVisible();
  await expect(page).toHaveURL(/\/users\/institution-codes\/create$/);
});
