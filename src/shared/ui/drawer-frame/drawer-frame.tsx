import { ConfigProvider } from 'antd';
import type { DrawerProps } from 'antd';
import type { ReactNode } from 'react';

type DrawerTitleProps = {
  children: ReactNode;
};

type DrawerHeaderMetaProps = {
  children?: ReactNode;
};

type DrawerFooterProps = {
  start?: ReactNode;
  end?: ReactNode;
};

export function mergeDrawerFrameStyles(
  drawerStyles?: DrawerProps['styles']
): DrawerProps['styles'] {
  return {
    ...drawerStyles,
    footer: {
      padding: '26px 16px',
      ...drawerStyles?.footer
    }
  };
}

export function DrawerTitle({ children }: DrawerTitleProps): JSX.Element {
  return <div className="detail-drawer__title">{children}</div>;
}

export function DrawerHeaderMeta({
  children
}: DrawerHeaderMetaProps): JSX.Element | null {
  if (!children) {
    return null;
  }

  return <div className="detail-drawer__header-meta">{children}</div>;
}

export function DrawerFooter({
  start,
  end
}: DrawerFooterProps): JSX.Element | null {
  if (!start && !end) {
    return null;
  }

  return (
    <ConfigProvider componentSize="large">
      <div className="detail-drawer__footer">
        <div className="detail-drawer__footer-start">{start}</div>
        <div className="detail-drawer__footer-end">{end}</div>
      </div>
    </ConfigProvider>
  );
}
