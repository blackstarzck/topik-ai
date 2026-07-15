import { toSafeResult } from '../../../shared/api/safe-request';
import {
  isSupabaseConfigured,
  supabaseClient
} from '../../../shared/api/supabase-client';
import {
  addCalendarDays,
  resolveLearningAnalyticsDateRange,
  type LearningAnalyticsQuery,
  type LearningDetailFilterKey,
  type LearningQuestionNo
} from '../model/analytics-learning-query';

export type LearningAnalyticsSummary = {
  periodDays: number | null;
  activeLearners: number;
  activeLearnersPrev: number | null;
  submitters: number;
  submissions: number;
  submissionsPrev: number | null;
  feedbackComplete: number;
  completionRate: number | null;
  completionRatePrev: number | null;
  avgScoreNormalized: number | null;
  avgScoreNormalizedPrev: number | null;
  feedbackViewedCount: number;
  feedbackViewRate: number | null;
  feedbackViewRatePrev: number | null;
  avgElapsedSeconds: number | null;
  avgElapsedSecondsPrev: number | null;
  elapsedSamples: number;
  medianProcessingSeconds: number | null;
  medianProcessingSecondsPrev: number | null;
  processingSamples: number;
  resubmissions: number;
  pdfExports: number;
  pdfExportsPrev: number | null;
  activeEventsTotal: number;
  activeEventsAttributed: number;
  activeEventAttributionRate: number | null;
  dimensionCoverageSubmissions: number;
  metadataEligibleSubmissions: number | null;
  metadataMappedSubmissions: number | null;
  metadataUnmappedSubmissions: number | null;
  metadataCoverageRate: number | null;
  metadataEligibleSubmissionsPrev: number | null;
  metadataMappedSubmissionsPrev: number | null;
  metadataUnmappedSubmissionsPrev: number | null;
  metadataCoverageRatePrev: number | null;
  metadataEligibleEvents: number | null;
  metadataMappedEvents: number | null;
  metadataEventCoverageRate: number | null;
  metadataEligibleEventsPrev: number | null;
  metadataMappedEventsPrev: number | null;
  metadataEventCoverageRatePrev: number | null;
  metadataEligibleProblems: number | null;
  metadataMappedProblems: number | null;
};

export type LearningAnalyticsQuestionStat = {
  questionNo: LearningQuestionNo;
  activeLearners: number;
  submitters: number;
  submissions: number;
  completionRate: number | null;
  avgScoreNormalized: number | null;
  feedbackViewRate: number | null;
  avgElapsedSeconds: number | null;
  elapsedSamples: number;
  resubmissionRate: number | null;
  pdfExports: number;
};

export type LearningAnalyticsScoreBucket = {
  questionNo: LearningQuestionNo;
  bucket: number;
  label: string;
  count: number;
  percentage: number;
};

export type LearningAnalyticsTopicStat = {
  questionNo: LearningQuestionNo;
  topicMain: string;
  topicDetail: string;
  submissions: number;
  avgScoreNormalized: number | null;
  avgScoreNormalizedPrev: number | null;
};

export type LearningAnalyticsPdfUsage = {
  totalExports: number;
  attributableExports: number;
  mixedExports: number;
  unclassifiedExports: number;
  attributionRate: number | null;
  perQuestion: Array<{ questionNo: LearningQuestionNo; count: number }>;
};

export type LearningAnalyticsScope = {
  startDate: string | null;
  endDate: string | null;
  compareStartDate: string | null;
  compareEndDate: string | null;
  comparePrevious: boolean;
  questions: LearningQuestionNo[];
  topicMain: string | null;
  topicDetail: string | null;
  detailFilters: Record<string, string[]>;
};

export type LearningAnalytics = {
  summary: LearningAnalyticsSummary;
  perQuestion: LearningAnalyticsQuestionStat[];
  scoreDistribution: LearningAnalyticsScoreBucket[];
  topicStats: LearningAnalyticsTopicStat[];
  pdfUsage: LearningAnalyticsPdfUsage;
  scope: LearningAnalyticsScope;
};

