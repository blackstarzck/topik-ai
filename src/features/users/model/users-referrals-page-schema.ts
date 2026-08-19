import { defaultReferralQuery } from './referrals-query-store';
import type {
  ReferralAnomalyFilter,
  ReferralQuery,
  ReferralRewardLedgerEntry,
  ReferralSearchField,
  ReferralStatusFilter,
  ReferralSummary
} from './referrals-types';
import type { DescriptionsProps } from 'antd';
import {
  matchesSearchDateRange,
  matchesSearchField,
  parseSearchDate
} from '@/shared/ui/search-bar/search-bar-utils';

// 추천인 관리 화면의 순수 스키마 — Phase 4 분해로 페이지 본문에서 이동(동작 동일).
// 조회 상태·조치 핸들러·폼 인스턴스는 페이지가 소유하고, 여기는 옵션·타입·파서·표시 헬퍼만 둔다.

export const pageSizeOptions = ['20', '50', '100'];

export const searchFieldOptions: { label: string; value: ReferralSearchField }[] = [
  { label: '전체', value: 'all' },
  { label: '추천 코드', value: 'code' },
  { label: '추천인 ID', value: 'referrerId' },
  { label: '추천인 이름', value: 'referrerName' }
];

export const statusFilterOptions: { label: string; value: ReferralStatusFilter }[] = [
  { label: '전체 상태', value: 'all' },
  { label: '활성', value: '활성' },
  { label: '비활성', value: '비활성' }
];

export const anomalyFilterOptions: {
  label: string;
  value: ReferralAnomalyFilter;
}[] = [
  { label: '전체 이상치', value: 'all' },
  { label: '없음', value: '없음' },
  { label: '검토 필요', value: '검토 필요' },
  { label: '검토 완료', value: '검토 완료' }
];

export type ReferralActionState =
  | { type: 'deactivate'; referral: ReferralSummary }
  | { type: 'activate'; referral: ReferralSummary }
  | { type: 'review-anomaly'; referral: ReferralSummary }
  | null;

export type ReferralRewardAdjustmentFormValues = {
  amount: number;
  reason: string;
};

export function parsePositiveNumber(value: string | null, fallback: number): number {
  if (!value) {
    return fallback;
  }

  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return fallback;
  }

  return parsed;
}

export function parseSearchField(value: string | null): ReferralSearchField {
  if (value === 'code' || value === 'referrerId' || value === 'referrerName') {
    return value;
  }
  return defaultReferralQuery.searchField;
}

export function parseStatusFilter(value: string | null): ReferralStatusFilter {
  if (value === '활성' || value === '비활성') {
    return value;
  }
  return defaultReferralQuery.status;
}

export function parseAnomalyFilter(value: string | null): ReferralAnomalyFilter {
  if (value === '없음' || value === '검토 필요' || value === '검토 완료') {
    return value;
  }
  return defaultReferralQuery.anomalyStatus;
}

export function parseReferralQuery(searchParams: URLSearchParams): ReferralQuery {
  return {
    page: parsePositiveNumber(
      searchParams.get('page'),
      defaultReferralQuery.page
    ),
    pageSize: parsePositiveNumber(
      searchParams.get('pageSize'),
      defaultReferralQuery.pageSize
    ),
    sort: defaultReferralQuery.sort,
    searchField: parseSearchField(searchParams.get('searchField')),
    status: parseStatusFilter(searchParams.get('status')),
    anomalyStatus: parseAnomalyFilter(searchParams.get('anomaly')),
    startDate: parseSearchDate(searchParams.get('startDate')),
    endDate: parseSearchDate(searchParams.get('endDate')),
    keyword: searchParams.get('keyword') ?? ''
  };
}

export function buildReferralSearchParams(
  query: ReferralQuery,
  selectedId?: string
): URLSearchParams {
  const params = new URLSearchParams();
  params.set('page', String(query.page));
  params.set('pageSize', String(query.pageSize));
  if (query.searchField !== 'all') {
    params.set('searchField', query.searchField);
  }
  if (query.status !== 'all') {
    params.set('status', query.status);
  }
  if (query.anomalyStatus !== 'all') {
    params.set('anomaly', query.anomalyStatus);
  }
  if (query.startDate) {
    params.set('startDate', query.startDate);
  }
  if (query.endDate) {
    params.set('endDate', query.endDate);
  }
  if (query.keyword.trim()) {
    params.set('keyword', query.keyword.trim());
  }
  if (selectedId) {
    params.set('selected', selectedId);
  }
  return params;
}

export function filterReferrals(
  referrals: ReferralSummary[],
  query: ReferralQuery
): ReferralSummary[] {
  const keyword = query.keyword.trim().toLowerCase();

  const filtered = referrals.filter((item) => {
    if (!matchesSearchDateRange(item.lastUsedAt, query.startDate, query.endDate)) {
      return false;
    }
    if (query.status !== 'all' && item.status !== query.status) {
      return false;
    }
    if (
      query.anomalyStatus !== 'all' &&
      item.anomalyStatus !== query.anomalyStatus
    ) {
      return false;
    }
    if (!keyword) {
      return true;
    }

    return matchesSearchField(keyword, query.searchField, {
      code: item.code,
      referrerId: item.referrerUserId,
      referrerName: item.referrerName
    });
  });

  return [...filtered].sort((left, right) =>
    right.lastUsedAt.localeCompare(left.lastUsedAt)
  );
}

export function formatCurrentDateTime(): string {
  return new Date().toISOString().slice(0, 16).replace('T', ' ');
}

export function formatRewardAmount(amount: number): string {
  const absolute = Math.abs(amount).toLocaleString();
  if (amount > 0) {
    return `+${absolute}`;
  }
  if (amount < 0) {
    return `-${absolute}`;
  }
  return '0';
}

export function calculateCompletedRewardAmount(
  entries: ReferralRewardLedgerEntry[]
): number {
  return entries
    .filter((entry) => entry.status === '완료')
    .reduce((total, entry) => total + entry.amount, 0);
}

export function buildPolicyItems(
  referral: ReferralSummary
): DescriptionsProps['items'] {
  return [
    {
      key: 'version',
      label: '정책 버전',
      children: referral.policySnapshot.version
    },
    {
      key: 'confirmationTiming',
      label: '추천 확정 시점',
      children: referral.policySnapshot.confirmationTiming
    },
    {
      key: 'rewardMethod',
      label: '보상 수단',
      children: referral.policySnapshot.rewardMethod
    },
    {
      key: 'manualAdjustmentAuthority',
      label: '수동 보정 권한',
      children: referral.policySnapshot.manualAdjustmentAuthority
    },
    {
      key: 'rollbackRule',
      label: '회수/취소 규칙',
      children: referral.policySnapshot.rollbackRule
    }
  ];
}

export function getAdjustmentEntryType(amount: number): ReferralRewardLedgerEntry['entryType'] {
  return amount >= 0 ? '수동 보정' : '회수';
}
