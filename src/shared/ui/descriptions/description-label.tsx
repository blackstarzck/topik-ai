import type { DescriptionsProps } from 'antd';
import type { ReactNode } from 'react';

function createRequiredDescriptionLabel(label: ReactNode): ReactNode {
  return (
    <span className="admin-required-description-label">
      <span>{label}</span>
      <span className="admin-required-description-label__mark" aria-hidden="true">
        *
      </span>
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
      label: createRequiredDescriptionLabel(item.label)
    };
  });
}
