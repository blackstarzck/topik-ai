import { createHash } from 'node:crypto';
import { expect, test, type Page } from '@playwright/test';

import {
  parseLearningAnalyticsQuery,
  type LearningAnalyticsPeriod,
  type LearningQuestionNo
} from '../../src/features/analytics/model/analytics-learning-query';
import type {
  LearningAnalyticsPdfUsage,
  LearningAnalyticsQuestionStat,
  LearningAnalyticsScoreBucket,
  LearningAnalyticsSummary,
  LearningAnalyticsTopicStat,
  LearningAnalyticsWeakDimension
} from '../../src/features/analytics/api/analytics-learning-service';

const adminEmail = process.env.E2E_ADMIN_EMAIL;
const adminPassword = process.env.E2E_ADMIN_PASSWORD;
const accessToken = process.env.SUPABASE_ACCESS_TOKEN;
const projectRef = process.env.SUPABASE_PROJECT_REF;
const expectedProjectRef = process.env.EXPECTED_SUPABASE_PROJECT_REF;

type DetailFilters = Record<string, string[]>;
type FilterCase = {
  label: string;
  period: LearningAnalyticsPeriod;
  compare?: boolean;
  questions: LearningQuestionNo[];
  from?: string | null;
  to?: string | null;
  topicMain?: string | null;
  topicDetail?: string | null;
  details?: DetailFilters;
};

type DateRange = {
  startDate: string | null;
  endDate: string | null;
  compareStartDate: string | null;
  compareEndDate: string | null;
};

type SqlDateBoundaries = {
  kst_today: string;
  start_7d: string;
  start_30d: string;
  start_90d: string;
};

type BaselineRow = {
  submission_count: number | string;
  previous_submission_count: number | string;
  per_question: Array<{ questionNo: number; submissions: number }>;
  score_distribution: Array<{ questionNo: number; bucket: number; count: number }>;
  weak_dimensions: Array<{
    questionNo: number;
    dimension: string;
    submissions: number;
    weaknessOccurrences: number;
    maxSeverity: number;
  }>;
  topic_stats: Array<{
    questionNo: number;
    topicMain: string;
    topicDetail: string;
    submissions: number;
    avgScoreNormalizedPrev: number | null;
  }>;
  pdf_per_question: Array<{ questionNo: number; count: number }>;
  pdf_per_topic: Array<{
    questionNo: number;
    topicMain: string | null;
    topicDetail: string | null;
    count: number;
  }>;
};

type LiveRpcRow = {
  summary: LearningAnalyticsSummary;
  per_question: LearningAnalyticsQuestionStat[];
  score_distribution: LearningAnalyticsScoreBucket[];
  weak_dimensions: LearningAnalyticsWeakDimension[];
  topic_stats: LearningAnalyticsTopicStat[];
  pdf_usage: LearningAnalyticsPdfUsage;
  scope: {
    startDate: string | null;
    endDate: string | null;
    compareStartDate: string | null;
    compareEndDate: string | null;
    comparePrevious: boolean;
  };
};

function sqlLiteral(value: string): string {
  return `'${value.replaceAll("'", "''")}'`;
}

async function runSql<T extends Record<string, unknown>>(sql: string): Promise<T[]> {
  const response = await fetch(`https://api.supabase.com/v1/projects/${projectRef}/database/query`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ query: sql })
  });
  const body = await response.text();
  if (!response.ok) throw new Error(`read-only baseline query failed (${response.status}): ${body}`);
  return JSON.parse(body) as T[];
}

