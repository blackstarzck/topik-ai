import { Alert, Button, Space, Typography, notification } from 'antd';
import type { TableProps } from 'antd';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';

import {
  deletePolicySafe,
  fetchPoliciesSafe,
  fetchPolicyHistorySafe,
  publishPolicyHistoryVersionSafe,
  sendTermsChangeNotificationSafe,
  togglePolicyStatusSafe
} from '../api/policies-service';
import type {
  OperationPolicy,
  OperationPolicyHistoryEntry
} from '../model/policy-types';
import {
  buildPolicySummaryCards,
  createInitialHistoryState,
  filterOperationPolicies,
  getActionCopy,
  parsePolicyCategory,
  parsePolicyStatus,
  parsePolicySummaryFilter,
  parsePolicyType,
  parseSortField,
  parseTrackingStatus,
  type PolicyActionState,
  type PolicyHistoryPublishState,
  type PolicyPreviewState
} from '../model/operation-policies-page-schema';
import { createOperationPolicyColumns } from '../ui/operation-policies-columns';
import { OperationPoliciesToolbar } from '../ui/operation-policies-toolbar';
import {
  buildPolicyAuditNoticeDescription,
  buildPolicyErrorDescription
} from '../ui/operation-policy-audit-notice';
import { OperationPolicyDetailDrawer } from '../ui/operation-policy-detail-drawer';
import type { AsyncState } from '@/shared/model/async-state';
import { useRouterStateNotice } from '@/shared/model/use-router-state-notice';
import { ConfirmAction } from '@/shared/ui/confirm-action/confirm-action';
import { HtmlPreviewModal } from '@/shared/ui/html-preview-modal/html-preview-modal';
import { AdminListCard } from '@/shared/ui/list-page-card/admin-list-card';
import {
  isInitialSummaryLoad,
  ListSummaryCards
} from '@/shared/ui/list-summary-cards/list-summary-cards';
import { PageTitle } from '@/shared/ui/page-title/page-title';
import { parseSearchDate } from '@/shared/ui/search-bar/search-bar-utils';
import { AdminDataTable } from '@/shared/ui/table/admin-data-table';
import { parseSortOrder } from '@/shared/ui/table/table-column-utils';
import { SPACE } from '@/shared/styles/design-tokens';

const { Text } = Typography;

