import {
  Form,
  Tabs,
  notification
} from 'antd';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';

import {
  fetchFaqCurationsSafe,
  fetchFaqMetricsSafe,
  fetchFaqsSafe,
} from '../api/faqs-service';
import {
  faqCategoryValues,
  faqCurationModeValues,
  faqCurationStatusValues,
  faqExposureSurfaceValues,
  faqStatusValues,
} from '../model/faq-schema';
import type {
  OperationFaq,
  OperationFaqCuration,
  OperationFaqMetric
} from '../model/types';
import {
  buildCurationFormValues,
  buildFaqFormValues,
  createInitialAsyncState,
  curationSearchFieldValues,
  curationSortFieldValues,
  masterSearchFieldValues,
  masterSortFieldValues,
  metricSearchFieldValues,
  metricSortFieldValues,
  parseTab,
  parseValue,
  tabItems,
  type CurationEditorState,
  type CurationFormValues,
  type DangerState,
  type FaqCurationRow,
  type FaqEditorState,
  type FaqFormValues,
  type FaqMetricRow,
  type FaqPageParamKey,
  type TabKey,
  filterVisibleCurations,
  filterVisibleFaqs,
  filterVisibleMetrics,
  buildFaqSummaryCards
} from '../model/operation-faq-page-schema';
import {
  createFaqCurationColumns,
  createFaqMasterColumns,
  createFaqMetricColumns
} from '../ui/operation-faq-columns';
import { CurationEditorModal, FaqEditorModal } from '../ui/operation-faq-modals';
import { CurationDetailDrawer, FaqDetailDrawer } from '../ui/operation-faq-drawers';
import {
  runFaqDangerAction,
  runSaveCuration,
  runSaveFaq,
  type FaqActionContext
} from '../ui/operation-faq-actions';
import {
  FaqCurationSection,
  FaqMasterSection,
  FaqMetricSection
} from '../ui/operation-faq-tab-sections';
import type { AsyncState } from '@/shared/model/async-state';
import { ConfirmAction } from '@/shared/ui/confirm-action/confirm-action';
import { AdminListCard } from '@/shared/ui/list-page-card/admin-list-card';
import { ListSummaryCards } from '@/shared/ui/list-summary-cards/list-summary-cards';
import { PageTitle } from '@/shared/ui/page-title/page-title';
import {
  parseSearchDate
} from '@/shared/ui/search-bar/search-bar-utils';
import { parseSortOrder } from '@/shared/ui/table/table-column-utils';


