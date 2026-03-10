import { Card, Table } from 'antd';
import type { TableColumnsType } from 'antd';
import { useCallback, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';

import { PageTitle } from '../../../shared/ui/page-title/page-title';
import { StatusBadge } from '../../../shared/ui/status-badge/status-badge';
import {
  createColumnFilterProps,
  createNumericTextSorter,
  createTextSorter
} from '../../../shared/ui/table/table-column-utils';
import { TableRowDetailModal } from '../../../shared/ui/table/table-row-detail-modal';

type PaymentStatus = '완료' | '취소' | '환불';

type PaymentRow = {
  id: string;
  userId: string;
  userNickname: string;
  product: string;
  amount: string;
  method: string;
  paidAt: string;
  status: PaymentStatus;
};

const rows: PaymentRow[] = [
  {
    id: 'PAY-1001',
    userId: 'U00001',
    userNickname: 'member_1',
    product: 'TOPIK Premium Monthly',
    amount: '₩9,000',
    method: '카드',
    paidAt: '2026-03-01',
    status: '완료'
  },
  {
    id: 'PAY-1002',
    userId: 'U00008',
    userNickname: 'member_8',
    product: 'TOPIK Mock Test',
    amount: '₩5,000',
    method: '계좌이체',
    paidAt: '2026-02-22',
    status: '환불'
  }
];

const detailLabelMap: Record<string, string> = {
  id: '결제 ID',
  userId: '사용자 ID',
  userNickname: '닉네임',
  product: '상품',
  amount: '결제 금액',
  method: '결제 수단',
  paidAt: '결제일',
  status: '상태'
};

export default function BillingPaymentsPage(): JSX.Element {
  const [selectedRow, setSelectedRow] = useState<PaymentRow | null>(null);

  const columns = useMemo<TableColumnsType<PaymentRow>>(
    () => [
      {
        title: '결제 ID',
        dataIndex: 'id',
        width: 120,
        ...createColumnFilterProps(rows, (record) => record.id),
        sorter: createTextSorter((record) => record.id)
      },
      {
        title: '회원',
        key: 'user',
        width: 220,
        ...createColumnFilterProps(rows, (record) => [
          record.userId,
          record.userNickname
        ]),
        sorter: createTextSorter((record) => record.userId),
        render: (_, record) => (
          <>
            <Link
              className="table-navigation-link"
              to={`/users/${record.userId}?tab=profile`}
              onClick={(event) => event.stopPropagation()}
            >
              {record.userId}
            </Link>{' '}
            / {record.userNickname}
          </>
        )
      },
      {
        title: '상품',
        dataIndex: 'product',
        width: 240,
        ...createColumnFilterProps(rows, (record) => record.product),
        sorter: createTextSorter((record) => record.product)
      },
      {
        title: '금액',
        dataIndex: 'amount',
        width: 120,
        align: 'right',
        ...createColumnFilterProps(rows, (record) => record.amount),
        sorter: createNumericTextSorter((record) => record.amount)
      },
      {
        title: '결제 수단',
        dataIndex: 'method',
        width: 120,
        ...createColumnFilterProps(rows, (record) => record.method),
        sorter: createTextSorter((record) => record.method)
      },
      {
        title: '결제일',
        dataIndex: 'paidAt',
        width: 120,
        ...createColumnFilterProps(rows, (record) => record.paidAt),
        sorter: createTextSorter((record) => record.paidAt)
      },
      {
        title: '상태',
        dataIndex: 'status',
        width: 100,
        ...createColumnFilterProps(rows, (record) => record.status),
        sorter: createTextSorter((record) => record.status),
        render: (status: PaymentStatus) => <StatusBadge status={status} />
      }
    ],
    []
  );

  const handleRow = useCallback(
    (record: PaymentRow) => ({
      onClick: () => setSelectedRow(record),
      style: { cursor: 'pointer' }
    }),
    []
  );

  const closeDetailModal = useCallback(() => setSelectedRow(null), []);

  return (
    <div>
      <PageTitle title="결제 내역" />
      <Card>
        <Table
          rowKey="id"
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
        title="결제 상세 (더미)"
        record={selectedRow}
        labelMap={detailLabelMap}
        onClose={closeDetailModal}
      />
    </div>
  );
}
