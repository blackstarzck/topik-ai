export type MessageChannel = 'mail' | 'push';

export type MessageTemplateMode = 'auto' | 'manual';

export type MessageTemplateStatus = '활성' | '비활성 | '珥덉븞';

export type MessageGroupDefinitionType = '?뺤쟻 洹몃９' | '議곌굔 湲곕컲 洹몃９';

export type MessageGroupStatus = '?ъ슜以? | '珥덉븞';

export type MessageHistoryStatus = '완료' | '부분 실패' | '실패' | '예약';

export type MessageSendActionType =
  | '즉시 발송'
  | '예약 발송'
  | '?ъ떆??;

export type MessageGroupBuilderMode = 'simple' | 'query-builder';

export type MessageGroupQueryCombinator = 'and' | 'or';

export type MessageGroupQueryField =
  | 'country'
  | 'memberType'
  | 'gender'
  | 'age'
  | 'signupMethod'
  | 'signupDate'
  | 'subscriptionState'
  | 'activityState';

export type MessageGroupQueryOperator =
  | 'equals'
  | 'notEquals'
  | 'contains'
  | 'greaterThanOrEquals'
  | 'lessThanOrEquals'
  | 'before'
  | 'after';

export type MessageGroupQueryRule = {
  type: 'rule';
  id: string;
  field: MessageGroupQueryField;
  operator: MessageGroupQueryOperator;
  value: string;
};

export type MessageGroupQueryGroup = {
  type: 'group';
  id: string;
  combinator: MessageGroupQueryCombinator;
  children: MessageGroupQueryNode[];
};

export type MessageGroupQueryNode = MessageGroupQueryRule | MessageGroupQueryGroup;

export type MessageGroupCountry = '?쒓뎅 (KR)' | '誘멸뎅 (US)' | '踰좏듃??(VN)';

export type MessageGroupMemberType = '?숈깮' | '媛뺤궗' | '?뚰듃??;

export type MessageGroupGender = '?⑥꽦' | '?ъ꽦';

export type MessageGroupSignupMethod = '이메일 | '援ш?' | '?섏씠?ㅻ턿' | '移댁뭅??;

export type MessageGroupSubscriptionState = '구독' | '구독?댁?';

export type MessageGroupActivityState = '활동' | '비활성;

export type MessageRecipientStatus = '성공' | '실패' | '예약';

export type MessageTemplate = {
  id: string;
  channel: MessageChannel;
  mode: MessageTemplateMode;
  category: string;
  name: string;
  summary: string;
  subject: string;
  targetGroupIds: string[];
  status: MessageTemplateStatus;
  triggerLabel?: string;
  bodyHtml: string;
  bodyJson: string;
  lastSentAt?: string;
  updatedAt: string;
  updatedBy: string;
};

export type MessageGroup = {
  id: string;
  name: string;
  description: string;
  definitionType: MessageGroupDefinitionType;
  builderMode: MessageGroupBuilderMode;
  channels: MessageChannel[];
  memberCount: number;
  ruleSummary: string;
  status: MessageGroupStatus;
  staticMembers: string[];
  filters: MessageGroupFilters;
  queryBuilderText?: string;
  queryBuilderConfig?: MessageGroupQueryGroup;
  lastCalculatedAt: string;
  updatedAt: string;
  updatedBy: string;
};

export type MessageGroupFilters = {
  country: MessageGroupCountry;
  memberTypes: MessageGroupMemberType[];
  genders: MessageGroupGender[];
  ageRange: [number, number];
  signupMethods: MessageGroupSignupMethod[];
  signupDateRange?: {
    start?: string;
    end?: string;
  };
  subscriptionStates: MessageGroupSubscriptionState[];
  activityStates: MessageGroupActivityState[];
};

export type MessageHistoryRecipient = {
  id: string;
  userId: string;
  userName: string;
  destination: string;
  mode: MessageTemplateMode;
  templateName: string;
  status: MessageRecipientStatus;
  sentAt: string;
  failureReason?: string;
};

export type MessageHistory = {
  id: string;
  channel: MessageChannel;
  mode: MessageTemplateMode;
  templateId: string;
  templateName: string;
  groupIds: string[];
  groupName: string;
  targetCount: number;
  successCount: number;
  failureCount: number;
  status: MessageHistoryStatus;
  actionType: MessageSendActionType;
  scheduledAt?: string;
  sentAt: string;
  actor: string;
  recipients: MessageHistoryRecipient[];
};

export type ChannelSnapshot = {
  templates: MessageTemplate[];
  groups: MessageGroup[];
};


