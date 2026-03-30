export const operationPolicyStatusValues = ['게시', '숨김'] as const;

export type OperationPolicyStatus =
  (typeof operationPolicyStatusValues)[number];

export const operationPolicyCategoryValues = [
  '법률/약관',
  '커뮤니티/안전',
  '결제/리워드',
  '운영/콘텐츠',
  '메시지/알림',
  '관리자/보안'
] as const;

export type OperationPolicyCategory =
  (typeof operationPolicyCategoryValues)[number];

export const operationPolicyTrackingStatusValues = [
  '코드 반영',
  '문서 추적',
  '정책 미확정'
] as const;

export type OperationPolicyTrackingStatus =
  (typeof operationPolicyTrackingStatusValues)[number];

export const operationPolicyTypeValues = [
  '이용약관',
  '개인정보 처리방침',
  '결제ㆍ환불 정책',
  '청소년 보호정책',
  '커뮤니티 게시글 제재 정책',
  '추천인 보상 정책',
  '포인트 운영정책',
  '쿠폰 운영정책',
  '이벤트 운영정책',
  'FAQ 노출 정책',
  '챗봇 상담 전환 정책',
  '메일 발송 운영정책',
  '푸시 발송 운영정책',
  '발송 실패/재시도 정책',
  '관리자 권한 변경 정책',
  '마케팅 정보 수신 동의'
] as const;

export type OperationPolicyType = (typeof operationPolicyTypeValues)[number];

export const operationPolicyExposureSurfaceValues = [
  '회원가입',
  '결제',
  '마이페이지',
  '고객센터',
  '앱 설정',
  '관리자 콘솔'
] as const;

export type OperationPolicyExposureSurface =
  (typeof operationPolicyExposureSurfaceValues)[number];

export const operationPolicyRelatedAdminPageValues = [
  'Operation > 정책 관리',
  'Operation > FAQ',
  'Operation > 이벤트',
  'Operation > 챗봇 설정',
  'Users > 회원 목록',
  'Users > 회원 상세',
  'Users > 추천인 관리',
  'Community > 게시글 관리',
  'Community > 신고 관리',
  'Message > 메일',
  'Message > 푸시',
  'Message > 대상 그룹',
  'Message > 발송 이력',
  'Commerce > 결제 내역',
  'Commerce > 환불 관리',
  'Commerce > 쿠폰 관리',
  'Commerce > 포인트 관리',
  'System > 관리자 계정',
  'System > 권한 관리',
  'System > 감사 로그'
] as const;

export type OperationPolicyRelatedAdminPage =
  (typeof operationPolicyRelatedAdminPageValues)[number];

export const operationPolicyRelatedUserPageValues = [
  '회원가입 > 약관 동의',
  '회원가입 > 마케팅 수신 동의',
  '결제 > 약관/환불 안내',
  '결제 > 쿠폰/포인트 적용',
  '마이페이지 > 정책 링크',
  '마이페이지 > 개인정보/수신 동의 설정',
  '고객센터 > 정책 문서',
  '앱 설정 > 법적 고지',
  '커뮤니티 > 게시글 작성/이용 안내',
  'FAQ > 고객센터 FAQ',
  '이벤트 > 상세',
  '챗봇 > 상담 전환 안내',
  '이메일 > 운영/정책 안내',
  '앱/웹 푸시 > 운영/정책 안내'
] as const;

export type OperationPolicyRelatedUserPage =
  (typeof operationPolicyRelatedUserPageValues)[number];

export const operationPolicyHistoryActionValues = [
  'created',
  'updated',
  'status_changed',
  'version_published',
  'deleted'
] as const;

export type OperationPolicyHistoryAction =
  (typeof operationPolicyHistoryActionValues)[number];

export type OperationPolicy = {
  id: string;
  category: OperationPolicyCategory;
  policyType: OperationPolicyType;
  title: string;
  versionLabel: string;
  effectiveDate: string;
  exposureSurfaces: OperationPolicyExposureSurface[];
  requiresConsent: boolean;
  trackingStatus: OperationPolicyTrackingStatus;
  relatedAdminPages: OperationPolicyRelatedAdminPage[];
  relatedUserPages: OperationPolicyRelatedUserPage[];
  sourceDocuments: string[];
  summary: string;
  legalReferences: string[];
  bodyHtml: string;
  adminMemo: string;
  status: OperationPolicyStatus;
  createdAt: string;
  updatedAt: string;
  updatedBy: string;
};

export type OperationPolicyHistoryEntry = {
  id: string;
  policyId: string;
  action: OperationPolicyHistoryAction;
  versionLabel: string;
  status: OperationPolicyStatus;
  trackingStatus: OperationPolicyTrackingStatus;
  changedAt: string;
  changedBy: string;
  note: string;
  snapshot: OperationPolicy;
};

