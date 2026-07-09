import type {
  EmailVerificationStatus,
  SubscriptionStatus,
  TermsConsentDisplayStatus,
  UserGenderFilter,
  UserMembershipStatus,
  UsersSearchField,
  UserSummary,
  UserTier
} from './types';

export type UserExportScope = 'filters' | 'selected';

export type UserExportColumnKey =
  | 'id'
  | 'realName'
  | 'email'
  | 'nickname'
  | 'gender'
  | 'phone'
  | 'nationality'
  | 'socialProviders'
  | 'affiliationCode'
  | 'affiliationLabel'
  | 'joinedAt'
  | 'lastLoginAt'
  | 'tier'
  | 'subscriptionStatus'
  | 'membershipStatus'
  | 'termsConsentStatus'
  | 'termsConsentAt'
  | 'emailVerificationStatus';

export const requiredUserExportColumnKeys = ['id'] as const satisfies readonly UserExportColumnKey[];

export const defaultUserExportColumnKeys = [
  'id',
  'realName',
  'email',
  'nickname',
  'gender',
  'phone',
  'nationality',
  'socialProviders',
  'affiliationCode',
  'affiliationLabel',
  'joinedAt',
  'lastLoginAt',
  'tier',
  'subscriptionStatus',
  'membershipStatus',
  'termsConsentStatus',
  'termsConsentAt',
  'emailVerificationStatus'
] as const satisfies readonly UserExportColumnKey[];

export type UserExportFilters = {
  searchField: UsersSearchField;
  keyword: string;
  startDate: string;
  endDate: string;
  affiliation: string;
  genders: UserGenderFilter[];
  tiers: UserTier[];
  subscriptionStatuses: SubscriptionStatus[];
  membershipStatuses: UserMembershipStatus[];
  termsConsentStatuses: TermsConsentDisplayStatus[];
  emailVerificationStatuses: EmailVerificationStatus[];
};

export type ExportUsersOptions = {
  reason: string;
  includeFullPhone: boolean;
  affiliation?: string;
  scope: UserExportScope;
  selectedUserIds: string[];
  filters: UserExportFilters;
  columns: UserExportColumnKey[];
};

export type UserExportRow = UserSummary & {
  exportPhone: string;
};
