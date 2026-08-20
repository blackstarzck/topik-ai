import {
  Alert,
  Space,
  Typography,
  notification
} from 'antd';
import type { TableColumnsType } from 'antd';
import { useCallback, useMemo, useState } from 'react';
import { useAsyncResource } from '@/shared/model/use-async-resource';
import { Link, useSearchParams } from 'react-router-dom';

import {
  fetchCommunityReportsSafe,
  resolveCommunityReportSafe
} from '../api/community-service';
import type {
  CommunityReport,
  CommunityReportResolutionAction
} from '../model/types';
import { AuditLogLink } from '@/shared/ui/audit-log-link/audit-log-link';
import { ConfirmAction } from '@/shared/ui/confirm-action/confirm-action';
import { AdminListCard } from '@/shared/ui/list-page-card/admin-list-card';
import { getTargetTypeLabel } from '@/shared/model/target-type-label';
import { ListSummaryCards } from '@/shared/ui/list-summary-cards/list-summary-cards';
import { PageTitle } from '@/shared/ui/page-title/page-title';
import {
  SearchBar,
  SearchBarDateRange,
  SearchBarDetailField
} from '@/shared/ui/search-bar/search-bar';
import { useSearchBarDateDraft } from '@/shared/ui/search-bar/use-search-bar-date-draft';
import {
  matchesSearchDateRange,
  matchesSearchField,
  parseSearchDate
} from '@/shared/ui/search-bar/search-bar-utils';
import { AdminDataTable } from '@/shared/ui/table/admin-data-table';
import { StatusBadge } from '@/shared/ui/status-badge/status-badge';
import { TableActionMenu } from '@/shared/ui/table/table-action-menu';
import { createStatusColumnTitle } from '@/shared/ui/table/status-column-title';
import {
  createDefinedColumnFilterProps,
  createTextSorter
} from '@/shared/ui/table/table-column-utils';
import { TableRowDetailModal } from '@/shared/ui/table/table-row-detail-modal';
import {
  formatUserDisplayName,
  UserNavigationLink
} from '@/shared/ui/user/user-reference';

const { Text } = Typography;

type ReportRow = CommunityReport;

type ReportActionState =
  | { type: 'hide-post'; row: ReportRow }
  | { type: 'suspend-user'; row: ReportRow }
  | { type: 'dismiss'; row: ReportRow }
  | null;

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

const reportActionByState: Record<
  Exclude<ReportActionState, null>['type'],
  CommunityReportResolutionAction
> = {
  'hide-post': 'hide_post',
  'suspend-user': 'suspend_user',
  dismiss: 'dismiss'
};