export type LearningAnalyticsFilterOptions = {
  topics: Array<{ topicMain: string; topicDetails: string[] }>;
  detailFilters: Record<
    `${LearningQuestionNo}`,
    Partial<Record<LearningDetailFilterKey, string[]>>
  >;
};

// RPC 응답의 weak_dimensions·summary.dimensionCoverageSubmissions는 취약 평가 영역 섹션
// 제거(2026-07-15)로 화면에서 쓰지 않아 타입에서 뺐다. DB RPC는 계속 반환하며 여기서 무시된다.
type LearningAnalyticsRow = {
  summary: LearningAnalyticsSummary;
  per_question: LearningAnalyticsQuestionStat[];
  score_distribution: LearningAnalyticsScoreBucket[];
  topic_stats: LearningAnalyticsTopicStat[];
  pdf_usage: LearningAnalyticsPdfUsage;
  scope: LearningAnalyticsScope;
};

type LearningAnalyticsFilterOptionsRow = {
  options: LearningAnalyticsFilterOptions;
};

const emptyPdfUsage: LearningAnalyticsPdfUsage = {
  totalExports: 0,
  attributableExports: 0,
  mixedExports: 0,
  unclassifiedExports: 0,
  attributionRate: null,
  perQuestion: []
};

const metadataCoverageKeys = [
  'metadataEligibleSubmissions',
  'metadataMappedSubmissions',
  'metadataUnmappedSubmissions',
  'metadataCoverageRate',
  'metadataEligibleSubmissionsPrev',
  'metadataMappedSubmissionsPrev',
  'metadataUnmappedSubmissionsPrev',
  'metadataCoverageRatePrev',
  'metadataEligibleEvents',
  'metadataMappedEvents',
  'metadataEventCoverageRate',
  'metadataEligibleEventsPrev',
  'metadataMappedEventsPrev',
  'metadataEventCoverageRatePrev',
  'metadataEligibleProblems',
  'metadataMappedProblems'
] as const satisfies ReadonlyArray<keyof LearningAnalyticsSummary>;

function normalizeLearningAnalyticsSummary(
  summary: LearningAnalyticsSummary
): LearningAnalyticsSummary {
  const source = summary as unknown as Record<string, unknown>;
  const coverage = Object.fromEntries(
    metadataCoverageKeys.map((key) => {
      const value = source[key];
      return [key, typeof value === 'number' && Number.isFinite(value) ? value : null];
    })
  ) as Pick<LearningAnalyticsSummary, (typeof metadataCoverageKeys)[number]>;

  return { ...summary, ...coverage };
}

export function fetchLearningAnalyticsSafe(
  query: LearningAnalyticsQuery,
  signal?: AbortSignal
) {
  return toSafeResult<LearningAnalytics | null>(async () => {
    if (!isSupabaseConfigured || !supabaseClient) {
      return null;
    }
    const range = resolveLearningAnalyticsDateRange(query);
    const { data, error } = await supabaseClient.rpc(
      'get_admin_learning_analytics_filtered',
      {
        p_start_date: range.startDate,
        p_end_date: range.endDate,
        p_question_nos: query.questions,
        p_topic_main: query.topicMain,
        p_topic_detail: query.topicDetail,
        p_detail_filters: query.detailFilters,
        p_compare_previous: query.period !== 'all' && query.compare
      }
    );
    if (signal?.aborted) {
      throw new DOMException('Request aborted', 'AbortError');
    }
    if (error) {
      throw new Error(error.message);
    }
    const row = ((data ?? []) as LearningAnalyticsRow[])[0];
    if (!row) {
      throw new Error('학습 분석 응답이 비어 있습니다.');
    }
    return {
      summary: normalizeLearningAnalyticsSummary(row.summary),
      perQuestion: row.per_question ?? [],
      scoreDistribution: row.score_distribution ?? [],
      topicStats: row.topic_stats ?? [],
      pdfUsage: row.pdf_usage ?? emptyPdfUsage,
      scope: row.scope
    };
  });
}

