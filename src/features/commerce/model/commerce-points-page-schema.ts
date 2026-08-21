import type { TableProps } from 'antd';

import type { PointsOverview } from './point-page-contract';
import type { SortOrder } from 'antd/es/table/interface';

import type {
  CommercePointsQuery,
  CommercePointsSnapshot,
  PointExpiration,
  PointExpirationQuery,
  PointLedger,
  PointLedgerQuery,
  PointLedgerSourceType,
  PointLedgerType,
  PointPolicy,
  PointPolicyQuery,
  PointPolicyType
} from './point-types';
import {
  matchesSearchDateRange,
  matchesSearchField
} from '@/shared/ui/search-bar/search-bar-utils';

// 포인트 관리 페이지 스키마 — Phase 4 분해로 페이지 모듈 상단에서 이동(동작 동일).
// 폼/필터/위험 조치 타입·포맷터·정렬/필터·URL 파서·요약 카드 빌더·폼 기본값을 담는다.

export const pageSizeOptions = ['10', '20', '50'];

export type PolicyFormValues = {
  name: string;
  policyType: PointPolicyType;
  conditionSummary: string;
  earnDebitRule: string;
  expirationRule: string;
  targetCondition: string;
  triggerSource: string;
  duplicationRule: string;
  manualAdjustmentRule: string;
  note: string;
};

export type ManualAdjustmentFormValues = {
  userId: string;
  userName: string;
  ledgerType: Extract<PointLedgerType, '적립' | '차감' | '회수' | '복구'>;
  amount: number;
  approvalMemo: string;
  reason: string;
};

export type ExpirationHoldFormValues = {
  expirationId: string;
  holdReason: string;
};

export type PolicyDraftFilter = {
  status: PointPolicyQuery['status'];
  type: PointPolicyQuery['type'];
};

export type LedgerDraftFilter = {
  type: PointLedgerQuery['type'];
  sourceType: PointLedgerQuery['sourceType'];
  status: PointLedgerQuery['status'];
};

export type ExpirationDraftFilter = {
  status: PointExpirationQuery['status'];
};

export type PolicyModalState =
  | { mode: 'create'; policy: null }
  | { mode: 'edit'; policy: PointPolicy }
  | null;

export type DangerState =
  | { type: 'activate-policy'; policy: PointPolicy }
  | { type: 'pause-policy'; policy: PointPolicy }
  | { type: 'release-expiration'; expiration: PointExpiration }
  | null;

export function createEmptySnapshot(): CommercePointsSnapshot {
  return {
    policies: [],
    ledgers: [],
    expirations: []
  };
}

export function formatPoint(value: number): string {
  return `${value.toLocaleString('ko-KR')}P`;
}

export function formatPointDelta(value: number): string {
  const sign = value > 0 ? '+' : '';
  return `${sign}${value.toLocaleString('ko-KR')}P`;
}

export function compareText(left: string | number, right: string | number): number {
  return String(left).localeCompare(String(right), 'ko-KR', {
    numeric: true,
    sensitivity: 'base'
  });
}

export function getSorterField(
  sorter:
    | Parameters<NonNullable<TableProps<PointPolicy>['onChange']>>[2]
    | Parameters<NonNullable<TableProps<PointLedger>['onChange']>>[2]
    | Parameters<NonNullable<TableProps<PointExpiration>['onChange']>>[2]
): string | null {
  if (Array.isArray(sorter)) {
    return getSorterField(sorter[0]);
  }

  if (!sorter) {
    return null;
  }

  if (typeof sorter.field === 'string') {
    return sorter.field;
  }

  return typeof sorter.columnKey === 'string' ? sorter.columnKey : null;
}

export function applySortDirection(
  difference: number,
  sortOrder: SortOrder | null
): number {
  return sortOrder === 'descend' ? difference * -1 : difference;
}

export function sortPolicies(
  policies: PointPolicy[],
  query: PointPolicyQuery
): PointPolicy[] {
  if (!query.sortField || !query.sortOrder) {
    return policies;
  }

  return [...policies].sort((left, right) => {
    const difference =
      query.sortField === 'name'
        ? compareText(left.name, right.name)
        : query.sortField === 'policyType'
          ? compareText(left.policyType, right.policyType)
          : query.sortField === 'status'
            ? compareText(left.status, right.status)
            : compareText(left.updatedAt, right.updatedAt);

    return applySortDirection(difference, query.sortOrder);
  });
}

