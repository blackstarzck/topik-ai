import { Card, Col, Row, Select, Statistic, Typography } from 'antd';
import type { TableColumnsType } from 'antd';
import { useCallback, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';

import { useCommerceStore } from '../model/commerce-store';
import type { PaymentMethod, PaymentRow, PaymentStatus } from '../model/commerce-store';
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
import { StatusBadge } from '../../../shared/ui/status-badge/status-badge';
import { AdminDataTable } from '../../../shared/ui/table/admin-data-table';
import {
  createNumberSorter,
  createTextSorter
} from '../../../shared/ui/table/table-column-utils';
import { TableRowDetailModal } from '../../../shared/ui/table/table-row-detail-modal';

const { Paragraph, Text } = Typography;

const detailLabelMap: Record<string, string> = {
  id: '결제 ID',
  userId: '회원 ID',
  userNickname: '닉네임',
  product: '상품',
  amount: '결제 금액',
  method: '결제 수단',
  paidAt: '결제일',
  status: '상태'
};

function parseStatus(value: string | null): PaymentStatus | 'all' {
  if (value === '완료' || value === '취소' || value === '환불') {
    return value;
  }
  return 'all';
}

function parseMethod(value: string | null): PaymentMethod | 'all' {
  if (value === '카드' || value === '계좌이체' || value === '간편결제') {
    return value;
  }
  return 'all';
}

function formatCurrency(value: number): string {
  return `₩${value.toLocaleString('ko-KR')}`;
}

export default function BillingPaymentsPage(): JSX.Element {
  const payments = useCommerceStore((state) => state.payments);
  const refunds = useCommerceStore((state) => state.refunds);
  const [searchParams, setSearchParams] = useSearchParams();
  const searchField = searchParams.get('searchField') ?? 'all';
  const startDate = parseSearchDate(searchParams.get('startDate'));
  const endDate = parseSearchDate(searchParams.get('endDate'));
  const keyword = searchParams.get('keyword') ?? '';
  const statusFilter = parseStatus(searchParams.get('status'));
  const methodFilter = parseMethod(searchParams.get('method'));
  const [selectedRow, setSelectedRow] = useState<PaymentRow | null>(null);

  const filteredRows = useMemo(() => {
    const normalizedKeyword = keyword.trim().toLowerCase();

    return payments.filter((record) => {
      if (statusFilter !== 'all' && record.status !== statusFilter) {
        return false;
      }
      if (methodFilter !== 'all' && record.method !== methodFilter) {
        return false;
      }
      if (!matchesSearchDateRange(record.paidAt, startDate, endDate)) {
        return false;
      }
      if (!normalizedKeyword) {
        return true;
      }

      return matchesSearchField(normalizedKeyword, searchField, {
        id: record.id,
        userId: record.userId,
        userNickname: record.userNickname,
        product: record.product
      });
    });
  }, [endDate, keyword, methodFilter, payments, searchField, startDate, statusFilter]);

  const completedAmount = useMemo(
    () =>
      payments
        .filter((row) => row.status === '완료')
        .reduce((sum, row) => sum + row.amount, 0),
    [payments]
  );
  const refundedCount = payments.filter((row) => row.status === '환불').length;
  const pendingRefundCount = refunds.filter((row) => row.status === '처리 대기').length;

  const commitParams = useCallback(
    (
      next: Partial<
        Record<'keyword' | 'searchField' | 'startDate' | 'endDate' | 'status' | 'method', string>
      >
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

  const selectedDetailRecord = useMemo(
    () =>
      selectedRow
        ? {
            ...selectedRow,
            amount: formatCurrency(selectedRow.amount)
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
        sorter: createTextSorter((record) => record.userId),
        render: (_, record) => (
          <>
            <Link
              className="table-navigation-link"
              to={`/users/${record.userId}?tab=profile`}
              onClick={(event) => event.stopPropagation()}
            >
              {record.userId}
            </Link>{' '}
            / {record.userNickname}
          </>
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
        align: 'right',
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
        title: '상태',
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

      <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
        <Col xs={24} md={8}>
          <Card>
            <Statistic title="전체 결제 건수" value={payments.length} suffix="건" />
          </Card>
        </Col>
        <Col xs={24} md={8}>
          <Card>
            <Statistic title="결제 완료 금액" value={completedAmount} prefix="₩" />
          </Card>
        </Col>
        <Col xs={24} md={8}>
          <Card>
            <Statistic title="환불 관련 건수" value={refundedCount + pendingRefundCount} suffix="건" />
          </Card>
        </Col>
      </Row>

      <Card>
        <SearchBar
          searchField={searchField}
          searchFieldOptions={[
            { label: '전체', value: 'all' },
            { label: '결제 ID', value: 'id' },
            { label: '회원 ID', value: 'userId' },
            { label: '닉네임', value: 'userNickname' },
            { label: '상품명', value: 'product' }
          ]}
          keyword={keyword}
          onSearchFieldChange={(value) => commitParams({ searchField: value })}
          onKeywordChange={(event) => commitParams({ keyword: event.target.value })}
          keywordPlaceholder="검색..."
          detailTitle="상세 검색"
          detailContent={
            <>
              <SearchBarDetailField label="결제 상태">
                <Select
                  value={statusFilter}
                  options={[
                    { label: '전체', value: 'all' },
                    { label: '완료', value: '완료' },
                    { label: '취소', value: '취소' },
                    { label: '환불', value: '환불' }
                  ]}
                  onChange={(value) => commitParams({ status: value })}
                />
              </SearchBarDetailField>
              <SearchBarDetailField label="결제 수단">
                <Select
                  value={methodFilter}
                  options={[
                    { label: '전체', value: 'all' },
                    { label: '카드', value: '카드' },
                    { label: '계좌이체', value: '계좌이체' },
                    { label: '간편결제', value: '간편결제' }
                  ]}
                  onChange={(value) => commitParams({ method: value })}
                />
              </SearchBarDetailField>
              <SearchBarDetailField label="결제일">
                <SearchBarDateRange
                  startDate={startDate}
                  endDate={endDate}
                  onChange={(nextStartDate, nextEndDate) =>
                    commitParams({
                      startDate: nextStartDate,
                      endDate: nextEndDate
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
      </Card>

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
