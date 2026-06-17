export type UserStatus = '정상' | '정지' | '탈퇴';
export type UserTier = '일반' | '프리미엄';
export type SubscriptionStatus = '구독' | '미구독';
// 회원가입(일반·SNS) 필수 약관 동의 상태. 현재 필수 문서 = 이용약관(terms) + 개인정보처리방침(privacy).
export type TermsConsentStatus = '동의 완료' | '일부 동의' | '미동의';

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
  // 약관 동의(인증약관) 상태와 최종 동의일(YYYY-MM-DD, 미동의 시 빈 문자열).
  termsConsentStatus: TermsConsentStatus;
  termsConsentAt: string;
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

