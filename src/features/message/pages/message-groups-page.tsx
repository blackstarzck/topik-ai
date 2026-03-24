import {
  Alert,
  Button,
  Card,
  Checkbox,
  DatePicker,
  Descriptions,
  Divider,
  Drawer,
  Form,
  Input,
  InputNumber,
  Radio,
  Select,
  Slider,
  Spin,
  Space,
  Tooltip,
  Typography,
  notification
} from 'antd';
import type { TableColumnsType } from 'antd';
import { DeleteOutlined, MinusCircleFilled, PlusOutlined, ReloadOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import type { Dayjs } from 'dayjs';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';

import { fetchGroupsSafe } from '../api/messages-service';
import { useMessageStore } from '../model/message-store';
import {
  DEFAULT_MESSAGE_GROUP_BUILDER_MODE,
  DEFAULT_MESSAGE_GROUP_CHANNELS,
  DEFAULT_MESSAGE_GROUP_DEFINITION_TYPE,
  DEFAULT_MESSAGE_GROUP_STATUS,
  MESSAGE_GROUP_DEFAULT_AGE_RANGE,
  activityOptionValues,
  allActivityValues,
  allGenderValues,
  allMemberTypeValues,
  allSignupMethodValues,
  allSubscriptionValues,
  channelOptionValues,
  countryOptionValues,
  createDefaultMessageGroupFilters,
  genderOptionValues,
  memberTypeOptionValues,
  messageGroupBuilderModeOptions,
  messageGroupDefinitionTypeOptions,
  messageGroupQueryFieldDefinitions,
  messageGroupQueryOperatorLabels,
  messageGroupStatusOptions,
  signupMethodOptionValues,
  subscriptionOptionValues
} from '../model/message-group-segment-schema';
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
  MessageGroupQueryCombinator,
  MessageGroupQueryField,
  MessageGroupQueryGroup,
  MessageGroupQueryOperator,
  MessageGroupQueryRule,
  MessageGroupSignupMethod,
  MessageGroupStatus,
  MessageGroupSubscriptionState
} from '../model/types';
import type { AsyncState } from '../../../shared/model/async-state';
import { getTargetTypeLabel } from '../../../shared/model/target-type-label';
import { AuditLogLink } from '../../../shared/ui/audit-log-link/audit-log-link';
import { ConfirmAction } from '../../../shared/ui/confirm-action/confirm-action';
import { PageTitle } from '../../../shared/ui/page-title/page-title';
import {
  SearchBar,
  SearchBarDateRange,
  SearchBarDetailField
} from '../../../shared/ui/search-bar/search-bar';
import { useSearchBarDateDraft } from '../../../shared/ui/search-bar/use-search-bar-date-draft';
import {
  matchesSearchDateRange,
  matchesSearchField,
  parseSearchDate
} from '../../../shared/ui/search-bar/search-bar-utils';
import { StatusBadge } from '../../../shared/ui/status-badge/status-badge';
import { AdminDataTable } from '../../../shared/ui/table/admin-data-table';
import { createStatusColumnTitle } from '../../../shared/ui/table/status-column-title';
import {
  createDefinedColumnFilterProps,
  createNumberSorter,
  createTextSorter
} from '../../../shared/ui/table/table-column-utils';

const { Paragraph, Text } = Typography;
const { RangePicker } = DatePicker;

type GroupEditorState =
  | { type: 'create' }
  | { type: 'edit'; group: MessageGroup }
  | null;

type GroupSearchParamKey =
  | 'keyword'
  | 'searchField'
  | 'startDate'
  | 'endDate'
  | 'selected'
  | 'editor';

type GroupFormValues = {
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
};

type GroupSavePayload = {
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
};

const messageGroupDefinitionTypeFilterValues = messageGroupDefinitionTypeOptions.map(
  (option) => option.value
);
const messageGroupStatusFilterValues = messageGroupStatusOptions.map((option) => option.value);

type QueryPreviewMode = 'natural-language' | 'sql' | 'json';

type MultiCheckboxGroupProps<T extends string> = {
  value?: T[];
  options: { label: string; value: T }[];
  onChange: (next: T[]) => void;
};

type QueryBuilderRuleRowProps = {
  rule: MessageGroupQueryRule;
  canRemove: boolean;
  onChange: (next: MessageGroupQueryRule) => void;
  onRemove: () => void;
  onInteract: () => void;
};

type QueryBuilderGroupEditorProps = {
  group: MessageGroupQueryGroup;
  isRoot?: boolean;
  onChange: (next: MessageGroupQueryGroup) => void;
  onInteract: () => void;
  onRemove?: () => void;
};

const queryPreviewModeLabels: Record<QueryPreviewMode, string> = {
  'natural-language': '자연어로 변환',
  sql: 'SQL로 변환',
  json: 'JSON으로 변환'
};

let queryBuilderSequence = 0;

function createQueryBuilderId(prefix: string): string {
  queryBuilderSequence += 1;
  return `${prefix}-${queryBuilderSequence}`;
}

