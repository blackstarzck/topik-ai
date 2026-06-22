export type UserStatus = '정상' | '정지' | '탈퇴';
export type UserTier = '일반' | '프리미엄';
export type SubscriptionStatus = '구독' | '미구독';
// 회원가입(일반·SNS) 필수 약관 동의 상태. 현재 필수 문서 = 이용약관(terms) + 개인정보처리방침(privacy).
export type TermsConsentStatus = '동의 완료' | '일부 동의' | '미동의';
// 이메일 인증(가입 완료) 여부. auth.users.email_confirmed_at 기준.
// '미인증' = 이메일 가입 후 확인메일을 누르지 않은 가입 미완료(중도이탈) 계정.
// 소셜(google 등) 가입은 자동 인증되어 항상 '인증 완료'.
export type EmailVerificationStatus = '인증 완료' | '미인증';

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
  // v13 가입 시 수집되는 국적 ISO 3166-1 alpha-2 코드 원본(미입력 시 빈 문자열).
  // 화면 표시(국가명 한글)는 shared/model/country-name 의 formatNationality 로 변환.
  nationalityCode: string;
  // 연동된 소셜 로그인 제공자 목록(예: ['google', 'kakao']). auth.identities 에서
  // 'email'(이메일·비밀번호 가입)을 제외한 provider 집계. 소셜 미연동 시 빈 배열.
  // 화면 표시(브랜드 라벨/색상 태그)는 shared/ui/social-provider 에서 처리.
  socialProviders: string[];
  // 약관 동의(인증약관) 상태와 최종 동의일(YYYY-MM-DD, 미동의 시 빈 문자열).
  termsConsentStatus: TermsConsentStatus;
  termsConsentAt: string;
  // 이메일 인증(가입 완료) 여부. '미인증' = 가입 미완료(중도이탈) 계정으로 회원명/닉네임이
  // 비어있을 수 있다. 회원 상태(정상/정지/탈퇴)와는 직교한다.
  emailVerificationStatus: EmailVerificationStatus;
  // 박람회/기관 유입 코드(v13 profiles.affiliation_code). 비어있으면 일반(유입경로 없음) 회원.
  // 코드 자체는 의미가 없고, 의미(기관/행사명)는 admin institution_codes 카탈로그가 소유한다.
  affiliationCode: string;
  // affiliationCode 를 institution_codes.label 로 해석한 표시명(없음/미등록 시 빈 문자열).
  affiliationLabel: string;
};

// 회원 상세 > 학습 현황 탭 모델. get_admin_user_learning_overview(120000) RPC 및
// mock(getMockUserLearningOverview)이 반환하는 집계 계약과 1:1 대응한다.
export type UserLearningKpi = {
  totalAttempts: number;
  solvedProblems: number;
  correctRate: number | null;
  averageScore: number | null;
  totalStudyMinutes: number;
  bookmarkedCount: number;
  writingSubmissionCount: number;
  writingFeedbackCount: number;
  // 연속 학습일(KST, 오늘/어제 기준), 주간 목표 학습 분(미설정 시 null), 이번 주 누적 학습 분.
  streakDays: number;
  weeklyGoalMinutes: number | null;
  weeklyStudiedMinutes: number;
  latestActivityAt: string;
};

// 회원 상세 > 학습 현황 탭의 온보딩 현황 카드. v13 learning_goals(온보딩 마지막 단계 산출물)에서
// 파생한다. 약관 동의/가입 단계는 프로필(UserSummary)의 termsConsentStatus·joinedAt로 표시한다.
export type UserOnboarding = {
  hasGoal: boolean;
  topikLevel: string;
  targetGrade: number | null;
  examDate: string;
  weeklyGoalMinutes: number | null;
  weakAreas: string[];
  goalUpdatedAt: string;
};

export type UserLearningDomainAccuracy = {
  domain: string;
  attempts: number;
  correctRate: number | null;
  averageScore: number | null;
};

export type UserLearningWeakness = {
  label: string;
  source: 'domain' | 'tag' | 'writing_dimension' | 'goal';
  severity: number;
  evidenceCount: number;
};

export type UserLearningRecentAttempt = {
  id: string;
  problemId: string;
  domain: string;
  questionNo: number | null;
  topikLevel: string;
  difficulty: string;
  title: string;
  isCorrect: boolean | null;
  score: number | null;
  status: string;
  submittedAt: string;
  timeSpentSeconds: number;
};

