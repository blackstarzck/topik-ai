import {
  Alert,
  Button,
  Card,
  Descriptions,
  Empty,
  Select,
  Space,
  Tabs,
  Tag,
  Typography,
  notification
} from 'antd';
import type { TableColumnsType } from 'antd';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';

import {
  fetchAssessmentQuestionsSafe,
  updateAssessmentQuestionOperationStatusSafe,
  updateAssessmentQuestionReviewStatusSafe
} from '../api/assessment-question-bank-service';
import {
  assessmentQuestionBankTabItems,
  assessmentQuestionNumberTabItems,
  assessmentQuestionOperationStatuses,
  assessmentQuestionReviewStatuses,
  getOperationStatusColor,
  getReviewStatusColor,
  getValidationStatusColor,
  manageSearchFieldOptions,
  parseAssessmentQuestionBankTab,
  parseAssessmentQuestionNumber,
  parseAssessmentQuestionOperationStatus,
  parseAssessmentQuestionReviewStatus,
  reviewSearchFieldOptions
} from '../model/assessment-question-bank-schema';
import type {
  AssessmentQuestion,
  AssessmentQuestionBankTab,
  AssessmentQuestionOperationStatus,
  AssessmentQuestionReviewStatus
} from '../model/assessment-question-bank-types';
import type { AsyncState } from '../../../shared/model/async-state';
import { getTargetTypeLabel } from '../../../shared/model/target-type-label';
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
  SearchBarDateRange,
  SearchBarDetailField
} from '../../../shared/ui/search-bar/search-bar';
import {
  matchesSearchDateRange,
  matchesSearchField,
  parseSearchDate
} from '../../../shared/ui/search-bar/search-bar-utils';
import { useSearchBarDateDraft } from '../../../shared/ui/search-bar/use-search-bar-date-draft';
import { AdminDataTable } from '../../../shared/ui/table/admin-data-table';
import {
  createNumberSorter,
  createTextSorter
} from '../../../shared/ui/table/table-column-utils';
import { TableActionMenu } from '../../../shared/ui/table/table-action-menu';

const { Paragraph, Text } = Typography;

type AssessmentQuestionSearchField =
  | 'all'
  | 'questionId'
  | 'generationBatchId'
  | 'topic'
  | 'promptVersion'
  | 'updatedBy'
  | 'managementNote';

type QuestionActionState =
  | {
      kind: 'review';
      question: AssessmentQuestion;
      nextStatus: AssessmentQuestionReviewStatus;
    }
  | {
      kind: 'manage';
      question: AssessmentQuestion;
      nextStatus: AssessmentQuestionOperationStatus;
    }
  | null;

type QuestionActionCopy = {
  title: string;
  description: string;
  confirmText: string;
  successMessage: string;
  reasonPlaceholder: string;
};

function parseSearchField(
  tab: AssessmentQuestionBankTab,
  value: string | null
): AssessmentQuestionSearchField {
  const options =
    tab === 'manage' ? manageSearchFieldOptions : reviewSearchFieldOptions;

  if (options.some((option) => option.value === value)) {
    return value as AssessmentQuestionSearchField;
  }

  return 'all';
}

function parseSelectedId(value: string | null): string {
  return value?.trim() ?? '';
}

function formatDateForFilter(
  question: AssessmentQuestion,
  tab: AssessmentQuestionBankTab
): string {
  return tab === 'review' ? question.generatedAt : question.updatedAt;
}

function getQuestionPreviewText(question: AssessmentQuestion): string {
  if (question.content.kind === '51' || question.content.kind === '52') {
    return question.content.learnerPrompt;
  }

  if (question.content.kind === '53') {
    return `${question.content.chartTitle} · ${question.content.sourceSummary}`;
  }

  return question.content.topicPrompt;
}

function getQuestionUsageSummary(question: AssessmentQuestion): string {
  return `사용 ${question.usageCount}회 / 시험 연결 ${question.linkedExamCount}건`;
}

