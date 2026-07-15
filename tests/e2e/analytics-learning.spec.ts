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
  const pdfPanel = page.locator('.pdf-usage-panel');
  const pdfCompositionSection = pdfPanel.locator('.pdf-composition');
  const pdfHierarchySection = pdfPanel.locator('.pdf-hierarchy');
  const pdfStats = pdfPanel.locator('.pdf-usage-stats');
  const pdfComposition = pdfPanel.getByRole('img', {
    name: /PDF 내보내기 완료 전체 .*건의 구성/
  });
  const pdfHierarchyTable = pdfPanel.getByRole('table', {
    name: 'PDF 내보내기 구성과 주제 상세'
  });
  await expect(pdfStats).toBeVisible();
  await expect(pdfComposition).toBeVisible();
  await expect(pdfHierarchyTable).toBeVisible();
  await expect(pdfPanel.locator('.pdf-composition-bar')).toHaveCount(0);
  const pieBackgroundImage = await pdfPanel.locator('.pdf-composition-pie').evaluate(
    (element) => window.getComputedStyle(element).backgroundImage
  );
  expect(pieBackgroundImage).toContain('conic-gradient');
  await expect(pdfPanel.locator('.pdf-composition-legend')).toHaveCount(0);
  for (const label of ['전체 이벤트', '직접 귀속', '혼합', '미분류']) {
    await expect(pdfStats.getByText(label, { exact: true })).toBeVisible();
  }

  const [pdfCompositionSectionBox, pdfHierarchySectionBox, pdfStatsBox, pdfCompositionBox] = await Promise.all([
    pdfCompositionSection.boundingBox(),
    pdfHierarchySection.boundingBox(),
    pdfStats.boundingBox(),
    pdfComposition.boundingBox()
  ]);
  expect(pdfCompositionSectionBox).not.toBeNull();
  expect(pdfHierarchySectionBox).not.toBeNull();
  expect(pdfStatsBox).not.toBeNull();
  expect(pdfCompositionBox).not.toBeNull();
  expect(pdfCompositionSectionBox!.x).toBeLessThan(pdfHierarchySectionBox!.x);
  expect(Math.abs(pdfCompositionSectionBox!.y - pdfHierarchySectionBox!.y)).toBeLessThanOrEqual(1);
  expect(pdfCompositionSectionBox!.width).toBeLessThan(pdfHierarchySectionBox!.width);
  expect(Math.abs(pdfCompositionSectionBox!.height - pdfHierarchySectionBox!.height)).toBeLessThanOrEqual(1);
  expect(pdfStatsBox!.y).toBeLessThan(pdfCompositionBox!.y);
  await expect(page.getByText('51~54번 전체').first()).toBeVisible();
  await expect(page.locator('[data-testid^="metadata-coverage-warning-"]')).toHaveCount(0);
  await expect(page.getByTestId('metadata-coverage-unavailable')).toHaveCount(0);
});

test('같은 행의 분석 표는 카드 본문의 남는 높이를 채우고 작은 화면에서는 자연 높이로 돌아간다', async ({ page }) => {
  await page.setViewportSize({ width: 1600, height: 900 });
  await page.goto('/analytics/learning');

  const comparisonRow = page.locator('.analytics-analysis-row--table-panels');
  const comparisonPanel = comparisonRow.locator('.question-comparison-panel');
  const distributionPanel = comparisonRow.locator('.score-distribution-panel');
  await distributionPanel.getByText('표', { exact: true }).click();

  const comparisonBody = comparisonPanel.locator(':scope > .ant-card-body');
  const comparisonTable = comparisonPanel.locator('.analytics-fill-table');
  const comparisonNote = comparisonPanel.locator('.analytics-panel-note');
  const [comparisonPanelBox, distributionPanelBox, comparisonBodyBox, comparisonTableBox, comparisonNoteBox] = await Promise.all([
    comparisonPanel.boundingBox(),
    distributionPanel.boundingBox(),
    comparisonBody.boundingBox(),
    comparisonTable.boundingBox(),
    comparisonNote.boundingBox()
  ]);

  expect(comparisonPanelBox).not.toBeNull();
  expect(distributionPanelBox).not.toBeNull();
  expect(comparisonBodyBox).not.toBeNull();
  expect(comparisonTableBox).not.toBeNull();
  expect(comparisonNoteBox).not.toBeNull();
  expect(Math.abs(comparisonPanelBox!.height - distributionPanelBox!.height)).toBeLessThanOrEqual(1);
  expect(comparisonTableBox!.height).toBeGreaterThan(comparisonBodyBox!.height * 0.8);
  expect(Math.abs(
    comparisonTableBox!.y + comparisonTableBox!.height + 8 - comparisonNoteBox!.y
  )).toBeLessThanOrEqual(1);

  const comparisonRowHeights = await comparisonTable.locator('tbody > tr').evaluateAll(
    (rows) => rows.map((row) => row.getBoundingClientRect().height)
  );
  expect(Math.max(...comparisonRowHeights)).toBeLessThan(60);

  await page.setViewportSize({ width: 1024, height: 900 });
  const [stackedComparisonPanelBox, stackedDistributionPanelBox, stackedComparisonTableBox] = await Promise.all([
    comparisonPanel.boundingBox(),
    distributionPanel.boundingBox(),
    comparisonTable.boundingBox()
  ]);
  expect(stackedComparisonPanelBox).not.toBeNull();
  expect(stackedDistributionPanelBox).not.toBeNull();
  expect(stackedComparisonTableBox).not.toBeNull();
  expect(stackedComparisonPanelBox!.y).toBeLessThan(stackedDistributionPanelBox!.y);
  expect(stackedComparisonPanelBox!.height).toBeLessThan(stackedDistributionPanelBox!.height);
  expect(stackedComparisonTableBox!.height).toBeLessThan(stackedComparisonPanelBox!.height);
});

