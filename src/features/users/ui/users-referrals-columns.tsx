import { Space, Tag, Typography } from 'antd';
import type { TableColumnsType } from 'antd';

import {
  anomalyFilterOptions,
  calculateCompletedRewardAmount,
  formatRewardAmount,
  statusFilterOptions
} from '../model/users-referrals-page-schema';
import type {
  ReferralAnomalyFilter,
  ReferralAnomalyStatus,
  ReferralRelation,
  ReferralRewardLedgerEntry,
  ReferralStatusFilter,
  ReferralSummary
} from '../model/referrals-types';
import { StatusBadge } from '@/shared/ui/status-badge/status-badge';
import { BinaryStatusSwitch } from '@/shared/ui/table/binary-status-switch';
import { createStatusColumnTitle } from '@/shared/ui/table/status-column-title';
import { fixDrawerTableFirstColumn } from '@/shared/ui/table/drawer-table';
import { TableActionMenu } from '@/shared/ui/table/table-action-menu';
import {
  createNumberSorter,
  createTextSorter
} from '@/shared/ui/table/table-column-utils';
import { UserNavigationLink } from '@/shared/ui/user/user-reference';

const { Text } = Typography;

// 추천인 목록·추천 관계·보상 원장 컬럼 — Phase 4 분해로 페이지 본문에서 이동(동작 동일).
// URL 필터 상태와 조치 핸들러는 페이지가 소유하고 인자로 받는다.

export function renderAnomalyTag(
  status: ReferralAnomalyStatus,
  count?: number
): JSX.Element {
  const color =
    status === '검토 필요'
      ? 'volcano'
      : status === '검토 완료'
        ? 'blue'
        : 'default';
  const label = count && count > 0 ? `${status} (${count})` : status;
  return <Tag color={color}>{label}</Tag>;
}

export type ReferralColumnsOptions = {
  statusFilter: ReferralStatusFilter;
  anomalyFilter: ReferralAnomalyFilter;
  onDeactivate: (referral: ReferralSummary) => void;
  onActivate: (referral: ReferralSummary) => void;
  onReviewAnomaly: (referral: ReferralSummary) => void;
  onOpenAdjustment: (referral: ReferralSummary) => void;
  onOpenPoints: (userId: string) => void;
};

export function createReferralColumns({
  statusFilter,
  anomalyFilter,
  onDeactivate,
  onActivate,
  onReviewAnomaly,
  onOpenAdjustment,
  onOpenPoints
}: ReferralColumnsOptions): TableColumnsType<ReferralSummary> {
  return [
  {
    title: '추천 코드',
    dataIndex: 'code',
    width: 150,
    sorter: createTextSorter((record) => record.code)
  },
  {
    title: '추천인 회원',
    dataIndex: 'referrerName',
    width: 180,
    sorter: createTextSorter((record) => record.referrerName),
    render: (_, record) => (
      <UserNavigationLink
        stopPropagation
        userId={record.referrerUserId}
        userName={record.referrerName}
      />
    )
  },
  {
    title: '피추천인 수',
    dataIndex: 'referredCount',
    width: 120,
    sorter: createNumberSorter((record) => record.referredCount),
    render: (value: number) => `${value.toLocaleString()}명`
  },
  {
    title: '추천 확정 수',
    dataIndex: 'confirmedCount',
    width: 120,
    sorter: createNumberSorter((record) => record.confirmedCount),
    render: (value: number) => `${value.toLocaleString()}건`
  },
  {
    title: '누적 보상',
    dataIndex: 'totalRewardAmount',
    width: 140,
    sorter: createNumberSorter((record) => record.totalRewardAmount),
    render: (value: number) => formatRewardAmount(value)
  },
  {
    title: '최근 사용일',
    dataIndex: 'lastUsedAt',
    width: 160,
    sorter: createTextSorter((record) => record.lastUsedAt)
  },
  {
    title: createStatusColumnTitle('코드 상태', ['활성', '비활성']),
    dataIndex: 'status',
    width: 120,
    filters: statusFilterOptions
      .filter((option) => option.value !== 'all')
      .map((option) => ({
        text: option.label,
        value: option.value
      })),
    filteredValue: statusFilter === 'all' ? null : [statusFilter],
    sorter: createTextSorter((record) => record.status),
    onCell: () => ({
      onClick: (event) => {
        event.stopPropagation();
      }
    }),
    render: (_, record) => (
      <BinaryStatusSwitch
        checked={record.status === '활성'}
        checkedLabel="활성"
        uncheckedLabel="비활성"
        onToggle={() =>
          record.status === '활성'
            ? onDeactivate(record)
            : onActivate(record)
        }
      />
    )
  },
  {
    title: createStatusColumnTitle('이상치 여부', ['없음', '검토 필요', '검토 완료']),
    dataIndex: 'anomalyStatus',
    width: 140,
    filters: anomalyFilterOptions
      .filter((option) => option.value !== 'all')
      .map((option) => ({
        text: option.label,
        value: option.value
      })),
    filteredValue:
      anomalyFilter === 'all' ? null : [anomalyFilter],
    sorter: createTextSorter((record) => record.anomalyStatus),
    render: (status: ReferralAnomalyStatus, record) =>
      renderAnomalyTag(status, record.anomalyFlags.length)
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
            key: `points-${record.id}`,
            label: '포인트 관리 이동',
            onClick: () => onOpenPoints(record.referrerUserId)
          },
          {
            key: `adjust-${record.id}`,
            label: '보상 수동 조정',
            onClick: () => onOpenAdjustment(record)
          },
          {
            key: `review-${record.id}`,
            label: '이상치 검토 완료',
            disabled: record.anomalyStatus !== '검토 필요',
            onClick: () => onReviewAnomaly(record)
          }
        ]}
      />
    )
  }
];
}

