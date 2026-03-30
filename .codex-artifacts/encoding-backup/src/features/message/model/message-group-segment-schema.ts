import dayjs from 'dayjs';

import type {
  MessageChannel,
  MessageGroupActivityState,
  MessageGroupBuilderMode,
  MessageGroupCountry,
  MessageGroupDefinitionType,
  MessageGroupFilters,
  MessageGroupGender,
  MessageGroupMemberType,
  MessageGroupQueryField,
  MessageGroupQueryOperator,
  MessageGroupSignupMethod,
  MessageGroupStatus,
  MessageGroupSubscriptionState
} from './types';

export type MessageGroupOption<T extends string> = {
  label: string;
  value: T;
};

export type MessageGroupFieldValueType = 'select' | 'number' | 'date';

export type MessageGroupQueryFieldDefinition = {
  key: MessageGroupQueryField;
  label: string;
  column: string;
  sourceKey: keyof MessageGroupFilters;
  valueType: MessageGroupFieldValueType;
  defaultValue: string;
  operators: MessageGroupQueryOperator[];
  options?: MessageGroupOption<string>[];
};

export const MESSAGE_GROUP_DEFAULT_AGE_RANGE: [number, number] = [18, 60];

export const channelOptionValues: MessageGroupOption<MessageChannel>[] = [
  { label: '硫붿씪', value: 'mail' },
  { label: '?몄떆', value: 'push' }
];

export const DEFAULT_MESSAGE_GROUP_CHANNELS: MessageChannel[] = channelOptionValues.map(
  (option) => option.value
);

export const messageGroupDefinitionTypeOptions: MessageGroupOption<MessageGroupDefinitionType>[] = [
  { label: '議곌굔 湲곕컲 洹몃９', value: '議곌굔 湲곕컲 洹몃９' },
  { label: '?뺤쟻 洹몃９', value: '?뺤쟻 洹몃９' }
];

export const DEFAULT_MESSAGE_GROUP_DEFINITION_TYPE: MessageGroupDefinitionType =
  '議곌굔 湲곕컲 洹몃９';

export const messageGroupStatusOptions: MessageGroupOption<MessageGroupStatus>[] = [
  { label: '?ъ슜以?, value: '?ъ슜以? },
  { label: '珥덉븞', value: '珥덉븞' }
];

export const DEFAULT_MESSAGE_GROUP_STATUS: MessageGroupStatus = '?ъ슜以?;

export const messageGroupBuilderModeOptions: MessageGroupOption<MessageGroupBuilderMode>[] = [
  { label: '媛꾪렪 ?ㅼ젙', value: 'simple' },
  { label: '상세 ?ㅼ젙(Query Builder)', value: 'query-builder' }
];

export const DEFAULT_MESSAGE_GROUP_BUILDER_MODE: MessageGroupBuilderMode = 'simple';

export const countryOptionValues: MessageGroupOption<MessageGroupCountry>[] = [
  { label: '?쒓뎅 (KR)', value: '?쒓뎅 (KR)' },
  { label: '誘멸뎅 (US)', value: '誘멸뎅 (US)' },
  { label: '踰좏듃??(VN)', value: '踰좏듃??(VN)' }
];

export const memberTypeOptionValues: MessageGroupOption<MessageGroupMemberType>[] = [
  { label: '?숈깮', value: '?숈깮' },
  { label: '媛뺤궗', value: '媛뺤궗' },
  { label: '?뚰듃??, value: '?뚰듃?? }
];

export const genderOptionValues: MessageGroupOption<MessageGroupGender>[] = [
  { label: '?⑥꽦', value: '?⑥꽦' },
  { label: '?ъ꽦', value: '?ъ꽦' }
];

export const signupMethodOptionValues: MessageGroupOption<MessageGroupSignupMethod>[] = [
  { label: '이메일, value: '이메일 },
  { label: '援ш?', value: '援ш?' },
  { label: '?섏씠?ㅻ턿', value: '?섏씠?ㅻ턿' },
  { label: '移댁뭅??, value: '移댁뭅?? }
];

export const subscriptionOptionValues: MessageGroupOption<MessageGroupSubscriptionState>[] = [
  { label: '구독', value: '구독' },
  { label: '구독?댁?', value: '구독?댁?' }
];

export const activityOptionValues: MessageGroupOption<MessageGroupActivityState>[] = [
  { label: '활동', value: '활동' },
  { label: '비활성, value: '비활성 }
];

