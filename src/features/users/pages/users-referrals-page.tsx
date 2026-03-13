import {
  Alert,
  Button,
  Card,
  Col,
  Descriptions,
  Drawer,
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
import { Link, useNavigate, useSearchParams } from 'react-router-dom';

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
  ReferralStatus,
  ReferralStatusFilter,
  ReferralSummary
} from '../model/referrals-types';
import type { AsyncState } from '../../../shared/model/async-state';
import { AuditLogLink } from '../../../shared/ui/audit-log-link/audit-log-link';
import { ConfirmAction } from '../../../shared/ui/confirm-action/confirm-action';
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
import {
  createDrawerTableScroll,
  DRAWER_SECTION_GAP,
  DRAWER_TABLE_PAGINATION,
  fixDrawerTableFirstColumn
} from '../../../shared/ui/table/drawer-table';
import { createStatusColumnTitle } from '../../../shared/ui/table/status-column-title';
import {
  createColumnFilterProps,
  createNumberSorter,
  createTextSorter
} from '../../../shared/ui/table/table-column-utils';
import { TableActionMenu } from '../../../shared/ui/table/table-action-menu';

const { Paragraph, Text, Title } = Typography;

const pageSizeOptions = ['20', '50', '100'];

const searchFieldOptions: { label: string; value: ReferralSearchField }[] = [
  { label: '전체', value: 'all' },
  { label: '추천 코드', value: 'code' },
  { label: '추천인 ID', value: 'referrerId' },
  { label: '추천인 이름', value: 'referrerName' }
];

const statusFilterOptions: { label: string; value: ReferralStatusFilter }[] = [
  { label: '전체 상태', value: 'all' },
  { label: '활성', value: '활성' },
  { label: '비활성', value: '비활성' }
];

const anomalyFilterOptions: {
  label: string;
  value: ReferralAnomalyFilter;
}[] = [
  { label: '전체 이상치', value: 'all' },
  { label: '없음', value: '없음' },
  { label: '검토 필요', value: '검토 필요' },
  { label: '검토 완료', value: '검토 완료' }
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
  if (value === '활성' || value === '비활성') {
    return value;
  }
  return defaultReferralQuery.status;
}

