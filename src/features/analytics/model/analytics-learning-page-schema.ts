import type { LearningAnalytics } from '../api/analytics-learning-service';
import {
  learningPeriodLabels,
  learningQuestionLabels,
  type LearningAnalyticsPeriod,
  type LearningAnalyticsQuery,
  type LearningDetailFilterKey,
  type LearningQuestionNo
} from './analytics-learning-query';

// 학습 분석 화면의 순수 스키마 — Phase 4 분해로 페이지 본문에서 이동(동작 동일).
// KPI 정의 카피는 e2e 가 문구를 검증하므로 수정 시 스펙과 함께 갱신한다.

export type KpiKey =
  | 'activeLearners'
  | 'submissions'
  | 'completionRate'
  | 'avgScore'
  | 'feedbackViewRate'
  | 'elapsedTime'
  | 'processingTime'
  | 'pdfExports';

export type MetricDefinition = {
  key: KpiKey;
  category: string;
  label: string;
  definition: string;
  formula: string;
  inclusion: string;
  caution: string;
};

// KPI 설명은 비개발 운영자 기준(오너, 2026-07-15): DB·SQL 용어와 '귀속/커버리지' 같은
// 전문어를 쓰지 않는다. e2e가 평균 환산 점수 계산 방법 문구를 검증하므로 수정 시 스펙도 함께 갱신.
export const metricDefinitions: MetricDefinition[] = [
  {
    key: 'activeLearners',
    category: '규모',
    label: '해당 조건 학습자',
    definition: '선택한 기간·문제 유형·주제에서 학습 활동을 한 번이라도 남긴 사람 수입니다. 같은 사람이 여러 번 활동해도 1명으로 셉니다.',
    formula: '조건에 연결되는 학습 활동이 있는 사람을 중복 없이 셉니다.',
    inclusion: '어떤 문제에 대한 활동인지 확인할 수 있는 기록만 셉니다.',
    caution: '어떤 문제에 대한 활동인지 알 수 없는 기록은 추측으로 나눠 넣지 않고 집계에서 뺍니다.'
  },
  {
    key: 'submissions',
    category: '규모',
    label: '제출 수',
    definition: '선택한 조건에서 학습자가 TOPIK 쓰기 답안을 제출한 횟수입니다.',
    formula: '조건에 맞는 답안 제출 건수를 모두 더합니다.',
    inclusion: '51~54번 문제 중 선택한 기간·유형·주제 조건에 맞는 제출만 셉니다.',
    caution: '같은 사람이 같은 문제를 다시 제출해도 각각 1건으로 셉니다.'
  },
  {
    key: 'completionRate',
    category: '성과',
    label: '피드백 완료율',
    definition: '제출된 답안 중 AI 피드백까지 완성된 비율입니다.',
    formula: '피드백이 완성된 제출 ÷ 전체 제출 × 100',
    inclusion: '아직 처리 중이거나 실패한 제출도 전체 제출(나누는 수)에 포함해 계산합니다.',
    caution: '지난 기간과의 변화는 %p(퍼센트포인트) 차이로 표시합니다. 예: 80%에서 85%가 되면 +5.0%p입니다.'
  },
  {
    key: 'avgScore',
    category: '성과',
    label: '평균 환산 점수',
    definition: '문제마다 만점이 달라서, 각 점수를 100점 만점 기준으로 바꾼 뒤 평균낸 값입니다.',
    formula: '(받은 점수 ÷ 그 문제의 만점) × 100을 제출마다 구한 뒤 평균냅니다.',
    inclusion: '점수와 만점이 모두 정상적으로 기록된 피드백 완료 제출만 사용합니다.',
    caution: '51~54번은 만점이 서로 달라 원점수를 그대로 평균내면 왜곡되므로, 100점으로 바꾼 뒤 평균냅니다.'
  },
  {
    key: 'feedbackViewRate',
    category: '행동',
    label: '피드백 조회율',
    definition: '완성된 피드백 중 학습자가 실제로 한 번 이상 열어 본 비율입니다.',
    formula: '열어 본 피드백 ÷ 완성된 피드백 전체 × 100',
    inclusion: '어느 제출의 피드백을 봤는지 확인되는 조회 기록만 셉니다.',
    caution: '같은 피드백을 여러 번 열어 봐도 1건으로 셉니다.'
  },
  {
    key: 'elapsedTime',
    category: '행동',
    label: '평균 풀이 시간',
    definition: '학습자가 문제를 푸는 데 걸린 시간의 평균입니다.',
    formula: '풀이 시간이 기록된 제출들의 시간을 모두 더해 평균냅니다.',
    inclusion: '풀이 시간이 정상적으로 기록된 제출만 사용합니다.',
    caution: '기록된 제출이 하나도 없으면 0초가 아니라 미수집으로 표시합니다.'
  },
  {
    key: 'processingTime',
    category: '운영',
    label: '처리 시간 중앙값',
    definition: '답안 제출 후 AI 피드백이 완성될 때까지 걸린 시간의 중앙값입니다. 전체 건의 절반은 이보다 빠르고, 절반은 느립니다.',
    formula: '제출부터 피드백 완성까지 걸린 시간을 짧은 순서로 늘어놓았을 때 한가운데 값을 씁니다.',
    inclusion: '피드백이 언제 완성됐는지 기록된 완료 제출만 사용합니다.',
    caution: '재처리 등으로 유난히 오래 걸린 소수 건이 값을 끌어올리지 않도록 평균 대신 중앙값을 씁니다.'
  },
  {
    key: 'pdfExports',
    category: '운영',
    label: 'PDF 내보내기 완료 수',
    definition: '선택한 기간에 피드백 PDF 내보내기가 완료된 횟수입니다.',
    formula: 'PDF 내보내기 완료 기록을 모두 더합니다.',
    inclusion: '문제 유형·주제 필터를 쓰면, 어떤 문제의 PDF인지 확인되는 건만 이 지표에 넣습니다.',
    caution: '앱에서 내보내기가 완료된 횟수라서, 파일이 기기에 실제로 저장됐는지까지 보장하지는 않습니다.'
  }
];

