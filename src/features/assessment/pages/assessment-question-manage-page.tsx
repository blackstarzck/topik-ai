import {
  Alert,
  Button,
  Empty,
  Space,
  Tag,
  Typography,
  notification
} from 'antd';
import type { TableColumnsType } from 'antd';
import { useCallback, useMemo, useState } from 'react';

import { updateAssessmentQuestionOperationStatusSafe } from '../api/assessment-question-bank-service';
import { useAssessmentQuestionFilters } from '../model/use-assessment-question-filters';
import { useAssessmentQuestionList } from '../model/use-assessment-question-list';
import { AssessmentQuestionBankToolbar } from '../ui/assessment-question-bank-toolbar';
import {
  assessmentQuestionReviewStatuses,
  getOperationStatusColor,
  getReviewStatusColor,
  parseAssessmentQuestionOperationStatus
} from '../model/assessment-question-bank-schema';
import {
  applyCommonQuestionFilters,
  filterQuestionsByNumbers,
  getQuestionUsageSummary
} from '../model/assessment-question-bank-presenter';
import type {
  AssessmentQuestion,
  AssessmentQuestionNumber,
  AssessmentQuestionOperationStatus,
  AssessmentQuestionReviewStatus
} from '../model/assessment-question-bank-types';
import { getTargetTypeLabel } from '../../../shared/model/target-type-label';
import { AuditLogLink } from '../../../shared/ui/audit-log-link/audit-log-link';
import { ConfirmAction } from '../../../shared/ui/confirm-action/confirm-action';
import { AdminListCard } from '../../../shared/ui/list-page-card/admin-list-card';
import { ListSummaryCards } from '../../../shared/ui/list-summary-cards/list-summary-cards';
import { PageTitle } from '../../../shared/ui/page-title/page-title';
import { AdminDataTable } from '../../../shared/ui/table/admin-data-table';
import { createStatusColumnTitle } from '../../../shared/ui/table/status-column-title';
import {
  createNumberSorter,
  createTextSorter
} from '../../../shared/ui/table/table-column-utils';

const { Text } = Typography;

/**
 * Operation-status writes depend on v13 `lifecycle_status`, which is not applied
 * yet, so the audited write path (`admin_update_problem`) is disabled by the data
 * contract. This page ships the 운영 조치 UI scaffolded but inert: flip this flag
 * to `true` together with `updateOperationStatus` in the service once
 * `lifecycle_status` lands. Until then every row reads the `미지정` sentinel.
 */
const OPERATION_WRITE_ENABLED = false;

type OperationActionableStatus = Exclude<
  AssessmentQuestionOperationStatus,
  '미지정'
>;

type OperationActionState = {
  questionId: string;
  nextStatus: OperationActionableStatus;
} | null;

type OperationActionCopy = {
  title: string;
  description: string;
  confirmText: string;
  successMessage: string;
  reasonPlaceholder: string;
};

const OPERATION_ACTIONABLE_STATUSES: OperationActionableStatus[] = [
  '노출 후보',
  '숨김 후보',
  '운영 제외'
];

const OPERATION_ACTION_COPY_BY_STATUS: Record<
  OperationActionableStatus,
  OperationActionCopy
> = {
  '노출 후보': {
    title: '노출 후보 처리',
    description:
      '이 문항을 노출 후보로 전환합니다. 변경 사유는 감사 로그로 남습니다.',
    confirmText: '노출 후보',
    successMessage: '노출 후보로 변경했습니다.',
    reasonPlaceholder: '노출 후보 전환 사유를 입력해 주세요.'
  },
  '숨김 후보': {
    title: '숨김 후보 처리',
    description:
      '이 문항을 숨김 후보로 전환합니다. 변경 사유는 감사 로그로 남습니다.',
    confirmText: '숨김 후보',
    successMessage: '숨김 후보로 변경했습니다.',
    reasonPlaceholder: '숨김 후보 전환 사유를 입력해 주세요.'
  },
  '운영 제외': {
    title: '운영 제외 처리',
    description:
      '이 문항을 운영 제외로 전환합니다. 변경 사유는 감사 로그로 남습니다.',
    confirmText: '운영 제외',
    successMessage: '운영 제외로 변경했습니다.',
    reasonPlaceholder: '운영 제외 사유를 입력해 주세요.'
  }
};

