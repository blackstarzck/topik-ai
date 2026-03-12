import { Card, Col, Row, Select, Statistic, Typography } from 'antd';
import type { TableColumnsType } from 'antd';
import { useCallback, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';

import { PageTitle } from '../../../shared/ui/page-title/page-title';
import {
  SearchBar,
  SearchBarDetailField
} from '../../../shared/ui/search-bar/search-bar';
import { matchesSearchField } from '../../../shared/ui/search-bar/search-bar-utils';
import { StatusBadge } from '../../../shared/ui/status-badge/status-badge';
import { AdminDataTable } from '../../../shared/ui/table/admin-data-table';
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
  message: '메시지',
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
  const keyword = searchParams.get('keyword') ?? '';
  const levelFilter = searchParams.get('level') ?? 'all';
  const componentFilter = searchParams.get('component') ?? 'all';
  const [selectedRow, setSelectedRow] = useState<SystemLogRow | null>(null);

  const componentOptions = useMemo(
    () =>
      Array.from(new Set(rows.map((row) => row.component))).map((component) => ({
        label: component,
        value: component
      })),
    []
  );

  const filteredRows = useMemo(() => {
    const normalizedKeyword = keyword.trim().toLowerCase();

    return rows.filter((row) => {
      if (levelFilter !== 'all' && row.level !== levelFilter) {
        return false;
      }
      if (componentFilter !== 'all' && row.component !== componentFilter) {
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
  }, [componentFilter, keyword, levelFilter, searchField]);

  const commitParams = useCallback(
    (next: Partial<Record<'keyword' | 'searchField' | 'level' | 'component', string>>) => {
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

  const errorCount = rows.filter((row) => row.level === 'ERROR').length;
  const warningCount = rows.filter((row) => row.level === 'WARN').length;
  const componentCount = new Set(rows.map((row) => row.component)).size;

  const columns = useMemo<TableColumnsType<SystemLogRow>>(
    () => [
      {
        title: '로그 ID',
        dataIndex: 'id',
        width: 120,
        sorter: createTextSorter((record) => record.id)
      },
      {
        title: '레벨',
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
        title: '메시지',
        dataIndex: 'message',
        sorter: createTextSorter((record) => record.message)
      },
      {
        title: '발생 시각',
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

      <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
        <Col xs={24} md={8}>
          <Card>
            <Statistic title="오류 로그" value={errorCount} suffix="건" />
          </Card>
        </Col>
        <Col xs={24} md={8}>
          <Card>
            <Statistic title="경고 로그" value={warningCount} suffix="건" />
          </Card>
        </Col>
        <Col xs={24} md={8}>
          <Card>
            <Statistic title="영향 컴포넌트" value={componentCount} suffix="개" />
          </Card>
        </Col>
      </Row>

      <Card>
        <SearchBar
          searchField={searchField}
          searchFieldOptions={[
            { label: '전체', value: 'all' },
            { label: '로그 ID', value: 'id' },
            { label: '컴포넌트', value: 'component' },
            { label: '메시지', value: 'message' }
          ]}
          keyword={keyword}
          onSearchFieldChange={(value) =>
            commitParams({ searchField: value, level: levelFilter, component: componentFilter })
          }
          onKeywordChange={(event) =>
            commitParams({
              keyword: event.target.value,
              searchField,
              level: levelFilter,
              component: componentFilter
            })
          }
          keywordPlaceholder="검색..."
          detailTitle="상세 검색"
          detailContent={
            <>
              <SearchBarDetailField label="레벨">
                <Select
                  value={levelFilter}
                  options={[
                    { label: '전체', value: 'all' },
                    { label: 'INFO', value: 'INFO' },
                    { label: 'WARN', value: 'WARN' },
                    { label: 'ERROR', value: 'ERROR' }
                  ]}
                  onChange={(value) =>
                    commitParams({
                      level: value,
                      keyword,
                      searchField,
                      component: componentFilter
                    })
                  }
                />
              </SearchBarDetailField>
              <SearchBarDetailField label="컴포넌트">
                <Select
                  value={componentFilter}
                  options={[{ label: '전체', value: 'all' }, ...componentOptions]}
                  onChange={(value) =>
                    commitParams({
                      component: value,
                      keyword,
                      searchField,
                      level: levelFilter
                    })
                  }
                />
              </SearchBarDetailField>
            </>
          }
          onReset={() => setSearchParams({}, { replace: true })}
          summary={
            <Text type="secondary">총 {filteredRows.length.toLocaleString()}건</Text>
          }
        />

        <Paragraph type="secondary" style={{ marginBottom: 16 }}>
          컴포넌트 링크를 누르면 해당 오류가 주로 영향을 주는 운영 화면으로 이동합니다.{' '}
          <Link className="table-navigation-link" to="/system/audit-logs">
            감사 로그
          </Link>
          와 함께 보면 원인 추적이 빠릅니다.
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
      </Card>

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
