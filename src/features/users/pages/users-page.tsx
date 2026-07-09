import type { ChangeEvent, Key } from 'react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { DownloadOutlined } from '@ant-design/icons';
import {
  Alert,
  Button,
  Checkbox,
  Form,
  Input,
  InputNumber,
  Modal,
  notification,
  Radio,
  Select,
  Space,
  Tag,
  Typography
} from 'antd';
import type { TableColumnsType, TableProps } from 'antd';
import { useNavigate, useSearchParams } from 'react-router-dom';

import { exportUsersSafe, fetchUsersSafe, setUserStatusSafe } from '../api/users-service';
import {
  buildUsersExportFileName,
  buildUsersWorkbook,
  downloadWorkbook,
  formatKstTimestampLabel,
  getUserExportColumnLabels,
  normalizeUserExportColumns,
  userExportColumnOptions
} from '../model/export-users-xlsx';
import {
  buildUserExportFiltersFromQuery,
  toUserGenderFilter,
  userMatchesExportFilters
} from '../model/user-export-filter';
import {
  defaultUserExportColumnKeys,
  requiredUserExportColumnKeys,
  type UserExportColumnKey,
  type UserExportScope
} from '../model/user-export-types';
import {
  inviteInstitutionMembersSafe,
  clearInstitutionCodeSafe,
  fetchInstitutionCodesSafe
} from '../api/institution-codes-service';
import { kickNotificationEmailDispatch } from '../../../shared/api/notification-email-kick';
import {
  AFFILIATION_FILTER_AFFILIATED,
  AFFILIATION_FILTER_ALL,
  AFFILIATION_FILTER_GENERAL
} from '../model/institution-codes-types';
import type { InstitutionCode } from '../model/institution-codes-types';
import { usePermissionStore } from '../../system/model/permission-store';
import {
  defaultUsersQuery,
  useUsersQueryStore
} from '../model/users-query-store';
import type {
  EmailVerificationStatus,
  SubscriptionStatus,
  TermsConsentDisplayStatus,
  UserGenderFilter,
  UserMembershipStatus,
  UserStatus,
  UserSummary,
  UserTier,
  UsersQuery,
  UsersSearchField
} from '../model/types';
import {
  getTermsConsentDisplayStatus,
  getUserMembershipStatus
} from '../model/registration-status';
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
import {
  parseSearchDate
} from '../../../shared/ui/search-bar/search-bar-utils';
import { SocialProviderTags } from '../../../shared/ui/social-provider/social-provider-tags';
import { StatusBadge } from '../../../shared/ui/status-badge/status-badge';
import { AdminDataTable } from '../../../shared/ui/table/admin-data-table';
import { createStatusColumnTitle } from '../../../shared/ui/table/status-column-title';
import {
  createDefinedColumnFilterProps,
  createTextSorter
} from '../../../shared/ui/table/table-column-utils';
import { TableActionMenu } from '../../../shared/ui/table/table-action-menu';
import { UserNavigationLink } from '../../../shared/ui/user/user-reference';
import type { AsyncState } from '../../../shared/model/async-state';
import { getTargetTypeLabel } from '../../../shared/model/target-type-label';
import { formatNationality } from '../../../shared/model/country-name';

const { Text } = Typography;

const pageSizeOptions = ['20', '50', '100'];
const emptyProfileValue = '-';
const userGenderFilterValues = ['남성', '여성', '기타', '미입력'] as const;
const userTierFilterValues = ['일반', '프리미엄'] as const;
const userSubscriptionStatusFilterValues = ['구독', '미구독'] as const;
const userMembershipStatusFilterValues = [
  '인증 대기',
  '약관 대기',
  '정상',
  '정지',
  '탈퇴'
] as const;
const userConsentStatusFilterValues = [
  '동의 완료',
  '일부 동의',
  '미동의',
  '동의 불가'
] as const;
const userEmailVerificationFilterValues = ['인증 완료', '미인증'] as const;

const searchFieldOptions: { label: string; value: UsersSearchField }[] = [
  { label: '전체', value: 'all' },
  { label: '사용자 ID', value: 'id' },
  { label: '이름', value: 'realName' },
  { label: '이메일', value: 'email' },
  { label: '닉네임', value: 'nickname' }
];

