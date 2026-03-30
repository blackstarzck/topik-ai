import {
  Alert,
  Button,
  Descriptions,
  Select,
  Space,
  Typography,
  notification
} from 'antd';
import type { SortOrder, TableColumnsType, TableProps } from 'antd';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom';

import {
  deletePolicySafe,
  fetchPoliciesSafe,
  fetchPolicyHistorySafe,
  publishPolicyHistoryVersionSafe,
  togglePolicyStatusSafe
} from '../api/policies-service';
import type {
  OperationPolicy,
  OperationPolicyCategory,
  OperationPolicyHistoryEntry,
  OperationPolicyStatus,
  OperationPolicyTrackingStatus,
  OperationPolicyType
} from '../model/policy-types';
import {
  operationPolicyCategoryValues,
  operationPolicyTrackingStatusValues,
  operationPolicyTypeValues
} from '../model/policy-types';
import type { AsyncState } from '../../../shared/model/async-state';
import { getTargetTypeLabel } from '../../../shared/model/target-type-label';
import { AuditLogLink } from '../../../shared/ui/audit-log-link/audit-log-link';
import { ConfirmAction } from '../../../shared/ui/confirm-action/confirm-action';
import {
  DetailDrawer,
  DetailDrawerBody,
  DetailDrawerSection
} from '../../../shared/ui/detail-drawer/detail-drawer';
import { HtmlPreviewModal } from '../../../shared/ui/html-preview-modal/html-preview-modal';
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
  matchesSearchField,
  parseSearchDate
} from '../../../shared/ui/search-bar/search-bar-utils';
import { AdminDataTable } from '../../../shared/ui/table/admin-data-table';
import { BinaryStatusSwitch } from '../../../shared/ui/table/binary-status-switch';
import { createStatusColumnTitle } from '../../../shared/ui/table/status-column-title';
import {
  createDefinedColumnFilterProps,
  createTextSorter
} from '../../../shared/ui/table/table-column-utils';

const { Paragraph, Text } = Typography;

