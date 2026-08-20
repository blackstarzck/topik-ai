import { Button, Input, Space, Tag, Typography } from 'antd';
import type { TableColumnsType, TableProps } from 'antd';
import { RightOutlined, SearchOutlined } from '@ant-design/icons';

import {
  assessmentDifficultyLevels,
  assessmentQuestionNumbers,
  getServiceStatusColor,
  getServiceStatusLabel
} from '../model/assessment-question-bank-schema';
import {
  EMPTY_VERSION_HISTORY_STATE,
  OPERATION_ACTIONS,
  serviceStatusLabels,
  type OperationActionState
} from '../model/assessment-question-manage-schema';
import type {
  AssessmentQuestionNumber,
  AssessmentQuestionSummary,
  AssessmentQuestionVersionEntry,
  AssessmentQuestionVersionSummary
} from '../model/assessment-question-bank-types';
import { QuestionVersionHistoryTable } from './question-version-history-table';
import type { AsyncState } from '@/shared/model/async-state';
import {
  TableActionMenu,
  type TableActionMenuItem
} from '@/shared/ui/table/table-action-menu';
import { createStatusColumnTitle } from '@/shared/ui/table/status-column-title';
import { createTextSorter } from '@/shared/ui/table/table-column-utils';
import { COLOR, SPACE } from '@/shared/styles/design-tokens';

const { Text } = Typography;

// 문항 관리 목록의 컬럼·행 액션·버전 확장 정의 — Phase 4 분해로 페이지 본문에서
// 이동(동작 동일). 조회 상태·핸들러는 페이지가 소유하고 인자로 받는다.

export type ManageColumnsOptions = {
  versionSummaryState: AsyncState<Record<string, AssessmentQuestionVersionSummary>>;
  topicMainFilterOptions: { text: string; value: string }[];
  targetLevelFilterOptions: { text: string; value: string }[];
  tagCountByQuestionId: Record<string, number>;
  openDetail: (questionId: string) => void;
  onEditTags: (questionId: string) => void;
  onOperationAction: (next: NonNullable<OperationActionState>) => void;
};

export function createManageRowActionItems(
  { openDetail, onOperationAction }: Pick<ManageColumnsOptions, 'openDetail' | 'onOperationAction'>
): (record: AssessmentQuestionSummary) => TableActionMenuItem[] {
  return (record: AssessmentQuestionSummary): TableActionMenuItem[] => [
      {
        key: 'detail',
        label: '상세 보기',
        onClick: () => openDetail(record.questionId)
      },
      ...OPERATION_ACTIONS.map((action) => ({
        key: `status-${action.nextStatus}`,
        label: action.copy.label,
        disabled: record.serviceStatus === action.nextStatus,
        onClick: () =>
          onOperationAction({
            questionId: record.questionId,
            nextStatus: action.nextStatus
          })
      }))
    ];
}

