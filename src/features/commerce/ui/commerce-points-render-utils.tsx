import { Tag, Typography } from 'antd';
import type { DescriptionsProps } from 'antd';
import { Link } from 'react-router-dom';

import {
  formatPoint,
  getSourceRoute
} from '../model/commerce-points-page-schema';
import type {
  PointExpiration,
  PointLedger,
  PointLedgerSourceType,
  PointPolicy
} from '../model/point-types';
import { UserNavigationLink } from '@/shared/ui/user/user-reference';

const { Text } = Typography;

// 포인트 공용 렌더 헬퍼 — Phase 4 분해로 페이지 모듈에서 이동(동작 동일).
// 상태 태그·발생 원천 링크·상세 요약 Descriptions 아이템을 컬럼/Drawer 가 함께 쓴다.

export function renderLocalStatusTag(status: string): JSX.Element {
  const colorMap: Record<string, string> = {
    초안: 'gold',
    '운영 중': 'green',
    중지: 'default',
    예정: 'gold',
    보류: 'orange',
    완료: 'blue',
    취소: 'default'
  };

  return <Tag color={colorMap[status] ?? 'default'}>{status}</Tag>;
}

export function renderSourceReference(
  sourceType: PointLedgerSourceType,
  sourceId: string,
  sourceLabel: string,
  stopPropagation = false
): JSX.Element {
  const route = getSourceRoute(sourceType, sourceId);

  if (!route) {
    return (
      <Text>
        {sourceLabel} ({sourceId})
      </Text>
    );
  }

  return (
    <Link
      className="table-navigation-link"
      to={route}
      onClick={
        stopPropagation
          ? (event) => {
              event.stopPropagation();
            }
          : undefined
      }
    >
      {sourceLabel} ({sourceId})
    </Link>
  );
}

export function buildPolicySummaryItems(policy: PointPolicy): DescriptionsProps['items'] {
  return [
    { key: 'id', label: '정책 ID', children: policy.id },
    { key: 'name', label: '정책명', children: policy.name },
    { key: 'type', label: '정책 유형', children: policy.policyType },
    { key: 'status', label: '상태', children: renderLocalStatusTag(policy.status) },
    {
      key: 'updatedAt',
      label: '최종 수정',
      children: `${policy.updatedAt} · ${policy.updatedBy}`
    }
  ];
}

export function buildLedgerSummaryItems(ledger: PointLedger): DescriptionsProps['items'] {
  return [
    { key: 'id', label: '원장 ID', children: ledger.id },
    { key: 'occurredAt', label: '발생 시각', children: ledger.occurredAt },
    {
      key: 'user',
      label: '회원',
      children: (
        <UserNavigationLink userId={ledger.userId} userName={ledger.userName} />
      )
    },
    { key: 'type', label: '원장 유형', children: ledger.ledgerType },
    { key: 'status', label: '처리 상태', children: renderLocalStatusTag(ledger.status) }
  ];
}

export function buildExpirationSummaryItems(
  expiration: PointExpiration
): DescriptionsProps['items'] {
  return [
    { key: 'id', label: '소멸 ID', children: expiration.id },
    { key: 'scheduledAt', label: '예정 시각', children: expiration.scheduledAt },
    {
      key: 'user',
      label: '회원',
      children: (
        <UserNavigationLink
          userId={expiration.userId}
          userName={expiration.userName}
        />
      )
    },
    {
      key: 'expiringPoint',
      label: '예정 포인트',
      children: formatPoint(expiration.expiringPoint)
    },
    {
      key: 'status',
      label: '소멸 상태',
      children: renderLocalStatusTag(expiration.status)
    }
  ];
}
