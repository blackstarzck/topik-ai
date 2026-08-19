import dayjs from 'dayjs';
import type { Dayjs } from 'dayjs';

import { messageDataSource } from '../api/message-data-source';
import {
  DEFAULT_MESSAGE_GROUP_BUILDER_MODE,
  DEFAULT_MESSAGE_GROUP_CHANNELS,
  DEFAULT_MESSAGE_GROUP_DEFINITION_TYPE,
  DEFAULT_MESSAGE_GROUP_STATUS,
  MESSAGE_GROUP_DEFAULT_AGE_RANGE,
  allActivityValues,
  allGenderValues,
  allMemberTypeValues,
  allSignupMethodValues,
  allSubscriptionValues,
  createDefaultMessageGroupFilters,
  messageGroupDefinitionTypeOptions,
  messageGroupQueryFieldDefinitions,
  messageGroupStatusOptions
} from './message-group-segment-schema';
import type {
  MessageChannel,
  MessageGroupActivityState,
  MessageGroup,
  MessageGroupBuilderMode,
  MessageGroupCountry,
  MessageGroupDefinitionType,
  MessageGroupFilters,
  MessageGroupGender,
  MessageGroupMemberType,
  MessageGroupQueryField,
  MessageGroupQueryGroup,
  MessageGroupQueryOperator,
  MessageGroupQueryRule,
  MessageGroupSignupMethod,
  MessageGroupStatus,
  MessageGroupSubscriptionState
} from './types';
import {
  matchesSearchDateRange,
  matchesSearchField
} from '@/shared/ui/search-bar/search-bar-utils';

// 대상 그룹 페이지 스키마 — Phase 4 분해로 페이지 모듈 상단에서 이동(동작 동일).
// 폼/저장 타입·쿼리 빌더 순수 함수·폼 값 빌더·목록 가시 필터를 담는다.

export type GroupEditorState =
  | { type: 'create' }
  | { type: 'edit'; group: MessageGroup }
  | null;

export type GroupSearchParamKey =
  | 'keyword'
  | 'searchField'
  | 'startDate'
  | 'endDate'
  | 'selected'
  | 'editor';

export type GroupFormValues = {
  name: string;
  description: string;
  definitionType: MessageGroupDefinitionType;
  builderMode: MessageGroupBuilderMode;
  channels: MessageChannel[];
  status: MessageGroupStatus;
  country: MessageGroupCountry;
  memberTypes: MessageGroupMemberType[];
  genders: MessageGroupGender[];
  ageRange: [number, number];
  signupMethods: MessageGroupSignupMethod[];
  signupDateRange?: [Dayjs | null, Dayjs | null];
  subscriptionStates: MessageGroupSubscriptionState[];
  activityStates: MessageGroupActivityState[];
  staticMembersText: string;
  queryBuilderText: string;
  // supabase 모드 전용 — RPC p_reason(사유) 필수.
  reason?: string;
};

export type GroupSavePayload = {
  id?: string;
  name: string;
  description: string;
  definitionType: MessageGroupDefinitionType;
  builderMode: MessageGroupBuilderMode;
  channels: MessageChannel[];
  status: MessageGroupStatus;
  staticMembers: string[];
  filters: MessageGroup['filters'];
  queryBuilderText?: string;
  queryBuilderConfig?: MessageGroupQueryGroup;
  reason?: string;
};

export const isSupabaseSource = messageDataSource === 'supabase';

export const messageGroupDefinitionTypeFilterValues = messageGroupDefinitionTypeOptions.map(
  (option) => option.value
);
export const messageGroupStatusFilterValues = messageGroupStatusOptions.map((option) => option.value);

export type QueryPreviewMode = 'natural-language' | 'sql' | 'json';

export const queryPreviewModeLabels: Record<QueryPreviewMode, string> = {
  'natural-language': '자연어로 변환',
  sql: 'SQL로 변환',
  json: 'JSON으로 변환'
};

let queryBuilderSequence = 0;

export function createQueryBuilderId(prefix: string): string {
  queryBuilderSequence += 1;
  return `${prefix}-${queryBuilderSequence}`;
}

export function createQueryRule(
  partial: Partial<Omit<MessageGroupQueryRule, 'type'>> = {}
): MessageGroupQueryRule {
  const field = partial.field ?? 'country';
  const definition = messageGroupQueryFieldDefinitions[field];
  const operator =
    partial.operator && definition.operators.includes(partial.operator)
      ? partial.operator
      : definition.operators[0];

  return {
    type: 'rule',
    id: partial.id ?? createQueryBuilderId('rule'),
    field,
    operator,
    value: partial.value ?? definition.defaultValue
  };
}

