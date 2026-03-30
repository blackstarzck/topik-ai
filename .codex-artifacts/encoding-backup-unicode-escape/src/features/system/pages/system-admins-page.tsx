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
  adminId: '\uad00\ub9ac\uc790 ID',
  name: '\uc774\ub984',
  roleName: '\uc5ed\ud560',
  permissionsCount: '\uad8c\ud55c \uc218',
  permissions: '\uad8c\ud55c \ubaa9\ub85d',
  lastLoginAt: '\ucd5c\uadfc \ub85c\uadf8\uc778',
  status: '\uc0c1\ud0dc',
  updatedAt: '\ucd5c\uadfc \uc218\uc815',
  updatedBy: '\uc218\uc815 \uad00\ub9ac\uc790'
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

  const activeCount = admins.filter((admin) => admin.status === '\ud65c\uc131').length;
  const inactiveCount = admins.filter((admin) => admin.status === '\ube44\ud65c\uc131').length;
  const contentManagerCount = admins.filter(
    (admin) => admin.role === 'CONTENT_MANAGER'
  ).length;

  const summaryItems = useMemo(
    () => [
      {
        key: 'all',
        label: '\uc804\uccb4 \uad00\ub9ac\uc790',
        value: `${admins.length.toLocaleString()}\uba85`
      },
      {
        key: 'active',
        label: '\ud65c\uc131 \uacc4\uc815',
        value: `${activeCount.toLocaleString()}\uba85`
      },
      {
        key: 'content',
        label: '\ucf58\ud150\uce20 \uad00\ub9ac\uc790',
        value: `${contentManagerCount.toLocaleString()}\uba85`
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
        title: '\uad00\ub9ac\uc790 ID',
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
        title: '\uc774\ub984',
        dataIndex: 'name',
        width: 120,
        sorter: createTextSorter((record) => record.name)
      },
      {
        title: '\uc5ed\ud560',
        dataIndex: 'role',
        width: 160,
        sorter: createTextSorter((record) => roleNameMap[record.role]),
        render: (role: RoleKey) => roleNameMap[role]
      },
      {
        title: '\uad8c\ud55c \uc218',
        key: 'permissionsCount',
        width: 100,
        sorter: createNumberSorter((record) => record.permissions.length),
        render: (_, record) => record.permissions.length
      },
      {
        title: '\ucd5c\uadfc \ub85c\uadf8\uc778',
        dataIndex: 'lastLoginAt',
        width: 180,
        sorter: createTextSorter((record) => record.lastLoginAt)
      },
      {
        title: '\uc0c1\ud0dc',
        dataIndex: 'status',
        width: 100,
        sorter: createTextSorter((record) => record.status),
        render: (status: string) => <StatusBadge status={status} />
      },
      {
        title: '\uad00\ub9ac',
        key: 'manage',
        width: 180,
        render: (_, record) => (
          <Link
            className="table-navigation-link"
            to={`/system/audit-logs?targetType=Admin&targetId=${record.adminId}`}
            onClick={(event) => event.stopPropagation()}
          >
            \uac10\uc0ac \ub85c\uadf8 \ubcf4\uae30
          </Link>
        )
      }
    ],
    []
  );

  return (
    <div>
      <PageTitle title="\uad00\ub9ac\uc790 \uacc4\uc815" />
      <ListSummaryCards items={summaryItems} />

      <AdminListCard
        toolbar={
          <SearchBar
            searchField={searchField}
            searchFieldOptions={[
              { label: '\uc804\uccb4', value: 'all' },
              { label: '\uad00\ub9ac\uc790 ID', value: 'adminId' },
              { label: '\uc774\ub984', value: 'name' },
              { label: '\uc5ed\ud560', value: 'role' }
            ]}
            keyword={keyword}
            keywordPlaceholder="\uad00\ub9ac\uc790 \uacc4\uc815 \uac80\uc0c9"
            detailTitle="\uc0c1\uc138 \uac80\uc0c9"
            detailContent={
              <SearchBarDetailField label="\ucd5c\uadfc \ub85c\uadf8\uc778">
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
            summary={<Text type="secondary">\ucd1d {filteredRows.length.toLocaleString()}\uac74</Text>}
          />
        }
      >
        <Paragraph type="secondary" style={{ marginBottom: 16 }}>
          \uad00\ub9ac\uc790 \uacc4\uc815 \uac00\uc2dc\uc131\uc740 \uacc4\uc815 \uc0c1\ud0dc, \uc5ed\ud560, \uad8c\ud55c \uc218, \uac10\uc0ac \ub85c\uadf8 \uc5f0\uacb0\ub85c \ud1b5\uc77c\ud569\ub2c8\ub2e4.
          \uad8c\ud55c \ubd80\uc5ec/\uc218\uc815/\ud68c\uc218\ub294{' '}
          <Link className="table-navigation-link" to="/system/permissions">
            \uad8c\ud55c \uad00\ub9ac
          </Link>
          \uc5d0\uc11c \uc218\ud589\ud558\uace0, \uc870\uce58 \uacb0\uacfc\ub294 \uac10\uc0ac \ub85c\uadf8\uc5d0\uc11c \ud655\uc778\ud569\ub2c8\ub2e4.
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
          \ube44\ud65c\uc131 \uacc4\uc815 {inactiveCount}\uba85\uc740 \ub85c\uadf8\uc778\ub9cc \ucc28\ub2e8\ud558\uace0, \uad6c\uc131 \uc774\ub825\uc740 \uac10\uc0ac \ub85c\uadf8\uc5d0\uc11c \uc720\uc9c0\ud569\ub2c8\ub2e4.
        </Paragraph>
      </AdminListCard>

      <TableRowDetailModal
        open={Boolean(selectedDetailRecord)}
        title="\uad00\ub9ac\uc790 \uacc4\uc815 \uc0c1\uc138"
        record={selectedDetailRecord}
        labelMap={detailLabelMap}
        onClose={() => setSelectedRow(null)}
      />
    </div>
  );
}
