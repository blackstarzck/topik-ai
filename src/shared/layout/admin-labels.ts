import type { RoleKey } from '../../features/system/model/permission-types';

export const adminMenuLabels = {
  dashboard: '대시보드',
  users: '회원 관리',
  usersList: '회원 목록',
  usersGroups: 'B2B 그룹 관리',
  usersReferrals: '추천인 관리',
  community: '커뮤니티',
  communityPosts: '게시글 관리',
  communityReports: '신고 관리',
  messages: '메시지',
  messagesMail: '메일',
  messagesPush: '푸시',
  messagesGroups: '대상 그룹',
  messagesHistory: '발송 이력',
  operation: '운영',
  operationNotices: '공지사항',
  operationFaq: 'FAQ',
  operationEvents: '이벤트',
  operationChatbot: '챗봇 설정',
  commerce: '커머스',
  commercePayments: '결제 내역',
  commerceRefunds: '환불 관리',
  commerceCoupons: '쿠폰 관리',
  commercePoints: '포인트 관리',
  commerceStore: '이커머스 관리',
  assessment: '평가',
  assessmentQuestionBank: '문제은행',
  assessmentEpsTopik: 'EPS TOPIK',
  assessmentLevelTests: '레벨 테스트',
  content: '콘텐츠',
  contentLibrary: '콘텐츠 관리',
  contentBadges: '배지',
  contentVocabulary: '단어장',
  contentVocabularySonagi: '소나기',
  contentVocabularyMultipleChoice: '객관식 선택',
  contentMissions: '학습 미션',
  analytics: '통계',
  system: '시스템',
  systemAdmins: '관리자 계정',
  systemPermissions: '권한 관리',
  systemAuditLogs: '감사 로그',
  systemLogs: '시스템 로그'
} as const;

export const adminRoleLabels: Record<RoleKey, string> = {
  SUPER_ADMIN: '슈퍼 관리자',
  OPS_ADMIN: '운영 관리자',
  CONTENT_MANAGER: '콘텐츠 관리자',
  CS_MANAGER: 'CS 담당자',
  READ_ONLY: '조회 전용'
};

export const userDetailTabLabels: Record<string, string> = {
  profile: '프로필',
  activity: '활동',
  payments: '결제',
  community: '커뮤니티',
  logs: '로그',
  'admin-memo': '관리자 메모'
};
