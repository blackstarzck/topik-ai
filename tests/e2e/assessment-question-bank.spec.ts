import { expect, test, type Page } from '@playwright/test';

async function skipIfAuthRequired(page: Page): Promise<void> {
  const loginHeading = page.getByRole('heading', { name: 'TOPIK 관리자 로그인' });

  if (await loginHeading.isVisible().catch(() => false)) {
    test.skip(true, 'Supabase auth is configured for this run; login credentials are not part of this e2e.');
  }
}

async function isListSupabaseError(page: Page): Promise<boolean> {
  return page
    .getByText('문항 목록을 불러오지 못했습니다.')
    .isVisible()
    .catch(() => false);
}

async function isReviewSupabaseError(page: Page): Promise<boolean> {
  return page
    .getByText('검수 대상 문항을 불러오지 못했습니다.')
    .isVisible()
    .catch(() => false);
}

async function waitForListState(page: Page): Promise<'error' | 'rows'> {
  for (let attempt = 0; attempt < 50; attempt += 1) {
    if (await isListSupabaseError(page)) {
      return 'error';
    }

    if ((await page.locator('tbody tr').count()) > 0) {
      return 'rows';
    }

    await page.waitForTimeout(200);
  }

  throw new Error('문제은행 목록이 error 또는 row 상태로 전환되지 않았습니다.');
}

test('TOPIK 쓰기 문제은행은 JSON fallback 없이 Supabase 조회 실패를 error/retry로 노출한다', async ({
  page
}) => {
  await page.goto('/assessment/question-bank?questionNo=53');
  await skipIfAuthRequired(page);

  await expect(
    page.getByRole('heading', { name: 'TOPIK 쓰기 문제 검수' })
  ).toBeVisible();
  await expect(page.getByLabel('문항 검색어')).toBeVisible();

  if ((await waitForListState(page)) === 'error') {
    await expect(page.getByText('Supabase client not configured')).toBeVisible();
    await expect(page.getByRole('button', { name: '다시 시도' })).toBeVisible();
    await expect(page.getByText('조건에 맞는 검수 대상 문항이 없습니다.')).toBeVisible();
    await expect(page.getByText('AQ-51001')).toHaveCount(0);
    await expect(page.getByText('AQ-53002')).toHaveCount(0);
    return;
  }

  await expect(page.getByRole('columnheader', { name: '문항 번호' })).toBeVisible();
  await expect(page.getByRole('columnheader', { name: '문항 ID' })).toBeVisible();
  await expect(
    page.getByRole('columnheader', { name: '문항 주제 / 도메인' })
  ).toBeVisible();
  await expect(page.getByRole('columnheader', { name: '문항', exact: true })).toBeVisible();
  await expect(page.locator('tbody tr').first()).toBeVisible();
  await expect(page.getByText('AQ-51001')).toHaveCount(0);
});

test('검수 상세은 과거 JSON mock ID를 fallback으로 복구하지 않는다', async ({ page }) => {
  await page.goto('/assessment/question-bank/review/AQ-51001?questionNo=53');
  await skipIfAuthRequired(page);

  await expect(page.getByRole('heading', { name: '문항 검수' })).toBeVisible();
  await expect(page.getByText('검수 대상 문항을 불러오지 못했습니다.')).toBeVisible();
  await expect(page.getByRole('button', { name: '다시 시도' })).toBeVisible();
  await expect(page.getByText('문항 상세를 불러오지 못했습니다.')).toBeVisible();
  await expect(page.getByText('유연근무제 운영')).toHaveCount(0);
  await expect(page.getByRole('button', { name: '검수 완료' })).toHaveCount(0);
});

test('Supabase 연결 성공 시 목록 행은 2depth 검수 페이지로 이어진다', async ({ page }) => {
  await page.goto('/assessment/question-bank');
  await skipIfAuthRequired(page);

  if ((await waitForListState(page)) === 'error') {
    test.skip(true, 'Supabase client is not configured; failure UI is covered by the fallback-removal test.');
  }

  const firstRow = page.locator('tbody tr').first();
  await expect(firstRow).toBeVisible();

  const firstQuestionId = (await firstRow.locator('td').nth(1).innerText()).trim();
  await firstRow.click();

  await expect(page).toHaveURL(
    new RegExp(`/assessment/question-bank/review/${firstQuestionId}`)
  );
  await expect(page.getByRole('heading', { name: /TOPIK .*번 문항 검수/ })).toBeVisible();
  await expect(page.getByText('문항 지시문', { exact: true })).toBeVisible();

  await expect(page.getByText('검수 대상 문항을 불러오지 못했습니다.')).toHaveCount(0);
});

test('TOPIK 쓰기 문항 관리는 운영 상태 준비 중 안내와 비활성 조치를 노출한다', async ({
  page
}) => {
  await page.goto('/assessment/question-bank/manage');
  await skipIfAuthRequired(page);

  await expect(
    page.getByRole('heading', { name: 'TOPIK 쓰기 문항 관리' })
  ).toBeVisible();
  await expect(page.getByText('운영 상태 관리는 준비 중입니다.')).toBeVisible();
  await expect(
    page.getByText('노출 후보/숨김 후보/운영 제외 조치는 비활성화되어 있습니다.', {
      exact: false
    })
  ).toBeVisible();
  await expect(page.getByLabel('문항 검색어')).toBeVisible();
});

test('AssessmentQuestion 감사 로그는 삭제된 문제은행 store audit으로 역이동하지 않는다', async ({
  page
}) => {
  await page.goto('/system/audit-logs?targetType=AssessmentQuestion&targetId=AQ-53002');
  await skipIfAuthRequired(page);

  await expect(page.getByRole('heading', { name: '감사 로그' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'AQ-53002' })).toHaveCount(0);
});
