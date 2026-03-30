import { Typography } from 'antd';
import type { TableColumnsType } from 'antd';
import { useCallback, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';

import { roleCatalog } from '../model/permission-types';
import { usePermissionStore } from '../model/permission-store';
import type { AdminPermissionAssignment, RoleKey } from '../model/permission-types';
import { AdminListCard } from '../../../shared/ui/list-page-card/admin-list-card';
import { ListSummaryCards } from '../../../shared/ui/list-summary-cards/list-summary-cards';
import { PageTitle } from '../../../shared/ui/page-title/page-title';
import {
  SearchBar,
  SearchBarDateRange,
  SearchBarDetailField
} from '../../../shared/ui/search-bar/search-bar';
import {
  matchesSearchDateRange,
  matchesSearchField,
  parseSearchDate
} from '../../../shared/ui/search-bar/search-bar-utils';
import { useSearchBarDateDraft } from '../../../shared/ui/search-bar/use-search-bar-date-draft';
import { StatusBadge } from '../../../shared/ui/status-badge/status-badge';
import { AdminDataTable } from '../../../shared/ui/table/admin-data-table';
import { TableRowDetailModal } from '../../../shared/ui/table/table-row-detail-modal';
import {
  createNumberSorter,
  createTextSorter
} from '../../../shared/ui/table/table-column-utils';

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
      <PageTitle title="관리자 계정" />
      <ListSummaryCards items={summaryItems} />

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
        <Paragraph type="secondary" style={{ marginBottom: 16 }}>
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
          scroll={{ x: 1200 }}
          columns={columns}
          dataSource={filteredRows}
          onRow={(record) => ({
            onClick: () => setSelectedRow(record),
            style: { cursor: 'pointer' }
          })}
        />

        <Paragraph type="secondary" style={{ marginTop: 12, marginBottom: 0 }}>
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
    </div>
  );
}
