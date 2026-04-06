import {
  Alert,
  Button,
  Checkbox,
  Empty,
  Form,
  Grid,
  Popover,
  Select,
  Space,
  Tabs,
  Tag,
  Typography
} from 'antd';
import type { TableColumnsType } from 'antd';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';

import {
  fetchAssessmentQuestionsSafe
} from '../api/assessment-question-bank-service';
import {
  assessmentQuestionBankTabItems,
  assessmentQuestionDifficultyLevels,
  assessmentQuestionDomains,
  assessmentQuestionNumbers,
  assessmentQuestionNumberTabItems,
  assessmentQuestionReviewStatuses,
  assessmentQuestionTypeLabels,
  getOperationStatusColor,
  getReviewStatusColor,
  parseAssessmentQuestionBankTab,
  parseAssessmentQuestionDifficulty,
  parseAssessmentQuestionDomain,
  parseAssessmentQuestionNumbers,
  parseAssessmentQuestionOperationStatus,
  parseAssessmentQuestionReviewStatus,
  parseAssessmentQuestionTypeLabel
} from '../model/assessment-question-bank-schema';
import {
  buildAssessmentQuestionSearchText,
  getQuestionText,
  getQuestionUsageSummary
} from '../model/assessment-question-bank-presenter';
import type {
  AssessmentQuestion,
  AssessmentQuestionNumber,
  AssessmentQuestionOperationStatus,
  AssessmentQuestionReviewStatus
} from '../model/assessment-question-bank-types';
import type { AsyncState } from '../../../shared/model/async-state';
import { AdminListCard } from '../../../shared/ui/list-page-card/admin-list-card';
import { ListSummaryCards } from '../../../shared/ui/list-summary-cards/list-summary-cards';
import { PageTitle } from '../../../shared/ui/page-title/page-title';
import {
  SearchBar,
  SearchBarDetailField
} from '../../../shared/ui/search-bar/search-bar';
import { AdminDataTable } from '../../../shared/ui/table/admin-data-table';
import { createStatusColumnTitle } from '../../../shared/ui/table/status-column-title';
import {
  createNumberSorter,
  createTextSorter
} from '../../../shared/ui/table/table-column-utils';

const { Paragraph, Text } = Typography;
const { useBreakpoint } = Grid;

type SearchQueryKey =
  | 'tab'
  | 'questionNo'
  | 'domain'
  | 'questionType'
  | 'difficulty'
  | 'keyword'
  | 'reviewStatus'
  | 'operationStatus';

