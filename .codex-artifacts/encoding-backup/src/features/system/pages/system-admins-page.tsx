import { Typography } from 'antd';
import type { TableColumnsType } from 'antd';
import { useCallback, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';

import { usePermissionStore } from '../model/permission-store';
import { roleCatalog } from '../model/permission-types';
import type { AdminPermissionAssignment, RoleKey } from '../model/permission-types';
import { AdminListCard } from '../../../shared/ui/list-page-card/admin-list-card';
import { ListSummaryCards } from '../../../shared/ui/list-summary-cards/list-summary-cards';
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
  adminId: '愿由ъ옄 ID',
  name: '이름',
  roleName: '역할',
  permissionsCount: '권한 수,
  permissions: '沅뚰븳 紐⑸줉',
  lastLoginAt: '理쒓렐 로그??,
  status: '상태',
  updatedAt: '최근 수정',
  updatedBy: '?섏젙 愿由ъ옄'
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
  const inactiveCount = admins.filter((admin) => admin.status === '비활성).length;
  const contentManagerCount = admins.filter(
    (admin) => admin.role === 'CONTENT_MANAGER'
  ).length;
  const adminSummaryCards = useMemo(
    () => [
      {
        key: 'all-admins',
        label: '전체 愿由ъ옄',
        value: `${admins.length.toLocaleString()}紐?
      },
      {
        key: 'active-admins',
        label: '활성 怨꾩젙',
        value: `${activeCount.toLocaleString()}紐?
      },
      {
        key: 'content-managers',
        label: '콘텐츠愿由ъ옄',
        value: `${contentManagerCount.toLocaleString()}紐?
      }
    ],
    [activeCount, admins.length, contentManagerCount]
  );

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
        title: '愿由ъ옄 ID',
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
        title: '권한 수,
        key: 'permissionCount',
        width: 110,
        sorter: createNumberSorter((record) => record.permissions.length),
        render: (_, record) => record.permissions.length
      },
      {
        title: '理쒓렐 로그??,
        dataIndex: 'lastLoginAt',
        width: 170,
        sorter: createTextSorter((record) => record.lastLoginAt)
      },
      {
        title: createStatusColumnTitle('상태', ['활성', '비활성]),
        dataIndex: 'status',
        width: 110,
        sorter: createTextSorter((record) => record.status),
        render: (status) => <StatusBadge status={status} />
      },
      {
        title: '권한 관리,
        key: 'manage',
        width: 180,
        render: (_, record) => (
          <Link
            className="table-navigation-link"
            to={`/system/audit-logs?targetType=Admin&targetId=${record.adminId}`}
            onClick={(event) => event.stopPropagation()}
          >
            蹂寃??대젰 蹂닿린
          </Link>
        )
      }
    ],
    []
  );

  return (
    <div>
      <PageTitle title="관리자 계정" />
      <ListSummaryCards items={adminSummaryCards} />

      <AdminListCard
        toolbar={
          <SearchBar
            searchField={searchField}
            searchFieldOptions={[
              { label: '전체', value: 'all' },
              { label: '愿由ъ옄 ID', value: 'adminId' },
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
            keywordPlaceholder="寃??.."
            detailTitle="상세 寃??
            detailContent={
              <SearchBarDetailField label="理쒓렐 로그??>
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
              <Text type="secondary">珥?{filteredRows.length.toLocaleString()}嫄?/Text>
            }
          />
        }
      >

        <Paragraph type="secondary" style={{ marginBottom: 16 }}>
          관리자 계정怨?沅뚰븳 蹂寃쎌? ?숈씪??沅뚰븳 ?먮낯??怨듭쑀?⑸땲?? 상세 議곗튂 ?대젰? 媛먯궗 로그
          ?붾㈃?먯꽌 諛붾줈 ??텛?곹븷 ???덇퀬,{' '}
          <Link className="table-navigation-link" to="/system/permissions">
            권한 관리          </Link>
          ?먯꽌 역할蹂??ㅼ젙???뺤씤?????덉뒿?덈떎.
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
          비활성怨꾩젙 {inactiveCount}紐낆? 로그?몃쭔 李⑤떒?섎ŉ, ?대젰? 媛먯궗 로그?먯꽌 ?좎??⑸땲??
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


