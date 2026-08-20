import { createHash } from 'node:crypto';
import { expect, test, type Page } from '@playwright/test';

import {
  accessToken,
  adminEmail,
  adminPassword,
  baselineAnalytics,
  expectedProjectRef,
  metadataCte,
  normalizeRows,
  optionValues,
  projectRef,
  runSql,
  type BaselineRow,
  type DateRange,
  type FilterCase,
  type LiveRpcRow,
  type SqlDateBoundaries
} from './analytics-learning-live-baseline';
import {
  parseLearningAnalyticsQuery,
  type LearningAnalyticsPeriod,
  type LearningQuestionNo
} from '../../src/features/analytics/model/analytics-learning-query';
function buildUrl(filterCase: FilterCase): string {
  const params = new URLSearchParams({
    period: filterCase.period,
    compare: filterCase.period !== 'all' && filterCase.compare ? '1' : '0'
  });
  for (const question of filterCase.questions) params.append('question', String(question));
  if (filterCase.period === 'custom' && filterCase.from && filterCase.to) {
    params.set('from', filterCase.from);
    params.set('to', filterCase.to);
  }
  if (filterCase.topicMain) params.set('topicMain', filterCase.topicMain);
  if (filterCase.topicDetail) params.set('topicDetail', filterCase.topicDetail);
  for (const [key, values] of Object.entries(filterCase.details ?? {})) {
    for (const value of values) params.append(`d.${key}`, value);
  }
  return `/analytics/learning?${params.toString()}`;
}

async function openLearningAnalytics(page: Page): Promise<void> {
  await page.goto('/analytics/learning');
  if (await page.getByRole('heading', { name: 'TOPIK 관리자 로그인' }).isVisible()) {
    await page.getByLabel('이메일').fill(adminEmail ?? '');
    await page.getByLabel('비밀번호').fill(adminPassword ?? '');
    await page.getByRole('button', { name: '로그인' }).click();
  }
  await expect(page.getByRole('heading', { name: '학습 분석' })).toBeVisible();
}

async function expectSubmissionKpi(page: Page, expected: number): Promise<void> {
  const card = page.locator('.analytics-kpi-card').filter({ hasText: '제출 수' });
  await expect(card.locator('.analytics-kpi-value')).toHaveText(expected.toLocaleString('ko-KR'));
}

async function navigateAndReadRpc(page: Page, url: string): Promise<LiveRpcRow> {
  const responsePromise = page.waitForResponse((response) =>
    response.url().includes('/rest/v1/rpc/get_admin_learning_analytics_filtered') &&
    response.request().method() === 'POST' &&
    response.status() < 400
  );
  await page.goto(url);
  const response = await responsePromise;
  const rows = await response.json() as LiveRpcRow[];
  if (!rows[0]) throw new Error(`analytics RPC returned no row for ${url}`);
  return rows[0];
}

