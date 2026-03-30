import { Typography } from 'antd';
import type { TableColumnsType } from 'antd';
import { useCallback, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';

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
import { createTextSorter } from '../../../shared/ui/table/table-column-utils';
import { TableRowDetailModal } from '../../../shared/ui/table/table-row-detail-modal';

const { Paragraph, Text } = Typography;

type LogLevel = 'INFO' | 'WARN' | 'ERROR';

type SystemLogRow = {
  id: string;
  level: LogLevel;
  component: string;
  message: string;
  createdAt: string;
};

const rows: SystemLogRow[] = [
  {
    id: 'SYS-001',
    level: 'INFO',
    component: 'notification-worker',
    message: 'dispatch batch completed',
    createdAt: '2026-03-11 09:11:42'
  },
  {
    id: 'SYS-002',
    level: 'WARN',
    component: 'billing-sync',
    message: 'payment webhook delayed',
    createdAt: '2026-03-11 09:47:03'
  },
  {
    id: 'SYS-003',
    level: 'ERROR',
    component: 'community-service',
    message: 'report queue retry limit reached',
    createdAt: '2026-03-11 10:02:19'
  },
  {
    id: 'SYS-004',
    level: 'ERROR',
    component: 'admin-auth',
    message: 'temporary token validation failed',
    createdAt: '2026-03-11 10:38:11'
  }
];

const detailLabelMap: Record<string, string> = {
  id: '로그 ID',
  level: '레벨',
  component: '컴포넌트',
  message: '硫붿떆吏',
  createdAt: '시각'
};

function getComponentRoute(component: string): string | null {
  if (component === 'notification-worker') {
    return '/messages/history?channel=mail';
  }
  if (component === 'billing-sync') {
    return '/commerce/payments';
  }
  if (component === 'community-service') {
    return '/community/reports';
  }
  if (component === 'admin-auth') {
    return '/system/admins';
  }
  return null;
}

export default function SystemLogsPage(): JSX.Element {
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
  const [selectedRow, setSelectedRow] = useState<SystemLogRow | null>(null);

  const filteredRows = useMemo(() => {
    const normalizedKeyword = keyword.trim().toLowerCase();

    return rows.filter((row) => {
      if (!matchesSearchDateRange(row.createdAt, startDate, endDate)) {
        return false;
      }
      if (!normalizedKeyword) {
        return true;
      }

      return matchesSearchField(normalizedKeyword, searchField, {
        id: row.id,
        component: row.component,
        message: row.message
      });
    });
  }, [endDate, keyword, searchField, startDate]);

  const commitParams = useCallback(
    (
      next: Partial<
        Record<'keyword' | 'searchField' | 'startDate' | 'endDate', string>
      >
    ) => {
      const merged = new URLSearchParams(searchParams);
      merged.delete('level');
      merged.delete('component');

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

  const errorCount = rows.filter((row) => row.level === 'ERROR').length;
  const warningCount = rows.filter((row) => row.level === 'WARN').length;
  const componentCount = new Set(rows.map((row) => row.component)).size;
  const systemLogSummaryCards = useMemo(
    () => [
      {
        key: 'error-logs',
        label: '?ㅻ쪟 로그',
        value: `${errorCount.toLocaleString()}嫄?
      },
      {
        key: 'warning-logs',
        label: '寃쎄퀬 로그',
        value: `${warningCount.toLocaleString()}嫄?
      },
      {
        key: 'affected-components',
        label: '?곹뼢 컴포넌트',
        value: `${componentCount.toLocaleString()}媛?
      }
    ],
    [componentCount, errorCount, warningCount]
  );

  const columns = useMemo<TableColumnsType<SystemLogRow>>(
    () => [
      {
        title: '로그 ID',
        dataIndex: 'id',
        width: 120,
        sorter: createTextSorter((record) => record.id)
      },
      {
        title: createStatusColumnTitle('레벨', ['INFO', 'WARN', 'ERROR']),
        dataIndex: 'level',
        width: 100,
        sorter: createTextSorter((record) => record.level),
        render: (level: LogLevel) => <StatusBadge status={level} />
      },
      {
        title: '컴포넌트',
        dataIndex: 'component',
        width: 190,
        sorter: createTextSorter((record) => record.component),
        render: (component: string) => {
          const route = getComponentRoute(component);
          if (!route) {
            return component;
          }

          return (
            <Link
              className="table-navigation-link"
              to={route}
              onClick={(event) => event.stopPropagation()}
            >
              {component}
            </Link>
          );
        }
      },
      {
        title: '硫붿떆吏',
        dataIndex: 'message',
        sorter: createTextSorter((record) => record.message)
      },
      {
        title: '諛쒖깮 시각',
        dataIndex: 'createdAt',
        width: 180,
        sorter: createTextSorter((record) => record.createdAt)
      }
    ],
    []
  );

  return (
    <div>
      <PageTitle title="시스템 로그" />
      <ListSummaryCards items={systemLogSummaryCards} />

      <AdminListCard
        toolbar={
          <SearchBar
            searchField={searchField}
            searchFieldOptions={[
              { label: '전체', value: 'all' },
              { label: '로그 ID', value: 'id' },
              { label: '컴포넌트', value: 'component' },
              { label: '硫붿떆吏', value: 'message' }
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
              <SearchBarDetailField label="諛쒖깮 시각">
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
          컴포넌트 留곹겕瑜??꾨Ⅴ硫??대떦 ?ㅻ쪟媛 二쇰줈 ?곹뼢??二쇰뒗 운영 ?붾㈃?쇰줈 ?대룞?⑸땲??{' '}
          <Link className="table-navigation-link" to="/system/audit-logs">
            媛먯궗 로그
          </Link>
          ? ?④퍡 蹂대㈃ ?먯씤 異붿쟻??鍮좊쫭?덈떎.
        </Paragraph>

        <AdminDataTable<SystemLogRow>
          rowKey="id"
          pagination={false}
          columns={columns}
          dataSource={filteredRows}
          onRow={(record) => ({
            onClick: () => setSelectedRow(record),
            style: { cursor: 'pointer' }
          })}
        />
      </AdminListCard>

      <TableRowDetailModal
        open={Boolean(selectedRow)}
        title="시스템 로그 상세"
        record={selectedRow}
        labelMap={detailLabelMap}
        onClose={() => setSelectedRow(null)}
      />
    </div>
  );
}


