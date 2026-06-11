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

import { updateAssessmentQuestionServiceStatusSafe } from '../api/assessment-question-bank-service';
import { questionBankDataSource } from '../api/question-bank-data-source';
import { useAssessmentQuestionFilters } from '../model/use-assessment-question-filters';
import { useAssessmentQuestionList } from '../model/use-assessment-question-list';
import {
  useQuestionBankTopicMaster,
  useQuestionTagCounts
} from '../model/use-question-bank-masters';
import { AssessmentQuestionBankToolbar } from '../ui/assessment-question-bank-toolbar';
import {
  SERVICE_STATUS_LABELS,
  assessmentServiceStatuses,
  getServiceStatusColor,
  getServiceStatusLabel,
  parseAssessmentServiceStatus
} from '../model/assessment-question-bank-schema';
import {
  applyCommonQuestionFilters,
  filterQuestionsByNumbers,
  getQuestionLevelText
} from '../model/assessment-question-bank-presenter';
import type {
  AssessmentQuestionNumber,
  AssessmentQuestionSummary,
  AssessmentServiceStatus
} from '../model/assessment-question-bank-types';
import { getTargetTypeLabel } from '../../../shared/model/target-type-label';
import { AuditLogLink } from '../../../shared/ui/audit-log-link/audit-log-link';
import { ConfirmAction } from '../../../shared/ui/confirm-action/confirm-action';
import { AdminListCard } from '../../../shared/ui/list-page-card/admin-list-card';
import { ListSummaryCards } from '../../../shared/ui/list-summary-cards/list-summary-cards';
import { PageTitle } from '../../../shared/ui/page-title/page-title';
import { AdminDataTable } from '../../../shared/ui/table/admin-data-table';
import { createStatusColumnTitle } from '../../../shared/ui/table/status-column-title';
import { createTextSorter } from '../../../shared/ui/table/table-column-utils';

const { Text } = Typography;

/**
 * P4 게이트 (D-6, 실행계획안 2026-06-11 개정 §8): `service_status` write는
 * P4(관리 포인트 개방)에서 이 플래그 제거와 함께 활성화한다. 신규 스키마·RPC
 * (admin_update_topik_question)는 service_status patch를 지원하므로, P4에서는
 * 이 플래그와 facade 게이트만 제거하면 된다. 그때까지 모든 적재 문항은
 * 'internal_test'(노출 차단)다.
 */
const OPERATION_WRITE_ENABLED = false;

const serviceStatusLabels = assessmentServiceStatuses.map(
  (status) => SERVICE_STATUS_LABELS[status]
);

type OperationActionState = {
  questionId: string;
  nextStatus: AssessmentServiceStatus;
} | null;

type OperationActionCopy = {
  label: string;
  title: string;
  description: string;
  confirmText: string;
  successMessage: string;
  reasonPlaceholder: string;
};

// D-6: 노출 가능(available) / 노출 제외(excluded). '운영 제외'는 excluded +
// 운영주의 태그 '운영 제외' 부여로 구분한다(태그 편집은 P4 — 버튼만 자리 확보).
const OPERATION_ACTIONS: { nextStatus: AssessmentServiceStatus; copy: OperationActionCopy }[] = [
  {
    nextStatus: 'available',
    copy: {
      label: '노출 가능',
      title: '노출 가능 전환',
      description:
        '이 문항을 노출 가능(available)으로 전환합니다. 운영주의 태그 활성 문항은 전환 사유가 필수이며(POL-018), 변경 사유는 감사 로그로 남습니다.',
      confirmText: '노출 가능',
      successMessage: '노출 가능으로 변경했습니다.',
      reasonPlaceholder: '노출 가능 전환 사유를 입력해 주세요.'
    }
  },
  {
    nextStatus: 'excluded',
    copy: {
      label: '노출 제외',
      title: '노출 제외 전환',
      description:
        '이 문항을 노출 제외(excluded)로 전환합니다. 변경 사유는 감사 로그로 남습니다.',
      confirmText: '노출 제외',
      successMessage: '노출 제외로 변경했습니다.',
      reasonPlaceholder: '노출 제외 사유를 입력해 주세요.'
    }
  },
  {
    nextStatus: 'internal_test',
    copy: {
      label: '내부 테스트',
      title: '내부 테스트 전환',
      description:
        '이 문항을 내부 테스트(internal_test)로 되돌립니다. 사용자 노출이 차단되며, 변경 사유는 감사 로그로 남습니다.',
      confirmText: '내부 테스트',
      successMessage: '내부 테스트로 변경했습니다.',
      reasonPlaceholder: '내부 테스트 전환 사유를 입력해 주세요.'
    }
  }
];

