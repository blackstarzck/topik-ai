import {
  Button,
  Card,
  Col,
  Input,
  Row,
  Select,
  Space,
  Statistic,
  Typography,
  notification
} from 'antd';
import type { TableColumnsType } from 'antd';
import { useCallback, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';

import { useCommerceStore } from '../model/commerce-store';
import type { RefundRow, RefundStatus } from '../model/commerce-store';
import { AuditLogLink } from '../../../shared/ui/audit-log-link/audit-log-link';
import { ConfirmAction } from '../../../shared/ui/confirm-action/confirm-action';
import { FilterBar } from '../../../shared/ui/filter-bar/filter-bar';
import { PageTitle } from '../../../shared/ui/page-title/page-title';
import { StatusBadge } from '../../../shared/ui/status-badge/status-badge';
import { AdminDataTable } from '../../../shared/ui/table/admin-data-table';
import {
  createNumberSorter,
  createTextSorter
} from '../../../shared/ui/table/table-column-utils';
import { TableRowDetailModal } from '../../../shared/ui/table/table-row-detail-modal';

const { Paragraph } = Typography;

type PendingAction =
  | { type: 'approve'; refund: RefundRow }
  | { type: 'reject'; refund: RefundRow }
  | null;

const detailLabelMap: Record<string, string> = {
  id: '환불 ID',
  paymentId: '결제 ID',
  userId: '회원 ID',
  userNickname: '닉네임',
  requestedAmount: '요청 금액',
  reason: '환불 사유',
  status: '처리 상태',
  requestedAt: '요청 시각',
  processedAt: '처리 시각',
  processedBy: '처리 관리자',
  reviewReason: '처리 사유'
};

function parseStatus(value: string | null): RefundStatus | 'all' {
  if (value === '처리 대기' || value === '승인' || value === '거절') {
    return value;
  }
  return 'all';
}

function formatCurrency(value: number): string {
  return `₩${value.toLocaleString('ko-KR')}`;
}

export default function BillingRefundsPage(): JSX.Element {
  const refunds = useCommerceStore((state) => state.refunds);
  const approveRefund = useCommerceStore((state) => state.approveRefund);
  const rejectRefund = useCommerceStore((state) => state.rejectRefund);
  const [searchParams, setSearchParams] = useSearchParams();
  const keyword = searchParams.get('keyword') ?? '';
  const statusFilter = parseStatus(searchParams.get('status'));
  const [selectedRow, setSelectedRow] = useState<RefundRow | null>(null);
  const [pendingAction, setPendingAction] = useState<PendingAction>(null);

  const filteredRows = useMemo(() => {
    const normalizedKeyword = keyword.trim().toLowerCase();

    return refunds.filter((record) => {
      if (statusFilter !== 'all' && record.status !== statusFilter) {
        return false;
      }
      if (!normalizedKeyword) {
        return true;
      }

      return (
        record.id.toLowerCase().includes(normalizedKeyword) ||
        record.paymentId.toLowerCase().includes(normalizedKeyword) ||
        record.userId.toLowerCase().includes(normalizedKeyword) ||
        record.userNickname.toLowerCase().includes(normalizedKeyword) ||
        record.reason.toLowerCase().includes(normalizedKeyword)
      );
    });
  }, [keyword, refunds, statusFilter]);

  const pendingCount = refunds.filter((row) => row.status === '처리 대기').length;
  const approvedAmount = refunds
    .filter((row) => row.status === '승인')
    .reduce((sum, row) => sum + row.requestedAmount, 0);
  const rejectedCount = refunds.filter((row) => row.status === '거절').length;

  const commitParams = useCallback(
    (next: Partial<Record<'keyword' | 'status', string>>) => {
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
            requestedAmount: formatCurrency(selectedRow.requestedAmount)
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
            ? '환불 승인 처리 완료'
            : '환불 거절 처리 완료',
        description: (
          <Space direction="vertical" size={4}>
            <span>
              결제 ID {pendingAction.refund.paymentId}와 연결된 환불 상태가
              업데이트되었습니다.
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
        sorter: createTextSorter((record) => record.userId),
        render: (_, record) => (
          <>
            <Link
              className="table-navigation-link"
              to={`/users/${record.userId}?tab=payments`}
              onClick={(event) => event.stopPropagation()}
            >
              {record.userId}
            </Link>{' '}
            / {record.userNickname}
          </>
        )
      },
      {
        title: '요청 금액',
        dataIndex: 'requestedAmount',
        width: 140,
        align: 'right',
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
        title: '상태',
        dataIndex: 'status',
        width: 110,
        sorter: createTextSorter((record) => record.status),
        render: (status: RefundStatus) => <StatusBadge status={status} />
      },
      {
        title: '요청 시각',
        dataIndex: 'requestedAt',
        width: 150,
        sorter: createTextSorter((record) => record.requestedAt)
      },
      {
        title: '처리',
        key: 'actions',
        width: 180,
        render: (_, record) =>
          record.status === '처리 대기' ? (
            <Space onClick={(event) => event.stopPropagation()}>
              <Button type="link" onClick={() => setPendingAction({ type: 'approve', refund: record })}>
                승인
              </Button>
              <Button danger type="link" onClick={() => setPendingAction({ type: 'reject', refund: record })}>
                거절
              </Button>
            </Space>
          ) : (
            <Link
              className="table-navigation-link"
              to={`/system/audit-logs?targetType=Commerce&targetId=${record.id}`}
              onClick={(event) => event.stopPropagation()}
            >
              감사 로그
            </Link>
          )
      }
    ],
    []
  );

  return (
    <div>
      <PageTitle title="환불 관리" />

      <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
        <Col xs={24} md={8}>
          <Card>
            <Statistic title="처리 대기" value={pendingCount} suffix="건" />
          </Card>
        </Col>
        <Col xs={24} md={8}>
          <Card>
            <Statistic title="승인 금액" value={approvedAmount} prefix="₩" />
          </Card>
        </Col>
        <Col xs={24} md={8}>
          <Card>
            <Statistic title="거절 건수" value={rejectedCount} suffix="건" />
          </Card>
        </Col>
      </Row>

      <Card>
        <FilterBar>
          <Input.Search
            allowClear
            placeholder="환불 ID, 결제 ID, 회원 ID, 닉네임 검색"
            value={keyword}
            onChange={(event) => commitParams({ keyword: event.target.value })}
            style={{ width: 320 }}
          />
          <Select
            value={statusFilter}
            style={{ width: 160 }}
            options={[
              { label: '전체 상태', value: 'all' },
              { label: '처리 대기', value: '처리 대기' },
              { label: '승인', value: '승인' },
              { label: '거절', value: '거절' }
            ]}
            onChange={(value) => commitParams({ status: value })}
          />
        </FilterBar>

        <Paragraph type="secondary" style={{ marginBottom: 16 }}>
          환불 승인/거절은 결제 내역과 동일한 원본을 갱신합니다. 승인 시 결제 상태는 즉시
          `환불`로 동기화됩니다.
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
      </Card>

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
          pendingAction?.type === 'approve' ? '환불 승인 확인' : '환불 거절 확인'
        }
        description={
          pendingAction?.type === 'approve'
            ? '승인 후 결제 상태가 환불로 변경되고, 회원 결제 이력과 연결된 상태도 함께 갱신됩니다.'
            : '거절 사유는 운영 이력으로 남으며, 결제 상태는 유지됩니다.'
        }
        targetType="Commerce"
        targetId={pendingAction?.refund.id ?? ''}
        confirmText={pendingAction?.type === 'approve' ? '승인' : '거절'}
        onCancel={() => setPendingAction(null)}
        onConfirm={handleResolveRefund}
      />
    </div>
  );
}
