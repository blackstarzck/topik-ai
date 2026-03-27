import { parseSearchDate } from '../../../shared/ui/search-bar/search-bar-utils';
import type {
  CommercePointsQuery,
  PointExpirationQuery,
  PointExpirationSortField,
  PointExpirationStatusFilter,
  PointExpirationSearchField,
  PointLedgerQuery,
  PointLedgerSortField,
  PointLedgerSearchField,
  PointLedgerSourceTypeFilter,
  PointLedgerStatusFilter,
  PointLedgerTypeFilter,
  PointPolicyQuery,
  PointPolicySortField,
  PointPolicySearchField,
  PointSortOrder,
  PointPolicyStatusFilter,
  PointPolicyTypeFilter,
  PointsTab
} from './point-types';

const defaultPage = 1;
const defaultPageSize = 10;

export const defaultPointPolicyQuery: PointPolicyQuery = {
  page: defaultPage,
  pageSize: defaultPageSize,
  searchField: 'name',
  keyword: '',
  status: 'all',
  type: 'all',
  sortField: null,
  sortOrder: null
};

export const defaultPointLedgerQuery: PointLedgerQuery = {
  page: defaultPage,
  pageSize: defaultPageSize,
  searchField: 'userId',
  keyword: '',
  type: 'all',
  sourceType: 'all',
  status: 'all',
  startDate: '',
  endDate: '',
  sortField: null,
  sortOrder: null
};

export const defaultPointExpirationQuery: PointExpirationQuery = {
  page: defaultPage,
  pageSize: defaultPageSize,
  searchField: 'userId',
  keyword: '',
  status: 'all',
  startDate: '',
  endDate: '',
  sortField: null,
  sortOrder: null
};

export const defaultCommercePointsQuery: CommercePointsQuery = {
  tab: 'policy',
  selectedId: '',
  policy: defaultPointPolicyQuery,
  ledger: defaultPointLedgerQuery,
  expiration: defaultPointExpirationQuery
};

function parsePositiveNumber(value: string | null, fallback: number): number {
  if (!value) {
    return fallback;
  }

  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return fallback;
  }

  return parsed;
}

function parsePointsTab(value: string | null): PointsTab {
  if (value === 'ledger' || value === 'expiration') {
    return value;
  }

  return defaultCommercePointsQuery.tab;
}

function parseSortOrder(value: string | null): PointSortOrder {
  return value === 'ascend' || value === 'descend' ? value : null;
}

function parsePointPolicySearchField(
  value: string | null
): PointPolicySearchField {
  return value === 'id' ? 'id' : defaultPointPolicyQuery.searchField;
}

function parsePointPolicyStatusFilter(
  value: string | null
): PointPolicyStatusFilter {
  if (value === '초안' || value === '운영 중' || value === '중지') {
    return value;
  }

  return defaultPointPolicyQuery.status;
}

function parsePointPolicyTypeFilter(
  value: string | null
): PointPolicyTypeFilter {
  if (value === '적립' || value === '차감' || value === '소멸') {
    return value;
  }

  return defaultPointPolicyQuery.type;
}

function parsePointPolicySortField(
  value: string | null
): PointPolicySortField | null {
  if (
    value === 'name' ||
    value === 'policyType' ||
    value === 'status' ||
    value === 'updatedAt'
  ) {
    return value;
  }

  return defaultPointPolicyQuery.sortField;
}

function parsePointLedgerSearchField(
  value: string | null
): PointLedgerSearchField {
  if (value === 'userName' || value === 'id') {
    return value;
  }

  return defaultPointLedgerQuery.searchField;
}

function parsePointLedgerTypeFilter(
  value: string | null
): PointLedgerTypeFilter {
  if (
    value === '적립' ||
    value === '차감' ||
    value === '회수' ||
    value === '복구' ||
    value === '소멸'
  ) {
    return value;
  }

  return defaultPointLedgerQuery.type;
}

