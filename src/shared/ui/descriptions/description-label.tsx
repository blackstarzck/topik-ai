import { InfoCircleOutlined } from '@ant-design/icons';
import { Tooltip } from 'antd';
import type { DescriptionsProps } from 'antd';
import type { ReactNode } from 'react';

type DescriptionLabelOptions = {
  required?: boolean;
  tooltip?: ReactNode;
};

export function createDescriptionLabel(
  label: ReactNode,
  options: DescriptionLabelOptions = {}
): ReactNode {
  return (
    <span className="admin-description-label">
      <span>{label}</span>
      {options.tooltip ? (
        <Tooltip title={options.tooltip}>
          <span
            className="admin-description-label__icon"
            role="img"
            aria-label={`${String(label)} 안내`}
            tabIndex={0}
          >
            <InfoCircleOutlined />
          </span>
        </Tooltip>
      ) : null}
      {options.required ? (
        <span className="admin-required-description-label__mark" aria-hidden="true">
          *
        </span>
      ) : null}
    </span>
  );
}

export function markRequiredDescriptionItems(
  items: DescriptionsProps['items'],
  requiredKeys: Array<string | number>
): DescriptionsProps['items'] {
  if (!items?.length || requiredKeys.length === 0) {
    return items;
  }

  const requiredKeySet = new Set(requiredKeys.map((key) => String(key)));

  return items.map((item) => {
    if (!item || item.key === undefined || !requiredKeySet.has(String(item.key))) {
      return item;
    }

    return {
      ...item,
      label: createDescriptionLabel(item.label, { required: true })
    };
  });
}
