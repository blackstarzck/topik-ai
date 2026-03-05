export type UserStatus = '정상' | '정지' | '탈퇴';
export type UserTier = '일반' | '프리미엄';
export type SubscriptionStatus = '구독' | '미구독';

export type UserSummary = {
  id: string;
  realName: string;
  email: string;
  nickname: string;
  joinedAt: string;
  lastLoginAt: string;
  status: UserStatus;
  tier: UserTier;
  subscriptionStatus: SubscriptionStatus;
};

export type UsersSort = 'latest' | 'oldest';
export type UsersStatusFilter = 'all' | UserStatus;

export type UsersQuery = {
  page: number;
  pageSize: number;
  sort: UsersSort;
  status: UsersStatusFilter;
  keyword: string;
};

