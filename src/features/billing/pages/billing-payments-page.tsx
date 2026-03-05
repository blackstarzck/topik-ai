import { Card, Table, Typography } from 'antd';
import type { TableColumnsType } from 'antd';

import { StatusBadge } from '../../../shared/ui/status-badge/status-badge';

import { PageTitle } from '../../../shared/ui/page-title/page-title';

const { Paragraph } = Typography;

type PaymentRow = {
  id: string;
  user: string;
  product: string;
  amount: string;
  method: string;
  paidAt: string;
  status: '완료' | '취소' | '환불';
};

const rows: PaymentRow[] = [
  {
    id: 'PAY-1001',
    user: 'U00001 / member_1',
    product: 'TOPIK Premium Monthly',
    amount: '₩9,000',
    method: '카드',
    paidAt: '2026-03-01',
    status: '완료'
  },
  {
    id: 'PAY-1002',
    user: 'U00008 / member_8',
    product: 'TOPIK Mock Test',
    amount: '₩5,000',
    method: '계좌',
    paidAt: '2026-02-22',
    status: '환불'
  }
];

const columns: TableColumnsType<PaymentRow> = [
  { title: '결제 ID', dataIndex: 'id', width: 120 },
  { title: '회원', dataIndex: 'user', width: 200 },
  { title: '상품', dataIndex: 'product', width: 240 },
  { title: '금액', dataIndex: 'amount', width: 120, align: 'right' },
  { title: '결제 수단', dataIndex: 'method', width: 120 },
  { title: '결제일', dataIndex: 'paidAt', width: 120 },
  {
    title: '상태',
    dataIndex: 'status',
    width: 100,
    render: (status: PaymentRow['status']) => <StatusBadge status={status} />
  }
];

export default function BillingPaymentsPage(): JSX.Element {
  return (
    <div>
      <PageTitle title="결제 내역" />
      <Paragraph className="page-description">
        결제 내역을 조회하고 상태를 관리합니다.
      </Paragraph>
      <Card>
        <Table
          rowKey="id"
          size="small"
          pagination={false}
          scroll={{ x: 1200 }}
          columns={columns}
          dataSource={rows}
        />
      </Card>
    </div>
  );
}
