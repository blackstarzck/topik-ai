import {
  Alert,
  Button,
  Card,
  Col,
  DatePicker,
  Descriptions,
  Form,
  Input,
  InputNumber,
  Modal,
  Row,
  Select,
  Space,
  Statistic,
  Tabs,
  Tag,
  Typography,
  notification
} from 'antd';
import type {
  SortOrder,
  TableColumnsType,
  TableProps,
  TabsProps
} from 'antd';
import { PlusOutlined, ReloadOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import type { Dayjs } from 'dayjs';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';

import {
  deleteFaqCurationSafe,
  deleteFaqSafe,
  fetchFaqCurationsSafe,
  fetchFaqMetricsSafe,
  fetchFaqsSafe,
  saveFaqCurationSafe,
  saveFaqSafe,
  toggleFaqStatusSafe
} from '../api/faqs-service';
import {
  faqCategoryOptions,
  faqCategoryValues,
  faqCurationModeOptions,
  faqCurationModeValues,
  faqCurationStatusOptions,
  faqCurationStatusValues,
  faqExposureSurfaceOptions,
  faqExposureSurfaceValues,
  faqStatusOptions,
  faqStatusValues,
  getFaqCategoryLabel,
  getFaqCurationModeLabel,
  getFaqCurationStatusLabel,
  getFaqExposureSurfaceLabel
} from '../model/faq-schema';
import type {
  OperationFaq,
  OperationFaqCategory,
  OperationFaqCuration,
  OperationFaqCurationMode,
  OperationFaqCurationStatus,
  OperationFaqExposureSurface,
  OperationFaqMetric,
  OperationFaqStatus
} from '../model/types';
import type { AsyncState } from '../../../shared/model/async-state';
import { getTargetTypeLabel } from '../../../shared/model/target-type-label';
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
import { TableActionMenu } from '../../../shared/ui/table/table-action-menu';
import { createStatusColumnTitle } from '../../../shared/ui/table/status-column-title';
import {
  createNumberSorter,
  createTextSorter
} from '../../../shared/ui/table/table-column-utils';

const { Text, Paragraph } = Typography;
const { RangePicker } = DatePicker;

type TabKey = 'master' | 'curation' | 'metrics';

const tabItems: TabsProps['items'] = [
  { key: 'master', label: 'FAQ 마스터' },
  { key: 'curation', label: '노출 관리' },
  { key: 'metrics', label: '지표 보기' }
];

const masterSearchFieldValues = [
  'all',
  'id',
  'question',
  'answer',
  'searchKeywords'
] as const;

const masterSortFieldValues = [
  'id',
  'question',
  'category',
  'updatedAt',
  'status'
] as const;

const curationSearchFieldValues = [
  'all',
  'id',
  'faqId',
  'question',
  'surface'
] as const;

const curationSortFieldValues = [
  'id',
  'surface',
  'displayRank',
  'updatedAt',
  'exposureStatus'
] as const;

const metricSearchFieldValues = [
  'all',
  'faqId',
  'question',
  'searchKeywords'
] as const;

const metricSortFieldValues = [
  'faqId',
  'viewCount',
  'searchHitCount',
  'helpfulCount',
  'notHelpfulCount',
  'lastViewedAt'
] as const;

type FaqPageParamKey =
  | 'tab'
  | 'keyword'
  | 'searchField'
  | 'startDate'
  | 'endDate'
  | 'status'
  | 'category'
  | 'sortField'
  | 'sortOrder'
  | 'selected'
  | 'curationKeyword'
  | 'curationSearchField'
  | 'curationSurface'
  | 'curationMode'
  | 'curationExposureStatus'
  | 'curationSortField'
  | 'curationSortOrder'
  | 'curationSelected'
  | 'metricKeyword'
  | 'metricSearchField'
  | 'metricSortField'
  | 'metricSortOrder';

type FaqFormValues = {
  question: string;
  answer: string;
  searchKeywordsText: string;
  category: OperationFaqCategory;
  status: OperationFaqStatus;
};

type CurationFormValues = {
  faqId: string;
  surface: OperationFaqExposureSurface;
  curationMode: OperationFaqCurationMode;
  displayRank: number;
  exposureStatus: OperationFaqCurationStatus;
  pinnedDateRange?: [Dayjs | null, Dayjs | null];
};

type FaqEditorState =
  | { type: 'create' }
  | { type: 'edit'; faq: OperationFaq }
  | null;

type CurationEditorState =
  | { type: 'create'; faqId?: string }
  | { type: 'edit'; curation: OperationFaqCuration }
  | null;

type DangerState =
  | { type: 'deleteFaq'; faq: OperationFaq }
  | {
      type: 'toggleFaqStatus';
      faq: OperationFaq;
      nextStatus: OperationFaqStatus;
    }
  | { type: 'deleteCuration'; curation: OperationFaqCuration }
  | {
      type: 'toggleCurationStatus';
      curation: OperationFaqCuration;
      nextStatus: OperationFaqCurationStatus;
    }
  | null;

type FaqCurationRow = OperationFaqCuration & {
  faq: OperationFaq | null;
};

type FaqMetricRow = OperationFaqMetric & {
  faq: OperationFaq | null;
};

function createInitialAsyncState<T>(data: T): AsyncState<T> {
  return {
    status: 'pending',
    data,
    errorMessage: null,
    errorCode: null
  };
}

function parseTab(value: string | null): TabKey {
  if (value === 'curation' || value === 'metrics') {
    return value;
  }
  return 'master';
}

function parseSortOrder(value: string | null): SortOrder | null {
  if (value === 'ascend' || value === 'descend') {
    return value;
  }
  return null;
}

function parseValue<T extends readonly string[]>(
  value: string | null,
  candidates: T
): T[number] | null {
  if (!value) {
    return null;
  }

  return candidates.includes(value) ? value : null;
}

function joinKeywords(keywords: string[]): string {
  return keywords.join(', ');
}

function parseKeywords(input: string): string[] {
  return Array.from(
    new Set(
      input
        .split(/[\n,]/)
        .map((item) => item.trim())
        .filter(Boolean)
    )
  );
}

function formatPinnedDateRange(
  startAt: string | null,
  endAt: string | null
): string {
  if (!startAt && !endAt) {
    return '상시';
  }

  if (startAt && endAt) {
    return `${startAt} ~ ${endAt}`;
  }

  if (startAt) {
    return `${startAt}부터`;
  }

  return `${endAt ?? '-'}까지`;
}

function formatMetricRatio(metric: OperationFaqMetric | null): string {
  if (!metric) {
    return '-';
  }

  const denominator = metric.helpfulCount + metric.notHelpfulCount;
  if (denominator === 0) {
    return '0%';
  }

  return `${Math.round((metric.helpfulCount / denominator) * 100)}%`;
}

function getCurationStatusTagColor(status: OperationFaqCurationStatus): string {
  return status === 'active' ? 'green' : 'default';
}

function getCurationModeTagColor(mode: OperationFaqCurationMode): string {
  return mode === 'manual' ? 'blue' : 'purple';
}

function buildFaqFormValues(faq?: OperationFaq): FaqFormValues {
  return {
    question: faq?.question ?? '',
    answer: faq?.answer ?? '',
    searchKeywordsText: faq ? joinKeywords(faq.searchKeywords) : '',
    category: faq?.category ?? '계정',
    status: faq?.status ?? '공개'
  };
}

function buildCurationFormValues(
  curation?: OperationFaqCuration,
  faqId?: string
): CurationFormValues {
  return {
    faqId: curation?.faqId ?? faqId ?? '',
    surface: curation?.surface ?? 'help_center',
    curationMode: curation?.curationMode ?? 'manual',
    displayRank: curation?.displayRank ?? 1,
    exposureStatus: curation?.exposureStatus ?? 'active',
    pinnedDateRange:
      curation?.pinnedStartAt || curation?.pinnedEndAt
        ? [
            curation?.pinnedStartAt ? dayjs(curation.pinnedStartAt) : null,
            curation?.pinnedEndAt ? dayjs(curation.pinnedEndAt) : null
          ]
        : undefined
  };
}

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

  const {
    draftStartDate,
    draftEndDate,
    handleDraftDateChange,
    handleDraftReset,
    handleDetailOpenChange
  } = useSearchBarDateDraft(startDate, endDate);

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

  const visibleFaqs = useMemo(() => {
    return faqsState.data.filter((faq) => {
      if (faqStatusFilter && faq.status !== faqStatusFilter) {
        return false;
      }

      if (faqCategoryFilter && faq.category !== faqCategoryFilter) {
        return false;
      }

      if (!matchesSearchDateRange(faq.updatedAt, startDate, endDate)) {
        return false;
      }

      return matchesSearchField(keyword, masterSearchField, {
        id: faq.id,
        question: faq.question,
        answer: faq.answer,
        searchKeywords: faq.searchKeywords
      });
    });
  }, [
    faqCategoryFilter,
    faqStatusFilter,
    faqsState.data,
    keyword,
    masterSearchField,
    startDate,
    endDate
  ]);

  const visibleCurations = useMemo(() => {
    return curationRows.filter((curation) => {
      if (curationSurfaceFilter && curation.surface !== curationSurfaceFilter) {
        return false;
      }

      if (curationModeFilter && curation.curationMode !== curationModeFilter) {
        return false;
      }

      if (
        curationExposureStatusFilter &&
        curation.exposureStatus !== curationExposureStatusFilter
      ) {
        return false;
      }

      return matchesSearchField(curationKeyword, curationSearchField, {
        id: curation.id,
        faqId: curation.faqId,
        question: curation.faq?.question ?? '',
        surface: getFaqExposureSurfaceLabel(curation.surface)
      });
    });
  }, [
    curationExposureStatusFilter,
    curationKeyword,
    curationModeFilter,
    curationRows,
    curationSearchField,
    curationSurfaceFilter
  ]);

  const visibleMetrics = useMemo(() => {
    return metricRows.filter((metric) =>
      matchesSearchField(metricKeyword, metricSearchField, {
        faqId: metric.faqId,
        question: metric.faq?.question ?? '',
        searchKeywords: metric.faq?.searchKeywords ?? []
      })
    );
  }, [metricKeyword, metricRows, metricSearchField]);

  const totalFaqCount = faqsState.data.length;
  const publicFaqCount = faqsState.data.filter((faq) => faq.status === '공개').length;
  const activeCurationCount = curationsState.data.filter(
    (curation) => curation.exposureStatus === 'active'
  ).length;
  const totalViewCount = metricsState.data.reduce(
    (sum, metric) => sum + metric.viewCount,
    0
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

  const handleApplyMasterDateRange = useCallback(() => {
    syncSearchParams({
      startDate: draftStartDate || null,
      endDate: draftEndDate || null
    });
  }, [draftEndDate, draftStartDate, syncSearchParams]);

  const handleResetMasterFilters = useCallback(() => {
    handleDraftReset();
    syncSearchParams({
      startDate: null,
      endDate: null,
      status: null,
      category: null
    });
  }, [handleDraftReset, syncSearchParams]);

  const handleSaveFaq = useCallback(async () => {
    const values = await faqForm.validateFields();
    const result = await saveFaqSafe({
      id: faqEditorState?.type === 'edit' ? faqEditorState.faq.id : undefined,
      question: values.question.trim(),
      answer: values.answer.trim(),
      searchKeywords: parseKeywords(values.searchKeywordsText),
      category: values.category,
      status: values.status
    });

    if (!result.ok) {
      notificationApi.error({
        message:
          faqEditorState?.type === 'edit' ? 'FAQ 수정 실패' : 'FAQ 등록 실패',
        description: (
          <Space direction="vertical">
            <Text>{result.error.message}</Text>
            <Text type="secondary">오류 코드: {result.error.code}</Text>
          </Space>
        )
      });
      return;
    }

    closeFaqEditor();
    setFaqsState((prev) => {
      const nextData = [result.data, ...prev.data.filter((faq) => faq.id !== result.data.id)];
      return {
        status: nextData.length === 0 ? 'empty' : 'success',
        data: nextData,
        errorMessage: null,
        errorCode: null
      };
    });
    syncSearchParams({
      tab: 'master',
      selected: result.data.id
    });
    handleReload();

    notificationApi.success({
      message:
        faqEditorState?.type === 'edit' ? 'FAQ 수정 완료' : 'FAQ 등록 완료',
      description: (
        <Space direction="vertical">
          <Text>대상 유형: {getTargetTypeLabel('OperationFaq')}</Text>
          <Text>대상 ID: {result.data.id}</Text>
          <Text>
            조치: {faqEditorState?.type === 'edit' ? 'FAQ 원문 수정' : 'FAQ 신규 등록'}
          </Text>
          <AuditLogLink targetType="OperationFaq" targetId={result.data.id} />
        </Space>
      )
    });
  }, [closeFaqEditor, faqEditorState, faqForm, handleReload, notificationApi, syncSearchParams]);

  const handleSaveCuration = useCallback(async () => {
    const values = await curationForm.validateFields();
    const pinnedDateRange = values.pinnedDateRange;

    const result = await saveFaqCurationSafe({
      id:
        curationEditorState?.type === 'edit'
          ? curationEditorState.curation.id
          : undefined,
      faqId: values.faqId,
      surface: values.surface,
      curationMode: values.curationMode,
      displayRank: Number(values.displayRank),
      exposureStatus: values.exposureStatus,
      pinnedStartAt: pinnedDateRange?.[0]?.format('YYYY-MM-DD') ?? null,
      pinnedEndAt: pinnedDateRange?.[1]?.format('YYYY-MM-DD') ?? null
    });

    if (!result.ok) {
      notificationApi.error({
        message:
          curationEditorState?.type === 'edit'
            ? 'FAQ 노출 수정 실패'
            : 'FAQ 노출 등록 실패',
        description: (
          <Space direction="vertical">
            <Text>{result.error.message}</Text>
            <Text type="secondary">오류 코드: {result.error.code}</Text>
          </Space>
        )
      });
      return;
    }

    closeCurationEditor();
    setCurationsState((prev) => {
      const nextData = [
        result.data,
        ...prev.data.filter((curation) => curation.id !== result.data.id)
      ];
      return {
        status: nextData.length === 0 ? 'empty' : 'success',
        data: nextData,
        errorMessage: null,
        errorCode: null
      };
    });
    syncSearchParams({
      tab: 'curation',
      curationSelected: result.data.id,
      selected: null
    });
    handleReload();

    notificationApi.success({
      message:
        curationEditorState?.type === 'edit'
          ? 'FAQ 노출 수정 완료'
          : 'FAQ 노출 등록 완료',
      description: (
        <Space direction="vertical">
          <Text>대상 유형: {getTargetTypeLabel('OperationFaqCuration')}</Text>
          <Text>대상 ID: {result.data.id}</Text>
          <Text>
            조치:{' '}
            {curationEditorState?.type === 'edit'
              ? 'FAQ 노출 규칙 수정'
              : 'FAQ 대표 노출 추가'}
          </Text>
          <AuditLogLink
            targetType="OperationFaqCuration"
            targetId={result.data.id}
          />
        </Space>
      )
    });
  }, [
    closeCurationEditor,
    curationEditorState,
    curationForm,
    handleReload,
    notificationApi,
    syncSearchParams
  ]);

  const handleDangerConfirm = useCallback(
    async (reason: string) => {
      if (!dangerState) {
        return;
      }

      if (dangerState.type === 'deleteFaq') {
        const result = await deleteFaqSafe(dangerState.faq.id);
        if (!result.ok) {
          notificationApi.error({
            message: 'FAQ 삭제 실패',
            description: (
              <Space direction="vertical">
                <Text>{result.error.message}</Text>
                <Text type="secondary">오류 코드: {result.error.code}</Text>
              </Space>
            )
          });
          return;
        }

        closeFaqDrawer();
        handleReload();
        setDangerState(null);
        notificationApi.success({
          message: 'FAQ 삭제 완료',
          description: (
            <Space direction="vertical">
              <Text>대상 유형: {getTargetTypeLabel('OperationFaq')}</Text>
              <Text>대상 ID: {result.data.id}</Text>
              <Text>사유/근거: {reason}</Text>
              <AuditLogLink targetType="OperationFaq" targetId={result.data.id} />
            </Space>
          )
        });
        return;
      }

      if (dangerState.type === 'toggleFaqStatus') {
        const result = await toggleFaqStatusSafe({
          faqId: dangerState.faq.id,
          nextStatus: dangerState.nextStatus
        });

        if (!result.ok) {
          notificationApi.error({
            message:
              dangerState.nextStatus === '공개'
                ? 'FAQ 공개 전환 실패'
                : 'FAQ 비공개 전환 실패',
            description: (
              <Space direction="vertical">
                <Text>{result.error.message}</Text>
                <Text type="secondary">오류 코드: {result.error.code}</Text>
              </Space>
            )
          });
          return;
        }

        handleReload();
        setDangerState(null);
        notificationApi.success({
          message:
            dangerState.nextStatus === '공개'
              ? 'FAQ 공개 전환 완료'
              : 'FAQ 비공개 전환 완료',
          description: (
            <Space direction="vertical">
              <Text>대상 유형: {getTargetTypeLabel('OperationFaq')}</Text>
              <Text>대상 ID: {result.data.id}</Text>
              <Text>사유/근거: {reason}</Text>
              <AuditLogLink targetType="OperationFaq" targetId={result.data.id} />
            </Space>
          )
        });
        return;
      }

      if (dangerState.type === 'deleteCuration') {
        const result = await deleteFaqCurationSafe(dangerState.curation.id);
        if (!result.ok) {
          notificationApi.error({
            message: 'FAQ 노출 삭제 실패',
            description: (
              <Space direction="vertical">
                <Text>{result.error.message}</Text>
                <Text type="secondary">오류 코드: {result.error.code}</Text>
              </Space>
            )
          });
          return;
        }

        closeCurationDrawer();
        handleReload();
        setDangerState(null);
        notificationApi.success({
          message: 'FAQ 노출 삭제 완료',
          description: (
            <Space direction="vertical">
              <Text>대상 유형: {getTargetTypeLabel('OperationFaqCuration')}</Text>
              <Text>대상 ID: {result.data.id}</Text>
              <Text>사유/근거: {reason}</Text>
              <AuditLogLink
                targetType="OperationFaqCuration"
                targetId={result.data.id}
              />
            </Space>
          )
        });
        return;
      }

      const result = await saveFaqCurationSafe({
        id: dangerState.curation.id,
        faqId: dangerState.curation.faqId,
        surface: dangerState.curation.surface,
        curationMode: dangerState.curation.curationMode,
        displayRank: dangerState.curation.displayRank,
        exposureStatus: dangerState.nextStatus,
        pinnedStartAt: dangerState.curation.pinnedStartAt,
        pinnedEndAt: dangerState.curation.pinnedEndAt
      });

      if (!result.ok) {
        notificationApi.error({
          message:
            dangerState.nextStatus === 'active'
              ? 'FAQ 노출 재개 실패'
              : 'FAQ 노출 일시중지 실패',
          description: (
            <Space direction="vertical">
              <Text>{result.error.message}</Text>
              <Text type="secondary">오류 코드: {result.error.code}</Text>
            </Space>
          )
        });
        return;
      }

      handleReload();
      setDangerState(null);
      notificationApi.success({
        message:
          dangerState.nextStatus === 'active'
            ? 'FAQ 노출 재개 완료'
            : 'FAQ 노출 일시중지 완료',
        description: (
          <Space direction="vertical">
            <Text>대상 유형: {getTargetTypeLabel('OperationFaqCuration')}</Text>
            <Text>대상 ID: {result.data.id}</Text>
            <Text>사유/근거: {reason}</Text>
            <AuditLogLink
              targetType="OperationFaqCuration"
              targetId={result.data.id}
            />
          </Space>
        )
      });
    },
    [
      closeCurationDrawer,
      closeFaqDrawer,
      dangerState,
      handleReload,
      notificationApi
    ]
  );

  const faqColumns = useMemo<TableColumnsType<OperationFaq>>(
    () => [
      {
        title: 'FAQ ID',
        dataIndex: 'id',
        width: 120,
        sorter: createTextSorter((record) => record.id),
        sortOrder: masterSortField === 'id' ? masterSortOrder : null
      },
      {
        title: '질문',
        dataIndex: 'question',
        width: 320,
        sorter: createTextSorter((record) => record.question),
        sortOrder: masterSortField === 'question' ? masterSortOrder : null
      },
      {
        title: '카테고리',
        dataIndex: 'category',
        width: 120,
        sorter: createTextSorter((record) => record.category),
        sortOrder: masterSortField === 'category' ? masterSortOrder : null,
        render: (category: OperationFaqCategory) => getFaqCategoryLabel(category)
      },
      {
        title: '검색 키워드',
        dataIndex: 'searchKeywords',
        width: 220,
        render: (searchKeywords: string[]) => (
          <Text type="secondary">{joinKeywords(searchKeywords) || '-'}</Text>
        )
      },
      {
        title: '최종 수정',
        dataIndex: 'updatedAt',
        width: 140,
        sorter: createTextSorter((record) => record.updatedAt),
        sortOrder: masterSortField === 'updatedAt' ? masterSortOrder : null
      },
      {
        title: createStatusColumnTitle('상태', ['공개', '비공개']),
        dataIndex: 'status',
        width: 110,
        sorter: createTextSorter((record) => record.status),
        sortOrder: masterSortField === 'status' ? masterSortOrder : null,
        render: (status: OperationFaqStatus) => <StatusBadge status={status} />
      },
      {
        title: '액션',
        key: 'action',
        width: 116,
        onCell: () => ({
          onClick: (event) => event.stopPropagation()
        }),
        render: (_, record) => (
          <TableActionMenu
            items={[
              {
                key: `edit-${record.id}`,
                label: 'FAQ 수정',
                onClick: () => openFaqEditModal(record)
              },
              {
                key: `curation-${record.id}`,
                label: '노출 추가',
                onClick: () => openCurationCreateModal(record.id)
              }
            ]}
          />
        )
      }
    ],
    [
      masterSortField,
      masterSortOrder,
      openCurationCreateModal,
      openFaqEditModal
    ]
  );

  const curationColumns = useMemo<TableColumnsType<FaqCurationRow>>(
    () => [
      {
        title: '노출 ID',
        dataIndex: 'id',
        width: 140,
        sorter: createTextSorter((record) => record.id),
        sortOrder: curationSortField === 'id' ? curationSortOrder : null
      },
      {
        title: '노출 위치',
        dataIndex: 'surface',
        width: 160,
        sorter: createTextSorter((record) => record.surface),
        sortOrder: curationSortField === 'surface' ? curationSortOrder : null,
        render: (surface: OperationFaqExposureSurface) =>
          getFaqExposureSurfaceLabel(surface)
      },
      {
        title: '연결 FAQ',
        dataIndex: 'faqId',
        width: 320,
        render: (_, record) => (
          <Space direction="vertical" size={0}>
            <Text>{record.faq?.question ?? '삭제되었거나 동기화되지 않은 FAQ'}</Text>
            <Text type="secondary">{record.faqId}</Text>
          </Space>
        )
      },
      {
        title: '노출 순서',
        dataIndex: 'displayRank',
        width: 110,
        sorter: createNumberSorter((record) => record.displayRank),
        sortOrder: curationSortField === 'displayRank' ? curationSortOrder : null
      },
      {
        title: '설정 방식',
        dataIndex: 'curationMode',
        width: 120,
        render: (curationMode: OperationFaqCurationMode) => (
          <Tag color={getCurationModeTagColor(curationMode)}>
            {getFaqCurationModeLabel(curationMode)}
          </Tag>
        )
      },
      {
        title: '노출 상태',
        dataIndex: 'exposureStatus',
        width: 120,
        sorter: createTextSorter((record) => record.exposureStatus),
        sortOrder:
          curationSortField === 'exposureStatus' ? curationSortOrder : null,
        render: (status: OperationFaqCurationStatus) => (
          <Tag color={getCurationStatusTagColor(status)}>
            {getFaqCurationStatusLabel(status)}
          </Tag>
        )
      },
      {
        title: '최종 수정',
        dataIndex: 'updatedAt',
        width: 140,
        sorter: createTextSorter((record) => record.updatedAt),
        sortOrder: curationSortField === 'updatedAt' ? curationSortOrder : null
      },
      {
        title: '액션',
        key: 'action',
        width: 96,
        onCell: () => ({
          onClick: (event) => event.stopPropagation()
        }),
        render: (_, record) => (
          <TableActionMenu
            items={[
              {
                key: `edit-${record.id}`,
                label: '노출 수정',
                onClick: () => openCurationEditModal(record)
              }
            ]}
          />
        )
      }
    ],
    [curationSortField, curationSortOrder, openCurationEditModal]
  );

  const metricColumns = useMemo<TableColumnsType<FaqMetricRow>>(
    () => [
      {
        title: 'FAQ ID',
        dataIndex: 'faqId',
        width: 120,
        sorter: createTextSorter((record) => record.faqId),
        sortOrder: metricSortField === 'faqId' ? metricSortOrder : null
      },
      {
        title: '질문',
        dataIndex: 'faq',
        width: 320,
        render: (_, record) => record.faq?.question ?? '삭제된 FAQ'
      },
      {
        title: '카테고리',
        dataIndex: 'faq',
        width: 120,
        render: (_, record) =>
          record.faq ? getFaqCategoryLabel(record.faq.category) : '-'
      },
      {
        title: '조회수',
        dataIndex: 'viewCount',
        width: 110,
        sorter: createNumberSorter((record) => record.viewCount),
        sortOrder: metricSortField === 'viewCount' ? metricSortOrder : null
      },
      {
        title: '검색 유입',
        dataIndex: 'searchHitCount',
        width: 120,
        sorter: createNumberSorter((record) => record.searchHitCount),
        sortOrder:
          metricSortField === 'searchHitCount' ? metricSortOrder : null
      },
      {
        title: '도움됨',
        dataIndex: 'helpfulCount',
        width: 110,
        sorter: createNumberSorter((record) => record.helpfulCount),
        sortOrder: metricSortField === 'helpfulCount' ? metricSortOrder : null
      },
      {
        title: '도움 안 됨',
        dataIndex: 'notHelpfulCount',
        width: 130,
        sorter: createNumberSorter((record) => record.notHelpfulCount),
        sortOrder:
          metricSortField === 'notHelpfulCount' ? metricSortOrder : null
      },
      {
        title: '최근 조회',
        dataIndex: 'lastViewedAt',
        width: 150,
        sorter: createTextSorter((record) => record.lastViewedAt ?? ''),
        sortOrder: metricSortField === 'lastViewedAt' ? metricSortOrder : null,
        render: (lastViewedAt: string | null) => lastViewedAt ?? '-'
      }
    ],
    [metricSortField, metricSortOrder]
  );

  const handleMasterTableChange = useCallback<
    NonNullable<TableProps<OperationFaq>['onChange']>
  >(
    (_, __, sorter) => {
      const nextSorter = Array.isArray(sorter) ? sorter[0] : sorter;
      const nextField =
        nextSorter && typeof nextSorter.field === 'string'
          ? parseValue(nextSorter.field, masterSortFieldValues)
          : null;

      syncSearchParams({
        sortField: nextField,
        sortOrder: nextField ? nextSorter?.order ?? null : null
      });
    },
    [syncSearchParams]
  );

  const handleCurationTableChange = useCallback<
    NonNullable<TableProps<FaqCurationRow>['onChange']>
  >(
    (_, __, sorter) => {
      const nextSorter = Array.isArray(sorter) ? sorter[0] : sorter;
      const nextField =
        nextSorter && typeof nextSorter.field === 'string'
          ? parseValue(nextSorter.field, curationSortFieldValues)
          : null;

      syncSearchParams({
        curationSortField: nextField,
        curationSortOrder: nextField ? nextSorter?.order ?? null : null
      });
    },
    [syncSearchParams]
  );

  const handleMetricTableChange = useCallback<
    NonNullable<TableProps<FaqMetricRow>['onChange']>
  >(
    (_, __, sorter) => {
      const nextSorter = Array.isArray(sorter) ? sorter[0] : sorter;
      const nextField =
        nextSorter && typeof nextSorter.field === 'string'
          ? parseValue(nextSorter.field, metricSortFieldValues)
          : null;

      syncSearchParams({
        metricSortField: nextField,
        metricSortOrder: nextField ? nextSorter?.order ?? null : null
      });
    },
    [syncSearchParams]
  );

  const faqAlert =
    faqsState.status === 'error' ? (
      <Alert
        type="error"
        showIcon
        style={{ marginBottom: 12 }}
        message="FAQ 목록을 불러오지 못했습니다."
        description={
          <Space direction="vertical">
            <Text>{faqsState.errorMessage ?? '일시적인 오류가 발생했습니다.'}</Text>
            {faqsState.errorCode ? (
              <Text type="secondary">오류 코드: {faqsState.errorCode}</Text>
            ) : null}
            {faqsState.data.length > 0 ? (
              <Text type="secondary">
                마지막 성공 상태를 유지한 채 운영 흐름을 계속할 수 있습니다.
              </Text>
            ) : null}
          </Space>
        }
        action={
          <Button size="small" icon={<ReloadOutlined />} onClick={handleReload}>
            다시 시도
          </Button>
        }
      />
    ) : faqsState.status === 'pending' && faqsState.data.length > 0 ? (
      <Alert
        type="info"
        showIcon
        style={{ marginBottom: 12 }}
        message="FAQ 목록을 새로 불러오는 중입니다."
        description="마지막 성공 상태를 유지한 채 최신 데이터를 동기화하고 있습니다."
      />
    ) : faqsState.status === 'empty' ? (
      <Alert
        type="info"
        showIcon
        style={{ marginBottom: 12 }}
        message="등록된 FAQ가 없습니다."
        description="FAQ 등록 버튼으로 첫 FAQ를 추가하세요."
      />
    ) : faqsState.data.length > 0 && visibleFaqs.length === 0 ? (
      <Alert
        type="info"
        showIcon
        style={{ marginBottom: 12 }}
        message="검색 조건에 맞는 FAQ가 없습니다."
        description="검색어, 카테고리, 공개 상태, 날짜 조건을 다시 조정하세요."
      />
    ) : null;

  const curationAlert =
    curationsState.status === 'error' ? (
      <Alert
        type="error"
        showIcon
        style={{ marginBottom: 12 }}
        message="FAQ 노출 목록을 불러오지 못했습니다."
        description={
          <Space direction="vertical">
            <Text>{curationsState.errorMessage ?? '일시적인 오류가 발생했습니다.'}</Text>
            {curationsState.errorCode ? (
              <Text type="secondary">오류 코드: {curationsState.errorCode}</Text>
            ) : null}
          </Space>
        }
        action={
          <Button size="small" icon={<ReloadOutlined />} onClick={handleReload}>
            다시 시도
          </Button>
        }
      />
    ) : curationsState.status === 'pending' && curationsState.data.length > 0 ? (
      <Alert
        type="info"
        showIcon
        style={{ marginBottom: 12 }}
        message="FAQ 노출 정보를 새로 불러오는 중입니다."
        description="마지막 성공 상태를 유지한 채 최신 노출 규칙을 반영하고 있습니다."
      />
    ) : curationsState.status === 'empty' ? (
      <Alert
        type="info"
        showIcon
        style={{ marginBottom: 12 }}
        message="등록된 FAQ 노출 규칙이 없습니다."
        description="노출 추가 버튼으로 홈/고객센터 대표 FAQ를 관리하세요."
      />
    ) : curationsState.data.length > 0 && visibleCurations.length === 0 ? (
      <Alert
        type="info"
        showIcon
        style={{ marginBottom: 12 }}
        message="검색 조건에 맞는 노출 규칙이 없습니다."
        description="노출 위치, 설정 방식, 노출 상태 조건을 다시 조정하세요."
      />
    ) : null;

  const metricAlert =
    metricsState.status === 'error' ? (
      <Alert
        type="error"
        showIcon
        style={{ marginBottom: 12 }}
        message="FAQ 지표를 불러오지 못했습니다."
        description={
          <Space direction="vertical">
            <Text>{metricsState.errorMessage ?? '일시적인 오류가 발생했습니다.'}</Text>
            {metricsState.errorCode ? (
              <Text type="secondary">오류 코드: {metricsState.errorCode}</Text>
            ) : null}
          </Space>
        }
        action={
          <Button size="small" icon={<ReloadOutlined />} onClick={handleReload}>
            다시 시도
          </Button>
        }
      />
    ) : metricsState.status === 'pending' && metricsState.data.length > 0 ? (
      <Alert
        type="info"
        showIcon
        style={{ marginBottom: 12 }}
        message="FAQ 지표를 새로 불러오는 중입니다."
        description="마지막 성공 상태를 유지한 채 최신 조회/검색 지표를 갱신하고 있습니다."
      />
    ) : metricsState.status === 'empty' ? (
      <Alert
        type="info"
        showIcon
        style={{ marginBottom: 12 }}
        message="표시할 FAQ 지표가 없습니다."
        description="FAQ가 등록되면 조회/검색 지표 스냅샷이 함께 생성됩니다."
      />
    ) : metricsState.data.length > 0 && visibleMetrics.length === 0 ? (
      <Alert
        type="info"
        showIcon
        style={{ marginBottom: 12 }}
        message="검색 조건에 맞는 FAQ 지표가 없습니다."
        description="FAQ ID, 질문, 검색 키워드 기준으로 다시 검색하세요."
      />
    ) : null;

  const faqDrawerInfoItems = selectedFaq
    ? [
        { key: 'faqId', label: 'FAQ ID', children: selectedFaq.id },
        { key: 'category', label: '카테고리', children: selectedFaq.category },
        {
          key: 'status',
          label: '공개 상태',
          children: <StatusBadge status={selectedFaq.status} />
        },
        { key: 'createdAt', label: '등록일', children: selectedFaq.createdAt },
        { key: 'updatedAt', label: '최종 수정', children: selectedFaq.updatedAt },
        { key: 'updatedBy', label: '수정자', children: selectedFaq.updatedBy }
      ]
    : [];

  const faqMetricItems = selectedFaqMetric
    ? [
        {
          key: 'viewCount',
          label: '조회수',
          children: `${selectedFaqMetric.viewCount.toLocaleString()}회`
        },
        {
          key: 'searchHitCount',
          label: '검색 유입',
          children: `${selectedFaqMetric.searchHitCount.toLocaleString()}회`
        },
        {
          key: 'helpful',
          label: '도움됨',
          children: `${selectedFaqMetric.helpfulCount.toLocaleString()}건`
        },
        {
          key: 'notHelpful',
          label: '도움 안 됨',
          children: `${selectedFaqMetric.notHelpfulCount.toLocaleString()}건`
        },
        {
          key: 'ratio',
          label: '도움됨 비율',
          children: formatMetricRatio(selectedFaqMetric)
        },
        {
          key: 'lastViewedAt',
          label: '최근 조회',
          children: selectedFaqMetric.lastViewedAt ?? '-'
        }
      ]
    : [{ key: 'empty', label: '지표 상태', children: '아직 집계된 지표가 없습니다.' }];

  const curationDrawerItems = selectedCuration
    ? [
        { key: 'curationId', label: '노출 ID', children: selectedCuration.id },
        {
          key: 'surface',
          label: '노출 위치',
          children: getFaqExposureSurfaceLabel(selectedCuration.surface)
        },
        {
          key: 'displayRank',
          label: '노출 순서',
          children: `${selectedCuration.displayRank}위`
        },
        {
          key: 'curationMode',
          label: '설정 방식',
          children: getFaqCurationModeLabel(selectedCuration.curationMode)
        },
        {
          key: 'exposureStatus',
          label: '노출 상태',
          children: (
            <Tag color={getCurationStatusTagColor(selectedCuration.exposureStatus)}>
              {getFaqCurationStatusLabel(selectedCuration.exposureStatus)}
            </Tag>
          )
        },
        {
          key: 'pinnedPeriod',
          label: '노출 기간',
          children: formatPinnedDateRange(
            selectedCuration.pinnedStartAt,
            selectedCuration.pinnedEndAt
          )
        },
        { key: 'updatedAt', label: '최종 수정', children: selectedCuration.updatedAt },
        { key: 'updatedBy', label: '수정자', children: selectedCuration.updatedBy }
      ]
    : [];

  const curationLinkedFaqItems = selectedCuration
    ? [
        { key: 'faqId', label: 'FAQ ID', children: selectedCuration.faqId },
        {
          key: 'question',
          label: '질문',
          children: selectedCuration.faq?.question ?? '삭제되었거나 동기화되지 않은 FAQ'
        },
        {
          key: 'category',
          label: '카테고리',
          children: selectedCuration.faq
            ? getFaqCategoryLabel(selectedCuration.faq.category)
            : '-'
        },
        {
          key: 'status',
          label: 'FAQ 상태',
          children: selectedCuration.faq ? (
            <StatusBadge status={selectedCuration.faq.status} />
          ) : (
            '-'
          )
        }
      ]
    : [];

  return (
    <div>
      {notificationContextHolder}
      <PageTitle title="자주 묻는 질문" />

      <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
        <Col xs={24} md={6}>
          <Card>
            <Statistic title="전체 FAQ" value={totalFaqCount} suffix="건" />
          </Card>
        </Col>
        <Col xs={24} md={6}>
          <Card>
            <Statistic title="공개 FAQ" value={publicFaqCount} suffix="건" />
          </Card>
        </Col>
        <Col xs={24} md={6}>
          <Card>
            <Statistic title="활성 노출" value={activeCurationCount} suffix="건" />
          </Card>
        </Col>
        <Col xs={24} md={6}>
          <Card>
            <Statistic title="누적 조회수" value={totalViewCount} suffix="회" />
          </Card>
        </Col>
      </Row>

      <AdminListCard
        toolbar={
          <div className="admin-list-card-toolbar-stack">
            <Tabs
              activeKey={activeTab}
              items={tabItems}
              className="admin-list-card-toolbar-tabs"
              onChange={(value) => syncSearchParams({ tab: value as TabKey })}
            />

            {activeTab === 'master' ? (
              <SearchBar
                searchField={masterSearchField}
                searchFieldOptions={[
                  { label: '전체', value: 'all' },
                  { label: 'FAQ ID', value: 'id' },
                  { label: '질문', value: 'question' },
                  { label: '답변', value: 'answer' },
                  { label: '검색 키워드', value: 'searchKeywords' }
                ]}
                keyword={keyword}
                onSearchFieldChange={(value) =>
                  syncSearchParams({
                    searchField: value,
                    sortField: null,
                    sortOrder: null
                  })
                }
                onKeywordChange={(event) =>
                  syncSearchParams({ keyword: event.target.value || null })
                }
                detailTitle="상세 검색"
                detailContent={
                  <Space direction="vertical" size={16} style={{ width: '100%' }}>
                    <SearchBarDetailField label="최종 수정일">
                      <SearchBarDateRange
                        startDate={draftStartDate}
                        endDate={draftEndDate}
                        onChange={handleDraftDateChange}
                      />
                    </SearchBarDetailField>
                    <SearchBarDetailField label="카테고리">
                      <Select
                        allowClear
                        value={faqCategoryFilter ?? undefined}
                        options={faqCategoryOptions}
                        placeholder="카테고리를 선택하세요."
                        onChange={(value) =>
                          syncSearchParams({ category: value ?? null })
                        }
                      />
                    </SearchBarDetailField>
                    <SearchBarDetailField label="공개 상태">
                      <Select
                        allowClear
                        value={faqStatusFilter ?? undefined}
                        options={faqStatusOptions}
                        placeholder="공개 상태를 선택하세요."
                        onChange={(value) =>
                          syncSearchParams({ status: value ?? null })
                        }
                      />
                    </SearchBarDetailField>
                  </Space>
                }
                onApply={handleApplyMasterDateRange}
                onDetailOpenChange={handleDetailOpenChange}
                onReset={handleResetMasterFilters}
                summary={<Text type="secondary">총 {visibleFaqs.length.toLocaleString()}건</Text>}
                actions={
                  <Space>
                    <Button icon={<ReloadOutlined />} onClick={handleReload}>
                      새로고침
                    </Button>
                    <Button
                      type="primary"
                      size="large"
                      icon={<PlusOutlined />}
                      onClick={openFaqCreateModal}
                    >
                      FAQ 등록
                    </Button>
                  </Space>
                }
              />
            ) : null}

            {activeTab === 'curation' ? (
              <SearchBar
                searchField={curationSearchField}
                searchFieldOptions={[
                  { label: '전체', value: 'all' },
                  { label: '노출 ID', value: 'id' },
                  { label: 'FAQ ID', value: 'faqId' },
                  { label: '질문', value: 'question' },
                  { label: '노출 위치', value: 'surface' }
                ]}
                keyword={curationKeyword}
                onSearchFieldChange={(value) =>
                  syncSearchParams({
                    curationSearchField: value,
                    curationSortField: null,
                    curationSortOrder: null
                  })
                }
                onKeywordChange={(event) =>
                  syncSearchParams({
                    curationKeyword: event.target.value || null
                  })
                }
                extra={
                  <Space wrap>
                    <Select
                      allowClear
                      style={{ width: 180 }}
                      value={curationSurfaceFilter ?? undefined}
                      options={faqExposureSurfaceOptions}
                      placeholder="노출 위치"
                      onChange={(value) =>
                        syncSearchParams({ curationSurface: value ?? null })
                      }
                    />
                    <Select
                      allowClear
                      style={{ width: 160 }}
                      value={curationModeFilter ?? undefined}
                      options={faqCurationModeOptions}
                      placeholder="설정 방식"
                      onChange={(value) =>
                        syncSearchParams({ curationMode: value ?? null })
                      }
                    />
                    <Select
                      allowClear
                      style={{ width: 160 }}
                      value={curationExposureStatusFilter ?? undefined}
                      options={faqCurationStatusOptions}
                      placeholder="노출 상태"
                      onChange={(value) =>
                        syncSearchParams({
                          curationExposureStatus: value ?? null
                        })
                      }
                    />
                  </Space>
                }
                summary={
                  <Text type="secondary">총 {visibleCurations.length.toLocaleString()}건</Text>
                }
                actions={
                  <Space>
                    <Button icon={<ReloadOutlined />} onClick={handleReload}>
                      새로고침
                    </Button>
                    <Button
                      type="primary"
                      size="large"
                      icon={<PlusOutlined />}
                      onClick={() => openCurationCreateModal()}
                    >
                      노출 추가
                    </Button>
                  </Space>
                }
              />
            ) : null}

            {activeTab === 'metrics' ? (
              <SearchBar
                searchField={metricSearchField}
                searchFieldOptions={[
                  { label: '전체', value: 'all' },
                  { label: 'FAQ ID', value: 'faqId' },
                  { label: '질문', value: 'question' },
                  { label: '검색 키워드', value: 'searchKeywords' }
                ]}
                keyword={metricKeyword}
                onSearchFieldChange={(value) =>
                  syncSearchParams({
                    metricSearchField: value,
                    metricSortField: null,
                    metricSortOrder: null
                  })
                }
                onKeywordChange={(event) =>
                  syncSearchParams({
                    metricKeyword: event.target.value || null
                  })
                }
                summary={<Text type="secondary">총 {visibleMetrics.length.toLocaleString()}건</Text>}
                actions={
                  <Button icon={<ReloadOutlined />} onClick={handleReload}>
                    새로고침
                  </Button>
                }
              />
            ) : null}
          </div>
        }
      >
        {activeTab === 'master' ? faqAlert : null}
        {activeTab === 'curation' ? curationAlert : null}
        {activeTab === 'metrics' ? metricAlert : null}

        {activeTab === 'master' ? (
          <AdminDataTable<OperationFaq>
            rowKey="id"
            columns={faqColumns}
            dataSource={visibleFaqs}
            pagination={false}
            loading={faqsState.status === 'pending' && faqsState.data.length === 0}
            locale={{ emptyText: '등록된 FAQ가 없습니다.' }}
            scroll={{ x: 1180 }}
            onChange={handleMasterTableChange}
            onRow={(record) => ({
              onClick: () => openFaqDrawer(record.id),
              style: { cursor: 'pointer' }
            })}
          />
        ) : null}

        {activeTab === 'curation' ? (
          <AdminDataTable<FaqCurationRow>
            rowKey="id"
            columns={curationColumns}
            dataSource={visibleCurations}
            pagination={false}
            loading={curationsState.status === 'pending' && curationsState.data.length === 0}
            locale={{ emptyText: '등록된 FAQ 노출 규칙이 없습니다.' }}
            scroll={{ x: 1320 }}
            onChange={handleCurationTableChange}
            onRow={(record) => ({
              onClick: () => openCurationDrawer(record.id),
              style: { cursor: 'pointer' }
            })}
          />
        ) : null}

        {activeTab === 'metrics' ? (
          <AdminDataTable<FaqMetricRow>
            rowKey="faqId"
            columns={metricColumns}
            dataSource={visibleMetrics}
            pagination={false}
            loading={metricsState.status === 'pending' && metricsState.data.length === 0}
            locale={{ emptyText: '표시할 FAQ 지표가 없습니다.' }}
            scroll={{ x: 1280 }}
            onChange={handleMetricTableChange}
            onRow={(record) => ({
              onClick: () => openFaqDrawer(record.faqId),
              style: { cursor: record.faq ? 'pointer' : 'default' }
            })}
          />
        ) : null}
      </AdminListCard>

      <Modal
        open={Boolean(faqEditorState)}
        title={faqEditorState?.type === 'edit' ? 'FAQ 수정' : 'FAQ 등록'}
        okText="저장"
        cancelText="취소"
        onCancel={closeFaqEditor}
        onOk={() => void handleSaveFaq()}
        destroyOnHidden
      >
        <Form form={faqForm} layout="vertical">
          <Form.Item
            label="질문"
            name="question"
            rules={[{ required: true, message: '질문을 입력하세요.' }]}
          >
            <Input placeholder="사용자에게 노출할 질문을 입력하세요." />
          </Form.Item>
          <Form.Item
            label="카테고리"
            name="category"
            rules={[{ required: true, message: '카테고리를 선택하세요.' }]}
          >
            <Select options={faqCategoryOptions} />
          </Form.Item>
          <Form.Item
            label="검색 키워드"
            name="searchKeywordsText"
            extra="쉼표 또는 줄바꿈 기준으로 분리되어 저장됩니다."
          >
            <Input.TextArea rows={3} placeholder="예: 결제 오류, 카드 결제, 환불" />
          </Form.Item>
          <Form.Item
            label="답변"
            name="answer"
            rules={[{ required: true, message: '답변을 입력하세요.' }]}
          >
            <Input.TextArea rows={7} placeholder="FAQ 답변을 입력하세요." />
          </Form.Item>
          <Form.Item
            label="공개 상태"
            name="status"
            rules={[{ required: true, message: '공개 상태를 선택하세요.' }]}
            style={{ marginBottom: 0 }}
          >
            <Select options={faqStatusOptions} />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        open={Boolean(curationEditorState)}
        title={curationEditorState?.type === 'edit' ? 'FAQ 노출 수정' : 'FAQ 노출 추가'}
        okText="저장"
        cancelText="취소"
        onCancel={closeCurationEditor}
        onOk={() => void handleSaveCuration()}
        destroyOnHidden
      >
        <Form form={curationForm} layout="vertical">
          <Form.Item
            label="연결 FAQ"
            name="faqId"
            rules={[{ required: true, message: '연결할 FAQ를 선택하세요.' }]}
          >
            <Select
              showSearch
              optionFilterProp="label"
              placeholder="FAQ를 선택하세요."
              options={faqsState.data.map((faq) => ({
                label: `${faq.id} · ${faq.question}`,
                value: faq.id
              }))}
            />
          </Form.Item>
          <Form.Item
            label="노출 위치"
            name="surface"
            rules={[{ required: true, message: '노출 위치를 선택하세요.' }]}
          >
            <Select options={faqExposureSurfaceOptions} />
          </Form.Item>
          <Form.Item
            label="노출 순서"
            name="displayRank"
            rules={[{ required: true, message: '노출 순서를 입력하세요.' }]}
          >
            <InputNumber min={1} max={5} style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item
            label="설정 방식"
            name="curationMode"
            rules={[{ required: true, message: '설정 방식을 선택하세요.' }]}
          >
            <Select options={faqCurationModeOptions} />
          </Form.Item>
          <Form.Item
            label="노출 상태"
            name="exposureStatus"
            rules={[{ required: true, message: '노출 상태를 선택하세요.' }]}
          >
            <Select options={faqCurationStatusOptions} />
          </Form.Item>
          <Form.Item label="노출 기간" name="pinnedDateRange" style={{ marginBottom: 0 }}>
            <RangePicker style={{ width: '100%' }} />
          </Form.Item>
        </Form>
      </Modal>

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

      <DetailDrawer
        open={Boolean(selectedFaq)}
        title={selectedFaq ? `FAQ 상세 · ${selectedFaq.id}` : 'FAQ 상세'}
        width={760}
        destroyOnHidden
        onClose={closeFaqDrawer}
        headerMeta={selectedFaq ? <StatusBadge status={selectedFaq.status} /> : null}
        footerStart={
          selectedFaq ? (
            <AuditLogLink targetType="OperationFaq" targetId={selectedFaq.id} />
          ) : null
        }
        footerEnd={
          selectedFaq ? (
            <Space wrap>
              <Button onClick={() => openFaqEditModal(selectedFaq)}>FAQ 수정</Button>
              <Button onClick={() => openCurationCreateModal(selectedFaq.id)}>
                노출 추가
              </Button>
              <Button
                onClick={() =>
                  setDangerState({
                    type: 'toggleFaqStatus',
                    faq: selectedFaq,
                    nextStatus: selectedFaq.status === '공개' ? '비공개' : '공개'
                  })
                }
              >
                {selectedFaq.status === '공개' ? '비공개 전환' : '공개 전환'}
              </Button>
              <Button
                danger
                onClick={() => setDangerState({ type: 'deleteFaq', faq: selectedFaq })}
              >
                FAQ 삭제
              </Button>
            </Space>
          ) : null
        }
      >
        {selectedFaq ? (
          <DetailDrawerBody>
            {selectedFaq.status === '비공개' && selectedFaqCurations.length > 0 ? (
              <Alert
                type="warning"
                showIcon
                message="비공개 FAQ에 연결된 노출 규칙이 있습니다."
                description="비공개 전환 시 관련 노출 규칙은 자동으로 대기 상태로 전환됩니다."
              />
            ) : null}

            <DetailDrawerSection title="FAQ 정보">
              <Descriptions bordered size="small" column={1} items={faqDrawerInfoItems} />
            </DetailDrawerSection>

            <DetailDrawerSection title="질문 / 답변">
              <Descriptions
                bordered
                size="small"
                column={1}
                items={[
                  { key: 'question', label: '질문', children: selectedFaq.question },
                  {
                    key: 'searchKeywords',
                    label: '검색 키워드',
                    children: joinKeywords(selectedFaq.searchKeywords) || '-'
                  },
                  {
                    key: 'answer',
                    label: '답변',
                    children: (
                      <Paragraph style={{ marginBottom: 0, whiteSpace: 'pre-wrap' }}>
                        {selectedFaq.answer}
                      </Paragraph>
                    )
                  }
                ]}
              />
            </DetailDrawerSection>

            <DetailDrawerSection
              title="노출 관리 요약"
              actions={
                <Button
                  type="primary"
                  size="large"
                  onClick={() => openCurationCreateModal(selectedFaq.id)}
                >
                  노출 추가
                </Button>
              }
            >
              {selectedFaqCurations.length === 0 ? (
                <Alert
                  type="info"
                  showIcon
                  message="연결된 노출 규칙이 없습니다."
                  description="홈 추천 FAQ나 고객센터 대표 FAQ로 노출하려면 규칙을 추가하세요."
                />
              ) : (
                <Descriptions
                  bordered
                  size="small"
                  column={1}
                  items={selectedFaqCurations.map((curation) => ({
                    key: curation.id,
                    label: curation.id,
                    children: (
                      <Space wrap>
                        <Tag color={getCurationStatusTagColor(curation.exposureStatus)}>
                          {getFaqCurationStatusLabel(curation.exposureStatus)}
                        </Tag>
                        <Text>{getFaqExposureSurfaceLabel(curation.surface)}</Text>
                        <Text type="secondary">{curation.displayRank}위</Text>
                        <Button type="link" onClick={() => openCurationDrawer(curation.id)}>
                          노출 상세 열기
                        </Button>
                      </Space>
                    )
                  }))}
                />
              )}
            </DetailDrawerSection>

            <DetailDrawerSection title="지표 요약">
              <Descriptions bordered size="small" column={1} items={faqMetricItems} />
            </DetailDrawerSection>
          </DetailDrawerBody>
        ) : null}
      </DetailDrawer>

      <DetailDrawer
        open={Boolean(selectedCuration)}
        title={selectedCuration ? `FAQ 노출 상세 · ${selectedCuration.id}` : 'FAQ 노출 상세'}
        width={720}
        destroyOnHidden
        onClose={closeCurationDrawer}
        headerMeta={
          selectedCuration ? (
            <Tag color={getCurationStatusTagColor(selectedCuration.exposureStatus)}>
              {getFaqCurationStatusLabel(selectedCuration.exposureStatus)}
            </Tag>
          ) : null
        }
        footerStart={
          selectedCuration ? (
            <AuditLogLink
              targetType="OperationFaqCuration"
              targetId={selectedCuration.id}
            />
          ) : null
        }
        footerEnd={
          selectedCuration ? (
            <Space wrap>
              <Button onClick={() => openCurationEditModal(selectedCuration)}>
                노출 수정
              </Button>
              <Button
                onClick={() =>
                  setDangerState({
                    type: 'toggleCurationStatus',
                    curation: selectedCuration,
                    nextStatus:
                      selectedCuration.exposureStatus === 'active'
                        ? 'paused'
                        : 'active'
                  })
                }
              >
                {selectedCuration.exposureStatus === 'active'
                  ? '노출 일시중지'
                  : '노출 재개'}
              </Button>
              <Button
                danger
                onClick={() =>
                  setDangerState({
                    type: 'deleteCuration',
                    curation: selectedCuration
                  })
                }
              >
                노출 삭제
              </Button>
            </Space>
          ) : null
        }
      >
        {selectedCuration ? (
          <DetailDrawerBody>
            <DetailDrawerSection title="노출 규칙">
              <Descriptions bordered size="small" column={1} items={curationDrawerItems} />
            </DetailDrawerSection>

            <DetailDrawerSection
              title="연결 FAQ"
              actions={
                selectedCuration.faq ? (
                  <Button
                    type="primary"
                    size="large"
                    onClick={() => openFaqDrawer(selectedCuration.faqId)}
                  >
                    FAQ 상세 열기
                  </Button>
                ) : null
              }
            >
              <Descriptions bordered size="small" column={1} items={curationLinkedFaqItems} />
            </DetailDrawerSection>

            <DetailDrawerSection title="지표 참고">
              <Descriptions
                bordered
                size="small"
                column={1}
                items={[
                  {
                    key: 'viewCount',
                    label: '조회수',
                    children:
                      metricRows
                        .find((metric) => metric.faqId === selectedCuration.faqId)
                        ?.viewCount.toLocaleString() ?? '-'
                  },
                  {
                    key: 'searchHitCount',
                    label: '검색 유입',
                    children:
                      metricRows
                        .find((metric) => metric.faqId === selectedCuration.faqId)
                        ?.searchHitCount.toLocaleString() ?? '-'
                  },
                  {
                    key: 'helpfulRatio',
                    label: '도움됨 비율',
                    children: formatMetricRatio(
                      metricRows.find((metric) => metric.faqId === selectedCuration.faqId) ??
                        null
                    )
                  }
                ]}
              />
            </DetailDrawerSection>
          </DetailDrawerBody>
        ) : null}
      </DetailDrawer>
    </div>
  );
}
