import {
  Alert,
  Button,
  Descriptions,
  Form,
  Input,
  InputNumber,
  Modal,
  Select,
  type SortOrder,
  Space,
  type TableProps,
  Tabs,
  Tag,
  Typography,
  notification
} from 'antd';
import type { DescriptionsProps, TableColumnsType, TabsProps } from 'antd';
import type { ChangeEvent } from 'react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';

import {
  createManualPointAdjustmentSafe,
  exportPointExpirationsSafe,
  fetchPointsSnapshotSafe,
  releasePointExpirationHoldSafe,
  savePointExpirationHoldSafe,
  savePointPolicySafe,
  updatePointPolicyStatusSafe
} from '../api/points-service';
import {
  buildCommercePointsSearchParams,
  defaultPointExpirationQuery,
  defaultPointLedgerQuery,
  defaultPointPolicyQuery,
  parseCommercePointsQuery
} from '../model/point-schema';
import { usePointQueryStore } from '../model/point-store';
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
  CommercePointsSnapshot,
  PointExpiration,
  PointExpirationQuery,
  PointExpirationStatus,
  PointLedger,
  PointLedgerQuery,
  PointLedgerSourceType,
  PointLedgerStatus,
  PointLedgerType,
  PointPolicy,
  PointPolicyQuery,
  PointPolicyStatus,
  PointPolicyType,
  PointsTab
} from '../model/point-types';
import type { AsyncState } from '../../../shared/model/async-state';
import { AuditLogLink } from '../../../shared/ui/audit-log-link/audit-log-link';
import { ConfirmAction } from '../../../shared/ui/confirm-action/confirm-action';
import { markRequiredDescriptionItems } from '../../../shared/ui/descriptions/description-label';
import {
  DetailDrawer,
  DetailDrawerBody,
  DetailDrawerSection
} from '../../../shared/ui/detail-drawer/detail-drawer';
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
  matchesSearchField
} from '../../../shared/ui/search-bar/search-bar-utils';
import { AdminDataTable } from '../../../shared/ui/table/admin-data-table';
import { createStatusColumnTitle } from '../../../shared/ui/table/status-column-title';
import { TableActionMenu } from '../../../shared/ui/table/table-action-menu';
import { UserNavigationLink } from '../../../shared/ui/user/user-reference';

const { Paragraph, Text } = Typography;

const pageSizeOptions = ['10', '20', '50'];