const searchFieldLabelMap = searchFieldOptions.reduce<Record<UsersSearchField, string>>(
  (acc, option) => {
    acc[option.value] = option.label;
    return acc;
  },
  {
    all: '전체',
    id: '사용자 ID',
    realName: '이름',
    email: '이메일',
    nickname: '닉네임'
  }
);

type ExportFormValues = {
  reason: string;
  phoneMode: 'masked' | 'full';
  scope: UserExportScope;
  columns: UserExportColumnKey[];
};

type ListActionState =
  | { type: 'suspend'; user: UserSummary }
  | { type: 'unsuspend'; user: UserSummary }
  | null;

function renderProfileValue(value: string): string {
  const trimmed = value.trim();
  return trimmed ? trimmed : emptyProfileValue;
}

function renderMembershipStatus(user: UserSummary) {
  return <StatusBadge status={getUserMembershipStatus(user)} />;
}

function renderTermsConsentStatus(user: UserSummary) {
  return <StatusBadge status={getTermsConsentDisplayStatus(user)} />;
}

function parsePositiveNumber(value: string | null, fallback: number): number {
  if (!value) {
    return fallback;
  }
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return fallback;
  }
  return parsed;
}

function parseSearchField(value: string | null): UsersSearchField {
  if (
    value === 'id' ||
    value === 'realName' ||
    value === 'email' ||
    value === 'nickname'
  ) {
    return value;
  }
  return defaultUsersQuery.searchField;
}

function parseMultiValue<T extends string>(
  value: string | null,
  allowedValues: readonly T[]
): T[] {
  if (!value) {
    return [];
  }
  const allowed = new Set<string>(allowedValues);
  return value
    .split(',')
    .map((item) => item.trim())
    .filter((item): item is T => allowed.has(item));
}

function setMultiValueParam<T extends string>(
  params: URLSearchParams,
  key: string,
  values: readonly T[]
) {
  if (values.length > 0) {
    params.set(key, values.join(','));
  }
}

function toFilteredValue<T extends string>(values: readonly T[]): T[] | null {
  return values.length > 0 ? [...values] : null;
}

function normalizeTableFilter<T extends string>(
  values: readonly Key[] | null | undefined,
  allowedValues: readonly T[]
): T[] {
  if (!values) {
    return [];
  }
  const allowed = new Set<string>(allowedValues);
  return values.map(String).filter((value): value is T => allowed.has(value));
}

function parseUsersQuery(searchParams: URLSearchParams): UsersQuery {
  return {
    page: parsePositiveNumber(searchParams.get('page'), defaultUsersQuery.page),
    pageSize: parsePositiveNumber(
      searchParams.get('pageSize'),
      defaultUsersQuery.pageSize
    ),
    status: defaultUsersQuery.status,
    sort: defaultUsersQuery.sort,
    searchField: parseSearchField(searchParams.get('searchField')),
    startDate: parseSearchDate(searchParams.get('startDate')),
    endDate: parseSearchDate(searchParams.get('endDate')),
    keyword: searchParams.get('keyword') ?? '',
    affiliation: searchParams.get('affiliation') ?? '',
    genderFilters: parseMultiValue<UserGenderFilter>(
      searchParams.get('gender'),
      userGenderFilterValues
    ),
    tierFilters: parseMultiValue<UserTier>(searchParams.get('tier'), userTierFilterValues),
    subscriptionStatusFilters: parseMultiValue<SubscriptionStatus>(
      searchParams.get('subscriptionStatus'),
      userSubscriptionStatusFilterValues
    ),
    membershipStatusFilters: parseMultiValue<UserMembershipStatus>(
      searchParams.get('membershipStatus'),
      userMembershipStatusFilterValues
    ),
    termsConsentStatusFilters: parseMultiValue<TermsConsentDisplayStatus>(
      searchParams.get('termsConsentStatus'),
      userConsentStatusFilterValues
    ),
    emailVerificationStatusFilters: parseMultiValue<EmailVerificationStatus>(
      searchParams.get('emailVerificationStatus'),
      userEmailVerificationFilterValues
    )
  };
}

