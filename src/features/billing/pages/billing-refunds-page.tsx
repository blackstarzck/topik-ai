import { Alert, Card, Table } from 'antd';
import type { TableColumnsType } from 'antd';
import { useCallback, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';

import { PageTitle } from '../../../shared/ui/page-title/page-title';
import {
  createColumnFilterProps,
  createTextSorter
} from '../../../shared/ui/table/table-column-utils';
import { TableRowDetailModal } from '../../../shared/ui/table/table-row-detail-modal';

type RefundStatus = '대기' | '완료';

type RefundRow = {
  id: string;
  paymentId: string;
  userId: string;
  reason: string;
  status: RefundStatus;
  requestedAt: string;
};

const rows: RefundRow[] = [
  {
    id: 'RF-001',
    paymentId: 'PAY-1022',
    userId: 'U00031',
    reason: '중복 결제',
    status: '대기',
    requestedAt: '2026-03-04 10:23'
  },
  {
    id: 'RF-002',
    paymentId: 'PAY-1015',
    userId: 'U00018',
    reason: '서비스 미이용',
    status: '완료',
    requestedAt: '2026-03-02 08:12'
  }
];

const detailLabelMap: Record<string, string> = {
  id: '환불 ID',
  paymentId: '결제 ID',
  userId: '사용자 ID',
  reason: '환불 사유',
  status: '처리 상태',
  requestedAt: '요청 시각'
};

export default function BillingRefundsPage(): JSX.Element {
  const [selectedRow, setSelectedRow] = useState<RefundRow | null>(null);

  const columns = useMemo<TableColumnsType<RefundRow>>(
    () => [
      {
        title: '환불 ID',
        dataIndex: 'id',
        width: 120,
        ...createColumnFilterProps(rows, (record) => record.id),
        sorter: createTextSorter((record) => record.id)
      },
      {
        title: '결제 ID',
        dataIndex: 'paymentId',
        width: 130,
        ...createColumnFilterProps(rows, (record) => record.paymentId),
        sorter: createTextSorter((record) => record.paymentId),
        render: (paymentId: string) => (
          <Link
            className="table-navigation-link"
            to="/commerce/payments"
            onClick={(event) => event.stopPropagation()}
          >
            {paymentId}
          </Link>
        )
      },
      {
        title: '사용자 ID',
        dataIndex: 'userId',
        width: 130,
        ...createColumnFilterProps(rows, (record) => record.userId),
        sorter: createTextSorter((record) => record.userId),
        render: (userId: string) => (
          <Link
            className="table-navigation-link"
            to={`/users/${userId}?tab=profile`}
            onClick={(event) => event.stopPropagation()}
          >
            {userId}
          </Link>
        )
      },
      {
        title: '사유',
        dataIndex: 'reason',
        ...createColumnFilterProps(rows, (record) => record.reason),
        sorter: createTextSorter((record) => record.reason)
      },
      {
        title: '상태',
        dataIndex: 'status',
        width: 100,
        ...createColumnFilterProps(rows, (record) => record.status),
        sorter: createTextSorter((record) => record.status)
      },
      {
        title: '요청 시각',
        dataIndex: 'requestedAt',
        width: 180,
        ...createColumnFilterProps(rows, (record) => record.requestedAt),
        sorter: createTextSorter((record) => record.requestedAt)
      }
    ],
    []
  );

  const handleRow = useCallback(
    (record: RefundRow) => ({
      onClick: () => setSelectedRow(record),
      style: { cursor: 'pointer' }
    }),
    []
  );

  const closeDetailModal = useCallback(() => setSelectedRow(null), []);

  return (
    <div>
      <PageTitle title="환불 관리" />
      <Alert
        showIcon
        type="info"
        style={{ marginBottom: 12 }}
        message="환불 조치 가이드"
        description="환불 처리(승인/거절) 시 사유 기록이 필요합니다."
      />
      <Card>
        <Table
          rowKey="id"
          size="small"
          pagination={false}
          columns={columns}
          dataSource={rows}
          onRow={handleRow}
        />
      </Card>
      <TableRowDetailModal
        open={Boolean(selectedRow)}
        title="환불 상세 (더미)"
        record={selectedRow}
        labelMap={detailLabelMap}
        onClose={closeDetailModal}
      />
    </div>
  );
}
