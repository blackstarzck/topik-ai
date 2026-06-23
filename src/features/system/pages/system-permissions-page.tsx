import {
  Alert,
  Button,
  Card,
  Descriptions,
  Form,
  Input,
  Modal,
  Select,
  Space,
  Tag,
  Typography,
  notification
} from 'antd';
import type { TableColumnsType } from 'antd';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';

import { useAuthStore } from '../../auth/model/auth-store';
import type { V13AppRole } from '../../auth/model/session-types';
import { getTargetTypeLabel } from '../../../shared/model/target-type-label';
import { AuditLogLink } from '../../../shared/ui/audit-log-link/audit-log-link';
import { PageTitle } from '../../../shared/ui/page-title/page-title';
import { AdminDataTable } from '../../../shared/ui/table/admin-data-table';
import { TableRowDetailModal } from '../../../shared/ui/table/table-row-detail-modal';
import { createTextSorter } from '../../../shared/ui/table/table-column-utils';
import {
  changeAdminAppRoleSafe,
  fetchAdminAppRolesSafe,
  type AdminAppRoleRow
} from '../api/system-permissions-service';
import { systemPermissionsDataSource } from '../api/system-permissions-data-source';
import { permissionCatalog, roleCatalog } from '../model/permission-types';
import type { PermissionDefinition, RoleDefinition, RoleKey } from '../model/permission-types';

const { Paragraph, Text, Title } = Typography;

const appRoleOptions: Array<{ value: V13AppRole; label: string; description: string }> = [
  {
    value: 'platform_admin',
    label: '플랫폼 관리자',
    description: '전체 관리자 기능과 관리자 app_role 변경 권한'
  },
  {
    value: 'content_admin',
    label: '콘텐츠 관리자',
    description: '콘텐츠·평가 운영 중심 권한'
  },
  {
    value: 'org_admin',
    label: '조직 관리자',
    description: '현재 임시 매핑상 READ_ONLY로 표시'
  },
  {
    value: 'learner',
    label: '학습자',
    description: '관리자 콘솔 접근 불가'
  }
];

const roleNameMap: Record<RoleKey, string> = {
  SUPER_ADMIN: '최고 관리자',
  OPS_ADMIN: '운영 관리자',
  CONTENT_MANAGER: '콘텐츠 관리자',
  CS_MANAGER: '고객지원 관리자',
  READ_ONLY: '읽기 전용'
};

const appRoleLabelMap: Record<V13AppRole, string> = Object.fromEntries(
  appRoleOptions.map((option) => [option.value, option.label])
) as Record<V13AppRole, string>;

type RoleChangeModalState = {
  admin: AdminAppRoleRow;
} | null;

type RoleChangeFormValues = {
  appRole: V13AppRole;
  reason: string;
};

type DetailModalState = {
  title: string;
  record: Record<string, unknown>;
} | null;

function getRoleLabel(roleKey: RoleKey | null): string {
  return roleKey ? `${roleNameMap[roleKey]} (${roleKey})` : '관리자 접근 없음';
}

function getStatusLabel(status: string): string {
  if (status === 'active') {
    return '정상';
  }
  if (status === 'blocked') {
    return '정지';
  }
  if (status === 'deleted') {
    return '탈퇴';
  }
  return status;
}

function getRiskTag(risk: string): JSX.Element {
  if (risk === 'high') {
    return <Tag color="volcano">High</Tag>;
  }
  if (risk === 'medium') {
    return <Tag color="gold">Medium</Tag>;
  }
  return <Tag color="green">Low</Tag>;
}

