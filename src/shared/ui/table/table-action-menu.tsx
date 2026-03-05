import { MoreOutlined } from '@ant-design/icons';
import { Button, Dropdown } from 'antd';
import type { MenuProps } from 'antd';
import type { ReactNode } from 'react';
import { useCallback, useMemo } from 'react';

export type TableActionMenuItem = {
  key: string;
  label: ReactNode;
  danger?: boolean;
  disabled?: boolean;
  onClick?: () => void;
};

type TableActionMenuProps = {
  items: TableActionMenuItem[];
  buttonLabel?: string;
};

export function TableActionMenu({
  items,
  buttonLabel = '더보기'
}: TableActionMenuProps): JSX.Element {
  const menuItems = useMemo<NonNullable<MenuProps['items']>>(
    () =>
      items.map(({ key, label, danger, disabled }) => ({
        key,
        label,
        danger,
        disabled
      })),
    [items]
  );

  const clickHandlers = useMemo(() => {
    const handlerMap = new Map<string, () => void>();
    items.forEach((item) => {
      if (item.onClick) {
        handlerMap.set(item.key, item.onClick);
      }
    });
    return handlerMap;
  }, [items]);

  const handleMenuClick = useCallback<NonNullable<MenuProps['onClick']>>(
    ({ key }) => {
      clickHandlers.get(String(key))?.();
    },
    [clickHandlers]
  );

  return (
    <Dropdown
      trigger={['click']}
      placement="bottomRight"
      menu={{ items: menuItems, onClick: handleMenuClick }}
    >
      <Button size="small" icon={<MoreOutlined />}>
        {buttonLabel}
      </Button>
    </Dropdown>
  );
}