export const allMemberTypeValues = memberTypeOptionValues.map((option) => option.value);
export const allGenderValues = genderOptionValues.map((option) => option.value);
export const allSignupMethodValues = signupMethodOptionValues.map((option) => option.value);
export const allSubscriptionValues = subscriptionOptionValues.map((option) => option.value);
export const allActivityValues = activityOptionValues.map((option) => option.value);

export const messageGroupQueryOperatorLabels: Record<MessageGroupQueryOperator, string> = {
  equals: '媛숈쓬',
  notEquals: '媛숈? ?딆쓬',
  contains: '?ы븿',
  greaterThanOrEquals: '?댁긽',
  lessThanOrEquals: '?댄븯',
  before: '?댁쟾',
  after: '?댄썑'
};

// Local schema SoT for admin segmentation. This can be swapped to API metadata later
// without changing the page composition or query builder logic.
export const messageGroupQueryFieldDefinitions: Record<
  MessageGroupQueryField,
  MessageGroupQueryFieldDefinition
> = {
  country: {
    key: 'country',
    label: '援?쟻',
    column: 'country',
    sourceKey: 'country',
    valueType: 'select',
    defaultValue: countryOptionValues[0].value,
    operators: ['equals', 'notEquals'],
    options: countryOptionValues
  },
  memberType: {
    key: 'memberType',
    label: '회원 ?좏삎',
    column: 'member_type',
    sourceKey: 'memberTypes',
    valueType: 'select',
    defaultValue: memberTypeOptionValues[0].value,
    operators: ['equals', 'notEquals'],
    options: memberTypeOptionValues
  },
  gender: {
    key: 'gender',
    label: '?깅퀎',
    column: 'gender',
    sourceKey: 'genders',
    valueType: 'select',
    defaultValue: genderOptionValues[0].value,
    operators: ['equals', 'notEquals'],
    options: genderOptionValues
  },
  age: {
    key: 'age',
    label: '?곕졊',
    column: 'age',
    sourceKey: 'ageRange',
    valueType: 'number',
    defaultValue: String(MESSAGE_GROUP_DEFAULT_AGE_RANGE[0]),
    operators: ['greaterThanOrEquals', 'lessThanOrEquals', 'equals']
  },
  signupMethod: {
    key: 'signupMethod',
    label: '媛??諛⑹떇',
    column: 'signup_method',
    sourceKey: 'signupMethods',
    valueType: 'select',
    defaultValue: signupMethodOptionValues[0].value,
    operators: ['equals', 'notEquals'],
    options: signupMethodOptionValues
  },
  signupDate: {
    key: 'signupDate',
    label: '媛???쇱옄',
    column: 'signup_date',
    sourceKey: 'signupDateRange',
    valueType: 'date',
    defaultValue: dayjs().format('YYYY-MM-DD'),
    operators: ['after', 'before', 'equals']
  },
  subscriptionState: {
    key: 'subscriptionState',
    label: '구독 ?щ?',
    column: 'subscription_state',
    sourceKey: 'subscriptionStates',
    valueType: 'select',
    defaultValue: subscriptionOptionValues[0].value,
    operators: ['equals', 'notEquals'],
    options: subscriptionOptionValues
  },
  activityState: {
    key: 'activityState',
    label: '활동 ?щ?',
    column: 'activity_state',
    sourceKey: 'activityStates',
    valueType: 'select',
    defaultValue: activityOptionValues[0].value,
    operators: ['equals', 'notEquals'],
    options: activityOptionValues
  }
};

export function createDefaultMessageGroupFilters(referenceDate?: string): MessageGroupFilters {
  const baseDate = referenceDate ? dayjs(referenceDate) : dayjs();

  return {
    country: countryOptionValues[0].value,
    memberTypes: [memberTypeOptionValues[0].value],
    genders: [...allGenderValues],
    ageRange: [...MESSAGE_GROUP_DEFAULT_AGE_RANGE],
    signupMethods: signupMethodOptionValues.slice(0, 2).map((option) => option.value),
    signupDateRange: {
      start: baseDate.subtract(1, 'year').format('YYYY-MM-DD'),
      end: baseDate.format('YYYY-MM-DD')
    },
    subscriptionStates: [subscriptionOptionValues[0].value],
    activityStates: [activityOptionValues[0].value]
  };
}


