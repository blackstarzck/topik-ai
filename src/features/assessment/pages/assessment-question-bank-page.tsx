import { Alert, Button, Empty, Grid, Popover, Space, Tag, Typography } from 'antd';
import type { TableColumnsType } from 'antd';
import { useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';

import { useAssessmentQuestionFilters } from '../model/use-assessment-question-filters';
import { useAssessmentQuestionList } from '../model/use-assessment-question-list';
import { AssessmentQuestionBankToolbar } from '../ui/assessment-question-bank-toolbar';
import {
  assessmentQuestionReviewStatuses,
  getReviewStatusColor,
  parseAssessmentQuestionReviewStatus
} from '../model/assessment-question-bank-schema';
import {
  applyCommonQuestionFilters,
  filterQuestionsByNumbers,
  getQuestionText
} from '../model/assessment-question-bank-presenter';
import type {
  AssessmentQuestion,
  AssessmentQuestionNumber,
  AssessmentQuestionReviewStatus
} from '../model/assessment-question-bank-types';
import { AdminListCard } from '../../../shared/ui/list-page-card/admin-list-card';
import { ListSummaryCards } from '../../../shared/ui/list-summary-cards/list-summary-cards';
import { PageTitle } from '../../../shared/ui/page-title/page-title';
import { AdminDataTable } from '../../../shared/ui/table/admin-data-table';
import { createStatusColumnTitle } from '../../../shared/ui/table/status-column-title';
import { createTextSorter } from '../../../shared/ui/table/table-column-utils';

const { Paragraph, Text } = Typography;
const { useBreakpoint } = Grid;

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

function renderQuestionTextParagraph(content: string): JSX.Element {
  return (
    <Paragraph
      className="assessment-question-bank-page__question-text"
      ellipsis={{ rows: 1, tooltip: false }}
      style={{ marginBottom: 0 }}
    >
      {content}
    </Paragraph>
  );
}

function renderQuestionTextCell(
  question: AssessmentQuestion,
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
            {getQuestionText(question)}
          </Paragraph>
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
        aria-label={`${question.questionId} 문항 전체 보기`}
        className="assessment-question-bank-page__question-trigger"
        style={questionPreviewTriggerStyle}
      >
        {renderQuestionTextParagraph(getQuestionText(question))}
      </button>
    </Popover>
  );
}

export default function AssessmentQuestionBankPage(): JSX.Element {
  const screens = useBreakpoint();
  const navigate = useNavigate();
  const filters = useAssessmentQuestionFilters();
  const { state, reload } = useAssessmentQuestionList();

  const {
    searchParams,
    activeQuestionNumbers,
    domainFilter,
    questionTypeFilter,
    difficultyFilter,
    keyword,
    commitParams
  } = filters;

  const reviewStatusFilter = parseAssessmentQuestionReviewStatus(
    searchParams.get('reviewStatus')
  );

  const hasCachedQuestions = state.data.length > 0;

  const currentNumberQuestions = useMemo(
    () => filterQuestionsByNumbers(state.data, activeQuestionNumbers),
    [activeQuestionNumbers, state.data]
  );

  const filteredQuestions = useMemo(() => {
    const common = applyCommonQuestionFilters(currentNumberQuestions, {
      domain: domainFilter,
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
    domainFilter,
    keyword,
    questionTypeFilter,
    reviewStatusFilter
  ]);

  const summaryItems = useMemo(() => {
    const pendingCount = currentNumberQuestions.filter(
      (question) => question.reviewStatus === '검수 대기'
    ).length;
    const holdCount = currentNumberQuestions.filter(
      (question) => question.reviewStatus === '보류'
    ).length;
    const completedCount = currentNumberQuestions.filter(
      (question) => question.reviewStatus === '검수 완료'
    ).length;

    return [
      {
        key: 'review-total',
        label: '전체 문항',
        value: `${currentNumberQuestions.length.toLocaleString()}문항`,
        active: reviewStatusFilter === null,
        onClick: () => commitParams({ reviewStatus: null })
      },
      {
        key: 'review-pending',
        label: '검수 대기',
        value: `${pendingCount.toLocaleString()}문항`,
        active: reviewStatusFilter === '검수 대기',
        onClick: () => commitParams({ reviewStatus: '검수 대기' })
      },
      {
        key: 'review-hold',
        label: '보류',
        value: `${holdCount.toLocaleString()}문항`,
        active: reviewStatusFilter === '보류',
        onClick: () => commitParams({ reviewStatus: '보류' })
      },
      {
        key: 'review-completed',
        label: '검수 완료',
        value: `${completedCount.toLocaleString()}문항`,
        active: reviewStatusFilter === '검수 완료',
        onClick: () => commitParams({ reviewStatus: '검수 완료' })
      }
    ];
  }, [commitParams, currentNumberQuestions, reviewStatusFilter]);

  const openReviewPage = useCallback(
    (questionId: string) => {
      navigate(buildReviewPageHref(questionId, searchParams));
    },
    [navigate, searchParams]
  );

  const questionColumnWidth = useMemo(() => {
    if (screens.xxl) {
      return 560;
    }

    if (screens.xl) {
      return 500;
    }

    if (screens.lg) {
      return 440;
    }

    if (screens.md) {
      return 360;
    }

    return 300;
  }, [screens.lg, screens.md, screens.xl, screens.xxl]);

  const reviewColumns = useMemo<TableColumnsType<AssessmentQuestion>>(
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
        width: 130,
        sorter: createTextSorter((record) => record.questionId)
      },
      {
        title: '문항 주제 / 도메인',
        key: 'topicAndMeta',
        width: 280,
        sorter: createTextSorter((record) => `${record.topic} ${record.domain}`),
        render: (_, record) => (
          <Space direction="vertical" size={2}>
            <Text strong>{record.topic}</Text>
            <Text type="secondary">{record.domain || '-'}</Text>
          </Space>
        )
      },
      {
        title: '문항',
        dataIndex: 'questionText',
        key: 'questionText',
        width: questionColumnWidth,
        sorter: createTextSorter((record) => getQuestionText(record)),
        onCell: () => ({
          className: 'assessment-question-bank-page__question-cell'
        }),
        render: (_, record) => renderQuestionTextCell(record, openReviewPage)
      },
      {
        title: createStatusColumnTitle('검수 상태', assessmentQuestionReviewStatuses),
        dataIndex: 'reviewStatus',
        width: 120,
        sorter: createTextSorter((record) => record.reviewStatus),
        render: (status: AssessmentQuestionReviewStatus) => (
          <Tag color={getReviewStatusColor(status)}>{status}</Tag>
        )
      },
      {
        title: '최근 수정',
        key: 'updatedAt',
        width: 180,
        sorter: createTextSorter((record) => record.updatedAt),
        render: (_, record) => (
          <Space direction="vertical" size={2}>
            <Text>{record.updatedAt}</Text>
            <Text type="secondary">{record.updatedBy}</Text>
          </Space>
        )
      }
    ],
    [openReviewPage, questionColumnWidth]
  );

  return (
    <div>
      <PageTitle title="TOPIK 쓰기 문제 검수" />

      <ListSummaryCards items={summaryItems} />

      <AdminListCard
        toolbar={
          <AssessmentQuestionBankToolbar
            filters={filters}
            resultCount={filteredQuestions.length}
          />
        }
      >
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
          <AdminDataTable<AssessmentQuestion>
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
