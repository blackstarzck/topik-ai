import { Alert, Button, Form, Space, Tabs, Typography, notification } from 'antd';
import type { TableColumnsType, TableProps, TabsProps } from 'antd';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';

import { fetchPointsSnapshotSafe } from '../api/points-service';
import {
  buildPointsSummaryCards,
  createEmptySnapshot,
  createManualAdjustmentDefaults,
  createPolicyFormDefaults,
  filterExpirations,
  filterLedgers,
  filterPolicies,
  getDangerCopy,
  getFirstTableFilterValue,
  getPointsEmptyMessage,
  getSorterField,
  pageSizeOptions,
  paginateItems,
  parseExpirationSortField,
  parseLedgerSortField,
  parsePolicySortField,
  sortExpirations,
  sortLedgers,
  sortPolicies
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
import type { AsyncState } from '@/shared/model/async-state';
import { ConfirmAction } from '@/shared/ui/confirm-action/confirm-action';
import { AdminListCard } from '@/shared/ui/list-page-card/admin-list-card';
import { ListSummaryCards } from '@/shared/ui/list-summary-cards/list-summary-cards';
import { PageTitle } from '@/shared/ui/page-title/page-title';
import { AdminDataTable } from '@/shared/ui/table/admin-data-table';
import { parseSortOrder } from '@/shared/ui/table/table-column-utils';

const { Paragraph, Text } = Typography;


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
  useEffect(() => {
    replaceQuery(parseCommercePointsQuery(searchParams));
  }, [replaceQuery, searchParams]);

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

  const summaryCards = useMemo(
    () =>
      buildPointsSummaryCards(
        pointsState.data,
        query,
        commitPolicyQuery,
        commitLedgerQuery,
        commitExpirationQuery
      ),
    [
      commitExpirationQuery,
      commitLedgerQuery,
      commitPolicyQuery,
      pointsState.data,
      query
    ]
  );

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

  const actionContext = useMemo<PointsActionContext>(
    () => ({
      notificationApi,
      query,
      updateUrl,
      showActionError,
      setReloadKey,
      setPolicyModalState,
      setAdjustmentModalOpen,
      setAdjustmentTarget,
      setExpirationHoldModalOpen,
      setExpirationHoldTarget,
      setDangerState
    }),
    [notificationApi, query, showActionError, updateUrl]
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

  const handleExportExpirations = useCallback(
    async () => runExportExpirations(actionContext, filteredExpirations.length),
    [actionContext, filteredExpirations.length]
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

      <CommercePointsDetailDrawer
        selectedPolicy={selectedPolicy}
        selectedLedger={selectedLedger}
        selectedExpiration={selectedExpiration}
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
        expirations={pointsState.data.expirations}
      />
    </div>
  );
}
