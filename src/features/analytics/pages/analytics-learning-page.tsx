import {
  Alert,
  Button,
  Card,
  Col,
  Progress,
  Row,
  Segmented,
  Space,
  Statistic,
  Table,
  Typography
} from 'antd';
import type { TableColumnsType } from 'antd';
import { useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';

import {
  fetchLearningAnalyticsSafe,
  type LearningAnalytics,
  type LearningAnalyticsQuestionStat,
  type LearningAnalyticsScoreBucket,
  type LearningAnalyticsTagStat,
  type LearningAnalyticsWeakDimension
} from '../api/analytics-learning-service';
import { isSupabaseConfigured } from '../../../shared/api/supabase-client';
import type { AsyncState } from '../../../shared/model/async-state';
import { formatWritingDimension } from '../../../shared/model/writing-dimension-labels';
import { PageTitle } from '../../../shared/ui/page-title/page-title';
import {
  createNumberSorter,
  createTextSorter
} from '../../../shared/ui/table/table-column-utils';

const { Paragraph, Text } = Typography;

type PeriodKey = '7d' | '30d' | '90d' | 'all';

const periodDaysMap: Record<PeriodKey, number> = {
  '7d': 7,
  '30d': 30,
  '90d': 90,
  all: 0
};

const periodOptions = [
  { label: '최근 7일', value: '7d' },
  { label: '최근 30일', value: '30d' },
  { label: '최근 90일', value: '90d' },
  { label: '전체', value: 'all' }
];

function parsePeriod(value: string | null): PeriodKey {
  if (value === '7d' || value === '90d' || value === 'all') {
    return value;
  }
  return '30d';
}

// 소요/처리 시간 표시. null = 미수집(0초와 구분).
function formatSeconds(value: number | null): string {
  if (value == null) {
    return '미수집';
  }
  if (value >= 3600) {
    return `${Math.floor(value / 3600)}시간 ${Math.floor((value % 3600) / 60)}분`;
  }
  if (value >= 60) {
    return `${Math.floor(value / 60)}분 ${Math.round(value % 60)}초`;
  }
  return `${Math.round(value)}초`;
}

// 직전 동일기간 대비 변화율(%). 비교값이 없으면 null.
function relChange(current: number, prev: number | null): number | null {
  if (prev == null || prev <= 0) {
    return null;
  }
  return Math.round(((current - prev) / prev) * 1000) / 10;
}

function trendText(current: number, prev: number | null): string {
  const change = relChange(current, prev);
  if (change == null) {
    return '';
  }
  return `직전 기간 대비 ${change > 0 ? '+' : ''}${change}%`;
}

// mock 모드(Supabase 미설정) 전용 결정적 목업 — 계약과 동일한 모양.
// 소요 시간은 "미수집"(metricsCount 0) 상태를 그대로 노출해 e2e가 라벨을 검증한다.
const mockLearningAnalytics: Record<PeriodKey, LearningAnalytics> = (() => {
  const build = (scale: number, periodDays: number): LearningAnalytics => {
    const submissions = 40 * scale;
    const complete = Math.round(submissions * 0.85);
    const failed = Math.round(submissions * 0.1);
    return {
      summary: {
        periodDays,
        activeLearners: 30 * scale,
        activeLearnersPrev: periodDays === 0 ? null : 24 * scale,
        submitters: 18 * scale,
        submissions,
        submissionsPrev: periodDays === 0 ? null : 32 * scale,
        feedbackComplete: complete,
        feedbackPending: submissions - complete - failed,
        feedbackFailed: failed,
        completionRate: Math.round((complete / submissions) * 1000) / 10,
        failureRate: Math.round((failed / submissions) * 1000) / 10,
        resubmissions: 2 * scale,
        avgScoreNormalized: 61.5,
        avgScoreNormalizedPrev: periodDays === 0 ? null : 58.2,
        feedbackViewedCount: Math.round(complete * 0.6),
        feedbackViewRate: 60,
        avgProcessingSeconds: 95,
        medianProcessingSeconds: 28,
        metricsCount: 0,
        avgElapsedSeconds: null,
        medianElapsedSeconds: null,
        dimensionCoverageSubmissions: Math.round(complete * 0.2)
      },
      perQuestion: [
        {
          questionNo: 51,
          submissions: Math.round(submissions * 0.5),
          feedbackComplete: Math.round(complete * 0.5),
          avgScoreRaw: 6.2,
          scoreMax: 10,
          avgScoreNormalized: 62,
          avgElapsedSeconds: null,
          metricsCount: 0
        },
        {
          questionNo: 52,
          submissions: Math.round(submissions * 0.25),
          feedbackComplete: Math.round(complete * 0.25),
          avgScoreRaw: 5.4,
          scoreMax: 10,
          avgScoreNormalized: 54,
          avgElapsedSeconds: null,
          metricsCount: 0
        },
        {
          questionNo: 53,
          submissions: Math.round(submissions * 0.15),
          feedbackComplete: Math.round(complete * 0.15),
          avgScoreRaw: 19.5,
          scoreMax: 30,
          avgScoreNormalized: 65,
          avgElapsedSeconds: null,
          metricsCount: 0
        },
        {
          questionNo: 54,
          submissions: Math.round(submissions * 0.1),
          feedbackComplete: Math.round(complete * 0.1),
          avgScoreRaw: 31,
          scoreMax: 50,
          avgScoreNormalized: 62,
          avgElapsedSeconds: null,
          metricsCount: 0
        }
      ],
      scoreDistribution: [
        { bucket: 1, label: '0-19', count: 6 * scale },
        { bucket: 2, label: '20-39', count: 5 * scale },
        { bucket: 3, label: '40-59', count: 8 * scale },
        { bucket: 4, label: '60-79', count: 12 * scale },
        { bucket: 5, label: '80-100', count: 9 * scale }
      ],
      weakDimensions: [
        { dimension: 'content', weaknessOccurrences: 9 * scale, submissions: 8 * scale, maxSeverity: 4 },
        { dimension: 'structure', weaknessOccurrences: 7 * scale, submissions: 7 * scale, maxSeverity: 3 },
        { dimension: 'grammar', weaknessOccurrences: 4 * scale, submissions: 4 * scale, maxSeverity: 3 }
      ],
      tagStats: [
        { tag: '문의', submissions: 14 * scale, avgScoreNormalized: 58.4 },
        { tag: '주거와 환경', submissions: 10 * scale, avgScoreNormalized: 63.1 },
        { tag: '건강', submissions: 7 * scale, avgScoreNormalized: 49.7 }
      ]
    };
  };
  return {
    '7d': build(1, 7),
    '30d': build(3, 30),
    '90d': build(6, 90),
    all: build(8, 0)
  };
})();

const questionColumns: TableColumnsType<LearningAnalyticsQuestionStat> = [
  {
    title: '문항',
    dataIndex: 'questionNo',
    width: 90,
    render: (value: number) => `${value}번`
  },
  {
    title: '제출 수',
    dataIndex: 'submissions',
    width: 110,
    sorter: createNumberSorter((record) => record.submissions)
  },
  {
    title: '피드백 완료',
    dataIndex: 'feedbackComplete',
    width: 110,
    sorter: createNumberSorter((record) => record.feedbackComplete)
  },
  {
    title: '평균 점수(원점)',
    dataIndex: 'avgScoreRaw',
    width: 130,
    render: (value: number | null, record) =>
      value == null ? '-' : `${value} / ${record.scoreMax ?? '-'}`
  },
  {
    title: '평균 점수(환산)',
    dataIndex: 'avgScoreNormalized',
    width: 130,
    sorter: createNumberSorter((record) => record.avgScoreNormalized ?? -1),
    render: (value: number | null) => (value == null ? '-' : `${value}점`)
  },
  {
    title: '평균 소요 시간',
    dataIndex: 'avgElapsedSeconds',
    width: 130,
    render: (value: number | null, record) =>
      record.metricsCount === 0 ? '미수집' : formatSeconds(value)
  }
];

const weakDimensionColumns: TableColumnsType<LearningAnalyticsWeakDimension> = [
  {
    title: '평가 차원',
    dataIndex: 'dimension',
    render: (value: string) => formatWritingDimension(value),
    sorter: createTextSorter((record) => formatWritingDimension(record.dimension))
  },
  {
    title: '약점 지적 수',
    dataIndex: 'weaknessOccurrences',
    width: 120,
    sorter: createNumberSorter((record) => record.weaknessOccurrences)
  },
  {
    title: '해당 제출 수',
    dataIndex: 'submissions',
    width: 120,
    sorter: createNumberSorter((record) => record.submissions)
  },
  {
    title: '최고 심각도',
    dataIndex: 'maxSeverity',
    width: 110,
    sorter: createNumberSorter((record) => record.maxSeverity)
  }
];

const tagColumns: TableColumnsType<LearningAnalyticsTagStat> = [
  {
    title: '태그',
    dataIndex: 'tag',
    sorter: createTextSorter((record) => record.tag)
  },
  {
    title: '제출 수',
    dataIndex: 'submissions',
    width: 120,
    sorter: createNumberSorter((record) => record.submissions)
  },
  {
    title: '평균 점수(환산)',
    dataIndex: 'avgScoreNormalized',
    width: 140,
    sorter: createNumberSorter((record) => record.avgScoreNormalized ?? -1),
    render: (value: number | null) => (value == null ? '-' : `${value}점`)
  }
];

export default function AnalyticsLearningPage(): JSX.Element {
  const [searchParams, setSearchParams] = useSearchParams();
  const activePeriod = parsePeriod(searchParams.get('period'));

  const [state, setState] = useState<AsyncState<LearningAnalytics | null>>({
    status: 'pending',
    data: null,
    errorMessage: null,
    errorCode: null
  });
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    setState((prev) => ({
      ...prev,
      status: 'pending',
      errorMessage: null,
      errorCode: null
    }));
    void fetchLearningAnalyticsSafe(periodDaysMap[activePeriod], controller.signal).then(
      (result) => {
        if (controller.signal.aborted) {
          return;
        }
        if (result.ok) {
          setState({
            status: 'success',
            data: result.data,
            errorMessage: null,
            errorCode: null
          });
          return;
        }
        setState((prev) => ({
          ...prev,
          status: 'error',
          errorMessage: result.error.message,
          errorCode: result.error.code
        }));
      }
    );
    return () => controller.abort();
  }, [activePeriod, reloadKey]);

  const commitPeriod = useCallback(
    (nextPeriod: string) => {
      const next = new URLSearchParams(searchParams);
      next.set('period', nextPeriod);
      setSearchParams(next, { replace: true });
    },
    [searchParams, setSearchParams]
  );

  const handleRetry = useCallback(() => {
    setReloadKey((prev) => prev + 1);
  }, []);

  // 표시 모델: 실데이터 > (Supabase 로딩/오류 시 null → '—') > mock.
  const analytics: LearningAnalytics | null =
    state.data ?? (isSupabaseConfigured ? null : mockLearningAnalytics[activePeriod]);
  const summary = analytics?.summary ?? null;
  const loading = isSupabaseConfigured && state.status === 'pending';
  const scoreTotal = analytics
    ? analytics.scoreDistribution.reduce((sum, bucket) => sum + bucket.count, 0)
    : 0;

  const distributionColumns: TableColumnsType<LearningAnalyticsScoreBucket> = [
    {
      title: '점수 구간(환산)',
      dataIndex: 'label',
      width: 140
    },
    {
      title: '제출 수',
      dataIndex: 'count',
      width: 110
    },
    {
      title: '비율',
      dataIndex: 'count',
      key: 'ratio',
      render: (value: number) => (
        <Progress
          percent={scoreTotal > 0 ? Math.round((value / scoreTotal) * 100) : 0}
          size="small"
        />
      )
    }
  ];

  return (
    <Space direction="vertical" size={16} style={{ width: '100%' }}>
      <PageTitle
        title="학습 분석"
        description="TOPIK 쓰기(51~54번) 전체 사용자 학습 지표입니다. 학습 활성 사용자는 로그인이 아니라 학습 이벤트(연습 시작·제출·피드백 열람 등) 기준이며, 점수는 100점 환산 기준으로 비교합니다."
      />

      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
        <Segmented
          options={periodOptions}
          value={activePeriod}
          onChange={(value) => commitPeriod(String(value))}
        />
      </div>

      {state.status === 'error' ? (
        <Alert
          type="error"
          showIcon
          message="학습 분석 집계를 불러오지 못했습니다."
          description={state.errorMessage}
          action={
            <Button size="small" onClick={handleRetry}>
              다시 시도
            </Button>
          }
        />
      ) : null}

      <Row gutter={[16, 16]}>
        <Col xs={24} sm={12} lg={6}>
          <Card size="small" loading={loading}>
            <Statistic
              title="학습 활성 사용자(학습 이벤트 기준)"
              value={summary ? summary.activeLearners : '—'}
              suffix="명"
            />
            <Text type="secondary">
              {summary ? trendText(summary.activeLearners, summary.activeLearnersPrev) : ''}
            </Text>
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card size="small" loading={loading}>
            <Statistic
              title="제출 수"
              value={summary ? summary.submissions : '—'}
              suffix="건"
            />
            <Text type="secondary">
              {summary
                ? `제출 사용자 ${summary.submitters}명${
                    trendText(summary.submissions, summary.submissionsPrev)
                      ? ` · ${trendText(summary.submissions, summary.submissionsPrev)}`
                      : ''
                  }`
                : ''}
            </Text>
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card size="small" loading={loading}>
            <Statistic
              title="피드백 완료율"
              value={summary?.completionRate ?? '—'}
              suffix="%"
            />
            <Text type="secondary">
              {summary
                ? `완료 ${summary.feedbackComplete} · 대기 ${summary.feedbackPending} · 실패 ${summary.feedbackFailed}`
                : ''}
            </Text>
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card size="small" loading={loading}>
            <Statistic
              title="평균 점수(100점 환산)"
              value={summary?.avgScoreNormalized ?? '—'}
              suffix="점"
            />
            <Text type="secondary">
              {summary
                ? trendText(summary.avgScoreNormalized ?? 0, summary.avgScoreNormalizedPrev)
                : ''}
            </Text>
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card size="small" loading={loading}>
            <Statistic
              title="피드백 열람률"
              value={summary?.feedbackViewRate ?? '—'}
              suffix="%"
            />
            <Text type="secondary">
              {summary ? `열람 ${summary.feedbackViewedCount}건 / 완료 ${summary.feedbackComplete}건` : ''}
            </Text>
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card size="small" loading={loading}>
            <Statistic
              title="평균 소요 시간"
              value={
                summary
                  ? summary.metricsCount === 0
                    ? '미수집'
                    : formatSeconds(summary.avgElapsedSeconds)
                  : '—'
              }
            />
            <Text type="secondary">
              {summary && summary.metricsCount > 0
                ? `중앙값 ${formatSeconds(summary.medianElapsedSeconds)} · 수집 ${summary.metricsCount}건`
                : summary
                  ? '소요 시간 수집(2026-07-08) 이후 제출부터 집계됩니다.'
                  : ''}
            </Text>
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card size="small" loading={loading}>
            <Statistic
              title="피드백 처리 시간(중앙값)"
              value={summary ? formatSeconds(summary.medianProcessingSeconds) : '—'}
            />
            <Text type="secondary">
              {summary
                ? `평균 ${formatSeconds(summary.avgProcessingSeconds)} (재동기화 이력 포함 시 부풀 수 있음)`
                : ''}
            </Text>
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card size="small" loading={loading}>
            <Statistic
              title="재제출 수"
              value={summary ? summary.resubmissions : '—'}
              suffix="건"
            />
            <Text type="secondary">피드백 후 같은 문항을 다시 제출한 건수입니다.</Text>
          </Card>
        </Col>
      </Row>

      <Card size="small" title="문항별 성과 (51~54번)" loading={loading}>
        <Table
          rowKey="questionNo"
          size="small"
          showSorterTooltip={false}
          pagination={false}
          dataSource={analytics?.perQuestion ?? []}
          columns={questionColumns}
        />
      </Card>

      <Row gutter={[16, 16]}>
        <Col xs={24} lg={12}>
          <Card size="small" title="점수 분포(100점 환산)" loading={loading}>
            <Table
              rowKey="bucket"
              size="small"
              pagination={false}
              dataSource={analytics?.scoreDistribution ?? []}
              columns={distributionColumns}
            />
          </Card>
        </Col>
        <Col xs={24} lg={12}>
          <Card size="small" title="취약 평가 차원" loading={loading}>
            <Table
              rowKey="dimension"
              size="small"
              showSorterTooltip={false}
              pagination={false}
              dataSource={analytics?.weakDimensions ?? []}
              columns={weakDimensionColumns}
            />
            <Paragraph type="secondary" style={{ marginTop: 8, marginBottom: 0 }}>
              차원 점수가 기록된 제출 {summary ? summary.dimensionCoverageSubmissions : '—'}건
              기준입니다. 차원 점수가 없는 피드백은 표본에서 제외됩니다.
            </Paragraph>
          </Card>
        </Col>
      </Row>

      <Card size="small" title="태그별 성과 (제출 수 상위 12개)" loading={loading}>
        <Table
          rowKey="tag"
          size="small"
          showSorterTooltip={false}
          pagination={false}
          dataSource={analytics?.tagStats ?? []}
          columns={tagColumns}
        />
      </Card>
    </Space>
  );
}
