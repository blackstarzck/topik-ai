import type {
  SubscriptionStatus,
  TermsConsentStatus,
  UserLearningOverview,
  UserStatus,
  UserSummary,
  UserTier
} from '../model/types';

const statuses: UserStatus[] = ['정상', '정지', '탈퇴'];
const tiers: UserTier[] = ['일반', '프리미엄'];
const subscriptions: SubscriptionStatus[] = ['구독', '미구독'];
const consentStatuses: TermsConsentStatus[] = [
  '동의 완료',
  '동의 완료',
  '일부 동의',
  '미동의'
];
// 국적 ISO alpha-2 코드 표본(빈 값 = 미입력). 다양한 국가 + 미입력 케이스 노출.
const nationalityCodes: string[] = ['KR', 'US', 'VN', 'JP', 'CN', ''];
// 소셜 로그인 provider 표본. 빈 배열 = 이메일·비밀번호 가입(소셜 미연동, 화면에서 '-').
// 단일/복수 연동 + 미연동을 고루 노출해 태그 렌더를 검증한다.
const socialProvidersSamples: string[][] = [
  ['google'],
  [],
  ['kakao'],
  ['facebook'],
  ['google', 'facebook'],
  ['naver'],
  ['apple']
];
// 박람회/기관 유입 코드 표본. 대부분 미유입(''), 일부만 박람회 코드(institution_codes 시드와 정렬).
const affiliationSamples: { code: string; label: string }[] = [
  { code: '', label: '' },
  { code: '', label: '' },
  { code: '', label: '' },
  { code: 'EXPO2026-BOOTH-A', label: '2026 한국어교육 박람회 · A부스' },
  { code: '', label: '' },
  { code: '', label: '' },
  { code: 'EXPO2026-BOOTH-B', label: '2026 한국어교육 박람회 · B부스' }
];
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
  const termsConsentStatus = consentStatuses[index % consentStatuses.length];
  const affiliation = affiliationSamples[index % affiliationSamples.length];

  return {
    id,
    realName,
    email: `member${index + 1}@topik.ai`,
    nickname: `member_${index + 1}`,
    joinedAt,
    lastLoginAt,
    status,
    tier,
    subscriptionStatus,
    nationalityCode: nationalityCodes[index % nationalityCodes.length],
    socialProviders: socialProvidersSamples[index % socialProvidersSamples.length],
    termsConsentStatus,
    termsConsentAt: termsConsentStatus === '미동의' ? '' : joinedAt,
    affiliationCode: affiliation.code,
    affiliationLabel: affiliation.label
  };
});

export function getMockUserById(userId: string): UserSummary | undefined {
  return mockUsers.find((item) => item.id === userId);
}

export function getMockUserLearningOverview(userId: string): UserLearningOverview {
  const seed = Math.max(1, Number.parseInt(userId.replace(/\D/g, ''), 10) || 1);
  const attemptBase = 18 + (seed % 24);
  const correctRate = 58 + (seed % 31);
  const latestDate = formatDate(430 + (seed % 20));

  return {
    kpis: {
      totalAttempts: attemptBase,
      solvedProblems: Math.max(1, attemptBase - (seed % 5)),
      correctRate,
      averageScore: 62 + (seed % 25),
      totalStudyMinutes: 240 + seed * 7,
      bookmarkedCount: seed % 9,
      writingSubmissionCount: 2 + (seed % 5),
      writingFeedbackCount: 1 + (seed % 4),
      latestActivityAt: latestDate
    },
    domainAccuracy: [
      { domain: '읽기', attempts: 12 + (seed % 6), correctRate: correctRate - 4, averageScore: 68 },
      { domain: '듣기', attempts: 9 + (seed % 5), correctRate: correctRate + 3, averageScore: 74 },
      { domain: '쓰기', attempts: 3 + (seed % 4), correctRate: null, averageScore: 61 }
    ],
    weaknesses: [
      { label: '문법 연결 표현', source: 'tag', severity: 3, evidenceCount: 5 + (seed % 3) },
      { label: '중심 내용 파악', source: 'domain', severity: 2, evidenceCount: 4 + (seed % 2) },
      { label: '쓰기 구성', source: 'writing_dimension', severity: 2, evidenceCount: 2 }
    ],
    recentAttempts: [
      {
        id: `${userId}-AT1`,
        problemId: 'PR-READ-041',
        domain: '읽기',
        questionNo: 41,
        topikLevel: 'TOPIK II',
        difficulty: '중',
        title: '세부 내용 파악',
        isCorrect: seed % 2 === 0,
        score: seed % 2 === 0 ? 2 : 0,
        status: 'submitted',
        submittedAt: latestDate,
        timeSpentSeconds: 164
      },
      {
        id: `${userId}-AT2`,
        problemId: 'PR-LISTEN-018',
        domain: '듣기',
        questionNo: 18,
        topikLevel: 'TOPIK I',
        difficulty: '하',
        title: '대화 장소 추론',
        isCorrect: true,
        score: 2,
        status: 'submitted',
        submittedAt: formatDate(428 + (seed % 18)),
        timeSpentSeconds: 92
      }
    ],
    recentWriting: [
      {
        submissionId: `${userId}-WS1`,
        questionNo: 54,
        submittedAt: latestDate,
        feedbackStatus: 'completed',
        scoreTotal: 32,
        scoreMax: 50,
        weaknessDimensions: ['구성', '문법']
      }
    ]
  };
}
