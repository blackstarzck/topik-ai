export type UserStatus = '정상' | '정지' | '탈퇴';
export type UserTier = '일반' | '프리미엄';
export type SubscriptionStatus = '구독' | '미구독';
// 회원가입(일반·SNS) 필수 약관 동의 상태. 현재 필수 문서 = 이용약관(terms) + 개인정보처리방침(privacy).
export type TermsConsentStatus = '동의 완료' | '일부 동의' | '미동의';
export type TermsConsentDisplayStatus = TermsConsentStatus | '동의 불가';
// 이메일 인증(가입 완료) 여부. auth.users.email_confirmed_at 기준.
// '미인증' = 이메일 가입 후 확인메일을 누르지 않은 가입 미완료(중도이탈) 계정.
// 소셜(google 등) 가입은 자동 인증되어 항상 '인증 완료'.
export type EmailVerificationStatus = '인증 완료' | '미인증';
export type UserGenderFilter = '남성' | '여성' | '기타' | '미입력';
export type UserMembershipStatus = '인증 대기' | '약관 대기' | UserStatus;
export type RegistrationStatus =
  | 'active'
  | 'blocked'
  | 'deleted'
  | 'pending_email_verification'
  | 'pending_required_consent';

export type UserSummary = {
  id: string;
  realName: string;
  email: string;
  nickname: string;
  // v13 profiles.gender 원본을 관리자 표시 라벨(남성/여성/기타 등)로 정규화한 값.
  // 미입력/비공개 값은 빈 문자열로 두고 UI에서 '-' 로 렌더한다.
  gender: string;
  joinedAt: string;
  lastLoginAt: string;
  // v13 profiles.status 원천 운영 상태. 화면의 "회원 상태"는 이메일 인증과
  // 필수 약관 동의까지 반영해 registration-status helper에서 파생한다.
  status: UserStatus;
  // Admin RPC가 계산한 가입 생애주기 상태. profiles.status를 과확장하지 않고
  // 이메일 인증/필수 약관 동의 여부를 별도 계약으로 내려준다.
  registrationStatus?: RegistrationStatus;
  tier: UserTier;
  subscriptionStatus: SubscriptionStatus;
  // v13 가입 시 수집되는 국적 ISO 3166-1 alpha-2 코드 원본(미입력 시 빈 문자열).
  // 화면 표시(국가명 한글)는 shared/model/country-name 의 formatNationality 로 변환.
  nationalityCode: string;
  // 연동된 소셜 로그인 제공자 목록(예: ['google', 'kakao']). auth.identities 에서
  // 'email'(이메일·비밀번호 가입)을 제외한 provider 집계. 소셜 미연동 시 빈 배열.
  // 화면 표시(브랜드 라벨/색상 태그)는 shared/ui/social-provider 에서 처리.
  socialProviders: string[];
  // v13 원천 약관 동의 상태와 최종 동의일(YYYY-MM-DD, 미동의 시 빈 문자열).
  // 이메일 미인증 계정에서는 화면 표시를 "동의 불가"로 파생한다.
  termsConsentStatus: TermsConsentStatus;
  termsConsentAt: string;
  // 이메일 인증(가입 완료) 여부. '미인증' = 가입 미완료(중도이탈) 계정으로 회원명/닉네임이
  // 비어있을 수 있다. '미인증'이면 회원 상태는 "인증 대기"로 파생한다.
  emailVerificationStatus: EmailVerificationStatus;
  // 박람회/기관 유입 코드(v13 profiles.affiliation_code). 비어있으면 일반(유입경로 없음) 회원.
  // 코드 자체는 의미가 없고, 의미(기관/행사명)는 admin institution_codes 카탈로그가 소유한다.
  affiliationCode: string;
  // affiliationCode 를 institution_codes.label 로 해석한 표시명(없음/미등록 시 빈 문자열).
  affiliationLabel: string;
  // 전화번호 마스킹값(예: 010-****-5678, 미입력 시 빈 문자열). 목록 등 대량 화면은
  // 이 값만 사용한다 — 개인정보 안전성 확보조치 기준의 출력 항목 최소화(표시제한) 정책.
  phoneMasked: string;
  // 전화번호 원문(개인정보). 단건 상세 RPC(get_admin_user)만 내려주는 값으로, 목록
  // RPC(get_admin_users)는 원문을 반환하지 않으므로 목록 행에서는 undefined 다.
  phone?: string;
};