export function createQueryGroup(
  partial: Partial<Omit<MessageGroupQueryGroup, 'type'>> = {}
): MessageGroupQueryGroup {
  return {
    type: 'group',
    id: partial.id ?? createQueryBuilderId('group'),
    combinator: partial.combinator ?? 'and',
    children: partial.children ?? [createQueryRule()]
  };
}

export function cloneQueryBuilderGroup(group: MessageGroupQueryGroup): MessageGroupQueryGroup {
  return JSON.parse(JSON.stringify(group)) as MessageGroupQueryGroup;
}

export function buildSelectionNode<T extends string>(
  field: Extract<
    MessageGroupQueryField,
    'memberType' | 'gender' | 'signupMethod' | 'subscriptionState' | 'activityState'
  >,
  selectedValues: T[],
  allValues: T[]
): MessageGroupQueryGroup | MessageGroupQueryRule | null {
  if (selectedValues.length === 0 || selectedValues.length === allValues.length) {
    return null;
  }

  if (selectedValues.length === 1) {
    return createQueryRule({ field, operator: 'equals', value: selectedValues[0] });
  }

  return createQueryGroup({
    combinator: 'or',
    children: selectedValues.map((value) => createQueryRule({ field, operator: 'equals', value }))
  });
}

export function buildQueryBuilderConfigFromValues(values: GroupFormValues): MessageGroupQueryGroup {
  const children = [
    createQueryRule({ field: 'country', operator: 'equals', value: values.country }),
    buildSelectionNode('memberType', values.memberTypes, allMemberTypeValues),
    buildSelectionNode('gender', values.genders, allGenderValues),
    createQueryRule({
      field: 'age',
      operator: 'greaterThanOrEquals',
      value: String(values.ageRange[0] ?? MESSAGE_GROUP_DEFAULT_AGE_RANGE[0])
    }),
    createQueryRule({
      field: 'age',
      operator: 'lessThanOrEquals',
      value: String(values.ageRange[1] ?? MESSAGE_GROUP_DEFAULT_AGE_RANGE[1])
    }),
    buildSelectionNode('signupMethod', values.signupMethods, allSignupMethodValues),
    values.signupDateRange?.[0]
      ? createQueryRule({
          field: 'signupDate',
          operator: 'after',
          value: values.signupDateRange[0].format('YYYY-MM-DD')
        })
      : null,
    values.signupDateRange?.[1]
      ? createQueryRule({
          field: 'signupDate',
          operator: 'before',
          value: values.signupDateRange[1].format('YYYY-MM-DD')
        })
      : null,
    buildSelectionNode('subscriptionState', values.subscriptionStates, allSubscriptionValues),
    buildSelectionNode('activityState', values.activityStates, allActivityValues)
  ].filter(Boolean) as MessageGroupQueryGroup['children'];

  return createQueryGroup({ combinator: 'and', children: children.length > 0 ? children : [createQueryRule()] });
}

export function visitQueryRules(
  node: MessageGroupQueryGroup,
  visitor: (rule: MessageGroupQueryRule) => void
): void {
  node.children.forEach((child) => {
    if (child.type === 'rule') {
      visitor(child);
      return;
    }

    visitQueryRules(child, visitor);
  });
}

export function replaceCountryRules(
  group: MessageGroupQueryGroup,
  country: MessageGroupCountry
): { nextGroup: MessageGroupQueryGroup; hasCountryRule: boolean } {
  let hasCountryRule = false;

  const nextChildren = group.children.map((child) => {
    if (child.type === 'group') {
      const nested = replaceCountryRules(child, country);
      hasCountryRule = hasCountryRule || nested.hasCountryRule;
      return nested.nextGroup;
    }

    if (child.field === 'country') {
      hasCountryRule = true;
      return {
        ...child,
        operator: 'equals' as const,
        value: country
      };
    }

    return child;
  });

  return {
    nextGroup: { ...group, children: nextChildren },
    hasCountryRule
  };
}

export function syncCountryRule(
  group: MessageGroupQueryGroup,
  country: MessageGroupCountry
): MessageGroupQueryGroup {
  const { nextGroup, hasCountryRule } = replaceCountryRules(group, country);

  if (hasCountryRule) {
    return nextGroup;
  }

  return {
    ...nextGroup,
    children: [
      createQueryRule({ field: 'country', operator: 'equals', value: country }),
      ...nextGroup.children
    ]
  };
}

