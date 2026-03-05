import { Space } from 'antd';
import type { ReactNode } from 'react';

type FilterBarProps = {
  children: ReactNode;
};

export function FilterBar({ children }: FilterBarProps): JSX.Element {
  return (
    <div className="filter-bar">
      <Space wrap>{children}</Space>
    </div>
  );
}
