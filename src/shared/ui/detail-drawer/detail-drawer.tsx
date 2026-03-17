import { ConfigProvider, Drawer, Typography } from 'antd';
import type { DrawerProps } from 'antd';
import type { ReactNode } from 'react';

const { Title } = Typography;

type DetailDrawerProps = Omit<DrawerProps, 'title' | 'extra' | 'footer'> & {
  title: ReactNode;
  headerMeta?: ReactNode;
  footerStart?: ReactNode;
  footerEnd?: ReactNode;
};

type DetailDrawerBodyProps = {
  children: ReactNode;
};

type DetailDrawerSectionProps = {
  title: ReactNode;
  children: ReactNode;
  actions?: ReactNode;
};

export function DetailDrawer({
  title,
  headerMeta,
  footerStart,
  footerEnd,
  children,
  ...drawerProps
}: DetailDrawerProps): JSX.Element {
  const drawerStyles = drawerProps.styles;

  return (
    <Drawer
      {...drawerProps}
      styles={{
        ...drawerStyles,
        footer: {
          padding: '26px 16px',
          ...drawerStyles?.footer
        }
      }}
      title={<div className="detail-drawer__title">{title}</div>}
      extra={
        headerMeta ? (
          <div className="detail-drawer__header-meta">{headerMeta}</div>
        ) : null
      }
      footer={
        footerStart || footerEnd ? (
          <ConfigProvider componentSize="large">
            <div className="detail-drawer__footer">
              <div className="detail-drawer__footer-start">{footerStart}</div>
              <div className="detail-drawer__footer-end">{footerEnd}</div>
            </div>
          </ConfigProvider>
        ) : null
      }
    >
      {children}
    </Drawer>
  );
}

export function DetailDrawerBody({
  children
}: DetailDrawerBodyProps): JSX.Element {
  return <div className="detail-drawer__body">{children}</div>;
}

export function DetailDrawerSection({
  title,
  actions,
  children
}: DetailDrawerSectionProps): JSX.Element {
  return (
    <section className="detail-drawer__section">
      <div className="detail-drawer__section-header">
        <Title level={5} className="detail-drawer__section-title">
          {title}
        </Title>
        {actions ? (
          <div className="detail-drawer__section-actions">{actions}</div>
        ) : null}
      </div>
      {children}
    </section>
  );
}