export function buildFiltersFromQueryBuilder(
  config: MessageGroupQueryGroup,
  country: MessageGroupCountry
): MessageGroupFilters {
  const memberTypeInclude = new Set<MessageGroupMemberType>();
  const memberTypeExclude = new Set<MessageGroupMemberType>();
  const genderInclude = new Set<MessageGroupGender>();
  const genderExclude = new Set<MessageGroupGender>();
  const signupMethodInclude = new Set<MessageGroupSignupMethod>();
  const signupMethodExclude = new Set<MessageGroupSignupMethod>();
  const subscriptionInclude = new Set<MessageGroupSubscriptionState>();
  const subscriptionExclude = new Set<MessageGroupSubscriptionState>();
  const activityInclude = new Set<MessageGroupActivityState>();
  const activityExclude = new Set<MessageGroupActivityState>();
  let nextCountry = country;
  let minAge = MESSAGE_GROUP_DEFAULT_AGE_RANGE[0];
  let maxAge = MESSAGE_GROUP_DEFAULT_AGE_RANGE[1];
  let signupStart: string | undefined;
  let signupEnd: string | undefined;

  visitQueryRules(config, (rule) => {
    switch (rule.field) {
      case 'country':
        if (rule.operator === 'equals') {
          nextCountry = rule.value as MessageGroupCountry;
        }
        break;
      case 'memberType':
        if (rule.operator === 'equals') {
          memberTypeInclude.add(rule.value as MessageGroupMemberType);
        }
        if (rule.operator === 'notEquals') {
          memberTypeExclude.add(rule.value as MessageGroupMemberType);
        }
        break;
      case 'gender':
        if (rule.operator === 'equals') {
          genderInclude.add(rule.value as MessageGroupGender);
        }
        if (rule.operator === 'notEquals') {
          genderExclude.add(rule.value as MessageGroupGender);
        }
        break;
      case 'signupMethod':
        if (rule.operator === 'equals') {
          signupMethodInclude.add(rule.value as MessageGroupSignupMethod);
        }
        if (rule.operator === 'notEquals') {
          signupMethodExclude.add(rule.value as MessageGroupSignupMethod);
        }
        break;
      case 'subscriptionState':
        if (rule.operator === 'equals') {
          subscriptionInclude.add(rule.value as MessageGroupSubscriptionState);
        }
        if (rule.operator === 'notEquals') {
          subscriptionExclude.add(rule.value as MessageGroupSubscriptionState);
        }
        break;
      case 'activityState':
        if (rule.operator === 'equals') {
          activityInclude.add(rule.value as MessageGroupActivityState);
        }
        if (rule.operator === 'notEquals') {
          activityExclude.add(rule.value as MessageGroupActivityState);
        }
        break;
      case 'age': {
        const numericValue = Number(rule.value);
        if (Number.isNaN(numericValue)) {
          return;
        }
        if (rule.operator === 'greaterThanOrEquals') {
          minAge = Math.max(minAge, numericValue);
        }
        if (rule.operator === 'lessThanOrEquals') {
          maxAge = Math.min(maxAge, numericValue);
        }
        if (rule.operator === 'equals') {
          minAge = numericValue;
          maxAge = numericValue;
        }
        break;
      }
      case 'signupDate':
        if (rule.operator === 'after') {
          signupStart = rule.value;
        }
        if (rule.operator === 'before') {
          signupEnd = rule.value;
        }
        if (rule.operator === 'equals') {
          signupStart = rule.value;
          signupEnd = rule.value;
        }
        break;
      default:
        break;
    }
  });

  const memberTypes =
    memberTypeInclude.size > 0
      ? Array.from(memberTypeInclude)
      : allMemberTypeValues.filter((value) => !memberTypeExclude.has(value));
  const genders =
    genderInclude.size > 0
      ? Array.from(genderInclude)
      : allGenderValues.filter((value) => !genderExclude.has(value));
  const signupMethods =
    signupMethodInclude.size > 0
      ? Array.from(signupMethodInclude)
      : allSignupMethodValues.filter((value) => !signupMethodExclude.has(value));
  const subscriptionStates =
    subscriptionInclude.size > 0
      ? Array.from(subscriptionInclude)
      : allSubscriptionValues.filter((value) => !subscriptionExclude.has(value));
  const activityStates =
    activityInclude.size > 0
      ? Array.from(activityInclude)
      : allActivityValues.filter((value) => !activityExclude.has(value));

  return {
    country: nextCountry,
    memberTypes: memberTypes.length > 0 ? memberTypes : allMemberTypeValues,
    genders: genders.length > 0 ? genders : allGenderValues,
    ageRange: [Math.min(minAge, maxAge), Math.max(minAge, maxAge)],
    signupMethods: signupMethods.length > 0 ? signupMethods : allSignupMethodValues,
    signupDateRange: signupStart || signupEnd ? { start: signupStart, end: signupEnd } : undefined,
    subscriptionStates:
      subscriptionStates.length > 0 ? subscriptionStates : allSubscriptionValues,
    activityStates: activityStates.length > 0 ? activityStates : allActivityValues
  };
}

