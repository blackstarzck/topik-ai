import { Card, Table, Typography } from 'antd';
import type { TableColumnsType } from 'antd';

import { PageTitle } from '../../../shared/ui/page-title/page-title';

const { Paragraph } = Typography;

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

const columns: TableColumnsType<SystemLogRow> = [
  { title: '로그 ID', dataIndex: 'id', width: 120 },
  { title: '레벨', dataIndex: 'level', width: 100 },
  { title: '컴포넌트', dataIndex: 'component', width: 190 },
  { title: '메시지', dataIndex: 'message' },
  { title: '시각', dataIndex: 'createdAt', width: 190 }
];

export default function SystemLogsPage(): JSX.Element {
  return (
    <div>
      <PageTitle title="시스템 로그" />
      <Paragraph className="page-description">
        시스템 로그는 기술 로그이며, 감사 로그와 별도로 관리됩니다.
      </Paragraph>
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


