import type { AsyncState } from '@/shared/model/async-state';
import {
  matchesSearchDateRange,
  matchesSearchField
} from '@/shared/ui/search-bar/search-bar-utils';

import type {
  OperationPolicy,
  OperationPolicyCategory,
  OperationPolicyHistoryEntry,
  OperationPolicyStatus,
  OperationPolicyTrackingStatus,
  OperationPolicyType
} from './policy-types';
import {
  operationPolicyCategoryValues,
  operationPolicyTrackingStatusValues,
  operationPolicyTypeValues
} from './policy-types';

// 정책 목록 화면의 순수 스키마 — Phase 4 분해로 페이지 본문에서 이동(동작 동일).
// 조회 상태·조치 핸들러·URL 커밋은 페이지가 소유하고, 여기는 상수·파서·필터·카피만 둔다.

export const policyStatusFilterValues = ['게시', '숨김'] as const;
export const policySortableFieldValues = [
  'id',
  'category',
  'policyType',
  'title',
  'trackingStatus',
  'versionLabel',
  'effectiveDate',
  'status',
  'updatedAt'
] as const;

export type PolicySortField = (typeof policySortableFieldValues)[number];
export type PolicySummaryFilter = 'published' | 'operational' | 'pending';

export type PolicyActionState = {
  policy: OperationPolicy;
  nextStatus: OperationPolicyStatus;
} | null;

export type PolicyPreviewState = {
  title: string;
  bodyHtml: string;
  editTarget?: OperationPolicy;
} | null;

export type PolicyHistoryPublishState = {
  policy: OperationPolicy;
  historyEntry: OperationPolicyHistoryEntry;
} | null;

export function parsePolicyStatus(value: string | null): OperationPolicyStatus | null {
  if (value === '게시' || value === '숨김') {
    return value;
  }

  return null;
}

export function parsePolicyType(value: string | null): OperationPolicyType | null {
  if (
    value &&
    operationPolicyTypeValues.includes(value as OperationPolicyType)
  ) {
    return value as OperationPolicyType;
  }

  return null;
}

export function parsePolicyCategory(value: string | null): OperationPolicyCategory | null {
  if (
    value &&
    operationPolicyCategoryValues.includes(value as OperationPolicyCategory)
  ) {
    return value as OperationPolicyCategory;
  }

  return null;
}

export function parseTrackingStatus(
  value: string | null
): OperationPolicyTrackingStatus | null {
  if (
    value &&
    operationPolicyTrackingStatusValues.includes(
      value as OperationPolicyTrackingStatus
    )
  ) {
    return value as OperationPolicyTrackingStatus;
  }

  return null;
}

export function parsePolicySummaryFilter(
  value: string | null
): PolicySummaryFilter | null {
  if (
    value === 'published' ||
    value === 'operational' ||
    value === 'pending'
  ) {
    return value;
  }

  return null;
}

export function parseSortField(value: string | null): PolicySortField | null {
  if (
    value === 'id' ||
    value === 'category' ||
    value === 'policyType' ||
    value === 'title' ||
    value === 'trackingStatus' ||
    value === 'versionLabel' ||
    value === 'effectiveDate' ||
    value === 'status' ||
    value === 'updatedAt'
  ) {
    return value;
  }

  return null;
}

export function getActionCopy(nextStatus: OperationPolicyStatus) {
  if (nextStatus === '게시') {
    return {
      title: '정책 게시',
      description:
        '숨김 상태 정책을 게시합니다. 시행일과 사용자 노출 위치를 다시 확인한 뒤 사유를 남겨주세요.',
      confirmText: '게시 실행',
      successMessage: '정책 게시 완료'
    };
  }

  return {
    title: '정책 숨김',
    description:
      '게시 중인 정책 노출을 중단합니다. 숨김 사유를 남겨주세요.',
    confirmText: '숨김 실행',
    successMessage: '정책 숨김 완료'
  };
}

export function getHistoryActionLabel(action: OperationPolicyHistoryEntry['action']) {
  switch (action) {
    case 'created':
      return '등록';
    case 'updated':
      return '수정';
    case 'status_changed':
      return '상태 변경';
    case 'version_published':
      return '이력 버전 게시';
    case 'deleted':
      return '삭제';
    default:
      return action;
  }
}