export function fetchLearningAnalyticsFilterOptionsSafe(signal?: AbortSignal) {
  return toSafeResult<LearningAnalyticsFilterOptions | null>(async () => {
    if (!isSupabaseConfigured || !supabaseClient) {
      return null;
    }
    const { data, error } = await supabaseClient.rpc(
      'get_admin_learning_analytics_filter_options'
    );
    if (signal?.aborted) {
      throw new DOMException('Request aborted', 'AbortError');
    }
    if (error) {
      throw new Error(error.message);
    }
    const row = ((data ?? []) as LearningAnalyticsFilterOptionsRow[])[0];
    if (!row?.options) {
      throw new Error('학습 분석 필터 옵션 응답이 비어 있습니다.');
    }
    return row.options;
  });
}

export const mockLearningAnalyticsFilterOptions: LearningAnalyticsFilterOptions = {
  topics: [
    { topicMain: '교육', topicDetails: ['학교 교육', '평생 교육'] },
    { topicMain: '사회', topicDetails: ['문화', '환경', '기술 변화'] },
    { topicMain: '생활', topicDetails: ['건강', '주거', '소비'] }
  ],
  detailFilters: {
    '51': {
      blankRole: ['원인', '결과', '예시'],
      blankFunction: ['연결', '강조', '전환'],
      answerType: ['구', '절', '문장']
    },
    '52': {
      connectionFunction: ['대조', '인과', '나열'],
      answerScope: ['단일 답안', '복수 허용']
    },
    '53': {
      dataType: ['그래프', '표', '도표'],
      requiredStructure: ['도입', '자료 요약', '변화 설명']
    },
    '54': {
      essayType: ['찬반', '원인·해결', '비교'],
      stance: ['입장 필수', '균형 서술'],
      requiredStructure: ['서론', '본론', '결론']
    }
  }
};

const questionBase: Record<
  LearningQuestionNo,
  Omit<LearningAnalyticsQuestionStat, 'questionNo'>
> = {
  51: {
    activeLearners: 156,
    submitters: 142,
    submissions: 512,
    completionRate: 89.3,
    avgScoreNormalized: 73.2,
    feedbackViewRate: 68.3,
    avgElapsedSeconds: 1206,
    elapsedSamples: 445,
    resubmissionRate: 14.6,
    pdfExports: 51
  },
  52: {
    activeLearners: 146,
    submitters: 131,
    submissions: 468,
    completionRate: 88.7,
    avgScoreNormalized: 71.4,
    feedbackViewRate: 66.1,
    avgElapsedSeconds: 1288,
    elapsedSamples: 401,
    resubmissionRate: 15.1,
    pdfExports: 43
  },
  53: {
    activeLearners: 138,
    submitters: 124,
    submissions: 402,
    completionRate: 86.1,
    avgScoreNormalized: 69.8,
    feedbackViewRate: 61.8,
    avgElapsedSeconds: 1394,
    elapsedSamples: 331,
    resubmissionRate: 15.9,
    pdfExports: 34
  },
  54: {
    activeLearners: 121,
    submitters: 109,
    submissions: 318,
    completionRate: 84.6,
    avgScoreNormalized: 67.1,
    feedbackViewRate: 59.4,
    avgElapsedSeconds: 1882,
    elapsedSamples: 248,
    resubmissionRate: 17.3,
    pdfExports: 28
  }
};

const distributionPercentages: Record<LearningQuestionNo, number[]> = {
  51: [12, 36, 33, 19],
  52: [14, 38, 31, 17],
  53: [18, 40, 30, 12],
  54: [21, 39, 28, 12]
};

