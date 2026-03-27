import { MoreOutlined } from '@ant-design/icons';
import { Button, Dropdown, Space } from 'antd';
import type { MenuProps } from 'antd';
import type { MouseEvent, ReactNode } from 'react';
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

const FOOTER_ACTION_KEY_PREFIXES = [
  'delete-',
  'suspend-',
  'pause-',
  'stop-',
  'hide-',
  'revoke-'
] as const;
const FOOTER_ACTION_LABEL_KEYWORDS = ['삭제', '정지', '중지', '숨김', '회수'] as const;
const NON_FOOTER_ACTION_LABEL_KEYWORDS = ['정지해제', '중지해제', '발행재개', '운영시작', '재개', '복구'] as const;

function extractActionLabelText(label: ReactNode): string {
  if (typeof label === 'string' || typeof label === 'number') {
    return String(label);
  }

  return '';
}

function isCriticalFooterAction(item: TableActionMenuItem): boolean {
  if (item.danger) {
    return true;
  }

  const normalizedKey = item.key.toLowerCase();
  if (FOOTER_ACTION_KEY_PREFIXES.some((prefix) => normalizedKey.startsWith(prefix))) {
    return true;
  }

  const labelText = extractActionLabelText(item.label).replace(/\s+/g, '');

  if (NON_FOOTER_ACTION_LABEL_KEYWORDS.some((keyword) => labelText.includes(keyword))) {
    return false;
  }

  return FOOTER_ACTION_LABEL_KEYWORDS.some((keyword) => labelText.includes(keyword));
}

function shouldRenderActionInFooter(item: TableActionMenuItem): boolean {
  return isCriticalFooterAction(item);
}

export function TableActionMenu({
  items,
  buttonLabel = '더보기',
  footerItems = []
}: TableActionMenuProps): JSX.Element {
  const [open, setOpen] = useState(false);

  const stopTriggerPropagation = useCallback(
    (event: MouseEvent<HTMLElement>): void => {
      event.stopPropagation();
    },
    []
  );

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
    ({ key, domEvent }) => {
      domEvent.stopPropagation();
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
        onMouseDown={stopTriggerPropagation}
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
          <div className="table-action-menu__popup">
            {menuActionItems.length ? (
              <div className="table-action-menu__content">{menu}</div>
            ) : null}
              <div
                className={
                  menuActionItems.length
                    ? 'table-action-menu__footer'
                    : 'table-action-menu__footer table-action-menu__footer--standalone'
                }
              >
                <Space direction="vertical" size={8} style={{ width: '100%' }}>
                  {resolvedFooterItems.map((item) => (
                    <Button
                      key={item.key}
                      block
                      size="small"
                      type={isCriticalFooterAction(item) ? 'primary' : 'default'}
                      danger={isCriticalFooterAction(item)}
                      disabled={item.disabled}
                      className={
                        isCriticalFooterAction(item)
                          ? 'table-action-menu__footer-button table-action-menu__footer-button--critical'
                          : 'table-action-menu__footer-button'
                      }
                      onMouseDown={stopTriggerPropagation}
                      onClick={(event) => {
                        event.stopPropagation();
                        handleFooterClick(item.key);
                      }}
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
      <Button
        size="small"
        icon={<MoreOutlined />}
        onMouseDown={stopTriggerPropagation}
        onClick={stopTriggerPropagation}
      >
        {buttonLabel}
      </Button>
    </Dropdown>
  );
}
