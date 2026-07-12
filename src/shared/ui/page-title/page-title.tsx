import { Breadcrumb, Typography } from 'antd';
import { useMemo } from 'react';
import type { ReactNode } from 'react';
import { useLocation } from 'react-router-dom';

import { buildAdminBreadcrumbItems } from '../../layout/admin-breadcrumb';

const { Title } = Typography;

type PageTitleProps = {
  title: string;
  description?: ReactNode;
  actions?: ReactNode;
  meta?: ReactNode;
  breadcrumbFirst?: boolean;
};

export function PageTitle({
  title,
  description,
  actions,
  meta,
  breadcrumbFirst = false
}: PageTitleProps): JSX.Element {
  const location = useLocation();
  const breadcrumbItems = useMemo(
    () => buildAdminBreadcrumbItems(location.pathname, location.search),
    [location.pathname, location.search]
  );

  const breadcrumb = <Breadcrumb items={breadcrumbItems} className="page-breadcrumb" />;

  return (
    <div className="page-title-block">
      {breadcrumbFirst ? breadcrumb : null}
      <div className="page-title-block__row">
        <div className="page-title-block__copy">
          <Title className="page-title" level={3}>
            {title}
          </Title>
          {description ? <div className="page-title-description">{description}</div> : null}
        </div>
        {actions || meta ? (
          <div className="page-title-block__aside">
            {actions ? <div className="page-title-actions">{actions}</div> : null}
            {meta ? <div className="page-title-meta">{meta}</div> : null}
          </div>
        ) : null}
      </div>
      {breadcrumbFirst ? null : breadcrumb}
    </div>
  );
}