function createQueryRule(
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

function createQueryGroup(
  partial: Partial<Omit<MessageGroupQueryGroup, 'type'>> = {}
): MessageGroupQueryGroup {
  return {
    type: 'group',
    id: partial.id ?? createQueryBuilderId('group'),
    combinator: partial.combinator ?? 'and',
    children: partial.children ?? [createQueryRule()]
  };
}

function cloneQueryBuilderGroup(group: MessageGroupQueryGroup): MessageGroupQueryGroup {
  return JSON.parse(JSON.stringify(group)) as MessageGroupQueryGroup;
}

function buildSelectionNode<T extends string>(
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

function buildQueryBuilderConfigFromValues(values: GroupFormValues): MessageGroupQueryGroup {
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

function visitQueryRules(
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

function replaceCountryRules(
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
        operator: 'equals',
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

function syncCountryRule(
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

function buildFiltersFromQueryBuilder(
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

function formatRuleNaturalLanguage(rule: MessageGroupQueryRule): string {
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

function buildNaturalLanguagePreview(node: MessageGroupQueryGroup): string {
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

function formatSqlValue(rule: MessageGroupQueryRule): string {
  const fieldDefinition = messageGroupQueryFieldDefinitions[rule.field];
  if (fieldDefinition.valueType === 'number') {
    return rule.value;
  }

  return `'${rule.value.replaceAll("'", "''")}'`;
}

function buildSqlPreview(node: MessageGroupQueryGroup): string {
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

function validateQueryBuilder(group: MessageGroupQueryGroup): string | null {
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

function MultiCheckboxGroup<T extends string>({
  value,
  options,
  onChange
}: MultiCheckboxGroupProps<T>): JSX.Element {
  const selectedValues = value ?? [];
  const allValues = options.map((option) => option.value);
  const isAllChecked = selectedValues.length === allValues.length;
  const isIndeterminate = selectedValues.length > 0 && !isAllChecked;

  return (
    <Space wrap size={[18, 12]}>
      <Checkbox
        checked={isAllChecked}
        indeterminate={isIndeterminate}
        onChange={(event) => onChange(event.target.checked ? allValues : [])}
      >
        전체
      </Checkbox>
      <Checkbox.Group
        options={options}
        value={selectedValues}
        onChange={(nextValues) => onChange(nextValues as T[])}
      />
    </Space>
  );
}

function QueryBuilderRuleRow({
  rule,
  canRemove,
  onChange,
  onRemove,
  onInteract
}: QueryBuilderRuleRowProps): JSX.Element {
  const fieldDefinition = messageGroupQueryFieldDefinitions[rule.field];
  const operatorOptions = fieldDefinition.operators.map((operator) => ({
    label: messageGroupQueryOperatorLabels[operator],
    value: operator
  }));

  return (
    <div className="message-groups-query-rule">
      <Select
        value={rule.field}
        style={{ minWidth: 136 }}
        options={Object.entries(messageGroupQueryFieldDefinitions).map(([value, definition]) => ({
          label: definition.label,
          value
        }))}
        onChange={(nextField) => {
          onInteract();
          const nextDefinition = messageGroupQueryFieldDefinitions[nextField as MessageGroupQueryField];
          onChange(
            createQueryRule({
              id: rule.id,
              field: nextField as MessageGroupQueryField,
              operator: nextDefinition.operators[0],
              value: nextDefinition.defaultValue
            })
          );
        }}
      />
      <Select
        value={rule.operator}
        style={{ minWidth: 120 }}
        options={operatorOptions}
        onChange={(nextOperator) => {
          onInteract();
          onChange({
            ...rule,
            operator: nextOperator as MessageGroupQueryOperator
          });
        }}
      />
      {fieldDefinition.valueType === 'select' ? (
        <Select
          value={rule.value}
          style={{ flex: 1, minWidth: 180 }}
          options={fieldDefinition.options}
          onChange={(nextValue) => {
            onInteract();
            onChange({
              ...rule,
              value: nextValue
            });
          }}
        />
      ) : null}
      {fieldDefinition.valueType === 'number' ? (
        <InputNumber
          value={Number(rule.value)}
          min={0}
          max={100}
          style={{ flex: 1, minWidth: 180 }}
          onChange={(nextValue) => {
            onInteract();
            onChange({
              ...rule,
              value: String(nextValue ?? '')
            });
          }}
        />
      ) : null}
      {fieldDefinition.valueType === 'date' ? (
        <DatePicker
          value={rule.value ? dayjs(rule.value) : undefined}
          style={{ flex: 1, minWidth: 180 }}
          onChange={(nextValue) => {
            onInteract();
            onChange({
              ...rule,
              value: nextValue ? nextValue.format('YYYY-MM-DD') : ''
            });
          }}
        />
      ) : null}
      <Button
        danger
        type="text"
        icon={<MinusCircleFilled />}
        disabled={!canRemove}
        onClick={() => {
          onInteract();
          onRemove();
        }}
      />
    </div>
  );
}

function QueryBuilderGroupEditor({
  group,
  isRoot = false,
  onChange,
  onInteract,
  onRemove
}: QueryBuilderGroupEditorProps): JSX.Element {
  return (
    <div className={`message-groups-query-group${isRoot ? ' message-groups-query-group--root' : ''}`}>
      <div className="message-groups-query-group-toolbar">
        <Space wrap>
          <Text type="secondary">Combinator</Text>
          <Select
            size="small"
            value={group.combinator}
            style={{ minWidth: 120 }}
            options={[
              { label: 'And', value: 'and' },
              { label: 'Or', value: 'or' }
            ]}
            onChange={(nextCombinator) => {
              onInteract();
              onChange({
                ...group,
                combinator: nextCombinator as MessageGroupQueryCombinator
              });
            }}
          />
        </Space>
        <Space wrap>
          <Button
            size="small"
            icon={<PlusOutlined />}
            onClick={() => {
              onInteract();
              onChange({
                ...group,
                children: [...group.children, createQueryRule()]
              });
            }}
          >
            조건 추가
          </Button>
          <Button
            size="small"
            icon={<PlusOutlined />}
            onClick={() => {
              onInteract();
              onChange({
                ...group,
                children: [...group.children, createQueryGroup()]
              });
            }}
          >
            그룹 추가
          </Button>
          {!isRoot && onRemove ? (
            <Button danger size="small" type="text" onClick={onRemove}>
              그룹 삭제
            </Button>
          ) : null}
        </Space>
      </div>
      <div className="message-groups-query-group-children">
        {group.children.map((child) =>
          child.type === 'rule' ? (
            <QueryBuilderRuleRow
              key={child.id}
              rule={child}
              canRemove={group.children.length > 1 || !isRoot}
              onInteract={onInteract}
              onChange={(nextRule) => {
                onChange({
                  ...group,
                  children: group.children.map((item) => (item.id === child.id ? nextRule : item))
                });
              }}
              onRemove={() => {
                onChange({
                  ...group,
                  children: group.children.filter((item) => item.id !== child.id)
                });
              }}
            />
          ) : (
            <QueryBuilderGroupEditor
              key={child.id}
              group={child}
              onInteract={onInteract}
              onChange={(nextGroup) => {
                onChange({
                  ...group,
                  children: group.children.map((item) => (item.id === child.id ? nextGroup : item))
                });
              }}
              onRemove={() => {
                onChange({
                  ...group,
                  children: group.children.filter((item) => item.id !== child.id)
                });
              }}
            />
          )
        )}
      </div>
    </div>
  );
}

function buildDefaultFormValues(): GroupFormValues {
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
    queryBuilderText: ''
  };
}

function toFormValues(group: MessageGroup): GroupFormValues {
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
    queryBuilderText: group.queryBuilderText ?? ''
  };
}

function buildPayload(
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
    queryBuilderConfig: resolvedQueryBuilderConfig
  };
}

export default function MessageGroupsPage(): JSX.Element {
  const [searchParams, setSearchParams] = useSearchParams();
  const searchField = searchParams.get('searchField') ?? 'all';
  const startDate = parseSearchDate(searchParams.get('startDate'));
  const endDate = parseSearchDate(searchParams.get('endDate'));
  const keyword = searchParams.get('keyword') ?? '';
  const selectedGroupId = searchParams.get('selected') ?? '';
  const editorParam = searchParams.get('editor') ?? '';
  const {
    draftStartDate,
    draftEndDate,
    handleDraftDateChange,
    handleDraftReset,
    handleDetailOpenChange
  } = useSearchBarDateDraft(startDate, endDate);

  const groups = useMessageStore((state) => state.groups);
  const previewGroupCount = useMessageStore((state) => state.previewGroupCount);
  const saveGroup = useMessageStore((state) => state.saveGroup);
  const recalculateGroup = useMessageStore((state) => state.recalculateGroup);
  const deleteGroup = useMessageStore((state) => state.deleteGroup);

  const [loadState, setLoadState] = useState<AsyncState<null>>({
    status: 'pending',
    data: null,
    errorMessage: null,
    errorCode: null
  });
  const [reloadKey, setReloadKey] = useState(0);
  const [editorState, setEditorState] = useState<GroupEditorState>(null);
  const [deleteTarget, setDeleteTarget] = useState<MessageGroup | null>(null);
  const [previewCount, setPreviewCount] = useState<number | null>(null);
  const [recalculatingGroupId, setRecalculatingGroupId] = useState<string | null>(null);
  const [lastSuccessfulGroups, setLastSuccessfulGroups] = useState<MessageGroup[]>([]);
  const [queryPreviewMode, setQueryPreviewMode] = useState<QueryPreviewMode>('natural-language');
  const [queryBuilderConfig, setQueryBuilderConfig] = useState<MessageGroupQueryGroup>(() =>
    buildQueryBuilderConfigFromValues(buildDefaultFormValues())
  );
  const [queryBuilderTouched, setQueryBuilderTouched] = useState(false);
  const [notificationApi, notificationContextHolder] = notification.useNotification();
  const [form] = Form.useForm<GroupFormValues>();

  const definitionType = Form.useWatch('definitionType', form);
  const builderMode = Form.useWatch('builderMode', form);
  const country = Form.useWatch('country', form);
  const ageRange = Form.useWatch('ageRange', form);

  const queryPreviewText = useMemo(
    () => ({
      'natural-language': buildNaturalLanguagePreview(queryBuilderConfig),
      sql: buildSqlPreview(queryBuilderConfig),
      json: JSON.stringify(queryBuilderConfig, null, 2)
    }),
    [queryBuilderConfig]
  );

  useEffect(() => {
    if (definitionType !== '조건 기반 그룹' || builderMode !== 'query-builder') {
      form.setFieldValue('queryBuilderText', '');
      return;
    }

    form.setFieldValue('queryBuilderText', queryPreviewText.sql);
  }, [builderMode, definitionType, form, queryPreviewText.sql]);

  useEffect(() => {
    if (editorState?.type !== 'create') {
      return;
    }

    if (definitionType !== '조건 기반 그룹' || builderMode !== 'query-builder' || queryBuilderTouched) {
      return;
    }

    const currentValues = form.getFieldsValue(true) as GroupFormValues;
    setQueryBuilderConfig(buildQueryBuilderConfigFromValues(currentValues));
  }, [builderMode, definitionType, editorState, form, queryBuilderTouched]);

  useEffect(() => {
    if (definitionType !== '조건 기반 그룹' || builderMode !== 'query-builder' || !country) {
      return;
    }

    setQueryBuilderConfig((current) => syncCountryRule(current, country));
  }, [builderMode, country, definitionType]);

  useEffect(() => {
    const controller = new AbortController();
    setLoadState({
      status: 'pending',
      data: null,
      errorMessage: null,
      errorCode: null
    });

    void fetchGroupsSafe(controller.signal).then((result) => {
      if (controller.signal.aborted) {
        return;
      }

      if (result.ok) {
        setLastSuccessfulGroups(result.data);
        setLoadState({
          status: result.data.length === 0 ? 'empty' : 'success',
          data: null,
          errorMessage: null,
          errorCode: null
        });
        return;
      }

      setLoadState({
        status: 'error',
        data: null,
        errorMessage: result.error.message,
        errorCode: result.error.code
      });
    });

    return () => {
      controller.abort();
    };
  }, [reloadKey]);

  useEffect(() => {
    if (loadState.status === 'success' || loadState.status === 'empty') {
      setLastSuccessfulGroups(groups);
    }
  }, [groups, loadState.status]);

  const isUsingLastSuccessfulGroups =
    (loadState.status === 'pending' || loadState.status === 'error') &&
    lastSuccessfulGroups.length > 0;
  const sourceGroups = isUsingLastSuccessfulGroups ? lastSuccessfulGroups : groups;

  const visibleGroups = useMemo(() => {
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
  }, [endDate, keyword, searchField, sourceGroups, startDate]);

  const syncSearchParams = useCallback(
    (
      next: Partial<Record<GroupSearchParamKey, string | null>>,
      options?: { replace?: boolean }
    ) => {
      const merged = new URLSearchParams(searchParams);
      merged.delete('definition');

      Object.entries(next).forEach(([key, value]) => {
        if (!value || value === 'all') {
          merged.delete(key);
          return;
        }
        merged.set(key, value);
      });

      setSearchParams(merged, { replace: options?.replace ?? true });
    },
    [searchParams, setSearchParams]
  );

  const handleApplyDateRange = useCallback(() => {
    syncSearchParams({
      startDate: draftStartDate,
      endDate: draftEndDate,
      keyword,
      searchField
    });
  }, [draftEndDate, draftStartDate, keyword, searchField, syncSearchParams]);

  const applyCreateDrawerState = useCallback(() => {
    const defaultValues = buildDefaultFormValues();
    form.setFieldsValue(defaultValues);
    setPreviewCount(null);
    setQueryPreviewMode('natural-language');
    setQueryBuilderTouched(false);
    setQueryBuilderConfig(buildQueryBuilderConfigFromValues(defaultValues));
    setEditorState({ type: 'create' });
  }, [form]);

  const applyEditDrawerState = useCallback(
    (group: MessageGroup) => {
      form.setFieldsValue(toFormValues(group));
      setPreviewCount(group.memberCount);
      setQueryPreviewMode('sql');
      setQueryBuilderTouched(group.builderMode === 'query-builder');
      setQueryBuilderConfig(
        group.queryBuilderConfig
          ? cloneQueryBuilderGroup(group.queryBuilderConfig)
          : buildQueryBuilderConfigFromValues(toFormValues(group))
      );
      setEditorState({ type: 'edit', group });
    },
    [form]
  );

  const resetDrawerState = useCallback(() => {
    setEditorState(null);
    setPreviewCount(null);
    setQueryBuilderTouched(false);
  }, []);

  const openCreateDrawer = useCallback(() => {
    syncSearchParams({ editor: 'create', selected: null });
  }, [syncSearchParams]);

  const openEditDrawer = useCallback(
    (group: MessageGroup) => {
      syncSearchParams({ selected: group.id, editor: null });
    },
    [syncSearchParams]
  );

  const closeDrawer = useCallback(() => {
    syncSearchParams({ selected: null, editor: null });
  }, [syncSearchParams]);

  useEffect(() => {
    if (editorParam === 'create') {
      if (editorState?.type !== 'create') {
        applyCreateDrawerState();
      }
      return;
    }

    if (selectedGroupId) {
      const selectedGroup = sourceGroups.find((group) => group.id === selectedGroupId);
      if (!selectedGroup) {
        if (loadState.status === 'pending') {
          return;
        }

        resetDrawerState();
        syncSearchParams({ selected: null, editor: null });
        return;
      }

      if (editorState?.type === 'edit' && editorState.group.id === selectedGroupId) {
        return;
      }

      applyEditDrawerState(selectedGroup);
      return;
    }

    if (editorState) {
      resetDrawerState();
    }
  }, [
    applyCreateDrawerState,
    applyEditDrawerState,
    editorParam,
    editorState,
    loadState.status,
    resetDrawerState,
    selectedGroupId,
    sourceGroups,
    syncSearchParams
  ]);

  const handlePreviewCount = useCallback(async () => {
    const fieldsToValidate =
      definitionType === '정적 그룹'
        ? ['definitionType', 'channels', 'staticMembersText']
        : builderMode === 'query-builder'
          ? ['definitionType', 'builderMode', 'channels', 'country']
          : [
              'definitionType',
              'builderMode',
              'channels',
              'country',
              'memberTypes',
              'genders',
              'ageRange',
              'signupMethods',
              'signupDateRange',
              'subscriptionStates',
              'activityStates'
            ];
    const values = await form.validateFields(fieldsToValidate);

    if (definitionType === '조건 기반 그룹' && builderMode === 'query-builder') {
      const errorMessage = validateQueryBuilder(queryBuilderConfig);
      if (errorMessage) {
        notificationApi.error({
          message: '상세 조건을 확인하세요.',
          description: errorMessage
        });
        return;
      }
    }

    const count = previewGroupCount(buildPayload(values, editorState, queryBuilderConfig));
    setPreviewCount(count);
  }, [
    builderMode,
    definitionType,
    editorState,
    form,
    notificationApi,
    previewGroupCount,
    queryBuilderConfig
  ]);

  const handleSaveGroup = useCallback(async () => {
    if (definitionType === '조건 기반 그룹' && builderMode === 'query-builder') {
      const errorMessage = validateQueryBuilder(queryBuilderConfig);
      if (errorMessage) {
        notificationApi.error({
          message: '상세 조건을 확인하세요.',
          description: errorMessage
        });
        return;
      }
    }

    const values = await form.validateFields();
    const saved = saveGroup(buildPayload(values, editorState, queryBuilderConfig));

    notificationApi.success({
      message: `대상 그룹 ${editorState?.type === 'edit' ? '수정' : '생성'} 완료`,
      description: (
        <Space direction="vertical">
          <Text>대상 유형: {getTargetTypeLabel('Message')}</Text>
          <Text>대상 ID: {saved.id}</Text>
          <Text>예상 대상 수: {saved.memberCount.toLocaleString()}명</Text>
          <AuditLogLink targetType="Message" targetId={saved.id} />
        </Space>
      )
    });
    closeDrawer();
  }, [
    builderMode,
    closeDrawer,
    definitionType,
    editorState,
    form,
    notificationApi,
    queryBuilderConfig,
    saveGroup
  ]);

  const handleRecalculate = useCallback(
    async (group: MessageGroup) => {
      if (recalculatingGroupId) {
        return;
      }

      setRecalculatingGroupId(group.id);

      try {
        await new Promise((resolve) => window.setTimeout(resolve, 420));
        const refreshed = recalculateGroup(group.id);
        if (!refreshed) {
          return;
        }

        setEditorState((current) =>
          current?.type === 'edit' && current.group.id === refreshed.id
            ? { type: 'edit', group: refreshed }
            : current
        );
        setPreviewCount((current) =>
          editorState?.type === 'edit' && editorState.group.id === refreshed.id
            ? refreshed.memberCount
            : current
        );

        notificationApi.success({
          message: '대상 그룹 예상 수 재계산 완료',
          description: (
            <Space direction="vertical">
              <Text>대상 유형: {getTargetTypeLabel('Message')}</Text>
              <Text>대상 ID: {refreshed.id}</Text>
              <Text>예상 대상 수: {refreshed.memberCount.toLocaleString()}명</Text>
              <AuditLogLink targetType="Message" targetId={refreshed.id} />
            </Space>
          )
        });
      } finally {
        setRecalculatingGroupId(null);
      }
    },
    [editorState, notificationApi, recalculateGroup, recalculatingGroupId]
  );

  const handleDeleteGroup = useCallback(
    async (reason: string) => {
      if (!deleteTarget) {
        return;
      }

      const deleted = deleteGroup(deleteTarget.id);
      if (!deleted) {
        return;
      }

      notificationApi.success({
        message: '대상 그룹 삭제 완료',
        description: (
          <Space direction="vertical">
            <Text>대상 유형: {getTargetTypeLabel('Message')}</Text>
            <Text>대상 ID: {deleted.id}</Text>
            <Text>사유/근거: {reason}</Text>
            <AuditLogLink targetType="Message" targetId={deleted.id} />
          </Space>
        )
      });
      setDeleteTarget(null);
    },
    [deleteGroup, deleteTarget, notificationApi]
  );

  const columns = useMemo<TableColumnsType<MessageGroup>>(
    () => [
      {
        title: '그룹 이름',
        dataIndex: 'name',
        width: 180,
        sorter: createTextSorter((record) => record.name)
      },
      {
        title: '설명',
        dataIndex: 'description',
        width: 260,
        ellipsis: true,
        sorter: createTextSorter((record) => record.description)
      },
      {
        title: '정의 방식',
        dataIndex: 'definitionType',
        width: 130,
        ...createDefinedColumnFilterProps(
          messageGroupDefinitionTypeFilterValues,
          (record) => record.definitionType
        ),
        sorter: createTextSorter((record) => record.definitionType)
      },
      {
        title: '조건 요약',
        dataIndex: 'ruleSummary',
        ellipsis: true,
        sorter: createTextSorter((record) => record.ruleSummary)
      },
      {
        title: '예상 대상 수',
        dataIndex: 'memberCount',
        width: 130,
        align: 'right',
        sorter: createNumberSorter((record) => record.memberCount),
        render: (value: number, record) => (
          <div className="message-groups-count-cell">
            <div className="message-groups-count-value-wrap">
              <span
                className={
                  recalculatingGroupId === record.id
                    ? 'message-groups-count-value message-groups-count-value--muted'
                    : 'message-groups-count-value'
                }
              >
                {value.toLocaleString()}명
              </span>
              {recalculatingGroupId === record.id ? (
                <Spin size="small" className="message-groups-count-spinner" />
              ) : null}
            </div>
          </div>
        )
      },
      {
        title: createStatusColumnTitle('상태', ['사용중', '초안']),
        dataIndex: 'status',
        width: 100,
        ...createDefinedColumnFilterProps(
          messageGroupStatusFilterValues,
          (record) => record.status
        ),
        sorter: createTextSorter((record) => record.status),
        render: (status: string) => <StatusBadge status={status} />
      },
      {
        title: '작업',
        key: 'actions',
        width: 132,
        onCell: () => ({
          onClick: (event) => {
            event.stopPropagation();
          }
        }),
        render: (_, record) => (
          <Space size={4}>
            <Tooltip title="대상 수 재계산">
              <Button
                type="text"
                icon={<ReloadOutlined />}
                loading={recalculatingGroupId === record.id}
                onClick={() => void handleRecalculate(record)}
              />
            </Tooltip>
            <Tooltip title="그룹 삭제">
              <Button
                danger
                type="text"
                icon={<DeleteOutlined />}
                onClick={() => setDeleteTarget(record)}
              />
            </Tooltip>
          </Space>
        )
      }
    ],
    [handleRecalculate, recalculatingGroupId]
  );

  const handleRetryLoad = useCallback(() => {
    setReloadKey((prev) => prev + 1);
  }, []);

  const conditionSummaryPreview = useMemo(() => {
    if (definitionType === '정적 그룹') {
      return editorState?.type === 'edit'
        ? editorState.group.ruleSummary
        : '저장 시 정적 대상 수 요약이 자동 생성됩니다.';
    }

    if (builderMode === 'query-builder') {
      return queryPreviewText.sql || '상세 조건이 아직 없습니다.';
    }

    return editorState?.type === 'edit'
      ? editorState.group.ruleSummary
      : '저장 시 조건 요약이 자동 생성됩니다.';
  }, [builderMode, definitionType, editorState, queryPreviewText.sql]);

  const isEditingExistingGroup = editorState?.type === 'edit';
  const isDrawerPreviewLoading =
    editorState?.type === 'edit' && recalculatingGroupId === editorState.group.id;

  return (
    <div>
      {notificationContextHolder}
      <PageTitle title="대상 그룹" />

      {loadState.status === 'error' ? (
        <Alert
          type="error"
          showIcon
          style={{ marginBottom: 12 }}
          message="대상 그룹 조회에 실패했습니다."
          description={
            <Space direction="vertical" size={4}>
              <Text>{loadState.errorMessage ?? '일시적인 오류가 발생했습니다.'}</Text>
              <Text type="secondary">오류 코드: {loadState.errorCode ?? '-'}</Text>
              <Text type="secondary">
                {lastSuccessfulGroups.length > 0
                  ? '마지막 성공 목록을 유지한 상태로 화면을 계속 제공합니다.'
                  : '이전에 성공한 조회 결과가 없어 fallback 목록은 제공되지 않습니다.'}
              </Text>
              <Button onClick={handleRetryLoad}>다시 시도</Button>
            </Space>
          }
        />
      ) : null}

      <Card>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'flex-start',
            gap: 12,
            marginBottom: 8
          }}
        >
          <div style={{ flex: 1 }}>
            <SearchBar
              searchField={searchField}
              searchFieldOptions={[
                { label: '전체', value: 'all' },
                { label: '그룹 이름', value: 'name' },
                { label: '설명', value: 'description' },
                { label: '조건 요약', value: 'ruleSummary' }
              ]}
              keyword={keyword}
              onSearchFieldChange={(value) => syncSearchParams({ searchField: value })}
              onKeywordChange={(event) =>
                syncSearchParams({
                  keyword: event.target.value,
                  searchField
                })
              }
              keywordPlaceholder="검색..."
              detailTitle="상세 검색"
              detailContent={
                <SearchBarDetailField label="마지막 계산일">
                  <SearchBarDateRange
                    startDate={draftStartDate}
                    endDate={draftEndDate}
                    onChange={handleDraftDateChange}
                  />
                </SearchBarDetailField>
              }
              onApply={handleApplyDateRange}
              onDetailOpenChange={handleDetailOpenChange}
              onReset={handleDraftReset}
              summary={
                <Text type="secondary">총 {visibleGroups.length.toLocaleString()}건</Text>
              }
            />
          </div>
          <Button type="primary" size="large" icon={<PlusOutlined />} onClick={openCreateDrawer}>
            그룹 추가
          </Button>
        </div>

        <Paragraph type="secondary" style={{ marginTop: 0 }}>
          메일과 푸시에서 공용으로 사용하는 대상 그룹입니다. 행을 클릭하면 우측에서 그룹 조건과
          예상 수신자 수를 바로 조정할 수 있습니다.
        </Paragraph>

        {loadState.status !== 'pending' && visibleGroups.length === 0 ? (
          <Alert
            type="info"
            showIcon
            style={{ marginBottom: 12 }}
            message="조건에 맞는 대상 그룹이 없습니다."
            description="검색어 또는 정의 방식을 조정하거나 새 그룹을 생성하세요."
          />
        ) : null}

        <AdminDataTable<MessageGroup>
          rowKey="id"
          columns={columns}
          dataSource={visibleGroups}
          onRow={(record) => ({
            onClick: () => openEditDrawer(record),
            style: { cursor: 'pointer' }
          })}
          loading={loadState.status === 'pending'}
          pagination={false}
          scroll={{ x: 1180 }}
        />
      </Card>

      <Drawer
        open={Boolean(editorState)}
        title={editorState?.type === 'edit' ? '그룹 수정' : '그룹 추가'}
        width={920}
        onClose={closeDrawer}
        destroyOnHidden
        extra={
          editorState?.type === 'edit' ? (
            <Text type="secondary">그룹 ID: {editorState.group.id}</Text>
          ) : null
        }
        footer={
          <Space style={{ width: '100%', justifyContent: 'space-between' }}>
            <Button size="large" onClick={closeDrawer}>
              취소
            </Button>
            <Space>
              <Button size="large" onClick={() => void handlePreviewCount()}>
                조회하기
              </Button>
              <Button size="large" type="primary" onClick={() => void handleSaveGroup()}>
                저장
              </Button>
            </Space>
          </Space>
        }
      >
        <Form form={form} layout="vertical" initialValues={buildDefaultFormValues()}>
          <Form.Item hidden name="queryBuilderText">
            <Input />
          </Form.Item>

          <div className="message-groups-editor-table">
            <div className="message-groups-editor-row">
              <div className="message-groups-editor-label">그룹 이름</div>
              <div className="message-groups-editor-content">
                <Form.Item
                  name="name"
                  rules={[{ required: true, message: '그룹 이름을 입력하세요.' }]}
                  style={{ marginBottom: 0 }}
                >
                  <Input placeholder="예: 활성 학습자" />
                </Form.Item>
              </div>
            </div>

            <div className="message-groups-editor-row">
              <div className="message-groups-editor-label">설명 (선택사항)</div>
              <div className="message-groups-editor-content">
                <Form.Item name="description" style={{ marginBottom: 0 }}>
                  <Input.TextArea rows={3} placeholder="발송 대상 그룹의 목적과 사용 맥락을 적어주세요." />
                </Form.Item>
              </div>
            </div>

            <div className="message-groups-editor-row">
              <div className="message-groups-editor-label">정의 방식</div>
              <div className="message-groups-editor-content">
                <div className="message-groups-inline-fields">
                  <Form.Item
                    name="definitionType"
                    rules={[{ required: true, message: '정의 방식을 선택하세요.' }]}
                    style={{ flex: 1, marginBottom: 0 }}
                  >
                    <Select options={messageGroupDefinitionTypeOptions} />
                  </Form.Item>
                  <Form.Item
                    name="status"
                    rules={[{ required: true, message: '운영 상태를 선택하세요.' }]}
                    style={{ width: 180, marginBottom: 0 }}
                  >
                    <Select options={messageGroupStatusOptions} />
                  </Form.Item>
                </div>
              </div>
            </div>

            <div className="message-groups-editor-row">
              <div className="message-groups-editor-label">적용 채널</div>
              <div className="message-groups-editor-content">
                <Form.Item
                  name="channels"
                  rules={[{ required: true, message: '적용 채널을 하나 이상 선택하세요.' }]}
                  style={{ marginBottom: 0 }}
                >
                  <MultiCheckboxGroup
                    options={channelOptionValues}
                    value={form.getFieldValue('channels')}
                    onChange={(nextValue) => form.setFieldValue('channels', nextValue)}
                  />
                </Form.Item>
              </div>
            </div>

            {definitionType === '정적 그룹' ? (
              <div className="message-groups-editor-row">
                <div className="message-groups-editor-label">정적 대상 목록</div>
                <div className="message-groups-editor-content">
                  <Form.Item
                    name="staticMembersText"
                    rules={[{ required: true, message: '정적 대상 목록을 입력하세요.' }]}
                    style={{ marginBottom: 0 }}
                  >
                    <Input.TextArea
                      rows={10}
                      placeholder="한 줄에 하나씩 이메일 또는 사용자 식별자를 입력하세요."
                    />
                  </Form.Item>
                </div>
              </div>
            ) : (
              <>
                <div className="message-groups-editor-row">
                  <div className="message-groups-editor-label">설정 유형</div>
                  <div className="message-groups-editor-content">
                    <Form.Item name="builderMode" style={{ marginBottom: 8 }}>
                      <Radio.Group
                        disabled={isEditingExistingGroup}
                        options={messageGroupBuilderModeOptions}
                      />
                    </Form.Item>
                    {isEditingExistingGroup ? (
                      <Text type="secondary">설정 유형은 그룹 생성 후 변경할 수 없습니다.</Text>
                    ) : (
                      <Text type="secondary">
                        설정 유형을 변경하면 아래 세그먼트 편집 UI가 즉시 바뀝니다.
                      </Text>
                    )}
                  </div>
                </div>

                <div className="message-groups-editor-row">
                  <div className="message-groups-editor-label">국적</div>
                  <div className="message-groups-editor-content">
                    <Form.Item name="country" style={{ marginBottom: 0 }}>
                      <Select options={countryOptionValues} />
                    </Form.Item>
                  </div>
                </div>

                {builderMode === 'simple' ? (
                  <>
                    <div className="message-groups-editor-row">
                      <div className="message-groups-editor-label">회원 유형</div>
                      <div className="message-groups-editor-content">
                        <Form.Item name="memberTypes" style={{ marginBottom: 0 }}>
                          <MultiCheckboxGroup
                            options={memberTypeOptionValues}
                            value={form.getFieldValue('memberTypes')}
                            onChange={(nextValue) => form.setFieldValue('memberTypes', nextValue)}
                          />
                        </Form.Item>
                      </div>
                    </div>

                    <div className="message-groups-editor-row">
                      <div className="message-groups-editor-label">성별</div>
                      <div className="message-groups-editor-content">
                        <Form.Item name="genders" style={{ marginBottom: 0 }}>
                          <MultiCheckboxGroup
                            options={genderOptionValues}
                            value={form.getFieldValue('genders')}
                            onChange={(nextValue) => form.setFieldValue('genders', nextValue)}
                          />
                        </Form.Item>
                      </div>
                    </div>

                    <div className="message-groups-editor-row">
                      <div className="message-groups-editor-label">연령</div>
                      <div className="message-groups-editor-content">
                        <Space direction="vertical" style={{ width: '100%' }} size={16}>
                          <div className="message-groups-age-inputs">
                            <InputNumber
                              min={MESSAGE_GROUP_DEFAULT_AGE_RANGE[0]}
                              max={MESSAGE_GROUP_DEFAULT_AGE_RANGE[1]}
                              value={ageRange?.[0] ?? MESSAGE_GROUP_DEFAULT_AGE_RANGE[0]}
                              onChange={(value) =>
                                form.setFieldValue('ageRange', [
                                  Number(value ?? MESSAGE_GROUP_DEFAULT_AGE_RANGE[0]),
                                  Math.max(
                                    ageRange?.[1] ?? MESSAGE_GROUP_DEFAULT_AGE_RANGE[1],
                                    Number(value ?? MESSAGE_GROUP_DEFAULT_AGE_RANGE[0])
                                  )
                                ])
                              }
                            />
                            <Text>~</Text>
                            <InputNumber
                              min={MESSAGE_GROUP_DEFAULT_AGE_RANGE[0]}
                              max={MESSAGE_GROUP_DEFAULT_AGE_RANGE[1]}
                              value={ageRange?.[1] ?? MESSAGE_GROUP_DEFAULT_AGE_RANGE[1]}
                              onChange={(value) =>
                                form.setFieldValue('ageRange', [
                                  Math.min(
                                    ageRange?.[0] ?? MESSAGE_GROUP_DEFAULT_AGE_RANGE[0],
                                    Number(value ?? MESSAGE_GROUP_DEFAULT_AGE_RANGE[1])
                                  ),
                                  Number(value ?? MESSAGE_GROUP_DEFAULT_AGE_RANGE[1])
                                ])
                              }
                            />
                          </div>
                          <Form.Item name="ageRange" style={{ marginBottom: 0 }}>
                            <Slider
                              range
                              min={MESSAGE_GROUP_DEFAULT_AGE_RANGE[0]}
                              max={MESSAGE_GROUP_DEFAULT_AGE_RANGE[1]}
                            />
                          </Form.Item>
                        </Space>
                      </div>
                    </div>

                    <div className="message-groups-editor-row">
                      <div className="message-groups-editor-label">가입 방식</div>
                      <div className="message-groups-editor-content">
                        <Form.Item name="signupMethods" style={{ marginBottom: 0 }}>
                          <MultiCheckboxGroup
                            options={signupMethodOptionValues}
                            value={form.getFieldValue('signupMethods')}
                            onChange={(nextValue) => form.setFieldValue('signupMethods', nextValue)}
                          />
                        </Form.Item>
                      </div>
                    </div>

                    <div className="message-groups-editor-row">
                      <div className="message-groups-editor-label">가입 일자</div>
                      <div className="message-groups-editor-content">
                        <Form.Item name="signupDateRange" style={{ marginBottom: 0 }}>
                          <RangePicker style={{ width: '100%' }} />
                        </Form.Item>
                      </div>
                    </div>

                    <div className="message-groups-editor-row">
                      <div className="message-groups-editor-label">구독 여부</div>
                      <div className="message-groups-editor-content">
                        <Form.Item name="subscriptionStates" style={{ marginBottom: 0 }}>
                          <MultiCheckboxGroup
                            options={subscriptionOptionValues}
                            value={form.getFieldValue('subscriptionStates')}
                            onChange={(nextValue) => form.setFieldValue('subscriptionStates', nextValue)}
                          />
                        </Form.Item>
                      </div>
                    </div>

                    <div className="message-groups-editor-row">
                      <div className="message-groups-editor-label">활동 여부</div>
                      <div className="message-groups-editor-content">
                        <Form.Item name="activityStates" style={{ marginBottom: 0 }}>
                          <MultiCheckboxGroup
                            options={activityOptionValues}
                            value={form.getFieldValue('activityStates')}
                            onChange={(nextValue) => form.setFieldValue('activityStates', nextValue)}
                          />
                        </Form.Item>
                      </div>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="message-groups-editor-row">
                      <div className="message-groups-editor-label">상세 조건</div>
                      <div className="message-groups-editor-content">
                        <div className="message-groups-query-panel">
                          <QueryBuilderGroupEditor
                            group={queryBuilderConfig}
                            isRoot
                            onInteract={() => setQueryBuilderTouched(true)}
                            onChange={(nextGroup) => {
                              setQueryBuilderTouched(true);
                              setQueryBuilderConfig(nextGroup);
                            }}
                          />
                        </div>
                      </div>
                    </div>

                    <div className="message-groups-editor-row">
                      <div className="message-groups-editor-label">변환된 쿼리</div>
                      <div className="message-groups-editor-content">
                        <Space direction="vertical" style={{ width: '100%' }} size={12}>
                          <Space wrap>
                            {(
                              Object.keys(queryPreviewModeLabels) as QueryPreviewMode[]
                            ).map((mode) => (
                              <Button
                                key={mode}
                                type={queryPreviewMode === mode ? 'primary' : 'default'}
                                onClick={() => setQueryPreviewMode(mode)}
                              >
                                {queryPreviewModeLabels[mode]}
                              </Button>
                            ))}
                          </Space>
                          <Input.TextArea
                            readOnly
                            value={queryPreviewText[queryPreviewMode]}
                            autoSize={{ minRows: 5, maxRows: 10 }}
                          />
                        </Space>
                      </div>
                    </div>
                  </>
                )}
              </>
            )}
          </div>
        </Form>

        <Divider />

        <Descriptions
          size="small"
          column={1}
          bordered
          items={[
            {
              key: 'summary',
              label: '조건 요약',
              children: conditionSummaryPreview
            },
            {
              key: 'preview',
              label: '예상 발송 인원',
              children: (
                <div className="message-groups-count-value-wrap">
                  <span
                    className={
                      isDrawerPreviewLoading
                        ? 'message-groups-count-value message-groups-count-value--muted'
                        : 'message-groups-count-value'
                    }
                  >
                    {previewCount === null ? '조회하기 전' : `${previewCount.toLocaleString()}명`}
                  </span>
                  {isDrawerPreviewLoading ? (
                    <Spin size="small" className="message-groups-count-spinner" />
                  ) : null}
                </div>
              )
            },
            {
              key: 'lastCalculatedAt',
              label: '마지막 계산',
              children: editorState?.type === 'edit' ? editorState.group.lastCalculatedAt : '-'
            }
          ]}
        />
      </Drawer>

      {deleteTarget ? (
        <ConfirmAction
          open
          title="대상 그룹 삭제"
          description="공용 대상 그룹을 삭제하면 메일/푸시 템플릿에서 해당 그룹을 새로 선택할 수 없습니다. 삭제 사유를 남기세요."
          targetType="Message"
          targetId={deleteTarget.id}
          confirmText="삭제 실행"
          onCancel={() => setDeleteTarget(null)}
          onConfirm={handleDeleteGroup}
        />
      ) : null}
    </div>
  );
}
