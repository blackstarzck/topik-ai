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
  className,
  ...cardProps
}: AdminListCardProps): JSX.Element {
  const mergedClassName = ['admin-list-card', className].filter(Boolean).join(' ');

  return (
    <Card {...cardProps} className={mergedClassName}>
      {toolbar ? <div className="admin-list-card-toolbar">{toolbar}</div> : null}
      {children}
    </Card>
  );
}
