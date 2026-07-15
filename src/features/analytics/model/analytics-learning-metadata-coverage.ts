import type { LearningAnalyticsSummary } from '../api/analytics-learning-service';

export type MetadataCoverageWarning = {
  testId: string;
  message: string;
  description: string;
};

type CoveragePair = {
  testId: string;
  label: string;
  eligible: number | null;
  mapped: number | null;
  required: boolean;
};

function isValidCount(value: number | null): value is number {
  return value != null && Number.isInteger(value) && value >= 0;
}

function isValidPair(pair: CoveragePair): boolean {
  if (!pair.required && pair.eligible == null && pair.mapped == null) {
    return true;
  }
  return isValidCount(pair.eligible)
    && isValidCount(pair.mapped)
    && pair.mapped <= pair.eligible;
}

export function getLearningAnalyticsMetadataCoverageState(
  summary: LearningAnalyticsSummary | undefined,
  comparePrevious: boolean
): { unavailable: boolean; warnings: MetadataCoverageWarning[] } {
  if (!summary) return { unavailable: false, warnings: [] };

  const pairs: CoveragePair[] = [
    {
      testId: 'metadata-coverage-warning-current-submissions',
      label: '현재 기간 제출',
      eligible: summary.metadataEligibleSubmissions,
      mapped: summary.metadataMappedSubmissions,
      required: true
    },
    {
      testId: 'metadata-coverage-warning-previous-submissions',
      label: '직전 기간 제출',
      eligible: summary.metadataEligibleSubmissionsPrev,
      mapped: summary.metadataMappedSubmissionsPrev,
      required: comparePrevious
    },
    {
      testId: 'metadata-coverage-warning-current-events',
      label: '현재 기간 학습 이벤트',
      eligible: summary.metadataEligibleEvents,
      mapped: summary.metadataMappedEvents,
      required: true
    },
    {
      testId: 'metadata-coverage-warning-previous-events',
      label: '직전 기간 학습 이벤트',
      eligible: summary.metadataEligibleEventsPrev,
      mapped: summary.metadataMappedEventsPrev,
      required: comparePrevious
    },
    {
      testId: 'metadata-coverage-warning-problems',
      label: '참조 문제',
      eligible: summary.metadataEligibleProblems,
      mapped: summary.metadataMappedProblems,
      required: true
    }
  ];
  const unavailable = pairs.some((pair) => !isValidPair(pair));
  const warnings = pairs
    .filter((pair) => pair.testId !== 'metadata-coverage-warning-problems')
    .filter((pair) => isValidPair(pair))
    .filter((pair) => pair.required && (pair.eligible ?? 0) > 0 && pair.mapped! < pair.eligible!)
    .map((pair) => ({
      testId: pair.testId,
      message: `${pair.label} 메타데이터 연결이 완전하지 않습니다.`,
      description: `연결 ${pair.mapped!.toLocaleString('ko-KR')}건 / 대상 ${pair.eligible!.toLocaleString('ko-KR')}건입니다. 주제·세부 조건 결과에서 연결되지 않은 학습 데이터는 제외될 수 있습니다.`
    }));

  return { unavailable, warnings };
}
