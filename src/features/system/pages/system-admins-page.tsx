import { Card, Col, Row, Statistic, Typography } from 'antd';
import type { TableColumnsType } from 'antd';
import { useCallback, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';

import { usePermissionStore } from '../model/permission-store';
import { roleCatalog } from '../model/permission-types';
import type { AdminPermissionAssignment, AdminStatus, RoleKey } from '../model/permission-types';
import { PageTitle } from '../../../shared/ui/page-title/page-title';
import {
  SearchBar,
  SearchBarDateRange,
  SearchBarDetailField
} from '../../../shared/ui/search-bar/search-bar';
import { useSearchBarDateDraft } from '../../../shared/ui/search-bar/use-search-bar-date-draft';
import {
  matchesSearchDateRange,
  matchesSearchField,
  parseSearchDate
} from '../../../shared/ui/search-bar/search-bar-utils';
import { StatusBadge } from '../../../shared/ui/status-badge/status-badge';
import { AdminDataTable } from '../../../shared/ui/table/admin-data-table';
import { createStatusColumnTitle } from '../../../shared/ui/table/status-column-title';
import {
  createNumberSorter,
  createTextSorter
} from '../../../shared/ui/table/table-column-utils';
import { TableRowDetailModal } from '../../../shared/ui/table/table-row-detail-modal';

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

export default function SystemAdminsPage(): JSX.Element {
  const admins = usePermissionStore((state) => state.admins);
  const [searchParams, setSearchParams] = useSearchParams();
  const searchField = searchParams.get('searchField') ?? 'all';
  const startDate = parseSearchDate(searchParams.get('startDate'));
  const endDate = parseSearchDate(searchParams.get('endDate'));
  const keyword = searchParams.get('keyword') ?? '';
  const {
    draftStartDate,
    draftEndDate,
    handleDraftDateChange,
    handleDraftReset,
    handleDetailOpenChange
  } = useSearchBarDateDraft(startDate, endDate);
  const [selectedRow, setSelectedRow] = useState<AdminPermissionAssignment | null>(null);

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

  const commitParams = useCallback(
    (
      next: Partial<
        Record<'keyword' | 'searchField' | 'startDate' | 'endDate', string>
      >
    ) => {
      const merged = new URLSearchParams(searchParams);
      merged.delete('status');
      merged.delete('role');

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
      startDate: draftStartDate,
      endDate: draftEndDate,
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
        width: 150,
        sorter: createTextSorter((record) => roleNameMap[record.role]),
        render: (role: RoleKey) => roleNameMap[role]
      },
      {
        title: '권한 수',
        key: 'permissionCount',
        width: 110,
        align: 'right',
        sorter: createNumberSorter((record) => record.permissions.length),
        render: (_, record) => record.permissions.length
      },
      {
        title: '최근 로그인',
        dataIndex: 'lastLoginAt',
        width: 170,
        sorter: createTextSorter((record) => record.lastLoginAt)
      },
      {
        title: createStatusColumnTitle('상태', ['활성', '비활성']),
        dataIndex: 'status',
        width: 110,
        sorter: createTextSorter((record) => record.status),
        render: (status: AdminStatus) => <StatusBadge status={status} />
      },
      {
        title: '권한 관리',
        key: 'manage',
        width: 180,
        render: (_, record) => (
          <Link
            className="table-navigation-link"
            to={`/system/audit-logs?targetType=Admin&targetId=${record.adminId}`}
            onClick={(event) => event.stopPropagation()}
          >
            변경 이력 보기
          </Link>
        )
      }
    ],
    []
  );

  return (
    <div>
      <PageTitle title="관리자 계정" />

      <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
        <Col xs={24} md={8}>
          <Card>
            <Statistic title="전체 관리자" value={admins.length} suffix="명" />
          </Card>
        </Col>
        <Col xs={24} md={8}>
          <Card>
            <Statistic title="활성 계정" value={activeCount} suffix="명" />
          </Card>
        </Col>
        <Col xs={24} md={8}>
          <Card>
            <Statistic title="콘텐츠 관리자" value={contentManagerCount} suffix="명" />
          </Card>
        </Col>
      </Row>

      <Card>
        <SearchBar
          searchField={searchField}
          searchFieldOptions={[
            { label: '전체', value: 'all' },
            { label: '관리자 ID', value: 'adminId' },
            { label: '이름', value: 'name' },
            { label: '역할', value: 'role' }
          ]}
          keyword={keyword}
          onSearchFieldChange={(value) => commitParams({ searchField: value })}
          onKeywordChange={(event) =>
            commitParams({
              keyword: event.target.value,
              searchField
            })
          }
          keywordPlaceholder="검색..."
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
          onApply={handleApplyDateRange}
          onDetailOpenChange={handleDetailOpenChange}
          onReset={handleDraftReset}
          summary={
            <Text type="secondary">총 {filteredRows.length.toLocaleString()}건</Text>
          }
        />

        <Paragraph type="secondary" style={{ marginBottom: 16 }}>
          관리자 계정과 권한 변경은 동일한 권한 원본을 공유합니다. 상세 조치 이력은 감사 로그
          화면에서 바로 역추적할 수 있고,{' '}
          <Link className="table-navigation-link" to="/system/permissions">
            권한 관리
          </Link>
          에서 역할별 설정을 확인할 수 있습니다.
        </Paragraph>

        <AdminDataTable<AdminPermissionAssignment>
          rowKey="adminId"
          pagination={false}
          scroll={{ x: 1200 }}
          columns={columns}
          dataSource={filteredRows}
          onRow={(record) => ({
            onClick: () => setSelectedRow(record),
            style: { cursor: 'pointer' }
          })}
        />

        <Paragraph type="secondary" style={{ marginTop: 12, marginBottom: 0 }}>
          비활성 계정 {inactiveCount}명은 로그인만 차단되며, 이력은 감사 로그에서 유지됩니다.
        </Paragraph>
      </Card>

      <TableRowDetailModal
        open={Boolean(selectedDetailRecord)}
        title="관리자 계정 상세"
        record={selectedDetailRecord}
        labelMap={detailLabelMap}
        onClose={() => setSelectedRow(null)}
      />
    </div>
  );
}