export function createInitialHistoryState(): AsyncState<OperationPolicyHistoryEntry[]> {
  return {
    status: 'success',
    data: [],
    errorMessage: null,
    errorCode: null
  };
}

// 아래 두 함수는 페이지 useMemo 본문을 그대로 옮긴 순수 변환이다.
export type OperationPoliciesFilterInput = {
  statusFilter: OperationPolicyStatus | null;
  categoryFilter: OperationPolicyCategory | null;
  policyTypeFilter: OperationPolicyType | null;
  trackingStatusFilter: OperationPolicyTrackingStatus | null;
  summaryFilter: PolicySummaryFilter | null;
  startDate: string;
  endDate: string;
  keyword: string;
  searchField: string;
};

export function filterOperationPolicies(
  policies: OperationPolicy[],
  {
    statusFilter,
    categoryFilter,
    policyTypeFilter,
    trackingStatusFilter,
    summaryFilter,
    startDate,
    endDate,
    keyword,
    searchField
  }: OperationPoliciesFilterInput
): OperationPolicy[] {
  return policies.filter((policy) => {
    if (statusFilter && policy.status !== statusFilter) {
      return false;
    }

    if (categoryFilter && policy.category !== categoryFilter) {
      return false;
    }

    if (policyTypeFilter && policy.policyType !== policyTypeFilter) {
      return false;
    }

    if (trackingStatusFilter && policy.trackingStatus !== trackingStatusFilter) {
      return false;
    }

    if (summaryFilter === 'published' && policy.status !== '게시') {
      return false;
    }

    if (
      summaryFilter === 'operational' &&
      policy.category === '법률/약관'
    ) {
      return false;
    }

    if (
      summaryFilter === 'pending' &&
      policy.trackingStatus !== '정책 미확정'
    ) {
      return false;
    }

    if (!matchesSearchDateRange(policy.effectiveDate, startDate, endDate)) {
      return false;
    }

    return matchesSearchField(keyword, searchField, {
      id: policy.id,
      category: policy.category,
      title: policy.title,
      versionLabel: policy.versionLabel,
      trackingStatus: policy.trackingStatus,
      relatedAdminPages: policy.relatedAdminPages,
      relatedUserPages: policy.relatedUserPages,
      sourceDocuments: policy.sourceDocuments,
      summary: policy.summary,
      legalReferences: policy.legalReferences,
      policyType: policy.policyType
    });
  });
}

export function buildPolicySummaryCards({
  policies,
  summaryFilter,
  onSelect
}: {
  policies: OperationPolicy[];
  summaryFilter: PolicySummaryFilter | null;
  onSelect: (next: PolicySummaryFilter | null) => void;
}) {
  const publishedCount = policies.filter(
    (policy) => policy.status === '게시'
  ).length;
  const operationalPolicyCount = policies.filter(
    (policy) => policy.category !== '법률/약관'
  ).length;
  const policyPendingCount = policies.filter(
    (policy) => policy.trackingStatus === '정책 미확정'
  ).length;
  const currentSummaryFilter = summaryFilter ?? 'all';

  return [
    {
      key: 'all',
      label: '전체 정책',
      value: `${policies.length.toLocaleString()}건`,
      active: currentSummaryFilter === 'all',
      onClick: () => onSelect(null)
    },
    {
      key: 'published',
      label: '게시 중',
      value: `${publishedCount.toLocaleString()}건`,
      active: currentSummaryFilter === 'published',
      onClick: () =>
        onSelect('published')
    },
    {
      key: 'operational',
      label: '운영 정책',
      value: `${operationalPolicyCount.toLocaleString()}건`,
      active: currentSummaryFilter === 'operational',
      onClick: () =>
        onSelect('operational')
    },
    {
      key: 'pending',
      label: '정책 미확정',
      value: `${policyPendingCount.toLocaleString()}건`,
      active: currentSummaryFilter === 'pending',
      onClick: () => onSelect('pending')
    }
  ];
}
