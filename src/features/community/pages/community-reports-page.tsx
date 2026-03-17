import {
  Card,
  Col,
  Row,
  Space,
  Statistic,
  Typography,
  notification
} from 'antd';
import type { TableColumnsType } from 'antd';
import { useCallback, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';

import { getMockUserById } from '../../users/api/mock-users';
import { AuditLogLink } from '../../../shared/ui/audit-log-link/audit-log-link';
import { ConfirmAction } from '../../../shared/ui/confirm-action/confirm-action';
import { AdminListCard } from '../../../shared/ui/list-page-card/admin-list-card';
import { getTargetTypeLabel } from '../../../shared/model/target-type-label';
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
import { TableActionMenu } from '../../../shared/ui/table/table-action-menu';
import { createStatusColumnTitle } from '../../../shared/ui/table/status-column-title';
import {
  createDefinedColumnFilterProps,
  createTextSorter
} from '../../../shared/ui/table/table-column-utils';
import { TableRowDetailModal } from '../../../shared/ui/table/table-row-detail-modal';
import {
  formatUserDisplayName,
  UserNavigationLink
} from '../../../shared/ui/user/user-reference';

const { Text } = Typography;

type ProcessStatus = '처리 대기' | '처리 완료';

type ReportRow = {
  id: string;
  targetPostId: string;
  targetUserId: string;
  targetUserName: string;
  reporterId: string;
  reporterName: string;
  reason: string;
  createdAt: string;
  processStatus: ProcessStatus;
};

type ReportActionState =
  | { type: 'hide-post'; row: ReportRow }
  | { type: 'suspend-user'; row: ReportRow }
  | null;

function getResolvedUserName(userId: string, fallbackName?: string): string {
  return getMockUserById(userId)?.realName ?? fallbackName ?? userId;
}

const initialRows: ReportRow[] = [
  {
    id: 'RP-001',
    targetPostId: 'POST-002',
    targetUserId: 'U00047',
    targetUserName: getResolvedUserName('U00047'),
    reporterId: 'U00012',
    reporterName: getResolvedUserName('U00012'),
    reason: '욕설 포함',
    createdAt: '2026-03-03 14:12',
    processStatus: '처리 대기'
  },
  {
    id: 'RP-002',
    targetPostId: 'POST-010',
    targetUserId: 'U00019',
    targetUserName: getResolvedUserName('U00019'),
    reporterId: 'U00031',
    reporterName: getResolvedUserName('U00031'),
    reason: '광고성 게시물',
    createdAt: '2026-03-04 09:31',
    processStatus: '처리 대기'
  },
  {
    id: 'RP-003',
    targetPostId: 'POST-003',
    targetUserId: 'U00077',
    targetUserName: getResolvedUserName('U00077'),
    reporterId: 'U00001',
    reporterName: getResolvedUserName('U00001'),
    reason: '스팸',
    createdAt: '2026-03-04 10:05',
    processStatus: '처리 완료'
  }
];

const reportProcessStatusFilterValues = ['처리 대기', '처리 완료'] as const;

const detailLabelMap: Record<string, string> = {
  id: '신고 ID',
  targetPostId: '대상 게시글 ID',
  targetUser: '대상 사용자',
  reporter: '신고자',
  reason: '신고 사유',
  createdAt: '신고일',
  processStatus: '처리 상태'
};

export default function CommunityReportsPage(): JSX.Element {
  const [rows, setRows] = useState<ReportRow[]>(initialRows);
  const [actionState, setActionState] = useState<ReportActionState>(null);
  const [selectedRow, setSelectedRow] = useState<ReportRow | null>(null);
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
  const [notificationApi, notificationContextHolder] = notification.useNotification();

  const processedStatus = useMemo<ProcessStatus>(
    () =>
      initialRows.find((row) => row.processStatus === '처리 완료')?.processStatus ??
      '처리 완료',
    []
  );

  const commitParams = useCallback(
    (
      next: Partial<
        Record<'keyword' | 'searchField' | 'startDate' | 'endDate', string>
      >
    ) => {
      const merged = new URLSearchParams(searchParams);
      merged.delete('status');

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

  const visibleRows = useMemo(() => {
    const normalizedKeyword = keyword.trim().toLowerCase();

    return rows.filter((record) => {
      if (!matchesSearchDateRange(record.createdAt, startDate, endDate)) {
        return false;
      }
      if (!normalizedKeyword) {
        return true;
      }

      return matchesSearchField(normalizedKeyword, searchField, {
        id: record.id,
        targetPostId: record.targetPostId,
        targetUser: `${record.targetUserName} ${record.targetUserId}`,
        reporter: `${record.reporterName} ${record.reporterId}`,
        reason: record.reason
      });
    });
  }, [endDate, keyword, rows, searchField, startDate]);

  const selectedDetailRecord = useMemo(
    () =>
      selectedRow
        ? {
            id: selectedRow.id,
            targetPostId: selectedRow.targetPostId,
            targetUser: formatUserDisplayName(
              selectedRow.targetUserName,
              selectedRow.targetUserId
            ),
            reporter: formatUserDisplayName(
              selectedRow.reporterName,
              selectedRow.reporterId
            ),
            reason: selectedRow.reason,
            createdAt: selectedRow.createdAt,
            processStatus: selectedRow.processStatus
          }
        : null,
    [selectedRow]
  );

  const markProcessed = useCallback(
    (row: ReportRow) => {
      setRows((prev) =>
        prev.map((item) =>
          item.id === row.id ? { ...item, processStatus: '처리 완료' } : item
        )
      );
      notificationApi.success({
        message: '신고 처리 완료',
        description: (
          <Space direction="vertical">
            <Text>대상 유형: {getTargetTypeLabel('Community')}</Text>
            <Text>대상 ID: {row.id}</Text>
            <Text>사유/근거: 운영자가 신고 처리를 완료했습니다.</Text>
            <AuditLogLink targetType="Community" targetId={row.id} />
          </Space>
        )
      });
    },
    [notificationApi]
  );

  const handleConfirmAction = useCallback(
    async (reason: string) => {
      if (!actionState) {
        return;
      }

      setRows((prev) =>
        prev.map((item) =>
          item.id === actionState.row.id ? { ...item, processStatus: '처리 완료' } : item
        )
      );

      if (actionState.type === 'hide-post') {
        notificationApi.success({
          message: '게시글 숨김 완료',
          description: (
            <Space direction="vertical">
              <Text>대상 유형: {getTargetTypeLabel('Community')}</Text>
              <Text>대상 ID: {actionState.row.targetPostId}</Text>
              <Text>사유/근거: {reason}</Text>
              <AuditLogLink targetType="Community" targetId={actionState.row.targetPostId} />
            </Space>
          )
        });
      } else {
        notificationApi.success({
          message: '사용자 정지 완료',
          description: (
            <Space direction="vertical">
              <Text>대상 유형: {getTargetTypeLabel('Users')}</Text>
              <Text>대상 ID: {actionState.row.targetUserId}</Text>
              <Text>사유/근거: {reason}</Text>
              <AuditLogLink targetType="Users" targetId={actionState.row.targetUserId} />
            </Space>
          )
        });
      }

      setActionState(null);
    },
    [actionState, notificationApi]
  );

  const columns = useMemo<TableColumnsType<ReportRow>>(
    () => [
      {
        title: '신고 ID',
        dataIndex: 'id',
        width: 110,
        sorter: createTextSorter((record) => record.id)
      },
      {
        title: '게시글',
        dataIndex: 'targetPostId',
        width: 130,
        sorter: createTextSorter((record) => record.targetPostId),
        render: (value: string) => (
          <Link
            className="table-navigation-link"
            to={`/community/posts?keyword=${value}`}
            onClick={(event) => event.stopPropagation()}
          >
            {value}
          </Link>
        )
      },
      {
        title: '대상 사용자',
        dataIndex: 'targetUserName',
        width: 180,
        sorter: createTextSorter((record) => record.targetUserName),
        render: (_, record) => (
          <UserNavigationLink
            stopPropagation
            userId={record.targetUserId}
            userName={record.targetUserName}
            withId
          />
        )
      },
      {
        title: '신고자',
        dataIndex: 'reporterName',
        width: 180,
        sorter: createTextSorter((record) => record.reporterName),
        render: (_, record) => (
          <UserNavigationLink
            stopPropagation
            userId={record.reporterId}
            userName={record.reporterName}
            withId
          />
        )
      },
      {
        title: '신고 사유',
        dataIndex: 'reason',
        width: 220,
        sorter: createTextSorter((record) => record.reason)
      },
      {
        title: '신고일',
        dataIndex: 'createdAt',
        width: 180,
        sorter: createTextSorter((record) => record.createdAt)
      },
      {
        title: createStatusColumnTitle('처리 상태', ['처리 대기', '처리 완료']),
        dataIndex: 'processStatus',
        width: 120,
        ...createDefinedColumnFilterProps(
          reportProcessStatusFilterValues,
          (record) => record.processStatus
        ),
        sorter: createTextSorter((record) => record.processStatus),
        render: (status: ProcessStatus) => <StatusBadge status={status} />
      },
      {
        title: '액션',
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
                key: `hide-${record.id}`,
                label: '게시글 숨김',
                onClick: () => setActionState({ type: 'hide-post', row: record })
              },
              {
                key: `suspend-${record.id}`,
                label: '사용자 정지',
                danger: true,
                onClick: () => setActionState({ type: 'suspend-user', row: record })
              },
              {
                key: `complete-${record.id}`,
                label: '신고 처리 완료',
                disabled: record.processStatus === processedStatus,
                onClick: () => markProcessed(record)
              }
            ]}
          />
        )
      }
    ],
    [markProcessed, processedStatus]
  );

  const pendingCount = rows.filter((row) => row.processStatus === '처리 대기').length;
  const completedCount = rows.filter((row) => row.processStatus === '처리 완료').length;

  return (
    <div>
      {notificationContextHolder}
      <PageTitle title="신고 관리" />

      <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
        <Col xs={24} md={8}>
          <Card>
            <Statistic title="전체 신고" value={rows.length} suffix="건" />
          </Card>
        </Col>
        <Col xs={24} md={8}>
          <Card>
            <Statistic title="처리 대기" value={pendingCount} suffix="건" />
          </Card>
        </Col>
        <Col xs={24} md={8}>
          <Card>
            <Statistic title="처리 완료" value={completedCount} suffix="건" />
          </Card>
        </Col>
      </Row>

      <AdminListCard
        toolbar={
          <SearchBar
            searchField={searchField}
            searchFieldOptions={[
              { label: '전체', value: 'all' },
              { label: '신고 ID', value: 'id' },
              { label: '게시글 ID', value: 'targetPostId' },
              { label: '대상 사용자', value: 'targetUser' },
              { label: '신고자', value: 'reporter' },
              { label: '신고 사유', value: 'reason' }
            ]}
            keyword={keyword}
            onSearchFieldChange={(value) =>
              commitParams({
                searchField: value
              })
            }
            onKeywordChange={(event) =>
              commitParams({
                keyword: event.target.value,
                searchField
              })
            }
            keywordPlaceholder="검색..."
          detailTitle="상세 검색"
          detailContent={
            <SearchBarDetailField label="신고일">
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
              <Text type="secondary">총 {visibleRows.length.toLocaleString()}건</Text>
            }
          />
        }
      >
        <Text type="secondary" style={{ display: 'block', marginBottom: 16 }}>
          원본 게시글 흐름은{' '}
          <Link className="table-navigation-link" to="/community/posts">
            게시글 관리
          </Link>
          에서 함께 확인할 수 있습니다.
        </Text>
        <AdminDataTable<ReportRow>
          rowKey="id"
          pagination={false}
          scroll={{ x: 1400 }}
          columns={columns}
          dataSource={visibleRows}
          onRow={(record) => ({
            onClick: () => setSelectedRow(record),
            style: { cursor: 'pointer' }
          })}
        />
      </AdminListCard>

      {actionState ? (
        <ConfirmAction
          open
          title={actionState.type === 'hide-post' ? '게시글 숨김' : '사용자 정지'}
          description={
            actionState.type === 'hide-post'
              ? '신고 대상 게시글을 숨김 처리합니다. 사유를 입력하세요.'
              : '신고 대상 사용자를 정지 처리합니다. 사유를 입력하세요.'
          }
          targetType={actionState.type === 'hide-post' ? 'Community' : 'Users'}
          targetId={
            actionState.type === 'hide-post'
              ? actionState.row.targetPostId
              : actionState.row.targetUserId
          }
          confirmText={actionState.type === 'hide-post' ? '숨김 실행' : '정지 실행'}
          onCancel={() => setActionState(null)}
          onConfirm={handleConfirmAction}
        />
      ) : null}

      <TableRowDetailModal
        open={Boolean(selectedRow)}
        title="신고 상세"
        record={selectedDetailRecord}
        labelMap={detailLabelMap}
        onClose={() => setSelectedRow(null)}
      />
    </div>
  );
}