function getMockScale(query: LearningAnalyticsQuery, now: Date): number {
  if (query.period === 'all') {
    return 5.2;
  }
  if (query.period === '7d') {
    return 0.35;
  }
  if (query.period === '90d') {
    return 2.4;
  }
  if (query.period === 'custom') {
    const range = resolveLearningAnalyticsDateRange(query, now);
    if (range.startDate && range.endDate) {
      const days =
        Math.round(
          (new Date(`${range.endDate}T00:00:00Z`).getTime() -
            new Date(`${range.startDate}T00:00:00Z`).getTime()) /
            86_400_000
        ) + 1;
      return Math.max(0.12, days / 30);
    }
  }
  return 1;
}

function round(value: number, digits = 0): number {
  const multiplier = 10 ** digits;
  return Math.round(value * multiplier) / multiplier;
}

function weightedAverage(
  rows: LearningAnalyticsQuestionStat[],
  key: 'completionRate' | 'avgScoreNormalized' | 'feedbackViewRate' | 'avgElapsedSeconds'
): number | null {
  const valid = rows.filter((row) => row[key] != null && row.submissions > 0);
  const total = valid.reduce((sum, row) => sum + row.submissions, 0);
  if (total === 0) {
    return null;
  }
  return round(
    valid.reduce((sum, row) => sum + (row[key] ?? 0) * row.submissions, 0) / total,
    1
  );
}