export function createManageColumns(options: ManageColumnsOptions): TableColumnsType<AssessmentQuestionSummary> {
  const {
    versionSummaryState,
    topicMainFilterOptions,
    targetLevelFilterOptions,
    tagCountByQuestionId,
    openDetail
  } = options;
  const createRowActionItems = createManageRowActionItems(options);
  return [
      {
        title: '문항 번호',
        dataIndex: 'questionNumber',
        width: 110,
        sorter: createTextSorter((record) => record.questionNumber),
        filters: assessmentQuestionNumbers.map((number) => ({
          text: `${number}번`,
          value: number
        })),
        onFilter: (value, record) => record.questionNumber === value,
        render: (questionNumber: AssessmentQuestionNumber) => `${questionNumber}번`
      },
      {
        title: '문항 ID',
        dataIndex: 'questionId',
        width: 230,
        sorter: createTextSorter((record) => record.questionId),
        filterIcon: (filtered) => (
          <SearchOutlined style={{ color: filtered ? COLOR.primary : undefined }} />
        ),
        filterDropdown: ({
          setSelectedKeys,
          selectedKeys,
          confirm,
          clearFilters
        }) => (
          <div
            style={{ padding: SPACE.xs }}
            onKeyDown={(event) => event.stopPropagation()}
          >
            <Input
              allowClear
              placeholder="문항 ID 검색"
              value={selectedKeys[0] as string | undefined}
              onChange={(event) =>
                setSelectedKeys(event.target.value ? [event.target.value] : [])
              }
              onPressEnter={() => confirm()}
              style={{ marginBottom: SPACE.xs, display: 'block', width: 220 }}
            />
            <Space>
              <Button
                type="primary"
                size="small"
                icon={<SearchOutlined />}
                onClick={() => confirm()}
              >
                검색
              </Button>
              <Button
                size="small"
                onClick={() => {
                  clearFilters?.();
                  confirm();
                }}
              >
                초기화
              </Button>
            </Space>
          </div>
        ),
        onFilter: (value, record) =>
          record.questionId.toLowerCase().includes(String(value).toLowerCase()),
        render: (questionId: string) => (
          <Button
            type="link"
            style={{ padding: 0, height: 'auto' }}
            onClick={() => openDetail(questionId)}
          >
            {questionId}
          </Button>
        )
      },
      {
        title: '버전',
        key: 'version',
        width: 140,
        sorter: (a, b) => {
          const left = versionSummaryState.data[a.questionId];
          const right = versionSummaryState.data[b.questionId];
          const leftValue = left?.canonicalImportId == null ? -1 : left.revisionCount;
          const rightValue =
            right?.canonicalImportId == null ? -1 : right.revisionCount;
          return leftValue - rightValue;
        },
        render: (_, record) => {
          const summary = versionSummaryState.data[record.questionId];
          if (!summary) {
            return versionSummaryState.status === 'error' ? (
              <Text type="danger">확인 실패</Text>
            ) : versionSummaryState.status === 'pending' ? (
              <Text type="secondary">확인 중</Text>
            ) : (
              <Text type="secondary">버전 연결 없음</Text>
            );
          }
          if (summary.canonicalImportId == null) {
            return <Text type="secondary">버전 연결 없음</Text>;
          }
          return <Text>{summary.revisionCount.toLocaleString()}회</Text>;
        }
      },
      {
        title: '주제',
        dataIndex: 'topicMain',
        width: 160,
        sorter: createTextSorter((record) => record.topicMain),
        filters: topicMainFilterOptions,
        onFilter: (value, record) => record.topicMain === value,
        render: (topicMain: string) => <Text>{topicMain || '-'}</Text>
      },
      {
        title: '난이도',
        dataIndex: 'difficultyLevel',
        width: 110,
        sorter: (a, b) => (a.difficultyLevel ?? 0) - (b.difficultyLevel ?? 0),
        filters: assessmentDifficultyLevels.map((level) => ({
          text: `난이도 ${level}`,
          value: level
        })),
        onFilter: (value, record) => record.difficultyLevel === value,
        render: (difficultyLevel: number | null) =>
          difficultyLevel == null ? (
            <Text type="secondary">-</Text>
          ) : (
            <Text>난이도 {difficultyLevel}</Text>
          )
      },
      {
        title: 'TOPIK 급수',
        dataIndex: 'targetLevel',
        width: 130,
        sorter: createTextSorter((record) => record.targetLevel),
        filters: targetLevelFilterOptions,
        onFilter: (value, record) => record.targetLevel === value,
        render: (targetLevel: string) =>
          targetLevel ? (
            <Text>{targetLevel}</Text>
          ) : (
            <Text type="secondary">-</Text>
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
        width: 150,
        render: (_, record) => {
          const count = tagCountByQuestionId[record.questionId] ?? 0;
          return (
            <Space size={6}>
              {count > 0 ? <Text>{count}개</Text> : <Text type="secondary">-</Text>}
              <Button
                size="small"
                aria-label={`태그 편집: ${record.questionId}`}
                onClick={() => options.onEditTags(record.questionId)}
              >
                태그 편집
              </Button>
            </Space>
          );
        }
      },
      {
        title: '최근 수정',
        key: 'updatedAt',
        width: 160,
        sorter: createTextSorter((record) => record.updatedAt),
        render: (_, record) => <Text>{record.updatedAt || '-'}</Text>
      },
      {
        title: '',
        key: 'rowActions',
        width: 100,
        fixed: 'right',
        render: (_, record) => (
          <TableActionMenu items={createRowActionItems(record)} />
        )
      }
    ];
}

export type VersionExpandableOptions = {
  versionSummaryState: AsyncState<Record<string, AssessmentQuestionVersionSummary>>;
  versionHistoryByQuestionId: Record<string, AsyncState<AssessmentQuestionVersionEntry[]>>;
  loadVersionHistory: (questionId: string) => void;
  openVersionDetail: (entry: AssessmentQuestionVersionEntry) => void;
};

export function createVersionExpandable({
  versionSummaryState,
  versionHistoryByQuestionId,
  loadVersionHistory,
  openVersionDetail
}: VersionExpandableOptions): NonNullable<TableProps<AssessmentQuestionSummary>['expandable']> {
  return ({
      expandIcon: ({ expanded, expandable, onExpand, record }) =>
        expandable ? (
          <Button
            type="text"
            size="small"
            className="question-version-expand-button"
            aria-label={expanded ? '문항 변경 이력 접기' : '문항 변경 이력 펼치기'}
            icon={<RightOutlined rotate={expanded ? 90 : 0} />}
            onClick={(event) => {
              event.stopPropagation();
              onExpand(record, event);
            }}
          />
        ) : null,
      rowExpandable: (record) => {
        const summary = versionSummaryState.data[record.questionId];
        return Boolean(
          summary?.canonicalImportId != null && summary.revisionCount > 0
        );
      },
      onExpand: (expanded, record) => {
        if (!expanded) {
          return;
        }
        const historyState = versionHistoryByQuestionId[record.questionId];
        if (!historyState || historyState.status === 'idle') {
          loadVersionHistory(record.questionId);
        }
      },
      expandedRowRender: (record) => (
        <QuestionVersionHistoryTable
          state={
            versionHistoryByQuestionId[record.questionId] ??
            EMPTY_VERSION_HISTORY_STATE
          }
          currentImportId={
            versionSummaryState.data[record.questionId]?.canonicalImportId ?? null
          }
          onOpenVersion={openVersionDetail}
          onRetry={() => loadVersionHistory(record.questionId)}
        />
      )
    });
}
