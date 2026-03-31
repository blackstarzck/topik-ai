import {
  Alert,
  Button,
  Checkbox,
  Collapse,
  Descriptions,
  Empty,
  Form,
  Select,
  Space,
  Tabs,
  Tag,
  Typography,
  notification
} from 'antd';
import type { TableColumnsType } from 'antd';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';

import {
  fetchAssessmentQuestionsSafe,
  updateAssessmentQuestionOperationStatusSafe
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
  getValidationStatusColor,
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
  getQuestionInstructionLabel,
  getQuestionInstructionText,
  getQuestionPreviewText,
  getQuestionSourceSummary,
  getQuestionUsageSummary
} from '../model/assessment-question-bank-presenter';
import type {
  AssessmentQuestion,
  AssessmentQuestionNumber,
  AssessmentQuestionOperationStatus,
  AssessmentQuestionReviewStatus
} from '../model/assessment-question-bank-types';
import type { AsyncState } from '../../../shared/model/async-state';
import { AuditLogLink } from '../../../shared/ui/audit-log-link/audit-log-link';
import { ConfirmAction } from '../../../shared/ui/confirm-action/confirm-action';
import {
  DetailDrawer,
  DetailDrawerBody,
  DetailDrawerSection
} from '../../../shared/ui/detail-drawer/detail-drawer';
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
import { TableActionMenu } from '../../../shared/ui/table/table-action-menu';

const { Paragraph, Text } = Typography;

type ManageActionState = {
  question: AssessmentQuestion;
  nextStatus: AssessmentQuestionOperationStatus;
} | null;

type OperationActionCopy = {
  title: string;
  description: string;
  confirmText: string;
  successMessage: string;
  reasonPlaceholder: string;
};

type SearchQueryKey =
  | 'tab'
  | 'questionNo'
  | 'domain'
  | 'questionType'
  | 'difficulty'
  | 'keyword'
  | 'reviewStatus'
  | 'operationStatus'
  | 'selected';

type SearchQueryValue = string | string[] | null;

function parseSelectedId(value: string | null): string {
  return value?.trim() ?? '';
}

function buildReviewPageHref(
  questionId: string,
  params: URLSearchParams
): string {
  const nextParams = new URLSearchParams(params);
  nextParams.delete('selected');

  const nextSearch = nextParams.toString();
  return nextSearch
    ? `/assessment/question-bank/review/${questionId}?${nextSearch}`
    : `/assessment/question-bank/review/${questionId}`;
}

function getOperationActionCopy(
  nextStatus: AssessmentQuestionOperationStatus
): OperationActionCopy {
  if (nextStatus === '노출 후보') {
    return {
      title: '노출 후보 지정',
      description:
        '이 문항을 노출 후보로 지정합니다. 실제 시험 연결 여부는 별도 편성 정책에 따라 결정됩니다.',
      confirmText: '노출 후보',
      successMessage: '노출 후보로 지정되었습니다.',
      reasonPlaceholder: '노출 후보 판단 근거를 입력해 주세요.'
    };
  }

  if (nextStatus === '숨김 후보') {
    return {
      title: '숨김 후보 지정',
      description:
        '이 문항을 숨김 후보로 전환합니다. 품질은 통과했지만 당장 운영 우선순위에서 제외하는 상태입니다.',
      confirmText: '숨김 후보',
      successMessage: '숨김 후보로 지정되었습니다.',
      reasonPlaceholder: '숨김 후보 사유를 입력해 주세요.'
    };
  }

  return {
    title: '운영 제외 처리',
    description:
      '이 문항을 운영 제외 상태로 전환합니다. 현재 편성 대상에서는 빠지지만 이후 복구는 가능합니다.',
    confirmText: '운영 제외',
    successMessage: '운영 제외 처리되었습니다.',
    reasonPlaceholder: '운영 제외 사유를 입력해 주세요.'
  };
}

function renderPreviewParagraph(content: string): JSX.Element {
  return (
    <Paragraph ellipsis={{ rows: 2 }} style={{ marginBottom: 0 }}>
      {content}
    </Paragraph>
  );
}

