import { Card, Table } from 'antd';
import type { TableColumnsType } from 'antd';
import { useCallback, useMemo, useState } from 'react';

import { PageTitle } from '../../../shared/ui/page-title/page-title';
import { StatusBadge } from '../../../shared/ui/status-badge/status-badge';
import { createStatusColumnTitle } from '../../../shared/ui/table/status-column-title';
import {
  createDefinedColumnFilterProps,
  createNumberSorter,
  createTextSorter
} from '../../../shared/ui/table/table-column-utils';
import { TableRowDetailModal } from '../../../shared/ui/table/table-row-detail-modal';

type NotificationSendStatus = '성공' | '부분 실패' | '실패';

type NotificationHistoryRow = {
  id: string;
  title: string;
  target: string;
  sentAt: string;
  successCount: number;
  failureCount: number;
  status: NotificationSendStatus;
};

const notificationStatusFilterValues = ['성공', '부분 실패', '실패'] as const;

const rows: NotificationHistoryRow[] = [
  {
    id: 'NT-001',
    title: '정기 점검 안내',
    target: '전체',
    sentAt: '2026-03-04 08:30',
    successCount: 5120,
    failureCount: 11,
    status: '성공'
  },
  {
    id: 'NT-002',
    title: '환불 정책 변경',
    target: '프리미엄 사용자',
    sentAt: '2026-03-03 19:00',
    successCount: 911,
    failureCount: 17,
    status: '부분 실패'
  },
  {
    id: 'NT-003',
    title: '서비스 공지',
    target: '전체',
    sentAt: '2026-03-02 10:20',
    successCount: 0,
    failureCount: 4960,
    status: '실패'
  }
];

const detailLabelMap: Record<string, string> = {
  id: '발송 ID',
  title: '제목',
  target: '발송 대상',
  sentAt: '발송 시각',
  successCount: '성공 수',
  failureCount: '실패 수',
  status: '상태'
};

export default function NotificationHistoryPage(): JSX.Element {
  const [selectedRow, setSelectedRow] = useState<NotificationHistoryRow | null>(
    null
  );

  const columns = useMemo<TableColumnsType<NotificationHistoryRow>>(
    () => [
      {
        title: '발송 ID',
        dataIndex: 'id',
        width: 110,
        sorter: createTextSorter((record) => record.id)
      },
      {
        title: '제목',
        dataIndex: 'title',
        width: 240,
        sorter: createTextSorter((record) => record.title)
      },
      {
        title: '발송 대상',
        dataIndex: 'target',
        width: 160,
        sorter: createTextSorter((record) => record.target)
      },
      {
        title: '발송 시각',
        dataIndex: 'sentAt',
        width: 180,
        sorter: createTextSorter((record) => record.sentAt)
      },
      {
        title: '성공 수',
        dataIndex: 'successCount',
        width: 100,
        align: 'right',
        sorter: createNumberSorter((record) => record.successCount)
      },
      {
        title: '실패 수',
        dataIndex: 'failureCount',
        width: 100,
        align: 'right',
        sorter: createNumberSorter((record) => record.failureCount)
      },
      {
        title: createStatusColumnTitle('상태', ['성공', '부분 실패', '실패']),
        dataIndex: 'status',
        width: 110,
        ...createDefinedColumnFilterProps(
          notificationStatusFilterValues,
          (record) => record.status
        ),
        sorter: createTextSorter((record) => record.status),
        render: (status: NotificationSendStatus) => <StatusBadge status={status} />
      }
    ],
    []
  );

  const handleRow = useCallback(
    (record: NotificationHistoryRow) => ({
      onClick: () => setSelectedRow(record),
      style: { cursor: 'pointer' }
    }),
    []
  );

  const closeDetailModal = useCallback(() => setSelectedRow(null), []);

  return (
    <div>
      <PageTitle title="발송 이력" />
      <Card>
        <Table
          rowKey="id"
          showSorterTooltip={false}
          size="small"
          pagination={false}
          scroll={{ x: 1200 }}
          columns={columns}
          dataSource={rows}
          onRow={handleRow}
        />
      </Card>
      <TableRowDetailModal
        open={Boolean(selectedRow)}
        title="알림 발송 상세 (더미)"
        record={selectedRow}
        labelMap={detailLabelMap}
        onClose={closeDetailModal}
      />
    </div>
  );
}
