import { Table } from 'antd';
import type { TableProps } from 'antd';
import { useMemo } from 'react';

const ACTION_COLUMN_KEYS = new Set(['action', 'actions']);
const ACTION_COLUMN_TITLES = new Set(['\uC561\uC158', '\uC791\uC5C5']);

type TableColumn<RecordType extends object> = NonNullable<
  TableProps<RecordType>['columns']
>[number];
type AdminDataTableProps<RecordType extends object> = Omit<
  TableProps<RecordType>,
  'virtual'
>;

function getColumnIdentifier(dataIndex: unknown): string | null {
  if (typeof dataIndex === 'string') {
    return dataIndex;
  }

  if (Array.isArray(dataIndex)) {
    return dataIndex.join('.');
  }

  return null;
}

function isActionColumn<RecordType extends object>(
  column: TableColumn<RecordType>
): boolean {
  if ('children' in column && Array.isArray(column.children) && column.children.length) {
    return false;
  }

  const normalizedKey =
    typeof column.key === 'string' ? column.key.trim().toLowerCase() : null;
  const normalizedDataIndex =
    getColumnIdentifier(column.dataIndex)?.trim().toLowerCase() ?? null;
  const normalizedTitle =
    typeof column.title === 'string' ? column.title.replace(/\s+/g, '') : null;

  return (
    (normalizedKey !== null && ACTION_COLUMN_KEYS.has(normalizedKey)) ||
    (normalizedDataIndex !== null && ACTION_COLUMN_KEYS.has(normalizedDataIndex)) ||
    (normalizedTitle !== null && ACTION_COLUMN_TITLES.has(normalizedTitle))
  );
}

function normalizeColumn<RecordType extends object>(
  column: TableColumn<RecordType>
): TableColumn<RecordType> {
  if ('children' in column && Array.isArray(column.children) && column.children.length) {
    return {
      ...column,
      align: column.align ?? 'left',
      children: column.children.map((child) => normalizeColumn(child))
    };
  }

  const alignedColumn =
    column.align == null
      ? {
          ...column,
          align: 'left' as const
        }
      : column;

  if (!isActionColumn(alignedColumn) || alignedColumn.fixed) {
    return alignedColumn;
  }

  return {
    ...alignedColumn,
    fixed: 'right' as const
  };
}

function hasActionColumn<RecordType extends object>(
  columns: TableProps<RecordType>['columns']
): boolean {
  if (!columns) {
    return false;
  }

  return columns.some((column) => {
    if ('children' in column && Array.isArray(column.children) && column.children.length) {
      return hasActionColumn(column.children);
    }

    return isActionColumn(column);
  });
}

export function AdminDataTable<RecordType extends object>(
  props: AdminDataTableProps<RecordType>
): JSX.Element {
  const {
    className,
    columns,
    loading,
    scroll,
    size = 'small',
    showSorterTooltip = false,
    ...rest
  } = props;

  const normalizedLoading =
    typeof loading === 'boolean'
      ? loading
        ? { spinning: true }
        : false
      : loading
        ? { ...loading }
        : loading;

  const isLoading =
    typeof normalizedLoading === 'boolean'
      ? normalizedLoading
      : Boolean(normalizedLoading?.spinning);

  const tableClassName = [
    className,
    'admin-data-table',
    isLoading ? 'admin-data-table--loading' : null
  ]
    .filter(Boolean)
    .join(' ');

  const normalizedColumns = useMemo(() => {
    if (!columns) {
      return columns;
    }

    return columns.map((column) => normalizeColumn(column));
  }, [columns]);

  const hasFixedActionColumn = useMemo(
    () => hasActionColumn(normalizedColumns),
    [normalizedColumns]
  );

  const normalizedScroll = useMemo(() => {
    if (!hasFixedActionColumn) {
      return scroll;
    }

    if (!scroll) {
      return { x: 'max-content' };
    }

    if (scroll.x != null) {
      return scroll;
    }

    return {
      ...scroll,
      x: 'max-content'
    };
  }, [hasFixedActionColumn, scroll]);

  return (
    <Table<RecordType>
      className={tableClassName}
      columns={normalizedColumns}
      loading={normalizedLoading}
      scroll={normalizedScroll}
      showSorterTooltip={showSorterTooltip}
      size={size}
      {...rest}
    />
  );
}
