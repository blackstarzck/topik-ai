import { Card, Space, Table } from 'antd';
import type { TableColumnsType } from 'antd';
import { useCallback, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';

import { StatusBadge } from '../../../shared/ui/status-badge/status-badge';
import { usePermissionStore } from '../model/permission-store';
import type { AdminPermissionAssignment } from '../model/permission-types';

import { PageTitle } from '../../../shared/ui/page-title/page-title';
import {
  createColumnFilterProps,
  createNumberSorter,
  createTextSorter
} from '../../../shared/ui/table/table-column-utils';
import { TableRowDetailModal } from '../../../shared/ui/table/table-row-detail-modal';

const detailLabelMap: Record<string, string> = {
  adminId: '관리자 ID',
  name: '이름',
  role: '역할',
  permissions: '권한 목록',
  lastLoginAt: '최근 로그인',
  status: '상태',
  updatedAt: '최근 수정'
};

export default function SystemAdminsPage(): JSX.Element {
  const admins = usePermissionStore((state) => state.admins);
  const [selectedRow, setSelectedRow] = useState<AdminPermissionAssignment | null>(
    null
  );

  const columns = useMemo<TableColumnsType<AdminPermissionAssignment>>(
    () => [
      {
        title: '관리자 ID',
        dataIndex: 'adminId',
        width: 150,
        ...createColumnFilterProps(admins, (record) => record.adminId),
        sorter: createTextSorter((record) => record.adminId),
        render: (adminId: string) => (
          <Link
            className="table-navigation-link"
            to="/system/permissions"
            onClick={(event) => event.stopPropagation()}
          >
            {adminId}
          </Link>
        )
      },
      {
        title: '이름',
        dataIndex: 'name',
        width: 120,
        ...createColumnFilterProps(admins, (record) => record.name),
        sorter: createTextSorter((record) => record.name)
      },
      {
        title: '권한',
        dataIndex: 'role',
        width: 150,
        ...createColumnFilterProps(admins, (record) => record.role),
        sorter: createTextSorter((record) => record.role)
      },
      {
        title: '보유 권한 수',
        width: 110,
        align: 'right',
        ...createColumnFilterProps(admins, (record) => record.permissions.length),
        sorter: createNumberSorter((record) => record.permissions.length),
        render: (_, record) => record.permissions.length
      },
      {
        title: '최근 로그인',
        dataIndex: 'lastLoginAt',
        width: 180,
        ...createColumnFilterProps(admins, (record) => record.lastLoginAt),
        sorter: createTextSorter((record) => record.lastLoginAt)
      },
      {
        title: '상태',
        dataIndex: 'status',
        width: 110,
        ...createColumnFilterProps(admins, (record) => record.status),
        sorter: createTextSorter((record) => record.status),
        render: (status: string) => <StatusBadge status={status} />
      },
      {
        title: '권한 관리',
        key: 'manage',
        width: 180,
        onCell: () => ({
          onClick: (event) => {
            event.stopPropagation();
          }
        }),
        render: () => (
          <Link className="table-navigation-link" to="/system/permissions">
            권한 부여/수정/회수
          </Link>
        )
      }
    ],
    [admins]
  );

  const handleRowClick = useCallback(
    (record: AdminPermissionAssignment) => ({
      onClick: () => setSelectedRow(record),
      style: { cursor: 'pointer' }
    }),
    []
  );

  const closeDetailModal = useCallback(() => setSelectedRow(null), []);

  return (
    <div>
      <PageTitle title="관리자 계정" />
      <Card>
        <Table
          rowKey="adminId"
          size="small"
          pagination={false}
          scroll={{ x: 1200 }}
          columns={columns}
          dataSource={admins}
          onRow={handleRowClick}
        />
        <Space size={14} style={{ marginTop: 12 }}>
          <Link to="/system/permissions">권한 관리</Link>
          <Link to="/system/audit-logs">감사 로그</Link>
          <Link to="/system/logs">시스템 로그</Link>
        </Space>
      </Card>
      <TableRowDetailModal
        open={Boolean(selectedRow)}
        title="관리자 계정 상세 (더미)"
        record={selectedRow}
        labelMap={detailLabelMap}
        onClose={closeDetailModal}
      />
    </div>
  );
}
