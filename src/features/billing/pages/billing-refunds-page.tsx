import { Alert, Card, Table, Typography } from 'antd';
import type { TableColumnsType } from 'antd';

import { PageTitle } from '../../../shared/ui/page-title/page-title';

const { Paragraph } = Typography;

type RefundRow = {
  id: string;
  paymentId: string;
  userId: string;
  reason: string;
  status: '대기' | '완료';
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

const columns: TableColumnsType<RefundRow> = [
  { title: '환불 ID', dataIndex: 'id', width: 120 },
  { title: '결제 ID', dataIndex: 'paymentId', width: 120 },
  { title: '사용자 ID', dataIndex: 'userId', width: 120 },
  { title: '사유', dataIndex: 'reason' },
  { title: '상태', dataIndex: 'status', width: 100 },
  { title: '요청 시각', dataIndex: 'requestedAt', width: 180 }
];

export default function BillingRefundsPage(): JSX.Element {
  return (
    <div>
      <PageTitle title="환불 관리" />
      <Paragraph className="page-description">
        환불 승인/거절 액션은 대상 유형/대상 ID와 함께 추적합니다.
      </Paragraph>
      <Alert
        showIcon
        type="info"
        style={{ marginBottom: 12 }}
        message="파괴적 액션 가이드"
        description="환불 처리(승인/거절)는 사유 입력이 필수입니다."
      />
      <Card>
        <Table
          rowKey="id"
          size="small"
          pagination={false}
          columns={columns}
          dataSource={rows}
        />
      </Card>
    </div>
  );
}
