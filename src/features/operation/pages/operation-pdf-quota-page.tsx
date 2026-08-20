import {
  Alert,
  Button,
  Form,
  Modal,
  Select,
  Space,
  Tabs,
  Typography,
  notification
} from 'antd';
import { useCallback, useEffect, useMemo, useState, type UIEvent } from 'react';
import { useSearchParams } from 'react-router-dom';

import {
  createPdfQuotaResetSafe,
  fetchPdfQuotaPoliciesSafe,
  fetchPdfQuotaPolicyHistorySafe,
  fetchPdfQuotaResetUserOptionsSafe,
  fetchPdfQuotaResetsSafe,
  savePdfQuotaPolicySafe
} from '../api/pdf-quota-service';
import {
  formatPdfQuotaLimitLabel,
  mergePdfQuotaResetUserOptions,
  parsePdfQuotaActiveTab,
  PDF_QUOTA_HISTORY_PAGE_SIZE,
  PDF_QUOTA_RESET_PAGE_SIZE,
  PDF_QUOTA_RESET_USER_OPTION_PAGE_SIZE,
  PDF_QUOTA_RESET_USER_SEARCH_DEBOUNCE_MS,
  type PdfQuotaPolicyFormValues,
  type PdfQuotaResetFormValues
} from '../model/operation-pdf-quota-page-schema';
import {
  pdfQuotaPeriodUnitLabels,
  pdfQuotaResetScopeLabels,
  type PdfQuotaPolicy,
  type PdfQuotaPolicyHistoryEntry,
  type PdfQuotaReset,
  type PdfQuotaResetScope,
  type PdfQuotaResetUserOption
} from '../model/pdf-quota-types';
import { createPdfQuotaResetColumns } from '../ui/operation-pdf-quota-columns';
import { PdfQuotaPoliciesTab } from '../ui/operation-pdf-quota-policies-tab';
import { PdfQuotaResetModal } from '../ui/operation-pdf-quota-reset-modal';
import { fetchInstitutionCodesSafe } from '@/features/users/api/institution-codes-service';
import type { InstitutionCode } from '@/features/users/model/institution-codes-types';
import type { AsyncState } from '@/shared/model/async-state';
import { getTargetTypeLabel } from '@/shared/model/target-type-label';
import { AuditLogLink } from '@/shared/ui/audit-log-link/audit-log-link';
import { AdminListCard } from '@/shared/ui/list-page-card/admin-list-card';
import { PageTitle } from '@/shared/ui/page-title/page-title';
import { AdminDataTable } from '@/shared/ui/table/admin-data-table';
import { SPACE } from '@/shared/styles/design-tokens';

const { Text } = Typography;