function getActionCopy(actionState: QuestionActionState): QuestionActionCopy {
  if (!actionState) {
    return {
      title: '',
      description: '',
      confirmText: '',
      successMessage: '',
      reasonPlaceholder: ''
    };
  }

  if (actionState.kind === 'review') {
    if (actionState.nextStatus === '검수 완료') {
      return {
        title: '검수 완료 처리',
        description:
          '이 문항을 검수 완료로 전환합니다. 이후 운영 상태는 문항 관리 탭에서 별도로 관리합니다.',
        confirmText: '검수 완료',
        successMessage: '검수 완료 처리되었습니다.',
        reasonPlaceholder: '검수 완료 근거를 입력해 주세요.'
      };
    }

    if (actionState.nextStatus === '보류') {
      return {
        title: '보류 처리',
        description:
          '이 문항을 보류 상태로 전환합니다. 보류 사유를 남겨 후속 재검토 근거를 유지하세요.',
        confirmText: '보류',
        successMessage: '보류 처리되었습니다.',
        reasonPlaceholder: '보류 사유를 입력해 주세요.'
      };
    }

    return {
      title: '수정 필요 처리',
      description:
        '이 문항을 수정 필요 상태로 전환합니다. AI 재생성 또는 수동 수정 판단 근거를 남겨야 합니다.',
      confirmText: '수정 필요',
      successMessage: '수정 필요 처리되었습니다.',
      reasonPlaceholder: '수정 필요 사유를 입력해 주세요.'
    };
  }

  if (actionState.nextStatus === '노출 후보') {
    return {
      title: '노출 후보 지정',
      description:
        '이 문항을 노출 후보로 지정합니다. 실제 시험 연결 여부는 별도 편성 정책에 따릅니다.',
      confirmText: '노출 후보',
      successMessage: '노출 후보로 지정되었습니다.',
      reasonPlaceholder: '노출 후보 판단 근거를 입력해 주세요.'
    };
  }

  if (actionState.nextStatus === '숨김 후보') {
    return {
      title: '숨김 후보 지정',
      description:
        '이 문항을 숨김 후보로 전환합니다. 숨김 후보는 품질은 통과했지만 우선순위가 낮은 문항을 관리하기 위한 상태입니다.',
      confirmText: '숨김 후보',
      successMessage: '숨김 후보로 지정되었습니다.',
      reasonPlaceholder: '숨김 후보 사유를 입력해 주세요.'
    };
  }

  return {
    title: '운영 제외 처리',
    description:
      '이 문항을 운영 제외 상태로 전환합니다. 운영 제외는 복구 가능하지만 현재 회차 운영 대상에서는 빠집니다.',
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

function renderQuestionPreviewCard(question: AssessmentQuestion): JSX.Element {
  if (question.content.kind === '51' || question.content.kind === '52') {
    return (
      <Space direction="vertical" size={12} style={{ width: '100%' }}>
        <Text strong>{question.content.instruction}</Text>
        <Paragraph style={{ marginBottom: 0 }}>
          {question.content.learnerPrompt}
        </Paragraph>
        <Card size="small" title="보기">
          <ol style={{ margin: 0, paddingLeft: 20 }}>
            {question.content.choices.map((choice) => (
              <li key={choice}>
                <Text>{choice}</Text>
              </li>
            ))}
          </ol>
        </Card>
        <Text type="secondary">정답: {question.content.answer}</Text>
      </Space>
    );
  }

  if (question.content.kind === '53') {
    return (
      <Space direction="vertical" size={12} style={{ width: '100%' }}>
        <Text strong>{question.content.learnerPrompt}</Text>
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
              label: '자료 요약',
              children: question.content.sourceSummary
            },
            {
              key: 'answerGuide',
              label: '답안 가이드',
              children: question.content.answerGuide
            }
          ]}
        />
        <Card size="small" title="핵심 수치">
          <Space direction="vertical" size={8}>
            {question.content.keyFigures.map((figure) => (
              <Text key={figure}>{figure}</Text>
            ))}
          </Space>
        </Card>
      </Space>
    );
  }

  return (
    <Space direction="vertical" size={12} style={{ width: '100%' }}>
      <Text strong>{question.content.learnerPrompt}</Text>
      <Descriptions
        bordered
        size="small"
        column={1}
        items={[
          {
            key: 'topicPrompt',
            label: '주제',
            children: question.content.topicPrompt
          },
          {
            key: 'outlineGuide',
            label: '개요 가이드',
            children: question.content.outlineGuide
          }
        ]}
      />
      <Card size="small" title="조건 줄">
        <Space direction="vertical" size={8}>
          {question.content.conditionLines.map((line) => (
            <Text key={line}>{line}</Text>
          ))}
        </Space>
      </Card>
    </Space>
  );
}

