import {
  Alert,
  Button,
  Card,
  Checkbox,
  Form,
  Input,
  Modal,
  Select,
  Space,
  Table,
  Tag,
  Typography,
  message,
  notification
} from 'antd';
import type { TableColumnsType } from 'antd';
import { useCallback, useMemo, useState } from 'react';

import { AuditLogLink } from '../../../shared/ui/audit-log-link/audit-log-link';
import { StatusBadge } from '../../../shared/ui/status-badge/status-badge';
import { TableActionMenu } from '../../../shared/ui/table/table-action-menu';
import { getTargetTypeLabel } from '../../../shared/model/target-type-label';
import { usePermissionStore } from '../model/permission-store';
import { permissionCatalog, roleCatalog } from '../model/permission-types';
import type {
  AdminPermissionAssignment,
  PermissionAuditEvent,
  RoleKey
} from '../model/permission-types';

import { PageTitle } from '../../../shared/ui/page-title/page-title';

const { Paragraph, Text, Title } = Typography;

type PermissionModalMode = 'grant' | 'update' | 'revoke';

type PermissionModalState = {
  mode: PermissionModalMode;
  adminId: string;
} | null;

type PermissionFormValues = {
  role: RoleKey;
  permissionKeys: string[];
  reason: string;
};

const CURRENT_ACTOR = 'admin_park';

function formatRiskTag(risk: string): JSX.Element {
  if (risk === 'high') {
    return <Tag color="volcano">High</Tag>;
  }
  if (risk === 'medium') {
    return <Tag color="gold">Medium</Tag>;
  }
  return <Tag color="green">Low</Tag>;
}