test('PDF 사용 분석이 Ant Design expandable 표로 문제 유형별 주제 상세를 표시한다', async ({ page }) => {
  await page.goto('/analytics/learning');

  const pdfPanel = page.locator('.pdf-usage-panel');
  const hierarchyTable = pdfPanel.getByRole('table', {
    name: 'PDF 내보내기 구성과 주제 상세'
  });
  await expect(hierarchyTable).toBeVisible();
  for (const column of ['구성', '대주제', '세부 주제']) {
    await expect(hierarchyTable.getByRole('columnheader', { name: column, exact: true })).toBeVisible();
  }
  await expect(hierarchyTable.getByRole('columnheader', { name: /내보내기 완료 수/ })).toBeVisible();

  const questionRows = hierarchyTable.locator('tbody > tr[data-row-key^="pdf-question-"]');
  await expect(questionRows).toHaveCount(4);
  for (const questionNo of [51, 52, 53, 54]) {
    const row = hierarchyTable.locator(`tbody > tr[data-row-key="pdf-question-${questionNo}"]`);
    await expect(row).toContainText(`${questionNo}번`);
    await expect(row.getByRole('button', { name: '접기' })).toHaveAttribute('aria-expanded', 'true');
    await expect(row.getByRole('progressbar')).toHaveAttribute(
      'aria-label',
      new RegExp(`${questionNo}번 PDF 내보내기 완료 [0-9,]+건, 전체의`)
    );
  }

  const transparentTableCells = [
    hierarchyTable.locator('thead th').first(),
    hierarchyTable.locator('tbody > tr[data-row-key="pdf-question-51"] > td').first(),
    hierarchyTable.locator('tbody > tr[data-row-key^="pdf-topic-51-"] > td').first(),
    hierarchyTable.locator('tbody > tr[data-row-key="pdf-mixed"] > td').first()
  ];
  for (const cell of transparentTableCells) {
    await expect(cell).toHaveCSS('background-color', 'rgba(0, 0, 0, 0)');
  }
  const question51Row = hierarchyTable.locator('tbody > tr[data-row-key="pdf-question-51"]');
  await question51Row.hover();
  await expect(question51Row.locator('td').first()).toHaveCSS('background-color', 'rgba(0, 0, 0, 0)');

  const directSummary = pdfPanel.locator('.pdf-usage-stats > div').filter({ hasText: '직접 귀속' });
  const directCount = Number((await directSummary.locator('strong').innerText()).replace(/[^0-9]/g, ''));
  const questionCounts = await questionRows.evaluateAll((rows) => rows.map((row) => {
    const countLabel = row.querySelector('.pdf-hierarchy-count strong')?.textContent ?? '0';
    return Number(countLabel.replace(/[^0-9]/g, ''));
  }));
  expect(questionCounts.reduce((sum, count) => sum + count, 0)).toBe(directCount);

  const topicRows51 = hierarchyTable.locator('tbody > tr[data-row-key^="pdf-topic-51-"]');
  const initialTopicCount = await topicRows51.count();
  expect(initialTopicCount).toBeGreaterThan(0);
  const topicCounts51 = await topicRows51.evaluateAll((rows) => rows.map((row) => {
    const countLabel = row.querySelector('.pdf-hierarchy-count strong')?.textContent ?? '0';
    return Number(countLabel.replace(/[^0-9]/g, ''));
  }));
  expect(topicCounts51).toEqual([...topicCounts51].sort((left, right) => right - left));

  await question51Row.getByRole('button', { name: '접기' }).focus();
  await page.keyboard.press('Enter');
  await expect(topicRows51).toHaveCount(0);
  await expect(question51Row.getByRole('button', { name: '펼치기' })).toHaveAttribute('aria-expanded', 'false');
  await question51Row.getByRole('button', { name: '펼치기' }).press('Enter');
  await expect(topicRows51).toHaveCount(initialTopicCount);

  for (const rowKey of ['pdf-mixed', 'pdf-unclassified']) {
    const row = hierarchyTable.locator(`tbody > tr[data-row-key="${rowKey}"]`);
    await expect(row).toContainText('주제 분석 불가');
    await expect(row.getByRole('button')).toHaveCount(0);
  }

  await expect(pdfPanel.getByRole('img', { name: /51번 .*혼합 .*미분류/ })).toBeVisible();
});