export function sortLedgers(
  ledgers: PointLedger[],
  query: PointLedgerQuery
): PointLedger[] {
  if (!query.sortField || !query.sortOrder) {
    return ledgers;
  }

  return [...ledgers].sort((left, right) => {
    const difference =
      query.sortField === 'occurredAt'
        ? compareText(left.occurredAt, right.occurredAt)
        : query.sortField === 'ledgerType'
          ? compareText(left.ledgerType, right.ledgerType)
          : query.sortField === 'sourceType'
            ? compareText(left.sourceType, right.sourceType)
            : query.sortField === 'pointDelta'
              ? left.pointDelta - right.pointDelta
              : query.sortField === 'expirationAt'
                ? compareText(left.expirationAt || '', right.expirationAt || '')
                : compareText(left.status, right.status);

    return applySortDirection(difference, query.sortOrder);
  });
}

export function sortExpirations(
  expirations: PointExpiration[],
  query: PointExpirationQuery
): PointExpiration[] {
  if (!query.sortField || !query.sortOrder) {
    return expirations;
  }

  return [...expirations].sort((left, right) => {
    const difference =
      query.sortField === 'scheduledAt'
        ? compareText(left.scheduledAt, right.scheduledAt)
        : query.sortField === 'sourceType'
          ? compareText(left.sourceType, right.sourceType)
          : query.sortField === 'expiringPoint'
            ? left.expiringPoint - right.expiringPoint
            : query.sortField === 'availablePoint'
              ? left.availablePoint - right.availablePoint
              : compareText(left.status, right.status);

    return applySortDirection(difference, query.sortOrder);
  });
}

export function getFirstTableFilterValue(
  value: Parameters<
    NonNullable<TableProps<PointPolicy>['onChange']>
  >[1][string] | null | undefined
): string | null {
  if (!Array.isArray(value)) {
    return null;
  }

  const normalized = value[0];
  return typeof normalized === 'string' ? normalized : null;
}

export function parsePolicySortField(
  value: string | null
): PointPolicyQuery['sortField'] {
  if (
    value === 'name' ||
    value === 'policyType' ||
    value === 'status' ||
    value === 'updatedAt'
  ) {
    return value;
  }

  return null;
}

export function parseLedgerSortField(
  value: string | null
): PointLedgerQuery['sortField'] {
  if (
    value === 'occurredAt' ||
    value === 'ledgerType' ||
    value === 'sourceType' ||
    value === 'pointDelta' ||
    value === 'expirationAt' ||
    value === 'status'
  ) {
    return value;
  }

  return null;
}

export function parseExpirationSortField(
  value: string | null
): PointExpirationQuery['sortField'] {
  if (
    value === 'scheduledAt' ||
    value === 'sourceType' ||
    value === 'expiringPoint' ||
    value === 'availablePoint' ||
    value === 'status'
  ) {
    return value;
  }

  return null;
}

export function paginateItems<T>(items: T[], page: number, pageSize: number): T[] {
  const startIndex = (page - 1) * pageSize;
  return items.slice(startIndex, startIndex + pageSize);
}

export function getSourceRoute(
  sourceType: PointLedgerSourceType,
  sourceId: string
): string | null {
  if (sourceType === '추천') {
    return `/users/referrals?keyword=${encodeURIComponent(sourceId)}`;
  }
  if (sourceType === '미션') {
    return `/content/missions?keyword=${encodeURIComponent(sourceId)}`;
  }
  if (sourceType === '이벤트') {
    return `/operation/events?keyword=${encodeURIComponent(sourceId)}`;
  }
  if (sourceType === '결제') {
    return `/commerce/payments?keyword=${encodeURIComponent(sourceId)}`;
  }
  if (sourceType === '환불') {
    return `/commerce/refunds?keyword=${encodeURIComponent(sourceId)}`;
  }

  return null;
}

export function filterPolicies(
  policies: PointPolicy[],
  query: PointPolicyQuery
): PointPolicy[] {
  const keyword = query.keyword.trim().toLowerCase();

  return policies.filter((policy) => {
    if (query.status !== 'all' && policy.status !== query.status) {
      return false;
    }
    if (query.type !== 'all' && policy.policyType !== query.type) {
      return false;
    }
    if (!keyword) {
      return true;
    }

    return matchesSearchField(keyword, query.searchField, {
      name: policy.name,
      id: policy.id
    });
  });
}

export function filterLedgers(
  ledgers: PointLedger[],
  query: PointLedgerQuery
): PointLedger[] {
  const keyword = query.keyword.trim().toLowerCase();

  return ledgers.filter((ledger) => {
    if (!matchesSearchDateRange(ledger.occurredAt, query.startDate, query.endDate)) {
      return false;
    }
    if (query.type !== 'all' && ledger.ledgerType !== query.type) {
      return false;
    }
    if (query.sourceType !== 'all' && ledger.sourceType !== query.sourceType) {
      return false;
    }
    if (query.status !== 'all' && ledger.status !== query.status) {
      return false;
    }
    if (!keyword) {
      return true;
    }

    return matchesSearchField(keyword, query.searchField, {
      userId: ledger.userId,
      userName: ledger.userName,
      id: ledger.id
    });
  });
}