export function formatRuleNaturalLanguage(rule: MessageGroupQueryRule): string {
  const fieldDefinition = messageGroupQueryFieldDefinitions[rule.field];
  const operatorPhrase: Record<MessageGroupQueryOperator, string> = {
    equals: '이',
    notEquals: '이 아니고',
    contains: '에',
    greaterThanOrEquals: '이',
    lessThanOrEquals: '이',
    before: '가',
    after: '가'
  };

  switch (rule.operator) {
    case 'equals':
      return `${fieldDefinition.label}이 ${rule.value}`;
    case 'notEquals':
      return `${fieldDefinition.label}이 ${rule.value}이 아님`;
    case 'contains':
      return `${fieldDefinition.label}에 ${rule.value} 포함`;
    case 'greaterThanOrEquals':
      return `${fieldDefinition.label}이 ${rule.value}${rule.field === 'age' ? '세' : ''} 이상`;
    case 'lessThanOrEquals':
      return `${fieldDefinition.label}이 ${rule.value}${rule.field === 'age' ? '세' : ''} 이하`;
    case 'before':
      return `${fieldDefinition.label}가 ${rule.value} 이전`;
    case 'after':
      return `${fieldDefinition.label}가 ${rule.value} 이후`;
    default:
      return `${fieldDefinition.label} ${operatorPhrase[rule.operator]} ${rule.value}`;
  }
}

export function buildNaturalLanguagePreview(node: MessageGroupQueryGroup): string {
  if (node.children.length === 0) {
    return '조건이 없습니다.';
  }

  const glue = node.combinator === 'and' ? ' 그리고 ' : ' 또는 ';
  return node.children
    .map((child) =>
      child.type === 'rule' ? formatRuleNaturalLanguage(child) : `(${buildNaturalLanguagePreview(child)})`
    )
    .join(glue);
}

export function formatSqlValue(rule: MessageGroupQueryRule): string {
  const fieldDefinition = messageGroupQueryFieldDefinitions[rule.field];
  if (fieldDefinition.valueType === 'number') {
    return rule.value;
  }

  return `'${rule.value.replaceAll("'", "''")}'`;
}

export function buildSqlPreview(node: MessageGroupQueryGroup): string {
  if (node.children.length === 0) {
    return '';
  }

  const glue = node.combinator === 'and' ? ' AND ' : ' OR ';
  return node.children
    .map((child) => {
      if (child.type === 'group') {
        return `(${buildSqlPreview(child)})`;
      }

      const fieldDefinition = messageGroupQueryFieldDefinitions[child.field];
      const operatorMap: Record<MessageGroupQueryOperator, string> = {
        equals: '=',
        notEquals: '!=',
        contains: 'LIKE',
        greaterThanOrEquals: '>=',
        lessThanOrEquals: '<=',
        before: '<',
        after: '>'
      };
      const value =
        child.operator === 'contains'
          ? `'%${child.value.replaceAll("'", "''")}%'`
          : formatSqlValue(child);

      return `${fieldDefinition.column} ${operatorMap[child.operator]} ${value}`;
    })
    .join(glue);
}

export function validateQueryBuilder(group: MessageGroupQueryGroup): string | null {
  if (group.children.length === 0) {
    return '하나 이상의 조건을 추가하세요.';
  }

  for (const child of group.children) {
    if (child.type === 'group') {
      const error = validateQueryBuilder(child);
      if (error) {
        return error;
      }
      continue;
    }

    if (child.value.trim().length === 0) {
      return `${messageGroupQueryFieldDefinitions[child.field].label} 조건 값을 입력하세요.`;
    }
  }

  return null;
}