export default function OperationPdfQuotaPage(): JSX.Element {
  const [searchParams, setSearchParams] = useSearchParams();
  const activeTab = parsePdfQuotaActiveTab(searchParams.get('tab'));

  const [policiesState, setPoliciesState] = useState<AsyncState<PdfQuotaPolicy[]>>({
    status: 'pending',
    data: [],
    errorMessage: null,
    errorCode: null
  });
  const [policiesReloadKey, setPoliciesReloadKey] = useState(0);

  const [historyState, setHistoryState] = useState<
    AsyncState<PdfQuotaPolicyHistoryEntry[]>
  >({
    status: 'pending',
    data: [],
    errorMessage: null,
    errorCode: null
  });
  const [historyTotal, setHistoryTotal] = useState(0);
  const [historyPage, setHistoryPage] = useState(1);
  const [historyReloadKey, setHistoryReloadKey] = useState(0);

  const [resetsState, setResetsState] = useState<AsyncState<PdfQuotaReset[]>>({
    status: 'pending',
    data: [],
    errorMessage: null,
    errorCode: null
  });
  const [resetTotal, setResetTotal] = useState(0);
  const [resetPage, setResetPage] = useState(1);
  const [resetScopeFilter, setResetScopeFilter] = useState<PdfQuotaResetScope | null>(
    null
  );
  const [resetsReloadKey, setResetsReloadKey] = useState(0);

  const [policySaving, setPolicySaving] = useState(false);
  const [policyForm] = Form.useForm<PdfQuotaPolicyFormValues>();
  const policyPeriodUnitValue = Form.useWatch('periodUnit', policyForm);
  const policyLimitValue = Form.useWatch('limitCount', policyForm);

  const [resetModalOpen, setResetModalOpen] = useState(false);
  const [resetSaving, setResetSaving] = useState(false);
  const [resetForm] = Form.useForm<PdfQuotaResetFormValues>();
  const resetScopeValue = Form.useWatch('scope', resetForm);
  const activeResetScope = resetScopeValue ?? 'user';

  const [userOptionsState, setUserOptionsState] = useState<
    AsyncState<PdfQuotaResetUserOption[]>
  >({
    status: 'pending',
    data: [],
    errorMessage: null,
    errorCode: null
  });
  const [userOptionTotal, setUserOptionTotal] = useState(0);
  const [userOptionSearchInput, setUserOptionSearchInput] = useState('');
  const [userOptionSearch, setUserOptionSearch] = useState('');
  const [userOptionPage, setUserOptionPage] = useState(1);
  const [codeOptionsState, setCodeOptionsState] = useState<
    AsyncState<InstitutionCode[]>
  >({
    status: 'pending',
    data: [],
    errorMessage: null,
    errorCode: null
  });

  const [notificationApi, notificationContextHolder] = notification.useNotification();
  const [modalApi, modalContextHolder] = Modal.useModal();

  // RPC가 자기치유하므로 화면 기준값도 claim과 같은 우선순위로 고른다:
  // 활성 행 → (전부 비활성 드리프트면) 최신 행 → 없음.
  const basePolicy = useMemo(() => {
    const active = policiesState.data.find((policy) => policy.isActive);
    return active ?? policiesState.data[0] ?? null;
  }, [policiesState.data]);
  const isAllInactiveDrift =
    policiesState.data.length > 0 &&
    !policiesState.data.some((policy) => policy.isActive);
  const policiesLoaded =
    policiesState.status === 'success' || policiesState.status === 'empty';

  useEffect(() => {
    const controller = new AbortController();

    setPoliciesState((prev) => ({
      ...prev,
      status: 'pending',
      errorMessage: null,
      errorCode: null
    }));

    void fetchPdfQuotaPoliciesSafe(controller.signal).then((result) => {
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
  }, [policiesReloadKey]);

  useEffect(() => {
    const controller = new AbortController();

    setHistoryState((prev) => ({
      ...prev,
      status: 'pending',
      errorMessage: null,
      errorCode: null
    }));

    void fetchPdfQuotaPolicyHistorySafe(
      { page: historyPage, pageSize: PDF_QUOTA_HISTORY_PAGE_SIZE },
      controller.signal
    ).then((result) => {
      if (controller.signal.aborted) {
        return;
      }

      if (result.ok) {
        setHistoryState({
          status: result.data.items.length === 0 ? 'empty' : 'success',
          data: result.data.items,
          errorMessage: null,
          errorCode: null
        });
        setHistoryTotal(result.data.totalCount);
        return;
      }

      setHistoryState((prev) => ({
        ...prev,
        status: 'error',
        errorMessage: result.error.message,
        errorCode: result.error.code
      }));
    });

    return () => {
      controller.abort();
    };
  }, [historyPage, historyReloadKey]);

  useEffect(() => {
    const controller = new AbortController();

    setResetsState((prev) => ({
      ...prev,
      status: 'pending',
      errorMessage: null,
      errorCode: null
    }));

    void fetchPdfQuotaResetsSafe(
      { page: resetPage, pageSize: PDF_QUOTA_RESET_PAGE_SIZE, scope: resetScopeFilter },
      controller.signal
    ).then((result) => {
      if (controller.signal.aborted) {
        return;
      }

      if (result.ok) {
        setResetsState({
          status: result.data.items.length === 0 ? 'empty' : 'success',
          data: result.data.items,
          errorMessage: null,
          errorCode: null
        });
        setResetTotal(result.data.totalCount);
        return;
      }

      setResetsState((prev) => ({
        ...prev,
        status: 'error',
        errorMessage: result.error.message,
        errorCode: result.error.code
      }));
    });

    return () => {
      controller.abort();
    };
  }, [resetPage, resetScopeFilter, resetsReloadKey]);

  useEffect(() => {
    if (!resetModalOpen) {
      return;
    }

    setUserOptionsState({
      status: 'pending',
      data: [],
      errorMessage: null,
      errorCode: null
    });
    setUserOptionTotal(0);
    setUserOptionSearchInput('');
    setUserOptionSearch('');
    setUserOptionPage(1);
  }, [resetModalOpen]);

  useEffect(() => {
    if (!resetModalOpen) {
      return;
    }

    const timer = window.setTimeout(() => {
      setUserOptionPage(1);
      setUserOptionSearch(userOptionSearchInput.trim());
    }, PDF_QUOTA_RESET_USER_SEARCH_DEBOUNCE_MS);

    return () => {
      window.clearTimeout(timer);
    };
  }, [resetModalOpen, userOptionSearchInput]);

  useEffect(() => {
    if (!resetModalOpen || activeResetScope !== 'user') {
      return;
    }

    const controller = new AbortController();

    setUserOptionsState((prev) => ({
      ...prev,
      data: userOptionPage === 1 ? [] : prev.data,
      status: 'pending',
      errorMessage: null,
      errorCode: null
    }));

    void fetchPdfQuotaResetUserOptionsSafe(
      {
        search: userOptionSearch,
        page: userOptionPage,
        pageSize: PDF_QUOTA_RESET_USER_OPTION_PAGE_SIZE
      },
      controller.signal
    ).then((result) => {
      if (controller.signal.aborted) {
        return;
      }
      if (result.ok) {
        setUserOptionsState((prev) => {
          const nextData =
            userOptionPage === 1
              ? result.data.items
              : mergePdfQuotaResetUserOptions(prev.data, result.data.items);

          return {
            status: nextData.length === 0 ? 'empty' : 'success',
            data: nextData,
            errorMessage: null,
            errorCode: null
          };
        });
        setUserOptionTotal(result.data.totalCount);
        return;
      }
      setUserOptionsState((prev) => ({
        ...prev,
        status: 'error',
        errorMessage: result.error.message,
        errorCode: result.error.code
      }));
    });

    return () => {
      controller.abort();
    };
  }, [activeResetScope, resetModalOpen, userOptionPage, userOptionSearch]);

  useEffect(() => {
    if (!resetModalOpen || activeResetScope !== 'group') {
      return;
    }

    const controller = new AbortController();

    setCodeOptionsState((prev) => ({ ...prev, status: 'pending' }));
    void fetchInstitutionCodesSafe(controller.signal).then((result) => {
      if (controller.signal.aborted) {
        return;
      }
      if (result.ok) {
        setCodeOptionsState({
          status: result.data.length === 0 ? 'empty' : 'success',
          data: result.data,
          errorMessage: null,
          errorCode: null
        });
        return;
      }
      setCodeOptionsState((prev) => ({
        ...prev,
        status: 'error',
        errorMessage: result.error.message,
        errorCode: result.error.code
      }));
    });

    return () => {
      controller.abort();
    };
  }, [activeResetScope, resetModalOpen]);

  const handleTabChange = useCallback(
    (nextTab: string) => {
      const merged = new URLSearchParams(searchParams);
      if (nextTab === 'policies') {
        merged.delete('tab');
      } else {
        merged.set('tab', nextTab);
      }
      setSearchParams(merged, { replace: true });
    },
    [searchParams, setSearchParams]
  );

  const reloadPolicyAndHistory = useCallback(() => {
    setPoliciesReloadKey((prev) => prev + 1);
    setHistoryPage(1);
    setHistoryReloadKey((prev) => prev + 1);
  }, []);

  const executePolicySave = useCallback(
    async (values: PdfQuotaPolicyFormValues) => {
      setPolicySaving(true);
      const result = await savePdfQuotaPolicySafe({
        limitCount: values.limitCount,
        periodUnit: values.periodUnit,
        periodTimezone: values.periodTimezone.trim(),
        reason: values.reason,
        expectedUpdatedAt: basePolicy?.updatedAtIso ?? null
      });
      setPolicySaving(false);

      if (!result.ok) {
        if (result.error.message.includes('changed by another admin')) {
          notificationApi.error({
            message: '다른 관리자가 정책을 변경했습니다.',
            description:
              '최신 정책 값을 다시 불러왔습니다. 내용을 확인한 뒤 다시 저장해 주세요.'
          });
          reloadPolicyAndHistory();
          return;
        }
        notificationApi.error({
          message: '정책 저장 실패',
          description: (
            <Space direction="vertical">
              <Text>{result.error.message}</Text>
              <Text type="secondary">오류 코드: {result.error.code}</Text>
            </Space>
          )
        });
        return;
      }

      notificationApi.success({
        message: '정책 저장 완료',
        description: (
          <Space direction="vertical">
            <Text>대상 유형: {getTargetTypeLabel('PdfQuotaPolicy')}</Text>
            <Text>대상 ID: {result.data}</Text>
            <Text>
              적용 값: {formatPdfQuotaLimitLabel(values.limitCount)}/
              {pdfQuotaPeriodUnitLabels[values.periodUnit]}
            </Text>
            <Text>사유/근거: {values.reason}</Text>
            <AuditLogLink targetType="PdfQuotaPolicy" targetId={result.data} />
          </Space>
        )
      });

      // 폼은 정책 리로드 후 key 리마운트로 최신 값 + 빈 사유로 초기화된다.
      reloadPolicyAndHistory();
    },
    [basePolicy?.updatedAtIso, notificationApi, reloadPolicyAndHistory]
  );

  const submitPolicyForm = useCallback(async () => {
    const values = await policyForm.validateFields().catch(() => null);
    if (!values) {
      return;
    }
    const periodChanged = Boolean(
      basePolicy && values.periodUnit !== basePolicy.periodUnit
    );
    const pausing = values.limitCount === 0;

    if (periodChanged || pausing) {
      // 파괴적 조치 확인 규칙: 주기 변경(사실상 전원 카운트 초기화)과
      // 한도 0(전 사용자 내보내기 중단)은 2차 확인을 거친다.
      modalApi.confirm({
        title: pausing ? 'PDF 내보내기 중단 확인' : '주기 변경 확인',
        content: (
          <Space direction="vertical">
            {pausing ? (
              <Text>
                한도 0회 저장 시 모든 회원의 PDF 내보내기가 중단됩니다(사용자에게는
                횟수 소진 안내가 표시됩니다).
              </Text>
            ) : null}
            {periodChanged ? (
              <Text>
                주기를 변경하면 기존 사용량이 새 주기 경계와 달라 카운트에서
                제외됩니다. 사실상 전체 회원의 사용량이 초기화되는 효과가 있습니다.
              </Text>
            ) : null}
            <Text type="secondary">계속할까요?</Text>
          </Space>
        ),
        okText: '저장 실행',
        okButtonProps: { danger: true },
        cancelText: '취소',
        onOk: () => executePolicySave(values)
      });
      return;
    }

    await executePolicySave(values);
  }, [basePolicy, executePolicySave, modalApi, policyForm]);

  const openResetModal = useCallback(() => {
    setResetModalOpen(true);
  }, []);

  const closeResetModal = useCallback(() => {
    setResetModalOpen(false);
    resetForm.resetFields();
  }, [resetForm]);

  const handleUserOptionsPopupScroll = useCallback(
    (event: UIEvent<HTMLDivElement>) => {
      const target = event.currentTarget;
      const reachedBottom =
        target.scrollTop + target.offsetHeight >= target.scrollHeight - 24;

      if (
        !reachedBottom ||
        userOptionsState.status === 'pending' ||
        userOptionsState.data.length >= userOptionTotal
      ) {
        return;
      }

      setUserOptionPage((prev) => prev + 1);
    },
    [userOptionTotal, userOptionsState.data.length, userOptionsState.status]
  );

  const executeReset = useCallback(
    async (values: PdfQuotaResetFormValues) => {
      setResetSaving(true);
      const result = await createPdfQuotaResetSafe({
        scope: values.scope,
        userId: values.scope === 'user' ? values.userId ?? null : null,
        groupCode: values.scope === 'group' ? values.groupCode ?? null : null,
        problemId: values.problemId?.trim() ? values.problemId.trim() : null,
        reason: values.reason
      });
      setResetSaving(false);

      if (!result.ok) {
        notificationApi.error({
          message: '초기화 실행 실패',
          description: (
            <Space direction="vertical">
              <Text>{result.error.message}</Text>
              <Text type="secondary">오류 코드: {result.error.code}</Text>
            </Space>
          )
        });
        return;
      }

      notificationApi.success({
        message: '초기화 실행 완료',
        description: (
          <Space direction="vertical">
            <Text>대상 유형: {getTargetTypeLabel('PdfQuotaReset')}</Text>
            <Text>대상 ID: {result.data.resetId}</Text>
            <Text>
              범위: {pdfQuotaResetScopeLabels[values.scope]} · 대상{' '}
              {`${result.data.targetCount.toLocaleString()}명`}
            </Text>
            <Text>사유/근거: {values.reason}</Text>
            <AuditLogLink targetType="PdfQuotaReset" targetId={result.data.resetId} />
          </Space>
        )
      });

      closeResetModal();
      setResetPage(1);
      setResetsReloadKey((prev) => prev + 1);
    },
    [closeResetModal, notificationApi]
  );

  const submitResetModal = useCallback(async () => {
    const values = await resetForm.validateFields().catch(() => null);
    if (!values) {
      return;
    }

    if (values.scope === 'global') {
      // 전체 초기화는 영향 범위가 커 실행 전 확인 단계를 한 번 더 둔다.
      modalApi.confirm({
        title: '전체 초기화 확인',
        content:
          '모든 회원의 이번 주기 PDF 내보내기 사용량이 초기화됩니다. 실행할까요?',
        okText: '전체 초기화 실행',
        okButtonProps: { danger: true },
        cancelText: '취소',
        onOk: () => executeReset(values)
      });
      return;
    }

    await executeReset(values);
  }, [executeReset, modalApi, resetForm]);

  const resetColumns = useMemo(() => createPdfQuotaResetColumns(), []);

  const resetsToolbar = (
    <div className="admin-list-card-toolbar-side">
      <Space>
        <Text className="admin-list-card-toolbar-summary" type="secondary">
          총 {resetTotal.toLocaleString()}건
        </Text>
        <Select<PdfQuotaResetScope | ''>
          size="middle"
          style={{ width: 140 }}
          value={resetScopeFilter ?? ''}
          onChange={(value) => {
            setResetPage(1);
            setResetScopeFilter(value === '' ? null : value);
          }}
          options={[
            { value: '', label: '전체 범위' },
            { value: 'user', label: '개인' },
            { value: 'group', label: '기관 코드' },
            { value: 'global', label: '전체' }
          ]}
        />
      </Space>
      <div className="admin-list-card-toolbar-actions">
        <Button type="primary" size="large" onClick={openResetModal}>
          초기화 실행
        </Button>
      </div>
    </div>
  );

  const hasCachedResets = resetsState.data.length > 0;

  return (
    <div>
      {notificationContextHolder}
      {modalContextHolder}
      <PageTitle title="PDF 내보내기 제한" />

      <Tabs
        activeKey={activeTab}
        onChange={handleTabChange}
        items={[
          {
            key: 'policies',
            label: '정책',
            children: (
              <PdfQuotaPoliciesTab
                policiesState={policiesState}
                historyState={historyState}
                historyPage={historyPage}
                historyTotal={historyTotal}
                basePolicy={basePolicy}
                isAllInactiveDrift={isAllInactiveDrift}
                policiesLoaded={policiesLoaded}
                policyPeriodUnitValue={policyPeriodUnitValue}
                policyLimitValue={policyLimitValue}
                policySaving={policySaving}
                policyForm={policyForm}
                onSubmitPolicy={submitPolicyForm}
                onRetryPolicies={() => setPoliciesReloadKey((prev) => prev + 1)}
                onRetryHistory={() => setHistoryReloadKey((prev) => prev + 1)}
                onHistoryPageChange={setHistoryPage}
              />
            )
          },
          {
            key: 'resets',
            label: '초기화',
            children: (
              <AdminListCard toolbar={resetsToolbar}>
                {resetsState.status === 'error' ? (
                  <Alert
                    type="error"
                    showIcon
                    style={{ marginBottom: SPACE.sm }}
                    message="초기화 이력을 불러오지 못했습니다."
                    description={
                      <Space direction="vertical">
                        <Text>
                          {resetsState.errorMessage ?? '일시적인 오류가 발생했습니다.'}
                        </Text>
                        {resetsState.errorCode ? (
                          <Text type="secondary">오류 코드: {resetsState.errorCode}</Text>
                        ) : null}
                      </Space>
                    }
                    action={
                      <Button
                        size="small"
                        onClick={() => setResetsReloadKey((prev) => prev + 1)}
                      >
                        다시 시도
                      </Button>
                    }
                  />
                ) : null}

                {resetsState.status === 'empty' ? (
                  <Alert
                    type="info"
                    showIcon
                    style={{ marginBottom: SPACE.sm }}
                    message="초기화 이력이 없습니다."
                    description="초기화 실행 버튼으로 개인/기관 코드/전체 초기화를 만들 수 있습니다. 이력은 수정/삭제하지 않고 보상 초기화로만 정정합니다."
                  />
                ) : null}

                <AdminDataTable<PdfQuotaReset>
                  rowKey="id"
                  scroll={{ x: 1000 }}
                  loading={resetsState.status === 'pending' && !hasCachedResets}
                  columns={resetColumns}
                  dataSource={resetsState.data}
                  pagination={{
                    current: resetPage,
                    pageSize: PDF_QUOTA_RESET_PAGE_SIZE,
                    total: resetTotal,
                    showSizeChanger: false,
                    onChange: (nextPage) => setResetPage(nextPage)
                  }}
                />
              </AdminListCard>
            )
          }
        ]}
      />

      <PdfQuotaResetModal
        open={resetModalOpen}
        saving={resetSaving}
        activeResetScope={activeResetScope}
        userOptionsState={userOptionsState}
        userOptionSearchInput={userOptionSearchInput}
        onUserOptionSearchInputChange={setUserOptionSearchInput}
        onUserOptionsPopupScroll={handleUserOptionsPopupScroll}
        codeOptionsState={codeOptionsState}
        form={resetForm}
        onOk={submitResetModal}
        onCancel={closeResetModal}
      />
    </div>
  );
}
