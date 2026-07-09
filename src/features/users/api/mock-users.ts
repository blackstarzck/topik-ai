import type {
  EmailVerificationStatus,
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

// 가입일/최근 접속용 'YYYY-MM-DD HH:mm'. minuteSeed로 시:분을 결정적으로 분산시켜
// 같은 날짜 안에서도 정렬 순서가 명확하도록(실데이터의 KST 분 단위 표기와 형식 일치).
function formatDateTime(dayOffset: number, minuteSeed: number): string {
  const hh = String(minuteSeed % 24).padStart(2, '0');
  const mi = String((minuteSeed * 7) % 60).padStart(2, '0');

  return `${formatDate(dayOffset)} ${hh}:${mi}`;
}

export const mockUsers: UserSummary[] = Array.from({ length: 420 }, (_, index) => {
  const id = `U${String(index + 1).padStart(5, '0')}`;
  const tier = tiers[index % tiers.length];
  const subscriptionStatus = subscriptions[(index + 1) % subscriptions.length];
  const joinedAt = formatDateTime(index % 365, index);
  const lastLoginAt = formatDateTime((index % 180) + 120, index + 11);
  const realName = `${familyNames[index % familyNames.length]}${givenNames[(index * 3) % givenNames.length]}`;
  const termsConsentStatus = consentStatuses[index % consentStatuses.length];
  const affiliation = affiliationSamples[index % affiliationSamples.length];
  // 일부(약 1/9)를 미인증으로 둬 배지/필터를 검증. 가입 미완료 계정은 이름/닉네임이
  // 비어있는 경우가 많으므로 미인증 표본은 회원명/닉네임을 빈 값으로 렌더(실데이터 모사).
  const emailVerificationStatus: EmailVerificationStatus =
    index % 9 === 7 ? '미인증' : '인증 완료';
  const isUnverified = emailVerificationStatus === '미인증';
  // v13 handoff 진단을 위해 원천 profiles.status가 active여도 이메일 미인증인 표본을 남긴다.
  // 화면은 이 원천값을 그대로 "정상"으로 노출하지 않고 "인증 대기"로 파생 표시한다.
  const status: UserStatus = isUnverified ? '정상' : statuses[index % statuses.length];

  return {
    id,
    realName: isUnverified ? '' : realName,
    email: `member${index + 1}@topik.ai`,
    nickname: isUnverified ? '' : `member_${index + 1}`,
    joinedAt,
    lastLoginAt: isUnverified ? '' : lastLoginAt,
    status,
    tier,
    subscriptionStatus,
    nationalityCode: nationalityCodes[index % nationalityCodes.length],
    socialProviders: socialProvidersSamples[index % socialProvidersSamples.length],
    termsConsentStatus,
    termsConsentAt: termsConsentStatus === '미동의' ? '' : joinedAt.slice(0, 10),
    affiliationCode: affiliation.code,
    affiliationLabel: affiliation.label,
    emailVerificationStatus
  };
});

export function getMockUserById(userId: string): UserSummary | undefined {
  return mockUsers.find((item) => item.id === userId);
}

// writing 중심 재정의(20260708130000) 계약과 동일한 모양의 결정적 mock.
// 소요 시간은 "수집됨"(51/52)과 "미수집"(53/54, elapsed null)을 함께 노출해
// 화면의 미수집 라벨 경로가 mock/e2e에서도 렌더되게 한다.
export function getMockUserLearningOverview(userId: string): UserLearningOverview {
  const seed = Math.max(1, Number.parseInt(userId.replace(/\D/g, ''), 10) || 1);
  const latestDate = formatDate(430 + (seed % 20));
  const weeklyGoalMinutes = 150 + (seed % 4) * 30;
  const subs51 = 6 + (seed % 6);
  const subs52 = 3 + (seed % 4);
  const subs53 = 1 + (seed % 3);
  const subs54 = seed % 3;
  const totalSubmissions = subs51 + subs52 + subs53 + subs54;
  const feedbackFailed = seed % 3 === 0 ? 1 : 0;
  const feedbackPending = seed % 4 === 0 ? 1 : 0;
  const feedbackComplete = Math.max(0, totalSubmissions - feedbackFailed - feedbackPending);
  const norm51 = 62 + (seed % 25);
  const norm52 = 55 + (seed % 30);

  return {
    kpis: {
      totalSubmissions,
      feedbackComplete,
      feedbackPending,
      feedbackFailed,
      resubmissionCount: seed % 3,
      avgScoreNormalized: 58 + (seed % 27),
      feedbackViewedCount: Math.max(0, feedbackComplete - (seed % 4)),
      feedbackViewRate:
        feedbackComplete > 0
          ? Math.round(
              (Math.max(0, feedbackComplete - (seed % 4)) / feedbackComplete) * 1000
            ) / 10
          : null,
      streakDays: 1 + (seed % 12),
      weeklyGoalMinutes,
      weeklyStudiedMinutes: 40 + (seed % 6) * 25,
      metricsCount: subs51 + subs52,
      avgElapsedSeconds: 420 + (seed % 10) * 30,
      avgActiveSeconds: 300 + (seed % 10) * 20,
      latestActivityAt: latestDate
    },
    perQuestion: [
      {
        questionNo: 51,
        submissions: subs51,
        feedbackComplete: subs51,
        avgScoreRaw: Math.round(norm51) / 10,
        scoreMax: 10,
        avgScoreNormalized: norm51,
        avgElapsedSeconds: 360 + (seed % 8) * 15,
        metricsCount: subs51
      },
      {
        questionNo: 52,
        submissions: subs52,
        feedbackComplete: Math.max(0, subs52 - feedbackFailed),
        avgScoreRaw: Math.round(norm52) / 10,
        scoreMax: 10,
        avgScoreNormalized: norm52,
        avgElapsedSeconds: 480 + (seed % 8) * 20,
        metricsCount: subs52
      },
      {
        questionNo: 53,
        submissions: subs53,
        feedbackComplete: Math.max(0, subs53 - feedbackPending),
        avgScoreRaw: 16 + (seed % 9),
        scoreMax: 30,
        avgScoreNormalized: Math.round(((16 + (seed % 9)) / 30) * 1000) / 10,
        avgElapsedSeconds: null,
        metricsCount: 0
      },
      {
        questionNo: 54,
        submissions: subs54,
        feedbackComplete: subs54,
        avgScoreRaw: subs54 > 0 ? 28 + (seed % 12) : null,
        scoreMax: subs54 > 0 ? 50 : null,
        avgScoreNormalized:
          subs54 > 0 ? Math.round(((28 + (seed % 12)) / 50) * 1000) / 10 : null,
        avgElapsedSeconds: null,
        metricsCount: 0
      }
    ],
    tagStats: [
      {
        tag: '문의',
        submissions: 4 + (seed % 4),
        feedbackComplete: 4 + (seed % 4),
        avgScoreNormalized: 70 + (seed % 20)
      },
      {
        tag: '주거와 환경',
        submissions: 3 + (seed % 3),
        feedbackComplete: 3 + (seed % 3),
        avgScoreNormalized: 64 + (seed % 18)
      },
      {
        tag: '건강',
        submissions: 2 + (seed % 2),
        feedbackComplete: 2 + (seed % 2),
        avgScoreNormalized: 52 + (seed % 16)
      }
    ],
    weaknesses: [
      { label: 'structure', source: 'writing_dimension', severity: 3, evidenceCount: 3 + (seed % 3) },
      { label: '건강', source: 'tag', severity: 2, evidenceCount: 2 + (seed % 2) },
      { label: 'essay-structure', source: 'goal', severity: 1, evidenceCount: 1 }
    ],
    recentWriting: [
      {
        submissionId: `${userId}-WS1`,
        questionNo: 51,
        problemId: 'PR-WRITE-051',
        problemTitle: '기숙사 방 변경 문의 이메일',
        submittedAt: `${latestDate} 10:12`,
        feedbackStatus: 'complete',
        scoreTotal: 8,
        scoreMax: 10,
        scoreNormalized: 80,
        isResubmission: false,
        viewed: true,
        elapsedSeconds: 412,
        weaknessDimensions: ['structure']
      },
      {
        submissionId: `${userId}-WS2`,
        questionNo: 54,
        problemId: 'PR-WRITE-054',
        problemTitle: '인공지능 시대의 education 방향',
        submittedAt: `${formatDate(428 + (seed % 18))} 21:40`,
        feedbackStatus: 'complete',
        scoreTotal: 32,
        scoreMax: 50,
        scoreNormalized: 64,
        isResubmission: seed % 2 === 0,
        viewed: false,
        elapsedSeconds: null,
        weaknessDimensions: ['content', 'structure']
      }
    ],
    objectiveAttempts: {
      totalAttempts: 0,
      solvedProblems: 0,
      correctRate: null,
      averageScore: null,
      totalStudyMinutes: 0,
      bookmarkedCount: 0,
      latestAttemptAt: ''
    },
    onboarding: {
      hasGoal: true,
      topikLevel: 'TOPIK II',
      targetGrade: 3 + (seed % 4),
      examDate: formatDate(380 + (seed % 30)),
      weeklyGoalMinutes,
      weakAreas: ['vocabulary', 'grammar'],
      goalUpdatedAt: latestDate
    }
  };
}