function parsePointLedgerSourceTypeFilter(
  value: string | null
): PointLedgerSourceTypeFilter {
  if (
    value === '추천' ||
    value === '미션' ||
    value === '이벤트' ||
    value === '결제' ||
    value === '환불' ||
    value === '관리자' ||
    value === '시스템'
  ) {
    return value;
  }

  return defaultPointLedgerQuery.sourceType;
}

function parsePointLedgerStatusFilter(
  value: string | null
): PointLedgerStatusFilter {
  if (value === '완료' || value === '보류' || value === '취소') {
    return value;
  }

  return defaultPointLedgerQuery.status;
}

function parsePointLedgerSortField(
  value: string | null
): PointLedgerSortField | null {
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

  return defaultPointLedgerQuery.sortField;
}

function parsePointExpirationSearchField(
  value: string | null
): PointExpirationSearchField {
  if (value === 'userName' || value === 'id') {
    return value;
  }

  return defaultPointExpirationQuery.searchField;
}

function parsePointExpirationStatusFilter(
  value: string | null
): PointExpirationStatusFilter {
  if (
    value === '예정' ||
    value === '보류' ||
    value === '완료' ||
    value === '취소'
  ) {
    return value;
  }

  return defaultPointExpirationQuery.status;
}

function parsePointExpirationSortField(
  value: string | null
): PointExpirationSortField | null {
  if (
    value === 'scheduledAt' ||
    value === 'sourceType' ||
    value === 'expiringPoint' ||
    value === 'availablePoint' ||
    value === 'status'
  ) {
    return value;
  }

  return defaultPointExpirationQuery.sortField;
}

export function parseCommercePointsQuery(
  searchParams: URLSearchParams
): CommercePointsQuery {
  return {
    tab: parsePointsTab(searchParams.get('tab')),
    selectedId: searchParams.get('selected') ?? '',
    policy: {
      page: parsePositiveNumber(
        searchParams.get('policyPage'),
        defaultPointPolicyQuery.page
      ),
      pageSize: parsePositiveNumber(
        searchParams.get('policyPageSize'),
        defaultPointPolicyQuery.pageSize
      ),
      searchField: parsePointPolicySearchField(
        searchParams.get('policySearchField')
      ),
      keyword: searchParams.get('policyKeyword') ?? '',
      status: parsePointPolicyStatusFilter(searchParams.get('policyStatus')),
      type: parsePointPolicyTypeFilter(searchParams.get('policyType')),
      sortField: parsePointPolicySortField(searchParams.get('policySortField')),
      sortOrder: parseSortOrder(searchParams.get('policySortOrder'))
    },
    ledger: {
      page: parsePositiveNumber(
        searchParams.get('ledgerPage'),
        defaultPointLedgerQuery.page
      ),
      pageSize: parsePositiveNumber(
        searchParams.get('ledgerPageSize'),
        defaultPointLedgerQuery.pageSize
      ),
      searchField: parsePointLedgerSearchField(
        searchParams.get('ledgerSearchField')
      ),
      keyword: searchParams.get('ledgerKeyword') ?? '',
      type: parsePointLedgerTypeFilter(searchParams.get('ledgerType')),
      sourceType: parsePointLedgerSourceTypeFilter(
        searchParams.get('ledgerSourceType')
      ),
      status: parsePointLedgerStatusFilter(searchParams.get('ledgerStatus')),
      startDate: parseSearchDate(searchParams.get('ledgerStartDate')),
      endDate: parseSearchDate(searchParams.get('ledgerEndDate')),
      sortField: parsePointLedgerSortField(searchParams.get('ledgerSortField')),
      sortOrder: parseSortOrder(searchParams.get('ledgerSortOrder'))
    },
    expiration: {
      page: parsePositiveNumber(
        searchParams.get('expirationPage'),
        defaultPointExpirationQuery.page
      ),
      pageSize: parsePositiveNumber(
        searchParams.get('expirationPageSize'),
        defaultPointExpirationQuery.pageSize
      ),
      searchField: parsePointExpirationSearchField(
        searchParams.get('expirationSearchField')
      ),
      keyword: searchParams.get('expirationKeyword') ?? '',
      status: parsePointExpirationStatusFilter(
        searchParams.get('expirationStatus')
      ),
      startDate: parseSearchDate(searchParams.get('expirationStartDate')),
      endDate: parseSearchDate(searchParams.get('expirationEndDate')),
      sortField: parsePointExpirationSortField(
        searchParams.get('expirationSortField')
      ),
      sortOrder: parseSortOrder(searchParams.get('expirationSortOrder'))
    }
  };
}