function expectRpcMatchesBaseline(
  rpc: LiveRpcRow,
  baseline: BaselineRow,
  range: DateRange,
  filterCase: FilterCase
): void {
  expect(rpc.scope).toMatchObject({
    startDate: range.startDate,
    endDate: range.endDate,
    compareStartDate: range.compareStartDate,
    compareEndDate: range.compareEndDate,
    comparePrevious: Boolean(filterCase.compare && filterCase.period !== 'all')
  });
  expect(rpc.summary.submissions).toBe(Number(baseline.submission_count));
  expect(rpc.summary.submissionsPrev).toBe(
    filterCase.compare && filterCase.period !== 'all'
      ? Number(baseline.previous_submission_count)
      : null
  );

  expect(normalizeRows(
    rpc.per_question.map((row) => ({
      questionNo: row.questionNo,
      submissions: row.submissions
    })),
    ['questionNo']
  )).toEqual(normalizeRows(baseline.per_question, ['questionNo']));

  expect(normalizeRows(
    rpc.score_distribution.map((row) => ({
      questionNo: row.questionNo,
      bucket: row.bucket,
      count: row.count
    })),
    ['questionNo', 'bucket']
  )).toEqual(normalizeRows(baseline.score_distribution, ['questionNo', 'bucket']));

  expect(normalizeRows(
    rpc.weak_dimensions.map((row) => ({
      questionNo: row.questionNo,
      dimension: row.dimension,
      submissions: row.submissions,
      weaknessOccurrences: row.weaknessOccurrences,
      maxSeverity: row.maxSeverity
    })),
    ['questionNo', 'dimension']
  )).toEqual(normalizeRows(baseline.weak_dimensions, ['questionNo', 'dimension']));

  expect(normalizeRows(
    rpc.topic_stats.map((row) => ({
      questionNo: row.questionNo,
      topicMain: row.topicMain,
      topicDetail: row.topicDetail,
      submissions: row.submissions,
      avgScoreNormalizedPrev: row.avgScoreNormalizedPrev
    })),
    ['questionNo', 'topicMain', 'topicDetail']
  )).toEqual(normalizeRows(
    baseline.topic_stats,
    ['questionNo', 'topicMain', 'topicDetail']
  ));

  expect(normalizeRows(rpc.pdf_usage.perQuestion, ['questionNo'])).toEqual(
    normalizeRows(baseline.pdf_per_question, ['questionNo'])
  );
  expect(normalizeRows(
    rpc.pdf_usage.perTopic,
    ['questionNo', 'topicMain', 'topicDetail']
  )).toEqual(normalizeRows(
    baseline.pdf_per_topic,
    ['questionNo', 'topicMain', 'topicDetail']
  ));
  expect(rpc.pdf_usage.attributableExports).toBe(
    baseline.pdf_per_question.reduce((sum, row) => sum + Number(row.count), 0)
  );
}

async function expectAnalyticsPanelsRenderRpc(page: Page, rpc: LiveRpcRow): Promise<void> {
  await expect(
    page.getByRole('table', { name: '문제 유형별 비교' })
      .locator('.ant-table-tbody .ant-table-row')
  ).toHaveCount(rpc.per_question.length);
  await expect(page.locator('.score-distribution-segment')).toHaveCount(
    rpc.score_distribution.length
  );
  await expect(
    page.getByRole('table', { name: '주제별 성과' })
      .locator('.ant-table-tbody .ant-table-row')
  ).toHaveCount(rpc.topic_stats.length);
  await expect(
    page.locator('.pdf-hierarchy__table .ant-table-tbody tr[data-row-key^="pdf-question-"]')
  ).toHaveCount(rpc.pdf_usage.perQuestion.length);
  await expect(
    page.locator('.pdf-hierarchy__table .ant-table-tbody tr[data-row-key^="pdf-topic-"]')
  ).toHaveCount(rpc.pdf_usage.perTopic.length);
  await expect(page.locator('.pdf-hierarchy__table tr[data-row-key="pdf-mixed"]')).toHaveCount(1);
  await expect(page.locator('.pdf-hierarchy__table tr[data-row-key="pdf-unclassified"]')).toHaveCount(1);
}

test.beforeAll(() => {
  if (!adminEmail || !adminPassword) throw new Error('E2E_ADMIN_EMAIL and E2E_ADMIN_PASSWORD are required.');
  if (!accessToken || !projectRef || !expectedProjectRef) {
    throw new Error('SUPABASE_ACCESS_TOKEN, SUPABASE_PROJECT_REF, and EXPECTED_SUPABASE_PROJECT_REF are required.');
  }
  if (projectRef !== expectedProjectRef) {
    throw new Error(`live E2E project mismatch: requested ${projectRef}, expected ${expectedProjectRef}`);
  }
});

