import { Drawer, Typography } from 'antd';
import type { DrawerProps } from 'antd';
import type { ReactNode } from 'react';

import {
  DrawerFooter,
  DrawerHeaderMeta,
  DrawerTitle,
  mergeDrawerFrameStyles
} from '../drawer-frame/drawer-frame';

const { Title } = Typography;

export const DETAIL_DRAWER_WIDTH = {
  compact: 640,
  medium: 720,
  default: 760
} as const;

export type DetailDrawerWidth =
  (typeof DETAIL_DRAWER_WIDTH)[keyof typeof DETAIL_DRAWER_WIDTH];

type DetailDrawerProps = Omit<DrawerProps, 'title' | 'extra' | 'footer' | 'width'> & {
  title: ReactNode;
  headerMeta?: ReactNode;
  footerStart?: ReactNode;
  footerEnd?: ReactNode;
  width?: DetailDrawerWidth;
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
  width = DETAIL_DRAWER_WIDTH.default,
  ...drawerProps
}: DetailDrawerProps): JSX.Element {
  return (
    <Drawer
      {...drawerProps}
      width={width}
      styles={mergeDrawerFrameStyles(drawerProps.styles)}
      title={<DrawerTitle>{title}</DrawerTitle>}
      extra={<DrawerHeaderMeta>{headerMeta}</DrawerHeaderMeta>}
      footer={<DrawerFooter start={footerStart} end={footerEnd} />}
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
