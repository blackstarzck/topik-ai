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
  Table,
  Tag,
  Typography,
  message,
  notification
} from 'antd';
import type { TableColumnsType } from 'antd';
import { useCallback, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';

import { AuditLogLink } from '../../../shared/ui/audit-log-link/audit-log-link';
import { StatusBadge } from '../../../shared/ui/status-badge/status-badge';
import { AdminDataTable } from '../../../shared/ui/table/admin-data-table';
import { TableActionMenu } from '../../../shared/ui/table/table-action-menu';
import { createStatusColumnTitle } from '../../../shared/ui/table/status-column-title';
import { getTargetTypeLabel } from '../../../shared/model/target-type-label';
import { usePermissionStore } from '../model/permission-store';
import { permissionCatalog, roleCatalog } from '../model/permission-types';
import type {
  AdminPermissionAssignment,
  PermissionAuditEvent,
  RoleKey
} from '../model/permission-types';

import { PageTitle } from '../../../shared/ui/page-title/page-title';
import {
  createDefinedColumnFilterProps,
  createNumberSorter,
  createTextSorter
} from '../../../shared/ui/table/table-column-utils';
import { TableRowDetailModal } from '../../../shared/ui/table/table-row-detail-modal';
import { markRequiredDescriptionItems } from '../../../shared/ui/descriptions/description-label';

const { Paragraph, Text, Title } = Typography;

const adminStatusFilterValues = ['활성', '비활성] as const;
const permissionAuditActionFilterValues = ['권한 부여, '권한 수정', '권한 회수'] as const;

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

type DetailModalState = {
  title: string;
  record: Record<string, unknown>;
} | null;

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
  const [detailModalState, setDetailModalState] = useState<DetailModalState>(null);
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

  const openDetailModal = useCallback(
    (title: string, record: Record<string, unknown>) => {
      setDetailModalState({ title, record });
    },
    []
  );

  const closeDetailModal = useCallback(() => setDetailModalState(null), []);

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
          <Text>대상?좏삎: {getTargetTypeLabel(result.targetType)}</Text>
          <Text>대상ID: {result.targetId}</Text>
          <Text>사유/洹쇨굅: {result.reason}</Text>
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
        title: '愿由ъ옄 ID',
        dataIndex: 'adminId',
        width: 150,
        sorter: createTextSorter((record) => record.adminId),
        render: (adminId: string) => (
          <Link
            className="table-navigation-link"
            to="/system/admins"
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
        sorter: createTextSorter((record) => record.name)
      },
      {
        title: createStatusColumnTitle('상태', ['활성', '비활성]),
        dataIndex: 'status',
        width: 90,
        ...createDefinedColumnFilterProps(adminStatusFilterValues, (record) => record.status),
        sorter: createTextSorter((record) => record.status),
        render: (status: string) => <StatusBadge status={status} />
      },
      {
        title: '역할',
        dataIndex: 'role',
        width: 120,
        ...createDefinedColumnFilterProps(
          roleCatalog.map((role) => role.key),
          (record) => record.role
        ),
        sorter: createTextSorter((record) => record.role)
      },
      {
        title: '권한 수,
        width: 90,
        sorter: createNumberSorter((record) => record.permissions.length),
        render: (_, record) => record.permissions.length
      },
      {
        title: '최근 수정',
        dataIndex: 'updatedAt',
        width: 170,
        sorter: createTextSorter((record) => record.updatedAt)
      },
      {
        title: '?≪뀡',
        key: 'actions',
        width: 140,
        onCell: () => ({
          onClick: (event) => {
            event.stopPropagation();
          }
        }),
        render: (_, record) => (
          <TableActionMenu
            items={[
              {
                key: `grant-${record.adminId}`,
                label: '권한 부여,
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
      {
        title: '역할 肄붾뱶',
        dataIndex: 'key',
        width: 140,
        sorter: createTextSorter((record) => record.key)
      },
      {
        title: '역할紐?,
        dataIndex: 'name',
        width: 140,
        sorter: createTextSorter((record) => record.name)
      },
      {
        title: '설명',
        dataIndex: 'description',
        sorter: createTextSorter((record) => record.description)
      },
      {
        title: '湲곕낯 권한 수,
        width: 120,
        sorter: createNumberSorter((record) => record.defaultPermissions.length),
        render: (_, role) => role.defaultPermissions.length
      }
    ],
    []
  );

  const permissionColumns = useMemo<TableColumnsType<(typeof permissionCatalog)[number]>>(
    () => [
      {
        title: '沅뚰븳 肄붾뱶',
        dataIndex: 'key',
        width: 220,
        sorter: createTextSorter((record) => record.key)
      },
      {
        title: '권한명,
        dataIndex: 'name',
        width: 160,
        sorter: createTextSorter((record) => record.name)
      },
      {
        title: '紐⑤뱢',
        dataIndex: 'module',
        width: 100,
        ...createDefinedColumnFilterProps(
          permissionCatalog.map((permission) => permission.module),
          (record) => record.module
        ),
        sorter: createTextSorter((record) => record.module)
      },
      {
        title: '沅뚰븳 踰붿쐞 설명',
        dataIndex: 'scopeDescription',
        sorter: createTextSorter((record) => record.scopeDescription)
      },
      {
        title: '위험도,
        dataIndex: 'risk',
        width: 100,
        ...createDefinedColumnFilterProps(['low', 'medium', 'high'], (record) => record.risk),
        sorter: createTextSorter((record) => record.risk),
        render: (risk: string) => formatRiskTag(risk)
      }
    ],
    []
  );

  const recentAuditRows = useMemo(() => audits.slice(0, 8), [audits]);

  const auditColumns = useMemo<TableColumnsType<(typeof recentAuditRows)[number]>>(
    () => [
      {
        title: '로그 ID',
        dataIndex: 'id',
        width: 130,
        sorter: createTextSorter((record) => record.id)
      },
      {
        title: '대상,
        dataIndex: 'targetId',
        width: 140,
        sorter: createTextSorter((record) => record.targetId),
        render: (targetId: string) => (
          <Link
            className="table-navigation-link"
            to="/system/admins"
            onClick={(event) => event.stopPropagation()}
          >
            {targetId}
          </Link>
        )
      },
      {
        title: '?≪뀡',
        dataIndex: 'action',
        width: 100,
        ...createDefinedColumnFilterProps(
          permissionAuditActionFilterValues,
          (record) => record.action
        ),
        sorter: createTextSorter((record) => record.action)
      },
      {
        title: '사유',
        dataIndex: 'reason',
        sorter: createTextSorter((record) => record.reason)
      },
      {
        title: '수행자,
        dataIndex: 'changedBy',
        width: 120,
        sorter: createTextSorter((record) => record.changedBy)
      },
      {
        title: '시각',
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
      return `권한 부여- ${selectedAdmin.adminId}`;
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
      <PageTitle title="권한 관리 />

      <Card style={{ marginBottom: 12 }}>
        <Title level={5} style={{ marginTop: 0 }}>
          愿由ъ옄蹂?권한 부여상태
        </Title>
        <AdminDataTable
          rowKey="adminId"
          showSorterTooltip={false}
          size="small"
          pagination={false}
          scroll={{ x: 1200 }}
          columns={adminColumns}
          dataSource={admins}
          onRow={(record) => ({
            onClick: () => openDetailModal('愿由ъ옄 沅뚰븳 상세 (?붾?)', record),
            style: { cursor: 'pointer' }
          })}
        />
      </Card>

      <Card style={{ marginBottom: 12 }}>
        <Title level={5} style={{ marginTop: 0 }}>
          역할 ?쒗뵆由?        </Title>
        <Table
          rowKey="key"
          showSorterTooltip={false}
          size="small"
          pagination={false}
          columns={roleColumns}
          dataSource={roleCatalog}
          onRow={(record) => ({
            onClick: () => openDetailModal('역할 ?쒗뵆由?상세 (?붾?)', record),
            style: { cursor: 'pointer' }
          })}
        />
      </Card>

      <Card>
        <Title level={5} style={{ marginTop: 0 }}>
          沅뚰븳蹂?踰붿쐞 설명
        </Title>
        <Paragraph type="secondary">
          媛?沅뚰븳留덈떎 ?묎렐 媛?ν븳 ?붾㈃怨??≪뀡 踰붿쐞瑜??뺤씤?섍퀬, 遺????운영 ?곹뼢??          寃?좏븯?몄슂.
        </Paragraph>
        <Table
          rowKey="key"
          showSorterTooltip={false}
          size="small"
          pagination={false}
          scroll={{ x: 1400 }}
          columns={permissionColumns}
          dataSource={permissionCatalog}
          onRow={(record) => ({
            onClick: () => openDetailModal('沅뚰븳 ?뺤쓽 상세 (?붾?)', record),
            style: { cursor: 'pointer' }
          })}
        />
      </Card>

      <Card style={{ marginTop: 12 }}>
        <Title level={5} style={{ marginTop: 0 }}>
          理쒓렐 沅뚰븳 蹂寃??대젰
        </Title>
        <Table
          rowKey="id"
          showSorterTooltip={false}
          size="small"
          pagination={false}
          columns={auditColumns}
          dataSource={recentAuditRows}
          onRow={(record) => ({
            onClick: () => openDetailModal('沅뚰븳 蹂寃??대젰 상세 (?붾?)', record),
            style: { cursor: 'pointer' }
          })}
        />
      </Card>

      <TableRowDetailModal
        open={Boolean(detailModalState)}
        title={detailModalState?.title ?? ''}
        record={detailModalState?.record ?? null}
        onClose={closeDetailModal}
      />

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
      destroyOnHidden
      >
        {selectedAdmin ? (
          <Form form={form}>
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
              description={`대상?좏삎: ${getTargetTypeLabel('Admin')} / 대상ID: ${selectedAdmin.adminId}`}
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
                    label: '대상愿由ъ옄',
                    children: (
                      <Text>
                        {selectedAdmin.adminId} / {selectedAdmin.name}
                      </Text>
                    )
                  },
                  {
                    key: 'role',
                    label: '역할',
                    children: (
                      <Form.Item
                        name="role"
                        rules={[{ required: true, message: '역할을 선택하세요.' }]}
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
                          label: '湲곕낯 沅뚰븳',
                          children: (
                            <Button onClick={applyRoleDefaults}>
                              ?좏깮??역할??湲곕낯 沅뚰븳 遺덈윭?ㅺ린
                            </Button>
                          )
                        }
                      ]
                    : []),
                  {
                    key: 'permissionKeys',
                    label:
                      modalState?.mode === 'grant'
                        ? '부여할 권한'
                        : modalState?.mode === 'update'
                          ? '沅뚰븳 紐⑸줉'
                          : '회수할 권한',
                    children: (
                      <Form.Item
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
                    )
                  },
                  {
                    key: 'reason',
                    label: '사유/洹쇨굅',
                    children: (
                      <Form.Item
                        name="reason"
                        rules={[{ required: true, message: '蹂寃?사유를 입력하세요.' }]}
                      >
                        <div>
                          <Typography.Paragraph style={{ marginBottom: 8 }} type="secondary">
                            沅뚰븳 蹂寃??댁뿭? 媛먯궗 로그??湲곕줉?⑸땲??
                          </Typography.Paragraph>
                          <Input.TextArea rows={4} placeholder="沅뚰븳 蹂寃?사유를 입력하세요." />
                        </div>
                      </Form.Item>
                    )
                  }
                ],
                ['role', 'permissionKeys', 'reason']
              )}
            />

            {selectedPermissionDescriptions.length > 0 ? (
              <Card size="small" title="?좏깮 沅뚰븳 踰붿쐞 誘몃━蹂닿린">
                <Space direction="vertical">
                  {selectedPermissionDescriptions.map((permission) => (
                    <Text key={permission.key}>
                      - {permission.name}: {permission.scopeDescription}
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