export default function AssessmentQuestionManagePage(): JSX.Element {
  const filters = useAssessmentQuestionFilters();
  const { state, reload } = useAssessmentQuestionList();
  const [actionState, setActionState] = useState<OperationActionState>(null);
  const [notificationApi, notificationContextHolder] =
    notification.useNotification();

  const {
    searchParams,
    activeQuestionNumbers,
    domainFilter,
    questionTypeFilter,
    difficultyFilter,
    keyword,
    commitParams
  } = filters;

  const operationStatusFilter = parseAssessmentQuestionOperationStatus(
    searchParams.get('operationStatus')
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

    return operationStatusFilter
      ? common.filter(
          (question) => question.operationStatus === operationStatusFilter
        )
      : common;
  }, [
    currentNumberQuestions,
    difficultyFilter,
    domainFilter,
    keyword,
    operationStatusFilter,
    questionTypeFilter
  ]);

  const summaryItems = useMemo(() => {
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
        onClick: () => commitParams({ operationStatus: null })
      },
      {
        key: 'manage-expose',
        label: '노출 후보',
        value: `${candidateExposeCount.toLocaleString()}문항`,
        active: operationStatusFilter === '노출 후보',
        onClick: () => commitParams({ operationStatus: '노출 후보' })
      },
      {
        key: 'manage-hide',
        label: '숨김 후보',
        value: `${candidateHideCount.toLocaleString()}문항`,
        active: operationStatusFilter === '숨김 후보',
        onClick: () => commitParams({ operationStatus: '숨김 후보' })
      },
      {
        key: 'manage-excluded',
        label: '운영 제외',
        value: `${excludedCount.toLocaleString()}문항`,
        active: operationStatusFilter === '운영 제외',
        onClick: () => commitParams({ operationStatus: '운영 제외' })
      }
    ];
  }, [commitParams, currentNumberQuestions, operationStatusFilter]);

  const handleConfirmOperationAction = useCallback(
    async (reason: string) => {
      if (!actionState) {
        return;
      }

      const result = await updateAssessmentQuestionOperationStatusSafe({
        questionId: actionState.questionId,
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

      const { successMessage } =
        OPERATION_ACTION_COPY_BY_STATUS[actionState.nextStatus];
      const targetId = actionState.questionId;
      setActionState(null);
      reload();
      notificationApi.success({
        message: successMessage,
        description: (
          <Space direction="vertical" size={4}>
            <Text>대상 유형: {getTargetTypeLabel('AssessmentQuestion')}</Text>
            <Text>대상 ID: {targetId}</Text>
            <AuditLogLink targetType="AssessmentQuestion" targetId={targetId} />
          </Space>
        )
      });
    },
    [actionState, notificationApi, reload]
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
        title: '운영 조치',
        key: 'operationAction',
        width: 260,
        render: (_, record) => (
          <Space size={4} wrap>
            {OPERATION_ACTIONABLE_STATUSES.map((status) => (
              <Button
                key={status}
                size="small"
                disabled={!OPERATION_WRITE_ENABLED}
                onClick={() =>
                  setActionState({
                    questionId: record.questionId,
                    nextStatus: status
                  })
                }
              >
                {status}
              </Button>
            ))}
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

  const actionCopy = actionState
    ? OPERATION_ACTION_COPY_BY_STATUS[actionState.nextStatus]
    : null;

  return (
    <>
      {notificationContextHolder}
      <div>
        <PageTitle title="TOPIK 쓰기 문항 관리" />

        <ListSummaryCards items={summaryItems} />

        <AdminListCard
          toolbar={
            <AssessmentQuestionBankToolbar
              filters={filters}
              resultCount={filteredQuestions.length}
            />
          }
        >
          {!OPERATION_WRITE_ENABLED ? (
            <Alert
              type="warning"
              showIcon
              style={{ marginBottom: 16 }}
              message="운영 상태 관리는 준비 중입니다."
              description="v13 lifecycle_status가 적용되기 전까지 모든 문항의 운영 상태는 '미지정'으로 표시되며, 노출 후보/숨김 후보/운영 제외 조치는 비활성화되어 있습니다."
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
              description="조건에 맞는 관리 대상 문항이 없습니다."
            />
          ) : (
            <AdminDataTable<AssessmentQuestion>
              rowKey="questionId"
              pagination={{ pageSize: 10 }}
              scroll={{ x: 1440 }}
              tableLayout="fixed"
              columns={manageColumns}
              dataSource={filteredQuestions}
            />
          )}
        </AdminListCard>

        {actionState && actionCopy ? (
          <ConfirmAction
            open
            title={actionCopy.title}
            description={actionCopy.description}
            targetType="AssessmentQuestion"
            targetId={actionState.questionId}
            confirmText={actionCopy.confirmText}
            reasonPlaceholder={actionCopy.reasonPlaceholder}
            onCancel={() => setActionState(null)}
            onConfirm={handleConfirmOperationAction}
          />
        ) : null}
      </div>
    </>
  );
}