function renderDrawerSpecificSummary(question: AssessmentQuestion): JSX.Element {
  if (question.content.kind === '51' || question.content.kind === '52') {
    return (
      <Descriptions
        bordered
        size="small"
        column={1}
        items={[
          {
            key: 'choices',
            label: '보기',
            children: (
              <ol style={{ margin: 0, paddingLeft: 20 }}>
                {question.content.choices.map((choice) => (
                  <li key={choice}>
                    <Text>{choice}</Text>
                  </li>
                ))}
              </ol>
            )
          },
          {
            key: 'answer',
            label: '정답',
            children: question.content.answer
          }
        ]}
      />
    );
  }

  if (question.content.kind === '53') {
    return (
      <Descriptions
        bordered
        size="small"
        column={1}
        items={[
          {
            key: 'chartTitle',
            label: '자료 제목',
            children: question.content.chartTitle
          },
          {
            key: 'sourceSummary',
            label: '자료 설명',
            children: question.content.sourceSummary
          },
          {
            key: 'keyFigures',
            label: '핵심 수치',
            children: (
              <ul style={{ margin: 0, paddingLeft: 20 }}>
                {question.content.keyFigures.map((figure) => (
                  <li key={figure}>{figure}</li>
                ))}
              </ul>
            )
          }
        ]}
      />
    );
  }

  return (
    <Descriptions
      bordered
      size="small"
      column={1}
      items={[
        {
          key: 'topicPrompt',
          label: '논제',
          children: question.content.topicPrompt
        },
        {
          key: 'conditionLines',
          label: '조건 줄',
          children: (
            <ul style={{ margin: 0, paddingLeft: 20 }}>
              {question.content.conditionLines.map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ul>
          )
        },
        {
          key: 'outlineGuide',
          label: '개요 가이드',
          children: question.content.outlineGuide
        }
      ]}
    />
  );
}

export default function AssessmentQuestionBankPage(): JSX.Element {
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
  const [actionState, setActionState] = useState<ManageActionState>(null);
  const [notificationApi, notificationContextHolder] =
    notification.useNotification();

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
  const selectedId = parseSelectedId(searchParams.get('selected'));
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
      difficulty: draftDifficultyFilter,
      selected: null
    });
  }, [
    commitParams,
    draftDifficultyFilter,
    draftDomainFilter,
    draftQuestionTypeFilter
  ]);

  const hasCachedQuestions = questionsState.data.length > 0;

  const selectedQuestion = useMemo(
    () =>
      questionsState.data.find((question) => question.questionId === selectedId) ??
      null,
    [questionsState.data, selectedId]
  );

  useEffect(() => {
    if (
      !selectedId ||
      selectedQuestion ||
      questionsState.status === 'pending'
    ) {
      return;
    }

    commitParams({ selected: null });
  }, [commitParams, questionsState.status, selectedId, selectedQuestion]);

  const syncUpdatedQuestion = useCallback((updatedQuestion: AssessmentQuestion) => {
    setQuestionsState((prev) => {
      const nextData = prev.data.map((question) =>
        question.questionId === updatedQuestion.questionId ? updatedQuestion : question
      );

      return {
        status: nextData.length === 0 ? 'empty' : 'success',
        data: nextData,
        errorMessage: null,
        errorCode: null
      };
    });
  }, []);

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
            : nextQuestionNumbers,
        selected: null
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

  const openDrawer = useCallback(
    (questionId: string) => {
      commitParams({ selected: questionId });
    },
    [commitParams]
  );

  const closeDrawer = useCallback(() => {
    commitParams({ selected: null });
  }, [commitParams]);

  const openReviewPage = useCallback(
    (questionId: string) => {
      navigate(buildReviewPageHref(questionId, searchParams));
    },
    [navigate, searchParams]
  );

  const triggerOperationAction = useCallback(
    (
      question: AssessmentQuestion,
      nextStatus: AssessmentQuestionOperationStatus
    ) => {
      setActionState({
        question,
        nextStatus
      });
    },
    []
  );

  const handleConfirmAction = useCallback(
    async (reason: string) => {
      if (!actionState) {
        return;
      }

      const actionCopy = getOperationActionCopy(actionState.nextStatus);
      const result = await updateAssessmentQuestionOperationStatusSafe({
        questionId: actionState.question.questionId,
        nextStatus: actionState.nextStatus,
        reason
      });

      if (!result.ok) {
        notificationApi.error({
          message: '운영 상태를 변경하지 못했습니다.',
          description: result.error.message
        });
        return;
      }

      syncUpdatedQuestion(result.data);
      notificationApi.success({
        message: actionCopy.successMessage,
        description: (
          <Space direction="vertical" size={4}>
            <Text>대상 유형: AssessmentQuestion</Text>
            <Text>대상 ID: {result.data.questionId}</Text>
            <AuditLogLink
              targetType="AssessmentQuestion"
              targetId={result.data.questionId}
            />
          </Space>
        )
      });

      setActionState(null);
    },
    [actionState, notificationApi, syncUpdatedQuestion]
  );

  const reviewColumns = useMemo<TableColumnsType<AssessmentQuestion>>(
    () => [
      {
        title: '문항 ID',
        dataIndex: 'questionId',
        width: 130,
        sorter: createTextSorter((record) => record.questionId)
      },
      {
        title: '도메인 / 유형',
        key: 'topicAndMeta',
        width: 280,
        sorter: createTextSorter(
          (record) =>
            `${record.topic} ${record.domain} ${record.questionTypeLabel} ${record.difficultyLevel}`
        ),
        render: (_, record) => (
          <Space direction="vertical" size={2}>
            <Text strong>{record.topic}</Text>
            <Text type="secondary">
              {record.domain} · {record.questionTypeLabel} · 난이도{' '}
              {record.difficultyLevel}
            </Text>
          </Space>
        )
      },
      {
        title: '문항 미리보기',
        key: 'preview',
        sorter: createTextSorter((record) => getQuestionPreviewText(record)),
        render: (_, record) => renderPreviewParagraph(getQuestionPreviewText(record))
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
        title: '자동 점검',
        key: 'validation',
        width: 160,
        sorter: createTextSorter((record) => record.validationStatus),
        render: (_, record) => (
          <Space direction="vertical" size={2}>
            <Tag color={getValidationStatusColor(record.validationStatus)}>
              {record.validationStatus}
            </Tag>
            <Text type="secondary">신호 {record.validationSignals.length}건</Text>
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
      },
      {
        title: '액션',
        key: 'actions',
        width: 120,
        onCell: () => ({
          onClick: (event) => {
            event.stopPropagation();
          }
        }),
        render: (_, record) => (
          <TableActionMenu
            items={[
              {
                key: `review-page-${record.questionId}`,
                label: '검수 페이지 열기',
                onClick: () => openReviewPage(record.questionId)
              },
              {
                key: `review-drawer-${record.questionId}`,
                label: '빠른 상세 보기',
                onClick: () => openDrawer(record.questionId)
              }
            ]}
          />
        )
      }
    ],
    [openDrawer, openReviewPage]
  );

  const manageColumns = useMemo<TableColumnsType<AssessmentQuestion>>(
    () => [
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
      },
      {
        title: '액션',
        key: 'actions',
        width: 120,
        onCell: () => ({
          onClick: (event) => {
            event.stopPropagation();
          }
        }),
        render: (_, record) => (
          <TableActionMenu
            items={[
              {
                key: `manage-review-page-${record.questionId}`,
                label: '검수 페이지 열기',
                onClick: () => openReviewPage(record.questionId)
              },
              {
                key: `manage-drawer-${record.questionId}`,
                label: '빠른 상세 보기',
                onClick: () => openDrawer(record.questionId)
              },
              {
                key: `manage-expose-${record.questionId}`,
                label: '노출 후보',
                disabled: record.operationStatus === '노출 후보',
                onClick: () => triggerOperationAction(record, '노출 후보')
              }
            ]}
            footerItems={[
              {
                key: `manage-hide-${record.questionId}`,
                label: '숨김 후보',
                danger: true,
                disabled: record.operationStatus === '숨김 후보',
                onClick: () => triggerOperationAction(record, '숨김 후보')
              },
              {
                key: `manage-exclude-${record.questionId}`,
                label: '운영 제외',
                danger: true,
                disabled: record.operationStatus === '운영 제외',
                onClick: () => triggerOperationAction(record, '운영 제외')
              }
            ]}
          />
        )
      }
    ],
    [openDrawer, openReviewPage, triggerOperationAction]
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
            operationStatus: null,
            selected: null
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
            keyword: event.target.value || null,
            selected: null
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

  const drawerHeaderMeta = selectedQuestion ? (
    <Space wrap size={[8, 8]}>
      <Tag color={getReviewStatusColor(selectedQuestion.reviewStatus)}>
        {selectedQuestion.reviewStatus}
      </Tag>
      <Tag color={getOperationStatusColor(selectedQuestion.operationStatus)}>
        {selectedQuestion.operationStatus}
      </Tag>
      <Tag color={getValidationStatusColor(selectedQuestion.validationStatus)}>
        {selectedQuestion.validationStatus}
      </Tag>
    </Space>
  ) : null;

  const drawerFooterStart = selectedQuestion ? (
    <Space wrap size={12}>
      <AuditLogLink
        targetType="AssessmentQuestion"
        targetId={selectedQuestion.questionId}
      />
      <Button size="large" onClick={() => openReviewPage(selectedQuestion.questionId)}>
        검수 페이지로 이동
      </Button>
    </Space>
  ) : null;

  const drawerFooterEnd =
    activeTab === 'manage' && selectedQuestion ? (
      <Space wrap size={8}>
        <Button
          size="large"
          type="primary"
          disabled={selectedQuestion.operationStatus === '노출 후보'}
          onClick={() => triggerOperationAction(selectedQuestion, '노출 후보')}
        >
          노출 후보
        </Button>
        <Button
          size="large"
          danger
          disabled={selectedQuestion.operationStatus === '숨김 후보'}
          onClick={() => triggerOperationAction(selectedQuestion, '숨김 후보')}
        >
          숨김 후보
        </Button>
        <Button
          size="large"
          danger
          disabled={selectedQuestion.operationStatus === '운영 제외'}
          onClick={() => triggerOperationAction(selectedQuestion, '운영 제외')}
        >
          운영 제외
        </Button>
      </Space>
    ) : null;

  const actionCopy = actionState
    ? getOperationActionCopy(actionState.nextStatus)
    : null;

  return (
    <>
      {notificationContextHolder}
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
              columns={activeColumns}
              dataSource={filteredQuestions}
              onRow={(record) => ({
                onClick: () => {
                  if (activeTab === 'review') {
                    openReviewPage(record.questionId);
                    return;
                  }

                  openDrawer(record.questionId);
                },
                style: { cursor: 'pointer' }
              })}
            />
          )}
        </AdminListCard>

        <DetailDrawer
          open={Boolean(selectedQuestion)}
          onClose={closeDrawer}
          destroyOnHidden
          width={760}
          title={
            selectedQuestion
              ? `TOPIK ${selectedQuestion.questionNumber}번 문항 · ${selectedQuestion.questionId}`
              : '문항 상세'
          }
          headerMeta={drawerHeaderMeta}
          footerStart={drawerFooterStart}
          footerEnd={drawerFooterEnd}
        >
          {selectedQuestion ? (
            <DetailDrawerBody>
              <Alert
                type={activeTab === 'review' ? 'info' : 'warning'}
                showIcon
                message={activeTab === 'review' ? '빠른 상세 보기' : '운영 관리 상세'}
                description={
                  activeTab === 'review'
                    ? '실제 검수 조치는 2depth 검수 페이지에서 진행합니다. 이 Drawer는 문항 구조와 메모를 빠르게 확인하는 용도입니다.'
                    : '운영 상태 변경 전, 문항의 핵심 의미와 최근 수정 이력, 검수 메모를 한 번 더 확인합니다.'
                }
              />

              <DetailDrawerSection title="기본 정보">
                <Descriptions
                  bordered
                  size="small"
                  column={1}
                  items={[
                    {
                      key: 'topic',
                      label: '주제',
                      children: selectedQuestion.topic
                    },
                    {
                      key: 'questionNumber',
                      label: '문제 번호',
                      children: `TOPIK ${selectedQuestion.questionNumber}번`
                    },
                    {
                      key: 'domain',
                      label: '도메인 / 유형',
                      children: `${selectedQuestion.domain} · ${selectedQuestion.questionTypeLabel}`
                    },
                    {
                      key: 'difficulty',
                      label: '난이도',
                      children: selectedQuestion.difficultyLevel
                    },
                    {
                      key: 'generatedAt',
                      label: '생성 시각',
                      children: selectedQuestion.generatedAt
                    },
                    {
                      key: 'updatedAt',
                      label: '최근 수정',
                      children: `${selectedQuestion.updatedAt} · ${selectedQuestion.updatedBy}`
                    }
                  ]}
                />
              </DetailDrawerSection>

              <DetailDrawerSection title="출처 / 상태">
                <Descriptions
                  bordered
                  size="small"
                  column={1}
                  items={[
                    {
                      key: 'source',
                      label: '출처',
                      children: getQuestionSourceSummary(selectedQuestion)
                    },
                    {
                      key: 'reviewStatus',
                      label: '검수 상태',
                      children: (
                        <Tag color={getReviewStatusColor(selectedQuestion.reviewStatus)}>
                          {selectedQuestion.reviewStatus}
                        </Tag>
                      )
                    },
                    {
                      key: 'operationStatus',
                      label: '운영 상태',
                      children: (
                        <Tag
                          color={getOperationStatusColor(
                            selectedQuestion.operationStatus
                          )}
                        >
                          {selectedQuestion.operationStatus}
                        </Tag>
                      )
                    },
                    {
                      key: 'validationStatus',
                      label: '자동 점검',
                      children: (
                        <Space direction="vertical" size={4}>
                          <Tag
                            color={getValidationStatusColor(
                              selectedQuestion.validationStatus
                            )}
                          >
                            {selectedQuestion.validationStatus}
                          </Tag>
                          <Text type="secondary">
                            신호 {selectedQuestion.validationSignals.length}건
                          </Text>
                        </Space>
                      )
                    }
                  ]}
                />
              </DetailDrawerSection>

              <DetailDrawerSection title="문항 핵심 요약">
                <Space direction="vertical" size={16} style={{ width: '100%' }}>
                  <div>
                    <Text strong>{getQuestionInstructionLabel(selectedQuestion)}</Text>
                    <Paragraph style={{ marginTop: 8, marginBottom: 0 }}>
                      {getQuestionInstructionText(selectedQuestion)}
                    </Paragraph>
                  </div>
                  <Descriptions
                    bordered
                    size="small"
                    column={1}
                    items={[
                      {
                        key: 'coreMeaning',
                        label: '핵심 의미',
                        children: selectedQuestion.coreMeaning
                      },
                      {
                        key: 'keyIssue',
                        label: '핵심 문제',
                        children: selectedQuestion.keyIssue
                      }
                    ]}
                  />
                  {renderDrawerSpecificSummary(selectedQuestion)}
                </Space>
              </DetailDrawerSection>

              <DetailDrawerSection title="모범답안 · 메모 · 사용 현황">
                <Descriptions
                  bordered
                  size="small"
                  column={1}
                  items={[
                    {
                      key: 'modelAnswer',
                      label: '모범답안',
                      children: selectedQuestion.modelAnswer
                    },
                    {
                      key: 'reviewMemo',
                      label: '검수 메모',
                      children: selectedQuestion.reviewMemo || '저장된 검수 메모가 없습니다.'
                    },
                    {
                      key: 'managementNote',
                      label: '운영 메모',
                      children:
                        selectedQuestion.managementNote || '등록된 운영 메모가 없습니다.'
                    },
                    {
                      key: 'usage',
                      label: '사용 현황',
                      children: getQuestionUsageSummary(selectedQuestion)
                    }
                  ]}
                />
                <Collapse
                  className="assessment-review-page__collapse"
                  items={[
                    {
                      key: 'scoring-criteria',
                      label: '채점 기준',
                      children: (
                        <ul className="assessment-review-page__list">
                          {selectedQuestion.scoringCriteria.map((criterion) => (
                            <li key={criterion}>{criterion}</li>
                          ))}
                        </ul>
                      )
                    },
                    {
                      key: 'revision-history',
                      label: '수정 히스토리',
                      children: (
                        <ul className="assessment-review-page__list">
                          {selectedQuestion.revisionHistory.map((item) => (
                            <li key={item.id}>
                              <Text strong>{item.summary}</Text>
                              <br />
                              <Text type="secondary">
                                {item.changedAt} · {item.changedBy}
                              </Text>
                            </li>
                          ))}
                        </ul>
                      )
                    },
                    {
                      key: 'validation-signals',
                      label: '자동 점검 신호',
                      children: (
                        <ul className="assessment-review-page__list">
                          {selectedQuestion.validationSignals.map((signal) => (
                            <li key={signal}>{signal}</li>
                          ))}
                        </ul>
                      )
                    }
                  ]}
                />
              </DetailDrawerSection>
            </DetailDrawerBody>
          ) : null}
        </DetailDrawer>

        {actionState && actionCopy ? (
          <ConfirmAction
            open
            title={actionCopy.title}
            description={actionCopy.description}
            targetType="AssessmentQuestion"
            targetId={actionState.question.questionId}
            confirmText={actionCopy.confirmText}
            reasonPlaceholder={actionCopy.reasonPlaceholder}
            onCancel={() => setActionState(null)}
            onConfirm={handleConfirmAction}
          />
        ) : null}
      </div>
    </>
  );
}
