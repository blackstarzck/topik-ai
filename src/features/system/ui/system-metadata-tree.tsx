import { Button } from 'antd';
import { DeleteOutlined, MenuOutlined, PlusSquareOutlined } from '@ant-design/icons';
import type { DragEvent as ReactDragEvent, MouseEvent as ReactMouseEvent } from 'react';

import type { SystemMetadataItem } from '../model/system-metadata-types';
import { COLOR, SPACE } from '@/shared/styles/design-tokens';

// 설정 구조 트리 조각 — Phase 4 분해로 페이지 모듈에서 이동(동작 동일).
// 드래그 핸들·트리 항목 타이틀·추가 노드 타이틀. 트리 데이터 조립과 상태는 페이지가 소유한다.

export type MetadataItemDragHandleProps = {
  itemId: string;
  disabled: boolean;
  onDragStart: (itemId: string, event: ReactDragEvent<HTMLButtonElement>) => void;
  onDragEnd: () => void;
};

export type MetadataTreeItemTitleProps = {
  item: SystemMetadataItem;
  hovered: boolean;
  onHoverChange: (hovered: boolean) => void;
  onDelete: (item: SystemMetadataItem, event: ReactMouseEvent<HTMLElement>) => void;
};

export type MetadataTreeAddTitleProps = {
  onClick: () => void;
};

export function MetadataItemDragHandle({
  itemId,
  disabled,
  onDragStart,
  onDragEnd
}: MetadataItemDragHandleProps): JSX.Element {
  return (
    <button
      type="button"
      aria-label="운영 값 순서 변경"
      draggable={!disabled}
      disabled={disabled}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        border: 0,
        background: 'transparent',
        padding: SPACE.xxs,
        cursor: disabled ? 'not-allowed' : 'grab',
        color: COLOR.textTertiary
      }}
      onClick={(event) => {
        event.preventDefault();
        event.stopPropagation();
      }}
      onDragStart={(event) => onDragStart(itemId, event)}
      onDragEnd={onDragEnd}
    >
      <MenuOutlined />
    </button>
  );
}

export function MetadataTreeItemTitle({
  item,
  hovered,
  onHoverChange,
  onDelete
}: MetadataTreeItemTitleProps): JSX.Element {
  return (
    <span
      data-testid={`metadata-tree-item-${item.itemId}`}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: SPACE.xs,
        maxWidth: '100%'
      }}
      onMouseEnter={() => onHoverChange(true)}
      onMouseLeave={() => onHoverChange(false)}
    >
      <span>{item.label}</span>
      {hovered ? (
        <Button
          type="text"
          size="small"
          danger
          icon={<DeleteOutlined />}
          data-testid={`metadata-tree-delete-button-${item.itemId}`}
          aria-label={`운영 값 삭제 ${item.label}`}
          onClick={(event) => onDelete(item, event)}
        />
      ) : null}
    </span>
  );
}

export function MetadataTreeAddTitle({ onClick }: MetadataTreeAddTitleProps): JSX.Element {
  return (
    <span
      role="button"
      tabIndex={0}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: SPACE.xs,
        cursor: 'pointer'
      }}
      onClick={(event) => {
        event.preventDefault();
        event.stopPropagation();
        onClick();
      }}
      onKeyDown={(event) => {
        if (event.key !== 'Enter' && event.key !== ' ') {
          return;
        }
        event.preventDefault();
        event.stopPropagation();
        onClick();
      }}
    >
      <PlusSquareOutlined style={{ color: COLOR.textSecondary }} />
      <span>추가</span>
    </span>
  );
}