export function buildCommercePointsSearchParams(
  query: CommercePointsQuery
): URLSearchParams {
  const params = new URLSearchParams();

  if (query.tab !== defaultCommercePointsQuery.tab) {
    params.set('tab', query.tab);
  }
  if (query.selectedId) {
    params.set('selected', query.selectedId);
  }

  params.set('policyPage', String(query.policy.page));
  params.set('policyPageSize', String(query.policy.pageSize));
  if (query.policy.searchField !== defaultPointPolicyQuery.searchField) {
    params.set('policySearchField', query.policy.searchField);
  }
  if (query.policy.keyword.trim()) {
    params.set('policyKeyword', query.policy.keyword.trim());
  }
  if (query.policy.status !== defaultPointPolicyQuery.status) {
    params.set('policyStatus', query.policy.status);
  }
  if (query.policy.type !== defaultPointPolicyQuery.type) {
    params.set('policyType', query.policy.type);
  }
  if (query.policy.sortField) {
    params.set('policySortField', query.policy.sortField);
  }
  if (query.policy.sortOrder) {
    params.set('policySortOrder', query.policy.sortOrder);
  }

  params.set('ledgerPage', String(query.ledger.page));
  params.set('ledgerPageSize', String(query.ledger.pageSize));
  if (query.ledger.searchField !== defaultPointLedgerQuery.searchField) {
    params.set('ledgerSearchField', query.ledger.searchField);
  }
  if (query.ledger.keyword.trim()) {
    params.set('ledgerKeyword', query.ledger.keyword.trim());
  }
  if (query.ledger.type !== defaultPointLedgerQuery.type) {
    params.set('ledgerType', query.ledger.type);
  }
  if (query.ledger.sourceType !== defaultPointLedgerQuery.sourceType) {
    params.set('ledgerSourceType', query.ledger.sourceType);
  }
  if (query.ledger.status !== defaultPointLedgerQuery.status) {
    params.set('ledgerStatus', query.ledger.status);
  }
  if (query.ledger.startDate) {
    params.set('ledgerStartDate', query.ledger.startDate);
  }
  if (query.ledger.endDate) {
    params.set('ledgerEndDate', query.ledger.endDate);
  }
  if (query.ledger.sortField) {
    params.set('ledgerSortField', query.ledger.sortField);
  }
  if (query.ledger.sortOrder) {
    params.set('ledgerSortOrder', query.ledger.sortOrder);
  }

  params.set('expirationPage', String(query.expiration.page));
  params.set('expirationPageSize', String(query.expiration.pageSize));
  if (
    query.expiration.searchField !== defaultPointExpirationQuery.searchField
  ) {
    params.set('expirationSearchField', query.expiration.searchField);
  }
  if (query.expiration.keyword.trim()) {
    params.set('expirationKeyword', query.expiration.keyword.trim());
  }
  if (query.expiration.status !== defaultPointExpirationQuery.status) {
    params.set('expirationStatus', query.expiration.status);
  }
  if (query.expiration.startDate) {
    params.set('expirationStartDate', query.expiration.startDate);
  }
  if (query.expiration.endDate) {
    params.set('expirationEndDate', query.expiration.endDate);
  }
  if (query.expiration.sortField) {
    params.set('expirationSortField', query.expiration.sortField);
  }
  if (query.expiration.sortOrder) {
    params.set('expirationSortOrder', query.expiration.sortOrder);
  }

  return params;
}
