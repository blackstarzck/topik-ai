import { Typography } from 'antd';
import type { TableColumnsType } from 'antd';

import type {
  LearningAnalyticsQuestionStat,
  LearningAnalyticsTopicStat
} from '../api/analytics-learning-service';
import type { LearningQuestionNo } from '../model/analytics-learning-query';
import {
  formatDuration,
  formatNumber,
  getQuestionShortLabel,
  type PdfUsageHierarchyRow
} from '../model/analytics-learning-page-schema';
import { PdfUsageCountBar, TopicSubmissionBar } from './analytics-learning-charts';

const { Text } = Typography;

// 문제 유형·주제·PDF 위계 테이블 컬럼 — Phase 4 분해로 페이지 본문에서 이동(동작 동일).
// 최대 제출 수·전체 건수 같은 파생값은 페이지가 계산해 인자로 전달한다.

export function createLearningQuestionColumns(): TableColumnsType<LearningAnalyticsQuestionStat> {
  return [
  {
    title: '문제 유형',
    dataIndex: 'questionNo',
    fixed: 'left',
    width: 138,
    render: (value: LearningQuestionNo) => getQuestionShortLabel(value)
  },
  { title: '학습자', dataIndex: 'activeLearners', width: 88, render: (value: number) => `${formatNumber(value)}명` },
  { title: '제출자', dataIndex: 'submitters', width: 88, render: (value: number) => `${formatNumber(value)}명` },
  { title: '제출', dataIndex: 'submissions', width: 78, render: (value: number) => `${formatNumber(value)}건` },
  { title: '완료율', dataIndex: 'completionRate', width: 84, render: (value: number | null) => `${formatNumber(value, 1)}%` },
  { title: '평균 환산 점수', dataIndex: 'avgScoreNormalized', width: 120, render: (value: number | null) => `${formatNumber(value, 1)}점` },
  { title: '조회율', dataIndex: 'feedbackViewRate', width: 82, render: (value: number | null) => `${formatNumber(value, 1)}%` },
  { title: '풀이 시간', dataIndex: 'avgElapsedSeconds', width: 112, render: (value: number | null) => formatDuration(value) },
  { title: '재제출률', dataIndex: 'resubmissionRate', width: 90, render: (value: number | null) => `${formatNumber(value, 1)}%` },
  { title: 'PDF', dataIndex: 'pdfExports', width: 72, render: (value: number) => `${formatNumber(value)}건` }
  ];
}

export function createLearningTopicColumns({
  maxTopicSubmissions
}: {
  maxTopicSubmissions: number;
}): TableColumnsType<LearningAnalyticsTopicStat> {
  return [
  { title: '대주제', dataIndex: 'topicMain', width: 84 },
  { title: '세부 주제', dataIndex: 'topicDetail', width: 112 },
  {
    title: '문제 유형',
    dataIndex: 'questionNo',
    width: 88,
    render: (value: LearningQuestionNo) => `${value}번`
  },
  {
    title: '평균 환산 점수',
    dataIndex: 'avgScoreNormalized',
    width: 110,
    render: (value: number | null) => `${formatNumber(value, 1)}점`
  },
  {
    title: '제출',
    dataIndex: 'submissions',
    width: 72,
    render: (value: number) => formatNumber(value)
  },
  {
    title: '변화',
    key: 'delta',
    width: 70,
    render: (_, row) => {
      if (row.avgScoreNormalized == null || row.avgScoreNormalizedPrev == null) {
        return '—';
      }
      const delta = row.avgScoreNormalized - row.avgScoreNormalizedPrev;
      return <span className={delta >= 0 ? 'is-positive' : 'is-negative'}>{delta >= 0 ? '+' : ''}{formatNumber(delta, 1)}</span>;
    }
  },
  {
    title: (
      <div className="topic-submission-chart__heading">
        <span>제출 수</span>
        <Text type="secondary">최대 제출 기준 · 제출 많은 순</Text>
      </div>
    ),
    key: 'submissionChart',
    width: 700,
    render: (_, row) => (
      <TopicSubmissionBar maxSubmissions={maxTopicSubmissions} row={row} />
    )
  }
  ];
}

export function createLearningPdfHierarchyColumns({
  pdfUsageTotal
}: {
  pdfUsageTotal: number;
}): TableColumnsType<PdfUsageHierarchyRow> {
  return [
  {
    title: '구성',
    dataIndex: 'label',
    width: 96,
    render: (_value: string, row) => (
      <span className={`pdf-hierarchy-label is-${row.kind}`}>
        <i aria-hidden="true" style={{ backgroundColor: row.color }} />
        {row.kind === 'topic' ? null : <Text strong>{row.label}</Text>}
      </span>
    )
  },
  {
    title: '대주제',
    dataIndex: 'topicMain',
    width: 128,
    render: (value: string | null, row) => {
      if (row.kind === 'mixed' || row.kind === 'unclassified') {
        return <Text type="secondary">주제 분석 불가</Text>;
      }
      if (row.kind === 'question') {
        const topicCount = new Set(
          (row.children ?? []).map((child) => child.topicMain ?? '주제 미연결')
        ).size;
        return <Text type="secondary">{topicCount}</Text>;
      }
      return value ?? <Text type="secondary">주제 미연결</Text>;
    }
  },
  {
    title: '세부 주제',
    dataIndex: 'topicDetail',
    width: 140,
    render: (value: string | null, row) => row.kind === 'topic'
      ? (value ?? <Text type="secondary">-</Text>)
      : <Text type="secondary">-</Text>
  },
  {
    title: (
      <div className="pdf-hierarchy-count__heading">
        <span>내보내기 완료 수</span>
        <Text type="secondary">전체 이벤트 기준</Text>
      </div>
    ),
    dataIndex: 'count',
    width: 280,
    render: (_value: number, row) => <PdfUsageCountBar row={row} total={pdfUsageTotal} />
  }
  ];
}