export default function AssessmentQuestionBankPage(): JSX.Element {
  const [searchParams, setSearchParams] = useSearchParams();
  const [questionsState, setQuestionsState] = useState<
    AsyncState<AssessmentQuestion[]>
  >({
    status: 'pending',
    data: [],
    errorMessage: null,
    errorCode: null
  });
  const [reloadKey, setReloadKey] = useState(0);
  const [actionState, setActionState] = useState<QuestionActionState>(null);
  const [notificationApi, notificationContextHolder] =
    notification.useNotification();
  const activeTab = parseAssessmentQuestionBankTab(searchParams.get('tab'));
  const activeQuestionNumber = parseAssessmentQuestionNumber(
    searchParams.get('questionNo')
  );
  const searchField = parseSearchField(activeTab, searchParams.get('searchField'));
  const keyword = searchParams.get('keyword') ?? '';
  const startDate = parseSearchDate(searchParams.get('startDate'));
  const endDate = parseSearchDate(searchParams.get('endDate'));
  const selectedId = parseSelectedId(searchParams.get('selected'));
  const reviewStatusFilter = parseAssessmentQuestionReviewStatus(
    searchParams.get('reviewStatus')
  );
  const operationStatusFilter = parseAssessmentQuestionOperationStatus(
    searchParams.get('operationStatus')
  );
  const {
    draftStartDate,
    draftEndDate,
    handleDraftDateChange,
    handleDraftReset,
    handleDetailOpenChange
  } = useSearchBarDateDraft(startDate, endDate);

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

      if (result.ok) {
        setQuestionsState({
          status: result.data.length === 0 ? 'empty' : 'success',
          data: result.data,
          errorMessage: null,
          errorCode: null
        });
        return;
      }

      setQuestionsState((prev) => ({
        ...prev,
        status: 'error',
        errorMessage: result.error.message,
        errorCode: result.error.code
      }));
    });

    return () => {
      controller.abort();
    };
  }, [reloadKey]);

  const commitParams = useCallback(
    (
      next: Partial<
        Record<
          | 'tab'
          | 'questionNo'
          | 'searchField'
          | 'keyword'
          | 'startDate'
          | 'endDate'
          | 'reviewStatus'
          | 'operationStatus'
          | 'selected',
          string | null
        >
      >
    ) => {
      const merged = new URLSearchParams(searchParams);

      Object.entries(next).forEach(([key, value]) => {
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

  const currentNumberQuestions = useMemo(
    () =>
      questionsState.data.filter(
        (question) => question.questionNumber === activeQuestionNumber
      ),
    [activeQuestionNumber, questionsState.data]
  );

  const filteredQuestions = useMemo(() => {
    const normalizedKeyword = keyword.trim().toLowerCase();

    return currentNumberQuestions.filter((question) => {
      if (
        !matchesSearchDateRange(
          formatDateForFilter(question, activeTab),
          startDate,
          endDate
        )
      ) {
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

      return matchesSearchField(normalizedKeyword, searchField, {
        questionId: question.questionId,
        generationBatchId: question.generationBatchId,
        topic: question.topic,
        promptVersion: question.promptVersion,
        updatedBy: question.updatedBy,
        managementNote: question.managementNote,
        generationModel: question.generationModel,
        preview: getQuestionPreviewText(question),
        reviewMemo: question.reviewMemo
      });
    });
  }, [
    activeTab,
    currentNumberQuestions,
    endDate,
    keyword,
    operationStatusFilter,
    reviewStatusFilter,
    searchField,
    startDate
  ]);

  const summaryItems = useMemo(() => {
    if (activeTab === 'review') {
      const pendingCount = currentNumberQuestions.filter(
        (question) => question.reviewStatus === '검수 대기'
      ).length;
      const completedCount = currentNumberQuestions.filter(
        (question) => question.reviewStatus === '검수 완료'
      ).length;
      const holdCount = currentNumberQuestions.filter(
        (question) =>
          question.reviewStatus === '보류' ||
          question.reviewStatus === '수정 필요'
      ).length;

      return [
        {
          key: 'review-total',
          label: `${activeQuestionNumber}번 전체`,
          value: `${currentNumberQuestions.length.toLocaleString()}문항`
        },
        {
          key: 'review-pending',
          label: '검수 대기',
          value: `${pendingCount.toLocaleString()}문항`
        },
        {
          key: 'review-completed',
          label: '검수 완료',
          value: `${completedCount.toLocaleString()}문항`
        },
        {
          key: 'review-hold',
          label: '보류 / 수정 필요',
          value: `${holdCount.toLocaleString()}문항`
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
        label: `${activeQuestionNumber}번 전체`,
        value: `${currentNumberQuestions.length.toLocaleString()}문항`
      },
      {
        key: 'manage-expose',
        label: '노출 후보',
        value: `${candidateExposeCount.toLocaleString()}문항`
      },
      {
        key: 'manage-hide',
        label: '숨김 후보',
        value: `${candidateHideCount.toLocaleString()}문항`
      },
      {
        key: 'manage-excluded',
        label: '운영 제외',
        value: `${excludedCount.toLocaleString()}문항`
      }
    ];
  }, [activeQuestionNumber, activeTab, currentNumberQuestions]);

  const handleResetFilters = useCallback(() => {
    handleDraftReset();
    commitParams({
      startDate: null,
      endDate: null,
      reviewStatus: null,
      operationStatus: null
    });
  }, [commitParams, handleDraftReset]);

  const handleApplyDateRange = useCallback(() => {
    commitParams({
      startDate: draftStartDate || null,
      endDate: draftEndDate || null
    });
  }, [commitParams, draftEndDate, draftStartDate]);

  const openQuestionDetail = useCallback(
    (questionId: string) => {
      commitParams({ selected: questionId });
    },
    [commitParams]
  );

  const closeQuestionDetail = useCallback(() => {
    commitParams({ selected: null });
  }, [commitParams]);

  const triggerReviewAction = useCallback(
    (
      question: AssessmentQuestion,
      nextStatus: AssessmentQuestionReviewStatus
    ) => {
      setActionState({
        kind: 'review',
        question,
        nextStatus
      });
    },
    []
  );

  const triggerOperationAction = useCallback(
    (
      question: AssessmentQuestion,
      nextStatus: AssessmentQuestionOperationStatus
    ) => {
      setActionState({
        kind: 'manage',
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

      const actionCopy = getActionCopy(actionState);
      const result =
        actionState.kind === 'review'
          ? await updateAssessmentQuestionReviewStatusSafe({
              questionId: actionState.question.questionId,
              nextStatus: actionState.nextStatus,
              reason
            })
          : await updateAssessmentQuestionOperationStatusSafe({
              questionId: actionState.question.questionId,
              nextStatus: actionState.nextStatus,
              reason
            });

      if (!result.ok) {
        notificationApi.error({
          message: '문항 상태를 저장하지 못했습니다.',
          description: result.error.message
        });
        return;
      }

      setQuestionsState((prev) => {
        const nextData = prev.data.map((question) =>
          question.questionId === result.data.questionId ? result.data : question
        );

        return {
          ...prev,
          data: nextData,
          status: nextData.length === 0 ? 'empty' : 'success'
        };
      });

      notificationApi.success({
        message: actionCopy.successMessage,
        description: (
          <Space direction="vertical" size={4}>
            <Text>대상 유형: {getTargetTypeLabel('AssessmentQuestion')}</Text>
            <Text>대상 ID: {result.data.questionId}</Text>
            <Text>사유/근거: {reason}</Text>
            <AuditLogLink
              targetType="AssessmentQuestion"
              targetId={result.data.questionId}
            />
          </Space>
        )
      });

      setActionState(null);
    },
    [actionState, notificationApi]
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
        title: '토픽 / 생성 배치',
        key: 'topicAndBatch',
        width: 260,
        sorter: createTextSorter(
          (record) => `${record.topic} ${record.generationBatchId}`
        ),
        render: (_, record) => (
          <Space direction="vertical" size={2}>
            <Text strong>{record.topic}</Text>
            <Text type="secondary">
              {record.generationBatchId} · {record.promptVersion}
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
        title: '검수 상태',
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
            <Text type="secondary">
              신호 {record.validationSignals.length}건
            </Text>
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
                key: `review-complete-${record.questionId}`,
                label: '검수 완료',
                disabled: record.reviewStatus === '검수 완료',
                onClick: () => triggerReviewAction(record, '검수 완료')
              },
              {
                key: `review-hold-${record.questionId}`,
                label: '보류',
                disabled: record.reviewStatus === '보류',
                onClick: () => triggerReviewAction(record, '보류')
              }
            ]}
            footerItems={[
              {
                key: `review-revise-${record.questionId}`,
                label: '수정 필요',
                danger: true,
                disabled: record.reviewStatus === '수정 필요',
                onClick: () => triggerReviewAction(record, '수정 필요')
              }
            ]}
          />
        )
      }
    ],
    [triggerReviewAction]
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
        title: '토픽',
        dataIndex: 'topic',
        width: 240,
        sorter: createTextSorter((record) => record.topic)
      },
      {
        title: '검수 상태',
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
        width: 170,
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
    [triggerOperationAction]
  );

  const toolbar = (
    <Space direction="vertical" size={16} style={{ width: '100%' }}>
      <Tabs
        activeKey={activeTab}
        items={assessmentQuestionBankTabItems}
        onChange={(value) => {
          commitParams({
            tab: value,
            questionNo: activeQuestionNumber,
            searchField: 'all',
            keyword: null,
            startDate: null,
            endDate: null,
            reviewStatus: null,
            operationStatus: null,
            selected: null
          });
        }}
      />
      <Tabs
        activeKey={activeQuestionNumber}
        items={assessmentQuestionNumberTabItems}
        onChange={(value) => {
          commitParams({
            questionNo: value,
            searchField: 'all',
            keyword: null,
            startDate: null,
            endDate: null,
            reviewStatus: null,
            operationStatus: null,
            selected: null
          });
        }}
      />
      <SearchBar
        searchField={searchField}
        searchFieldOptions={
          activeTab === 'manage' ? [...manageSearchFieldOptions] : [...reviewSearchFieldOptions]
        }
        keyword={keyword}
        keywordPlaceholder={
          activeTab === 'review'
            ? '문항 ID, 배치 ID, 토픽을 검색하세요.'
            : '문항 ID, 토픽, 운영 메모를 검색하세요.'
        }
        detailTitle="상세 필터"
        detailContent={
          <Space direction="vertical" size={12} style={{ width: 280 }}>
            <SearchBarDetailField label="날짜">
              <SearchBarDateRange
                startDate={draftStartDate}
                endDate={draftEndDate}
                onChange={handleDraftDateChange}
              />
            </SearchBarDetailField>
            <SearchBarDetailField label="검수 상태">
              <Select
                allowClear
                value={reviewStatusFilter ?? undefined}
                placeholder="검수 상태를 선택하세요."
                options={assessmentQuestionReviewStatuses.map((status) => ({
                  label: status,
                  value: status
                }))}
                onChange={(value) =>
                  commitParams({
                    reviewStatus: value ?? null
                  })
                }
              />
            </SearchBarDetailField>
            {activeTab === 'manage' ? (
              <SearchBarDetailField label="운영 상태">
                <Select
                  allowClear
                  value={operationStatusFilter ?? undefined}
                  placeholder="운영 상태를 선택하세요."
                  options={assessmentQuestionOperationStatuses.map((status) => ({
                    label: status,
                    value: status
                  }))}
                  onChange={(value) =>
                    commitParams({
                      operationStatus: value ?? null
                    })
                  }
                />
              </SearchBarDetailField>
            ) : null}
          </Space>
        }
        onSearchFieldChange={(value) =>
          commitParams({
            searchField: value
          })
        }
        onKeywordChange={(event) =>
          commitParams({
            keyword: event.target.value || null
          })
        }
        onApply={handleApplyDateRange}
        onDetailOpenChange={handleDetailOpenChange}
        onReset={handleResetFilters}
        summary={
          <Text type="secondary">
            현재 결과 {filteredQuestions.length.toLocaleString()}문항
          </Text>
        }
      />
    </Space>
  );

  const drawerFooterActions =
    selectedQuestion && activeTab === 'review' ? (
      <Space wrap>
        <Button
          size="large"
          onClick={() => triggerReviewAction(selectedQuestion, '보류')}
        >
          보류
        </Button>
        <Button
          size="large"
          onClick={() => triggerReviewAction(selectedQuestion, '검수 완료')}
        >
          검수 완료
        </Button>
        <Button
          size="large"
          danger
          onClick={() => triggerReviewAction(selectedQuestion, '수정 필요')}
        >
          수정 필요
        </Button>
      </Space>
    ) : selectedQuestion ? (
      <Space wrap>
        <Button
          size="large"
          onClick={() => triggerOperationAction(selectedQuestion, '노출 후보')}
        >
          노출 후보
        </Button>
        <Button
          size="large"
          onClick={() => triggerOperationAction(selectedQuestion, '숨김 후보')}
        >
          숨김 후보
        </Button>
        <Button
          size="large"
          danger
          onClick={() => triggerOperationAction(selectedQuestion, '운영 제외')}
        >
          운영 제외
        </Button>
      </Space>
    ) : null;
  const actionCopy = getActionCopy(actionState);

  return (
    <>
      {notificationContextHolder}
      <div>
        <PageTitle title="TOPIK 쓰기 문제은행" />
        <Paragraph type="secondary" style={{ marginBottom: 24 }}>
          서버 배치로 생성된 TOPIK 쓰기 51번부터 54번 문항을 빠르게 검수하고,
          검수 완료 문항의 운영 상태를 같은 페이지에서 관리합니다.
        </Paragraph>

        <ListSummaryCards items={summaryItems} />

        <AdminListCard toolbar={toolbar}>
          {questionsState.status === 'error' ? (
            <Alert
              type="error"
              showIcon
              style={{ marginBottom: 12 }}
              message="문항 목록을 불러오지 못했습니다."
              description={questionsState.errorMessage ?? ''}
              action={
                <Button
                  size="small"
                  onClick={() => setReloadKey((prev) => prev + 1)}
                >
                  다시 시도
                </Button>
              }
            />
          ) : null}

          {questionsState.status === 'pending' && hasCachedQuestions ? (
            <Alert
              type="info"
              showIcon
              style={{ marginBottom: 12 }}
              message="최신 문항을 다시 불러오는 중입니다."
            />
          ) : null}

          {questionsState.status === 'empty' ? (
            <Alert
              type="info"
              showIcon
              style={{ marginBottom: 12 }}
              message="등록된 문항이 없습니다."
              description="현재 배치에서 가져온 TOPIK 쓰기 문항이 없습니다."
            />
          ) : null}

          {questionsState.status !== 'pending' &&
          questionsState.status !== 'empty' &&
          filteredQuestions.length === 0 ? (
            <Alert
              type="info"
              showIcon
              style={{ marginBottom: 12 }}
              message="선택한 조건에 맞는 문항이 없습니다."
              description="문제 번호, 검수 상태, 날짜, 검색어를 조정해서 다시 확인해 주세요."
            />
          ) : null}

          {questionsState.status === 'error' && !hasCachedQuestions ? (
            <Empty
              description="문항 데이터를 불러오지 못했습니다."
              image={Empty.PRESENTED_IMAGE_SIMPLE}
            />
          ) : (
            <AdminDataTable<AssessmentQuestion>
              rowKey="questionId"
              pagination={false}
              scroll={{ x: 1320 }}
              loading={questionsState.status === 'pending' && !hasCachedQuestions}
              columns={activeTab === 'review' ? reviewColumns : manageColumns}
              dataSource={filteredQuestions}
              locale={{
                emptyText:
                  questionsState.status === 'empty'
                    ? '문항이 없습니다.'
                    : '검색 결과가 없습니다.'
              }}
              onRow={(record) => ({
                onClick: () => openQuestionDetail(record.questionId),
                style: { cursor: 'pointer' }
              })}
            />
          )}
        </AdminListCard>

        {actionState ? (
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

        <DetailDrawer
          open={Boolean(selectedQuestion)}
          title={
            selectedQuestion
              ? `TOPIK ${selectedQuestion.questionNumber}번 문항 · ${selectedQuestion.questionId}`
              : 'TOPIK 문항 상세'
          }
          destroyOnHidden
          width={760}
          onClose={closeQuestionDetail}
          headerMeta={
            selectedQuestion ? (
              <Space wrap size={8}>
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
            ) : null
          }
          footerStart={
            selectedQuestion ? (
              <AuditLogLink
                targetType="AssessmentQuestion"
                targetId={selectedQuestion.questionId}
              />
            ) : null
          }
          footerEnd={drawerFooterActions}
        >
          {selectedQuestion ? (
            <DetailDrawerBody>
              <Alert
                type={activeTab === 'review' ? 'info' : 'warning'}
                showIcon
                message={
                  activeTab === 'review'
                    ? '유형별 검수 포인트를 확인하고 상태를 결정하세요.'
                    : '검수 완료 문항의 운영 상태와 활용도를 함께 관리하세요.'
                }
                description={
                  activeTab === 'review'
                    ? '51/52번은 보기와 정답, 53번은 자료와 핵심 수치, 54번은 주제와 조건 줄을 중심으로 검수하면 됩니다.'
                    : '노출 후보, 숨김 후보, 운영 제외는 검수 상태와 별도로 관리되며 모든 조치는 감사 로그로 추적됩니다.'
                }
              />

              <DetailDrawerSection title="기본 정보">
                <Descriptions
                  bordered
                  size="small"
                  column={1}
                  items={[
                    {
                      key: 'questionId',
                      label: '문항 ID',
                      children: selectedQuestion.questionId
                    },
                    {
                      key: 'questionNumber',
                      label: '문제 번호',
                      children: `TOPIK 쓰기 ${selectedQuestion.questionNumber}번`
                    },
                    {
                      key: 'topic',
                      label: '토픽',
                      children: selectedQuestion.topic
                    },
                    {
                      key: 'source',
                      label: '생성 정보',
                      children: `${selectedQuestion.sourceType} · ${selectedQuestion.generationModel} · ${selectedQuestion.promptVersion}`
                    },
                    {
                      key: 'batch',
                      label: '배치 ID',
                      children: selectedQuestion.generationBatchId
                    },
                    {
                      key: 'reviewer',
                      label: '담당 검수자',
                      children: selectedQuestion.reviewerName
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

              <DetailDrawerSection title="문항 프리뷰">
                {renderQuestionPreviewCard(selectedQuestion)}
              </DetailDrawerSection>

              <DetailDrawerSection title="자동 점검 / 검수 포인트">
                <Space direction="vertical" size={12} style={{ width: '100%' }}>
                  <Card size="small" title="자동 점검 신호">
                    <Space direction="vertical" size={8}>
                      {selectedQuestion.validationSignals.map((signal) => (
                        <Text key={signal}>{signal}</Text>
                      ))}
                    </Space>
                  </Card>
                  <Card size="small" title="검수 포인트">
                    <Space direction="vertical" size={8}>
                      {selectedQuestion.content.reviewPoints.map((point) => (
                        <Text key={point}>{point}</Text>
                      ))}
                    </Space>
                  </Card>
                </Space>
              </DetailDrawerSection>

              <DetailDrawerSection title="검수 / 운영 메모">
                <Descriptions
                  bordered
                  size="small"
                  column={1}
                  items={[
                    {
                      key: 'reviewMemo',
                      label: '검수 메모',
                      children: selectedQuestion.reviewMemo || '등록된 검수 메모가 없습니다.'
                    },
                    {
                      key: 'managementNote',
                      label: '운영 메모',
                      children: selectedQuestion.managementNote || '등록된 운영 메모가 없습니다.'
                    },
                    {
                      key: 'usage',
                      label: '사용 현황',
                      children: getQuestionUsageSummary(selectedQuestion)
                    }
                  ]}
                />
              </DetailDrawerSection>
            </DetailDrawerBody>
          ) : null}
        </DetailDrawer>
      </div>
    </>
  );
}