export type UserLearningRecentWriting = {
  submissionId: string;
  questionNo: number;
  submittedAt: string;
  feedbackStatus: string;
  scoreTotal: number | null;
  scoreMax: number | null;
  weaknessDimensions: string[];
};

export type UserLearningOverview = {
  kpis: UserLearningKpi;
  domainAccuracy: UserLearningDomainAccuracy[];
  weaknesses: UserLearningWeakness[];
  recentAttempts: UserLearningRecentAttempt[];
  recentWriting: UserLearningRecentWriting[];
  onboarding: UserOnboarding;
};

export type UsersSort = 'latest' | 'oldest';
export type UsersStatusFilter = 'all' | UserStatus;
export type UsersSearchField = 'all' | 'id' | 'realName' | 'email' | 'nickname';

export type UsersQuery = {
  page: number;
  pageSize: number;
  sort: UsersSort;
  status: UsersStatusFilter;
  searchField: UsersSearchField;
  startDate: string;
  endDate: string;
  keyword: string;
};

export type InstructorStatus = '정상' | '정지' | '탈퇴';

export const instructorCountries = [
  '한국',
  '베트남',
  '인도네시아',
  '태국',
  '필리핀'
] as const;

export const instructorOrganizations = [
  '서울 TOPIK 센터',
  '하노이 제휴 캠퍼스',
  '자카르타 학습 허브',
  '방콕 교육 라운지',
  '마닐라 운영 센터'
] as const;

export const instructorActivityStatuses = ['활성', '주의', '휴면'] as const;
export const instructorAssignmentStatuses = ['안정', '주의', '조정 필요'] as const;

export type InstructorCountry = (typeof instructorCountries)[number];
export type InstructorOrganization = (typeof instructorOrganizations)[number];
export type InstructorActivityStatus = (typeof instructorActivityStatuses)[number];
export type InstructorAssignmentStatus =
  (typeof instructorAssignmentStatuses)[number];
export type InstructorCourseStatus = '진행 중' | '준비 중' | '종료 예정';
export type InstructorMessageChannel = '메일' | '푸시';
export type InstructorMessageStatus = '발송 완료' | '예약' | '초안';

export type InstructorCourseSummary = {
  id: string;
  title: string;
  level: string;
  studentCount: number;
  status: InstructorCourseStatus;
};

export type InstructorMessageHistory = {
  id: string;
  channel: InstructorMessageChannel;
  title: string;
  sentAt: string;
  status: InstructorMessageStatus;
};

export type InstructorAdminNote = {
  id: string;
  adminName: string;
  content: string;
  createdAt: string;
};

export type InstructorDetail = {
  id: string;
  realName: string;
  email: string;
  nickname: string;
  organization: InstructorOrganization;
  country: InstructorCountry;
  status: InstructorStatus;
  activityStatus: InstructorActivityStatus;
  assignmentStatus: InstructorAssignmentStatus;
  courseCount: number;
  studentCount: number;
  lastActivityAt: string;
  lastActionAt: string;
  messageGroupId: string;
  messageGroupName: string;
  specialties: string[];
  introduction: string;
  assignedCourses: InstructorCourseSummary[];
  recentMessages: InstructorMessageHistory[];
  adminNotes: InstructorAdminNote[];
};

export type InstructorSort =
  | 'recent-activity'
  | 'students-desc'
  | 'courses-desc';
export type InstructorStatusFilter = 'all' | InstructorStatus;
export type InstructorActivityFilter = 'all' | InstructorActivityStatus;
export type InstructorCountryFilter = 'all' | InstructorCountry;
export type InstructorOrganizationFilter = 'all' | InstructorOrganization;
export type InstructorSearchField =
  | 'all'
  | 'id'
  | 'realName'
  | 'email'
  | 'organization'
  | 'messageGroupName';

export type InstructorQuery = {
  page: number;
  pageSize: number;
  sort: InstructorSort;
  status: InstructorStatusFilter;
  activityStatus: InstructorActivityFilter;
  country: InstructorCountryFilter;
  organization: InstructorOrganizationFilter;
  searchField: InstructorSearchField;
  startDate: string;
  endDate: string;
  keyword: string;
};
