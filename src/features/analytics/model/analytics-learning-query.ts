export type LearningAnalyticsPeriod = '7d' | '30d' | '90d' | 'all' | 'custom';

export type LearningQuestionNo = 51 | 52 | 53 | 54;

export type LearningDetailFilterKey =
  | 'blankRole'
  | 'blankFunction'
  | 'answerType'
  | 'connectionFunction'
  | 'answerScope'
  | 'dataType'
  | 'requiredStructure'
  | 'essayType'
  | 'stance';

export type LearningDetailFilters = Partial<
  Record<LearningDetailFilterKey, string[]>
>;

export type LearningAnalyticsQuery = {
  period: LearningAnalyticsPeriod;
  from: string | null;
  to: string | null;
  compare: boolean;
  questions: LearningQuestionNo[];
  topicMain: string | null;
  topicDetail: string | null;
  detailFilters: LearningDetailFilters;
};

export type LearningAnalyticsDateRange = {
  startDate: string | null;
  endDate: string | null;
};

export const learningQuestionLabels: Record<LearningQuestionNo, string> = {
  51: '51번 빈칸 완성',
  52: '52번 문장 완성',
  53: '53번 자료 해석',
  54: '54번 논술'
};

export const learningPeriodLabels: Record<LearningAnalyticsPeriod, string> = {
  '7d': '최근 7일',
  '30d': '최근 30일',
  '90d': '최근 90일',
  all: '전체',
  custom: '직접 선택'
};

export const learningDetailKeysByQuestion: Record<
  LearningQuestionNo,
  LearningDetailFilterKey[]
> = {
  51: ['blankRole', 'blankFunction', 'answerType'],
  52: ['connectionFunction', 'answerScope'],
  53: ['dataType', 'requiredStructure'],
  54: ['essayType', 'stance', 'requiredStructure']
};

export const defaultLearningAnalyticsQuery: LearningAnalyticsQuery = {
  period: '30d',
  from: null,
  to: null,
  compare: true,
  questions: [51, 52, 53, 54],
  topicMain: null,
  topicDetail: null,
  detailFilters: {}
};

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

function isDateString(value: string | null): value is string {
  if (!value || !DATE_PATTERN.test(value)) {
    return false;
  }
  const parsed = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

export function addCalendarDays(date: string, days: number): string {
  const parsed = new Date(`${date}T00:00:00Z`);
  parsed.setUTCDate(parsed.getUTCDate() + days);
  return parsed.toISOString().slice(0, 10);
}

export function getKstDateString(now = new Date()): string {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Seoul',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).formatToParts(now);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
}

export function resolveLearningAnalyticsDateRange(
  query: LearningAnalyticsQuery,
  now = new Date()
): LearningAnalyticsDateRange {
  if (query.period === 'all') {
    return { startDate: null, endDate: null };
  }
  if (query.period === 'custom' && query.from && query.to) {
    return { startDate: query.from, endDate: query.to };
  }
  const endDate = getKstDateString(now);
  const days = query.period === '7d' ? 7 : query.period === '90d' ? 90 : 30;
  return { startDate: addCalendarDays(endDate, -(days - 1)), endDate };
}

function parseQuestions(searchParams: URLSearchParams): LearningQuestionNo[] {
  const values = searchParams
    .getAll('question')
    .map(Number)
    .filter((value): value is LearningQuestionNo =>
      value === 51 || value === 52 || value === 53 || value === 54
    );
  return values.length > 0 ? [...new Set(values)].sort() : [51, 52, 53, 54];
}

function parsePeriod(value: string | null): LearningAnalyticsPeriod {
  if (value === '7d' || value === '90d' || value === 'all' || value === 'custom') {
    return value;
  }
  return '30d';
}

export function parseLearningAnalyticsQuery(
  searchParams: URLSearchParams
): LearningAnalyticsQuery {
  let period = parsePeriod(searchParams.get('period'));
  const from = isDateString(searchParams.get('from')) ? searchParams.get('from') : null;
  const to = isDateString(searchParams.get('to')) ? searchParams.get('to') : null;
  if (period === 'custom' && (!from || !to || from > to)) {
    period = '30d';
  }

  const questions = parseQuestions(searchParams);
  const topicMain = searchParams.get('topicMain')?.trim() || null;
  const topicDetail = topicMain
    ? searchParams.get('topicDetail')?.trim() || null
    : null;
  const detailFilters: LearningDetailFilters = {};
  if (questions.length === 1) {
    for (const key of learningDetailKeysByQuestion[questions[0]]) {
      const values = searchParams
        .getAll(`d.${key}`)
        .map((value) => value.trim())
        .filter(Boolean);
      if (values.length > 0) {
        detailFilters[key] = [...new Set(values)];
      }
    }
  }

  return {
    period,
    from: period === 'custom' ? from : null,
    to: period === 'custom' ? to : null,
    compare: period !== 'all' && searchParams.get('compare') !== '0',
    questions,
    topicMain,
    topicDetail,
    detailFilters
  };
}

export function serializeLearningAnalyticsQuery(
  query: LearningAnalyticsQuery
): URLSearchParams {
  const params = new URLSearchParams();
  params.set('period', query.period);
  params.set('compare', query.period === 'all' || !query.compare ? '0' : '1');
  if (query.period === 'custom' && query.from && query.to) {
    params.set('from', query.from);
    params.set('to', query.to);
  }
  for (const question of [...query.questions].sort()) {
    params.append('question', String(question));
  }
  if (query.topicMain) {
    params.set('topicMain', query.topicMain);
    if (query.topicDetail) {
      params.set('topicDetail', query.topicDetail);
    }
  }
  if (query.questions.length === 1) {
    for (const key of learningDetailKeysByQuestion[query.questions[0]]) {
      for (const value of query.detailFilters[key] ?? []) {
        params.append(`d.${key}`, value);
      }
    }
  }
  return params;
}

export function countLearningAnalyticsConditions(query: LearningAnalyticsQuery): number {
  const questionCount = query.questions.length === 4 ? 0 : query.questions.length;
  const detailCount = Object.values(query.detailFilters).reduce(
    (total, values) => total + (values?.length ?? 0),
    0
  );
  return (
    1 +
    (query.compare && query.period !== 'all' ? 1 : 0) +
    questionCount +
    (query.topicMain ? 1 : 0) +
    (query.topicDetail ? 1 : 0) +
    detailCount
  );
}

export function areLearningAnalyticsQueriesEqual(
  left: LearningAnalyticsQuery,
  right: LearningAnalyticsQuery
): boolean {
  return serializeLearningAnalyticsQuery(left).toString() ===
    serializeLearningAnalyticsQuery(right).toString();
}