function buildUsersSearchParams(query: UsersQuery): URLSearchParams {
  const params = new URLSearchParams();
  params.set('page', String(query.page));
  params.set('pageSize', String(query.pageSize));
  if (query.searchField !== 'all') {
    params.set('searchField', query.searchField);
  }
  if (query.startDate) {
    params.set('startDate', query.startDate);
  }
  if (query.endDate) {
    params.set('endDate', query.endDate);
  }
  if (query.keyword.trim()) {
    params.set('keyword', query.keyword.trim());
  }
  if (query.affiliation.trim()) {
    params.set('affiliation', query.affiliation.trim());
  }
  setMultiValueParam(params, 'gender', query.genderFilters);
  setMultiValueParam(params, 'tier', query.tierFilters);
  setMultiValueParam(params, 'subscriptionStatus', query.subscriptionStatusFilters);
  setMultiValueParam(params, 'membershipStatus', query.membershipStatusFilters);
  setMultiValueParam(params, 'termsConsentStatus', query.termsConsentStatusFilters);
  setMultiValueParam(
    params,
    'emailVerificationStatus',
    query.emailVerificationStatusFilters
  );
  return params;
}

function filterUsers(users: UserSummary[], query: UsersQuery): UserSummary[] {
  const exportFilters = buildUserExportFiltersFromQuery(query);
  const filtered = users.filter((item) => userMatchesExportFilters(item, exportFilters));

  const sorted = [...filtered].sort((left, right) => {
    if (query.sort === 'latest') {
      return right.joinedAt.localeCompare(left.joinedAt);
    }
    return left.joinedAt.localeCompare(right.joinedAt);
  });

  return sorted;
}