export default function SystemPermissionsPage(): JSX.Element {
  const [searchParams] = useSearchParams();
  const session = useAuthStore((state) => state.session);
  const authStatus = useAuthStore((state) => state.status);
  const [rows, setRows] = useState<AdminAppRoleRow[]>([]);
  const [loadState, setLoadState] = useState<'pending' | 'success' | 'error'>('pending');
  const [loadErrorMessage, setLoadErrorMessage] = useState('');
  const [modalState, setModalState] = useState<RoleChangeModalState>(null);
  const [detailModalState, setDetailModalState] = useState<DetailModalState>(null);
  const [submitting, setSubmitting] = useState(false);
  const [notificationApi, notificationContextHolder] = notification.useNotification();
  const [form] = Form.useForm<RoleChangeFormValues>();

  const isPlatformAdmin =
    systemPermissionsDataSource === 'mock' || session?.appRole === 'platform_admin';

  const selectedAdminId = searchParams.get('adminId') ?? '';

  const mountedRef = useRef(true);
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const loadRows = useCallback((signal?: AbortSignal) => {
    setLoadState('pending');
    setLoadErrorMessage('');
    void fetchAdminAppRolesSafe(signal).then((result) => {
      // Guard both the mount-time controller (signal) and the post-submit reload
      // (called with no signal) so a resolved fetch never writes state after unmount.
      if (signal?.aborted || !mountedRef.current) {
        return;
      }
      if (result.ok) {
        setRows(result.data);
        setLoadState('success');
        return;
      }
      setRows([]);
      setLoadErrorMessage(result.error.message);
      setLoadState('error');
    });
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    loadRows(controller.signal);
    return () => controller.abort();
  }, [loadRows]);

  const selectedModalAppRole = Form.useWatch('appRole', form);

  const openChangeModal = useCallback(
    (admin: AdminAppRoleRow) => {
      setModalState({ admin });
      form.setFieldsValue({ appRole: admin.appRole, reason: '' });
    },
    [form]
  );

  const closeChangeModal = useCallback(() => {
    setModalState(null);
    form.resetFields();
  }, [form]);

  const handleChangeSubmit = useCallback(async () => {
    if (!modalState) {
      return;
    }

    const values = await form.validateFields();
    setSubmitting(true);
    const result = await changeAdminAppRoleSafe({
      targetUserId: modalState.admin.adminId,
      newAppRole: values.appRole,
      reason: values.reason.trim()
    });
    setSubmitting(false);

    if (!result.ok) {
      notificationApi.error({
        message: '등급 변경 실패',
        description: result.error.message
      });
      return;
    }

    notificationApi.success({
      message: '관리자 등급 변경 완료',
      description: (
        <Space direction="vertical">
          <Text>대상 유형: {getTargetTypeLabel('AdminAccount')}</Text>
          <Text>대상 ID: {modalState.admin.adminId}</Text>
          <Text>반영 정책: 다음 로그인 때 반영</Text>
          <AuditLogLink targetType="AdminAccount" targetId={modalState.admin.adminId} />
        </Space>
      )
    });
    closeChangeModal();
    loadRows();
  }, [closeChangeModal, form, loadRows, modalState, notificationApi]);

  const adminColumns = useMemo<TableColumnsType<AdminAppRoleRow>>(
    () => [
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
        width: 130,
        onCell: () => ({ onClick: (event) => event.stopPropagation() }),
        render: (_, record) => (
          <Button
            size="small"
            disabled={!isPlatformAdmin}
            onClick={() => openChangeModal(record)}
          >
            등급 변경
          </Button>
        )
      }
    ],
    [isPlatformAdmin, openChangeModal]
  );

  const roleColumns = useMemo<TableColumnsType<RoleDefinition>>(
    () => [
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
    ],
    []
  );

  const permissionColumns = useMemo<TableColumnsType<PermissionDefinition>>(
    () => [
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
    ],
    []
  );

  const modalAdmin = modalState?.admin ?? null;
  const demotesSelf =
    Boolean(modalAdmin && session?.userId === modalAdmin.adminId) &&
    modalAdmin?.appRole === 'platform_admin' &&
    selectedModalAppRole !== 'platform_admin';

  return (
    <div>
      {notificationContextHolder}
      <PageTitle title="권한 관리" />

      <Card style={{ marginBottom: 12 }}>
        <Space direction="vertical" size={12} style={{ width: '100%' }}>
          <Alert
            type="info"
            showIcon
            message="실제 관리자 권한 기준은 profiles.app_role입니다."
            description="이 화면의 등급 변경은 profiles.app_role만 갱신합니다. 기존 세션 강제 만료나 토큰 폐기는 하지 않으며, 변경된 권한은 다음 로그인 때 반영됩니다."
          />
          <Alert
            type="warning"
            showIcon
            message="권한 카탈로그는 참고 전용입니다."
            description="아래 37개 permission과 5개 RoleKey는 메뉴 게이팅과 운영자 이해를 위한 client bundle입니다. 개별 permission 부여/회수는 실권한 변경이 아닙니다."
          />
          {systemPermissionsDataSource === 'mock' ? (
            <Alert
              type="warning"
              showIcon
              message="Mock 데이터소스"
              description="VITE_SUPABASE_DISABLED 또는 VITE_SYSTEM_PERMISSIONS_SOURCE=mock 경로입니다. 기존 permission-store 시뮬레이션으로 회귀 확인만 수행하며 실권한은 변경되지 않습니다."
            />
          ) : null}
          {!isPlatformAdmin && authStatus !== 'mock' ? (
            <Alert
              type="error"
              showIcon
              message="platform_admin만 관리자 등급을 조회·변경할 수 있습니다."
              description="아래 RoleKey·permission 카탈로그(읽기 전용)는 참고용으로 열람할 수 있습니다. 다만 관리자 목록 조회와 등급 변경은 platform_admin 전용이라, 권한이 없으면 목록은 로드되지 않습니다."
            />
          ) : null}
        </Space>
      </Card>

      <Card style={{ marginBottom: 12 }}>
        <Title level={5} style={{ marginTop: 0 }}>
          관리자별 app_role
        </Title>
        <Paragraph type="secondary">
          운영 흐름: 관리자 확인 - 등급 변경 - 사유 입력 - 감사 로그 확인. 마지막 platform_admin 강등과 자기 자신 강등은 서버 RPC에서 차단합니다.
        </Paragraph>
        {loadState === 'error' ? (
          <Alert
            type="error"
            showIcon
            message="관리자 목록을 불러오지 못했습니다."
            description={loadErrorMessage}
            style={{ marginBottom: 12 }}
          />
        ) : null}
        <AdminDataTable<AdminAppRoleRow>
          rowKey="adminId"
          loading={loadState === 'pending'}
          pagination={false}
          scroll={{ x: 1180 }}
          columns={adminColumns}
          dataSource={rows}
          rowClassName={(record) => (record.adminId === selectedAdminId ? 'ant-table-row-selected' : '')}
          onRow={(record) => ({
            onClick: () =>
              setDetailModalState({
                title: '관리자 app_role 상세',
                record: {
                  ...record,
                  appRoleLabel: appRoleLabelMap[record.appRole],
                  mappedRole: getRoleLabel(record.roleKey),
                  auditLog: `/system/audit-logs?targetType=AdminAccount&targetId=${record.adminId}`
                }
              }),
            style: { cursor: 'pointer' }
          })}
        />
      </Card>

      <Card style={{ marginBottom: 12 }}>
        <Title level={5} style={{ marginTop: 0 }}>
          app_role 변경 감사 경로
        </Title>
        <Descriptions
          bordered
          size="small"
          column={1}
          items={[
            { key: 'targetType', label: 'Target Type', children: 'AdminAccount' },
            { key: 'action', label: 'Action', children: 'admin_role_changed' },
            {
              key: 'route',
              label: '감사 로그 확인',
              children: (
                <Link to="/system/audit-logs?targetType=AdminAccount">
                  /system/audit-logs?targetType=AdminAccount
                </Link>
              )
            }
          ]}
        />
      </Card>

      <Card style={{ marginBottom: 12 }}>
        <Title level={5} style={{ marginTop: 0 }}>
          RoleKey 카탈로그(읽기 전용)
        </Title>
        <Paragraph type="secondary">
          RoleKey는 app_role에서 파생된 메뉴 게이팅용 표시값입니다. org_admin은 임시 현행대로 READ_ONLY에 매핑됩니다.
        </Paragraph>
        <AdminDataTable<RoleDefinition>
          rowKey="key"
          pagination={false}
          columns={roleColumns}
          dataSource={roleCatalog}
          onRow={(record) => ({
            onClick: () =>
              setDetailModalState({
                title: 'RoleKey 카탈로그 상세',
                record: {
                  key: record.key,
                  name: roleNameMap[record.key],
                  description: record.description,
                  defaultPermissionCount: record.defaultPermissions.length,
                  defaultPermissions: record.defaultPermissions
                }
              }),
            style: { cursor: 'pointer' }
          })}
        />
      </Card>

      <Card>
        <Title level={5} style={{ marginTop: 0 }}>
          Permission 카탈로그(읽기 전용)
        </Title>
        <Paragraph type="secondary">
          이 목록은 메뉴 노출과 화면 조치 가능 여부를 설명하는 참고 자료입니다. DB 인가 SoT가 아니며 이 화면에서 개별 권한을 부여하거나 회수하지 않습니다.
        </Paragraph>
        <AdminDataTable<PermissionDefinition>
          rowKey="key"
          pagination={false}
          scroll={{ x: 1400 }}
          columns={permissionColumns}
          dataSource={permissionCatalog}
          onRow={(record) => ({
            onClick: () => setDetailModalState({ title: 'Permission 카탈로그 상세', record }),
            style: { cursor: 'pointer' }
          })}
        />
      </Card>

      <TableRowDetailModal
        open={Boolean(detailModalState)}
        title={detailModalState?.title ?? ''}
        record={detailModalState?.record ?? null}
        onClose={() => setDetailModalState(null)}
      />

      <Modal
        open={Boolean(modalAdmin)}
        title="관리자 등급 변경"
        okText="등급 변경"
        cancelText="취소"
        okButtonProps={{
          danger: selectedModalAppRole === 'learner' || demotesSelf,
          loading: submitting,
          disabled: !isPlatformAdmin || demotesSelf
        }}
        onCancel={closeChangeModal}
        onOk={() => void handleChangeSubmit()}
        destroyOnHidden
      >
        {modalAdmin ? (
          <Space direction="vertical" size={12} style={{ width: '100%' }}>
            <Descriptions
              bordered
              size="small"
              column={1}
              items={[
                { key: 'admin', label: '관리자', children: modalAdmin.displayName },
                { key: 'email', label: '이메일', children: modalAdmin.email || modalAdmin.adminId },
                {
                  key: 'current',
                  label: '현재 app_role',
                  children: `${appRoleLabelMap[modalAdmin.appRole]} (${modalAdmin.appRole})`
                },
                {
                  key: 'currentRoleKey',
                  label: '현재 RoleKey',
                  children: getRoleLabel(modalAdmin.roleKey)
                }
              ]}
            />
            <Alert
              type="warning"
              showIcon
              message="잠금 방지"
              description="마지막 platform_admin 강등과 자기 자신 platform_admin 강등은 차단됩니다. 변경은 다음 로그인 때 반영됩니다."
            />
            {demotesSelf ? (
              <Alert
                type="error"
                showIcon
                message="자기 자신의 platform_admin 등급 강등은 허용하지 않습니다."
              />
            ) : null}
            <Form<RoleChangeFormValues> form={form} layout="vertical">
              <Form.Item
                label="새 app_role"
                name="appRole"
                rules={[{ required: true, message: '새 app_role을 선택하세요.' }]}
              >
                <Select
                  options={appRoleOptions.map((option) => ({
                    value: option.value,
                    label: `${option.label} (${option.value})`
                  }))}
                />
              </Form.Item>
              <Form.Item
                label="사유/근거"
                name="reason"
                rules={[
                  { required: true, message: '사유를 입력하세요.' },
                  {
                    validator: (_, value: string | undefined) =>
                      value?.trim()
                        ? Promise.resolve()
                        : Promise.reject(new Error('공백만 입력할 수 없습니다.'))
                  }
                ]}
              >
                <Input.TextArea rows={4} placeholder="등급 변경 사유와 승인 근거를 입력하세요." />
              </Form.Item>
            </Form>
          </Space>
        ) : null}
      </Modal>
    </div>
  );
}
