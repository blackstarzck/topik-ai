import { MoreOutlined } from '@ant-design/icons';
import { Button, Dropdown, Space } from 'antd';
import type { MenuProps } from 'antd';
import type { ReactNode } from 'react';
import { useCallback, useMemo, useState } from 'react';

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
  footerItems?: TableActionMenuItem[];
};

const FOOTER_ACTION_KEY_PREFIXES = ['delete-', 'suspend-'] as const;
const FOOTER_ACTION_LABEL_KEYWORDS = ['삭제', '정지'] as const;

function extractActionLabelText(label: ReactNode): string {
  if (typeof label === 'string' || typeof label === 'number') {
    return String(label);
  }

  return '';
}

function shouldRenderActionInFooter(item: TableActionMenuItem): boolean {
  const normalizedKey = item.key.toLowerCase();
  if (FOOTER_ACTION_KEY_PREFIXES.some((prefix) => normalizedKey.startsWith(prefix))) {
    return true;
  }

  const labelText = extractActionLabelText(item.label).replace(/\s+/g, '');

  if (labelText.includes('정지해제')) {
    return false;
  }

  return FOOTER_ACTION_LABEL_KEYWORDS.some((keyword) => labelText.includes(keyword));
}

export function TableActionMenu({
  items,
  buttonLabel = '더보기',
  footerItems = []
}: TableActionMenuProps): JSX.Element {
  const [open, setOpen] = useState(false);

  const menuActionItems = useMemo(
    () => items.filter((item) => !shouldRenderActionInFooter(item)),
    [items]
  );

  const resolvedFooterItems = useMemo(() => {
    const footerMap = new Map<string, TableActionMenuItem>();

    items.filter(shouldRenderActionInFooter).forEach((item) => {
      footerMap.set(item.key, item);
    });

    footerItems.forEach((item) => {
      footerMap.set(item.key, item);
    });

    return Array.from(footerMap.values());
  }, [footerItems, items]);

  const menuItems = useMemo<NonNullable<MenuProps['items']>>(
    () =>
      menuActionItems.map(({ key, label, danger, disabled }) => ({
        key,
        label,
        danger,
        disabled
      })),
    [menuActionItems]
  );

  const clickHandlers = useMemo(() => {
    const handlerMap = new Map<string, () => void>();
    [...menuActionItems, ...resolvedFooterItems].forEach((item) => {
      if (item.onClick) {
        handlerMap.set(item.key, item.onClick);
      }
    });
    return handlerMap;
  }, [menuActionItems, resolvedFooterItems]);

  const handleMenuClick = useCallback<NonNullable<MenuProps['onClick']>>(
    ({ key }) => {
      clickHandlers.get(String(key))?.();
      setOpen(false);
    },
    [clickHandlers]
  );

  const handleFooterClick = useCallback(
    (key: string) => {
      clickHandlers.get(key)?.();
      setOpen(false);
    },
    [clickHandlers]
  );

  const singleActionItem = useMemo(() => {
    const allActionItems = [...menuActionItems, ...resolvedFooterItems];
    return allActionItems.length === 1 ? allActionItems[0] : null;
  }, [menuActionItems, resolvedFooterItems]);

  if (singleActionItem) {
    return (
      <Button
        size="small"
        type={singleActionItem.danger ? 'text' : 'default'}
        danger={singleActionItem.danger}
        disabled={singleActionItem.disabled}
        onClick={(event) => {
          event.stopPropagation();
          singleActionItem.onClick?.();
        }}
      >
        {singleActionItem.label}
      </Button>
    );
  }

  return (
    <Dropdown
      open={open}
      trigger={['click']}
      placement="bottomRight"
      onOpenChange={setOpen}
      menu={{
        items: menuItems,
        onClick: handleMenuClick,
        style: resolvedFooterItems.length
          ? {
              boxShadow: 'none',
              border: 'none',
              borderRadius: 0
            }
          : undefined
      }}
      popupRender={(menu) =>
        resolvedFooterItems.length ? (
          <div
            style={{
              minWidth: 176,
              overflow: 'hidden',
              borderRadius: 12,
              background: '#fff',
              boxShadow:
                '0 6px 16px 0 rgba(0, 0, 0, 0.08), 0 3px 6px -4px rgba(0, 0, 0, 0.12), 0 9px 28px 8px rgba(0, 0, 0, 0.05)'
              }}
            >
              {menuActionItems.length ? menu : null}
              <div
                style={{
                  padding: 8,
                  borderTop: menuActionItems.length ? '1px solid #f0f0f0' : 'none'
                }}
              >
                <Space direction="vertical" size={8} style={{ width: '100%' }}>
                  {resolvedFooterItems.map((item) => (
                    <Button
                      key={item.key}
                      block
                      size="small"
                      type={item.danger ? 'primary' : 'default'}
                      danger={item.danger}
                      disabled={item.disabled}
                      onClick={() => handleFooterClick(item.key)}
                    >
                      {item.label}
                    </Button>
                  ))}
                </Space>
            </div>
          </div>
        ) : (
          menu
        )
      }
    >
      <Button size="small" icon={<MoreOutlined />}>
        {buttonLabel}
      </Button>
    </Dropdown>
  );
}