function buildFilterSummaryLabel(
  query: UsersQuery,
  affiliationScopeLabel: string
): string {
  const parts = [`기관 소속: ${affiliationScopeLabel}`];
  const keyword = query.keyword.trim();

  if (keyword) {
    parts.push(`검색: ${searchFieldLabelMap[query.searchField]} "${keyword}"`);
  }
  if (query.startDate || query.endDate) {
    parts.push(`가입일: ${query.startDate || '전체'} ~ ${query.endDate || '전체'}`);
  }
  if (query.genderFilters.length > 0) {
    parts.push(`성별: ${query.genderFilters.join(', ')}`);
  }
  if (query.tierFilters.length > 0) {
    parts.push(`등급: ${query.tierFilters.join(', ')}`);
  }
  if (query.subscriptionStatusFilters.length > 0) {
    parts.push(`구독 상태: ${query.subscriptionStatusFilters.join(', ')}`);
  }
  if (query.membershipStatusFilters.length > 0) {
    parts.push(`회원 상태: ${query.membershipStatusFilters.join(', ')}`);
  }
  if (query.termsConsentStatusFilters.length > 0) {
    parts.push(`약관 동의: ${query.termsConsentStatusFilters.join(', ')}`);
  }
  if (query.emailVerificationStatusFilters.length > 0) {
    parts.push(`이메일 인증: ${query.emailVerificationStatusFilters.join(', ')}`);
  }

  return parts.join(' / ');
}

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
  const [actionState, setActionState] = useState<ListActionState>(null);
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
  const [exportForm] = Form.useForm<ExportFormValues>();
  const exportColumnValues = Form.useWatch('columns', exportForm);
  const exportColumns = useMemo(
    () => normalizeUserExportColumns(exportColumnValues),
    [exportColumnValues]
  );
  const isExportPhoneColumnSelected = exportColumns.includes('phone');

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

  const affiliationFilterOptions = useMemo(() => {
    const base = {
      label: '구분',
      options: [
        { value: AFFILIATION_FILTER_ALL, label: '전체 회원' },
        { value: AFFILIATION_FILTER_AFFILIATED, label: '기관 회원만' },
        { value: AFFILIATION_FILTER_GENERAL, label: '일반 회원만' }
      ]
    };
    if (institutionCodes.length === 0) {
      return [base];
    }
    return [
      base,
      {
        label: '코드별',
        options: institutionCodes.map((code) => ({
          value: code.code,
          label: `${code.label} (${code.code})`
        }))
      }
    ];
  }, [institutionCodes]);

  // 내보내기 범위 라벨 — 서버사이드 기관 필터(query.affiliation)만 반영된다는 사실을
  // 다이얼로그와 파일('내보내기 정보' 시트)에 그대로 기록한다.
  const affiliationScopeLabel = useMemo(() => {
    if (!query.affiliation || query.affiliation === AFFILIATION_FILTER_ALL) {
      return '전체 회원';
    }
    if (query.affiliation === AFFILIATION_FILTER_AFFILIATED) {
      return '기관 회원만';
    }
    if (query.affiliation === AFFILIATION_FILTER_GENERAL) {
      return '일반 회원만';
    }
    const code = institutionCodes.find((item) => item.code === query.affiliation);
    return code ? `${code.label} (${code.code})` : query.affiliation;
  }, [institutionCodes, query.affiliation]);

  const exportFilterSummaryLabel = useMemo(
    () => buildFilterSummaryLabel(query, affiliationScopeLabel),
    [affiliationScopeLabel, query]
  );

  // 일괄 배정 코드 피커는 활성 코드만(종료 코드 신규 배정은 RPC가 차단).
  const activeCodeOptions = useMemo(
    () =>
      institutionCodes
        .filter((code) => code.status === '활성')
        .map((code) => ({ value: code.code, label: `${code.label} (${code.code})` })),
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

  // 모달이 열릴 때(폼 마운트 후) 이전 입력값을 비운다.
  useEffect(() => {
    if (bulkMode) {
      bulkForm.resetFields();
    }
  }, [bulkMode, bulkForm]);

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
  useEffect(() => {
    if (exportOpen) {
      exportForm.setFieldsValue({
        reason: '',
        phoneMode: 'masked',
        scope: 'filters',
        columns: [...defaultUserExportColumnKeys]
      });
    }
  }, [exportForm, exportOpen]);

  useEffect(() => {
    if (exportOpen && !isExportPhoneColumnSelected) {
      exportForm.setFieldValue('phoneMode', 'masked');
    }
  }, [exportForm, exportOpen, isExportPhoneColumnSelected]);

  useEffect(() => {
    if (exportOpen && selectedCount === 0 && exportForm.getFieldValue('scope') === 'selected') {
      exportForm.setFieldValue('scope', 'filters');
    }
  }, [exportForm, exportOpen, selectedCount]);

  const handleSelectAllExportColumns = useCallback(() => {
    exportForm.setFieldValue('columns', [...defaultUserExportColumnKeys]);
  }, [exportForm]);

  const handleClearExportColumns = useCallback(() => {
    exportForm.setFieldValue('columns', [...requiredUserExportColumnKeys]);
  }, [exportForm]);

  const handleExportSubmit = useCallback(async () => {
    if (exportSubmitting) {
      return;
    }
    setExportSubmitting(true);
    let values: ExportFormValues;
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
      affiliation: query.affiliation || null,
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
        ? await inviteInstitutionMembersSafe(
            ids,
            values.code,
            values.reason,
            values.expiresInDays ?? 7
          )
        : await clearInstitutionCodeSafe(ids, values.reason);
    setBulkSubmitting(false);

    const actionLabel = bulkMode === 'assign' ? '기관 초대' : '기관 소속 해제';
    if (!result.ok) {
      notificationApi.error({
        message: `${actionLabel} 실패`,
        description: result.error.message
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

  const columns = useMemo<TableColumnsType<UserSummary>>(
    () => [
      {
        title: '회원',
        key: 'user',
        width: 220,
        sorter: createTextSorter((record) => `${record.realName} ${record.id}`),
        render: (_, record) => (
          <UserNavigationLink
            stopPropagation
            withId={false}
            userId={record.id}
            userName={renderProfileValue(record.realName)}
          />
        )
      },
      {
        title: '이메일',
        dataIndex: 'email',
        width: 220,
        sorter: createTextSorter((record) => record.email)
      },
      {
        title: '닉네임',
        dataIndex: 'nickname',
        width: 160,
        render: (value: string) => renderProfileValue(value),
        sorter: createTextSorter((record) => record.nickname)
      },
      {
        title: '성별',
        dataIndex: 'gender',
        key: 'gender',
        width: 110,
        ...createDefinedColumnFilterProps(
          userGenderFilterValues,
          (record) => toUserGenderFilter(record.gender)
        ),
        filteredValue: toFilteredValue(query.genderFilters),
        render: (value: string) => renderProfileValue(value),
        sorter: createTextSorter((record) => record.gender)
      },
      {
        title: '국적',
        dataIndex: 'nationalityCode',
        width: 150,
        render: (_: string, record) =>
          renderProfileValue(formatNationality(record.nationalityCode)),
        sorter: createTextSorter((record) => formatNationality(record.nationalityCode))
      },
      {
        title: '소셜 로그인',
        dataIndex: 'socialProviders',
        key: 'socialProviders',
        width: 170,
        render: (_: string[], record) => (
          <SocialProviderTags providers={record.socialProviders} />
        )
      },
      {
        title: '기관 소속',
        dataIndex: 'affiliationLabel',
        key: 'affiliation',
        width: 200,
        render: (_: string, record) =>
          record.affiliationCode ? (
            <Tag color="blue">{record.affiliationLabel || record.affiliationCode}</Tag>
          ) : (
            emptyProfileValue
          ),
        sorter: createTextSorter(
          (record) => record.affiliationLabel || record.affiliationCode
        )
      },
      {
        // 개인정보 표시제한 — 목록에는 마스킹값(phoneMasked)만 렌더한다. 원문은 상세
        // 단건 조회와 내보내기(원문 포함 선택, 감사 기록)로만 접근한다.
        title: '전화번호',
        dataIndex: 'phoneMasked',
        width: 150,
        render: (value: string) => renderProfileValue(value),
        sorter: createTextSorter((record) => record.phoneMasked)
      },
      {
        title: '가입일',
        dataIndex: 'joinedAt',
        width: 160,
        // 기본 노출 순서 = 최근 가입자가 위로(내림차순). joinedAt이 분 단위 문자열이라
        // 같은 날짜라도 가입 시각까지 비교해 정확히 정렬된다.
        defaultSortOrder: 'descend',
        sorter: createTextSorter((record) => record.joinedAt)
      },
      {
        title: '최근 접속',
        dataIndex: 'lastLoginAt',
        width: 160,
        sorter: createTextSorter((record) => record.lastLoginAt)
      },
      {
        title: '등급',
        dataIndex: 'tier',
        key: 'tier',
        width: 120,
        ...createDefinedColumnFilterProps(userTierFilterValues, (record) => record.tier),
        filteredValue: toFilteredValue(query.tierFilters),
        sorter: createTextSorter((record) => record.tier)
      },
      {
        title: createStatusColumnTitle('구독 상태', ['구독', '미구독']),
        dataIndex: 'subscriptionStatus',
        key: 'subscriptionStatus',
        width: 120,
        ...createDefinedColumnFilterProps(
          userSubscriptionStatusFilterValues,
          (record) => record.subscriptionStatus
        ),
        filteredValue: toFilteredValue(query.subscriptionStatusFilters),
        sorter: createTextSorter((record) => record.subscriptionStatus)
      },
      {
        title: createStatusColumnTitle('회원 상태', userMembershipStatusFilterValues),
        dataIndex: 'status',
        key: 'membershipStatus',
        width: 150,
        ...createDefinedColumnFilterProps(
          userMembershipStatusFilterValues,
          (record) => getUserMembershipStatus(record)
        ),
        filteredValue: toFilteredValue(query.membershipStatusFilters),
        sorter: createTextSorter((record) => getUserMembershipStatus(record)),
        render: (_, record) => renderMembershipStatus(record)
      },
      {
        title: createStatusColumnTitle('약관 동의', userConsentStatusFilterValues),
        dataIndex: 'termsConsentStatus',
        key: 'termsConsentStatus',
        width: 130,
        ...createDefinedColumnFilterProps(
          userConsentStatusFilterValues,
          (record) => getTermsConsentDisplayStatus(record)
        ),
        filteredValue: toFilteredValue(query.termsConsentStatusFilters),
        sorter: createTextSorter((record) => getTermsConsentDisplayStatus(record)),
        render: (_, record) => renderTermsConsentStatus(record)
      },
      {
        title: createStatusColumnTitle('이메일 인증', ['인증 완료', '미인증']),
        dataIndex: 'emailVerificationStatus',
        key: 'emailVerificationStatus',
        width: 130,
        ...createDefinedColumnFilterProps(
          userEmailVerificationFilterValues,
          (record) => record.emailVerificationStatus
        ),
        filteredValue: toFilteredValue(query.emailVerificationStatusFilters),
        sorter: createTextSorter((record) => record.emailVerificationStatus),
        render: (emailVerificationStatus: EmailVerificationStatus) => (
          <StatusBadge status={emailVerificationStatus} />
        )
      },
      {
        title: '액션',
        key: 'actions',
        width: 140,
        onCell: () => ({
          onClick: (event) => {
            event.stopPropagation();
          }
        }),
        render: (_, record) => (
          <TableActionMenu
            items={[
              {
                key: `suspend-${record.id}`,
                label: '회원 정지',
                danger: true,
                disabled: record.status !== '정상',
                onClick: () => handleSuspend(record)
              },
              {
                key: `unsuspend-${record.id}`,
                label: '회원 정지 해제',
                disabled: record.status !== '정지',
                onClick: () => handleUnsuspend(record)
              },
              {
                key: `memo-${record.id}`,
                label: '관리자 메모 작성',
                onClick: () => handleMemoOpen(record)
              }
            ]}
          />
        )
      }
    ],
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
      commitQuery({
        page: 1,
        genderFilters: normalizeTableFilter(
          filters.gender as readonly Key[] | null | undefined,
          userGenderFilterValues
        ),
        tierFilters: normalizeTableFilter(
          filters.tier as readonly Key[] | null | undefined,
          userTierFilterValues
        ),
        subscriptionStatusFilters: normalizeTableFilter(
          filters.subscriptionStatus as readonly Key[] | null | undefined,
          userSubscriptionStatusFilterValues
        ),
        membershipStatusFilters: normalizeTableFilter(
          filters.membershipStatus as readonly Key[] | null | undefined,
          userMembershipStatusFilterValues
        ),
        termsConsentStatusFilters: normalizeTableFilter(
          filters.termsConsentStatus as readonly Key[] | null | undefined,
          userConsentStatusFilterValues
        ),
        emailVerificationStatusFilters: normalizeTableFilter(
          filters.emailVerificationStatus as readonly Key[] | null | undefined,
          userEmailVerificationFilterValues
        )
      });
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

      <Modal
        open={Boolean(memoTarget)}
        title="관리자 메모 작성"
        okText="저장"
        cancelText="취소"
        onCancel={closeMemoModal}
        onOk={handleMemoSubmit}
        destroyOnHidden
      >
        <Form form={memoForm} layout="vertical">
          <Text type="secondary">
            대상 유형: {getTargetTypeLabel('Users')} / 대상 ID: {memoTarget?.id ?? '-'}
          </Text>
          <Form.Item
            label="메모"
            name="memo"
            rules={[{ required: true, message: '메모 내용을 입력하세요.' }]}
            style={{ marginTop: 12, marginBottom: 0 }}
          >
            <Input.TextArea rows={4} placeholder="운영 메모를 입력하세요." />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        open={bulkMode !== null}
        title={bulkMode === 'assign' ? '기관 초대' : '기관 소속 해제'}
        okText={bulkMode === 'assign' ? '초대 발송' : '해제'}
        cancelText="취소"
        confirmLoading={bulkSubmitting}
        onCancel={handleCloseBulk}
        onOk={handleBulkSubmit}
        destroyOnHidden
      >
        <Space direction="vertical" size={12} style={{ width: '100%' }}>
          <Text type="secondary">
            {bulkMode === 'assign'
              ? `선택한 회원 ${selectedCount.toLocaleString()}명에게 초대 알림(인앱+이메일)을 보냅니다. 회원이 수락해야 소속이 적용되며, 이미 같은 코드 소속이거나 대기 중 초대가 있는 회원은 건너뜁니다.`
              : `선택한 회원 ${selectedCount.toLocaleString()}명에게 적용됩니다. 기관 소속이 없는 회원은 변경 없이 건너뜁니다.`}
          </Text>
          <Form form={bulkForm} layout="vertical">
            {bulkMode === 'assign' ? (
              <>
                <Form.Item
                  label="기관 코드"
                  name="code"
                  rules={[{ required: true, message: '초대할 기관 코드를 선택하세요.' }]}
                >
                  <Select
                    placeholder="활성 코드를 선택하세요."
                    options={activeCodeOptions}
                    showSearch
                    optionFilterProp="label"
                  />
                </Form.Item>
                <Form.Item
                  label="만료 기간"
                  name="expiresInDays"
                  initialValue={7}
                  rules={[{ required: true, message: '만료 기간을 입력하세요.' }]}
                  extra="이 기간 안에 응답하지 않으면 초대가 만료됩니다."
                >
                  <InputNumber min={1} max={365} addonAfter="일" style={{ width: 140 }} />
                </Form.Item>
              </>
            ) : null}
            <Form.Item
              label="사유/근거"
              name="reason"
              rules={[{ required: true, message: '조치 사유를 입력하세요.' }]}
              style={{ marginBottom: 0 }}
            >
              <Input.TextArea rows={3} placeholder="감사 기록에 남길 사유를 입력하세요." />
            </Form.Item>
          </Form>
        </Space>
      </Modal>

      <Modal
        open={exportOpen}
        title="회원 정보 내보내기"
        okText="엑셀 다운로드"
        cancelText="취소"
        confirmLoading={exportSubmitting}
        onCancel={handleCloseExport}
        onOk={handleExportSubmit}
        destroyOnHidden
      >
        <Space direction="vertical" size={12} style={{ width: '100%' }}>
          <Alert
            type="warning"
            showIcon
            message="개인정보 반출 작업입니다"
            description={`현재 목록 조건: ${exportFilterSummaryLabel}. 모든 내보내기는 사유·범위·행수와 함께 감사 로그에 기록됩니다.`}
          />
          <Form
            form={exportForm}
            layout="vertical"
            initialValues={{
              phoneMode: 'masked',
              scope: 'filters',
              columns: [...defaultUserExportColumnKeys]
            }}
          >
            <Form.Item label="대상 회원" name="scope" style={{ marginBottom: 12 }}>
              <Radio.Group>
                <Space direction="vertical" size={4}>
                  <Radio value="filters">현재 목록 조건</Radio>
                  <Radio value="selected" disabled={selectedCount === 0}>
                    선택한 회원만 ({selectedCount.toLocaleString()}명)
                  </Radio>
                </Space>
              </Radio.Group>
            </Form.Item>
            <Form.Item
              label="내보낼 컬럼"
            >
              <div className="users-export-column-toolbar">
                <Text type="secondary">사용자 ID는 추적성을 위해 항상 포함됩니다.</Text>
                <Space size={6}>
                  <Button size="small" onClick={handleSelectAllExportColumns}>
                    전체 선택
                  </Button>
                  <Button size="small" onClick={handleClearExportColumns}>
                    선택 해제
                  </Button>
                </Space>
              </div>
              <Form.Item
                name="columns"
                noStyle
                rules={[
                  {
                    validator: (_, value: UserExportColumnKey[] | undefined) => {
                      const normalized = normalizeUserExportColumns(value);
                      return normalized.includes('id')
                        ? Promise.resolve()
                        : Promise.reject(new Error('사용자 ID 컬럼은 필수입니다.'));
                    }
                  }
                ]}
              >
                <Checkbox.Group
                  className="users-export-column-group"
                  onChange={(values) =>
                    exportForm.setFieldValue(
                      'columns',
                      normalizeUserExportColumns(values as UserExportColumnKey[])
                    )
                  }
                >
                  <div className="users-export-column-grid">
                    {userExportColumnOptions.map((option) => (
                      <Checkbox
                        key={option.value}
                        value={option.value}
                        disabled={option.required}
                      >
                        {option.label}
                      </Checkbox>
                    ))}
                  </div>
                </Checkbox.Group>
              </Form.Item>
            </Form.Item>
            <Form.Item
              label="내보내기 사유"
              name="reason"
              rules={[
                {
                  required: true,
                  whitespace: true,
                  message: '내보내기 사유를 입력하세요.'
                }
              ]}
            >
              <Input.TextArea
                rows={2}
                maxLength={200}
                showCount
                placeholder="예: 2026 상반기 기관 제출용 회원 현황 정리"
              />
            </Form.Item>
            <Form.Item
              label="전화번호 처리"
              name="phoneMode"
              style={{ marginBottom: 0 }}
              extra={
                isExportPhoneColumnSelected
                  ? '원문 포함은 업무상 꼭 필요한 경우에만 선택하세요. 선택 여부가 감사 로그에 남습니다.'
                  : '전화번호 컬럼을 선택하지 않아 전화번호는 파일에 포함되지 않습니다.'
              }
            >
              <Radio.Group disabled={!isExportPhoneColumnSelected}>
                <Space direction="vertical" size={4}>
                  <Radio value="masked">마스킹(권장) — 예: 010-****-5678</Radio>
                  <Radio value="full">원문 포함 — 파일에 전화번호 전체가 기록됩니다</Radio>
                </Space>
              </Radio.Group>
            </Form.Item>
          </Form>
        </Space>
      </Modal>
    </div>
  );
}
