import { describe, expect, it } from 'vitest';

import type { LearningAnalyticsSummary } from '../../src/features/analytics/api/analytics-learning-service';
import { getLearningAnalyticsMetadataCoverageState } from '../../src/features/analytics/model/analytics-learning-metadata-coverage';

function summary(overrides: Partial<LearningAnalyticsSummary> = {}): LearningAnalyticsSummary {
  return {
    metadataEligibleSubmissions: 10,
    metadataMappedSubmissions: 10,
    metadataEligibleSubmissionsPrev: 8,
    metadataMappedSubmissionsPrev: 8,
    metadataEligibleEvents: 20,
    metadataMappedEvents: 20,
    metadataEligibleEventsPrev: 16,
    metadataMappedEventsPrev: 16,
    metadataEligibleProblems: 4,
    metadataMappedProblems: 4,
    ...overrides
  } as LearningAnalyticsSummary;
}

describe('학습 분석 메타데이터 coverage UI 상태', () => {
  it('완전 연결과 빈 eligible 집합은 경고를 만들지 않는다', () => {
    expect(getLearningAnalyticsMetadataCoverageState(summary(), true)).toEqual({
      unavailable: false,
      warnings: []
    });
    expect(getLearningAnalyticsMetadataCoverageState(summary({
      metadataEligibleSubmissions: 0,
      metadataMappedSubmissions: 0,
      metadataEligibleEvents: 0,
      metadataMappedEvents: 0
    }), true)).toEqual({ unavailable: false, warnings: [] });
  });

  it('비교를 끄면 직전 기간 필드가 없어도 계약 오류로 보지 않는다', () => {
    expect(getLearningAnalyticsMetadataCoverageState(summary({
      metadataEligibleSubmissionsPrev: null,
      metadataMappedSubmissionsPrev: null,
      metadataEligibleEventsPrev: null,
      metadataMappedEventsPrev: null
    }), false)).toEqual({ unavailable: false, warnings: [] });
  });

  it('현재·직전 제출과 이벤트의 부분 연결을 각각 구분한다', () => {
    const result = getLearningAnalyticsMetadataCoverageState(summary({
      metadataMappedSubmissions: 9,
      metadataMappedSubmissionsPrev: 7,
      metadataMappedEvents: 19,
      metadataMappedEventsPrev: 15
    }), true);

    expect(result.unavailable).toBe(false);
    expect(result.warnings.map((warning) => warning.testId)).toEqual([
      'metadata-coverage-warning-current-submissions',
      'metadata-coverage-warning-previous-submissions',
      'metadata-coverage-warning-current-events',
      'metadata-coverage-warning-previous-events'
    ]);
  });

  it.each([
    ['구 RPC 필드 누락', { metadataEligibleSubmissions: null }],
    ['mapped가 eligible 초과', { metadataMappedEvents: 21 }],
    ['문제 coverage 필드 누락', { metadataMappedProblems: null }]
  ])('%s은 fail-closed 계약 오류로 분류한다', (_label, override) => {
    expect(getLearningAnalyticsMetadataCoverageState(summary(override), true).unavailable).toBe(true);
  });
});