const metadataCte = `resolved_problem_map as (
  select distinct on (pm.problem_id)
    pm.problem_id, pm.question_id, pm.item_number
  from private.admin_writing_question_identity_map pm
  where pm.mapping_status = 'active' and pm.hold_reason is null
  order by pm.problem_id,
    case when pm.mapping_kind = 'legacy' then 0 else 1 end,
    pm.question_id
), question_metadata as (
  select pm.problem_id, v.item_number, v.topic_main, v.topic_detail,
    case v.item_number
      when 51 then jsonb_build_object(
        'blankRole', to_jsonb(array_remove(array[q51.blank_1_role, q51.blank_2_role], null)),
        'blankFunction', to_jsonb(array_remove(array[q51.blank_1_function, q51.blank_2_function], null)),
        'answerType', to_jsonb(array_remove(array[q51.blank_1_answer_type, q51.blank_2_answer_type], null)))
      when 52 then jsonb_build_object(
        'connectionFunction', jsonb_build_array(q52.connection_function),
        'answerScope', jsonb_build_array(q52.answer_scope_type))
      when 53 then jsonb_build_object(
        'dataType', jsonb_build_array(q53.data_type),
        'requiredStructure', case when jsonb_typeof(q53.required_structure) = 'array'
          then q53.required_structure else '[]'::jsonb end)
      when 54 then jsonb_build_object(
        'essayType', jsonb_build_array(q54.essay_type),
        'stance', jsonb_build_array(q54.stance_requirement),
        'requiredStructure', case when jsonb_typeof(q54.required_structure) = 'array'
          then q54.required_structure else '[]'::jsonb end)
      else '{}'::jsonb
    end detail_values
  from resolved_problem_map pm
  join private.admin_writing_problem_identity_projection mapped_problem
    on mapped_problem.problem_id = pm.problem_id and mapped_problem.item_number = pm.item_number
  join public.topik_writing_question_recommendation_view v
    on v.question_id = pm.question_id and v.item_number = pm.item_number
  left join public.topik_writing_51_questions q51
    on q51.question_id = v.question_id and v.item_number = 51
  left join public.topik_writing_52_questions q52
    on q52.question_id = v.question_id and v.item_number = 52
  left join public.topik_writing_53_questions q53
    on q53.question_id = v.question_id and v.item_number = 53
  left join public.topik_writing_54_questions q54
    on q54.question_id = v.question_id and v.item_number = 54
  where v.topic_main is not null and v.topic_detail is not null
    and (
      (v.item_number = 51 and q51.blank_1_role is not null and q51.blank_1_function is not null
        and q51.blank_1_answer_type is not null and q51.blank_2_role is not null
        and q51.blank_2_function is not null and q51.blank_2_answer_type is not null)
      or (v.item_number = 52 and q52.connection_function is not null and q52.answer_scope_type is not null)
      or (v.item_number = 53 and q53.data_type is not null and q53.required_structure is not null)
      or (v.item_number = 54 and q54.essay_type is not null and q54.stance_requirement is not null
        and q54.required_structure is not null)
    )
)`;

function subtractDays(date: string, days: number): string {
  const parsed = new Date(`${date}T00:00:00Z`);
  parsed.setUTCDate(parsed.getUTCDate() - days);
  return parsed.toISOString().slice(0, 10);
}

function resolveCaseRange(
  filterCase: FilterCase,
  boundaries: SqlDateBoundaries
): DateRange {
  if (filterCase.period === 'all') {
    return {
      startDate: null,
      endDate: null,
      compareStartDate: null,
      compareEndDate: null
    };
  }
  const startDate = filterCase.period === 'custom'
    ? filterCase.from ?? null
    : boundaries[`start_${filterCase.period}` as 'start_7d' | 'start_30d' | 'start_90d'];
  const endDate = filterCase.period === 'custom'
    ? filterCase.to ?? null
    : boundaries.kst_today;
  if (!startDate || !endDate || !filterCase.compare) {
    return { startDate, endDate, compareStartDate: null, compareEndDate: null };
  }
  const durationDays = Math.round(
    (new Date(`${endDate}T00:00:00Z`).getTime() -
      new Date(`${startDate}T00:00:00Z`).getTime()) /
      86_400_000
  ) + 1;
  return {
    startDate,
    endDate,
    compareStartDate: subtractDays(startDate, durationDays),
    compareEndDate: subtractDays(startDate, 1)
  };
}