export default function CommunityReportsPage(): JSX.Element {
  const fetchReports = useCallback(
    (signal: AbortSignal) => fetchCommunityReportsSafe(signal),
    []
  );
  const {
    state: reportsState,
    mutate: mutateReports
  } = useAsyncResource<ReportRow[]>(fetchReports, { initialData: [] });
  const rows = reportsState.data;
  const loadState = reportsState.status;
  const loadErrorMessage = reportsState.errorMessage ?? '';
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

  const handleConfirmAction = useCallback(
    async (reason: string) => {
      if (!actionState) {
        return;
      }

      const result = await resolveCommunityReportSafe(
        actionState.row.id,
        reportActionByState[actionState.type],
        reason
      );

      if (!result.ok) {
        notificationApi.error({
          message: '\uC2E0\uACE0 \uCC98\uB9AC \uC2E4\uD328',
          description: result.error.message
        });
        return;
      }

      mutateReports((data) =>
        data.map((item) => (item.id === result.data.id ? result.data : item))
      );

      if (actionState.type === 'hide-post') {
        notificationApi.success({
          message: '게시글 숨김 완료',
          description: (
            <Space direction="vertical">
              <Text>대상 유형: {getTargetTypeLabel('CommunityReport')}</Text>
              <Text>대상 ID: {actionState.row.id}</Text>
              <Text>게시글 ID: {actionState.row.targetPostId}</Text>
              <Text>사유/근거: {reason}</Text>
              <AuditLogLink targetType="CommunityReport" targetId={actionState.row.id} />
            </Space>
          )
        });
      } else if (actionState.type === 'suspend-user') {
        notificationApi.success({
          message: '사용자 정지 의도 기록 완료',
          description: (
            <Space direction="vertical">
              <Text>대상 유형: {getTargetTypeLabel('CommunityReport')}</Text>
              <Text>대상 ID: {actionState.row.id}</Text>
              <Text>사용자 ID: {actionState.row.targetUserId}</Text>
              <Text>사유/근거: {reason}</Text>
              <AuditLogLink targetType="CommunityReport" targetId={actionState.row.id} />
            </Space>
          )
        });
      } else {
        notificationApi.success({
          message: '신고 반려 완료',
          description: (
            <Space direction="vertical">
              <Text>대상 유형: {getTargetTypeLabel('CommunityReport')}</Text>
              <Text>대상 ID: {actionState.row.id}</Text>
              <Text>사유/근거: {reason}</Text>
              <AuditLogLink targetType="CommunityReport" targetId={actionState.row.id} />
            </Space>
          )
        });
      }

      setActionState(null);
    },
    [actionState, mutateReports, notificationApi]
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
        render: (status: string) => <StatusBadge status={status} />
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
                key: `dismiss-${record.id}`,
                label: '신고 반려',
                onClick: () => setActionState({ type: 'dismiss', row: record })
              }
            ]}
          />
        )
      }
    ],
    []
  );

  const pendingCount = rows.filter((row) => row.processStatus === '처리 대기').length;
  const completedCount = rows.filter((row) => row.processStatus === '처리 완료').length;
  const reportSummaryCards = useMemo(
    () => [
      {
        key: 'all-reports',
        label: '전체 신고',
        value: `${rows.length.toLocaleString()}건`
      },
      {
        key: 'pending-reports',
        label: '처리 대기',
        value: `${pendingCount.toLocaleString()}건`
      },
      {
        key: 'completed-reports',
        label: '처리 완료',
        value: `${completedCount.toLocaleString()}건`
      }
    ],
    [completedCount, pendingCount, rows.length]
  );

  return (
    <div>
      {notificationContextHolder}
      <PageTitle title="신고 관리" />
      <ListSummaryCards items={reportSummaryCards} />

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
        {loadState === 'error' ? (
          <Alert
            type="error"
            showIcon
            style={{ marginBottom: 16 }}
            message="\uCEE4\uBBA4\uB2C8\uD2F0 \uC2E0\uACE0\uB97C \uBD88\uB7EC\uC624\uC9C0 \uBABB\uD588\uC2B5\uB2C8\uB2E4."
            description={loadErrorMessage}
          />
        ) : null}
        <AdminDataTable<ReportRow>
          rowKey="id"
          pagination={false}
          scroll={{ x: 1400 }}
          columns={columns}
          dataSource={visibleRows}
          loading={loadState === 'pending'}
          locale={{ emptyText: loadState === 'error' ? loadErrorMessage : '\uC870\uD68C\uB41C \uC2E0\uACE0\uAC00 \uC5C6\uC2B5\uB2C8\uB2E4.' }}
          onRow={(record) => ({
            onClick: () => setSelectedRow(record),
            style: { cursor: 'pointer' }
          })}
        />
      </AdminListCard>

      {actionState ? (
        <ConfirmAction
          open
          title={
            actionState.type === 'hide-post'
              ? '게시글 숨김'
              : actionState.type === 'suspend-user'
                ? '사용자 정지'
                : '신고 반려'
          }
          description={
            actionState.type === 'hide-post'
              ? '신고 대상 게시글을 숨김 처리합니다. 사유를 입력하세요.'
              : actionState.type === 'suspend-user'
                ? '신고 대상 사용자 정지 의도를 기록합니다. 실제 v13 사용자 정지는 이번 증분에서 호출하지 않습니다. 사유를 입력하세요.'
                : '신고를 추가 조치 없이 종결합니다. 반려 사유를 입력하세요.'
          }
          targetType="CommunityReport"
          targetId={actionState.row.id}
          confirmText={
            actionState.type === 'hide-post'
              ? '숨김 실행'
              : actionState.type === 'suspend-user'
                ? '정지 의도 기록'
                : '반려 실행'
          }
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
