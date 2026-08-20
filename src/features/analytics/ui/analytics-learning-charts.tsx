import { memo } from 'react';

import type { LearningAnalyticsTopicStat } from '../api/analytics-learning-service';
import { APP_COLOR } from '@/shared/styles/design-tokens';
import {
  formatNumber,
  type PdfUsageHierarchyRow,
  type PdfUsageSlice
} from '../model/analytics-learning-page-schema';

// 주제 제출 바·PDF 구성 파이·PDF 위계 바 — Phase 4 분해로 페이지 본문에서 이동(동작 동일).

export const TopicSubmissionBar = memo(function TopicSubmissionBar({
  maxSubmissions,
  row
}: {
  maxSubmissions: number;
  row: LearningAnalyticsTopicStat;
}): JSX.Element {
  const normalizedSubmissions = maxSubmissions > 0
    ? Math.min(100, Math.max(0, (row.submissions / maxSubmissions) * 100))
    : 0;
  const rowLabel = `${row.topicMain} · ${row.topicDetail} · ${row.questionNo}번`;
  const submissionsLabel = `${formatNumber(row.submissions)}건`;

  return (
    <div
      className="topic-submission-chart__row"
      title={`${rowLabel}: 제출 ${submissionsLabel}`}
    >
      <span className="topic-submission-chart__label">{rowLabel}</span>
      <svg
        className="topic-submission-chart__graphic"
        viewBox="0 0 100 18"
        preserveAspectRatio="none"
        role="img"
        aria-label={`${rowLabel} 제출 수 ${submissionsLabel}`}
      >
        <rect className="topic-submission-chart__track" width="100" height="18" rx="2" />
        <rect className="topic-submission-chart__bar" width={normalizedSubmissions} height="18" rx="2" />
      </svg>
      <span className="topic-submission-chart__value">{submissionsLabel}</span>
    </div>
  );
});

export function PdfUsageCompositionPie({
  slices,
  total
}: {
  slices: PdfUsageSlice[];
  total: number;
}): JSX.Element {
  const compositionLabel = slices
    .map((slice) => {
      const percentage = total > 0 ? (slice.count / total) * 100 : 0;
      return `${slice.label} ${formatNumber(slice.count)}건 ${formatNumber(percentage, 1)}%`;
    })
    .join(', ');
  let accumulatedPercentage = 0;
  const gradientSegments = slices.flatMap((slice) => {
    const percentage = total > 0 ? Math.max(0, (slice.count / total) * 100) : 0;
    if (percentage === 0) {
      return [];
    }
    const start = accumulatedPercentage;
    accumulatedPercentage = Math.min(100, accumulatedPercentage + percentage);
    return `${slice.color} ${start.toFixed(3)}% ${accumulatedPercentage.toFixed(3)}%`;
  });
  if (accumulatedPercentage < 100) {
    gradientSegments.push(`${APP_COLOR.chartTrackBg} ${accumulatedPercentage.toFixed(3)}% 100%`);
  }
  const pieBackground = gradientSegments.length > 0
    ? `conic-gradient(${gradientSegments.join(', ')})`
    : APP_COLOR.chartTrackBg;

  return (
    <div className="pdf-composition-chart">
      <div
        className="pdf-composition-pie"
        role="img"
        aria-label={`PDF 내보내기 완료 전체 ${formatNumber(total)}건의 구성: ${compositionLabel}`}
        style={{ background: pieBackground }}
      />
    </div>
  );
}

export function PdfUsageCountBar({
  row,
  total
}: {
  row: PdfUsageHierarchyRow;
  total: number;
}): JSX.Element {
  const percentage = total > 0 ? Math.min(100, Math.max(0, (row.count / total) * 100)) : 0;
  const context = row.kind === 'topic'
    ? `${row.questionNo}번 ${row.topicMain ?? '주제 미연결'} ${row.topicDetail ?? ''}`.trim()
    : row.label;

  return (
    <div className="pdf-hierarchy-count">
      <div
        className="pdf-hierarchy-count__track"
        role="progressbar"
        aria-label={`${context} PDF 내보내기 완료 ${formatNumber(row.count)}건, 전체의 ${formatNumber(percentage, 1)}%`}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Number(percentage.toFixed(1))}
      >
        <span style={{ width: `${percentage}%`, backgroundColor: row.color }} />
      </div>
      <strong>{formatNumber(row.count)}건</strong>
      <small>{formatNumber(percentage, 1)}%</small>
    </div>
  );
}
