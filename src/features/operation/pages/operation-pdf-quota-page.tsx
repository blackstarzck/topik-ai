import {
  Alert,
  Button,
  Divider,
  Form,
  Input,
  InputNumber,
  Modal,
  Radio,
  Select,
  Space,
  Tabs,
  Tag,
  Typography,
  notification
} from 'antd';
import type { TableColumnsType } from 'antd';
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
  pdfQuotaPeriodUnitLabels,
  pdfQuotaPeriodUnitValues,
  pdfQuotaResetScopeLabels,
  type PdfQuotaPeriodUnit,
  type PdfQuotaPolicy,
  type PdfQuotaPolicyHistoryEntry,
  type PdfQuotaReset,
  type PdfQuotaResetScope,
  type PdfQuotaResetUserOption
} from '../model/pdf-quota-types';
import { fetchInstitutionCodesSafe } from '../../users/api/institution-codes-service';
import type { InstitutionCode } from '../../users/model/institution-codes-types';
import type { AsyncState } from '../../../shared/model/async-state';
import { getTargetTypeLabel } from '../../../shared/model/target-type-label';
import { AuditLogLink } from '../../../shared/ui/audit-log-link/audit-log-link';
import { AdminListCard } from '../../../shared/ui/list-page-card/admin-list-card';
import { PageTitle } from '../../../shared/ui/page-title/page-title';
import { AdminDataTable } from '../../../shared/ui/table/admin-data-table';

const { Text } = Typography;

const RESET_PAGE_SIZE = 20;
const HISTORY_PAGE_SIZE = 10;
const RESET_USER_OPTION_PAGE_SIZE = 20;
const RESET_USER_SEARCH_DEBOUNCE_MS = 250;
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// 기준 시간대는 free text 대신 운영에서 실제로 쓰는 후보만 노출한다.
// 현재 정책 값이 목록에 없으면 옵션에 동적으로 추가해 표시가 깨지지 않게 한다.
const TIMEZONE_OPTIONS = [
  'Asia/Seoul',
  'Asia/Tokyo',
  'Asia/Shanghai',
  'Asia/Taipei',
  'Asia/Ho_Chi_Minh',
  'Asia/Bangkok',
  'Asia/Jakarta',
  'Asia/Manila',
  'Asia/Kuala_Lumpur',
  'Asia/Ulaanbaatar',
  'UTC'
];

type ActiveTab = 'policies' | 'resets';

type PolicyFormValues = {
  limitCount: number;
  periodUnit: PdfQuotaPeriodUnit;
  periodTimezone: string;
  reason: string;
};

type ResetFormValues = {
  scope: PdfQuotaResetScope;
  userId?: string;
  groupCode?: string;
  problemId?: string;
  reason: string;
};

function parseActiveTab(value: string | null): ActiveTab {
  return value === 'resets' ? 'resets' : 'policies';
}

function formatLimitLabel(limit: number | null): string {
  if (limit === null) return '-';
  return limit === 0 ? '0회(중단)' : `${limit}회`;
}

function formatUnitLabel(unit: PdfQuotaPeriodUnit | null): string {
  return unit ? pdfQuotaPeriodUnitLabels[unit] : '-';
}

function formatResetUserOptionLabel(user: PdfQuotaResetUserOption): string {
  const primary = user.nickname || user.displayName || '-';
  const secondary = user.email || user.id;
  return `${primary} (${secondary})`;
}

function mergeResetUserOptions(
  current: PdfQuotaResetUserOption[],
  next: PdfQuotaResetUserOption[]
): PdfQuotaResetUserOption[] {
  const seen = new Set(current.map((user) => user.id));
  return [...current, ...next.filter((user) => !seen.has(user.id))];
}

// 구형 감사 행(변경 키만 기록)은 from/to가 비어 있으므로 결과값으로 fallback한다.
function renderTransition(
  from: string,
  to: string,
  hasDiff: boolean,
  fallback: string
): string {
  if (!hasDiff) {
    return fallback === '-' ? '기록 없음' : `${fallback} (결과값)`;
  }
  if (from === to) {
    return to;
  }
  return `${from} → ${to}`;
}