export function createMockLearningAnalytics(
  query: LearningAnalyticsQuery,
  now = new Date()
): LearningAnalytics {
  const range = resolveLearningAnalyticsDateRange(query, now);
  const topicScale = query.topicMain ? 0.42 : 1;
  const detailScale = Object.keys(query.detailFilters).length > 0 ? 0.66 : 1;
  const scale = getMockScale(query, now) * topicScale * detailScale;
  const perQuestion = query.questions.map((questionNo) => {
    const base = questionBase[questionNo];
    return {
      questionNo,
      ...base,
      activeLearners: Math.max(1, round(base.activeLearners * scale)),
      submitters: Math.max(1, round(base.submitters * scale)),
      submissions: Math.max(1, round(base.submissions * scale)),
      elapsedSamples: Math.max(0, round(base.elapsedSamples * scale)),
      pdfExports: Math.max(0, round(base.pdfExports * scale)),
      avgScoreNormalized: round(
        (base.avgScoreNormalized ?? 0) - (query.topicDetail ? 2.8 : 0),
        1
      )
    };
  });

  const submissions = perQuestion.reduce((sum, row) => sum + row.submissions, 0);
  const feedbackComplete = round(
    perQuestion.reduce(
      (sum, row) => sum + row.submissions * ((row.completionRate ?? 0) / 100),
      0
    )
  );
  const feedbackViewedCount = round(
    perQuestion.reduce(
      (sum, row) => sum + row.submissions * ((row.feedbackViewRate ?? 0) / 100),
      0
    )
  );
  const elapsedSamples = perQuestion.reduce((sum, row) => sum + row.elapsedSamples, 0);
  const pdfExports = perQuestion.reduce((sum, row) => sum + row.pdfExports, 0);
  const compareEnabled = query.period !== 'all' && query.compare;
  const completionRate = weightedAverage(perQuestion, 'completionRate');
  const avgScoreNormalized = weightedAverage(perQuestion, 'avgScoreNormalized');
  const feedbackViewRate = weightedAverage(perQuestion, 'feedbackViewRate');
  const avgElapsedSeconds = weightedAverage(perQuestion, 'avgElapsedSeconds');
  const activeLearners = round(
    perQuestion.reduce((sum, row) => sum + row.activeLearners, 0) * 0.72
  );
  const activeEventsAttributed = round(submissions * 1.18);
  const activeEventsTotal = activeEventsAttributed + Math.max(2, round(scale * 17));
  const submissionsPrev = compareEnabled ? round(submissions / 1.08) : null;
  const metadataEligibleEventsPrev = compareEnabled
    ? round(activeEventsAttributed / 1.08)
    : null;
  const usePartialCoverageFixture =
    import.meta.env.VITE_ANALYTICS_METADATA_COVERAGE_FIXTURE === 'partial';
  const metadataUnmappedSubmissions = usePartialCoverageFixture
    ? Math.max(1, round(submissions * 0.04))
    : 0;
  const metadataMappedSubmissions = Math.max(
    0,
    submissions - metadataUnmappedSubmissions
  );
  const metadataUnmappedSubmissionsPrev =
    usePartialCoverageFixture && submissionsPrev != null
      ? Math.max(1, round(submissionsPrev * 0.04))
      : 0;
  const metadataMappedSubmissionsPrev =
    submissionsPrev == null
      ? null
      : Math.max(0, submissionsPrev - metadataUnmappedSubmissionsPrev);
  const metadataUnmappedEvents = usePartialCoverageFixture
    ? Math.max(1, round(activeEventsAttributed * 0.03))
    : 0;
  const metadataMappedEvents = Math.max(
    0,
    activeEventsAttributed - metadataUnmappedEvents
  );
  const metadataUnmappedEventsPrev =
    usePartialCoverageFixture && metadataEligibleEventsPrev != null
      ? Math.max(1, round(metadataEligibleEventsPrev * 0.03))
      : 0;
  const metadataMappedEventsPrev =
    metadataEligibleEventsPrev == null
      ? null
      : Math.max(0, metadataEligibleEventsPrev - metadataUnmappedEventsPrev);
  const processingSamples = feedbackComplete;
  const totalPdfExports = pdfExports + Math.max(1, round(scale * 15));

  const scoreDistribution = perQuestion.flatMap((row) =>
    distributionPercentages[row.questionNo].map((percentage, index) => ({
      questionNo: row.questionNo,
      bucket: index + 1,
      label: ['0-40', '41-60', '61-80', '81-100'][index],
      count: round(row.submissions * (percentage / 100)),
      percentage
    }))
  );
  const topics = [
    ['교육', '학교 교육', 216, 76.8, 73.7],
    ['교육', '평생 교육', 142, 71.2, 69.8],
    ['사회', '문화', 128, 70.1, 70.9],
    ['사회', '환경', 112, 68.4, 66.2],
    ['생활', '건강', 96, 72.7, 71.1]
  ] as const;
  const topicStats = topics
    .filter(([topicMain, topicDetail]) =>
      (!query.topicMain || topicMain === query.topicMain) &&
      (!query.topicDetail || topicDetail === query.topicDetail)
    )
    .flatMap(([topicMain, topicDetail, count, score, previous]) =>
      query.questions.map((questionNo, questionIndex) => ({
        questionNo,
        topicMain,
        topicDetail,
        submissions: Math.max(1, round((count * scale) / query.questions.length)),
        avgScoreNormalized: round(
          score - (query.questions.length === 1 ? 1.2 : 0) - questionIndex * 1.1,
          1
        ),
        avgScoreNormalizedPrev: compareEnabled ? round(previous - questionIndex * 1.1, 1) : null
      }))
    );

  const periodDays =
    range.startDate && range.endDate
      ? Math.round(
          (new Date(`${range.endDate}T00:00:00Z`).getTime() -
            new Date(`${range.startDate}T00:00:00Z`).getTime()) /
            86_400_000
        ) + 1
      : null;
  const compareEndDate =
    compareEnabled && range.startDate ? addCalendarDays(range.startDate, -1) : null;
  const compareStartDate =
    compareEndDate && periodDays ? addCalendarDays(compareEndDate, -(periodDays - 1)) : null;

  return {
    summary: {
      periodDays,
      activeLearners,
      activeLearnersPrev: compareEnabled ? round(activeLearners / 1.079) : null,
      submitters: perQuestion.reduce((sum, row) => sum + row.submitters, 0),
      submissions,
      submissionsPrev,
      feedbackComplete,
      completionRate,
      completionRatePrev: compareEnabled && completionRate != null ? round(completionRate - 2.7, 1) : null,
      avgScoreNormalized,
      avgScoreNormalizedPrev:
        compareEnabled && avgScoreNormalized != null ? round(avgScoreNormalized - 2.4, 1) : null,
      feedbackViewedCount,
      feedbackViewRate,
      feedbackViewRatePrev:
        compareEnabled && feedbackViewRate != null ? round(feedbackViewRate - 3.4, 1) : null,
      avgElapsedSeconds,
      avgElapsedSecondsPrev:
        compareEnabled && avgElapsedSeconds != null ? round(avgElapsedSeconds + 66) : null,
      elapsedSamples,
      medianProcessingSeconds: 44,
      medianProcessingSecondsPrev: compareEnabled ? 48 : null,
      processingSamples,
      resubmissions: round(submissions * 0.154),
      pdfExports,
      pdfExportsPrev: compareEnabled ? round(pdfExports / 1.136) : null,
      activeEventsTotal,
      activeEventsAttributed,
      activeEventAttributionRate: round((activeEventsAttributed / activeEventsTotal) * 100, 1),
      dimensionCoverageSubmissions: round(feedbackComplete * 0.82),
      metadataEligibleSubmissions: submissions,
      metadataMappedSubmissions,
      metadataUnmappedSubmissions,
      metadataCoverageRate:
        submissions > 0 ? round((metadataMappedSubmissions / submissions) * 100, 1) : null,
      metadataEligibleSubmissionsPrev: submissionsPrev,
      metadataMappedSubmissionsPrev,
      metadataUnmappedSubmissionsPrev: submissionsPrev == null
        ? null
        : metadataUnmappedSubmissionsPrev,
      metadataCoverageRatePrev:
        submissionsPrev != null && submissionsPrev > 0 && metadataMappedSubmissionsPrev != null
          ? round((metadataMappedSubmissionsPrev / submissionsPrev) * 100, 1)
          : null,
      metadataEligibleEvents: activeEventsAttributed,
      metadataMappedEvents,
      metadataEventCoverageRate:
        activeEventsAttributed > 0
          ? round((metadataMappedEvents / activeEventsAttributed) * 100, 1)
          : null,
      metadataEligibleEventsPrev,
      metadataMappedEventsPrev,
      metadataEventCoverageRatePrev:
        metadataEligibleEventsPrev != null &&
        metadataEligibleEventsPrev > 0 &&
        metadataMappedEventsPrev != null
          ? round((metadataMappedEventsPrev / metadataEligibleEventsPrev) * 100, 1)
          : null,
      metadataEligibleProblems: query.questions.length,
      metadataMappedProblems: usePartialCoverageFixture
        ? Math.max(0, query.questions.length - 1)
        : query.questions.length
    },
    perQuestion,
    scoreDistribution,
    topicStats,
    pdfUsage: {
      totalExports: totalPdfExports,
      attributableExports: pdfExports,
      mixedExports: Math.max(0, round(scale * 6)),
      unclassifiedExports: Math.max(0, totalPdfExports - pdfExports - round(scale * 6)),
      attributionRate: round((pdfExports / totalPdfExports) * 100, 1),
      perQuestion: perQuestion.map((row) => ({
        questionNo: row.questionNo,
        count: row.pdfExports
      }))
    },
    scope: {
      startDate: range.startDate,
      endDate: range.endDate,
      compareStartDate,
      compareEndDate,
      comparePrevious: compareEnabled,
      questions: query.questions,
      topicMain: query.topicMain,
      topicDetail: query.topicDetail,
      detailFilters: query.detailFilters as Record<string, string[]>
    }
  };
}
