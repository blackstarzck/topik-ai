import { Space, Typography } from 'antd';
import type { TableColumnsType } from 'antd';
import type { NavigateFunction } from 'react-router-dom';

import {
  formatPoint,
  formatPointDelta
} from '../model/commerce-points-page-schema';
import type { DangerState } from '../model/commerce-points-page-schema';
import {
  pointExpirationStatuses,
  pointLedgerSourceTypes,
  pointLedgerStatuses,
  pointLedgerTypes,
  pointPolicyStatuses,
  pointPolicyTypes
} from '../model/point-types';
import type {
  CommercePointsQuery,
  PointExpiration,
  PointExpirationStatus,
  PointLedger,
  PointLedgerStatus,
  PointPolicy,
  PointPolicyStatus
} from '../model/point-types';
import {
  renderLocalStatusTag,
  renderSourceReference
} from './commerce-points-render-utils';
import { createStatusColumnTitle } from '@/shared/ui/table/status-column-title';
import { TableActionMenu } from '@/shared/ui/table/table-action-menu';
import { UserNavigationLink } from '@/shared/ui/user/user-reference';

const { Text } = Typography;

// 포인트 정책/원장/소멸 컬럼 — Phase 4 분해로 페이지 useMemo 본문에서 이동(동작 동일).
// URL 정렬/필터 상태(query)·모달 오프너·위험 조치·네비게이션은 페이지가 소유하고 인자로 받는다.
export type PointPolicyColumnsContext = {
  query: CommercePointsQuery;
  openEditPolicyModal: (policy: PointPolicy) => void;
  setDangerState: (next: DangerState) => void;
};

export function createPolicyColumns({
  query,
  openEditPolicyModal,
  setDangerState
}: PointPolicyColumnsContext): TableColumnsType<PointPolicy> {
  return [
    {
      title: '정책명',
      dataIndex: 'name',
      key: 'name',
      width: 180,
      sorter: true,
      sortOrder: query.policy.sortField === 'name' ? query.policy.sortOrder : null
    },
    {
      title: '정책 유형',
      dataIndex: 'policyType',
      key: 'policyType',
      width: 110,
      filters: pointPolicyTypes.map((value) => ({ text: value, value })),
      filteredValue: query.policy.type === 'all' ? null : [query.policy.type],
      sorter: true,
      sortOrder:
        query.policy.sortField === 'policyType' ? query.policy.sortOrder : null
    },
    { title: '적용 조건', dataIndex: 'conditionSummary', width: 220 },
    { title: '적립/차감 규칙', dataIndex: 'earnDebitRule', width: 220 },
    { title: '소멸 규칙', dataIndex: 'expirationRule', width: 180 },
    {
      title: createStatusColumnTitle('상태', pointPolicyStatuses),
      dataIndex: 'status',
      key: 'status',
      width: 110,
      filters: pointPolicyStatuses.map((value) => ({ text: value, value })),
      filteredValue: query.policy.status === 'all' ? null : [query.policy.status],
      sorter: true,
      sortOrder: query.policy.sortField === 'status' ? query.policy.sortOrder : null,
      render: (status: PointPolicyStatus) => renderLocalStatusTag(status)
    },
    {
      title: '최종 수정',
      key: 'updatedAt',
      width: 180,
      sorter: true,
      sortOrder:
        query.policy.sortField === 'updatedAt' ? query.policy.sortOrder : null,
      render: (_, record) => (
        <Space direction="vertical" size={0}>
          <Text>{record.updatedAt}</Text>
          <Text type="secondary">{record.updatedBy}</Text>
        </Space>
      )
    },
    {
      title: '액션',
      key: 'actions',
      width: 120,
      fixed: 'right',
      onCell: () => ({
        onClick: (event) => event.stopPropagation()
      }),
      render: (_, record) => (
        <TableActionMenu
          items={[
            {
              key: `${record.id}-edit`,
              label: '정책 수정',
              onClick: () => openEditPolicyModal(record)
            },
            {
              key: `${record.id}-toggle`,
              label: record.status === '운영 중' ? '운영 중지' : '운영 시작',
              danger: record.status === '운영 중',
              onClick: () =>
                setDangerState(
                  record.status === '운영 중'
                    ? { type: 'pause-policy', policy: record }
                    : { type: 'activate-policy', policy: record }
                )
            }
          ]}
        />
      )
    }
  ];
}

