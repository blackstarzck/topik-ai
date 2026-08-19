import { InfoCircleOutlined } from '@ant-design/icons';
import { Button, Card, Tooltip, Typography } from 'antd';
import type { ReactNode } from 'react';

import type { LearningAnalytics } from '../api/analytics-learning-service';
import {
  formatDuration,
  formatNumber,
  metricDefinitions,
  relativeChange,
  type MetricDefinition
} from '../model/analytics-learning-page-schema';

const { Text } = Typography;

// KPI 카드·추세·지표 설명 툴팁 — Phase 4 분해로 페이지 본문에서 이동(동작 동일).

type TrendProps = {
  current: number | null;
  previous: number | null;
  mode: 'relative' | 'point' | 'duration';
  suffix?: string;
  lowerIsBetter?: boolean;
};

function MetricTrend({
  current,
  previous,
  mode,
  suffix = '',
  lowerIsBetter = false
}: TrendProps): JSX.Element | null {
  if (current == null || previous == null) {
    return null;
  }
  const delta = mode === 'relative' ? relativeChange(current, previous) : current - previous;
  if (delta == null) {
    return null;
  }
  const isUp = delta > 0;
  const isGood = lowerIsBetter ? !isUp : isUp;
  const text =
    mode === 'duration'
      ? formatDuration(Math.abs(delta))
      : `${formatNumber(Math.abs(delta), 1)}${mode === 'relative' ? '%' : suffix}`;
  return (
    <span className={`analytics-learning-trend ${isGood ? 'is-good' : 'is-bad'}`}>
      <span aria-hidden="true">{isUp ? '▲' : '▼'}</span> {text}
    </span>
  );
}

type KpiCardProps = {
  definition: MetricDefinition;
  value: ReactNode;
  unit?: string;
  trend?: ReactNode;
  helper: ReactNode;
  loading: boolean;
};

function MetricDefinitionTooltip({ definition }: { definition: MetricDefinition }): JSX.Element {
  return (
    <div className="analytics-kpi-tooltip-content">
      <header className="analytics-kpi-tooltip-content__header">
        <span className="analytics-kpi-tooltip-content__eyebrow">{definition.category} 지표</span>
        <strong className="analytics-kpi-tooltip-content__title">{definition.label}</strong>
      </header>
      <div className="analytics-kpi-tooltip-content__summary">
        <span>지표 정의</span>
        <p>{definition.definition}</p>
      </div>
      <dl className="analytics-kpi-tooltip-content__details">
        <div>
          <dt>계산 방법</dt>
          <dd>{definition.formula}</dd>
        </div>
        <div>
          <dt>포함 조건</dt>
          <dd>{definition.inclusion}</dd>
        </div>
        <div className="analytics-kpi-tooltip-content__caution">
          <dt>주의사항</dt>
          <dd>{definition.caution}</dd>
        </div>
      </dl>
    </div>
  );
}

function KpiCard({
  definition,
  value,
  unit,
  trend,
  helper,
  loading
}: KpiCardProps): JSX.Element {
  return (
    <Card className="analytics-kpi-card" loading={loading} variant="outlined">
      <Text className="analytics-kpi-category">{definition.category}</Text>
      <div className="analytics-kpi-title-row">
        <Text strong>{definition.label}</Text>
        <Tooltip
          title={<MetricDefinitionTooltip definition={definition} />}
          trigger={['hover', 'focus', 'click']}
          placement="top"
          rootClassName="analytics-kpi-tooltip"
        >
          <Button
            type="text"
            size="small"
            shape="circle"
            className="analytics-kpi-info"
            aria-label={`${definition.label} 지표 설명`}
            icon={<InfoCircleOutlined />}
          />
        </Tooltip>
      </div>
      <div className="analytics-kpi-value-row">
        <span className="analytics-kpi-value">{value}</span>
        {unit ? <span className="analytics-kpi-unit">{unit}</span> : null}
        {trend}
      </div>
      <Text className="analytics-kpi-helper">{helper}</Text>
    </Card>
  );
}