export function filterExpirations(
  expirations: PointExpiration[],
  query: PointExpirationQuery
): PointExpiration[] {
  const keyword = query.keyword.trim().toLowerCase();

  return expirations.filter((expiration) => {
    if (
      !matchesSearchDateRange(
        expiration.scheduledAt,
        query.startDate,
        query.endDate
      )
    ) {
      return false;
    }
    if (query.status !== 'all' && expiration.status !== query.status) {
      return false;
    }
    if (!keyword) {
      return true;
    }

    return matchesSearchField(keyword, query.searchField, {
      userId: expiration.userId,
      userName: expiration.userName,
      id: expiration.id
    });
  });
}

export function createPolicyFormDefaults(policy: PointPolicy | null): PolicyFormValues {
  if (!policy) {
    return {
      name: '',
      policyType: '적립',
      conditionSummary: '',
      earnDebitRule: '',
      expirationRule: '',
      targetCondition: '',
      triggerSource: '',
      duplicationRule: '',
      manualAdjustmentRule: '',
      note: ''
    };
  }

  return {
    name: policy.name,
    policyType: policy.policyType,
    conditionSummary: policy.conditionSummary,
    earnDebitRule: policy.earnDebitRule,
    expirationRule: policy.expirationRule,
    targetCondition: policy.targetCondition,
    triggerSource: policy.triggerSource,
    duplicationRule: policy.duplicationRule,
    manualAdjustmentRule: policy.manualAdjustmentRule,
    note: policy.note
  };
}

export function createManualAdjustmentDefaults(
  ledger: PointLedger | null
): ManualAdjustmentFormValues {
  return {
    userId: ledger?.userId ?? '',
    userName: ledger?.userName ?? '',
    ledgerType: '적립',
    amount: 1000,
    approvalMemo: '',
    reason: ''
  };
}

export function getDangerCopy(state: DangerState) {
  if (state?.type === 'activate-policy') {
    return {
      title: '포인트 정책을 운영 시작할까요?',
      description:
        '정책을 운영 시작하면 관련 적립/차감 계산 기준으로 바로 반영됩니다. 변경 사유를 남겨 주세요.',
      confirmText: '운영 시작',
      targetType: 'CommercePointPolicy',
      targetId: state.policy.id,
      successMessage: '포인트 정책을 운영 시작했습니다.'
    };
  }

  if (state?.type === 'pause-policy') {
    return {
      title: '포인트 정책을 중지할까요?',
      description:
        '정책을 중지하면 신규 적립/차감 계산에서 제외됩니다. 운영 중지 사유를 남겨 주세요.',
      confirmText: '운영 중지',
      targetType: 'CommercePointPolicy',
      targetId: state.policy.id,
      successMessage: '포인트 정책을 중지했습니다.'
    };
  }

  return {
    title: '소멸 보류를 해제할까요?',
    description:
      '보류 해제 후에는 다음 소멸 배치 대상에 다시 포함됩니다. 보류 해제 사유를 남겨 주세요.',
    confirmText: '보류 해제',
    targetType: 'CommercePointExpiration',
    targetId: state?.expiration.id ?? '',
    successMessage: '소멸 보류를 해제했습니다.'
  };
}

// 상단 요약 카드 — 페이지 useMemo 본문을 함수화(Phase 4 분해, 동작 동일).
/**
 * 요약 카드.
 *
 * 서버 페이징으로 바뀌면서 전량 배열이 사라졌으므로 **개요 건수**(`PointsOverview`)를 받는다.
 * 카드가 세는 값은 이전과 같은 의미다 — 상태 **필터 무관** 탭 전체 기준. 필터를 적용해 세면
 * 카드가 자기 자신을 0 으로 만들어 버린다.
 */
