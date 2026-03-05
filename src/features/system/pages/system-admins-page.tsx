import { Card, Space, Table, Typography } from 'antd';
import type { TableColumnsType } from 'antd';
import { Link } from 'react-router-dom';

import { StatusBadge } from '../../../shared/ui/status-badge/status-badge';
import { usePermissionStore } from '../model/permission-store';
import type { AdminPermissionAssignment } from '../model/permission-types';

import { PageTitle } from '../../../shared/ui/page-title/page-title';

const { Paragraph } = Typography;

export default function SystemAdminsPage(): JSX.Element {
  const admins = usePermissionStore((state) => state.admins);

  const columns: TableColumnsType<AdminPermissionAssignment> = [
    { title: '관리자 ID', dataIndex: 'adminId', width: 150 },
    { title: '이름', dataIndex: 'name', width: 120 },
    { title: '권한', dataIndex: 'role', width: 150 },
    {
      title: '보유 권한 수',
      width: 110,
      align: 'right',
      render: (_, record) => record.permissions.length
    },
    { title: '최근 로그인', dataIndex: 'lastLoginAt', width: 180 },
    {
      title: '상태',
      dataIndex: 'status',
      width: 110,
      render: (status: string) => <StatusBadge status={status} />
    },
    {
      title: '권한 관리',
      key: 'manage',
      width: 180,
      render: () => <Link to="/system/permissions">권한 부여/수정/회수</Link>
    }
  ];

  return (
    <div>
      <PageTitle title="관리자 계정" />
      <Paragraph className="page-description">
        관리자 계정과 현재 역할/권한 현황을 확인합니다. 상세 변경은 권한 관리 화면에서
        수행합니다.
      </Paragraph>
      <Card>
        <Table
          rowKey="adminId"
          size="small"
          pagination={false}
          scroll={{ x: 1200 }}
          columns={columns}
          dataSource={admins}
        />
        <Space size={14} style={{ marginTop: 12 }}>
          <Link to="/system/permissions">권한 관리</Link>
          <Link to="/system/audit-logs">감사 로그</Link>
          <Link to="/system/logs">시스템 로그</Link>
        </Space>
      </Card>
    </div>
  );
}