export type LearningKpiCardItem = Omit<KpiCardProps, 'loading'>;

// 페이지의 kpiCards 배열 구성을 그대로 옮긴 빌더(호출부가 summary 존재를 보장).
export function buildLearningKpiCards({
  summary,
  pdfUsage
}: {
  summary: NonNullable<LearningAnalytics['summary']>;
  pdfUsage: LearningAnalytics['pdfUsage'];
}): LearningKpiCardItem[] {
  return [
    {
      definition: metricDefinitions[0],
      value: formatNumber(summary.activeLearners),
      unit: '명',
      trend: <MetricTrend current={summary.activeLearners} previous={summary.activeLearnersPrev} mode="relative" />,
      helper: `귀속 이벤트 ${formatNumber(summary.activeEventsAttributed)}건 · coverage ${formatNumber(summary.activeEventAttributionRate, 1)}%`
    },
    {
      definition: metricDefinitions[1],
      value: formatNumber(summary.submissions),
      unit: '건',
      trend: <MetricTrend current={summary.submissions} previous={summary.submissionsPrev} mode="relative" />,
      helper: `제출자 ${formatNumber(summary.submitters)}명 · 재제출 ${formatNumber(summary.resubmissions)}건`
    },
    {
      definition: metricDefinitions[2],
      value: formatNumber(summary.completionRate, 1),
      unit: '%',
      trend: <MetricTrend current={summary.completionRate} previous={summary.completionRatePrev} mode="point" suffix="%p" />,
      helper: `완료 ${formatNumber(summary.feedbackComplete)} / 전체 ${formatNumber(summary.submissions)}`
    },
    {
      definition: metricDefinitions[3],
      value: formatNumber(summary.avgScoreNormalized, 1),
      unit: '점',
      trend: <MetricTrend current={summary.avgScoreNormalized} previous={summary.avgScoreNormalizedPrev} mode="point" suffix="점" />,
      helper: `0~100 환산 · N=${formatNumber(summary.feedbackComplete)}`
    },
    {
      definition: metricDefinitions[4],
      value: formatNumber(summary.feedbackViewRate, 1),
      unit: '%',
      trend: <MetricTrend current={summary.feedbackViewRate} previous={summary.feedbackViewRatePrev} mode="point" suffix="%p" />,
      helper: `조회 ${formatNumber(summary.feedbackViewedCount)} / 완료 ${formatNumber(summary.feedbackComplete)}`
    },
    {
      definition: metricDefinitions[5],
      value: formatDuration(summary.avgElapsedSeconds),
      trend: <MetricTrend current={summary.avgElapsedSeconds} previous={summary.avgElapsedSecondsPrev} mode="duration" lowerIsBetter />,
      helper: `N=${formatNumber(summary.elapsedSamples)} · coverage ${summary.submissions > 0 ? formatNumber((summary.elapsedSamples / summary.submissions) * 100, 1) : '—'}%`
    },
    {
      definition: metricDefinitions[6],
      value: formatDuration(summary.medianProcessingSeconds),
      trend: <MetricTrend current={summary.medianProcessingSeconds} previous={summary.medianProcessingSecondsPrev} mode="duration" lowerIsBetter />,
      helper: `완료 피드백 ${formatNumber(summary.processingSamples)}건`
    },
    {
      definition: metricDefinitions[7],
      value: formatNumber(summary.pdfExports),
      unit: '건',
      trend: <MetricTrend current={summary.pdfExports} previous={summary.pdfExportsPrev} mode="relative" />,
      helper: `전체 이벤트 ${formatNumber(pdfUsage.totalExports)} · 귀속률 ${formatNumber(pdfUsage.attributionRate, 1)}%`
    }
  ];
}

export { KpiCard, MetricTrend };
