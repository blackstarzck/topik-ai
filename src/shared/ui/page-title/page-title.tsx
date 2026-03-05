import { Breadcrumb, Typography } from 'antd';
import { useMemo } from 'react';
import { useLocation } from 'react-router-dom';

import { buildAdminBreadcrumbItems } from '../../layout/admin-breadcrumb';

const { Title } = Typography;

type PageTitleProps = {
  title: string;
};

export function PageTitle({ title }: PageTitleProps): JSX.Element {
  const location = useLocation();
  const breadcrumbItems = useMemo(
    () => buildAdminBreadcrumbItems(location.pathname, location.search),
    [location.pathname, location.search]
  );

  return (
    <div className="page-title-block">
      <Title className="page-title" level={3}>
        {title}
      </Title>
      <Breadcrumb items={breadcrumbItems} className="page-breadcrumb" />
    </div>
  );
}
