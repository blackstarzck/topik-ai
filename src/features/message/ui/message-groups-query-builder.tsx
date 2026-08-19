import {
  Button,
  Checkbox,
  DatePicker,
  InputNumber,
  Select,
  Space,
  Typography
} from 'antd';
import { MinusCircleFilled, PlusOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';

import {
  messageGroupQueryFieldDefinitions,
  messageGroupQueryOperatorLabels
} from '../model/message-group-segment-schema';
import { createQueryGroup, createQueryRule } from '../model/message-groups-page-schema';
import type {
  MessageGroupQueryCombinator,
  MessageGroupQueryField,
  MessageGroupQueryGroup,
  MessageGroupQueryOperator,
  MessageGroupQueryRule
} from '../model/types';

const { Text } = Typography;

// 대상 그룹 쿼리 빌더 UI — Phase 4 분해로 페이지 모듈에서 이동(동작 동일).
// 전체 선택 체크박스 그룹과 재귀 그룹/규칙 편집기를 담고, 설정 상태는 호출부가 소유한다.

export type MultiCheckboxGroupProps<T extends string> = {
  value?: T[];
  options: { label: string; value: T }[];
  onChange: (next: T[]) => void;
};

export type QueryBuilderRuleRowProps = {
  rule: MessageGroupQueryRule;
  canRemove: boolean;
  onChange: (next: MessageGroupQueryRule) => void;
  onRemove: () => void;
  onInteract: () => void;
};

export type QueryBuilderGroupEditorProps = {
  group: MessageGroupQueryGroup;
  isRoot?: boolean;
  onChange: (next: MessageGroupQueryGroup) => void;
  onInteract: () => void;
  onRemove?: () => void;
};

export function MultiCheckboxGroup<T extends string>({
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

export function QueryBuilderRuleRow({
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

export function QueryBuilderGroupEditor({
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