export function createReferralRelationColumns(
  relationEntryMap: Map<string, ReferralRewardLedgerEntry[]>
): TableColumnsType<ReferralRelation> {
  return fixDrawerTableFirstColumn<ReferralRelation>([
  {
    title: '피추천인',
    dataIndex: 'referredUserName',
    width: 120,
    render: (_, relation) => (
      <UserNavigationLink
        userId={relation.referredUserId}
        userName={relation.referredUserName}
      />
    )
  },
  {
    title: '진행 시각',
    key: 'timeline',
    width: 220,
    render: (_, relation) => (
      <Space direction="vertical" size={0}>
        <Text type="secondary">가입: {relation.joinedAt}</Text>
        <Text type="secondary">
          확정: {relation.confirmedAt || '미확정'}
        </Text>
      </Space>
    )
  },
  {
    title: createStatusColumnTitle('관계 상태', ['대기', '완료', '취소']),
    dataIndex: 'status',
    width: 100,
    render: (status: ReferralRelation['status']) => (
      <StatusBadge status={status} />
    )
  },
  {
    title: '검수',
    key: 'review',
    render: (_, relation) => (
      <Space direction="vertical" size={4}>
        {relation.anomalyFlag ? (
          <Tag color="volcano">{relation.anomalyFlag}</Tag>
        ) : (
          <Text type="secondary">이상치 없음</Text>
        )}
        {relation.reviewNote ? (
          <Text type="secondary">{relation.reviewNote}</Text>
        ) : null}
      </Space>
    )
  },
  {
    title: '누적 보상',
    key: 'rewardAmount',
    width: 110,
    render: (_, relation) =>
      formatRewardAmount(
        calculateCompletedRewardAmount(
          relationEntryMap.get(relation.id) ?? []
        )
      )
  }
  ]);
}

export function createReferralRewardLedgerColumns(): TableColumnsType<ReferralRewardLedgerEntry> {
  return [
  {
    title: '유형',
    dataIndex: 'entryType',
    width: 140,
    render: (_, entry) => (
      <Space direction="vertical" size={4}>
        <Text strong>{entry.entryType}</Text>
        <StatusBadge status={entry.status} />
      </Space>
    )
  },
  {
    title: '금액',
    dataIndex: 'amount',
    width: 100,
    render: (value: number) => (
      <Text strong type={value < 0 ? 'danger' : undefined}>
        {formatRewardAmount(value)}
      </Text>
    )
  },
  {
    title: '처리 시각',
    dataIndex: 'actedAt',
    width: 150
  },
  {
    title: '사유',
    dataIndex: 'reason'
  }
];
}