function parseAnomalyFilter(value: string | null): ReferralAnomalyFilter {
  if (value === '없음' || value === '검토 필요' || value === '검토 완료') {
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
    { key: 'id', label: '추천 코드 ID', children: referral.id },
    { key: 'code', label: '추천 코드', children: referral.code },
    {
      key: 'referrer',
      label: '추천인 회원',
      children: (
        <Link to={`/users/${referral.referrerUserId}?tab=profile`}>
          {referral.referrerName} ({referral.referrerUserId})
        </Link>
      )
    },
    { key: 'email', label: '추천인 이메일', children: referral.referrerEmail },
    {
      key: 'status',
      label: '코드 상태',
      children: <StatusBadge status={referral.status} />
    },
    { key: 'createdAt', label: '생성일', children: referral.createdAt },
    { key: 'expiresAt', label: '만료일', children: referral.expiresAt },
    { key: 'lastUsedAt', label: '최근 사용일', children: referral.lastUsedAt },
    {
      key: 'lastActionAt',
      label: '최근 조치일',
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

function renderAnomalyTag(
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

function getAdjustmentEntryType(amount: number): ReferralRewardLedgerEntry['entryType'] {
  return amount >= 0 ? '수동 보정' : '회수';
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
  }, [reloadKey]);

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
        (item) => item.anomalyStatus === '검토 필요'
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
        deactivate: '추천 코드 비활성화',
        activate: '추천 코드 재활성화',
        'review-anomaly': '이상치 검토 완료 처리'
      } as const;

      setReferralsState((prev) => {
        const nextData = prev.data.map((item) => {
          if (item.id !== actionState.referral.id) {
            return item;
          }

          if (actionState.type === 'review-anomaly') {
            return {
              ...item,
              anomalyStatus: '검토 완료',
              lastActionAt: formatCurrentDateTime(),
              adminMemo: `${item.adminMemo}\n- ${formatCurrentDateTime()} 이상치 검토 완료: ${reason}`
            };
          }

          return {
            ...item,
            status: actionState.type === 'deactivate' ? '비활성' : '활성',
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
            <Text>대상 유형: 추천인</Text>
            <Text>대상 ID: {actionState.referral.id}</Text>
            <Text>사유/근거: {reason}</Text>
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
      rewardMethodLabel: '정책 미확정',
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
      message: '보상 수동 조정 완료',
      description: (
        <Space direction="vertical">
          <Text>대상 유형: 추천인</Text>
          <Text>대상 ID: {adjustmentTarget.id}</Text>
          <Text>조정 ID: {adjustmentId}</Text>
          <Text>조정 금액: {formatRewardAmount(values.amount)}</Text>
          <Text>사유/근거: {values.reason.trim()}</Text>
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
        title: '추천 코드',
        dataIndex: 'code',
        width: 150,
        ...createColumnFilterProps(visibleReferrals, (record) => record.code),
        sorter: createTextSorter((record) => record.code)
      },
      {
        title: '추천인 회원',
        dataIndex: 'referrerName',
        width: 180,
        ...createColumnFilterProps(
          visibleReferrals,
          (record) => `${record.referrerName} ${record.referrerUserId}`
        ),
        sorter: createTextSorter((record) => record.referrerName),
        render: (_, record) => (
          <Link
            className="table-navigation-link"
            to={`/users/${record.referrerUserId}?tab=profile`}
            onClick={(event) => event.stopPropagation()}
          >
            {record.referrerName}
          </Link>
        )
      },
      {
        title: '피추천인 수',
        dataIndex: 'referredCount',
        width: 120,
        ...createColumnFilterProps(
          visibleReferrals,
          (record) => record.referredCount
        ),
        sorter: createNumberSorter((record) => record.referredCount),
        render: (value: number) => `${value.toLocaleString()}명`
      },
      {
        title: '추천 확정 수',
        dataIndex: 'confirmedCount',
        width: 120,
        ...createColumnFilterProps(
          visibleReferrals,
          (record) => record.confirmedCount
        ),
        sorter: createNumberSorter((record) => record.confirmedCount),
        render: (value: number) => `${value.toLocaleString()}건`
      },
      {
        title: '누적 보상',
        dataIndex: 'totalRewardAmount',
        width: 140,
        ...createColumnFilterProps(
          visibleReferrals,
          (record) => record.totalRewardAmount
        ),
        sorter: createNumberSorter((record) => record.totalRewardAmount),
        render: (value: number) => formatRewardAmount(value)
      },
      {
        title: '최근 사용일',
        dataIndex: 'lastUsedAt',
        width: 160,
        ...createColumnFilterProps(
          visibleReferrals,
          (record) => record.lastUsedAt
        ),
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
        filteredValue: query.status === 'all' ? null : [query.status],
        sorter: createTextSorter((record) => record.status),
        render: (status: ReferralStatus) => <StatusBadge status={status} />
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
          query.anomalyStatus === 'all' ? null : [query.anomalyStatus],
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
                onClick: () => openPointsPage(record.referrerUserId)
              },
              {
                key: `adjust-${record.id}`,
                label: '보상 수동 조정',
                onClick: () => handleOpenAdjustment(record)
              },
              {
                key: `review-${record.id}`,
                label: '이상치 검토 완료',
                disabled: record.anomalyStatus !== '검토 필요',
                onClick: () => handleReviewAnomaly(record)
              },
              record.status === '활성'
                ? {
                    key: `deactivate-${record.id}`,
                    label: '코드 비활성화',
                    danger: true,
                    onClick: () => handleDeactivate(record)
                  }
                : {
                    key: `activate-${record.id}`,
                    label: '코드 재활성화',
                    onClick: () => handleActivate(record)
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
      visibleReferrals
    ]
  );

  const relationColumns = useMemo<TableColumnsType<ReferralRelation>>(
    () =>
      fixDrawerTableFirstColumn([
      {
        title: '피추천인',
        dataIndex: 'referredUserName',
        width: 120,
        render: (_, relation) => (
          <Link
            className="table-navigation-link"
            to={`/users/${relation.referredUserId}?tab=profile`}
          >
            {relation.referredUserName}
          </Link>
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
              selectedReferralRewardGroups.relationEntryMap.get(relation.id) ?? []
            )
          )
      }
      ]),
    [selectedReferralRewardGroups.relationEntryMap]
  );

  const rewardLedgerColumns = useMemo<TableColumnsType<ReferralRewardLedgerEntry>>(
    () =>
      fixDrawerTableFirstColumn([
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
      ]),
    []
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
    if (selectedReferral.anomalyStatus === '검토 필요') {
      return {
        type: 'warning' as const,
        message: '이상치 검토가 필요한 추천 코드입니다.',
        description:
          '추천 관계와 보상 원장을 함께 확인한 뒤 검토 완료 또는 코드 상태 변경을 진행하세요.'
      };
    }
    if (selectedReferral.status === '비활성') {
      return {
        type: 'info' as const,
        message: '현재 비활성 상태의 추천 코드입니다.',
        description:
          '사용자 화면에서는 코드 입력이 차단될 가능성이 있으므로 만료/비활성 안내 문구 설계와 함께 확인해야 합니다.'
      };
    }
    return {
      type: 'info' as const,
      message: '추천 정책 일부가 아직 미확정입니다.',
      description:
        '추천 확정 시점, 보상 수단, 수동 보정 권한, 회수 규칙은 가정값 기준으로 표시됩니다.'
    };
  }, [selectedReferral]);

  return (
    <div>
      {notificationContextHolder}
      <PageTitle title="추천인 관리" />

      <Paragraph type="secondary" style={{ marginBottom: 16 }}>
        추천 코드, 추천 관계, 보상 원장을 같은 운영 흐름에서 관리합니다. 사용자
        화면은 아직 구현되지 않았기 때문에, 이 화면의 상태값과 조치 이력은 향후
        가입 프로모션, 친구 초대, 보상 내역 UI의 기준 데이터로 사용됩니다.
      </Paragraph>

      <Alert
        type="warning"
        showIcon
        style={{ marginBottom: 16 }}
        message="미확정 정책 확인 필요"
        description={
          <Space direction="vertical" size={4}>
            <Text>추천 확정 시점: 가입 완료 / 첫 결제 / 첫 학습 완료 중 미확정</Text>
            <Text>보상 수단: 포인트 / 쿠폰 / 혼합 중 미확정</Text>
            <Text>수동 보정 권한과 회수 규칙: 별도 권한 분리 여부 및 취소 조건 미확정</Text>
          </Space>
        }
      />

      {referralsState.status === 'error' ? (
        <Alert
          type="error"
          showIcon
          style={{ marginBottom: 12 }}
          message="추천인 목록 조회에 실패했습니다."
          description={
            <Space direction="vertical" size={4}>
              <Text>
                {referralsState.errorMessage ?? '일시적인 오류가 발생했습니다.'}
              </Text>
              <Text type="secondary">
                오류 코드: {referralsState.errorCode ?? '-'}
              </Text>
              <Space>
                <Button onClick={handleRetryLoad}>재시도</Button>
                <Text type="secondary">마지막 성공 데이터는 유지됩니다.</Text>
              </Space>
            </Space>
          }
        />
      ) : null}

      <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
        <Col xs={24} md={6}>
          <Card>
            <Title level={5} style={{ marginTop: 0, marginBottom: 8 }}>
              활성 코드 수
            </Title>
            <Text strong style={{ fontSize: 28 }}>
              {summary.activeCodeCount.toLocaleString()}건
            </Text>
          </Card>
        </Col>
        <Col xs={24} md={6}>
          <Card>
            <Title level={5} style={{ marginTop: 0, marginBottom: 8 }}>
              총 추천 수
            </Title>
            <Text strong style={{ fontSize: 28 }}>
              {summary.totalReferralCount.toLocaleString()}건
            </Text>
          </Card>
        </Col>
        <Col xs={24} md={6}>
          <Card>
            <Title level={5} style={{ marginTop: 0, marginBottom: 8 }}>
              보상 지급 건수
            </Title>
            <Text strong style={{ fontSize: 28 }}>
              {summary.rewardPayoutCount.toLocaleString()}건
            </Text>
          </Card>
        </Col>
        <Col xs={24} md={6}>
          <Card>
            <Title level={5} style={{ marginTop: 0, marginBottom: 8 }}>
              검토 필요 건수
            </Title>
            <Text strong style={{ fontSize: 28 }}>
              {summary.reviewNeededCount.toLocaleString()}건
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
            keywordPlaceholder="추천 코드, 추천인 ID/이름 검색"
            detailTitle="상세 검색"
            detailContent={
              <SearchBarDetailField label="최근 사용일">
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
                총 {visibleReferrals.length.toLocaleString()}건
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
            message="조건에 맞는 추천 코드가 없습니다."
            description="검색어 또는 필터 조건을 조정한 뒤 다시 확인하세요."
          />
        ) : null}

        <AdminDataTable<ReferralSummary>
          rowKey="id"
          virtual
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
            showTotal: (total) => `총 ${total.toLocaleString()}건`
          }}
        />
      </AdminListCard>

      <Drawer
        open={Boolean(selectedReferral)}
        title={
          selectedReferral
            ? `추천 코드 상세 · ${selectedReferral.code}`
            : '추천 코드 상세'
        }
        width={720}
        onClose={closeDrawer}
        extra={
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
        footer={
          selectedReferral ? (
            <Space
              style={{ width: '100%', justifyContent: 'space-between' }}
              wrap
            >
              <AuditLogLink
                targetType="Referral"
                targetId={selectedReferral.id}
              />
              <Space wrap>
                <Button
                  onClick={() => openPointsPage(selectedReferral.referrerUserId)}
                >
                  포인트 관리 이동
                </Button>
                <Button onClick={() => handleOpenAdjustment(selectedReferral)}>
                  보상 조정
                </Button>
                {selectedReferral.anomalyStatus === '검토 필요' ? (
                  <Button onClick={() => handleReviewAnomaly(selectedReferral)}>
                    이상치 검토 완료
                  </Button>
                ) : null}
                {selectedReferral.status === '활성' ? (
                  <Button
                    danger
                    type="primary"
                    onClick={() => handleDeactivate(selectedReferral)}
                  >
                    코드 비활성화
                  </Button>
                ) : (
                  <Button
                    type="primary"
                    onClick={() => handleActivate(selectedReferral)}
                  >
                    코드 재활성화
                  </Button>
                )}
              </Space>
            </Space>
          ) : null
        }
      >
        {selectedReferral ? (
          <Space
            direction="vertical"
            size={DRAWER_SECTION_GAP}
            style={{ width: '100%' }}
          >
            {drawerStatusAlert ? (
              <Alert
                type={drawerStatusAlert.type}
                showIcon
                message={drawerStatusAlert.message}
                description={drawerStatusAlert.description}
              />
            ) : null}

            <div>
              <Title level={5} style={{ marginTop: 0 }}>
                기본 정보
              </Title>
              <Descriptions
                bordered
                size="small"
                column={1}
                items={buildBasicInfoItems(selectedReferral)}
              />
            </div>

            <div>
              <Title level={5} style={{ marginTop: 0, marginBottom: 8 }}>
                추천 관계 및 보상
              </Title>
              <AdminDataTable
                rowKey={(relation) => relation.id}
                columns={relationColumns}
                dataSource={selectedReferral.relations}
                pagination={DRAWER_TABLE_PAGINATION}
                scroll={createDrawerTableScroll(960)}
                locale={{ emptyText: '추천 관계가 없습니다.' }}
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
                        pagination={DRAWER_TABLE_PAGINATION}
                        scroll={createDrawerTableScroll(720)}
                        locale={{ emptyText: '이 관계에 연결된 원장 이력이 없습니다.' }}
                      />
                    );
                  }
                }}
              />
              {selectedReferralRewardGroups.codeLevelEntries.length > 0 ? (
                <div style={{ marginTop: 16 }}>
                  <Title level={5} style={{ marginTop: 0, marginBottom: 8 }}>
                    코드 단위 조정
                  </Title>
                  <AdminDataTable
                    rowKey={(entry) => entry.id}
                    columns={rewardLedgerColumns}
                    dataSource={selectedReferralRewardGroups.codeLevelEntries}
                    pagination={DRAWER_TABLE_PAGINATION}
                    scroll={createDrawerTableScroll(720)}
                    locale={{ emptyText: '코드 단위 조정이 없습니다.' }}
                  />
                </div>
              ) : null}
            </div>

            <div>
              <Title level={5} style={{ marginTop: 0 }}>
                정책 스냅샷
              </Title>
              <Descriptions
                bordered
                size="small"
                column={1}
                items={buildPolicyItems(selectedReferral)}
              />
              <Paragraph type="secondary" style={{ marginTop: 8, marginBottom: 0 }}>
                {selectedReferral.policySnapshot.note}
              </Paragraph>
            </div>

            <div>
              <Title level={5} style={{ marginTop: 0, marginBottom: 8 }}>
                이상치 및 운영 메모
              </Title>
              <Space wrap style={{ marginBottom: 8 }}>
                {selectedReferral.anomalyFlags.length > 0 ? (
                  selectedReferral.anomalyFlags.map((flag) => (
                    <Tag color="volcano" key={flag}>
                      {flag}
                    </Tag>
                  ))
                ) : (
                  <Tag>이상치 플래그 없음</Tag>
                )}
              </Space>
              <Paragraph style={{ marginBottom: 0 }}>
                {selectedReferral.adminMemo}
              </Paragraph>
            </div>
          </Space>
        ) : null}
      </Drawer>

      {actionState ? (
        <ConfirmAction
          open
          title={
            actionState.type === 'deactivate'
              ? '추천 코드 비활성화'
              : actionState.type === 'activate'
                ? '추천 코드 재활성화'
                : '이상치 검토 완료 처리'
          }
          description={
            actionState.type === 'deactivate'
              ? '추천 코드 사용을 중단합니다. 사용자 화면 입력 차단과 운영 사유를 함께 기록하세요.'
              : actionState.type === 'activate'
                ? '추천 코드 사용을 다시 허용합니다. 재활성화 사유와 근거를 기록하세요.'
                : '추천 관계와 보상 원장을 검토 완료 상태로 전환합니다. 검토 사유와 판단 근거를 기록하세요.'
          }
          targetType="Referral"
          targetId={actionState.referral.id}
          confirmText={
            actionState.type === 'deactivate'
              ? '비활성화 실행'
              : actionState.type === 'activate'
                ? '재활성화 실행'
                : '검토 완료'
          }
          onCancel={closeAction}
          onConfirm={handleConfirmAction}
        />
      ) : null}

      <Modal
        open={Boolean(adjustmentTarget)}
        title="보상 수동 조정"
        okText="조정 저장"
        cancelText="취소"
        onCancel={closeAdjustmentModal}
        onOk={handleSubmitAdjustment}
        destroyOnClose
      >
        <Form form={adjustmentForm} layout="vertical">
          <Text type="secondary">
            대상 유형: 추천인 / 대상 ID: {adjustmentTarget?.id ?? '-'}
          </Text>
          <Form.Item
            label="조정 금액"
            name="amount"
            rules={[
              { required: true, message: '조정 금액을 입력하세요.' },
              {
                validator: async (_, value: number | undefined) => {
                  if (!value) {
                    throw new Error('0이 아닌 금액을 입력하세요.');
                  }
                }
              }
            ]}
            style={{ marginTop: 12 }}
            extra="양수는 수동 보정, 음수는 회수로 기록됩니다."
          >
            <InputNumber
              style={{ width: '100%' }}
              step={1000}
              placeholder="예: 5000 또는 -3000"
            />
          </Form.Item>
          <Form.Item
            label="사유/근거"
            name="reason"
            rules={[{ required: true, message: '조정 사유를 입력하세요.' }]}
            style={{ marginBottom: 0 }}
          >
            <Input.TextArea rows={4} placeholder="운영 판단 근거를 입력하세요." />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
