import { Alert, Button, Form, Space, Tabs, Typography, notification } from 'antd';
import type { TableColumnsType, TableProps, TabsProps } from 'antd';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';

import {
  fetchPointExpirationsPageSafe,
  fetchPointLedgersPageSafe,
  fetchPointPoliciesPageSafe,
  fetchHoldableExpirationsSafe,
  fetchPointRecordByIdSafe,
  fetchPointsOverviewSafe
} from '../api/points-service';
import {
  buildPointsSummaryCards,
  createManualAdjustmentDefaults,
  createPolicyFormDefaults,
  getDangerCopy,
  getFirstTableFilterValue,
  getPointsEmptyMessage,
  getSorterField,
  pageSizeOptions,
  parseExpirationSortField,
  parseLedgerSortField,
  parsePolicySortField
} from '../model/commerce-points-page-schema';
import type {
  DangerState,
  ExpirationHoldFormValues,
  ManualAdjustmentFormValues,
  PolicyFormValues,
  PolicyModalState
} from '../model/commerce-points-page-schema';
import {
  buildCommercePointsSearchParams,
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
import type { PointsActionContext } from '../ui/commerce-points-actions';
import {
  runDangerConfirm,
  runExpirationHoldSubmit,
  runExportExpirations,
  runManualAdjustmentSubmit,
  runPolicySubmit
} from '../ui/commerce-points-actions';
import {
  createExpirationColumns,
  createLedgerColumns,
  createPolicyColumns
} from '../ui/commerce-points-columns';
import { CommercePointsDetailDrawer } from '../ui/commerce-points-detail-drawer';
import {
  PointExpirationHoldModal,
  PointManualAdjustmentModal,
  PointPolicyModal
} from '../ui/commerce-points-modals';
import { CommercePointsSearchToolbar } from '../ui/commerce-points-toolbar';
import { useAsyncResource } from '@/shared/model/use-async-resource';
import {
  createEmptyPointsOverview,
  createEmptyPointsPageSlice
} from '../model/point-page-contract';
import type { PointsOverview, PointsPageSlice } from '../model/point-page-contract';
import { ConfirmAction } from '@/shared/ui/confirm-action/confirm-action';
import { AdminListCard } from '@/shared/ui/list-page-card/admin-list-card';
import {
  isInitialSummaryLoad,
  ListSummaryCards
} from '@/shared/ui/list-summary-cards/list-summary-cards';
import { PageTitle } from '@/shared/ui/page-title/page-title';
import { AdminDataTable } from '@/shared/ui/table/admin-data-table';
import { parseSortOrder } from '@/shared/ui/table/table-column-utils';
import { SPACE } from '@/shared/styles/design-tokens';

const { Paragraph, Text } = Typography;


export default function CommercePointsPage(): JSX.Element {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const query = usePointQueryStore((state) => state.query);
  const replaceQuery = usePointQueryStore((state) => state.replaceQuery);
  /**
   * 전량 스냅샷 하나 → **개요 + 활성 탭 페이지** 두 조회로 나눈다(gap-register §3.18).
   *
   * 개요는 쿼리와 무관한 건수(탭 라벨·요약 카드)이고, 페이지는 활성 탭의 현재 페이지 행 +
   * 필터 적용 후 전체 건수다. 활성 탭만 조회하므로 탭을 옮길 때 그 탭만 받는다.
   */
  const fetchOverview = useCallback(
    (signal: AbortSignal) => fetchPointsOverviewSafe(signal),
    []
  );
  const {
    state: overviewState,
    reload: reloadOverview
  } = useAsyncResource<PointsOverview>(fetchOverview, {
    initialData: createEmptyPointsOverview(),
    isEmpty: (overview) =>
      overview.tabCounts.policy === 0
      && overview.tabCounts.ledger === 0
      && overview.tabCounts.expiration === 0
  });
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
  useEffect(() => {
    replaceQuery(parseCommercePointsQuery(searchParams));
  }, [replaceQuery, searchParams]);

  /**
   * 활성 탭의 페이지만 조회한다. `enabled` 로 비활성 탭은 아예 요청하지 않는다.
   *
   * 🚨 fetcher 의 deps 에 **그 탭의 쿼리 전체**가 들어가야 한다 — 필터·정렬·페이지가 모두
   * 서버 조건이 됐으므로 하나라도 빠지면 화면이 낡은 페이지를 보여준다.
   */
  const fetchPolicyPage = useCallback(
    (signal: AbortSignal) => fetchPointPoliciesPageSafe(query.policy, signal),
    [query.policy]
  );
  const { state: policyPageState, reload: reloadPolicyPage } = useAsyncResource<
    PointsPageSlice<PointPolicy>
  >(fetchPolicyPage, {
    initialData: createEmptyPointsPageSlice<PointPolicy>(),
    enabled: query.tab === 'policy',
    isEmpty: (slice) => slice.total === 0
  });

  const fetchLedgerPage = useCallback(
    (signal: AbortSignal) => fetchPointLedgersPageSafe(query.ledger, signal),
    [query.ledger]
  );
  const { state: ledgerPageState, reload: reloadLedgerPage } = useAsyncResource<
    PointsPageSlice<PointLedger>
  >(fetchLedgerPage, {
    initialData: createEmptyPointsPageSlice<PointLedger>(),
    enabled: query.tab === 'ledger',
    isEmpty: (slice) => slice.total === 0
  });

  const fetchExpirationPage = useCallback(
    (signal: AbortSignal) => fetchPointExpirationsPageSafe(query.expiration, signal),
    [query.expiration]
  );
  const { state: expirationPageState, reload: reloadExpirationPage } = useAsyncResource<
    PointsPageSlice<PointExpiration>
  >(fetchExpirationPage, {
    initialData: createEmptyPointsPageSlice<PointExpiration>(),
    enabled: query.tab === 'expiration',
    isEmpty: (slice) => slice.total === 0
  });

  /** 활성 탭의 조회 상태(로딩·에러 표시와 건수의 단일 출처). */
  const activePageState =
    query.tab === 'policy'
      ? policyPageState
      : query.tab === 'ledger'
        ? ledgerPageState
        : expirationPageState;

  /**
   * 보류 모달의 선택 후보. 모달이 열릴 때만 조회한다(`enabled`) — 목록과 독립적인 집합이다.
   */
  const fetchHoldable = useCallback(
    (signal: AbortSignal) => fetchHoldableExpirationsSafe(signal),
    []
  );
  const { state: holdableState } = useAsyncResource<PointExpiration[]>(fetchHoldable, {
    initialData: [],
    enabled: expirationHoldModalOpen
  });

  /** 조치 후에는 개요와 활성 탭 페이지를 함께 다시 받는다(건수와 행이 갈리면 안 된다). */
  const reloadActive = useCallback(() => {
    reloadOverview();
    if (query.tab === 'policy') {
      reloadPolicyPage();
      return;
    }
    if (query.tab === 'ledger') {
      reloadLedgerPage();
      return;
    }
    reloadExpirationPage();
  }, [
    query.tab,
    reloadExpirationPage,
    reloadLedgerPage,
    reloadOverview,
    reloadPolicyPage
  ]);

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

  // 필터·정렬·페이징은 전부 서버가 한다 — 화면은 받은 행을 그리기만 한다.
  const visiblePolicies = policyPageState.data.rows;
  const visibleLedgers = ledgerPageState.data.rows;
  const visibleExpirations = expirationPageState.data.rows;

  /**
   * 상세 대상 복원.
   *
   * 🚨 서버 페이징에서는 `selected` 가 **다른 페이지의 id** 일 수 있다. 이전 배선은 목록에서
   * 못 찾으면 URL 의 `selected` 를 지웠는데, 전량 조회에서는 "없는 id"만 그랬지만 페이징에서는
   * 정상 링크까지 지워진다. 현재 페이지에 없으면 **단건 조회로 가져온다**.
   */
  const pageRecord = useMemo(() => {
    if (!query.selectedId) {
      return null;
    }
    if (query.tab === 'policy') {
      return visiblePolicies.find((item) => item.id === query.selectedId) ?? null;
    }
    if (query.tab === 'ledger') {
      return visibleLedgers.find((item) => item.id === query.selectedId) ?? null;
    }
    return visibleExpirations.find((item) => item.id === query.selectedId) ?? null;
  }, [query.selectedId, query.tab, visibleExpirations, visibleLedgers, visiblePolicies]);

  /**
   * 단건 조회 상태.
   *
   * 🚨 `record !== null` 로 "조회가 끝났나"를 판정하면 **경합**이 난다 — 못 찾은 것과 아직
   * 안 끝난 것이 구별되지 않아서, 페이지 조회가 먼저 끝나는 순간 정리 effect 가 정상
   * `selected` 를 지운다(프리뷰 실측으로 잡았다). 그래서 대상 id 와 완료 여부를 함께 들고
   * 있는다 — `resolved` 이면서 `record === null` 일 때만 "없는 id" 다.
   */
  const [lookup, setLookup] = useState<{
    id: string;
    resolved: boolean;
    record: PointPolicy | PointLedger | PointExpiration | null;
  }>({ id: '', resolved: true, record: null });

  useEffect(() => {
    if (!query.selectedId || pageRecord) {
      setLookup({ id: '', resolved: true, record: null });
      return;
    }
    const targetId = query.selectedId;
    setLookup({ id: targetId, resolved: false, record: null });
    const controller = new AbortController();
    void fetchPointRecordByIdSafe(query.tab, targetId, controller.signal).then((result) => {
      if (controller.signal.aborted) {
        return;
      }
      setLookup({ id: targetId, resolved: true, record: result.ok ? result.data : null });
    });
    return () => controller.abort();
  }, [pageRecord, query.selectedId, query.tab]);

  const selectedRecord =
    pageRecord ?? (lookup.id === query.selectedId ? lookup.record : null);

  useEffect(() => {
    // 단건 조회가 **끝났고** 못 찾았을 때만 URL 을 정리한다.
    if (!query.selectedId || selectedRecord || activePageState.status === 'pending') {
      return;
    }
    if (lookup.id !== query.selectedId || !lookup.resolved) {
      return;
    }
    updateUrl({ ...query, selectedId: '' });
  }, [activePageState.status, lookup, query, selectedRecord, updateUrl]);

  /** 필터 적용 후 전체 건수 — 툴바 `총 N건`·페이지네이션·내보내기 건수의 단일 출처. */
  const activeCount = activePageState.data.total;

  const hasCachedData = activePageState.data.rows.length > 0;

  const summaryCards = useMemo(
    () =>
      buildPointsSummaryCards(
        overviewState.data,
        query,
        commitPolicyQuery,
        commitLedgerQuery,
        commitExpirationQuery
      ),
    [
      commitExpirationQuery,
      commitLedgerQuery,
      commitPolicyQuery,
      overviewState.data,
      query
    ]
  );

  const tabItems = useMemo<NonNullable<TabsProps['items']>>(
    () => [
      {
        key: 'policy',
        label: `정책 ${overviewState.data.tabCounts.policy}`
      },
      {
        key: 'ledger',
        label: `포인트 원장 ${overviewState.data.tabCounts.ledger}`
      },
      {
        key: 'expiration',
        label: `소멸 예정 ${overviewState.data.tabCounts.expiration}`
      }
    ],
    [
      overviewState.data.tabCounts.expiration,
      overviewState.data.tabCounts.ledger,
      overviewState.data.tabCounts.policy
    ]
  );

  const handleReload = useCallback(() => {
    reloadActive();
  }, [reloadActive]);

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

  const actionContext = useMemo<PointsActionContext>(
    () => ({
      notificationApi,
      query,
      updateUrl,
      showActionError,
      reloadActive,
      setPolicyModalState,
      setAdjustmentModalOpen,
      setAdjustmentTarget,
      setExpirationHoldModalOpen,
      setExpirationHoldTarget,
      setDangerState
    }),
    [notificationApi, query, reloadActive, showActionError, updateUrl]
  );

  const handlePolicySubmit = useCallback(
    async () => runPolicySubmit(actionContext, policyForm, policyModalState),
    [actionContext, policyForm, policyModalState]
  );

  const handleManualAdjustmentSubmit = useCallback(
    async () => runManualAdjustmentSubmit(actionContext, adjustmentForm),
    [actionContext, adjustmentForm]
  );

  const handleExpirationHoldSubmit = useCallback(
    async () => runExpirationHoldSubmit(actionContext, expirationHoldForm),
    [actionContext, expirationHoldForm]
  );

  const handleDangerConfirm = useCallback(
    async (reason: string) => runDangerConfirm(actionContext, dangerState, reason),
    [actionContext, dangerState]
  );

  /**
   * 🚨 내보내기 건수는 **서버가 센 필터 적용 후 전체 건수**여야 한다. 현재 페이지 길이를
   * 넘기면 "20건 내보냈다"처럼 실제와 다른 수치를 알린다(파일을 만들지 않고 건수만 알리는
   * 기능이라 그 수치가 유일한 산출물이다).
   */
  const handleExportExpirations = useCallback(
    async () => runExportExpirations(actionContext, expirationPageState.data.total),
    [actionContext, expirationPageState.data.total]
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

  const policyColumns = useMemo<TableColumnsType<PointPolicy>>(
    () => createPolicyColumns({ query, openEditPolicyModal, setDangerState }),
    [openEditPolicyModal, query]
  );

  const ledgerColumns = useMemo<TableColumnsType<PointLedger>>(
    () => createLedgerColumns({ query, openManualAdjustmentModal, navigate }),
    [navigate, openManualAdjustmentModal, query]
  );

  const expirationColumns = useMemo<TableColumnsType<PointExpiration>>(
    () =>
      createExpirationColumns({
        query,
        openExpirationHoldModal,
        setDangerState,
        navigate
      }),
    [navigate, openExpirationHoldModal, query]
  );

  const emptyMessage = getPointsEmptyMessage(query.tab);

  const currentTable =
    query.tab === 'policy' ? (
      <AdminDataTable<PointPolicy>
        rowKey="id"
        columns={policyColumns}
        dataSource={visiblePolicies}
        loading={activePageState.status === 'pending' && !hasCachedData}
        scroll={{ x: 1320, y: 560 }}
        onChange={handlePolicyTableChange}
        pagination={{
          current: query.policy.page,
          pageSize: query.policy.pageSize,
          pageSizeOptions,
          showSizeChanger: true,
          total: policyPageState.data.total,
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
        loading={activePageState.status === 'pending' && !hasCachedData}
        scroll={{ x: 1460, y: 560 }}
        onChange={handleLedgerTableChange}
        pagination={{
          current: query.ledger.page,
          pageSize: query.ledger.pageSize,
          pageSizeOptions,
          showSizeChanger: true,
          total: ledgerPageState.data.total,
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
        loading={activePageState.status === 'pending' && !hasCachedData}
        scroll={{ x: 1340, y: 560 }}
        onChange={handleExpirationTableChange}
        pagination={{
          current: query.expiration.page,
          pageSize: query.expiration.pageSize,
          pageSizeOptions,
          showSizeChanger: true,
          total: expirationPageState.data.total,
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

      <Paragraph type="secondary" style={{ marginBottom: SPACE.base }}>
        현재 화면은 포인트 정책, 포인트 원장, 소멸 예정 건을 한 곳에서 운영하기 위한
        기준 화면입니다. 포인트 발생 원천, 차감 우선순위, 소멸 예외 정책은 아직
        확정 중이므로 이 페이지와 IA 문서는 운영/정책 합의에 맞춰 계속 갱신하는
        living 문서로 관리합니다.
      </Paragraph>

      <Alert
        type="warning"
        showIcon
        style={{ marginBottom: SPACE.base }}
        message="운영 정책 미확정 항목이 남아 있습니다."
        description={
          <Space direction="vertical" size={4}>
            <Text>포인트 발생 원천 분류와 코드 테이블은 1차 초안만 반영된 상태입니다.</Text>
            <Text>결제 포인트 차감 우선순위와 환불 복구 기준은 아직 최종 확정되지 않았습니다.</Text>
            <Text>소멸 사전 안내 시점과 보류 승인 체계는 운영 정책 협의 후 계속 업데이트됩니다.</Text>
          </Space>
        }
      />

      {activePageState.status === 'error' || overviewState.status === 'error' ? (
        <Alert
          type="error"
          showIcon
          style={{ marginBottom: SPACE.sm }}
          message="포인트 관리 데이터를 불러오지 못했습니다."
          description={
            <Space direction="vertical" size={4}>
              <Text>
                {activePageState.errorMessage
                  ?? overviewState.errorMessage
                  ?? '일시적인 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.'}
              </Text>
              {activePageState.errorCode ?? overviewState.errorCode ? (
                <Text type="secondary">
                  오류 코드: {activePageState.errorCode ?? overviewState.errorCode}
                </Text>
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

      <ListSummaryCards
        items={summaryCards}
        loading={isInitialSummaryLoad(
          overviewState.status,
          overviewState.data.tabCounts.policy > 0
            || overviewState.data.tabCounts.ledger > 0
            || overviewState.data.tabCounts.expiration > 0
        )}
      />

      <AdminListCard
        toolbar={
          <div className="admin-list-card-toolbar-stack">
            <Tabs
              activeKey={query.tab}
              items={tabItems}
              onChange={(nextTab) => commitTab(nextTab as PointsTab)}
              className="admin-list-card-toolbar-tabs"
            />
            <CommercePointsSearchToolbar
              query={query}
              activeCount={activeCount}
              commitPolicyQuery={commitPolicyQuery}
              commitLedgerQuery={commitLedgerQuery}
              commitExpirationQuery={commitExpirationQuery}
              openCreatePolicyModal={openCreatePolicyModal}
              openManualAdjustmentModal={openManualAdjustmentModal}
              openExpirationHoldModal={openExpirationHoldModal}
              handleExportExpirations={handleExportExpirations}
            />
          </div>
        }
      >
        {activePageState.status !== 'pending' && activeCount === 0 ? (
          <Alert
            type="info"
            showIcon
            style={{ marginBottom: SPACE.sm }}
            message={emptyMessage.message}
            description={emptyMessage.description}
          />
        ) : null}

        {currentTable}
      </AdminListCard>

      <CommercePointsDetailDrawer
        selectedPolicy={query.tab === 'policy' ? (selectedRecord as PointPolicy | null) : null}
        selectedLedger={query.tab === 'ledger' ? (selectedRecord as PointLedger | null) : null}
        selectedExpiration={
          query.tab === 'expiration' ? (selectedRecord as PointExpiration | null) : null
        }
        closeDetail={closeDetail}
        openEditPolicyModal={openEditPolicyModal}
        openManualAdjustmentModal={openManualAdjustmentModal}
        openExpirationHoldModal={openExpirationHoldModal}
        setDangerState={setDangerState}
        navigate={navigate}
      />

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

      <PointPolicyModal
        policyModalState={policyModalState}
        policyForm={policyForm}
        closePolicyModal={closePolicyModal}
        handlePolicySubmit={handlePolicySubmit}
      />

      <PointManualAdjustmentModal
        adjustmentModalOpen={adjustmentModalOpen}
        adjustmentTarget={adjustmentTarget}
        adjustmentForm={adjustmentForm}
        closeManualAdjustmentModal={closeManualAdjustmentModal}
        handleManualAdjustmentSubmit={handleManualAdjustmentSubmit}
      />

      <PointExpirationHoldModal
        expirationHoldModalOpen={expirationHoldModalOpen}
        expirationHoldTarget={expirationHoldTarget}
        expirationHoldForm={expirationHoldForm}
        closeExpirationHoldModal={closeExpirationHoldModal}
        handleExpirationHoldSubmit={handleExpirationHoldSubmit}
        expirations={holdableState.data}
      />
    </div>
  );
}
