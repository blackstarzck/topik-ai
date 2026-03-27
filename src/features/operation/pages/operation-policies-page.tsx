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
      title: '정책 게시',
      description:
        '숨김 상태 정책을 게시합니다. 시행일과 사용자 노출 위치를 다시 확인한 뒤 사유를 남겨주세요.',
      confirmText: '게시 실행',
      successMessage: '정책 게시 완료'
    };
  }

  return {
    title: '정책 숨김',
    description:
      '게시 중인 정책 노출을 중단합니다. 숨김 사유를 남겨주세요.',
    confirmText: '숨김 실행',
    successMessage: '정책 숨김 완료'
  };
}

function getHistoryActionLabel(action: OperationPolicyHistoryEntry['action']) {
  switch (action) {
    case 'created':
      return '등록';
    case 'updated':
      return '수정';
    case 'status_changed':
      return '상태 변경';
    case 'version_published':
      return '이력 버전 게시';
    case 'deleted':
      return '삭제';
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
        ? '?뺤콉 ?깅줉 ?꾨즺'
        : state.operationPolicySaved.mode === 'version'
          ? '정책 새 버전 등록 완료'
          : '정책 내용 수정 완료';
    const successReason =
      state.operationPolicySaved.mode === 'create'
        ? '?좉퇋 ?뺤콉 ???珥덇린 ?곹깭: ?④?)'
        : state.operationPolicySaved.mode === 'version'
          ? '기존 정책 기준 새 버전 등록(초기 상태: 숨김)'
          : '정책 메타/본문 내용 수정';

    notificationApi.success({
      message: successMessage,
      description: (
        <Space direction="vertical">
          <Text>대상 유형: {getTargetTypeLabel('OperationPolicy')}</Text>
          <Text>대상 ID: {state.operationPolicySaved.policyId}</Text>
          <Text>사유/근거: {successReason}</Text>
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
        policy.category === '법률/약관'
      ) {
        return false;
      }

      if (
        summaryFilter === 'pending' &&
        policy.trackingStatus !== '정책 미확정'
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
      (policy) => policy.category !== '법률/약관'
    ).length;
    const policyPendingCount = policiesState.data.filter(
      (policy) => policy.trackingStatus === '정책 미확정'
    ).length;
    const currentSummaryFilter = summaryFilter ?? 'all';

    return [
      {
        key: 'all',
        label: '전체 정책',
        value: `${policiesState.data.length.toLocaleString()}건`,
        active: currentSummaryFilter === 'all',
        onClick: () => commitParams({ summaryFilter: null, selected: null })
      },
      {
        key: 'published',
        label: '게시 중',
        value: `${publishedCount.toLocaleString()}건`,
        active: currentSummaryFilter === 'published',
        onClick: () =>
          commitParams({ summaryFilter: 'published', selected: null })
      },
      {
        key: 'operational',
        label: '운영 정책',
        value: `${operationalPolicyCount.toLocaleString()}건`,
        active: currentSummaryFilter === 'operational',
        onClick: () =>
          commitParams({ summaryFilter: 'operational', selected: null })
      },
      {
        key: 'pending',
        label: '정책 미확정',
        value: `${policyPendingCount.toLocaleString()}건`,
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
      title: `정책 본문 미리보기 · ${policy.id}`,
      bodyHtml: policy.bodyHtml,
      editTarget: policy
    });
  }, []);

  const openHistoryPreview = useCallback(
    (historyEntry: OperationPolicyHistoryEntry) => {
      setPreviewState({
        title: `정책 본문 미리보기 · ${historyEntry.versionLabel}`,
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
              ? '정책 게시 실패'
              : '정책 숨김 실패',
          description: (
            <Space direction="vertical">
              <Text>{result.error.message}</Text>
              <Text type="secondary">오류 코드: {result.error.code}</Text>
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
            <Text>대상 유형: {getTargetTypeLabel('OperationPolicy')}</Text>
            <Text>대상 ID: {result.data.id}</Text>
            <Text>사유/근거: {reason}</Text>
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
          message: '정책 삭제 실패',
          description: (
            <Space direction="vertical">
              <Text>{result.error.message}</Text>
              <Text type="secondary">오류 코드: {result.error.code}</Text>
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
        message: '정책 삭제 완료',
        description: (
          <Space direction="vertical">
            <Text>대상 유형: {getTargetTypeLabel('OperationPolicy')}</Text>
            <Text>대상 ID: {result.data.id}</Text>
            <Text>사유/근거: {reason}</Text>
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
          message: '이 버전 게시 실패',
          description: (
            <Space direction="vertical">
              <Text>{result.error.message}</Text>
              <Text type="secondary">오류 코드: {result.error.code}</Text>
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
          title: `정책 본문 미리보기 · ${result.data.id}`,
          bodyHtml: result.data.bodyHtml,
          editTarget: result.data
        });
      }

      notificationApi.success({
        message: '이 버전 게시 완료',
        description: (
          <Space direction="vertical">
            <Text>대상 유형: {getTargetTypeLabel('OperationPolicy')}</Text>
            <Text>대상 ID: {result.data.id}</Text>
            <Text>게시 버전: {historyPublishState.historyEntry.versionLabel}</Text>
            <Text>사유/근거: {reason}</Text>
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
        title: '정책 ID',
        dataIndex: 'id',
        width: 120,
        sorter: createTextSorter((record) => record.id),
        sortOrder: sortField === 'id' ? sortOrder : null
      },
      {
        title: '운영 영역',
        dataIndex: 'category',
        width: 140,
        sorter: createTextSorter((record) => record.category),
        sortOrder: sortField === 'category' ? sortOrder : null
      },
      {
        title: '정책 유형',
        dataIndex: 'policyType',
        width: 210,
        sorter: createTextSorter((record) => record.policyType),
        sortOrder: sortField === 'policyType' ? sortOrder : null
      },
      {
        title: '문서명',
        dataIndex: 'title',
        width: 260,
        sorter: createTextSorter((record) => record.title),
        sortOrder: sortField === 'title' ? sortOrder : null
      },
      {
        title: '추적 상태',
        dataIndex: 'trackingStatus',
        width: 130,
        sorter: createTextSorter((record) => record.trackingStatus),
        sortOrder: sortField === 'trackingStatus' ? sortOrder : null
      },
      {
        title: '버전',
        dataIndex: 'versionLabel',
        width: 110,
        sorter: createTextSorter((record) => record.versionLabel),
        sortOrder: sortField === 'versionLabel' ? sortOrder : null
      },
      {
        title: '시행일',
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
        title: '수정자',
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
        title: '버전',
        dataIndex: 'versionLabel',
        width: 120
      },
      {
        title: '상태',
        dataIndex: 'status',
        width: 120
      },
      {
        title: '변경 유형',
        dataIndex: 'action',
        width: 130,
        render: (action: OperationPolicyHistoryEntry['action']) =>
          getHistoryActionLabel(action)
      },
      {
        title: '변경 시각',
        dataIndex: 'changedAt',
        width: 160
      },
      {
        title: '수정자',
        dataIndex: 'changedBy',
        width: 140
      },
      {
        title: '액션',
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
              본문 보기
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
              이 버전 게시
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
              label: '변경 유형',
              children: getHistoryActionLabel(entry.action)
            },
            {
              key: 'trackingStatus',
              label: '추적 상태',
              children: snapshot.trackingStatus
            },
            {
              key: 'effectiveDate',
              label: '시행일',
              children: snapshot.effectiveDate
            },
            {
              key: 'requiresConsent',
              label: '동의 필요',
              children: snapshot.requiresConsent ? '예' : '아니오'
            },
            {
              key: 'category',
              label: '운영 영역',
              children: snapshot.category
            },
            {
              key: 'policyType',
              label: '정책 유형',
              children: snapshot.policyType
            },
            {
              key: 'summary',
              label: '버전 요약',
              span: 2,
              children: snapshot.summary || '등록된 요약이 없습니다.'
            },
            {
              key: 'exposureSurfaces',
              label: '노출 위치',
              span: 2,
              children:
                snapshot.exposureSurfaces.length > 0
                  ? snapshot.exposureSurfaces.join(', ')
                  : '등록된 노출 위치가 없습니다.'
            },
            {
              key: 'relatedAdminPages',
              label: '연관 관리자 화면',
              span: 2,
              children:
                snapshot.relatedAdminPages.length > 0 ? (
                  <ul style={{ margin: 0, paddingInlineStart: 18 }}>
                    {snapshot.relatedAdminPages.map((pageName) => (
                      <li key={pageName}>{pageName}</li>
                    ))}
                  </ul>
                ) : (
                  '등록된 연관 관리자 화면이 없습니다.'
                )
            },
            {
              key: 'relatedUserPages',
              label: '연관 사용자 화면',
              span: 2,
              children:
                snapshot.relatedUserPages.length > 0 ? (
                  <ul style={{ margin: 0, paddingInlineStart: 18 }}>
                    {snapshot.relatedUserPages.map((pageName) => (
                      <li key={pageName}>{pageName}</li>
                    ))}
                  </ul>
                ) : (
                  '등록된 연관 사용자 화면이 없습니다.'
                )
            },
            {
              key: 'sourceDocuments',
              label: '추적 근거 문서',
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
                  '등록된 추적 근거 문서가 없습니다.'
                )
            },
            {
              key: 'legalReferences',
              label: '법령 및 근거',
              span: 2,
              children:
                snapshot.legalReferences.length > 0 ? (
                  <ul style={{ margin: 0, paddingInlineStart: 18 }}>
                    {snapshot.legalReferences.map((reference) => (
                      <li key={reference}>{reference}</li>
                    ))}
                  </ul>
                ) : (
                  '등록된 법령 및 근거가 없습니다.'
                )
            },
            {
              key: 'note',
              label: '변경 사유',
              span: 2,
              children: entry.note || '기록된 메모가 없습니다.'
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
      <PageTitle title="정책 관리" />
      <ListSummaryCards items={policySummaryCards} />

      <AdminListCard
        toolbar={
          <SearchBar
            searchField={searchField}
            searchFieldOptions={[
              { label: '전체', value: 'all' },
              { label: '정책 ID', value: 'id' },
              { label: '운영 영역', value: 'category' },
              { label: '문서명', value: 'title' },
              { label: '추적 상태', value: 'trackingStatus' },
              { label: '연관 관리자 화면', value: 'relatedAdminPages' },
              { label: '연관 사용자 화면', value: 'relatedUserPages' },
              { label: '추적 문서', value: 'sourceDocuments' },
              { label: '버전', value: 'versionLabel' },
              { label: '법령/근거', value: 'legalReferences' }
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
            keywordPlaceholder="정책 ID, 문서명, 버전, 법령/근거 검색"
            detailTitle="상세 필터"
            detailContent={
              <>
                <SearchBarDetailField label="운영 영역">
                  <Select
                    allowClear
                    value={draftCategory || undefined}
                    options={operationPolicyCategoryValues.map((value) => ({
                      label: value,
                      value
                    }))}
                    placeholder="운영 영역 선택"
                    onChange={(value) => setDraftCategory(value ?? '')}
                  />
                </SearchBarDetailField>
                <SearchBarDetailField label="정책 유형">
                  <Select
                    allowClear
                    value={draftPolicyType || undefined}
                    options={operationPolicyTypeValues.map((value) => ({
                      label: value,
                      value
                    }))}
                    placeholder="정책 유형 선택"
                    onChange={(value) => setDraftPolicyType(value ?? '')}
                  />
                </SearchBarDetailField>
                <SearchBarDetailField label="추적 상태">
                  <Select
                    allowClear
                    value={draftTrackingStatus || undefined}
                    options={operationPolicyTrackingStatusValues.map((value) => ({
                      label: value,
                      value
                    }))}
                    placeholder="추적 상태 선택"
                    onChange={(value) => setDraftTrackingStatus(value ?? '')}
                  />
                </SearchBarDetailField>
                <SearchBarDetailField label="시행일">
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
                총 {filteredPolicies.length.toLocaleString()}건
              </Text>
            }
            actions={
              <Button type="primary" size="large" onClick={openCreateDetail}>
                새 정책 등록
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
            message="정책 목록을 불러오지 못했습니다."
            description={
              <Space direction="vertical">
                <Text>{policiesState.errorMessage ?? '일시적인 오류가 발생했습니다.'}</Text>
                {policiesState.errorCode ? (
                  <Text type="secondary">오류 코드: {policiesState.errorCode}</Text>
                ) : null}
                {hasCachedPolicies ? (
                  <Text type="secondary">
                    마지막 성공 상태를 유지한 채 목록을 계속 확인할 수 있습니다.
                  </Text>
                ) : null}
              </Space>
            }
            action={
              <Button size="small" onClick={handleReload}>
                다시 시도
              </Button>
            }
          />
        ) : null}

        {policiesState.status === 'pending' && hasCachedPolicies ? (
          <Alert
            type="info"
            showIcon
            style={{ marginBottom: 12 }}
            message="최신 정책 목록을 다시 불러오는 중입니다."
            description="마지막 성공 상태를 유지한 채 현재 데이터를 확인합니다."
          />
        ) : null}

        {policiesState.status === 'empty' ? (
          <Alert
            type="info"
            showIcon
            style={{ marginBottom: 12 }}
            message="등록된 정책 문서가 없습니다."
            description="새 정책 등록 버튼으로 법률/약관 문서뿐 아니라 추천인, 포인트, 쿠폰, 이벤트, FAQ, 메시지, 권한 변경 정책까지 함께 등록해주세요."
          />
        ) : null}

        {isFilteredEmpty ? (
          <Alert
            type="info"
            showIcon
            style={{ marginBottom: 12 }}
            message="선택한 조건에 맞는 정책 문서가 없습니다."
            description="운영 영역, 정책 유형, 추적 상태, 시행일 필터를 조정하거나 검색어를 다시 확인해주세요."
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
          title="정책 삭제"
          description="정책 문서를 목록과 상세에서 제거합니다. 삭제 사유를 남기고 감사 로그로 추적하세요."
          targetType="OperationPolicy"
          targetId={deleteTarget.id}
          confirmText="삭제 실행"
          reasonPlaceholder="삭제 사유를 입력하세요."
          onCancel={closeDeleteModal}
          onConfirm={handleDeletePolicy}
        />
      ) : null}

      {historyPublishState ? (
        <ConfirmAction
          open
          title="이 버전 게시"
          description={`선택한 히스토리 버전(${historyPublishState.historyEntry.versionLabel})을 현재 사용자 노출 기준으로 전환합니다. 게시 전환 사유를 입력하세요.`}
          targetType="OperationPolicy"
          targetId={historyPublishState.policy.id}
          confirmText="이 버전 게시"
          reasonPlaceholder="게시 버전을 전환하는 사유를 입력하세요."
          onCancel={closeHistoryPublishModal}
          onConfirm={handlePublishHistoryVersion}
        />
      ) : null}

      <DetailDrawer
        open={Boolean(selectedPolicy)}
        title={selectedPolicy ? `정책 상세 · ${selectedPolicy.id}` : '정책 상세'}
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
                본문 미리보기
              </Button>
              <Button
                type="primary"
                size="large"
                onClick={() => openEditDetail(selectedPolicy)}
              >
                내용 수정
              </Button>
              <Button
                size="large"
                onClick={() => openVersionCreateDetail(selectedPolicy)}
              >
                새 버전 등록
              </Button>
              <Button size="large" onClick={() => promptToggleStatus(selectedPolicy)}>
                {selectedPolicy.status === '게시' ? '숨김' : '게시'}
              </Button>
              <Button
                danger
                size="large"
                onClick={() => promptDeletePolicy(selectedPolicy)}
              >
                정책 삭제
              </Button>
            </Space>
          ) : null
        }
      >
        {selectedPolicy ? (
          <DetailDrawerBody>
            <Alert
              type={
                selectedPolicy.trackingStatus === '정책 미확정'
                  ? 'warning'
                  : selectedPolicy.requiresConsent
                    ? 'info'
                    : 'success'
              }
              showIcon
              message={
                selectedPolicy.trackingStatus === '정책 미확정'
                  ? '정책 미확정 문서입니다.'
                  : selectedPolicy.requiresConsent
                    ? '동의 화면과 함께 검수해야 하는 문서입니다.'
                    : '운영 기준 문서입니다.'
              }
              description={
                selectedPolicy.trackingStatus === '정책 미확정'
                  ? '현재는 문서/IA 기준으로만 추적 중이며, 관련 화면 구현 또는 승인 체계 확정이 필요합니다.'
                  : selectedPolicy.requiresConsent
                    ? '회원가입/결제/마이페이지에 실제 노출되는 동의 문구와 시행일, 버전이 일치하는지 확인하세요.'
                    : '관련 관리자 화면과 근거 문서가 최신 코드베이스와 일치하는지 함께 검수하세요.'
              }
            />

            <DetailDrawerSection title="기본 정보">
              <Descriptions
                bordered
                size="small"
                column={1}
                items={[
                  { key: 'id', label: '정책 ID', children: selectedPolicy.id },
                  {
                    key: 'category',
                    label: '운영 영역',
                    children: selectedPolicy.category
                  },
                  {
                    key: 'policyType',
                    label: '정책 유형',
                    children: selectedPolicy.policyType
                  },
                  { key: 'title', label: '문서명', children: selectedPolicy.title },
                  { key: 'versionLabel', label: '버전', children: selectedPolicy.versionLabel },
                  {
                    key: 'effectiveDate',
                    label: '시행일',
                    children: selectedPolicy.effectiveDate
                  },
                  { key: 'status', label: '상태', children: selectedPolicy.status },
                  {
                    key: 'trackingStatus',
                    label: '추적 상태',
                    children: selectedPolicy.trackingStatus
                  },
                  {
                    key: 'requiresConsent',
                    label: '동의 필요',
                    children: selectedPolicy.requiresConsent ? '예' : '아니오'
                  },
                  {
                    key: 'exposureSurfaces',
                    label: '노출 위치',
                    children: selectedPolicy.exposureSurfaces.join(', ')
                  },
                  {
                    key: 'updatedAt',
                    label: '최근 수정',
                    children: `${selectedPolicy.updatedAt} · ${selectedPolicy.updatedBy}`
                  }
                ]}
              />
            </DetailDrawerSection>

            <DetailDrawerSection title="정책 요약">
              <Paragraph style={{ marginBottom: 0, whiteSpace: 'pre-wrap' }}>
                {selectedPolicy.summary}
              </Paragraph>
            </DetailDrawerSection>

            <DetailDrawerSection title="운영 범위 및 추적 근거">
              <Descriptions
                bordered
                size="small"
                column={1}
                items={[
                  {
                    key: 'relatedAdminPages',
                    label: '연관 관리자 화면',
                    children:
                      selectedPolicy.relatedAdminPages.length > 0 ? (
                        <ul style={{ margin: 0, paddingInlineStart: 18 }}>
                          {selectedPolicy.relatedAdminPages.map((pageName) => (
                            <li key={pageName}>{pageName}</li>
                          ))}
                        </ul>
                      ) : (
                        '등록된 연관 화면이 없습니다.'
                      )
                  },
                  {
                    key: 'relatedUserPages',
                    label: '연관 사용자 화면',
                    children:
                      selectedPolicy.relatedUserPages.length > 0 ? (
                        <ul style={{ margin: 0, paddingInlineStart: 18 }}>
                          {selectedPolicy.relatedUserPages.map((pageName) => (
                            <li key={pageName}>{pageName}</li>
                          ))}
                        </ul>
                      ) : (
                        '등록된 연관 사용자 화면이 없습니다.'
                      )
                  },
                  {
                    key: 'sourceDocuments',
                    label: '추적 근거 문서',
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
                        '등록된 근거 문서가 없습니다.'
                      )
                  }
                ]}
              />
            </DetailDrawerSection>

            <DetailDrawerSection title="법령 및 근거">
              {selectedPolicy.legalReferences.length > 0 ? (
                <ul style={{ margin: 0, paddingInlineStart: 18 }}>
                  {selectedPolicy.legalReferences.map((reference) => (
                    <li key={reference}>{reference}</li>
                  ))}
                </ul>
              ) : (
                <Text type="secondary">등록된 법령/근거가 없습니다.</Text>
              )}
            </DetailDrawerSection>

            <DetailDrawerSection title="관리자 메모">
              <Paragraph style={{ marginBottom: 0, whiteSpace: 'pre-wrap' }}>
                {selectedPolicy.adminMemo || '등록된 관리자 메모가 없습니다.'}
              </Paragraph>
            </DetailDrawerSection>

            <DetailDrawerSection
              title="정책 히스토리"
              actions={
                policyHistoryState.status === 'error' ? (
                  <Button size="small" onClick={handleReloadHistory}>
                    다시 시도
                  </Button>
                ) : null
              }
            >
              <Space direction="vertical" size={12} style={{ display: 'flex' }}>
                {policyHistoryState.status === 'pending' ? (
                  <Alert
                    type="info"
                    showIcon
                    message="정책 히스토리를 불러오는 중입니다."
                    description="마지막 성공 상태가 있으면 같은 Drawer 안에서 계속 확인할 수 있습니다."
                  />
                ) : null}

                {policyHistoryState.status === 'error' ? (
                  <Alert
                    type="error"
                    showIcon
                    message="정책 히스토리를 불러오지 못했습니다."
                    description={
                      <Space direction="vertical">
                        <Text>
                          {policyHistoryState.errorMessage ??
                            '일시적인 오류가 발생했습니다.'}
                        </Text>
                        {policyHistoryState.errorCode ? (
                          <Text type="secondary">
                            오류 코드: {policyHistoryState.errorCode}
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
                    message="등록된 정책 히스토리가 없습니다."
                    description="최초 등록 이후 조치가 누적되면 이 테이블에 변경 이력이 추가됩니다."
                  />
                ) : null}

                <Text type="secondary">
                  행을 펼치면 해당 시점의 정책 스냅샷을 확인할 수 있습니다. 하단
                  관리 버튼은 현재 선택된 정책 기준으로 동작합니다.
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
        title={previewState?.title ?? '정책 본문 미리보기'}
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
                내용 수정
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
