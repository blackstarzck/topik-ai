import {
  Alert,
  Button,
  Card,
  Col,
  Descriptions,
  Form,
  Input,
  InputNumber,
  Modal,
  Row,
  Space,
  Tag,
  Typography,
  notification
} from 'antd';
import type { DescriptionsProps, TableColumnsType } from 'antd';
import type {
  FilterValue,
  TablePaginationConfig
} from 'antd/es/table/interface';
import type { ChangeEvent } from 'react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';

import { fetchReferralsSafe } from '../api/referrals-service';
import {
  defaultReferralQuery,
  useReferralsQueryStore
} from '../model/referrals-query-store';
import type {
  ReferralAnomalyFilter,
  ReferralAnomalyStatus,
  ReferralQuery,
  ReferralRelation,
  ReferralRewardLedgerEntry,
  ReferralSearchField,
  ReferralStatusFilter,
  ReferralSummary
} from '../model/referrals-types';
import type { AsyncState } from '../../../shared/model/async-state';
import { AuditLogLink } from '../../../shared/ui/audit-log-link/audit-log-link';
import { ConfirmAction } from '../../../shared/ui/confirm-action/confirm-action';
import {
  DetailDrawer,
  DetailDrawerBody,
  DetailDrawerSection
} from '../../../shared/ui/detail-drawer/detail-drawer';
import { AdminListCard } from '../../../shared/ui/list-page-card/admin-list-card';
import { PageTitle } from '../../../shared/ui/page-title/page-title';
import {
  SearchBar,
  SearchBarDateRange,
  SearchBarDetailField
} from '../../../shared/ui/search-bar/search-bar';
import { useSearchBarDateDraft } from '../../../shared/ui/search-bar/use-search-bar-date-draft';
import {
  matchesSearchDateRange,
  matchesSearchField,
  parseSearchDate
} from '../../../shared/ui/search-bar/search-bar-utils';
import { StatusBadge } from '../../../shared/ui/status-badge/status-badge';
import { AdminDataTable } from '../../../shared/ui/table/admin-data-table';
import { BinaryStatusSwitch } from '../../../shared/ui/table/binary-status-switch';
import {
  createDrawerTableScroll,
  DRAWER_TABLE_PAGINATION,
  fixDrawerTableFirstColumn
} from '../../../shared/ui/table/drawer-table';
import { createStatusColumnTitle } from '../../../shared/ui/table/status-column-title';
import {
  createNumberSorter,
  createTextSorter
} from '../../../shared/ui/table/table-column-utils';
import { TableActionMenu } from '../../../shared/ui/table/table-action-menu';
import { UserNavigationLink } from '../../../shared/ui/user/user-reference';

const { Paragraph, Text, Title } = Typography;

const pageSizeOptions = ['20', '50', '100'];

const searchFieldOptions: { label: string; value: ReferralSearchField }[] = [
  { label: '전체', value: 'all' },
  { label: '異붿쿇 肄붾뱶', value: 'code' },
  { label: '異붿쿇??ID', value: 'referrerId' },
  { label: '異붿쿇??이름', value: 'referrerName' }
];

const statusFilterOptions: { label: string; value: ReferralStatusFilter }[] = [
  { label: '전체 상태', value: 'all' },
  { label: '활성', value: '활성' },
  { label: '비활성, value: '비활성 }
];

