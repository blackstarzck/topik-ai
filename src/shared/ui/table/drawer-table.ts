import type {
  TableColumnsType,
  TablePaginationConfig,
  TableProps
} from 'antd';

export const DRAWER_SECTION_GAP = 32;
export const DRAWER_TABLE_BODY_MAX_HEIGHT = 280;
export const DRAWER_TABLE_PAGINATION: TablePaginationConfig = {
  pageSize: 5,
  showSizeChanger: false,
  position: ['bottomRight']
};

type DrawerTableScroll = NonNullable<TableProps<object>['scroll']>;

export function createDrawerTableScroll(
  x: string | number | true = 'max-content'
): DrawerTableScroll {
  return {
    x,
    y: DRAWER_TABLE_BODY_MAX_HEIGHT
  };
}

export function fixDrawerTableFirstColumn<RecordType extends object>(
  columns: TableColumnsType<RecordType>
): TableColumnsType<RecordType> {
  return columns.map((column, index) => {
    if (index !== 0 || 'children' in column) {
      return column;
    }

    return {
      ...column,
      fixed: 'left'
    };
  });
}