export function buildDefaultFormValues(): GroupFormValues {
  const defaultFilters = createDefaultMessageGroupFilters('2026-03-10');

  return {
    name: '',
    description: '',
    definitionType: DEFAULT_MESSAGE_GROUP_DEFINITION_TYPE,
    builderMode: DEFAULT_MESSAGE_GROUP_BUILDER_MODE,
    channels: [...DEFAULT_MESSAGE_GROUP_CHANNELS],
    status: DEFAULT_MESSAGE_GROUP_STATUS,
    country: defaultFilters.country,
    memberTypes: defaultFilters.memberTypes,
    genders: defaultFilters.genders,
    ageRange: defaultFilters.ageRange,
    signupMethods: defaultFilters.signupMethods,
    signupDateRange:
      defaultFilters.signupDateRange?.start && defaultFilters.signupDateRange?.end
        ? [
            dayjs(defaultFilters.signupDateRange.start),
            dayjs(defaultFilters.signupDateRange.end)
          ]
        : undefined,
    subscriptionStates: defaultFilters.subscriptionStates,
    activityStates: defaultFilters.activityStates,
    staticMembersText: '',
    queryBuilderText: '',
    reason: ''
  };
}

export function toFormValues(group: MessageGroup): GroupFormValues {
  return {
    name: group.name,
    description: group.description,
    definitionType: group.definitionType,
    builderMode: group.builderMode,
    channels: group.channels,
    status: group.status,
    country: group.filters.country,
    memberTypes: group.filters.memberTypes,
    genders: group.filters.genders,
    ageRange: group.filters.ageRange,
    signupMethods: group.filters.signupMethods,
    signupDateRange: group.filters.signupDateRange?.start && group.filters.signupDateRange?.end
      ? [dayjs(group.filters.signupDateRange.start), dayjs(group.filters.signupDateRange.end)]
      : undefined,
    subscriptionStates: group.filters.subscriptionStates,
    activityStates: group.filters.activityStates,
    staticMembersText: group.staticMembers.join('\n'),
    queryBuilderText: group.queryBuilderText ?? '',
    reason: ''
  };
}

export function buildPayload(
  values: GroupFormValues,
  editorState: GroupEditorState,
  queryBuilderConfig: MessageGroupQueryGroup
): GroupSavePayload {
  const simpleFilters: MessageGroupFilters = {
    country: values.country,
    memberTypes: values.memberTypes,
    genders: values.genders,
    ageRange: values.ageRange,
    signupMethods: values.signupMethods,
    signupDateRange:
      values.signupDateRange && values.signupDateRange[0] && values.signupDateRange[1]
        ? {
            start: values.signupDateRange[0].format('YYYY-MM-DD'),
            end: values.signupDateRange[1].format('YYYY-MM-DD')
          }
        : undefined,
    subscriptionStates: values.subscriptionStates,
    activityStates: values.activityStates
  };
  const resolvedQueryBuilderConfig =
    values.definitionType === '조건 기반 그룹' && values.builderMode === 'query-builder'
      ? cloneQueryBuilderGroup(queryBuilderConfig)
      : undefined;

  return {
    id: editorState?.type === 'edit' ? editorState.group.id : undefined,
    name: values.name.trim(),
    description: values.description.trim(),
    definitionType: values.definitionType,
    builderMode: values.definitionType === '정적 그룹' ? 'simple' : values.builderMode,
    channels: values.channels,
    status: values.status,
    staticMembers:
      values.definitionType === '정적 그룹'
        ? values.staticMembersText
            .split(/\r?\n/)
            .map((member) => member.trim())
            .filter(Boolean)
        : [],
    filters:
      values.definitionType === '조건 기반 그룹' && resolvedQueryBuilderConfig
        ? buildFiltersFromQueryBuilder(resolvedQueryBuilderConfig, values.country)
        : simpleFilters,
    queryBuilderText:
      resolvedQueryBuilderConfig ? buildSqlPreview(resolvedQueryBuilderConfig) : undefined,
    queryBuilderConfig: resolvedQueryBuilderConfig,
    reason: values.reason
  };
}

// 목록 가시 필터 — 페이지 useMemo 본문을 함수화(Phase 4 분해, 동작 동일).
export function filterMessageGroups(
  sourceGroups: MessageGroup[],
  keyword: string,
  searchField: string,
  startDate: string,
  endDate: string
): MessageGroup[] {
  const normalizedKeyword = keyword.trim().toLowerCase();

  return sourceGroups.filter((group) => {
    if (!matchesSearchDateRange(group.lastCalculatedAt, startDate, endDate)) {
      return false;
    }

    if (!normalizedKeyword) {
      return true;
    }

    return matchesSearchField(normalizedKeyword, searchField, {
      name: group.name,
      description: group.description,
      ruleSummary: group.ruleSummary
    });
  });
}