type PolicyFormValues = {
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

type ManualAdjustmentFormValues = {
  userId: string;
  userName: string;
  ledgerType: Extract<PointLedgerType, '적립' | '차감' | '회수' | '복구'>;
  amount: number;
  approvalMemo: string;
  reason: string;
};

type ExpirationHoldFormValues = {
  expirationId: string;
  holdReason: string;
};

type PolicyDraftFilter = {
  status: PointPolicyQuery['status'];
  type: PointPolicyQuery['type'];
};

type LedgerDraftFilter = {
  type: PointLedgerQuery['type'];
  sourceType: PointLedgerQuery['sourceType'];
  status: PointLedgerQuery['status'];
};

type ExpirationDraftFilter = {
  status: PointExpirationQuery['status'];
};

type PolicyModalState =
  | { mode: 'create'; policy: null }
  | { mode: 'edit'; policy: PointPolicy }
  | null;

type DangerState =
  | { type: 'activate-policy'; policy: PointPolicy }
  | { type: 'pause-policy'; policy: PointPolicy }
  | { type: 'release-expiration'; expiration: PointExpiration }
  | null;

function createEmptySnapshot(): CommercePointsSnapshot {
  return {
    policies: [],
    ledgers: [],
    expirations: []
  };
}

function formatPoint(value: number): string {
  return `${value.toLocaleString('ko-KR')}P`;
}

function formatPointDelta(value: number): string {
  const sign = value > 0 ? '+' : '';
  return `${sign}${value.toLocaleString('ko-KR')}P`;
}

function renderLocalStatusTag(status: string): JSX.Element {
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

function compareText(left: string | number, right: string | number): number {
  return String(left).localeCompare(String(right), 'ko-KR', {
    numeric: true,
    sensitivity: 'base'
  });
}

function parseSortOrder(value: SortOrder | null | undefined): SortOrder | null {
  return value === 'ascend' || value === 'descend' ? value : null;
}

function getSorterField(
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

function applySortDirection(
  difference: number,
  sortOrder: SortOrder | null
): number {
  return sortOrder === 'descend' ? difference * -1 : difference;
}

function sortPolicies(
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

function sortLedgers(
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

function sortExpirations(
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

function getFirstTableFilterValue(
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

function parsePolicySortField(
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

function parseLedgerSortField(
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

function parseExpirationSortField(
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

function paginateItems<T>(items: T[], page: number, pageSize: number): T[] {
  const startIndex = (page - 1) * pageSize;
  return items.slice(startIndex, startIndex + pageSize);
}

function getSourceRoute(
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

function renderSourceReference(
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

function filterPolicies(
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

function filterLedgers(
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

function filterExpirations(
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

function buildPolicySummaryItems(policy: PointPolicy): DescriptionsProps['items'] {
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

function buildLedgerSummaryItems(ledger: PointLedger): DescriptionsProps['items'] {
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

function buildExpirationSummaryItems(
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

function createPolicyFormDefaults(policy: PointPolicy | null): PolicyFormValues {
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

function createManualAdjustmentDefaults(
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

function getDangerCopy(state: DangerState) {
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

export default function CommercePointsPage(): JSX.Element {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const query = usePointQueryStore((state) => state.query);
  const replaceQuery = usePointQueryStore((state) => state.replaceQuery);
  const [pointsState, setPointsState] = useState<AsyncState<CommercePointsSnapshot>>({
    status: 'pending',
    data: createEmptySnapshot(),
    errorMessage: null,
    errorCode: null
  });
  const [reloadKey, setReloadKey] = useState(0);
  const [policyModalState, setPolicyModalState] = useState<PolicyModalState>(null);
  const [adjustmentTarget, setAdjustmentTarget] = useState<PointLedger | null>(null);
  const [adjustmentModalOpen, setAdjustmentModalOpen] = useState(false);
  const [expirationHoldTarget, setExpirationHoldTarget] = useState<PointExpiration | null>(null);
  const [expirationHoldModalOpen, setExpirationHoldModalOpen] = useState(false);
  const [dangerState, setDangerState] = useState<DangerState>(null);
  const [policyForm] = Form.useForm<PolicyFormValues>();
  const [adjustmentForm] = Form.useForm<ManualAdjustmentFormValues>();
  const [expirationHoldForm] = Form.useForm<ExpirationHoldFormValues>();
  const [notificationApi, notificationContextHolder] =
    notification.useNotification();
  const [policyDraft, setPolicyDraft] = useState<PolicyDraftFilter>({
    status: defaultPointPolicyQuery.status,
    type: defaultPointPolicyQuery.type
  });
  const [ledgerDraft, setLedgerDraft] = useState<LedgerDraftFilter>({
    type: defaultPointLedgerQuery.type,
    sourceType: defaultPointLedgerQuery.sourceType,
    status: defaultPointLedgerQuery.status
  });
  const [expirationDraft, setExpirationDraft] = useState<ExpirationDraftFilter>({
    status: defaultPointExpirationQuery.status
  });
  const {
    draftStartDate: draftLedgerStartDate,
    draftEndDate: draftLedgerEndDate,
    handleDraftDateChange: handleLedgerDraftDateChange,
    handleDraftReset: handleLedgerDraftReset,
    handleDetailOpenChange: handleLedgerDetailOpenChangeBase
  } = useSearchBarDateDraft(query.ledger.startDate, query.ledger.endDate);
  const {
    draftStartDate: draftExpirationStartDate,
    draftEndDate: draftExpirationEndDate,
    handleDraftDateChange: handleExpirationDraftDateChange,
    handleDraftReset: handleExpirationDraftReset,
    handleDetailOpenChange: handleExpirationDetailOpenChangeBase
  } = useSearchBarDateDraft(
    query.expiration.startDate,
    query.expiration.endDate
  );

  useEffect(() => {
    replaceQuery(parseCommercePointsQuery(searchParams));
  }, [replaceQuery, searchParams]);

  useEffect(() => {
    setPolicyDraft({
      status: query.policy.status,
      type: query.policy.type
    });
  }, [query.policy.status, query.policy.type]);

  useEffect(() => {
    setLedgerDraft({
      type: query.ledger.type,
      sourceType: query.ledger.sourceType,
      status: query.ledger.status
    });
  }, [query.ledger.sourceType, query.ledger.status, query.ledger.type]);

  useEffect(() => {
    setExpirationDraft({
      status: query.expiration.status
    });
  }, [query.expiration.status]);

  useEffect(() => {
    const controller = new AbortController();

    setPointsState((prev) => ({
      ...prev,
      status: 'pending',
      errorMessage: null,
      errorCode: null
    }));

    void fetchPointsSnapshotSafe(controller.signal).then((result) => {
      if (controller.signal.aborted) {
        return;
      }

      if (result.ok) {
        const isEmpty =
          result.data.policies.length === 0 &&
          result.data.ledgers.length === 0 &&
          result.data.expirations.length === 0;

        setPointsState({
          status: isEmpty ? 'empty' : 'success',
          data: result.data,
          errorMessage: null,
          errorCode: null
        });
        return;
      }

      setPointsState((prev) => ({
        ...prev,
        status: 'error',
        errorMessage: result.error.message,
        errorCode: result.error.code
      }));
    });

    return () => controller.abort();
  }, [reloadKey]);

  const updateUrl = useCallback(
    (nextQuery: CommercePointsQuery) => {
      replaceQuery(nextQuery);
      setSearchParams(buildCommercePointsSearchParams(nextQuery), {
        replace: true
      });
    },
    [replaceQuery, setSearchParams]
  );

  const commitTab = useCallback(
    (tab: PointsTab) => {
      updateUrl({
        ...query,
        tab,
        selectedId: ''
      });
    },
    [query, updateUrl]
  );

  const openDetail = useCallback(
    (selectedId: string) => {
      updateUrl({
        ...query,
        selectedId
      });
    },
    [query, updateUrl]
  );

  const closeDetail = useCallback(() => {
    updateUrl({
      ...query,
      selectedId: ''
    });
  }, [query, updateUrl]);

  const commitPolicyQuery = useCallback(
    (next: Partial<PointPolicyQuery>) => {
      updateUrl({
        ...query,
        selectedId: '',
        policy: {
          ...query.policy,
          ...next
        }
      });
    },
    [query, updateUrl]
  );

  const commitLedgerQuery = useCallback(
    (next: Partial<PointLedgerQuery>) => {
      updateUrl({
        ...query,
        selectedId: '',
        ledger: {
          ...query.ledger,
          ...next
        }
      });
    },
    [query, updateUrl]
  );

  const commitExpirationQuery = useCallback(
    (next: Partial<PointExpirationQuery>) => {
      updateUrl({
        ...query,
        selectedId: '',
        expiration: {
          ...query.expiration,
          ...next
        }
      });
    },
    [query, updateUrl]
  );

  const filteredPolicies = useMemo(
    () => filterPolicies(pointsState.data.policies, query.policy),
    [pointsState.data.policies, query.policy]
  );
  const filteredLedgers = useMemo(
    () => filterLedgers(pointsState.data.ledgers, query.ledger),
    [pointsState.data.ledgers, query.ledger]
  );
  const filteredExpirations = useMemo(
    () => filterExpirations(pointsState.data.expirations, query.expiration),
    [pointsState.data.expirations, query.expiration]
  );

  const sortedPolicies = useMemo(
    () => sortPolicies(filteredPolicies, query.policy),
    [filteredPolicies, query.policy]
  );
  const sortedLedgers = useMemo(
    () => sortLedgers(filteredLedgers, query.ledger),
    [filteredLedgers, query.ledger]
  );
  const sortedExpirations = useMemo(
    () => sortExpirations(filteredExpirations, query.expiration),
    [filteredExpirations, query.expiration]
  );

  const visiblePolicies = useMemo(
    () => paginateItems(sortedPolicies, query.policy.page, query.policy.pageSize),
    [query.policy.page, query.policy.pageSize, sortedPolicies]
  );
  const visibleLedgers = useMemo(
    () => paginateItems(sortedLedgers, query.ledger.page, query.ledger.pageSize),
    [query.ledger.page, query.ledger.pageSize, sortedLedgers]
  );
  const visibleExpirations = useMemo(
    () =>
      paginateItems(
        sortedExpirations,
        query.expiration.page,
        query.expiration.pageSize
      ),
    [query.expiration.page, query.expiration.pageSize, sortedExpirations]
  );

  const selectedPolicy = useMemo(
    () =>
      query.tab === 'policy'
        ? pointsState.data.policies.find((item) => item.id === query.selectedId) ?? null
        : null,
    [pointsState.data.policies, query.selectedId, query.tab]
  );
  const selectedLedger = useMemo(
    () =>
      query.tab === 'ledger'
        ? pointsState.data.ledgers.find((item) => item.id === query.selectedId) ?? null
        : null,
    [pointsState.data.ledgers, query.selectedId, query.tab]
  );
  const selectedExpiration = useMemo(
    () =>
      query.tab === 'expiration'
        ? pointsState.data.expirations.find((item) => item.id === query.selectedId) ??
          null
        : null,
    [pointsState.data.expirations, query.selectedId, query.tab]
  );

  const selectedRecord = selectedPolicy ?? selectedLedger ?? selectedExpiration;

  useEffect(() => {
    if (!query.selectedId || selectedRecord || pointsState.status === 'pending') {
      return;
    }

    updateUrl({
      ...query,
      selectedId: ''
    });
  }, [pointsState.status, query, selectedRecord, updateUrl]);

  const activeCount = useMemo(() => {
    if (query.tab === 'policy') {
      return filteredPolicies.length;
    }
    if (query.tab === 'ledger') {
      return filteredLedgers.length;
    }
    return filteredExpirations.length;
  }, [
    filteredExpirations.length,
    filteredLedgers.length,
    filteredPolicies.length,
    query.tab
  ]);

  const hasCachedData =
    pointsState.data.policies.length > 0 ||
    pointsState.data.ledgers.length > 0 ||
    pointsState.data.expirations.length > 0;

  const summaryCards = useMemo(() => {
    if (query.tab === 'policy') {
      const statusCounts = {
        all: pointsState.data.policies.length,
        draft: pointsState.data.policies.filter((item) => item.status === '초안').length,
        active: pointsState.data.policies.filter((item) => item.status === '운영 중').length,
        paused: pointsState.data.policies.filter((item) => item.status === '중지').length
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
      const statusCounts = {
        all: pointsState.data.ledgers.length,
        completed: pointsState.data.ledgers.filter((item) => item.status === '완료').length,
        held: pointsState.data.ledgers.filter((item) => item.status === '보류').length,
        canceled: pointsState.data.ledgers.filter((item) => item.status === '취소').length
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

    const statusCounts = {
      all: pointsState.data.expirations.length,
      scheduled: pointsState.data.expirations.filter((item) => item.status === '예정').length,
      held: pointsState.data.expirations.filter((item) => item.status === '보류').length,
      completed: pointsState.data.expirations.filter((item) => item.status === '완료').length,
      canceled: pointsState.data.expirations.filter((item) => item.status === '취소').length
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
  }, [
    commitExpirationQuery,
    commitLedgerQuery,
    commitPolicyQuery,
    pointsState.data.expirations,
    pointsState.data.ledgers,
    pointsState.data.policies,
    query.expiration.status,
    query.ledger.status,
    query.policy.status,
    query.tab
  ]);

  const tabItems = useMemo<NonNullable<TabsProps['items']>>(
    () => [
      {
        key: 'policy',
        label: `정책 ${pointsState.data.policies.length}`
      },
      {
        key: 'ledger',
        label: `포인트 원장 ${pointsState.data.ledgers.length}`
      },
      {
        key: 'expiration',
        label: `소멸 예정 ${pointsState.data.expirations.length}`
      }
    ],
    [
      pointsState.data.expirations.length,
      pointsState.data.ledgers.length,
      pointsState.data.policies.length
    ]
  );

  const handleReload = useCallback(() => {
    setReloadKey((prev) => prev + 1);
  }, []);

  const openCreatePolicyModal = useCallback(() => {
    setPolicyModalState({ mode: 'create', policy: null });
    policyForm.setFieldsValue(createPolicyFormDefaults(null));
  }, [policyForm]);

  const openEditPolicyModal = useCallback(
    (policy: PointPolicy) => {
      setPolicyModalState({ mode: 'edit', policy });
      policyForm.setFieldsValue(createPolicyFormDefaults(policy));
    },
    [policyForm]
  );

  const closePolicyModal = useCallback(() => {
    setPolicyModalState(null);
  }, []);

  const openManualAdjustmentModal = useCallback(
    (ledger: PointLedger | null = null) => {
      setAdjustmentTarget(ledger);
      setAdjustmentModalOpen(true);
      adjustmentForm.setFieldsValue(createManualAdjustmentDefaults(ledger));
    },
    [adjustmentForm]
  );

  const closeManualAdjustmentModal = useCallback(() => {
    setAdjustmentTarget(null);
    setAdjustmentModalOpen(false);
  }, []);

  const openExpirationHoldModal = useCallback(
    (expiration: PointExpiration | null = null) => {
      setExpirationHoldTarget(expiration);
      setExpirationHoldModalOpen(true);
      expirationHoldForm.setFieldsValue({
        expirationId: expiration?.id ?? '',
        holdReason: expiration?.holdReason ?? ''
      });
    },
    [expirationHoldForm]
  );

  const closeExpirationHoldModal = useCallback(() => {
    setExpirationHoldTarget(null);
    setExpirationHoldModalOpen(false);
  }, []);

  const showActionError = useCallback(
    (message: string, description?: string) => {
      notificationApi.error({
        message,
        description: description ?? '잠시 후 다시 시도해 주세요.'
      });
    },
    [notificationApi]
  );

  const handlePolicySubmit = useCallback(async () => {
    const values = await policyForm.validateFields();
    const result = await savePointPolicySafe({
      policyId: policyModalState?.policy?.id,
      ...values
    });

    if (!result.ok) {
      showActionError('포인트 정책 저장에 실패했습니다.', result.error.message);
      return;
    }

    setPolicyModalState(null);
    setReloadKey((prev) => prev + 1);
    updateUrl({
      ...query,
      tab: 'policy',
      selectedId: result.data.id
    });
    notificationApi.success({
      message:
        policyModalState?.mode === 'edit'
          ? '포인트 정책을 수정했습니다.'
          : '포인트 정책을 등록했습니다.',
      description: (
        <Space direction="vertical">
          <Text>대상 유형: 포인트 정책</Text>
          <Text>대상 ID: {result.data.id}</Text>
          <AuditLogLink
            targetType="CommercePointPolicy"
            targetId={result.data.id}
          />
        </Space>
      )
    });
  }, [notificationApi, policyForm, policyModalState, query, showActionError, updateUrl]);

  const handleManualAdjustmentSubmit = useCallback(async () => {
    const values = await adjustmentForm.validateFields();
    const result = await createManualPointAdjustmentSafe({
      userId: values.userId.trim(),
      userName: values.userName.trim(),
      ledgerType: values.ledgerType,
      amount: values.amount,
      approvalMemo: values.approvalMemo,
      reason: values.reason
    });

    if (!result.ok) {
      showActionError('포인트 수동 조정에 실패했습니다.', result.error.message);
      return;
    }

    setAdjustmentModalOpen(false);
    setAdjustmentTarget(null);
    setReloadKey((prev) => prev + 1);
    updateUrl({
      ...query,
      tab: 'ledger',
      selectedId: result.data.id
    });
    notificationApi.success({
      message: '포인트 수동 조정을 등록했습니다.',
      description: (
        <Space direction="vertical">
          <Text>대상 유형: 포인트 원장</Text>
          <Text>대상 ID: {result.data.id}</Text>
          <Text>회원: {result.data.userName} ({result.data.userId})</Text>
          <Text>조정 포인트: {formatPointDelta(result.data.pointDelta)}</Text>
          <AuditLogLink
            targetType="CommercePointLedger"
            targetId={result.data.id}
          />
        </Space>
      )
    });
  }, [adjustmentForm, notificationApi, query, showActionError, updateUrl]);

  const handleExpirationHoldSubmit = useCallback(async () => {
    const values = await expirationHoldForm.validateFields();
    const result = await savePointExpirationHoldSafe({
      expirationId: values.expirationId,
      holdReason: values.holdReason
    });

    if (!result.ok) {
      showActionError('소멸 보류 등록에 실패했습니다.', result.error.message);
      return;
    }

    setExpirationHoldModalOpen(false);
    setExpirationHoldTarget(null);
    setReloadKey((prev) => prev + 1);
    updateUrl({
      ...query,
      tab: 'expiration',
      selectedId: result.data.id
    });
    notificationApi.success({
      message: '소멸 보류를 등록했습니다.',
      description: (
        <Space direction="vertical">
          <Text>대상 유형: 포인트 소멸</Text>
          <Text>대상 ID: {result.data.id}</Text>
          <AuditLogLink
            targetType="CommercePointExpiration"
            targetId={result.data.id}
          />
        </Space>
      )
    });
  }, [expirationHoldForm, notificationApi, query, showActionError, updateUrl]);

  const handleDangerConfirm = useCallback(
    async (reason: string) => {
      if (!dangerState) {
        return;
      }

      if (
        dangerState.type === 'activate-policy' ||
        dangerState.type === 'pause-policy'
      ) {
        const result = await updatePointPolicyStatusSafe({
          policyId: dangerState.policy.id,
          nextStatus:
            dangerState.type === 'activate-policy' ? '운영 중' : '중지',
          reason
        });

        if (!result.ok) {
          showActionError('포인트 정책 상태 변경에 실패했습니다.', result.error.message);
          return;
        }

        setDangerState(null);
        setReloadKey((prev) => prev + 1);
        updateUrl({
          ...query,
          tab: 'policy',
          selectedId: result.data.id
        });
        notificationApi.success({
          message: getDangerCopy(dangerState).successMessage,
          description: (
            <Space direction="vertical">
              <Text>대상 유형: 포인트 정책</Text>
              <Text>대상 ID: {result.data.id}</Text>
              <Text>사유/근거: {reason}</Text>
              <AuditLogLink
                targetType="CommercePointPolicy"
                targetId={result.data.id}
              />
            </Space>
          )
        });
        return;
      }

      const result = await releasePointExpirationHoldSafe({
        expirationId: dangerState.expiration.id,
        reason
      });

      if (!result.ok) {
        showActionError('소멸 보류 해제에 실패했습니다.', result.error.message);
        return;
      }

      setDangerState(null);
      setReloadKey((prev) => prev + 1);
      updateUrl({
        ...query,
        tab: 'expiration',
        selectedId: result.data.id
      });
      notificationApi.success({
        message: getDangerCopy(dangerState).successMessage,
        description: (
          <Space direction="vertical">
            <Text>대상 유형: 포인트 소멸</Text>
            <Text>대상 ID: {result.data.id}</Text>
            <Text>사유/근거: {reason}</Text>
            <AuditLogLink
              targetType="CommercePointExpiration"
              targetId={result.data.id}
            />
          </Space>
        )
      });
    },
    [dangerState, notificationApi, query, showActionError, updateUrl]
  );

  const handleExportExpirations = useCallback(async () => {
    const result = await exportPointExpirationsSafe({
      itemCount: filteredExpirations.length
    });

    if (!result.ok) {
      showActionError('소멸 예정 내역 내보내기에 실패했습니다.', result.error.message);
      return;
    }

    notificationApi.success({
      message: '소멸 예정 내역을 내보냈습니다.',
      description: `${result.data.exportedAt} 기준 ${result.data.itemCount.toLocaleString()}건`
    });
  }, [filteredExpirations.length, notificationApi, showActionError]);

  const handlePolicyDetailOpenChange = useCallback(
    (open: boolean) => {
      if (open) {
        return;
      }

      setPolicyDraft({
        status: query.policy.status,
        type: query.policy.type
      });
    },
    [query.policy.status, query.policy.type]
  );

  const handleLedgerDetailOpenChange = useCallback(
    (open: boolean) => {
      handleLedgerDetailOpenChangeBase(open);
      if (open) {
        return;
      }

      setLedgerDraft({
        type: query.ledger.type,
        sourceType: query.ledger.sourceType,
        status: query.ledger.status
      });
    },
    [
      handleLedgerDetailOpenChangeBase,
      query.ledger.sourceType,
      query.ledger.status,
      query.ledger.type
    ]
  );

  const handleExpirationDetailOpenChange = useCallback(
    (open: boolean) => {
      handleExpirationDetailOpenChangeBase(open);
      if (open) {
        return;
      }

      setExpirationDraft({
        status: query.expiration.status
      });
    },
    [handleExpirationDetailOpenChangeBase, query.expiration.status]
  );

  const handleSearchFieldChange = useCallback(
    (value: string) => {
      if (query.tab === 'policy') {
        commitPolicyQuery({
          searchField: value as PointPolicyQuery['searchField'],
          page: 1
        });
        return;
      }

      if (query.tab === 'ledger') {
        commitLedgerQuery({
          searchField: value as PointLedgerQuery['searchField'],
          page: 1
        });
        return;
      }

      commitExpirationQuery({
        searchField: value as PointExpirationQuery['searchField'],
        page: 1
      });
    },
    [commitExpirationQuery, commitLedgerQuery, commitPolicyQuery, query.tab]
  );

  const handleKeywordChange = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => {
      if (query.tab === 'policy') {
        commitPolicyQuery({
          keyword: event.target.value,
          page: 1
        });
        return;
      }

      if (query.tab === 'ledger') {
        commitLedgerQuery({
          keyword: event.target.value,
          page: 1
        });
        return;
      }

      commitExpirationQuery({
        keyword: event.target.value,
        page: 1
      });
    },
    [commitExpirationQuery, commitLedgerQuery, commitPolicyQuery, query.tab]
  );

  const handlePolicyTableChange = useCallback<
    NonNullable<TableProps<PointPolicy>['onChange']>
  >(
    (pagination, filters, sorter) => {
      const nextSorter = Array.isArray(sorter) ? sorter[0] : sorter;
      const nextField = parsePolicySortField(getSorterField(sorter));

      commitPolicyQuery({
        page: pagination.current ?? 1,
        pageSize: pagination.pageSize ?? query.policy.pageSize,
        status: pointPolicyStatuses.includes(
          getFirstTableFilterValue(filters.status) as PointPolicyStatus
        )
          ? (getFirstTableFilterValue(filters.status) as PointPolicyStatus)
          : 'all',
        type: pointPolicyTypes.includes(
          getFirstTableFilterValue(filters.policyType) as PointPolicyType
        )
          ? (getFirstTableFilterValue(filters.policyType) as PointPolicyType)
          : 'all',
        sortField: nextField,
        sortOrder: nextField ? parseSortOrder(nextSorter?.order) : null
      });
    },
    [commitPolicyQuery, query.policy.pageSize]
  );

  const handleLedgerTableChange = useCallback<
    NonNullable<TableProps<PointLedger>['onChange']>
  >(
    (pagination, filters, sorter) => {
      const nextSorter = Array.isArray(sorter) ? sorter[0] : sorter;
      const nextField = parseLedgerSortField(getSorterField(sorter));

      commitLedgerQuery({
        page: pagination.current ?? 1,
        pageSize: pagination.pageSize ?? query.ledger.pageSize,
        type: pointLedgerTypes.includes(
          getFirstTableFilterValue(filters.ledgerType) as PointLedgerType
        )
          ? (getFirstTableFilterValue(filters.ledgerType) as PointLedgerType)
          : 'all',
        sourceType: pointLedgerSourceTypes.includes(
          getFirstTableFilterValue(filters.sourceType) as PointLedgerSourceType
        )
          ? (getFirstTableFilterValue(filters.sourceType) as PointLedgerSourceType)
          : 'all',
        status: pointLedgerStatuses.includes(
          getFirstTableFilterValue(filters.status) as PointLedgerStatus
        )
          ? (getFirstTableFilterValue(filters.status) as PointLedgerStatus)
          : 'all',
        sortField: nextField,
        sortOrder: nextField ? parseSortOrder(nextSorter?.order) : null
      });
    },
    [commitLedgerQuery, query.ledger.pageSize]
  );

  const handleExpirationTableChange = useCallback<
    NonNullable<TableProps<PointExpiration>['onChange']>
  >(
    (pagination, filters, sorter) => {
      const nextSorter = Array.isArray(sorter) ? sorter[0] : sorter;
      const nextField = parseExpirationSortField(getSorterField(sorter));

      commitExpirationQuery({
        page: pagination.current ?? 1,
        pageSize: pagination.pageSize ?? query.expiration.pageSize,
        status: pointExpirationStatuses.includes(
          getFirstTableFilterValue(filters.status) as PointExpirationStatus
        )
          ? (getFirstTableFilterValue(filters.status) as PointExpirationStatus)
          : 'all',
        sortField: nextField,
        sortOrder: nextField ? parseSortOrder(nextSorter?.order) : null
      });
    },
    [commitExpirationQuery, query.expiration.pageSize]
  );

  const activeSearchField =
    query.tab === 'policy'
      ? query.policy.searchField
      : query.tab === 'ledger'
        ? query.ledger.searchField
        : query.expiration.searchField;
  const activeKeyword =
    query.tab === 'policy'
      ? query.policy.keyword
      : query.tab === 'ledger'
        ? query.ledger.keyword
        : query.expiration.keyword;

  const policyDetailContent = (
    <>
      <SearchBarDetailField label="정책 상태">
        <Select
          value={policyDraft.status}
          options={[
            { label: '전체 상태', value: 'all' },
            { label: '초안', value: '초안' },
            { label: '운영 중', value: '운영 중' },
            { label: '중지', value: '중지' }
          ]}
          onChange={(value) =>
            setPolicyDraft((prev) => ({
              ...prev,
              status: value as PolicyDraftFilter['status']
            }))
          }
        />
      </SearchBarDetailField>
      <SearchBarDetailField label="정책 유형">
        <Select
          value={policyDraft.type}
          options={[
            { label: '전체 유형', value: 'all' },
            { label: '적립', value: '적립' },
            { label: '차감', value: '차감' },
            { label: '소멸', value: '소멸' }
          ]}
          onChange={(value) =>
            setPolicyDraft((prev) => ({
              ...prev,
              type: value as PolicyDraftFilter['type']
            }))
          }
        />
      </SearchBarDetailField>
    </>
  );

  const ledgerDetailContent = (
    <>
      <SearchBarDetailField label="원장 유형">
        <Select
          value={ledgerDraft.type}
          options={[
            { label: '전체 유형', value: 'all' },
            { label: '적립', value: '적립' },
            { label: '차감', value: '차감' },
            { label: '회수', value: '회수' },
            { label: '복구', value: '복구' },
            { label: '소멸', value: '소멸' }
          ]}
          onChange={(value) =>
            setLedgerDraft((prev) => ({
              ...prev,
              type: value as LedgerDraftFilter['type']
            }))
          }
        />
      </SearchBarDetailField>
      <SearchBarDetailField label="발생 원천">
        <Select
          value={ledgerDraft.sourceType}
          options={[
            { label: '전체 원천', value: 'all' },
            { label: '추천', value: '추천' },
            { label: '미션', value: '미션' },
            { label: '이벤트', value: '이벤트' },
            { label: '결제', value: '결제' },
            { label: '환불', value: '환불' },
            { label: '관리자', value: '관리자' },
            { label: '시스템', value: '시스템' }
          ]}
          onChange={(value) =>
            setLedgerDraft((prev) => ({
              ...prev,
              sourceType: value as LedgerDraftFilter['sourceType']
            }))
          }
        />
      </SearchBarDetailField>
      <SearchBarDetailField label="처리 상태">
        <Select
          value={ledgerDraft.status}
          options={[
            { label: '전체 상태', value: 'all' },
            { label: '완료', value: '완료' },
            { label: '보류', value: '보류' },
            { label: '취소', value: '취소' }
          ]}
          onChange={(value) =>
            setLedgerDraft((prev) => ({
              ...prev,
              status: value as LedgerDraftFilter['status']
            }))
          }
        />
      </SearchBarDetailField>
      <SearchBarDetailField label="발생 기간">
        <SearchBarDateRange
          startDate={draftLedgerStartDate}
          endDate={draftLedgerEndDate}
          onChange={handleLedgerDraftDateChange}
        />
      </SearchBarDetailField>
    </>
  );

  const expirationDetailContent = (
    <>
      <SearchBarDetailField label="소멸 상태">
        <Select
          value={expirationDraft.status}
          options={[
            { label: '전체 상태', value: 'all' },
            { label: '예정', value: '예정' },
            { label: '보류', value: '보류' },
            { label: '완료', value: '완료' },
            { label: '취소', value: '취소' }
          ]}
          onChange={(value) =>
            setExpirationDraft((prev) => ({
              ...prev,
              status: value as ExpirationDraftFilter['status']
            }))
          }
        />
      </SearchBarDetailField>
      <SearchBarDetailField label="예정 기간">
        <SearchBarDateRange
          startDate={draftExpirationStartDate}
          endDate={draftExpirationEndDate}
          onChange={handleExpirationDraftDateChange}
        />
      </SearchBarDetailField>
    </>
  );

  const activeSearchBarProps =
    query.tab === 'policy'
      ? {
          searchFieldOptions: [
            { label: '정책명', value: 'name' },
            { label: '정책 ID', value: 'id' }
          ],
          keywordPlaceholder: '정책명 또는 정책 ID 검색',
          detailContent: policyDetailContent,
          onApply: () =>
            commitPolicyQuery({
              page: 1,
              status: policyDraft.status,
              type: policyDraft.type
            }),
          onReset: () =>
            setPolicyDraft({
              status: defaultPointPolicyQuery.status,
              type: defaultPointPolicyQuery.type
            }),
          onDetailOpenChange: handlePolicyDetailOpenChange,
          actions: (
            <Button type="primary" size="large" onClick={openCreatePolicyModal}>
              정책 등록
            </Button>
          )
        }
      : query.tab === 'ledger'
        ? {
            searchFieldOptions: [
              { label: '회원 ID', value: 'userId' },
              { label: '회원명', value: 'userName' },
              { label: '원장 ID', value: 'id' }
            ],
            keywordPlaceholder: '회원 ID, 회원명 또는 원장 ID 검색',
            detailContent: ledgerDetailContent,
            onApply: () =>
              commitLedgerQuery({
                page: 1,
                type: ledgerDraft.type,
                sourceType: ledgerDraft.sourceType,
                status: ledgerDraft.status,
                startDate: draftLedgerStartDate,
                endDate: draftLedgerEndDate
              }),
            onReset: () => {
              setLedgerDraft({
                type: defaultPointLedgerQuery.type,
                sourceType: defaultPointLedgerQuery.sourceType,
                status: defaultPointLedgerQuery.status
              });
              handleLedgerDraftReset();
            },
            onDetailOpenChange: handleLedgerDetailOpenChange,
            actions: (
              <Button
                type="primary"
                size="large"
                onClick={() => openManualAdjustmentModal()}
              >
                포인트 수동 조정
              </Button>
            )
          }
        : {
            searchFieldOptions: [
              { label: '회원 ID', value: 'userId' },
              { label: '회원명', value: 'userName' },
              { label: '소멸 ID', value: 'id' }
            ],
            keywordPlaceholder: '회원 ID, 회원명 또는 소멸 ID 검색',
            detailContent: expirationDetailContent,
            onApply: () =>
              commitExpirationQuery({
                page: 1,
                status: expirationDraft.status,
                startDate: draftExpirationStartDate,
                endDate: draftExpirationEndDate
              }),
            onReset: () => {
              setExpirationDraft({
                status: defaultPointExpirationQuery.status
              });
              handleExpirationDraftReset();
            },
            onDetailOpenChange: handleExpirationDetailOpenChange,
            actions: (
              <Space wrap>
                <Button
                  type="primary"
                  size="large"
                  onClick={() => openExpirationHoldModal()}
                >
                  소멸 보류 등록
                </Button>
                <Button size="large" onClick={handleExportExpirations}>
                  내역 내보내기
                </Button>
              </Space>
            )
          };

  const policyColumns = useMemo<TableColumnsType<PointPolicy>>(
    () => [
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
    ],
    [openEditPolicyModal, query.policy.sortField, query.policy.sortOrder, query.policy.status, query.policy.type]
  );

  const ledgerColumns = useMemo<TableColumnsType<PointLedger>>(
    () => [
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
    ],
    [
      navigate,
      openManualAdjustmentModal,
      query.ledger.sortField,
      query.ledger.sortOrder,
      query.ledger.sourceType,
      query.ledger.status,
      query.ledger.type
    ]
  );

  const expirationColumns = useMemo<TableColumnsType<PointExpiration>>(
    () => [
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
    ],
    [
      navigate,
      openExpirationHoldModal,
      query.expiration.sortField,
      query.expiration.sortOrder,
      query.expiration.status
    ]
  );

  const emptyMessage =
    query.tab === 'policy'
      ? {
          message: '조건에 맞는 포인트 정책이 없습니다.',
          description: '정책 상태나 유형, 검색어를 조정한 뒤 다시 확인해 주세요.'
        }
      : query.tab === 'ledger'
        ? {
            message: '조건에 맞는 포인트 원장이 없습니다.',
            description:
              '회원, 원장 유형, 원천, 기간 조건을 조정한 뒤 다시 확인해 주세요.'
          }
        : {
            message: '현재 예정된 소멸 건이 없습니다.',
            description: '소멸 상태 또는 기간 조건을 조정한 뒤 다시 확인해 주세요.'
          };

  const expirationSelectOptions = useMemo(
    () =>
      pointsState.data.expirations
        .filter((item) => item.status === '예정' || item.status === '보류')
        .map((item) => ({
          label: `${item.id} · ${item.userName} (${item.userId})`,
          value: item.id
        })),
    [pointsState.data.expirations]
  );

  const currentTable =
    query.tab === 'policy' ? (
      <AdminDataTable<PointPolicy>
        rowKey="id"
        columns={policyColumns}
        dataSource={visiblePolicies}
        loading={pointsState.status === 'pending' && !hasCachedData}
        scroll={{ x: 1320, y: 560 }}
        onChange={handlePolicyTableChange}
        pagination={{
          current: query.policy.page,
          pageSize: query.policy.pageSize,
          pageSizeOptions,
          showSizeChanger: true,
          total: sortedPolicies.length,
          showTotal: (total) => `총 ${total.toLocaleString()}건`
        }}
        onRow={(record) => ({
          onClick: () => openDetail(record.id),
          style: { cursor: 'pointer' }
        })}
      />
    ) : query.tab === 'ledger' ? (
      <AdminDataTable<PointLedger>
        rowKey="id"
        columns={ledgerColumns}
        dataSource={visibleLedgers}
        loading={pointsState.status === 'pending' && !hasCachedData}
        scroll={{ x: 1460, y: 560 }}
        onChange={handleLedgerTableChange}
        pagination={{
          current: query.ledger.page,
          pageSize: query.ledger.pageSize,
          pageSizeOptions,
          showSizeChanger: true,
          total: sortedLedgers.length,
          showTotal: (total) => `총 ${total.toLocaleString()}건`
        }}
        onRow={(record) => ({
          onClick: () => openDetail(record.id),
          style: { cursor: 'pointer' }
        })}
      />
    ) : (
      <AdminDataTable<PointExpiration>
        rowKey="id"
        columns={expirationColumns}
        dataSource={visibleExpirations}
        loading={pointsState.status === 'pending' && !hasCachedData}
        scroll={{ x: 1340, y: 560 }}
        onChange={handleExpirationTableChange}
        pagination={{
          current: query.expiration.page,
          pageSize: query.expiration.pageSize,
          pageSizeOptions,
          showSizeChanger: true,
          total: sortedExpirations.length,
          showTotal: (total) => `총 ${total.toLocaleString()}건`
        }}
        onRow={(record) => ({
          onClick: () => openDetail(record.id),
          style: { cursor: 'pointer' }
        })}
      />
    );

  return (
    <div>
      {notificationContextHolder}
      <PageTitle title="포인트 관리" />

      <Paragraph type="secondary" style={{ marginBottom: 16 }}>
        현재 화면은 포인트 정책, 포인트 원장, 소멸 예정 건을 한 곳에서 운영하기 위한
        기준 화면입니다. 포인트 발생 원천, 차감 우선순위, 소멸 예외 정책은 아직
        확정 중이므로 이 페이지와 IA 문서는 운영/정책 합의에 맞춰 계속 갱신하는
        living 문서로 관리합니다.
      </Paragraph>

      <Alert
        type="warning"
        showIcon
        style={{ marginBottom: 16 }}
        message="운영 정책 미확정 항목이 남아 있습니다."
        description={
          <Space direction="vertical" size={4}>
            <Text>포인트 발생 원천 분류와 코드 테이블은 1차 초안만 반영된 상태입니다.</Text>
            <Text>결제 포인트 차감 우선순위와 환불 복구 기준은 아직 최종 확정되지 않았습니다.</Text>
            <Text>소멸 사전 안내 시점과 보류 승인 체계는 운영 정책 협의 후 계속 업데이트됩니다.</Text>
          </Space>
        }
      />

      {pointsState.status === 'error' ? (
        <Alert
          type="error"
          showIcon
          style={{ marginBottom: 12 }}
          message="포인트 관리 데이터를 불러오지 못했습니다."
          description={
            <Space direction="vertical" size={4}>
              <Text>
                {pointsState.errorMessage ??
                  '일시적인 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.'}
              </Text>
              {pointsState.errorCode ? (
                <Text type="secondary">오류 코드: {pointsState.errorCode}</Text>
              ) : null}
              {hasCachedData ? (
                <Text type="secondary">
                  마지막 성공 상태를 유지한 채 화면을 계속 사용할 수 있습니다.
                </Text>
              ) : null}
              <Button size="small" onClick={handleReload}>
                다시 시도
              </Button>
            </Space>
          }
        />
      ) : null}

      <ListSummaryCards items={summaryCards} />

      <AdminListCard
        toolbar={
          <div className="admin-list-card-toolbar-stack">
            <Tabs
              activeKey={query.tab}
              items={tabItems}
              onChange={(nextTab) => commitTab(nextTab as PointsTab)}
              className="admin-list-card-toolbar-tabs"
            />
            <SearchBar
              searchField={activeSearchField}
              searchFieldOptions={activeSearchBarProps.searchFieldOptions}
              keyword={activeKeyword}
              onSearchFieldChange={handleSearchFieldChange}
              onKeywordChange={handleKeywordChange}
              keywordPlaceholder={activeSearchBarProps.keywordPlaceholder}
              detailContent={activeSearchBarProps.detailContent}
              onApply={activeSearchBarProps.onApply}
              onReset={activeSearchBarProps.onReset}
              onDetailOpenChange={activeSearchBarProps.onDetailOpenChange}
              summary={<Text type="secondary">총 {activeCount.toLocaleString()}건</Text>}
              actions={activeSearchBarProps.actions}
            />
          </div>
        }
      >
        {pointsState.status !== 'pending' && activeCount === 0 ? (
          <Alert
            type="info"
            showIcon
            style={{ marginBottom: 12 }}
            message={emptyMessage.message}
            description={emptyMessage.description}
          />
        ) : null}

        {currentTable}
      </AdminListCard>

      <DetailDrawer
        open={Boolean(selectedRecord)}
        title={
          selectedPolicy
            ? `포인트 정책 상세 · ${selectedPolicy.id}`
            : selectedLedger
              ? `포인트 원장 상세 · ${selectedLedger.id}`
              : selectedExpiration
                ? `소멸 예정 상세 · ${selectedExpiration.id}`
                : '포인트 상세'
        }
        width={760}
        destroyOnHidden
        onClose={closeDetail}
        headerMeta={
          selectedPolicy
            ? renderLocalStatusTag(selectedPolicy.status)
            : selectedLedger
              ? renderLocalStatusTag(selectedLedger.status)
              : selectedExpiration
                ? renderLocalStatusTag(selectedExpiration.status)
                : null
        }
        footerStart={
          selectedPolicy ? (
            <AuditLogLink
              targetType="CommercePointPolicy"
              targetId={selectedPolicy.id}
            />
          ) : selectedLedger ? (
            <AuditLogLink
              targetType="CommercePointLedger"
              targetId={selectedLedger.id}
            />
          ) : selectedExpiration ? (
            <AuditLogLink
              targetType="CommercePointExpiration"
              targetId={selectedExpiration.id}
            />
          ) : null
        }
        footerEnd={
          selectedPolicy ? (
            <Space wrap>
              <Button size="large" onClick={() => openEditPolicyModal(selectedPolicy)}>
                수정
              </Button>
              <Button
                size="large"
                onClick={() =>
                  setDangerState(
                    selectedPolicy.status === '운영 중'
                      ? { type: 'pause-policy', policy: selectedPolicy }
                      : { type: 'activate-policy', policy: selectedPolicy }
                  )
                }
              >
                {selectedPolicy.status === '운영 중' ? '운영 중지' : '운영 시작'}
              </Button>
            </Space>
          ) : selectedLedger ? (
            <Space wrap>
              <Button
                size="large"
                onClick={() => navigate(`/users/${selectedLedger.userId}?tab=payment`)}
              >
                회원 상세로 이동
              </Button>
              <Button
                size="large"
                type="primary"
                onClick={() => openManualAdjustmentModal(selectedLedger)}
              >
                같은 회원으로 조정
              </Button>
            </Space>
          ) : selectedExpiration ? (
            <Space wrap>
              <Button
                size="large"
                onClick={() =>
                  navigate(`/users/${selectedExpiration.userId}?tab=payment`)
                }
              >
                회원 상세로 이동
              </Button>
              {selectedExpiration.status === '보류' ? (
                <Button
                  size="large"
                  onClick={() =>
                    setDangerState({
                      type: 'release-expiration',
                      expiration: selectedExpiration
                    })
                  }
                >
                  보류 해제
                </Button>
              ) : (
                <Button
                  size="large"
                  type="primary"
                  onClick={() => openExpirationHoldModal(selectedExpiration)}
                >
                  보류 등록
                </Button>
              )}
            </Space>
          ) : null
        }
      >
        {selectedPolicy ? (
          <DetailDrawerBody>
            <DetailDrawerSection title="기본 정보">
              <Descriptions
                bordered
                size="small"
                column={1}
                items={buildPolicySummaryItems(selectedPolicy)}
              />
            </DetailDrawerSection>

            <DetailDrawerSection title="적용 조건">
              <Descriptions
                bordered
                size="small"
                column={1}
                items={[
                  {
                    key: 'targetCondition',
                    label: '대상 조건',
                    children: selectedPolicy.targetCondition
                  },
                  {
                    key: 'triggerSource',
                    label: '발생 원천',
                    children: selectedPolicy.triggerSource
                  },
                  {
                    key: 'duplicationRule',
                    label: '중복 방지 규칙',
                    children: selectedPolicy.duplicationRule
                  }
                ]}
              />
            </DetailDrawerSection>

            <DetailDrawerSection title="적립/차감/소멸 규칙">
              <Descriptions
                bordered
                size="small"
                column={1}
                items={[
                  {
                    key: 'earnDebitRule',
                    label: '적립/차감 규칙',
                    children: selectedPolicy.earnDebitRule
                  },
                  {
                    key: 'expirationRule',
                    label: '소멸 규칙',
                    children: selectedPolicy.expirationRule
                  },
                  {
                    key: 'manualAdjustmentRule',
                    label: '수동 조정 규칙',
                    children: selectedPolicy.manualAdjustmentRule
                  }
                ]}
              />
            </DetailDrawerSection>

            <DetailDrawerSection title="운영 메모">
              <Paragraph style={{ marginBottom: 0, whiteSpace: 'pre-wrap' }}>
                {selectedPolicy.note}
              </Paragraph>
            </DetailDrawerSection>
          </DetailDrawerBody>
        ) : null}

        {selectedLedger ? (
          <DetailDrawerBody>
            <DetailDrawerSection title="회원 요약">
              <Descriptions
                bordered
                size="small"
                column={1}
                items={buildLedgerSummaryItems(selectedLedger)}
              />
            </DetailDrawerSection>

            <DetailDrawerSection title="발생 정보">
              <Descriptions
                bordered
                size="small"
                column={1}
                items={[
                  {
                    key: 'source',
                    label: '발생 원천',
                    children: renderSourceReference(
                      selectedLedger.sourceType,
                      selectedLedger.sourceId,
                      selectedLedger.sourceLabel
                    )
                  },
                  {
                    key: 'policy',
                    label: '관련 정책',
                    children: `${selectedLedger.policyName} (${selectedLedger.policyId})`
                  },
                  {
                    key: 'pointDelta',
                    label: '포인트 증감',
                    children: (
                      <Text strong type={selectedLedger.pointDelta < 0 ? 'danger' : undefined}>
                        {formatPointDelta(selectedLedger.pointDelta)}
                      </Text>
                    )
                  },
                  {
                    key: 'balanceAfter',
                    label: '처리 후 잔액',
                    children: formatPoint(selectedLedger.availableBalanceAfter)
                  },
                  {
                    key: 'expirationAt',
                    label: '만료 예정일',
                    children: selectedLedger.expirationAt || '-'
                  }
                ]}
              />
            </DetailDrawerSection>

            <DetailDrawerSection title="사유/확인 정보">
              <Descriptions
                bordered
                size="small"
                column={1}
                items={[
                  { key: 'reason', label: '조정 사유', children: selectedLedger.reason },
                  {
                    key: 'approvalMemo',
                    label: '확인 메모',
                    children: selectedLedger.approvalMemo || '-'
                  },
                  {
                    key: 'actedBy',
                    label: '처리자',
                    children: selectedLedger.actedBy
                  }
                ]}
              />
            </DetailDrawerSection>
          </DetailDrawerBody>
        ) : null}

        {selectedExpiration ? (
          <DetailDrawerBody>
            <DetailDrawerSection title="대상 요약">
              <Descriptions
                bordered
                size="small"
                column={1}
                items={buildExpirationSummaryItems(selectedExpiration)}
              />
            </DetailDrawerSection>

            <DetailDrawerSection title="소멸 계산 정보">
              <Descriptions
                bordered
                size="small"
                column={1}
                items={[
                  {
                    key: 'policy',
                    label: '관련 정책',
                    children: `${selectedExpiration.policyName} (${selectedExpiration.policyId})`
                  },
                  {
                    key: 'relatedLedgerId',
                    label: '관련 원장',
                    children: (
                      <Link
                        className="table-navigation-link"
                        to={`/commerce/points?tab=ledger&selected=${selectedExpiration.relatedLedgerId}`}
                      >
                        {selectedExpiration.relatedLedgerId}
                      </Link>
                    )
                  },
                  {
                    key: 'calculationMemo',
                    label: '계산 메모',
                    children: selectedExpiration.calculationMemo
                  }
                ]}
              />
            </DetailDrawerSection>

            <DetailDrawerSection title="보류/처리 이력">
              <Descriptions
                bordered
                size="small"
                column={1}
                items={[
                  {
                    key: 'holdReason',
                    label: '보류 사유',
                    children: selectedExpiration.holdReason || '-'
                  },
                  {
                    key: 'heldBy',
                    label: '보류 담당자',
                    children: selectedExpiration.heldBy || '-'
                  },
                  {
                    key: 'processedAt',
                    label: '처리 시각',
                    children: selectedExpiration.processedAt || '-'
                  }
                ]}
              />
            </DetailDrawerSection>
          </DetailDrawerBody>
        ) : null}
      </DetailDrawer>

      {dangerState ? (
        <ConfirmAction
          open
          title={getDangerCopy(dangerState).title}
          description={getDangerCopy(dangerState).description}
          targetType={getDangerCopy(dangerState).targetType}
          targetId={getDangerCopy(dangerState).targetId}
          confirmText={getDangerCopy(dangerState).confirmText}
          onCancel={() => setDangerState(null)}
          onConfirm={handleDangerConfirm}
        />
      ) : null}

      <Modal
        open={Boolean(policyModalState)}
        title={
          policyModalState?.mode === 'edit' ? '포인트 정책 수정' : '포인트 정책 등록'
        }
        okText={policyModalState?.mode === 'edit' ? '수정 저장' : '정책 등록'}
        cancelText="취소"
        destroyOnHidden
        onCancel={closePolicyModal}
        onOk={handlePolicySubmit}
      >
        <Form form={policyForm} layout="vertical">
          <Descriptions
            bordered
            size="small"
            column={1}
            className="admin-form-descriptions"
            items={markRequiredDescriptionItems(
              [
                {
                  key: 'name',
                  label: '정책명',
                  children: (
                    <Form.Item name="name" noStyle rules={[{ required: true }]}>
                      <Input placeholder="예: 추천 가입 보상" />
                    </Form.Item>
                  )
                },
                {
                  key: 'policyType',
                  label: '정책 유형',
                  children: (
                    <Form.Item
                      name="policyType"
                      noStyle
                      rules={[{ required: true }]}
                    >
                      <Select
                        options={[
                          { label: '적립', value: '적립' },
                          { label: '차감', value: '차감' },
                          { label: '소멸', value: '소멸' }
                        ]}
                      />
                    </Form.Item>
                  )
                },
                {
                  key: 'conditionSummary',
                  label: '적용 조건',
                  children: (
                    <Form.Item
                      name="conditionSummary"
                      noStyle
                      rules={[{ required: true }]}
                    >
                      <Input.TextArea rows={3} />
                    </Form.Item>
                  )
                },
                {
                  key: 'earnDebitRule',
                  label: '적립/차감 규칙',
                  children: (
                    <Form.Item
                      name="earnDebitRule"
                      noStyle
                      rules={[{ required: true }]}
                    >
                      <Input.TextArea rows={3} />
                    </Form.Item>
                  )
                },
                {
                  key: 'expirationRule',
                  label: '소멸 규칙',
                  children: (
                    <Form.Item
                      name="expirationRule"
                      noStyle
                      rules={[{ required: true }]}
                    >
                      <Input.TextArea rows={3} />
                    </Form.Item>
                  )
                },
                {
                  key: 'targetCondition',
                  label: '대상 조건',
                  children: (
                    <Form.Item
                      name="targetCondition"
                      noStyle
                      rules={[{ required: true }]}
                    >
                      <Input />
                    </Form.Item>
                  )
                },
                {
                  key: 'triggerSource',
                  label: '발생 원천',
                  children: (
                    <Form.Item
                      name="triggerSource"
                      noStyle
                      rules={[{ required: true }]}
                    >
                      <Input />
                    </Form.Item>
                  )
                },
                {
                  key: 'duplicationRule',
                  label: '중복 방지 규칙',
                  children: (
                    <Form.Item
                      name="duplicationRule"
                      noStyle
                      rules={[{ required: true }]}
                    >
                      <Input.TextArea rows={2} />
                    </Form.Item>
                  )
                },
                {
                  key: 'manualAdjustmentRule',
                  label: '수동 조정 규칙',
                  children: (
                    <Form.Item
                      name="manualAdjustmentRule"
                      noStyle
                      rules={[{ required: true }]}
                    >
                      <Input.TextArea rows={2} />
                    </Form.Item>
                  )
                },
                {
                  key: 'note',
                  label: '운영 메모',
                  children: (
                    <Form.Item name="note" noStyle rules={[{ required: true }]}>
                      <Input.TextArea rows={3} />
                    </Form.Item>
                  )
                }
              ],
              [
                'name',
                'policyType',
                'conditionSummary',
                'earnDebitRule',
                'expirationRule',
                'targetCondition',
                'triggerSource',
                'duplicationRule',
                'manualAdjustmentRule',
                'note'
              ]
            )}
          />
        </Form>
      </Modal>

      <Modal
        open={adjustmentModalOpen}
        title={
          adjustmentTarget
            ? `포인트 수동 조정 · ${adjustmentTarget.userName}`
            : '포인트 수동 조정'
        }
        okText="조정 등록"
        cancelText="취소"
        destroyOnHidden
        onCancel={closeManualAdjustmentModal}
        onOk={handleManualAdjustmentSubmit}
      >
        <Form form={adjustmentForm} layout="vertical">
          <Descriptions
            bordered
            size="small"
            column={1}
            className="admin-form-descriptions"
            items={markRequiredDescriptionItems(
              [
                {
                  key: 'userId',
                  label: '회원 ID',
                  children: (
                    <Form.Item name="userId" noStyle rules={[{ required: true }]}>
                      <Input placeholder="예: U00018" />
                    </Form.Item>
                  )
                },
                {
                  key: 'userName',
                  label: '회원명',
                  children: (
                    <Form.Item
                      name="userName"
                      noStyle
                      rules={[{ required: true }]}
                    >
                      <Input placeholder="예: 김하린" />
                    </Form.Item>
                  )
                },
                {
                  key: 'ledgerType',
                  label: '조정 유형',
                  children: (
                    <Form.Item
                      name="ledgerType"
                      noStyle
                      rules={[{ required: true }]}
                    >
                      <Select
                        options={[
                          { label: '적립', value: '적립' },
                          { label: '차감', value: '차감' },
                          { label: '회수', value: '회수' },
                          { label: '복구', value: '복구' }
                        ]}
                      />
                    </Form.Item>
                  )
                },
                {
                  key: 'amount',
                  label: '조정 포인트',
                  children: (
                    <Form.Item
                      name="amount"
                      noStyle
                      rules={[
                        { required: true },
                        {
                          validator: async (_, value: number | undefined) => {
                            if (!value || value <= 0) {
                              throw new Error('0보다 큰 포인트를 입력해 주세요.');
                            }
                          }
                        }
                      ]}
                    >
                      <InputNumber
                        style={{ width: '100%' }}
                        min={1}
                        step={100}
                        placeholder="예: 1000"
                      />
                    </Form.Item>
                  )
                },
                {
                  key: 'approvalMemo',
                  label: '확인 메모',
                  children: (
                    <Form.Item
                      name="approvalMemo"
                      noStyle
                      rules={[{ required: true }]}
                    >
                      <Input.TextArea rows={3} />
                    </Form.Item>
                  )
                },
                {
                  key: 'reason',
                  label: '사유/근거',
                  children: (
                    <Form.Item name="reason" noStyle rules={[{ required: true }]}>
                      <Input.TextArea rows={4} />
                    </Form.Item>
                  )
                }
              ],
              ['userId', 'userName', 'ledgerType', 'amount', 'approvalMemo', 'reason']
            )}
          />
        </Form>
      </Modal>

      <Modal
        open={expirationHoldModalOpen}
        title={
          expirationHoldTarget
            ? `소멸 보류 등록 · ${expirationHoldTarget.id}`
            : '소멸 보류 등록'
        }
        okText="보류 등록"
        cancelText="취소"
        destroyOnHidden
        onCancel={closeExpirationHoldModal}
        onOk={handleExpirationHoldSubmit}
      >
        <Form form={expirationHoldForm} layout="vertical">
          <Descriptions
            bordered
            size="small"
            column={1}
            className="admin-form-descriptions"
            items={markRequiredDescriptionItems(
              [
                {
                  key: 'expirationId',
                  label: '소멸 예정 건',
                  children: (
                    <Form.Item
                      name="expirationId"
                      noStyle
                      rules={[{ required: true }]}
                    >
                      <Select
                        showSearch
                        options={expirationSelectOptions}
                        placeholder="소멸 예정 건을 선택해 주세요."
                      />
                    </Form.Item>
                  )
                },
                {
                  key: 'holdReason',
                  label: '보류 사유',
                  children: (
                    <Form.Item
                      name="holdReason"
                      noStyle
                      rules={[{ required: true }]}
                    >
                      <Input.TextArea rows={4} />
                    </Form.Item>
                  )
                }
              ],
              ['expirationId', 'holdReason']
            )}
          />
        </Form>
      </Modal>
    </div>
  );
}