export type PointLedgerColumnsContext = {
  query: CommercePointsQuery;
  openManualAdjustmentModal: (ledger?: PointLedger | null) => void;
  navigate: NavigateFunction;
};

export function createLedgerColumns({
  query,
  openManualAdjustmentModal,
  navigate
}: PointLedgerColumnsContext): TableColumnsType<PointLedger> {
  return [
    {
      title: '발생 시각',
      dataIndex: 'occurredAt',
      key: 'occurredAt',
      width: 150,
      sorter: true,
      sortOrder:
        query.ledger.sortField === 'occurredAt' ? query.ledger.sortOrder : null
    },
    {
      title: '회원',
      key: 'user',
      width: 190,
      render: (_, record) => (
        <UserNavigationLink
          stopPropagation
          userId={record.userId}
          userName={record.userName}
        />
      )
    },
    {
      title: '원장 유형',
      dataIndex: 'ledgerType',
      key: 'ledgerType',
      width: 100,
      filters: pointLedgerTypes.map((value) => ({ text: value, value })),
      filteredValue: query.ledger.type === 'all' ? null : [query.ledger.type],
      sorter: true,
      sortOrder:
        query.ledger.sortField === 'ledgerType' ? query.ledger.sortOrder : null
    },
    {
      title: '발생 원천',
      key: 'source',
      dataIndex: 'sourceType',
      width: 220,
      filters: pointLedgerSourceTypes.map((value) => ({ text: value, value })),
      filteredValue:
        query.ledger.sourceType === 'all' ? null : [query.ledger.sourceType],
      sorter: true,
      sortOrder:
        query.ledger.sortField === 'sourceType' ? query.ledger.sortOrder : null,
      render: (_, record) =>
        renderSourceReference(
          record.sourceType,
          record.sourceId,
          record.sourceLabel,
          true
        )
    },
    {
      title: '포인트 증감',
      dataIndex: 'pointDelta',
      key: 'pointDelta',
      width: 120,
      sorter: true,
      sortOrder:
        query.ledger.sortField === 'pointDelta' ? query.ledger.sortOrder : null,
      render: (value: number) => (
        <Text strong type={value < 0 ? 'danger' : undefined}>
          {formatPointDelta(value)}
        </Text>
      )
    },
    {
      title: '처리 후 잔액',
      key: 'balance',
      width: 140,
      render: (_, record) => formatPoint(record.availableBalanceAfter)
    },
    {
      title: '만료 예정일',
      dataIndex: 'expirationAt',
      key: 'expirationAt',
      width: 120,
      sorter: true,
      sortOrder:
        query.ledger.sortField === 'expirationAt' ? query.ledger.sortOrder : null,
      render: (value: string) => value || '-'
    },
    {
      title: createStatusColumnTitle('처리 상태', pointLedgerStatuses),
      dataIndex: 'status',
      key: 'status',
      width: 110,
      filters: pointLedgerStatuses.map((value) => ({ text: value, value })),
      filteredValue:
        query.ledger.status === 'all' ? null : [query.ledger.status],
      sorter: true,
      sortOrder: query.ledger.sortField === 'status' ? query.ledger.sortOrder : null,
      render: (status: PointLedgerStatus) => renderLocalStatusTag(status)
    },
    {
      title: '액션',
      key: 'actions',
      width: 120,
      fixed: 'right',
      onCell: () => ({
        onClick: (event) => event.stopPropagation()
      }),
      render: (_, record) => (
        <TableActionMenu
          items={[
            {
              key: `${record.id}-adjust`,
              label: '같은 회원으로 조정',
              onClick: () => openManualAdjustmentModal(record)
            },
            {
              key: `${record.id}-user`,
              label: '회원 상세로 이동',
              onClick: () => navigate(`/users/${record.userId}?tab=payment`)
            }
          ]}
        />
      )
    }
  ];
}

