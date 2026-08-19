import { Button, Space, Tag, Typography } from 'antd';
import type { TableColumnsType } from 'antd';

import type { V13AppRole } from '../../auth/model/session-types';
import type { AdminAppRoleRow } from '../api/system-permissions-service';
import type { PermissionDefinition, RoleDefinition, RoleKey } from '../model/permission-types';
import {
  appRoleLabelMap,
  getRoleLabel,
  getStatusLabel,
  roleNameMap
} from '../model/system-permissions-page-schema';
import { createTextSorter } from '@/shared/ui/table/table-column-utils';

const { Text } = Typography;

// 권한 관리 3개 테이블의 컬럼 정의 — Phase 4 분해로 페이지 본문에서 이동(동작 동일).
// 조치 가능 여부와 모달 오픈 핸들러는 페이지가 소유하고 인자로 받는다.

function getRiskTag(risk: string): JSX.Element {
  if (risk === 'high') {
    return <Tag color="volcano">High</Tag>;
  }
  if (risk === 'medium') {
    return <Tag color="gold">Medium</Tag>;
  }
  return <Tag color="green">Low</Tag>;
}

export type AdminAppRoleColumnsOptions = {
  isPlatformAdmin: boolean;
  onChangeRole: (admin: AdminAppRoleRow) => void;
  onManagePermissions: (admin: AdminAppRoleRow) => void;
  onChangeStatus: (admin: AdminAppRoleRow) => void;
};

export function createAdminAppRoleColumns({
  isPlatformAdmin,
  onChangeRole,
  onManagePermissions,
  onChangeStatus
}: AdminAppRoleColumnsOptions): TableColumnsType<AdminAppRoleRow> {
  return [
    {
      title: '관리자',
      dataIndex: 'displayName',
      width: 180,
      sorter: createTextSorter((record) => record.displayName),
      render: (displayName: string, record) => (
        <Space direction="vertical" size={0}>
          <Text strong>{displayName}</Text>
          <Text type="secondary">{record.email || record.adminId}</Text>
        </Space>
      )
    },
    {
      title: 'app_role',
      dataIndex: 'appRole',
      width: 170,
      sorter: createTextSorter((record) => record.appRole),
      render: (appRole: V13AppRole) => (
        <Tag color={appRole === 'platform_admin' ? 'blue' : 'default'}>
          {appRoleLabelMap[appRole]} ({appRole})
        </Tag>
      )
    },
    {
      title: '매핑 RoleKey',
      dataIndex: 'roleKey',
      width: 190,
      sorter: createTextSorter((record) => record.roleKey ?? ''),
      render: (roleKey: RoleKey | null) => getRoleLabel(roleKey)
    },
    {
      title: '카탈로그 권한 수',
      dataIndex: 'permissionCount',
      width: 130,
      sorter: createTextSorter((record) => String(record.permissionCount))
    },
    {
      title: '상태',
      dataIndex: 'status',
      width: 100,
      sorter: createTextSorter((record) => record.status),
      render: (status: string) => getStatusLabel(status)
    },
    {
      title: '최근 로그인',
      dataIndex: 'lastLoginAt',
      width: 170,
      sorter: createTextSorter((record) => record.lastLoginAt)
    },
    {
      title: '조치',
      key: 'actions',
      width: 280,
      onCell: () => ({ onClick: (event) => event.stopPropagation() }),
      render: (_, record) => (
        <Space size="small" wrap>
          <Button size="small" disabled={!isPlatformAdmin} onClick={() => onChangeRole(record)}>
            등급 변경
          </Button>
          <Button
            size="small"
            disabled={!isPlatformAdmin}
            onClick={() => onManagePermissions(record)}
          >
            권한 관리
          </Button>
          {record.status === 'active' || record.status === 'suspended' ? (
            <Button
              size="small"
              danger={record.status === 'active'}
              disabled={!isPlatformAdmin}
              onClick={() => onChangeStatus(record)}
            >
              {record.status === 'active' ? '정지' : '복구'}
            </Button>
          ) : null}
        </Space>
      )
    }
  ];
}

export function createRoleCatalogColumns(): TableColumnsType<RoleDefinition> {
  return [
    {
      title: 'RoleKey',
      dataIndex: 'key',
      width: 160,
      sorter: createTextSorter((record) => record.key)
    },
    {
      title: '표시명',
      dataIndex: 'key',
      width: 160,
      sorter: createTextSorter((record) => roleNameMap[record.key]),
      render: (roleKey: RoleKey) => roleNameMap[roleKey]
    },
    {
      title: '기본 권한 수',
      width: 130,
      sorter: createTextSorter((record) => String(record.defaultPermissions.length)),
      render: (_, role) => role.defaultPermissions.length
    },
    {
      title: '설명',
      dataIndex: 'description',
      sorter: createTextSorter((record) => record.description)
    }
  ];
}

export function createPermissionCatalogColumns(): TableColumnsType<PermissionDefinition> {
  return [
    {
      title: '권한 코드',
      dataIndex: 'key',
      width: 240,
      sorter: createTextSorter((record) => record.key)
    },
    {
      title: '권한명',
      dataIndex: 'name',
      width: 180,
      sorter: createTextSorter((record) => record.name)
    },
    {
      title: '모듈',
      dataIndex: 'module',
      width: 120,
      sorter: createTextSorter((record) => record.module)
    },
    {
      title: '범위 설명',
      dataIndex: 'scopeDescription',
      sorter: createTextSorter((record) => record.scopeDescription)
    },
    {
      title: '위험도',
      dataIndex: 'risk',
      width: 100,
      sorter: createTextSorter((record) => record.risk),
      render: (risk: string) => getRiskTag(risk)
    }
  ];
}