test('PDF 사용 분석의 두 섹션은 1024px 이하에서 세로로 전환되고 문서 너비를 넘지 않는다', async ({ page }) => {
  await page.setViewportSize({ width: 1024, height: 900 });
  await page.goto('/analytics/learning');

  const pdfPanel = page.locator('.pdf-usage-panel');
  const compositionSection = pdfPanel.locator('.pdf-composition');
  const hierarchySection = pdfPanel.locator('.pdf-hierarchy');
  await expect(compositionSection).toBeVisible();
  await expect(hierarchySection).toBeVisible();

  const [compositionBox, hierarchyBox] = await Promise.all([
    compositionSection.boundingBox(),
    hierarchySection.boundingBox()
  ]);
  expect(compositionBox).not.toBeNull();
  expect(hierarchyBox).not.toBeNull();
  expect(compositionBox!.y).toBeLessThan(hierarchyBox!.y);
  expect(Math.abs(compositionBox!.x - hierarchyBox!.x)).toBeLessThanOrEqual(1);
  expect(compositionBox!.height).toBeLessThan(hierarchyBox!.height);

  const hasDocumentOverflow = await page.evaluate(
    () => document.documentElement.scrollWidth > document.documentElement.clientWidth
  );
  expect(hasDocumentOverflow).toBe(false);

  await page.setViewportSize({ width: 375, height: 812 });
  await expect(pdfPanel.locator('.pdf-composition-legend')).toHaveCount(0);
  const [mobilePieBox, mobileCompositionBox] = await Promise.all([
    pdfPanel.locator('.pdf-composition-pie').boundingBox(),
    compositionSection.boundingBox()
  ]);
  expect(mobilePieBox).not.toBeNull();
  expect(mobileCompositionBox).not.toBeNull();
  expect(mobilePieBox!.width).toBeLessThan(mobileCompositionBox!.width);
  const hasMobileDocumentOverflow = await page.evaluate(
    () => document.documentElement.scrollWidth > document.documentElement.clientWidth
  );
  expect(hasMobileDocumentOverflow).toBe(false);
});

test('주제별 성과 제출 막대가 많은 제출 순으로 같은 행에 1대1 대응한다', async ({ page }) => {
  await page.goto('/analytics/learning');

  const topicTable = page.getByRole('table', { name: '주제별 성과' });
  const topicRows = topicTable.locator('tbody > tr.ant-table-row');
  await expect(topicRows.first()).toBeVisible();
  await expect(topicTable.getByRole('columnheader', { name: /제출 수/ })).toBeVisible();

  const rowCount = await topicRows.count();
  expect(rowCount).toBeGreaterThan(0);
  await expect(topicTable.locator('.topic-submission-chart__row')).toHaveCount(rowCount);

  const submissionCounts: number[] = [];
  const barWidths: number[] = [];

  for (let index = 0; index < rowCount; index += 1) {
    const row = topicRows.nth(index);
    const cells = row.getByRole('cell');
    const identity = [
      await cells.nth(0).innerText(),
      await cells.nth(1).innerText(),
      await cells.nth(2).innerText()
    ].join(' · ');
    const submissionsLabel = (await cells.nth(4).innerText()).trim();
    const submissions = Number(submissionsLabel.replaceAll(',', ''));
    const chartRow = row.locator('.topic-submission-chart__row');
    const barWidth = Number(
      await chartRow.locator('.topic-submission-chart__bar').getAttribute('width')
    );

    submissionCounts.push(submissions);
    barWidths.push(barWidth);

    await expect(chartRow.locator('.topic-submission-chart__label')).toHaveText(identity);
    await expect(chartRow.locator('.topic-submission-chart__value')).toHaveText(`${submissionsLabel}건`);
    expect(await chartRow.getByRole('img').getAttribute('aria-label')).toContain(identity);
    expect(await chartRow.getByRole('img').getAttribute('aria-label')).toContain(`제출 수 ${submissionsLabel}건`);

    const [tableRowBox, chartRowBox] = await Promise.all([
      row.boundingBox(),
      chartRow.boundingBox()
    ]);
    expect(tableRowBox).not.toBeNull();
    expect(chartRowBox).not.toBeNull();
    expect(
      Math.abs(
        tableRowBox!.y + tableRowBox!.height / 2 -
        (chartRowBox!.y + chartRowBox!.height / 2)
      )
    ).toBeLessThanOrEqual(1);
  }

  expect(submissionCounts).toEqual([...submissionCounts].sort((a, b) => b - a));
  const maxSubmissions = Math.max(...submissionCounts);
  barWidths.forEach((width, index) => {
    expect(width).toBeCloseTo((submissionCounts[index] / maxSubmissions) * 100, 5);
  });
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
  await expect(
    page.getByLabel('주제별 성과').getByRole('cell', { name: '문화', exact: true })
  ).toBeVisible();
  await expect(
    page.getByRole('table', { name: 'PDF 내보내기 구성과 주제 상세' })
      .locator('tbody > tr[data-row-key="pdf-question-53"]')
  ).toBeVisible();
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