export type PointExpirationColumnsContext = {
  query: CommercePointsQuery;
  openExpirationHoldModal: (expiration?: PointExpiration | null) => void;
  setDangerState: (next: DangerState) => void;
  navigate: NavigateFunction;
};

export function createExpirationColumns({
  query,
  openExpirationHoldModal,
  setDangerState,
  navigate
}: PointExpirationColumnsContext): TableColumnsType<PointExpiration> {
  return [
    {
      title: '예정 시각',
      dataIndex: 'scheduledAt',
      key: 'scheduledAt',
      width: 150,
      sorter: true,
      sortOrder:
        query.expiration.sortField === 'scheduledAt'
          ? query.expiration.sortOrder
          : null
    },
    {
      title: '회원',
      key: 'user',
      width: 190,
      render: (_, record) => (
        <UserNavigationLink
          stopPropagation
          userId={record.userId}
          userName={record.userName}
        />
      )
    },
    {
      title: '원천',
      dataIndex: 'sourceType',
      key: 'sourceType',
      width: 100,
      sorter: true,
      sortOrder:
        query.expiration.sortField === 'sourceType'
          ? query.expiration.sortOrder
          : null
    },
    {
      title: '예정 포인트',
      dataIndex: 'expiringPoint',
      key: 'expiringPoint',
      width: 120,
      sorter: true,
      sortOrder:
        query.expiration.sortField === 'expiringPoint'
          ? query.expiration.sortOrder
          : null,
      render: (value: number) => formatPoint(value)
    },
    {
      title: '사용 가능 요약',
      dataIndex: 'availablePoint',
      key: 'availablePoint',
      width: 120,
      sorter: true,
      sortOrder:
        query.expiration.sortField === 'availablePoint'
          ? query.expiration.sortOrder
          : null,
      render: (value: number) => formatPoint(value)
    },
    {
      title: createStatusColumnTitle('소멸 상태', pointExpirationStatuses),
      dataIndex: 'status',
      key: 'status',
      width: 110,
      filters: pointExpirationStatuses.map((value) => ({ text: value, value })),
      filteredValue:
        query.expiration.status === 'all' ? null : [query.expiration.status],
      sorter: true,
      sortOrder:
        query.expiration.sortField === 'status'
          ? query.expiration.sortOrder
          : null,
      render: (status: PointExpirationStatus) => renderLocalStatusTag(status)
    },
    {
      title: '보류 사유',
      dataIndex: 'holdReason',
      width: 220,
      render: (value: string) => value || '-'
    },
    {
      title: '액션',
      key: 'actions',
      width: 120,
      fixed: 'right',
      onCell: () => ({
        onClick: (event) => event.stopPropagation()
      }),
      render: (_, record) => (
        <TableActionMenu
          items={[
            ...(record.status !== '보류'
              ? [
                  {
                    key: `${record.id}-hold`,
                    label: '보류 등록',
                    onClick: () => openExpirationHoldModal(record)
                  }
                ]
              : [
                  {
                    key: `${record.id}-release`,
                    label: '보류 해제',
                    onClick: () =>
                      setDangerState({
                        type: 'release-expiration',
                        expiration: record
                      })
                  }
                ]),
            {
              key: `${record.id}-user`,
              label: '회원 상세로 이동',
              onClick: () => navigate(`/users/${record.userId}?tab=payment`)
            }
          ]}
        />
      )
    }
  ];
}
