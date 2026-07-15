import { expect, test } from '@playwright/test';

test('학습 분석 기본 대시보드가 8개 KPI와 전체 분석 섹션을 표시한다', async ({ page }) => {
  await page.goto('/analytics/learning');

  await expect(page.getByRole('heading', { name: '학습 분석' })).toBeVisible();
  await expect(page.getByText('문제 유형, 주제, 기간 기준으로')).toBeVisible();
  const csvExportButton = page.getByRole('button', { name: 'CSV 내보내기' });
  const conditionButton = page.getByRole('button', { name: /분석 조건/ });
  await expect(csvExportButton).toBeVisible();
  await expect(csvExportButton).toHaveClass(/ant-btn-lg/);
  await expect(conditionButton).toBeVisible();
  await expect(conditionButton).toHaveClass(/ant-btn-lg/);
  await expect(page.getByRole('button', { name: '지표 사전' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: '분석 공유' })).toHaveCount(0);

  for (const metric of [
    '해당 조건 학습자',
    '제출 수',
    '피드백 완료율',
    '평균 환산 점수',
    '피드백 조회율',
    '평균 풀이 시간',
    '처리 시간 중앙값',
    'PDF 내보내기 완료 수'
  ]) {
    await expect(page.getByText(metric, { exact: true }).first()).toBeVisible();
  }

  await expect(page.getByText('문제 유형별 비교')).toBeVisible();
  for (const question of ['51번 빈칸 완성', '52번 문장 완성', '53번 자료 해석', '54번 논술']) {
    await expect(page.getByRole('cell', { name: question, exact: true })).toBeVisible();
  }
  await expect(page.getByText('문제 유형별 점수 분포')).toBeVisible();
  await expect(page.getByText('주제별 성과')).toBeVisible();
  await expect(page.getByText('PDF 사용 분석')).toBeVisible();
  await expect(page.getByText('51~54번 전체').first()).toBeVisible();
  await expect(page.locator('[data-testid^="metadata-coverage-warning-"]')).toHaveCount(0);
  await expect(page.getByTestId('metadata-coverage-unavailable')).toHaveCount(0);
});

test('URL 조건이 문제 유형·주제·세부 필터를 모든 분석 블록에 복원한다', async ({ page }) => {
  await page.goto(
    '/analytics/learning?period=custom&from=2026-07-01&to=2026-07-10&compare=1&question=53&topicMain=%EC%82%AC%ED%9A%8C&topicDetail=%EB%AC%B8%ED%99%94&d.dataType=%ED%91%9C'
  );

  await expect(page.getByText('2026-07-01~2026-07-10').first()).toBeVisible();
  await expect(page.getByText('53번', { exact: true }).first()).toBeVisible();
  await expect(page.getByText('사회', { exact: true }).first()).toBeVisible();
  await expect(page.getByText('문화', { exact: true }).first()).toBeVisible();

  await page.getByRole('button', { name: /분석 조건/ }).click();
  await expect(page.getByText('자료 유형: 표', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: '취소' }).click();

  await expect(page.getByRole('cell', { name: '53번 자료 해석', exact: true })).toBeVisible();
  await expect(page.getByRole('cell', { name: '51번 빈칸 완성', exact: true })).toHaveCount(0);
  await expect(page.locator('.score-distribution-row')).toHaveCount(1);
  await expect(page.getByRole('cell', { name: '문화', exact: true })).toBeVisible();
  await expect(page.locator('.pdf-question-list').getByText('53번', { exact: true })).toBeVisible();
});