export default function OperationPoliciesPage(): JSX.Element {
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
  const [notifyTarget, setNotifyTarget] = useState<OperationPolicy | null>(null);
  const [historyPublishState, setHistoryPublishState] =
    useState<PolicyHistoryPublishState>(null);
  const [historyReloadKey, setHistoryReloadKey] = useState(0);
  const [policyHistoryState, setPolicyHistoryState] = useState<
    AsyncState<OperationPolicyHistoryEntry[]>
  >(createInitialHistoryState);
  const [notificationApi, notificationContextHolder] = notification.useNotification();
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

  useRouterStateNotice(
    'operationPolicySaved',
    (saved) => `${saved.policyId}:${saved.mode}`,
    (saved) => {
      const successMessage =
        saved.mode === 'create'
          ? '정책 등록 완료'
          : saved.mode === 'version'
            ? '정책 새 버전 등록 완료'
            : '정책 내용 수정 완료';
      const successReason =
        saved.mode === 'create'
          ? '신규 정책 저장(초기 상태: 숨김)'
          : saved.mode === 'version'
            ? '기존 정책 기준 새 버전 등록(초기 상태: 숨김)'
            : '정책 메타/본문 내용 수정';

      notificationApi.success({
        message: successMessage,
        description: buildPolicyAuditNoticeDescription(saved.policyId, [
          `사유/근거: ${successReason}`
        ])
      });
    }
  );

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

  const filteredPolicies = useMemo(
    () =>
      filterOperationPolicies(policiesState.data, {
        statusFilter,
        categoryFilter,
        policyTypeFilter,
        trackingStatusFilter,
        summaryFilter,
        startDate,
        endDate,
        keyword,
        searchField
      }),
    [
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
    ]
  );

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

  const policySummaryCards = useMemo(
    () =>
      buildPolicySummaryCards({
        policies: policiesState.data,
        summaryFilter,
        onSelect: (next) => commitParams({ summaryFilter: next, selected: null })
      }),
    [commitParams, policiesState.data, summaryFilter]
  );

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

  const promptSendNotification = useCallback((policy: OperationPolicy) => {
    setNotifyTarget(policy);
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
  const closeNotifyModal = useCallback(() => setNotifyTarget(null), []);
  const closeHistoryPublishModal = useCallback(
    () => setHistoryPublishState(null),
    []
  );
  const handleReload = useCallback(() => setReloadKey((prev) => prev + 1), []);
  const handleReloadHistory = useCallback(
    () => setHistoryReloadKey((prev) => prev + 1),
    []
  );

  const handleAction = useCallback(
    async (reason: string) => {
      if (!actionState) {
        return;
      }

      const result = await togglePolicyStatusSafe({
        policyId: actionState.policy.id,
        nextStatus: actionState.nextStatus,
        reason
      });

      if (!result.ok) {
        notificationApi.error({
          message:
            actionState.nextStatus === '게시'
              ? '정책 게시 실패'
              : '정책 숨김 실패',
          description: buildPolicyErrorDescription(
            result.error.message,
            result.error.code
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
        description: buildPolicyAuditNoticeDescription(result.data.id, [
          `사유/근거: ${reason}`
        ])
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
          description: buildPolicyErrorDescription(
            result.error.message,
            result.error.code
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
        description: buildPolicyAuditNoticeDescription(result.data.id, [
          `사유/근거: ${reason}`
        ])
      });
    },
    [
      commitParams,
      deleteTarget,
      notificationApi,
      previewState?.editTarget?.id
    ]
  );

  const handleSendNotification = useCallback(
    async (reason: string) => {
      if (!notifyTarget) {
        return;
      }

      const result = await sendTermsChangeNotificationSafe(reason);

      if (!result.ok) {
        notificationApi.error({
          message: '약관 변경 알림 발송 실패',
          description: buildPolicyErrorDescription(
            result.error.message,
            result.error.code
          )
        });
        return;
      }

      setNotifyTarget(null);
      notificationApi.success({
        message: '약관 변경 알림 발송',
        description: (
          <Space direction="vertical">
            <Text>대상(활성 회원): {result.data.recipients}명</Text>
            <Text>인앱은 전원 발송, 이메일은 수신 동의 사용자에게 전달됩니다.</Text>
            <Text type="secondary">사유/근거: {reason}</Text>
          </Space>
        )
      });
    },
    [notifyTarget, notificationApi]
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
          description: buildPolicyErrorDescription(
            result.error.message,
            result.error.code
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
        description: buildPolicyAuditNoticeDescription(result.data.id, [
          `게시 버전: ${historyPublishState.historyEntry.versionLabel}`,
          `사유/근거: ${reason}`
        ])
      });

      setHistoryReloadKey((prev) => prev + 1);
      setHistoryPublishState(null);
    },
    [historyPublishState, notificationApi, previewState?.editTarget?.id]
  );

  const columns = useMemo(
    () =>
      createOperationPolicyColumns({
        sortField,
        sortOrder,
        statusFilter,
        onToggleStatus: promptToggleStatus
      }),
    [promptToggleStatus, sortField, sortOrder, statusFilter]
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

  // JSX 콜백 안에서는 previewState?.editTarget 좁힘이 유지되지 않아 지역 변수로 캡처한다.
  const previewEditTarget = previewState?.editTarget;

  return (
    <div>
      {notificationContextHolder}
      <PageTitle title="정책 관리" />
      <ListSummaryCards
        items={policySummaryCards}
        loading={isInitialSummaryLoad(policiesState.status, hasCachedPolicies)}
      />

      <AdminListCard
        toolbar={
          <OperationPoliciesToolbar
            searchField={searchField}
            keyword={keyword}
            categoryFilter={categoryFilter}
            policyTypeFilter={policyTypeFilter}
            trackingStatusFilter={trackingStatusFilter}
            startDate={startDate}
            endDate={endDate}
            filteredCount={filteredPolicies.length}
            onCommit={commitParams}
            onCreate={openCreateDetail}
          />
        }
      >
        {policiesState.status === 'error' ? (
          <Alert
            type="error"
            showIcon
            style={{ marginBottom: SPACE.sm }}
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
            style={{ marginBottom: SPACE.sm }}
            message="최신 정책 목록을 다시 불러오는 중입니다."
            description="마지막 성공 상태를 유지한 채 현재 데이터를 확인합니다."
          />
        ) : null}

        {policiesState.status === 'empty' ? (
          <Alert
            type="info"
            showIcon
            style={{ marginBottom: SPACE.sm }}
            message="등록된 정책 문서가 없습니다."
            description="새 정책 등록 버튼으로 법률/약관 문서뿐 아니라 추천인, 포인트, 쿠폰, 이벤트, FAQ, 메시지, 권한 변경 정책까지 함께 등록해주세요."
          />
        ) : null}

        {isFilteredEmpty ? (
          <Alert
            type="info"
            showIcon
            style={{ marginBottom: SPACE.sm }}
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

      {notifyTarget ? (
        <ConfirmAction
          open
          title="사용자에게 약관 변경 알림"
          description={`현재 게시된 "${notifyTarget.title}" 버전(${notifyTarget.versionLabel}) 기준으로 전체 활성 회원에게 인앱+이메일 알림을 발송합니다. 이메일 CTA는 약관 동의 화면으로 연결됩니다. 발송 사유를 입력하세요.`}
          targetType="Notification"
          targetId={notifyTarget.id}
          confirmText="알림 발송"
          reasonPlaceholder="약관 변경 알림 발송 사유를 입력하세요."
          onCancel={closeNotifyModal}
          onConfirm={handleSendNotification}
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

      <OperationPolicyDetailDrawer
        policy={selectedPolicy}
        historyState={policyHistoryState}
        onClose={closeDetail}
        onOpenPreview={openCurrentPreview}
        onEdit={openEditDetail}
        onCreateVersion={openVersionCreateDetail}
        onSendNotification={promptSendNotification}
        onToggleStatus={promptToggleStatus}
        onDelete={promptDeletePolicy}
        onReloadHistory={handleReloadHistory}
        onOpenHistoryPreview={openHistoryPreview}
        onPublishHistoryVersion={promptPublishHistoryVersion}
      />

      <HtmlPreviewModal
        open={Boolean(previewState)}
        title={previewState?.title ?? '정책 본문 미리보기'}
        descriptionItems={undefined}
        bodyHtml={previewState?.bodyHtml}
        footerActions={
          previewEditTarget
            ? [
              <Button
                key="edit"
                type="primary"
                onClick={() => openEditDetail(previewEditTarget)}
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
