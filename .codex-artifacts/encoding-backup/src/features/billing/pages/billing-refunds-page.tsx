import {
  Button,
  Space,
  Typography,
  notification
} from 'antd';
import type { TableColumnsType } from 'antd';
import { useCallback, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';

import { useCommerceStore } from '../model/commerce-store';
import type { RefundRow, RefundStatus } from '../model/commerce-store';
import { getMockUserById } from '../../users/api/mock-users';
import { AuditLogLink } from '../../../shared/ui/audit-log-link/audit-log-link';
import { ConfirmAction } from '../../../shared/ui/confirm-action/confirm-action';
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
import {
  formatUserDisplayName,
  UserNavigationLink
} from '../../../shared/ui/user/user-reference';

const { Paragraph, Text } = Typography;

type PendingAction =
  | { type: 'approve'; refund: RefundRow }
  | { type: 'reject'; refund: RefundRow }
  | null;

const detailLabelMap: Record<string, string> = {
  id: '환불 ID',
  paymentId: '결제 ID',
  user: '회원',
  userNickname: '닉네임,
  requestedAmount: '?붿껌 湲덉븸',
  reason: '환불 사유',
  status: '泥섎━ 상태',
  requestedAt: '?붿껌 시각',
  processedAt: '泥섎━ 시각',
  processedBy: '泥섎━ 愿由ъ옄',
  reviewReason: '泥섎━ 사유'
};

function formatCurrency(value: number): string {
  return `??{value.toLocaleString('ko-KR')}`;
}

function getRefundUserName(record: Pick<RefundRow, 'userId' | 'userNickname'>): string {
  return getMockUserById(record.userId)?.realName ?? record.userNickname;
}

export default function BillingRefundsPage(): JSX.Element {
  const refunds = useCommerceStore((state) => state.refunds);
  const approveRefund = useCommerceStore((state) => state.approveRefund);
  const rejectRefund = useCommerceStore((state) => state.rejectRefund);
  const [searchParams, setSearchParams] = useSearchParams();
  const searchField = searchParams.get('searchField') ?? 'all';
  const keyword = searchParams.get('keyword') ?? '';
  const [selectedRow, setSelectedRow] = useState<RefundRow | null>(null);
  const [pendingAction, setPendingAction] = useState<PendingAction>(null);

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

    return refunds.filter((record) => {
      if (!matchesSearchDateRange(record.requestedAt, startDate, endDate)) {
        return false;
      }
      if (!normalizedKeyword) {
        return true;
      }

      return matchesSearchField(normalizedKeyword, searchField, {
        id: record.id,
        paymentId: record.paymentId,
        userId: record.userId,
        userName: getRefundUserName(record),
        userNickname: record.userNickname,
        reason: record.reason
      });
    });
  }, [endDate, keyword, refunds, searchField, startDate]);

  const pendingCount = refunds.filter((row) => row.status === '泥섎━ 대기).length;
  const approvedAmount = refunds
    .filter((row) => row.status === '?뱀씤')
    .reduce((sum, row) => sum + row.requestedAmount, 0);
  const rejectedCount = refunds.filter((row) => row.status === '嫄곗젅').length;
  const refundSummaryCards = useMemo(
    () => [
      {
        key: 'pending-refunds',
        label: '泥섎━ 대기,
        value: `${pendingCount.toLocaleString()}嫄?
      },
      {
        key: 'approved-amount',
        label: '?뱀씤 湲덉븸',
        value: formatCurrency(approvedAmount)
      },
      {
        key: 'rejected-refunds',
        label: '嫄곗젅 嫄댁닔',
        value: `${rejectedCount.toLocaleString()}嫄?
      }
    ],
    [approvedAmount, pendingCount, rejectedCount]
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
      endDate: draftEndDate
    });
  }, [commitParams, draftEndDate, draftStartDate]);

  const selectedDetailRecord = useMemo(
    () =>
      selectedRow
        ? {
            id: selectedRow.id,
            paymentId: selectedRow.paymentId,
            user: formatUserDisplayName(
              getRefundUserName(selectedRow),
              selectedRow.userId
            ),
            userNickname: selectedRow.userNickname,
            requestedAmount: formatCurrency(selectedRow.requestedAmount),
            reason: selectedRow.reason,
            status: selectedRow.status,
            requestedAt: selectedRow.requestedAt,
            processedAt: selectedRow.processedAt,
            processedBy: selectedRow.processedBy,
            reviewReason: selectedRow.reviewReason
          }
        : null,
    [selectedRow]
  );

  const handleResolveRefund = useCallback(
    async (reason: string) => {
      if (!pendingAction) {
        return;
      }

      const action =
        pendingAction.type === 'approve'
          ? approveRefund({
              refundId: pendingAction.refund.id,
              changedBy: 'admin_park',
              reason
            })
          : rejectRefund({
              refundId: pendingAction.refund.id,
              changedBy: 'admin_park',
              reason
            });

      if (!action) {
        return;
      }

      notification.success({
        message:
          pendingAction.type === 'approve'
            ? '환불 ?뱀씤 泥섎━ 완료'
            : '환불 嫄곗젅 泥섎━ 완료',
        description: (
          <Space direction="vertical" size={4}>
            <span>
              결제 ID {pendingAction.refund.paymentId}? ?곌껐??환불 상태媛
              ?낅뜲?댄듃?섏뿀?듬땲??
            </span>
            <AuditLogLink targetType="Commerce" targetId={pendingAction.refund.id} />
          </Space>
        )
      });

      setPendingAction(null);
    },
    [approveRefund, pendingAction, rejectRefund]
  );

  const columns = useMemo<TableColumnsType<RefundRow>>(
    () => [
      {
        title: '환불 ID',
        dataIndex: 'id',
        width: 120,
        sorter: createTextSorter((record) => record.id)
      },
      {
        title: '결제 ID',
        dataIndex: 'paymentId',
        width: 120,
        sorter: createTextSorter((record) => record.paymentId),
        render: (paymentId: string) => (
          <Link
            className="table-navigation-link"
            to={`/commerce/payments?keyword=${paymentId}`}
            onClick={(event) => event.stopPropagation()}
          >
            {paymentId}
          </Link>
        )
      },
      {
        title: '회원',
        key: 'user',
        width: 220,
        sorter: createTextSorter((record) => getRefundUserName(record)),
        render: (_, record) => (
          <UserNavigationLink
            stopPropagation
            tab="payments"
            userId={record.userId}
            userName={getRefundUserName(record)}
            withId
          />
        )
      },
      {
        title: '?붿껌 湲덉븸',
        dataIndex: 'requestedAmount',
        width: 140,
        sorter: createNumberSorter((record) => record.requestedAmount),
        render: (value: number) => formatCurrency(value)
      },
      {
        title: '사유',
        dataIndex: 'reason',
        width: 220,
        sorter: createTextSorter((record) => record.reason)
      },
      {
        title: createStatusColumnTitle('상태', ['泥섎━ 대기, '?뱀씤', '嫄곗젅']),
        dataIndex: 'status',
        width: 110,
        sorter: createTextSorter((record) => record.status),
        render: (status: RefundStatus) => <StatusBadge status={status} />
      },
      {
        title: '?붿껌 시각',
        dataIndex: 'requestedAt',
        width: 150,
        sorter: createTextSorter((record) => record.requestedAt)
      },
      {
        title: '泥섎━',
        key: 'actions',
        width: 180,
        render: (_, record) =>
          record.status === '泥섎━ 대기 ? (
            <Space onClick={(event) => event.stopPropagation()}>
              <Button type="link" onClick={() => setPendingAction({ type: 'approve', refund: record })}>
                ?뱀씤
              </Button>
              <Button danger type="link" onClick={() => setPendingAction({ type: 'reject', refund: record })}>
                嫄곗젅
              </Button>
            </Space>
          ) : (
            <Link
              className="table-navigation-link"
              to={`/system/audit-logs?targetType=Commerce&targetId=${record.id}`}
              onClick={(event) => event.stopPropagation()}
            >
              媛먯궗 로그
            </Link>
          )
      }
    ],
    []
  );

  return (
    <div>
      <PageTitle title="환불 愿由? />
      <ListSummaryCards items={refundSummaryCards} />

      <AdminListCard
        toolbar={
          <SearchBar
            searchField={searchField}
            searchFieldOptions={[
              { label: '전체', value: 'all' },
              { label: '환불 ID', value: 'id' },
              { label: '결제 ID', value: 'paymentId' },
              { label: '회원 ID', value: 'userId' },
              { label: '회원紐?, value: 'userName' },
              { label: '닉네임, value: 'userNickname' },
              { label: '사유', value: 'reason' }
            ]}
            keyword={keyword}
            onSearchFieldChange={(value) => commitParams({ searchField: value })}
            onKeywordChange={(event) => commitParams({ keyword: event.target.value })}
            keywordPlaceholder="寃??.."
            detailTitle="상세 寃??
            detailContent={
              <SearchBarDetailField label="?붿껌??>
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
          환불 ?뱀씤/嫄곗젅? 결제 내역怨??숈씪???먮낯??媛깆떊?⑸땲?? ?뱀씤 ??결제 상태??즉시
          `환불`濡??숆린?붾맗?덈떎.
        </Paragraph>

        <AdminDataTable<RefundRow>
          rowKey="id"
          pagination={false}
          scroll={{ x: 1250 }}
          columns={columns}
          dataSource={filteredRows}
          onRow={(record) => ({
            onClick: () => setSelectedRow(record),
            style: { cursor: 'pointer' }
          })}
        />
      </AdminListCard>

      <TableRowDetailModal
        open={Boolean(selectedDetailRecord)}
        title="환불 상세"
        record={selectedDetailRecord}
        labelMap={detailLabelMap}
        onClose={() => setSelectedRow(null)}
      />

      <ConfirmAction
        open={Boolean(pendingAction)}
        title={
          pendingAction?.type === 'approve' ? '환불 ?뱀씤 ?뺤씤' : '환불 嫄곗젅 ?뺤씤'
        }
        description={
          pendingAction?.type === 'approve'
            ? '?뱀씤 ??결제 상태媛 환불濡?蹂寃쎈릺怨? 회원 결제 ?대젰怨??곌껐??상태???④퍡 媛깆떊?⑸땲??'
            : '嫄곗젅 사유??운영 ?대젰?쇰줈 ?⑥쑝硫? 결제 상태???좎??⑸땲??'
        }
        targetType="Commerce"
        targetId={pendingAction?.refund.id ?? ''}
        confirmText={pendingAction?.type === 'approve' ? '?뱀씤' : '嫄곗젅'}
        onCancel={() => setPendingAction(null)}
        onConfirm={handleResolveRefund}
      />
    </div>
  );
}


