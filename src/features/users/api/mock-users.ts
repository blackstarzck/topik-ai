import type {
  SubscriptionStatus,
  UserStatus,
  UserSummary,
  UserTier
} from '../model/types';

const statuses: UserStatus[] = ['정상', '정지', '탈퇴'];
const tiers: UserTier[] = ['일반', '프리미엄'];
const subscriptions: SubscriptionStatus[] = ['구독', '미구독'];
const familyNames = ['김', '이', '박', '최', '정', '강', '조', '윤', '장', '임'];
const givenNames = [
  '민준',
  '서연',
  '지후',
  '하은',
  '도윤',
  '예린',
  '시우',
  '유진',
  '현우',
  '지원'
];

function formatDate(dayOffset: number): string {
  const date = new Date(Date.UTC(2025, 0, 1));
  date.setUTCDate(date.getUTCDate() + dayOffset);

  return date.toISOString().slice(0, 10);
}

export const mockUsers: UserSummary[] = Array.from({ length: 420 }, (_, index) => {
  const id = `U${String(index + 1).padStart(5, '0')}`;
  const status = statuses[index % statuses.length];
  const tier = tiers[index % tiers.length];
  const subscriptionStatus = subscriptions[(index + 1) % subscriptions.length];
  const joinedAt = formatDate(index % 365);
  const lastLoginAt = formatDate((index % 180) + 120);
  const realName = `${familyNames[index % familyNames.length]}${givenNames[(index * 3) % givenNames.length]}`;

  return {
    id,
    realName,
    email: `member${index + 1}@topik.ai`,
    nickname: `member_${index + 1}`,
    joinedAt,
    lastLoginAt,
    status,
    tier,
    subscriptionStatus
  };
});

export function getMockUserById(userId: string): UserSummary | undefined {
  return mockUsers.find((item) => item.id === userId);
}

