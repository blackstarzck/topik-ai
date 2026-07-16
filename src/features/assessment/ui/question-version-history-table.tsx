import { Alert, Button, Empty, Typography } from 'antd';
import type { TableColumnsType } from 'antd';
import { useMemo } from 'react';

import type { AsyncState } from '../../../shared/model/async-state';
import { AdminDataTable } from '../../../shared/ui/table/admin-data-table';
import type { AssessmentQuestionVersionEntry } from '../model/assessment-question-bank-types';

const { Text } = Typography;

type QuestionVersionHistoryTableProps = {
  state: AsyncState<AssessmentQuestionVersionEntry[]>;
  currentImportId: number | null;
  onOpenVersion: (entry: AssessmentQuestionVersionEntry) => void;
  onRetry: () => void;
};

export function QuestionVersionHistoryTable({
  state,
  currentImportId,
  onOpenVersion,
  onRetry
}: QuestionVersionHistoryTableProps): JSX.Element {
  const previousVersions = useMemo(
    () =>
      state.data
        .filter((entry) => entry.importId !== currentImportId)
        .sort(
          (a, b) =>
            b.sourceUpdatedAt.localeCompare(a.sourceUpdatedAt) || b.importId - a.importId
        ),
    [currentImportId, state.data]
  );

  const columns = useMemo<TableColumnsType<AssessmentQuestionVersionEntry>>(
    () => [
      {
        title: '버전 ID',
        dataIndex: 'importId',
        width: 110,
        sorter: (a, b) => a.importId - b.importId,
        render: (importId: number) => <Text strong>#{importId}</Text>
      },
      {
        title: '원본 생성 시각',
        dataIndex: 'sourceCreatedAt',
        width: 170,
        sorter: (a, b) => a.sourceCreatedAt.localeCompare(b.sourceCreatedAt),
        render: (value: string) => value || '-'
      },
      {
        title: '원본 수정 시각',
        dataIndex: 'sourceUpdatedAt',
        width: 170,
        sorter: (a, b) => a.sourceUpdatedAt.localeCompare(b.sourceUpdatedAt),
        render: (value: string) => value || '-'
      },
      {
        title: '최초 수신',
        dataIndex: 'firstSeenAt',
        width: 160,
        sorter: (a, b) => a.firstSeenAt.localeCompare(b.firstSeenAt),
        render: (value: string) => value || '-'
      },
      {
        title: '마지막 수신',
        dataIndex: 'lastSeenAt',
        width: 160,
        sorter: (a, b) => a.lastSeenAt.localeCompare(b.lastSeenAt),
        render: (value: string) => value || '-'
      },
      {
        title: '수신 횟수',
        dataIndex: 'ingestCount',
        width: 110,
        sorter: (a, b) => a.ingestCount - b.ingestCount,
        render: (value: number) => `${value.toLocaleString()}회`
      },
      {
        title: 'content hash',
        dataIndex: 'contentHash',
        width: 210,
        ellipsis: true,
        render: (value: string) => (
          <Text code ellipsis={{ tooltip: value }}>
            {value || '-'}
          </Text>
        )
      },
      {
        title: 'payload hash',
        dataIndex: 'payloadHash',
        ellipsis: true,
        render: (value: string) => (
          <Text code ellipsis={{ tooltip: value }}>
            {value || '-'}
          </Text>
        )
      }
    ],
    []
  );

  if (state.status === 'error') {
    return (
      <Alert
        type="error"
        showIcon
        message="변경 이력을 불러오지 못했습니다."
        description={state.errorMessage ?? ''}
        action={
          <Button size="small" onClick={onRetry}>
            다시 시도
          </Button>
        }
      />
    );
  }

  if (state.status === 'success' && previousVersions.length === 0) {
    return (
      <Empty
        image={Empty.PRESENTED_IMAGE_SIMPLE}
        description="이전 버전이 없습니다."
      />
    );
  }

  return (
    <AdminDataTable<AssessmentQuestionVersionEntry>
      data-testid="question-version-history-table"
      className="question-version-history-table"
      rowKey="importId"
      columns={columns}
      dataSource={previousVersions}
      loading={state.status === 'pending'}
      pagination={false}
      scroll={{ x: 1320 }}
      tableLayout="fixed"
      onRow={(entry) => ({
        tabIndex: 0,
        'aria-label': `과거 버전 #${entry.importId} 상세 보기`,
        onClick: () => onOpenVersion(entry),
        onKeyDown: (event) => {
          if (event.key === 'Enter') {
            event.preventDefault();
            onOpenVersion(entry);
          }
        }
      })}
    />
  );
}
