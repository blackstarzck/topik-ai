import type { RoleKey } from '../../features/system/model/permission-types';

export const adminMenuLabels = {
  dashboard: '\ub300\uc2dc\ubcf4\ub4dc',
  users: '\ud68c\uc6d0 \uad00\ub9ac',
  usersList: '\ud68c\uc6d0 \ubaa9\ub85d',
  usersGroups: '\uac15\uc0ac \uad00\ub9ac',
  usersReferrals: '\ucd94\ucc9c\uc778 \uad00\ub9ac',
  community: '\ucee4\ubba4\ub2c8\ud2f0',
  communityPosts: '\uac8c\uc2dc\uae00 \uad00\ub9ac',
  communityReports: '\uc2e0\uace0 \uad00\ub9ac',
  messages: '\uba54\uc2dc\uc9c0',
  messagesMail: '\uba54\uc77c',
  messagesPush: '\ud478\uc2dc',
  messagesGroups: '\ub300\uc0c1 \uadf8\ub8f9',
  messagesHistory: '\ubc1c\uc1a1 \uc774\ub825',
  operation: '\uc6b4\uc601',
  operationNotices: '\uacf5\uc9c0\uc0ac\ud56d',
  operationFaq: 'FAQ',
  operationEvents: '\uc774\ubca4\ud2b8',
  operationPolicies: '\uc815\ucc45 \uad00\ub9ac',
  operationChatbot: '\ucc57\ubd07 \uc124\uc815',
  commerce: '\ucee4\uba38\uc2a4',
  commercePayments: '\uacb0\uc81c \ub0b4\uc5ed',
  commerceRefunds: '\ud658\ubd88 \uad00\ub9ac',
  commerceCoupons: '\ucfe0\ud3f0 \uad00\ub9ac',
  commercePoints: '\ud3ec\uc778\ud2b8 \uad00\ub9ac',
  commerceStore: '\uc774\ucee4\uba38\uc2a4 \uad00\ub9ac',
  assessment: '\ud3c9\uac00',
  assessmentQuestionBank: '\ubb38\uc81c\uc740\ud589',
  assessmentEpsTopik: 'EPS TOPIK',
  assessmentLevelTests: '\ub808\ubca8 \ud14c\uc2a4\ud2b8',
  content: '\ucf58\ud150\uce20',
  contentLibrary: '\ucf58\ud150\uce20 \uad00\ub9ac',
  contentBadges: '\ubc30\uc9c0',
  contentVocabulary: '\ub2e8\uc5b4\uc7a5',
  contentVocabularySonagi: '\uc18c\ub098\uae30',
  contentVocabularyMultipleChoice: '\uac1d\uad00\uc2dd \uc120\ud0dd',
  contentMissions: '\ud559\uc2b5 \ubbf8\uc158',
  analytics: '\ud1b5\uacc4',
  system: '\uc2dc\uc2a4\ud15c',
  systemAdmins: '\uad00\ub9ac\uc790 \uacc4\uc815',
  systemPermissions: '\uad8c\ud55c \uad00\ub9ac',
  systemMetadata: '\uba54\ud0c0\ub370\uc774\ud130 \uad00\ub9ac',
  systemAuditLogs: '\uac10\uc0ac \ub85c\uadf8',
  systemLogs: '\uc2dc\uc2a4\ud15c \ub85c\uadf8'
} as const;

export const adminRoleLabels: Record<RoleKey, string> = {
  SUPER_ADMIN: '\uc288\ud37c \uad00\ub9ac\uc790',
  OPS_ADMIN: '\uc6b4\uc601 \uad00\ub9ac\uc790',
  CONTENT_MANAGER: '\ucf58\ud150\uce20 \uad00\ub9ac\uc790',
  CS_MANAGER: 'CS \ub2f4\ub2f9\uc790',
  READ_ONLY: '\uc870\ud68c \uc804\uc6a9'
};

export const userDetailTabLabels: Record<string, string> = {
  profile: '\ud504\ub85c\ud544',
  activity: '\ud65c\ub3d9',
  payments: '\uacb0\uc81c',
  community: '\ucee4\ubba4\ub2c8\ud2f0',
  logs: '\ub85c\uadf8',
  'admin-memo': '\uad00\ub9ac\uc790 \uba54\ubaa8'
};