export const detailFilterLabels: Record<LearningDetailFilterKey, string> = {
  blankRole: '빈칸 역할',
  blankFunction: '빈칸 기능',
  answerType: '정답 표현 종류',
  connectionFunction: '연결 기능',
  answerScope: '허용 답안 범위',
  dataType: '자료 유형',
  requiredStructure: '요구 글 구성',
  essayType: '논술 유형',
  stance: '요구 관점'
};

export const periodOptions: Array<{ label: string; value: LearningAnalyticsPeriod }> = [
  { label: '최근 7일', value: '7d' },
  { label: '30일', value: '30d' },
  { label: '90일', value: '90d' },
  { label: '전체', value: 'all' },
  { label: '직접 선택', value: 'custom' }
];

export const scoreColors = ['#2563eb', '#0ea5e9', '#8b5cf6', '#5b21b6'];
export const pdfQuestionColors: Record<LearningQuestionNo, string> = {
  51: scoreColors[0],
  52: scoreColors[1],
  53: scoreColors[2],
  54: scoreColors[3]
};

export function formatNumber(value: number | null | undefined, digits = 0): string {
  if (value == null) {
    return '—';
  }
  return value.toLocaleString('ko-KR', {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits
  });
}

export function formatDuration(value: number | null): string {
  if (value == null) {
    return '미수집';
  }
  if (value >= 3600) {
    return `${Math.floor(value / 3600)}시간 ${Math.floor((value % 3600) / 60)}분`;
  }
  if (value >= 60) {
    return `${Math.floor(value / 60)}분 ${String(Math.round(value % 60)).padStart(2, '0')}초`;
  }
  return `${Math.round(value)}초`;
}

export function relativeChange(current: number, previous: number | null): number | null {
  if (previous == null || previous === 0) {
    return null;
  }
  return Math.round(((current - previous) / previous) * 1000) / 10;
}