type SearchQueryValue = string | string[] | null;

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
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const [questionsState, setQuestionsState] = useState<
    AsyncState<AssessmentQuestion[]>
  >({
    status: 'pending',
    data: [],
    errorMessage: null,
    errorCode: null
  });
  const [reloadKey, setReloadKey] = useState(0);

  const activeTab = parseAssessmentQuestionBankTab(searchParams.get('tab'));
  const activeQuestionNumbers = parseAssessmentQuestionNumbers(
    searchParams.getAll('questionNo')
  );
  const domainFilter = parseAssessmentQuestionDomain(searchParams.get('domain'));
  const questionTypeFilter = parseAssessmentQuestionTypeLabel(
    searchParams.get('questionType')
  );
  const difficultyFilter = parseAssessmentQuestionDifficulty(
    searchParams.get('difficulty')
  );
  const keyword = searchParams.get('keyword') ?? '';
  const reviewStatusFilter = parseAssessmentQuestionReviewStatus(
    searchParams.get('reviewStatus')
  );
  const operationStatusFilter = parseAssessmentQuestionOperationStatus(
    searchParams.get('operationStatus')
  );
  const [draftDomainFilter, setDraftDomainFilter] = useState<string | null>(
    domainFilter
  );
  const [draftQuestionTypeFilter, setDraftQuestionTypeFilter] = useState<
    string | null
  >(questionTypeFilter);
  const [draftDifficultyFilter, setDraftDifficultyFilter] = useState<string | null>(
    difficultyFilter
  );

  useEffect(() => {
    setDraftDomainFilter(domainFilter);
    setDraftQuestionTypeFilter(questionTypeFilter);
    setDraftDifficultyFilter(difficultyFilter);
  }, [difficultyFilter, domainFilter, questionTypeFilter]);

  useEffect(() => {
    const controller = new AbortController();

    setQuestionsState((prev) => ({
      ...prev,
      status: 'pending',
      errorMessage: null,
      errorCode: null
    }));

    void fetchAssessmentQuestionsSafe(controller.signal).then((result) => {
      if (controller.signal.aborted) {
        return;
      }

      if (!result.ok) {
        setQuestionsState((prev) => ({
          ...prev,
          status: 'error',
          errorMessage: result.error.message,
          errorCode: result.error.code
        }));
        return;
      }

      setQuestionsState({
        status: result.data.length === 0 ? 'empty' : 'success',
        data: result.data,
        errorMessage: null,
        errorCode: null
      });
    });

    return () => {
      controller.abort();
    };
  }, [reloadKey]);

  const commitParams = useCallback(
    (next: Partial<Record<SearchQueryKey, SearchQueryValue>>) => {
      const merged = new URLSearchParams(searchParams);

      Object.entries(next).forEach(([key, value]) => {
        if (Array.isArray(value)) {
          merged.delete(key);

          if (value.length === 0) {
            return;
          }

          value.forEach((item) => {
            if (!item || item === 'all') {
              return;
            }

            merged.append(key, item);
          });
          return;
        }

        if (!value || value === 'all') {
          merged.delete(key);
          return;
        }

        merged.set(key, value);
      });

      setSearchParams(merged, { replace: true });
    },
    [searchParams, setSearchParams]
  );

  const handleSearchDetailOpenChange = useCallback(
    (open: boolean) => {
      if (open) {
        return;
      }

      setDraftDomainFilter(domainFilter);
      setDraftQuestionTypeFilter(questionTypeFilter);
      setDraftDifficultyFilter(difficultyFilter);
    },
    [difficultyFilter, domainFilter, questionTypeFilter]
  );

  const handleResetSearchDetail = useCallback(() => {
    setDraftDomainFilter(null);
    setDraftQuestionTypeFilter(null);
    setDraftDifficultyFilter(null);
  }, []);

  const handleApplySearchDetail = useCallback(() => {
    commitParams({
      domain: draftDomainFilter,
      questionType: draftQuestionTypeFilter,
      difficulty: draftDifficultyFilter
    });
  }, [
    commitParams,
    draftDifficultyFilter,
    draftDomainFilter,
    draftQuestionTypeFilter
  ]);

  const hasCachedQuestions = questionsState.data.length > 0;
  const currentNumberQuestions = useMemo(
    () =>
      questionsState.data.filter(
        (question) => activeQuestionNumbers.includes(question.questionNumber)
      ),
    [activeQuestionNumbers, questionsState.data]
  );

  const handleQuestionNumberToggle = useCallback(
    (questionNumber: AssessmentQuestionNumber, checked: boolean) => {
      const nextQuestionNumbers = checked
        ? assessmentQuestionNumbers.filter(
          (candidate) =>
            activeQuestionNumbers.includes(candidate) || candidate === questionNumber
        )
        : activeQuestionNumbers.filter((candidate) => candidate !== questionNumber);

      if (nextQuestionNumbers.length === 0) {
        return;
      }

      commitParams({
        questionNo:
          nextQuestionNumbers.length === assessmentQuestionNumbers.length
            ? null
            : nextQuestionNumbers
      });
    },
    [activeQuestionNumbers, commitParams]
  );

  const filteredQuestions = useMemo(() => {
    const normalizedKeyword = keyword.trim().toLowerCase();

    return currentNumberQuestions.filter((question) => {
      if (domainFilter && question.domain !== domainFilter) {
        return false;
      }

      if (questionTypeFilter && question.questionTypeLabel !== questionTypeFilter) {
        return false;
      }

      if (difficultyFilter && question.difficultyLevel !== difficultyFilter) {
        return false;
      }

      if (reviewStatusFilter && question.reviewStatus !== reviewStatusFilter) {
        return false;
      }

      if (
        activeTab === 'manage' &&
        operationStatusFilter &&
        question.operationStatus !== operationStatusFilter
      ) {
        return false;
      }

      if (!normalizedKeyword) {
        return true;
      }

      return buildAssessmentQuestionSearchText(question).includes(normalizedKeyword);
    });
  }, [
    activeTab,
    currentNumberQuestions,
    difficultyFilter,
    domainFilter,
    keyword,
    operationStatusFilter,
    questionTypeFilter,
    reviewStatusFilter
  ]);

  const summaryItems = useMemo(() => {
    if (activeTab === 'review') {
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
          onClick: () =>
            commitParams({
              reviewStatus: null
            })
        },
        {
          key: 'review-pending',
          label: '검수 대기',
          value: `${pendingCount.toLocaleString()}문항`,
          active: reviewStatusFilter === '검수 대기',
          onClick: () =>
            commitParams({
              reviewStatus: '검수 대기'
            })
        },
        {
          key: 'review-hold',
          label: '보류',
          value: `${holdCount.toLocaleString()}문항`,
          active: reviewStatusFilter === '보류',
          onClick: () =>
            commitParams({
              reviewStatus: '보류'
            })
        },
        {
          key: 'review-completed',
          label: '검수 완료',
          value: `${completedCount.toLocaleString()}문항`,
          active: reviewStatusFilter === '검수 완료',
          onClick: () =>
            commitParams({
              reviewStatus: '검수 완료'
            })
        }
      ];
    }

    const candidateExposeCount = currentNumberQuestions.filter(
      (question) => question.operationStatus === '노출 후보'
    ).length;
    const candidateHideCount = currentNumberQuestions.filter(
      (question) => question.operationStatus === '숨김 후보'
    ).length;
    const excludedCount = currentNumberQuestions.filter(
      (question) => question.operationStatus === '운영 제외'
    ).length;

    return [
      {
        key: 'manage-total',
        label: '전체 문항',
        value: `${currentNumberQuestions.length.toLocaleString()}문항`,
        active: operationStatusFilter === null,
        onClick: () =>
          commitParams({
            operationStatus: null
          })
      },
      {
        key: 'manage-expose',
        label: '노출 후보',
        value: `${candidateExposeCount.toLocaleString()}문항`,
        active: operationStatusFilter === '노출 후보',
        onClick: () =>
          commitParams({
            operationStatus: '노출 후보'
          })
      },
      {
        key: 'manage-hide',
        label: '숨김 후보',
        value: `${candidateHideCount.toLocaleString()}문항`,
        active: operationStatusFilter === '숨김 후보',
        onClick: () =>
          commitParams({
            operationStatus: '숨김 후보'
          })
      },
      {
        key: 'manage-excluded',
        label: '운영 제외',
        value: `${excludedCount.toLocaleString()}문항`,
        active: operationStatusFilter === '운영 제외',
        onClick: () =>
          commitParams({
            operationStatus: '운영 제외'
          })
      }
    ];
  }, [
    activeTab,
    commitParams,
    currentNumberQuestions,
    operationStatusFilter,
    reviewStatusFilter
  ]);

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
        sorter: createTextSorter(
          (record) => `${record.topic} ${record.domain}`
        ),
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

  const manageColumns = useMemo<TableColumnsType<AssessmentQuestion>>(
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
        title: '주제',
        dataIndex: 'topic',
        width: 240,
        sorter: createTextSorter((record) => record.topic)
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
        title: '운영 상태',
        dataIndex: 'operationStatus',
        width: 120,
        sorter: createTextSorter((record) => record.operationStatus),
        render: (status: AssessmentQuestionOperationStatus) => (
          <Tag color={getOperationStatusColor(status)}>{status}</Tag>
        )
      },
      {
        title: '사용 현황',
        key: 'usage',
        width: 200,
        sorter: createNumberSorter((record) => record.usageCount),
        render: (_, record) => (
          <Space direction="vertical" size={2}>
            <Text>{getQuestionUsageSummary(record)}</Text>
            <Text type="secondary">{record.managementNote}</Text>
          </Space>
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
    []
  );

  const toolbar = (
    <Space direction="vertical" size={16} style={{ width: '100%' }}>
      <Tabs
        activeKey={activeTab}
        items={assessmentQuestionBankTabItems}
        onChange={(value) => {
          commitParams({
            tab: value,
            questionNo:
              activeQuestionNumbers.length === assessmentQuestionNumbers.length
                ? null
                : activeQuestionNumbers,
            domain: null,
            questionType: null,
            difficulty: null,
            keyword: null,
            reviewStatus: null,
            operationStatus: null
          });
        }}
      />
      <div role="group" aria-label="문제 번호 필터">
        <Space wrap size={[16, 8]}>
          {assessmentQuestionNumberTabItems.map((item) => (
            <Checkbox
              key={item.key}
              checked={activeQuestionNumbers.includes(
                item.key as AssessmentQuestionNumber
              )}
              onChange={(event) =>
                handleQuestionNumberToggle(
                  item.key as AssessmentQuestionNumber,
                  event.target.checked
                )
              }
            >
              {item.label}
            </Checkbox>
          ))}
        </Space>
      </div>
      <SearchBar
        searchField="all"
        searchFieldOptions={[{ label: '전체', value: 'all' }]}
        showSingleFieldSelect
        searchFieldAriaLabel="검색 범위"
        keyword={keyword}
        keywordAriaLabel="문항 검색어"
        onSearchFieldChange={() => undefined}
        onKeywordChange={(event) =>
          commitParams({
            keyword: event.target.value || null
          })
        }
        keywordPlaceholder="문항 ID, 주제, 키워드를 검색하세요."
        detailTitle="상세 검색"
        detailContent={
          <Form layout="vertical">
            <SearchBarDetailField label="도메인">
              <Select
                aria-label="도메인 필터"
                popupMatchSelectWidth={false}
                value={draftDomainFilter ?? 'all'}
                options={[
                  { label: '전체', value: 'all' },
                  ...assessmentQuestionDomains.map((domain) => ({
                    label: domain,
                    value: domain
                  }))
                ]}
                onChange={(value) =>
                  setDraftDomainFilter(value === 'all' ? null : value)
                }
                style={{ width: '100%' }}
              />
            </SearchBarDetailField>
            <SearchBarDetailField label="유형">
              <Select
                aria-label="유형 필터"
                popupMatchSelectWidth={false}
                value={draftQuestionTypeFilter ?? 'all'}
                options={[
                  { label: '전체', value: 'all' },
                  ...assessmentQuestionTypeLabels.map((questionType) => ({
                    label: questionType,
                    value: questionType
                  }))
                ]}
                onChange={(value) =>
                  setDraftQuestionTypeFilter(value === 'all' ? null : value)
                }
                style={{ width: '100%' }}
              />
            </SearchBarDetailField>
            <SearchBarDetailField label="난이도">
              <Select
                aria-label="난이도 필터"
                popupMatchSelectWidth={false}
                value={draftDifficultyFilter ?? 'all'}
                options={[
                  { label: '전체', value: 'all' },
                  ...assessmentQuestionDifficultyLevels.map((difficulty) => ({
                    label: difficulty,
                    value: difficulty
                  }))
                ]}
                onChange={(value) =>
                  setDraftDifficultyFilter(value === 'all' ? null : value)
                }
                style={{ width: '100%' }}
              />
            </SearchBarDetailField>
          </Form>
        }
        onApply={handleApplySearchDetail}
        onDetailOpenChange={handleSearchDetailOpenChange}
        onReset={handleResetSearchDetail}
        summary={
          <Text type="secondary">
            현재 결과 {filteredQuestions.length.toLocaleString()}문항
          </Text>
        }
      />
    </Space>
  );

  const activeColumns = activeTab === 'review' ? reviewColumns : manageColumns;
  const emptyDescription =
    activeTab === 'review'
      ? '조건에 맞는 검수 대상 문항이 없습니다.'
      : '조건에 맞는 관리 대상 문항이 없습니다.';

  return (
    <>
      <div>
        <PageTitle title="TOPIK 쓰기 문제은행" />

        <ListSummaryCards items={summaryItems} />

        <AdminListCard toolbar={toolbar}>
          {questionsState.status === 'error' ? (
            <Alert
              type="error"
              showIcon
              style={{ marginBottom: 16 }}
              message="문항 목록을 불러오지 못했습니다."
              description={questionsState.errorMessage ?? ''}
              action={
                <Button size="small" onClick={() => setReloadKey((prev) => prev + 1)}>
                  다시 시도
                </Button>
              }
            />
          ) : null}

          {questionsState.status === 'pending' && !hasCachedQuestions ? (
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
              description={emptyDescription}
            />
          ) : (
            <AdminDataTable<AssessmentQuestion>
              rowKey="questionId"
              pagination={{ pageSize: 10 }}
              scroll={{ x: 1380 }}
              tableLayout="fixed"
              columns={activeColumns}
              dataSource={filteredQuestions}
              onRow={
                activeTab === 'review'
                  ? (record) => ({
                      onClick: () => {
                        openReviewPage(record.questionId);
                      },
                      style: { cursor: 'pointer' }
                    })
                  : undefined
              }
            />
          )}
        </AdminListCard>
      </div>
    </>
  );
}
