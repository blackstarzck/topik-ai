import { Card, Table, Typography } from 'antd';
import type { TableColumnsType } from 'antd';

import { StatusBadge } from '../../../shared/ui/status-badge/status-badge';

import { PageTitle } from '../../../shared/ui/page-title/page-title';

const { Paragraph } = Typography;

type NotificationHistoryRow = {
  id: string;
  title: string;
  target: string;
  sentAt: string;
  successCount: number;
  failureCount: number;
  status: '성공' | '부분 실패' | '실패';
};

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

const columns: TableColumnsType<NotificationHistoryRow> = [
  { title: '발송 ID', dataIndex: 'id', width: 110 },
  { title: '제목', dataIndex: 'title', width: 240 },
  { title: '발송 대상', dataIndex: 'target', width: 160 },
  { title: '발송 시각', dataIndex: 'sentAt', width: 180 },
  { title: '성공 수', dataIndex: 'successCount', width: 100, align: 'right' },
  { title: '실패 수', dataIndex: 'failureCount', width: 100, align: 'right' },
  {
    title: '상태',
    dataIndex: 'status',
    width: 110,
    render: (status: NotificationHistoryRow['status']) => (
      <StatusBadge status={status} />
    )
  }
];

export default function NotificationHistoryPage(): JSX.Element {
  return (
    <div>
      <PageTitle title="발송 이력" />
      <Paragraph className="page-description">
        발송 이력, 성공/실패 건수, 상태를 조회합니다.
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