test('조건 Drawer는 draft를 적용 전까지 보존하고 다중 유형에서 세부 필터를 해제한다', async ({ page }) => {
  await page.goto(
    '/analytics/learning?period=custom&from=2026-07-01&to=2026-07-10&compare=1&question=53&d.dataType=%ED%91%9C'
  );
  const originalUrl = page.url();

  await page.getByRole('button', { name: /분석 조건/ }).click();
  await expect(page.locator('.ant-drawer-title').getByText('분석 조건', { exact: true })).toBeVisible();
  await expect(page.getByText('자료 유형', { exact: true })).toBeVisible();
  await expect(page.getByText('미적용 변경 있음')).toHaveCount(0);

  await page.getByRole('checkbox', { name: '51번 빈칸 완성' }).check();
  await expect(page.getByText('미적용 변경 있음')).toBeVisible();
  await expect(page.getByText('문제 유형 1개 선택 시 사용')).toBeVisible();
  expect(page.url()).toBe(originalUrl);

  await page.getByRole('button', { name: '분석 적용' }).click();
  await expect.poll(() => new URL(page.url()).searchParams.getAll('question')).toEqual(['51', '53']);
  await expect.poll(() => new URL(page.url()).searchParams.getAll('d.dataType')).toEqual([]);
  await expect(page.getByRole('cell', { name: '51번 빈칸 완성', exact: true })).toBeVisible();
  await expect(page.getByRole('cell', { name: '53번 자료 해석', exact: true })).toBeVisible();

  await page.getByRole('button', { name: /분석 조건/ }).click();
  await page.getByRole('checkbox', { name: '54번 논술' }).check();
  await page.getByRole('button', { name: '취소' }).click();
  await page.getByRole('button', { name: /분석 조건/ }).click();
  await expect(page.getByRole('checkbox', { name: '54번 논술' })).not.toBeChecked();
});

test('KPI 설명 툴팁, 표 대체 보기, CSV 내보내기가 동작한다', async ({ page }) => {
  await page.goto('/analytics/learning?period=30d&compare=1&question=51&question=53');

  await page.getByRole('button', { name: '평균 환산 점수 지표 설명' }).click();
  const metricTooltip = page.getByRole('tooltip');
  await expect(metricTooltip).toBeVisible();
  await expect(metricTooltip.locator('.analytics-kpi-tooltip-content__eyebrow')).toHaveText('성과 지표');
  await expect(metricTooltip.locator('.analytics-kpi-tooltip-content__title')).toHaveText('평균 환산 점수');
  await expect(metricTooltip.locator('.analytics-kpi-tooltip-content__summary > span')).toHaveText('지표 정의');
  await expect(metricTooltip.locator('.analytics-kpi-tooltip-content__details dt')).toHaveText([
    '계산 방법',
    '포함 조건',
    '주의사항'
  ]);
  await expect(metricTooltip).toContainText('(받은 점수 ÷ 그 문제의 만점) × 100');
  await expect(page.getByRole('dialog', { name: '학습 분석 지표 사전' })).toHaveCount(0);
  await page.keyboard.press('Escape');

  await page.locator('.analytics-panel').filter({ hasText: '문제 유형별 점수 분포' }).getByText('표', { exact: true }).click();
  await expect(page.getByRole('table', { name: '문제 유형별 점수 분포 표' })).toBeVisible();

  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: 'CSV 내보내기' }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toMatch(/^learning-analytics_.*\.csv$/);
});

test('조건 Drawer 초기화 적용이 기본 30일·51~54번·비교 사용으로 복원된다', async ({ page }) => {
  await page.goto('/analytics/learning?period=all&compare=0&question=54');

  await page.getByRole('button', { name: /분석 조건/ }).click();
  await page.getByRole('button', { name: '초기화' }).click();
  await page.getByRole('button', { name: '분석 적용' }).click();
  await expect.poll(() => new URL(page.url()).searchParams.get('period')).toBe('30d');
  await expect.poll(() => new URL(page.url()).searchParams.get('compare')).toBe('1');
  await expect.poll(() => new URL(page.url()).searchParams.getAll('question')).toEqual([
    '51',
    '52',
    '53',
    '54'
  ]);
  await page.reload();
  await expect(page.getByText('51~54번 전체').first()).toBeVisible();
});

test('Analytics 메뉴에서 학습 분석으로 이동한다', async ({ page }) => {
  await page.goto('/analytics/overview');

  const learningMenuItem = page.getByRole('menuitem', { name: '학습 분석' });
  if (!(await learningMenuItem.isVisible())) {
    await page.getByRole('menuitem', { name: '통계' }).click();
  }
  await learningMenuItem.click();
  await expect.poll(() => new URL(page.url()).pathname).toBe('/analytics/learning');
  await expect(page.getByRole('heading', { name: '학습 분석' })).toBeVisible();
});
