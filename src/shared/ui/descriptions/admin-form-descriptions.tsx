import { Descriptions } from 'antd';
import type { DescriptionsProps } from 'antd';

import { markRequiredDescriptionItems } from './description-label';

type AdminFormDescriptionsProps = Omit<DescriptionsProps, 'items'> & {
  items: DescriptionsProps['items'];
  requiredKeys?: Array<string | number>;
};

export function AdminFormDescriptions({
  items,
  requiredKeys = [],
  className,
  ...descriptionsProps
}: AdminFormDescriptionsProps): JSX.Element {
  const mergedClassName = ['admin-form-descriptions', className]
    .filter(Boolean)
    .join(' ');

  return (
    <Descriptions
      {...descriptionsProps}
      className={mergedClassName}
      items={markRequiredDescriptionItems(items, requiredKeys)}
    />
  );
}