export function inferOperationPolicyRelatedAdminPages(
  policyType: OperationPolicyType
): OperationPolicyRelatedAdminPage[] {
  switch (policyType) {
    case '이용약관':
      return ['Operation > 정책 관리', 'Users > 회원 목록', 'Users > 회원 상세'];
    case '개인정보 처리방침':
      return ['Operation > 정책 관리', 'Users > 회원 상세', 'Message > 메일'];
    case '결제ㆍ환불 정책':
      return ['Commerce > 결제 내역', 'Commerce > 환불 관리', 'Commerce > 포인트 관리'];
    case '청소년 보호정책':
      return ['Community > 게시글 관리', 'Community > 신고 관리', 'Operation > 정책 관리'];
    case '커뮤니티 게시글 제재 정책':
      return ['Community > 게시글 관리', 'Community > 신고 관리', 'System > 감사 로그'];
    case '추천인 보상 정책':
      return ['Users > 추천인 관리', 'Commerce > 포인트 관리', 'System > 감사 로그'];
    case '포인트 운영정책':
      return ['Commerce > 포인트 관리', 'Users > 추천인 관리', 'Operation > 이벤트'];
    case '쿠폰 운영정책':
      return ['Commerce > 쿠폰 관리', 'Operation > 이벤트', 'Message > 메일'];
    case '이벤트 운영정책':
      return ['Operation > 이벤트', 'Commerce > 쿠폰 관리', 'Message > 대상 그룹'];
    case 'FAQ 노출 정책':
      return ['Operation > FAQ', 'Operation > 챗봇 설정', 'System > 감사 로그'];
    case '챗봇 상담 전환 정책':
      return ['Operation > 챗봇 설정', 'Operation > FAQ', 'Message > 메일'];
    case '메일 발송 운영정책':
      return ['Message > 메일', 'Message > 대상 그룹', 'Message > 발송 이력'];
    case '푸시 발송 운영정책':
      return ['Message > 푸시', 'Message > 대상 그룹', 'Message > 발송 이력'];
    case '발송 실패/재시도 정책':
      return ['Message > 발송 이력', 'Message > 메일', 'Message > 푸시'];
    case '관리자 권한 변경 정책':
      return ['System > 권한 관리', 'System > 관리자 계정', 'System > 감사 로그'];
    case '마케팅 정보 수신 동의':
      return ['Message > 메일', 'Message > 푸시', 'Users > 회원 상세'];
    default:
      return ['Operation > 정책 관리'];
  }
}

export function inferOperationPolicyRelatedUserPages(
  policyType: OperationPolicyType,
  exposureSurfaces: OperationPolicyExposureSurface[] = []
): OperationPolicyRelatedUserPage[] {
  switch (policyType) {
    case '이용약관':
      return ['회원가입 > 약관 동의', '마이페이지 > 정책 링크', '고객센터 > 정책 문서'];
    case '개인정보 처리방침':
      return [
        '회원가입 > 약관 동의',
        '마이페이지 > 개인정보/수신 동의 설정',
        '앱 설정 > 법적 고지'
      ];
    case '결제ㆍ환불 정책':
      return ['결제 > 약관/환불 안내', '마이페이지 > 정책 링크', '고객센터 > 정책 문서'];
    case '청소년 보호정책':
      return ['커뮤니티 > 게시글 작성/이용 안내', '고객센터 > 정책 문서', '앱 설정 > 법적 고지'];
    case '커뮤니티 게시글 제재 정책':
      return ['커뮤니티 > 게시글 작성/이용 안내', '고객센터 > 정책 문서'];
    case '추천인 보상 정책':
      return ['마이페이지 > 정책 링크', '결제 > 쿠폰/포인트 적용', '이벤트 > 상세'];
    case '포인트 운영정책':
      return ['결제 > 쿠폰/포인트 적용', '마이페이지 > 정책 링크'];
    case '쿠폰 운영정책':
      return ['결제 > 쿠폰/포인트 적용', '이벤트 > 상세', '마이페이지 > 정책 링크'];
    case '이벤트 운영정책':
      return ['이벤트 > 상세', '고객센터 > 정책 문서'];
    case 'FAQ 노출 정책':
      return ['FAQ > 고객센터 FAQ', '챗봇 > 상담 전환 안내'];
    case '챗봇 상담 전환 정책':
      return ['챗봇 > 상담 전환 안내', 'FAQ > 고객센터 FAQ'];
    case '메일 발송 운영정책':
      return ['이메일 > 운영/정책 안내'];
    case '푸시 발송 운영정책':
      return ['앱/웹 푸시 > 운영/정책 안내'];
    case '발송 실패/재시도 정책':
      return ['이메일 > 운영/정책 안내', '앱/웹 푸시 > 운영/정책 안내'];
    case '관리자 권한 변경 정책':
      return [];
    case '마케팅 정보 수신 동의':
      return ['회원가입 > 마케팅 수신 동의', '마이페이지 > 개인정보/수신 동의 설정'];
    default: {
      const inferredFromSurface = new Set<OperationPolicyRelatedUserPage>();

      exposureSurfaces.forEach((surface) => {
        if (surface === '회원가입') {
          inferredFromSurface.add('회원가입 > 약관 동의');
        }

        if (surface === '결제') {
          inferredFromSurface.add('결제 > 약관/환불 안내');
        }

        if (surface === '마이페이지') {
          inferredFromSurface.add('마이페이지 > 정책 링크');
        }

        if (surface === '고객센터') {
          inferredFromSurface.add('고객센터 > 정책 문서');
        }

        if (surface === '앱 설정') {
          inferredFromSurface.add('앱 설정 > 법적 고지');
        }
      });

      return Array.from(inferredFromSurface);
    }
  }
}