export default function AssessmentQuestionManagePage(): JSX.Element {
  const filters = useAssessmentQuestionFilters();
  const { state, reload } = useAssessmentQuestionList();
  const { topicOptions } = useQuestionBankTopicMaster();
  const { tagCountByQuestionId } = useQuestionTagCounts();
  const [actionState, setActionState] = useState<OperationActionState>(null);
  const [notificationApi, notificationContextHolder] =
    notification.useNotification();

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

  const serviceStatusFilter = parseAssessmentServiceStatus(
    searchParams.get('serviceStatus')
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

    return serviceStatusFilter
      ? common.filter(
          (question) => question.serviceStatus === serviceStatusFilter
        )
      : common;
  }, [
    currentNumberQuestions,
    difficultyFilter,
    keyword,
    questionTypeFilter,
    serviceStatusFilter,
    topicDetailFilter,
    topicMainFilter
  ]);

  const summaryItems = useMemo(() => {
    const countOf = (status: AssessmentServiceStatus) =>
      currentNumberQuestions.filter(
        (question) => question.serviceStatus === status
      ).length;

    return [
      {
        key: 'manage-total',
        label: '전체 문항',
        value: `${currentNumberQuestions.length.toLocaleString()}문항`,
        active: serviceStatusFilter === null,
        onClick: () => commitParams({ serviceStatus: null })
      },
      ...assessmentServiceStatuses.map((status) => ({
        key: `manage-${status}`,
        label: SERVICE_STATUS_LABELS[status],
        value: `${countOf(status).toLocaleString()}문항`,
        active: serviceStatusFilter === status,
        onClick: () => commitParams({ serviceStatus: status })
      }))
    ];
  }, [commitParams, currentNumberQuestions, serviceStatusFilter]);

  const handleConfirmOperationAction = useCallback(
    async (reason: string) => {
      if (!actionState) {
        return;
      }

      const result = await updateAssessmentQuestionServiceStatusSafe({
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

      const action = OPERATION_ACTIONS.find(
        (candidate) => candidate.nextStatus === actionState.nextStatus
      );
      const targetId = actionState.questionId;
      setActionState(null);
      reload();
      notificationApi.success({
        message: action?.copy.successMessage ?? '운영 상태를 변경했습니다.',
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

  const manageColumns = useMemo<TableColumnsType<AssessmentQuestionSummary>>(
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
        width: 200,
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
        title: createStatusColumnTitle('노출 상태', serviceStatusLabels),
        dataIndex: 'serviceStatus',
        width: 130,
        sorter: createTextSorter((record) => record.serviceStatus ?? ''),
        render: (_, record) => (
          <Tag color={getServiceStatusColor(record.serviceStatus)}>
            {getServiceStatusLabel(record.serviceStatus)}
          </Tag>
        )
      },
      {
        title: '태그',
        key: 'tags',
        width: 100,
        render: (_, record) => {
          const count = tagCountByQuestionId[record.questionId] ?? 0;
          return count > 0 ? <Text>{count}개</Text> : <Text type="secondary">-</Text>;
        }
      },
      {
        title: '운영 조치',
        key: 'operationAction',
        width: 280,
        render: (_, record) => (
          <Space size={4} wrap>
            {OPERATION_ACTIONS.map((action) => (
              <Button
                key={action.nextStatus}
                size="small"
                disabled={!OPERATION_WRITE_ENABLED}
                onClick={() =>
                  setActionState({
                    questionId: record.questionId,
                    nextStatus: action.nextStatus
                  })
                }
              >
                {action.copy.label}
              </Button>
            ))}
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
    [tagCountByQuestionId]
  );

  const actionCopy = actionState
    ? OPERATION_ACTIONS.find(
        (candidate) => candidate.nextStatus === actionState.nextStatus
      )?.copy ?? null
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

          {!OPERATION_WRITE_ENABLED ? (
            <Alert
              type="warning"
              showIcon
              style={{ marginBottom: 16 }}
              message="관리 포인트(노출 상태·태그) 조치는 준비 중입니다."
              description="노출 가능/노출 제외/내부 테스트 조치와 태그 부여/제거는 P4(관리 포인트 개방)에서 활성화됩니다. 적재된 문항은 노출 상태(service_status) 'internal_test'로 사용자 노출이 차단되어 있습니다."
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
            <AdminDataTable<AssessmentQuestionSummary>
              rowKey="questionId"
              pagination={{ pageSize: 10 }}
              scroll={{ x: 1460 }}
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
