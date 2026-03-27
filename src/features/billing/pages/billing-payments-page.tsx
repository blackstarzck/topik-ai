import { Typography } from 'antd';
import type { TableColumnsType } from 'antd';
import { useCallback, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';

import { useCommerceStore } from '../model/commerce-store';
import type { PaymentRow, PaymentStatus } from '../model/commerce-store';
import { getMockUserById } from '../../users/api/mock-users';
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

const detailLabelMap: Record<string, string> = {
  id: '결제 ID',
  user: '회원',
  userNickname: '닉네임',
  product: '상품',
  amount: '결제 금액',
  method: '결제 수단',
  paidAt: '결제일',
  status: '상태'
};

function formatCurrency(value: number): string {
  return `₩${value.toLocaleString('ko-KR')}`;
}

function getPaymentUserName(record: Pick<PaymentRow, 'userId' | 'userNickname'>): string {
  return getMockUserById(record.userId)?.realName ?? record.userNickname;
}

export default function BillingPaymentsPage(): JSX.Element {
  const payments = useCommerceStore((state) => state.payments);
  const refunds = useCommerceStore((state) => state.refunds);
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
  const [selectedRow, setSelectedRow] = useState<PaymentRow | null>(null);

  const filteredRows = useMemo(() => {
    const normalizedKeyword = keyword.trim().toLowerCase();

    return payments.filter((record) => {
      if (!matchesSearchDateRange(record.paidAt, startDate, endDate)) {
        return false;
      }
      if (!normalizedKeyword) {
        return true;
      }

      return matchesSearchField(normalizedKeyword, searchField, {
        id: record.id,
        userId: record.userId,
        userName: getPaymentUserName(record),
        userNickname: record.userNickname,
        product: record.product
      });
    });
  }, [endDate, keyword, payments, searchField, startDate]);

  const completedAmount = useMemo(
    () =>
      payments
        .filter((row) => row.status === '완료')
        .reduce((sum, row) => sum + row.amount, 0),
    [payments]
  );
  const refundedCount = payments.filter((row) => row.status === '환불').length;
  const pendingRefundCount = refunds.filter((row) => row.status === '처리 대기').length;
  const paymentSummaryCards = useMemo(
    () => [
      {
        key: 'all-payments',
        label: '전체 결제 건수',
        value: `${payments.length.toLocaleString()}건`
      },
      {
        key: 'completed-amount',
        label: '결제 완료 금액',
        value: formatCurrency(completedAmount)
      },
      {
        key: 'refund-related',
        label: '환불 관련 건수',
        value: `${(refundedCount + pendingRefundCount).toLocaleString()}건`
      }
    ],
    [completedAmount, payments.length, pendingRefundCount, refundedCount]
  );

  const commitParams = useCallback(
    (
      next: Partial<
        Record<'keyword' | 'searchField' | 'startDate' | 'endDate', string>
      >
    ) => {
      const merged = new URLSearchParams(searchParams);
      merged.delete('status');
      merged.delete('method');

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
            user: formatUserDisplayName(
              getPaymentUserName(selectedRow),
              selectedRow.userId
            ),
            userNickname: selectedRow.userNickname,
            product: selectedRow.product,
            amount: formatCurrency(selectedRow.amount),
            method: selectedRow.method,
            paidAt: selectedRow.paidAt,
            status: selectedRow.status
          }
        : null,
    [selectedRow]
  );

  const columns = useMemo<TableColumnsType<PaymentRow>>(
    () => [
      {
        title: '결제 ID',
        dataIndex: 'id',
        width: 120,
        sorter: createTextSorter((record) => record.id),
        render: (value: string, record) => (
          <Link
            className="table-navigation-link"
            to={`/commerce/refunds?keyword=${record.id}`}
            onClick={(event) => event.stopPropagation()}
          >
            {value}
          </Link>
        )
      },
      {
        title: '회원',
        key: 'user',
        width: 220,
        sorter: createTextSorter((record) => getPaymentUserName(record)),
        render: (_, record) => (
          <UserNavigationLink
            stopPropagation
            userId={record.userId}
            userName={getPaymentUserName(record)}
            withId
          />
        )
      },
      {
        title: '상품',
        dataIndex: 'product',
        width: 240,
        sorter: createTextSorter((record) => record.product)
      },
      {
        title: '금액',
        dataIndex: 'amount',
        width: 140,
        sorter: createNumberSorter((record) => record.amount),
        render: (value: number) => formatCurrency(value)
      },
      {
        title: '결제 수단',
        dataIndex: 'method',
        width: 120,
        sorter: createTextSorter((record) => record.method)
      },
      {
        title: '결제일',
        dataIndex: 'paidAt',
        width: 120,
        sorter: createTextSorter((record) => record.paidAt)
      },
      {
        title: createStatusColumnTitle('상태', ['완료', '취소', '환불']),
        dataIndex: 'status',
        width: 100,
        sorter: createTextSorter((record) => record.status),
        render: (status: PaymentStatus) => <StatusBadge status={status} />
      }
    ],
    []
  );

  const closeDetailModal = useCallback(() => setSelectedRow(null), []);

  return (
    <div>
      <PageTitle title="결제 내역" />
      <ListSummaryCards items={paymentSummaryCards} />

      <AdminListCard
        toolbar={
          <SearchBar
            searchField={searchField}
            searchFieldOptions={[
              { label: '전체', value: 'all' },
              { label: '결제 ID', value: 'id' },
              { label: '회원 ID', value: 'userId' },
              { label: '회원명', value: 'userName' },
              { label: '닉네임', value: 'userNickname' },
              { label: '상품명', value: 'product' }
            ]}
            keyword={keyword}
            onSearchFieldChange={(value) => commitParams({ searchField: value })}
            onKeywordChange={(event) => commitParams({ keyword: event.target.value })}
            keywordPlaceholder="검색..."
            detailTitle="상세 검색"
            detailContent={
              <SearchBarDetailField label="결제일">
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
        }
      >

        <Paragraph type="secondary" style={{ marginBottom: 16 }}>
          환불 관리에서 승인된 요청은 같은 원본 데이터를 공유하므로 이 페이지의 결제 상태에도 즉시 반영됩니다.{' '}
          <Link className="table-navigation-link" to="/commerce/refunds">
            환불 관리
          </Link>
          에서 처리 흐름을 이어서 확인할 수 있습니다.
        </Paragraph>

        <AdminDataTable<PaymentRow>
          rowKey="id"
          pagination={false}
          scroll={{ x: 1100 }}
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
        title="결제 상세"
        record={selectedDetailRecord}
        labelMap={detailLabelMap}
        onClose={closeDetailModal}
      />
    </div>
  );
}