function normalizeRows<T extends Record<string, unknown>>(
  rows: T[],
  keys: Array<keyof T>
): T[] {
  return [...rows]
    .map((row) => Object.fromEntries(
      Object.entries(row).map(([key, value]) => [
        key,
        typeof value === 'string' && /^-?\d+(?:\.\d+)?$/.test(value)
          ? Number(value)
          : value
      ])
    ) as T)
    .sort((left, right) => keys
      .map((key) => String(left[key]).localeCompare(String(right[key]), 'en', { numeric: true }))
      .find((value) => value !== 0) ?? 0);
}

async function baselineAnalytics(
  filterCase: FilterCase,
  boundaries: SqlDateBoundaries
): Promise<{ row: BaselineRow; range: DateRange }> {
  const range = resolveCaseRange(filterCase, boundaries);
  const questionArray = `array[${filterCase.questions.join(',')}]::smallint[]`;
  const metadataPredicates = [`m.item_number = any(${questionArray})`];
  if (filterCase.topicMain) {
    metadataPredicates.push(`m.topic_main = ${sqlLiteral(filterCase.topicMain)}`);
  }
  if (filterCase.topicDetail) {
    metadataPredicates.push(`m.topic_detail = ${sqlLiteral(filterCase.topicDetail)}`);
  }
  for (const [key, values] of Object.entries(filterCase.details ?? {})) {
    const selected = values.map(sqlLiteral).join(', ');
    metadataPredicates.push(
      `coalesce(m.detail_values->${sqlLiteral(key)}, '[]'::jsonb) ?| array[${selected}]`
    );
  }
  const hasMetadataFilter = Boolean(
    filterCase.topicMain ||
    filterCase.topicDetail ||
    Object.keys(filterCase.details ?? {}).length
  );
  const currentDatePredicate = range.startDate && range.endDate
    ? `ws.submitted_at >= (${sqlLiteral(range.startDate)}::date::timestamp at time zone 'Asia/Seoul')
       and ws.submitted_at < ((${sqlLiteral(range.endDate)}::date + 1)::timestamp at time zone 'Asia/Seoul')`
    : 'true';
  const previousDatePredicate = range.compareStartDate && range.compareEndDate
    ? `ws.submitted_at >= (${sqlLiteral(range.compareStartDate)}::date::timestamp at time zone 'Asia/Seoul')
       and ws.submitted_at < ((${sqlLiteral(range.compareEndDate)}::date + 1)::timestamp at time zone 'Asia/Seoul')`
    : 'false';
  const pdfDatePredicate = range.startDate && range.endDate
    ? `pe.occurred_at >= (${sqlLiteral(range.startDate)}::date::timestamp at time zone 'Asia/Seoul')
       and pe.occurred_at < ((${sqlLiteral(range.endDate)}::date + 1)::timestamp at time zone 'Asia/Seoul')`
    : 'true';

  const rows = await runSql<BaselineRow>(`with ${metadataCte},
    filtered_metadata as (
      select m.* from question_metadata m
      where ${metadataPredicates.join('\n        and ')}
    ),
    current_subs as (
      select ws.id, ws.user_id, problem.item_number as question_no, m.topic_main, m.topic_detail,
        case when ws.feedback_status = 'complete'
          and wf.score_total is not null and coalesce(wf.score_max, 0) > 0
          then round(wf.score_total::numeric / wf.score_max * 100, 1) end score_normalized
      from public.writing_submissions ws
      join private.admin_writing_problem_identity_projection problem
        on problem.problem_id = ws.problem_id
      left join filtered_metadata m on m.problem_id = ws.problem_id
      left join public.writing_feedback wf
        on wf.submission_id = ws.id and wf.user_id = ws.user_id
      where problem.item_number = any(${questionArray})
        and ${currentDatePredicate}
        and ${hasMetadataFilter ? 'm.problem_id is not null' : 'true'}
    ),
    previous_subs as (
      select ws.id, ws.user_id, problem.item_number as question_no, m.topic_main, m.topic_detail,
        case when ws.feedback_status = 'complete'
          and wf.score_total is not null and coalesce(wf.score_max, 0) > 0
          then round(wf.score_total::numeric / wf.score_max * 100, 1) end score_normalized
      from public.writing_submissions ws
      join private.admin_writing_problem_identity_projection problem
        on problem.problem_id = ws.problem_id
      left join filtered_metadata m on m.problem_id = ws.problem_id
      left join public.writing_feedback wf
        on wf.submission_id = ws.id and wf.user_id = ws.user_id
      where problem.item_number = any(${questionArray})
        and ${previousDatePredicate}
        and ${hasMetadataFilter ? 'm.problem_id is not null' : 'true'}
    ),
    bucket_definitions as (
      select * from (values
        (1, 0::numeric, 40::numeric),
        (2, 40::numeric, 60::numeric),
        (3, 60::numeric, 80::numeric),
        (4, 80::numeric, 100::numeric)
      ) b(bucket, lower_bound, upper_bound)
    ),
    current_topics as (
      select question_no, topic_main, topic_detail, count(*)::integer submissions
      from current_subs
      where topic_main is not null and topic_detail is not null
      group by question_no, topic_main, topic_detail
    ),
    previous_topics as (
      select question_no, topic_main, topic_detail,
        round(avg(score_normalized), 1) avg_score_normalized
      from previous_subs
      where topic_main is not null and topic_detail is not null
      group by question_no, topic_main, topic_detail
    ),
    pdf_events as (
      select se.id, se.occurred_at, se.payload->>'source_type' source_type,
        case when coalesce(se.payload->>'source_id', '') ~*
          '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
          then (se.payload->>'source_id')::uuid end source_id
      from public.study_events se
      where se.event_type = 'export_downloaded'
    ),
    scoped_pdf as (
      select
        pe.id,
        source_problem.item_number as question_no,
        all_meta.topic_main,
        all_meta.topic_detail
      from pdf_events pe
      join public.writing_submissions source_submission
        on pe.source_type = 'submission' and source_submission.id = pe.source_id
      join private.admin_writing_problem_identity_projection source_problem
        on source_problem.problem_id = source_submission.problem_id
      left join question_metadata all_meta on all_meta.problem_id = source_problem.problem_id
      left join filtered_metadata filtered_meta on filtered_meta.problem_id = source_problem.problem_id
      where ${pdfDatePredicate}
        and coalesce(all_meta.problem_id, source_problem.problem_id) is not null
        and ${hasMetadataFilter
          ? 'filtered_meta.problem_id is not null'
          : `source_problem.item_number = any(${questionArray})`}
    )
    select
      (select count(*)::integer from current_subs) submission_count,
      (select count(*)::integer from previous_subs) previous_submission_count,
      (select coalesce(jsonb_agg(jsonb_build_object(
        'questionNo', selected.question_no,
        'submissions', (select count(*) from current_subs s where s.question_no = selected.question_no)
      ) order by selected.question_no), '[]'::jsonb)
        from unnest(${questionArray}) selected(question_no)) per_question,
      (select coalesce(jsonb_agg(jsonb_build_object(
        'questionNo', selected.question_no, 'bucket', b.bucket,
        'count', (select count(*) from current_subs s
          where s.question_no = selected.question_no and s.score_normalized is not null
            and case when b.bucket = 1
              then s.score_normalized >= b.lower_bound and s.score_normalized <= b.upper_bound
              else s.score_normalized > b.lower_bound and s.score_normalized <= b.upper_bound end)
      ) order by selected.question_no, b.bucket), '[]'::jsonb)
        from unnest(${questionArray}) selected(question_no)
        cross join bucket_definitions b) score_distribution,
      (select coalesce(jsonb_agg(jsonb_build_object(
        'questionNo', d.question_no, 'dimension', d.dimension,
        'submissions', d.submissions, 'weaknessOccurrences', d.weakness_occurrences,
        'maxSeverity', d.max_severity
      ) order by d.question_no, d.dimension), '[]'::jsonb)
        from (
          select s.question_no, fds.dimension,
            count(distinct fds.submission_id)::integer submissions,
            count(*) filter (where coalesce(fds.weakness_level, 0) > 0)::integer weakness_occurrences,
            coalesce(max(fds.weakness_level), 0)::integer max_severity
          from current_subs s
          join public.feedback_dimension_scores fds
            on fds.submission_id = s.id and fds.user_id = s.user_id
          group by s.question_no, fds.dimension
        ) d) weak_dimensions,
      (select coalesce(jsonb_agg(jsonb_build_object(
        'questionNo', c.question_no,
        'topicMain', c.topic_main, 'topicDetail', c.topic_detail,
        'submissions', c.submissions,
        'avgScoreNormalizedPrev', ${filterCase.compare ? 'p.avg_score_normalized' : 'null'}
      ) order by c.question_no, c.topic_main, c.topic_detail), '[]'::jsonb)
        from current_topics c
        left join previous_topics p
          on p.question_no = c.question_no
         and p.topic_main = c.topic_main and p.topic_detail = c.topic_detail) topic_stats,
      (select coalesce(jsonb_agg(jsonb_build_object(
        'questionNo', selected.question_no,
        'count', (select count(*) from scoped_pdf p where p.question_no = selected.question_no)
      ) order by selected.question_no), '[]'::jsonb)
        from unnest(${questionArray}) selected(question_no)) pdf_per_question,
      (select coalesce(jsonb_agg(jsonb_build_object(
        'questionNo', p.question_no,
        'topicMain', p.topic_main,
        'topicDetail', p.topic_detail,
        'count', p.count
      ) order by p.count desc, p.question_no, p.topic_main nulls last, p.topic_detail nulls last), '[]'::jsonb)
        from (
          select question_no, topic_main, topic_detail, count(*)::integer count
          from scoped_pdf
          group by question_no, topic_main, topic_detail
        ) p) pdf_per_topic;`);
  const row = rows[0];
  if (!row) throw new Error(`baseline query returned no row for ${filterCase.label}`);
  return { row, range };
}

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