// 회원 상세 > 학습 현황 탭 모델. get_admin_user_learning_overview(writing 중심 재정의,
// 20260708130000) RPC 및 mock(getMockUserLearningOverview)이 반환하는 집계 계약과 1:1 대응한다.
// 점수는 원점수+100점 정규화 병기, 소요 시간은 writing_submission_metrics 부재 시 null(미수집).
export type UserLearningKpi = {
  totalSubmissions: number;
  feedbackComplete: number;
  feedbackPending: number;
  feedbackFailed: number;
  resubmissionCount: number;
  avgScoreNormalized: number | null;
  feedbackViewedCount: number;
  feedbackViewRate: number | null;
  // 연속 학습일(KST, 오늘/어제 기준) — 학습 이벤트(study_events) 기준(로그인 아님).
  streakDays: number;
  weeklyGoalMinutes: number | null;
  // 이번 주 학습 분(소요시간 metrics 합). null = 소요시간 미수집 사용자(0분과 구분).
  weeklyStudiedMinutes: number | null;
  // 소요시간이 수집된 제출 수. 0이면 시간 관련 항목은 전부 "미수집"으로 표시한다.
  metricsCount: number;
  avgElapsedSeconds: number | null;
  avgActiveSeconds: number | null;
  latestActivityAt: string;
};

// 51~54 문항별 성과 행.
export type UserLearningQuestionStat = {
  questionNo: number;
  submissions: number;
  feedbackComplete: number;
  avgScoreRaw: number | null;
  // 해당 문항 피드백의 대표 만점(최빈값). 행별 만점이 섞여 있을 수 있어 표시용.
  scoreMax: number | null;
  avgScoreNormalized: number | null;
  avgElapsedSeconds: number | null;
  metricsCount: number;
};

// 문항 태그별 성과 행(problems.tags 기준, 제출 수 상위).
export type UserLearningTagStat = {
  tag: string;
  submissions: number;
  feedbackComplete: number;
  avgScoreNormalized: number | null;
};

// 객관식(problem_attempts) KPI 분리 블록. 객관식/읽기/듣기 도입 전까지는 수집 전 상태(전부 0).
export type UserObjectiveAttemptStats = {
  totalAttempts: number;
  solvedProblems: number;
  correctRate: number | null;
  averageScore: number | null;
  totalStudyMinutes: number;
  bookmarkedCount: number;
  latestAttemptAt: string;
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

export type UserLearningWeakness = {
  label: string;
  source: 'tag' | 'writing_dimension' | 'goal';
  severity: number;
  evidenceCount: number;
};

export type UserLearningRecentWriting = {
  submissionId: string;
  questionNo: number;
  problemId: string | null;
  // 문항 제목(지문형은 SQL에서 120자 절단). 답안 원문(answer_text)은 계약상 포함하지 않는다.
  problemTitle: string;
  submittedAt: string;
  feedbackStatus: string;
  scoreTotal: number | null;
  scoreMax: number | null;
  scoreNormalized: number | null;
  isResubmission: boolean;
  viewed: boolean;
  // null = 소요시간 미수집 제출(마이그레이션 이전 제출 등).
  elapsedSeconds: number | null;
  weaknessDimensions: string[];
};

export type UserLearningOverview = {
  kpis: UserLearningKpi;
  perQuestion: UserLearningQuestionStat[];
  tagStats: UserLearningTagStat[];
  weaknesses: UserLearningWeakness[];
  recentWriting: UserLearningRecentWriting[];
  objectiveAttempts: UserObjectiveAttemptStats;
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
  // 기관 소속 서버사이드 필터('' 전체 | @affiliated | @general | 특정 코드).
  affiliation: string;
  genderFilters: UserGenderFilter[];
  tierFilters: UserTier[];
  subscriptionStatusFilters: SubscriptionStatus[];
  membershipStatusFilters: UserMembershipStatus[];
  termsConsentStatusFilters: TermsConsentDisplayStatus[];
  emailVerificationStatusFilters: EmailVerificationStatus[];
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