export default function OperationFaqPage(): JSX.Element {
  const [searchParams, setSearchParams] = useSearchParams();
  const activeTab = parseTab(searchParams.get('tab'));

  const masterSearchField =
    parseValue(searchParams.get('searchField'), masterSearchFieldValues) ?? 'all';
  const keyword = searchParams.get('keyword') ?? '';
  const startDate = parseSearchDate(searchParams.get('startDate'));
  const endDate = parseSearchDate(searchParams.get('endDate'));
  const faqStatusFilter = parseValue(searchParams.get('status'), faqStatusValues);
  const faqCategoryFilter = parseValue(
    searchParams.get('category'),
    faqCategoryValues
  );
  const masterSortField = parseValue(
    searchParams.get('sortField'),
    masterSortFieldValues
  );
  const masterSortOrder = parseSortOrder(searchParams.get('sortOrder'));
  const selectedFaqId = searchParams.get('selected') ?? '';

  const curationSearchField =
    parseValue(searchParams.get('curationSearchField'), curationSearchFieldValues) ??
    'all';
  const curationKeyword = searchParams.get('curationKeyword') ?? '';
  const curationSurfaceFilter = parseValue(
    searchParams.get('curationSurface'),
    faqExposureSurfaceValues
  );
  const curationModeFilter = parseValue(
    searchParams.get('curationMode'),
    faqCurationModeValues
  );
  const curationExposureStatusFilter = parseValue(
    searchParams.get('curationExposureStatus'),
    faqCurationStatusValues
  );
  const curationSortField = parseValue(
    searchParams.get('curationSortField'),
    curationSortFieldValues
  );
  const curationSortOrder = parseSortOrder(searchParams.get('curationSortOrder'));
  const selectedCurationId = searchParams.get('curationSelected') ?? '';

  const metricSearchField =
    parseValue(searchParams.get('metricSearchField'), metricSearchFieldValues) ?? 'all';
  const metricKeyword = searchParams.get('metricKeyword') ?? '';
  const metricSortField = parseValue(
    searchParams.get('metricSortField'),
    metricSortFieldValues
  );
  const metricSortOrder = parseSortOrder(searchParams.get('metricSortOrder'));

  const [faqsState, setFaqsState] = useState<AsyncState<OperationFaq[]>>(
    createInitialAsyncState([])
  );
  const [curationsState, setCurationsState] = useState<
    AsyncState<OperationFaqCuration[]>
  >(createInitialAsyncState([]));
  const [metricsState, setMetricsState] = useState<AsyncState<OperationFaqMetric[]>>(
    createInitialAsyncState([])
  );
  const [reloadKey, setReloadKey] = useState(0);
  const [faqEditorState, setFaqEditorState] = useState<FaqEditorState>(null);
  const [curationEditorState, setCurationEditorState] =
    useState<CurationEditorState>(null);
  const [dangerState, setDangerState] = useState<DangerState>(null);
  const [notificationApi, notificationContextHolder] = notification.useNotification();
  const [faqForm] = Form.useForm<FaqFormValues>();
  const [curationForm] = Form.useForm<CurationFormValues>();

  const syncSearchParams = useCallback(
    (next: Partial<Record<FaqPageParamKey, string | null>>) => {
      const merged = new URLSearchParams(searchParams);

      Object.entries(next).forEach(([key, value]) => {
        const shouldDelete =
          !value ||
          (key === 'tab' && value === 'master') ||
          ((key === 'searchField' ||
            key === 'curationSearchField' ||
            key === 'metricSearchField') &&
            value === 'all');

        if (shouldDelete) {
          merged.delete(key);
          return;
        }

        merged.set(key, value);
      });

      setSearchParams(merged, { replace: true });
    },
    [searchParams, setSearchParams]
  );

  const handleReload = useCallback(() => {
    setReloadKey((prev) => prev + 1);
  }, []);

  useEffect(() => {
    const controller = new AbortController();

    setFaqsState((prev) => ({
      ...prev,
      status: 'pending',
      errorMessage: null,
      errorCode: null
    }));

    void fetchFaqsSafe(controller.signal).then((result) => {
      if (controller.signal.aborted) {
        return;
      }

      if (result.ok) {
        setFaqsState({
          status: result.data.length === 0 ? 'empty' : 'success',
          data: result.data,
          errorMessage: null,
          errorCode: null
        });
        return;
      }

      setFaqsState((prev) => ({
        ...prev,
        status: 'error',
        errorMessage: result.error.message,
        errorCode: result.error.code
      }));
    });

    return () => controller.abort();
  }, [reloadKey]);

  useEffect(() => {
    const controller = new AbortController();

    setCurationsState((prev) => ({
      ...prev,
      status: 'pending',
      errorMessage: null,
      errorCode: null
    }));

    void fetchFaqCurationsSafe(controller.signal).then((result) => {
      if (controller.signal.aborted) {
        return;
      }

      if (result.ok) {
        setCurationsState({
          status: result.data.length === 0 ? 'empty' : 'success',
          data: result.data,
          errorMessage: null,
          errorCode: null
        });
        return;
      }

      setCurationsState((prev) => ({
        ...prev,
        status: 'error',
        errorMessage: result.error.message,
        errorCode: result.error.code
      }));
    });

    return () => controller.abort();
  }, [reloadKey]);

  useEffect(() => {
    const controller = new AbortController();

    setMetricsState((prev) => ({
      ...prev,
      status: 'pending',
      errorMessage: null,
      errorCode: null
    }));

    void fetchFaqMetricsSafe(controller.signal).then((result) => {
      if (controller.signal.aborted) {
        return;
      }

      if (result.ok) {
        setMetricsState({
          status: result.data.length === 0 ? 'empty' : 'success',
          data: result.data,
          errorMessage: null,
          errorCode: null
        });
        return;
      }

      setMetricsState((prev) => ({
        ...prev,
        status: 'error',
        errorMessage: result.error.message,
        errorCode: result.error.code
      }));
    });

    return () => controller.abort();
  }, [reloadKey]);

  const faqMap = useMemo(
    () => new Map(faqsState.data.map((faq) => [faq.id, faq])),
    [faqsState.data]
  );

  const curationRows = useMemo<FaqCurationRow[]>(
    () =>
      curationsState.data.map((curation) => ({
        ...curation,
        faq: faqMap.get(curation.faqId) ?? null
      })),
    [curationsState.data, faqMap]
  );

  const metricRows = useMemo<FaqMetricRow[]>(
    () =>
      metricsState.data.map((metric) => ({
        ...metric,
        faq: faqMap.get(metric.faqId) ?? null
      })),
    [faqMap, metricsState.data]
  );

  const selectedFaq = selectedFaqId ? faqMap.get(selectedFaqId) ?? null : null;
  const selectedFaqMetric = selectedFaq
    ? metricRows.find((metric) => metric.faqId === selectedFaq.id) ?? null
    : null;
  const selectedFaqCurations = selectedFaq
    ? curationRows.filter((curation) => curation.faqId === selectedFaq.id)
    : [];
  const selectedCuration = selectedCurationId
    ? curationRows.find((curation) => curation.id === selectedCurationId) ?? null
    : null;

  useEffect(() => {
    const canValidate =
      faqsState.status === 'success' ||
      faqsState.status === 'empty' ||
      (faqsState.status === 'error' && faqsState.data.length > 0);

    if (!selectedFaqId || !canValidate) {
      return;
    }

    if (!faqMap.has(selectedFaqId)) {
      syncSearchParams({ selected: null });
    }
  }, [faqMap, faqsState.data.length, faqsState.status, selectedFaqId, syncSearchParams]);

  useEffect(() => {
    const canValidate =
      curationsState.status === 'success' ||
      curationsState.status === 'empty' ||
      (curationsState.status === 'error' && curationsState.data.length > 0);

    if (!selectedCurationId || !canValidate) {
      return;
    }

    if (!curationRows.some((row) => row.id === selectedCurationId)) {
      syncSearchParams({ curationSelected: null });
    }
  }, [
    curationRows,
    curationsState.data.length,
    curationsState.status,
    selectedCurationId,
    syncSearchParams
  ]);

  const visibleFaqs = useMemo(
    () =>
      filterVisibleFaqs(faqsState.data, {
        faqStatusFilter,
        faqCategoryFilter,
        startDate,
        endDate,
        keyword,
        masterSearchField
      }),
    [
      faqCategoryFilter,
      faqStatusFilter,
      faqsState.data,
      keyword,
      masterSearchField,
      startDate,
      endDate
    ]
  );

  const visibleCurations = useMemo(
    () =>
      filterVisibleCurations(curationRows, {
        curationSurfaceFilter,
        curationModeFilter,
        curationExposureStatusFilter,
        curationKeyword,
        curationSearchField
      }),
    [
      curationExposureStatusFilter,
      curationKeyword,
      curationModeFilter,
      curationRows,
      curationSearchField,
      curationSurfaceFilter
    ]
  );

  const visibleMetrics = useMemo(
    () => filterVisibleMetrics(metricRows, { metricKeyword, metricSearchField }),
    [metricKeyword, metricRows, metricSearchField]
  );

  const totalFaqCount = faqsState.data.length;
  const publicFaqCount = faqsState.data.filter((faq) => faq.status === '공개').length;
  const activeCurationCount = curationsState.data.filter(
    (curation) => curation.exposureStatus === 'active'
  ).length;
  const totalViewCount = metricsState.data.reduce(
    (sum, metric) => sum + metric.viewCount,
    0
  );
  const faqSummaryCards = useMemo(
    () =>
      buildFaqSummaryCards({
        totalFaqCount,
        publicFaqCount,
        activeCurationCount,
        totalViewCount
      }),
    [activeCurationCount, publicFaqCount, totalFaqCount, totalViewCount]
  );

  useEffect(() => {
    if (faqEditorState?.type === 'edit') {
      faqForm.setFieldsValue(buildFaqFormValues(faqEditorState.faq));
      return;
    }

    if (faqEditorState?.type === 'create') {
      faqForm.setFieldsValue(buildFaqFormValues());
    }
  }, [faqEditorState, faqForm]);

  useEffect(() => {
    if (curationEditorState?.type === 'edit') {
      curationForm.setFieldsValue(
        buildCurationFormValues(curationEditorState.curation)
      );
      return;
    }

    if (curationEditorState?.type === 'create') {
      curationForm.setFieldsValue(
        buildCurationFormValues(undefined, curationEditorState.faqId)
      );
    }
  }, [curationEditorState, curationForm]);

  const openFaqCreateModal = useCallback(() => {
    faqForm.setFieldsValue(buildFaqFormValues());
    setFaqEditorState({ type: 'create' });
  }, [faqForm]);

  const openFaqEditModal = useCallback(
    (faq: OperationFaq) => {
      faqForm.setFieldsValue(buildFaqFormValues(faq));
      setFaqEditorState({ type: 'edit', faq });
    },
    [faqForm]
  );

  const openCurationCreateModal = useCallback(
    (faqId?: string) => {
      curationForm.setFieldsValue(buildCurationFormValues(undefined, faqId));
      setCurationEditorState({ type: 'create', faqId });
    },
    [curationForm]
  );

  const openCurationEditModal = useCallback(
    (curation: OperationFaqCuration) => {
      curationForm.setFieldsValue(buildCurationFormValues(curation));
      setCurationEditorState({ type: 'edit', curation });
    },
    [curationForm]
  );

  const closeFaqEditor = useCallback(() => {
    setFaqEditorState(null);
    faqForm.resetFields();
  }, [faqForm]);

  const closeCurationEditor = useCallback(() => {
    setCurationEditorState(null);
    curationForm.resetFields();
  }, [curationForm]);

  const closeFaqDrawer = useCallback(() => {
    syncSearchParams({ selected: null });
  }, [syncSearchParams]);

  const closeCurationDrawer = useCallback(() => {
    syncSearchParams({ curationSelected: null });
  }, [syncSearchParams]);

  const openFaqDrawer = useCallback(
    (faqId: string) => {
      syncSearchParams({
        selected: faqId,
        curationSelected: null
      });
    },
    [syncSearchParams]
  );

  const openCurationDrawer = useCallback(
    (curationId: string) => {
      syncSearchParams({
        curationSelected: curationId,
        selected: null
      });
    },
    [syncSearchParams]
  );

  const actionContext = useMemo<FaqActionContext>(
    () => ({
      notificationApi,
      syncSearchParams,
      reload: handleReload,
      closeFaqEditor,
      closeCurationEditor,
      closeFaqDrawer,
      closeCurationDrawer,
      setFaqsState,
      setCurationsState,
      setDangerState
    }),
    [
      closeCurationDrawer,
      closeCurationEditor,
      closeFaqDrawer,
      closeFaqEditor,
      handleReload,
      notificationApi,
      syncSearchParams
    ]
  );

  const handleSaveFaq = useCallback(
    () => runSaveFaq(actionContext, faqForm, faqEditorState),
    [actionContext, faqEditorState, faqForm]
  );

  const handleSaveCuration = useCallback(
    () => runSaveCuration(actionContext, curationForm, curationEditorState),
    [actionContext, curationEditorState, curationForm]
  );

  const handleDangerConfirm = useCallback(
    async (reason: string) => {
      if (!dangerState) {
        return;
      }
      await runFaqDangerAction(actionContext, dangerState, reason);
    },
    [actionContext, dangerState]
  );

  const faqColumns = useMemo(
    () =>
      createFaqMasterColumns({
        masterSortField,
        masterSortOrder,
        onOpenCurationCreate: openCurationCreateModal,
        onOpenFaqEdit: openFaqEditModal
      }),
    [masterSortField, masterSortOrder, openCurationCreateModal, openFaqEditModal]
  );

  const curationColumns = useMemo(
    () =>
      createFaqCurationColumns({
        curationSortField,
        curationSortOrder,
        onOpenCurationEdit: openCurationEditModal
      }),
    [curationSortField, curationSortOrder, openCurationEditModal]
  );

  const metricColumns = useMemo(
    () => createFaqMetricColumns({ metricSortField, metricSortOrder }),
    [metricSortField, metricSortOrder]
  );

  return (
    <div>
      {notificationContextHolder}
      <PageTitle title="자주 묻는 질문" />
      <ListSummaryCards items={faqSummaryCards} />

      <AdminListCard
        toolbar={
          <div className="admin-list-card-toolbar-stack">
            <Tabs
              activeKey={activeTab}
              items={tabItems}
              className="admin-list-card-toolbar-tabs"
              onChange={(value) => syncSearchParams({ tab: value as TabKey })}
            />

          </div>
        }
      >
        {activeTab === 'master' ? (
          <FaqMasterSection
            faqsState={faqsState}
            visibleFaqs={visibleFaqs}
            columns={faqColumns}
            masterSearchField={masterSearchField}
            keyword={keyword}
            faqCategoryFilter={faqCategoryFilter}
            faqStatusFilter={faqStatusFilter}
            startDate={startDate}
            endDate={endDate}
            onCommit={syncSearchParams}
            onReload={handleReload}
            onOpenFaqCreate={openFaqCreateModal}
            onOpenFaqDrawer={openFaqDrawer}
          />
        ) : null}

        {activeTab === 'curation' ? (
          <FaqCurationSection
            curationsState={curationsState}
            visibleCurations={visibleCurations}
            columns={curationColumns}
            curationSearchField={curationSearchField}
            curationKeyword={curationKeyword}
            curationSurfaceFilter={curationSurfaceFilter}
            curationModeFilter={curationModeFilter}
            curationExposureStatusFilter={curationExposureStatusFilter}
            onCommit={syncSearchParams}
            onReload={handleReload}
            onOpenCurationCreate={() => openCurationCreateModal()}
            onOpenCurationDrawer={openCurationDrawer}
          />
        ) : null}

        {activeTab === 'metrics' ? (
          <FaqMetricSection
            metricsState={metricsState}
            visibleMetrics={visibleMetrics}
            columns={metricColumns}
            metricSearchField={metricSearchField}
            metricKeyword={metricKeyword}
            onCommit={syncSearchParams}
            onReload={handleReload}
            onOpenFaqDrawer={openFaqDrawer}
          />
        ) : null}
      </AdminListCard>

      <FaqEditorModal
        editorState={faqEditorState}
        form={faqForm}
        onOk={handleSaveFaq}
        onCancel={closeFaqEditor}
      />

      <CurationEditorModal
        editorState={curationEditorState}
        faqs={faqsState.data}
        form={curationForm}
        onOk={handleSaveCuration}
        onCancel={closeCurationEditor}
      />

      {dangerState ? (
        <ConfirmAction
          open
          title={
            dangerState.type === 'deleteFaq'
              ? 'FAQ 삭제'
              : dangerState.type === 'toggleFaqStatus'
                ? `FAQ ${dangerState.nextStatus === '공개' ? '공개' : '비공개'} 전환`
                : dangerState.type === 'deleteCuration'
                  ? 'FAQ 노출 삭제'
                  : `FAQ 노출 ${dangerState.nextStatus === 'active' ? '재개' : '일시중지'}`
          }
          description={
            dangerState.type === 'deleteFaq'
              ? 'FAQ를 삭제하면 연결된 노출 규칙과 지표 연결도 함께 정리됩니다.'
              : dangerState.type === 'toggleFaqStatus'
                ? 'FAQ 공개 상태를 변경하면 사용자 도움말과 연결된 노출 규칙에 즉시 영향이 생깁니다.'
                : dangerState.type === 'deleteCuration'
                  ? '대표 FAQ 노출 규칙을 삭제하면 해당 화면에서 더 이상 자동으로 노출되지 않습니다.'
                  : 'FAQ 노출 상태를 변경하면 대표 FAQ 영역의 즉시 노출 여부가 달라집니다.'
          }
          targetType={
            dangerState.type === 'deleteFaq' || dangerState.type === 'toggleFaqStatus'
              ? 'OperationFaq'
              : 'OperationFaqCuration'
          }
          targetId={
            dangerState.type === 'deleteFaq' || dangerState.type === 'toggleFaqStatus'
              ? dangerState.faq.id
              : dangerState.curation.id
          }
          confirmText={
            dangerState.type === 'deleteFaq' || dangerState.type === 'deleteCuration'
              ? '삭제 실행'
              : '조치 실행'
          }
          onCancel={() => setDangerState(null)}
          onConfirm={handleDangerConfirm}
        />
      ) : null}

      <FaqDetailDrawer
        faq={selectedFaq}
        metric={selectedFaqMetric}
        curations={selectedFaqCurations}
        onClose={closeFaqDrawer}
        onEditFaq={openFaqEditModal}
        onCreateCuration={openCurationCreateModal}
        onOpenCurationDrawer={openCurationDrawer}
        onDanger={setDangerState}
      />

      <CurationDetailDrawer
        curation={selectedCuration}
        metricRows={metricRows}
        onClose={closeCurationDrawer}
        onEditCuration={openCurationEditModal}
        onOpenFaqDrawer={openFaqDrawer}
        onDanger={setDangerState}
      />
    </div>
  );
}