const policyStatusFilterValues = ['게시', '숨김'] as const;
const policySortableFieldValues = [
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

type PolicySortField = (typeof policySortableFieldValues)[number];
type PolicySummaryFilter = 'published' | 'operational' | 'pending';

type PolicyActionState = {
  policy: OperationPolicy;
  nextStatus: OperationPolicyStatus;
} | null;

type PolicyPreviewState = {
  title: string;
  bodyHtml: string;
  editTarget?: OperationPolicy;
} | null;

type PolicyHistoryPublishState = {
  policy: OperationPolicy;
  historyEntry: OperationPolicyHistoryEntry;
} | null;

function parsePolicyStatus(value: string | null): OperationPolicyStatus | null {
  if (value === '게시' || value === '숨김') {
    return value;
  }

  return null;
}

function parsePolicyType(value: string | null): OperationPolicyType | null {
  if (
    value &&
    operationPolicyTypeValues.includes(value as OperationPolicyType)
  ) {
    return value as OperationPolicyType;
  }

  return null;
}

function parsePolicyCategory(value: string | null): OperationPolicyCategory | null {
  if (
    value &&
    operationPolicyCategoryValues.includes(value as OperationPolicyCategory)
  ) {
    return value as OperationPolicyCategory;
  }

  return null;
}

function parseTrackingStatus(
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

function parsePolicySummaryFilter(
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

function parseSortField(value: string | null): PolicySortField | null {
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

function parseSortOrder(value: string | null): SortOrder | null {
  if (value === 'ascend' || value === 'descend') {
    return value;
  }

  return null;
}

function getActionCopy(nextStatus: OperationPolicyStatus) {
  if (nextStatus === '게시') {
    return {
      title: '?뺤콉 게시',
      description:
        '숨김 상태 ?뺤콉??게시?⑸땲?? ?쒗뻾?쇨낵 사용자?몄텧 ?꾩튂瑜??ㅼ떆 ?뺤씤????사유瑜??④꺼二쇱꽭??',
      confirmText: '게시 ?ㅽ뻾',
      successMessage: '?뺤콉 게시 완료'
    };
  }

  return {
    title: '?뺤콉 숨김',
    description:
      '게시 以묒씤 ?뺤콉 노출을 중단합니다. 숨김 사유瑜??④꺼二쇱꽭??',
    confirmText: '숨김 실행',
    successMessage: '?뺤콉 숨김 완료'
  };
}

function getHistoryActionLabel(action: OperationPolicyHistoryEntry['action']) {
  switch (action) {
    case 'created':
      return '?깅줉';
    case 'updated':
      return '?섏젙';
    case 'status_changed':
      return '상태 蹂寃?;
    case 'version_published':
      return '?대젰 踰꾩쟾 게시';
    case 'deleted':
      return '??젣';
    default:
      return action;
  }
}

function createInitialHistoryState(): AsyncState<OperationPolicyHistoryEntry[]> {
  return {
    status: 'success',
    data: [],
    errorMessage: null,
    errorCode: null
  };
}

export default function OperationPoliciesPage(): JSX.Element {
  const location = useLocation();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const statusFilter = parsePolicyStatus(searchParams.get('status'));
  const categoryFilter = parsePolicyCategory(searchParams.get('category'));
  const policyTypeFilter = parsePolicyType(searchParams.get('policyType'));
  const trackingStatusFilter = parseTrackingStatus(
    searchParams.get('trackingStatus')
  );
  const summaryFilter = parsePolicySummaryFilter(searchParams.get('summaryFilter'));
  const sortField = parseSortField(searchParams.get('sortField'));
  const sortOrder = parseSortOrder(searchParams.get('sortOrder'));
  const searchField = searchParams.get('searchField') ?? 'all';
  const keyword = searchParams.get('keyword') ?? '';
  const startDate = parseSearchDate(searchParams.get('startDate'));
  const endDate = parseSearchDate(searchParams.get('endDate'));
  const selectedPolicyId = searchParams.get('selected');
  const [policiesState, setPoliciesState] = useState<AsyncState<OperationPolicy[]>>({
    status: 'pending',
    data: [],
    errorMessage: null,
    errorCode: null
  });
  const [reloadKey, setReloadKey] = useState(0);
  const [actionState, setActionState] = useState<PolicyActionState>(null);
  const [previewState, setPreviewState] = useState<PolicyPreviewState>(null);
  const [deleteTarget, setDeleteTarget] = useState<OperationPolicy | null>(null);
  const [historyPublishState, setHistoryPublishState] =
    useState<PolicyHistoryPublishState>(null);
  const [historyReloadKey, setHistoryReloadKey] = useState(0);
  const [policyHistoryState, setPolicyHistoryState] = useState<
    AsyncState<OperationPolicyHistoryEntry[]>
  >(createInitialHistoryState);
  const [draftCategory, setDraftCategory] = useState(categoryFilter ?? '');
  const [draftPolicyType, setDraftPolicyType] = useState(policyTypeFilter ?? '');
  const [draftTrackingStatus, setDraftTrackingStatus] = useState(
    trackingStatusFilter ?? ''
  );
  const [notificationApi, notificationContextHolder] = notification.useNotification();
  const {
    draftStartDate,
    draftEndDate,
    handleDraftDateChange,
    handleDraftReset,
    handleDetailOpenChange
  } = useSearchBarDateDraft(startDate, endDate);

  const listSearch = useMemo(() => {
    const nextSearchParams = new URLSearchParams(searchParams);
    nextSearchParams.delete('selected');
    const search = nextSearchParams.toString();
    return search ? `?${search}` : '';
  }, [searchParams]);

  const commitParams = useCallback(
    (
      next: Partial<
        Record<
          | 'status'
          | 'category'
          | 'policyType'
          | 'trackingStatus'
          | 'summaryFilter'
          | 'sortField'
          | 'sortOrder'
          | 'searchField'
          | 'keyword'
          | 'startDate'
          | 'endDate'
          | 'selected',
          string | null
        >
      >
    ) => {
      const merged = new URLSearchParams(searchParams);

      Object.entries(next).forEach(([key, value]) => {
        if (!value || value === 'all') {
          merged.delete(key);
          return;
        }

        merged.set(key, value);
      });

      setSearchParams(merged, { replace: true });
    },
    [searchParams, setSearchParams]
  );

  useEffect(() => {
    const controller = new AbortController();

    setPoliciesState((prev) => ({
      ...prev,
      status: 'pending',
      errorMessage: null,
      errorCode: null
    }));

    void fetchPoliciesSafe(controller.signal).then((result) => {
      if (controller.signal.aborted) {
        return;
      }

      if (result.ok) {
        setPoliciesState({
          status: result.data.length === 0 ? 'empty' : 'success',
          data: result.data,
          errorMessage: null,
          errorCode: null
        });
        return;
      }

      setPoliciesState((prev) => ({
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

  useEffect(() => {
    const state = location.state as
      | {
        operationPolicySaved?: {
          policyId: string;
          mode: 'create' | 'edit' | 'version';
        };
      }
      | null;

    if (!state?.operationPolicySaved) {
      return;
    }

    const successMessage =
      state.operationPolicySaved.mode === 'create'
        ? '?類ㅼ퐠 ?源낆쨯 ?袁⑥┷'
        : state.operationPolicySaved.mode === 'version'
          ? '?뺤콉 ??踰꾩쟾 ?깅줉 완료'
          : '?뺤콉 내용 ?섏젙 완료';
    const successReason =
      state.operationPolicySaved.mode === 'create'
        ? '?醫됲뇣 ?類ㅼ퐠 ?????λ뜃由??怨밴묶: ???)'
        : state.operationPolicySaved.mode === 'version'
          ? '湲곗〈 ?뺤콉 湲곗? ??踰꾩쟾 ?깅줉(珥덇린 상태: 숨김)'
          : '?뺤콉 硫뷀?/蹂몃Ц 내용 ?섏젙';

    notificationApi.success({
      message: successMessage,
      description: (
        <Space direction="vertical">
          <Text>대상?좏삎: {getTargetTypeLabel('OperationPolicy')}</Text>
          <Text>대상ID: {state.operationPolicySaved.policyId}</Text>
          <Text>사유/洹쇨굅: {successReason}</Text>
          <AuditLogLink
            targetType="OperationPolicy"
            targetId={state.operationPolicySaved.policyId}
          />
        </Space>
      )
    });

    navigate(
      {
        pathname: location.pathname,
        search: location.search
      },
      {
        replace: true,
        state: null
      }
    );
  }, [location.pathname, location.search, location.state, navigate, notificationApi]);

  useEffect(() => {
    setDraftCategory(categoryFilter ?? '');
  }, [categoryFilter]);

  useEffect(() => {
    setDraftPolicyType(policyTypeFilter ?? '');
  }, [policyTypeFilter]);

  useEffect(() => {
    setDraftTrackingStatus(trackingStatusFilter ?? '');
  }, [trackingStatusFilter]);

  useEffect(() => {
    if (!selectedPolicyId) {
      setPolicyHistoryState(createInitialHistoryState());
      return;
    }

    const controller = new AbortController();

    setPolicyHistoryState((prev) => ({
      ...prev,
      status: 'pending',
      errorMessage: null,
      errorCode: null
    }));

    void fetchPolicyHistorySafe(selectedPolicyId, controller.signal).then((result) => {
      if (controller.signal.aborted) {
        return;
      }

      if (result.ok) {
        setPolicyHistoryState({
          status: result.data.length === 0 ? 'empty' : 'success',
          data: result.data,
          errorMessage: null,
          errorCode: null
        });
        return;
      }

      setPolicyHistoryState((prev) => ({
        ...prev,
        status: 'error',
        errorMessage: result.error.message,
        errorCode: result.error.code
      }));
    });

    return () => {
      controller.abort();
    };
  }, [historyReloadKey, selectedPolicyId]);

  const filteredPolicies = useMemo(() => {
    return policiesState.data.filter((policy) => {
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
        policy.category === '踰뺣쪧/?쎄?'
      ) {
        return false;
      }

      if (
        summaryFilter === 'pending' &&
        policy.trackingStatus !== '?뺤콉 誘명솗??
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
  }, [
    endDate,
    categoryFilter,
    keyword,
    policiesState.data,
    policyTypeFilter,
    searchField,
    summaryFilter,
    startDate,
    statusFilter,
    trackingStatusFilter
  ]);

  useEffect(() => {
    if (!selectedPolicyId) {
      return;
    }

    const canValidateSelection =
      policiesState.status === 'success' ||
      policiesState.status === 'empty' ||
      (policiesState.status === 'error' && policiesState.data.length > 0);

    if (!canValidateSelection) {
      return;
    }

    const hasSelectedTarget = filteredPolicies.some(
      (policy) => policy.id === selectedPolicyId
    );

    if (hasSelectedTarget) {
      return;
    }

    commitParams({ selected: null });
  }, [commitParams, filteredPolicies, policiesState.data.length, policiesState.status, selectedPolicyId]);

  const selectedPolicy = useMemo(
    () =>
      selectedPolicyId
        ? filteredPolicies.find((policy) => policy.id === selectedPolicyId) ?? null
        : null,
    [filteredPolicies, selectedPolicyId]
  );

  const policySummaryCards = useMemo(() => {
    const publishedCount = policiesState.data.filter(
      (policy) => policy.status === '게시'
    ).length;
    const operationalPolicyCount = policiesState.data.filter(
      (policy) => policy.category !== '踰뺣쪧/?쎄?'
    ).length;
    const policyPendingCount = policiesState.data.filter(
      (policy) => policy.trackingStatus === '?뺤콉 誘명솗??
    ).length;
    const currentSummaryFilter = summaryFilter ?? 'all';

    return [
      {
        key: 'all',
        label: '전체 ?뺤콉',
        value: `${policiesState.data.length.toLocaleString()}嫄?,
        active: currentSummaryFilter === 'all',
        onClick: () => commitParams({ summaryFilter: null, selected: null })
      },
      {
        key: 'published',
        label: '게시 以?,
        value: `${publishedCount.toLocaleString()}嫄?,
        active: currentSummaryFilter === 'published',
        onClick: () =>
          commitParams({ summaryFilter: 'published', selected: null })
      },
      {
        key: 'operational',
        label: '운영 ?뺤콉',
        value: `${operationalPolicyCount.toLocaleString()}嫄?,
        active: currentSummaryFilter === 'operational',
        onClick: () =>
          commitParams({ summaryFilter: 'operational', selected: null })
      },
      {
        key: 'pending',
        label: '?뺤콉 誘명솗??,
        value: `${policyPendingCount.toLocaleString()}嫄?,
        active: currentSummaryFilter === 'pending',
        onClick: () => commitParams({ summaryFilter: 'pending', selected: null })
      }
    ];
  }, [commitParams, policiesState.data, summaryFilter]);

  const openCreateDetail = useCallback(() => {
    navigate({
      pathname: '/operation/policies/create',
      search: listSearch
    });
  }, [listSearch, navigate]);

  const openEditDetail = useCallback(
    (policy: OperationPolicy) => {
      navigate({
        pathname: `/operation/policies/create/${policy.id}`,
        search: listSearch
      });
    },
    [listSearch, navigate]
  );

  const openVersionCreateDetail = useCallback(
    (policy: OperationPolicy) => {
      const nextSearchParams = new URLSearchParams(listSearch);
      nextSearchParams.set('mode', 'version');
      nextSearchParams.set('sourcePolicyId', policy.id);

      navigate({
        pathname: '/operation/policies/create',
        search: `?${nextSearchParams.toString()}`
      });
    },
    [listSearch, navigate]
  );

  const openCurrentPreview = useCallback((policy: OperationPolicy) => {
    setPreviewState({
      title: `?뺤콉 蹂몃Ц 誘몃━蹂닿린 쨌 ${policy.id}`,
      bodyHtml: policy.bodyHtml,
      editTarget: policy
    });
  }, []);

  const openHistoryPreview = useCallback(
    (historyEntry: OperationPolicyHistoryEntry) => {
      setPreviewState({
        title: `?뺤콉 蹂몃Ц 誘몃━蹂닿린 쨌 ${historyEntry.versionLabel}`,
        bodyHtml: historyEntry.snapshot.bodyHtml
      });
    },
    []
  );

  const openDetail = useCallback(
    (policy: OperationPolicy) => {
      commitParams({ selected: policy.id });
    },
    [commitParams]
  );

  const closeDetail = useCallback(() => {
    commitParams({ selected: null });
  }, [commitParams]);

  const promptToggleStatus = useCallback((policy: OperationPolicy) => {
    setActionState({
      policy,
      nextStatus: policy.status === '게시' ? '숨김' : '게시'
    });
  }, []);

  const promptDeletePolicy = useCallback((policy: OperationPolicy) => {
    setDeleteTarget(policy);
  }, []);

  const promptPublishHistoryVersion = useCallback(
    (policy: OperationPolicy, historyEntry: OperationPolicyHistoryEntry) => {
      setHistoryPublishState({ policy, historyEntry });
    },
    []
  );

  const closeActionModal = useCallback(() => setActionState(null), []);
  const closePreviewModal = useCallback(() => setPreviewState(null), []);
  const closeDeleteModal = useCallback(() => setDeleteTarget(null), []);
  const closeHistoryPublishModal = useCallback(
    () => setHistoryPublishState(null),
    []
  );
  const handleReload = useCallback(() => setReloadKey((prev) => prev + 1), []);
  const handleReloadHistory = useCallback(
    () => setHistoryReloadKey((prev) => prev + 1),
    []
  );

  const handleApplyDetailFilters = useCallback(() => {
    commitParams({
      category: draftCategory || null,
      policyType: draftPolicyType || null,
      trackingStatus: draftTrackingStatus || null,
      startDate: draftStartDate || null,
      endDate: draftEndDate || null,
      selected: null
    });
  }, [
    commitParams,
    draftCategory,
    draftEndDate,
    draftPolicyType,
    draftStartDate,
    draftTrackingStatus
  ]);

  const handleResetDetailFilters = useCallback(() => {
    setDraftCategory('');
    setDraftPolicyType('');
    setDraftTrackingStatus('');
    handleDraftReset();
  }, [handleDraftReset]);

  const handleSearchBarDetailOpenChange = useCallback(
    (open: boolean) => {
      handleDetailOpenChange(open);

      if (!open) {
        setDraftCategory(categoryFilter ?? '');
        setDraftPolicyType(policyTypeFilter ?? '');
        setDraftTrackingStatus(trackingStatusFilter ?? '');
      }
    },
    [categoryFilter, handleDetailOpenChange, policyTypeFilter, trackingStatusFilter]
  );

  const handleAction = useCallback(
    async (reason: string) => {
      if (!actionState) {
        return;
      }

      const result = await togglePolicyStatusSafe({
        policyId: actionState.policy.id,
        nextStatus: actionState.nextStatus
      });

      if (!result.ok) {
        notificationApi.error({
          message:
            actionState.nextStatus === '게시'
              ? '?뺤콉 게시 실패'
              : '?뺤콉 숨김 실패',
          description: (
            <Space direction="vertical">
              <Text>{result.error.message}</Text>
              <Text type="secondary">?ㅻ쪟 肄붾뱶: {result.error.code}</Text>
            </Space>
          )
        });
        return;
      }

      setPoliciesState((prev) => ({
        status: prev.data.length === 0 ? 'empty' : 'success',
        data: prev.data.map((policy) =>
          policy.id === result.data.id ? result.data : policy
        ),
        errorMessage: null,
        errorCode: null
      }));

      notificationApi.success({
        message: getActionCopy(actionState.nextStatus).successMessage,
        description: (
          <Space direction="vertical">
            <Text>대상?좏삎: {getTargetTypeLabel('OperationPolicy')}</Text>
            <Text>대상ID: {result.data.id}</Text>
            <Text>사유/洹쇨굅: {reason}</Text>
            <AuditLogLink
              targetType="OperationPolicy"
              targetId={result.data.id}
            />
          </Space>
        )
      });

      setHistoryReloadKey((prev) => prev + 1);
      setActionState(null);
    },
    [actionState, notificationApi]
  );

  const handleDeletePolicy = useCallback(
    async (reason: string) => {
      if (!deleteTarget) {
        return;
      }

      const result = await deletePolicySafe({
        policyId: deleteTarget.id,
        reason
      });

      if (!result.ok) {
        notificationApi.error({
          message: '?뺤콉 ??젣 실패',
          description: (
            <Space direction="vertical">
              <Text>{result.error.message}</Text>
              <Text type="secondary">?ㅻ쪟 肄붾뱶: {result.error.code}</Text>
            </Space>
          )
        });
        return;
      }

      setPoliciesState((prev) => {
        const nextPolicies = prev.data.filter(
          (policy) => policy.id !== result.data.id
        );

        return {
          status: nextPolicies.length === 0 ? 'empty' : 'success',
          data: nextPolicies,
          errorMessage: null,
          errorCode: null
        };
      });

      if (previewState?.editTarget?.id === result.data.id) {
        setPreviewState(null);
      }

      commitParams({ selected: null });
      setDeleteTarget(null);

      notificationApi.success({
        message: '?뺤콉 ??젣 완료',
        description: (
          <Space direction="vertical">
            <Text>대상?좏삎: {getTargetTypeLabel('OperationPolicy')}</Text>
            <Text>대상ID: {result.data.id}</Text>
            <Text>사유/洹쇨굅: {reason}</Text>
            <AuditLogLink
              targetType="OperationPolicy"
              targetId={result.data.id}
            />
          </Space>
        )
      });
    },
    [
      commitParams,
      deleteTarget,
      notificationApi,
      previewState?.editTarget?.id
    ]
  );

  const handlePublishHistoryVersion = useCallback(
    async (reason: string) => {
      if (!historyPublishState) {
        return;
      }

      const result = await publishPolicyHistoryVersionSafe({
        policyId: historyPublishState.policy.id,
        historyId: historyPublishState.historyEntry.id,
        reason
      });

      if (!result.ok) {
        notificationApi.error({
          message: '??踰꾩쟾 게시 실패',
          description: (
            <Space direction="vertical">
              <Text>{result.error.message}</Text>
              <Text type="secondary">?ㅻ쪟 肄붾뱶: {result.error.code}</Text>
            </Space>
          )
        });
        return;
      }

      setPoliciesState((prev) => ({
        status: prev.data.length === 0 ? 'empty' : 'success',
        data: prev.data.map((policy) =>
          policy.id === result.data.id ? result.data : policy
        ),
        errorMessage: null,
        errorCode: null
      }));

      if (previewState?.editTarget?.id === result.data.id) {
        setPreviewState({
          title: `?뺤콉 蹂몃Ц 誘몃━蹂닿린 쨌 ${result.data.id}`,
          bodyHtml: result.data.bodyHtml,
          editTarget: result.data
        });
      }

      notificationApi.success({
        message: '??踰꾩쟾 게시 완료',
        description: (
          <Space direction="vertical">
            <Text>대상?좏삎: {getTargetTypeLabel('OperationPolicy')}</Text>
            <Text>대상ID: {result.data.id}</Text>
            <Text>게시 踰꾩쟾: {historyPublishState.historyEntry.versionLabel}</Text>
            <Text>사유/洹쇨굅: {reason}</Text>
            <AuditLogLink
              targetType="OperationPolicy"
              targetId={result.data.id}
            />
          </Space>
        )
      });

      setHistoryReloadKey((prev) => prev + 1);
      setHistoryPublishState(null);
    },
    [historyPublishState, notificationApi, previewState?.editTarget?.id]
  );

  const columns = useMemo<TableColumnsType<OperationPolicy>>(
    () => [
      {
        title: '?뺤콉 ID',
        dataIndex: 'id',
        width: 120,
        sorter: createTextSorter((record) => record.id),
        sortOrder: sortField === 'id' ? sortOrder : null
      },
      {
        title: '운영 ?곸뿭',
        dataIndex: 'category',
        width: 140,
        sorter: createTextSorter((record) => record.category),
        sortOrder: sortField === 'category' ? sortOrder : null
      },
      {
        title: '?뺤콉 ?좏삎',
        dataIndex: 'policyType',
        width: 210,
        sorter: createTextSorter((record) => record.policyType),
        sortOrder: sortField === 'policyType' ? sortOrder : null
      },
      {
        title: '臾몄꽌紐?,
        dataIndex: 'title',
        width: 260,
        sorter: createTextSorter((record) => record.title),
        sortOrder: sortField === 'title' ? sortOrder : null
      },
      {
        title: '異붿쟻 상태',
        dataIndex: 'trackingStatus',
        width: 130,
        sorter: createTextSorter((record) => record.trackingStatus),
        sortOrder: sortField === 'trackingStatus' ? sortOrder : null
      },
      {
        title: '踰꾩쟾',
        dataIndex: 'versionLabel',
        width: 110,
        sorter: createTextSorter((record) => record.versionLabel),
        sortOrder: sortField === 'versionLabel' ? sortOrder : null
      },
      {
        title: '?쒗뻾??,
        dataIndex: 'effectiveDate',
        width: 120,
        sorter: createTextSorter((record) => record.effectiveDate),
        sortOrder: sortField === 'effectiveDate' ? sortOrder : null
      },
      {
        title: createStatusColumnTitle('상태', ['게시', '숨김']),
        dataIndex: 'status',
        width: 132,
        filteredValue: statusFilter ? [statusFilter] : null,
        ...createDefinedColumnFilterProps(policyStatusFilterValues, (record) => record.status),
        sorter: createTextSorter((record) => record.status),
        sortOrder: sortField === 'status' ? sortOrder : null,
        onCell: () => ({
          onClick: (event) => {
            event.stopPropagation();
          }
        }),
        render: (_, record) => (
          <BinaryStatusSwitch
            checked={record.status === '게시'}
            checkedLabel="게시"
            uncheckedLabel="숨김"
            onToggle={() => promptToggleStatus(record)}
          />
        )
      },
      {
        title: '최근 수정',
        dataIndex: 'updatedAt',
        width: 160,
        sorter: createTextSorter((record) => record.updatedAt),
        sortOrder: sortField === 'updatedAt' ? sortOrder : null
      },
      {
        title: '?섏젙??,
        dataIndex: 'updatedBy',
        width: 130,
        render: (updatedBy: string) => (
          <Link
            className="table-navigation-link"
            to={`/system/admins?keyword=${updatedBy}`}
            onClick={(event) => event.stopPropagation()}
          >
            {updatedBy}
          </Link>
        )
      }
    ],
    [promptToggleStatus, sortField, sortOrder, statusFilter]
  );

  const historyColumns = useMemo<TableColumnsType<OperationPolicyHistoryEntry>>(
    () => [
      {
        title: '踰꾩쟾',
        dataIndex: 'versionLabel',
        width: 120
      },
      {
        title: '상태',
        dataIndex: 'status',
        width: 120
      },
      {
        title: '蹂寃??좏삎',
        dataIndex: 'action',
        width: 130,
        render: (action: OperationPolicyHistoryEntry['action']) =>
          getHistoryActionLabel(action)
      },
      {
        title: '蹂寃?시각',
        dataIndex: 'changedAt',
        width: 160
      },
      {
        title: '?섏젙??,
        dataIndex: 'changedBy',
        width: 140
      },
      {
        title: '?≪뀡',
        key: 'actions',
        width: 200,
        onCell: () => ({
          onClick: (event) => {
            event.stopPropagation();
          }
        }),
        render: (_, entry) => (
          <Space size={8}>
            <Button
              size="small"
              onClick={(event) => {
                event.stopPropagation();
                openHistoryPreview(entry);
              }}
            >
              蹂몃Ц 蹂닿린
            </Button>
            <Button
              size="small"
              type="primary"
              onClick={(event) => {
                event.stopPropagation();
                if (!selectedPolicy) {
                  return;
                }

                promptPublishHistoryVersion(selectedPolicy, entry);
              }}
            >
              ??踰꾩쟾 게시
            </Button>
          </Space>
        )
      }
    ],
    [openHistoryPreview, promptPublishHistoryVersion, selectedPolicy]
  );

  const renderHistoryExpandedRow = useCallback(
    (entry: OperationPolicyHistoryEntry) => {
      const snapshot = entry.snapshot;

      return (
        <Descriptions
          bordered
          size="small"
          column={2}
          items={[
            {
              key: 'action',
              label: '蹂寃??좏삎',
              children: getHistoryActionLabel(entry.action)
            },
            {
              key: 'trackingStatus',
              label: '異붿쟻 상태',
              children: snapshot.trackingStatus
            },
            {
              key: 'effectiveDate',
              label: '?쒗뻾??,
              children: snapshot.effectiveDate
            },
            {
              key: 'requiresConsent',
              label: '?숈쓽 ?꾩슂',
              children: snapshot.requiresConsent ? '?? : '?꾨땲??
            },
            {
              key: 'category',
              label: '운영 ?곸뿭',
              children: snapshot.category
            },
            {
              key: 'policyType',
              label: '?뺤콉 ?좏삎',
              children: snapshot.policyType
            },
            {
              key: 'summary',
              label: '踰꾩쟾 ?붿빟',
              span: 2,
              children: snapshot.summary || '?깅줉???붿빟???놁뒿?덈떎.'
            },
            {
              key: 'exposureSurfaces',
              label: '?몄텧 ?꾩튂',
              span: 2,
              children:
                snapshot.exposureSurfaces.length > 0
                  ? snapshot.exposureSurfaces.join(', ')
                  : '?깅줉???몄텧 ?꾩튂媛 ?놁뒿?덈떎.'
            },
            {
              key: 'relatedAdminPages',
              label: '?곌? 愿由ъ옄 ?붾㈃',
              span: 2,
              children:
                snapshot.relatedAdminPages.length > 0 ? (
                  <ul style={{ margin: 0, paddingInlineStart: 18 }}>
                    {snapshot.relatedAdminPages.map((pageName) => (
                      <li key={pageName}>{pageName}</li>
                    ))}
                  </ul>
                ) : (
                  '?깅줉???곌? 愿由ъ옄 ?붾㈃???놁뒿?덈떎.'
                )
            },
            {
              key: 'relatedUserPages',
              label: '?곌? 사용자?붾㈃',
              span: 2,
              children:
                snapshot.relatedUserPages.length > 0 ? (
                  <ul style={{ margin: 0, paddingInlineStart: 18 }}>
                    {snapshot.relatedUserPages.map((pageName) => (
                      <li key={pageName}>{pageName}</li>
                    ))}
                  </ul>
                ) : (
                  '?깅줉???곌? 사용자?붾㈃???놁뒿?덈떎.'
                )
            },
            {
              key: 'sourceDocuments',
              label: '異붿쟻 洹쇨굅 臾몄꽌',
              span: 2,
              children:
                snapshot.sourceDocuments.length > 0 ? (
                  <ul style={{ margin: 0, paddingInlineStart: 18 }}>
                    {snapshot.sourceDocuments.map((documentPath) => (
                      <li key={documentPath}>
                        <Text code>{documentPath}</Text>
                      </li>
                    ))}
                  </ul>
                ) : (
                  '?깅줉??異붿쟻 洹쇨굅 臾몄꽌媛 ?놁뒿?덈떎.'
                )
            },
            {
              key: 'legalReferences',
              label: '踰뺣졊 諛?洹쇨굅',
              span: 2,
              children:
                snapshot.legalReferences.length > 0 ? (
                  <ul style={{ margin: 0, paddingInlineStart: 18 }}>
                    {snapshot.legalReferences.map((reference) => (
                      <li key={reference}>{reference}</li>
                    ))}
                  </ul>
                ) : (
                  '?깅줉??踰뺣졊 諛?洹쇨굅媛 ?놁뒿?덈떎.'
                )
            },
            {
              key: 'note',
              label: '蹂寃?사유',
              span: 2,
              children: entry.note || '湲곕줉??硫붾え媛 ?놁뒿?덈떎.'
            }
          ]}
        />
      );
    },
    []
  );

  const handleTableChange = useCallback<NonNullable<TableProps<OperationPolicy>['onChange']>>(
    (_, filters, sorter) => {
      const nextStatusFilter = Array.isArray(filters.status)
        ? String(filters.status[0] ?? '')
        : '';
      const nextSorter = Array.isArray(sorter) ? sorter[0] : sorter;
      const nextField =
        nextSorter && typeof nextSorter.field === 'string'
          ? parseSortField(nextSorter.field)
          : null;

      commitParams({
        status: nextStatusFilter || null,
        sortField: nextField,
        sortOrder: nextField ? nextSorter?.order ?? null : null,
        selected: null
      });
    },
    [commitParams]
  );

  const handleRowClick = useCallback(
    (record: OperationPolicy) => ({
      onClick: () => openDetail(record),
      style: { cursor: 'pointer' }
    }),
    [openDetail]
  );

  const hasCachedPolicies = policiesState.data.length > 0;
  const isFilteredEmpty =
    policiesState.status !== 'empty' &&
    policiesState.data.length > 0 &&
    filteredPolicies.length === 0;

  return (
    <div>
      {notificationContextHolder}
      <PageTitle title="?뺤콉 愿由? />
      <ListSummaryCards items={policySummaryCards} />

      <AdminListCard
        toolbar={
          <SearchBar
            searchField={searchField}
            searchFieldOptions={[
              { label: '전체', value: 'all' },
              { label: '?뺤콉 ID', value: 'id' },
              { label: '운영 ?곸뿭', value: 'category' },
              { label: '臾몄꽌紐?, value: 'title' },
              { label: '異붿쟻 상태', value: 'trackingStatus' },
              { label: '?곌? 愿由ъ옄 ?붾㈃', value: 'relatedAdminPages' },
              { label: '?곌? 사용자?붾㈃', value: 'relatedUserPages' },
              { label: '異붿쟻 臾몄꽌', value: 'sourceDocuments' },
              { label: '踰꾩쟾', value: 'versionLabel' },
              { label: '踰뺣졊/洹쇨굅', value: 'legalReferences' }
            ]}
            keyword={keyword}
            onSearchFieldChange={(value) =>
              commitParams({ searchField: value, selected: null })
            }
            onKeywordChange={(event) =>
              commitParams({
                keyword: event.target.value,
                searchField,
                selected: null
              })
            }
            keywordPlaceholder="?뺤콉 ID, 臾몄꽌紐? 踰꾩쟾, 踰뺣졊/洹쇨굅 寃??
            detailTitle="상세 ?꾪꽣"
            detailContent={
              <>
                <SearchBarDetailField label="운영 ?곸뿭">
                  <Select
                    allowClear
                    value={draftCategory || undefined}
                    options={operationPolicyCategoryValues.map((value) => ({
                      label: value,
                      value
                    }))}
                    placeholder="운영 ?곸뿭 ?좏깮"
                    onChange={(value) => setDraftCategory(value ?? '')}
                  />
                </SearchBarDetailField>
                <SearchBarDetailField label="?뺤콉 ?좏삎">
                  <Select
                    allowClear
                    value={draftPolicyType || undefined}
                    options={operationPolicyTypeValues.map((value) => ({
                      label: value,
                      value
                    }))}
                    placeholder="?뺤콉 ?좏삎 ?좏깮"
                    onChange={(value) => setDraftPolicyType(value ?? '')}
                  />
                </SearchBarDetailField>
                <SearchBarDetailField label="異붿쟻 상태">
                  <Select
                    allowClear
                    value={draftTrackingStatus || undefined}
                    options={operationPolicyTrackingStatusValues.map((value) => ({
                      label: value,
                      value
                    }))}
                    placeholder="異붿쟻 상태 ?좏깮"
                    onChange={(value) => setDraftTrackingStatus(value ?? '')}
                  />
                </SearchBarDetailField>
                <SearchBarDetailField label="?쒗뻾??>
                  <SearchBarDateRange
                    startDate={draftStartDate}
                    endDate={draftEndDate}
                    onChange={handleDraftDateChange}
                  />
                </SearchBarDetailField>
              </>
            }
            onApply={handleApplyDetailFilters}
            onDetailOpenChange={handleSearchBarDetailOpenChange}
            onReset={handleResetDetailFilters}
            summary={
              <Text type="secondary">
                珥?{filteredPolicies.length.toLocaleString()}嫄?              </Text>
            }
            actions={
              <Button type="primary" size="large" onClick={openCreateDetail}>
                ???뺤콉 ?깅줉
              </Button>
            }
          />
        }
      >
        {policiesState.status === 'error' ? (
          <Alert
            type="error"
            showIcon
            style={{ marginBottom: 12 }}
            message="?뺤콉 紐⑸줉??遺덈윭?ㅼ? 紐삵뻽?듬땲??"
            description={
              <Space direction="vertical">
                <Text>{policiesState.errorMessage ?? '?쇱떆?곸씤 ?ㅻ쪟媛 諛쒖깮?덉뒿?덈떎.'}</Text>
                {policiesState.errorCode ? (
                  <Text type="secondary">?ㅻ쪟 肄붾뱶: {policiesState.errorCode}</Text>
                ) : null}
                {hasCachedPolicies ? (
                  <Text type="secondary">
                    留덉?留?성공 상태瑜??좎???梨?紐⑸줉??怨꾩냽 ?뺤씤?????덉뒿?덈떎.
                  </Text>
                ) : null}
              </Space>
            }
            action={
              <Button size="small" onClick={handleReload}>
                ?ㅼ떆 ?쒕룄
              </Button>
            }
          />
        ) : null}

        {policiesState.status === 'pending' && hasCachedPolicies ? (
          <Alert
            type="info"
            showIcon
            style={{ marginBottom: 12 }}
            message="理쒖떊 ?뺤콉 紐⑸줉???ㅼ떆 遺덈윭?ㅻ뒗 以묒엯?덈떎."
            description="留덉?留?성공 상태瑜??좎???梨??꾩옱 ?곗씠?곕? ?뺤씤?⑸땲??"
          />
        ) : null}

        {policiesState.status === 'empty' ? (
          <Alert
            type="info"
            showIcon
            style={{ marginBottom: 12 }}
            message="?깅줉???뺤콉 臾몄꽌媛 ?놁뒿?덈떎."
            description="???뺤콉 ?깅줉 踰꾪듉?쇰줈 踰뺣쪧/?쎄? 臾몄꽌肉??꾨땲??異붿쿇?? ?ъ씤?? 荑좏룿, ?대깽?? FAQ, 硫붿떆吏, 沅뚰븳 蹂寃??뺤콉源뚯? ?④퍡 ?깅줉?댁＜?몄슂."
          />
        ) : null}

        {isFilteredEmpty ? (
          <Alert
            type="info"
            showIcon
            style={{ marginBottom: 12 }}
            message="?좏깮??議곌굔??留욌뒗 ?뺤콉 臾몄꽌媛 ?놁뒿?덈떎."
            description="운영 ?곸뿭, ?뺤콉 ?좏삎, 異붿쟻 상태, ?쒗뻾???꾪꽣瑜?議곗젙?섍굅??寃?됱뼱瑜??ㅼ떆 ?뺤씤?댁＜?몄슂."
          />
        ) : null}

        <AdminDataTable<OperationPolicy>
          rowKey="id"
          pagination={false}
          scroll={{ x: 1680 }}
          loading={policiesState.status === 'pending' && !hasCachedPolicies}
          columns={columns}
          dataSource={filteredPolicies}
          onRow={handleRowClick}
          onChange={handleTableChange}
        />
      </AdminListCard>

      {actionState ? (
        <ConfirmAction
          open
          title={getActionCopy(actionState.nextStatus).title}
          description={getActionCopy(actionState.nextStatus).description}
          targetType="OperationPolicy"
          targetId={actionState.policy.id}
          confirmText={getActionCopy(actionState.nextStatus).confirmText}
          onCancel={closeActionModal}
          onConfirm={handleAction}
        />
      ) : null}

      {deleteTarget ? (
        <ConfirmAction
          open
          title="?뺤콉 ??젣"
          description="?뺤콉 臾몄꽌瑜?紐⑸줉怨?상세?먯꽌 ?쒓굅?⑸땲?? ??젣 사유瑜??④린怨?媛먯궗 로그濡?異붿쟻?섏꽭??"
          targetType="OperationPolicy"
          targetId={deleteTarget.id}
          confirmText="삭제 실행"
          reasonPlaceholder="??젣 사유를 입력하세요."
          onCancel={closeDeleteModal}
          onConfirm={handleDeletePolicy}
        />
      ) : null}

      {historyPublishState ? (
        <ConfirmAction
          open
          title="??踰꾩쟾 게시"
          description={`?좏깮???덉뒪?좊━ 踰꾩쟾(${historyPublishState.historyEntry.versionLabel})???꾩옱 사용자?몄텧 湲곗??쇰줈 ?꾪솚?⑸땲?? 게시 ?꾪솚 사유를 입력하세요.`}
          targetType="OperationPolicy"
          targetId={historyPublishState.policy.id}
          confirmText="??踰꾩쟾 게시"
          reasonPlaceholder="게시 踰꾩쟾???꾪솚?섎뒗 사유를 입력하세요."
          onCancel={closeHistoryPublishModal}
          onConfirm={handlePublishHistoryVersion}
        />
      ) : null}

      <DetailDrawer
        open={Boolean(selectedPolicy)}
        title={selectedPolicy ? `?뺤콉 상세 쨌 ${selectedPolicy.id}` : '?뺤콉 상세'}
        onClose={closeDetail}
        destroyOnHidden
        width={760}
        headerMeta={
          selectedPolicy ? (
            <AuditLogLink
              targetType="OperationPolicy"
              targetId={selectedPolicy.id}
            />
          ) : null
        }
        footerEnd={
          selectedPolicy ? (
            <Space wrap>
              <Button
                size="large"
                onClick={() => openCurrentPreview(selectedPolicy)}
              >
                蹂몃Ц 誘몃━蹂닿린
              </Button>
              <Button
                type="primary"
                size="large"
                onClick={() => openEditDetail(selectedPolicy)}
              >
                내용 ?섏젙
              </Button>
              <Button
                size="large"
                onClick={() => openVersionCreateDetail(selectedPolicy)}
              >
                ??踰꾩쟾 ?깅줉
              </Button>
              <Button size="large" onClick={() => promptToggleStatus(selectedPolicy)}>
                {selectedPolicy.status === '게시' ? '숨김' : '게시'}
              </Button>
              <Button
                danger
                size="large"
                onClick={() => promptDeletePolicy(selectedPolicy)}
              >
                ?뺤콉 ??젣
              </Button>
            </Space>
          ) : null
        }
      >
        {selectedPolicy ? (
          <DetailDrawerBody>
            <Alert
              type={
                selectedPolicy.trackingStatus === '?뺤콉 誘명솗??
                  ? 'warning'
                  : selectedPolicy.requiresConsent
                    ? 'info'
                    : 'success'
              }
              showIcon
              message={
                selectedPolicy.trackingStatus === '?뺤콉 誘명솗??
                  ? '?뺤콉 誘명솗??臾몄꽌?낅땲??'
                  : selectedPolicy.requiresConsent
                    ? '?숈쓽 ?붾㈃怨??④퍡 寃?섑빐???섎뒗 臾몄꽌?낅땲??'
                    : '운영 湲곗? 臾몄꽌?낅땲??'
              }
              description={
                selectedPolicy.trackingStatus === '?뺤콉 誘명솗??
                  ? '?꾩옱??臾몄꽌/IA 湲곗??쇰줈留?異붿쟻 以묒씠硫? 愿???붾㈃ 援ы쁽 ?먮뒗 ?뱀씤 泥닿퀎 ?뺤젙???꾩슂?⑸땲??'
                  : selectedPolicy.requiresConsent
                    ? '회원媛??결제/留덉씠?섏씠吏???ㅼ젣 ?몄텧?섎뒗 ?숈쓽 臾멸뎄? ?쒗뻾?? 踰꾩쟾???쇱튂?섎뒗吏 ?뺤씤?섏꽭??'
                    : '愿??愿由ъ옄 ?붾㈃怨?洹쇨굅 臾몄꽌媛 理쒖떊 肄붾뱶踰좎씠?ㅼ? ?쇱튂?섎뒗吏 ?④퍡 寃?섑븯?몄슂.'
              }
            />

            <DetailDrawerSection title="湲곕낯 ?뺣낫">
              <Descriptions
                bordered
                size="small"
                column={1}
                items={[
                  { key: 'id', label: '?뺤콉 ID', children: selectedPolicy.id },
                  {
                    key: 'category',
                    label: '운영 ?곸뿭',
                    children: selectedPolicy.category
                  },
                  {
                    key: 'policyType',
                    label: '?뺤콉 ?좏삎',
                    children: selectedPolicy.policyType
                  },
                  { key: 'title', label: '臾몄꽌紐?, children: selectedPolicy.title },
                  { key: 'versionLabel', label: '踰꾩쟾', children: selectedPolicy.versionLabel },
                  {
                    key: 'effectiveDate',
                    label: '?쒗뻾??,
                    children: selectedPolicy.effectiveDate
                  },
                  { key: 'status', label: '상태', children: selectedPolicy.status },
                  {
                    key: 'trackingStatus',
                    label: '異붿쟻 상태',
                    children: selectedPolicy.trackingStatus
                  },
                  {
                    key: 'requiresConsent',
                    label: '?숈쓽 ?꾩슂',
                    children: selectedPolicy.requiresConsent ? '?? : '?꾨땲??
                  },
                  {
                    key: 'exposureSurfaces',
                    label: '?몄텧 ?꾩튂',
                    children: selectedPolicy.exposureSurfaces.join(', ')
                  },
                  {
                    key: 'updatedAt',
                    label: '최근 수정',
                    children: `${selectedPolicy.updatedAt} 쨌 ${selectedPolicy.updatedBy}`
                  }
                ]}
              />
            </DetailDrawerSection>

            <DetailDrawerSection title="?뺤콉 ?붿빟">
              <Paragraph style={{ marginBottom: 0, whiteSpace: 'pre-wrap' }}>
                {selectedPolicy.summary}
              </Paragraph>
            </DetailDrawerSection>

            <DetailDrawerSection title="운영 踰붿쐞 諛?異붿쟻 洹쇨굅">
              <Descriptions
                bordered
                size="small"
                column={1}
                items={[
                  {
                    key: 'relatedAdminPages',
                    label: '?곌? 愿由ъ옄 ?붾㈃',
                    children:
                      selectedPolicy.relatedAdminPages.length > 0 ? (
                        <ul style={{ margin: 0, paddingInlineStart: 18 }}>
                          {selectedPolicy.relatedAdminPages.map((pageName) => (
                            <li key={pageName}>{pageName}</li>
                          ))}
                        </ul>
                      ) : (
                        '?깅줉???곌? ?붾㈃???놁뒿?덈떎.'
                      )
                  },
                  {
                    key: 'relatedUserPages',
                    label: '?곌? 사용자?붾㈃',
                    children:
                      selectedPolicy.relatedUserPages.length > 0 ? (
                        <ul style={{ margin: 0, paddingInlineStart: 18 }}>
                          {selectedPolicy.relatedUserPages.map((pageName) => (
                            <li key={pageName}>{pageName}</li>
                          ))}
                        </ul>
                      ) : (
                        '?깅줉???곌? 사용자?붾㈃???놁뒿?덈떎.'
                      )
                  },
                  {
                    key: 'sourceDocuments',
                    label: '異붿쟻 洹쇨굅 臾몄꽌',
                    children:
                      selectedPolicy.sourceDocuments.length > 0 ? (
                        <ul style={{ margin: 0, paddingInlineStart: 18 }}>
                          {selectedPolicy.sourceDocuments.map((documentPath) => (
                            <li key={documentPath}>
                              <Text code>{documentPath}</Text>
                            </li>
                          ))}
                        </ul>
                      ) : (
                        '?깅줉??洹쇨굅 臾몄꽌媛 ?놁뒿?덈떎.'
                      )
                  }
                ]}
              />
            </DetailDrawerSection>

            <DetailDrawerSection title="踰뺣졊 諛?洹쇨굅">
              {selectedPolicy.legalReferences.length > 0 ? (
                <ul style={{ margin: 0, paddingInlineStart: 18 }}>
                  {selectedPolicy.legalReferences.map((reference) => (
                    <li key={reference}>{reference}</li>
                  ))}
                </ul>
              ) : (
                <Text type="secondary">?깅줉??踰뺣졊/洹쇨굅媛 ?놁뒿?덈떎.</Text>
              )}
            </DetailDrawerSection>

            <DetailDrawerSection title="관리자 메모">
              <Paragraph style={{ marginBottom: 0, whiteSpace: 'pre-wrap' }}>
                {selectedPolicy.adminMemo || '?깅줉??관리자 메모媛 ?놁뒿?덈떎.'}
              </Paragraph>
            </DetailDrawerSection>

            <DetailDrawerSection
              title="?뺤콉 ?덉뒪?좊━"
              actions={
                policyHistoryState.status === 'error' ? (
                  <Button size="small" onClick={handleReloadHistory}>
                    ?ㅼ떆 ?쒕룄
                  </Button>
                ) : null
              }
            >
              <Space direction="vertical" size={12} style={{ display: 'flex' }}>
                {policyHistoryState.status === 'pending' ? (
                  <Alert
                    type="info"
                    showIcon
                    message="?뺤콉 ?덉뒪?좊━瑜?遺덈윭?ㅻ뒗 以묒엯?덈떎."
                    description="留덉?留?성공 상태媛 ?덉쑝硫?媛숈? Drawer ?덉뿉??怨꾩냽 ?뺤씤?????덉뒿?덈떎."
                  />
                ) : null}

                {policyHistoryState.status === 'error' ? (
                  <Alert
                    type="error"
                    showIcon
                    message="?뺤콉 ?덉뒪?좊━瑜?遺덈윭?ㅼ? 紐삵뻽?듬땲??"
                    description={
                      <Space direction="vertical">
                        <Text>
                          {policyHistoryState.errorMessage ??
                            '?쇱떆?곸씤 ?ㅻ쪟媛 諛쒖깮?덉뒿?덈떎.'}
                        </Text>
                        {policyHistoryState.errorCode ? (
                          <Text type="secondary">
                            ?ㅻ쪟 肄붾뱶: {policyHistoryState.errorCode}
                          </Text>
                        ) : null}
                      </Space>
                    }
                  />
                ) : null}

                {policyHistoryState.status === 'empty' ? (
                  <Alert
                    type="info"
                    showIcon
                    message="?깅줉???뺤콉 ?덉뒪?좊━媛 ?놁뒿?덈떎."
                    description="理쒖큹 ?깅줉 ?댄썑 議곗튂媛 ?꾩쟻?섎㈃ ???뚯씠釉붿뿉 蹂寃??대젰??異붽??⑸땲??"
                  />
                ) : null}

                <Text type="secondary">
                  ?됱쓣 ?쇱튂硫??대떦 ?쒖젏???뺤콉 ?ㅻ깄?룹쓣 ?뺤씤?????덉뒿?덈떎. ?섎떒
                  愿由?踰꾪듉? ?꾩옱 ?좏깮???뺤콉 湲곗??쇰줈 ?숈옉?⑸땲??
                </Text>

                <AdminDataTable<OperationPolicyHistoryEntry>
                  rowKey="id"
                  pagination={false}
                  scroll={{ x: 1080 }}
                  loading={policyHistoryState.status === 'pending'}
                  columns={historyColumns}
                  dataSource={policyHistoryState.data}
                  expandable={{
                    fixed: 'left',
                    expandRowByClick: true,
                    expandedRowRender: renderHistoryExpandedRow,
                    rowExpandable: () => true
                  }}
                />
              </Space>
            </DetailDrawerSection>
          </DetailDrawerBody>
        ) : null}
      </DetailDrawer>

      <HtmlPreviewModal
        open={Boolean(previewState)}
        title={previewState?.title ?? '?뺤콉 蹂몃Ц 誘몃━蹂닿린'}
        descriptionItems={undefined}
        bodyHtml={previewState?.bodyHtml}
        footerActions={
          previewState?.editTarget
            ? [
              <Button
                key="edit"
                type="primary"
                onClick={() => openEditDetail(previewState.editTarget)}
              >
                내용 ?섏젙
              </Button>
            ]
            : undefined
        }
        width={920}
        onClose={closePreviewModal}
      />
    </div>
  );
}


