import { getTermsConsentDisplayStatus, getUserMembershipStatus } from './registration-status';
import type { UserExportFilters } from './user-export-types';
import type { UserGenderFilter, UserSummary, UsersQuery } from './types';

const lowerIncludes = (source: string, keyword: string) =>
  source.toLowerCase().includes(keyword.toLowerCase());

const hasFilterValues = <T>(values: readonly T[]) => values.length > 0;

const matchesSelectedValue = <T>(selected: readonly T[], value: T) =>
  !hasFilterValues(selected) || selected.includes(value);

const matchesJoinedDateRange = (joinedAt: string, startDate: string, endDate: string) => {
  const joinedDate = joinedAt.slice(0, 10);
  if (startDate && joinedDate < startDate) {
    return false;
  }
  if (endDate && joinedDate > endDate) {
    return false;
  }
  return true;
};

export function toUserGenderFilter(value: string): UserGenderFilter {
  const normalized = value.trim().toLowerCase();
  if (!normalized) {
    return '미입력';
  }
  if (['남', '남성', 'male', 'm'].includes(normalized)) {
    return '남성';
  }
  if (['여', '여성', 'female', 'f'].includes(normalized)) {
    return '여성';
  }
  return '기타';
}

export function buildUserExportFiltersFromQuery(query: UsersQuery): UserExportFilters {
  return {
    searchField: query.searchField,
    keyword: query.keyword.trim(),
    startDate: query.startDate,
    endDate: query.endDate,
    affiliation: query.affiliation,
    genders: query.genderFilters,
    tiers: query.tierFilters,
    subscriptionStatuses: query.subscriptionStatusFilters,
    membershipStatuses: query.membershipStatusFilters,
    termsConsentStatuses: query.termsConsentStatusFilters,
    emailVerificationStatuses: query.emailVerificationStatusFilters
  };
}

export function userMatchesExportFilters(user: UserSummary, filters: UserExportFilters): boolean {
  if (!matchesJoinedDateRange(user.joinedAt, filters.startDate, filters.endDate)) {
    return false;
  }

  if (!matchesSelectedValue(filters.genders, toUserGenderFilter(user.gender))) {
    return false;
  }
  if (!matchesSelectedValue(filters.tiers, user.tier)) {
    return false;
  }
  if (!matchesSelectedValue(filters.subscriptionStatuses, user.subscriptionStatus)) {
    return false;
  }
  if (!matchesSelectedValue(filters.membershipStatuses, getUserMembershipStatus(user))) {
    return false;
  }
  if (!matchesSelectedValue(filters.termsConsentStatuses, getTermsConsentDisplayStatus(user))) {
    return false;
  }
  if (!matchesSelectedValue(filters.emailVerificationStatuses, user.emailVerificationStatus)) {
    return false;
  }

  if (!filters.keyword) {
    return true;
  }

  const keyword = filters.keyword;
  const searchable = {
    id: user.id,
    realName: user.realName,
    email: user.email,
    nickname: user.nickname
  };

  if (filters.searchField === 'all') {
    return Object.values(searchable).some((value) => lowerIncludes(value, keyword));
  }

  return lowerIncludes(searchable[filters.searchField], keyword);
}

export function hasActiveUserExportFilters(filters: UserExportFilters): boolean {
  return Boolean(
    filters.keyword ||
      filters.startDate ||
      filters.endDate ||
      filters.affiliation ||
      filters.genders.length ||
      filters.tiers.length ||
      filters.subscriptionStatuses.length ||
      filters.membershipStatuses.length ||
      filters.termsConsentStatuses.length ||
      filters.emailVerificationStatuses.length
  );
}
