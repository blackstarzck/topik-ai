import { Card } from 'antd';
import type { CardProps } from 'antd';
import type { ReactNode } from 'react';

type AdminListCardProps = {
  toolbar?: ReactNode;
  children: ReactNode;
} & CardProps;

export function AdminListCard({
  toolbar,
  children,
  ...cardProps
}: AdminListCardProps): JSX.Element {
  return (
    <Card {...cardProps}>
      {toolbar ? <div className="admin-list-card-toolbar">{toolbar}</div> : null}
      {children}
    </Card>
  );
}
