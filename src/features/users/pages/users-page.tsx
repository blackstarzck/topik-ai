import type { ChangeEvent, Key } from 'react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { DownloadOutlined } from '@ant-design/icons';
import {
  Alert,
  Button,
  Form,
  notification,
  Select,
  Space,
  Typography
} from 'antd';
import type { TableProps } from 'antd';
import { useNavigate, useSearchParams } from 'react-router-dom';

import { exportUsersSafe, fetchUsersSafe, setUserStatusSafe } from '../api/users-service';
import {
  buildUsersExportFileName,
  buildUsersWorkbook,
  downloadWorkbook,
  formatKstTimestampLabel,
  getUserExportColumnLabels,
  normalizeUserExportColumns
} from '../model/export-users-xlsx';
import { buildUserExportFiltersFromQuery } from '../model/user-export-filter';
import type { UserExportScope } from '../model/user-export-types';
import {
  clearInstitutionCodeSafe,
  fetchInstitutionCodesSafe
} from '../api/institution-codes-service';
import {
  inviteInstitutionMembersGuardedSafe,
  translateInstitutionContractError
} from '../api/institution-contracts-service';
import { kickNotificationEmailDispatch } from '../../../shared/api/notification-email-kick';
import type { InstitutionCode } from '../model/institution-codes-types';
import { usePermissionStore } from '../../system/model/permission-store';
import { useUsersQueryStore } from '../model/users-query-store';
import type {
  UserStatus,
  UserSummary,
  UsersQuery,
  UsersSearchField
} from '../model/types';
import {
  buildActiveCodeOptions,
  buildAffiliationFilterOptions,
  buildAffiliationScopeLabel,
  buildFilterSummaryLabel,
  buildUsersSearchParams,
  filterUsers,
  pageSizeOptions,
  parseUsersQuery,
  parseUsersTableFilters,
  searchFieldOptions,
  type UsersExportFormValues,
  type UsersListActionState
} from '../model/users-page-schema';
import { createUsersColumns } from '../ui/users-columns';
import { UsersBulkModal } from '../ui/users-bulk-modal';
import { UsersExportModal } from '../ui/users-export-modal';
import { UsersMemoModal } from '../ui/users-memo-modal';
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
import { AdminDataTable } from '../../../shared/ui/table/admin-data-table';
import type { AsyncState } from '../../../shared/model/async-state';
import { getTargetTypeLabel } from '../../../shared/model/target-type-label';

const { Text } = Typography;


