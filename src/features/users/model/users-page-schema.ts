import type { Key } from 'react';

import {
  AFFILIATION_FILTER_AFFILIATED,
  AFFILIATION_FILTER_ALL,
  AFFILIATION_FILTER_GENERAL
} from './institution-codes-types';
import type { InstitutionCode } from './institution-codes-types';
import {
  buildUserExportFiltersFromQuery,
  userMatchesExportFilters
} from './user-export-filter';
import type {
  UserExportColumnKey,
  UserExportScope
} from './user-export-types';
import { defaultUsersQuery } from './users-query-store';
import type {
  EmailVerificationStatus,
  SubscriptionStatus,
  TermsConsentDisplayStatus,
  UserGenderFilter,
  UserMembershipStatus,
  UserSummary,
  UserTier,
  UsersQuery,
  UsersSearchField
} from './types';
import { parseSearchDate } from '@/shared/ui/search-bar/search-bar-utils';

// 회원 목록 화면의 순수 스키마 — Phase 4 분해로 페이지 본문에서 이동(동작 동일).
// 조회 상태·권한 판정·조치/내보내기 핸들러·폼 인스턴스는 페이지가 소유한다.

export const pageSizeOptions = ['20', '50', '100'];
export const emptyProfileValue = '-';
export const userGenderFilterValues = ['남성', '여성', '기타', '미입력'] as const;
export const userTierFilterValues = ['일반', '프리미엄'] as const;
export const userSubscriptionStatusFilterValues = ['구독', '미구독'] as const;
export const userMembershipStatusFilterValues = [
  '인증 대기',
  '약관 대기',
  '정상',
  '정지',
  '탈퇴'
] as const;
export const userConsentStatusFilterValues = [
  '동의 완료',
  '일부 동의',
  '미동의',
  '동의 불가'
] as const;
export const userEmailVerificationFilterValues = ['인증 완료', '미인증'] as const;

export const searchFieldOptions: { label: string; value: UsersSearchField }[] = [
  { label: '전체', value: 'all' },
  { label: '사용자 ID', value: 'id' },
  { label: '이름', value: 'realName' },
  { label: '이메일', value: 'email' },
  { label: '닉네임', value: 'nickname' }
];

export const searchFieldLabelMap = searchFieldOptions.reduce<Record<UsersSearchField, string>>(
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

export type UsersExportFormValues = {
  reason: string;
  phoneMode: 'masked' | 'full';
  scope: UserExportScope;
  columns: UserExportColumnKey[];
};

export type UsersListActionState =
  | { type: 'suspend'; user: UserSummary }
  | { type: 'unsuspend'; user: UserSummary }
  | null;

export function parsePositiveNumber(value: string | null, fallback: number): number {
  if (!value) {
    return fallback;
  }
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return fallback;
  }
  return parsed;
}

export function parseSearchField(value: string | null): UsersSearchField {
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

export function parseMultiValue<T extends string>(
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

export function setMultiValueParam<T extends string>(
  params: URLSearchParams,
  key: string,
  values: readonly T[]
) {
  if (values.length > 0) {
    params.set(key, values.join(','));
  }
}

export function toFilteredValue<T extends string>(values: readonly T[]): T[] | null {
  return values.length > 0 ? [...values] : null;
}

export function normalizeTableFilter<T extends string>(
  values: readonly Key[] | null | undefined,
  allowedValues: readonly T[]
): T[] {
  if (!values) {
    return [];
  }
  const allowed = new Set<string>(allowedValues);
  return values.map(String).filter((value): value is T => allowed.has(value));
}

export function parseUsersQuery(searchParams: URLSearchParams): UsersQuery {
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

export function buildUsersSearchParams(query: UsersQuery): URLSearchParams {
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

export function filterUsers(users: UserSummary[], query: UsersQuery): UserSummary[] {
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

export function buildFilterSummaryLabel(
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

// 아래 빌더들은 페이지 useMemo/핸들러 본문을 그대로 옮긴 순수 함수다.
export function buildAffiliationFilterOptions(institutionCodes: InstitutionCode[]) {
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
}

export function buildAffiliationScopeLabel(
  affiliation: string,
  institutionCodes: InstitutionCode[]
): string {
  if (!affiliation || affiliation === AFFILIATION_FILTER_ALL) {
    return '전체 회원';
  }
  if (affiliation === AFFILIATION_FILTER_AFFILIATED) {
    return '기관 회원만';
  }
  if (affiliation === AFFILIATION_FILTER_GENERAL) {
    return '일반 회원만';
  }
  const code = institutionCodes.find((item) => item.code === affiliation);
  return code ? `${code.label} (${code.code})` : affiliation;
}

export function buildActiveCodeOptions(institutionCodes: InstitutionCode[]) {
  return institutionCodes
    .filter((code) => code.status === '활성')
    .map((code) => ({ value: code.code, label: `${code.label} (${code.code})` }));
}

export function parseUsersTableFilters(
  filters: Record<string, (Key | boolean)[] | null>
): Partial<UsersQuery> {
  return {
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
  };
}
