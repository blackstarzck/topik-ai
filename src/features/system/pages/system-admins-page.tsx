import { Alert, Button, Form, Input, Modal, Select, Space, Typography, notification } from 'antd';
import type { TableColumnsType } from 'antd';
import { useCallback, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';

import { fetchSystemAdminsSafe } from '../api/system-admins-service';
import {
  inviteAdminSafe,
  type AdminAccountRole
} from '../api/admin-accounts-service';
import { useAsyncResource } from '@/shared/model/use-async-resource';
import { permissionCatalog, roleCatalog } from '../model/permission-types';
import type { AdminPermissionAssignment, RoleKey } from '../model/permission-types';
import { mapAppRoleToRoleKey, permissionKeysForRole } from '@/features/auth/model/app-role-mapping';
import { AdminListCard } from '@/shared/ui/list-page-card/admin-list-card';
import {
  isInitialSummaryLoad,
  ListSummaryCards
} from '@/shared/ui/list-summary-cards/list-summary-cards';
import { PageTitle } from '@/shared/ui/page-title/page-title';
import {
  SearchBar,
  SearchBarDateRange,
  SearchBarDetailField
} from '@/shared/ui/search-bar/search-bar';
import {
  matchesSearchDateRange,
  matchesSearchField,
  parseSearchDate
} from '@/shared/ui/search-bar/search-bar-utils';
import { useSearchBarDateDraft } from '@/shared/ui/search-bar/use-search-bar-date-draft';
import { StatusBadge } from '@/shared/ui/status-badge/status-badge';
import { AdminDataTable } from '@/shared/ui/table/admin-data-table';
import { TableRowDetailModal } from '@/shared/ui/table/table-row-detail-modal';
import { SPACE } from '@/shared/styles/design-tokens';
import {
  createNumberSorter,
  createTextSorter
} from '@/shared/ui/table/table-column-utils';

const { Paragraph, Text } = Typography;

const roleNameMap = Object.fromEntries(roleCatalog.map((role) => [role.key, role.name])) as Record<
  RoleKey,
  string
>;

const detailLabelMap: Record<string, string> = {
  adminId: '관리자 ID',
  name: '이름',
  roleName: '역할',
  permissionsCount: '권한 수',
  permissions: '권한 목록',
  lastLoginAt: '최근 로그인',
  status: '상태',
  updatedAt: '최근 수정',
  updatedBy: '수정 관리자'
};

const inviteRoleOptions: { label: string; value: AdminAccountRole }[] = [
  { label: '슈퍼 관리자 (platform_admin)', value: 'platform_admin' },
  { label: '콘텐츠 관리자 (content_admin)', value: 'content_admin' },
  { label: '기관 관리자 (org_admin)', value: 'org_admin' }
];

const invitePermissionOptions = permissionCatalog.map((permission) => ({
  label: `${permission.name} · ${permission.key}`,
  value: permission.key
}));

function templatePermissionKeys(role: AdminAccountRole): string[] {
  const roleKey = mapAppRoleToRoleKey(role);
  return roleKey ? permissionKeysForRole(roleKey) : [];
}

type InviteFormValues = { email: string; role: AdminAccountRole; permissionKeys: string[] };

/** 훅의 initialData 는 안정 참조로 둔다(렌더마다 새 배열을 만들지 않는다). */
const EMPTY_ADMINS: AdminPermissionAssignment[] = [];

export default function SystemAdminsPage(): JSX.Element {

  const [searchParams, setSearchParams] = useSearchParams();
  const [selectedRow, setSelectedRow] = useState<AdminPermissionAssignment | null>(null);
  const searchField = searchParams.get('searchField') ?? 'all';
  const keyword = searchParams.get('keyword') ?? '';
  const startDate = parseSearchDate(searchParams.get('startDate'));
  const endDate = parseSearchDate(searchParams.get('endDate'));
  const {
    draftStartDate,
    draftEndDate,
    handleDraftDateChange,
    handleDraftReset,
    handleDetailOpenChange
  } = useSearchBarDateDraft(startDate, endDate);

  const [notificationApi, notificationContextHolder] = notification.useNotification();
  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteSubmitting, setInviteSubmitting] = useState(false);
  const [inviteForm] = Form.useForm<InviteFormValues>();
  const inviteRole = Form.useWatch('role', inviteForm);

  const fetchAdmins = useCallback(
    (signal: AbortSignal) => fetchSystemAdminsSafe(signal),
    []
  );
  const {
    state: adminsState,
    reload: reloadAdmins
  } = useAsyncResource<AdminPermissionAssignment[]>(fetchAdmins, { initialData: EMPTY_ADMINS });
  const admins = adminsState.data;

  const handleInviteRoleChange = useCallback(
    (role: AdminAccountRole) => {
      inviteForm.setFieldValue(
        'permissionKeys',
        role === 'platform_admin' ? [] : templatePermissionKeys(role)
      );
    },
    [inviteForm]
  );

  const handleInviteSubmit = useCallback(async () => {
    let values: InviteFormValues;
    try {
      values = await inviteForm.validateFields();
    } catch {
      return;
    }
    const keys = values.role === 'platform_admin' ? [] : values.permissionKeys ?? [];
    setInviteSubmitting(true);
    const result = await inviteAdminSafe({
      email: values.email.trim().toLowerCase(),
      role: values.role,
      permissionKeys: keys
    });
    setInviteSubmitting(false);
    if (!result.ok) {
      notificationApi.error({ message: '관리자 초대 실패', description: result.error.message });
      return;
    }
    if (result.data.emailSent) {
      notificationApi.success({
        message: '관리자 초대 완료',
        description: `${values.email} 주소로 초대 메일을 보냈습니다. 수락 후 첫 로그인 시 활성화됩니다.`
      });
    } else {
      notificationApi.warning({
        message: '관리자 계정 생성됨 (메일 미발송)',
        description: `${values.email} 계정은 생성됐지만 초대 메일 발송에 실패했습니다${
          result.data.warning ? ` (${result.data.warning})` : ''
        }. SMTP 설정 확인 후 다시 초대하세요.`
      });
    }
    setInviteOpen(false);
    inviteForm.resetFields();
    reloadAdmins();
  }, [inviteForm, notificationApi, reloadAdmins]);

  const filteredRows = useMemo(() => {
    const normalizedKeyword = keyword.trim().toLowerCase();

    return admins.filter((record) => {
      if (!matchesSearchDateRange(record.lastLoginAt, startDate, endDate)) {
        return false;
      }
      if (!normalizedKeyword) {
        return true;
      }

      return matchesSearchField(normalizedKeyword, searchField, {
        adminId: record.adminId,
        name: record.name,
        role: roleNameMap[record.role]
      });
    });
  }, [admins, endDate, keyword, searchField, startDate]);

  const activeCount = admins.filter((admin) => admin.status === '활성').length;
  const inactiveCount = admins.filter((admin) => admin.status === '비활성').length;
  const contentManagerCount = admins.filter(
    (admin) => admin.role === 'CONTENT_MANAGER'
  ).length;

  const summaryItems = useMemo(
    () => [
      {
        key: 'all',
        label: '전체 관리자',
        value: `${admins.length.toLocaleString()}명`
      },
      {
        key: 'active',
        label: '활성 계정',
        value: `${activeCount.toLocaleString()}명`
      },
      {
        key: 'content',
        label: '콘텐츠 관리자',
        value: `${contentManagerCount.toLocaleString()}명`
      }
    ],
    [activeCount, admins.length, contentManagerCount]
  );

  const commitParams = useCallback(
    (
      next: Partial<Record<'keyword' | 'searchField' | 'startDate' | 'endDate', string | null>>
    ) => {
      const merged = new URLSearchParams(searchParams);
      Object.entries(next).forEach(([key, value]) => {
        if (!value || value === 'all') {
          merged.delete(key);
          return;
        }
        merged.set(key, value);
      });
      setSearchParams(merged, { replace: true });
    },
    [searchParams, setSearchParams]
  );

  const handleApplyDateRange = useCallback(() => {
    commitParams({
      startDate: draftStartDate || null,
      endDate: draftEndDate || null,
      keyword,
      searchField
    });
  }, [commitParams, draftEndDate, draftStartDate, keyword, searchField]);

  const selectedDetailRecord = useMemo(
    () =>
      selectedRow
        ? {
            ...selectedRow,
            roleName: roleNameMap[selectedRow.role],
            permissionsCount: selectedRow.permissions.length
          }
        : null,
    [selectedRow]
  );

  const columns = useMemo<TableColumnsType<AdminPermissionAssignment>>(
    () => [
      {
        title: '관리자 ID',
        dataIndex: 'adminId',
        width: 150,
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
        title: '역할',
        dataIndex: 'role',
        width: 160,
        sorter: createTextSorter((record) => roleNameMap[record.role]),
        render: (role: RoleKey) => roleNameMap[role]
      },
      {
        title: '권한 수',
        key: 'permissionsCount',
        width: 100,
        sorter: createNumberSorter((record) => record.permissions.length),
        render: (_, record) => record.permissions.length
      },
      {
        title: '최근 로그인',
        dataIndex: 'lastLoginAt',
        width: 180,
        sorter: createTextSorter((record) => record.lastLoginAt)
      },
      {
        title: '상태',
        dataIndex: 'status',
        width: 100,
        sorter: createTextSorter((record) => record.status),
        render: (status: string) => <StatusBadge status={status} />
      },
      {
        title: '관리',
        key: 'manage',
        width: 180,
        render: (_, record) => (
          <Link
            className="table-navigation-link"
            to={`/system/audit-logs?targetType=Admin&targetId=${record.adminId}`}
            onClick={(event) => event.stopPropagation()}
          >
            감사 로그 보기
          </Link>
        )
      }
    ],
    []
  );

  return (
    <div>
      {notificationContextHolder}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: SPACE.sm
        }}
      >
        <PageTitle title="관리자 계정" />
        <Button type="primary" onClick={() => setInviteOpen(true)}>
          관리자 초대
        </Button>
      </div>
      <ListSummaryCards
        items={summaryItems}
        loading={isInitialSummaryLoad(adminsState.status, admins.length > 0)}
      />

      <AdminListCard
        toolbar={
          <SearchBar
            searchField={searchField}
            searchFieldOptions={[
              { label: '전체', value: 'all' },
              { label: '관리자 ID', value: 'adminId' },
              { label: '이름', value: 'name' },
              { label: '역할', value: 'role' }
            ]}
            keyword={keyword}
            keywordPlaceholder="관리자 계정 검색"
            detailTitle="상세 검색"
            detailContent={
              <SearchBarDetailField label="최근 로그인">
                <SearchBarDateRange
                  startDate={draftStartDate}
                  endDate={draftEndDate}
                  onChange={handleDraftDateChange}
                />
              </SearchBarDetailField>
            }
            onSearchFieldChange={(value) => commitParams({ searchField: value })}
            onKeywordChange={(event) =>
              commitParams({
                keyword: event.target.value,
                searchField
              })
            }
            onApply={handleApplyDateRange}
            onDetailOpenChange={handleDetailOpenChange}
            onReset={handleDraftReset}
            summary={<Text type="secondary">총 {filteredRows.length.toLocaleString()}건</Text>}
          />
        }
      >
        {adminsState.status === 'error' ? (
          <Alert
            type="error"
            showIcon
            style={{ marginBottom: SPACE.sm }}
            message="관리자 계정 목록을 불러오지 못했습니다."
            description={adminsState.errorMessage ?? undefined}
          />
        ) : null}

        <Paragraph type="secondary" style={{ marginBottom: SPACE.base }}>
          관리자 계정 가시성은 계정 상태, 역할, 권한 수, 감사 로그 연결로 통일합니다.
          권한 부여/수정/회수는{' '}
          <Link className="table-navigation-link" to="/system/permissions">
            권한 관리
          </Link>
          에서 수행하고, 조치 결과는 감사 로그에서 확인합니다.
        </Paragraph>

        <AdminDataTable<AdminPermissionAssignment>
          rowKey="adminId"
          pagination={false}
          loading={adminsState.status === 'pending'}
          scroll={{ x: 1200 }}
          columns={columns}
          dataSource={filteredRows}
          onRow={(record) => ({
            onClick: () => setSelectedRow(record),
            style: { cursor: 'pointer' }
          })}
        />

        <Paragraph type="secondary" style={{ marginTop: SPACE.sm, marginBottom: 0 }}>
          비활성 계정 {inactiveCount}명은 로그인만 차단하고, 구성 이력은 감사 로그에서 유지합니다.
        </Paragraph>
      </AdminListCard>

      <TableRowDetailModal
        open={Boolean(selectedDetailRecord)}
        title="관리자 계정 상세"
        record={selectedDetailRecord}
        labelMap={detailLabelMap}
        onClose={() => setSelectedRow(null)}
      />

      <Modal
        open={inviteOpen}
        title="관리자 초대"
        okText="초대 메일 보내기"
        cancelText="취소"
        confirmLoading={inviteSubmitting}
        onOk={handleInviteSubmit}
        onCancel={() => {
          setInviteOpen(false);
          inviteForm.resetFields();
        }}
        destroyOnHidden
      >
        <Paragraph type="secondary" style={{ marginTop: 0 }}>
          입력한 이메일로 초대 메일이 발송됩니다. 초대받은 사람이 비밀번호를 설정하고
          처음 로그인하면 관리자 계정이 활성화됩니다. 슈퍼 관리자는 모든 권한을 자동으로
          가지므로 별도 권한 선택이 필요 없습니다.
        </Paragraph>
        <Form<InviteFormValues>
          form={inviteForm}
          layout="vertical"
          initialValues={{ role: 'content_admin', permissionKeys: templatePermissionKeys('content_admin') }}
        >
          <Form.Item
            name="email"
            label="이메일"
            rules={[
              { required: true, message: '이메일을 입력하세요.' },
              { type: 'email', message: '올바른 이메일 형식이 아닙니다.' }
            ]}
          >
            <Input placeholder="admin@example.com" autoComplete="off" />
          </Form.Item>
          <Form.Item name="role" label="역할" rules={[{ required: true }]}>
            <Select options={inviteRoleOptions} onChange={handleInviteRoleChange} />
          </Form.Item>
          <Form.Item
            name="permissionKeys"
            label="권한"
            tooltip="역할을 고르면 기본 권한이 채워집니다. 필요에 맞게 추가/제거하세요."
          >
            <Select
              mode="multiple"
              allowClear
              disabled={inviteRole === 'platform_admin'}
              placeholder={
                inviteRole === 'platform_admin' ? '슈퍼 관리자는 모든 권한 보유' : '권한 선택'
              }
              options={invitePermissionOptions}
              maxTagCount="responsive"
              optionFilterProp="label"
            />
          </Form.Item>
          {inviteRole !== 'platform_admin' ? (
            <Space size="small" wrap>
              <Button
                size="small"
                onClick={() =>
                  inviteForm.setFieldValue(
                    'permissionKeys',
                    templatePermissionKeys(inviteRole ?? 'content_admin')
                  )
                }
              >
                역할 기본 권한 적용
              </Button>
              <Button
                size="small"
                onClick={() => inviteForm.setFieldValue('permissionKeys', [])}
              >
                전체 해제
              </Button>
            </Space>
          ) : null}
        </Form>
      </Modal>
    </div>
  );
}