test('dev DB PDF 문제 유형·주제별 집계를 독립 SQL과 화면에서 검증한다', async ({ page }) => {
  test.setTimeout(120_000);
  await openLearningAnalytics(page);

  const boundaryRows = await runSql<SqlDateBoundaries>(`select
    (current_timestamp at time zone 'Asia/Seoul')::date::text kst_today,
    ((current_timestamp at time zone 'Asia/Seoul')::date - 6)::text start_7d,
    ((current_timestamp at time zone 'Asia/Seoul')::date - 29)::text start_30d,
    ((current_timestamp at time zone 'Asia/Seoul')::date - 89)::text start_90d;`);
  const boundaries = boundaryRows[0];
  if (!boundaries) throw new Error('KST date boundary query returned no row.');

  const filterCase: FilterCase = {
    label: 'PDF 문제 유형·주제별 집계',
    period: 'all',
    compare: false,
    questions: [51, 52, 53, 54]
  };
  const [rpc, baseline] = await Promise.all([
    navigateAndReadRpc(page, buildUrl(filterCase)),
    baselineAnalytics(filterCase, boundaries)
  ]);

  expect(normalizeRows(
    rpc.pdf_usage.perTopic,
    ['questionNo', 'topicMain', 'topicDetail']
  )).toEqual(normalizeRows(
    baseline.row.pdf_per_topic,
    ['questionNo', 'topicMain', 'topicDetail']
  ));
  expect(rpc.pdf_usage.perTopic.reduce((sum, row) => sum + row.count, 0)).toBe(
    rpc.pdf_usage.attributableExports
  );
  expect(rpc.pdf_usage.perTopic.map((row) => row.count)).toEqual(
    [...rpc.pdf_usage.perTopic.map((row) => row.count)].sort((left, right) => right - left)
  );
  await expect(
    page.locator('.pdf-hierarchy__table .ant-table-tbody tr[data-row-key^="pdf-topic-"]')
  ).toHaveCount(rpc.pdf_usage.perTopic.length);
  await expect(
    page.getByRole('table', { name: 'PDF 내보내기 구성과 주제 상세' })
  ).toBeVisible();
});