export function formatRefreshTime(value: Date | null): string {
  if (!value) {
    return '갱신 대기';
  }
  return value
    .toLocaleString('ko-KR', {
      timeZone: 'Asia/Seoul',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false
    })
    .replace(/\. /g, '-')
    .replace('.', '');
}

export type PdfUsageSlice = {
  label: string;
  count: number;
  color: string;
};

export type PdfUsageHierarchyRow = {
  key: string;
  kind: 'question' | 'topic' | 'mixed' | 'unclassified';
  label: string;
  count: number;
  color: string;
  questionNo: LearningQuestionNo | null;
  topicMain: string | null;
  topicDetail: string | null;
  children?: PdfUsageHierarchyRow[];
};

export function getAppliedConditionTags(query: LearningAnalyticsQuery): string[] {
  const tags = [
    query.period === 'custom' && query.from && query.to
      ? `${query.from}~${query.to}`
      : learningPeriodLabels[query.period]
  ];
  if (query.questions.length === 4) {
    tags.push('51~54번 전체');
  } else {
    tags.push(...query.questions.map((question) => `${question}번`));
  }
  if (query.compare && query.period !== 'all') {
    tags.push('이전 동일 기간');
  }
  if (query.topicMain) {
    tags.push(query.topicMain);
  }
  if (query.topicDetail) {
    tags.push(query.topicDetail);
  }
  for (const [key, values] of Object.entries(query.detailFilters)) {
    for (const value of values ?? []) {
      tags.push(`${detailFilterLabels[key as LearningDetailFilterKey]}: ${value}`);
    }
  }
  return tags;
}

export function getQuestionShortLabel(questionNo: LearningQuestionNo): string {
  return learningQuestionLabels[questionNo];
}

// 아래 두 함수는 페이지 useMemo 본문을 그대로 옮긴 순수 변환이다(null 가드 포함).
export function buildLearningPdfHierarchyRows(
  data: LearningAnalytics | null
): PdfUsageHierarchyRow[] {
  if (!data) {
    return [];
  }

  const questionRows = data.pdfUsage.perQuestion.map((question) => {
    const color = pdfQuestionColors[question.questionNo];
    const children = data.pdfUsage.perTopic
      .filter((topic) => topic.questionNo === question.questionNo)
      .map<PdfUsageHierarchyRow>((topic) => ({
        key: `pdf-topic-${topic.questionNo}-${topic.topicMain ?? 'unmapped'}-${topic.topicDetail ?? 'unmapped'}`,
        kind: 'topic',
        label: '',
        count: topic.count,
        color,
        questionNo: topic.questionNo,
        topicMain: topic.topicMain,
        topicDetail: topic.topicDetail
      }));

    return {
      key: `pdf-question-${question.questionNo}`,
      kind: 'question' as const,
      label: `${question.questionNo}번`,
      count: question.count,
      color,
      questionNo: question.questionNo,
      topicMain: null,
      topicDetail: null,
      children: children.length > 0 ? children : undefined
    };
  });

  return [
    ...questionRows,
    {
      key: 'pdf-mixed',
      kind: 'mixed',
      label: '혼합',
      count: data.pdfUsage.mixedExports,
      color: '#d97706',
      questionNo: null,
      topicMain: null,
      topicDetail: null
    },
    {
      key: 'pdf-unclassified',
      kind: 'unclassified',
      label: '미분류',
      count: data.pdfUsage.unclassifiedExports,
      color: '#dc2626',
      questionNo: null,
      topicMain: null,
      topicDetail: null
    }
  ];
}

export function buildLearningPdfSlices(
  data: LearningAnalytics | null
): PdfUsageSlice[] {
  return data
    ? [
      ...data.pdfUsage.perQuestion.map((row) => ({
        label: `${row.questionNo}번`,
        count: row.count,
        color: pdfQuestionColors[row.questionNo]
      })),
      { label: '혼합', count: data.pdfUsage.mixedExports, color: '#d97706' },
      { label: '미분류', count: data.pdfUsage.unclassifiedExports, color: '#dc2626' }
    ]
    : [];
}
