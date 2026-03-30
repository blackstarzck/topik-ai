import {
  Alert,
  Button,
  Card,
  Checkbox,
  Descriptions,
  Form,
  Input,
  Modal,
  Select,
  Space,
  Tag,
  Typography,
  message,
  notification
} from 'antd';
import type { TableColumnsType } from 'antd';
import { useCallback, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';

import { getTargetTypeLabel } from '../../../shared/model/target-type-label';
import { AuditLogLink } from '../../../shared/ui/audit-log-link/audit-log-link';
import { markRequiredDescriptionItems } from '../../../shared/ui/descriptions/description-label';
import { PageTitle } from '../../../shared/ui/page-title/page-title';
import { StatusBadge } from '../../../shared/ui/status-badge/status-badge';
import { AdminDataTable } from '../../../shared/ui/table/admin-data-table';
import { TableActionMenu } from '../../../shared/ui/table/table-action-menu';
import { createTextSorter } from '../../../shared/ui/table/table-column-utils';
import { TableRowDetailModal } from '../../../shared/ui/table/table-row-detail-modal';
import { usePermissionStore } from '../model/permission-store';
import { permissionCatalog, roleCatalog } from '../model/permission-types';
import type {
  AdminPermissionAssignment,
  PermissionAuditEvent,
  PermissionDefinition,
  RoleDefinition,
  RoleKey
} from '../model/permission-types';

const { Paragraph, Text, Title } = Typography;

const CURRENT_ACTOR = 'admin_park';

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

type DetailModalState =
  | {
      title: string;
      record: Record<string, unknown>;
    }
  | null;

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
  const [detailModalState, setDetailModalState] = useState<DetailModalState>(null);
  const [messageApi, messageContextHolder] = message.useMessage();
  const [notificationApi, notificationContextHolder] = notification.useNotification();
  const [form] = Form.useForm<PermissionFormValues>();

  const permissionNameMap = useMemo(
    () => Object.fromEntries(permissionCatalog.map((permission) => [permission.key, permission.name])),
    []
  );

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
  const selectedPermissionDescriptions = useMemo(
    () =>
      permissionCatalog.filter((permission) =>
        (watchedPermissionKeys ?? []).includes(permission.key)
      ),
    [watchedPermissionKeys]
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

  const openDetailModal = useCallback((title: string, record: Record<string, unknown>) => {
    setDetailModalState({ title, record });
  }, []);

  const applyRoleDefaults = useCallback(() => {
    const role = form.getFieldValue('role') as RoleKey | undefined;
    const roleDefinition = roleCatalog.find((item) => item.key === role);
    if (!roleDefinition) {
      return;
    }

    form.setFieldValue('permissionKeys', roleDefinition.defaultPermissions);
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
    } else if (modalState.mode === 'update') {
      result = updatePermissions({
        adminId: selectedAdmin.adminId,
        role: values.role,
        permissionKeys: values.permissionKeys,
        reason,
        changedBy: CURRENT_ACTOR
      });
    } else {
      result = revokePermissions({
        adminId: selectedAdmin.adminId,
        permissionKeys: values.permissionKeys,
        reason,
        changedBy: CURRENT_ACTOR
      });
    }

    if (!result) {
      messageApi.warning('\ubcc0\uacbd \uc0ac\ud56d\uc774 \uc5c6\uac70\ub098 \ucc98\ub9ac\ud560 \ub300\uc0c1\uc774 \uc5c6\uc2b5\ub2c8\ub2e4.');
      return;
    }

    notificationApi.success({
      message: `${result.action} \uc644\ub8cc`,
      description: (
        <Space direction="vertical">
          <Text>\ub300\uc0c1 \uc720\ud615: {getTargetTypeLabel(result.targetType)}</Text>
          <Text>\ub300\uc0c1 ID: {result.targetId}</Text>
          <Text>\uc0ac\uc720/\uadfc\uac70: {result.reason}</Text>
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
      {
        title: '\uad00\ub9ac\uc790 ID',
        dataIndex: 'adminId',
        width: 140,
        sorter: createTextSorter((record) => record.adminId),
        render: (adminId: string) => (
          <Link
            className="table-navigation-link"
            to={`/system/audit-logs?targetType=Admin&targetId=${adminId}`}
            onClick={(event) => event.stopPropagation()}
          >
            {adminId}
          </Link>
        )
      },
      {
        title: '\uc774\ub984',
        dataIndex: 'name',
        width: 120,
        sorter: createTextSorter((record) => record.name)
      },
      {
        title: '\uc0c1\ud0dc',
        dataIndex: 'status',
        width: 100,
        sorter: createTextSorter((record) => record.status),
        render: (status: string) => <StatusBadge status={status} />
      },
      {
        title: '\uc5ed\ud560',
        dataIndex: 'role',
        width: 150,
        sorter: createTextSorter((record) => record.role),
        render: (role: RoleKey) => roleCatalog.find((item) => item.key === role)?.name ?? role
      },
      {
        title: '\uad8c\ud55c \uc218',
        key: 'permissionCount',
        width: 90,
        sorter: createTextSorter((record) => String(record.permissions.length)),
        render: (_, record) => record.permissions.length
      },
      {
        title: '\ucd5c\uadfc \uc218\uc815',
        dataIndex: 'updatedAt',
        width: 170,
        sorter: createTextSorter((record) => record.updatedAt)
      },
      {
        title: '\uc561\uc158',
        key: 'actions',
        width: 120,
        onCell: () => ({
          onClick: (event) => event.stopPropagation()
        }),
        render: (_, record) => (
          <TableActionMenu
            items={[
              {
                key: `grant-${record.adminId}`,
                label: '\uad8c\ud55c \ubd80\uc5ec',
                onClick: () => openModal('grant', record)
              },
              {
                key: `update-${record.adminId}`,
                label: '\uad8c\ud55c \uc218\uc815',
                onClick: () => openModal('update', record)
              },
              {
                key: `revoke-${record.adminId}`,
                label: '\uad8c\ud55c \ud68c\uc218',
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

  const roleColumns = useMemo<TableColumnsType<RoleDefinition>>(
    () => [
      {
        title: '\uc5ed\ud560 \ucf54\ub4dc',
        dataIndex: 'key',
        width: 150,
        sorter: createTextSorter((record) => record.key)
      },
      {
        title: '\uc5ed\ud560\uba85',
        dataIndex: 'name',
        width: 150,
        sorter: createTextSorter((record) => record.name)
      },
      {
        title: '\uc124\uba85',
        dataIndex: 'description',
        sorter: createTextSorter((record) => record.description)
      },
      {
        title: '\uae30\ubcf8 \uad8c\ud55c \uc218',
        width: 120,
        sorter: createTextSorter((record) => String(record.defaultPermissions.length)),
        render: (_, role) => role.defaultPermissions.length
      }
    ],
    []
  );

  const permissionColumns = useMemo<TableColumnsType<PermissionDefinition>>(
    () => [
      {
        title: '\uad8c\ud55c \ucf54\ub4dc',
        dataIndex: 'key',
        width: 240,
        sorter: createTextSorter((record) => record.key)
      },
      {
        title: '\uad8c\ud55c\uba85',
        dataIndex: 'name',
        width: 180,
        sorter: createTextSorter((record) => record.name)
      },
      {
        title: '\ubaa8\ub4c8',
        dataIndex: 'module',
        width: 100,
        sorter: createTextSorter((record) => record.module)
      },
      {
        title: '\uad8c\ud55c \ubc94\uc704 \uc124\uba85',
        dataIndex: 'scopeDescription',
        sorter: createTextSorter((record) => record.scopeDescription)
      },
      {
        title: '\uc704\ud5d8\ub3c4',
        dataIndex: 'risk',
        width: 100,
        sorter: createTextSorter((record) => record.risk),
        render: (risk: string) => formatRiskTag(risk)
      }
    ],
    []
  );

  const auditColumns = useMemo<TableColumnsType<PermissionAuditEvent>>(
    () => [
      {
        title: '\ub85c\uadf8 ID',
        dataIndex: 'id',
        width: 130,
        sorter: createTextSorter((record) => record.id)
      },
      {
        title: '\ub300\uc0c1',
        dataIndex: 'targetId',
        width: 140,
        sorter: createTextSorter((record) => record.targetId),
        render: (targetId: string) => (
          <Link
            className="table-navigation-link"
            to={`/system/audit-logs?targetType=Admin&targetId=${targetId}`}
            onClick={(event) => event.stopPropagation()}
          >
            {targetId}
          </Link>
        )
      },
      {
        title: '\uc870\uce58',
        dataIndex: 'action',
        width: 110,
        sorter: createTextSorter((record) => record.action)
      },
      {
        title: '\uc0ac\uc720/\uadfc\uac70',
        dataIndex: 'reason',
        sorter: createTextSorter((record) => record.reason)
      },
      {
        title: '\uc218\ud589\uc790',
        dataIndex: 'changedBy',
        width: 120,
        sorter: createTextSorter((record) => record.changedBy)
      },
      {
        title: '\uc2dc\uac01',
        dataIndex: 'createdAt',
        width: 170,
        sorter: createTextSorter((record) => record.createdAt)
      }
    ],
    []
  );

  const modalTitle = useMemo(() => {
    if (!modalState || !selectedAdmin) {
      return '';
    }

    if (modalState.mode === 'grant') {
      return `\uad8c\ud55c \ubd80\uc5ec - ${selectedAdmin.adminId}`;
    }
    if (modalState.mode === 'update') {
      return `\uad8c\ud55c \uc218\uc815 - ${selectedAdmin.adminId}`;
    }
    return `\uad8c\ud55c \ud68c\uc218 - ${selectedAdmin.adminId}`;
  }, [modalState, selectedAdmin]);

  const recentAuditRows = useMemo(() => audits.slice(0, 8), [audits]);

  return (
    <div>
      {messageContextHolder}
      {notificationContextHolder}
      <PageTitle title="\uad8c\ud55c \uad00\ub9ac" />

      <Card style={{ marginBottom: 12 }}>
        <Title level={5} style={{ marginTop: 0 }}>
          \uad00\ub9ac\uc790\ubcc4 \uad8c\ud55c \ubd80\uc5ec \uc0c1\ud0dc
        </Title>
        <Paragraph type="secondary">
          \uc6b4\uc601 \ud750\ub984\uc740 \uad00\ub9ac\uc790 \uc870\ud68c - \uad8c\ud55c \uc870\uce58 - \uac10\uc0ac \ub85c\uadf8 \ud655\uc778 \uc21c\uc11c\ub97c \uae30\ubcf8\uc73c\ub85c \uc720\uc9c0\ud569\ub2c8\ub2e4.
        </Paragraph>
        <AdminDataTable
          rowKey="adminId"
          pagination={false}
          scroll={{ x: 1200 }}
          columns={adminColumns}
          dataSource={admins}
          onRow={(record) => ({
            onClick: () =>
              openDetailModal('\uad00\ub9ac\uc790 \uad8c\ud55c \uc0c1\uc138', {
                ...record,
                roleName: roleCatalog.find((role) => role.key === record.role)?.name ?? record.role,
                permissionNames: record.permissions.map((permission) => permissionNameMap[permission])
              }),
            style: { cursor: 'pointer' }
          })}
        />
      </Card>

      <Card style={{ marginBottom: 12 }}>
        <Title level={5} style={{ marginTop: 0 }}>
          \uc5ed\ud560 \ud15c\ud50c\ub9bf
        </Title>
        <AdminDataTable<RoleDefinition>
          rowKey="key"
          pagination={false}
          columns={roleColumns}
          dataSource={roleCatalog}
          onRow={(record) => ({
            onClick: () =>
              openDetailModal('\uc5ed\ud560 \ud15c\ud50c\ub9bf \uc0c1\uc138', {
                ...record,
                defaultPermissionNames: record.defaultPermissions.map(
                  (permission) => permissionNameMap[permission]
                )
              }),
            style: { cursor: 'pointer' }
          })}
        />
      </Card>

      <Card style={{ marginBottom: 12 }}>
        <Title level={5} style={{ marginTop: 0 }}>
          \uad8c\ud55c \uc815\uc758
        </Title>
        <Paragraph type="secondary">
          \uad8c\ud55c \uc815\uc758\ub294 \uba54\ub274 \ub178\ucd9c, \uc870\uce58 \uac00\ub2a5 \uc5ec\ubd80, \uac10\uc0ac \ub85c\uadf8 \uac80\uc99d \uacbd\ub85c\ub97c \ud568\uaed8 \uad00\ub9ac\ud569\ub2c8\ub2e4.
        </Paragraph>
        <AdminDataTable<PermissionDefinition>
          rowKey="key"
          pagination={false}
          scroll={{ x: 1400 }}
          columns={permissionColumns}
          dataSource={permissionCatalog}
          onRow={(record) => ({
            onClick: () => openDetailModal('\uad8c\ud55c \uc815\uc758 \uc0c1\uc138', record),
            style: { cursor: 'pointer' }
          })}
        />
      </Card>

      <Card>
        <Title level={5} style={{ marginTop: 0 }}>
          \ucd5c\uadfc \uad8c\ud55c \ubcc0\uacbd \uc774\ub825
        </Title>
        <AdminDataTable<PermissionAuditEvent>
          rowKey="id"
          pagination={false}
          columns={auditColumns}
          dataSource={recentAuditRows}
          onRow={(record) => ({
            onClick: () =>
              openDetailModal('\uad8c\ud55c \ubcc0\uacbd \uc774\ub825 \uc0c1\uc138', {
                ...record,
                beforePermissionNames: record.beforePermissions.map(
                  (permission) => permissionNameMap[permission]
                ),
                afterPermissionNames: record.afterPermissions.map(
                  (permission) => permissionNameMap[permission]
                )
              }),
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
        open={Boolean(modalState && selectedAdmin)}
        title={modalTitle}
        okText={
          modalState?.mode === 'grant'
            ? '\ubd80\uc5ec \uc2e4\ud589'
            : modalState?.mode === 'update'
              ? '\uc218\uc815 \uc801\uc6a9'
              : '\ud68c\uc218 \uc2e4\ud589'
        }
        cancelText="\ucde8\uc18c"
        onCancel={closeModal}
        onOk={() => void handleSubmit()}
        okButtonProps={{ danger: modalState?.mode === 'revoke' }}
        width={760}
        destroyOnHidden
      >
        {selectedAdmin ? (
          <Form<PermissionFormValues> form={form}>
            <Alert
              type={modalState?.mode === 'revoke' ? 'warning' : 'info'}
              showIcon
              style={{ marginBottom: 12 }}
              message={
                modalState?.mode === 'grant'
                  ? '\uad8c\ud55c \ubd80\uc5ec \ud655\uc778'
                  : modalState?.mode === 'update'
                    ? '\uad8c\ud55c \uc218\uc815 \ud655\uc778'
                    : '\uad8c\ud55c \ud68c\uc218 \ud655\uc778'
              }
              description={`\ub300\uc0c1 \uc720\ud615: ${getTargetTypeLabel('Admin')} / \ub300\uc0c1 ID: ${selectedAdmin.adminId}`}
            />

            <Descriptions
              bordered
              size="small"
              column={1}
              className="admin-form-descriptions"
              items={markRequiredDescriptionItems(
                [
                  {
                    key: 'admin',
                    label: '\ub300\uc0c1 \uad00\ub9ac\uc790',
                    children: (
                      <Text>
                        {selectedAdmin.adminId} / {selectedAdmin.name}
                      </Text>
                    )
                  },
                  {
                    key: 'role',
                    label: '\uc5ed\ud560',
                    children: (
                      <Form.Item
                        name="role"
                        rules={[{ required: true, message: '\uc5ed\ud560\uc744 \uc120\ud0dd\ud574 \uc8fc\uc138\uc694.' }]}
                      >
                        <Select
                          options={roleOptions}
                          disabled={modalState?.mode === 'grant' || modalState?.mode === 'revoke'}
                        />
                      </Form.Item>
                    )
                  },
                  ...(modalState?.mode === 'update'
                    ? [
                        {
                          key: 'roleDefaults',
                          label: '\uae30\ubcf8 \uad8c\ud55c',
                          children: (
                            <Button onClick={applyRoleDefaults}>
                              \uc120\ud0dd\ud55c \uc5ed\ud560\uc758 \uae30\ubcf8 \uad8c\ud55c \ubd88\ub7ec\uc624\uae30
                            </Button>
                          )
                        }
                      ]
                    : []),
                  {
                    key: 'permissionKeys',
                    label:
                      modalState?.mode === 'grant'
                        ? '\ubd80\uc5ec\ud560 \uad8c\ud55c'
                        : modalState?.mode === 'update'
                          ? '\uad8c\ud55c \ubaa9\ub85d'
                          : '\ud68c\uc218\ud560 \uad8c\ud55c',
                    children: (
                      <Form.Item
                        name="permissionKeys"
                        rules={[{ required: true, message: '\uad8c\ud55c\uc744 1\uac1c \uc774\uc0c1 \uc120\ud0dd\ud574 \uc8fc\uc138\uc694.' }]}
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
                    )
                  },
                  {
                    key: 'reason',
                    label: '\uc0ac\uc720/\uadfc\uac70',
                    children: (
                      <Form.Item
                        name="reason"
                        rules={[{ required: true, message: '\ubcc0\uacbd \uc0ac\uc720\ub97c \uc785\ub825\ud574 \uc8fc\uc138\uc694.' }]}
                      >
                        <div>
                          <Paragraph style={{ marginBottom: 8 }} type="secondary">
                            \uad8c\ud55c \ubcc0\uacbd \ub0b4\uc5ed\uc740 \uac10\uc0ac \ub85c\uadf8\uc5d0 \uae30\ub85d\ub429\ub2c8\ub2e4.
                          </Paragraph>
                          <Input.TextArea
                            rows={4}
                            placeholder="\uad8c\ud55c \ubcc0\uacbd \uc0ac\uc720\ub97c \uc785\ub825\ud574 \uc8fc\uc138\uc694."
                          />
                        </div>
                      </Form.Item>
                    )
                  }
                ],
                ['role', 'permissionKeys', 'reason']
              )}
            />

            {selectedPermissionDescriptions.length > 0 ? (
              <Card
                size="small"
                title="\uc120\ud0dd \uad8c\ud55c \ubc94\uc704 \ubbf8\ub9ac\ubcf4\uae30"
                style={{ marginTop: 12 }}
              >
                <Space direction="vertical">
                  {selectedPermissionDescriptions.map((permission) => (
                    <Text key={permission.key}>
                      {permission.name}: {permission.scopeDescription}
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