test('dev DB 독립 기준값으로 기간·문항·주제·문항별 세부 필터의 실제 조회를 검증한다', async ({ page }, testInfo) => {
  test.setTimeout(600_000);
  const rpcFailures: string[] = [];
  const consoleErrors: string[] = [];
  page.on('response', (response) => {
    if (response.url().includes('/rest/v1/rpc/') && response.status() >= 400) {
      rpcFailures.push(`${response.status()} ${response.url()}`);
    }
  });
  page.on('console', (message) => {
    if (message.type() === 'error') consoleErrors.push(message.text());
  });

  await openLearningAnalytics(page);
  const boundaryRows = await runSql<SqlDateBoundaries>(`select
    (current_timestamp at time zone 'Asia/Seoul')::date::text kst_today,
    ((current_timestamp at time zone 'Asia/Seoul')::date - 6)::text start_7d,
    ((current_timestamp at time zone 'Asia/Seoul')::date - 29)::text start_30d,
    ((current_timestamp at time zone 'Asia/Seoul')::date - 89)::text start_90d;`);
  const boundaries = boundaryRows[0];
  if (!boundaries) throw new Error('KST date boundary query returned no row.');
  const latestRows = await runSql<{ max_date: string }>(
    "select max((submitted_at at time zone 'Asia/Seoul')::date)::text max_date from public.writing_submissions;"
  );
  const latestDate = latestRows[0]?.max_date;
  expect(latestDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);

  const allQuestions: LearningQuestionNo[] = [51, 52, 53, 54];
  const cases: FilterCase[] = [
    ...(['7d', '30d', '90d'] as LearningAnalyticsPeriod[]).map((period) => ({
      label: `기간 ${period}`,
      period,
      compare: true,
      questions: allQuestions
    })),
    {
      label: '기간 30d 비교 끔',
      period: '30d',
      compare: false,
      questions: allQuestions
    },
    {
      label: '기간 all',
      period: 'all',
      questions: allQuestions
    },
    {
      label: '기간 custom',
      period: 'custom',
      from: latestDate,
      to: latestDate,
      questions: allQuestions
    },
    ...allQuestions.map((questionNo) => ({
      label: `문항 ${questionNo}`,
      period: 'all' as const,
      questions: [questionNo]
    }))
  ];

  const topicRows = await runSql<{ topic_main: string; topic_detail: string }>(`select distinct v.topic_main, v.topic_detail
    from public.writing_submissions ws
    join private.admin_writing_question_identity_map pm on pm.problem_id = ws.problem_id
    join public.topik_writing_question_recommendation_view v
      on v.question_id = pm.question_id and v.item_number = pm.item_number
    where pm.mapping_status = 'active' and pm.hold_reason is null
    order by v.topic_main, v.topic_detail;`);
  const topic = topicRows[0];
  expect(topic).toBeTruthy();
  cases.push({
    label: '대주제 단독',
    period: 'all',
    questions: allQuestions,
    topicMain: topic.topic_main
  });
  cases.push({
    label: '대주제+세부 주제',
    period: 'all',
    questions: allQuestions,
    topicMain: topic.topic_main,
    topicDetail: topic.topic_detail
  });
  const zeroTopicPair = topicRows
    .flatMap((main) => topicRows.map((detail) => ({
      topic_main: main.topic_main,
      topic_detail: detail.topic_detail
    })))
    .find((candidate) => !topicRows.some((row) =>
      row.topic_main === candidate.topic_main &&
      row.topic_detail === candidate.topic_detail
    ));
  expect(zeroTopicPair, 'a known zero-result topic pair is required').toBeTruthy();
  cases.push({
    label: '의도적인 주제 0건 조합',
    period: 'all',
    questions: allQuestions,
    topicMain: zeroTopicPair?.topic_main,
    topicDetail: zeroTopicPair?.topic_detail
  });

  const detailKeys: Array<[LearningQuestionNo, string]> = [
    [51, 'blankRole'], [51, 'blankFunction'], [51, 'answerType'],
    [52, 'connectionFunction'], [52, 'answerScope'],
    [53, 'dataType'], [53, 'requiredStructure'],
    [54, 'essayType'], [54, 'stance'], [54, 'requiredStructure']
  ];
  for (const [questionNo, key] of detailKeys) {
    const [value] = await optionValues(questionNo, key);
    expect(value, `${questionNo}.${key} must have a referenced option`).toBeTruthy();
    cases.push({
      label: `${questionNo}.${key}`,
      period: 'all',
      questions: [questionNo],
      details: { [key]: [value] }
    });
  }

  const intersectionRows = await runSql<{
    topic_main: string;
    topic_detail: string;
    value: string;
  }>(`with ${metadataCte}
    select distinct m.topic_main, m.topic_detail, option.value
    from question_metadata m
    join public.writing_submissions ws on ws.problem_id = m.problem_id
    cross join lateral jsonb_array_elements_text(m.detail_values->'blankRole') option(value)
    where m.item_number = 51 and option.value <> ''
    order by m.topic_main, m.topic_detail, option.value
    limit 1;`);
  const intersection = intersectionRows[0];
  expect(intersection, 'a referenced question/topic/detail intersection is required').toBeTruthy();
  cases.push({
    label: '문항+주제+세부 조건 교차 AND',
    period: 'all',
    questions: [51],
    topicMain: intersection.topic_main,
    topicDetail: intersection.topic_detail,
    details: { blankRole: [intersection.value] }
  });

  const orValues = await optionValues(51, 'blankRole', 2);
  expect(orValues).toHaveLength(2);
  cases.push({
    label: '동일 필드 OR',
    period: 'all',
    questions: [51],
    details: { blankRole: orValues }
  });
  const [dataType] = await optionValues(53, 'dataType');
  const [requiredStructure] = await optionValues(53, 'requiredStructure');
  cases.push({
    label: '서로 다른 필드 AND',
    period: 'all',
    questions: [53],
    details: { dataType: [dataType], requiredStructure: [requiredStructure] }
  });

  const evidence: Array<{
    label: string;
    url: string;
    submissions: number;
    previousSubmissions: number | null;
  }> = [];
  for (const filterCase of cases) {
    const baseline = await baselineAnalytics(filterCase, boundaries);
    const url = buildUrl(filterCase);
    const rpc = await navigateAndReadRpc(page, url);
    await expect(page.getByRole('heading', { name: '학습 분석' })).toBeVisible();
    expectRpcMatchesBaseline(rpc, baseline.row, baseline.range, filterCase);
    await expectSubmissionKpi(page, Number(baseline.row.submission_count));
    await expectAnalyticsPanelsRenderRpc(page, rpc);
    evidence.push({
      label: filterCase.label,
      url,
      submissions: Number(baseline.row.submission_count),
      previousSubmissions: filterCase.compare && filterCase.period !== 'all'
        ? Number(baseline.row.previous_submission_count)
        : null
    });
  }

  await navigateAndReadRpc(
    page,
    buildUrl({ label: 'drawer start', period: 'all', questions: [53] })
  );
  await page.getByRole('button', { name: /분석 조건/ }).click();
  await page.getByRole('checkbox', { name: '51번 빈칸 완성' }).check();
  await page.getByText('90일', { exact: true }).last().click();
  const drawerResponsePromise = page.waitForResponse((response) =>
    response.url().includes('/rest/v1/rpc/get_admin_learning_analytics_filtered') &&
    response.request().method() === 'POST' &&
    response.status() < 400
  );
  await page.getByRole('button', { name: '분석 적용' }).click();
  const drawerResponse = await drawerResponsePromise;
  const drawerRows = await drawerResponse.json() as LiveRpcRow[];
  const drawerRpc = drawerRows[0];
  if (!drawerRpc) throw new Error('Drawer analytics RPC returned no row.');
  await expect.poll(() => new URL(page.url()).searchParams.getAll('question')).toEqual(['51', '53']);
  await expect.poll(() => new URL(page.url()).searchParams.get('period')).toBe('90d');
  const appliedQuery = parseLearningAnalyticsQuery(new URL(page.url()).searchParams);
  const drawerCase: FilterCase = {
    label: 'Drawer 실제 선택',
    period: appliedQuery.period,
    compare: appliedQuery.compare,
    questions: appliedQuery.questions,
    from: appliedQuery.from,
    to: appliedQuery.to,
    topicMain: appliedQuery.topicMain,
    topicDetail: appliedQuery.topicDetail,
    details: appliedQuery.detailFilters
  };
  const drawerBaseline = await baselineAnalytics(drawerCase, boundaries);
  expectRpcMatchesBaseline(drawerRpc, drawerBaseline.row, drawerBaseline.range, drawerCase);
  await expectSubmissionKpi(page, Number(drawerBaseline.row.submission_count));
  await expectAnalyticsPanelsRenderRpc(page, drawerRpc);
  evidence.push({
    label: drawerCase.label,
    url: page.url(),
    submissions: Number(drawerBaseline.row.submission_count),
    previousSubmissions: Number(drawerBaseline.row.previous_submission_count)
  });

  await expect(page.getByTestId('metadata-coverage-unavailable')).toHaveCount(0);
  await expect(page.locator('[data-testid^="metadata-coverage-warning-"]')).toHaveCount(0);
  expect(rpcFailures).toEqual([]);
  expect(consoleErrors).toEqual([]);

  const payload = JSON.stringify(evidence);
  await testInfo.attach('analytics-learning-live-baseline.json', {
    body: JSON.stringify({
      projectRef,
      baselineHash: createHash('sha256').update(payload).digest('hex'),
      cases: evidence
    }, null, 2),
    contentType: 'application/json'
  });
});