export default function UsersPage(): JSX.Element {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const query = useUsersQueryStore((state) => state.query);
  const replaceQuery = useUsersQueryStore((state) => state.replaceQuery);
  const setQuery = useUsersQueryStore((state) => state.setQuery);
  const [usersState, setUsersState] = useState<AsyncState<UserSummary[]>>({
    status: 'pending',
    data: [],
    errorMessage: null,
    errorCode: null
  });
  const [reloadKey, setReloadKey] = useState(0);
  const [actionState, setActionState] = useState<UsersListActionState>(null);
  const [memoForm] = Form.useForm<{ memo: string }>();
  const [memoTarget, setMemoTarget] = useState<UserSummary | null>(null);
  const [notificationApi, notificationContextHolder] = notification.useNotification();
  const {
    draftStartDate,
    draftEndDate,
    handleDraftDateChange,
    handleDraftReset,
    handleDetailOpenChange
  } = useSearchBarDateDraft(query.startDate, query.endDate);

  // 서버사이드 "기관 소속" 필터는 query.affiliation('' | @affiliated | @general | 특정 코드)로
  // 관리한다 — 검색/상세검색과 동일하게 URL·스토어에 실려 상세 진입 후 뒤로가기에도 유지된다.
  // 기관 코드 카탈로그 — 필터 옵션 + 일괄 배정 모달 코드 피커용.
  const [institutionCodes, setInstitutionCodes] = useState<InstitutionCode[]>([]);
  // 다중 선택 + 일괄 배정/해제 모달.
  const [selectedRowKeys, setSelectedRowKeys] = useState<Key[]>([]);
  const [bulkMode, setBulkMode] = useState<'assign' | 'clear' | null>(null);
  const [bulkSubmitting, setBulkSubmitting] = useState(false);
  const [bulkForm] = Form.useForm<{
    code: string;
    reason: string;
    expiresInDays: number;
  }>();

  // 기관 코드 회원 배정/해제 권한(메뉴 게이팅과 동일 키). 미보유 시 일괄 액션 숨김.
  const currentAdminId = usePermissionStore((state) => state.currentAdminId);
  const admins = usePermissionStore((state) => state.admins);
  const canManageInstitutionCodes = useMemo(() => {
    const me = admins.find((item) => item.adminId === currentAdminId);
    return me?.permissions.includes('users.institution-codes.manage') ?? false;
  }, [admins, currentAdminId]);
  // 회원 정보 내보내기(개인정보 반출) 권한 — 기본은 SUPER_ADMIN 만. 서버 RPC 도
  // platform_admin 전용 + 사유 필수 + 감사 기록으로 별도 강제한다(UI 게이팅은 편의).
  const canExportUsers = useMemo(() => {
    const me = admins.find((item) => item.adminId === currentAdminId);
    return me?.permissions.includes('users.export') ?? false;
  }, [admins, currentAdminId]);
  // 내보내기 다이얼로그(사유 필수 + 대상/컬럼/전화번호 마스킹·원문 선택).
  const [exportOpen, setExportOpen] = useState(false);
  const [exportSubmitting, setExportSubmitting] = useState(false);
  const [exportForm] = Form.useForm<UsersExportFormValues>();

  useEffect(() => {
    const parsed = parseUsersQuery(searchParams);
    replaceQuery(parsed);
  }, [replaceQuery, searchParams]);

  useEffect(() => {
    const controller = new AbortController();

    // 데이터셋이 새로 로드되면(필터/재조회 포함) 이전 선택은 무효 → 초기화.
    setSelectedRowKeys([]);
    setUsersState((prev) => ({
      ...prev,
      status: 'pending',
      errorMessage: null,
      errorCode: null
    }));

    void fetchUsersSafe(controller.signal, query.affiliation).then((result) => {
      if (controller.signal.aborted) {
        return;
      }

      if (result.ok) {
        setUsersState({
          status: result.data.length === 0 ? 'empty' : 'success',
          data: result.data,
          errorMessage: null,
          errorCode: null
        });
        return;
      }

      setUsersState((prev) => ({
        ...prev,
        status: 'error',
        errorMessage: result.error.message,
        errorCode: result.error.code
      }));
    });

    return () => {
      controller.abort();
    };
  }, [query.page, query.pageSize, reloadKey, query.affiliation]);

  // 기관 코드 카탈로그 로드(필터 옵션 + 일괄 배정 코드 피커). 실패해도 목록 기능엔 영향 없음.
  useEffect(() => {
    const controller = new AbortController();
    void fetchInstitutionCodesSafe(controller.signal).then((result) => {
      if (controller.signal.aborted || !result.ok) {
        return;
      }
      setInstitutionCodes(result.data);
    });
    return () => {
      controller.abort();
    };
  }, []);

  const commitQuery = useCallback(
    (next: Partial<UsersQuery>) => {
      const merged = { ...query, ...next };
      setSelectedRowKeys([]);
      setQuery(next);
      setSearchParams(buildUsersSearchParams(merged), { replace: true });
    },
    [query, setQuery, setSearchParams]
  );

  const filteredUsers = useMemo(
    () => filterUsers(usersState.data, query),
    [usersState.data, query]
  );

  const affiliationFilterOptions = useMemo(
    () => buildAffiliationFilterOptions(institutionCodes),
    [institutionCodes]
  );

  // 내보내기 범위 라벨 — 서버사이드 기관 필터(query.affiliation)만 반영된다는 사실을
  // 다이얼로그와 파일('내보내기 정보' 시트)에 그대로 기록한다.
  const affiliationScopeLabel = useMemo(
    () => buildAffiliationScopeLabel(query.affiliation, institutionCodes),
    [institutionCodes, query.affiliation]
  );

  const exportFilterSummaryLabel = useMemo(
    () => buildFilterSummaryLabel(query, affiliationScopeLabel),
    [affiliationScopeLabel, query]
  );

  // 일괄 배정 코드 피커는 활성 코드만(종료 코드 신규 배정은 RPC가 차단).
  const activeCodeOptions = useMemo(
    () => buildActiveCodeOptions(institutionCodes),
    [institutionCodes]
  );

  const selectedCount = selectedRowKeys.length;

  const handleAffiliationChange = useCallback(
    (value: string) => {
      commitQuery({ affiliation: value, page: 1 });
    },
    [commitQuery]
  );

  const handleClearSelection = useCallback(() => {
    setSelectedRowKeys([]);
  }, []);

  const handleOpenBulkAssign = useCallback(() => {
    setBulkMode('assign');
  }, []);

  const handleOpenBulkClear = useCallback(() => {
    setBulkMode('clear');
  }, []);

  const handleCloseBulk = useCallback(() => {
    if (bulkSubmitting) {
      return;
    }
    setBulkMode(null);
  }, [bulkSubmitting]);

  const handleOpenExport = useCallback(() => {
    setExportOpen(true);
  }, []);

  const handleCloseExport = useCallback(() => {
    if (exportSubmitting) {
      return;
    }
    setExportOpen(false);
  }, [exportSubmitting]);

  // 내보내기 다이얼로그가 열릴 때 이전 입력을 초기화한다.
  const handleExportSubmit = useCallback(async () => {
    if (exportSubmitting) {
      return;
    }
    setExportSubmitting(true);
    let values: UsersExportFormValues;
    try {
      values = await exportForm.validateFields();
    } catch {
      setExportSubmitting(false);
      return;
    }
    const selectedColumns = normalizeUserExportColumns(values.columns);
    const includeFullPhone =
      selectedColumns.includes('phone') && values.phoneMode === 'full';
    const scope: UserExportScope =
      values.scope === 'selected' && selectedRowKeys.length > 0
        ? 'selected'
        : 'filters';
    const selectedUserIds = scope === 'selected' ? selectedRowKeys.map(String) : [];
    const exportFilters = buildUserExportFiltersFromQuery(query);

    // 서버가 사유와 안전한 필터 요약을 감사 로그에 기록한 뒤 범위에 맞는 회원을 반환한다.
    const result = await exportUsersSafe({
      reason: values.reason.trim(),
      includeFullPhone,
      affiliation: query.affiliation || undefined,
      scope,
      selectedUserIds,
      filters: exportFilters,
      columns: selectedColumns
    });
    if (!result.ok) {
      setExportSubmitting(false);
      notificationApi.error({
        message: '회원 정보 내보내기 실패',
        description: result.error.message
      });
      return;
    }

    try {
      const meta = {
        exportedAtLabel: formatKstTimestampLabel(new Date()),
        reason: values.reason.trim(),
        includeFullPhone,
        scopeLabel:
          scope === 'selected'
            ? `선택한 회원 ${selectedUserIds.length.toLocaleString()}명`
            : '현재 목록 조건',
        filterSummaryLabel:
          scope === 'selected'
            ? `선택한 사용자 ID ${selectedUserIds.length.toLocaleString()}개`
            : exportFilterSummaryLabel,
        selectedColumnLabels: getUserExportColumnLabels(selectedColumns)
      };
      const buffer = await buildUsersWorkbook(result.data, meta, selectedColumns);
      downloadWorkbook(buffer, buildUsersExportFileName(meta));
    } catch (error) {
      setExportSubmitting(false);
      notificationApi.error({
        message: '엑셀 파일 생성 실패',
        description: error instanceof Error ? error.message : '파일 생성 중 오류가 발생했습니다.'
      });
      return;
    }

    setExportSubmitting(false);
    setExportOpen(false);
    notificationApi.success({
      message: '회원 정보 내보내기 완료',
      description: `${result.data.length.toLocaleString()}명 · ${
        includeFullPhone ? '전화번호 원문 포함' : '전화번호 마스킹'
      } · ${
        scope === 'selected' ? '선택한 회원만' : '현재 목록 조건'
      } · 내보내기 내역이 감사 로그에 기록되었습니다.`
    });
  }, [
    exportFilterSummaryLabel,
    exportForm,
    exportSubmitting,
    notificationApi,
    query,
    selectedRowKeys
  ]);

  const handleBulkSubmit = useCallback(async () => {
    if (!bulkMode || bulkSubmitting) {
      return;
    }
    const ids = selectedRowKeys.map(String);
    if (ids.length === 0) {
      setBulkMode(null);
      return;
    }

    // submitting을 검증 await 전에 세워 더블 서밋 창을 닫는다.
    setBulkSubmitting(true);
    let values: { code: string; reason: string; expiresInDays: number };
    try {
      values = await bulkForm.validateFields();
    } catch {
      setBulkSubmitting(false);
      return;
    }
    const result =
      bulkMode === 'assign'
        ? // 정원·계약 만료 차단이 걸린 wrapper 로 보낸다(기관 코드 화면과 같은 경로).
          // 만료 기간을 비우면 서버가 기관 설정의 기본값으로 해석한다.
          await inviteInstitutionMembersGuardedSafe(
            ids,
            values.code,
            values.reason,
            values.expiresInDays ?? null
          )
        : await clearInstitutionCodeSafe(ids, values.reason);
    setBulkSubmitting(false);

    const actionLabel = bulkMode === 'assign' ? '기관 초대' : '기관 소속 해제';
    if (!result.ok) {
      notificationApi.error({
        message: `${actionLabel} 실패`,
        description: translateInstitutionContractError(result.error.message)
      });
      return;
    }

    if (bulkMode === 'assign' && result.data > 0) {
      // 이메일이 cron 주기를 기다리지 않도록 워커 즉시 kick(실패해도 cron 이 수거).
      void kickNotificationEmailDispatch();
    }

    notificationApi.success({
      message: `${actionLabel} 완료`,
      description:
        bulkMode === 'assign'
          ? `${result.data.toLocaleString()}명에게 초대를 보냈습니다. 인앱 알림은 즉시 전달되고 이메일 발송을 시작했습니다. 발송 결과는 메시지 ▸ 발송 이력에서 확인할 수 있습니다. (선택 ${ids.length}명, 이미 소속·대기 중 제외)`
          : `${result.data.toLocaleString()}명 처리되었습니다. (선택 ${ids.length}명, 변경 없음 제외)`
    });
    setBulkMode(null);
    setSelectedRowKeys([]);
    setReloadKey((prev) => prev + 1);
  }, [bulkForm, bulkMode, bulkSubmitting, notificationApi, selectedRowKeys]);

  const handleSuspend = useCallback((user: UserSummary) => {
    setActionState({ type: 'suspend', user });
  }, []);

  const handleUnsuspend = useCallback((user: UserSummary) => {
    setActionState({ type: 'unsuspend', user });
  }, []);

  const handleOpenDetail = useCallback(
    (userId: string) => {
      navigate(`/users/${userId}?tab=profile`);
    },
    [navigate]
  );

  const handleMemoOpen = useCallback(
    (user: UserSummary) => {
      setMemoTarget(user);
      memoForm.setFieldsValue({ memo: '' });
    },
    [memoForm]
  );

  const closeAction = useCallback(() => setActionState(null), []);
  const closeMemoModal = useCallback(() => setMemoTarget(null), []);

  const handleConfirmAction = useCallback(
    async (reason: string) => {
      if (!actionState) {
        return;
      }

      const nextStatus: UserStatus =
        actionState.type === 'suspend' ? '정지' : '정상';
      const actionLabel =
        actionState.type === 'suspend' ? '회원 정지' : '회원 정지 해제';

      // Phase B: persist via the audited RPC (admin_set_user_status). Real actor +
      // permission enforced server-side; mock mode is a no-op success.
      const result = await setUserStatusSafe(actionState.user.id, nextStatus);
      if (!result.ok) {
        notificationApi.error({
          message: `${actionLabel} 실패`,
          description: result.error.message
        });
        setActionState(null);
        return;
      }

      setUsersState((prev) => {
        const nextData = prev.data.map((item) =>
          item.id === actionState.user.id ? { ...item, status: nextStatus } : item
        );

        return {
          ...prev,
          data: nextData,
          status: nextData.length === 0 ? 'empty' : 'success'
        };
      });

      notificationApi.success({
        message: `${actionLabel} 완료`,
        description: (
          <Space direction="vertical">
            <Text>대상 유형: {getTargetTypeLabel('Users')}</Text>
            <Text>대상 ID: {actionState.user.id}</Text>
            <Text>사유/근거: {reason}</Text>
            <AuditLogLink targetType="Users" targetId={actionState.user.id} />
          </Space>
        )
      });
      setActionState(null);
    },
    [actionState, notificationApi]
  );

  const handleMemoSubmit = useCallback(async () => {
    if (!memoTarget) {
      return;
    }

    const values = await memoForm.validateFields();
    notificationApi.success({
      message: '관리자 메모 작성 완료',
      description: (
        <Space direction="vertical">
          <Text>대상 유형: {getTargetTypeLabel('Users')}</Text>
          <Text>대상 ID: {memoTarget.id}</Text>
          <Text>사유/근거: {values.memo}</Text>
          <AuditLogLink targetType="Users" targetId={memoTarget.id} />
        </Space>
      )
    });
    setMemoTarget(null);
  }, [memoForm, memoTarget, notificationApi]);

  const columns = useMemo(
    () =>
      createUsersColumns({
        genderFilters: query.genderFilters,
        tierFilters: query.tierFilters,
        subscriptionStatusFilters: query.subscriptionStatusFilters,
        membershipStatusFilters: query.membershipStatusFilters,
        termsConsentStatusFilters: query.termsConsentStatusFilters,
        emailVerificationStatusFilters: query.emailVerificationStatusFilters,
        onSuspend: handleSuspend,
        onUnsuspend: handleUnsuspend,
        onMemoOpen: handleMemoOpen
      }),
    [
      handleMemoOpen,
      handleSuspend,
      handleUnsuspend,
      query.emailVerificationStatusFilters,
      query.genderFilters,
      query.membershipStatusFilters,
      query.subscriptionStatusFilters,
      query.termsConsentStatusFilters,
      query.tierFilters
    ]
  );

  const handleRowClick = useCallback(
    (record: UserSummary) => ({
      onClick: () => handleOpenDetail(record.id),
      style: { cursor: 'pointer' }
    }),
    [handleOpenDetail]
  );

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
        searchField: value as UsersSearchField,
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

  const handleTableChange = useCallback<NonNullable<TableProps<UserSummary>['onChange']>>(
    (_pagination, filters, _sorter, extra) => {
      if (extra.action !== 'filter') {
        return;
      }
      commitQuery({ page: 1, ...parseUsersTableFilters(filters) });
    },
    [commitQuery]
  );

  const handleRetryLoad = useCallback(() => {
    setReloadKey((prev) => prev + 1);
  }, []);

  // 다중 선택은 기관 코드 관리 권한자와 회원 내보내기 권한자에게 노출한다.
  // 단, 기관 초대/해제 일괄 액션은 users.institution-codes.manage 권한자에게만 유지한다.
  const rowSelection = canManageInstitutionCodes || canExportUsers
    ? {
        selectedRowKeys,
        onChange: (keys: Key[]) => setSelectedRowKeys(keys),
        fixed: true as const,
        preserveSelectedRowKeys: false
      }
    : undefined;

  return (
    <div>
      {notificationContextHolder}
      <PageTitle title="회원 목록" />

      {usersState.status === 'error' ? (
        <Alert
          type="error"
          showIcon
          style={{ marginBottom: 12 }}
          message="회원 목록 조회에 실패했습니다."
          description={
            <Space direction="vertical" size={4}>
              <Text>{usersState.errorMessage ?? '일시적인 오류가 발생했습니다.'}</Text>
              <Text type="secondary">오류 코드: {usersState.errorCode ?? '-'}</Text>
              <Space>
                <Button onClick={handleRetryLoad}>재시도</Button>
                <Text type="secondary">마지막 성공 데이터는 유지됩니다.</Text>
              </Space>
            </Space>
          }
        />
      ) : null}

      <AdminListCard
        toolbar={
          <SearchBar
            searchField={query.searchField}
            searchFieldOptions={searchFieldOptions}
            keyword={query.keyword}
            onSearchFieldChange={handleSearchFieldChange}
            onKeywordChange={handleKeywordChange}
            keywordPlaceholder="검색..."
            detailTitle="상세 검색"
            detailContent={
              <SearchBarDetailField label="가입일">
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
            extra={
              <Space size={8} align="center">
                <Text type="secondary">기관 소속</Text>
                <Select
                  value={query.affiliation}
                  onChange={handleAffiliationChange}
                  options={affiliationFilterOptions}
                  style={{ width: 240 }}
                  aria-label="기관 소속 필터"
                />
              </Space>
            }
            actions={
              canExportUsers ? (
                <Button icon={<DownloadOutlined />} size="large" onClick={handleOpenExport}>
                  회원 정보 내보내기
                </Button>
              ) : null
            }
          />
        }
      >
        {canManageInstitutionCodes && selectedCount > 0 ? (
          <Alert
            type="info"
            showIcon
            style={{ marginBottom: 12 }}
            message={`${selectedCount.toLocaleString()}명 선택됨`}
            action={
              <Space>
                <Button size="small" type="primary" onClick={handleOpenBulkAssign}>
                  기관 초대
                </Button>
                <Button size="small" onClick={handleOpenBulkClear}>
                  기관 소속 해제
                </Button>
                <Button size="small" type="text" onClick={handleClearSelection}>
                  선택 해제
                </Button>
              </Space>
            }
          />
        ) : null}
        {usersState.status === 'empty' ? (
          <Alert
            type="info"
            showIcon
            style={{ marginBottom: 12 }}
            message="조회된 회원 데이터가 없습니다."
            description="필터 조건을 확인하거나 잠시 후 다시 조회해주세요."
          />
        ) : null}
        <AdminDataTable<UserSummary>
          className="users-table--footer-total-left"
          rowKey="id"
          columns={columns}
          dataSource={filteredUsers}
          rowSelection={rowSelection}
          onRow={handleRowClick}
          onChange={handleTableChange}
          loading={usersState.status === 'pending'}
          scroll={{ x: 2750, y: 560 }}
          pagination={{
            current: query.page,
            pageSize: query.pageSize,
            pageSizeOptions,
            showSizeChanger: true,
            showTotal: (total) => `총 ${total.toLocaleString()}건`,
            onChange: (page, pageSize) => {
              commitQuery({
                page,
                pageSize: pageSize ?? query.pageSize
              });
            }
          }}
        />
      </AdminListCard>

      {actionState ? (
        <ConfirmAction
          open
          title={actionState.type === 'suspend' ? '회원 정지' : '회원 정지 해제'}
          description={
            actionState.type === 'suspend'
              ? '회원 기능을 제한합니다. 조치 사유를 기록하세요.'
              : '회원 기능을 복구합니다. 해제 사유를 기록하세요.'
          }
          targetType="Users"
          targetId={actionState.user.id}
          confirmText={actionState.type === 'suspend' ? '정지 실행' : '해제 실행'}
          onCancel={closeAction}
          onConfirm={handleConfirmAction}
        />
      ) : null}

      <UsersMemoModal
        target={memoTarget}
        form={memoForm}
        onOk={handleMemoSubmit}
        onCancel={closeMemoModal}
      />

      <UsersBulkModal
        mode={bulkMode}
        submitting={bulkSubmitting}
        selectedCount={selectedCount}
        activeCodeOptions={activeCodeOptions}
        form={bulkForm}
        onOk={handleBulkSubmit}
        onCancel={handleCloseBulk}
      />

      <UsersExportModal
        open={exportOpen}
        submitting={exportSubmitting}
        selectedCount={selectedCount}
        filterSummaryLabel={exportFilterSummaryLabel}
        form={exportForm}
        onOk={handleExportSubmit}
        onCancel={handleCloseExport}
      />
    </div>
  );
}