async function optionValues(questionNo: LearningQuestionNo, key: string, limit = 1): Promise<string[]> {
  const sources: Record<string, { table: string; lateral: string }> = {
    '51.blankRole': { table: 'topik_writing_51_questions', lateral: 'unnest(array[q.blank_1_role, q.blank_2_role])' },
    '51.blankFunction': { table: 'topik_writing_51_questions', lateral: 'unnest(array[q.blank_1_function, q.blank_2_function])' },
    '51.answerType': { table: 'topik_writing_51_questions', lateral: 'unnest(array[q.blank_1_answer_type, q.blank_2_answer_type])' },
    '52.connectionFunction': { table: 'topik_writing_52_questions', lateral: 'unnest(array[q.connection_function])' },
    '52.answerScope': { table: 'topik_writing_52_questions', lateral: 'unnest(array[q.answer_scope_type])' },
    '53.dataType': { table: 'topik_writing_53_questions', lateral: 'unnest(array[q.data_type])' },
    '53.requiredStructure': { table: 'topik_writing_53_questions', lateral: "jsonb_array_elements_text(case when jsonb_typeof(q.required_structure) = 'array' then q.required_structure else '[]'::jsonb end)" },
    '54.essayType': { table: 'topik_writing_54_questions', lateral: 'unnest(array[q.essay_type])' },
    '54.stance': { table: 'topik_writing_54_questions', lateral: 'unnest(array[q.stance_requirement])' },
    '54.requiredStructure': { table: 'topik_writing_54_questions', lateral: "jsonb_array_elements_text(case when jsonb_typeof(q.required_structure) = 'array' then q.required_structure else '[]'::jsonb end)" }
  };
  const source = sources[`${questionNo}.${key}`];
  if (!source) throw new Error(`unsupported detail option: ${questionNo}.${key}`);
  const rows = await runSql<{ value: string }>(`select distinct option.value
    from public.${source.table} q
    cross join lateral ${source.lateral} option(value)
    where option.value is not null and option.value <> ''
      and exists (
        select 1 from private.admin_writing_question_identity_map pm
        join public.writing_submissions ws on ws.problem_id = pm.problem_id
        where pm.question_id = q.question_id
          and pm.item_number = ${questionNo}
          and pm.mapping_status = 'active'
          and pm.hold_reason is null
      )
    order by option.value
    limit ${limit};`);
  return rows.map((row) => row.value);
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
