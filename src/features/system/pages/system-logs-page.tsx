import { Card, Table } from 'antd';
import type { TableColumnsType } from 'antd';
import { useCallback, useMemo, useState } from 'react';

import { PageTitle } from '../../../shared/ui/page-title/page-title';
import {
  createColumnFilterProps,
  createTextSorter
} from '../../../shared/ui/table/table-column-utils';
import { TableRowDetailModal } from '../../../shared/ui/table/table-row-detail-modal';

type SystemLogRow = {
  id: string;
  level: 'INFO' | 'WARN' | 'ERROR';
  component: string;
  message: string;
  createdAt: string;
};

const rows: SystemLogRow[] = [
  {
    id: 'SYS-001',
    level: 'INFO',
    component: 'notification-worker',
    message: 'dispatch batch completed',
    createdAt: '2026-03-04 09:11:42'
  },
  {
    id: 'SYS-002',
    level: 'WARN',
    component: 'billing-sync',
    message: 'payment webhook delayed',
    createdAt: '2026-03-04 09:47:03'
  },
  {
    id: 'SYS-003',
    level: 'ERROR',
    component: 'community-service',
    message: 'report queue retry limit reached',
    createdAt: '2026-03-04 10:02:19'
  }
];

const detailLabelMap: Record<string, string> = {
  id: '로그 ID',
  level: '레벨',
  component: '컴포넌트',
  message: '메시지',
  createdAt: '시각'
};

export default function SystemLogsPage(): JSX.Element {
  const [selectedRow, setSelectedRow] = useState<SystemLogRow | null>(null);

  const columns = useMemo<TableColumnsType<SystemLogRow>>(
    () => [
      {
        title: '로그 ID',
        dataIndex: 'id',
        width: 120,
        ...createColumnFilterProps(rows, (record) => record.id),
        sorter: createTextSorter((record) => record.id)
      },
      {
        title: '레벨',
        dataIndex: 'level',
        width: 100,
        ...createColumnFilterProps(rows, (record) => record.level),
        sorter: createTextSorter((record) => record.level)
      },
      {
        title: '컴포넌트',
        dataIndex: 'component',
        width: 190,
        ...createColumnFilterProps(rows, (record) => record.component),
        sorter: createTextSorter((record) => record.component)
      },
      {
        title: '메시지',
        dataIndex: 'message',
        ...createColumnFilterProps(rows, (record) => record.message),
        sorter: createTextSorter((record) => record.message)
      },
      {
        title: '시각',
        dataIndex: 'createdAt',
        width: 190,
        ...createColumnFilterProps(rows, (record) => record.createdAt),
        sorter: createTextSorter((record) => record.createdAt)
      }
    ],
    []
  );

  const handleRowClick = useCallback(
    (record: SystemLogRow) => ({
      onClick: () => setSelectedRow(record),
      style: { cursor: 'pointer' }
    }),
    []
  );

  const closeDetailModal = useCallback(() => setSelectedRow(null), []);

  return (
    <div>
      <PageTitle title="시스템 로그" />
      <Card>
        <Table
          rowKey="id"
          size="small"
          pagination={false}
          columns={columns}
          dataSource={rows}
          onRow={handleRowClick}
        />
      </Card>
      <TableRowDetailModal
        open={Boolean(selectedRow)}
        title="시스템 로그 상세 (더미)"
        record={selectedRow}
        labelMap={detailLabelMap}
        onClose={closeDetailModal}
      />
    </div>
  );
}