export default function SystemPermissionsPage(): JSX.Element {
  const admins = usePermissionStore((state) => state.admins);
  const audits = usePermissionStore((state) => state.audits);
  const grantPermissions = usePermissionStore((state) => state.grantPermissions);
  const updatePermissions = usePermissionStore((state) => state.updatePermissions);
  const revokePermissions = usePermissionStore((state) => state.revokePermissions);

  const [modalState, setModalState] = useState<PermissionModalState>(null);
  const [messageApi, contextHolder] = message.useMessage();
  const [notificationApi, notificationContextHolder] = notification.useNotification();
  const [form] = Form.useForm<PermissionFormValues>();

  const selectedAdmin = useMemo(() => {
    if (!modalState) {
      return null;
    }
    return admins.find((item) => item.adminId === modalState.adminId) ?? null;
  }, [admins, modalState]);

  const roleOptions = useMemo(
    () =>
      roleCatalog.map((role) => ({
        label: `${role.name} (${role.key})`,
        value: role.key
      })),
    []
  );

  const permissionOptions = useMemo(
    () =>
      permissionCatalog.map((permission) => ({
        label: `${permission.name} (${permission.key})`,
        value: permission.key
      })),
    []
  );

  const watchedPermissionKeys = Form.useWatch('permissionKeys', form);
  const selectedPermissionKeys = useMemo(
    () => watchedPermissionKeys ?? [],
    [watchedPermissionKeys]
  );

  const selectedPermissionDescriptions = useMemo(
    () =>
      permissionCatalog.filter((permission) =>
        selectedPermissionKeys.includes(permission.key)
      ),
    [selectedPermissionKeys]
  );

  const openModal = useCallback(
    (mode: PermissionModalMode, admin: AdminPermissionAssignment) => {
      setModalState({ mode, adminId: admin.adminId });

      if (mode === 'grant') {
        const available = permissionCatalog
          .map((permission) => permission.key)
          .filter((key) => !admin.permissions.includes(key));
        form.setFieldsValue({
          role: admin.role,
          permissionKeys: available.slice(0, Math.min(2, available.length)),
          reason: ''
        });
        return;
      }

      if (mode === 'update') {
        form.setFieldsValue({
          role: admin.role,
          permissionKeys: admin.permissions,
          reason: ''
        });
        return;
      }

      form.setFieldsValue({
        role: admin.role,
        permissionKeys: admin.permissions.slice(0, Math.min(2, admin.permissions.length)),
        reason: ''
      });
    },
    [form]
  );

  const closeModal = useCallback(() => {
    setModalState(null);
    form.resetFields();
  }, [form]);

  const applyRoleDefaults = useCallback(() => {
    const role = form.getFieldValue('role') as RoleKey | undefined;
    if (!role) {
      return;
    }
    const roleDef = roleCatalog.find((item) => item.key === role);
    if (!roleDef) {
      return;
    }
    form.setFieldValue('permissionKeys', roleDef.defaultPermissions);
  }, [form]);

  const handleSubmit = useCallback(async () => {
    if (!modalState || !selectedAdmin) {
      return;
    }

    const values = await form.validateFields();
    const reason = values.reason.trim();

    let result: PermissionAuditEvent | null = null;

    if (modalState.mode === 'grant') {
      result = grantPermissions({
        adminId: selectedAdmin.adminId,
        permissionKeys: values.permissionKeys,
        reason,
        changedBy: CURRENT_ACTOR
      });
    }

    if (modalState.mode === 'update') {
      result = updatePermissions({
        adminId: selectedAdmin.adminId,
        role: values.role,
        permissionKeys: values.permissionKeys,
        reason,
        changedBy: CURRENT_ACTOR
      });
    }

    if (modalState.mode === 'revoke') {
      result = revokePermissions({
        adminId: selectedAdmin.adminId,
        permissionKeys: values.permissionKeys,
        reason,
        changedBy: CURRENT_ACTOR
      });
    }

    if (!result) {
      messageApi.warning('변경 사항이 없거나 처리할 대상이 없습니다.');
      return;
    }

    notificationApi.success({
      message: `${result.action} 완료`,
      description: (
        <Space direction="vertical">
          <Text>대상 유형: {getTargetTypeLabel(result.targetType)}</Text>
          <Text>대상 ID: {result.targetId}</Text>
          <Text>사유/근거: {result.reason}</Text>
          <AuditLogLink targetType={result.targetType} targetId={result.targetId} />
        </Space>
      )
    });
    closeModal();
  }, [
    closeModal,
    form,
    grantPermissions,
    messageApi,
    modalState,
    notificationApi,
    revokePermissions,
    selectedAdmin,
    updatePermissions
  ]);

  const adminColumns = useMemo<TableColumnsType<AdminPermissionAssignment>>(
    () => [
      { title: '관리자 ID', dataIndex: 'adminId', width: 150 },
      { title: '이름', dataIndex: 'name', width: 120 },
      {
        title: '상태',
        dataIndex: 'status',
        width: 90,
        render: (status: string) => <StatusBadge status={status} />
      },
      { title: '역할', dataIndex: 'role', width: 120 },
      {
        title: '권한 수',
        width: 90,
        align: 'right',
        render: (_, record) => record.permissions.length
      },
      { title: '최근 수정', dataIndex: 'updatedAt', width: 170 },
      {
        title: '액션',
        key: 'actions',
        width: 140,
        render: (_, record) => (
          <TableActionMenu
            items={[
              {
                key: `grant-${record.adminId}`,
                label: '권한 부여',
                onClick: () => openModal('grant', record)
              },
              {
                key: `update-${record.adminId}`,
                label: '권한 수정',
                onClick: () => openModal('update', record)
              },
              {
                key: `revoke-${record.adminId}`,
                label: '권한 회수',
                danger: true,
                onClick: () => openModal('revoke', record)
              }
            ]}
          />
        )
      }
    ],
    [openModal]
  );

  const roleColumns = useMemo<TableColumnsType<(typeof roleCatalog)[number]>>(
    () => [
      { title: '역할 코드', dataIndex: 'key', width: 140 },
      { title: '역할명', dataIndex: 'name', width: 140 },
      { title: '설명', dataIndex: 'description' },
      {
        title: '기본 권한 수',
        width: 120,
        align: 'right',
        render: (_, role) => role.defaultPermissions.length
      }
    ],
    []
  );

  const permissionColumns = useMemo<TableColumnsType<(typeof permissionCatalog)[number]>>(
    () => [
      { title: '권한 코드', dataIndex: 'key', width: 220 },
      { title: '권한명', dataIndex: 'name', width: 160 },
      { title: '모듈', dataIndex: 'module', width: 100 },
      { title: '권한 범위 설명', dataIndex: 'scopeDescription' },
      {
        title: '위험도',
        dataIndex: 'risk',
        width: 100,
        render: (risk: string) => formatRiskTag(risk)
      }
    ],
    []
  );

  const modalTitle = useMemo(() => {
    if (!modalState || !selectedAdmin) {
      return '';
    }
    if (modalState.mode === 'grant') {
      return `권한 부여 - ${selectedAdmin.adminId}`;
    }
    if (modalState.mode === 'update') {
      return `권한 수정 - ${selectedAdmin.adminId}`;
    }
    return `권한 회수 - ${selectedAdmin.adminId}`;
  }, [modalState, selectedAdmin]);

  return (
    <div>
      {contextHolder}
      {notificationContextHolder}
      <PageTitle title="권한 관리" />
      <Paragraph className="page-description">
        관리자 권한은 부여/수정/회수할 수 있으며, 모든 변경은 사유와 함께 감사 로그로
        추적됩니다.
      </Paragraph>

      <Card style={{ marginBottom: 12 }}>
        <Title level={5} style={{ marginTop: 0 }}>
          관리자별 권한 부여 상태
        </Title>
        <Table
          rowKey="adminId"
          size="small"
          pagination={false}
          scroll={{ x: 1200 }}
          columns={adminColumns}
          dataSource={admins}
        />
      </Card>

      <Card style={{ marginBottom: 12 }}>
        <Title level={5} style={{ marginTop: 0 }}>
          역할 템플릿
        </Title>
        <Table
          rowKey="key"
          size="small"
          pagination={false}
          columns={roleColumns}
          dataSource={roleCatalog}
        />
      </Card>

      <Card>
        <Title level={5} style={{ marginTop: 0 }}>
          권한별 범위 설명
        </Title>
        <Paragraph type="secondary">
          각 권한마다 접근 가능한 화면과 액션 범위를 확인하고, 부여 시 운영 영향을 검토하세요.
        </Paragraph>
        <Table
          rowKey="key"
          size="small"
          pagination={false}
          scroll={{ x: 1400 }}
          columns={permissionColumns}
          dataSource={permissionCatalog}
        />
      </Card>

      <Card style={{ marginTop: 12 }}>
        <Title level={5} style={{ marginTop: 0 }}>
          최근 권한 변경 이력
        </Title>
        <Table
          rowKey="id"
          size="small"
          pagination={false}
          columns={[
            { title: '로그 ID', dataIndex: 'id', width: 130 },
            { title: '대상', dataIndex: 'targetId', width: 140 },
            { title: '액션', dataIndex: 'action', width: 100 },
            { title: '사유', dataIndex: 'reason' },
            { title: '수행자', dataIndex: 'changedBy', width: 120 },
            { title: '시각', dataIndex: 'createdAt', width: 170 }
          ]}
          dataSource={audits.slice(0, 8)}
        />
      </Card>

      <Modal
        open={Boolean(modalState && selectedAdmin)}
        title={modalTitle}
        okText={
          modalState?.mode === 'grant'
            ? '부여 실행'
            : modalState?.mode === 'update'
              ? '수정 적용'
              : '회수 실행'
        }
        cancelText="취소"
        onCancel={closeModal}
        onOk={handleSubmit}
        okButtonProps={{ danger: modalState?.mode === 'revoke' }}
        width={760}
        destroyOnClose
      >
        {selectedAdmin ? (
          <Form form={form} layout="vertical">
            <Alert
              type={modalState?.mode === 'revoke' ? 'warning' : 'info'}
              showIcon
              style={{ marginBottom: 12 }}
              message={
                modalState?.mode === 'grant'
                  ? '권한 부여 확인'
                  : modalState?.mode === 'update'
                    ? '권한 수정 확인'
                    : '권한 회수 확인'
              }
              description={`대상 유형: ${getTargetTypeLabel('Admin')} / 대상 ID: ${selectedAdmin.adminId}`}
            />

            <Form.Item label="대상 관리자">
              <Text>
                {selectedAdmin.adminId} / {selectedAdmin.name}
              </Text>
            </Form.Item>

            <Form.Item
              label="역할"
              name="role"
              rules={[{ required: true, message: '역할을 선택하세요.' }]}
            >
              <Select
                options={roleOptions}
                disabled={modalState?.mode === 'grant' || modalState?.mode === 'revoke'}
              />
            </Form.Item>

            {modalState?.mode === 'update' ? (
              <Form.Item>
                <Button onClick={applyRoleDefaults}>선택한 역할의 기본 권한 불러오기</Button>
              </Form.Item>
            ) : null}

            <Form.Item
              label={
                modalState?.mode === 'grant'
                  ? '부여할 권한'
                  : modalState?.mode === 'update'
                    ? '권한 목록'
                    : '회수할 권한'
              }
              name="permissionKeys"
              rules={[{ required: true, message: '권한을 1개 이상 선택하세요.' }]}
            >
              <Checkbox.Group
                options={
                  modalState?.mode === 'grant'
                    ? permissionOptions.filter(
                        (option) => !selectedAdmin.permissions.includes(option.value)
                      )
                    : modalState?.mode === 'revoke'
                      ? permissionOptions.filter((option) =>
                          selectedAdmin.permissions.includes(option.value)
                        )
                      : permissionOptions
                }
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(2, minmax(260px, 1fr))',
                  gap: 8
                }}
              />
            </Form.Item>

            <Form.Item
              label="사유/근거"
              name="reason"
              rules={[{ required: true, message: '변경 사유를 입력하세요.' }]}
            >
              <Typography.Paragraph style={{ marginBottom: 8 }} type="secondary">
                권한 변경 내역은 감사 로그에 기록됩니다.
              </Typography.Paragraph>
              <Input.TextArea rows={4} placeholder="권한 변경 사유를 입력하세요." />
            </Form.Item>

            {selectedPermissionDescriptions.length > 0 ? (
              <Card size="small" title="선택 권한 범위 미리보기">
                <Space direction="vertical">
                  {selectedPermissionDescriptions.map((permission) => (
                    <Text key={permission.key}>
                      • {permission.name}: {permission.scopeDescription}
                    </Text>
                  ))}
                </Space>
              </Card>
            ) : null}
          </Form>
        ) : null}
      </Modal>
    </div>
  );
}