export default function OperationPdfQuotaPage(): JSX.Element {
  const [searchParams, setSearchParams] = useSearchParams();
  const activeTab = parseActiveTab(searchParams.get('tab'));

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
  const [policyForm] = Form.useForm<PolicyFormValues>();
  const policyPeriodUnitValue = Form.useWatch('periodUnit', policyForm);
  const policyLimitValue = Form.useWatch('limitCount', policyForm);

  const [resetModalOpen, setResetModalOpen] = useState(false);
  const [resetSaving, setResetSaving] = useState(false);
  const [resetForm] = Form.useForm<ResetFormValues>();
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
      { page: historyPage, pageSize: HISTORY_PAGE_SIZE },
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
      { page: resetPage, pageSize: RESET_PAGE_SIZE, scope: resetScopeFilter },
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
    }, RESET_USER_SEARCH_DEBOUNCE_MS);

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
        pageSize: RESET_USER_OPTION_PAGE_SIZE
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
              : mergeResetUserOptions(prev.data, result.data.items);

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
    async (values: PolicyFormValues) => {
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
              적용 값: {formatLimitLabel(values.limitCount)}/
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
    async (values: ResetFormValues) => {
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

  const historyColumns = useMemo<TableColumnsType<PdfQuotaPolicyHistoryEntry>>(
    () => [
      {
        title: '변경 시각',
        dataIndex: 'createdAt',
        width: 150
      },
      {
        title: '처리자',
        key: 'actor',
        width: 200,
        render: (_, record) =>
          record.actorName || record.actorEmail ? (
            <Space direction="vertical" size={0}>
              <Text>{record.actorName || '-'}</Text>
              <Text type="secondary">{record.actorEmail}</Text>
            </Space>
          ) : (
            <Text type="secondary">-</Text>
          )
      },
      {
        title: '한도',
        key: 'limit',
        width: 150,
        render: (_, record) =>
          renderTransition(
            formatLimitLabel(record.limitFrom),
            formatLimitLabel(record.limitTo),
            record.limitFrom !== null || record.limitTo !== null,
            formatLimitLabel(record.resultLimit)
          )
      },
      {
        title: '주기',
        key: 'periodUnit',
        width: 120,
        render: (_, record) =>
          renderTransition(
            formatUnitLabel(record.periodUnitFrom),
            formatUnitLabel(record.periodUnitTo),
            record.periodUnitFrom !== null || record.periodUnitTo !== null,
            formatUnitLabel(record.resultPeriodUnit)
          )
      },
      {
        title: '기준 시간대',
        key: 'timezone',
        width: 170,
        render: (_, record) => {
          if (!record.periodTimezoneFrom && !record.periodTimezoneTo) {
            return <Text type="secondary">-</Text>;
          }
          if (record.periodTimezoneFrom === record.periodTimezoneTo) {
            return record.periodTimezoneTo;
          }
          return `${record.periodTimezoneFrom ?? '-'} → ${record.periodTimezoneTo ?? '-'}`;
        }
      },
      {
        title: '사유/근거',
        dataIndex: 'reason'
      }
    ],
    []
  );

  const resetColumns = useMemo<TableColumnsType<PdfQuotaReset>>(
    () => [
      {
        title: '실행일',
        dataIndex: 'createdAt',
        width: 150
      },
      {
        title: '범위',
        dataIndex: 'scope',
        width: 110,
        render: (scope: PdfQuotaResetScope) => (
          <Tag color={scope === 'global' ? 'red' : scope === 'group' ? 'blue' : undefined}>
            {pdfQuotaResetScopeLabels[scope]}
          </Tag>
        )
      },
      {
        title: '대상 수',
        dataIndex: 'targetCount',
        width: 100,
        render: (targetCount: number) => `${targetCount.toLocaleString()}명`
      },
      {
        title: '문항',
        dataIndex: 'problemId',
        width: 200,
        render: (problemId: string | null) =>
          problemId ? <Text code>{problemId}</Text> : '전체 문항'
      },
      {
        title: '사유/근거',
        dataIndex: 'reason'
      },
      {
        title: '처리자',
        key: 'actor',
        width: 200,
        render: (_, record) =>
          record.actorName || record.actorEmail ? (
            <Space direction="vertical" size={0}>
              <Text>{record.actorName || '-'}</Text>
              <Text type="secondary">{record.actorEmail}</Text>
            </Space>
          ) : (
            <Text type="secondary">-</Text>
          )
      }
    ],
    []
  );

  const timezoneOptions = useMemo(() => {
    const values = new Set(TIMEZONE_OPTIONS);
    if (basePolicy?.periodTimezone) {
      values.add(basePolicy.periodTimezone);
    }
    return [...values].map((zone) => ({ value: zone, label: zone }));
  }, [basePolicy?.periodTimezone]);

  const policyInitialValues: PolicyFormValues = {
    limitCount: basePolicy?.limitCount ?? 3,
    periodUnit: basePolicy?.periodUnit ?? 'month',
    periodTimezone: basePolicy?.periodTimezone ?? 'Asia/Seoul',
    reason: ''
  };

  const policiesToolbar = (
    <div className="admin-list-card-toolbar-side">
      <Space>
        <Text className="admin-list-card-toolbar-summary" type="secondary">
          {basePolicy
            ? `현재 정책: ${formatLimitLabel(basePolicy.limitCount)}/${pdfQuotaPeriodUnitLabels[basePolicy.periodUnit]} · ${basePolicy.periodTimezone} · 마지막 변경 ${basePolicy.updatedAt}`
            : '정책 없음 — 저장하면 새 정책이 생성됩니다'}
        </Text>
        {basePolicy?.limitCount === 0 ? <Tag color="red">내보내기 중단됨</Tag> : null}
      </Space>
      <div className="admin-list-card-toolbar-actions">
        <Button
          type="primary"
          size="large"
          loading={policySaving}
          disabled={policySaving || !policiesLoaded}
          onClick={() => void submitPolicyForm()}
        >
          정책 저장
        </Button>
      </div>
    </div>
  );

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
  const editingPeriodUnitChanged = Boolean(
    basePolicy &&
      policyPeriodUnitValue !== undefined &&
      policyPeriodUnitValue !== basePolicy.periodUnit
  );

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
              <AdminListCard toolbar={policiesToolbar}>
                {policiesState.status === 'error' ? (
                  <Alert
                    type="error"
                    showIcon
                    style={{ marginBottom: 12 }}
                    message="정책을 불러오지 못했습니다."
                    description={
                      <Space direction="vertical">
                        <Text>
                          {policiesState.errorMessage ?? '일시적인 오류가 발생했습니다.'}
                        </Text>
                        {policiesState.errorCode ? (
                          <Text type="secondary">오류 코드: {policiesState.errorCode}</Text>
                        ) : null}
                      </Space>
                    }
                    action={
                      <Button
                        size="small"
                        onClick={() => setPoliciesReloadKey((prev) => prev + 1)}
                      >
                        다시 시도
                      </Button>
                    }
                  />
                ) : null}

                {isAllInactiveDrift ? (
                  <Alert
                    type="warning"
                    showIcon
                    style={{ marginBottom: 12 }}
                    message="활성 정책이 없어 사용자 PDF 내보내기가 실패하는 상태입니다."
                    description="아래 설정을 저장하면 최신 정책이 자동으로 복구(활성화)됩니다."
                  />
                ) : null}

                {policiesState.status === 'empty' ? (
                  <Alert
                    type="info"
                    showIcon
                    style={{ marginBottom: 12 }}
                    message="등록된 정책이 없습니다."
                    description="아래 설정을 저장하면 새 정책이 생성됩니다. 활성 정책이 없으면 v13 내보내기가 실패합니다."
                  />
                ) : null}

                {basePolicy?.limitCount === 0 ? (
                  <Alert
                    type="error"
                    showIcon
                    style={{ marginBottom: 12 }}
                    message="현재 PDF 내보내기가 중단된 상태입니다(한도 0회)."
                    description="한도를 1 이상으로 저장하면 내보내기가 재개됩니다."
                  />
                ) : null}

                <Alert
                  type="warning"
                  showIcon
                  style={{ marginBottom: 12 }}
                  message="주기 변경 주의"
                  description="주기(일/주/월)를 변경하면 기존 사용량이 새 주기 경계와 달라 카운트에서 제외됩니다. 사실상 전체 회원의 사용량이 초기화되는 효과가 있습니다."
                />
                {editingPeriodUnitChanged ? (
                  <Alert
                    type="error"
                    showIcon
                    style={{ marginBottom: 12 }}
                    message="이번 저장에서 주기가 변경됩니다."
                  />
                ) : null}
                {policyLimitValue === 0 ? (
                  <Alert
                    type="warning"
                    showIcon
                    style={{ marginBottom: 12 }}
                    message="한도 0회는 전 사용자의 PDF 내보내기를 중단합니다."
                    description="저장 시 한 번 더 확인합니다. 사용자에게는 횟수 소진 안내(429)가 표시됩니다."
                  />
                ) : null}

                {policiesLoaded ? (
                  // 로드 완료 후에만 Form을 렌더하고, 정책이 바뀌면 key로 리마운트해
                  // initialValues가 항상 최신 값으로 적용되게 한다(사유는 비워짐).
                  <Form
                    key={`${basePolicy?.id ?? 'new'}:${basePolicy?.updatedAtIso ?? ''}`}
                    form={policyForm}
                    layout="vertical"
                    initialValues={policyInitialValues}
                    style={{ maxWidth: 480 }}
                  >
                    <Form.Item
                      name="limitCount"
                      label="주기당 내보내기 한도(회)"
                      tooltip="0회는 의도적 내보내기 중단입니다."
                      rules={[
                        { required: true, message: '한도를 입력하세요.' },
                        { type: 'number', min: 0, message: '0 이상이어야 합니다.' }
                      ]}
                    >
                      <InputNumber min={0} max={999} style={{ width: '100%' }} />
                    </Form.Item>
                    <Form.Item
                      name="periodUnit"
                      label="주기"
                      rules={[{ required: true, message: '주기를 선택하세요.' }]}
                    >
                      <Select
                        options={pdfQuotaPeriodUnitValues.map((unit) => ({
                          value: unit,
                          label: pdfQuotaPeriodUnitLabels[unit]
                        }))}
                      />
                    </Form.Item>
                    <Form.Item
                      name="periodTimezone"
                      label="기준 시간대"
                      rules={[{ required: true, message: '시간대를 선택하세요.' }]}
                    >
                      <Select showSearch options={timezoneOptions} />
                    </Form.Item>
                    <Form.Item
                      name="reason"
                      label="사유/근거"
                      rules={[
                        { required: true, whitespace: true, message: '사유를 입력하세요.' }
                      ]}
                    >
                      <Input.TextArea
                        rows={2}
                        placeholder="정책을 변경하는 운영 사유를 입력하세요."
                      />
                    </Form.Item>
                  </Form>
                ) : policiesState.status === 'pending' ? (
                  <Alert
                    type="info"
                    showIcon
                    style={{ marginBottom: 12 }}
                    message="정책을 불러오는 중입니다."
                  />
                ) : null}

                <Divider />
                <Typography.Title level={5}>변경 이력</Typography.Title>

                {historyState.status === 'error' ? (
                  <Alert
                    type="error"
                    showIcon
                    style={{ marginBottom: 12 }}
                    message="변경 이력을 불러오지 못했습니다."
                    description={
                      <Space direction="vertical">
                        <Text>
                          {historyState.errorMessage ?? '일시적인 오류가 발생했습니다.'}
                        </Text>
                        {historyState.errorCode ? (
                          <Text type="secondary">오류 코드: {historyState.errorCode}</Text>
                        ) : null}
                      </Space>
                    }
                    action={
                      <Button
                        size="small"
                        onClick={() => setHistoryReloadKey((prev) => prev + 1)}
                      >
                        다시 시도
                      </Button>
                    }
                  />
                ) : null}

                {historyState.status === 'empty' ? (
                  <Alert
                    type="info"
                    showIcon
                    style={{ marginBottom: 12 }}
                    message="변경 이력이 없습니다."
                    description="정책을 저장하면 변경 이력이 감사 로그 기반으로 쌓입니다."
                  />
                ) : null}

                <AdminDataTable<PdfQuotaPolicyHistoryEntry>
                  rowKey="id"
                  scroll={{ x: 980 }}
                  loading={historyState.status === 'pending' && historyState.data.length === 0}
                  columns={historyColumns}
                  dataSource={historyState.data}
                  pagination={{
                    current: historyPage,
                    pageSize: HISTORY_PAGE_SIZE,
                    total: historyTotal,
                    showSizeChanger: false,
                    onChange: (nextPage) => setHistoryPage(nextPage)
                  }}
                />
              </AdminListCard>
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
                    style={{ marginBottom: 12 }}
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
                    style={{ marginBottom: 12 }}
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
                    pageSize: RESET_PAGE_SIZE,
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

      <Modal
        open={resetModalOpen}
        title="초기화 실행"
        okText="초기화 실행"
        cancelText="취소"
        confirmLoading={resetSaving}
        onOk={submitResetModal}
        onCancel={closeResetModal}
        destroyOnClose
      >
        <Space direction="vertical" size={12} style={{ width: '100%' }}>
          <Alert
            type="info"
            showIcon
            message="이번 주기 사용량만 초기화됩니다."
            description="초기화는 실행한 주기 안에서만 유효하며 다음 주기에는 영향이 없습니다. 기관 코드 대상은 실행 시점의 소속 회원 스냅샷으로 확정되고, 이후 가입자는 포함되지 않습니다."
          />
          <Form
            form={resetForm}
            layout="vertical"
            preserve={false}
            initialValues={{ scope: 'user', problemId: '', reason: '' }}
          >
            <Form.Item
              name="scope"
              label="초기화 범위"
              rules={[{ required: true, message: '범위를 선택하세요.' }]}
            >
              <Radio.Group
                options={[
                  { value: 'user', label: '개인' },
                  { value: 'group', label: '기관 코드' },
                  { value: 'global', label: '전체' }
                ]}
              />
            </Form.Item>
            {activeResetScope === 'user' ? (
              <Form.Item
                name="userId"
                label="대상 회원"
                rules={[{ required: true, message: '대상 회원을 선택하세요.' }]}
              >
                <Select
                  showSearch
                  placeholder={
                    userOptionsState.status === 'pending'
                      ? '회원을 검색하는 중...'
                      : '이메일/닉네임/회원 ID로 검색'
                  }
                  loading={userOptionsState.status === 'pending'}
                  notFoundContent={
                    userOptionsState.status === 'error'
                      ? '회원 목록 조회에 실패했습니다.'
                      : '검색 결과가 없습니다.'
                  }
                  filterOption={false}
                  searchValue={userOptionSearchInput}
                  onSearch={setUserOptionSearchInput}
                  onChange={() => setUserOptionSearchInput('')}
                  onPopupScroll={handleUserOptionsPopupScroll}
                  options={userOptionsState.data.map((user) => ({
                    value: user.id,
                    label: formatResetUserOptionLabel(user)
                  }))}
                />
              </Form.Item>
            ) : null}
            {activeResetScope === 'group' ? (
              <Form.Item
                name="groupCode"
                label="대상 기관 코드"
                rules={[{ required: true, message: '기관 코드를 선택하세요.' }]}
              >
                <Select
                  showSearch
                  placeholder={
                    codeOptionsState.status === 'pending'
                      ? '기관 코드를 불러오는 중...'
                      : '기관 코드 선택'
                  }
                  loading={codeOptionsState.status === 'pending'}
                  notFoundContent={
                    codeOptionsState.status === 'error'
                      ? '기관 코드 조회에 실패했습니다.'
                      : '검색 결과가 없습니다.'
                  }
                  optionFilterProp="label"
                  options={codeOptionsState.data.map((code) => ({
                    value: code.code,
                    label: `${code.label} (${code.code} · ${code.memberCount.toLocaleString()}명)`
                  }))}
                />
              </Form.Item>
            ) : null}
            {activeResetScope === 'global' ? (
              <Alert
                type="warning"
                showIcon
                style={{ marginBottom: 12 }}
                message="모든 회원이 대상입니다."
                description="전체 초기화는 실행 시점의 회원 스냅샷을 대상 목록으로 확정합니다. 이후 가입자는 포함되지 않으며, 실행 시 한 번 더 확인합니다."
              />
            ) : null}
            <Form.Item
              name="problemId"
              label="문항 ID (선택)"
              tooltip="비워두면 전체 문항의 사용량을 초기화합니다."
              rules={[
                {
                  validator: (_, value: string | undefined) => {
                    const trimmed = value?.trim();
                    if (!trimmed || UUID_PATTERN.test(trimmed)) {
                      return Promise.resolve();
                    }
                    return Promise.reject(
                      new Error('UUID 형식의 문항 ID를 입력하세요.')
                    );
                  }
                }
              ]}
            >
              <Input placeholder="예: 3f4c...-형식 UUID, 비워두면 전체 문항" />
            </Form.Item>
            <Form.Item
              name="reason"
              label="사유/근거"
              rules={[{ required: true, whitespace: true, message: '사유를 입력하세요.' }]}
            >
              <Input.TextArea
                rows={2}
                placeholder="초기화를 실행하는 운영 사유를 입력하세요."
              />
            </Form.Item>
          </Form>
        </Space>
      </Modal>
    </div>
  );
}
