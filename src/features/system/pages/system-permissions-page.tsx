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
      {
        title: '관리자 ID',
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
        title: '이름',
        dataIndex: 'name',
        width: 120,
        sorter: createTextSorter((record) => record.name)
      },
      {
        title: '상태',
        dataIndex: 'status',
        width: 100,
        sorter: createTextSorter((record) => record.status),
        render: (status: string) => <StatusBadge status={status} />
      },
      {
        title: '역할',
        dataIndex: 'role',
        width: 150,
        sorter: createTextSorter((record) => record.role),
        render: (role: RoleKey) => roleCatalog.find((item) => item.key === role)?.name ?? role
      },
      {
        title: '권한 수',
        key: 'permissionCount',
        width: 90,
        sorter: createTextSorter((record) => String(record.permissions.length)),
        render: (_, record) => record.permissions.length
      },
      {
        title: '최근 수정',
        dataIndex: 'updatedAt',
        width: 170,
        sorter: createTextSorter((record) => record.updatedAt)
      },
      {
        title: '액션',
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

  const roleColumns = useMemo<TableColumnsType<RoleDefinition>>(
    () => [
      {
        title: '역할 코드',
        dataIndex: 'key',
        width: 150,
        sorter: createTextSorter((record) => record.key)
      },
      {
        title: '역할명',
        dataIndex: 'name',
        width: 150,
        sorter: createTextSorter((record) => record.name)
      },
      {
        title: '설명',
        dataIndex: 'description',
        sorter: createTextSorter((record) => record.description)
      },
      {
        title: '기본 권한 수',
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
        width: 100,
        sorter: createTextSorter((record) => record.module)
      },
      {
        title: '권한 범위 설명',
        dataIndex: 'scopeDescription',
        sorter: createTextSorter((record) => record.scopeDescription)
      },
      {
        title: '위험도',
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
        title: '로그 ID',
        dataIndex: 'id',
        width: 130,
        sorter: createTextSorter((record) => record.id)
      },
      {
        title: '대상',
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
        title: '조치',
        dataIndex: 'action',
        width: 110,
        sorter: createTextSorter((record) => record.action)
      },
      {
        title: '사유/근거',
        dataIndex: 'reason',
        sorter: createTextSorter((record) => record.reason)
      },
      {
        title: '수행자',
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
      return `권한 부여 - ${selectedAdmin.adminId}`;
    }
    if (modalState.mode === 'update') {
      return `권한 수정 - ${selectedAdmin.adminId}`;
    }
    return `권한 회수 - ${selectedAdmin.adminId}`;
  }, [modalState, selectedAdmin]);

  const recentAuditRows = useMemo(() => audits.slice(0, 8), [audits]);

  return (
    <div>
      {messageContextHolder}
      {notificationContextHolder}
      <PageTitle title="권한 관리" />

      <Card style={{ marginBottom: 12 }}>
        <Title level={5} style={{ marginTop: 0 }}>
          관리자별 권한 부여 상태
        </Title>
        <Paragraph type="secondary">
          운영 흐름은 관리자 조회 - 권한 조치 - 감사 로그 확인 순서를 기본으로 유지합니다.
        </Paragraph>
        <AdminDataTable
          rowKey="adminId"
          pagination={false}
          scroll={{ x: 1200 }}
          columns={adminColumns}
          dataSource={admins}
          onRow={(record) => ({
            onClick: () =>
              openDetailModal('관리자 권한 상세', {
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
          역할 템플릿
        </Title>
        <AdminDataTable<RoleDefinition>
          rowKey="key"
          pagination={false}
          columns={roleColumns}
          dataSource={roleCatalog}
          onRow={(record) => ({
            onClick: () =>
              openDetailModal('역할 템플릿 상세', {
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
          권한 정의
        </Title>
        <Paragraph type="secondary">
          권한 정의는 메뉴 노출, 조치 가능 여부, 감사 로그 검증 경로를 함께 관리합니다.
        </Paragraph>
        <AdminDataTable<PermissionDefinition>
          rowKey="key"
          pagination={false}
          scroll={{ x: 1400 }}
          columns={permissionColumns}
          dataSource={permissionCatalog}
          onRow={(record) => ({
            onClick: () => openDetailModal('권한 정의 상세', record),
            style: { cursor: 'pointer' }
          })}
        />
      </Card>

      <Card>
        <Title level={5} style={{ marginTop: 0 }}>
          최근 권한 변경 이력
        </Title>
        <AdminDataTable<PermissionAuditEvent>
          rowKey="id"
          pagination={false}
          columns={auditColumns}
          dataSource={recentAuditRows}
          onRow={(record) => ({
            onClick: () =>
              openDetailModal('권한 변경 이력 상세', {
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
            ? '부여 실행'
            : modalState?.mode === 'update'
              ? '수정 적용'
              : '회수 실행'
        }
        cancelText="취소"
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
                  ? '권한 부여 확인'
                  : modalState?.mode === 'update'
                    ? '권한 수정 확인'
                    : '권한 회수 확인'
              }
              description={`대상 유형: ${getTargetTypeLabel('Admin')} / 대상 ID: ${selectedAdmin.adminId}`}
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
                    label: '대상 관리자',
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
                        rules={[{ required: true, message: '역할을 선택해 주세요.' }]}
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
                          label: '기본 권한',
                          children: (
                            <Button onClick={applyRoleDefaults}>
                              선택한 역할의 기본 권한 불러오기
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
                          ? '권한 목록'
                          : '회수할 권한',
                    children: (
                      <Form.Item
                        name="permissionKeys"
                        rules={[{ required: true, message: '권한을 1개 이상 선택해 주세요.' }]}
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
                    label: '사유/근거',
                    children: (
                      <Form.Item
                        name="reason"
                        rules={[{ required: true, message: '변경 사유를 입력해 주세요.' }]}
                      >
                        <div>
                          <Paragraph style={{ marginBottom: 8 }} type="secondary">
                            권한 변경 내역은 감사 로그에 기록됩니다.
                          </Paragraph>
                          <Input.TextArea
                            rows={4}
                            placeholder="권한 변경 사유를 입력해 주세요."
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
                title="선택 권한 범위 미리보기"
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
