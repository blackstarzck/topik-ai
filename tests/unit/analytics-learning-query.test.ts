import { describe, expect, it } from 'vitest';

import { createMockLearningAnalytics } from '../../src/features/analytics/api/analytics-learning-service';
import { createLearningAnalyticsCsv } from '../../src/features/analytics/model/analytics-learning-csv';
import {
  countLearningAnalyticsConditions,
  defaultLearningAnalyticsQuery,
  parseLearningAnalyticsQuery,
  resolveLearningAnalyticsDateRange,
  serializeLearningAnalyticsQuery
} from '../../src/features/analytics/model/analytics-learning-query';

describe('analytics learning query contract', () => {
  it('uses the KST calendar day for preset ranges', () => {
    const range = resolveLearningAnalyticsDateRange(
      defaultLearningAnalyticsQuery,
      new Date('2026-07-09T16:30:00Z')
    );

    expect(range).toEqual({
      startDate: '2026-06-11',
      endDate: '2026-07-10'
    });
  });

  it('round-trips custom dates, repeated questions, topics, and detail values', () => {
    const params = new URLSearchParams();
    params.set('period', 'custom');
    params.set('from', '2026-07-01');
    params.set('to', '2026-07-10');
    params.set('compare', '1');
    params.append('question', '53');
    params.set('topicMain', '사회');
    params.set('topicDetail', '문화');
    params.append('d.dataType', '표');
    params.append('d.dataType', '그래프');
    params.append('d.requiredStructure', '자료 요약');

    const query = parseLearningAnalyticsQuery(params);
    const restored = parseLearningAnalyticsQuery(
      serializeLearningAnalyticsQuery(query)
    );

    expect(restored).toEqual(query);
    expect(restored.detailFilters).toEqual({
      dataType: ['표', '그래프'],
      requiredStructure: ['자료 요약']
    });
  });

  it('drops type-specific details when multiple question types are selected', () => {
    const params = new URLSearchParams(
      'period=30d&question=51&question=53&d.blankRole=원인&d.dataType=표'
    );

    expect(parseLearningAnalyticsQuery(params).detailFilters).toEqual({});
  });

  it('falls back to the 30-day default for an invalid custom range', () => {
    const query = parseLearningAnalyticsQuery(
      new URLSearchParams('period=custom&from=2026-07-10&to=2026-07-01')
    );

    expect(query.period).toBe('30d');
    expect(query.from).toBeNull();
    expect(query.to).toBeNull();
  });

  it('counts only active condition values beyond the required date condition', () => {
    expect(countLearningAnalyticsConditions(defaultLearningAnalyticsQuery)).toBe(2);

    expect(
      countLearningAnalyticsConditions({
        ...defaultLearningAnalyticsQuery,
        questions: [51, 53],
        topicMain: '교육'
      })
    ).toBe(5);
  });

  it('applies the same selected question and topic scope to all mock sections', () => {
    const query = {
      ...defaultLearningAnalyticsQuery,
      period: 'custom' as const,
      from: '2026-07-01',
      to: '2026-07-10',
      questions: [53] as const,
      topicMain: '사회',
      topicDetail: '문화'
    };
    const data = createMockLearningAnalytics(
      { ...query, questions: [...query.questions] },
      new Date('2026-07-10T03:00:00Z')
    );

    expect(data.perQuestion.map((row) => row.questionNo)).toEqual([53]);
    expect(new Set(data.scoreDistribution.map((row) => row.questionNo))).toEqual(
      new Set([53])
    );
    expect(new Set(data.weakDimensions.map((row) => row.questionNo))).toEqual(
      new Set([53])
    );
    expect(data.topicStats).toHaveLength(1);
    expect(data.topicStats[0]).toMatchObject({
      topicMain: '사회',
      topicDetail: '문화'
    });
    expect(data.pdfUsage.perQuestion.map((row) => row.questionNo)).toEqual([53]);
    expect(data.summary.metadataMappedSubmissions).toBe(
      data.summary.metadataEligibleSubmissions
    );
    expect(data.summary.metadataMappedEvents).toBe(
      data.summary.metadataEligibleEvents
    );
    expect(data.summary.metadataCoverageRate).toBe(100);
    expect(data.summary.metadataEventCoverageRate).toBe(100);
  });

  it('exports a UTF-8 BOM long-form CSV with escaped values and every section', () => {
    const data = createMockLearningAnalytics(
      {
        ...defaultLearningAnalyticsQuery,
        questions: [51],
        topicMain: '사회,"문화"'
      },
      new Date('2026-07-10T03:00:00Z')
    );

    const csv = createLearningAnalyticsCsv(data);
    const [header] = csv.slice(1).split('\n');

    expect(csv.charCodeAt(0)).toBe(0xfeff);
    expect(header.split(',')).toEqual([
      'section',
      'question_type',
      'topic_main',
      'topic_detail',
      'metric',
      'category',
      'value',
      'unit',
      'sample_count',
      'coverage',
      'period_start',
      'period_end'
    ]);
    expect(csv).toContain('"사회,""문화"""');
    expect(csv).toContain('문제 유형별 비교,51');
    expect(csv).toContain(',학습자,문제 유형,');
    expect(csv).toContain(',제출자,문제 유형,');
    expect(csv).toContain(',평균 풀이 시간,문제 유형,');
    expect(csv).toContain('PDF 사용 분석');
    expect(csv).toContain(',혼합,');
    expect(csv).toContain(',미분류,');
  });
});