const anomalyFilterOptions: {
  label: string;
  value: ReferralAnomalyFilter;
}[] = [
  { label: '전체 ?댁긽移?, value: 'all' },
  { label: '?놁쓬', value: '?놁쓬' },
  { label: '寃???꾩슂', value: '寃???꾩슂' },
  { label: '寃??완료', value: '寃??완료' }
];

type ActionState =
  | { type: 'deactivate'; referral: ReferralSummary }
  | { type: 'activate'; referral: ReferralSummary }
  | { type: 'review-anomaly'; referral: ReferralSummary }
  | null;

type RewardAdjustmentFormValues = {
  amount: number;
  reason: string;
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

function parseSearchField(value: string | null): ReferralSearchField {
  if (value === 'code' || value === 'referrerId' || value === 'referrerName') {
    return value;
  }
  return defaultReferralQuery.searchField;
}

function parseStatusFilter(value: string | null): ReferralStatusFilter {
  if (value === '활성' || value === '비활성) {
    return value;
  }
  return defaultReferralQuery.status;
}

function parseAnomalyFilter(value: string | null): ReferralAnomalyFilter {
  if (value === '?놁쓬' || value === '寃???꾩슂' || value === '寃??완료') {
    return value;
  }
  return defaultReferralQuery.anomalyStatus;
}

function parseReferralQuery(searchParams: URLSearchParams): ReferralQuery {
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

function buildReferralSearchParams(
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

function filterReferrals(
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

function formatCurrentDateTime(): string {
  return new Date().toISOString().slice(0, 16).replace('T', ' ');
}

function formatRewardAmount(amount: number): string {
  const absolute = Math.abs(amount).toLocaleString();
  if (amount > 0) {
    return `+${absolute}`;
  }
  if (amount < 0) {
    return `-${absolute}`;
  }
  return '0';
}

function calculateCompletedRewardAmount(
  entries: ReferralRewardLedgerEntry[]
): number {
  return entries
    .filter((entry) => entry.status === '완료')
    .reduce((total, entry) => total + entry.amount, 0);
}

function buildBasicInfoItems(
  referral: ReferralSummary
): DescriptionsProps['items'] {
  return [
    { key: 'id', label: '異붿쿇 肄붾뱶 ID', children: referral.id },
    { key: 'code', label: '異붿쿇 肄붾뱶', children: referral.code },
    {
      key: 'referrer',
      label: '異붿쿇??회원',
      children: (
        <UserNavigationLink
          userId={referral.referrerUserId}
          userName={referral.referrerName}
        />
      )
    },
    { key: 'email', label: '異붿쿇??이메일, children: referral.referrerEmail },
    {
      key: 'status',
      label: '肄붾뱶 상태',
      children: <StatusBadge status={referral.status} />
    },
    { key: 'createdAt', label: '?앹꽦??, children: referral.createdAt },
    { key: 'expiresAt', label: '留뚮즺??, children: referral.expiresAt },
    { key: 'lastUsedAt', label: '理쒓렐 사용자, children: referral.lastUsedAt },
    {
      key: 'lastActionAt',
      label: '理쒓렐 議곗튂??,
      children: referral.lastActionAt
    }
  ];
}

function buildPolicyItems(
  referral: ReferralSummary
): DescriptionsProps['items'] {
  return [
    {
      key: 'version',
      label: '?뺤콉 踰꾩쟾',
      children: referral.policySnapshot.version
    },
    {
      key: 'confirmationTiming',
      label: '異붿쿇 ?뺤젙 ?쒖젏',
      children: referral.policySnapshot.confirmationTiming
    },
    {
      key: 'rewardMethod',
      label: '蹂댁긽 ?섎떒',
      children: referral.policySnapshot.rewardMethod
    },
    {
      key: 'manualAdjustmentAuthority',
      label: '?섎룞 蹂댁젙 沅뚰븳',
      children: referral.policySnapshot.manualAdjustmentAuthority
    },
    {
      key: 'rollbackRule',
      label: '?뚯닔/취소 洹쒖튃',
      children: referral.policySnapshot.rollbackRule
    }
  ];
}

function renderAnomalyTag(
  status: ReferralAnomalyStatus,
  count?: number
): JSX.Element {
  const color =
    status === '寃???꾩슂'
      ? 'volcano'
      : status === '寃??완료'
        ? 'blue'
        : 'default';
  const label = count && count > 0 ? `${status} (${count})` : status;
  return <Tag color={color}>{label}</Tag>;
}

function getAdjustmentEntryType(amount: number): ReferralRewardLedgerEntry['entryType'] {
  return amount >= 0 ? '?섎룞 蹂댁젙' : '?뚯닔';
}

export default function UsersReferralsPage(): JSX.Element {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const selectedReferralId = searchParams.get('selected') ?? '';
  const query = useReferralsQueryStore((state) => state.query);
  const replaceQuery = useReferralsQueryStore((state) => state.replaceQuery);
  const setQuery = useReferralsQueryStore((state) => state.setQuery);
  const [referralsState, setReferralsState] = useState<AsyncState<ReferralSummary[]>>({
    status: 'pending',
    data: [],
    errorMessage: null,
    errorCode: null
  });
  const [reloadKey, setReloadKey] = useState(0);
  const [actionState, setActionState] = useState<ActionState>(null);
  const [adjustmentTarget, setAdjustmentTarget] = useState<ReferralSummary | null>(
    null
  );
  const [adjustmentForm] = Form.useForm<RewardAdjustmentFormValues>();
  const [notificationApi, notificationContextHolder] =
    notification.useNotification();
  const {
    draftStartDate,
    draftEndDate,
    handleDraftDateChange,
    handleDraftReset,
    handleDetailOpenChange
  } = useSearchBarDateDraft(query.startDate, query.endDate);

  useEffect(() => {
    replaceQuery(parseReferralQuery(searchParams));
  }, [replaceQuery, searchParams]);

  useEffect(() => {
    const controller = new AbortController();

    setReferralsState((prev) => ({
      ...prev,
      status: 'pending',
      errorMessage: null,
      errorCode: null
    }));

    void fetchReferralsSafe(controller.signal).then((result) => {
      if (controller.signal.aborted) {
        return;
      }

      if (result.ok) {
        setReferralsState({
          status: result.data.length === 0 ? 'empty' : 'success',
          data: result.data,
          errorMessage: null,
          errorCode: null
        });
        return;
      }

      setReferralsState((prev) => ({
        ...prev,
        status: 'error',
        errorMessage: result.error.message,
        errorCode: result.error.code
      }));
    });

    return () => {
      controller.abort();
    };
  }, [query.page, query.pageSize, reloadKey]);

  const commitQuery = useCallback(
    (next: Partial<ReferralQuery>) => {
      const merged = { ...query, ...next };
      setQuery(next);
      setSearchParams(
        buildReferralSearchParams(merged, selectedReferralId || undefined),
        { replace: true }
      );
    },
    [query, selectedReferralId, setQuery, setSearchParams]
  );

  const visibleReferrals = useMemo(
    () => filterReferrals(referralsState.data, query),
    [query, referralsState.data]
  );

  const selectedReferral = useMemo(
    () =>
      referralsState.data.find((item) => item.id === selectedReferralId) ?? null,
    [referralsState.data, selectedReferralId]
  );

  const selectedReferralRewardGroups = useMemo(() => {
    if (!selectedReferral) {
      return {
        relationEntryMap: new Map<string, ReferralRewardLedgerEntry[]>(),
        codeLevelEntries: [] as ReferralRewardLedgerEntry[]
      };
    }

    const relationEntryMap = new Map<string, ReferralRewardLedgerEntry[]>();
    const relationIds = new Set(
      selectedReferral.relations.map((relation) => relation.id)
    );

    selectedReferral.relations.forEach((relation) => {
      relationEntryMap.set(relation.id, []);
    });

    const codeLevelEntries: ReferralRewardLedgerEntry[] = [];

    selectedReferral.rewardLedger.forEach((entry) => {
      if (entry.relationId && relationIds.has(entry.relationId)) {
        relationEntryMap.get(entry.relationId)?.push(entry);
        return;
      }

      codeLevelEntries.push(entry);
    });

    return { relationEntryMap, codeLevelEntries };
  }, [selectedReferral]);

  const summary = useMemo(
    () => ({
      activeCodeCount: referralsState.data.filter((item) => item.status === '활성')
        .length,
      totalReferralCount: referralsState.data.reduce(
        (total, item) => total + item.referredCount,
        0
      ),
      rewardPayoutCount: referralsState.data.reduce(
        (total, item) =>
          total +
          item.rewardLedger.filter((entry) => entry.status === '완료').length,
        0
      ),
      reviewNeededCount: referralsState.data.filter(
        (item) => item.anomalyStatus === '寃???꾩슂'
      ).length
    }),
    [referralsState.data]
  );

  const openDrawer = useCallback(
    (referralId: string) => {
      setSearchParams(buildReferralSearchParams(query, referralId), {
        replace: true
      });
    },
    [query, setSearchParams]
  );

  const closeDrawer = useCallback(() => {
    setSearchParams(buildReferralSearchParams(query), { replace: true });
  }, [query, setSearchParams]);

  const openPointsPage = useCallback(
    (userId: string) => {
      navigate(`/commerce/points?keyword=${encodeURIComponent(userId)}`);
    },
    [navigate]
  );

  const handleDeactivate = useCallback((referral: ReferralSummary) => {
    setActionState({ type: 'deactivate', referral });
  }, []);

  const handleActivate = useCallback((referral: ReferralSummary) => {
    setActionState({ type: 'activate', referral });
  }, []);

  const handleReviewAnomaly = useCallback((referral: ReferralSummary) => {
    setActionState({ type: 'review-anomaly', referral });
  }, []);

  const handleOpenAdjustment = useCallback(
    (referral: ReferralSummary) => {
      setAdjustmentTarget(referral);
      adjustmentForm.setFieldsValue({
        amount: 1000,
        reason: ''
      });
    },
    [adjustmentForm]
  );

  const closeAction = useCallback(() => {
    setActionState(null);
  }, []);

  const closeAdjustmentModal = useCallback(() => {
    setAdjustmentTarget(null);
  }, []);

  const handleConfirmAction = useCallback(
    async (reason: string) => {
      if (!actionState) {
        return;
      }

      const actionLabelMap = {
        deactivate: '異붿쿇 肄붾뱶 鍮꾪솢?깊솕',
        activate: '異붿쿇 肄붾뱶 ?ы솢?깊솕',
        'review-anomaly': '?댁긽移?寃??완료 泥섎━'
      } as const;

      setReferralsState((prev) => {
        const nextData = prev.data.map((item) => {
          if (item.id !== actionState.referral.id) {
            return item;
          }

          if (actionState.type === 'review-anomaly') {
            return {
              ...item,
              anomalyStatus: '寃??완료',
              lastActionAt: formatCurrentDateTime(),
              adminMemo: `${item.adminMemo}\n- ${formatCurrentDateTime()} ?댁긽移?寃??완료: ${reason}`
            };
          }

          return {
            ...item,
            status: actionState.type === 'deactivate' ? '비활성 : '활성',
            lastActionAt: formatCurrentDateTime()
          };
        });

        return {
          ...prev,
          data: nextData,
          status: nextData.length === 0 ? 'empty' : 'success'
        };
      });

      notificationApi.success({
        message: `${actionLabelMap[actionState.type]} 완료`,
        description: (
          <Space direction="vertical">
            <Text>대상?좏삎: 異붿쿇??/Text>
            <Text>대상ID: {actionState.referral.id}</Text>
            <Text>사유/洹쇨굅: {reason}</Text>
            <AuditLogLink
              targetType="Referral"
              targetId={actionState.referral.id}
            />
          </Space>
        )
      });

      setActionState(null);
    },
    [actionState, notificationApi]
  );

  const handleSubmitAdjustment = useCallback(async () => {
    if (!adjustmentTarget) {
      return;
    }

    const values = await adjustmentForm.validateFields();
    const entryType = getAdjustmentEntryType(values.amount);
    const adjustmentId = `ADJ-${Date.now()}`;
    const nextEntry: ReferralRewardLedgerEntry = {
      id: adjustmentId,
      relationId: '',
      entryType,
      rewardMethodLabel: '?뺤콉 誘명솗??,
      amount: values.amount,
      status: '완료',
      actedAt: formatCurrentDateTime(),
      reason: values.reason.trim()
    };

    setReferralsState((prev) => {
      const nextData = prev.data.map((item) => {
        if (item.id !== adjustmentTarget.id) {
          return item;
        }

        const rewardLedger = [nextEntry, ...item.rewardLedger];
        return {
          ...item,
          rewardLedger,
          totalRewardAmount: item.totalRewardAmount + values.amount,
          lastActionAt: nextEntry.actedAt
        };
      });

      return {
        ...prev,
        data: nextData,
        status: nextData.length === 0 ? 'empty' : 'success'
      };
    });

    notificationApi.success({
      message: '蹂댁긽 ?섎룞 議곗젙 완료',
      description: (
        <Space direction="vertical">
          <Text>대상?좏삎: 異붿쿇??/Text>
          <Text>대상ID: {adjustmentTarget.id}</Text>
          <Text>議곗젙 ID: {adjustmentId}</Text>
          <Text>議곗젙 湲덉븸: {formatRewardAmount(values.amount)}</Text>
          <Text>사유/洹쇨굅: {values.reason.trim()}</Text>
          <AuditLogLink targetType="Referral" targetId={adjustmentTarget.id} />
        </Space>
      )
    });

    setAdjustmentTarget(null);
  }, [adjustmentForm, adjustmentTarget, notificationApi]);

  const handleRetryLoad = useCallback(() => {
    setReloadKey((prev) => prev + 1);
  }, []);

  const handleKeywordChange = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => {
      commitQuery({
        keyword: event.target.value,
        page: 1
      });
    },
    [commitQuery]
  );

  const handleSearchFieldChange = useCallback(
    (value: string) => {
      commitQuery({
        searchField: value as ReferralSearchField,
        page: 1
      });
    },
    [commitQuery]
  );

  const handleDateRangeChange = useCallback(
    (startDate: string, endDate: string) => {
      commitQuery({
        startDate,
        endDate,
        page: 1
      });
    },
    [commitQuery]
  );

  const handleApplyDateRange = useCallback(() => {
    handleDateRangeChange(draftStartDate, draftEndDate);
  }, [draftEndDate, draftStartDate, handleDateRangeChange]);

  const handleTableChange = useCallback(
    (
      pagination: TablePaginationConfig,
      filters: Record<string, FilterValue | null>
    ) => {
      const nextStatus = parseStatusFilter(
        typeof filters.status?.[0] === 'string' ? String(filters.status[0]) : null
      );
      const nextAnomalyStatus = parseAnomalyFilter(
        typeof filters.anomalyStatus?.[0] === 'string'
          ? String(filters.anomalyStatus[0])
          : null
      );

      commitQuery({
        page: pagination.current ?? query.page,
        pageSize: pagination.pageSize ?? query.pageSize,
        status: nextStatus,
        anomalyStatus: nextAnomalyStatus
      });
    },
    [commitQuery, query.page, query.pageSize]
  );

  const columns = useMemo<TableColumnsType<ReferralSummary>>(
    () => [
      {
        title: '異붿쿇 肄붾뱶',
        dataIndex: 'code',
        width: 150,
        sorter: createTextSorter((record) => record.code)
      },
      {
        title: '異붿쿇??회원',
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
        title: '?쇱텛泥쒖씤 ??,
        dataIndex: 'referredCount',
        width: 120,
        sorter: createNumberSorter((record) => record.referredCount),
        render: (value: number) => `${value.toLocaleString()}紐?
      },
      {
        title: '異붿쿇 ?뺤젙 ??,
        dataIndex: 'confirmedCount',
        width: 120,
        sorter: createNumberSorter((record) => record.confirmedCount),
        render: (value: number) => `${value.toLocaleString()}嫄?
      },
      {
        title: '?꾩쟻 蹂댁긽',
        dataIndex: 'totalRewardAmount',
        width: 140,
        sorter: createNumberSorter((record) => record.totalRewardAmount),
        render: (value: number) => formatRewardAmount(value)
      },
      {
        title: '理쒓렐 사용자,
        dataIndex: 'lastUsedAt',
        width: 160,
        sorter: createTextSorter((record) => record.lastUsedAt)
      },
      {
        title: createStatusColumnTitle('肄붾뱶 상태', ['활성', '비활성]),
        dataIndex: 'status',
        width: 120,
        filters: statusFilterOptions
          .filter((option) => option.value !== 'all')
          .map((option) => ({
            text: option.label,
            value: option.value
          })),
        filteredValue: query.status === 'all' ? null : [query.status],
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
            uncheckedLabel="비활성
            onToggle={() =>
              record.status === '활성'
                ? handleDeactivate(record)
                : handleActivate(record)
            }
          />
        )
      },
      {
        title: createStatusColumnTitle('?댁긽移??щ?', ['?놁쓬', '寃???꾩슂', '寃??완료']),
        dataIndex: 'anomalyStatus',
        width: 140,
        filters: anomalyFilterOptions
          .filter((option) => option.value !== 'all')
          .map((option) => ({
            text: option.label,
            value: option.value
          })),
        filteredValue:
          query.anomalyStatus === 'all' ? null : [query.anomalyStatus],
        sorter: createTextSorter((record) => record.anomalyStatus),
        render: (status: ReferralAnomalyStatus, record) =>
          renderAnomalyTag(status, record.anomalyFlags.length)
      },
      {
        title: '?≪뀡',
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
                label: '?ъ씤??愿由??대룞',
                onClick: () => openPointsPage(record.referrerUserId)
              },
              {
                key: `adjust-${record.id}`,
                label: '蹂댁긽 ?섎룞 議곗젙',
                onClick: () => handleOpenAdjustment(record)
              },
              {
                key: `review-${record.id}`,
                label: '?댁긽移?寃??완료',
                disabled: record.anomalyStatus !== '寃???꾩슂',
                onClick: () => handleReviewAnomaly(record)
              }
            ]}
          />
        )
      }
    ],
    [
      handleActivate,
      handleDeactivate,
      handleOpenAdjustment,
      handleReviewAnomaly,
      openPointsPage,
      query.anomalyStatus,
      query.status,
    ]
  );

  const relationColumns = useMemo<TableColumnsType<ReferralRelation>>(
    () =>
      fixDrawerTableFirstColumn([
      {
        title: '?쇱텛泥쒖씤',
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
        title: '吏꾪뻾 시각',
        key: 'timeline',
        width: 220,
        render: (_, relation) => (
          <Space direction="vertical" size={0}>
            <Text type="secondary">媛?? {relation.joinedAt}</Text>
            <Text type="secondary">
              ?뺤젙: {relation.confirmedAt || '誘명솗??}
            </Text>
          </Space>
        )
      },
      {
        title: createStatusColumnTitle('愿怨?상태', ['대기, '완료', '취소']),
        dataIndex: 'status',
        width: 100,
        render: (status: ReferralRelation['status']) => (
          <StatusBadge status={status} />
        )
      },
      {
        title: '寃??,
        key: 'review',
        render: (_, relation) => (
          <Space direction="vertical" size={4}>
            {relation.anomalyFlag ? (
              <Tag color="volcano">{relation.anomalyFlag}</Tag>
            ) : (
              <Text type="secondary">?댁긽移??놁쓬</Text>
            )}
            {relation.reviewNote ? (
              <Text type="secondary">{relation.reviewNote}</Text>
            ) : null}
          </Space>
        )
      },
      {
        title: '?꾩쟻 蹂댁긽',
        key: 'rewardAmount',
        width: 110,
        render: (_, relation) =>
          formatRewardAmount(
            calculateCompletedRewardAmount(
              selectedReferralRewardGroups.relationEntryMap.get(relation.id) ?? []
            )
          )
      }
      ]),
    [selectedReferralRewardGroups.relationEntryMap]
  );

  const rewardLedgerColumns = useMemo<TableColumnsType<ReferralRewardLedgerEntry>>(
    () => [
      {
        title: '?좏삎',
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
        title: '湲덉븸',
        dataIndex: 'amount',
        width: 100,
        render: (value: number) => (
          <Text strong type={value < 0 ? 'danger' : undefined}>
            {formatRewardAmount(value)}
          </Text>
        )
      },
      {
        title: '泥섎━ 시각',
        dataIndex: 'actedAt',
        width: 150
      },
      {
        title: '사유',
        dataIndex: 'reason'
      }
    ],
    []
  );

  const codeLevelRewardLedgerColumns =
    useMemo<TableColumnsType<ReferralRewardLedgerEntry>>(
      () => fixDrawerTableFirstColumn(rewardLedgerColumns),
      [rewardLedgerColumns]
    );

  const handleRowClick = useCallback(
    (record: ReferralSummary) => ({
      onClick: () => openDrawer(record.id),
      style: { cursor: 'pointer' }
    }),
    [openDrawer]
  );

  const drawerStatusAlert = useMemo(() => {
    if (!selectedReferral) {
      return null;
    }
    if (selectedReferral.anomalyStatus === '寃???꾩슂') {
      return {
        type: 'warning' as const,
        message: '?댁긽移?寃?좉? ?꾩슂??異붿쿇 肄붾뱶?낅땲??',
        description:
          '異붿쿇 愿怨꾩? 蹂댁긽 ?먯옣???④퍡 ?뺤씤????寃??완료 ?먮뒗 肄붾뱶 상태 蹂寃쎌쓣 吏꾪뻾?섏꽭??'
      };
    }
    if (selectedReferral.status === '비활성) {
      return {
        type: 'info' as const,
        message: '?꾩옱 비활성상태??異붿쿇 肄붾뱶?낅땲??',
        description:
          '사용자?붾㈃?먯꽌??肄붾뱶 ?낅젰??李⑤떒??媛?μ꽦???덉쑝誘濡?留뚮즺/비활성?덈궡 臾멸뎄 ?ㅺ퀎? ?④퍡 ?뺤씤?댁빞 ?⑸땲??'
      };
    }
    return {
      type: 'info' as const,
      message: '異붿쿇 ?뺤콉 ?쇰?媛 ?꾩쭅 誘명솗?뺤엯?덈떎.',
      description:
        '異붿쿇 ?뺤젙 ?쒖젏, 蹂댁긽 ?섎떒, ?섎룞 蹂댁젙 沅뚰븳, ?뚯닔 洹쒖튃? 媛?뺢컪 湲곗??쇰줈 ?쒖떆?⑸땲??'
    };
  }, [selectedReferral]);

  return (
    <div>
      {notificationContextHolder}
      <PageTitle title="異붿쿇??愿由? />

      <Paragraph type="secondary" style={{ marginBottom: 16 }}>
        異붿쿇 肄붾뱶, 異붿쿇 愿怨? 蹂댁긽 ?먯옣??媛숈? 운영 ?먮쫫?먯꽌 愿由ы빀?덈떎. 사용자
        ?붾㈃? ?꾩쭅 援ы쁽?섏? ?딆븯湲??뚮Ц?? ???붾㈃??상태媛믨낵 議곗튂 ?대젰? ?ν썑
        媛???꾨줈紐⑥뀡, 移쒓뎄 珥덈?, 蹂댁긽 ?댁뿭 UI??湲곗? ?곗씠?곕줈 ?ъ슜?⑸땲??
      </Paragraph>

      <Alert
        type="warning"
        showIcon
        style={{ marginBottom: 16 }}
        message="誘명솗???뺤콉 ?뺤씤 ?꾩슂"
        description={
          <Space direction="vertical" size={4}>
            <Text>異붿쿇 ?뺤젙 ?쒖젏: 媛??완료 / 泥?결제 / 泥??숈뒿 완료 以?誘명솗??/Text>
            <Text>蹂댁긽 ?섎떒: ?ъ씤??/ 荑좏룿 / ?쇳빀 以?誘명솗??/Text>
            <Text>?섎룞 蹂댁젙 沅뚰븳怨??뚯닔 洹쒖튃: 蹂꾨룄 沅뚰븳 遺꾨━ ?щ? 諛?취소 議곌굔 誘명솗??/Text>
          </Space>
        }
      />

      {referralsState.status === 'error' ? (
        <Alert
          type="error"
          showIcon
          style={{ marginBottom: 12 }}
          message="異붿쿇??紐⑸줉 議고쉶??실패?덉뒿?덈떎."
          description={
            <Space direction="vertical" size={4}>
              <Text>
                {referralsState.errorMessage ?? '?쇱떆?곸씤 ?ㅻ쪟媛 諛쒖깮?덉뒿?덈떎.'}
              </Text>
              <Text type="secondary">
                ?ㅻ쪟 肄붾뱶: {referralsState.errorCode ?? '-'}
              </Text>
              <Space>
                <Button onClick={handleRetryLoad}>?ъ떆??/Button>
                <Text type="secondary">留덉?留?성공 ?곗씠?곕뒗 ?좎??⑸땲??</Text>
              </Space>
            </Space>
          }
        />
      ) : null}

      <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
        <Col xs={24} md={6}>
          <Card>
            <Title level={5} style={{ marginTop: 0, marginBottom: 8 }}>
              활성 肄붾뱶 ??
            </Title>
            <Text strong style={{ fontSize: 28 }}>
              {summary.activeCodeCount.toLocaleString()}嫄?
            </Text>
          </Card>
        </Col>
        <Col xs={24} md={6}>
          <Card>
            <Title level={5} style={{ marginTop: 0, marginBottom: 8 }}>
              珥?異붿쿇 ??
            </Title>
            <Text strong style={{ fontSize: 28 }}>
              {summary.totalReferralCount.toLocaleString()}嫄?
            </Text>
          </Card>
        </Col>
        <Col xs={24} md={6}>
          <Card>
            <Title level={5} style={{ marginTop: 0, marginBottom: 8 }}>
              蹂댁긽 吏湲?嫄댁닔
            </Title>
            <Text strong style={{ fontSize: 28 }}>
              {summary.rewardPayoutCount.toLocaleString()}嫄?
            </Text>
          </Card>
        </Col>
        <Col xs={24} md={6}>
          <Card>
            <Title level={5} style={{ marginTop: 0, marginBottom: 8 }}>
              寃???꾩슂 嫄댁닔
            </Title>
            <Text strong style={{ fontSize: 28 }}>
              {summary.reviewNeededCount.toLocaleString()}嫄?
            </Text>
          </Card>
        </Col>
      </Row>

      <AdminListCard
        toolbar={
          <SearchBar
            searchField={query.searchField}
            searchFieldOptions={searchFieldOptions}
            keyword={query.keyword}
            onSearchFieldChange={handleSearchFieldChange}
            onKeywordChange={handleKeywordChange}
            keywordPlaceholder="異붿쿇 肄붾뱶, 異붿쿇??ID/이름 寃??
            detailTitle="상세 寃??
            detailContent={
              <SearchBarDetailField label="理쒓렐 사용자>
                <SearchBarDateRange
                  startDate={draftStartDate}
                  endDate={draftEndDate}
                  onChange={handleDraftDateChange}
                />
              </SearchBarDetailField>
            }
            onApply={handleApplyDateRange}
            onDetailOpenChange={handleDetailOpenChange}
            onReset={handleDraftReset}
            summary={
              <Text type="secondary">
                珥?{visibleReferrals.length.toLocaleString()}嫄?
              </Text>
            }
          />
        }
      >
        {referralsState.status !== 'pending' && visibleReferrals.length === 0 ? (
          <Alert
            type="info"
            showIcon
            style={{ marginBottom: 12 }}
            message="議곌굔??留욌뒗 異붿쿇 肄붾뱶媛 ?놁뒿?덈떎."
            description="寃?됱뼱 ?먮뒗 ?꾪꽣 議곌굔??議곗젙?????ㅼ떆 ?뺤씤?섏꽭??"
          />
        ) : null}

      <AdminDataTable<ReferralSummary>
        rowKey="id"
        columns={columns}
          dataSource={visibleReferrals}
          onChange={handleTableChange}
          onRow={handleRowClick}
          loading={referralsState.status === 'pending'}
          scroll={{ x: 1560, y: 560 }}
          pagination={{
            current: query.page,
            pageSize: query.pageSize,
            pageSizeOptions,
            showSizeChanger: true,
            showTotal: (total) => `珥?${total.toLocaleString()}嫄?
          }}
        />
      </AdminListCard>

      <DetailDrawer
        open={Boolean(selectedReferral)}
        title={
          selectedReferral
            ? `異붿쿇 肄붾뱶 상세 쨌 ${selectedReferral.code}`
            : '異붿쿇 肄붾뱶 상세'
        }
        width={720}
        onClose={closeDrawer}
        headerMeta={
          selectedReferral ? (
            <Space>
              <StatusBadge status={selectedReferral.status} />
              {renderAnomalyTag(
                selectedReferral.anomalyStatus,
                selectedReferral.anomalyFlags.length
              )}
            </Space>
          ) : null
        }
        footerStart={
          selectedReferral ? (
            <AuditLogLink
              targetType="Referral"
              targetId={selectedReferral.id}
            />
          ) : null
        }
        footerEnd={
          selectedReferral ? (
            <Space wrap>
              <Button
                onClick={() => openPointsPage(selectedReferral.referrerUserId)}
              >
                ?ъ씤??愿由??대룞
              </Button>
              <Button onClick={() => handleOpenAdjustment(selectedReferral)}>
                蹂댁긽 議곗젙
              </Button>
              {selectedReferral.anomalyStatus === '寃???꾩슂' ? (
                <Button onClick={() => handleReviewAnomaly(selectedReferral)}>
                  ?댁긽移?寃??완료
                </Button>
              ) : null}
              {selectedReferral.status === '활성' ? (
                <Button
                  danger
                  type="primary"
                  onClick={() => handleDeactivate(selectedReferral)}
                >
                  肄붾뱶 鍮꾪솢?깊솕
                </Button>
              ) : (
                <Button
                  type="primary"
                  onClick={() => handleActivate(selectedReferral)}
                >
                  肄붾뱶 ?ы솢?깊솕
                </Button>
              )}
            </Space>
          ) : null
        }
      >
        {selectedReferral ? (
          <DetailDrawerBody>
            {drawerStatusAlert ? (
              <Alert
                type={drawerStatusAlert.type}
                showIcon
                message={drawerStatusAlert.message}
                description={drawerStatusAlert.description}
              />
            ) : null}

            <DetailDrawerSection title="湲곕낯 ?뺣낫">
              <Descriptions
                bordered
                size="small"
                column={1}
                items={buildBasicInfoItems(selectedReferral)}
              />
            </DetailDrawerSection>

            <DetailDrawerSection title="異붿쿇 愿怨?諛?蹂댁긽">
              <AdminDataTable
                rowKey={(relation) => relation.id}
                columns={relationColumns}
                dataSource={selectedReferral.relations}
                pagination={DRAWER_TABLE_PAGINATION}
                scroll={createDrawerTableScroll(960)}
                locale={{ emptyText: '異붿쿇 愿怨꾧? ?놁뒿?덈떎.' }}
                expandable={{
                  fixed: 'left',
                  rowExpandable: (relation) =>
                    (selectedReferralRewardGroups.relationEntryMap.get(relation.id) ?? [])
                      .length > 0,
                  expandedRowRender: (relation) => {
                    const relationEntries =
                      selectedReferralRewardGroups.relationEntryMap.get(relation.id) ??
                      [];

                    return (
                      <AdminDataTable
                        rowKey={(entry) => entry.id}
                        columns={rewardLedgerColumns}
                        dataSource={relationEntries}
                        pagination={false}
                        scroll={createDrawerTableScroll(720)}
                        locale={{ emptyText: '??愿怨꾩뿉 ?곌껐???먯옣 ?대젰???놁뒿?덈떎.' }}
                      />
                    );
                  }
                }}
              />
              {selectedReferralRewardGroups.codeLevelEntries.length > 0 ? (
                <div style={{ marginTop: 16 }}>
                  <Title level={5} style={{ marginTop: 0, marginBottom: 8 }}>
                    肄붾뱶 ?⑥쐞 議곗젙
                  </Title>
                  <AdminDataTable
                    rowKey={(entry) => entry.id}
                    columns={codeLevelRewardLedgerColumns}
                    dataSource={selectedReferralRewardGroups.codeLevelEntries}
                    pagination={DRAWER_TABLE_PAGINATION}
                    scroll={createDrawerTableScroll(720)}
                    locale={{ emptyText: '肄붾뱶 ?⑥쐞 議곗젙???놁뒿?덈떎.' }}
                  />
                </div>
              ) : null}
            </DetailDrawerSection>

            <DetailDrawerSection title="?뺤콉 ?ㅻ깄??>
              <Descriptions
                bordered
                size="small"
                column={1}
                items={buildPolicyItems(selectedReferral)}
              />
              <Paragraph type="secondary" style={{ marginTop: 8, marginBottom: 0 }}>
                {selectedReferral.policySnapshot.note}
              </Paragraph>
            </DetailDrawerSection>

            <DetailDrawerSection title="?댁긽移?諛?운영 硫붾え">
              <Space wrap style={{ marginBottom: 8 }}>
                {selectedReferral.anomalyFlags.length > 0 ? (
                  selectedReferral.anomalyFlags.map((flag) => (
                    <Tag color="volcano" key={flag}>
                      {flag}
                    </Tag>
                  ))
                ) : (
                  <Tag>?댁긽移??뚮옒洹??놁쓬</Tag>
                )}
              </Space>
              <Paragraph style={{ marginBottom: 0 }}>
                {selectedReferral.adminMemo}
              </Paragraph>
            </DetailDrawerSection>
          </DetailDrawerBody>
        ) : null}
      </DetailDrawer>

      {actionState ? (
        <ConfirmAction
          open
          title={
            actionState.type === 'deactivate'
              ? '異붿쿇 肄붾뱶 鍮꾪솢?깊솕'
              : actionState.type === 'activate'
                ? '異붿쿇 肄붾뱶 ?ы솢?깊솕'
                : '?댁긽移?寃??완료 泥섎━'
          }
          description={
            actionState.type === 'deactivate'
              ? '異붿쿇 肄붾뱶 사용자以묐떒?⑸땲?? 사용자?붾㈃ ?낅젰 李⑤떒怨?운영 사유瑜??④퍡 湲곕줉?섏꽭??'
              : actionState.type === 'activate'
                ? '異붿쿇 肄붾뱶 사용자?ㅼ떆 ?덉슜?⑸땲?? ?ы솢?깊솕 사유? 洹쇨굅瑜?湲곕줉?섏꽭??'
                : '異붿쿇 愿怨꾩? 蹂댁긽 ?먯옣??寃??완료 상태濡??꾪솚?⑸땲?? 寃??사유? ?먮떒 洹쇨굅瑜?湲곕줉?섏꽭??'
          }
          targetType="Referral"
          targetId={actionState.referral.id}
          confirmText={
            actionState.type === 'deactivate'
              ? '鍮꾪솢?깊솕 ?ㅽ뻾'
              : actionState.type === 'activate'
                ? '?ы솢?깊솕 ?ㅽ뻾'
                : '寃??완료'
          }
          onCancel={closeAction}
          onConfirm={handleConfirmAction}
        />
      ) : null}

      <Modal
        open={Boolean(adjustmentTarget)}
        title="蹂댁긽 ?섎룞 議곗젙"
        okText="議곗젙 대상
        cancelText="취소"
        onCancel={closeAdjustmentModal}
        onOk={handleSubmitAdjustment}
      destroyOnHidden
      >
        <Form form={adjustmentForm} layout="vertical">
          <Text type="secondary">
            대상?좏삎: 異붿쿇??/ 대상ID: {adjustmentTarget?.id ?? '-'}
          </Text>
          <Form.Item
            label="議곗젙 湲덉븸"
            name="amount"
            rules={[
              { required: true, message: '議곗젙 湲덉븸???낅젰?섏꽭??' },
              {
                validator: async (_, value: number | undefined) => {
                  if (!value) {
                    throw new Error('0???꾨땶 湲덉븸???낅젰?섏꽭??');
                  }
                }
              }
            ]}
            style={{ marginTop: 12 }}
            extra="?묒닔???섎룞 蹂댁젙, ?뚯닔???뚯닔濡?湲곕줉?⑸땲??"
          >
            <InputNumber
              style={{ width: '100%' }}
              step={1000}
              placeholder="?? 5000 ?먮뒗 -3000"
            />
          </Form.Item>
          <Form.Item
            label="사유/洹쇨굅"
            name="reason"
            rules={[{ required: true, message: '議곗젙 사유를 입력하세요.' }]}
            style={{ marginBottom: 0 }}
          >
            <Input.TextArea rows={4} placeholder="운영 ?먮떒 洹쇨굅瑜??낅젰?섏꽭??" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}