export function buildPointsSummaryCards(
  overview: PointsOverview,
  query: CommercePointsQuery,
  commitPolicyQuery: (next: Partial<PointPolicyQuery>) => void,
  commitLedgerQuery: (next: Partial<PointLedgerQuery>) => void,
  commitExpirationQuery: (next: Partial<PointExpirationQuery>) => void
) {
  if (query.tab === 'policy') {
    const counts = overview.policyStatusCounts;
    const statusCounts = {
      all: counts.all ?? 0,
      draft: counts['초안'] ?? 0,
      active: counts['운영 중'] ?? 0,
      paused: counts['중지'] ?? 0
    };

    return [
      {
        key: 'policy-all',
        label: '전체 정책',
        value: `${statusCounts.all.toLocaleString()}건`,
        active: query.policy.status === 'all',
        onClick: () => commitPolicyQuery({ page: 1, status: 'all' })
      },
      {
        key: 'policy-draft',
        label: '초안 정책',
        value: `${statusCounts.draft.toLocaleString()}건`,
        active: query.policy.status === '초안',
        onClick: () => commitPolicyQuery({ page: 1, status: '초안' })
      },
      {
        key: 'policy-active',
        label: '운영 중 정책',
        value: `${statusCounts.active.toLocaleString()}건`,
        active: query.policy.status === '운영 중',
        onClick: () => commitPolicyQuery({ page: 1, status: '운영 중' })
      },
      {
        key: 'policy-paused',
        label: '중지 정책',
        value: `${statusCounts.paused.toLocaleString()}건`,
        active: query.policy.status === '중지',
        onClick: () => commitPolicyQuery({ page: 1, status: '중지' })
      }
    ];
  }

  if (query.tab === 'ledger') {
    const counts = overview.ledgerStatusCounts;
    const statusCounts = {
      all: counts.all ?? 0,
      completed: counts['완료'] ?? 0,
      held: counts['보류'] ?? 0,
      canceled: counts['취소'] ?? 0
    };

    return [
      {
        key: 'ledger-all',
        label: '전체 원장',
        value: `${statusCounts.all.toLocaleString()}건`,
        active: query.ledger.status === 'all',
        onClick: () => commitLedgerQuery({ page: 1, status: 'all' })
      },
      {
        key: 'ledger-completed',
        label: '완료 원장',
        value: `${statusCounts.completed.toLocaleString()}건`,
        active: query.ledger.status === '완료',
        onClick: () => commitLedgerQuery({ page: 1, status: '완료' })
      },
      {
        key: 'ledger-held',
        label: '보류 원장',
        value: `${statusCounts.held.toLocaleString()}건`,
        active: query.ledger.status === '보류',
        onClick: () => commitLedgerQuery({ page: 1, status: '보류' })
      },
      {
        key: 'ledger-canceled',
        label: '취소 원장',
        value: `${statusCounts.canceled.toLocaleString()}건`,
        active: query.ledger.status === '취소',
        onClick: () => commitLedgerQuery({ page: 1, status: '취소' })
      }
    ];
  }

  const expirationCounts = overview.expirationStatusCounts;
  const statusCounts = {
    all: expirationCounts.all ?? 0,
    scheduled: expirationCounts['예정'] ?? 0,
    held: expirationCounts['보류'] ?? 0,
    completed: expirationCounts['완료'] ?? 0,
    canceled: expirationCounts['취소'] ?? 0
  };

  return [
    {
      key: 'expiration-all',
      label: '전체 소멸 예정',
      value: `${statusCounts.all.toLocaleString()}건`,
      active: query.expiration.status === 'all',
      onClick: () => commitExpirationQuery({ page: 1, status: 'all' })
    },
    {
      key: 'expiration-scheduled',
      label: '예정 건',
      value: `${statusCounts.scheduled.toLocaleString()}건`,
      active: query.expiration.status === '예정',
      onClick: () => commitExpirationQuery({ page: 1, status: '예정' })
    },
    {
      key: 'expiration-held',
      label: '보류 건',
      value: `${statusCounts.held.toLocaleString()}건`,
      active: query.expiration.status === '보류',
      onClick: () => commitExpirationQuery({ page: 1, status: '보류' })
    },
    {
      key: 'expiration-completed',
      label: '완료 건',
      value: `${statusCounts.completed.toLocaleString()}건`,
      active: query.expiration.status === '완료',
      onClick: () => commitExpirationQuery({ page: 1, status: '완료' })
    },
    {
      key: 'expiration-canceled',
      label: '취소 건',
      value: `${statusCounts.canceled.toLocaleString()}건`,
      active: query.expiration.status === '취소',
      onClick: () => commitExpirationQuery({ page: 1, status: '취소' })
    }
  ];
}

export function getPointsEmptyMessage(tab: CommercePointsQuery['tab']) {
  return tab === 'policy'
    ? {
        message: '조건에 맞는 포인트 정책이 없습니다.',
        description: '정책 상태나 유형, 검색어를 조정한 뒤 다시 확인해 주세요.'
      }
    : tab === 'ledger'
      ? {
          message: '조건에 맞는 포인트 원장이 없습니다.',
          description:
            '회원, 원장 유형, 원천, 기간 조건을 조정한 뒤 다시 확인해 주세요.'
        }
      : {
          message: '현재 예정된 소멸 건이 없습니다.',
          description: '소멸 상태 또는 기간 조건을 조정한 뒤 다시 확인해 주세요.'
        };
}
