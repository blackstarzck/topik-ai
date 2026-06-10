import { Alert, Button, Empty, Grid, Popover, Space, Tag, Typography } from 'antd';
import type { TableColumnsType } from 'antd';
import { useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';

import { questionBankDataSource } from '../api/question-bank-data-source';
import { useAssessmentQuestionFilters } from '../model/use-assessment-question-filters';
import { useAssessmentQuestionList } from '../model/use-assessment-question-list';
import { useQuestionBankTopicMaster } from '../model/use-question-bank-masters';
import { AssessmentQuestionBankToolbar } from '../ui/assessment-question-bank-toolbar';
import {
  REVIEW_STATUS_LABELS,
  assessmentReviewStatuses,
  getReviewStatusColor,
  getReviewStatusLabel,
  getReviewWorkflowStatusLabel,
  parseAssessmentReviewStatus
} from '../model/assessment-question-bank-schema';
import {
  applyCommonQuestionFilters,
  filterQuestionsByNumbers,
  getQuestionLevelText
} from '../model/assessment-question-bank-presenter';
import type {
  AssessmentQuestionNumber,
  AssessmentQuestionSummary,
  AssessmentReviewStatus
} from '../model/assessment-question-bank-types';
import { AdminListCard } from '../../../shared/ui/list-page-card/admin-list-card';
import { ListSummaryCards } from '../../../shared/ui/list-summary-cards/list-summary-cards';
import { PageTitle } from '../../../shared/ui/page-title/page-title';
import { AdminDataTable } from '../../../shared/ui/table/admin-data-table';
import { createStatusColumnTitle } from '../../../shared/ui/table/status-column-title';
import { createTextSorter } from '../../../shared/ui/table/table-column-utils';

const { Paragraph, Text } = Typography;
const { useBreakpoint } = Grid;

const reviewStatusLabels = assessmentReviewStatuses.map(
  (status) => REVIEW_STATUS_LABELS[status]
);

const questionPreviewTriggerStyle = {
  display: 'block',
  width: '100%',
  padding: 0,
  border: 'none',
  background: 'transparent',
  textAlign: 'left' as const,
  cursor: 'pointer'
};

const questionPreviewPopoverStyle = {
  width: 420,
  maxWidth: 'min(420px, calc(100vw - 48px))'
};

const questionPreviewFooterStyle = {
  display: 'flex',
  justifyContent: 'flex-end',
  marginTop: 12
};

function buildReviewPageHref(
  questionId: string,
  params: URLSearchParams
): string {
  const nextParams = new URLSearchParams(params);

  const nextSearch = nextParams.toString();
  return nextSearch
    ? `/assessment/question-bank/review/${questionId}?${nextSearch}`
    : `/assessment/question-bank/review/${questionId}`;
}

function renderSituationSummaryCell(
  question: AssessmentQuestionSummary,
  onOpenReviewPage: (questionId: string) => void
): JSX.Element {
  return (
    <Popover
      trigger={['hover', 'focus']}
      placement="rightTop"
      content={
        <div style={questionPreviewPopoverStyle}>
          <Paragraph
            className="assessment-review-page__description-paragraph"
            style={{ marginBottom: 0 }}
          >
            {question.situationSummary}
          </Paragraph>
          {question.scenarioType ? (
            <Text type="secondary">시나리오 유형: {question.scenarioType}</Text>
          ) : null}
          <div style={questionPreviewFooterStyle}>
            <Button
              size="small"
              type="primary"
              onClick={(event) => {
                event.stopPropagation();
                onOpenReviewPage(question.questionId);
              }}
            >
              검수하기
            </Button>
          </div>
        </div>
      }
    >
      <button
        type="button"
        aria-label={`${question.questionId} 문항 상황 요약 보기`}
        className="assessment-question-bank-page__question-trigger"
        style={questionPreviewTriggerStyle}
      >
        <Paragraph
          className="assessment-question-bank-page__question-text"
          ellipsis={{ rows: 1, tooltip: false }}
          style={{ marginBottom: 0 }}
        >
          {question.situationSummary}
        </Paragraph>
      </button>
    </Popover>
  );
}

export default function AssessmentQuestionBankPage(): JSX.Element {
  const screens = useBreakpoint();
  const navigate = useNavigate();
  const filters = useAssessmentQuestionFilters();
  const { state, reload } = useAssessmentQuestionList();
  const { topicOptions } = useQuestionBankTopicMaster();

  const {
    searchParams,
    activeQuestionNumbers,
    topicMainFilter,
    topicDetailFilter,
    questionTypeFilter,
    difficultyFilter,
    keyword,
    commitParams
  } = filters;

  const reviewStatusFilter = parseAssessmentReviewStatus(
    searchParams.get('reviewStatus')
  );

  const hasCachedQuestions = state.data.length > 0;

  const currentNumberQuestions = useMemo(
    () => filterQuestionsByNumbers(state.data, activeQuestionNumbers),
    [activeQuestionNumbers, state.data]
  );

  const filteredQuestions = useMemo(() => {
    const common = applyCommonQuestionFilters(currentNumberQuestions, {
      topicMain: topicMainFilter,
      topicDetail: topicDetailFilter,
      questionType: questionTypeFilter,
      difficulty: difficultyFilter,
      keyword
    });

    return reviewStatusFilter
      ? common.filter((question) => question.reviewStatus === reviewStatusFilter)
      : common;
  }, [
    currentNumberQuestions,
    difficultyFilter,
    keyword,
    questionTypeFilter,
    reviewStatusFilter,
    topicDetailFilter,
    topicMainFilter
  ]);

  const summaryItems = useMemo(() => {
    const countOf = (status: AssessmentReviewStatus) =>
      currentNumberQuestions.filter((question) => question.reviewStatus === status)
        .length;

    return [
      {
        key: 'review-total',
        label: '전체 문항',
        value: `${currentNumberQuestions.length.toLocaleString()}문항`,
        active: reviewStatusFilter === null,
        onClick: () => commitParams({ reviewStatus: null })
      },
      ...assessmentReviewStatuses.map((status) => ({
        key: `review-${status}`,
        label: REVIEW_STATUS_LABELS[status],
        value: `${countOf(status).toLocaleString()}문항`,
        active: reviewStatusFilter === status,
        onClick: () => commitParams({ reviewStatus: status })
      }))
    ];
  }, [commitParams, currentNumberQuestions, reviewStatusFilter]);

  const openReviewPage = useCallback(
    (questionId: string) => {
      navigate(buildReviewPageHref(questionId, searchParams));
    },
    [navigate, searchParams]
  );

  const situationColumnWidth = useMemo(() => {
    if (screens.xxl) {
      return 480;
    }

    if (screens.xl) {
      return 420;
    }

    if (screens.lg) {
      return 360;
    }

    return 280;
  }, [screens.lg, screens.xl, screens.xxl]);

  const reviewColumns = useMemo<TableColumnsType<AssessmentQuestionSummary>>(
    () => [
      {
        title: '문항 번호',
        dataIndex: 'questionNumber',
        width: 100,
        sorter: createTextSorter((record) => record.questionNumber),
        render: (questionNumber: AssessmentQuestionNumber) => `${questionNumber}번`
      },
      {
        title: '문항 ID',
        dataIndex: 'questionId',
        width: 200,
        sorter: createTextSorter((record) => record.questionId)
      },
      {
        title: '주제(종합/세부)',
        key: 'topicAxis',
        width: 220,
        sorter: createTextSorter(
          (record) => `${record.topicMain} ${record.topicDetail}`
        ),
        render: (_, record) => (
          <Space direction="vertical" size={2}>
            <Text strong>{record.topicMain}</Text>
            <Text type="secondary">{record.topicDetail || '-'}</Text>
          </Space>
        )
      },
      {
        title: '상황 요약',
        dataIndex: 'situationSummary',
        key: 'situationSummary',
        width: situationColumnWidth,
        sorter: createTextSorter((record) => record.situationSummary),
        onCell: () => ({
          className: 'assessment-question-bank-page__question-cell'
        }),
        render: (_, record) => renderSituationSummaryCell(record, openReviewPage)
      },
      {
        title: '유형/난이도',
        key: 'typeAndLevel',
        width: 170,
        sorter: createTextSorter((record) => record.questionTypeName),
        render: (_, record) => (
          <Space direction="vertical" size={2}>
            <Text>{record.questionTypeName}</Text>
            <Text type="secondary">{getQuestionLevelText(record) || '-'}</Text>
          </Space>
        )
      },
      {
        title: createStatusColumnTitle('검수 상태', reviewStatusLabels),
        dataIndex: 'reviewStatus',
        width: 140,
        sorter: createTextSorter((record) => record.reviewStatus),
        render: (_, record) => (
          <Space direction="vertical" size={2}>
            <Tag color={getReviewStatusColor(record.reviewStatus)}>
              {getReviewStatusLabel(record.reviewStatus)}
            </Tag>
            <Text type="secondary">
              {getReviewWorkflowStatusLabel(record.reviewWorkflowStatus)}
            </Text>
          </Space>
        )
      },
      {
        title: '최근 수정',
        key: 'updatedAt',
        width: 160,
        sorter: createTextSorter((record) => record.updatedAt),
        render: (_, record) => <Text>{record.updatedAt || '-'}</Text>
      }
    ],
    [openReviewPage, situationColumnWidth]
  );

  return (
    <div>
      <PageTitle title="TOPIK 쓰기 문제 검수" />

      <ListSummaryCards items={summaryItems} />

      <AdminListCard
        toolbar={
          <AssessmentQuestionBankToolbar
            filters={filters}
            topicOptions={topicOptions}
            resultCount={filteredQuestions.length}
          />
        }
      >
        {questionBankDataSource === 'mock' ? (
          <Alert
            type="info"
            showIcon
            style={{ marginBottom: 16 }}
            message="모크 모드로 동작 중입니다."
            description="Supabase가 구성되지 않아 화면 검증용 고정 데이터를 표시합니다. 실데이터·감사 로그에는 기록되지 않습니다."
          />
        ) : null}

        {state.status === 'error' ? (
          <Alert
            type="error"
            showIcon
            style={{ marginBottom: 16 }}
            message="문항 목록을 불러오지 못했습니다."
            description={state.errorMessage ?? ''}
            action={
              <Button size="small" onClick={reload}>
                다시 시도
              </Button>
            }
          />
        ) : null}

        {state.status === 'pending' && !hasCachedQuestions ? (
          <Alert
            type="info"
            showIcon
            style={{ marginBottom: 16 }}
            message="문항 목록을 불러오는 중입니다."
          />
        ) : null}

        {filteredQuestions.length === 0 ? (
          <Empty
            image={Empty.PRESENTED_IMAGE_SIMPLE}
            description="조건에 맞는 검수 대상 문항이 없습니다."
          />
        ) : (
          <AdminDataTable<AssessmentQuestionSummary>
            rowKey="questionId"
            pagination={{ pageSize: 10 }}
            scroll={{ x: 1380 }}
            tableLayout="fixed"
            columns={reviewColumns}
            dataSource={filteredQuestions}
            onRow={(record) => ({
              onClick: () => {
                openReviewPage(record.questionId);
              },
              style: { cursor: 'pointer' }
            })}
          />
        )}
      </AdminListCard>
    </div>
  );
}
