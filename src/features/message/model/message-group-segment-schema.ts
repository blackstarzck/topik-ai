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
  { label: '메일', value: 'mail' },
  { label: '푸시', value: 'push' }
];

export const DEFAULT_MESSAGE_GROUP_CHANNELS: MessageChannel[] = channelOptionValues.map(
  (option) => option.value
);

export const messageGroupDefinitionTypeOptions: MessageGroupOption<MessageGroupDefinitionType>[] = [
  { label: '조건 기반 그룹', value: '조건 기반 그룹' },
  { label: '정적 그룹', value: '정적 그룹' }
];

export const DEFAULT_MESSAGE_GROUP_DEFINITION_TYPE: MessageGroupDefinitionType =
  '조건 기반 그룹';

export const messageGroupStatusOptions: MessageGroupOption<MessageGroupStatus>[] = [
  { label: '사용중', value: '사용중' },
  { label: '초안', value: '초안' }
];

export const DEFAULT_MESSAGE_GROUP_STATUS: MessageGroupStatus = '사용중';

export const messageGroupBuilderModeOptions: MessageGroupOption<MessageGroupBuilderMode>[] = [
  { label: '간편 설정', value: 'simple' },
  { label: '상세 설정(Query Builder)', value: 'query-builder' }
];

export const DEFAULT_MESSAGE_GROUP_BUILDER_MODE: MessageGroupBuilderMode = 'simple';

export const countryOptionValues: MessageGroupOption<MessageGroupCountry>[] = [
  { label: '한국 (KR)', value: '한국 (KR)' },
  { label: '미국 (US)', value: '미국 (US)' },
  { label: '베트남 (VN)', value: '베트남 (VN)' }
];

export const memberTypeOptionValues: MessageGroupOption<MessageGroupMemberType>[] = [
  { label: '학생', value: '학생' },
  { label: '강사', value: '강사' },
  { label: '파트너', value: '파트너' }
];

export const genderOptionValues: MessageGroupOption<MessageGroupGender>[] = [
  { label: '남성', value: '남성' },
  { label: '여성', value: '여성' }
];

export const signupMethodOptionValues: MessageGroupOption<MessageGroupSignupMethod>[] = [
  { label: '이메일', value: '이메일' },
  { label: '구글', value: '구글' },
  { label: '페이스북', value: '페이스북' },
  { label: '카카오', value: '카카오' }
];

export const subscriptionOptionValues: MessageGroupOption<MessageGroupSubscriptionState>[] = [
  { label: '구독', value: '구독' },
  { label: '구독해지', value: '구독해지' }
];

export const activityOptionValues: MessageGroupOption<MessageGroupActivityState>[] = [
  { label: '활동', value: '활동' },
  { label: '비활동', value: '비활동' }
];

export const allMemberTypeValues = memberTypeOptionValues.map((option) => option.value);
export const allGenderValues = genderOptionValues.map((option) => option.value);
export const allSignupMethodValues = signupMethodOptionValues.map((option) => option.value);
export const allSubscriptionValues = subscriptionOptionValues.map((option) => option.value);
export const allActivityValues = activityOptionValues.map((option) => option.value);

export const messageGroupQueryOperatorLabels: Record<MessageGroupQueryOperator, string> = {
  equals: '같음',
  notEquals: '같지 않음',
  contains: '포함',
  greaterThanOrEquals: '이상',
  lessThanOrEquals: '이하',
  before: '이전',
  after: '이후'
};

// Local schema SoT for admin segmentation. This can be swapped to API metadata later
// without changing the page composition or query builder logic.
export const messageGroupQueryFieldDefinitions: Record<
  MessageGroupQueryField,
  MessageGroupQueryFieldDefinition
> = {
  country: {
    key: 'country',
    label: '국적',
    column: 'country',
    sourceKey: 'country',
    valueType: 'select',
    defaultValue: countryOptionValues[0].value,
    operators: ['equals', 'notEquals'],
    options: countryOptionValues
  },
  memberType: {
    key: 'memberType',
    label: '회원 유형',
    column: 'member_type',
    sourceKey: 'memberTypes',
    valueType: 'select',
    defaultValue: memberTypeOptionValues[0].value,
    operators: ['equals', 'notEquals'],
    options: memberTypeOptionValues
  },
  gender: {
    key: 'gender',
    label: '성별',
    column: 'gender',
    sourceKey: 'genders',
    valueType: 'select',
    defaultValue: genderOptionValues[0].value,
    operators: ['equals', 'notEquals'],
    options: genderOptionValues
  },
  age: {
    key: 'age',
    label: '연령',
    column: 'age',
    sourceKey: 'ageRange',
    valueType: 'number',
    defaultValue: String(MESSAGE_GROUP_DEFAULT_AGE_RANGE[0]),
    operators: ['greaterThanOrEquals', 'lessThanOrEquals', 'equals']
  },
  signupMethod: {
    key: 'signupMethod',
    label: '가입 방식',
    column: 'signup_method',
    sourceKey: 'signupMethods',
    valueType: 'select',
    defaultValue: signupMethodOptionValues[0].value,
    operators: ['equals', 'notEquals'],
    options: signupMethodOptionValues
  },
  signupDate: {
    key: 'signupDate',
    label: '가입 일자',
    column: 'signup_date',
    sourceKey: 'signupDateRange',
    valueType: 'date',
    defaultValue: dayjs().format('YYYY-MM-DD'),
    operators: ['after', 'before', 'equals']
  },
  subscriptionState: {
    key: 'subscriptionState',
    label: '구독 여부',
    column: 'subscription_state',
    sourceKey: 'subscriptionStates',
    valueType: 'select',
    defaultValue: subscriptionOptionValues[0].value,
    operators: ['equals', 'notEquals'],
    options: subscriptionOptionValues
  },
  activityState: {
    key: 'activityState',
    label: '활동 여부',
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
