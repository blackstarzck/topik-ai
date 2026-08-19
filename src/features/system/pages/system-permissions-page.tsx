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
import { useAsyncResource } from '@/shared/model/use-async-resource';
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
import {
  fetchAdminDetailSafe,
  grantPermissionsSafe,
  revokePermissionsSafe,
  setAdminStatusSafe
} from '../api/admin-accounts-service';
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
    return '활성';
  }
  if (status === 'invited') {
    return '초대됨';
  }
  if (status === 'suspended') {
    return '정지';
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

  const fetchRows = useCallback(
    (signal: AbortSignal) => fetchAdminAppRolesSafe(signal),
    []
  );
  // 기존 배선은 실패 시 목록을 비웠다(직전 데이터 보존 대신 소거).
  const { state: rowsState, reload: reloadRows } = useAsyncResource<AdminAppRoleRow[]>(
    fetchRows,
    { initialData: [], keepDataOnError: false }
  );
  const rows = rowsState.data;
  const loadState = rowsState.status;
  const loadErrorMessage = rowsState.errorMessage ?? '';

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
    reloadRows();
  }, [closeChangeModal, form, modalState, notificationApi, reloadRows]);

  // --- Per-admin permission grant/revoke ---------------------------------------
  const [permState, setPermState] = useState<{ admin: AdminAppRoleRow } | null>(null);
  const [permLoading, setPermLoading] = useState(false);
  const [permSubmitting, setPermSubmitting] = useState(false);
  const [permBaseline, setPermBaseline] = useState<string[]>([]);
  const [permForm] = Form.useForm<{ permissionKeys: string[]; reason: string }>();

  const permissionOptions = useMemo(
    () => permissionCatalog.map((permission) => ({
      label: `${permission.name} · ${permission.key}`,
      value: permission.key
    })),
    []
  );

  const openPermModal = useCallback(
    async (admin: AdminAppRoleRow) => {
      setPermState({ admin });
      permForm.resetFields();
      setPermBaseline([]);
      if (admin.appRole === 'platform_admin') {
        return;
      }
      setPermLoading(true);
      const result = await fetchAdminDetailSafe(admin.adminId);
      if (!mountedRef.current) {
        return;
      }
      setPermLoading(false);
      const keys = result.ok && result.data ? result.data.permissionKeys : [];
      setPermBaseline(keys);
      permForm.setFieldsValue({ permissionKeys: keys, reason: '' });
    },
    [permForm]
  );

  const closePermModal = useCallback(() => {
    setPermState(null);
    permForm.resetFields();
  }, [permForm]);

  const handlePermSubmit = useCallback(async () => {
    if (!permState) {
      return;
    }
    const values = await permForm.validateFields();
    const next = values.permissionKeys ?? [];
    const reason = values.reason.trim();
    const added = next.filter((key) => !permBaseline.includes(key));
    const removed = permBaseline.filter((key) => !next.includes(key));
    if (added.length === 0 && removed.length === 0) {
      notificationApi.info({ message: '변경 사항이 없습니다.' });
      return;
    }

    setPermSubmitting(true);
    let failure: string | null = null;
    if (added.length > 0) {
      const result = await grantPermissionsSafe(permState.admin.adminId, added, reason);
      if (!result.ok) {
        failure = result.error.message;
      }
    }
    if (!failure && removed.length > 0) {
      const result = await revokePermissionsSafe(permState.admin.adminId, removed, reason);
      if (!result.ok) {
        failure = result.error.message;
      }
    }
    setPermSubmitting(false);

    if (failure) {
      notificationApi.error({ message: '권한 변경 실패', description: failure });
      reloadRows();
      return;
    }
    notificationApi.success({
      message: '권한 변경 완료',
      description: (
        <Space direction="vertical">
          <Text>부여 {added.length}건 · 회수 {removed.length}건</Text>
          <AuditLogLink targetType="AdminAccount" targetId={permState.admin.adminId} />
        </Space>
      )
    });
    closePermModal();
    reloadRows();
  }, [closePermModal, notificationApi, permBaseline, permForm, permState, reloadRows]);

  // --- Suspend / reactivate ----------------------------------------------------
  const [statusState, setStatusState] = useState<{ admin: AdminAppRoleRow } | null>(null);
  const [statusSubmitting, setStatusSubmitting] = useState(false);
  const [statusForm] = Form.useForm<{ reason: string }>();

  const statusNext = statusState?.admin.status === 'active' ? 'suspended' : 'active';

  const openStatusModal = useCallback(
    (admin: AdminAppRoleRow) => {
      setStatusState({ admin });
      statusForm.resetFields();
    },
    [statusForm]
  );

  const handleStatusSubmit = useCallback(async () => {
    if (!statusState) {
      return;
    }
    const values = await statusForm.validateFields();
    setStatusSubmitting(true);
    const result = await setAdminStatusSafe(
      statusState.admin.adminId,
      statusNext as 'active' | 'suspended',
      values.reason.trim()
    );
    setStatusSubmitting(false);
    if (!result.ok) {
      notificationApi.error({ message: '상태 변경 실패', description: result.error.message });
      return;
    }
    notificationApi.success({
      message: statusNext === 'suspended' ? '관리자 정지 완료' : '관리자 복구 완료',
      description: (
        <AuditLogLink targetType="AdminAccount" targetId={statusState.admin.adminId} />
      )
    });
    setStatusState(null);
    statusForm.resetFields();
    reloadRows();
  }, [notificationApi, reloadRows, statusForm, statusNext, statusState]);

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
        width: 280,
        onCell: () => ({ onClick: (event) => event.stopPropagation() }),
        render: (_, record) => (
          <Space size="small" wrap>
            <Button size="small" disabled={!isPlatformAdmin} onClick={() => openChangeModal(record)}>
              등급 변경
            </Button>
            <Button
              size="small"
              disabled={!isPlatformAdmin}
              onClick={() => void openPermModal(record)}
            >
              권한 관리
            </Button>
            {record.status === 'active' || record.status === 'suspended' ? (
              <Button
                size="small"
                danger={record.status === 'active'}
                disabled={!isPlatformAdmin}
                onClick={() => openStatusModal(record)}
              >
                {record.status === 'active' ? '정지' : '복구'}
              </Button>
            ) : null}
          </Space>
        )
      }
    ],
    [isPlatformAdmin, openChangeModal, openPermModal, openStatusModal]
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
            message="관리자 권한은 admin_accounts(역할) + admin_permission_grants(세부 권한)에서 관리됩니다."
            description="등급 변경은 admin_accounts.role을, 권한 관리는 관리자별 세부 권한 부여/회수를 갱신합니다. 슈퍼 관리자(platform_admin)는 모든 권한을 자동 보유합니다. 변경은 다음 로그인 때 반영되며 모든 조치는 감사 로그에 기록됩니다."
          />
          <Alert
            type="warning"
            showIcon
            message="아래 카탈로그(37 permission · 5 RoleKey)는 권한 키 참조와 메뉴 게이팅 기준입니다."
            description="각 관리자의 실제 권한은 위 '권한 관리'에서 부여/회수하며, 서버측 admin_has_permission이 이를 강제합니다(단계적 적용)."
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
          권한 키 목록입니다. 관리자별 실제 부여/회수는 위 관리자 목록의 ‘권한 관리’에서 수행하고, 결과는 감사 로그에 기록됩니다.
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

      <Modal
        open={Boolean(permState)}
        title="관리자 권한 관리"
        okText="권한 적용"
        cancelText="취소"
        okButtonProps={{
          loading: permSubmitting,
          disabled: !isPlatformAdmin || permState?.admin.appRole === 'platform_admin'
        }}
        onCancel={closePermModal}
        onOk={() => void handlePermSubmit()}
        width={640}
        destroyOnHidden
      >
        {permState ? (
          <Space direction="vertical" size={12} style={{ width: '100%' }}>
            <Descriptions
              bordered
              size="small"
              column={1}
              items={[
                { key: 'admin', label: '관리자', children: permState.admin.displayName },
                {
                  key: 'email',
                  label: '이메일',
                  children: permState.admin.email || permState.admin.adminId
                },
                {
                  key: 'role',
                  label: 'app_role',
                  children: `${appRoleLabelMap[permState.admin.appRole]} (${permState.admin.appRole})`
                }
              ]}
            />
            {permState.admin.appRole === 'platform_admin' ? (
              <Alert
                type="info"
                showIcon
                message="슈퍼 관리자는 모든 권한을 자동으로 보유합니다."
                description="platform_admin은 개별 권한 부여/회수 대상이 아닙니다. 권한을 제한하려면 등급을 변경하세요."
              />
            ) : (
              <Form form={permForm} layout="vertical">
                <Form.Item
                  label="부여 권한"
                  name="permissionKeys"
                  tooltip="현재 부여된 권한이 채워져 있습니다. 추가/제거 후 적용하면 변경분만 부여·회수됩니다."
                >
                  <Select
                    mode="multiple"
                    allowClear
                    loading={permLoading}
                    placeholder="권한 선택"
                    options={permissionOptions}
                    optionFilterProp="label"
                    maxTagCount="responsive"
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
                  <Input.TextArea rows={3} placeholder="권한 부여/회수 사유를 입력하세요." />
                </Form.Item>
              </Form>
            )}
          </Space>
        ) : null}
      </Modal>

      <Modal
        open={Boolean(statusState)}
        title={statusNext === 'suspended' ? '관리자 정지' : '관리자 복구'}
        okText={statusNext === 'suspended' ? '정지' : '복구'}
        cancelText="취소"
        okButtonProps={{ danger: statusNext === 'suspended', loading: statusSubmitting, disabled: !isPlatformAdmin }}
        onCancel={() => {
          setStatusState(null);
          statusForm.resetFields();
        }}
        onOk={() => void handleStatusSubmit()}
        destroyOnHidden
      >
        {statusState ? (
          <Space direction="vertical" size={12} style={{ width: '100%' }}>
            <Descriptions
              bordered
              size="small"
              column={1}
              items={[
                { key: 'admin', label: '관리자', children: statusState.admin.displayName },
                {
                  key: 'email',
                  label: '이메일',
                  children: statusState.admin.email || statusState.admin.adminId
                },
                {
                  key: 'next',
                  label: '변경',
                  children:
                    statusNext === 'suspended'
                      ? '활성 → 정지 (로그인·권한 차단)'
                      : '정지 → 활성 (접근 복구)'
                }
              ]}
            />
            <Alert
              type="warning"
              showIcon
              message="잠금 방지"
              description="자기 자신 정지와 마지막 활성 platform_admin 정지는 서버에서 차단됩니다."
            />
            <Form form={statusForm} layout="vertical">
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
                <Input.TextArea rows={3} placeholder="상태 변경 사유를 입력하세요." />
              </Form.Item>
            </Form>
          </Space>
        ) : null}
      </Modal>
    </div>
  );
}
